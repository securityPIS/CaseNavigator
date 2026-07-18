import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, CalendarClock, GripVertical, Plus, Shapes, Trash2 } from 'lucide-react'
import { db } from '@/domain/db'
import type { CasePriority, GraphNode, RecColumn, Recommendation, User } from '@/domain/types'
import { cn, daysUntil, ENTITY_COLORS, PRIORITY_META, uid } from '@/lib/utils'
import { Avatar, Button, IconButton, Input, Select, Textarea, tone } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'

const COLUMNS: { id: RecColumn; label: string; color: string; hint: string }[] = [
  { id: 'open', label: 'Open', color: '#38BDF8', hint: 'Captured, not yet started' },
  { id: 'in_progress', label: 'In Progress', color: '#F59E0B', hint: 'Being worked now' },
  { id: 'closed', label: 'Closed', color: '#10B981', hint: 'Complete' },
]

export function RecommendationPage() {
  const { caseId = '' } = useParams()
  const recs = useLiveQuery(() => db.recommendations.where('caseId').equals(caseId).toArray(), [caseId], [])
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const nodes = useLiveQuery(() => db.nodes.where('caseId').equals(caseId).toArray(), [caseId], [])

  const [dragging, setDragging] = useState<Recommendation | null>(null)
  const [editing, setEditing] = useState<Recommendation | null>(null)
  const [creating, setCreating] = useState<RecColumn | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const byColumn = useMemo(() => {
    const map = new Map<RecColumn, Recommendation[]>()
    for (const col of COLUMNS) map.set(col.id, [])
    for (const r of recs) map.get(r.column)?.push(r)
    for (const list of map.values()) list.sort((a, b) => a.order - b.order)
    return map
  }, [recs])

  const onDragStart = (e: DragStartEvent) => {
    setDragging(recs.find((r) => r.id === e.active.id) ?? null)
  }

  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null)
    const { active, over } = e
    if (!over) return

    const activeRec = recs.find((r) => r.id === active.id)
    if (!activeRec) return

    // `over` is either a column (empty area) or another card.
    const overCol = COLUMNS.find((c) => c.id === over.id)?.id
    const overRec = recs.find((r) => r.id === over.id)
    const targetCol = overCol ?? overRec?.column
    if (!targetCol) return

    const target = (byColumn.get(targetCol) ?? []).filter((r) => r.id !== activeRec.id)
    const insertAt = overRec ? target.findIndex((r) => r.id === overRec.id) : target.length
    target.splice(insertAt < 0 ? target.length : insertAt, 0, { ...activeRec, column: targetCol })

    await Promise.all(target.map((r, i) => db.recommendations.update(r.id, { column: targetCol, order: i })))

    // Re-index the source column so gaps don't accumulate.
    if (activeRec.column !== targetCol) {
      const source = (byColumn.get(activeRec.column) ?? []).filter((r) => r.id !== activeRec.id)
      await Promise.all(source.map((r, i) => db.recommendations.update(r.id, { order: i })))
      await db.activities.add({
        id: uid('ac'),
        caseId,
        actorId: 'u-jason',
        verb: 'moved',
        object: `“${activeRec.title}” to ${COLUMNS.find((c) => c.id === targetCol)!.label}`,
        at: new Date().toISOString(),
        kind: 'case',
      })
    }
  }

  const blocking = recs.filter((r) => r.tags.includes('blocking') && r.column !== 'closed')

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-line-soft px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-[13.5px] font-semibold text-ink">Recommended Actions</h2>
            <p className="mt-0.5 text-[11px] text-ink-3">
              <span className="tnum">{recs.length}</span> actions ·{' '}
              <span className="tnum">{recs.filter((r) => r.column === 'closed').length}</span> complete
            </p>
          </div>

          {blocking.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5">
              <AlertTriangle size={13} className="shrink-0 text-danger" />
              <span className="text-[11px] text-danger">
                <span className="font-medium tnum">{blocking.length}</span> blocking{' '}
                {blocking.length === 1 ? 'action' : 'actions'} outstanding
              </span>
            </div>
          )}

          <Button size="sm" variant="primary" icon={<Plus size={13} />} className="ml-auto" onClick={() => setCreating('open')}>
            New action
          </Button>
        </div>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex h-full justify-center gap-3">
            {COLUMNS.map((col) => (
              <Column
                key={col.id}
                col={col}
                items={byColumn.get(col.id) ?? []}
                users={users}
                nodes={nodes}
                onAdd={() => setCreating(col.id)}
                onOpen={setEditing}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
          {dragging && (
            <div className="rotate-2 opacity-95">
              <CardBody rec={dragging} users={users} nodes={nodes} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editing && (
        <EditModal
          rec={editing}
          users={users}
          nodes={nodes}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            await db.recommendations.delete(editing.id)
            toast.success('Action deleted', `“${editing.title}” was removed.`)
            setEditing(null)
          }}
        />
      )}

      {creating && (
        <CreateModal
          caseId={caseId}
          column={creating}
          users={users}
          nodes={nodes}
          existingCount={(byColumn.get(creating) ?? []).length}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  )
}

/* --------------------------------------------------------------- Column */

function Column({
  col,
  items,
  users,
  nodes,
  onAdd,
  onOpen,
}: {
  col: (typeof COLUMNS)[number]
  items: Recommendation[]
  users: User[]
  nodes: GraphNode[]
  onAdd: () => void
  onOpen: (r: Recommendation) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col">
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <span className="size-2 shrink-0 rounded-full" style={{ background: col.color, boxShadow: `0 0 7px ${col.color}` }} />
        <h3 className="text-[12px] font-semibold text-ink">{col.label}</h3>
        <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10px] font-medium text-ink-3 tnum">{items.length}</span>
        <IconButton label={`Add to ${col.label}`} size={22} className="ml-auto" onClick={onAdd}>
          <Plus size={12} />
        </IconButton>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-dashed p-2 transition-colors duration-200',
          isOver ? 'border-brand/60 bg-brand/6' : 'border-line-soft bg-abyss/25',
        )}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((r) => (
            <SortableCard key={r.id} rec={r} users={users} nodes={nodes} onOpen={() => onOpen(r)} />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <div className="flex flex-1 items-center justify-center px-3 py-6 text-center">
            <p className="text-[10.5px] leading-relaxed text-ink-4">{col.hint}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- Card */

function SortableCard({
  rec,
  users,
  nodes,
  onOpen,
}: {
  rec: Recommendation
  users: User[]
  nodes: GraphNode[]
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rec.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-35')}
    >
      <CardBody rec={rec} users={users} nodes={nodes} onOpen={onOpen} dragHandle={{ ...attributes, ...listeners }} />
    </div>
  )
}

function CardBody({
  rec,
  users,
  nodes,
  onOpen,
  dragHandle,
}: {
  rec: Recommendation
  users: User[]
  nodes: GraphNode[]
  onOpen?: () => void
  dragHandle?: Record<string, unknown>
}) {
  const assignee = users.find((u) => u.id === rec.assigneeId)
  const priority = PRIORITY_META[rec.priority]
  const linked = nodes.filter((n) => rec.linkedNodeIds.includes(n.id))
  const due = rec.dueAt ? daysUntil(rec.dueAt) : null
  const isBlocking = rec.tags.includes('blocking')

  return (
    <div
      className={cn(
        'group glass rounded-xl p-3 transition-all duration-200 hover:border-brand/40',
        onOpen && 'cursor-pointer',
      )}
      onClick={onOpen}
    >
      <div className="mb-2 flex items-start gap-2">
        <span
          className="mt-1 size-1.5 shrink-0 rounded-full"
          style={{ background: priority.color, boxShadow: `0 0 6px ${priority.color}` }}
          title={priority.label}
        />
        <h4 className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-ink">{rec.title}</h4>
        {dragHandle && (
          <button
            {...dragHandle}
            aria-label="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
            className="-mr-1 -mt-0.5 shrink-0 cursor-grab text-ink-4 opacity-0 transition-opacity hover:text-ink-2 group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical size={13} />
          </button>
        )}
      </div>

      <p className="line-clamp-2 text-[10.5px] leading-relaxed text-ink-4">{rec.detail}</p>

      {(rec.tags.length > 0 || linked.length > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {isBlocking && (
            <span className="rounded border border-danger/35 bg-danger/12 px-1.5 py-px text-[9px] font-medium text-danger">
              blocking
            </span>
          )}
          {rec.tags
            .filter((t) => t !== 'blocking')
            .slice(0, 2)
            .map((t) => (
              <span key={t} className="rounded border border-line bg-abyss/50 px-1.5 py-px text-[9px] text-ink-4">
                {t}
              </span>
            ))}
          {linked.slice(0, 2).map((n) => {
            const color = ENTITY_COLORS[n.kind]
            return (
              <span key={n.id} className="tone flex items-center gap-1 rounded border px-1.5 py-px text-[9px]" style={tone(color)}>
                <Shapes size={7} />
                {n.label}
              </span>
            )
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-line-soft/70 pt-2.5">
        {due !== null ? (
          <span
            className={cn(
              'flex items-center gap-1 text-[9.5px] tnum',
              due < 0 ? 'text-danger' : due <= 7 ? 'text-warn' : 'text-ink-4',
            )}
          >
            <CalendarClock size={9} />
            {due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? 'Due today' : `${due}d`}
          </span>
        ) : (
          <span className="text-[9.5px] text-ink-4">No due date</span>
        )}
        {assignee ? (
          <Avatar src={assignee.avatar} name={assignee.name} size={19} />
        ) : (
          <span className="flex size-[19px] items-center justify-center rounded-full border border-dashed border-line-strong text-[8px] text-ink-4">
            ?
          </span>
        )}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Modals */

function EditModal({
  rec,
  users,
  nodes,
  onClose,
  onDelete,
}: {
  rec: Recommendation
  users: User[]
  nodes: GraphNode[]
  onClose: () => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(rec.title)
  const [detail, setDetail] = useState(rec.detail)
  const [priority, setPriority] = useState(rec.priority)
  const [assigneeId, setAssigneeId] = useState(rec.assigneeId ?? '')
  const [column, setColumn] = useState(rec.column)
  const [dueAt, setDueAt] = useState(rec.dueAt?.slice(0, 10) ?? '')
  const [linkIds, setLinkIds] = useState(rec.linkedNodeIds)

  const save = async () => {
    await db.recommendations.update(rec.id, {
      title: title.trim() || rec.title,
      detail: detail.trim(),
      priority,
      assigneeId: assigneeId || undefined,
      column,
      dueAt: dueAt ? new Date(`${dueAt}T17:00:00`).toISOString() : undefined,
      linkedNodeIds: linkIds,
    })
    toast.success('Action updated')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit action"
      size="md"
      footer={
        <>
          <Button variant="danger" icon={<Trash2 size={13} />} onClick={onDelete}>
            Delete
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <RecForm
        {...{ title, setTitle, detail, setDetail, priority, setPriority, assigneeId, setAssigneeId, column, setColumn, dueAt, setDueAt, linkIds, setLinkIds, users, nodes }}
      />
    </Modal>
  )
}

function CreateModal({
  caseId,
  column: initialColumn,
  users,
  nodes,
  existingCount,
  onClose,
}: {
  caseId: string
  column: RecColumn
  users: User[]
  nodes: GraphNode[]
  existingCount: number
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [priority, setPriority] = useState<CasePriority>('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [column, setColumn] = useState<RecColumn>(initialColumn)
  const [dueAt, setDueAt] = useState('')
  const [linkIds, setLinkIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await db.recommendations.add({
        id: uid('rc'),
        caseId,
        column,
        order: existingCount,
        title: title.trim(),
        detail: detail.trim() || 'No detail recorded.',
        priority,
        assigneeId: assigneeId || undefined,
        dueAt: dueAt ? new Date(`${dueAt}T17:00:00`).toISOString() : undefined,
        tags: [],
        linkedNodeIds: linkIds,
        createdAt: new Date().toISOString(),
      })
      toast.success('Action created', `Added to ${COLUMNS.find((c) => c.id === column)!.label}.`)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New recommended action"
      description="Actions are what closes a case. Be specific about what unblocks it."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} loading={saving} disabled={!title.trim()}>
            Create action
          </Button>
        </>
      }
    >
      <RecForm
        autoFocus
        {...{ title, setTitle, detail, setDetail, priority, setPriority, assigneeId, setAssigneeId, column, setColumn, dueAt, setDueAt, linkIds, setLinkIds, users, nodes }}
      />
    </Modal>
  )
}

function RecForm({
  title,
  setTitle,
  detail,
  setDetail,
  priority,
  setPriority,
  assigneeId,
  setAssigneeId,
  column,
  setColumn,
  dueAt,
  setDueAt,
  linkIds,
  setLinkIds,
  users,
  nodes,
  autoFocus,
}: {
  title: string
  setTitle: (v: string) => void
  detail: string
  setDetail: (v: string) => void
  priority: CasePriority
  setPriority: (v: CasePriority) => void
  assigneeId: string
  setAssigneeId: (v: string) => void
  column: RecColumn
  setColumn: (v: RecColumn) => void
  dueAt: string
  setDueAt: (v: string) => void
  linkIds: string[]
  setLinkIds: (v: string[]) => void
  users: User[]
  nodes: GraphNode[]
  autoFocus?: boolean
}) {
  return (
    <div className="space-y-4">
      <Field label="Title" required>
        <Input autoFocus={autoFocus} placeholder="e.g. Records request — account ••2210" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Detail" hint="Why does this matter, and what does it unblock?">
        <Textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Column">
          <Select value={column} onChange={(e) => setColumn(e.target.value as RecColumn)} options={COLUMNS.map((c) => ({ value: c.id, label: c.label }))} />
        </Field>
        <Field label="Priority">
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as CasePriority)}
            options={Object.entries(PRIORITY_META).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </Field>
        <Field label="Assignee">
          <Select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            options={[{ value: '', label: 'Unassigned' }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
          />
        </Field>
        <Field label="Due date">
          <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </Field>
      </div>

      {nodes.length > 0 && (
        <Field label="Link to entities">
          <div className="flex max-h-[96px] flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-line bg-abyss/35 p-2">
            {nodes.map((n) => {
              const on = linkIds.includes(n.id)
              const color = ENTITY_COLORS[n.kind]
              return (
                <button
                  key={n.id}
                  onClick={() => setLinkIds(on ? linkIds.filter((x) => x !== n.id) : [...linkIds, n.id])}
                  className={cn(
                    'rounded-full border px-2 py-1 text-[10.5px] transition-colors',
                    on ? 'tone' : 'border-line text-ink-3 hover:text-ink',
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
  )
}

