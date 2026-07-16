import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  Briefcase,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  KeyRound,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { db } from '@/domain/db'
import { can, sprintState } from '@/domain/access'
import type { Case, CaseDocument, Role, Sprint, User } from '@/domain/types'
import {
  cn,
  daysUntil,
  formatBytes,
  formatDate,
  formatDateTime,
  PRIORITY_META,
  STATUS_META,
  uid,
} from '@/lib/utils'
import { Avatar, Badge, Button, EmptyState, IconButton, Progress, tone, Tooltip } from '@/components/ui/primitives'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'

const CATEGORY_COLOR: Record<string, string> = {
  Laporan: '#EF4444',
  Registrasi: '#3B82F6',
  Kronologi: '#8B5CF6',
  'Nota Dinas': '#F59E0B',
  Lampiran: '#10B981',
  Identitas: '#06B6D4',
}
const categoryColor = (c?: string) => (c && CATEGORY_COLOR[c]) || '#6A7FA3'

const docIcon = (mime?: string) =>
  mime?.startsWith('image/') ? ImageIcon : mime?.startsWith('video/') ? Film : FileText

export function CaseRegistrationPage() {
  const { caseId = '' } = useParams()
  const userId = useSession((s) => s.userId)
  const [params, setParams] = useSearchParams()
  const openId = params.get('doc')

  const c = useLiveQuery(() => db.cases.get(caseId), [caseId])
  const assignee = useLiveQuery(() => (c ? db.users.get(c.assigneeId) : undefined), [c?.assigneeId])
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const roles = useLiveQuery(() => db.roles.toArray(), [], [])
  const sprints = useLiveQuery(() => db.sprints.where('caseId').equals(caseId).toArray(), [caseId], [])

  const me = users.find((u) => u.id === userId)
  const documents = useMemo(
    () => [...(c?.documents ?? [])].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
    [c?.documents],
  )
  const open = useMemo(() => documents.find((d) => d.id === openId) ?? null, [documents, openId])

  const select = (id: string | null, replace = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('doc', id)
        else next.delete('doc')
        return next
      },
      { replace },
    )

  // On a wide screen, open the first document straight away so the viewer isn't
  // empty on arrival. Mobile keeps the list in front until the user taps one.
  useEffect(() => {
    if (open || documents.length === 0) return
    if (window.matchMedia('(min-width: 768px)').matches) select(documents[0].id, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, open])

  const patchDocs = (next: CaseDocument[]) =>
    db.cases.update(caseId, { documents: next, updatedAt: new Date().toISOString() })

  const addFiles = async (list: FileList | null) => {
    if (!list?.length || !c) return
    const added: CaseDocument[] = []
    for (const file of list) {
      const blobId = uid('blob')
      await db.blobs.add({ id: blobId, data: file })
      added.push({
        id: uid('cd'),
        name: file.name,
        category: 'Lampiran',
        blobId,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        uploadedBy: me?.name ?? 'Unknown user',
        uploadedAt: new Date().toISOString(),
      })
    }
    await patchDocs([...(c.documents ?? []), ...added])
    toast.success('Dokumen ditambahkan', `${added.length} berkas tersimpan lokal di browser ini.`)
    if (added[0]) select(added[0].id, true)
  }

  const removeDoc = async (doc: CaseDocument) => {
    if (!c) return
    if (doc.blobId) await db.blobs.delete(doc.blobId)
    await patchDocs((c.documents ?? []).filter((d) => d.id !== doc.id))
    if (openId === doc.id) select(null, true)
    toast.success('Dokumen dihapus', `“${doc.name}” dihapus dari registrasi perkara.`)
  }

  if (!c) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState icon={<ClipboardList size={22} />} title="Memuat perkara…" description="Menyiapkan registrasi perkara." />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left — details, access, document list */}
      <div className={cn('flex w-full shrink-0 flex-col border-r border-line-soft md:w-[420px]', open && 'hidden md:flex')}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CaseDetails c={c} assignee={assignee ?? undefined} />
          <AccessList sprints={sprints} users={users} roles={roles} meId={userId} />
          <DocumentList
            documents={documents}
            openId={openId}
            onSelect={(id) => select(id)}
            onAdd={addFiles}
            onRemove={removeDoc}
          />
        </div>
      </div>

      {/* Right — viewer */}
      <div className={cn('min-w-0 flex-1', !open && 'hidden md:block')}>
        {open ? (
          <DocumentViewer key={open.id} doc={open} onBack={() => select(null)} onRemove={() => removeDoc(open)} />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              icon={<FileText size={22} />}
              title="Belum ada dokumen dipilih"
              description="Pilih dokumen dari daftar di kiri untuk melihat pratinjaunya di sini."
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* --------------------------------------------------------- Case details */

function Section({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line-soft px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-brand-bright">{icon}</span>
        <h3 className="flex-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-[3px]">
      <span className="w-[86px] shrink-0 pt-px text-[11px] text-ink-4">{label}</span>
      <span className="min-w-0 flex-1 text-[12px] text-ink-2">{children}</span>
    </div>
  )
}

function CaseDetails({ c, assignee }: { c: Case; assignee?: User }) {
  const priority = PRIORITY_META[c.priority]
  const status = STATUS_META[c.status]
  const due = c.dueAt ? daysUntil(c.dueAt) : null

  return (
    <Section title="Detail Kasus" icon={<Briefcase size={13} />}>
      <div className="mb-3">
        <p className="text-[11px] text-ink-4 tnum">{c.code}</p>
        <h2 className="mt-0.5 text-[15px] font-semibold leading-snug text-ink">{c.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge color={priority.color} size="sm" dot>
            {priority.label}
          </Badge>
          <Badge color={status.color} size="sm" dot>
            {status.label}
          </Badge>
        </div>
      </div>

      <p className="mb-3 text-[12px] leading-relaxed text-ink-3">{c.summary}</p>

      <div className="rounded-lg border border-line-soft bg-abyss/30 px-3 py-2">
        {c.caseType && <Row label="Jenis">{c.caseType}</Row>}
        {c.jurisdiction && <Row label="Yurisdiksi">{c.jurisdiction}</Row>}
        <Row label="Dibuka">
          <span className="tnum">{formatDate(c.openedAt)}</span>
        </Row>
        {c.dueAt && (
          <Row label="Tenggat">
            <span className="tnum">{formatDate(c.dueAt)}</span>
            {due !== null && (
              <span className={cn('ml-2 text-[10.5px]', due < 0 ? 'text-danger' : due <= 7 ? 'text-warn' : 'text-ink-4')}>
                {due < 0 ? `lewat ${Math.abs(due)} hari` : due === 0 ? 'hari ini' : `${due} hari lagi`}
              </span>
            )}
          </Row>
        )}
        <Row label="Penyidik">
          <span className="flex items-center gap-1.5">
            <Avatar src={assignee?.avatar} name={assignee?.name ?? '—'} size={18} />
            {assignee?.name ?? '—'}
          </span>
        </Row>
        <Row label="Progress">
          <span className="flex items-center gap-2">
            <Progress value={c.progress} className="w-[110px]" color={priority.color} />
            <span className="text-[11px] text-ink-3 tnum">{c.progress}%</span>
          </span>
        </Row>
      </div>

      {c.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <span key={t} className="rounded-md border border-line bg-abyss/50 px-1.5 py-0.5 text-[10.5px] text-ink-3">
              #{t}
            </span>
          ))}
        </div>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------ Access list */

function AccessList({ sprints, users, roles, meId }: { sprints: Sprint[]; users: User[]; roles: Role[]; meId: string }) {
  const viaSprint = useMemo(() => {
    const ids = new Set<string>()
    for (const s of sprints) {
      if (sprintState(s) !== 'active') continue
      for (const m of s.members) ids.add(m.userId)
    }
    return [...ids].map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u)
  }, [sprints, users])

  const viaRole = useMemo(
    () =>
      users.filter(
        (u) => u.active && !viaSprint.some((v) => v.id === u.id) && can(roles.find((r) => r.id === u.role), 'case.viewAll'),
      ),
    [users, roles, viaSprint],
  )

  const chip = (u: User, byRole: boolean) => {
    const role = roles.find((r) => r.id === u.role)
    const mine = u.id === meId
    return (
      <Tooltip key={u.id} label={byRole ? `${role?.name ?? 'Peran'} · melihat semua perkara` : (role?.name ?? 'Peran')}>
        <span
          className={cn(
            'flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5',
            byRole ? 'border-line bg-abyss/40' : 'border-brand/35 bg-brand/8',
          )}
        >
          <Avatar src={u.avatar} name={u.name} size={20} />
          <span className="text-[11.5px] text-ink-2">
            {u.name}
            {mine && <span className="ml-1 text-[10px] text-ink-4">(anda)</span>}
          </span>
        </span>
      </Tooltip>
    )
  }

  return (
    <Section title="Siapa yang boleh melihat" icon={<KeyRound size={13} />}>
      <div className="space-y-3.5">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium text-ink-3">
            <ShieldCheck size={11} className="text-brand-bright" /> Ditunjuk pada SPRINT aktif
          </p>
          <div className="flex flex-wrap gap-2">
            {viaSprint.length === 0 ? (
              <p className="text-[11.5px] text-ink-4">Belum ada — tidak ada surat perintah aktif yang menunjuk penyidik.</p>
            ) : (
              viaSprint.map((u) => chip(u, false))
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium text-ink-3">
            <Users size={11} /> Berdasarkan peran — melihat semua perkara
          </p>
          <div className="flex flex-wrap gap-2">
            {viaRole.length === 0 ? (
              <p className="text-[11.5px] text-ink-4">Tidak ada.</p>
            ) : (
              viaRole.map((u) => chip(u, true))
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}

/* --------------------------------------------------------- Document list */

function DocumentList({
  documents,
  openId,
  onSelect,
  onAdd,
  onRemove,
}: {
  documents: CaseDocument[]
  openId: string | null
  onSelect: (id: string) => void
  onAdd: (list: FileList | null) => void
  onRemove: (doc: CaseDocument) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const browse = () => fileRef.current?.click()

  return (
    <Section
      title={`Dokumen · ${documents.length}`}
      icon={<ClipboardList size={13} />}
      action={
        <Button size="xs" variant="outline" icon={<Upload size={12} />} onClick={browse}>
          Unggah
        </Button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onAdd(e.target.files)
          e.target.value = ''
        }}
      />

      {documents.length === 0 ? (
        <button
          onClick={browse}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            onAdd(e.dataTransfer.files)
          }}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-strong bg-abyss/35 px-4 py-7 transition-colors hover:border-brand/60 hover:bg-brand/6"
        >
          <Upload size={18} className="text-ink-3" />
          <p className="mt-2 text-[12px] font-medium text-ink">Jatuhkan berkas atau klik untuk unggah</p>
          <p className="mt-0.5 text-[10.5px] text-ink-4">Laporan, formulir registrasi, identitas, lampiran.</p>
        </button>
      ) : (
        <ul
          className="space-y-1.5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            onAdd(e.dataTransfer.files)
          }}
        >
          {documents.map((d) => {
            const Icon = docIcon(d.mime)
            const active = d.id === openId
            const color = categoryColor(d.category)
            return (
              <li key={d.id}>
                <div
                  className={cn(
                    'group relative flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
                    active ? 'border-brand/45 bg-brand/10' : 'border-line-soft hover:border-line-strong hover:bg-tint/4',
                  )}
                >
                  <button onClick={() => onSelect(d.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span className="tone flex size-8 shrink-0 items-center justify-center rounded-lg border" style={tone(color)}>
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[12px]', active ? 'font-medium text-ink' : 'text-ink-2')}>
                        {d.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-4">
                        {d.category && (
                          <span className="rounded px-1 py-px" style={{ ...tone(color), color }}>
                            {d.category}
                          </span>
                        )}
                        {d.size !== undefined && <span className="tnum">{formatBytes(d.size)}</span>}
                      </span>
                    </span>
                  </button>
                  <IconButton
                    label={`Hapus ${d.name}`}
                    size={26}
                    className="opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                    onClick={() => onRemove(d)}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

/* -------------------------------------------------------- Document viewer */

/** Loads a document blob as an object URL (media/pdf) or decoded text. */
function useDocPreview(doc: CaseDocument) {
  const [state, setState] = useState<{ url: string | null; text: string | null; loading: boolean }>({
    url: null,
    text: null,
    loading: true,
  })

  useEffect(() => {
    if (!doc.blobId) {
      setState({ url: null, text: null, loading: false })
      return
    }
    let url: string | null = null
    let cancelled = false
    setState({ url: null, text: null, loading: true })

    db.blobs.get(doc.blobId).then(async (rec) => {
      if (cancelled) return
      if (!rec) {
        setState({ url: null, text: null, loading: false })
        return
      }
      const mime = doc.mime ?? rec.data.type
      if (mime.startsWith('text/')) {
        const text = await rec.data.text()
        if (!cancelled) setState({ url: null, text, loading: false })
      } else {
        url = URL.createObjectURL(rec.data)
        if (cancelled) URL.revokeObjectURL(url)
        else setState({ url, text: null, loading: false })
      }
    })

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc.blobId, doc.mime])

  return state
}

async function downloadDoc(doc: CaseDocument) {
  if (!doc.blobId) return
  const rec = await db.blobs.get(doc.blobId)
  if (!rec) {
    toast.error('Berkas hilang', 'Dokumen tidak ditemukan di browser ini.')
    return
  }
  const url = URL.createObjectURL(rec.data)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.name
  a.click()
  URL.revokeObjectURL(url)
}

function DocumentViewer({ doc, onBack, onRemove }: { doc: CaseDocument; onBack: () => void; onRemove: () => void }) {
  const { url, text, loading } = useDocPreview(doc)
  const mime = doc.mime ?? ''
  const color = categoryColor(doc.category)
  const Icon = docIcon(doc.mime)

  return (
    <div className="flex h-full flex-col animate-fade-in">
      {/* Toolbar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line-soft px-4 py-2.5">
        <IconButton label="Kembali ke daftar" className="md:hidden" onClick={onBack}>
          <ArrowLeft size={16} />
        </IconButton>

        <span className="tone flex size-9 shrink-0 items-center justify-center rounded-lg border" style={tone(color)}>
          <Icon size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13.5px] font-semibold leading-tight text-ink">{doc.name}</h2>
          <p className="flex flex-wrap items-center gap-x-2 text-[10.5px] text-ink-4">
            {doc.category && <span style={{ color }}>{doc.category}</span>}
            {doc.uploadedBy && <span>· {doc.uploadedBy}</span>}
            <span className="tnum">· {formatDateTime(doc.uploadedAt)}</span>
            {doc.size !== undefined && <span className="tnum">· {formatBytes(doc.size)}</span>}
          </p>
        </div>

        <Button size="sm" variant="outline" icon={<Download size={13} />} onClick={() => downloadDoc(doc)}>
          Unduh
        </Button>
        <Tooltip label="Hapus dokumen">
          <IconButton label="Hapus dokumen" className="hover:text-danger" onClick={onRemove}>
            <Trash2 size={15} />
          </IconButton>
        </Tooltip>
      </header>

      {doc.note && (
        <p className="shrink-0 border-b border-line-soft bg-abyss/25 px-4 py-2 text-[11.5px] italic leading-relaxed text-ink-3">
          {doc.note}
        </p>
      )}

      {/* Preview surface */}
      <div className="min-h-0 flex-1 overflow-auto bg-abyss/20 p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[12px] text-ink-4">Memuat pratinjau…</div>
        ) : mime.startsWith('image/') && url ? (
          <div className="flex min-h-full items-center justify-center">
            <img src={url} alt={doc.name} className="max-w-full rounded-lg border border-line shadow-lg" />
          </div>
        ) : mime.startsWith('video/') && url ? (
          <div className="flex min-h-full items-center justify-center">
            <video src={url} controls className="max-h-full max-w-full rounded-lg" />
          </div>
        ) : mime === 'application/pdf' && url ? (
          <iframe src={url} title={doc.name} className="size-full min-h-[70vh] rounded-lg border border-line bg-white" />
        ) : text !== null ? (
          <div className="mx-auto max-w-[820px] rounded-lg border border-line bg-surface-1 p-6 shadow-sm">
            <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-ink-2">{text}</pre>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FileText size={40} className="mx-auto text-ink-3" />
              <p className="mt-3 text-[12.5px] text-ink-3">Tidak ada pratinjau untuk jenis berkas ini.</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-ink-4">
                <Clock size={11} /> {mime || 'berkas'} · {doc.size !== undefined ? formatBytes(doc.size) : '—'}
              </p>
              {doc.blobId && (
                <Button className="mt-4" variant="primary" icon={<Download size={13} />} onClick={() => downloadDoc(doc)}>
                  Unduh berkas
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
