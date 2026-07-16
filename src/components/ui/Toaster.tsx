import { createPortal } from 'react-dom'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToasts, type ToastKind } from '@/stores/toast'
import { IconButton } from './primitives'

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const COLORS: Record<ToastKind, string> = {
  success: '#10B981',
  error: '#EF4444',
  info: '#38BDF8',
}

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  if (toasts.length === 0) return null

  return createPortal(
    <div className="fixed bottom-5 right-5 z-200 flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        const color = COLORS[t.kind]
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 w-[340px] glass-strong rounded-xl px-3.5 py-3 shadow-[var(--shadow-panel)] animate-scale-in"
            style={{ borderColor: `${color}44` }}
          >
            <Icon size={17} style={{ color }} className="shrink-0 mt-px" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink leading-snug">{t.title}</p>
              {t.body && <p className="mt-1 text-[12px] text-ink-3 leading-relaxed">{t.body}</p>}
            </div>
            <IconButton label="Dismiss" size={24} onClick={() => dismiss(t.id)}>
              <X size={13} />
            </IconButton>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
