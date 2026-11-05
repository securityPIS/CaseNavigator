import { useCallback, useEffect, useRef, useState } from 'react'

export interface RecordedMedia {
  blob: Blob
  mime: string
  durationSec: number
}

export interface MediaRecorderState {
  /** The browser can record at all. */
  supported: boolean
  recording: boolean
  /** Seconds since recording started. */
  elapsed: number
  /** The live stream — for a camera preview while recording. */
  stream: MediaStream | null
  /** 'not-allowed', 'not-found', … — set when the devices can't be opened. */
  error: string | null
  start: (want: { audio: boolean; video: boolean }) => Promise<boolean>
  /** Stops and resolves with the recording, or null if nothing was captured. */
  stop: () => Promise<RecordedMedia | null>
  /** Stops and throws the recording away. */
  cancel: () => void
}

const VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
const VIDEO_ONLY_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

function pickType(candidates: string[]): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

/**
 * Records from the microphone and/or camera with MediaRecorder. The devices
 * are released as soon as recording stops or the component unmounts, so the
 * camera light never stays on behind the investigator's back.
 */
export function useMediaRecorder(): MediaRecorderState {
  const supported =
    typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const release = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)
    setRecording(false)
  }, [])

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      release()
    },
    [release],
  )

  const start = useCallback(
    async (want: { audio: boolean; video: boolean }) => {
      if (!supported || recorderRef.current?.state === 'recording') return false
      setError(null)
      try {
        const media = await navigator.mediaDevices.getUserMedia({ audio: want.audio, video: want.video })
        const mimeType = pickType(want.video ? (want.audio ? VIDEO_TYPES : VIDEO_ONLY_TYPES) : AUDIO_TYPES)
        const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
        chunksRef.current = []
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        rec.start(1000)
        recorderRef.current = rec
        streamRef.current = media
        startedRef.current = Date.now()
        setStream(media)
        setElapsed(0)
        setRecording(true)
        timerRef.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedRef.current) / 1000)), 500)
        return true
      } catch (e) {
        const name = (e as DOMException)?.name
        setError(name === 'NotAllowedError' ? 'not-allowed' : name === 'NotFoundError' ? 'not-found' : 'failed')
        release()
        return false
      }
    },
    [supported, release],
  )

  const stop = useCallback(
    () =>
      new Promise<RecordedMedia | null>((resolve) => {
        const rec = recorderRef.current
        if (!rec || rec.state !== 'recording') {
          release()
          resolve(null)
          return
        }
        rec.onstop = () => {
          const mime = rec.mimeType || chunksRef.current[0]?.type || 'application/octet-stream'
          const blob = new Blob(chunksRef.current, { type: mime })
          const durationSec = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000))
          recorderRef.current = null
          release()
          resolve(blob.size > 0 ? { blob, mime, durationSec } : null)
        }
        rec.stop()
      }),
    [release],
  )

  const cancel = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state === 'recording') {
      rec.onstop = null
      rec.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
    release()
  }, [release])

  return { supported, recording, elapsed, stream, error, start, stop, cancel }
}

export const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
