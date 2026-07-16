import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Banknote,
  Boxes,
  CheckCircle2,
  Download,
  FileAudio,
  FileText,
  FileVideo,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Package,
  Rows3,
  Search,
  Shapes,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { Evidence, EvidenceKind, EvidenceStatus, GraphNode } from '@/domain/types'
import {
  cn,
  ENTITY_COLORS,
  formatBytes,
  formatDate,
  formatDateTime,
  uid,
} from '@/lib/utils'
import { Badge, Button, EmptyState, IconButton, Input, Select, Textarea, tone } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { ENTITY_ICONS } from '@/components/graph/EntityNode'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'

const KIND_META: Record<EvidenceKind, { label: string; icon: typeof FileText; color: string }> = {
  document: { label: 'Document', icon: FileText, color: '#3B82F6' },
  image: { label: 'Image', icon: ImageIcon, color: '#A855F7' },
  video: { label: 'Video', icon: FileVideo, color: '#F43F5E' },
  audio: { label: 'Audio', icon: FileAudio, color: '#22D3EE' },
  physical: { label: 'Physical', icon: Package, color: '#F59E0B' },
  digital: { label: 'Digital', icon: HardDrive, color: '#10B981' },
  financial: { label: 'Financial', icon: Banknote, color: '#EAB308' },
}

const STATUS_META: Record<EvidenceStatus, { label: string; color: string }> = {
  collected: { label: 'Collected', color: '#38BDF8' },
  analyzing: { label: 'Analyzing', color: '#F59E0B' },
  verified: { label: 'Verified', color: '#10B981' },
  rejected: { label: 'Out of scope', color: '#6A7FA3' },
}

export function EvidencePage() {
  const { caseId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const openId = params.get('id')

  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<EvidenceKind | 'all'>('all')
  const [status, setStatus] = useState<EvidenceStatus | 'all'>('all')
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [dragging, setDragging] = useState(false)

  const items = useLiveQuery(
    () => db.evidence.where('caseId').equals(caseId).reverse().sortBy('collectedAt'),
    [caseId],
    [],
  )
  const nodes = useLiveQuery(() => db.nodes.where('caseId').equals(caseId).toArray(), [caseId], [])
  const open = useMemo(() => items.find((e) => e.id === openId) ?? null, [items, openId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((e) => {
      if (kind !== 'all' && e.kind !== kind) return false
      if (status !== 'all' && e.status !== status) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.ref.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [items, query, kind, status])

  const stats = useMemo(
    () => ({
      verified: items.filter((e) => e.status === 'verified').length,
      pending: items.filter((e) => e.status === 'analyzing' || e.status === 'collected').length,
      rejected: items.filter((e) => e.status === 'rejected').length,
    }),
    [items],
  )

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

  /* Page-level drop target so a file can be dropped anywhere. */
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const dragDepth = useRef(0)

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    if (!e.dataTransfer.types.includes('Files')) return
    dragDepth.current += 1
    setDragging(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) setDragging(false)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const files = [...e.dataTransfer.files]
    if (files.length === 0) return
    setPendingFiles(files)
    setUploadOpen(true)
  }

  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Toolbar */}
      <div className="shrink-0 border-b border-line-soft px-5 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-full max-w-[280px]">
            <Input
              icon={<Search size={13} />}
              placeholder="Search evidence, refs, tags…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-[12px]"
            />
          </div>

          <div className="w-[136px]">
            <Select
              className="h-8 text-[12px]"
              value={kind}
              onChange={(e) => setKind(e.target.value as EvidenceKind | 'all')}
              options={[
                { value: 'all', label: 'All types' },
                ...Object.entries(KIND_META).map(([k, v]) => ({ value: k, label: v.label })),
              ]}
            />
          </div>

          <div className="w-[136px]">
            <Select
              className="h-8 text-[12px]"
              value={status}
              onChange={(e) => setStatus(e.target.value as EvidenceStatus | 'all')}
              options={[
                { value: 'all', label: 'All statuses' },
                ...Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label })),
              ]}
            />
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden items-center gap-3 text-[10.5px] text-ink-4 lg:flex">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-ok" /> <span className="tnum">{stats.verified}</span> verified
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-warn" /> <span className="tnum">{stats.pending}</span> pending
              </span>
              {stats.rejected > 0 && (
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-ink-4" /> <span className="tnum">{stats.rejected}</span> out of scope
                </span>
              )}
            </span>

            <div className="flex items-center gap-1 rounded-lg border border-line bg-abyss/50 p-0.5">
              {([['grid', LayoutGrid], ['table', Rows3]] as const).map(([v, Icon]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-label={`${v} view`}
                  aria-pressed={view === v}
                  className={cn(
                    'flex size-6 items-center justify-center rounded-md transition-colors',
                    view === v ? 'bg-brand/18 text-brand-bright' : 'text-ink-4 hover:text-ink-2',
                  )}
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>

            <Button size="sm" variant="primary" icon={<Upload size={13} />} onClick={() => setUploadOpen(true)}>
              Upload
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Boxes size={22} />}
            title={items.length === 0 ? 'No evidence yet' : 'No evidence matches these filters'}
            description={
              items.length === 0
                ? 'Drop a file anywhere on this page, or use the Upload button. Files are stored locally in your browser.'
                : 'Try a different type or status, or clear the search term.'
            }
            action={
              items.length === 0 ? (
                <Button variant="primary" icon={<Upload size={14} />} onClick={() => setUploadOpen(true)}>
                  Upload evidence
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setQuery('')
                    setKind('all')
                    setStatus('all')
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : view === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((e, i) => (
              <EvidenceCard key={e.id} item={e} nodes={nodes} onClick={() => select(e.id)} i={i} />
            ))}
          </div>
        ) : (
          <EvidenceTable items={filtered} onSelect={select} />
        )}
      </div>

      {/* Drop overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand bg-brand/10 backdrop-blur-sm animate-fade-in">
          <div className="text-center">
            <Upload size={30} className="mx-auto text-brand-bright" />
            <p className="mt-3 text-[15px] font-medium text-ink">Drop to add evidence</p>
            <p className="mt-1 text-[12px] text-ink-2">Files are stored in this browser only</p>
          </div>
        </div>
      )}

      <UploadModal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false)
          setPendingFiles([])
        }}
        caseId={caseId}
        nodes={nodes}
        initialFiles={pendingFiles}
      />

      {open && <EvidenceDetail item={open} nodes={nodes} caseId={caseId} onClose={() => select(null)} />}
    </div>
  )
}

/* ----------------------------------------------------------------- Card */

function EvidenceCard({
  item,
  nodes,
  onClick,
  i,
}: {
  item: Evidence
  nodes: GraphNode[]
  onClick: () => void
  i: number
}) {
  const meta = KIND_META[item.kind]
  const status = STATUS_META[item.status]
  const Icon = meta.icon
  const linked = nodes.filter((n) => item.linkedNodeIds.includes(n.id))
  const preview = useBlobUrl(item.blobId, item.mime)

  return (
    <button
      onClick={onClick}
      className="group glass flex flex-col overflow-hidden rounded-[var(--radius-card)] text-left transition-all duration-250 hover:-translate-y-0.5 hover:border-brand/40 animate-fade-up"
      style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
    >
      {/* Thumb */}
      <div className="relative flex h-[110px] items-center justify-center overflow-hidden border-b border-line-soft bg-abyss/50">
        {preview ? (
          <img src={preview} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <>
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{ background: `radial-gradient(circle at 50% 40%, ${meta.color}, transparent 70%)` }}
            />
            <Icon size={30} style={{ color: meta.color }} className="relative opacity-65" />
          </>
        )}

        <span className="absolute left-2 top-2">
          <Badge color={status.color} size="sm" dot>
            {status.label}
          </Badge>
        </span>

        {item.confidence > 0 && (
          <span className="absolute bottom-2 right-2 rounded-full border border-line bg-void/85 px-1.5 py-0.5 text-[9px] font-medium text-ink-2 tnum backdrop-blur-sm">
            {item.confidence}% conf.
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-ink-4 tnum">{item.ref}</span>
          <span className="tone rounded border px-1 py-px text-[9px]" style={tone(meta.color)}>
            {meta.label}
          </span>
        </div>

        <h3 className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-ink transition-colors group-hover:text-brand-bright">
          {item.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-ink-4">{item.description}</p>

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-[9.5px] text-ink-4 tnum">{formatDate(item.collectedAt)}</span>
          <div className="flex items-center gap-2">
            {item.size !== undefined && <span className="text-[9.5px] text-ink-4 tnum">{formatBytes(item.size)}</span>}
            {linked.length > 0 && (
              <span className="flex items-center gap-0.5 text-[9.5px] text-ink-4">
                <Shapes size={9} /> <span className="tnum">{linked.length}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

/* ---------------------------------------------------------------- Table */

function EvidenceTable({ items, onSelect }: { items: Evidence[]; onSelect: (id: string) => void }) {
  return (
    <div className="glass overflow-hidden rounded-[var(--radius-card)] animate-fade-up">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.07em] text-ink-4">
              <th className="px-4 py-3 font-semibold">Ref</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Collected by</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Conf.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft/70">
            {items.map((e) => {
              const meta = KIND_META[e.kind]
              const status = STATUS_META[e.status]
              const Icon = meta.icon
              return (
                <tr key={e.id} onClick={() => onSelect(e.id)} className="group cursor-pointer transition-colors hover:bg-tint/4">
                  <td className="whitespace-nowrap px-4 py-3 text-[11.5px] text-ink-4 tnum">{e.ref}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="tone flex size-7 shrink-0 items-center justify-center rounded-md border" style={tone(meta.color)}>
                        <Icon size={13} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium text-ink transition-colors group-hover:text-brand-bright">
                          {e.name}
                        </span>
                        <span className="mt-0.5 block max-w-[320px] truncate text-[10.5px] text-ink-4">{e.description}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11.5px] text-ink-3">{meta.label}</td>
                  <td className="px-4 py-3">
                    <Badge color={status.color} size="sm" dot>
                      {status.label}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[11.5px] text-ink-3">{e.collectedBy}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[11.5px] text-ink-4 tnum">{formatDate(e.collectedAt)}</td>
                  <td className="px-4 py-3 text-[11.5px] text-ink-3 tnum">{e.confidence > 0 ? `${e.confidence}%` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Detail */

function EvidenceDetail({
  item,
  nodes,
  caseId,
  onClose,
}: {
  item: Evidence
  nodes: GraphNode[]
  caseId: string
  onClose: () => void
}) {
  const meta = KIND_META[item.kind]
  const status = STATUS_META[item.status]
  const Icon = meta.icon
  const linked = nodes.filter((n) => item.linkedNodeIds.includes(n.id))
  const preview = useBlobUrl(item.blobId, item.mime)

  const setStatus = async (next: EvidenceStatus) => {
    await db.evidence.update(item.id, {
      status: next,
      custody: [
        ...item.custody,
        { id: uid('cu'), actor: 'Jason Bennett', action: `Status changed to ${STATUS_META[next].label}`, at: new Date().toISOString() },
      ],
    })
    toast.success('Status updated', `${item.ref} is now ${STATUS_META[next].label.toLowerCase()}.`)
  }

  const download = async () => {
    if (!item.blobId) {
      toast.info('No file attached', 'This item was recorded manually and has no uploaded file.')
      return
    }
    const rec = await db.blobs.get(item.blobId)
    if (!rec) return
    const url = URL.createObjectURL(rec.data)
    const a = document.createElement('a')
    a.href = url
    a.download = item.name
    a.click()
    URL.revokeObjectURL(url)
  }

  const remove = async () => {
    if (item.blobId) await db.blobs.delete(item.blobId)
    await db.evidence.delete(item.id)
    toast.success('Evidence removed', `${item.ref} was deleted from the register.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={item.name}
      description={`${item.ref} · ${meta.label} · collected by ${item.collectedBy}`}
      footer={
        <>
          {item.blobId && (
            <Button variant="danger" icon={<Trash2 size={13} />} onClick={remove}>
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button icon={<Download size={13} />} onClick={download}>
            Download
          </Button>
          {item.status !== 'verified' && item.status !== 'rejected' && (
            <Button variant="primary" icon={<CheckCircle2 size={13} />} onClick={() => setStatus('verified')}>
              Mark verified
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Preview */}
        <div className="relative flex h-[190px] items-center justify-center overflow-hidden rounded-xl border border-line bg-abyss/50">
          {preview ? (
            <img src={preview} alt={item.name} className="size-full object-contain" />
          ) : (
            <div className="text-center">
              <Icon size={34} style={{ color: meta.color }} className="mx-auto opacity-60" />
              <p className="mt-2.5 text-[11.5px] text-ink-4">
                {item.blobId ? 'No inline preview for this file type' : 'Recorded item — no file payload'}
              </p>
            </div>
          )}
          <span className="absolute right-3 top-3">
            <Badge color={status.color} dot>
              {status.label}
            </Badge>
          </span>
        </div>

        <p className="text-[12.5px] leading-relaxed text-ink-2">{item.description}</p>

        {/* Facts */}
        <dl className="grid gap-2 sm:grid-cols-2">
          {[
            ['Reference', item.ref],
            ['Type', meta.label],
            ['Collected by', item.collectedBy],
            ['Collected at', formatDateTime(item.collectedAt)],
            ['Location', item.location],
            ['Confidence', item.confidence > 0 ? `${item.confidence}%` : 'Not assessed'],
            ...(item.size !== undefined ? [['File size', formatBytes(item.size)] as [string, string]] : []),
            ...(item.mime ? [['MIME type', item.mime] as [string, string]] : []),
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line-soft bg-abyss/35 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wide text-ink-4">{k}</dt>
              <dd className="mt-0.5 break-words text-[12px] text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Status control */}
        <Field label="Status" hint="Every change is written to the chain of custody below.">
          <Select
            value={item.status}
            onChange={(e) => setStatus(e.target.value as EvidenceStatus)}
            options={Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </Field>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <span key={t} className="rounded-md border border-line bg-abyss/50 px-2 py-0.5 text-[10.5px] text-ink-3">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Linked entities */}
        {linked.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
              <Link2 size={11} /> Linked entities
            </h3>
            <div className="flex flex-wrap gap-2">
              {linked.map((n) => {
                const color = ENTITY_COLORS[n.kind]
                const NIcon = ENTITY_ICONS[n.kind]
                return (
                  <Link
                    key={n.id}
                    to={`/cases/${caseId}/graph?node=${n.id}`}
                    onClick={onClose}
                    className="tone flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11.5px] transition-transform hover:scale-[1.03]"
                    style={tone(color)}
                  >
                    <NIcon size={12} />
                    {n.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Custody */}
        <div>
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
            <ShieldAlert size={11} /> Chain of custody
          </h3>
          <ol className="relative space-y-3 rounded-xl border border-line-soft bg-abyss/35 p-3.5">
            <span className="absolute bottom-4 left-[17px] top-4 w-px bg-line" aria-hidden />
            {item.custody.map((c) => (
              <li key={c.id} className="relative flex gap-3">
                <span className="relative z-1 mt-0.5 flex size-[15px] shrink-0 items-center justify-center rounded-full border border-brand/50 bg-void">
                  <span className="size-1.5 rounded-full bg-brand" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] text-ink-2">
                    <span className="font-medium text-ink">{c.actor}</span> — {c.action}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-4 tnum">{formatDateTime(c.at)}</p>
                  {c.note && (
                    <p className="mt-1 rounded-md border border-line-soft bg-void/50 px-2 py-1 text-[10.5px] italic text-ink-3">
                      {c.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  )
}

/* --------------------------------------------------------------- Upload */

function guessKind(file: File): EvidenceKind {
  const t = file.type
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  if (t.startsWith('audio/')) return 'audio'
  if (t.includes('sheet') || t.includes('csv') || t.includes('excel')) return 'financial'
  if (t.includes('pdf') || t.includes('word') || t.includes('text')) return 'document'
  return 'digital'
}

function UploadModal({
  open,
  onClose,
  caseId,
  nodes,
  initialFiles,
}: {
  open: boolean
  onClose: () => void
  caseId: string
  nodes: GraphNode[]
  initialFiles: File[]
}) {
  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<EvidenceKind>('document')
  const [location, setLocation] = useState('')
  const [linkIds, setLinkIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setFiles(initialFiles)
    if (initialFiles.length === 1) {
      setName(initialFiles[0].name)
      setKind(guessKind(initialFiles[0]))
    }
  }, [open, initialFiles])

  const reset = () => {
    setFiles([])
    setName('')
    setDescription('')
    setKind('document')
    setLocation('')
    setLinkIds([])
  }

  const pick = (list: FileList | null) => {
    if (!list?.length) return
    const arr = [...list]
    setFiles(arr)
    if (arr.length === 1) {
      setName(arr[0].name)
      setKind(guessKind(arr[0]))
    }
  }

  const submit = async () => {
    if (files.length === 0 && !name.trim()) return
    setSaving(true)
    try {
      const count = await db.evidence.where('caseId').equals(caseId).count()
      const caseRec = await db.cases.get(caseId)
      const codeNum = caseRec?.code.split('-').pop() ?? '000'
      const now = new Date().toISOString()

      const targets = files.length > 0 ? files : [null]

      for (const [i, file] of targets.entries()) {
        const blobId = file ? uid('blob') : undefined
        if (file && blobId) await db.blobs.add({ id: blobId, data: file })

        const ref = `EV-${codeNum}-${String(count + i + 1).padStart(3, '0')}`
        const evName = files.length === 1 || !file ? name.trim() || file!.name : file.name

        await db.evidence.add({
          id: uid('ev'),
          caseId,
          ref,
          name: evName,
          description: description.trim() || 'No description recorded at intake.',
          kind: file ? guessKind(file) : kind,
          status: 'collected',
          collectedBy: 'Jason Bennett',
          collectedAt: now,
          location: location.trim() || 'Uploaded via CaseNavigator',
          tags: ['uploaded'],
          linkedNodeIds: linkIds,
          blobId,
          mime: file?.type,
          size: file?.size,
          confidence: 0,
          custody: [
            {
              id: uid('cu'),
              actor: 'Jason Bennett',
              action: file ? `Uploaded ${file.name}` : 'Item recorded manually',
              at: now,
              note: 'Stored in local browser database (IndexedDB).',
            },
          ],
        })
      }

      await db.activities.add({
        id: uid('ac'),
        caseId,
        actorId: 'u-jason',
        verb: 'added',
        object: `${targets.length} evidence item${targets.length > 1 ? 's' : ''}`,
        at: now,
        kind: 'evidence',
      })

      toast.success(
        `${targets.length} item${targets.length > 1 ? 's' : ''} added`,
        'Stored locally in this browser. Nothing was uploaded to a server.',
      )
      reset()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Upload failed', err instanceof Error ? err.message : 'Could not write to the local database.')
    } finally {
      setSaving(false)
    }
  }

  const total = files.reduce((s, f) => s + f.size, 0)

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Add evidence"
      description="Files stay in this browser's local database. Nothing is sent anywhere."
      size="md"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={files.length === 0 && !name.trim()}>
            Add {files.length > 1 ? `${files.length} items` : 'to register'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Dropzone */}
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pick(e.dataTransfer.files)
          }}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-strong bg-abyss/35 px-4 py-8 transition-colors hover:border-brand/60 hover:bg-brand/6"
        >
          <Upload size={22} className="text-ink-3" />
          <p className="mt-2.5 text-[13px] font-medium text-ink">Drop files or click to browse</p>
          <p className="mt-1 text-[11px] text-ink-4">Any file type · stored locally</p>
        </button>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => pick(e.target.files)} />

        {files.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
                {files.length} file{files.length > 1 ? 's' : ''}
              </h3>
              <span className="text-[10.5px] text-ink-4 tnum">{formatBytes(total)} total</span>
            </div>
            <ul className="max-h-[132px] space-y-1.5 overflow-y-auto">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-abyss/35 px-3 py-2">
                  <FileText size={13} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">{f.name}</span>
                  <span className="shrink-0 text-[10px] text-ink-4 tnum">{formatBytes(f.size)}</span>
                  <IconButton label="Remove" size={20} onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                    <X size={11} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        )}

        {files.length <= 1 && (
          <Field label="Name" required={files.length === 0}>
            <Input placeholder="e.g. Bank statement — account ••8871" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}

        <Field label="Description" hint="What is it, and how does it bear on the case?">
          <Textarea rows={3} placeholder="Certified statements covering…" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {files.length === 0 && (
            <Field label="Type">
              <Select
                value={kind}
                onChange={(e) => setKind(e.target.value as EvidenceKind)}
                options={Object.entries(KIND_META).map(([k, v]) => ({ value: k, label: v.label }))}
              />
            </Field>
          )}
          <Field label="Source / location">
            <Input placeholder="e.g. Treasury system export" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>

        {nodes.length > 0 && (
          <Field label="Link to entities" hint="Linked evidence appears on the entity's detail panel in the graph.">
            <div className="flex max-h-[104px] flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-line bg-abyss/35 p-2">
              {nodes.map((n) => {
                const on = linkIds.includes(n.id)
                const color = ENTITY_COLORS[n.kind]
                return (
                  <button
                    key={n.id}
                    onClick={() => setLinkIds((prev) => (on ? prev.filter((x) => x !== n.id) : [...prev, n.id]))}
                    className={cn(
                      'rounded-full border px-2 py-1 text-[10.5px] transition-all',
                      on ? 'tone scale-100' : 'border-line text-ink-3 hover:text-ink',
                    )}
                    style={on ? tone(color) : undefined}
                  >
                    {n.label}
                  </button>
                )
              })}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  )
}

/* --------------------------------------------------------------- Hooks */

/**
 * Object URL for an uploaded image blob.
 *
 * The URL is created once the blob resolves and revoked when the inputs change
 * or the component unmounts — the async read means we also have to guard
 * against a stale resolve setting state after that.
 */
function useBlobUrl(blobId: string | undefined, mime: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blobId || !mime?.startsWith('image/')) {
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
