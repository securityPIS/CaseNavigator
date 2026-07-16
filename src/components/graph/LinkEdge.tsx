import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'
import type { EdgeKind } from '@/domain/types'
import { withAlpha } from '@/lib/utils'

export type LinkEdgeData = {
  kind: EdgeKind
  strength: number
  confirmed: boolean
  label?: string
  dimmed: boolean
  highlighted: boolean
}

export type LinkFlowEdge = Edge<LinkEdgeData, 'link'>

const EDGE_COLORS: Record<EdgeKind, string> = {
  associate: '#3B82F6',
  transaction: '#10B981',
  communication: '#8B5CF6',
  ownership: '#38BDF8',
  employment: '#22D3EE',
  presence: '#F59E0B',
  suspected: '#F43F5E',
}

/**
 * Bezier link. Confirmed relationships are solid with a travelling particle;
 * suspected ones are dashed and static — the dash carries the uncertainty, so
 * an investigator never mistakes an inference for a fact at a glance.
 */
function LinkEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<LinkFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.22,
  })

  const kind = data?.kind ?? 'associate'
  const strength = data?.strength ?? 0.5
  const confirmed = data?.confirmed ?? true
  const dimmed = data?.dimmed ?? false
  const highlighted = data?.highlighted ?? false
  const color = EDGE_COLORS[kind]

  const active = selected || highlighted
  const width = 1 + strength * 1.6 + (active ? 1.1 : 0)
  const opacity = dimmed ? 0.07 : active ? 0.95 : 0.34 + strength * 0.3

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: width,
          opacity,
          strokeDasharray: confirmed ? undefined : '5 5',
          filter: active ? `drop-shadow(0 0 6px ${withAlpha(color, 0.9)})` : undefined,
          transition: 'opacity 0.3s var(--ease-out-quint), stroke-width 0.2s var(--ease-out-quint)',
        }}
      />

      {/* Travelling particle — evidence flowing along a confirmed link. */}
      {confirmed && !dimmed && (
        <circle r={active ? 2.6 : 1.9} fill={color} opacity={active ? 1 : 0.75}>
          <animateMotion dur={`${3.6 - strength * 1.4}s`} repeatCount="indefinite" path={path} />
        </circle>
      )}

      {active && data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan animate-scale-in"
          >
            <span
              className="rounded-full border px-2 py-0.5 text-[9.5px] font-medium whitespace-nowrap backdrop-blur-md"
              style={{
                color,
                backgroundColor: 'rgb(6 11 24 / 0.92)',
                borderColor: withAlpha(color, 0.5),
              }}
            >
              {data.label}
              {!confirmed && ' (suspected)'}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const LinkEdge = memo(LinkEdgeImpl)
