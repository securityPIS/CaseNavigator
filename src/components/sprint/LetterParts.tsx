import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { IconButton, Textarea } from '@/components/ui/primitives'

/* -------------------------------------------------------------- Preview */

/** Width the letter is laid out at inside the frame — an A4 page plus the
    grey margin around it. */
const FRAME_WIDTH = 860

/**
 * Live preview of a rendered letter. The HTML is laid out at full A4 width
 * inside an isolated frame and scaled down to fit, so what you see is the
 * page that prints — not a re-flowed approximation of it.
 */
export function LetterPreview({ html, className }: { html: string; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(2400)
  // Typing re-renders the letter on every keystroke; reloading the frame that
  // often makes it flicker, so it only follows once input settles.
  const [doc, setDoc] = useState(html)

  useEffect(() => {
    const t = setTimeout(() => setDoc(html), 250)
    return () => clearTimeout(t)
  }, [html])

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = width > 0 ? width / FRAME_WIDTH : 0.5

  return (
    <div ref={boxRef} className={className}>
      <div style={{ height: height * scale, overflow: 'hidden' }} className="rounded-lg">
        <iframe
          ref={frameRef}
          title="Pratinjau Surat Perintah"
          srcDoc={doc}
          onLoad={() => {
            const h = frameRef.current?.contentDocument?.documentElement.scrollHeight
            if (h) setHeight(h)
          }}
          style={{
            width: FRAME_WIDTH,
            height,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
          }}
        />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- Form pieces */

/** A titled block in a long form. Not a <label>: it wraps several inputs. */
export function FormSection({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3 rounded-xl border border-line-soft bg-abyss/25 p-3.5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-2">{title}</h4>
          {hint && <p className="mt-1 text-[11px] leading-relaxed text-ink-4">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** An ordered list of free-text points: Dasar, Menimbang, standing tasks… */
export function ListEditor({
  items,
  onChange,
  addLabel,
  placeholder,
  numberFrom = 1,
  minItems = 0,
}: {
  items: string[]
  onChange: (next: string[]) => void
  addLabel: string
  placeholder?: string
  /** Number of the first item, for lists that continue a fixed point. */
  numberFrom?: number
  minItems?: number
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 w-5 shrink-0 text-right text-[10.5px] text-ink-4 tnum">{numberFrom + i}.</span>
          <Textarea
            rows={2}
            value={item}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
            className="min-h-[56px] text-[12px]"
          />
          <div className="flex shrink-0 flex-col gap-0.5">
            <IconButton label="Move up" size={22} disabled={i === 0} onClick={() => move(i, -1)}>
              <ChevronUp size={11} />
            </IconButton>
            <IconButton label="Move down" size={22} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              <ChevronDown size={11} />
            </IconButton>
            <IconButton
              label="Remove"
              size={22}
              className="hover:text-danger"
              disabled={items.length <= minItems}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <X size={11} />
            </IconButton>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong py-1.5 text-[11.5px] text-ink-3 transition-colors hover:border-brand/50 hover:text-brand-bright"
      >
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  )
}
