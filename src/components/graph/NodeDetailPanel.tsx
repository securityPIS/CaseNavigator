import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronRight,
  ExternalLink,
  Flag,
  Link2,
  ListChecks,
  MoreHorizontal,
  Plus,
  StickyNote,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { GraphNode } from '@/domain/types'
import {
  cn,
  ENTITY_COLORS,
  ENTITY_LABELS,
  formatDate,
  formatTime,
  RISK_META,
  withAlpha,
} from '@/lib/utils'
import { Badge, IconButton, tone } from '@/components/ui/primitives'
import { ENTITY_ICONS } from './EntityNode'
import { toast } from '@/stores/toast'

interface Props {
  node: GraphNode
  onClose: () => void
  onSelectNode: (id: string) => void
}

export function NodeDetailPanel({ node, onClose, onSelectNode }: Props) {
  const [expanded, setExpanded] = useState(false)
  const color = ENTITY_COLORS[node.kind]
  const Icon = ENTITY_ICONS[node.kind]
  const risk = RISK_META[node.risk]

  const edges = useLiveQuery(() => db.edges.where('caseId').equals(node.caseId).toArray(), [node.caseId], [])
  const allNodes = useLiveQuery(() => db.nodes.where('caseId').equals(node.caseId).toArray(), [node.caseId], [])
  const evidence = useLiveQuery(() => db.evidence.where('caseId').equals(node.caseId).toArray(), [node.caseId], [])
  const mails = useLiveQuery(() => db.mails.where('caseId').equals(node.caseId).toArray(), [node.caseId], [])

  const related = useMemo(() => {
    const ids = new Set<string>()
    for (const e of edges) {
      if (e.source === node.id) ids.add(e.target)
      if (e.target === node.id) ids.add(e.source)
    }
    return allNodes.filter((n) => ids.has(n.id))
  }, [edges, allNodes, node.id])

  const linkedEvidence = useMemo(
    () => evidence.filter((e) => e.linkedNodeIds.includes(node.id)),
    [evidence, node.id],
  )

  /** Timeline merges everything that mentions this entity, newest first. */
  const timeline = useMemo(() => {
    const items: { id: string; at: string; text: string; sub: string; to?: string }[] = []
    for (const e of linkedEvidence) {
      items.push({
        id: `ev-${e.id}`,
        at: e.collectedAt,
        text: `${e.ref} collected`,
        sub: `by ${e.collectedBy}`,
        to: `/cases/${node.caseId}/evidence?id=${e.id}`,
      })
    }
    for (const m of mails.filter((m) => m.linkedNodeIds.includes(node.id))) {
      items.push({
        id: `m-${m.id}`,
        at: m.sentAt,
        text: m.subject,
        sub: `from ${m.fromName}`,
        to: `/cases/${node.caseId}/mail?id=${m.id}`,
      })
    }
    items.push({ id: 'created', at: node.createdAt, text: 'Entity added to graph', sub: 'CaseNavigator' })
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 6)
  }, [linkedEvidence, mails, node])

  const summaryLong = node.summary.length > 150

  return (
    <aside
      key={node.id}
      className="flex h-full w-full flex-col overflow-hidden glass-strong animate-fade-up lg:rounded-[var(--radius-card)]"
    >
      {/* Header */}
      <header className="relative shrink-0 overflow-hidden border-b border-line-soft p-4">
        <div
          className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full opacity-25 blur-3xl"
          style={{ background: color }}
        />
        <div className="relative flex items-start gap-3">
          {node.avatar ? (
            <img
              src={node.avatar}
              alt=""
              className="size-12 shrink-0 rounded-xl object-cover ring-2"
              style={{ '--tw-ring-color': withAlpha(color, 0.5) } as React.CSSProperties}
            />
          ) : (
            <span className="tone flex size-12 shrink-0 items-center justify-center rounded-xl border" style={tone(color)}>
              <Icon size={22} />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-semibold leading-tight text-ink">{node.label}</h2>
            <p className="mt-0.5 text-[12px] text-ink-3">{node.sublabel}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Badge color={risk.color} size="sm">
              {risk.label}
            </Badge>
            <IconButton label="Close panel" size={28} onClick={onClose}>
              <X size={15} />
            </IconButton>
          </div>
        </div>

        <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
          <span className="tone rounded-md border px-1.5 py-0.5 text-[10px] font-medium" style={tone(color)}>
            {ENTITY_LABELS[node.kind]}
          </span>
          {node.tags.map((t) => (
            <span key={t} className="rounded-md border border-line bg-abyss/50 px-1.5 py-0.5 text-[10px] text-ink-3">
              {t}
            </span>
          ))}
          <button
            onClick={() => toast.info('Tagging', 'Tag editing is not wired up in this build.')}
            className="flex size-5 items-center justify-center rounded-md border border-dashed border-line-strong text-ink-4 transition-colors hover:border-brand/50 hover:text-brand-bright"
            aria-label="Add tag"
          >
            <Plus size={11} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary + counts */}
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <section className="rounded-xl border border-line-soft bg-abyss/35 p-3.5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">Summary</h3>
            <p className={cn('text-[12px] leading-relaxed text-ink-2', !expanded && summaryLong && 'line-clamp-3')}>
              {node.summary}
            </p>
            {summaryLong && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 flex items-center gap-1 text-[11px] text-brand-bright transition-colors hover:text-brand"
              >
                {expanded ? 'Show less' : 'Show more'}
                <ChevronRight size={11} className={cn('transition-transform duration-200', expanded && 'rotate-90')} />
              </button>
            )}
          </section>

          <div className="flex gap-3 lg:w-[112px] lg:flex-col">
            <StatBox label="Linked Evidence" value={linkedEvidence.length} to={`/cases/${node.caseId}/evidence`} />
            <StatBox label="Related Entities" value={related.length} />
          </div>
        </div>

        {/* Attributes */}
        {node.attributes.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">Attributes</h3>
            <dl className="overflow-hidden rounded-xl border border-line-soft">
              {node.attributes.map((a, i) => (
                <div
                  key={a.label}
                  className={cn(
                    'flex items-start gap-3 px-3 py-2 text-[11.5px]',
                    i % 2 === 0 ? 'bg-abyss/35' : 'bg-abyss/15',
                  )}
                >
                  <dt className="w-[42%] shrink-0 text-ink-4">{a.label}</dt>
                  <dd className="min-w-0 flex-1 break-words font-medium text-ink-2">{a.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Timeline + related */}
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-xl border border-line-soft bg-abyss/35 p-3.5">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">Timeline</h3>
            <ol className="relative space-y-3">
              <span className="absolute bottom-1.5 left-[3px] top-1.5 w-px bg-line" aria-hidden />
              {timeline.map((t) => (
                <li key={t.id} className="relative pl-4">
                  <span className="absolute left-0 top-1.5 size-[7px] rounded-full bg-brand ring-2 ring-void" />
                  <p className="text-[10px] uppercase tracking-wide text-ink-4 tnum">
                    {formatDate(t.at)} · {formatTime(t.at)}
                  </p>
                  {t.to ? (
                    <Link
                      to={t.to}
                      className="group mt-0.5 flex items-start gap-1 text-[11.5px] leading-snug text-ink-2 transition-colors hover:text-brand-bright"
                    >
                      <span className="min-w-0 flex-1 truncate">{t.text}</span>
                      <ExternalLink size={10} className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  ) : (
                    <p className="mt-0.5 truncate text-[11.5px] leading-snug text-ink-2">{t.text}</p>
                  )}
                  <p className="text-[10.5px] text-ink-4">{t.sub}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-line-soft bg-abyss/35 p-3.5">
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
              Related Entities
            </h3>
            <ul className="space-y-1">
              {related.slice(0, 6).map((r) => {
                const rc = ENTITY_COLORS[r.kind]
                const RIcon = ENTITY_ICONS[r.kind]
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => onSelectNode(r.id)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-tint/6"
                    >
                      <span className="tone flex size-6 shrink-0 items-center justify-center rounded-md border" style={tone(rc)}>
                        <RIcon size={12} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2 transition-colors group-hover:text-ink">
                        {r.label}
                      </span>
                      <ChevronRight size={12} className="shrink-0 text-ink-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
            {related.length > 6 && (
              <p className="mt-2 px-2 text-[10.5px] text-ink-4 tnum">+{related.length - 6} more in the graph</p>
            )}
          </section>
        </div>

        {/* Linked evidence */}
        {linkedEvidence.length > 0 && (
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">Linked Evidence</h3>
            <ul className="space-y-1.5">
              {linkedEvidence.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/cases/${node.caseId}/evidence?id=${e.id}`}
                    className="group flex items-center gap-2.5 rounded-lg border border-line-soft bg-abyss/35 px-3 py-2 transition-colors hover:border-brand/35 hover:bg-brand/6"
                  >
                    <span className="text-[10.5px] font-medium text-ink-4 tnum">{e.ref}</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2 transition-colors group-hover:text-ink">
                      {e.name}
                    </span>
                    <ExternalLink size={11} className="shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Quick actions */}
      <footer className="shrink-0 border-t border-line-soft p-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">Quick Actions</h3>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { icon: StickyNote, label: 'Add Note' },
            { icon: Link2, label: 'Add Link' },
            { icon: ListChecks, label: 'Create Task' },
            { icon: Flag, label: 'Mark for Review' },
            { icon: MoreHorizontal, label: 'More' },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => toast.info(a.label, 'This action is a placeholder in the current build.')}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-line-soft bg-abyss/35 px-1 py-2.5 text-ink-3 transition-all duration-150 hover:border-brand/40 hover:bg-brand/8 hover:text-brand-bright active:scale-95"
            >
              <a.icon size={15} />
              <span className="text-center text-[9px] leading-tight">{a.label}</span>
            </button>
          ))}
        </div>
      </footer>
    </aside>
  )
}

function StatBox({ label, value, to }: { label: string; value: number; to?: string }) {
  const inner = (
    <>
      <p className="text-[9.5px] uppercase leading-tight tracking-[0.05em] text-ink-4">{label}</p>
      <p className="mt-1 text-[20px] font-semibold leading-none text-ink tnum">{value}</p>
    </>
  )
  const cls =
    'flex-1 rounded-xl border border-line-soft bg-abyss/35 p-2.5 transition-colors hover:border-brand/35 hover:bg-brand/6'
  return to ? (
    <Link to={to} className={cn(cls, 'group flex flex-col justify-center')}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}
