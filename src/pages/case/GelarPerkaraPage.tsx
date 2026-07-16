import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  Download,
  FileText,
  Gavel,
  MapPin,
  Paperclip,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { GelarDoc, GelarPerkara, GelarStatus } from '@/domain/types'
import { cn, formatBytes, formatDateTime, uid } from '@/lib/utils'
import { Badge, Button, EmptyState, IconButton, Input, Select, Textarea, tone } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'

const STATUS_META: Record<GelarStatus, { label: string; color: string }> = {
  'lanjut-sprint': { label: 'Lanjut SPRINT', color: '#3B82F6' },
  'gelar-lanjutan': { label: 'Gelar Perkara Lanjutan', color: '#F59E0B' },
  close: { label: 'Close', color: '#10B981' },
}

/** ISO → value for a <input type="datetime-local">, corrected to local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function GelarPerkaraPage() {
  const { caseId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const openId = params.get('id')

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<GelarStatus | 'all'>('all')
  const [creating, setCreating] = useState(false)

  const items = useLiveQuery(
    () => db.gelarPerkara.where('caseId').equals(caseId).reverse().sortBy('scheduledAt'),
    [caseId],
    [],
  )

  const open = useMemo(() => items.find((g) => g.id === openId) ?? null, [items, openId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((g) => {
      if (status !== 'all' && g.status !== status) return false
      if (!q) return true
      return (
        g.title.toLowerCase().includes(q) ||
        g.number.toLowerCase().includes(q) ||
        g.conclusion.toLowerCase().includes(q) ||
        (g.location ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, query, status])

  const select = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('id', id)
        else next.delete('id')
        return next
      },
      { replace: true },
    )

  return (
    <div className="flex h-full">
      {/* List column */}
      <div
        className={cn(
          'flex w-full shrink-0 flex-col border-r border-line-soft md:w-[360px]',
          open && 'hidden md:flex',
        )}
      >
        {/* Toolbar */}
        <div className="shrink-0 border-b border-line-soft p-3">
          <div className="flex items-center gap-2">
            <Input
              icon={<Search size={13} />}
              placeholder="Cari judul, nomor, kesimpulan…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-[12px]"
            />
            <Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={() => setCreating(true)}>
              Baru
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-[150px]">
              <Select
                className="h-8 text-[12px]"
                value={status}
                onChange={(e) => setStatus(e.target.value as GelarStatus | 'all')}
                options={[
                  { value: 'all', label: 'Semua status' },
                  ...Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label })),
                ]}
              />
            </div>
            <span className="ml-auto text-[11px] text-ink-4 tnum">{items.length} gelar perkara</span>
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Gavel size={22} />}
              title={items.length === 0 ? 'Belum ada gelar perkara' : 'Tidak ada yang cocok dengan filter'}
              description={
                items.length === 0
                  ? 'Catat setiap gelar perkara: waktu, evidence yang dibahas, dokumentasi, dan kesimpulan hasilnya. Tersimpan lokal di browser ini.'
                  : 'Coba ganti status atau hapus kata kunci pencarian.'
              }
              action={
                items.length === 0 ? (
                  <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
                    Gelar Perkara Baru
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setQuery('')
                      setStatus('all')
                    }}
                  >
                    Hapus filter
                  </Button>
                )
              }
            />
          ) : (
            <ul>
              {filtered.map((g) => (
                <GelarRow key={g.id} item={g} active={g.id === openId} onClick={() => select(g.id)} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Detail column */}
      <div className={cn('min-w-0 flex-1', !open && 'hidden md:block')}>
        {open ? (
          <GelarDetail key={open.id} item={open} onBack={() => select(null)} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<Gavel size={22} />}
              title="Belum ada yang dipilih"
              description="Pilih gelar perkara dari daftar untuk melihat evidence, dokumentasi, dan kesimpulannya di sini."
            />
          </div>
        )}
      </div>

      {creating && (
        <NewGelarModal caseId={caseId} existing={items.length} onClose={() => setCreating(false)} onCreated={select} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Row */

function GelarRow({
  item,
  active,
  onClick,
}: {
  item: GelarPerkara
  active: boolean
  onClick: () => void
}) {
  const st = STATUS_META[item.status]

  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          'relative flex w-full gap-3 border-b border-line-soft/60 px-3.5 py-3 text-left transition-colors duration-150',
          active ? 'bg-brand/12' : 'hover:bg-tint/4',
        )}
      >
        {active && <span className="absolute inset-y-0 left-0 w-[2.5px] bg-brand-bright" />}

        <span className="tone flex size-9 shrink-0 items-center justify-center rounded-lg border" style={tone(st.color)}>
          <Gavel size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-ink-4 tnum">{item.number}</span>
            <Badge color={st.color} size="sm" dot>
              {st.label}
            </Badge>
          </div>
          <h3 className={cn('mt-0.5 truncate text-[12.5px] font-medium', active ? 'text-ink' : 'text-ink-2')}>
            {item.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-4">
            <span className="flex items-center gap-1 tnum">
              <CalendarClock size={10} /> {formatDateTime(item.scheduledAt)}
            </span>
            {item.location && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin size={10} className="shrink-0" /> <span className="truncate">{item.location}</span>
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-ink-4">
            <span className="flex items-center gap-1" title="Evidence">
              <Boxes size={10} /> <span className="tnum">{item.evidence.length}</span>
            </span>
            <span className="flex items-center gap-1" title="Dokumentasi">
              <Paperclip size={10} /> <span className="tnum">{item.documents.length}</span>
            </span>
          </div>
        </div>
      </button>
    </li>
  )
}

/* --------------------------------------------------------------- Detail */

function GelarDetail({ item, onBack }: { item: GelarPerkara; onBack: () => void }) {
  const st = STATUS_META[item.status]

  // Text fields edit locally and commit on "Simpan". Structural fields (status,
  // evidence links, documents) write immediately so an upload is never lost to
  // a forgotten Save.
  const [title, setTitle] = useState(item.title)
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(item.scheduledAt))
  const [location, setLocation] = useState(item.location ?? '')
  const [participants, setParticipants] = useState(item.participants.join(', '))
  const [conclusion, setConclusion] = useState(item.conclusion)
  const [saving, setSaving] = useState(false)

  const patch = (data: Partial<GelarPerkara>) =>
    db.gelarPerkara.update(item.id, { ...data, updatedAt: new Date().toISOString() })

  const setStatus = (next: GelarStatus) => patch({ status: next })

  /** Upload into either the evidence or documentation collection. */
  const addFiles = (field: 'evidence' | 'documents') => async (list: FileList | null) => {
    if (!list?.length) return
    const docs: GelarDoc[] = []
    for (const file of list) {
      const blobId = uid('blob')
      await db.blobs.add({ id: blobId, data: file })
      docs.push({ id: uid('gd'), name: file.name, blobId, mime: file.type, size: file.size })
    }
    await patch({ [field]: [...item[field], ...docs] } as Partial<GelarPerkara>)
    const what = field === 'evidence' ? 'Evidence' : 'Dokumentasi'
    toast.success(`${what} ditambahkan`, `${docs.length} berkas tersimpan lokal di browser ini.`)
  }

  const removeFile = (field: 'evidence' | 'documents') => async (doc: GelarDoc) => {
    if (doc.blobId) await db.blobs.delete(doc.blobId)
    await patch({ [field]: item[field].filter((d) => d.id !== doc.id) } as Partial<GelarPerkara>)
  }

  const save = async () => {
    if (!title.trim()) {
      toast.error('Judul wajib diisi', 'Beri judul untuk gelar perkara ini.')
      return
    }
    setSaving(true)
    try {
      await patch({
        title: title.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
        location: location.trim() || undefined,
        participants: participants.split(',').map((p) => p.trim()).filter(Boolean),
        conclusion: conclusion.trim(),
      })
      toast.success('Tersimpan', `${item.number} diperbarui.`)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    for (const d of [...item.evidence, ...item.documents]) if (d.blobId) await db.blobs.delete(d.blobId)
    await db.gelarPerkara.delete(item.id)
    toast.success('Gelar perkara dihapus', `${item.number} dihapus dari daftar.`)
    onBack()
  }

  return (
    <div className="flex h-full flex-col animate-fade-in">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line-soft px-4 py-2.5">
        <IconButton label="Kembali ke daftar" className="md:hidden" onClick={onBack}>
          <ArrowLeft size={16} />
        </IconButton>

        <span className="tone flex size-9 shrink-0 items-center justify-center rounded-lg border" style={tone(st.color)}>
          <Gavel size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-semibold leading-tight text-ink">{item.title}</h2>
          <p className="text-[11px] text-ink-4 tnum">
            {item.number} · {st.label}
          </p>
        </div>

        <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={remove}>
          Hapus
        </Button>
        <Button variant="primary" size="sm" onClick={save} loading={saving}>
          Simpan
        </Button>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] space-y-5 px-5 py-5">
        {/* Status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">Status</span>
          {(Object.keys(STATUS_META) as GelarStatus[]).map((s) => {
            const meta = STATUS_META[s]
            const on = item.status === s
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] transition-colors',
                  on ? 'border-brand/50 bg-brand/10 text-ink' : 'border-line-soft text-ink-3 hover:border-line-strong hover:text-ink-2',
                )}
              >
                <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
                {meta.label}
              </button>
            )
          })}
        </div>

        {/* Core fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Judul gelar perkara" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Gelar perkara awal" />
          </Field>
          <Field label="Waktu (datetime)">
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </Field>
          <Field label="Tempat">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ruang rapat / lokasi" />
          </Field>
          <Field label="Peserta" hint="Pisahkan dengan koma.">
            <Input value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="Ketua tim, Penyidik, …" />
          </Field>
        </div>

        {/* Peserta chips */}
        {item.participants.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Users size={12} className="text-ink-4" />
            {item.participants.map((p) => (
              <span key={p} className="rounded-md border border-line bg-abyss/50 px-2 py-0.5 text-[10.5px] text-ink-3">
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Evidence */}
        <MediaSection
          title="Evidence"
          icon={<Boxes size={11} />}
          docs={item.evidence}
          onAdd={addFiles('evidence')}
          onRemove={removeFile('evidence')}
          emptyHint="Unggah foto atau video evidence yang dibahas. Klik thumbnail untuk melihat."
        />

        {/* Dokumentasi */}
        <MediaSection
          title="Dokumentasi gelar perkara"
          icon={<Paperclip size={11} />}
          docs={item.documents}
          onAdd={addFiles('documents')}
          onRemove={removeFile('documents')}
          emptyHint="Notulen, foto sesi, daftar hadir. Klik thumbnail untuk melihat."
        />

        {/* Kesimpulan */}
        <Field label="Kesimpulan hasil gelar perkara" hint="Kesepakatan tim: status perkara dan langkah selanjutnya.">
          <Textarea
            rows={5}
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            placeholder="Ringkasan pembahasan dan keputusan gelar perkara…"
          />
        </Field>

        <div className="flex items-center gap-1.5 text-[10.5px] text-ink-4">
          <ClipboardCheck size={11} /> Diperbarui {formatDateTime(item.updatedAt)}
        </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ New modal */

function NewGelarModal({
  caseId,
  existing,
  onClose,
  onCreated,
}: {
  caseId: string
  existing: number
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [number, setNumber] = useState('')
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  // Default the number from the case code once, without blocking the field.
  useEffect(() => {
    let cancelled = false
    db.cases.get(caseId).then((c) => {
      if (cancelled) return
      const codeNum = c?.code.split('-').pop() ?? '000'
      setNumber((prev) => prev || `GP-${codeNum}-${String(existing + 1).padStart(2, '0')}`)
    })
    return () => {
      cancelled = true
    }
  }, [caseId, existing])

  const create = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const id = uid('gp')
      const now = new Date().toISOString()
      await db.gelarPerkara.add({
        id,
        caseId,
        number: number.trim() || `GP-${String(existing + 1).padStart(2, '0')}`,
        title: title.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
        location: location.trim() || undefined,
        status: 'gelar-lanjutan',
        participants: [],
        evidence: [],
        documents: [],
        conclusion: '',
        createdAt: now,
        updatedAt: now,
      })
      await db.activities.add({
        id: uid('ac'),
        caseId,
        actorId: 'u-jason',
        verb: 'menjadwalkan',
        object: `gelar perkara ${title.trim()}`,
        at: now,
        kind: 'case',
      })
      toast.success('Gelar perkara dibuat', `${title.trim()} siap dilengkapi.`)
      onCreated(id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Gelar Perkara Baru"
      description="Catat jadwal gelar perkara. Evidence, dokumentasi, dan kesimpulan dilengkapi pada detailnya."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={create} loading={saving} disabled={!title.trim()}>
            Buat
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor">
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="GP-014-01" />
          </Field>
          <Field label="Waktu (datetime)">
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </Field>
        </div>

        <Field label="Judul gelar perkara" required>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Gelar perkara awal" />
        </Field>

        <Field label="Tempat">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ruang rapat / lokasi" />
        </Field>
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------- Media section */

const isImage = (mime?: string) => !!mime?.startsWith('image/')
const isVideo = (mime?: string) => !!mime?.startsWith('video/')
const fileExt = (name: string) => (name.includes('.') ? name.split('.').pop()!.toUpperCase() : 'FILE')

/** Downloads a stored blob under its original filename. */
async function downloadBlob(blobId: string | undefined, name: string) {
  if (!blobId) return
  const rec = await db.blobs.get(blobId)
  if (!rec) return
  const url = URL.createObjectURL(rec.data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * An upload-and-preview collection: a grid of thumbnails for images/videos
 * (and file tiles for everything else). Clicking a thumbnail opens it in a
 * lightbox popup. Used for both "Evidence" and "Dokumentasi".
 */
function MediaSection({
  title,
  icon,
  docs,
  onAdd,
  onRemove,
  emptyHint,
}: {
  title: string
  icon: ReactNode
  docs: GelarDoc[]
  onAdd: (list: FileList | null) => void
  onRemove: (doc: GelarDoc) => void
  emptyHint: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<GelarDoc | null>(null)

  const browse = () => fileRef.current?.click()
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onAdd(e.target.files)
    e.target.value = ''
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
          {icon} {title}
          {docs.length > 0 && <span className="text-ink-4 tnum">· {docs.length}</span>}
        </h3>
        <Button size="xs" variant="outline" icon={<Upload size={12} />} onClick={browse}>
          Unggah
        </Button>
        <input ref={fileRef} type="file" multiple hidden onChange={onInput} />
      </div>

      {docs.length === 0 ? (
        <button
          onClick={browse}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            onAdd(e.dataTransfer.files)
          }}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-strong bg-abyss/35 px-4 py-6 transition-colors hover:border-brand/60 hover:bg-brand/6"
        >
          <Upload size={18} className="text-ink-3" />
          <p className="mt-2 text-[12px] font-medium text-ink">Jatuhkan berkas atau klik untuk unggah</p>
          <p className="mt-0.5 text-[10.5px] text-ink-4">{emptyHint}</p>
        </button>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            onAdd(e.dataTransfer.files)
          }}
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
        >
          {docs.map((d) => (
            <MediaThumb key={d.id} doc={d} onOpen={() => setPreview(d)} onRemove={() => onRemove(d)} />
          ))}
          <button
            onClick={browse}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line-strong bg-abyss/35 text-ink-4 transition-colors hover:border-brand/60 hover:text-brand-bright"
          >
            <Upload size={16} />
            <span className="text-[10px]">Tambah</span>
          </button>
        </div>
      )}

      {preview && <MediaLightbox doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

/** One thumbnail in a MediaSection grid. */
function MediaThumb({ doc, onOpen, onRemove }: { doc: GelarDoc; onOpen: () => void; onRemove: () => void }) {
  const url = useBlobUrl(doc.blobId, doc.mime)

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-abyss/50">
      <button onClick={onOpen} title={doc.name} className="block size-full">
        {isImage(doc.mime) && url ? (
          <img src={url} alt={doc.name} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : isVideo(doc.mime) && url ? (
          <>
            <video src={url} muted playsInline preload="metadata" className="size-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-8 items-center justify-center rounded-full bg-void/70 text-ink backdrop-blur-sm">
                <Play size={15} className="ml-0.5" />
              </span>
            </span>
          </>
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1.5 p-2">
            <FileText size={22} className="text-ink-3" />
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold text-ink-3">{fileExt(doc.name)}</span>
          </span>
        )}
      </button>

      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-void/90 to-transparent px-1.5 pb-1 pt-5 text-[9px] text-ink-2">
        {doc.name}
      </span>

      <button
        onClick={onRemove}
        aria-label="Hapus berkas"
        title="Hapus berkas"
        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-md bg-void/80 text-ink-3 opacity-0 backdrop-blur-sm transition-opacity hover:text-danger group-hover:opacity-100"
      >
        <X size={11} />
      </button>
    </div>
  )
}

/** Popup preview of a single image/video/file, opened from a thumbnail. */
function MediaLightbox({ doc, onClose }: { doc: GelarDoc; onClose: () => void }) {
  const url = useBlobUrl(doc.blobId, doc.mime)

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={doc.name}
      description={[doc.mime || 'Berkas', doc.size !== undefined ? formatBytes(doc.size) : null].filter(Boolean).join(' · ')}
      footer={
        <>
          <div className="flex-1" />
          {doc.blobId && (
            <Button icon={<Download size={13} />} onClick={() => downloadBlob(doc.blobId, doc.name)}>
              Unduh
            </Button>
          )}
        </>
      }
    >
      <div className="flex min-h-[240px] items-center justify-center">
        {isImage(doc.mime) && url ? (
          <img src={url} alt={doc.name} className="max-h-[70vh] w-auto rounded-lg object-contain" />
        ) : isVideo(doc.mime) && url ? (
          <video src={url} controls autoPlay className="max-h-[70vh] w-auto rounded-lg" />
        ) : (
          <div className="py-10 text-center">
            <FileText size={38} className="mx-auto text-ink-3" />
            <p className="mt-3 text-[12.5px] text-ink-3">Tidak ada pratinjau untuk jenis berkas ini.</p>
            {doc.blobId && (
              <Button className="mt-4" variant="primary" icon={<Download size={13} />} onClick={() => downloadBlob(doc.blobId, doc.name)}>
                Unduh berkas
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* --------------------------------------------------------------- Hooks */

/**
 * Object URL for an uploaded image or video blob. Created once the blob
 * resolves and revoked when inputs change or the component unmounts; the async
 * read is guarded so a stale resolve can't set state after cleanup.
 */
function useBlobUrl(blobId: string | undefined, mime: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blobId || !(isImage(mime) || isVideo(mime))) {
      setUrl(null)
      return
    }

    let objectUrl: string | null = null
    let cancelled = false

    db.blobs.get(blobId).then((rec) => {
      if (cancelled || !rec) return
      objectUrl = URL.createObjectURL(rec.data)
      setUrl(objectUrl)
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [blobId, mime])

  return url
}
