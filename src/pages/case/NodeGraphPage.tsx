import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type NodeChange,
  type Viewport,
} from '@xyflow/react'
import {
  Crosshair,
  Filter,
  Focus,
  Maximize2,
  Minus,
  Plus,
  Search,
  Shapes,
  Waypoints,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { EntityKind } from '@/domain/types'
import { cn, ENTITY_COLORS, ENTITY_LABELS } from '@/lib/utils'
import { EntityNode, type EntityFlowNode } from '@/components/graph/EntityNode'
import { LinkEdge, type LinkFlowEdge } from '@/components/graph/LinkEdge'
import { NodeDetailPanel } from '@/components/graph/NodeDetailPanel'
import { BoardBackground } from '@/components/graph/BoardBackground'
import { useSession } from '@/stores/session'
import { EmptyState, IconButton, Input, Tooltip } from '@/components/ui/primitives'

const nodeTypes = { entity: EntityNode }
const edgeTypes = { link: LinkEdge }

export function NodeGraphPage() {
  return (
    <ReactFlowProvider>
      <GraphCanvas />
    </ReactFlowProvider>
  )
}

function GraphCanvas() {
  const { caseId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('node')
  const theme = useSession((s) => s.theme)

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [query, setQuery] = useState('')
  const [hiddenKinds, setHiddenKinds] = useState<Set<EntityKind>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { fitView, zoomIn, zoomOut, setCenter, getZoom } = useReactFlow()

  const entities = useLiveQuery(() => db.nodes.where('caseId').equals(caseId).toArray(), [caseId])
  const links = useLiveQuery(() => db.edges.where('caseId').equals(caseId).toArray(), [caseId], [])
  /** Uploaded images to pin on each card, keyed by node id. */
  const nodeImages = useNodeImages(caseId)

  const selected = useMemo(
    () => entities?.find((n) => n.id === selectedId) ?? null,
    [entities, selectedId],
  )

  const selectNode = useCallback(
    (id: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id) next.set('node', id)
          else next.delete('node')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  /** Neighbours of the selection — drives focus-mode dimming. */
  const neighbourIds = useMemo(() => {
    if (!selectedId) return null
    const ids = new Set<string>([selectedId])
    for (const e of links) {
      if (e.source === selectedId) ids.add(e.target)
      if (e.target === selectedId) ids.add(e.source)
    }
    return ids
  }, [links, selectedId])

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !entities) return null
    return new Set(
      entities.filter((n) => n.label.toLowerCase().includes(q) || n.sublabel.toLowerCase().includes(q)).map((n) => n.id),
    )
  }, [entities, query])

  /**
   * React Flow owns node state so it can record its own measurements — edge
   * paths are computed from `measured`, which only ever gets populated by
   * letting `onNodesChange` apply dimension changes. Dexie is the source of
   * truth for which nodes exist and where they sit; everything transient
   * (dimming, hover) is layered on at render time below.
   */
  const [baseNodes, setBaseNodes, onNodesChangeInternal] = useNodesState<EntityFlowNode>([])

  const visibleEntities = useMemo(
    () => (entities ?? []).filter((n) => !hiddenKinds.has(n.kind)),
    [entities, hiddenKinds],
  )

  useEffect(() => {
    setBaseNodes((prev) =>
      visibleEntities.map((n) => {
        const existing = prev.find((p) => p.id === n.id)
        // Spread the existing node so measurements and drag positions survive.
        return existing
          ? { ...existing, data: { ...existing.data, entity: n } }
          : {
              id: n.id,
              type: 'entity' as const,
              position: { x: n.x, y: n.y },
              data: { entity: n, dimmed: false, highlighted: false },
            }
      }),
    )
  }, [visibleEntities, setBaseNodes])

  const flowNodes = useMemo<EntityFlowNode[]>(
    () =>
      baseNodes.map((n) => {
        const searchDim = searchHits !== null && !searchHits.has(n.id)
        const focusDim = focusMode && neighbourIds !== null && !neighbourIds.has(n.id)
        return {
          ...n,
          selected: n.id === selectedId,
          data: {
            ...n.data,
            dimmed: searchDim || focusDim,
            highlighted: (searchHits?.has(n.id) ?? false) || hoveredId === n.id,
            // An uploaded evidence image wins over the generated avatar.
            imageUrl: nodeImages[n.id] ?? n.data.entity.avatar,
          },
        }
      }),
    [baseNodes, searchHits, focusMode, neighbourIds, selectedId, hoveredId, nodeImages],
  )

  const flowEdges = useMemo<LinkFlowEdge[]>(() => {
    const visible = new Set(flowNodes.map((n) => n.id))
    return links
      .filter((e) => visible.has(e.source) && visible.has(e.target))
      .map((e) => {
        const touchesSelection = e.source === selectedId || e.target === selectedId
        const focusDim = focusMode && selectedId !== null && !touchesSelection
        const searchDim = searchHits !== null && !searchHits.has(e.source) && !searchHits.has(e.target)
        return {
          id: e.id,
          type: 'link' as const,
          source: e.source,
          target: e.target,
          data: {
            kind: e.kind,
            strength: e.strength,
            confirmed: e.confirmed,
            label: e.label,
            dimmed: focusDim || searchDim,
            highlighted: touchesSelection || e.source === hoveredId || e.target === hoveredId,
          },
        }
      })
  }, [links, flowNodes, selectedId, focusMode, searchHits, hoveredId])

  /** Let React Flow apply every change, then persist finished drags to Dexie. */
  const onNodesChange = useCallback(
    (changes: NodeChange<EntityFlowNode>[]) => {
      onNodesChangeInternal(changes)
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position && !ch.dragging) {
          db.nodes.update(ch.id, { x: ch.position.x, y: ch.position.y })
        }
      }
    },
    [onNodesChangeInternal],
  )

  /**
   * Centre on a node that arrives via ?node= from somewhere else — the command
   * palette, a mail link, an evidence link. A click on the canvas is skipped:
   * the node is already on screen and yanking the viewport under the cursor is
   * disorienting.
   */
  const centeredFor = useRef<string | null>(null)
  const cameFromCanvas = useRef(false)

  useEffect(() => {
    if (!selected || centeredFor.current === selected.id) return
    centeredFor.current = selected.id
    if (cameFromCanvas.current) {
      cameFromCanvas.current = false
      return
    }
    const t = setTimeout(() => {
      setCenter(selected.x + 58, selected.y + 52, { zoom: Math.max(getZoom(), 0.85), duration: 600 })
    }, 60)
    return () => clearTimeout(t)
  }, [selected, setCenter, getZoom])

  useEffect(() => {
    if (!entities?.length) return
    const t = setTimeout(() => fitView({ padding: 0.22, duration: 700, maxZoom: 1.1 }), 120)
    return () => clearTimeout(t)
  }, [caseId, entities?.length, fitView])

  const toggleKind = (k: EntityKind) =>
    setHiddenKinds((prev) => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })

  const presentKinds = useMemo(() => {
    const set = new Set<EntityKind>()
    for (const n of entities ?? []) set.add(n.kind)
    return [...set]
  }, [entities])

  const enterFullscreen = () => {
    if (!document.fullscreenElement) wrapRef.current?.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  if (entities && entities.length === 0) {
    return (
      <EmptyState
        icon={<Shapes size={22} />}
        title="Board is empty"
        description="This case has no entities pinned yet. Add people, organisations, documents and transactions to start mapping the relationships on the board."
      />
    )
  }

  return (
    <div ref={wrapRef} className="relative flex h-full gap-3 p-3">
      {/* Canvas */}
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-[var(--radius-card)] border border-line ring-1 ring-tint/4">
        {/* Corkboard surface — light tan in light mode, dark cork in dark. */}
        <BoardBackground theme={theme} />

        <ReactFlow<EntityFlowNode, LinkFlowEdge>
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onMove={(_, vp) => setViewport(vp)}
          onNodeClick={(_, n) => {
            cameFromCanvas.current = true
            selectNode(n.id)
          }}
          onNodeMouseEnter={(_, n) => setHoveredId(n.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          onPaneClick={() => selectNode(null)}
          minZoom={0.2}
          maxZoom={2.2}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          elementsSelectable
          className="relative z-1"
          defaultEdgeOptions={{ type: 'link' }}
        />

        {/* Left toolbar */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
          <div className="glass-strong flex flex-col gap-0.5 rounded-xl p-1 shadow-[var(--shadow-panel)]">
            <Tooltip label="Filter entities" side="right">
              <IconButton label="Filter entities" size={30} active={filterOpen || hiddenKinds.size > 0} onClick={() => setFilterOpen((v) => !v)}>
                <Filter size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Zoom in" side="right">
              <IconButton label="Zoom in" size={30} onClick={() => zoomIn({ duration: 200 })}>
                <Plus size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Zoom out" side="right">
              <IconButton label="Zoom out" size={30} onClick={() => zoomOut({ duration: 200 })}>
                <Minus size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Fit to view" side="right">
              <IconButton label="Fit to view" size={30} onClick={() => fitView({ padding: 0.22, duration: 500 })}>
                <Crosshair size={14} />
              </IconButton>
            </Tooltip>
          </div>

          <div className="glass-strong flex flex-col gap-0.5 rounded-xl p-1 shadow-[var(--shadow-panel)]">
            <Tooltip label={focusMode ? 'Focus mode on — dims unrelated entities' : 'Focus mode off'} side="right">
              <IconButton label="Toggle focus mode" size={30} active={focusMode} onClick={() => setFocusMode((v) => !v)}>
                <Focus size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Fullscreen" side="right">
              <IconButton label="Fullscreen" size={30} onClick={enterFullscreen}>
                <Maximize2 size={14} />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {/* Filter popover */}
        {filterOpen && (
          <div className="glass-strong absolute left-[54px] top-3 z-20 w-[212px] rounded-xl p-3 shadow-[var(--shadow-panel)] animate-scale-in origin-top-left">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">Entity Types</h3>
              <IconButton label="Close filters" size={20} onClick={() => setFilterOpen(false)}>
                <X size={12} />
              </IconButton>
            </div>
            <div className="space-y-0.5">
              {presentKinds.map((k) => {
                const on = !hiddenKinds.has(k)
                const color = ENTITY_COLORS[k]
                const count = entities?.filter((n) => n.kind === k).length ?? 0
                return (
                  <button
                    key={k}
                    onClick={() => toggleKind(k)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-tint/6"
                  >
                    <span
                      className={cn('size-2.5 shrink-0 rounded-full transition-opacity', !on && 'opacity-25')}
                      style={{ background: color, boxShadow: on ? `0 0 7px ${color}` : undefined }}
                    />
                    <span className={cn('flex-1 text-left text-[11.5px] transition-colors', on ? 'text-ink-2' : 'text-ink-4 line-through')}>
                      {ENTITY_LABELS[k]}
                    </span>
                    <span className="text-[10px] text-ink-4 tnum">{count}</span>
                  </button>
                )
              })}
            </div>
            {hiddenKinds.size > 0 && (
              <button
                onClick={() => setHiddenKinds(new Set())}
                className="mt-2 w-full rounded-lg border border-line py-1.5 text-[11px] text-ink-3 transition-colors hover:border-brand/40 hover:text-brand-bright"
              >
                Show all
              </button>
            )}
          </div>
        )}

        {/* Search */}
        <div className="absolute left-1/2 top-3 z-10 w-[260px] -translate-x-1/2">
          <Input
            icon={<Search size={13} />}
            placeholder="Find in graph…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 border-tint/8 bg-void/80 text-[12px] backdrop-blur-xl"
            suffix={
              query ? (
                <button onClick={() => setQuery('')} className="pointer-events-auto text-ink-4 hover:text-ink" aria-label="Clear search">
                  <X size={12} />
                </button>
              ) : undefined
            }
          />
          {searchHits && (
            <p className="mt-1.5 text-center text-[10.5px] text-ink-4 tnum">
              {searchHits.size} of {entities?.length ?? 0} entities match
            </p>
          )}
        </div>

        {/* Legend */}
        <div className="glass-strong absolute bottom-3 left-3 z-10 hidden rounded-xl px-3.5 py-2.5 shadow-[var(--shadow-panel)] md:block">
          <div className="grid grid-cols-5 gap-x-4 gap-y-1.5">
            {(Object.keys(ENTITY_COLORS) as EntityKind[]).map((k) => (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                className={cn(
                  'flex items-center gap-1.5 transition-opacity',
                  hiddenKinds.has(k) ? 'opacity-30' : 'hover:opacity-75',
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: ENTITY_COLORS[k], boxShadow: `0 0 6px ${ENTITY_COLORS[k]}` }}
                />
                <span className="text-[10px] text-ink-2">{ENTITY_LABELS[k]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats pill — carries the zoom read-out that used to sit under the
            overview minimap. */}
        <div className="glass-strong absolute right-3 top-3 z-10 flex items-center gap-3 rounded-xl px-3 py-2 shadow-[var(--shadow-panel)]">
          <span className="flex items-center gap-1.5 text-[10.5px] text-ink-2">
            <Shapes size={11} className="text-brand-bright" />
            <span className="tnum">{flowNodes.length}</span> entities
          </span>
          <span className="h-3 w-px bg-line" />
          <span className="flex items-center gap-1.5 text-[10.5px] text-ink-2">
            <Waypoints size={11} className="text-entity-transaction" />
            <span className="tnum">{flowEdges.length}</span> links
          </span>
          <span className="hidden h-3 w-px bg-line lg:block" />
          <span className="hidden text-[10.5px] text-ink-3 tnum lg:inline">{Math.round(viewport.zoom * 100)}%</span>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="hidden w-[380px] shrink-0 lg:block xl:w-[420px]">
          <NodeDetailPanel node={selected} onClose={() => selectNode(null)} onSelectNode={selectNode} />
        </div>
      )}

      {/* Mobile sheet */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-30 max-h-[72dvh] lg:hidden">
          <div className="mx-2 mb-2 h-full overflow-hidden rounded-2xl shadow-[var(--shadow-panel)]">
            <NodeDetailPanel node={selected} onClose={() => selectNode(null)} onSelectNode={selectNode} />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Resolves an uploaded image to pin on each entity's card. An entity picks up
 * the first image-kind evidence linked to it that carries a stored blob, turned
 * into an object URL. Entities with no uploaded image fall back to their avatar
 * (handled by the caller). Object URLs are revoked when the set changes.
 */
function useNodeImages(caseId: string): Record<string, string> {
  const evidence = useLiveQuery(
    () => db.evidence.where('caseId').equals(caseId).toArray(),
    [caseId],
    [],
  )

  // node id → blob id of the first uploaded image linked to that node.
  const nodeBlob = useMemo(() => {
    const map: Record<string, string> = {}
    for (const e of evidence) {
      if (!e.blobId) continue
      const isImage = e.kind === 'image' || (e.mime?.startsWith('image/') ?? false)
      if (!isImage) continue
      for (const nid of e.linkedNodeIds) if (!(nid in map)) map[nid] = e.blobId
    }
    return map
  }, [evidence])

  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const created: string[] = []
    const out: Record<string, string> = {}

    Promise.all(
      Object.entries(nodeBlob).map(async ([nid, bid]) => {
        const rec = await db.blobs.get(bid)
        if (cancelled || !rec) return
        const url = URL.createObjectURL(rec.data)
        created.push(url)
        out[nid] = url
      }),
    ).then(() => {
      if (cancelled) {
        created.forEach(URL.revokeObjectURL)
      } else {
        setUrls(out)
      }
    })

    return () => {
      cancelled = true
      created.forEach(URL.revokeObjectURL)
    }
  }, [nodeBlob])

  return urls
}

