import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  Ban,
  Download,
  FilePen,
  FileSignature,
  Paperclip,
  Printer,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import { SPRINT_STATE_META, can, sprintState } from '@/domain/access'
import { letterFromSprint, printLetterHtml, renderSprintLetterHtml, roleOf } from '@/domain/sprintLetter'
import type { ReportSource, Role, Sprint, SprintPosition, User } from '@/domain/types'
import { cn, formatBytes, formatDate, uid } from '@/lib/utils'
import { Avatar, Badge, Button, IconButton, Input, Select, Textarea, tone, Tooltip } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { BlobPreview, downloadBlob } from '@/components/ui/BlobPreview'
import { LetterPreview } from '@/components/sprint/LetterParts'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'

export const POSITION_META: Record<SprintPosition, { label: string; color: string }> = {
  ketua: { label: 'Ketua Tim', color: '#3B82F6' },
  sekretaris: { label: 'Sekretaris', color: '#8B5CF6' },
  anggota: { label: 'Anggota', color: '#6A7FA3' },
}

const POSITION_ORDER: SprintPosition[] = ['ketua', 'sekretaris', 'anggota']

/** A case carries exactly one SPRINT; this guards every way of adding one. */
export async function caseHasSprint(caseId: string): Promise<boolean> {
  return (await db.sprints.where('caseId').equals(caseId).count()) > 0
}

/* ------------------------------------------------------------ List items */

/** One SPRINT in the Case Registration list. */
export function SprintListItem({ sprint, active, onSelect }: { sprint: Sprint; active: boolean; onSelect: () => void }) {
  const state = sprintState(sprint)
  const meta = SPRINT_STATE_META[state]
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        active ? 'border-brand/45 bg-brand/10' : 'border-line-soft hover:border-line-strong hover:bg-tint/4',
      )}
    >
      <span className="tone flex size-8 shrink-0 items-center justify-center rounded-lg border" style={tone(meta.color)}>
        {state === 'draft' ? <FilePen size={15} /> : <FileSignature size={15} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[12px] tnum', active ? 'font-medium text-ink' : 'text-ink-2')}>{sprint.number}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-4">
          <span style={{ color: meta.color }}>{meta.label}</span>
          <span className="tnum">· {formatDate(sprint.issuedAt)}</span>
          <span>· {sprint.members.length} penyidik</span>
        </span>
      </span>
    </button>
  )
}

/* --------------------------------------------------------------- Viewer */

/**
 * A SPRINT opened in the Case Registration viewer: the letter shown as the
 * document it prints as, or the signed scan, with the team it authorises.
 */
export function SprintViewer({
  sprint,
  users,
  manage,
  caseTitle,
  reportSource,
  onBack,
  onEditDraft,
}: {
  sprint: Sprint
  users: User[]
  manage: boolean
  caseTitle?: string
  reportSource?: ReportSource
  onBack: () => void
  onEditDraft: () => void
}) {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const template = useLiveQuery(
    async () => (await db.templates.where('kind').equals('sprint').toArray()).find((t) => t.isDefault) ?? null,
    [],
  )
  const state = sprintState(sprint)
  const meta = SPRINT_STATE_META[state]
  const isDraft = state === 'draft'
  const editable = manage && (state === 'active' || state === 'scheduled')
  const [view, setView] = useState<'letter' | 'scan'>('letter')
  const [adding, setAdding] = useState(false)

  // An order recorded only as a scan still previews as the template
  // document, filled from its own data with placeholders for the rest.
  const letter = useMemo(
    () => sprint.letter ?? letterFromSprint(sprint, { users, caseTitle, reportSource, template: template ?? undefined }),
    [sprint, users, caseTitle, reportSource, template],
  )
  const letterHtml = useMemo(
    () => renderSprintLetterHtml(letter, { logoDataUrl: settings?.logoDataUrl, companyName: settings?.legalName }),
    [letter, settings],
  )

  const members = [...sprint.members].sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position))
  const listedOnly = letter.team.filter((e) => !e.userId || !roleOf(letter.body, e.roleId)?.access)

  const removeMember = async (userId: string) => {
    await db.sprints.update(sprint.id, {
      members: sprint.members.filter((m) => m.userId !== userId),
      updatedAt: new Date().toISOString(),
    })
    const name = users.find((u) => u.id === userId)?.name ?? 'Penyidik'
    toast.success('Penyidik dikeluarkan', `${name} tidak lagi dapat membuka perkara ini lewat surat ini.`)
  }

  const revoke = async () => {
    if (!window.confirm(`Cabut ${sprint.number}? Penyidik yang ditunjuk langsung kehilangan akses.`)) return
    await db.sprints.update(sprint.id, { revoked: true, updatedAt: new Date().toISOString() })
    toast.success('SPRINT dicabut', 'Penyidiknya kehilangan akses ke perkara ini.')
  }

  const deleteDraft = async () => {
    if (!window.confirm('Hapus draft SPRINT ini?')) return
    await db.sprints.delete(sprint.id)
    toast.success('Draft dihapus')
    onBack()
  }

  return (
    <div className="flex h-full flex-col animate-fade-in">
      {/* Toolbar */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-soft px-4 py-2.5">
        <IconButton label="Kembali ke daftar" className="md:hidden" onClick={onBack}>
          <ArrowLeft size={16} />
        </IconButton>
        <span className="tone flex size-9 shrink-0 items-center justify-center rounded-lg border" style={tone(meta.color)}>
          {isDraft ? <FilePen size={16} /> : <FileSignature size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[13.5px] font-semibold leading-tight text-ink tnum">{sprint.number}</h2>
            <Badge color={meta.color} size="sm" dot>
              {meta.label}
            </Badge>
          </div>
          <p className="truncate text-[10.5px] text-ink-4">
            {isDraft ? 'Akan ditandatangani' : 'Diterbitkan'} {sprint.issuedBy} · {formatDate(sprint.issuedAt)} · berlaku{' '}
            {formatDate(sprint.validFrom)}
            {sprint.validUntil ? ` – ${formatDate(sprint.validUntil)}` : ' sampai dicabut'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" icon={<Printer size={13} />} onClick={() => printLetterHtml(letterHtml)}>
            Cetak
          </Button>
          {isDraft && manage && (
            <Button size="sm" variant="primary" icon={<FilePen size={13} />} onClick={onEditDraft}>
              Lanjutkan draft
            </Button>
          )}
          {sprint.docBlobId && (
            <Button
              size="sm"
              variant="outline"
              icon={<Download size={13} />}
              onClick={() => downloadBlob(sprint.docBlobId, sprint.docName ?? sprint.number)}
            >
              Scan
            </Button>
          )}
          {manage && isDraft && (
            <Tooltip label="Hapus draft">
              <IconButton label="Hapus draft" className="hover:text-danger" onClick={deleteDraft}>
                <Trash2 size={15} />
              </IconButton>
            </Tooltip>
          )}
          {manage && !isDraft && !sprint.revoked && (
            <Tooltip label="Cabut surat perintah">
              <IconButton label="Cabut" className="hover:text-danger" onClick={revoke}>
                <Ban size={15} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </header>

      {isDraft && (
        <p className="shrink-0 border-b border-line-soft bg-[#A855F7]/8 px-4 py-2 text-[11.5px] leading-relaxed text-ink-3">
          Draft — belum berlaku. Cetak untuk ditandatangani, lalu lanjutkan draft untuk melampirkan scan bertanda tangan dan
          menerbitkannya. Sampai saat itu tidak ada yang mendapat akses lewat surat ini.
        </p>
      )}

      {sprint.docBlobId && (
        <div className="flex shrink-0 gap-1 border-b border-line-soft px-4 py-1.5">
          {(['letter', 'scan'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                view === v ? 'bg-brand/12 text-brand-bright' : 'text-ink-3 hover:bg-tint/5 hover:text-ink-2',
              )}
            >
              {v === 'letter' ? 'Dokumen SPRINT' : 'Scan bertanda tangan'}
            </button>
          ))}
        </div>
      )}

      {/* Document */}
      <div className="min-h-0 flex-1 overflow-auto bg-abyss/20 p-4">
        {view === 'letter' ? (
          <LetterPreview html={letterHtml} className="mx-auto w-full max-w-[860px]" />
        ) : (
          <BlobPreview blobId={sprint.docBlobId} mime={sprint.docMime} name={sprint.docName ?? sprint.number} size={sprint.docSize} />
        )}
      </div>

      {/* Team */}
      <footer className="max-h-[38%] shrink-0 overflow-y-auto border-t border-line-soft px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">
            {isDraft ? 'Penyidik — akses saat diterbitkan' : 'Penyidik yang ditunjuk'} ({members.length})
          </p>
          {editable && (
            <Button size="xs" variant="ghost" icon={<UserPlus size={11} />} onClick={() => setAdding(true)}>
              Tambah
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {members.length === 0 && <p className="text-[11.5px] text-ink-4">Tidak ada penyidik — surat ini tidak memberi akses.</p>}
          {members.map((m) => {
            const u = users.find((x) => x.id === m.userId)
            const pos = POSITION_META[m.position]
            return (
              <span key={m.userId} className="flex items-center gap-2 rounded-full border border-line-soft bg-abyss/40 py-1 pl-1 pr-1.5">
                <Avatar src={u?.avatar} name={u?.name ?? m.userId} size={20} />
                <span className="text-[11.5px] text-ink-2">{u?.name ?? 'Unknown user'}</span>
                <Badge color={pos.color} size="sm">
                  {pos.label}
                </Badge>
                {editable && (
                  <IconButton label={`Keluarkan ${u?.name ?? 'penyidik'}`} size={20} className="hover:text-danger" onClick={() => removeMember(m.userId)}>
                    <X size={10} />
                  </IconButton>
                )}
              </span>
            )
          })}
        </div>
        {listedOnly.length > 0 && (
          <p className="mt-2 text-[11px] text-ink-4">
            Juga tercantum tanpa akses perkara:{' '}
            {listedOnly.map((e) => `${e.name || '—'} (${roleOf(letter.body, e.roleId)?.label ?? '—'})`).join(', ')}
          </p>
        )}
        {sprint.notes && <p className="mt-2 text-[11px] italic text-ink-4">{sprint.notes}</p>}
      </footer>

      {adding && <AddMemberModal sprint={sprint} users={users} onClose={() => setAdding(false)} />}
    </div>
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
    toast.success('Penyidik ditambahkan', `${users.find((u) => u.id === userId)?.name} kini dapat membuka perkara ini.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Tambah penyidik ke SPRINT"
      description="Penyidik yang ditambahkan langsung mendapat akses ke perkara ini."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={add} disabled={!userId}>
            Tambahkan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Penyidik" required>
          <Select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            options={candidates.map((u) => ({ value: u.id, label: `${u.name} — ${u.title}` }))}
          />
        </Field>
        <Field label="Posisi">
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

/* ------------------------------------------------- Upload a signed SPRINT */

/** Records an order that was drafted and signed outside the app. */
export function UploadSprintModal({
  caseId,
  users,
  roles,
  onClose,
  onCreated,
}: {
  caseId: string
  users: User[]
  roles: Role[]
  onClose: () => void
  onCreated: (id: string) => void
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

  const candidates = useMemo(() => {
    const rank = (u: User) => (u.role === 'r-investigator' ? 0 : 1)
    return users.filter((u) => u.active).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  }, [users])

  const toggle = (userId: string) =>
    setMembers((prev) =>
      prev.some((m) => m.userId === userId)
        ? prev.filter((m) => m.userId !== userId)
        : [...prev, { userId, position: prev.length === 0 ? 'ketua' : 'anggota' }],
    )

  const valid = number.trim() && subject.trim() && issuedBy.trim() && file && members.length > 0

  const create = async () => {
    if (!valid || !file) return
    if (await caseHasSprint(caseId)) {
      toast.error('SPRINT sudah ada', 'Satu perkara hanya boleh memiliki satu Surat Perintah.')
      return
    }
    setSaving(true)
    try {
      const blobId = uid('blob')
      await db.blobs.add({ id: blobId, data: file })
      const now = new Date().toISOString()
      const id = uid('sp')
      await db.sprints.add({
        id,
        caseId,
        number: number.trim(),
        subject: subject.trim(),
        issuedBy: issuedBy.trim(),
        issuedAt: new Date(validFrom).toISOString(),
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
      toast.success('SPRINT dicatat', `${members.length} penyidik kini dapat membuka perkara ini.`)
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
      title="Unggah SPRINT bertanda tangan"
      description="Untuk surat perintah yang dibuat dan ditandatangani di luar aplikasi. Scan-nya wajib — tanpa dokumen, tidak ada yang memberi kewenangan pada tim."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={create} disabled={!valid} loading={saving}>
            Simpan SPRINT
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor SPRINT" required>
            <Input autoFocus value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Prin-.../PIS0400/2026-S0" />
          </Field>
          <Field label="Diterbitkan oleh" required>
            <Input value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} placeholder="Nama dan jabatan pejabat" />
          </Field>
        </div>
        <Field label="Perihal" required>
          <Textarea rows={2} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Kasus yang diinvestigasi" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal ditetapkan" required>
            <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </Field>
          <Field label="Berlaku sampai" hint="Kosongkan bila berlaku sampai dicabut.">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </div>

        <Field label="Scan Surat Perintah" required>
          {file ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-brand/40 bg-brand/8 px-3 py-2.5">
              <Paperclip size={13} className="shrink-0 text-brand-bright" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-ink">{file.name}</span>
                <span className="text-[10.5px] text-ink-4 tnum">{formatBytes(file.size)}</span>
              </span>
              <IconButton label="Hapus berkas" size={24} onClick={() => setFile(null)}>
                <X size={12} />
              </IconButton>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-strong bg-abyss/35 px-4 py-6 transition-colors hover:border-brand/60 hover:bg-brand/6"
            >
              <Upload size={18} className="text-ink-3" />
              <span className="mt-2 text-[12px] font-medium text-ink">Unggah scan Surat Perintah</span>
              <span className="mt-0.5 text-[10.5px] text-ink-4">Wajib — PDF atau scan</span>
            </button>
          )}
          <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>

        <Field label="Penyidik" required hint="Hanya yang dipilih di sini yang dapat membuka perkara ini.">
          <div className="max-h-[220px] space-y-1 overflow-y-auto rounded-lg border border-line bg-abyss/35 p-2">
            {candidates.map((u) => {
              const picked = members.find((m) => m.userId === u.id)
              const role = roles.find((r) => r.id === u.role)
              return (
                <div
                  key={u.id}
                  className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors', picked ? 'bg-brand/10' : 'hover:bg-tint/6')}
                >
                  <button type="button" onClick={() => toggle(u.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
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
                        {can(role, 'case.viewAll') && ' · sudah melihat semua perkara'}
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
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
        </Field>
      </div>
    </Modal>
  )
}
