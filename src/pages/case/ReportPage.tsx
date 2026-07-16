import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bold,
  Check,
  ChevronRight,
  FileText,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Plus,
  Printer,
  Redo2,
  Save,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { Report, ReportSection } from '@/domain/types'
import { cn, formatDateTime, relativeTime, uid } from '@/lib/utils'
import { Badge, Button, EmptyState, IconButton, Select, Tooltip } from '@/components/ui/primitives'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { toast } from '@/stores/toast'

const CLASSIFICATIONS: Record<Report['classification'], { label: string; color: string }> = {
  unclassified: { label: 'Unclassified', color: '#6A7FA3' },
  internal: { label: 'Internal', color: '#38BDF8' },
  confidential: { label: 'Confidential', color: '#F59E0B' },
  restricted: { label: 'Restricted', color: '#EF4444' },
}

const STATUS: Record<Report['status'], { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6A7FA3' },
  in_review: { label: 'In Review', color: '#8B5CF6' },
  final: { label: 'Final', color: '#10B981' },
}

export function ReportPage() {
  const { caseId = '' } = useParams()
  const report = useLiveQuery(() => db.reports.where('caseId').equals(caseId).first(), [caseId])
  const caseRec = useLiveQuery(() => db.cases.get(caseId), [caseId])

  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const savedTimer = useRef<number | null>(null)

  const touch = useCallback(
    async (patch: Partial<Report>) => {
      if (!report) return
      setSaving('saving')
      await db.reports.update(report.id, { ...patch, updatedAt: new Date().toISOString() })
      setSaving('saved')
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSaving('idle'), 1600)
    },
    [report],
  )

  useEffect(() => () => void (savedTimer.current && window.clearTimeout(savedTimer.current)), [])

  const wordCount = useMemo(() => {
    if (!report) return 0
    const text = report.sections.map((s) => `${s.heading} ${s.html.replace(/<[^>]+>/g, ' ')}`).join(' ')
    return text.split(/\s+/).filter(Boolean).length
  }, [report])

  if (report === undefined) return <PageSpinner />
  if (!report) {
    return (
      <EmptyState
        icon={<FileText size={22} />}
        title="No report yet"
        description="This case has no investigation report. Reports are seeded for CN-2026-014 in this build."
      />
    )
  }

  const exec = (cmd: string, arg?: string) => {
    // execCommand is deprecated but remains the only cross-browser way to drive
    // a contenteditable without shipping a full editor framework.
    document.execCommand(cmd, false, arg)
  }

  const patchSection = async (id: string, patch: Partial<ReportSection>) => {
    await touch({ sections: report.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  }

  const addSection = async () => {
    const s: ReportSection = { id: uid('sec'), heading: 'New section', level: 1, html: '<p>Write here…</p>' }
    await touch({ sections: [...report.sections, s] })
    setActiveSection(s.id)
    toast.success('Section added', 'Scroll to the end of the document to find it.')
  }

  const removeSection = async (id: string) => {
    await touch({ sections: report.sections.filter((s) => s.id !== id) })
  }

  const classification = CLASSIFICATIONS[report.classification]
  const status = STATUS[report.status]

  return (
    <div className="flex h-full flex-col">
      {/* Ribbon */}
      <div className="no-print flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line-soft px-4 py-2">
        <div className="flex items-center gap-0.5 pr-2">
          <Tooltip label="Undo">
            <IconButton label="Undo" onClick={() => exec('undo')}>
              <Undo2 size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Redo">
            <IconButton label="Redo" onClick={() => exec('redo')}>
              <Redo2 size={14} />
            </IconButton>
          </Tooltip>
        </div>

        <span className="h-5 w-px bg-line" />

        <div className="flex items-center gap-0.5 px-2">
          <Tooltip label="Bold (⌘B)">
            <IconButton label="Bold" onClick={() => exec('bold')}>
              <Bold size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Italic (⌘I)">
            <IconButton label="Italic" onClick={() => exec('italic')}>
              <Italic size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Underline (⌘U)">
            <IconButton label="Underline" onClick={() => exec('underline')}>
              <Underline size={14} />
            </IconButton>
          </Tooltip>
        </div>

        <span className="h-5 w-px bg-line" />

        <div className="flex items-center gap-0.5 px-2">
          <Tooltip label="Heading 1">
            <IconButton label="Heading 1" onClick={() => exec('formatBlock', '<h3>')}>
              <Heading1 size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Heading 2">
            <IconButton label="Heading 2" onClick={() => exec('formatBlock', '<h4>')}>
              <Heading2 size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Paragraph">
            <IconButton label="Paragraph" onClick={() => exec('formatBlock', '<p>')}>
              <span className="text-[11px] font-semibold">P</span>
            </IconButton>
          </Tooltip>
          <Tooltip label="Bulleted list">
            <IconButton label="Bulleted list" onClick={() => exec('insertUnorderedList')}>
              <List size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Numbered list">
            <IconButton label="Numbered list" onClick={() => exec('insertOrderedList')}>
              <ListOrdered size={14} />
            </IconButton>
          </Tooltip>
        </div>

        <span className="h-5 w-px bg-line" />

        <div className="flex items-center gap-2 px-2">
          <div className="w-[128px]">
            <Select
              className="h-7 text-[11.5px]"
              value={report.classification}
              onChange={(e) => touch({ classification: e.target.value as Report['classification'] })}
              options={Object.entries(CLASSIFICATIONS).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </div>
          <div className="w-[108px]">
            <Select
              className="h-7 text-[11.5px]"
              value={report.status}
              onChange={(e) => touch({ status: e.target.value as Report['status'] })}
              options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[10.5px] text-ink-4 lg:block tnum">{wordCount} words</span>
          <SaveIndicator state={saving} updatedAt={report.updatedAt} />
          <Button size="sm" variant="ghost" icon={<Printer size={13} />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Outline */}
        <nav className="no-print hidden w-[212px] shrink-0 flex-col overflow-y-auto border-r border-line-soft p-3 lg:flex">
          <h2 className="mb-2.5 px-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">Outline</h2>
          <ul className="space-y-px">
            {report.sections.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setActiveSection(s.id)
                    document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={cn(
                    'group flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left transition-colors',
                    s.level === 2 ? 'pl-5' : 'pl-2',
                    activeSection === s.id ? 'bg-brand/12 text-brand-bright' : 'text-ink-3 hover:bg-tint/5 hover:text-ink-2',
                  )}
                >
                  <span className="w-4 shrink-0 text-[9.5px] text-ink-4 tnum">{i + 1}</span>
                  <span className={cn('min-w-0 flex-1 truncate', s.level === 2 ? 'text-[11px]' : 'text-[11.5px] font-medium')}>
                    {s.heading}
                  </span>
                  <ChevronRight size={11} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={addSection}
            className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong py-2 text-[11px] text-ink-3 transition-colors hover:border-brand/50 hover:text-brand-bright"
          >
            <Plus size={12} /> Add section
          </button>

          <div className="mt-auto space-y-1.5 rounded-xl border border-line-soft bg-abyss/35 p-3">
            <Row label="Author" value={report.author} />
            <Row label="Status" value={status.label} color={status.color} />
            <Row label="Words" value={String(wordCount)} />
            <Row label="Updated" value={relativeTime(report.updatedAt)} />
          </div>
        </nav>

        {/* Document */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-abyss/45 p-6">
          <div className="mx-auto max-w-[820px]">
            {/* Page */}
            <article className="rounded-sm bg-[#F7F9FC] px-[76px] py-[68px] text-[#111827] shadow-[0_24px_70px_-16px_rgb(0_0_0/0.8)]">
              {/* Letterhead */}
              <header className="mb-9 border-b-2 border-[#1D4ED8] pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1D4ED8]">
                      Meridian International
                    </p>
                    <p className="mt-1 text-[9.5px] uppercase tracking-[0.1em] text-[#6B7280]">
                      Corporate Ethics · Investigations
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em]"
                    style={{
                      color: classification.color,
                      borderColor: classification.color,
                      backgroundColor: `${classification.color}14`,
                    }}
                  >
                    {classification.label}
                  </span>
                </div>

                <input
                  value={report.title}
                  onChange={(e) => touch({ title: e.target.value })}
                  className="mt-5 w-full border-none bg-transparent p-0 font-serif text-[27px] font-bold leading-tight text-[#0F172A] outline-none focus:bg-[#1D4ED8]/6"
                  aria-label="Report title"
                />

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[10.5px] text-[#4B5563]">
                  <span>
                    <strong className="font-semibold text-[#374151]">Case:</strong> {caseRec?.code}
                  </span>
                  <span>
                    <strong className="font-semibold text-[#374151]">Author:</strong> {report.author}
                  </span>
                  <span>
                    <strong className="font-semibold text-[#374151]">Status:</strong> {status.label}
                  </span>
                  <span>
                    <strong className="font-semibold text-[#374151]">Updated:</strong> {formatDateTime(report.updatedAt)}
                  </span>
                </div>
              </header>

              {/* Sections */}
              {report.sections.map((s, i) => (
                <SectionEditor
                  key={s.id}
                  section={s}
                  index={i}
                  onFocus={() => setActiveSection(s.id)}
                  onPatch={(p) => patchSection(s.id, p)}
                  onRemove={() => removeSection(s.id)}
                />
              ))}

              <footer className="mt-10 border-t border-[#D1D5DB] pt-4 text-[9px] text-[#9CA3AF]">
                <div className="flex justify-between">
                  <span>
                    {caseRec?.code} · {classification.label}
                  </span>
                  <span>Generated by CaseNavigator · {formatDateTime(report.updatedAt)}</span>
                </div>
              </footer>
            </article>

            <p className="no-print mt-4 text-center text-[10.5px] text-ink-4">
              Click any paragraph to edit. Changes save to your browser automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Section */

function SectionEditor({
  section,
  index,
  onFocus,
  onPatch,
  onRemove,
}: {
  section: ReportSection
  index: number
  onFocus: () => void
  onPatch: (p: Partial<ReportSection>) => void
  onRemove: () => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)

  // Only push DOM → state; never write state back into a focused editable or
  // the caret jumps to the start on every keystroke.
  useEffect(() => {
    const el = bodyRef.current
    if (!el || document.activeElement === el) return
    if (el.innerHTML !== section.html) el.innerHTML = section.html
  }, [section.html])

  return (
    <section id={`sec-${section.id}`} className="group/sec relative mb-7 scroll-mt-6">
      <div className="absolute -left-11 top-1 flex flex-col gap-1 opacity-0 transition-opacity group-hover/sec:opacity-100 no-print">
        <button
          onClick={onRemove}
          aria-label="Delete section"
          className="flex size-6 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#9CA3AF] transition-colors hover:border-red-300 hover:text-red-500"
        >
          <Trash2 size={11} />
        </button>
        <button
          onClick={() => onPatch({ level: section.level === 1 ? 2 : 1 })}
          aria-label="Toggle heading level"
          title={section.level === 1 ? 'Demote to sub-heading' : 'Promote to heading'}
          className="flex size-6 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[9px] font-bold text-[#9CA3AF] transition-colors hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
        >
          H{section.level}
        </button>
      </div>

      <input
        value={section.heading}
        onFocus={onFocus}
        onChange={(e) => onPatch({ heading: e.target.value })}
        aria-label={`Section ${index + 1} heading`}
        className={cn(
          'mb-2.5 w-full border-none bg-transparent p-0 font-serif font-bold text-[#0F172A] outline-none focus:bg-[#1D4ED8]/6',
          section.level === 1 ? 'text-[19px]' : 'text-[15.5px] text-[#1F2937]',
        )}
      />

      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={onFocus}
        onBlur={(e) => onPatch({ html: e.currentTarget.innerHTML })}
        className="report-body text-[12.5px] leading-[1.85] text-[#1F2937] outline-none focus:bg-[#1D4ED8]/4"
      />
    </section>
  )
}

/* --------------------------------------------------------------- Bits */

function SaveIndicator({ state, updatedAt }: { state: 'idle' | 'saving' | 'saved'; updatedAt: string }) {
  if (state === 'saving')
    return (
      <span className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
        <Save size={11} className="animate-spin-slow" /> Saving…
      </span>
    )
  if (state === 'saved')
    return (
      <span className="flex items-center gap-1.5 text-[10.5px] text-ok animate-fade-in">
        <Check size={11} /> Saved
      </span>
    )
  return <span className="hidden text-[10.5px] text-ink-4 xl:block">Saved {relativeTime(updatedAt)}</span>
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-ink-4">{label}</span>
      {color ? (
        <Badge color={color} size="sm">
          {value}
        </Badge>
      ) : (
        <span className="truncate text-[10.5px] text-ink-2">{value}</span>
      )}
    </div>
  )
}

