import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Building2, HelpCircle, LayoutTemplate, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionHeading } from '@/components/ui/primitives'

/** The admin destinations — surfaced here on phones, where the sidebar
    (which normally carries them) is hidden behind the bottom nav. */
const ADMIN_NAV = [
  { to: '/admin/company', label: 'Company', icon: Building2 },
  { to: '/admin/roles', label: 'Roles', icon: Users },
  { to: '/admin/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/admin/questions', label: 'Questions', icon: HelpCircle },
]

/** Shared chrome for the four admin pages so they read as one panel. */
export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-6 py-7 lg:px-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-4">Admin Panel</p>
            <h1 className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
            <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-relaxed text-ink-3">{description}</p>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>

        {/* Admin section switcher — phones only; the sidebar handles md and up. */}
        <nav className="mb-6 -mx-6 flex gap-2 overflow-x-auto px-6 no-scrollbar md:hidden" aria-label="Admin sections">
          {ADMIN_NAV.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors',
                  isActive
                    ? 'border-brand/40 bg-brand/12 text-brand-bright'
                    : 'border-line text-ink-3 hover:text-ink',
                )
              }
            >
              <it.icon size={15} className="shrink-0" />
              {it.label}
            </NavLink>
          ))}
        </nav>

        {children}
      </div>
    </div>
  )
}

export function AdminSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mb-6 animate-fade-up">
      <SectionHeading action={action}>{title}</SectionHeading>
      {description && <p className="-mt-1.5 mb-3 text-[11.5px] leading-relaxed text-ink-4">{description}</p>}
      {children}
    </section>
  )
}
