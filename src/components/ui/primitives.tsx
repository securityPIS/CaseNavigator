import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn, withAlpha } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

/* --------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white shadow-[0_2px_16px_-4px_rgb(59_130_246/0.7)] hover:bg-brand-bright active:bg-brand-deep border border-brand-bright/30',
  secondary:
    'bg-surface-3/80 text-ink hover:bg-elevated border border-tint/8 hover:border-tint/14',
  outline:
    'bg-transparent text-ink-2 hover:text-ink border border-line-strong hover:border-brand/60 hover:bg-brand/8',
  ghost: 'bg-transparent text-ink-2 hover:text-ink hover:bg-tint/6 border border-transparent',
  danger:
    'bg-danger/12 text-danger hover:bg-danger/20 border border-danger/30 hover:border-danger/50',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-[11px] gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap select-none',
        'transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-[var(--ease-out-quint)]',
        'active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin-slow shrink-0" /> : icon}
      {children}
    </button>
  )
})

/* ------------------------------------------------------------ IconButton */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: number
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 34, active, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={cn(
        'inline-flex items-center justify-center rounded-lg shrink-0',
        'transition-all duration-150 ease-[var(--ease-out-quint)] active:scale-90',
        active
          ? 'bg-brand/18 text-brand-bright border border-brand/40'
          : 'text-ink-3 hover:text-ink hover:bg-tint/7 border border-transparent',
        'disabled:opacity-40 disabled:pointer-events-none',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

/* ---------------------------------------------------------------- Badge */

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string
  dot?: boolean
  size?: 'sm' | 'md'
}

export function Badge({ color = '#6A7FA3', dot, size = 'md', className, children, style, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'tone inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap border',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        className,
      )}
      style={{ '--tone': color, ...style } as CSSProperties}
      {...rest}
    >
      {dot && <span className="size-1.5 rounded-full shrink-0 bg-current" />}
      {children}
    </span>
  )
}

/**
 * Style object for the `tone` class — for the accent chips built inline rather
 * than through Badge (icon tiles, swatches).
 */
export function tone(color: string): CSSProperties {
  return { '--tone': color } as CSSProperties
}

/* ----------------------------------------------------------------- Card */

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass rounded-[var(--radius-card)] shadow-[var(--shadow-card)]', className)} {...rest}>
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------- Input */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, suffix, className, ...rest },
  ref,
) {
  return (
    <div className="relative flex items-center w-full">
      {icon && <span className="absolute left-3 text-ink-3 pointer-events-none flex">{icon}</span>}
      <input
        ref={ref}
        className={cn(
          'w-full h-9 rounded-lg bg-abyss/60 border border-line text-[13px] text-ink',
          'placeholder:text-ink-4 transition-colors duration-150',
          'hover:border-line-strong focus:border-brand/70 focus:bg-abyss/80 focus:outline-none',
          'focus:ring-2 focus:ring-brand/18',
          icon ? 'pl-9' : 'pl-3',
          suffix ? 'pr-9' : 'pr-3',
          className,
        )}
        {...rest}
      />
      {suffix && <span className="absolute right-3 text-ink-4 pointer-events-none flex">{suffix}</span>}
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-lg bg-abyss/60 border border-line text-[13px] text-ink px-3 py-2 resize-y',
          'placeholder:text-ink-4 transition-colors duration-150 leading-relaxed',
          'hover:border-line-strong focus:border-brand/70 focus:outline-none focus:ring-2 focus:ring-brand/18',
          className,
        )}
        {...rest}
      />
    )
  },
)

/* --------------------------------------------------------------- Select */

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
}

export function Select({ options, className, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          'appearance-none w-full h-9 rounded-lg bg-abyss/60 border border-line text-[13px] text-ink',
          'pl-3 pr-8 cursor-pointer transition-colors duration-150',
          'hover:border-line-strong focus:border-brand/70 focus:outline-none focus:ring-2 focus:ring-brand/18',
          className,
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface-2 text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-3"
        width="12" height="12" viewBox="0 0 12 12" fill="none"
      >
        <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/* -------------------------------------------------------------- Switch */

interface SwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-[38px] h-[22px] rounded-full shrink-0 transition-colors duration-200 ease-[var(--ease-out-quint)]',
        'border disabled:opacity-40 disabled:pointer-events-none',
        checked ? 'bg-brand/85 border-brand-bright/50' : 'bg-surface-3 border-line-strong',
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 -translate-y-1/2 size-[16px] rounded-full bg-white shadow-md',
          'transition-transform duration-200 ease-[var(--ease-spring)]',
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  )
}

/* ------------------------------------------------------------- Progress */

export function Progress({ value, className, color = '#3B82F6' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn('h-1.5 rounded-full bg-abyss/80 overflow-hidden border border-line-soft', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-quint)]"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: `linear-gradient(90deg, ${withAlpha(color, 0.65)}, ${color})`,
          boxShadow: `0 0 12px -2px ${withAlpha(color, 0.8)}`,
        }}
      />
    </div>
  )
}

/* --------------------------------------------------------------- Avatar */

export function Avatar({
  src,
  name,
  size = 32,
  ring,
  className,
}: {
  src?: string
  name: string
  size?: number
  ring?: boolean
  className?: string
}) {
  return (
    <img
      src={src}
      alt={name}
      title={name}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn(
        'rounded-full object-cover shrink-0 bg-surface-3',
        ring && 'ring-2 ring-brand/50 ring-offset-2 ring-offset-void',
        className,
      )}
    />
  )
}

/* -------------------------------------------------------------- Tooltip */

export function Tooltip({ label, children, side = 'top' }: { label: string; children: ReactNode; side?: 'top' | 'bottom' | 'right' }) {
  return (
    <span className="relative group/tt inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md px-2 py-1 text-[11px]',
          'glass-strong text-ink shadow-[var(--shadow-panel)]',
          'opacity-0 scale-95 group-hover/tt:opacity-100 group-hover/tt:scale-100',
          'transition-all duration-150 ease-[var(--ease-out-quint)]',
          side === 'top' && 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
          side === 'bottom' && 'top-full left-1/2 -translate-x-1/2 mt-1.5',
          side === 'right' && 'left-full top-1/2 -translate-y-1/2 ml-1.5',
        )}
      >
        {label}
      </span>
    </span>
  )
}

/* ----------------------------------------------------------- EmptyState */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-up">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-2 border border-line text-ink-3">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-ink mb-1.5">{title}</h3>
      <p className="text-[13px] text-ink-3 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* -------------------------------------------------------- SectionHeading */

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-3">{children}</h2>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------ Kbd */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface-2 px-1.5 font-sans text-[10px] font-medium text-ink-3">
      {children}
    </kbd>
  )
}
