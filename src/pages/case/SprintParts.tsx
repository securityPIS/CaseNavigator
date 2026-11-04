import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Ban, FilePen, FileSignature, Printer, Trash2, X } from 'lucide-react'
import { db } from '@/domain/db'
import { SPRINT_STATE_META, sprintState } from '@/domain/access'
import { letterFromSprint, printLetterHtml, renderSprintLetterHtml, roleOf } from '@/domain/sprintLetter'
import type { ReportSource, Sprint, SprintLetter, SprintPosition, User } from '@/domain/types'
import { cn, formatDate } from '@/lib/utils'
import { Avatar, Badge, Button, IconButton, Select, tone, Tooltip } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
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

/**
 * The letter behind a SPRINT. An order with no letter of its own (recorded
 * before letters existed) gets one built from its data, so it can always be
 * shown as the template document.
 */
export function useSprintLetter(
  sprint: Sprint | undefined,
  ctx: { users: User[]; caseTitle?: string; reportSources?: ReportSource[] },
): SprintLetter | undefined {
  const template = useLiveQuery(
    async () => (await db.templates.where('kind').equals('sprint').toArray()).find((t) => t.isDefault) ?? null,
    [],
  )
  return useMemo(
    () =>
      sprint
        ? (sprint.letter ??
          letterFromSprint(sprint, {
            users: ctx.users,
            caseTitle: ctx.caseTitle,
            reportSources: ctx.reportSources,
            template: template ?? undefined,
          }))
        : undefined,
    [sprint, ctx.users, ctx.caseTitle, ctx.reportSources, template],
  )
}

/* ------------------------------------------------------------ List items */

/** The case's SPRINT in the Case Registration list. */
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
          <span>· {sprint.members.length} investigator</span>
        </span>
      </span>
    </button>
  )
}

/* --------------------------------------------------------------- Viewer */

/** A SPRINT opened in the Case Registration viewer, shown as the letter it
    prints as. */
export function SprintViewer({
  sprint,
  letter,
  manage,
  onBack,
  onEditDraft,
}: {
  sprint: Sprint
  letter: SprintLetter
  manage: boolean
  onBack: () => void
  onEditDraft: () => void
}) {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const state = sprintState(sprint)
  const meta = SPRINT_STATE_META[state]
  const isDraft = state === 'draft'

  const letterHtml = useMemo(
    () => renderSprintLetterHtml(letter, { logoDataUrl: settings?.logoDataUrl, companyName: settings?.legalName }),
    [letter, settings],
  )

  const revoke = async () => {
    if (!window.confirm(`Cabut ${sprint.number}? Investigator yang ditunjuk langsung kehilangan akses.`)) return
    await db.sprints.update(sprint.id, { revoked: true, updatedAt: new Date().toISOString() })
    toast.success('SPRINT dicabut', 'Investigatornya kehilangan akses ke perkara ini.')
  }

  const deleteDraft = async () => {
    if (!window.confirm('Hapus draft SPRINT ini?')) return
    await db.sprints.delete(sprint.id)
    toast.success('Draft dihapus')
    onBack()
  }

  return (
    <div className="flex h-full flex-col animate-fade-in">
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
            {isDraft ? 'Akan diterbitkan' : 'Diterbitkan'} {sprint.issuedBy} · {formatDate(sprint.issuedAt)} · berlaku{' '}
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
          Draft — belum berlaku. Lanjutkan draft untuk melengkapi dan menerbitkannya; sampai saat itu tidak ada yang mendapat
          akses lewat surat ini.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto bg-abyss/20 p-4">
        <LetterPreview html={letterHtml} className="mx-auto w-full max-w-[860px]" />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- Investigators */

/**
 * The people the SPRINT authorises. On an order in force they can be added
 * or taken off here; a draft's team is set in the draft itself, since saving
 * the draft rebuilds it from the letter.
 */
export function InvestigatorList({
  sprint,
  letter,
  users,
  editable,
}: {
  sprint: Sprint
  letter?: SprintLetter
  users: User[]
  editable: boolean
}) {
  const isDraft = sprintState(sprint) === 'draft'
  const members = [...sprint.members].sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position))
  const listedOnly = (letter?.team ?? []).filter((e) => !e.userId || !roleOf(letter!.body, e.roleId)?.access)

  const remove = async (userId: string) => {
    await db.sprints.update(sprint.id, {
      members: sprint.members.filter((m) => m.userId !== userId),
      updatedAt: new Date().toISOString(),
    })
    const name = users.find((u) => u.id === userId)?.name ?? 'Investigator'
    toast.success('Investigator dikeluarkan', `${name} tidak lagi dapat membuka perkara ini lewat SPRINT.`)
  }

  return (
    <div className="space-y-2">
      {isDraft && <p className="text-[11px] text-ink-4">Mendapat akses saat SPRINT diterbitkan. Ubah tim lewat draft SPRINT.</p>}
      {members.length === 0 && <p className="text-[11.5px] text-ink-4">Tidak ada investigator — SPRINT ini tidak memberi akses.</p>}
      {members.map((m) => {
        const u = users.find((x) => x.id === m.userId)
        const pos = POSITION_META[m.position]
        return (
          <div key={m.userId} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-abyss/30 px-2.5 py-2">
            <Avatar src={u?.avatar} name={u?.name ?? m.userId} size={26} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-ink">{u?.name ?? 'Unknown user'}</p>
              <p className="truncate text-[10.5px] text-ink-4">{u?.title}</p>
            </div>
            <Badge color={pos.color} size="sm">
              {pos.label}
            </Badge>
            {editable && (
              <IconButton label={`Keluarkan ${u?.name ?? 'investigator'}`} size={24} className="hover:text-danger" onClick={() => remove(m.userId)}>
                <X size={11} />
              </IconButton>
            )}
          </div>
        )
      })}
      {listedOnly.length > 0 && (
        <div className="pt-1">
          <p className="mb-1 text-[10.5px] font-medium text-ink-3">Juga tercantum di SPRINT, tanpa akses perkara</p>
          {listedOnly.map((e) => (
            <p key={e.id} className="flex gap-2 text-[11.5px]">
              <span className="w-[110px] shrink-0 truncate text-ink-4">{roleOf(letter!.body, e.roleId)?.label ?? '—'}</span>
              <span className="truncate text-ink-2">{e.name || '—'}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/** Puts one more investigator on an order already in force. */
export function AddInvestigatorModal({ sprint, users, onClose }: { sprint: Sprint; users: User[]; onClose: () => void }) {
  const candidates = users.filter((u) => u.active && !sprint.members.some((m) => m.userId === u.id))
  const [userId, setUserId] = useState(candidates[0]?.id ?? '')
  const [position, setPosition] = useState<SprintPosition>('anggota')

  const add = async () => {
    if (!userId) return
    const next = [...sprint.members, { userId, position, addedAt: new Date().toISOString() }]
    await db.sprints.update(sprint.id, { members: next, updatedAt: new Date().toISOString() })
    toast.success('Investigator ditambahkan', `${users.find((u) => u.id === userId)?.name} kini dapat membuka perkara ini.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Tambah investigator"
      description="Investigator yang ditambahkan ke SPRINT langsung mendapat akses ke perkara ini."
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
        <Field label="Investigator" required>
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
