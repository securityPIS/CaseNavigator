import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * The Web Speech API is not part of TypeScript's DOM lib, so the minimal shape
 * we actually touch is declared here. Chromium exposes it as
 * `webkitSpeechRecognition`; the standard name is `SpeechRecognition`.
 */
interface SpeechAlternative {
  transcript: string
}
interface SpeechResult {
  isFinal: boolean
  0: SpeechAlternative
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechResult>
}
interface SpeechRecognitionErrorLike {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface Dictation {
  /** The browser can transcribe speech at all. */
  supported: boolean
  /** A session is running and the mic is live. */
  listening: boolean
  /** The not-yet-final phrase, updated live while speaking. */
  interim: string
  /** Last error code from the engine ('not-allowed', 'no-speech', …). */
  error: string | null
  start: () => void
  stop: () => void
  toggle: () => void
}

/**
 * Live speech-to-text for a single answer field. Final phrases are handed to
 * `onFinal` as they settle so the caller can append them to the answer; the
 * answer stays a plain editable value, so the investigator can correct anything
 * the engine mishears. Defaults to Indonesian.
 */
export function useDictation({
  lang = 'id-ID',
  onFinal,
}: {
  lang?: string
  onFinal: (text: string) => void
}): Dictation {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recRef = useRef<SpeechRecognitionLike | null>(null)
  // Keep the latest callback without re-creating the recognition session.
  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  const supported = getRecognitionCtor() !== null

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    // Never run two sessions from the same field at once.
    recRef.current?.abort()

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let pending = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const transcript = res[0].transcript
        if (res.isFinal) onFinalRef.current(transcript)
        else pending += transcript
      }
      setInterim(pending)
    }
    rec.onerror = (e) => {
      setError(e.error)
      setListening(false)
      setInterim('')
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
      recRef.current = null
    }

    recRef.current = rec
    setError(null)
    try {
      rec.start()
      setListening(true)
    } catch {
      // start() throws if a session is somehow still live — ignore.
    }
  }, [lang])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  // Stop the mic if the field unmounts mid-recording.
  useEffect(() => () => recRef.current?.abort(), [])

  return { supported, listening, interim, error, start, stop, toggle }
}
