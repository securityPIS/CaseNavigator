import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Circle, Clapperboard, Maximize2, Mic, MicOff, Minimize2, Pause, Plus, Search, Square, Trash2, Video, VideoOff, X } from 'lucide-react'
import { db } from '@/domain/db'
import type { Bap, BapRecording, MediaClip, Question, QuestionSet, RecordingMode } from '@/domain/types'
import { cn, formatDateTime, uid } from '@/lib/utils'
import { Button, IconButton, Input } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useBlobPreview } from '@/components/ui/BlobPreview'
import { formatDuration, useMediaRecorder } from '@/hooks/useMediaRecorder'
import { toast } from '@/stores/toast'

/* ---------------------------------------------------------------- Player */

/** Plays a stored clip — video when it has a picture, audio otherwise. */
export function ClipPlayer({ clip, video, className }: { clip: MediaClip; video?: boolean; className?: string }) {
  const { url, loading } = useBlobPreview(clip.blobId, clip.mime.startsWith('text/') ? 'application/octet-stream' : clip.mime)
  if (loading) return <div className={cn('text-[11px] text-ink-4', className)}>Memuat rekaman…</div>
  if (!url) return <div className={cn('text-[11px] text-warn', className)}>Rekaman tidak ditemukan di browser ini.</div>
  return video ? (
    <video src={url} controls playsInline className={cn('w-full rounded-lg border border-line bg-black', className)} />
  ) : (
    <audio src={url} controls className={cn('h-9 w-full', className)} />
  )
}

/** Stores a recorded blob and returns its clip record. */
export async function storeClip(blob: Blob, mime: string, durationSec: number): Promise<MediaClip> {
  const blobId = uid('blob')
  await db.blobs.add({ id: blobId, data: blob })
  return { blobId, mime, size: blob.size, durationSec, recordedAt: new Date().toISOString() }
}

const MEDIA_ERROR: Record<string, string> = {
  'not-allowed': 'Izin kamera/mikrofon ditolak browser.',
  'not-found': 'Kamera atau mikrofon tidak ditemukan.',
  failed: 'Perangkat tidak dapat dibuka.',
}

/* ----------------------------------------------------- Session recording */

const MODE_META: Record<RecordingMode, { label: string; icon: typeof Video; audio: boolean; video: boolean }> = {
  av: { label: 'Audio + Video', icon: Clapperboard, audio: true, video: true },
  video: { label: 'Video saja', icon: Video, audio: false, video: true },
  audio: { label: 'Audio saja', icon: Mic, audio: true, video: false },
}

/**
 * Recording of the examination session, kept with the BAP. The investigator
 * chooses audio, video or both; the terperiksa's consent is confirmed first,
 * as TKO B14-002 (III.14) requires.
 */
export function SessionRecorder({ bap, locked, recordedBy }: { bap: Bap; locked: boolean; recordedBy: string }) {
  const media = useMediaRecorder()
  // Two switches, both on by default: video and audio together, or either
  // one alone.
  const [videoOn, setVideoOn] = useState(true)
  const [audioOn, setAudioOn] = useState(true)
  const mode: RecordingMode | null = videoOn && audioOn ? 'av' : videoOn ? 'video' : audioOn ? 'audio' : null
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const recordings = bap.recordings ?? []
  const [activeMode, setActiveMode] = useState<RecordingMode>('av')

  const start = async () => {
    if (!mode) return
    const m = MODE_META[mode]
    setActiveMode(mode)
    const ok = await media.start({ audio: m.audio, video: m.video })
    if (!ok) toast.error('Tidak dapat merekam', MEDIA_ERROR[media.error ?? 'failed'] ?? 'Periksa izin perangkat.')
  }

  const stop = async () => {
    setSaving(true)
    try {
      const res = await media.stop()
      if (!res) return
      const clip = await storeClip(res.blob, res.mime, res.durationSec)
      const rec: BapRecording = { ...clip, id: uid('rec'), mode: activeMode, recordedBy, consent }
      await db.baps.update(bap.id, { recordings: [...recordings, rec], updatedAt: new Date().toISOString() })
      toast.success('Rekaman disimpan', `${MODE_META[activeMode].label} · ${formatDuration(res.durationSec)}`)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r: BapRecording) => {
    if (!window.confirm('Hapus rekaman ini? Tindakan ini tidak dapat dibatalkan.')) return
    await db.blobs.delete(r.blobId)
    await db.baps.update(bap.id, { recordings: recordings.filter((x) => x.id !== r.id), updatedAt: new Date().toISOString() })
    toast.success('Rekaman dihapus')
  }

  const live = MODE_META[activeMode]

  return (
    <div className="border-t border-line-soft p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
          <Clapperboard size={12} className="text-brand-bright" /> Rekaman pemeriksaan
          <span className="font-normal normal-case tracking-normal text-ink-4 tnum">· {recordings.length}</span>
        </h4>
        {media.recording && (
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-danger">
            <span className="size-2 animate-pulse rounded-full bg-danger" /> REC {formatDuration(media.elapsed)}
          </span>
        )}
      </div>

      {!locked && !media.supported && (
        <p className="rounded-lg border border-line-soft bg-abyss/25 px-3 py-2 text-[11.5px] text-ink-4">Browser ini tidak mendukung perekaman.</p>
      )}

      {!locked && media.supported && (
        <div className="rounded-xl border border-line-soft bg-abyss/30 p-3">
          {media.recording ? (
            // The camera shows in the floating window; here, only a notice.
            <div className="flex flex-wrap items-center gap-3">
              <span className="relative flex size-3 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger/60" />
                <span className="relative inline-flex size-3 rounded-full bg-danger" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-ink">
                  {media.paused ? 'Perekaman dijeda' : `Sedang merekam ${live.video ? 'video' : 'audio'}`} ·{' '}
                  <span className="tnum">{formatDuration(media.elapsed)}</span>
                  {media.muted && <span className="ml-2 text-[11px] font-normal text-warn">mikrofon dimatikan</span>}
                </p>
                <p className="text-[11px] text-ink-4">{live.label} · kontrol rekaman ada di jendela kanan atas.</p>
              </div>
              <Button size="sm" variant="danger" icon={<Square size={11} className="fill-current" />} onClick={stop} loading={saving}>
                Berhenti & simpan
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div role="group" aria-label="Yang direkam" className="flex gap-1.5">
                {[
                  { label: 'Video', on: videoOn, set: setVideoOn, Icon: videoOn ? Video : VideoOff },
                  { label: 'Audio', on: audioOn, set: setAudioOn, Icon: audioOn ? Mic : MicOff },
                ].map(({ label, on, set, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set(!on)}
                    className={cn(
                      'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11.5px] transition-colors',
                      on ? 'border-brand/50 bg-brand/12 font-medium text-brand-bright' : 'border-line bg-abyss/40 text-ink-4 hover:border-line-strong',
                    )}
                  >
                    <Icon size={13} /> {label}
                    <span className={cn('ml-0.5 text-[9.5px] font-semibold', on ? 'text-brand-bright' : 'text-ink-4')}>{on ? 'ON' : 'OFF'}</span>
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-ink-2">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="size-4 accent-[#3B82F6]" />
                Terperiksa menyetujui perekaman
              </label>
              <div className="flex-1" />
              <Button size="sm" variant="primary" icon={<Circle size={10} className="fill-current" />} onClick={start} disabled={!consent || !mode}>
                Mulai rekam
              </Button>
            </div>
          )}
          {!media.recording && !mode && <p className="mt-2 text-[11px] text-warn">Nyalakan video, audio, atau keduanya untuk merekam.</p>}
          {media.error && !media.recording && <p className="mt-2 text-[11px] text-warn">{MEDIA_ERROR[media.error]}</p>}
        </div>
      )}

      {media.recording && (
        <RecordingWindow
          stream={media.stream}
          video={live.video}
          audio={live.audio}
          label={live.label}
          elapsed={media.elapsed}
          paused={media.paused}
          muted={media.muted}
          saving={saving}
          onPause={media.pause}
          onResume={media.resume}
          onToggleMute={media.toggleMute}
          onStop={stop}
          onCancel={media.cancel}
        />
      )}

      {recordings.length > 0 ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {recordings.map((r, i) => {
            const m = MODE_META[r.mode]
            return (
              <div key={r.id} className="rounded-lg border border-line-soft bg-abyss/25 p-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <m.icon size={13} className="shrink-0 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">
                      Rekaman {i + 1} · {m.label} · <span className="tnum">{formatDuration(r.durationSec)}</span>
                    </p>
                    <p className="truncate text-[10.5px] text-ink-4">
                      {formatDateTime(r.recordedAt)} · {r.recordedBy}
                      {r.consent && ' · disetujui terperiksa'}
                    </p>
                  </div>
                  {!locked && (
                    <IconButton label="Hapus rekaman" size={24} className="hover:text-danger" onClick={() => remove(r)}>
                      <Trash2 size={12} />
                    </IconButton>
                  )}
                </div>
                <ClipPlayer clip={r} video={m.video} />
              </div>
            )
          })}
        </div>
      ) : (
        locked && <p className="text-[11.5px] text-ink-4">Tidak ada rekaman pada BAP ini.</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------ Recording window */

function WindowButton({
  label,
  onClick,
  danger,
  active,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  active?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-9 items-center justify-center rounded-full text-white backdrop-blur-sm transition-colors disabled:opacity-50',
        danger ? 'bg-[#EF4444] hover:bg-[#DC2626]' : active ? 'bg-white/30 hover:bg-white/40' : 'bg-white/12 hover:bg-white/24',
      )}
    >
      {children}
    </button>
  )
}

/**
 * The live recording, floating in the top-right corner over whatever the
 * investigator is doing — like picture-in-picture, but inside the app, so it
 * stays put while they scroll through the questions. Its own controls pause
 * and resume, mute the microphone, and stop.
 */
function RecordingWindow({
  stream,
  video,
  audio,
  label,
  elapsed,
  paused,
  muted,
  saving,
  onPause,
  onResume,
  onToggleMute,
  onStop,
  onCancel,
}: {
  stream: MediaStream | null
  video: boolean
  audio: boolean
  label: string
  elapsed: number
  paused: boolean
  muted: boolean
  saving: boolean
  onPause: () => void
  onResume: () => void
  onToggleMute: () => void
  onStop: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [small, setSmall] = useState(false)

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream, small])

  const status = (
    <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
      {paused ? <Pause size={10} className="fill-current" /> : <span className="size-2 animate-pulse rounded-full bg-[#EF4444]" />}
      {paused ? 'DIJEDA' : 'REC'} <span className="tnum font-medium">{formatDuration(elapsed)}</span>
    </span>
  )

  const controls = (
    <>
      {paused ? (
        <WindowButton label="Lanjut merekam" onClick={onResume}>
          <Circle size={13} className="fill-[#EF4444] text-[#EF4444]" />
        </WindowButton>
      ) : (
        <WindowButton label="Jeda rekaman" onClick={onPause}>
          <Pause size={15} className="fill-current" />
        </WindowButton>
      )}
      {audio && (
        <WindowButton label={muted ? 'Nyalakan mikrofon' : 'Matikan mikrofon'} onClick={onToggleMute} active={muted}>
          {muted ? <MicOff size={15} /> : <Mic size={15} />}
        </WindowButton>
      )}
      <WindowButton label="Berhenti & simpan" onClick={onStop} danger disabled={saving}>
        <Square size={13} className="fill-current" />
      </WindowButton>
    </>
  )

  return createPortal(
    <div
      role="region"
      aria-label="Perekaman berlangsung"
      className="fixed right-4 top-[72px] z-[150] overflow-hidden rounded-2xl border border-[#EF4444]/60 bg-[#0B0F19] shadow-[0_20px_60px_-12px_rgb(0_0_0/0.75)] animate-scale-in"
      style={{ width: small ? 'auto' : 'min(360px, calc(100vw - 32px))' }}
    >
      {small ? (
        <div className="flex items-center gap-2 p-1.5 pl-2.5">
          {status}
          {controls}
          <WindowButton label="Perbesar jendela" onClick={() => setSmall(false)}>
            <Maximize2 size={14} />
          </WindowButton>
        </div>
      ) : (
        <div className="relative">
          {video ? (
            <video
              ref={ref}
              autoPlay
              muted
              playsInline
              disablePictureInPicture
              className={cn('block aspect-video w-full bg-black object-cover', paused && 'opacity-50')}
            />
          ) : (
            <div className="flex h-[120px] items-center justify-center gap-1 bg-gradient-to-b from-[#2A0E14] to-[#0B0F19]">
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className={cn('w-1 rounded-full bg-[#EF4444]/80', !paused && !muted && 'animate-pulse')}
                  style={{ height: paused || muted ? 4 : `${10 + ((i * 37) % 44)}px`, animationDelay: `${(i % 7) * 110}ms` }}
                />
              ))}
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
            {status}
            <div className="flex gap-1">
              <WindowButton label="Perkecil jendela" onClick={() => setSmall(true)}>
                <Minimize2 size={14} />
              </WindowButton>
              <WindowButton label="Batalkan rekaman" onClick={onCancel}>
                <X size={15} />
              </WindowButton>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-8">
            <span className="truncate text-[11px] font-medium text-white/85">
              {label}
              {muted && ' · mikrofon mati'}
            </span>
            <div className="flex shrink-0 gap-1.5">{controls}</div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------ Template picker */

/**
 * Adds questions to a BAP from any question-set template. Questions already
 * on the BAP are left out; a question dropped from the BAP's own set comes
 * back in place.
 */
export function TemplateQuestionPicker({
  sets,
  questions,
  present,
  onPick,
  onClose,
}: {
  sets: QuestionSet[]
  questions: Question[]
  /** Template question ids already on the BAP. */
  present: Set<string>
  onPick: (q: Question) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sets
      .map((s) => ({
        set: s,
        items: questions
          .filter((x) => x.setId === s.id && !present.has(x.id) && (!q || x.label.toLowerCase().includes(q)))
          .sort((a, b) => a.order - b.order),
      }))
      .filter((g) => g.items.length > 0)
  }, [sets, questions, present, query])

  return (
    <Modal open onClose={onClose} size="md" title="Tambah pertanyaan dari template" description="Pertanyaan dari question set di Admin → Questions Customization. Berlaku untuk BAP ini saja.">
      <div className="space-y-3">
        <Input icon={<Search size={13} />} placeholder="Cari pertanyaan…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 text-[12px]" />
        <div className="max-h-[55dvh] space-y-4 overflow-y-auto pr-1">
          {groups.length === 0 && <p className="py-6 text-center text-[12px] text-ink-4">Semua pertanyaan template sudah ada di BAP ini.</p>}
          {groups.map((g) => (
            <div key={g.set.id}>
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">{g.set.name}</p>
              <div className="space-y-1">
                {g.items.map((q) => (
                  <div key={q.id} className="flex items-start gap-3 rounded-lg border border-line-soft bg-abyss/30 px-3 py-2">
                    <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-2">{q.label}</p>
                    <Button size="xs" variant="outline" icon={<Plus size={11} />} onClick={() => onPick(q)}>
                      Tambah
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
