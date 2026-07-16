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
    curvature: 0.14,
  })

  const kind = data?.kind ?? 'associate'
  const strength = data?.strength ?? 0.5
  const confirmed = data?.confirmed ?? true
  const dimmed = data?.dimmed ?? false
  const highlighted = data?.highlighted ?? false
  const color = EDGE_COLORS[kind]

  const active = selected || highlighted
  // Reads as pinned yarn: thicker, round-capped, with a soft drop shadow so
  // the string sits above the corkboard rather than being etched into it.
  const width = 1.8 + strength * 2.2 + (active ? 1.4 : 0)
  const opacity = dimmed ? 0.08 : active ? 1 : 0.6 + strength * 0.3

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: width,
          strokeLinecap: 'round',
          opacity,
          strokeDasharray: confirmed ? undefined : '2 7',
          filter: active
            ? `drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.45)) drop-shadow(0 0 6px ${withAlpha(color, 0.85)})`
            : 'drop-shadow(0 1.5px 1.5px rgb(0 0 0 / 0.4))',
          transition: 'opacity 0.3s var(--ease-out-quint), stroke-width 0.2s var(--ease-out-quint)',
        }}
      />

      {active && data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) rotate(-2deg)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan animate-scale-in"
          >
            {/* A little paper note tacked to the string. */}
            <span
              className="whitespace-nowrap rounded-[3px] border px-2 py-0.5 text-[10px] font-semibold shadow-md"
              style={{
                color: '#2a2114',
                backgroundColor: '#fdf9ee',
                borderColor: withAlpha(color, 0.55),
                borderLeft: `3px solid ${color}`,
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
