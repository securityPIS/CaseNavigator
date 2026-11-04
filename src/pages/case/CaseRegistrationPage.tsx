import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  ClipboardList,
  Download,
  FilePen,
  FileSignature,
  FileText,
  Film,
  Image as ImageIcon,
  KeyRound,
  Landmark,
  Megaphone,
  NotebookPen,
  Paperclip,
  Pencil,
  Radio,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import { SPRINT_STATE_META, can, sprintState } from '@/domain/access'
import { menimbangFromSource } from '@/domain/sprintLetter'
import type { Case, CaseDocument, ReportSource, ReportSourceKind, Role, Sprint, User } from '@/domain/types'
import { cn, daysUntil, formatBytes, formatDate, formatDateTime, PRIORITY_META, STATUS_META, uid } from '@/lib/utils'
import { Avatar, Badge, Button, EmptyState, IconButton, Input, Progress, Select, Textarea, tone, Tooltip } from '@/components/ui/primitives'
import { BlobPreview, downloadBlob } from '@/components/ui/BlobPreview'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'
import { SprintLetterModal } from './SprintLetterModal'
import { SprintListItem, SprintViewer, UploadSprintModal } from './SprintParts'

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

export const SOURCE_META: Record<ReportSourceKind, { label: string; blurb: string; color: string; icon: typeof Megaphone }> = {
  wbs: { label: 'Whistle Blower System (WBS)', blurb: 'Laporan masuk lewat WBS — dicatat dengan nomor WBS.', color: '#EF4444', icon: Megaphone },
  management: { label: 'Management Report', blurb: 'Permintaan manajemen lewat nota dinas — nomor dan dokumennya.', color: '#F59E0B', icon: Landmark },
  internal: { label: 'Internal Report', blurb: 'Temuan tim sendiri — Investigation Notes, tanpa nomor.', color: '#3B82F6', icon: NotebookPen },
}

type Selection = { kind: 'doc' | 'sprint'; id: string } | null

/**
 * Case Registration — what the investigation stands on: the sumber laporan
 * that opened it, the SPRINT that authorises the team, and the supporting
 * documents. The viewer on the right shows whichever is opened: a SPRINT as
 * the letter it prints as, or a document's preview.
 */
export function CaseRegistrationPage() {
  const { caseId = '' } = useParams()
  const userId = useSession((s) => s.userId)
  const [params, setParams] = useSearchParams()
  const docId = params.get('doc')
  const sprintId = params.get('sprint')

  const c = useLiveQuery(() => db.cases.get(caseId), [caseId])
  const assignee = useLiveQuery(() => (c ? db.users.get(c.assigneeId) : undefined), [c?.assigneeId])
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const roles = useLiveQuery(() => db.roles.toArray(), [], [])
  const sprints = useLiveQuery(
    async () => (await db.sprints.where('caseId').equals(caseId).toArray()).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    [caseId],
  )

  const me = users.find((u) => u.id === userId)
  const myRole = roles.find((r) => r.id === me?.role)
  const manageSprint = can(myRole, 'sprint.manage')
  const editCase = can(myRole, 'case.edit')

  const [drafting, setDrafting] = useState<Sprint | 'new' | null>(null)
  const [uploading, setUploading] = useState(false)

  const documents = useMemo(
    () => [...(c?.documents ?? [])].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
    [c?.documents],
  )
  const openDoc = useMemo(() => documents.find((d) => d.id === docId) ?? null, [documents, docId])
  const openSprint = useMemo(() => sprints?.find((s) => s.id === sprintId) ?? null, [sprints, sprintId])

  const select = (sel: Selection, replace = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('doc')
        next.delete('sprint')
        if (sel) next.set(sel.kind, sel.id)
        return next
      },
      { replace },
    )

  // On a wide screen, open something straight away so the viewer isn't empty
  // on arrival — the order in force first, since it is what the case runs on.
  // Mobile keeps the list in front until the user taps one.
  useEffect(() => {
    if (!sprints || openDoc || openSprint) return
    if (!window.matchMedia('(min-width: 768px)').matches) return
    const sp = sprints.find((s) => sprintState(s) === 'active') ?? sprints[0]
    if (sp) select({ kind: 'sprint', id: sp.id }, true)
    else if (documents[0]) select({ kind: 'doc', id: documents[0].id }, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprints, documents, openDoc, openSprint])

  const storeFile = async (file: File, category: string, note?: string): Promise<CaseDocument> => {
    const blobId = uid('blob')
    await db.blobs.add({ id: blobId, data: file })
    return {
      id: uid('cd'),
      name: file.name,
      category,
      blobId,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      uploadedBy: me?.name ?? 'Unknown user',
      uploadedAt: new Date().toISOString(),
      note,
    }
  }

  const addFiles = async (list: FileList | null) => {
    if (!list?.length || !c) return
    const added: CaseDocument[] = []
    for (const file of list) added.push(await storeFile(file, 'Lampiran'))
    await db.cases.update(caseId, { documents: [...(c.documents ?? []), ...added], updatedAt: new Date().toISOString() })
    toast.success('Dokumen ditambahkan', `${added.length} berkas tersimpan lokal di browser ini.`)
    if (added[0]) select({ kind: 'doc', id: added[0].id }, true)
  }

  const removeDoc = async (doc: CaseDocument) => {
    if (!c) return
    const isNota = c.reportSource?.notaDinasDocId === doc.id
    if (isNota && !window.confirm(`“${doc.name}” adalah nota dinas sumber laporan. Tetap hapus?`)) return
    if (doc.blobId) await db.blobs.delete(doc.blobId)
    await db.cases.update(caseId, {
      documents: (c.documents ?? []).filter((d) => d.id !== doc.id),
      ...(isNota ? { reportSource: { ...c.reportSource!, notaDinasDocId: undefined } } : {}),
      updatedAt: new Date().toISOString(),
    })
    if (docId === doc.id) select(null, true)
    toast.success('Dokumen dihapus', `“${doc.name}” dihapus dari registrasi perkara.`)
  }

  const saveSource = async (src: ReportSource, notaFile: File | null) => {
    if (!c) return
    let docs = c.documents ?? []
    let next = src
    if (src.kind === 'management' && notaFile) {
      const doc = await storeFile(notaFile, 'Nota Dinas', `Nota Dinas Nomor ${src.notaDinasNumber} — sumber laporan.`)
      docs = [...docs, doc]
      next = { ...src, notaDinasDocId: doc.id }
    }
    await db.cases.update(caseId, { reportSource: next, documents: docs, updatedAt: new Date().toISOString() })
    toast.success('Sumber laporan disimpan', SOURCE_META[src.kind].label)
  }

  if (!c || !sprints) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState icon={<ClipboardList size={22} />} title="Memuat perkara…" description="Menyiapkan registrasi perkara." />
      </div>
    )
  }

  const opened = openSprint || openDoc

  return (
    <div className="flex h-full">
      {/* Left — registration */}
      <div className={cn('flex w-full shrink-0 flex-col border-r border-line-soft md:w-[420px]', opened && 'hidden md:flex')}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CaseDetails c={c} assignee={assignee ?? undefined} />

          <ReportSourceSection
            source={c.reportSource}
            documents={documents}
            editable={editCase}
            recordedBy={me?.name}
            onOpenDoc={(id) => select({ kind: 'doc', id })}
            onSave={saveSource}
          />

          <Section
            title="SPRINT"
            icon={<FileSignature size={13} />}
            summary={
              sprints[0]
                ? `${sprints[0].number} · ${SPRINT_STATE_META[sprintState(sprints[0])].label}`
                : 'Belum ada Surat Perintah'
            }
            action={
              // One case, one SPRINT: the way to add one goes once it exists.
              manageSprint &&
              sprints.length === 0 && (
                <div className="flex items-center gap-1">
                  <Tooltip label="Unggah SPRINT bertanda tangan dari luar aplikasi">
                    <IconButton label="Unggah SPRINT" size={28} onClick={() => setUploading(true)}>
                      <Upload size={13} />
                    </IconButton>
                  </Tooltip>
                  <Button size="xs" variant="primary" icon={<FilePen size={12} />} onClick={() => setDrafting('new')}>
                    Buat SPRINT
                  </Button>
                </div>
              )
            }
          >
            {sprints.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-abyss/30 px-4 py-5 text-center">
                <p className="text-[12px] font-medium text-ink-2">Belum ada Surat Perintah</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
                  Tanpa SPRINT aktif, tidak ada penyidik yang dapat membuka perkara ini. Satu perkara hanya
                  memiliki satu SPRINT.
                </p>
                {manageSprint && (
                  <Button className="mt-3" size="sm" variant="primary" icon={<FilePen size={13} />} onClick={() => setDrafting('new')}>
                    Buat SPRINT dari template
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <SprintListItem
                  sprint={sprints[0]}
                  active={sprints[0].id === sprintId}
                  onSelect={() => select({ kind: 'sprint', id: sprints[0].id })}
                />
                <p className="text-[10.5px] leading-relaxed text-ink-4">
                  Satu perkara hanya memiliki satu SPRINT. Perubahan tim dilakukan pada surat ini.
                </p>
              </div>
            )}
          </Section>

          <AccessList sprints={sprints} users={users} roles={roles} meId={userId} />

          <DocumentList
            documents={documents}
            openId={docId}
            notaId={c.reportSource?.notaDinasDocId}
            onSelect={(id) => select({ kind: 'doc', id })}
            onAdd={addFiles}
            onRemove={removeDoc}
          />
        </div>
      </div>

      {/* Right — viewer */}
      <div className={cn('min-w-0 flex-1', !opened && 'hidden md:block')}>
        {openSprint ? (
          <SprintViewer
            key={openSprint.id}
            sprint={openSprint}
            users={users}
            manage={manageSprint}
            caseTitle={c.title}
            reportSource={c.reportSource}
            onBack={() => select(null)}
            onEditDraft={() => setDrafting(openSprint)}
          />
        ) : openDoc ? (
          <DocumentViewer key={openDoc.id} doc={openDoc} onBack={() => select(null)} onRemove={() => removeDoc(openDoc)} />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              icon={<FileText size={22} />}
              title="Belum ada yang dibuka"
              description="Pilih SPRINT atau dokumen pendukung di kiri untuk melihatnya di sini."
            />
          </div>
        )}
      </div>

      {drafting && (
        <SprintLetterModal
          caseId={caseId}
          sprint={drafting === 'new' ? undefined : drafting}
          users={users}
          roles={roles}
          menimbangHint={menimbangFromSource(c.reportSource, c.title)}
          onClose={() => setDrafting(null)}
          onSaved={(id) => select({ kind: 'sprint', id }, true)}
        />
      )}
      {uploading && (
        <UploadSprintModal
          caseId={caseId}
          users={users}
          roles={roles}
          onClose={() => setUploading(false)}
          onCreated={(id) => select({ kind: 'sprint', id }, true)}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------- Layout */

/**
 * A registration section that folds away. Every section starts collapsed,
 * showing a one-line summary, so the whole registration reads at a glance.
 * Pass `open` / `onOpenChange` when something outside must open it.
 */
function Section({
  title,
  icon,
  action,
  summary,
  open: openProp,
  onOpenChange,
  children,
}: {
  title: string
  icon: ReactNode
  action?: ReactNode
  summary?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}) {
  const [inner, setInner] = useState(false)
  const open = openProp ?? inner
  const toggle = () => (onOpenChange ? onOpenChange(!open) : setInner(!open))

  return (
    <section className="border-b border-line-soft">
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={toggle} aria-expanded={open} className="group flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight
            size={13}
            className={cn('shrink-0 text-ink-4 transition-transform duration-200 group-hover:text-ink-2', open && 'rotate-90')}
          />
          <span className="shrink-0 text-brand-bright">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3 group-hover:text-ink-2">{title}</span>
            {!open && summary && <span className="mt-0.5 block truncate text-[11px] text-ink-4">{summary}</span>}
          </span>
        </button>
        {action}
      </div>
      {open && <div className="px-4 pb-4 animate-fade-in">{children}</div>}
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

/* --------------------------------------------------------- Case details */

function CaseDetails({ c, assignee }: { c: Case; assignee?: User }) {
  const priority = PRIORITY_META[c.priority]
  const status = STATUS_META[c.status]
  const due = c.dueAt ? daysUntil(c.dueAt) : null

  return (
    <Section title="Detail Kasus" icon={<Briefcase size={13} />} summary={`${c.code} · ${c.title}`}>
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

/* -------------------------------------------------------- Report source */

function ReportSourceSection({
  source,
  documents,
  editable,
  recordedBy,
  onOpenDoc,
  onSave,
}: {
  source?: ReportSource
  documents: CaseDocument[]
  editable: boolean
  recordedBy?: string
  onOpenDoc: (id: string) => void
  onSave: (src: ReportSource, notaFile: File | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const edit = () => {
    setOpen(true)
    setEditing(true)
  }

  return (
    <Section
      title="Sumber Laporan"
      icon={<Radio size={13} />}
      open={open}
      onOpenChange={setOpen}
      summary={
        source
          ? `${SOURCE_META[source.kind].label}${
              source.kind === 'wbs' ? ` · ${source.wbsNumber}` : source.kind === 'management' ? ` · ${source.notaDinasNumber}` : ''
            }`
          : 'Belum dicatat'
      }
      action={
        editable &&
        source &&
        !editing && (
          <Button size="xs" variant="ghost" icon={<Pencil size={11} />} onClick={edit}>
            Ubah
          </Button>
        )
      }
    >
      {editing ? (
        <ReportSourceForm
          initial={source}
          documents={documents}
          recordedBy={recordedBy}
          onCancel={() => setEditing(false)}
          onSave={async (src, file) => {
            await onSave(src, file)
            setEditing(false)
          }}
        />
      ) : source ? (
        <ReportSourceView source={source} documents={documents} onOpenDoc={onOpenDoc} />
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong bg-abyss/30 px-4 py-4 text-center">
          <p className="text-[12px] font-medium text-ink-2">Sumber laporan belum dicatat</p>
          <p className="mt-1 text-[11px] text-ink-4">WBS, Management Report, atau Internal Report.</p>
          {editable && (
            <Button className="mt-3" size="sm" variant="outline" icon={<Radio size={13} />} onClick={edit}>
              Catat sumber laporan
            </Button>
          )}
        </div>
      )}
    </Section>
  )
}

function ReportSourceView({
  source,
  documents,
  onOpenDoc,
}: {
  source: ReportSource
  documents: CaseDocument[]
  onOpenDoc: (id: string) => void
}) {
  const meta = SOURCE_META[source.kind]
  const nota = documents.find((d) => d.id === source.notaDinasDocId)
  return (
    <div className="rounded-lg border border-line-soft bg-abyss/30 p-3">
      <div className="flex items-center gap-2.5">
        <span className="tone flex size-8 shrink-0 items-center justify-center rounded-lg border" style={tone(meta.color)}>
          <meta.icon size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-ink">{meta.label}</p>
          <p className="text-[10px] text-ink-4">
            Dicatat {source.recordedBy ? `oleh ${source.recordedBy} · ` : ''}
            <span className="tnum">{formatDate(source.recordedAt)}</span>
          </p>
        </div>
      </div>

      <div className="mt-2.5">
        {source.kind === 'wbs' && (
          <Row label="Nomor WBS">
            <span className="font-medium tnum">{source.wbsNumber}</span>
          </Row>
        )}
        {source.kind === 'management' && (
          <>
            <Row label="No. Nota Dinas">
              <span className="font-medium tnum">{source.notaDinasNumber}</span>
            </Row>
            <Row label="Dokumen">
              {nota ? (
                <button onClick={() => onOpenDoc(nota.id)} className="flex max-w-full items-center gap-1.5 text-left text-brand-bright hover:underline">
                  <Paperclip size={11} className="shrink-0" />
                  <span className="truncate">{nota.name}</span>
                </button>
              ) : (
                <span className="text-warn">Dokumen nota dinas belum dilampirkan</span>
              )}
            </Row>
          </>
        )}
        {source.kind === 'internal' && (
          <div>
            <p className="mb-1 text-[11px] text-ink-4">Investigation Notes</p>
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-2">{source.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ReportSourceForm({
  initial,
  documents,
  recordedBy,
  onCancel,
  onSave,
}: {
  initial?: ReportSource
  documents: CaseDocument[]
  recordedBy?: string
  onCancel: () => void
  onSave: (src: ReportSource, notaFile: File | null) => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<ReportSourceKind>(initial?.kind ?? 'wbs')
  const [wbsNumber, setWbsNumber] = useState(initial?.wbsNumber ?? '')
  const [notaNumber, setNotaNumber] = useState(initial?.notaDinasNumber ?? '')
  const [notaDocId, setNotaDocId] = useState(initial?.notaDinasDocId ?? '')
  const [notaFile, setNotaFile] = useState<File | null>(null)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const valid =
    kind === 'wbs'
      ? !!wbsNumber.trim()
      : kind === 'management'
        ? !!notaNumber.trim() && (!!notaFile || !!notaDocId)
        : !!notes.trim()

  const save = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const base = { kind, recordedBy: recordedBy ?? initial?.recordedBy, recordedAt: new Date().toISOString() }
      const src: ReportSource =
        kind === 'wbs'
          ? { ...base, wbsNumber: wbsNumber.trim() }
          : kind === 'management'
            ? { ...base, notaDinasNumber: notaNumber.trim(), notaDinasDocId: notaFile ? undefined : notaDocId }
            : { ...base, notes: notes.trim() }
      await onSave(src, kind === 'management' ? notaFile : null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5" role="radiogroup" aria-label="Sumber laporan">
        {(Object.keys(SOURCE_META) as ReportSourceKind[]).map((k, i) => {
          const m = SOURCE_META[k]
          const on = kind === k
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setKind(k)}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                on ? 'border-brand/50 bg-brand/8' : 'border-line-soft hover:border-line-strong',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                  on ? 'border-brand' : 'border-line-strong',
                )}
              >
                {on && <span className="size-2 rounded-full bg-brand" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-ink">
                  {i + 1}. {m.label}
                </span>
                <span className="block text-[10.5px] leading-snug text-ink-4">{m.blurb}</span>
              </span>
            </button>
          )
        })}
      </div>

      {kind === 'wbs' && (
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-ink-2">
            Nomor WBS <span className="text-danger">*</span>
          </span>
          <Input autoFocus value={wbsNumber} onChange={(e) => setWbsNumber(e.target.value)} placeholder="mis. WBS-2026-0117" />
        </label>
      )}

      {kind === 'management' && (
        <>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">
              Nomor Nota Dinas <span className="text-danger">*</span>
            </span>
            <Input autoFocus value={notaNumber} onChange={(e) => setNotaNumber(e.target.value)} placeholder="mis. 041/PIS0400/2026-S0" />
          </label>
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-ink-2">
              Dokumen Nota Dinas <span className="text-danger">*</span>
            </span>
            {notaFile ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-brand/40 bg-brand/8 px-3 py-2">
                <Paperclip size={13} className="shrink-0 text-brand-bright" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-ink">{notaFile.name}</span>
                  <span className="text-[10.5px] text-ink-4 tnum">{formatBytes(notaFile.size)}</span>
                </span>
                <IconButton label="Hapus berkas" size={24} onClick={() => setNotaFile(null)}>
                  <X size={12} />
                </IconButton>
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong bg-abyss/35 px-3 py-3 text-[12px] text-ink-2 transition-colors hover:border-brand/60 hover:bg-brand/6"
                >
                  <Upload size={14} /> Unggah nota dinas
                </button>
                {documents.length > 0 && (
                  <Select
                    aria-label="Atau pilih dari dokumen pendukung"
                    className="h-8 text-[12px]"
                    value={notaDocId}
                    onChange={(e) => setNotaDocId(e.target.value)}
                    options={[
                      { value: '', label: '— atau pilih dari dokumen pendukung —' },
                      ...documents.map((d) => ({ value: d.id, label: d.name })),
                    ]}
                  />
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => {
                setNotaFile(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </div>
        </>
      )}

      {kind === 'internal' && (
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-ink-2">
            Investigation Notes <span className="text-danger">*</span>
          </span>
          <Textarea
            autoFocus
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Temuan awal yang menjadi dasar investigasi — apa, kapan, siapa yang menemukan."
          />
          <span className="mt-1 block text-[10.5px] text-ink-4">Internal Report tidak bernomor.</span>
        </label>
      )}

      <div className="flex justify-end gap-2">
        {initial && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Batal
          </Button>
        )}
        <Button size="sm" variant="primary" onClick={save} disabled={!valid} loading={saving}>
          Simpan
        </Button>
      </div>
    </div>
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
    <Section
      title="Siapa yang boleh melihat"
      icon={<KeyRound size={13} />}
      summary={`${viaSprint.length} lewat SPRINT · ${viaRole.length} lewat peran`}
    >
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
            {viaRole.length === 0 ? <p className="text-[11.5px] text-ink-4">Tidak ada.</p> : viaRole.map((u) => chip(u, true))}
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
  notaId,
  onSelect,
  onAdd,
  onRemove,
}: {
  documents: CaseDocument[]
  openId: string | null
  notaId?: string
  onSelect: (id: string) => void
  onAdd: (list: FileList | null) => void
  onRemove: (doc: CaseDocument) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const browse = () => fileRef.current?.click()

  return (
    <Section
      title="Dokumen Pendukung"
      icon={<ClipboardList size={13} />}
      summary={documents.length === 0 ? 'Belum ada dokumen' : `${documents.length} dokumen dasar investigasi`}
      action={
        <Button size="xs" variant="outline" icon={<Upload size={12} />} onClick={browse}>
          Unggah
        </Button>
      }
    >
      <p className="mb-3 text-[11px] leading-relaxed text-ink-4">Dokumen yang dijadikan dasar investigasi.</p>
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
          <p className="mt-0.5 text-[10.5px] text-ink-4">Laporan, kronologi, bukti awal, lampiran.</p>
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
                        {d.id === notaId && <span className="text-brand-bright">sumber laporan</span>}
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

function DocumentViewer({ doc, onBack, onRemove }: { doc: CaseDocument; onBack: () => void; onRemove: () => void }) {
  const color = categoryColor(doc.category)
  const Icon = docIcon(doc.mime)

  return (
    <div className="flex h-full flex-col animate-fade-in">
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

        <Button size="sm" variant="outline" icon={<Download size={13} />} onClick={() => downloadBlob(doc.blobId, doc.name)}>
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

      <div className="min-h-0 flex-1 overflow-auto bg-abyss/20 p-4">
        <BlobPreview blobId={doc.blobId} mime={doc.mime} name={doc.name} size={doc.size} />
      </div>
    </div>
  )
}
