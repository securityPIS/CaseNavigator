import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  Bold,
  ChevronDown,
  Copy,
  Image as ImageIcon,
  Layers,
  Play,
  Plus,
  Presentation,
  Shapes,
  Square,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { GraphNode, Slide, SlideElement, SlideLayout } from '@/domain/types'
import { cn, ENTITY_COLORS, uid } from '@/lib/utils'
import { BACKGROUNDS, SLIDE_H, SLIDE_W, SlideView } from '@/components/slides/SlideView'
import { Button, EmptyState, IconButton, Input, Select, Textarea, Tooltip } from '@/components/ui/primitives'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { toast } from '@/stores/toast'

const LAYOUT_LABELS: Record<SlideLayout, string> = {
  title: 'Title',
  'title-content': 'Title + Content',
  'two-column': 'Two Column',
  section: 'Section Break',
  blank: 'Blank',
}

const TEXT_COLORS = ['#EAF1FF', '#9DB0D0', '#60A5FA', '#10B981', '#F59E0B', '#F43F5E', '#A855F7', '#060B18']

export function ChallengePage() {
  const { caseId = '' } = useParams()

  const deck = useLiveQuery(() => db.decks.where('caseId').equals(caseId).first(), [caseId])
  const slides = useLiveQuery(
    () => db.slides.where('caseId').equals(caseId).sortBy('index'),
    [caseId],
    [],
  )
  const nodes = useLiveQuery(() => db.nodes.where('caseId').equals(caseId).toArray(), [caseId], [])

  const [current, setCurrent] = useState(0)
  const [selectedEl, setSelectedEl] = useState<string | null>(null)
  const [presenting, setPresenting] = useState(false)
  const [notesOpen, setNotesOpen] = useState(true)
  const [scale, setScale] = useState(0.6)
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  const slide = slides[current] as Slide | undefined
  const element = slide?.elements.find((e) => e.id === selectedEl) ?? null

  // Keep the canvas as large as the pane allows without ever clipping it.
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const fit = () => {
      const pad = 48
      const s = Math.min((el.clientWidth - pad) / SLIDE_W, (el.clientHeight - pad) / SLIDE_H)
      setScale(Math.max(0.25, Math.min(s, 1.1)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [notesOpen])

  useEffect(() => setSelectedEl(null), [current])

  useEffect(() => {
    if (current >= slides.length && slides.length > 0) setCurrent(slides.length - 1)
  }, [slides.length, current])

  /* ------------------------------------------------------------ Mutations */

  const patchSlide = useCallback(
    async (id: string, patch: Partial<Slide>) => {
      await db.slides.update(id, patch)
      if (deck) await db.decks.update(deck.id, { updatedAt: new Date().toISOString() })
    },
    [deck],
  )

  const patchElement = useCallback(
    async (elId: string, patch: Partial<SlideElement>) => {
      if (!slide) return
      const next = slide.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e))
      await patchSlide(slide.id, { elements: next })
    },
    [slide, patchSlide],
  )

  const addElement = useCallback(
    async (kind: SlideElement['kind'], extra: Partial<SlideElement> = {}) => {
      if (!slide) return
      const maxZ = slide.elements.reduce((m, e) => Math.max(m, e.z), 0)
      const el: SlideElement = {
        id: uid('el'),
        kind,
        x: 120,
        y: 200,
        w: kind === 'text' ? 400 : kind === 'entity' ? 250 : 200,
        h: kind === 'text' ? 60 : kind === 'entity' ? 96 : 120,
        z: maxZ + 1,
        ...(kind === 'text' && { text: 'New text', fontSize: 22, color: '#EAF1FF', align: 'left', fontFamily: 'sans', fontWeight: 400 }),
        ...(kind === 'shape' && { fill: '#3B82F6', radius: 8 }),
        ...extra,
      }
      await patchSlide(slide.id, { elements: [...slide.elements, el] })
      setSelectedEl(el.id)
    },
    [slide, patchSlide],
  )

  const deleteElement = useCallback(
    async (elId: string) => {
      if (!slide) return
      await patchSlide(slide.id, { elements: slide.elements.filter((e) => e.id !== elId) })
      setSelectedEl(null)
    },
    [slide, patchSlide],
  )

  const duplicateElement = useCallback(
    async (elId: string) => {
      if (!slide) return
      const src = slide.elements.find((e) => e.id === elId)
      if (!src) return
      const maxZ = slide.elements.reduce((m, e) => Math.max(m, e.z), 0)
      const copy = { ...src, id: uid('el'), x: src.x + 20, y: src.y + 20, z: maxZ + 1 }
      await patchSlide(slide.id, { elements: [...slide.elements, copy] })
      setSelectedEl(copy.id)
    },
    [slide, patchSlide],
  )

  const addSlide = useCallback(
    async (layout: SlideLayout = 'title-content') => {
      if (!deck) return
      const index = current + 1
      // Shift everything after the insertion point down one.
      await Promise.all(
        slides.filter((s) => s.index >= index).map((s) => db.slides.update(s.id, { index: s.index + 1 })),
      )
      const id = uid('slide')
      const elements: SlideElement[] =
        layout === 'blank'
          ? []
          : [
              {
                id: uid('el'),
                kind: 'text',
                text: layout === 'section' ? 'Section' : 'Slide title',
                x: 70,
                y: layout === 'section' ? 230 : 60,
                w: 800,
                h: 60,
                fontSize: layout === 'section' ? 42 : 36,
                fontWeight: layout === 'section' ? 700 : 600,
                color: '#EAF1FF',
                align: 'left',
                fontFamily: 'sans',
                z: 1,
              },
            ]
      if (layout === 'title-content') {
        elements.push({
          id: uid('el'),
          kind: 'text',
          text: '• First point\n\n• Second point',
          x: 70,
          y: 145,
          w: 820,
          h: 280,
          fontSize: 21,
          color: '#9DB0D0',
          align: 'left',
          fontFamily: 'sans',
          fontWeight: 400,
          z: 2,
        })
      }

      await db.slides.add({
        id,
        caseId,
        deckId: deck.id,
        index,
        layout,
        background: layout === 'section' ? 'gradient-midnight' : 'solid-void',
        elements,
        notes: '',
      })
      await db.decks.update(deck.id, { updatedAt: new Date().toISOString() })
      setCurrent(index)
      toast.success('Slide added', `${LAYOUT_LABELS[layout]} slide inserted at position ${index + 1}.`)
    },
    [deck, slides, current, caseId],
  )

  const deleteSlide = useCallback(
    async (id: string) => {
      if (slides.length <= 1) {
        toast.error('Cannot delete', 'A deck needs at least one slide.')
        return
      }
      const target = slides.find((s) => s.id === id)
      if (!target) return
      await db.slides.delete(id)
      await Promise.all(
        slides.filter((s) => s.index > target.index).map((s) => db.slides.update(s.id, { index: s.index - 1 })),
      )
      setCurrent((c) => Math.max(0, Math.min(c, slides.length - 2)))
    },
    [slides],
  )

  const moveSlide = useCallback(
    async (from: number, to: number) => {
      if (to < 0 || to >= slides.length) return
      const reordered = [...slides]
      const [moved] = reordered.splice(from, 1)
      reordered.splice(to, 0, moved)
      await Promise.all(reordered.map((s, i) => db.slides.update(s.id, { index: i })))
      setCurrent(to)
    },
    [slides],
  )

  /* ------------------------------------------------- Drag / resize on canvas */

  const dragState = useRef<{
    id: string
    mode: 'move' | 'resize'
    startX: number
    startY: number
    origin: { x: number; y: number; w: number; h: number }
  } | null>(null)

  const onElementPointerDown = (e: React.PointerEvent, el: SlideElement) => {
    if (presenting) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragState.current = {
      id: el.id,
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origin: { x: el.x, y: el.y, w: el.w, h: el.h },
    }
  }

  const onResizePointerDown = (e: React.PointerEvent) => {
    if (!element) return
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragState.current = {
      id: element.id,
      mode: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      origin: { x: element.x, y: element.y, w: element.w, h: element.h },
    }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = dragState.current
      if (!st || !slide) return
      const dx = (e.clientX - st.startX) / scale
      const dy = (e.clientY - st.startY) / scale

      if (st.mode === 'move') {
        const x = Math.round(Math.max(-40, Math.min(st.origin.x + dx, SLIDE_W - 20)))
        const y = Math.round(Math.max(-40, Math.min(st.origin.y + dy, SLIDE_H - 20)))
        patchElement(st.id, { x, y })
      } else {
        const w = Math.round(Math.max(40, st.origin.w + dx))
        const h = Math.round(Math.max(24, st.origin.h + dy))
        patchElement(st.id, { w, h })
      }
    }
    const onUp = () => {
      dragState.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [slide, scale, patchElement])

  /* ------------------------------------------------------------ Shortcuts */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.matches('input, textarea, [contenteditable="true"]')
      if (typing) return

      if (presenting) {
        if (e.key === 'ArrowRight' || e.key === ' ') setCurrent((c) => Math.min(c + 1, slides.length - 1))
        if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(c - 1, 0))
        if (e.key === 'Escape') setPresenting(false)
        return
      }

      if (selectedEl && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        deleteElement(selectedEl)
      }
      if (selectedEl && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateElement(selectedEl)
      }
      // Nudge with arrows; hold shift for coarse steps.
      if (selectedEl && element && e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const map: Record<string, Partial<SlideElement>> = {
          ArrowUp: { y: element.y - step },
          ArrowDown: { y: element.y + step },
          ArrowLeft: { x: element.x - step },
          ArrowRight: { x: element.x + step },
        }
        patchElement(selectedEl, map[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [presenting, slides.length, selectedEl, element, deleteElement, duplicateElement, patchElement])

  useEffect(() => {
    if (!presenting) return
    document.documentElement.requestFullscreen?.().catch(() => undefined)
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined)
    }
  }, [presenting])

  if (deck === undefined) return <PageSpinner />
  if (!deck || slides.length === 0) {
    return (
      <EmptyState
        icon={<Presentation size={22} />}
        title="No deck yet"
        description="This case has no challenge session deck. Decks are seeded for CN-2026-014 in this build."
      />
    )
  }

  /* -------------------------------------------------------- Present mode */

  if (presenting && slide) {
    return (
      <div className="fixed inset-0 z-200 flex flex-col items-center justify-center bg-black">
        <PresentSlide slide={slide} nodes={nodes} />
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-tint/8 px-3 py-2 backdrop-blur-md">
          <IconButton label="Previous" size={30} disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
            <ArrowLeft size={15} />
          </IconButton>
          <span className="text-[12px] text-tint/70 tnum">
            {current + 1} / {slides.length}
          </span>
          <IconButton label="Next" size={30} disabled={current === slides.length - 1} onClick={() => setCurrent((c) => c + 1)}>
            <ArrowRight size={15} />
          </IconButton>
          <span className="h-4 w-px bg-tint/20" />
          <IconButton label="Exit presentation" size={30} onClick={() => setPresenting(false)}>
            <X size={15} />
          </IconButton>
        </div>
      </div>
    )
  }

  /* -------------------------------------------------------------- Editor */

  return (
    <div className="flex h-full flex-col">
      {/* Ribbon */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line-soft px-4 py-2">
        <div className="flex items-center gap-1 pr-2">
          <AddSlideMenu onAdd={addSlide} />
          <Tooltip label="Duplicate slide">
            <IconButton
              label="Duplicate slide"
              onClick={async () => {
                if (!slide) return
                const index = current + 1
                await Promise.all(
                  slides.filter((s) => s.index >= index).map((s) => db.slides.update(s.id, { index: s.index + 1 })),
                )
                await db.slides.add({
                  ...slide,
                  id: uid('slide'),
                  index,
                  elements: slide.elements.map((e) => ({ ...e, id: uid('el') })),
                })
                setCurrent(index)
              }}
            >
              <Copy size={15} />
            </IconButton>
          </Tooltip>
        </div>

        <span className="h-5 w-px bg-line" />

        <div className="flex items-center gap-1 px-2">
          <Tooltip label="Add text box">
            <IconButton label="Add text" onClick={() => addElement('text')}>
              <Type size={15} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Add shape">
            <IconButton label="Add shape" onClick={() => addElement('shape')}>
              <Square size={15} />
            </IconButton>
          </Tooltip>
          <ImageButton onAdd={(src) => addElement('image', { src, w: 320, h: 200 })} />
          <EntityMenu nodes={nodes} onAdd={(nodeId) => addElement('entity', { nodeId })} />
        </div>

        <span className="h-5 w-px bg-line" />

        <div className="flex items-center gap-2 px-2">
          <span className="text-[11px] text-ink-4">Layout</span>
          <div className="w-[130px]">
            <Select
              className="h-7 text-[11.5px]"
              value={slide?.layout ?? 'blank'}
              onChange={(e) => slide && patchSlide(slide.id, { layout: e.target.value as SlideLayout })}
              options={Object.entries(LAYOUT_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>

          <span className="ml-1 text-[11px] text-ink-4">Background</span>
          <div className="flex items-center gap-1">
            {Object.keys(BACKGROUNDS).map((bg) => (
              <button
                key={bg}
                onClick={() => slide && patchSlide(slide.id, { background: bg })}
                aria-label={bg}
                title={bg}
                className={cn(
                  'size-5 rounded-md border transition-transform hover:scale-110',
                  slide?.background === bg ? 'border-brand-bright ring-1 ring-brand/50' : 'border-line',
                )}
                style={{ background: BACKGROUNDS[bg] }}
              />
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden text-[11px] text-ink-4 lg:block tnum">{slides.length} slides</span>
          <Button size="sm" variant="ghost" icon={<Layers size={13} />} onClick={() => setNotesOpen((v) => !v)}>
            Notes
          </Button>
          <Button size="sm" variant="primary" icon={<Play size={13} />} onClick={() => setPresenting(true)}>
            Present
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Thumbnails */}
        <div className="hidden w-[172px] shrink-0 flex-col border-r border-line-soft md:flex">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
            {slides.map((s, i) => (
              <div key={s.id} className="group relative">
                <button
                  onClick={() => setCurrent(i)}
                  className={cn(
                    'block w-full overflow-hidden rounded-lg border-2 transition-all duration-150',
                    i === current ? 'border-brand shadow-[0_0_16px_-4px_rgb(59_130_246/0.8)]' : 'border-line hover:border-line-strong',
                  )}
                >
                  <SlideView slide={s} nodes={nodes} scale={148 / SLIDE_W} />
                </button>
                <span className="absolute -left-0.5 top-1 rounded bg-void/85 px-1 text-[9px] text-ink-3 tnum backdrop-blur-sm">
                  {i + 1}
                </span>
                <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => moveSlide(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Move slide up"
                    className="flex size-4 items-center justify-center rounded bg-void/85 text-ink-3 backdrop-blur-sm hover:text-ink disabled:opacity-30"
                  >
                    <ChevronDown size={9} className="rotate-180" />
                  </button>
                  <button
                    onClick={() => moveSlide(i, i + 1)}
                    disabled={i === slides.length - 1}
                    aria-label="Move slide down"
                    className="flex size-4 items-center justify-center rounded bg-void/85 text-ink-3 backdrop-blur-sm hover:text-ink disabled:opacity-30"
                  >
                    <ChevronDown size={9} />
                  </button>
                  <button
                    onClick={() => deleteSlide(s.id)}
                    aria-label="Delete slide"
                    className="flex size-4 items-center justify-center rounded bg-void/85 text-ink-3 backdrop-blur-sm hover:text-danger"
                  >
                    <X size={9} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => addSlide()}
            className="m-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong py-2.5 text-[11.5px] text-ink-3 transition-colors hover:border-brand/50 hover:text-brand-bright"
          >
            <Plus size={13} /> New slide
          </button>
        </div>

        {/* Canvas */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={canvasWrapRef} className="grid-lines relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-abyss/45 p-6">
            {slide && (
              <div className="relative shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]">
                <SlideView
                  slide={slide}
                  nodes={nodes}
                  scale={scale}
                  interactive
                  selectedId={selectedEl}
                  onSelectElement={setSelectedEl}
                  onElementPointerDown={onElementPointerDown}
                />
                {/* Resize handle for the current selection */}
                {element && (
                  <div
                    onPointerDown={onResizePointerDown}
                    className="absolute z-10 size-3 cursor-nwse-resize rounded-sm border-2 border-brand-bright bg-void"
                    style={{
                      left: (element.x + element.w) * scale - 6,
                      top: (element.y + element.h) * scale - 6,
                    }}
                  />
                )}
              </div>
            )}

            <span className="absolute bottom-2 right-3 text-[10px] text-ink-4 tnum">{Math.round(scale * 100)}%</span>
          </div>

          {/* Notes */}
          {notesOpen && slide && (
            <div className="shrink-0 border-t border-line-soft p-3">
              <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">
                Speaker notes — slide {current + 1}
              </label>
              <Textarea
                rows={3}
                placeholder="What you'll actually say. Panels read the slide; they listen to you."
                value={slide.notes}
                onChange={(e) => patchSlide(slide.id, { notes: e.target.value })}
                className="text-[12px]"
              />
            </div>
          )}
        </div>

        {/* Inspector */}
        <div className="hidden w-[228px] shrink-0 overflow-y-auto border-l border-line-soft p-3 lg:block">
          {element ? (
            <ElementInspector
              el={element}
              onPatch={(p) => patchElement(element.id, p)}
              onDelete={() => deleteElement(element.id)}
              onDuplicate={() => duplicateElement(element.id)}
            />
          ) : (
            <div className="pt-6 text-center">
              <Shapes size={20} className="mx-auto text-ink-4" />
              <p className="mt-2.5 text-[12px] font-medium text-ink-2">Nothing selected</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-4">
                Click an element on the slide to edit it, or add one from the toolbar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- Inspector */

function ElementInspector({
  el,
  onPatch,
  onDelete,
  onDuplicate,
}: {
  el: SlideElement
  onPatch: (p: Partial<SlideElement>) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
          {el.kind} element
        </h3>
        <div className="flex gap-0.5">
          <IconButton label="Duplicate" size={24} onClick={onDuplicate}>
            <Copy size={12} />
          </IconButton>
          <IconButton label="Delete" size={24} onClick={onDelete} className="hover:text-danger">
            <Trash2 size={12} />
          </IconButton>
        </div>
      </div>

      {el.kind === 'text' && (
        <>
          <Label>Text</Label>
          <Textarea rows={4} value={el.text ?? ''} onChange={(e) => onPatch({ text: e.target.value })} className="text-[12px]" />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Size</Label>
              <Input
                type="number"
                min={8}
                max={96}
                value={el.fontSize ?? 18}
                onChange={(e) => onPatch({ fontSize: Number(e.target.value) })}
                className="h-8 text-[12px]"
              />
            </div>
            <div>
              <Label>Font</Label>
              <Select
                className="h-8 text-[12px]"
                value={el.fontFamily ?? 'sans'}
                onChange={(e) => onPatch({ fontFamily: e.target.value as 'sans' | 'serif' | 'mono' })}
                options={[
                  { value: 'sans', label: 'Sans' },
                  { value: 'serif', label: 'Serif' },
                  { value: 'mono', label: 'Mono' },
                ]}
              />
            </div>
          </div>

          <div>
            <Label>Style</Label>
            <div className="flex gap-1">
              <IconButton
                label="Bold"
                size={28}
                active={(el.fontWeight ?? 400) >= 600}
                onClick={() => onPatch({ fontWeight: (el.fontWeight ?? 400) >= 600 ? 400 : 700 })}
              >
                <Bold size={13} />
              </IconButton>
              <span className="mx-1 w-px bg-line" />
              {([
                ['left', AlignLeft],
                ['center', AlignCenter],
                ['right', AlignRight],
              ] as const).map(([a, Icon]) => (
                <IconButton key={a} label={`Align ${a}`} size={28} active={(el.align ?? 'left') === a} onClick={() => onPatch({ align: a })}>
                  <Icon size={13} />
                </IconButton>
              ))}
            </div>
          </div>

          <div>
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onPatch({ color: c })}
                  aria-label={c}
                  className={cn(
                    'size-6 rounded-md border transition-transform hover:scale-110',
                    el.color === c ? 'border-brand-bright ring-1 ring-brand/50' : 'border-line',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {el.kind === 'shape' && (
        <>
          <div>
            <Label>Fill</Label>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onPatch({ fill: c })}
                  aria-label={c}
                  className={cn(
                    'size-6 rounded-md border transition-transform hover:scale-110',
                    el.fill === c ? 'border-brand-bright ring-1 ring-brand/50' : 'border-line',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Corner radius</Label>
            <Input
              type="number"
              min={0}
              max={200}
              value={el.radius ?? 0}
              onChange={(e) => onPatch({ radius: Number(e.target.value) })}
              className="h-8 text-[12px]"
            />
          </div>
        </>
      )}

      <div>
        <Label>Position &amp; size</Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['x', 'X'],
            ['y', 'Y'],
            ['w', 'W'],
            ['h', 'H'],
          ] as const).map(([k, label]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-3 text-[10px] text-ink-4">{label}</span>
              <Input
                type="number"
                value={Math.round(el[k])}
                onChange={(e) => onPatch({ [k]: Number(e.target.value) } as Partial<SlideElement>)}
                className="h-7 text-[11px]"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[10.5px] font-medium text-ink-3">{children}</span>
}

/* -------------------------------------------------------------- Menus */

function AddSlideMenu({ onAdd }: { onAdd: (l: SlideLayout) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={() => setOpen((v) => !v)}>
        Slide
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <div className="glass-strong absolute left-0 top-[calc(100%+6px)] z-50 w-[178px] rounded-xl p-1.5 shadow-[var(--shadow-panel)] animate-scale-in origin-top-left">
          {(Object.keys(LAYOUT_LABELS) as SlideLayout[]).map((l) => (
            <button
              key={l}
              onClick={() => {
                onAdd(l)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] text-ink-2 transition-colors hover:bg-tint/6 hover:text-ink"
            >
              <span className="flex h-5 w-7 shrink-0 flex-col justify-center gap-0.5 rounded border border-line-strong bg-abyss/60 px-1">
                <span className="h-0.5 w-full rounded-full bg-ink-4" />
                {l !== 'title' && l !== 'section' && <span className="h-0.5 w-3/4 rounded-full bg-ink-4/60" />}
              </span>
              {LAYOUT_LABELS[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ImageButton({ onAdd }: { onAdd: (src: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <Tooltip label="Add image">
        <IconButton label="Add image" onClick={() => ref.current?.click()}>
          <ImageIcon size={15} />
        </IconButton>
      </Tooltip>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (!f) return
          // Data URI keeps the slide self-contained — no blob lifetime to manage.
          const reader = new FileReader()
          reader.onload = () => onAdd(reader.result as string)
          reader.readAsDataURL(f)
          e.target.value = ''
        }}
      />
    </>
  )
}

function EntityMenu({ nodes, onAdd }: { nodes: GraphNode[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Tooltip label="Insert entity from graph">
        <IconButton label="Insert entity" active={open} onClick={() => setOpen((v) => !v)}>
          <Shapes size={15} />
        </IconButton>
      </Tooltip>
      {open && (
        <div className="glass-strong absolute left-0 top-[calc(100%+6px)] z-50 max-h-[280px] w-[218px] overflow-y-auto rounded-xl p-1.5 shadow-[var(--shadow-panel)] animate-scale-in origin-top-left">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-4">From the case graph</p>
          {nodes.map((n) => {
            const color = ENTITY_COLORS[n.kind]
            return (
              <button
                key={n.id}
                onClick={() => {
                  onAdd(n.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-tint/6"
              >
                <span className="size-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] text-ink-2">{n.label}</span>
                  <span className="block truncate text-[9.5px] text-ink-4">{n.sublabel}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- Present */

function PresentSlide({ slide, nodes }: { slide: Slide; nodes: GraphNode[] }) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / SLIDE_W, window.innerHeight / SLIDE_H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <div key={slide.id} className="animate-fade-in">
      <SlideView slide={slide} nodes={nodes} scale={scale} />
    </div>
  )
}

