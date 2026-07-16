import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Eye,
  Hash,
  HelpCircle,
  List,
  Plus,
  Text,
  ToggleLeft,
  Trash2,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { Question, QuestionSet, QuestionType } from '@/domain/types'
import { cn, relativeTime, uid } from '@/lib/utils'
import { Badge, Button, Card, EmptyState, IconButton, Input, Select, Switch, Textarea, tone } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { AdminShell } from './AdminShell'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'

const TYPE_META: Record<QuestionType, { label: string; icon: typeof Text; color: string }> = {
  text: { label: 'Short text', icon: Text, color: '#3B82F6' },
  textarea: { label: 'Long text', icon: List, color: '#38BDF8' },
  select: { label: 'Single choice', icon: CircleDot, color: '#A855F7' },
  multiselect: { label: 'Multiple choice', icon: CheckSquare, color: '#8B5CF6' },
  boolean: { label: 'Yes / No', icon: ToggleLeft, color: '#10B981' },
  date: { label: 'Date', icon: Calendar, color: '#F59E0B' },
  number: { label: 'Number', icon: Hash, color: '#EAB308' },
}

export function QuestionsPage() {
  const sets = useLiveQuery(() => db.questionSets.toArray(), [], [])
  const questions = useLiveQuery(() => db.questions.toArray(), [], [])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Question | null>(null)
  const [creating, setCreating] = useState(false)
  const [newSetOpen, setNewSetOpen] = useState(false)
  const [preview, setPreview] = useState(false)

  const selected = sets.find((s) => s.id === selectedId) ?? sets[0] ?? null
  const items = questions.filter((q) => q.setId === selected?.id).sort((a, b) => a.order - b.order)

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const reordered = [...items]
    ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
    await Promise.all(reordered.map((q, idx) => db.questions.update(q.id, { order: idx })))
  }

  return (
    <AdminShell
      title="Questions Customization"
      description="Question sets are the prompts your team answers at intake, in interviews and at closure. They are how a process becomes repeatable rather than dependent on who happens to run it."
      actions={
        <>
          {selected && items.length > 0 && (
            <Button variant="ghost" icon={<Eye size={13} />} onClick={() => setPreview(true)}>
              Preview
            </Button>
          )}
          <Button variant="primary" icon={<Plus size={13} />} onClick={() => setNewSetOpen(true)}>
            New set
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[254px_1fr]">
        {/* Sets */}
        <div className="space-y-2">
          {sets.map((s) => {
            const count = questions.filter((q) => q.setId === s.id).length
            const active = selected?.id === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition-all duration-200',
                  active ? 'border-brand/50 bg-brand/8' : 'border-line-soft bg-abyss/30 hover:border-line-strong hover:bg-tint/4',
                  !s.active && 'opacity-60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-medium text-ink">{s.name}</span>
                  {!s.active && (
                    <Badge color="#6A7FA3" size="sm">
                      Off
                    </Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-ink-4">{s.description}</p>
                <p className="mt-1.5 text-[9.5px] text-ink-4 tnum">
                  {count} questions · {s.appliesTo}
                </p>
              </button>
            )
          })}
        </div>

        {/* Questions */}
        {selected ? (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-ink">{selected.name}</h2>
                  <p className="mt-1 max-w-[480px] text-[11.5px] leading-relaxed text-ink-3">{selected.description}</p>
                  <p className="mt-2 text-[10px] text-ink-4">
                    Applies to <span className="text-ink-3">{selected.appliesTo}</span> · updated{' '}
                    {relativeTime(selected.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] text-ink-4">Active</span>
                    <Switch
                      checked={selected.active}
                      onChange={(v) => db.questionSets.update(selected.id, { active: v, updatedAt: new Date().toISOString() })}
                      label="Set active"
                    />
                  </div>
                  <IconButton
                    label="Delete set"
                    size={28}
                    className="hover:text-danger"
                    onClick={async () => {
                      await db.questions.where('setId').equals(selected.id).delete()
                      await db.questionSets.delete(selected.id)
                      setSelectedId(null)
                      toast.success('Set deleted', 'Its questions were removed too.')
                    }}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>
            </Card>

            {items.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<HelpCircle size={22} />}
                  title="No questions yet"
                  description="Add the first question to this set."
                  action={
                    <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
                      Add question
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="space-y-2">
                {items.map((q, i) => {
                  const meta = TYPE_META[q.type]
                  return (
                    <Card
                      key={q.id}
                      className="group p-3.5 transition-colors hover:border-brand/35 animate-fade-up"
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 w-4 shrink-0 text-[10px] text-ink-4 tnum">{i + 1}</span>

                        <span
                          className="tone mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border"
                          style={tone(meta.color)}
                        >
                          <meta.icon size={13} />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[12.5px] font-medium text-ink">{q.label}</p>
                            {q.required && (
                              <Badge color="#EF4444" size="sm">
                                Required
                              </Badge>
                            )}
                          </div>
                          {q.hint && <p className="mt-1 text-[10.5px] italic leading-relaxed text-ink-4">{q.hint}</p>}
                          <p className="mt-1.5 text-[10px] text-ink-4">
                            {meta.label}
                            {q.options && q.options.length > 0 && ` · ${q.options.length} options`}
                          </p>
                          {q.options && q.options.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {q.options.slice(0, 4).map((o) => (
                                <span key={o} className="rounded border border-line bg-abyss/50 px-1.5 py-0.5 text-[9.5px] text-ink-4">
                                  {o}
                                </span>
                              ))}
                              {q.options.length > 4 && (
                                <span className="px-1 py-0.5 text-[9.5px] text-ink-4 tnum">+{q.options.length - 4}</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <IconButton label="Move up" size={24} disabled={i === 0} onClick={() => move(i, -1)}>
                            <ChevronUp size={11} />
                          </IconButton>
                          <IconButton label="Move down" size={24} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                            <ChevronDown size={11} />
                          </IconButton>
                          <IconButton label="Edit" size={24} onClick={() => setEditing(q)}>
                            <HelpCircle size={11} />
                          </IconButton>
                          <IconButton
                            label="Delete"
                            size={24}
                            className="hover:text-danger"
                            onClick={async () => {
                              await db.questions.delete(q.id)
                              const rest = items.filter((x) => x.id !== q.id)
                              await Promise.all(rest.map((x, idx) => db.questions.update(x.id, { order: idx })))
                              toast.success('Question deleted')
                            }}
                          >
                            <Trash2 size={11} />
                          </IconButton>
                        </div>
                      </div>
                    </Card>
                  )
                })}

                <button
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-2.5 text-[11.5px] text-ink-3 transition-colors hover:border-brand/50 hover:text-brand-bright"
                >
                  <Plus size={12} /> Add question
                </button>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<HelpCircle size={22} />}
              title="No question sets"
              description="Create a set to start building a repeatable process."
              action={
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => setNewSetOpen(true)}>
                  New set
                </Button>
              }
            />
          </Card>
        )}
      </div>

      {(editing || creating) && selected && (
        <QuestionEditor
          question={editing ?? undefined}
          setId={selected.id}
          order={items.length}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
        />
      )}

      {newSetOpen && <NewSetModal onClose={() => setNewSetOpen(false)} onCreated={setSelectedId} />}

      {preview && selected && (
        <PreviewModal set={selected} questions={items} onClose={() => setPreview(false)} />
      )}
    </AdminShell>
  )
}

/* --------------------------------------------------------------- Editor */

function QuestionEditor({
  question,
  setId,
  order,
  onClose,
}: {
  question?: Question
  setId: string
  order: number
  onClose: () => void
}) {
  const isNew = !question
  const [label, setLabel] = useState(question?.label ?? '')
  const [hint, setHint] = useState(question?.hint ?? '')
  const [type, setType] = useState<QuestionType>(question?.type ?? 'text')
  const [required, setRequired] = useState(question?.required ?? false)
  const [options, setOptions] = useState<string[]>(question?.options ?? ['Option 1'])

  const needsOptions = type === 'select' || type === 'multiselect'

  const save = async () => {
    if (!label.trim()) return
    const payload = {
      label: label.trim(),
      hint: hint.trim() || undefined,
      type,
      required,
      options: needsOptions ? options.map((o) => o.trim()).filter(Boolean) : undefined,
    }
    if (question) {
      await db.questions.update(question.id, payload)
      toast.success('Question saved')
    } else {
      await db.questions.add({ id: uid('q'), setId, order, ...payload })
      toast.success('Question added')
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add question' : 'Edit question'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!label.trim()}>
            {isNew ? 'Add question' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Question" required>
          <Textarea rows={2} autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. How was the allegation received?" />
        </Field>

        <Field label="Hint" hint="Shown under the question. Use it to prevent the common mistake, not to restate the question.">
          <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. Avoid paraphrasing at intake." />
        </Field>

        <Field label="Answer type">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {(Object.keys(TYPE_META) as QuestionType[]).map((t) => {
              const meta = TYPE_META[t]
              const on = type === t
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-all',
                    on ? 'border-brand/50 bg-brand/10' : 'border-line-soft bg-abyss/35 hover:border-line-strong',
                  )}
                >
                  <meta.icon size={14} style={{ color: on ? meta.color : undefined }} className={cn(!on && 'text-ink-4')} />
                  <span className={cn('text-center text-[10px] leading-tight', on ? 'text-ink' : 'text-ink-4')}>{meta.label}</span>
                </button>
              )
            })}
          </div>
        </Field>

        {needsOptions && (
          <Field label="Options">
            <div className="space-y-1.5">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-center text-[10px] text-ink-4 tnum">{i + 1}</span>
                  <Input
                    value={o}
                    onChange={(e) => {
                      const next = [...options]
                      next[i] = e.target.value
                      setOptions(next)
                    }}
                    className="h-8 text-[12px]"
                  />
                  <IconButton
                    label="Remove option"
                    size={24}
                    className="hover:text-danger"
                    disabled={options.length === 1}
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  >
                    <X size={11} />
                  </IconButton>
                </div>
              ))}
            </div>
            <button
              onClick={() => setOptions([...options, `Option ${options.length + 1}`])}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong py-1.5 text-[11px] text-ink-3 transition-colors hover:border-brand/50 hover:text-brand-bright"
            >
              <Plus size={11} /> Add option
            </button>
          </Field>
        )}

        <div className="flex items-center justify-between rounded-lg border border-line-soft bg-abyss/35 px-3.5 py-3">
          <div>
            <p className="text-[12px] font-medium text-ink">Required</p>
            <p className="mt-0.5 text-[10.5px] text-ink-4">The form cannot be submitted without an answer.</p>
          </div>
          <Switch checked={required} onChange={setRequired} label="Required" />
        </div>
      </div>
    </Modal>
  )
}

function NewSetModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [appliesTo, setAppliesTo] = useState('All cases')

  const create = async () => {
    if (!name.trim()) return
    const id = uid('qs')
    await db.questionSets.add({
      id,
      name: name.trim(),
      description: description.trim() || 'No description.',
      appliesTo,
      updatedAt: new Date().toISOString(),
      active: true,
    })
    toast.success('Question set created', 'Add questions to it next.')
    onCreated(id)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New question set"
      description="A set groups the questions asked at one moment in the process."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={!name.trim()}>
            Create set
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Subject Interview" />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When is this set used?" />
        </Field>
        <Field label="Applies to">
          <Select
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value)}
            options={[
              { value: 'All cases', label: 'All cases' },
              { value: 'Interviews', label: 'Interviews' },
              { value: 'Evidence', label: 'Evidence' },
              { value: 'Financial Misconduct', label: 'Financial Misconduct cases' },
              { value: 'Information Security', label: 'Information Security cases' },
            ]}
          />
        </Field>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------- Preview */

function PreviewModal({ set, questions, onClose }: { set: QuestionSet; questions: Question[]; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Preview — ${set.name}`}
      description="This is what the form looks like to whoever fills it in."
      size="md"
      footer={
        <Button variant="primary" onClick={onClose}>
          Close preview
        </Button>
      }
    >
      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={q.id}>
            <label className="mb-1.5 block text-[12px] font-medium text-ink-2">
              <span className="mr-1.5 text-ink-4 tnum">{i + 1}.</span>
              {q.label}
              {q.required && <span className="ml-1 text-danger">*</span>}
            </label>

            {q.type === 'text' && <Input placeholder="Your answer" disabled />}
            {q.type === 'textarea' && <Textarea rows={3} placeholder="Your answer" disabled />}
            {q.type === 'number' && <Input type="number" placeholder="0" disabled />}
            {q.type === 'date' && <Input type="date" disabled />}
            {q.type === 'select' && (
              <Select disabled options={(q.options ?? []).map((o) => ({ value: o, label: o }))} />
            )}
            {q.type === 'multiselect' && (
              <div className="flex flex-wrap gap-1.5">
                {(q.options ?? []).map((o) => (
                  <span key={o} className="rounded-full border border-line bg-abyss/50 px-2.5 py-1 text-[11px] text-ink-3">
                    {o}
                  </span>
                ))}
              </div>
            )}
            {q.type === 'boolean' && (
              <div className="flex gap-2">
                {['Yes', 'No'].map((v) => (
                  <span key={v} className="rounded-lg border border-line bg-abyss/50 px-4 py-1.5 text-[11.5px] text-ink-3">
                    {v}
                  </span>
                ))}
              </div>
            )}

            {q.hint && <p className="mt-1.5 text-[10.5px] italic text-ink-4">{q.hint}</p>}
          </div>
        ))}
      </div>
    </Modal>
  )
}
