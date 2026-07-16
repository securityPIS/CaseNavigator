import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Clock,
  FileText,
  FolderKanban,
  Mail,
  Shapes,
  TrendingUp,
} from 'lucide-react'
import { db } from '@/domain/db'
import { useVisibleCases } from '@/hooks/useAccess'
import { useSession } from '@/stores/session'
import type { Case } from '@/domain/types'
import {
  cn,
  daysUntil,
  ENTITY_COLORS,
  ENTITY_LABELS,
  formatDate,
  PRIORITY_META,
  relativeTime,
  STATUS_META,
  withAlpha,
} from '@/lib/utils'
import { Avatar, Badge, Card, Progress, SectionHeading, tone } from '@/components/ui/primitives'

export function DashboardPage() {
  const userId = useSession((s) => s.userId)
  const cases = useVisibleCases() ?? []
  const caseIds = useMemo(() => new Set(cases.map((c) => c.id)), [cases])
  const allNodes = useLiveQuery(() => db.nodes.toArray(), [], [])
  const allEvidence = useLiveQuery(() => db.evidence.toArray(), [], [])
  const allMails = useLiveQuery(() => db.mails.toArray(), [], [])
  const allActivities = useLiveQuery(() => db.activities.orderBy('at').reverse().toArray(), [], [])
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const me = users.find((u) => u.id === userId)

  // The dashboard aggregates across cases, so each source is cut to the cases
  // this user can open — otherwise the totals would count work they cannot see.
  const nodes = useMemo(() => allNodes.filter((n) => caseIds.has(n.caseId)), [allNodes, caseIds])
  const evidence = useMemo(() => allEvidence.filter((e) => caseIds.has(e.caseId)), [allEvidence, caseIds])
  const mails = useMemo(() => allMails.filter((m) => caseIds.has(m.caseId)), [allMails, caseIds])
  const activities = useMemo(
    () => allActivities.filter((a) => !a.caseId || caseIds.has(a.caseId)).slice(0, 9),
    [allActivities, caseIds],
  )

  const openCases = cases.filter((c) => c.status !== 'closed' && c.status !== 'archived')
  const myCases = openCases.filter((c) => c.assigneeId === userId)
  const unreadMail = mails.filter((m) => !m.read).length
  const pendingEvidence = evidence.filter((e) => e.status === 'analyzing' || e.status === 'collected').length

  /** Cases with a deadline, most urgent (most overdue) first. */
  const dueSoon = useMemo(
    () =>
      openCases
        .filter((c) => c.dueAt)
        .map((c) => ({ c, days: daysUntil(c.dueAt!) }))
        .sort((a, b) => a.days - b.days)
        .slice(0, 4),
    [openCases],
  )

  /** The one deadline worth naming in the greeting — only from the user's own cases. */
  const nearest = useMemo(
    () => dueSoon.find((d) => d.c.assigneeId === userId && d.days < 30) ?? null,
    [dueSoon, userId],
  )

  const entityBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of nodes) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [nodes])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] px-6 py-7 lg:px-8">
        {/* Header */}
        <header className="mb-7 animate-fade-up">
          <p className="text-[12.5px] text-ink-3">{formatDate(new Date().toISOString())}</p>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight text-ink">
            {greeting}, {me?.name.split(' ')[0]}.
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-2">
            {myCases.length > 0 ? (
              <>
                You have{' '}
                <strong className="font-medium text-ink">
                  {myCases.length} open {myCases.length === 1 ? 'case' : 'cases'}
                </strong>
                {nearest && (
                  <>
                    {' · '}
                    {nearest.days < 0 ? (
                      <>
                        <strong className="font-medium text-danger">{nearest.c.code}</strong> is{' '}
                        {Math.abs(nearest.days)} {Math.abs(nearest.days) === 1 ? 'day' : 'days'} overdue
                      </>
                    ) : nearest.days === 0 ? (
                      <>
                        <strong className="font-medium text-warn">{nearest.c.code}</strong> is due today
                      </>
                    ) : (
                      <>
                        nearest deadline is <strong className="font-medium text-ink">{nearest.c.code}</strong> in{' '}
                        {nearest.days} {nearest.days === 1 ? 'day' : 'days'}
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              'No cases currently assigned to you.'
            )}
          </p>
        </header>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatCard
            icon={FolderKanban}
            label="Open Cases"
            value={openCases.length}
            sub={`${myCases.length} assigned to you`}
            color="#3B82F6"
            i={0}
          />
          <StatCard
            icon={Shapes}
            label="Tracked Entities"
            value={nodes.length}
            sub={`across ${cases.length} cases`}
            color="#A855F7"
            i={1}
          />
          <StatCard
            icon={Boxes}
            label="Evidence Items"
            value={evidence.length}
            sub={`${pendingEvidence} awaiting review`}
            color="#10B981"
            i={2}
          />
          <StatCard
            icon={Mail}
            label="Unread Mail"
            value={unreadMail}
            sub={`${mails.length} total in case inboxes`}
            color="#F59E0B"
            i={3}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          {/* Left column */}
          <div className="space-y-5">
            <section className="animate-fade-up" style={{ animationDelay: '80ms' }}>
              <SectionHeading
                action={
                  <Link to="/cases" className="flex items-center gap-1 text-[11.5px] text-brand-bright transition-colors hover:text-brand">
                    View all <ArrowRight size={12} />
                  </Link>
                }
              >
                Active Investigations
              </SectionHeading>
              <div className="space-y-2.5">
                {openCases.slice(0, 4).map((c, i) => (
                  <CaseRow key={c.id} c={c} users={users} i={i} />
                ))}
              </div>
            </section>

            <section className="animate-fade-up" style={{ animationDelay: '140ms' }}>
              <SectionHeading>Entity Distribution</SectionHeading>
              <Card className="p-5">
                <div className="space-y-3.5">
                  {entityBreakdown.map(([kind, count]) => {
                    const color = ENTITY_COLORS[kind as keyof typeof ENTITY_COLORS]
                    const pct = (count / nodes.length) * 100
                    return (
                      <div key={kind} className="flex items-center gap-3.5">
                        <span className="w-[104px] shrink-0 text-[12px] text-ink-2">
                          {ENTITY_LABELS[kind as keyof typeof ENTITY_LABELS]}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-abyss/70">
                          <div
                            className="h-full rounded-full transition-[width] duration-1000 ease-[var(--ease-out-quint)]"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${withAlpha(color, 0.5)}, ${color})`,
                              boxShadow: `0 0 10px -1px ${withAlpha(color, 0.85)}`,
                            }}
                          />
                        </div>
                        <span className="w-7 shrink-0 text-right text-[12px] font-medium text-ink tnum">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {dueSoon.length > 0 && (
              <section className="animate-fade-up" style={{ animationDelay: '100ms' }}>
                <SectionHeading>Deadlines</SectionHeading>
                <Card className="divide-y divide-line-soft/70 overflow-hidden">
                  {dueSoon.map(({ c, days }) => {
                    const overdue = days < 0
                    const urgent = days >= 0 && days <= 14
                    return (
                      <Link
                        key={c.id}
                        to={`/cases/${c.id}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-tint/4"
                      >
                        <span
                          className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                            overdue
                              ? 'border-danger/40 bg-danger/12 text-danger'
                              : urgent
                                ? 'border-warn/40 bg-warn/12 text-warn'
                                : 'border-line bg-surface-2 text-ink-3',
                          )}
                        >
                          {overdue ? <AlertTriangle size={14} /> : <Clock size={14} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-medium text-ink tnum">{c.code}</span>
                          <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{c.title}</span>
                        </span>
                        <span
                          className={cn(
                            'shrink-0 text-right text-[11px] font-medium tnum',
                            overdue ? 'text-danger' : urgent ? 'text-warn' : 'text-ink-3',
                          )}
                        >
                          {overdue ? `${Math.abs(days)}d over` : `${days}d`}
                        </span>
                      </Link>
                    )
                  })}
                </Card>
              </section>
            )}

            <section className="animate-fade-up" style={{ animationDelay: '160ms' }}>
              <SectionHeading>Recent Activity</SectionHeading>
              <Card className="p-4">
                <ol className="relative space-y-4">
                  <span className="absolute bottom-2 left-[13px] top-2 w-px bg-line-soft" aria-hidden />
                  {activities.map((a) => {
                    const actor = users.find((u) => u.id === a.actorId)
                    return (
                      <li key={a.id} className="relative flex gap-3">
                        <Avatar src={actor?.avatar} name={actor?.name ?? '—'} size={27} className="relative z-1 ring-3 ring-surface" />
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-[12px] leading-relaxed text-ink-2">
                            <span className="font-medium text-ink">{actor?.name}</span> {a.verb}{' '}
                            <span className="text-ink">{a.object}</span>
                          </p>
                          <p className="mt-0.5 text-[10.5px] text-ink-4">{relativeTime(a.at)}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </Card>
            </section>

            <section className="animate-fade-up" style={{ animationDelay: '220ms' }}>
              <SectionHeading>Quick Access</SectionHeading>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { to: '/cases/c-014/graph', icon: Shapes, label: 'Board', sub: 'CN-2026-014' },
                  { to: '/cases/c-014/evidence', icon: Boxes, label: 'Evidence', sub: '12 items' },
                  { to: '/cases/c-014/report', icon: FileText, label: 'Report', sub: 'Draft' },
                  { to: '/cases/c-014/recommendation', icon: TrendingUp, label: 'Recommendations', sub: '12 actions' },
                ].map((q) => (
                  <Link
                    key={q.to}
                    to={q.to}
                    className="group glass rounded-xl p-3.5 transition-all duration-200 hover:border-brand/40 hover:bg-brand/6"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <q.icon size={16} className="text-ink-3 transition-colors group-hover:text-brand-bright" />
                      <ArrowUpRight size={13} className="text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="text-[12.5px] font-medium text-ink">{q.label}</p>
                    <p className="mt-0.5 text-[10.5px] text-ink-4">{q.sub}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  i,
}: {
  icon: typeof FolderKanban
  label: string
  value: number
  sub: string
  color: string
  i: number
}) {
  return (
    <Card
      className="group relative overflow-hidden p-4 animate-fade-up transition-colors duration-300 hover:border-tint/14"
      style={{ animationDelay: `${i * 60}ms` }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-45 blur-2xl transition-opacity duration-500 group-hover:opacity-75"
        style={{ background: color }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">{label}</p>
          <p className="mt-2 text-[30px] font-semibold leading-none text-ink tnum">{value}</p>
          <p className="mt-2 text-[11px] text-ink-4">{sub}</p>
        </div>
        <span className="tone flex size-9 items-center justify-center rounded-lg border" style={tone(color)}>
          <Icon size={17} />
        </span>
      </div>
    </Card>
  )
}

function CaseRow({ c, users, i }: { c: Case; users: { id: string; name: string; avatar?: string }[]; i: number }) {
  const navigate = useNavigate()
  const assignee = users.find((u) => u.id === c.assigneeId)
  const priority = PRIORITY_META[c.priority]
  const status = STATUS_META[c.status]

  return (
    <Card
      onClick={() => navigate(`/cases/${c.id}`)}
      className="group cursor-pointer p-4 transition-all duration-200 hover:border-brand/35 hover:bg-brand/4 animate-fade-up"
      style={{ animationDelay: `${100 + i * 55}ms` }}
    >
      <div className="flex items-start gap-3.5">
        <span
          className="tone mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors"
          style={tone(priority.color)}
        >
          <FolderKanban size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-ink-3 tnum">{c.code}</span>
            <Badge color={status.color} size="sm" dot>
              {status.label}
            </Badge>
            {(c.priority === 'high' || c.priority === 'critical') && (
              <Badge color={priority.color} size="sm">
                {priority.label}
              </Badge>
            )}
          </div>
          <h3 className="mt-1.5 truncate text-[14px] font-medium text-ink transition-colors group-hover:text-brand-bright">
            {c.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-[11.5px] leading-relaxed text-ink-3">{c.summary}</p>

          <div className="mt-3 flex items-center gap-3">
            <Progress value={c.progress} className="flex-1" color={priority.color} />
            <span className="shrink-0 text-[11px] font-medium text-ink-2 tnum">{c.progress}%</span>
            <Avatar src={assignee?.avatar} name={assignee?.name ?? '—'} size={22} />
          </div>
        </div>
      </div>
    </Card>
  )
}
