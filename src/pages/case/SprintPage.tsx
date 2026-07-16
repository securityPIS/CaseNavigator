import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Ban,
  Download,
  FileSignature,
  KeyRound,
  Paperclip,
  Plus,
  ScrollText,
  ShieldCheck,
  Upload,
  UserPlus,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import { SPRINT_STATE_META, can, sprintState } from '@/domain/access'
import type { Role, Sprint, SprintPosition, User } from '@/domain/types'
import { cn, formatBytes, formatDate, uid } from '@/lib/utils'
import { Avatar, Badge, Button, Card, EmptyState, IconButton, Input, Select, Textarea, tone, Tooltip } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/pages/CasesPage'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'

const POSITION_META: Record<SprintPosition, { label: string; color: string }> = {
  ketua: { label: 'Ketua Tim', color: '#3B82F6' },
  sekretaris: { label: 'Sekretaris', color: '#8B5CF6' },
  anggota: { label: 'Anggota', color: '#6A7FA3' },
}

const POSITION_ORDER: SprintPosition[] = ['ketua', 'sekretaris', 'anggota']

export function SprintPage() {
  const { caseId = '' } = useParams()
  const userId = useSession((s) => s.userId)

  const sprints = useLiveQuery(
    async () => (await db.sprints.where('caseId').equals(caseId).toArray()).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    [caseId],
  )
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const roles = useLiveQuery(() => db.roles.toArray(), [], [])
  const me = users.find((u) => u.id === userId)
  const myRole = roles.find((r) => r.id === me?.role)
  const manage = can(myRole, 'sprint.manage')

  const [issuing, setIssuing] = useState(false)

  if (!sprints) return <PageSpinner />

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-7">
      <div className="mx-auto max-w-[1080px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[620px]">
            <h2 className="text-[16px] font-semibold text-ink">Surat Perintah Investigasi (SPRINT)</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">
              An order names the investigators authorised to work this case — and naming them here is what grants them
              access to it. An investigator with no active SPRINT on this case cannot open it at all.
            </p>
          </div>
          {manage && (
            <Button variant="primary" icon={<Plus size={13} />} onClick={() => setIssuing(true)}>
              Issue SPRINT
            </Button>
          )}
        </header>

        <AccessSummary caseSprints={sprints} users={users} roles={roles} />

        {sprints.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ScrollText size={22} />}
              title="No SPRINT issued"
              description={
                manage
                  ? 'This case has no order yet, so no investigator can reach it. Issue a SPRINT and name the team.'
                  : 'This case has no order yet. Only roles that can see every case can reach it until one is issued.'
              }
              action={
                manage ? (
                  <Button variant="primary" icon={<Plus size={14} />} onClick={() => setIssuing(true)}>
                    Issue SPRINT
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {sprints.map((s) => (
              <SprintCard key={s.id} sprint={s} users={users} manage={manage} />
            ))}
          </div>
        )}
      </div>

      {issuing && <IssueSprintModal caseId={caseId} users={users} roles={roles} onClose={() => setIssuing(false)} />}
    </div>
  )
}

/* -------------------------------------------------------- Access summary */

function AccessSummary({ caseSprints, users, roles }: { caseSprints: Sprint[]; users: User[]; roles: Role[] }) {
  const viaSprint = useMemo(() => {
    const ids = new Set<string>()
    for (const s of caseSprints) {
      if (sprintState(s) !== 'active') continue
      for (const m of s.members) ids.add(m.userId)
    }
    return [...ids].map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u)
  }, [caseSprints, users])

  const viaRole = users.filter((u) => {
    if (!u.active || viaSprint.some((v) => v.id === u.id)) return false
    return can(roles.find((r) => r.id === u.role), 'case.viewAll')
  })

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <KeyRound size={13} className="text-brand-bright" />
        <h3 className="text-[12.5px] font-semibold text-ink">Who can open this case</h3>
      </div>

      <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">
            Named on an active SPRINT
          </p>
          <div className="flex flex-wrap gap-2">
            {viaSprint.length === 0 && <p className="text-[11.5px] text-ink-4">Nobody — no active order names an investigator.</p>}
            {viaSprint.map((u) => (
              <span key={u.id} className="flex items-center gap-2 rounded-full border border-brand/35 bg-brand/8 py-1 pl-1 pr-2.5">
                <Avatar src={u.avatar} name={u.name} size={20} />
                <span className="text-[11.5px] text-ink-2">{u.name}</span>
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">
            By role — sees every case
          </p>
          <div className="flex flex-wrap gap-2">
            {viaRole.length === 0 && <p className="text-[11.5px] text-ink-4">Nobody.</p>}
            {viaRole.map((u) => {
              const role = roles.find((r) => r.id === u.role)
              return (
                <Tooltip key={u.id} label={`${role?.name ?? 'Unknown role'} — case.viewAll`}>
                  <span className="flex items-center gap-2 rounded-full border border-line bg-abyss/40 py-1 pl-1 pr-2.5">
                    <Avatar src={u.avatar} name={u.name} size={20} />
                    <span className="text-[11.5px] text-ink-2">{u.name}</span>
                  </span>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ----------------------------------------------------------- Sprint card */

function SprintCard({ sprint, users, manage }: { sprint: Sprint; users: User[]; manage: boolean }) {
  const [adding, setAdding] = useState(false)
  const state = sprintState(sprint)
  const meta = SPRINT_STATE_META[state]
  const editable = manage && (state === 'active' || state === 'scheduled')

  const members = [...sprint.members].sort(
    (a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position),
  )

  const download = async () => {
    const rec = await db.blobs.get(sprint.docBlobId)
    if (!rec) {
      toast.error('Document missing', 'The uploaded order could not be found in this browser.')
      return
    }
    const url = URL.createObjectURL(rec.data)
    const a = document.createElement('a')
    a.href = url
    a.download = sprint.docName
    a.click()
    URL.revokeObjectURL(url)
  }

  const removeMember = async (userId: string) => {
    const next = sprint.members.filter((m) => m.userId !== userId)
    await db.sprints.update(sprint.id, { members: next, updatedAt: new Date().toISOString() })
    const name = users.find((u) => u.id === userId)?.name ?? 'Investigator'
    toast.success('Investigator removed', `${name} can no longer open this case through this order.`)
  }

  const revoke = async () => {
    await db.sprints.update(sprint.id, { revoked: true, updatedAt: new Date().toISOString() })
    toast.success('SPRINT revoked', 'Its investigators lose access to this case immediately.')
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line-soft p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tone flex size-8 shrink-0 items-center justify-center rounded-lg border" style={tone(meta.color)}>
              <FileSignature size={15} />
            </span>
            <h3 className="text-[14px] font-semibold text-ink tnum">{sprint.number}</h3>
            <Badge color={meta.color} size="sm" dot>
              {meta.label}
            </Badge>
          </div>
          <p className="mt-2 max-w-[640px] text-[12px] leading-relaxed text-ink-2">{sprint.subject}</p>
          <p className="mt-1.5 text-[11px] text-ink-4">
            Issued by <span className="text-ink-3">{sprint.issuedBy}</span> · {formatDate(sprint.issuedAt)} · valid{' '}
            {formatDate(sprint.validFrom)}
            {sprint.validUntil ? ` – ${formatDate(sprint.validUntil)}` : ' until revoked'}
          </p>
          {sprint.notes && <p className="mt-2 text-[11px] italic leading-relaxed text-ink-4">{sprint.notes}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" icon={<Download size={12} />} onClick={download}>
            Surat Perintah
          </Button>
          {manage && !sprint.revoked && (
            <Tooltip label="Revoke this order">
              <IconButton label="Revoke" size={30} className="hover:text-danger" onClick={revoke}>
                <Ban size={14} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_220px]">
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">
              Investigators ({members.length})
            </p>
            {editable && (
              <Button size="xs" variant="ghost" icon={<UserPlus size={11} />} onClick={() => setAdding(true)}>
                Add
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            {members.length === 0 && (
              <p className="text-[11.5px] text-ink-4">No investigator named — this order grants nobody access.</p>
            )}
            {members.map((m) => {
              const u = users.find((x) => x.id === m.userId)
              const pos = POSITION_META[m.position]
              return (
                <div
                  key={m.userId}
                  className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-abyss/30 px-2.5 py-2"
                >
                  <Avatar src={u?.avatar} name={u?.name ?? m.userId} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">{u?.name ?? 'Unknown user'}</p>
                    <p className="truncate text-[10.5px] text-ink-4">{u?.title}</p>
                  </div>
                  <Badge color={pos.color} size="sm">
                    {pos.label}
                  </Badge>
                  {editable && (
                    <IconButton label={`Remove ${u?.name ?? 'member'}`} size={24} className="hover:text-danger" onClick={() => removeMember(m.userId)}>
                      <X size={11} />
                    </IconButton>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">Document</p>
          <button
            onClick={download}
            className="flex w-full items-start gap-2.5 rounded-lg border border-line-soft bg-abyss/30 p-2.5 text-left transition-colors hover:border-brand/45"
          >
            <Paperclip size={13} className="mt-0.5 shrink-0 text-ink-3" />
            <span className="min-w-0">
              <span className="block truncate text-[11.5px] text-ink-2">{sprint.docName}</span>
              <span className="mt-0.5 block text-[10px] text-ink-4 tnum">{formatBytes(sprint.docSize)}</span>
            </span>
          </button>
        </div>
      </div>

      {adding && <AddMemberModal sprint={sprint} users={users} onClose={() => setAdding(false)} />}
    </Card>
  )
}

/* ---------------------------------------------------------- Add a member */

function AddMemberModal({ sprint, users, onClose }: { sprint: Sprint; users: User[]; onClose: () => void }) {
  const candidates = users.filter((u) => u.active && !sprint.members.some((m) => m.userId === u.id))
  const [userId, setUserId] = useState(candidates[0]?.id ?? '')
  const [position, setPosition] = useState<SprintPosition>('anggota')

  const add = async () => {
    if (!userId) return
    const next = [...sprint.members, { userId, position, addedAt: new Date().toISOString() }]
    await db.sprints.update(sprint.id, { members: next, updatedAt: new Date().toISOString() })
    toast.success('Investigator added', `${users.find((u) => u.id === userId)?.name} can now open this case.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add investigator to SPRINT"
      description="Adding someone here grants them access to this case straight away."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={add} disabled={!userId}>
            Add to order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Investigator" required>
          <Select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            options={candidates.map((u) => ({ value: u.id, label: `${u.name} — ${u.title}` }))}
          />
        </Field>
        <Field label="Position">
          <Select
            value={position}
            onChange={(e) => setPosition(e.target.value as SprintPosition)}
            options={POSITION_ORDER.map((p) => ({ value: p, label: POSITION_META[p].label }))}
          />
        </Field>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------- Issue a SPRINT */

function IssueSprintModal({
  caseId,
  users,
  roles,
  onClose,
}: {
  caseId: string
  users: User[]
  roles: Role[]
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().slice(0, 10)

  const [number, setNumber] = useState('')
  const [subject, setSubject] = useState('')
  const [issuedBy, setIssuedBy] = useState('')
  const [validFrom, setValidFrom] = useState(today)
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [members, setMembers] = useState<{ userId: string; position: SprintPosition }[]>([])
  const [saving, setSaving] = useState(false)

  // Investigators first: they are who an order exists to authorise. Everyone
  // else is listed too, since a case can name a specialist from any role.
  const candidates = useMemo(() => {
    const rank = (u: User) => (u.role === 'r-investigator' ? 0 : 1)
    return users.filter((u) => u.active).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  }, [users])

  const toggle = (userId: string) => {
    setMembers((prev) =>
      prev.some((m) => m.userId === userId)
        ? prev.filter((m) => m.userId !== userId)
        : [...prev, { userId, position: prev.length === 0 ? 'ketua' : 'anggota' }],
    )
  }

  const valid = number.trim() && subject.trim() && issuedBy.trim() && file && members.length > 0

  const create = async () => {
    if (!valid || !file) return
    setSaving(true)
    try {
      const blobId = uid('blob')
      await db.blobs.add({ id: blobId, data: file })
      const now = new Date().toISOString()
      await db.sprints.add({
        id: uid('sp'),
        caseId,
        number: number.trim(),
        subject: subject.trim(),
        issuedBy: issuedBy.trim(),
        issuedAt: now,
        validFrom: new Date(validFrom).toISOString(),
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        revoked: false,
        members: members.map((m) => ({ ...m, addedAt: now })),
        docBlobId: blobId,
        docName: file.name,
        docMime: file.type || 'application/octet-stream',
        docSize: file.size,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      })
      toast.success('SPRINT issued', `${members.length} investigator${members.length > 1 ? 's' : ''} can now open this case.`)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Issue Surat Perintah Investigasi"
      description="The signed order is required — without the document there is nothing authorising the team you name."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={!valid} loading={saving}>
            Issue SPRINT
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor SPRINT" required>
            <Input autoFocus value={number} onChange={(e) => setNumber(e.target.value)} placeholder="SPRINT-121/INV/VI/2026" />
          </Field>
          <Field label="Diterbitkan oleh" required>
            <Input value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} placeholder="Nama dan jabatan pejabat" />
          </Field>
        </div>

        <Field label="Perihal" required>
          <Textarea rows={2} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ruang lingkup perintah investigasi" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Berlaku dari" required>
            <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </Field>
          <Field label="Berlaku sampai" hint="Leave empty for an order that stands until revoked.">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </div>

        {/* Document — the hard requirement */}
        <Field label="Dokumen Surat Perintah" required hint="Scan of the signed order. Any file type, stored in this browser.">
          {file ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-brand/40 bg-brand/8 px-3 py-2.5">
              <Paperclip size={13} className="shrink-0 text-brand-bright" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-ink">{file.name}</span>
                <span className="text-[10.5px] text-ink-4 tnum">{formatBytes(file.size)}</span>
              </span>
              <IconButton label="Remove file" size={24} onClick={() => setFile(null)}>
                <X size={12} />
              </IconButton>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-strong bg-abyss/35 px-4 py-6 transition-colors hover:border-brand/60 hover:bg-brand/6"
            >
              <Upload size={18} className="text-ink-3" />
              <span className="mt-2 text-[12px] font-medium text-ink">Upload the Surat Perintah</span>
              <span className="mt-0.5 text-[10.5px] text-ink-4">Required — PDF or scan</span>
            </button>
          )}
          <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>

        {/* Team */}
        <Field label="Investigator" required hint="Whoever you name here — and only them — can open this case.">
          <div className="max-h-[220px] space-y-1 overflow-y-auto rounded-lg border border-line bg-abyss/35 p-2">
            {candidates.map((u) => {
              const picked = members.find((m) => m.userId === u.id)
              const role = roles.find((r) => r.id === u.role)
              const viewAll = can(role, 'case.viewAll')
              return (
                <div
                  key={u.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
                    picked ? 'bg-brand/10' : 'hover:bg-tint/6',
                  )}
                >
                  <button onClick={() => toggle(u.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                        picked ? 'border-brand bg-brand text-white' : 'border-line-strong',
                      )}
                    >
                      {picked && <ShieldCheck size={9} />}
                    </span>
                    <Avatar src={u.avatar} name={u.name} size={24} />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] text-ink">{u.name}</span>
                      <span className="block truncate text-[10px] text-ink-4">
                        {u.title} · {role?.name ?? 'No role'}
                        {viewAll && ' · already sees every case'}
                      </span>
                    </span>
                  </button>

                  {picked && (
                    <div className="w-[124px] shrink-0">
                      <Select
                        className="h-7 text-[11px]"
                        value={picked.position}
                        onChange={(e) =>
                          setMembers((prev) =>
                            prev.map((m) => (m.userId === u.id ? { ...m, position: e.target.value as SprintPosition } : m)),
                          )
                        }
                        options={POSITION_ORDER.map((p) => ({ value: p, label: POSITION_META[p].label }))}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Field>

        <Field label="Catatan">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — context for this order" />
        </Field>
      </div>
    </Modal>
  )
}
