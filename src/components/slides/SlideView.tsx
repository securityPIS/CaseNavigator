import { memo } from 'react'
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
  onPointerDown,
}: {
  el: SlideElement
  nodes: GraphNode[]
  selected: boolean
  interactive: boolean
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
    return (
      <div
        style={{
          ...base,
          color: el.color ?? '#EAF1FF',
          fontSize: el.fontSize ?? 18,
          fontWeight: el.fontWeight ?? 400,
          textAlign: el.align ?? 'left',
          fontFamily: FONTS[el.fontFamily ?? 'sans'],
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
        }}
        onPointerDown={onPointerDown}
      >
        {el.text}
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

export const SlideView = memo(SlideViewImpl)
