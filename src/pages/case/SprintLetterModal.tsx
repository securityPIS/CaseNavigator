import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CheckCircle2, KeyRound, Plus, Printer, X } from 'lucide-react'
import { db } from '@/domain/db'
import type { Role, Sprint, SprintLetter, SprintTeamEntry, SprintTeamRole, Template, User } from '@/domain/types'
import {
  fieldsIn,
  letterProblems,
  membersFromLetter,
  newLetter,
  printLetterHtml,
  renderSprintLetterHtml,
  sprintNumber,
  teamFor,
} from '@/domain/sprintLetter'
import { cn, uid } from '@/lib/utils'
import { Badge, Button, IconButton, Input, Select, Textarea } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { FormSection, LetterPreview, ListEditor } from '@/components/sprint/LetterParts'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'
import { caseHasSprint } from './SprintParts'

const ACCESS_LABEL = { ketua: 'Ketua Tim', sekretaris: 'Sekretaris', anggota: 'Anggota' } as const

/**
 * The SPRINT form: fills in a Surat Perintah template for one case.
 *
 * Two ways out. "Save draft" keeps the letter so it can be printed and sent
 * for signature — a draft grants nobody access. "Issue" needs the form
 * complete and the signed scan attached; only then does the named team gain
 * access to the case.
 */
export function SprintLetterModal({
  caseId,
  sprint,
  users,
  roles,
  menimbangHint,
  onClose,
  onSaved,
}: {
  caseId: string
  /** The draft being continued. Absent = a new order. */
  sprint?: Sprint
  users: User[]
  roles: Role[]
  /** Starting text for Menimbang point 1 — drawn from the case's sumber
      laporan. */
  menimbangHint?: string
  onClose: () => void
  /** Called with the order's id once it is saved. */
  onSaved?: (id: string) => void
}) {
  const templates = useLiveQuery(() => db.templates.where('kind').equals('sprint').toArray(), [])
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const caseRec = useLiveQuery(() => db.cases.get(caseId), [caseId])

  const [letter, setLetter] = useState<SprintLetter | null>(sprint?.letter ? structuredClone(sprint.letter) : null)
  const [validUntil, setValidUntil] = useState(sprint?.validUntil?.slice(0, 10) ?? '')
  const [notes, setNotes] = useState(sprint?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [showProblems, setShowProblems] = useState(false)

  // A new order starts from the default template once templates and the case
  // have loaded, with the next free sequence number for the year suggested.
  useEffect(() => {
    if (letter || !templates || caseRec === undefined) return
    const t = templates.find((x) => x.isDefault) ?? templates[0]
    if (!t) return
    void startFrom(t, caseRec?.title ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, caseRec, letter])

  const startFrom = async (t: Template, perihal: string, dateIssued?: string) => {
    const base = newLetter(t, { perihal, dateIssued })
    const all = await db.sprints.toArray()
    const used = all.filter((s) => s.letter && s.letter.year === base.year).length
    setLetter({ ...base, seq: String(used + 1), menimbang: menimbangHint ?? '' })
  }

  const html = useMemo(
    () => (letter ? renderSprintLetterHtml(letter, { logoDataUrl: settings?.logoDataUrl, companyName: settings?.legalName }) : ''),
    [letter, settings],
  )

  if (templates && templates.length === 0) {
    return (
      <Modal open onClose={onClose} title="No Surat Perintah template" size="sm">
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          An admin has to create a Surat Perintah template under Admin → Templates before an order can be drafted
          here. You can still record an order by uploading its signed scan.
        </p>
      </Modal>
    )
  }

  if (!letter) {
    return (
      <Modal open onClose={onClose} title="Draft Surat Perintah" size="sm">
        <p className="text-[12px] text-ink-4">Loading template…</p>
      </Modal>
    )
  }

  const set = <K extends keyof SprintLetter>(key: K, value: SprintLetter[K]) => setLetter((l) => (l ? { ...l, [key]: value } : l))
  const b = letter.body
  const used = fieldsIn(b.html)
  const number = sprintNumber(b, letter.seq, letter.year)
  const problems = letterProblems(letter)
  const granted = membersFromLetter(letter)
  const canIssue = problems.length === 0

  /* ------------------------------------------------------------ team */

  const addEntry = (role: SprintTeamRole) =>
    set('team', [...letter.team, { id: uid('tm'), roleId: role.id, name: '', employeeNo: '', jobTitle: '' }])

  const patchEntry = (id: string, patch: Partial<SprintTeamEntry>) =>
    set(
      'team',
      letter.team.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    )

  const pickUser = (entry: SprintTeamEntry, userId: string) => {
    const u = users.find((x) => x.id === userId)
    // Picking a user fills the printed name and title, which stay editable:
    // the letter carries the full official title, not the app's short one.
    patchEntry(entry.id, u ? { userId: u.id, name: u.name, jobTitle: entry.jobTitle || u.title } : { userId: undefined })
  }

  /* ----------------------------------------------------------- save */

  const persist = async (issue: boolean) => {
    if (!letter.perihal.trim()) {
      toast.error('Perihal is required', 'Name the case under investigation before saving.')
      return
    }
    if (issue && !canIssue) {
      setShowProblems(true)
      return
    }
    // One case, one SPRINT — a second order is never created alongside it.
    if (!sprint && (await caseHasSprint(caseId))) {
      toast.error('SPRINT sudah ada', 'Satu perkara hanya boleh memiliki satu Surat Perintah.')
      return
    }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const clean: SprintLetter = {
        ...letter,
        menimbangExtra: letter.menimbangExtra.map((s) => s.trim()).filter(Boolean),
        dasarExtra: letter.dasarExtra.map((s) => s.trim()).filter(Boolean),
        untukExtra: letter.untukExtra.map((s) => s.trim()).filter(Boolean),
        team: letter.team.map((e) => ({ ...e, name: e.name.trim(), employeeNo: e.employeeNo.trim(), jobTitle: e.jobTitle.trim() })),
      }
      const issuedAt = clean.dateIssued ? new Date(clean.dateIssued).toISOString() : now

      const record: Sprint = {
        id: sprint?.id ?? uid('sp'),
        caseId,
        number: sprintNumber(clean.body, clean.seq, clean.year),
        subject: clean.perihal.trim(),
        issuedBy: [clean.signerName.trim(), clean.signerTitle.trim()].filter(Boolean).join(' — ') || clean.body.issuerTitle,
        issuedAt,
        validFrom: issuedAt,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        revoked: false,
        draft: !issue,
        members: membersFromLetter(clean).map((m) => ({ ...m, addedAt: now })),
        letter: clean,
        notes: notes.trim() || undefined,
        createdAt: sprint?.createdAt ?? now,
        updatedAt: now,
      }
      await db.sprints.put(record)
      onSaved?.(record.id)

      if (issue) {
        const n = record.members.length
        toast.success('SPRINT issued', `${n} investigator${n === 1 ? '' : 's'} can now open this case.`)
      } else {
        toast.success('Draft saved', 'Come back to complete it and issue it — until then nobody gains access through it.')
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={sprint ? `Draft ${sprint.number}` : 'Draft Surat Perintah'}
      description="Fill in the case-specific parts of the order. The fixed wording comes from the template; the preview shows the letter as it will print."
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={() => setShowProblems((v) => !v)}
            className={cn(
              'mr-auto flex items-center gap-1.5 text-[11px]',
              problems.length > 0 ? 'text-warn' : 'text-ok',
            )}
          >
            {problems.length > 0 ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
            {problems.length > 0
              ? `${problems.length} item${problems.length === 1 ? '' : 's'} to complete before issuing`
              : 'Ready to issue'}
          </button>
          <Button variant="ghost" icon={<Printer size={13} />} onClick={() => printLetterHtml(html)}>
            Print
          </Button>
          <Button variant="secondary" onClick={() => persist(false)} loading={saving}>
            Save draft
          </Button>
          <Button variant="primary" onClick={() => persist(true)} loading={saving}>
            Issue SPRINT
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="space-y-4">
          {showProblems && problems.length > 0 && (
            <div className="rounded-xl border border-warn/35 bg-warn/8 p-3">
              <p className="mb-1.5 text-[11.5px] font-medium text-ink">Before this order can be issued:</p>
              <ul className="list-disc space-y-0.5 pl-4 text-[11.5px] leading-relaxed text-ink-3">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* A ─ Identitas */}
          <FormSection title="Identitas surat">
            {!sprint && templates && templates.length > 1 && (
              <Field label="Template">
                <Select
                  value={letter.templateId}
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value)
                    if (t) void startFrom(t, letter.perihal, letter.dateIssued)
                  }}
                  options={templates.map((t) => ({ value: t.id, label: t.isDefault ? `${t.name} (default)` : t.name }))}
                />
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-[96px_96px_minmax(0,1fr)]">
              <Field label="No. urut" required>
                <Input value={letter.seq} onChange={(e) => set('seq', e.target.value)} />
              </Field>
              <Field label="Tahun" required>
                <Input value={letter.year} onChange={(e) => set('year', e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Nomor surat">
                <div className="flex h-9 items-center truncate rounded-lg border border-line-soft bg-abyss/30 px-3 font-mono text-[12px] text-ink-2">
                  {number}
                </div>
              </Field>
            </div>
            <Field label="Perihal kasus" required hint="Printed under TENTANG and as the subtitle of the team attachment.">
              <Textarea rows={2} value={letter.perihal} onChange={(e) => set('perihal', e.target.value)} placeholder="Kasus yang akan diinvestigasi" />
            </Field>
          </FormSection>

          {/* B ─ Menimbang */}
          {(used.has('menimbang') || used.has('menimbang_tambahan')) && (
            <FormSection title="Menimbang">
              {used.has('menimbang') && (
                <Field
                  label="Dasar permintaan"
                  required
                  hint="The investigation request or the report of suspected fraud / security incident that triggered this order — cite its number, date and sender."
                >
                  <Textarea
                    rows={3}
                    value={letter.menimbang}
                    onChange={(e) => set('menimbang', e.target.value)}
                    placeholder="Surat permintaan investigasi No. … tanggal … perihal …"
                  />
                </Field>
              )}
              {used.has('menimbang_tambahan') && (
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-ink-2">Menimbang tambahan</p>
                  <ListEditor
                    items={letter.menimbangExtra}
                    onChange={(v) => set('menimbangExtra', v)}
                    addLabel="Add consideration for this case"
                  />
                </div>
              )}
            </FormSection>
          )}

          {/* C ─ Dasar */}
          {used.has('dasar_tambahan') && (
            <FormSection title="Dasar tambahan" hint="The template's own Dasar always prints. Add anything this case needs on top.">
              <ListEditor items={letter.dasarExtra} onChange={(v) => set('dasarExtra', v)} addLabel="Add legal basis" />
            </FormSection>
          )}

          {/* D ─ Untuk */}
          {(used.has('objek') || used.has('untuk_tambahan')) && (
            <FormSection title="Memerintahkan — Untuk">
              {used.has('objek') && (
                <Field label="Objek investigasi" required hint="Completes “Melakukan kegiatan investigasi terkait dengan …”.">
                  <Textarea rows={2} value={letter.objek} onChange={(e) => set('objek', e.target.value)} placeholder="Objek / ruang lingkup investigasi" />
                </Field>
              )}
              {used.has('untuk_tambahan') && (
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-ink-2">Tugas tambahan</p>
                  <ListEditor items={letter.untukExtra} onChange={(v) => set('untukExtra', v)} addLabel="Add task for this case" />
                </div>
              )}
            </FormSection>
          )}

          {/* E ─ Penetapan */}
          <FormSection title="Penetapan & tanda tangan">
            <div className="grid gap-3 sm:grid-cols-2">
              {used.has('tempat') && (
                <Field label="Ditetapkan di" required>
                  <Input value={letter.place} onChange={(e) => set('place', e.target.value)} />
                </Field>
              )}
              <Field label="Pada tanggal" required hint="The order is in force from this date.">
                <Input
                  type="date"
                  value={letter.dateIssued}
                  onChange={(e) => setLetter({ ...letter, dateIssued: e.target.value, year: e.target.value.slice(0, 4) || letter.year })}
                />
              </Field>
              {used.has('nama_penandatangan') && (
                <Field label="Nama penandatangan" required>
                  <Input value={letter.signerName} onChange={(e) => set('signerName', e.target.value)} placeholder="Nama lengkap" />
                </Field>
              )}
              {used.has('jabatan_penandatangan') && (
                <Field label="Jabatan penandatangan" required hint="e.g. Plt. VP HSSE when signed by an acting officer.">
                  <Input value={letter.signerTitle} onChange={(e) => set('signerTitle', e.target.value)} />
                </Field>
              )}
              <Field label="Berlaku sampai" hint="Not printed. Leave empty for an order that stands until revoked.">
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </Field>
            </div>
          </FormSection>

          {/* F ─ Susunan tim */}
          <FormSection
            title="Lampiran — Susunan tim"
            hint="Pick an app user to grant them access through the order; type a name for people outside the app (Pembina, holding advisors…)."
          >
            {b.roles.map((role) => (
              <TeamRole
                key={role.id}
                role={role}
                entries={teamFor(letter, role.id)}
                users={users}
                roles={roles}
                onAdd={() => addEntry(role)}
                onPatch={patchEntry}
                onPick={pickUser}
                onRemove={(id) => set('team', letter.team.filter((e) => e.id !== id))}
              />
            ))}
            <div className="flex items-start gap-2 rounded-lg border border-brand/25 bg-brand/6 px-3 py-2">
              <KeyRound size={12} className="mt-0.5 shrink-0 text-brand-bright" />
              <p className="text-[11px] leading-relaxed text-ink-3">
                {granted.length === 0
                  ? 'Nobody on this order will gain access to the case yet.'
                  : `On issue, ${granted.map((g) => users.find((u) => u.id === g.userId)?.name ?? g.userId).join(', ')} will gain access to this case.`}
              </p>
            </div>
          </FormSection>

          {/* G ─ Catatan */}
          <FormSection title="Catatan">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — internal note, not printed" />
          </FormSection>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-0">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">
              Preview · {letter.templateName}
            </p>
            <LetterPreview html={html} className="max-h-[70dvh] overflow-y-auto rounded-lg border border-line-soft" />
          </div>
        </div>
      </div>
    </Modal>
  )
}

function TeamRole({
  role,
  entries,
  users,
  roles,
  onAdd,
  onPatch,
  onPick,
  onRemove,
}: {
  role: SprintTeamRole
  entries: SprintTeamEntry[]
  users: User[]
  roles: Role[]
  onAdd: () => void
  onPatch: (id: string, patch: Partial<SprintTeamEntry>) => void
  onPick: (entry: SprintTeamEntry, userId: string) => void
  onRemove: (id: string) => void
}) {
  const full = role.max !== undefined && entries.length >= role.max
  const short = entries.length < role.min
  const range = role.max === undefined ? `min ${role.min}` : role.min === role.max ? `${role.min}` : `${role.min}–${role.max}`

  const userOptions = [
    { value: '', label: '— Bukan pengguna aplikasi —' },
    ...users
      .filter((u) => u.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => ({ value: u.id, label: `${u.name} · ${roles.find((r) => r.id === u.role)?.name ?? u.title}` })),
  ]

  return (
    <div className="rounded-lg border border-line-soft bg-abyss/30 p-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium text-ink">{role.label}</span>
        <Badge color={short ? '#F59E0B' : '#6A7FA3'} size="sm">
          {entries.length} / {range}
        </Badge>
        {role.access ? (
          <Badge color="#3B82F6" size="sm">
            <KeyRound size={8} /> Access as {ACCESS_LABEL[role.access]}
          </Badge>
        ) : (
          <Badge color="#6A7FA3" size="sm">
            Listed only
          </Badge>
        )}
        {role.hint && <span className="text-[10.5px] text-ink-4">{role.hint}</span>}
        <Button size="xs" variant="ghost" icon={<Plus size={11} />} className="ml-auto" disabled={full} onClick={onAdd}>
          Add
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-[11px] text-ink-4">{role.min === 0 ? 'Optional — leave empty to omit from the letter.' : 'Nobody named yet.'}</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <div key={e.id} className="flex items-start gap-2">
              <span className="mt-2 w-4 shrink-0 text-right text-[10.5px] text-ink-4 tnum">{i + 1}.</span>
              <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
                <Select
                  className="h-8 text-[11.5px]"
                  value={e.userId ?? ''}
                  onChange={(ev) => onPick(e, ev.target.value)}
                  options={userOptions}
                />
                <Input className="h-8 text-[12px]" value={e.name} placeholder="Nama lengkap" onChange={(ev) => onPatch(e.id, { name: ev.target.value })} />
                <Input
                  className="h-8 text-[12px]"
                  value={e.employeeNo}
                  placeholder="Nomor pekerja"
                  onChange={(ev) => onPatch(e.id, { employeeNo: ev.target.value })}
                />
                <Input className="h-8 text-[12px]" value={e.jobTitle} placeholder="Jabatan lengkap" onChange={(ev) => onPatch(e.id, { jobTitle: ev.target.value })} />
              </div>
              <IconButton label="Remove" size={24} className="mt-1 hover:text-danger" onClick={() => onRemove(e.id)}>
                <X size={11} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
