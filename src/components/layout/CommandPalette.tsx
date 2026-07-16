import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Building2,
  CornerDownLeft,
  FileText,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  Search,
  Shapes,
  Users,
} from 'lucide-react'
import { db } from '@/domain/db'
import { useApp } from '@/stores/app'
import { useVisibleCases } from '@/hooks/useAccess'
import { cn, ENTITY_COLORS, ENTITY_LABELS, splitHighlight } from '@/lib/utils'
import { Kbd, tone } from '@/components/ui/primitives'

interface Item {
  id: string
  title: string
  subtitle: string
  group: string
  to: string
  icon: typeof Search
  color?: string
}

/**
 * Global palette. Indexes navigation, cases, entities, mail and evidence —
 * the four things an investigator actually jumps between.
 */
export function CommandPalette() {
  const { commandOpen, setCommandOpen } = useApp()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Search must not surface what the user cannot open, so every result set is
  // narrowed to the cases they may reach.
  const cases = useVisibleCases() ?? []
  const caseIds = useMemo(() => new Set(cases.map((c) => c.id)), [cases])
  const allNodes = useLiveQuery(() => db.nodes.toArray(), [], [])
  const allMails = useLiveQuery(() => db.mails.toArray(), [], [])
  const allEvidence = useLiveQuery(() => db.evidence.toArray(), [], [])
  const nodes = useMemo(() => allNodes.filter((n) => caseIds.has(n.caseId)), [allNodes, caseIds])
  const mails = useMemo(() => allMails.filter((m) => caseIds.has(m.caseId)), [allMails, caseIds])
  const evidence = useMemo(() => allEvidence.filter((e) => caseIds.has(e.caseId)), [allEvidence, caseIds])

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = [
      { id: 'nav-dash', title: 'Dashboard', subtitle: 'Overview and activity', group: 'Navigate', to: '/', icon: LayoutDashboard },
      { id: 'nav-cases', title: 'Cases', subtitle: 'All investigations', group: 'Navigate', to: '/cases', icon: FolderKanban },
      { id: 'nav-company', title: 'Company Setting', subtitle: 'Admin Panel', group: 'Navigate', to: '/admin/company', icon: Building2 },
      { id: 'nav-roles', title: 'User Role Setting', subtitle: 'Admin Panel', group: 'Navigate', to: '/admin/roles', icon: Users },
      { id: 'nav-templates', title: 'Template Customization', subtitle: 'Admin Panel', group: 'Navigate', to: '/admin/templates', icon: LayoutTemplate },
      { id: 'nav-questions', title: 'Questions Customization', subtitle: 'Admin Panel', group: 'Navigate', to: '/admin/questions', icon: HelpCircle },
    ]
    const caseItems: Item[] = cases.map((c) => ({
      id: `case-${c.id}`,
      title: `${c.code} — ${c.title}`,
      subtitle: c.summary.slice(0, 90),
      group: 'Cases',
      to: `/cases/${c.id}`,
      icon: FolderKanban,
    }))
    const nodeItems: Item[] = nodes.map((n) => ({
      id: `node-${n.id}`,
      title: n.label,
      subtitle: `${ENTITY_LABELS[n.kind]} · ${n.sublabel}`,
      group: 'Entities',
      to: `/cases/${n.caseId}/graph?node=${n.id}`,
      icon: Shapes,
      color: ENTITY_COLORS[n.kind],
    }))
    const mailItems: Item[] = mails.map((m) => ({
      id: `mail-${m.id}`,
      title: m.subject,
      subtitle: `From ${m.fromName}`,
      group: 'Mail',
      to: `/cases/${m.caseId}/mail?id=${m.id}`,
      icon: Mail,
    }))
    const evItems: Item[] = evidence.map((e) => ({
      id: `ev-${e.id}`,
      title: e.name,
      subtitle: `${e.ref} · ${e.status}`,
      group: 'Evidence',
      to: `/cases/${e.caseId}/evidence?id=${e.id}`,
      icon: FileText,
    }))
    return [...nav, ...caseItems, ...nodeItems, ...mailItems, ...evItems]
  }, [cases, nodes, mails, evidence])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.filter((i) => i.group === 'Navigate' || i.group === 'Cases').slice(0, 10)
    return items
      .map((i) => {
        const t = i.title.toLowerCase()
        const s = i.subtitle.toLowerCase()
        // Prefix hits rank above substring hits, title above subtitle.
        let score = -1
        if (t.startsWith(q)) score = 0
        else if (t.includes(q)) score = 1
        else if (s.includes(q)) score = 2
        return { i, score }
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 12)
      .map((r) => r.i)
  }, [items, query])

  useEffect(() => setCursor(0), [query])

  useEffect(() => {
    if (commandOpen) {
      setQuery('')
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [commandOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(!useApp.getState().commandOpen)
      }
      if (e.key === 'Escape' && useApp.getState().commandOpen) setCommandOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setCommandOpen])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!commandOpen) return null

  const go = (item: Item) => {
    navigate(item.to)
    setCommandOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (c + 1) % Math.max(1, results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (c - 1 + results.length) % Math.max(1, results.length))
    } else if (e.key === 'Enter' && results[cursor]) {
      e.preventDefault()
      go(results[cursor])
    }
  }

  let lastGroup = ''

  return createPortal(
    <div className="fixed inset-0 z-200 flex items-start justify-center pt-[12dvh] px-4">
      <div className="absolute inset-0 bg-abyss/70 backdrop-blur-sm animate-fade-in" onClick={() => setCommandOpen(false)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-[620px] glass-strong rounded-2xl shadow-[var(--shadow-panel)] overflow-hidden animate-scale-in"
      >
        <div className="flex items-center gap-3 px-4 border-b border-line-soft">
          <Search size={17} className="text-ink-3 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search cases, entities, documents, emails…"
            className="flex-1 h-13 bg-transparent text-[14px] text-ink placeholder:text-ink-4 outline-none"
          />
          <Kbd>ESC</Kbd>
        </div>

        <div ref={listRef} className="max-h-[52dvh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-ink-3">
              Nothing matches “{query}”.
            </p>
          ) : (
            results.map((item, idx) => {
              const showGroup = item.group !== lastGroup
              lastGroup = item.group
              const active = idx === cursor
              return (
                <div key={item.id}>
                  {showGroup && (
                    <p className="px-4 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-4">
                      {item.group}
                    </p>
                  )}
                  <button
                    data-active={active}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => go(item)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100',
                      active ? 'bg-brand/14' : 'hover:bg-tint/4',
                    )}
                  >
                    <span
                      className="tone flex size-7 shrink-0 items-center justify-center rounded-md border"
                      style={tone(item.color ?? '#6A7FA3')}
                    >
                      <item.icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">
                        {splitHighlight(item.title, query).map((p, i) => (
                          <span key={i} className={p.hit ? 'text-brand-bright font-semibold' : undefined}>
                            {p.text}
                          </span>
                        ))}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-ink-4">{item.subtitle}</span>
                    </span>
                    {active && <CornerDownLeft size={13} className="text-ink-4 shrink-0" />}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line-soft px-4 py-2.5 text-[11px] text-ink-4">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto tnum">{results.length} results</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
