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
  Lock,
  Megaphone,
  NotebookPen,
  Paperclip,
  Pencil,
  Radio,
  ShieldCheck,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import { SPRINT_STATE_META, can, sprintState } from '@/domain/access'
import { menimbangFromSources } from '@/domain/sprintLetter'
import type { Case, CaseDocument, ReportSource, ReportSourceKind, Role, Sprint, User } from '@/domain/types'
import { cn, daysUntil, formatBytes, formatDate, formatDateTime, PRIORITY_META, STATUS_META, uid } from '@/lib/utils'
import { Avatar, Badge, Button, EmptyState, IconButton, Input, Progress, Select, Textarea, tone, Tooltip } from '@/components/ui/primitives'
import { BlobPreview, downloadBlob } from '@/components/ui/BlobPreview'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'
import { SprintLetterModal } from './SprintLetterModal'
import { AddInvestigatorModal, InvestigatorList, SprintListItem, SprintViewer, useSprintLetter } from './SprintParts'

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
  // A deactivated account holds no permission, whatever its role grants.
  const active = !!me?.active
  const viewSprint = active && can(myRole, 'sprint.view')
  const manageSprint = viewSprint && can(myRole, 'sprint.manage')
  const editCase = active && can(myRole, 'case.edit')

  const [drafting, setDrafting] = useState<Sprint | 'new' | null>(null)
  const [addingInvestigator, setAddingInvestigator] = useState(false)

  const documents = useMemo(
    () => [...(c?.documents ?? [])].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
    [c?.documents],
  )
  const openDoc = useMemo(() => documents.find((d) => d.id === docId) ?? null, [documents, docId])
  // A SPRINT opens only for roles that may read one, whatever the URL says.
  const openSprint = useMemo(
    () => (viewSprint ? (sprints?.find((s) => s.id === sprintId) ?? null) : null),
    [sprints, sprintId, viewSprint],
  )
  // One case, one SPRINT.
  const sprint = sprints?.[0]
  const sources = useMemo(() => c?.reportSources ?? [], [c?.reportSources])
  const letter = useSprintLetter(sprint, { users, caseTitle: c?.title, reportSources: sources })
  const notaIds = useMemo(() => new Set(sources.map((x) => x.notaDinasDocId).filter((x): x is string => !!x)), [sources])

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
    const sp = viewSprint ? (sprints.find((s) => sprintState(s) === 'active') ?? sprints[0]) : undefined
    if (sp) select({ kind: 'sprint', id: sp.id }, true)
    else if (documents[0]) select({ kind: 'doc', id: documents[0].id }, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprints, documents, openDoc, openSprint, viewSprint])

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
    if (!list?.length || !c || !editCase) return
    const added: CaseDocument[] = []
    for (const file of list) added.push(await storeFile(file, 'Lampiran'))
    await db.cases.update(caseId, { documents: [...(c.documents ?? []), ...added], updatedAt: new Date().toISOString() })
    toast.success('Dokumen ditambahkan', `${added.length} berkas tersimpan lokal di browser ini.`)
    if (added[0]) select({ kind: 'doc', id: added[0].id }, true)
  }

  const removeDoc = async (doc: CaseDocument) => {
    if (!c || !editCase) return
    const isNota = notaIds.has(doc.id)
    if (isNota && !window.confirm(`“${doc.name}” adalah nota dinas sumber laporan. Tetap hapus?`)) return
    if (doc.blobId) await db.blobs.delete(doc.blobId)
    await db.cases.update(caseId, {
      documents: (c.documents ?? []).filter((d) => d.id !== doc.id),
      reportSources: sources.map((x) => (x.notaDinasDocId === doc.id ? { ...x, notaDinasDocId: undefined } : x)),
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
    const list = sources.some((x) => x.id === next.id) ? sources.map((x) => (x.id === next.id ? next : x)) : [...sources, next]
    await db.cases.update(caseId, { reportSources: list, documents: docs, updatedAt: new Date().toISOString() })
    toast.success('Sumber laporan disimpan', SOURCE_META[src.kind].label)
  }

  const removeSource = async (src: ReportSource) => {
    await db.cases.update(caseId, { reportSources: sources.filter((x) => x.id !== src.id), updatedAt: new Date().toISOString() })
    toast.success('Sumber laporan dihapus', SOURCE_META[src.kind].label)
  }

  const saveViewers = async (viewerIds: string[]) => {
    await db.cases.update(caseId, { viewerIds, updatedAt: new Date().toISOString() })
  }

  const saveNote = async (doc: CaseDocument, note: string) => {
    if (!c || !editCase) return
    await db.cases.update(caseId, {
      documents: (c.documents ?? []).map((d) => (d.id === doc.id ? { ...d, note: note || undefined } : d)),
      updatedAt: new Date().toISOString(),
    })
    toast.success('Deskripsi disimpan', doc.name)
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
            sources={sources}
            documents={documents}
            editable={editCase}
            recordedBy={me?.name}
            onOpenDoc={(id) => select({ kind: 'doc', id })}
            onSave={saveSource}
            onRemove={removeSource}
          />

          {viewSprint ? (
            <>
              <Section
                title="SPRINT"
                icon={<FileSignature size={13} />}
                summary={
                  sprint ? `${sprint.number} · ${SPRINT_STATE_META[sprintState(sprint)].label}` : 'Belum ada Surat Perintah'
                }
                action={
                  // One case, one SPRINT: the way to add one goes once it exists.
                  manageSprint &&
                  !sprint && (
                    <Button size="xs" variant="primary" icon={<FilePen size={12} />} onClick={() => setDrafting('new')}>
                      Buat SPRINT
                    </Button>
                  )
                }
              >
                {!sprint ? (
                  <div className="rounded-xl border border-dashed border-line-strong bg-abyss/30 px-4 py-5 text-center">
                    <p className="text-[12px] font-medium text-ink-2">Belum ada Surat Perintah</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
                      Tanpa SPRINT aktif, tidak ada investigator yang dapat membuka perkara ini. Satu perkara hanya
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
                      sprint={sprint}
                      active={sprint.id === sprintId}
                      onSelect={() => select({ kind: 'sprint', id: sprint.id })}
                    />
                    <p className="text-[10.5px] leading-relaxed text-ink-4">
                      Satu perkara hanya memiliki satu SPRINT. Tim diatur di Investigators.
                    </p>
                  </div>
                )}
              </Section>

              <Section
                title="Investigators"
                icon={<Users size={13} />}
                summary={
                  !sprint
                    ? 'Ditunjuk lewat SPRINT'
                    : sprint.members.length === 0
                      ? 'Belum ada investigator'
                      : `${sprint.members.length} investigator · ${
                          users.find((u) => u.id === (sprint.members.find((m) => m.position === 'ketua') ?? sprint.members[0]).userId)?.name ?? ''
                        }`
                }
                action={
                  manageSprint &&
                  sprint &&
                  ['active', 'scheduled'].includes(sprintState(sprint)) && (
                    <Button size="xs" variant="ghost" icon={<UserPlus size={11} />} onClick={() => setAddingInvestigator(true)}>
                      Tambah
                    </Button>
                  )
                }
              >
                {sprint ? (
                  <InvestigatorList
                    sprint={sprint}
                    letter={letter}
                    users={users}
                    editable={manageSprint && ['active', 'scheduled'].includes(sprintState(sprint))}
                  />
                ) : (
                  <p className="text-[11.5px] text-ink-4">Investigator ditunjuk lewat SPRINT. Buat SPRINT terlebih dahulu.</p>
                )}
              </Section>

              <AccessList
                sprints={sprints}
                viewerIds={c.viewerIds ?? []}
                users={users}
                roles={roles}
                meId={userId}
                editable={manageSprint}
                onChange={saveViewers}
              />
            </>
          ) : (
            <Section title="SPRINT" icon={<FileSignature size={13} />} summary="Tidak dapat dilihat dengan peran ini">
              <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-4">
                <Lock size={12} className="mt-0.5 shrink-0" />
                Surat Perintah, investigator dan daftar akses perkara ini memerlukan izin View SPRINT.
              </p>
            </Section>
          )}

          <DocumentList
            documents={documents}
            openId={docId}
            notaIds={notaIds}
            editable={editCase}
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
            letter={letter!}
            manage={manageSprint}
            onBack={() => select(null)}
            onEditDraft={() => setDrafting(openSprint)}
          />
        ) : openDoc ? (
          <DocumentViewer
            key={openDoc.id}
            doc={openDoc}
            editable={editCase}
            onBack={() => select(null)}
            onRemove={() => removeDoc(openDoc)}
            onSaveNote={(note) => saveNote(openDoc, note)}
          />
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
          menimbangHint={menimbangFromSources(sources, c.title)}
          onClose={() => setDrafting(null)}
          onSaved={(id) => select({ kind: 'sprint', id }, true)}
        />
      )}
      {addingInvestigator && sprint && (
        <AddInvestigatorModal sprint={sprint} users={users} onClose={() => setAddingInvestigator(false)} />
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

/**
 * Every channel the case was reported through. A case can arrive by more
 * than one — a WBS report followed by a nota dinas, say — so each source is
 * its own entry, added, changed or removed independently.
 */
function ReportSourceSection({
  sources,
  documents,
  editable,
  recordedBy,
  onOpenDoc,
  onSave,
  onRemove,
}: {
  sources: ReportSource[]
  documents: CaseDocument[]
  editable: boolean
  recordedBy?: string
  onOpenDoc: (id: string) => void
  onSave: (src: ReportSource, notaFile: File | null) => Promise<void>
  onRemove: (src: ReportSource) => Promise<void>
}) {
  /** Id of the source being edited, 'new' while adding one, or null. */
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const start = (id: string) => {
    setOpen(true)
    setEditing(id)
  }

  return (
    <Section
      title="Sumber Laporan"
      icon={<Radio size={13} />}
      open={open}
      onOpenChange={setOpen}
      summary={
        sources.length === 0
          ? 'Belum dicatat'
          : sources
              .map((src) =>
                src.kind === 'wbs'
                  ? `WBS ${src.wbsNumber}`
                  : src.kind === 'management'
                    ? `Nota Dinas ${src.notaDinasNumber}`
                    : 'Internal Report',
              )
              .join(' · ')
      }
      action={
        editable &&
        editing === null && (
          <Button size="xs" variant="ghost" icon={<Plus size={11} />} onClick={() => start('new')}>
            Tambah
          </Button>
        )
      }
    >
      <div className="space-y-2">
        {sources.map((src, i) =>
          editing === src.id ? (
            <ReportSourceForm
              key={src.id}
              initial={src}
              documents={documents}
              recordedBy={recordedBy}
              onCancel={() => setEditing(null)}
              onSave={async (next, file) => {
                await onSave(next, file)
                setEditing(null)
              }}
            />
          ) : (
            <ReportSourceView
              key={src.id}
              index={i + 1}
              source={src}
              documents={documents}
              onOpenDoc={onOpenDoc}
              onEdit={editable && editing === null ? () => start(src.id) : undefined}
              onRemove={
                editable && editing === null
                  ? () => {
                      if (window.confirm(`Hapus sumber laporan ${SOURCE_META[src.kind].label}?`)) void onRemove(src)
                    }
                  : undefined
              }
            />
          ),
        )}

        {editing === 'new' && (
          <div className="rounded-lg border border-brand/30 bg-brand/5 p-3">
            <p className="mb-2 text-[11px] font-medium text-ink-2">Sumber laporan baru</p>
            <ReportSourceForm
              documents={documents}
              recordedBy={recordedBy}
              onCancel={() => setEditing(null)}
              onSave={async (next, file) => {
                await onSave(next, file)
                setEditing(null)
              }}
            />
          </div>
        )}

        {sources.length === 0 && editing !== 'new' && (
          <div className="rounded-xl border border-dashed border-line-strong bg-abyss/30 px-4 py-4 text-center">
            <p className="text-[12px] font-medium text-ink-2">Sumber laporan belum dicatat</p>
            <p className="mt-1 text-[11px] text-ink-4">WBS, Management Report, atau Internal Report — bisa lebih dari satu.</p>
            {editable && (
              <Button className="mt-3" size="sm" variant="outline" icon={<Plus size={13} />} onClick={() => start('new')}>
                Tambah sumber laporan
              </Button>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

function ReportSourceView({
  index,
  source,
  documents,
  onOpenDoc,
  onEdit,
  onRemove,
}: {
  index: number
  source: ReportSource
  documents: CaseDocument[]
  onOpenDoc: (id: string) => void
  onEdit?: () => void
  onRemove?: () => void
}) {
  const meta = SOURCE_META[source.kind]
  const nota = documents.find((d) => d.id === source.notaDinasDocId)
  return (
    <div className="group rounded-lg border border-line-soft bg-abyss/30 p-3">
      <div className="flex items-center gap-2.5">
        <span className="tone flex size-8 shrink-0 items-center justify-center rounded-lg border" style={tone(meta.color)}>
          <meta.icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-ink">
            <span className="mr-1 text-ink-4 tnum">{index}.</span>
            {meta.label}
          </p>
          <p className="text-[10px] text-ink-4">
            Dicatat {source.recordedBy ? `oleh ${source.recordedBy} · ` : ''}
            <span className="tnum">{formatDate(source.recordedAt)}</span>
          </p>
        </div>
        {onEdit && (
          <IconButton label="Ubah sumber laporan" size={26} onClick={onEdit}>
            <Pencil size={12} />
          </IconButton>
        )}
        {onRemove && (
          <IconButton label="Hapus sumber laporan" size={26} className="hover:text-danger" onClick={onRemove}>
            <Trash2 size={12} />
          </IconButton>
        )}
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
      const base = {
        id: initial?.id ?? uid('rs'),
        kind,
        recordedBy: initial?.recordedBy ?? recordedBy,
        recordedAt: initial?.recordedAt ?? new Date().toISOString(),
      }
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
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
        <Button size="sm" variant="primary" onClick={save} disabled={!valid} loading={saving}>
          Simpan
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Access list */

/**
 * Who can open the case, by the three routes that grant it: the SPRINT team
 * (managed under Investigators), people added here by hand, and roles that
 * see every case. Only the middle group is edited here.
 */
function AccessList({
  sprints,
  viewerIds,
  users,
  roles,
  meId,
  editable,
  onChange,
}: {
  sprints: Sprint[]
  viewerIds: string[]
  users: User[]
  roles: Role[]
  meId: string
  editable: boolean
  onChange: (next: string[]) => Promise<void>
}) {
  const [picking, setPicking] = useState('')

  const viaSprint = useMemo(() => {
    const ids = new Set<string>()
    for (const s of sprints) {
      if (sprintState(s) !== 'active') continue
      for (const m of s.members) ids.add(m.userId)
    }
    return [...ids].map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u)
  }, [sprints, users])

  const viewAll = (u: User) => {
    const role = roles.find((r) => r.id === u.role)
    return can(role, 'case.view') && can(role, 'case.viewAll')
  }
  const added = viewerIds.map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u)
  const viaRole = users.filter((u) => u.active && viewAll(u) && !viaSprint.some((v) => v.id === u.id))
  // Anyone who doesn't already reach the case some other way.
  const candidates = users.filter(
    (u) => u.active && !viewAll(u) && !viaSprint.some((v) => v.id === u.id) && !viewerIds.includes(u.id),
  )

  const chip = (u: User, tone: 'sprint' | 'added' | 'role', onRemove?: () => void) => {
    const role = roles.find((r) => r.id === u.role)
    return (
      <Tooltip
        key={u.id}
        label={tone === 'role' ? `${role?.name ?? 'Peran'} · melihat semua perkara` : (role?.name ?? 'Peran')}
      >
        <span
          className={cn(
            'flex items-center gap-2 rounded-full border py-1 pl-1',
            onRemove ? 'pr-1' : 'pr-2.5',
            tone === 'sprint' ? 'border-brand/35 bg-brand/8' : tone === 'added' ? 'border-ok/35 bg-ok/8' : 'border-line bg-abyss/40',
          )}
        >
          <Avatar src={u.avatar} name={u.name} size={20} />
          <span className="text-[11.5px] text-ink-2">
            {u.name}
            {u.id === meId && <span className="ml-1 text-[10px] text-ink-4">(anda)</span>}
          </span>
          {onRemove && (
            <IconButton label={`Cabut akses ${u.name}`} size={20} className="hover:text-danger" onClick={onRemove}>
              <X size={10} />
            </IconButton>
          )}
        </span>
      </Tooltip>
    )
  }

  const total = new Set([...viaSprint, ...added, ...viaRole].map((u) => u.id)).size

  return (
    <Section
      title="Siapa yang boleh melihat"
      icon={<KeyRound size={13} />}
      summary={`${total} orang · ${viaSprint.length} lewat SPRINT · ${added.length} ditambahkan · ${viaRole.length} lewat peran`}
    >
      <div className="space-y-3.5">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium text-ink-3">
            <ShieldCheck size={11} className="text-brand-bright" /> Investigator pada SPRINT aktif
          </p>
          <div className="flex flex-wrap gap-2">
            {viaSprint.length === 0 ? (
              <p className="text-[11.5px] text-ink-4">Belum ada — atur lewat Investigators.</p>
            ) : (
              viaSprint.map((u) => chip(u, 'sprint'))
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium text-ink-3">
            <UserPlus size={11} className="text-ok" /> Ditambahkan ke perkara ini
          </p>
          <div className="flex flex-wrap gap-2">
            {added.length === 0 ? (
              <p className="text-[11.5px] text-ink-4">Tidak ada.</p>
            ) : (
              added.map((u) =>
                chip(
                  u,
                  'added',
                  editable
                    ? () => {
                        void onChange(viewerIds.filter((id) => id !== u.id))
                        toast.success('Akses dicabut', `${u.name} tidak lagi dapat membuka perkara ini.`)
                      }
                    : undefined,
                ),
              )
            )}
          </div>
          {editable && candidates.length > 0 && (
            <div className="mt-2 flex gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  aria-label="Tambah orang"
                  className="h-8 text-[12px]"
                  value={picking}
                  onChange={(e) => setPicking(e.target.value)}
                  options={[
                    { value: '', label: '— Pilih orang —' },
                    ...candidates.map((u) => ({ value: u.id, label: `${u.name} · ${roles.find((r) => r.id === u.role)?.name ?? u.title}` })),
                  ]}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                icon={<UserPlus size={12} />}
                disabled={!picking}
                onClick={async () => {
                  const u = users.find((x) => x.id === picking)
                  await onChange([...viewerIds, picking])
                  setPicking('')
                  toast.success('Akses diberikan', `${u?.name} kini dapat membuka perkara ini.`)
                }}
              >
                Tambah
              </Button>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium text-ink-3">
            <Users size={11} /> Berdasarkan peran — melihat semua perkara
          </p>
          <div className="flex flex-wrap gap-2">
            {viaRole.length === 0 ? <p className="text-[11.5px] text-ink-4">Tidak ada.</p> : viaRole.map((u) => chip(u, 'role'))}
          </div>
          {editable && <p className="mt-1.5 text-[10.5px] text-ink-4">Diatur lewat peran di Admin → User Setting → User Role Setting.</p>}
        </div>
      </div>
    </Section>
  )
}

/* --------------------------------------------------------- Document list */

function DocumentList({
  documents,
  openId,
  notaIds,
  editable,
  onSelect,
  onAdd,
  onRemove,
}: {
  documents: CaseDocument[]
  openId: string | null
  notaIds: Set<string>
  editable: boolean
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
        editable && (
          <Button size="xs" variant="outline" icon={<Upload size={12} />} onClick={browse}>
            Unggah
          </Button>
        )
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

      {documents.length === 0 && !editable ? (
        <p className="text-[11.5px] text-ink-4">Belum ada dokumen.</p>
      ) : documents.length === 0 ? (
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
            if (editable) onAdd(e.dataTransfer.files)
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
                        {notaIds.has(d.id) && <span className="text-brand-bright">sumber laporan</span>}
                        {d.size !== undefined && <span className="tnum">{formatBytes(d.size)}</span>}
                      </span>
                      {d.note && <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-ink-3">{d.note}</span>}
                    </span>
                  </button>
                  {editable && (
                    <IconButton
                      label={`Hapus ${d.name}`}
                      size={26}
                      className="opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      onClick={() => onRemove(d)}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  )}
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

function DocumentViewer({
  doc,
  editable,
  onBack,
  onRemove,
  onSaveNote,
}: {
  doc: CaseDocument
  editable: boolean
  onBack: () => void
  onRemove: () => void
  onSaveNote: (note: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(doc.note ?? '')
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
        {editable && (
          <Tooltip label="Hapus dokumen">
            <IconButton label="Hapus dokumen" className="hover:text-danger" onClick={onRemove}>
              <Trash2 size={15} />
            </IconButton>
          </Tooltip>
        )}
      </header>

      {/* Description — why this document grounds the investigation */}
      <div className="shrink-0 border-b border-line-soft bg-abyss/25 px-4 py-2.5">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              autoFocus
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Deskripsi dokumen — isi singkat dan kaitannya dengan investigasi."
              className="text-[12px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setDraft(doc.note ?? '')
                  setEditing(false)
                }}
              >
                Batal
              </Button>
              <Button
                size="xs"
                variant="primary"
                onClick={async () => {
                  await onSaveNote(draft.trim())
                  setEditing(false)
                }}
              >
                Simpan deskripsi
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-4">Deskripsi</p>
              <p className={cn('mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed', doc.note ? 'text-ink-2' : 'italic text-ink-4')}>
                {doc.note || 'Belum ada deskripsi.'}
              </p>
            </div>
            {editable && (
              <Button size="xs" variant="ghost" icon={<Pencil size={11} />} onClick={() => setEditing(true)}>
                {doc.note ? 'Ubah' : 'Tambah'}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-abyss/20 p-4">
        <BlobPreview blobId={doc.blobId} mime={doc.mime} name={doc.name} size={doc.size} />
      </div>
    </div>
  )
}
