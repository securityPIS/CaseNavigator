import { memo, useEffect, useRef } from 'react'
import type { GraphNode, Slide, SlideElement } from '@/domain/types'
import { ENTITY_COLORS, withAlpha } from '@/lib/utils'
import { ENTITY_ICONS } from '@/components/graph/EntityNode'

/** Design surface. Every element coordinate is in this space and scaled at render. */
export const SLIDE_W = 960
export const SLIDE_H = 540

export const BACKGROUNDS: Record<string, string> = {
  'gradient-midnight':
    'radial-gradient(900px 520px at 78% 12%, rgb(37 99 235 / 0.34), transparent 62%), radial-gradient(760px 460px at 12% 92%, rgb(139 92 246 / 0.26), transparent 60%), linear-gradient(160deg, #0B1222, #060B18)',
  'solid-void': '#060B18',
  'solid-surface': 'linear-gradient(165deg, #101A2E, #0B1222)',
  'gradient-steel': 'linear-gradient(140deg, #16233D 0%, #0B1222 70%)',
  ivory: 'linear-gradient(160deg, #F8FAFC, #E8EDF5)',
}

const FONTS: Record<string, string> = {
  sans: 'var(--font-sans)',
  serif: 'var(--font-serif)',
  mono: 'var(--font-mono)',
}

interface Props {
  slide: Slide
  nodes: GraphNode[]
  /** Scale from design space to render space. */
  scale: number
  selectedId?: string | null
  onSelectElement?: (id: string | null) => void
  onElementPointerDown?: (e: React.PointerEvent, el: SlideElement) => void
  interactive?: boolean
  /** The text element being typed into on the slide itself. */
  editingId?: string | null
  /** Double-click (or Enter) on a text element asks to edit it in place. */
  onStartEdit?: (id: string) => void
  /** The edited text, once the user clicks away or presses Escape. */
  onCommitText?: (id: string, text: string) => void
}

/**
 * Renders a slide at any scale. Thumbnails, the editor canvas and present
 * mode all go through this so a slide can never look different in the deck
 * than it does in the editor.
 */
function SlideViewImpl({
  slide,
  nodes,
  scale,
  selectedId,
  onSelectElement,
  onElementPointerDown,
  interactive = false,
  editingId,
  onStartEdit,
  onCommitText,
}: Props) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: SLIDE_W * scale,
        height: SLIDE_H * scale,
        background: BACKGROUNDS[slide.background] ?? BACKGROUNDS['solid-void'],
      }}
      onPointerDown={interactive ? () => onSelectElement?.(null) : undefined}
    >
      {/* Design-space layer — one transform, so children use raw coordinates. */}
      <div
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {[...slide.elements]
          .sort((a, b) => a.z - b.z)
          .map((el) => (
            <ElementView
              key={el.id}
              el={el}
              nodes={nodes}
              selected={selectedId === el.id}
              interactive={interactive}
              editing={interactive && editingId === el.id}
              onStartEdit={() => onStartEdit?.(el.id)}
              onCommitText={(text) => onCommitText?.(el.id, text)}
              onPointerDown={(e) => {
                if (!interactive) return
                e.stopPropagation()
                onSelectElement?.(el.id)
                onElementPointerDown?.(e, el)
              }}
            />
          ))}
      </div>
    </div>
  )
}

function ElementView({
  el,
  nodes,
  selected,
  interactive,
  editing,
  onStartEdit,
  onCommitText,
  onPointerDown,
}: {
  el: SlideElement
  nodes: GraphNode[]
  selected: boolean
  interactive: boolean
  editing: boolean
  onStartEdit: () => void
  onCommitText: (text: string) => void
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    cursor: interactive ? (selected ? 'move' : 'pointer') : 'default',
    outline: selected ? '2px solid #60A5FA' : undefined,
    outlineOffset: 2,
  }

  if (el.kind === 'text') {
    const type: React.CSSProperties = {
      color: el.color ?? '#EAF1FF',
      fontSize: el.fontSize ?? 18,
      fontWeight: el.fontWeight ?? 400,
      textAlign: el.align ?? 'left',
      fontFamily: FONTS[el.fontFamily ?? 'sans'],
      lineHeight: 1.4,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }
    if (editing) return <InlineText el={el} style={{ ...base, ...type, cursor: 'text' }} onCommit={onCommitText} />
    return (
      <div
        style={{ ...base, ...type, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}
        onPointerDown={onPointerDown}
        onDoubleClick={interactive ? onStartEdit : undefined}
      >
        {el.text || (interactive ? <span style={{ opacity: 0.4 }}>Klik dua kali untuk mengetik</span> : null)}
      </div>
    )
  }

  if (el.kind === 'shape') {
    return (
      <div
        style={{
          ...base,
          background: el.fill ?? '#3B82F6',
          border: el.stroke ? `2px solid ${el.stroke}` : undefined,
          borderRadius: el.radius ?? 0,
        }}
        onPointerDown={onPointerDown}
      />
    )
  }

  if (el.kind === 'image') {
    return (
      <div style={{ ...base, overflow: 'hidden', borderRadius: el.radius ?? 8 }} onPointerDown={onPointerDown}>
        {el.src ? (
          <img src={el.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              background: '#101A2E',
              border: '1px dashed #2B3D61',
              color: '#6A7FA3',
              fontSize: 12,
            }}
          >
            Image
          </div>
        )}
      </div>
    )
  }

  // entity — a live chip pulled from the case graph
  const node = nodes.find((n) => n.id === el.nodeId)
  if (!node) {
    return (
      <div
        style={{
          ...base,
          display: 'grid',
          placeItems: 'center',
          border: '1px dashed #2B3D61',
          borderRadius: 12,
          color: '#6A7FA3',
          fontSize: 12,
        }}
        onPointerDown={onPointerDown}
      >
        Entity removed from graph
      </div>
    )
  }

  const color = ENTITY_COLORS[node.kind]
  const Icon = ENTITY_ICONS[node.kind]

  return (
    <div
      style={{
        ...base,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        borderRadius: 12,
        background: `linear-gradient(150deg, ${withAlpha(color, 0.18)}, rgb(8 13 26 / 0.9))`,
        border: `1px solid ${withAlpha(color, 0.45)}`,
        boxShadow: `0 0 22px -8px ${withAlpha(color, 0.9)}`,
      }}
      onPointerDown={onPointerDown}
    >
      <span
        style={{
          width: 38,
          height: 38,
          flexShrink: 0,
          borderRadius: 9,
          display: 'grid',
          placeItems: 'center',
          background: withAlpha(color, 0.15),
          border: `1px solid ${withAlpha(color, 0.4)}`,
          color,
        }}
      >
        <Icon size={19} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: 'block',
            fontSize: 15,
            fontWeight: 600,
            color: '#EAF1FF',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {node.label}
        </span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color }}>{node.sublabel}</span>
      </span>
    </div>
  )
}

/**
 * A text element being typed into where it sits on the slide, in its own
 * type. The text is written back once, when the user leaves the box.
 */
function InlineText({
  el,
  style,
  onCommit,
}: {
  el: SlideElement
  style: React.CSSProperties
  onCommit: (text: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // Latest text and callback, so leaving by any route — blur, or the box
  // being taken away when the selection or slide changes — keeps the words.
  const value = useRef(el.text ?? '')
  const commit = useRef(onCommit)
  commit.current = onCommit
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    commit.current(value.current)
  }

  useEffect(() => () => finish(), [])

  // Grow with the text, never below the element's own height, so every line
  // stays in view while typing.
  const fit = () => {
    const t = ref.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.max(el.h, t.scrollHeight)}px`
  }

  useEffect(() => {
    const t = ref.current
    if (!t) return
    fit()
    t.focus()
    // A fresh box still holds its placeholder wording — select it so typing
    // replaces it. Otherwise carry on from the end.
    if (el.text === 'New text') t.select()
    else t.setSelectionRange(t.value.length, t.value.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <textarea
      ref={ref}
      defaultValue={el.text ?? ''}
      aria-label="Edit text"
      spellCheck={false}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        value.current = e.target.value
        fit()
      }}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      style={{
        ...style,
        background: 'rgb(96 165 250 / 0.06)',
        border: 'none',
        outline: '2px solid #60A5FA',
        outlineOffset: 2,
        padding: 0,
        margin: 0,
        resize: 'none',
        overflow: 'hidden',
        caretColor: '#60A5FA',
      }}
    />
  )
}

export const SlideView = memo(SlideViewImpl)
