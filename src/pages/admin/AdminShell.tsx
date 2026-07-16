import type { ReactNode } from 'react'
import { SectionHeading } from '@/components/ui/primitives'

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
