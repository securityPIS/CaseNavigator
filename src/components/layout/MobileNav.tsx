import { NavLink, useLocation } from 'react-router-dom'
import { FolderKanban, LayoutDashboard, Search, ShieldCheck } from 'lucide-react'
import { useApp } from '@/stores/app'
import { cn } from '@/lib/utils'

/**
 * Fixed bottom navigation for phones. The sidebar is hidden below `md`, so this
 * bar carries the app's top-level destinations plus a search entry that opens
 * the command palette. It lives at the foot of the layout column — the column
 * is exactly one viewport tall and never scrolls — so it stays pinned to the
 * bottom without needing `position: fixed`. The safe-area inset keeps it clear
 * of the iOS home indicator.
 */
export function MobileNav() {
  const setCommandOpen = useApp((s) => s.setCommandOpen)
  const { pathname } = useLocation()
  const onAdmin = pathname.startsWith('/admin')

  return (
    <nav
      aria-label="Primary"
      className="z-40 flex shrink-0 items-stretch border-t border-line-soft bg-void/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <NavItem to="/" end icon={LayoutDashboard} label="Dashboard" />
      <NavItem to="/cases" icon={FolderKanban} label="Cases" />

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium text-ink-3 transition-colors active:text-brand-bright"
      >
        <Search size={20} className="shrink-0" />
        <span>Search</span>
      </button>

      <NavItem to="/admin" icon={ShieldCheck} label="Admin" active={onAdmin} />
    </nav>
  )
}

function NavItem({
  to,
  end,
  icon: Icon,
  label,
  active,
}: {
  to: string
  end?: boolean
  icon: typeof LayoutDashboard
  label: string
  /** Override active state (used for /admin/* which lands on /admin/company). */
  active?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors',
          (active ?? isActive) ? 'text-brand-bright' : 'text-ink-3',
        )
      }
    >
      {({ isActive }) => {
        const on = active ?? isActive
        return (
          <>
            {on && (
              <span className="absolute top-0 h-[2px] w-8 rounded-full bg-brand-bright shadow-[0_0_10px_rgb(96_165_250/0.9)]" />
            )}
            <Icon size={20} className="shrink-0" />
            <span>{label}</span>
          </>
        )
      }}
    </NavLink>
  )
}
