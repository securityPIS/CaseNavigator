import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Lock,
  MapPin,
  MessageSquareQuote,
  Mic,
  Phone,
  Plus,
  Sparkles,
  Square,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { db } from '@/domain/db'
import { assignedUserIds, can } from '@/domain/access'
import type {
  Bap,
  BapAnswer,
  BapExtraQuestion,
  BapStatus,
  Interviewee,
  IntervieweeKind,
  Question,
  QuestionSet,
  User,
} from '@/domain/types'
import { cn, formatDateTime, uid } from '@/lib/utils'
import { Avatar, Badge, Button, Card, EmptyState, IconButton, Input, Progress, Select, Textarea, tone, Tooltip } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/pages/CasesPage'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { useDictation } from '@/hooks/useDictation'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'

const KIND_META: Record<IntervieweeKind, { label: string; color: string }> = {
  terlapor: { label: 'Terlapor', color: '#EF4444' },
  saksi: { label: 'Saksi', color: '#38BDF8' },
  pelapor: { label: 'Pelapor', color: '#10B981' },
  ahli: { label: 'Ahli', color: '#A855F7' },
}

const STATUS_META: Record<BapStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6A7FA3' },
  in_progress: { label: 'Berlangsung', color: '#F59E0B' },
  completed: { label: 'Selesai', color: '#38BDF8' },
  signed: { label: 'Ditandatangani', color: '#10B981' },
}

export function InterviewPage() {
  const { caseId = '' } = useParams()
  const userId = useSession((s) => s.userId)

  const interviewees = useLiveQuery(() => db.interviewees.where('caseId').equals(caseId).toArray(), [caseId])
  const baps = useLiveQuery(() => db.baps.where('caseId').equals(caseId).toArray(), [caseId], [])
  const sprints = useLiveQuery(() => db.sprints.where('caseId').equals(caseId).toArray(), [caseId], [])
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const roles = useLiveQuery(() => db.roles.toArray(), [], [])
  const sets = useLiveQuery(() => db.questionSets.toArray(), [], [])
  const questions = useLiveQuery(() => db.questions.toArray(), [], [])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingPerson, setAddingPerson] = useState(false)
  const [newBapFor, setNewBapFor] = useState<Interviewee | null>(null)

  const me = users.find((u) => u.id === userId)
  const myRole = roles.find((r) => r.id === me?.role)
  const conduct = can(myRole, 'interview.conduct')

  const selected = interviewees?.find((i) => i.id === selectedId) ?? interviewees?.[0] ?? null
  const selectedBaps = baps.filter((b) => b.intervieweeId === selected?.id)

  if (!interviewees) return <PageSpinner />

  return (
    <div className="flex h-full min-h-0">
      {/* Terperiksa list */}
      <aside className="flex w-[268px] shrink-0 flex-col border-r border-line-soft">
        <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3.5">
          <div>
            <h2 className="text-[13px] font-semibold text-ink">Terperiksa</h2>
            <p className="mt-0.5 text-[10.5px] text-ink-4 tnum">
              {interviewees.length} orang · {baps.length} BAP
            </p>
          </div>
          {conduct && (
            <Tooltip label="Add terperiksa">
              <IconButton label="Add terperiksa" size={28} onClick={() => setAddingPerson(true)}>
                <Plus size={14} />
              </IconButton>
            </Tooltip>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {interviewees.length === 0 && (
            <p className="px-2 py-6 text-center text-[11.5px] leading-relaxed text-ink-4">
              No terperiksa yet. Add the people this case needs to examine.
            </p>
          )}
          {interviewees.map((p) => {
            const meta = KIND_META[p.kind]
            const count = baps.filter((b) => b.intervieweeId === p.id).length
            const active = selected?.id === p.id
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  'mb-1 w-full rounded-lg border p-2.5 text-left transition-all duration-150',
                  active ? 'border-brand/50 bg-brand/8' : 'border-transparent hover:bg-tint/5',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="tone flex size-8 shrink-0 items-center justify-center rounded-lg border" style={tone(meta.color)}>
                    <UserRound size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">{p.name}</span>
                    <span className="block truncate text-[10.5px] text-ink-4">{p.position}</span>
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge color={meta.color} size="sm">
                    {meta.label}
                  </Badge>
                  <span className="text-[10px] text-ink-4 tnum">
                    {count} BAP
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* BAP surface */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {!selected ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No terperiksa on this case"
            description="A BAP is an examination of a named person. Add the terperiksa first, then open a BAP against the question set that fits."
            action={
              conduct ? (
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAddingPerson(true)}>
                  Add terperiksa
                </Button>
              ) : undefined
            }
          />
        ) : (
          <IntervieweePanel
            person={selected}
            baps={selectedBaps}
            users={users}
            sets={sets}
            questions={questions}
            conduct={conduct}
            sprintUserIds={assignedUserIds(sprints)}
            onNewBap={() => setNewBapFor(selected)}
          />
        )}
      </div>

      {addingPerson && <AddIntervieweeModal caseId={caseId} onClose={() => setAddingPerson(false)} onCreated={setSelectedId} />}
      {newBapFor && (
        <NewBapModal
          caseId={caseId}
          person={newBapFor}
          sets={sets.filter((s) => s.active)}
          users={users}
          sprintUserIds={assignedUserIds(sprints)}
          existing={baps.length}
          onClose={() => setNewBapFor(null)}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------- Panel */

function IntervieweePanel({
  person,
  baps,
  users,
  sets,
  questions,
  conduct,
  sprintUserIds,
  onNewBap,
}: {
  person: Interviewee
  baps: Bap[]
  users: User[]
  sets: QuestionSet[]
  questions: Question[]
  conduct: boolean
  sprintUserIds: Set<string>
  onNewBap: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const meta = KIND_META[person.kind]
  const sorted = [...baps].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const open = sorted.find((b) => b.id === openId) ?? sorted[0] ?? null

  return (
    <div className="px-6 py-5">
      <div className="mx-auto max-w-[880px] space-y-5">
        {/* Identity */}
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3.5">
              <span className="tone flex size-11 shrink-0 items-center justify-center rounded-xl border" style={tone(meta.color)}>
                <UserRound size={20} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[17px] font-semibold text-ink">{person.name}</h2>
                  <Badge color={meta.color} size="sm">
                    {meta.label}
                  </Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-2">{person.position}</p>
                <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-ink-4">
                  {person.identityNo && (
                    <span className="flex items-center gap-1.5">
                      <BadgeCheck size={11} /> {person.identityNo}
                    </span>
                  )}
                  {person.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone size={11} /> {person.phone}
                    </span>
                  )}
                  {person.address && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={11} /> {person.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {conduct && (
              <Button variant="primary" size="sm" icon={<Plus size={12} />} onClick={onNewBap}>
                New BAP
              </Button>
            )}
          </div>
        </Card>

        {/* BAP selector */}
        {sorted.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((b) => {
              const st = STATUS_META[b.status]
              const on = open?.id === b.id
              return (
                <button
                  key={b.id}
                  onClick={() => setOpenId(b.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11.5px] transition-colors',
                    on ? 'border-brand/50 bg-brand/10 text-ink' : 'border-line-soft text-ink-3 hover:border-line-strong hover:text-ink-2',
                  )}
                >
                  <span className="size-1.5 rounded-full" style={{ background: st.color }} />
                  <span className="tnum">{b.number}</span>
                </button>
              )
            })}
          </div>
        )}

        {!open ? (
          <Card>
            <EmptyState
              icon={<ClipboardList size={22} />}
              title="No BAP for this person yet"
              description="Open a BAP to run the examination against a question set from Questions Customization."
              action={
                conduct ? (
                  <Button variant="primary" icon={<Plus size={14} />} onClick={onNewBap}>
                    New BAP
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <BapForm
            bap={open}
            person={person}
            users={users}
            set={sets.find((s) => s.id === open.questionSetId)}
            questions={questions.filter((q) => q.setId === open.questionSetId).sort((a, b) => a.order - b.order)}
            conduct={conduct}
            sprintUserIds={sprintUserIds}
          />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- BAP form */

function BapForm({
  bap,
  person,
  users,
  set,
  questions,
  conduct,
  sprintUserIds,
}: {
  bap: Bap
  person: Interviewee
  users: User[]
  set?: QuestionSet
  questions: Question[]
  conduct: boolean
  sprintUserIds: Set<string>
}) {
  const st = STATUS_META[bap.status]
  const locked = bap.status === 'signed' || !conduct

  // Ad-hoc questions the investigator added to this BAP are rendered right
  // after the template set, sharing the same answer store keyed by question id.
  const extras = useMemo(() => bap.extraQuestions ?? [], [bap.extraQuestions])
  const allQuestions = useMemo<Question[]>(
    () => [
      ...questions,
      ...extras.map((eq, i) => ({
        id: eq.id,
        setId: '__extra__',
        order: 10_000 + i,
        label: eq.label,
        type: eq.type,
        required: false,
      })),
    ],
    [questions, extras],
  )

  const answers = useMemo(() => new Map(bap.answers.map((a) => [a.questionId, a])), [bap.answers])
  const answered = allQuestions.filter((q) => {
    const a = answers.get(q.id)
    return a && (a.value.trim() !== '' || (a.values?.length ?? 0) > 0)
  }).length
  const requiredLeft = allQuestions.filter((q) => {
    const a = answers.get(q.id)
    return q.required && !(a && (a.value.trim() !== '' || (a.values?.length ?? 0) > 0))
  }).length

  const write = async (questionId: string, patch: Partial<BapAnswer>) => {
    const next = [...bap.answers]
    const i = next.findIndex((a) => a.questionId === questionId)
    if (i === -1) next.push({ questionId, value: '', ...patch })
    else next[i] = { ...next[i], ...patch }
    await db.baps.update(bap.id, { answers: next, updatedAt: new Date().toISOString() })
  }

  const addExtraQuestion = async (label: string, type: 'text' | 'textarea') => {
    const text = label.trim()
    if (!text) return
    const eq: BapExtraQuestion = { id: uid('eq'), label: text, type, createdAt: new Date().toISOString() }
    await db.baps.update(bap.id, { extraQuestions: [...extras, eq], updatedAt: new Date().toISOString() })
  }

  const removeExtraQuestion = async (id: string) => {
    await db.baps.update(bap.id, {
      extraQuestions: extras.filter((q) => q.id !== id),
      answers: bap.answers.filter((a) => a.questionId !== id),
      updatedAt: new Date().toISOString(),
    })
  }

  const setStatus = async (status: BapStatus) => {
    if (status === 'completed' && requiredLeft > 0) {
      toast.error('Belum lengkap', `${requiredLeft} pertanyaan wajib masih kosong.`)
      return
    }
    const closing = status === 'completed' || status === 'signed'
    await db.baps.update(bap.id, {
      status,
      // Signing off later must not rewrite when the examination actually ended.
      completedAt: closing ? (bap.completedAt ?? new Date().toISOString()) : undefined,
      updatedAt: new Date().toISOString(),
    })
    toast.success('BAP updated', `${bap.number} is now ${STATUS_META[status].label.toLowerCase()}.`)
  }

  return (
    <Card className="overflow-hidden">
      {/* BAP header */}
      <div className="border-b border-line-soft p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <MessageSquareQuote size={15} className="text-brand-bright" />
              <h3 className="text-[15px] font-semibold text-ink tnum">{bap.number}</h3>
              <Badge color={st.color} size="sm" dot>
                {st.label}
              </Badge>
            </div>
            <p className="mt-2 text-[11.5px] text-ink-3">
              Berita Acara Pemeriksaan — {person.name} ({KIND_META[person.kind].label.toLowerCase()})
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-ink-4">
              <span className="flex items-center gap-1.5">
                <CalendarClock size={11} /> {formatDateTime(bap.startedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={11} /> {bap.location}
              </span>
              {set && (
                <span className="flex items-center gap-1.5">
                  <ClipboardList size={11} /> {set.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!locked && bap.status !== 'completed' && (
              <Button size="sm" variant="outline" icon={<CheckCircle2 size={12} />} onClick={() => setStatus('completed')}>
                Mark complete
              </Button>
            )}
            {!locked && bap.status === 'completed' && (
              <Button size="sm" variant="primary" icon={<BadgeCheck size={12} />} onClick={() => setStatus('signed')}>
                Sign off
              </Button>
            )}
            {bap.status === 'signed' && (
              <span className="flex items-center gap-1.5 text-[11px] text-ok">
                <Lock size={11} /> Signed — read only
              </span>
            )}
          </div>
        </div>

        {/* Investigators conducting it */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">Pemeriksa</span>
          {bap.investigatorIds.map((id) => {
            const u = users.find((x) => x.id === id)
            const onSprint = sprintUserIds.has(id)
            return (
              <Tooltip key={id} label={onSprint ? `${u?.name} — named on an active SPRINT` : `${u?.name} — no longer on an active SPRINT`}>
                <span
                  className={cn(
                    'flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5',
                    onSprint ? 'border-line bg-abyss/40' : 'border-warn/40 bg-warn/8',
                  )}
                >
                  <Avatar src={u?.avatar} name={u?.name ?? id} size={18} />
                  <span className="text-[11px] text-ink-2">{u?.name ?? 'Unknown'}</span>
                </span>
              </Tooltip>
            )
          })}
        </div>

        {/* Progress */}
        <div className="mt-4 flex items-center gap-3">
          <Progress value={allQuestions.length ? (answered / allQuestions.length) * 100 : 0} className="max-w-[220px] flex-1" />
          <span className="text-[11px] text-ink-3 tnum">
            {answered}/{allQuestions.length} terjawab
          </span>
          {requiredLeft > 0 && (
            <span className="text-[11px] text-warn tnum">{requiredLeft} wajib belum diisi</span>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="divide-y divide-line-soft/70">
        {allQuestions.length === 0 && (
          <p className="px-5 py-8 text-center text-[12px] text-ink-4">
            Belum ada pertanyaan. Tambahkan pertanyaan di bawah, atau kelola question set di Admin → Questions Customization.
          </p>
        )}
        {allQuestions.map((q, i) => (
          <QuestionRow
            key={q.id}
            index={i}
            question={q}
            answer={answers.get(q.id)}
            locked={locked}
            extra={q.setId === '__extra__'}
            onRemove={q.setId === '__extra__' ? () => removeExtraQuestion(q.id) : undefined}
            onChange={(patch) => write(q.id, patch)}
          />
        ))}
        {!locked && <ExtraQuestionComposer onAdd={addExtraQuestion} />}
      </div>

      {/* Closing notes */}
      <div className="border-t border-line-soft p-5">
        <Field label="Catatan pemeriksa" hint="Observations that are not an answer to any question — demeanour, documents handed over, interruptions.">
          <Textarea
            rows={3}
            defaultValue={bap.notes}
            disabled={locked}
            placeholder="Catatan…"
            onBlur={(e) => db.baps.update(bap.id, { notes: e.target.value, updatedAt: new Date().toISOString() })}
          />
        </Field>
        {bap.completedAt && (
          <p className="mt-3 text-[10.5px] text-ink-4">
            Diselesaikan {formatDateTime(bap.completedAt)}
          </p>
        )}
      </div>
    </Card>
  )
}

/**
 * One question and its answer. Text answers commit on blur rather than on every
 * keystroke — a BAP is long-form, and a write per character would thrash Dexie
 * and re-render the whole form under the investigator's cursor.
 */
function QuestionRow({
  index,
  question,
  answer,
  locked,
  extra,
  onRemove,
  onChange,
}: {
  index: number
  question: Question
  answer?: BapAnswer
  locked: boolean
  extra?: boolean
  onRemove?: () => void
  onChange: (patch: Partial<BapAnswer>) => void
}) {
  const [noteOpen, setNoteOpen] = useState(!!answer?.note)
  const value = answer?.value ?? ''
  const values = answer?.values ?? []
  const canDictate = question.type === 'text' || question.type === 'textarea'

  // Answers can change under us (status changes rewrite the row), so keep the
  // uncontrolled inputs in step with the record.
  const [draft, setDraft] = useState(value)
  // Mirrors `draft` so dictation can append to the freshest text without a
  // stale closure between rapid final phrases.
  const draftRef = useRef(value)
  useEffect(() => {
    setDraft(value)
    draftRef.current = value
  }, [value])

  const commit = () => {
    if (draft !== value) onChange({ value: draft })
  }

  // Each settled phrase is appended to the current answer and committed — the
  // value stays an ordinary editable string the investigator can correct.
  const appendTranscript = useCallback(
    (text: string) => {
      const t = text.trim()
      if (!t) return
      const base = (draftRef.current ?? '').trim()
      const next = base ? `${base} ${t}` : t
      draftRef.current = next
      setDraft(next)
      onChange({ value: next, dictated: true })
    },
    [onChange],
  )
  const dictation = useDictation({ lang: 'id-ID', onFinal: appendTranscript })

  return (
    <div className="p-5">
      <div className="flex gap-3">
        <span className="mt-0.5 w-5 shrink-0 text-[11px] text-ink-4 tnum">{index + 1}.</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-medium leading-relaxed text-ink">
              {question.label}
              {question.required && <span className="ml-1 text-danger">*</span>}
              {extra && (
                <span className="ml-2 inline-flex items-center gap-1 rounded border border-brand/30 bg-brand/10 px-1.5 py-px align-middle text-[9px] font-medium text-brand-bright">
                  <Sparkles size={8} /> Tambahan
                </span>
              )}
            </p>
            {extra && onRemove && !locked && (
              <IconButton label="Hapus pertanyaan" size={22} onClick={onRemove}>
                <Trash2 size={12} />
              </IconButton>
            )}
          </div>
          {question.hint && <p className="mt-1 text-[10.5px] italic text-ink-4">{question.hint}</p>}

          <div className="mt-2.5">
            {question.type === 'textarea' && (
              <Textarea
                rows={3}
                value={draft}
                disabled={locked}
                placeholder="Jawaban terperiksa…"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
              />
            )}
            {(question.type === 'text' || question.type === 'number' || question.type === 'date') && (
              <Input
                type={question.type === 'text' ? 'text' : question.type}
                value={draft}
                disabled={locked}
                placeholder={question.type === 'text' ? 'Jawaban terperiksa…' : undefined}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
              />
            )}
            {question.type === 'select' && (
              <Select
                value={value}
                disabled={locked}
                onChange={(e) => onChange({ value: e.target.value })}
                options={[{ value: '', label: '— Belum dijawab —' }, ...(question.options ?? []).map((o) => ({ value: o, label: o }))]}
              />
            )}
            {question.type === 'multiselect' && (
              <div className="flex flex-wrap gap-1.5">
                {(question.options ?? []).map((o) => {
                  const on = values.includes(o)
                  return (
                    <button
                      key={o}
                      disabled={locked}
                      onClick={() => onChange({ values: on ? values.filter((v) => v !== o) : [...values, o] })}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:pointer-events-none',
                        on ? 'border-brand/50 bg-brand/12 text-brand-bright' : 'border-line bg-abyss/40 text-ink-3 hover:border-line-strong',
                      )}
                    >
                      {o}
                    </button>
                  )
                })}
              </div>
            )}
            {question.type === 'boolean' && (
              <div className="flex gap-2">
                {[
                  { v: 'yes', label: 'Ya' },
                  { v: 'no', label: 'Tidak' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    disabled={locked}
                    onClick={() => onChange({ value: value === opt.v ? '' : opt.v })}
                    className={cn(
                      'rounded-lg border px-4 py-1.5 text-[11.5px] transition-colors disabled:pointer-events-none',
                      value === opt.v
                        ? 'border-brand/50 bg-brand/12 text-brand-bright'
                        : 'border-line bg-abyss/40 text-ink-3 hover:border-line-strong',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voice — record the terperiksa and transcribe straight into the answer */}
          {canDictate && !locked && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {dictation.supported ? (
                <button
                  type="button"
                  onClick={dictation.toggle}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    dictation.listening
                      ? 'border-danger/50 bg-danger/12 text-danger'
                      : 'border-line-strong text-ink-3 hover:border-brand/60 hover:text-brand-bright',
                  )}
                >
                  {dictation.listening ? <Square size={10} className="fill-current" /> : <Mic size={12} />}
                  {dictation.listening ? 'Berhenti merekam' : 'Rekam suara'}
                </button>
              ) : (
                <span className="text-[10.5px] text-ink-4">Transkrip suara tidak didukung di browser ini.</span>
              )}
              {dictation.listening && (
                <span className="flex items-center gap-1.5 text-[10.5px] text-danger">
                  <span className="size-1.5 rounded-full bg-danger animate-pulse" /> Mendengarkan…
                </span>
              )}
              {dictation.error === 'not-allowed' && (
                <span className="text-[10.5px] text-warn">Izin mikrofon ditolak.</span>
              )}
              {dictation.error === 'no-speech' && !dictation.listening && (
                <span className="text-[10.5px] text-ink-4">Tidak ada suara terdeteksi.</span>
              )}
            </div>
          )}
          {canDictate && dictation.listening && dictation.interim && (
            <p className="mt-1.5 rounded-md border border-dashed border-brand/40 bg-brand/6 px-2.5 py-1.5 text-[11.5px] italic text-ink-3">
              {dictation.interim}
            </p>
          )}
          {canDictate && !dictation.listening && answer?.dictated && value.trim() !== '' && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-ink-4">
              <Mic size={9} /> Hasil transkrip suara — dapat diedit
            </p>
          )}

          {/* Investigator's note on the answer */}
          {noteOpen ? (
            <div className="mt-2.5">
              <Input
                defaultValue={answer?.note ?? ''}
                disabled={locked}
                placeholder="Catatan pemeriksa atas jawaban ini…"
                className="h-8 text-[12px]"
                onBlur={(e) => onChange({ note: e.target.value || undefined })}
              />
            </div>
          ) : (
            !locked && (
              <button
                onClick={() => setNoteOpen(true)}
                className="mt-2 text-[10.5px] text-ink-4 transition-colors hover:text-brand-bright"
              >
                + Tambah catatan
              </button>
            )
          )}
          {locked && answer?.note && <p className="mt-2 text-[10.5px] italic text-ink-4">Catatan: {answer.note}</p>}
        </div>
      </div>
    </div>
  )
}

/**
 * Inline composer for adding a question beyond the template set. Kept collapsed
 * until the investigator needs it so the BAP reads as the standard examination
 * until they deliberately go off-script.
 */
function ExtraQuestionComposer({ onAdd }: { onAdd: (label: string, type: 'text' | 'textarea') => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'text' | 'textarea'>('textarea')

  const submit = () => {
    if (!label.trim()) return
    onAdd(label, type)
    setLabel('')
    setType('textarea')
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="p-5">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[12px] text-ink-3 transition-colors hover:border-brand/60 hover:text-brand-bright"
        >
          <Plus size={13} /> Tambah pertanyaan di luar template
        </button>
      </div>
    )
  }

  return (
    <div className="bg-abyss/30 p-5">
      <Field label="Pertanyaan tambahan" hint="Berlaku untuk BAP ini saja — tidak mengubah question set.">
        <Textarea
          rows={2}
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Tulis pertanyaan…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
        />
      </Field>
      <div className="mt-3 flex items-center gap-2">
        <div className="w-[168px]">
          <Select
            className="h-8 text-[12px]"
            value={type}
            onChange={(e) => setType(e.target.value as 'text' | 'textarea')}
            options={[
              { value: 'textarea', label: 'Jawaban panjang' },
              { value: 'text', label: 'Jawaban singkat' },
            ]}
          />
        </div>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false)
            setLabel('')
          }}
        >
          Batal
        </Button>
        <Button size="sm" variant="primary" icon={<Plus size={12} />} onClick={submit} disabled={!label.trim()}>
          Tambah
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- Modals */

function AddIntervieweeModal({
  caseId,
  onClose,
  onCreated,
}: {
  caseId: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const nodes = useLiveQuery(() => db.nodes.where('caseId').equals(caseId).toArray(), [caseId], [])
  const people = nodes.filter((n) => n.kind === 'person' || n.kind === 'witness')

  const [name, setName] = useState('')
  const [kind, setKind] = useState<IntervieweeKind>('saksi')
  const [position, setPosition] = useState('')
  const [identityNo, setIdentityNo] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [nodeId, setNodeId] = useState('')

  const create = async () => {
    if (!name.trim()) return
    const id = uid('iv')
    await db.interviewees.add({
      id,
      caseId,
      name: name.trim(),
      kind,
      position: position.trim() || '—',
      identityNo: identityNo.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      nodeId: nodeId || undefined,
      createdAt: new Date().toISOString(),
    })
    toast.success('Terperiksa ditambahkan', `${name.trim()} is ready for a BAP.`)
    onCreated(id)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add terperiksa"
      description="The person to be examined. Link them to their graph entity where one already exists."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={!name.trim()}>
            Add terperiksa
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama" required>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
          </Field>
          <Field label="Status">
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as IntervieweeKind)}
              options={(Object.keys(KIND_META) as IntervieweeKind[]).map((k) => ({ value: k, label: KIND_META[k].label }))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jabatan / posisi">
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Procurement Analyst" />
          </Field>
          <Field label="Nomor identitas">
            <Input value={identityNo} onChange={(e) => setIdentityNo(e.target.value)} placeholder="e.g. EMP-40887" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telepon">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+62…" />
          </Field>
          <Field label="Alamat">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat / lokasi kerja" />
          </Field>
        </div>

        <Field label="Entitas pada graph" hint="Links this person to the case graph so the BAP and the node stay one record.">
          <Select
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            options={[
              { value: '', label: '— Tidak ditautkan —' },
              ...people.map((n) => ({ value: n.id, label: `${n.label} · ${n.sublabel}` })),
            ]}
          />
        </Field>
      </div>
    </Modal>
  )
}

function NewBapModal({
  caseId,
  person,
  sets,
  users,
  sprintUserIds,
  existing,
  onClose,
}: {
  caseId: string
  person: Interviewee
  sets: QuestionSet[]
  users: User[]
  sprintUserIds: Set<string>
  existing: number
  onClose: () => void
}) {
  const userId = useSession((s) => s.userId)
  // Only investigators the case SPRINT authorises may take a BAP.
  const eligible = users.filter((u) => sprintUserIds.has(u.id))

  const [number, setNumber] = useState(`BAP-${String(existing + 1).padStart(2, '0')}/${new Date().getFullYear()}`)
  const [setId, setSetId] = useState(sets.find((s) => s.appliesTo === 'Interviews')?.id ?? sets[0]?.id ?? '')
  const [location, setLocation] = useState('')
  const [startedAt, setStartedAt] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [investigatorIds, setInvestigatorIds] = useState<string[]>(sprintUserIds.has(userId) ? [userId] : [])

  const create = async () => {
    if (!number.trim() || !setId) return
    await db.baps.add({
      id: uid('bap'),
      caseId,
      intervieweeId: person.id,
      number: number.trim(),
      questionSetId: setId,
      investigatorIds,
      status: 'in_progress',
      location: location.trim() || 'Belum ditentukan',
      startedAt: new Date(startedAt).toISOString(),
      answers: [],
      notes: '',
      updatedAt: new Date().toISOString(),
    })
    toast.success('BAP dibuka', `${number.trim()} — ${person.name}.`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`New BAP — ${person.name}`}
      description="Pick the question set the examination follows. The questions come from Questions Customization, so the process stays the same whoever runs it."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={!number.trim() || !setId}>
            Open BAP
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor BAP" required>
            <Input autoFocus value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <Field label="Waktu pemeriksaan">
            <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </Field>
        </div>

        <Field label="Question set" required hint="Only active sets appear. Manage them in Admin → Questions Customization.">
          <Select
            value={setId}
            onChange={(e) => setSetId(e.target.value)}
            options={sets.map((s) => ({ value: s.id, label: `${s.name} · ${s.appliesTo}` }))}
          />
        </Field>

        <Field label="Tempat">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ruang pemeriksaan / lokasi" />
        </Field>

        <Field label="Pemeriksa" hint="Only investigators named on an active SPRINT for this case can be listed.">
          {eligible.length === 0 ? (
            <p className="rounded-lg border border-warn/40 bg-warn/8 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-2">
              No active SPRINT names an investigator on this case. Issue one on the SPRINT tab first.
            </p>
          ) : (
            <div className="space-y-1 rounded-lg border border-line bg-abyss/35 p-2">
              {eligible.map((u) => {
                const on = investigatorIds.includes(u.id)
                return (
                  <button
                    key={u.id}
                    onClick={() =>
                      setInvestigatorIds(on ? investigatorIds.filter((x) => x !== u.id) : [...investigatorIds, u.id])
                    }
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                      on ? 'bg-brand/10' : 'hover:bg-tint/6',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        on ? 'border-brand bg-brand text-white' : 'border-line-strong',
                      )}
                    >
                      {on && <CheckCircle2 size={9} />}
                    </span>
                    <Avatar src={u.avatar} name={u.name} size={22} />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] text-ink">{u.name}</span>
                      <span className="block truncate text-[10px] text-ink-4">{u.title}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Field>
      </div>
    </Modal>
  )
}
