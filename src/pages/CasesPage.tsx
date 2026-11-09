import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowUpRight,
  Boxes,
  CalendarClock,
  Clock,
  FilePen,
  FolderKanban,
  LayoutGrid,
  Rows3,
  ScrollText,
  Search,
  Shapes,
  SlidersHorizontal,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { Case, CasePriority, CaseStatus } from '@/domain/types'
import { cn, daysUntil, formatDate, formatDateTime, PRIORITY_META, relativeTime, STATUS_META } from '@/lib/utils'
import { Avatar, Badge, Button, Card, EmptyState, Input, Select, tone } from '@/components/ui/primitives'
import { usePermissions, useVisibleCases } from '@/hooks/useAccess'

// The SPRINT form opens only for roles that may create a case, so it loads on
// demand rather than riding in the first-paint bundle for everyone.
const SprintLetterModal = lazy(() =>
  import('@/pages/case/SprintLetterModal').then((m) => ({ default: m.SprintLetterModal })),
)

type View = 'grid' | 'table'

export function CasesPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CaseStatus | 'all'>('all')
  const [priority, setPriority] = useState<CasePriority | 'all'>('all')
  const [view, setView] = useState<View>('grid')
  const [newOpen, setNewOpen] = useState(false)

  // Only the cases this user's SPRINT assignments (or role) reach.
  const cases = useVisibleCases() ?? []
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const roles = useLiveQuery(() => db.roles.toArray(), [], [])
  const navigate = useNavigate()
  // A case begins with its SPRINT. Create cases is enough to open one with a
  // draft order; issuing that order (which grants the team access) still
  // takes Issue & revoke SPRINT, checked inside the form.
  const canOpen = usePermissions('case.create')['case.create']

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cases.filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (priority !== 'all' && c.priority !== priority) return false
      if (!q) return true
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [cases, query, status, priority])

  const stats = useMemo(
    () => ({
      total: cases.length,
      active: cases.filter((c) => c.status === 'active').length,
      review: cases.filter((c) => c.status === 'review').length,
      closed: cases.filter((c) => c.status === 'closed').length,
    }),
    [cases],
  )

  const hasFilters = query.trim() !== '' || status !== 'all' || priority !== 'all'

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1500px] px-6 py-7 lg:px-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Cases</h1>
            <p className="mt-1.5 text-[13px] text-ink-3">
              <span className="text-ink-2 tnum">{stats.total}</span> total ·{' '}
              <span className="text-ok tnum">{stats.active}</span> active ·{' '}
              <span className="text-entity-communication tnum">{stats.review}</span> in review ·{' '}
              <span className="text-ink-4 tnum">{stats.closed}</span> closed
            </p>
          </div>
          {canOpen && (
            <Button variant="primary" icon={<FilePen size={15} />} onClick={() => setNewOpen(true)}>
              Buat SPRINT
            </Button>
          )}
        </header>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-2.5 animate-fade-up" style={{ animationDelay: '60ms' }}>
          <div className="w-full max-w-[300px]">
            <Input
              icon={<Search size={14} />}
              placeholder="Filter by code, title or tag…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="w-[150px]">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as CaseStatus | 'all')}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'pending', label: 'Pending' },
                { value: 'review', label: 'In Review' },
                { value: 'closed', label: 'Closed' },
              ]}
            />
          </div>

          <div className="w-[150px]">
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as CasePriority | 'all')}
              options={[
                { value: 'all', label: 'All priorities' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
          </div>

          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery('')
                setStatus('all')
                setPriority('all')
              }}
            >
              Clear
            </Button>
          )}

          <div className="ml-auto flex items-center gap-1 rounded-lg border border-line bg-abyss/50 p-0.5">
            {([
              ['grid', LayoutGrid],
              ['table', Rows3],
            ] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={`${v} view`}
                aria-pressed={view === v}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md transition-colors duration-150',
                  view === v ? 'bg-brand/18 text-brand-bright' : 'text-ink-4 hover:text-ink-2',
                )}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {cases.length === 0 ? (
          // Nothing to filter: this user simply has no case. Saying "no match"
          // here would send them hunting through filters for a case that was
          // never theirs to see.
          <Card>
            <EmptyState
              icon={<ScrollText size={22} />}
              title="No cases assigned to you"
              description="Cases open up once a Surat Perintah names you. Ask whoever issues SPRINT to add you to the investigation you are expecting."
            />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<SlidersHorizontal size={22} />}
              title="No cases match these filters"
              description="Try widening the status or priority filter, or clearing the search term."
              action={
                <Button
                  onClick={() => {
                    setQuery('')
                    setStatus('all')
                    setPriority('all')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : view === 'grid' ? (
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c, i) => (
              <CaseCard key={c.id} c={c} users={users} i={i} />
            ))}
          </div>
        ) : (
          <CaseTable cases={filtered} users={users} />
        )}
      </div>

      {newOpen && canOpen && (
        <Suspense fallback={null}>
          <SprintLetterModal
            users={users}
            roles={roles}
            onClose={() => setNewOpen(false)}
            onSaved={(sprintId, caseId) => navigate(`/cases/${caseId}/registration?sprint=${sprintId}`)}
          />
        </Suspense>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Card */

function CaseCard({ c, users, i }: { c: Case; users: { id: string; name: string; avatar?: string }[]; i: number }) {
  const navigate = useNavigate()
  const assignee = users.find((u) => u.id === c.assigneeId)
  const team = c.teamIds.map((id) => users.find((u) => u.id === id)).filter(Boolean)
  const priority = PRIORITY_META[c.priority]
  const status = STATUS_META[c.status]
  const due = c.dueAt ? daysUntil(c.dueAt) : null

  const counts = useLiveQuery(
    async () => ({
      nodes: await db.nodes.where('caseId').equals(c.id).count(),
      evidence: await db.evidence.where('caseId').equals(c.id).count(),
    }),
    [c.id],
    { nodes: 0, evidence: 0 },
  )

  return (
    <Card
      onClick={() => navigate(`/cases/${c.id}`)}
      className="group relative flex cursor-pointer flex-col overflow-hidden p-4 transition-all duration-250 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_16px_40px_-12px_rgb(0_0_0/0.7)] animate-fade-up"
      style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${priority.color}, transparent)` }}
      />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-ink-3 tnum">{c.code}</span>
          <Badge color={status.color} size="sm" dot>
            {status.label}
          </Badge>
        </div>
        <ArrowUpRight size={14} className="shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <h3 className="text-[14.5px] font-medium leading-snug text-ink transition-colors group-hover:text-brand-bright">
        {c.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-3">{c.summary}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded-md border border-line bg-abyss/50 px-1.5 py-0.5 text-[10px] text-ink-3">
            {t}
          </span>
        ))}
        {c.tags.length > 3 && <span className="px-1 py-0.5 text-[10px] text-ink-4">+{c.tags.length - 3}</span>}
      </div>

      <div className="mt-3.5 flex items-center gap-4 text-[10.5px] text-ink-4">
        <span className="flex items-center gap-1">
          <Shapes size={11} /> <span className="tnum">{counts.nodes}</span> entities
        </span>
        <span className="flex items-center gap-1">
          <Boxes size={11} /> <span className="tnum">{counts.evidence}</span> evidence
        </span>
        {due !== null && (
          <span className={cn('ml-auto flex items-center gap-1 tnum', due < 0 ? 'text-danger' : due <= 14 ? 'text-warn' : '')}>
            <CalendarClock size={11} />
            {due < 0 ? `${Math.abs(due)}d over` : `${due}d left`}
          </span>
        )}
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line-soft bg-abyss/30 px-2.5 py-1.5">
          <span className="flex items-center gap-1.5 text-[10.5px] text-ink-4">
            <Clock size={11} /> Last update
          </span>
          <span className="text-[11px] text-ink-2 tnum" title={formatDateTime(c.updatedAt)}>
            {formatDateTime(c.updatedAt)}
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-line-soft pt-3">
        <div className="flex -space-x-2">
          {team.slice(0, 4).map((u) => (
            <Avatar key={u!.id} src={u!.avatar} name={u!.name} size={22} className="ring-2 ring-surface" />
          ))}
          {team.length > 4 && (
            <span className="flex size-[22px] items-center justify-center rounded-full bg-surface-3 text-[9px] font-medium text-ink-3 ring-2 ring-surface tnum">
              +{team.length - 4}
            </span>
          )}
        </div>
        <span className="truncate text-[10.5px] text-ink-4">{assignee?.name}</span>
      </div>
    </Card>
  )
}

/* ----------------------------------------------------------------- Table */

function CaseTable({ cases, users }: { cases: Case[]; users: { id: string; name: string; avatar?: string }[] }) {
  const navigate = useNavigate()
  return (
    <Card className="overflow-hidden animate-fade-up">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.07em] text-ink-4">
              <th className="px-4 py-3 font-semibold">Case</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Priority</th>
              <th className="px-4 py-3 font-semibold">Lead</th>
              <th className="px-4 py-3 font-semibold">Due</th>
              <th className="px-4 py-3 font-semibold">Last update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft/70">
            {cases.map((c) => {
              const assignee = users.find((u) => u.id === c.assigneeId)
              const status = STATUS_META[c.status]
              const priority = PRIORITY_META[c.priority]
              const due = c.dueAt ? daysUntil(c.dueAt) : null
              return (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="group cursor-pointer transition-colors hover:bg-tint/4"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="tone flex size-8 shrink-0 items-center justify-center rounded-lg border"
                        style={tone(priority.color)}
                      >
                        <FolderKanban size={14} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] text-ink-3 tnum">{c.code}</p>
                        <p className="truncate text-[13px] font-medium text-ink transition-colors group-hover:text-brand-bright">
                          {c.title}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={status.color} size="sm" dot>
                      {status.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={priority.color} size="sm">
                      {priority.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar src={assignee?.avatar} name={assignee?.name ?? '—'} size={22} />
                      <span className="whitespace-nowrap text-[12px] text-ink-2">{assignee?.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {due === null ? (
                      <span className="text-[12px] text-ink-4">—</span>
                    ) : (
                      <span className={cn('whitespace-nowrap text-[12px] tnum', due < 0 ? 'text-danger' : due <= 14 ? 'text-warn' : 'text-ink-3')}>
                        {formatDate(c.dueAt!)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="block text-[12px] text-ink-2 tnum">{formatDateTime(c.updatedAt)}</span>
                    <span className="block text-[10.5px] text-ink-4">{relativeTime(c.updatedAt)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink-2">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-relaxed text-ink-4">{hint}</span>}
    </label>
  )
}
