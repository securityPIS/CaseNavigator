import { memo, useMemo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import {
  Banknote,
  Building2,
  Car,
  FileText,
  Laptop,
  Mail,
  MapPin,
  Shield,
  User,
  UserCheck,
} from 'lucide-react'
import type { EntityKind, GraphNode } from '@/domain/types'
import { cn, ENTITY_COLORS, ENTITY_LABELS, withAlpha } from '@/lib/utils'

export const ENTITY_ICONS: Record<EntityKind, typeof User> = {
  person: User,
  organization: Building2,
  location: MapPin,
  device: Laptop,
  document: FileText,
  communication: Mail,
  transaction: Banknote,
  vehicle: Car,
  witness: UserCheck,
  evidence: Shield,
}

export type EntityNodeData = {
  entity: GraphNode
  dimmed: boolean
  highlighted: boolean
  /** Resolved by the board — an uploaded evidence image or the entity avatar. */
  imageUrl?: string
}

export type EntityFlowNode = Node<EntityNodeData, 'entity'>

/** Stable small tilt per entity so every pinned card sits a little askew. */
function tiltFor(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return ((h % 1000) / 1000) * 7 - 3.5 // −3.5°..+3.5°
}

/**
 * An entity as a pinned Polaroid on the investigation board: a push-pin, a
 * photo (an uploaded image where one exists, otherwise a kind-tinted icon) and
 * a caption. The case's central entity gets a larger card and a SUBJECT tag so
 * it still reads as the centre of gravity at a glance. Hovering straightens and
 * lifts the card — like picking a photo off the board.
 */
function EntityNodeImpl({ data, selected }: NodeProps<EntityFlowNode>) {
  const { entity, dimmed, highlighted, imageUrl } = data
  const color = ENTITY_COLORS[entity.kind]
  const Icon = ENTITY_ICONS[entity.kind]

  const isFocus = !!entity.isFocus
  const active = selected || highlighted
  const opacity = dimmed ? 0.28 : 1
  const tilt = useMemo(() => tiltFor(entity.id), [entity.id])

  const width = isFocus ? 190 : 158
  const photoH = isFocus ? 138 : 106

  return (
    <div
      className="board-node group relative transition-opacity duration-300"
      style={{ width, opacity }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div
        className={cn('board-card', isFocus && 'is-focus', active && 'is-active')}
        style={
          {
            '--tilt': active ? '0deg' : `${tilt}deg`,
            '--accent': color,
          } as React.CSSProperties
        }
      >
        {/* Push-pin, coloured by entity kind so it doubles as the legend. */}
        <span
          className="board-pin"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${withAlpha(color, 0.95)}, ${color} 60%, ${withAlpha(color, 0.7)})`,
          }}
        />

        {/* Photo */}
        <div className="board-photo" style={{ height: photoH }}>
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" draggable={false} />
          ) : (
            <div
              className="flex size-full items-center justify-center"
              style={{
                background: `linear-gradient(150deg, ${withAlpha(color, 0.22)}, ${withAlpha(color, 0.06)} 70%, #ece8dc)`,
              }}
            >
              <Icon size={isFocus ? 48 : 34} style={{ color }} strokeWidth={1.6} />
            </div>
          )}
          {/* Kind colour stripe across the top of the photo. */}
          <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} />
        </div>

        {/* Caption */}
        <div className="board-caption">
          {isFocus && (
            <span className="board-subject" style={{ background: color }}>
              SUBJECT
            </span>
          )}
          <p className="board-label line-clamp-2">{entity.label}</p>
          <p className="board-sub truncate">{entity.sublabel}</p>
        </div>
      </div>

      {/* Risk pip — only where it earns the ink. */}
      {(entity.risk === 'high' || entity.risk === 'critical') && (
        <span
          className="board-risk"
          style={{
            background: entity.risk === 'critical' ? '#EF4444' : '#F43F5E',
            boxShadow: `0 0 8px ${entity.risk === 'critical' ? '#EF4444' : '#F43F5E'}`,
          }}
          title={entity.risk === 'critical' ? 'Critical risk' : 'High risk'}
        />
      )}

      {/* Kind label chip, tucked at the card's foot. */}
      <span
        className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: '#faf7ef', color }}
      >
        {ENTITY_LABELS[entity.kind]}
      </span>
    </div>
  )
}

export const EntityNode = memo(EntityNodeImpl)
