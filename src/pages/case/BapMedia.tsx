import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Clapperboard, Mic, Plus, Search, Square, Trash2, Video, X } from 'lucide-react'
import { db } from '@/domain/db'
import type { Bap, BapRecording, MediaClip, Question, QuestionSet, RecordingMode } from '@/domain/types'
import { cn, formatDateTime, uid } from '@/lib/utils'
import { Badge, Button, IconButton, Input } from '@/components/ui/primitives'
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
  const [mode, setMode] = useState<RecordingMode>('av')
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const previewRef = useRef<HTMLVideoElement>(null)
  const recordings = bap.recordings ?? []
  const [activeMode, setActiveMode] = useState<RecordingMode>('av')

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = media.stream
  }, [media.stream])

  const start = async () => {
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
            <div className="space-y-3">
              {live.video ? (
                <video ref={previewRef} autoPlay muted playsInline className="aspect-video w-full max-w-[560px] rounded-lg border border-danger/40 bg-black object-cover" />
              ) : (
                <div className="flex h-20 max-w-[560px] items-center justify-center gap-1 rounded-lg border border-danger/30 bg-danger/6">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-1 animate-pulse rounded-full bg-danger/70"
                      style={{ height: `${12 + ((i * 37) % 40)}px`, animationDelay: `${(i % 6) * 120}ms` }}
                    />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Badge color="#EF4444" size="sm" dot>
                  Merekam · {live.label}
                </Badge>
                <div className="flex-1" />
                <Button size="sm" variant="ghost" icon={<X size={12} />} onClick={media.cancel}>
                  Batal
                </Button>
                <Button size="sm" variant="danger" icon={<Square size={11} className="fill-current" />} onClick={stop} loading={saving}>
                  Berhenti & simpan
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div role="group" aria-label="Jenis rekaman" className="flex gap-1">
                {(Object.keys(MODE_META) as RecordingMode[]).map((k) => {
                  const m = MODE_META[k]
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMode(k)}
                      className={cn(
                        'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] transition-colors',
                        mode === k ? 'border-brand/50 bg-brand/12 font-medium text-brand-bright' : 'border-line bg-abyss/40 text-ink-3 hover:border-line-strong',
                      )}
                    >
                      <m.icon size={12} /> {m.label}
                    </button>
                  )
                })}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-ink-2">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="size-4 accent-[#3B82F6]" />
                Terperiksa menyetujui perekaman
              </label>
              <div className="flex-1" />
              <Button size="sm" variant="primary" icon={<Circle size={10} className="fill-current" />} onClick={start} disabled={!consent}>
                Mulai rekam
              </Button>
            </div>
          )}
          {media.error && !media.recording && <p className="mt-2 text-[11px] text-warn">{MEDIA_ERROR[media.error]}</p>}
        </div>
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
