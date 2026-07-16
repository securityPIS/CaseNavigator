import { NavLink, useLocation } from 'react-router-dom'
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  PanelLeft,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useApp } from '@/stores/app'
import { useVisibleCases } from '@/hooks/useAccess'
import { cn, STATUS_META } from '@/lib/utils'
import { Tooltip } from '@/components/ui/primitives'

const ADMIN_ITEMS = [
  { to: '/admin/company', label: 'Company Setting', icon: Building2 },
  { to: '/admin/roles', label: 'User Role Setting', icon: Users },
  { to: '/admin/templates', label: 'Template Customization', icon: LayoutTemplate },
  { to: '/admin/questions', label: 'Questions Customization', icon: HelpCircle },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, casesExpanded, toggleCasesExpanded, adminExpanded, toggleAdminExpanded } = useApp()
  const location = useLocation()
  const cases = useVisibleCases() ?? []

  const collapsed = sidebarCollapsed
  const activeCases = cases.filter((c) => c.status !== 'closed' && c.status !== 'archived')
  const onCases = location.pathname.startsWith('/cases')
  const onAdmin = location.pathname.startsWith('/admin')

  return (
    <aside
      className={cn(
        'relative flex flex-col shrink-0 h-full border-r border-line-soft',
        'bg-gradient-to-b from-surface/90 to-void/95 backdrop-blur-xl',
        'transition-[width] duration-300 ease-[var(--ease-out-quint)]',
        collapsed ? 'w-[68px]' : 'w-[258px]',
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center h-[68px] shrink-0', collapsed ? 'justify-center px-2' : 'px-5 gap-2.5')}>
        <div className="relative shrink-0">
          <svg viewBox="0 0 64 64" className="size-8" fill="none" aria-hidden>
            <defs>
              <linearGradient id="sb-g" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
                <stop stopColor="#60A5FA" />
                <stop offset="0.55" stopColor="#3B82F6" />
                <stop offset="1" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <path d="M32 3.5 55.7 17v30L32 60.5 8.3 47V17L32 3.5Z" fill="url(#sb-g)" fillOpacity="0.16" stroke="url(#sb-g)" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M22 44V21l20 22V20" stroke="url(#sb-g)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="22" cy="20.5" r="4" fill="#0B1222" stroke="#60A5FA" strokeWidth="2.5" />
            <circle cx="42" cy="43.5" r="4" fill="#0B1222" stroke="#8B5CF6" strokeWidth="2.5" />
          </svg>
        </div>
        {!collapsed && (
          <span className="text-[17px] font-semibold tracking-tight text-ink truncate">
            Case<span className="text-brand-bright">Navigator</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 no-scrollbar">
        <SideLink to="/" icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} end />

        {/* Cases group */}
        <div className="mt-1">
          <div className={cn('flex items-center', collapsed && 'justify-center')}>
            <SideLink to="/cases" icon={FolderKanban} label="Cases" collapsed={collapsed} className="flex-1" partialActive />
            {!collapsed && (
              <button
                onClick={toggleCasesExpanded}
                aria-label={casesExpanded ? 'Collapse cases' : 'Expand cases'}
                aria-expanded={casesExpanded}
                className="p-1.5 -ml-1 mr-1 rounded-md text-ink-3 hover:text-ink hover:bg-tint/6 transition-colors"
              >
                <ChevronDown
                  size={14}
                  className={cn('transition-transform duration-250 ease-[var(--ease-out-quint)]', !casesExpanded && '-rotate-90')}
                />
              </button>
            )}
          </div>

          {!collapsed && (
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out-quint)]',
                casesExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <ul className="mt-1 ml-4 space-y-px border-l border-line-soft pl-2 py-0.5">
                  {activeCases.map((c) => {
                    const meta = STATUS_META[c.status]
                    return (
                      <li key={c.id}>
                        <NavLink
                          to={`/cases/${c.id}`}
                          className={({ isActive }) =>
                            cn(
                              'group relative flex items-start gap-2 rounded-lg px-2.5 py-2 transition-colors duration-150',
                              isActive ? 'bg-brand/12' : 'hover:bg-tint/5',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span
                                className="mt-1.5 size-1.5 rounded-full shrink-0 transition-transform duration-200"
                                style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
                              />
                              <span className="min-w-0 flex-1">
                                <span
                                  className={cn(
                                    'block truncate text-[12px] font-medium leading-tight tnum',
                                    isActive ? 'text-brand-bright' : 'text-ink-2 group-hover:text-ink',
                                  )}
                                >
                                  {c.code}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] leading-tight text-ink-4">
                                  {c.title}
                                </span>
                              </span>
                              {isActive && (
                                <span className="absolute -left-[9px] top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-bright" />
                              )}
                            </>
                          )}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Admin group */}
        <div className="mt-4">
          {collapsed ? (
            <SideLink to="/admin/company" icon={ShieldCheck} label="Admin Panel" collapsed active={onAdmin} />
          ) : (
            <>
              <button
                onClick={toggleAdminExpanded}
                aria-expanded={adminExpanded}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors duration-150',
                  onAdmin ? 'text-ink' : 'text-ink-2 hover:text-ink hover:bg-tint/5',
                )}
              >
                <ShieldCheck size={17} className={cn('shrink-0', onAdmin && 'text-brand-bright')} />
                <span className="flex-1 text-left text-[13px] font-medium">Admin Panel</span>
                <ChevronDown
                  size={14}
                  className={cn('text-ink-3 transition-transform duration-250 ease-[var(--ease-out-quint)]', !adminExpanded && '-rotate-90')}
                />
              </button>
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out-quint)]',
                  adminExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
              >
                <div className="overflow-hidden">
                  <ul className="mt-1 space-y-px">
                    {ADMIN_ITEMS.map((it) => (
                      <li key={it.to}>
                        <NavLink
                          to={it.to}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2.5 rounded-lg py-2 pl-4 pr-3 ml-3 transition-colors duration-150',
                              isActive ? 'bg-brand/12 text-brand-bright' : 'text-ink-3 hover:text-ink hover:bg-tint/5',
                            )
                          }
                        >
                          <it.icon size={15} className="shrink-0" />
                          <span className="truncate text-[12.5px]">{it.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-line-soft p-3">
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-ink-3 transition-colors duration-150',
            'hover:bg-tint/5 hover:text-ink',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <PanelLeft size={17} /> : <ChevronLeft size={17} />}
          {!collapsed && <span className="text-[12.5px] font-medium">Collapse</span>}
        </button>
      </div>

      {/* Active-case accent glow */}
      {onCases && !collapsed && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
      )}
    </aside>
  )
}

function SideLink({
  to,
  icon: Icon,
  label,
  collapsed,
  end,
  className,
  partialActive,
  active,
}: {
  to: string
  icon: typeof LayoutDashboard
  label: string
  collapsed: boolean
  end?: boolean
  className?: string
  partialActive?: boolean
  active?: boolean
}) {
  const body = (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => {
        const on = active ?? (partialActive ? isActive : isActive)
        return cn(
          'group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-150',
          on ? 'bg-brand/12 text-ink' : 'text-ink-2 hover:text-ink hover:bg-tint/5',
          collapsed && 'justify-center px-0',
          className,
        )
      }}
    >
      {({ isActive }) => {
        const on = active ?? isActive
        return (
          <>
            <Icon size={17} className={cn('shrink-0 transition-colors', on && 'text-brand-bright')} />
            {!collapsed && <span className="truncate text-[13px] font-medium">{label}</span>}
            {on && !collapsed && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-bright shadow-[0_0_10px_rgb(96_165_250/0.9)]" />
            )}
          </>
        )
      }}
    </NavLink>
  )

  return collapsed ? (
    <Tooltip label={label} side="right">
      {body}
    </Tooltip>
  ) : (
    body
  )
}
