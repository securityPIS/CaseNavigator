import { memo } from 'react'
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
import { ENTITY_COLORS, withAlpha } from '@/lib/utils'

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
}

export type EntityFlowNode = Node<EntityNodeData, 'entity'>

/** Regular hexagon, flat-top, as a CSS clip-path polygon. */
const HEX_CLIP = 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)'

/**
 * The focus node renders as a glowing circle with a portrait; every other
 * entity is a hexagon tinted by its kind. That asymmetry is the whole point —
 * you should be able to find the subject of a case in one glance.
 */
function EntityNodeImpl({ data, selected }: NodeProps<EntityFlowNode>) {
  const { entity, dimmed, highlighted } = data
  const color = ENTITY_COLORS[entity.kind]
  const Icon = ENTITY_ICONS[entity.kind]

  const opacity = dimmed ? 0.22 : 1
  const active = selected || highlighted

  if (entity.isFocus) {
    return (
      <div
        className="group relative flex flex-col items-center transition-opacity duration-300"
        style={{ opacity }}
      >
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />

        {/* Pulse rings — the case's centre of gravity. */}
        <span
          className="animate-pulse-ring pointer-events-none absolute left-1/2 top-[62px] size-[130px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ borderColor: withAlpha(color, 0.55) }}
        />
        <span
          className="animate-pulse-ring pointer-events-none absolute left-1/2 top-[62px] size-[130px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ borderColor: withAlpha(color, 0.4), animationDelay: '1.2s' }}
        />

        <div
          className="relative size-[124px] rounded-full p-[3px] transition-transform duration-250 ease-[var(--ease-spring)] group-hover:scale-[1.04]"
          style={{
            background: `conic-gradient(from 180deg, ${color}, ${withAlpha(color, 0.25)}, ${color})`,
            boxShadow: `0 0 ${active ? 54 : 34}px ${withAlpha(color, active ? 0.85 : 0.55)}`,
          }}
        >
          <div className="size-full overflow-hidden rounded-full bg-surface ring-2 ring-void/80">
            {entity.avatar ? (
              <img src={entity.avatar} alt="" className="size-full object-cover" draggable={false} />
            ) : (
              <span className="flex size-full items-center justify-center" style={{ color }}>
                <Icon size={44} />
              </span>
            )}
          </div>
        </div>

        <div className="mt-2.5 max-w-[150px] text-center">
          <p className="truncate text-[13px] font-semibold leading-tight text-ink drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
            {entity.label}
          </p>
          <p className="mt-0.5 truncate text-[10.5px] leading-tight text-ink-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            {entity.sublabel}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group relative transition-opacity duration-300"
      style={{ opacity }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div
        className="relative transition-transform duration-250 ease-[var(--ease-spring)] group-hover:scale-[1.07]"
        style={{ width: 116, height: 104 }}
      >
        {/* Border layer — the clip-path fill sits inset on top of it. */}
        <div
          className="absolute inset-0 transition-[filter] duration-250"
          style={{
            clipPath: HEX_CLIP,
            background: active ? color : withAlpha(color, 0.75),
            filter: `drop-shadow(0 0 ${active ? 18 : 9}px ${withAlpha(color, active ? 0.95 : 0.5)})`,
          }}
        />
        <div
          className="absolute transition-colors duration-250"
          style={{
            inset: 2,
            clipPath: HEX_CLIP,
            background: `linear-gradient(155deg, ${withAlpha(color, active ? 0.3 : 0.16)}, rgb(8 13 26 / 0.96) 62%)`,
            backdropFilter: 'blur(3px)',
          }}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4">
          <Icon size={21} style={{ color }} className="shrink-0 drop-shadow-[0_0_6px_currentColor]" />
          <div className="w-full text-center">
            <p className="truncate text-[10.5px] font-semibold leading-tight text-ink">{entity.label}</p>
            <p className="mt-px truncate text-[8.5px] leading-tight" style={{ color: withAlpha(color, 0.95) }}>
              {entity.sublabel}
            </p>
          </div>
        </div>

        {/* Risk pip — only where it earns the ink. */}
        {(entity.risk === 'high' || entity.risk === 'critical') && (
          <span
            className="absolute right-[13px] top-[9px] size-2 rounded-full ring-2 ring-void"
            style={{
              background: entity.risk === 'critical' ? '#EF4444' : '#F43F5E',
              boxShadow: `0 0 8px ${entity.risk === 'critical' ? '#EF4444' : '#F43F5E'}`,
            }}
            title={entity.risk === 'critical' ? 'Critical risk' : 'High risk'}
          />
        )}
      </div>
    </div>
  )
}

export const EntityNode = memo(EntityNodeImpl)
