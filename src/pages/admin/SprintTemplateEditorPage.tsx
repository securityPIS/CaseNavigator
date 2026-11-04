import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  BetweenHorizontalEnd,
  Bold,
  Braces,
  Check,
  ChevronDown,
  ChevronUp,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Minus,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  Rows3,
  SeparatorHorizontal,
  Settings2,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { SprintPosition, SprintTeamRole, SprintTemplateBody, Template } from '@/domain/types'
import {
  DEFAULT_SPRINT_BODY,
  SPRINT_DOC_CSS,
  SPRINT_FIELDS,
  fieldChip,
  fieldsIn,
  newLetter,
  printLetterHtml,
  renderSprintLetterHtml,
  sanitizeTemplateHtml,
  summarizeSprintTemplate,
} from '@/domain/sprintLetter'
import { cn, relativeTime, uid } from '@/lib/utils'
import { Button, EmptyState, IconButton, Input, Select, Tooltip } from '@/components/ui/primitives'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'

/** Editor-only chrome on top of the letter's own typography: field chips,
    page-break bands and faint table gridlines, as Word shows them. */
const EDITOR_CSS = `
.sprint-doc.editing { outline: none; min-height: 240mm; caret-color: #1d4ed8; }
.sprint-doc.editing td, .sprint-doc.editing th { outline: 1px dashed #d3d9e2; outline-offset: -1px; }
.sprint-doc .field { display: inline-block; background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; border-radius: 3px;
  padding: 0 4px; font-size: 0.88em; line-height: 1.35; white-space: nowrap; cursor: default; user-select: all; font-weight: 500; text-decoration: none; }
.sprint-doc .field[data-field="susunan_tim"] { display: block; text-align: center; padding: 5mm; border-style: dashed; white-space: normal; }
.sprint-doc .field[data-field="logo"] { background: #f1f5f9; color: #475569; border-color: #cbd5e1; padding: 2mm 4mm; }
.sprint-doc .page-break { position: relative; height: 12mm; background: #cfd5dd; margin: 12mm -20mm 12mm -25mm; }
.sprint-doc .page-break::after { content: 'Halaman baru'; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  background: #fff; color: #64748b; font: 600 9px/1 system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; padding: 4px 10px; border-radius: 99px; }
`

const FONTS = ['Arial', 'Calibri', 'Times New Roman', 'Cambria', 'Tahoma', 'Verdana']
const SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24']

const ACCESS_OPTIONS: { value: '' | SprintPosition; label: string }[] = [
  { value: '', label: 'No access — listed only' },
  { value: 'ketua', label: 'Access as Ketua Tim' },
  { value: 'sekretaris', label: 'Access as Sekretaris' },
  { value: 'anggota', label: 'Access as Anggota' },
]

type Settings = Omit<SprintTemplateBody, 'html'>

function settingsProblems(name: string, s: Settings): string[] {
  const p: string[] = []
  if (!name.trim()) p.push('Template name is required.')
  if (!s.numberPattern.includes('{urut}')) p.push('Number pattern must contain {urut}.')
  if (s.roles.length === 0) p.push('Add at least one team role.')
  if (s.roles.some((r) => !r.label.trim())) p.push('Every team role needs a name.')
  if (s.roles.some((r) => r.max !== undefined && r.max < Math.max(r.min, 1))) p.push('A role’s maximum cannot be below its minimum.')
  if (!s.roles.some((r) => r.access)) p.push('At least one team role must grant case access.')
  return p
}

/**
 * The Surat Perintah template, edited the way the LHI is: on an A4 page, with
 * a formatting ribbon. Everything typed on the page is fixed wording. The
 * blue chips are the form's fields — insert them from the side panel wherever
 * the order's own details belong.
 */
export function SprintTemplateEditorPage() {
  const { templateId = '' } = useParams()
  const navigate = useNavigate()
  const template = useLiveQuery(async () => (await db.templates.get(templateId)) ?? null, [templateId])
  const appSettings = useLiveQuery(() => db.settings.get('settings'), [])

  const docRef = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<Range | null>(null)
  const loadedRef = useRef(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [used, setUsed] = useState<Set<string>>(new Set())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [panel, setPanel] = useState<'fields' | 'settings'>('fields')

  // Load once. Later live-query ticks (our own saves) must not overwrite the
  // page under the caret.
  useEffect(() => {
    if (!template || loadedRef.current || !docRef.current) return
    const body = template.sprint ?? DEFAULT_SPRINT_BODY
    loadedRef.current = true
    setName(template.name)
    setDescription(template.description)
    setSettings({ numberPattern: body.numberPattern, defaultPlace: body.defaultPlace, issuerTitle: body.issuerTitle, roles: body.roles })
    docRef.current.innerHTML = body.html
    setUsed(fieldsIn(body.html))
  }, [template])

  // Remember the caret so ribbon buttons and the field panel act where the
  // user was typing, even after focus moved to a dropdown.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && docRef.current?.contains(sel.anchorNode)) {
        rangeRef.current = sel.getRangeAt(0).cloneRange()
      }
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const touched = useCallback(() => {
    setDirty(true)
    if (docRef.current) setUsed(fieldsIn(docRef.current.innerHTML))
  }, [])

  const focusDoc = () => {
    const el = docRef.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel) return
    // Still typing on the page: the live caret is the right one.
    if (document.activeElement === el && sel.rangeCount > 0 && el.contains(sel.anchorNode)) return
    el.focus()
    const r = rangeRef.current
    if (r && el.contains(r.startContainer)) {
      sel.removeAllRanges()
      sel.addRange(r)
    } else if (sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
      const end = document.createRange()
      end.selectNodeContents(el)
      end.collapse(false)
      sel.removeAllRanges()
      sel.addRange(end)
    }
  }

  const exec = (cmd: string, arg?: string) => {
    focusDoc()
    // execCommand is deprecated but remains the only cross-browser way to drive
    // a contenteditable without shipping a full editor framework — the LHI
    // editor does the same.
    document.execCommand(cmd, false, arg)
    touched()
  }

  const setFontSize = (pt: string) => {
    focusDoc()
    // fontSize only takes the 1–7 HTML scale; mark the selection with 7 and
    // swap the marks for real point sizes.
    document.execCommand('fontSize', false, '7')
    docRef.current?.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span')
      span.style.fontSize = `${pt}pt`
      span.append(...f.childNodes)
      f.replaceWith(span)
    })
    touched()
  }

  const currentRow = (): HTMLTableRowElement | null => {
    const node = rangeRef.current?.startContainer
    const el = node instanceof Element ? node : node?.parentElement
    const tr = el?.closest('tr')
    return tr && docRef.current?.contains(tr) ? tr : null
  }

  const addRow = () => {
    const tr = currentRow()
    if (!tr) {
      toast.info('Place the cursor in a table', 'The new row goes under the row the cursor is in.')
      return
    }
    const copy = tr.cloneNode(true) as HTMLTableRowElement
    copy.querySelectorAll('td, th').forEach((c) => (c.innerHTML = '<br>'))
    tr.after(copy)
    touched()
  }

  const deleteRow = () => {
    const tr = currentRow()
    if (!tr) {
      toast.info('Place the cursor in a table', 'The row the cursor is in is removed.')
      return
    }
    const table = tr.closest('table')
    tr.remove()
    if (table && table.querySelectorAll('tr').length === 0) table.remove()
    touched()
  }

  /**
   * Puts markup at the caret. Done by hand rather than with insertHTML,
   * which in Chromium strips the attributes that make a field chip a chip.
   * Block content (tables, page breaks, pasted paragraphs) goes after the
   * top-level block holding the caret, so it never lands inside a sentence.
   */
  const insertAtCaret = (html: string, asBlock: boolean) => {
    const el = docRef.current
    if (!el) return
    focusDoc()
    const sel = window.getSelection()
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    const frag = document.createRange().createContextualFragment(html)
    const last = frag.lastChild
    if (!range || !el.contains(range.startContainer)) {
      el.append(frag)
    } else if (asBlock) {
      let block: Node | null = range.startContainer
      while (block && block.parentNode !== el) block = block.parentNode
      if (block) el.insertBefore(frag, block.nextSibling)
      else el.append(frag)
    } else {
      range.deleteContents()
      range.insertNode(frag)
    }
    if (last && sel) {
      const after = document.createRange()
      after.setStartAfter(last)
      after.collapse(true)
      sel.removeAllRanges()
      sel.addRange(after)
    }
    touched()
  }

  // The zero-width space gives the caret somewhere to sit after the chip.
  const insertField = (key: string) => insertAtCaret(`${fieldChip(key)}&#8203;`, false)

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html')
    if (!html) return
    // Word's clipboard is a full document with its own styles — keep the
    // words and their basic formatting, drop the rest.
    e.preventDefault()
    const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html
    const clean = sanitizeTemplateHtml(body).trim()
    // A single pasted paragraph reads as a phrase: keep it in the line.
    const single = /^<p[^>]*>((?:(?!<\/?p[\s>]).)*)<\/p>$/is.exec(clean)
    if (single) insertAtCaret(single[1], false)
    else insertAtCaret(clean, /<(p|div|table|ol|ul|h[1-4]|blockquote|hr)[\s>]/i.test(clean))
  }

  const body = (): SprintTemplateBody | null =>
    settings && docRef.current ? { ...settings, html: sanitizeTemplateHtml(docRef.current.innerHTML) } : null

  const problems = settings ? settingsProblems(name, settings) : []

  const save = async () => {
    const b = body()
    if (!b || !template) return
    if (problems.length > 0) {
      setPanel('settings')
      toast.error('Template not saved', problems[0])
      return
    }
    setSaving(true)
    try {
      await db.templates.update(template.id, {
        name: name.trim(),
        description: description.trim() || 'No description.',
        sprint: b,
        blocks: summarizeSprintTemplate(b),
        updatedAt: new Date().toISOString(),
      })
      setDirty(false)
      toast.success('Template saved', 'Orders already drafted keep the wording they were written with.')
    } finally {
      setSaving(false)
    }
  }

  // Ctrl/⌘+S saves, as in Word.
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const printBlank = () => {
    const b = body()
    if (!b || !template) return
    const html = renderSprintLetterHtml(newLetter({ ...template, sprint: b }, { dateIssued: '' }), {
      logoDataUrl: appSettings?.logoDataUrl,
      companyName: appSettings?.legalName,
    })
    printLetterHtml(html)
  }

  const restoreStandard = () => {
    if (!docRef.current) return
    if (!window.confirm('Replace the whole page with the standard TKO B14-002 wording? Unsaved edits on the page are lost.')) return
    docRef.current.innerHTML = DEFAULT_SPRINT_BODY.html
    touched()
  }

  const back = () => {
    if (dirty && !window.confirm('Leave without saving? Your changes to this template will be lost.')) return
    navigate('/admin/templates')
  }

  if (template === undefined) return <PageSpinner />
  if (template === null || template.kind !== 'sprint') {
    return (
      <EmptyState
        icon={<Braces size={22} />}
        title="Template not found"
        description="It may have been deleted."
        action={
          <Link to="/admin/templates">
            <Button variant="primary">Back to templates</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <style>{SPRINT_DOC_CSS + EDITOR_CSS}</style>

      {/* Title bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-soft px-4 py-2.5">
        <IconButton label="Back to templates" onClick={back}>
          <ArrowLeft size={15} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">Template · Surat Perintah</p>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setDirty(true)
            }}
            aria-label="Template name"
            className="w-full truncate border-none bg-transparent p-0 text-[14px] font-semibold text-ink outline-none focus:bg-tint/5"
          />
        </div>
        <span className={cn('flex items-center gap-1.5 text-[10.5px]', dirty ? 'text-warn' : 'text-ink-4')}>
          {dirty ? (
            'Unsaved changes'
          ) : (
            <>
              <Check size={11} /> Saved {relativeTime(template.updatedAt)}
            </>
          )}
        </span>
        <Button size="sm" variant="ghost" icon={<Printer size={13} />} onClick={printBlank}>
          Print blank
        </Button>
        <Button size="sm" variant="primary" onClick={save} loading={saving} disabled={!dirty}>
          Save
        </Button>
      </div>

      {/* Ribbon */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line-soft px-4 py-1.5">
        <Group>
          <Cmd label="Undo" onRun={() => exec('undo')}>
            <Undo2 size={14} />
          </Cmd>
          <Cmd label="Redo" onRun={() => exec('redo')}>
            <Redo2 size={14} />
          </Cmd>
        </Group>
        <Sep />
        <Group>
          <div className="w-[128px]">
            <Select
              aria-label="Font"
              className="h-7 text-[11.5px]"
              value=""
              onChange={(e) => e.target.value && exec('fontName', e.target.value)}
              options={[{ value: '', label: 'Font…' }, ...FONTS.map((f) => ({ value: f, label: f }))]}
            />
          </div>
          <div className="w-[76px]">
            <Select
              aria-label="Font size"
              className="h-7 text-[11.5px]"
              value=""
              onChange={(e) => e.target.value && setFontSize(e.target.value)}
              options={[{ value: '', label: 'Size' }, ...SIZES.map((s) => ({ value: s, label: `${s} pt` }))]}
            />
          </div>
        </Group>
        <Sep />
        <Group>
          <Cmd label="Bold (Ctrl+B)" onRun={() => exec('bold')}>
            <Bold size={14} />
          </Cmd>
          <Cmd label="Italic (Ctrl+I)" onRun={() => exec('italic')}>
            <Italic size={14} />
          </Cmd>
          <Cmd label="Underline (Ctrl+U)" onRun={() => exec('underline')}>
            <Underline size={14} />
          </Cmd>
          <Cmd label="Strikethrough" onRun={() => exec('strikeThrough')}>
            <Strikethrough size={14} />
          </Cmd>
        </Group>
        <Sep />
        <Group>
          <Cmd label="Align left" onRun={() => exec('justifyLeft')}>
            <AlignLeft size={14} />
          </Cmd>
          <Cmd label="Center" onRun={() => exec('justifyCenter')}>
            <AlignCenter size={14} />
          </Cmd>
          <Cmd label="Align right" onRun={() => exec('justifyRight')}>
            <AlignRight size={14} />
          </Cmd>
          <Cmd label="Justify" onRun={() => exec('justifyFull')}>
            <AlignJustify size={14} />
          </Cmd>
        </Group>
        <Sep />
        <Group>
          <Cmd label="Numbered list" onRun={() => exec('insertOrderedList')}>
            <ListOrdered size={14} />
          </Cmd>
          <Cmd label="Bulleted list" onRun={() => exec('insertUnorderedList')}>
            <List size={14} />
          </Cmd>
          <Cmd label="Decrease indent" onRun={() => exec('outdent')}>
            <IndentDecrease size={14} />
          </Cmd>
          <Cmd label="Increase indent" onRun={() => exec('indent')}>
            <IndentIncrease size={14} />
          </Cmd>
        </Group>
        <Sep />
        <Group>
          <Cmd
            label="Insert table (label : isi)"
            onRun={() =>
              insertAtCaret('<table class="clause"><tbody><tr><td>Label</td><td>:</td><td><p>Isi</p></td></tr></tbody></table>', true)
            }
          >
            <Table2 size={14} />
          </Cmd>
          <Cmd label="Add table row below" onRun={addRow}>
            <Rows3 size={14} />
          </Cmd>
          <Cmd label="Delete table row" onRun={deleteRow}>
            <BetweenHorizontalEnd size={14} />
          </Cmd>
          <Cmd label="Horizontal line" onRun={() => exec('insertHorizontalRule')}>
            <Minus size={14} />
          </Cmd>
          <Cmd label="Page break" onRun={() => insertAtCaret('<div class="page-break"></div><p><br></p>', true)}>
            <SeparatorHorizontal size={14} />
          </Cmd>
        </Group>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Page */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-abyss/45 px-4 py-6">
          <div
            className="mx-auto w-full max-w-[210mm] rounded-sm bg-white text-[#111] shadow-[0_24px_70px_-16px_rgb(0_0_0/0.8)]"
            style={{ padding: '20mm 20mm 20mm 25mm' }}
          >
            <div
              ref={docRef}
              className="sprint-doc editing"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onInput={touched}
              onPaste={onPaste}
              aria-label="Surat Perintah template"
            />
          </div>
          <p className="mt-4 text-center text-[10.5px] text-ink-4">
            Type anywhere to change the wording. Blue chips are filled in from the SPRINT form — insert them from the
            side panel. Pasting from Word keeps the text and basic formatting.
          </p>
        </div>

        {/* Side panel */}
        <aside className="flex max-h-[45vh] w-full shrink-0 flex-col border-t border-line-soft lg:max-h-none lg:w-[300px] lg:border-l lg:border-t-0">
          <div className="flex shrink-0 gap-1 border-b border-line-soft p-2">
            <PanelTab active={panel === 'fields'} onClick={() => setPanel('fields')} icon={<Braces size={13} />}>
              Form fields
            </PanelTab>
            <PanelTab active={panel === 'settings'} onClick={() => setPanel('settings')} icon={<Settings2 size={13} />}>
              Settings
              {problems.length > 0 && <span className="ml-1 size-1.5 rounded-full bg-warn" />}
            </PanelTab>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {panel === 'fields' ? (
              <div className="space-y-1.5">
                <p className="mb-2 text-[11px] leading-relaxed text-ink-4">
                  Click to insert at the cursor. A list field on its own numbered line becomes one point per entry.
                </p>
                {SPRINT_FIELDS.map((f) => {
                  const on = used.has(f.key)
                  return (
                    <button
                      key={f.key}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertField(f.key)}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-line-soft bg-abyss/30 px-2.5 py-2 text-left transition-colors hover:border-brand/50 hover:bg-brand/6"
                    >
                      <Plus size={12} className="mt-0.5 shrink-0 text-brand-bright" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium text-ink">{f.label}</span>
                          {f.kind === 'list' && <span className="text-[9.5px] uppercase tracking-wide text-ink-4">list</span>}
                        </span>
                        <span className="block text-[10.5px] leading-snug text-ink-4">{f.hint}</span>
                      </span>
                      {on && (
                        <Tooltip label="Used in the document">
                          <Check size={12} className="mt-0.5 shrink-0 text-ok" />
                        </Tooltip>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : settings ? (
              <SettingsPanel
                description={description}
                onDescription={(v) => {
                  setDescription(v)
                  setDirty(true)
                }}
                settings={settings}
                onSettings={(s) => {
                  setSettings(s)
                  setDirty(true)
                }}
                problems={problems}
                onRestore={restoreStandard}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Settings */

function SettingsPanel({
  description,
  onDescription,
  settings,
  onSettings,
  problems,
  onRestore,
}: {
  description: string
  onDescription: (v: string) => void
  settings: Settings
  onSettings: (s: Settings) => void
  problems: string[]
  onRestore: () => void
}) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onSettings({ ...settings, [k]: v })
  const setRole = (i: number, patch: Partial<SprintTeamRole>) =>
    set(
      'roles',
      settings.roles.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    )
  const moveRole = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= settings.roles.length) return
    const next = [...settings.roles]
    ;[next[i], next[j]] = [next[j], next[i]]
    set('roles', next)
  }

  return (
    <div className="space-y-4">
      {problems.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-lg border border-warn/35 bg-warn/8 py-2 pl-6 pr-3 text-[11px] leading-relaxed text-ink-3">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <Field label="Description">
        <Input value={description} onChange={(e) => onDescription(e.target.value)} className="h-8 text-[12px]" />
      </Field>
      <Field label="Pola nomor" hint="Fills the Nomor surat field. {urut} and {tahun} come from the form.">
        <Input value={settings.numberPattern} onChange={(e) => set('numberPattern', e.target.value)} className="h-8 font-mono text-[11.5px]" />
      </Field>
      <Field label="Tempat ditetapkan — default">
        <Input value={settings.defaultPlace} onChange={(e) => set('defaultPlace', e.target.value)} className="h-8 text-[12px]" />
      </Field>
      <Field label="Jabatan penandatangan — default">
        <Input value={settings.issuerTitle} onChange={(e) => set('issuerTitle', e.target.value)} className="h-8 text-[12px]" />
      </Field>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[12px] font-medium text-ink-2">Susunan tim — peran</span>
          <Button
            size="xs"
            variant="ghost"
            icon={<Plus size={11} />}
            onClick={() => set('roles', [...settings.roles, { id: uid('role'), label: '', min: 0 }])}
          >
            Add
          </Button>
        </div>
        <p className="mb-2 text-[10.5px] leading-relaxed text-ink-4">
          Rows of the team table, in order. Only app users in a role with access can open the case.
        </p>
        <div className="space-y-2">
          {settings.roles.map((r, i) => (
            <div key={r.id} className="space-y-1.5 rounded-lg border border-line-soft bg-abyss/30 p-2">
              <div className="flex items-center gap-1">
                <Input
                  value={r.label}
                  placeholder="Role name"
                  onChange={(e) => setRole(i, { label: e.target.value })}
                  className="h-7 text-[11.5px]"
                />
                <IconButton label="Move up" size={22} disabled={i === 0} onClick={() => moveRole(i, -1)}>
                  <ChevronUp size={11} />
                </IconButton>
                <IconButton label="Move down" size={22} disabled={i === settings.roles.length - 1} onClick={() => moveRole(i, 1)}>
                  <ChevronDown size={11} />
                </IconButton>
                <IconButton
                  label="Remove role"
                  size={22}
                  className="hover:text-danger"
                  onClick={() => set('roles', settings.roles.filter((_, j) => j !== i))}
                >
                  <X size={11} />
                </IconButton>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  type="number"
                  min={0}
                  aria-label="Minimum"
                  value={r.min}
                  onChange={(e) => setRole(i, { min: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-7 text-[11.5px]"
                  suffix={<span className="text-[9.5px]">min</span>}
                />
                <Input
                  type="number"
                  min={1}
                  aria-label="Maximum"
                  value={r.max ?? ''}
                  placeholder="∞"
                  onChange={(e) => setRole(i, { max: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })}
                  className="h-7 text-[11.5px]"
                  suffix={<span className="text-[9.5px]">max</span>}
                />
              </div>
              <Select
                aria-label="Case access"
                className="h-7 text-[11.5px]"
                value={r.access ?? ''}
                onChange={(e) => setRole(i, { access: (e.target.value || undefined) as SprintPosition | undefined })}
                options={ACCESS_OPTIONS}
              />
              <Input
                value={r.hint ?? ''}
                placeholder="Guidance, e.g. Level Manager"
                onChange={(e) => setRole(i, { hint: e.target.value || undefined })}
                className="h-7 text-[11px]"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line-soft pt-3">
        <Button size="sm" variant="ghost" icon={<RotateCcw size={12} />} onClick={onRestore}>
          Restore standard TKO wording
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Bits */

function Group({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5 px-1">{children}</div>
}

function Sep() {
  return <span className="h-5 w-px bg-line" />
}

/** A ribbon button. Pressing it never takes focus from the page, so the
    selection it acts on survives the click. */
function Cmd({ label, onRun, children }: { label: string; onRun: () => void; children: ReactNode }) {
  return (
    <Tooltip label={label} side="bottom">
      <IconButton label={label} onMouseDown={(e) => e.preventDefault()} onClick={onRun}>
        {children}
      </IconButton>
    </Tooltip>
  )
}

function PanelTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors',
        active ? 'bg-brand/12 text-brand-bright' : 'text-ink-3 hover:bg-tint/5 hover:text-ink-2',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

/** Creates a SPRINT template from the standard wording; returns its id. */
export async function createSprintTemplate(): Promise<string> {
  const first = (await db.templates.where('kind').equals('sprint').count()) === 0
  const t: Template = {
    id: uid('tpl'),
    kind: 'sprint',
    name: 'New Surat Perintah template',
    description: 'No description.',
    updatedAt: new Date().toISOString(),
    isDefault: first,
    blocks: summarizeSprintTemplate(DEFAULT_SPRINT_BODY),
    sprint: structuredClone(DEFAULT_SPRINT_BODY),
  }
  await db.templates.add(t)
  return t.id
}

