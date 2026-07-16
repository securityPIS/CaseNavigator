import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Boxes,
  Briefcase,
  ChevronRight,
  ClipboardList,
  FileText,
  Gavel,
  Lightbulb,
  MessageSquareQuote,
  MoreHorizontal,
  Presentation,
  Shapes,
  ShieldAlert,
  Sparkles,
  ScrollText,
} from 'lucide-react'
import { db } from '@/domain/db'
import { canAccessCase } from '@/domain/access'
import type { CaseStatus } from '@/domain/types'
import { cn, PRIORITY_META, STATUS_META } from '@/lib/utils'
import { Avatar, Badge, IconButton, Progress, Select, tone } from '@/components/ui/primitives'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'

const TABS = [
  { to: 'registration', label: 'Case Registration', icon: ClipboardList, count: (c: Counts) => c.documents },
  { to: 'graph', label: 'Node Graph', icon: Shapes, count: (c: Counts) => c.nodes },
  { to: 'gelar', label: 'Gelar Perkara', icon: Gavel, count: (c: Counts) => c.gelar },
  { to: 'sprint', label: 'SPRINT', icon: ScrollText, count: (c: Counts) => c.sprints },
  { to: 'interview', label: 'Interview', icon: MessageSquareQuote, count: (c: Counts) => c.baps },
  { to: 'evidence', label: 'Evidence', icon: Boxes, count: (c: Counts) => c.evidence },
  { to: 'challenge', label: 'Challenge Session', icon: Presentation, count: (c: Counts) => c.slides },
  { to: 'report', label: 'Investigation Report', icon: FileText, count: () => null },
  { to: 'recommendation', label: 'Recommendation', icon: Lightbulb, count: (c: Counts) => c.recs },
]

interface Counts {
  nodes: number
  documents: number
  evidence: number
  slides: number
  recs: number
  sprints: number
  baps: number
  gelar: number
}

export function CaseLayout() {
  const { caseId = '' } = useParams()
  const userId = useSession((s) => s.userId)
  const c = useLiveQuery(() => db.cases.get(caseId), [caseId])
  const assignee = useLiveQuery(() => (c ? db.users.get(c.assigneeId) : undefined), [c?.assigneeId])

  /** Undefined while loading — the gate must not flash "no access" first. */
  const access = useLiveQuery(async () => {
    const me = await db.users.get(userId)
    const role = me ? await db.roles.get(me.role) : undefined
    const sprints = await db.sprints.where('caseId').equals(caseId).toArray()
    return { ok: canAccessCase(me, role, sprints), roleName: role?.name ?? 'No role', name: me?.name ?? 'Unknown user' }
  }, [caseId, userId])

  const counts = useLiveQuery(
    async (): Promise<Counts> => ({
      nodes: await db.nodes.where('caseId').equals(caseId).count(),
      documents: (await db.cases.get(caseId))?.documents?.length ?? 0,
      evidence: await db.evidence.where('caseId').equals(caseId).count(),
      slides: await db.slides.where('caseId').equals(caseId).count(),
      recs: await db.recommendations.where('caseId').equals(caseId).count(),
      sprints: await db.sprints.where('caseId').equals(caseId).count(),
      baps: await db.baps.where('caseId').equals(caseId).count(),
      gelar: await db.gelarPerkara.where('caseId').equals(caseId).count(),
    }),
    [caseId],
    { nodes: 0, documents: 0, evidence: 0, slides: 0, recs: 0, sprints: 0, baps: 0, gelar: 0 },
  )

  if (c === undefined || access === undefined) return <PageSpinner />
  if (c === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-[15px] font-medium text-ink">Case not found</p>
          <Link to="/cases" className="mt-2 inline-block text-[13px] text-brand-bright hover:underline">
            Back to all cases
          </Link>
        </div>
      </div>
    )
  }

  if (!access.ok) return <NoAccess code={c.code} name={access.name} roleName={access.roleName} />

  const priority = PRIORITY_META[c.priority]
  const status = STATUS_META[c.status]

  const setStatus = async (next: CaseStatus) => {
    await db.cases.update(c.id, { status: next, updatedAt: new Date().toISOString() })
    toast.success('Status updated', `${c.code} is now ${STATUS_META[next].label.toLowerCase()}.`)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Case header */}
      <div
        className="case-header shrink-0 px-6 pt-4 lg:px-7"
        style={tone(priority.color)}
      >
        <nav className="mb-3 flex items-center gap-1.5 text-[11.5px] text-ink-4" aria-label="Breadcrumb">
          <Link to="/cases" className="transition-colors hover:text-ink-2">
            Cases
          </Link>
          <ChevronRight size={12} />
          <span className="text-ink-2 tnum">{c.code}</span>
        </nav>

        <div className="flex flex-wrap items-start gap-4">
          <span
            className="tone tone-glow flex size-11 shrink-0 items-center justify-center rounded-xl border"
            style={tone(priority.color)}
          >
            <Briefcase size={20} />
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="text-[19px] font-semibold leading-tight tracking-tight text-ink">
              <span className="text-ink-3 tnum">{c.code}</span> {c.title}
            </h1>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Badge color={priority.color} size="sm">
                <Sparkles size={10} />
                {priority.label}
              </Badge>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ink-4">Assigned To</span>
                <Avatar src={assignee?.avatar} name={assignee?.name ?? '—'} size={20} />
                <span className="text-[12px] text-ink-2">{assignee?.name}</span>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-[11px] text-ink-4">Progress</span>
                <Progress value={c.progress} className="w-[120px]" color={priority.color} />
                <span className="text-[11.5px] font-medium text-ink-2 tnum">{c.progress}%</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ink-4">Status</span>
                <div className="w-[122px]">
                  <Select
                    value={c.status}
                    onChange={(e) => setStatus(e.target.value as CaseStatus)}
                    className="h-7 text-[12px]"
                    style={{ color: status.color }}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'review', label: 'In Review' },
                      { value: 'closed', label: 'Closed' },
                      { value: 'archived', label: 'Archived' },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>

          <IconButton label="Case actions" className="mt-1">
            <MoreHorizontal size={17} />
          </IconButton>
        </div>

        <TabBar caseId={caseId} counts={counts} />
      </div>

      {/* Tab content */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}

/**
 * Shown when the signed-in user is not on this case's SPRINT and their role
 * cannot see every case. The case code is safe to name — they reached this URL
 * already — but nothing about its content is.
 */
function NoAccess({ code, name, roleName }: { code: string; name: string; roleName: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-[420px] text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-warn/30 bg-warn/10 text-warn">
          <ShieldAlert size={24} />
        </span>
        <h1 className="text-[16px] font-semibold text-ink">No access to {code}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          No active Surat Perintah on this case names {name}, and the {roleName} role does not see every case. Ask
          whoever issues SPRINT for this investigation to add you to the order.
        </p>
        <Link
          to="/cases"
          className="mt-5 inline-block rounded-lg border border-line-strong px-3.5 py-2 text-[12.5px] text-ink-2 transition-colors hover:border-brand/60 hover:text-ink"
        >
          Back to my cases
        </Link>
      </div>
    </div>
  )
}

/** Tab bar with a sliding indicator that tracks the active link. */
function TabBar({ caseId, counts }: { caseId: string; counts: Counts }) {
  const listRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  const { pathname } = useLocation()

  useEffect(() => {
    const update = () => {
      const active = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
      if (!active || !listRef.current) return
      const parent = listRef.current.getBoundingClientRect()
      const rect = active.getBoundingClientRect()
      const next = { left: rect.left - parent.left, width: rect.width, ready: true }
      // Bail when nothing moved: this sets state, so an unconditional write
      // would re-render, re-run the effect, and loop forever.
      setIndicator((prev) =>
        prev.ready && prev.left === next.left && prev.width === next.width ? prev : next,
      )
    }
    update()
    // The active tab's font-weight settles a frame later; re-measure once.
    const t = setTimeout(update, 60)
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', update)
    }
  }, [pathname])

  return (
    <div ref={listRef} className="relative mt-4 flex gap-1 overflow-x-auto no-scrollbar">
      {TABS.map((t) => {
        const count = t.count(counts)
        return (
          <NavLink
            key={t.to}
            to={`/cases/${caseId}/${t.to}`}
            className={({ isActive }) =>
              cn(
                'group relative flex shrink-0 items-center gap-2 rounded-t-lg px-3.5 py-3 transition-colors duration-150',
                isActive ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
              )
            }
          >
            {({ isActive }) => (
              <>
                <t.icon size={15} className={cn('transition-colors', isActive && 'text-brand-bright')} />
                <span className="whitespace-nowrap text-[12.5px] font-medium">{t.label}</span>
                {count !== null && count > 0 && (
                  <span
                    className={cn(
                      'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tnum transition-colors',
                      isActive ? 'bg-brand/25 text-brand-bright' : 'bg-surface-3 text-ink-3',
                    )}
                  >
                    {count}
                  </span>
                )}
              </>
            )}
          </NavLink>
        )
      })}

      {indicator.ready && (
        <span
          className="pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-brand-bright shadow-[0_0_10px_rgb(96_165_250/0.9)] transition-all duration-300 ease-[var(--ease-out-quint)]"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
    </div>
  )
}
