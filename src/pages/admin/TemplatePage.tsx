import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  GripVertical,
  LayoutTemplate,
  Mail,
  Plus,
  Presentation,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { Template, TemplateKind } from '@/domain/types'
import { cn, relativeTime, uid } from '@/lib/utils'
import { Badge, Button, Card, EmptyState, IconButton, Input, tone } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { AdminShell } from './AdminShell'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'

const KINDS: { id: TemplateKind; label: string; icon: typeof FileText; color: string; blurb: string }[] = [
  { id: 'report', label: 'Report', icon: FileText, color: '#3B82F6', blurb: 'Section structure for investigation reports' },
  { id: 'deck', label: 'Deck', icon: Presentation, color: '#A855F7', blurb: 'Slide running order for challenge sessions' },
  { id: 'mail', label: 'Mail', icon: Mail, color: '#10B981', blurb: 'Boilerplate for outbound correspondence' },
  { id: 'evidence-label', label: 'Evidence Label', icon: Tag, color: '#F59E0B', blurb: 'Fields printed on evidence labels' },
]

export function TemplatePage() {
  const templates = useLiveQuery(() => db.templates.toArray(), [], [])
  const [kind, setKind] = useState<TemplateKind>('report')
  const [editing, setEditing] = useState<Template | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const filtered = templates.filter((t) => t.kind === kind)
  const meta = KINDS.find((k) => k.id === kind)!

  const setDefault = async (t: Template) => {
    await Promise.all(
      templates.filter((x) => x.kind === t.kind).map((x) => db.templates.update(x.id, { isDefault: x.id === t.id })),
    )
    toast.success('Default updated', `${t.name} is now the default ${t.kind} template.`)
  }

  return (
    <AdminShell
      title="Template Customization"
      description="Templates set the starting structure for new reports, decks, mail and evidence labels. Changing one does not affect documents already created from it."
      actions={
        <Button variant="primary" icon={<Plus size={13} />} onClick={() => setNewOpen(true)}>
          New template
        </Button>
      }
    >
      {/* Kind tabs */}
      <div className="mb-5 flex flex-wrap gap-2 animate-fade-up">
        {KINDS.map((k) => {
          const active = kind === k.id
          const count = templates.filter((t) => t.kind === k.id).length
          return (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-all duration-200',
                active ? 'border-brand/50 bg-brand/8' : 'border-line-soft bg-abyss/30 hover:border-line-strong',
              )}
            >
              <span className="tone flex size-7 shrink-0 items-center justify-center rounded-lg border" style={tone(k.color)}>
                <k.icon size={14} />
              </span>
              <span className="text-left">
                <span className={cn('block text-[12.5px] font-medium', active ? 'text-ink' : 'text-ink-2')}>{k.label}</span>
                <span className="block text-[10px] text-ink-4 tnum">{count} templates</span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="mb-3 text-[11.5px] text-ink-4">{meta.blurb}</p>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LayoutTemplate size={22} />}
            title={`No ${meta.label.toLowerCase()} templates`}
            description="Create one to give your team a consistent starting point."
            action={
              <Button variant="primary" icon={<Plus size={14} />} onClick={() => setNewOpen(true)}>
                New template
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((t, i) => (
            <Card
              key={t.id}
              className="group flex flex-col p-4 transition-all duration-200 hover:border-brand/35 animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[13.5px] font-medium text-ink">{t.name}</h3>
                    {t.isDefault && (
                      <Badge color="#10B981" size="sm">
                        <Star size={8} /> Default
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-3">{t.description}</p>
                </div>
              </div>

              {/* Block preview */}
              <ol className="my-3 space-y-1">
                {t.blocks.slice(0, 4).map((b, bi) => (
                  <li key={bi} className="flex items-center gap-2 text-[11px] text-ink-3">
                    <span className="w-3 shrink-0 text-[9px] text-ink-4 tnum">{bi + 1}</span>
                    <span className="h-1 w-1 shrink-0 rounded-full bg-ink-4" />
                    <span className="truncate">{b}</span>
                  </li>
                ))}
                {t.blocks.length > 4 && (
                  <li className="pl-5 text-[10.5px] text-ink-4 tnum">+{t.blocks.length - 4} more sections</li>
                )}
              </ol>

              <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-3">
                <span className="text-[10px] text-ink-4">Updated {relativeTime(t.updatedAt)}</span>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!t.isDefault && (
                    <IconButton label="Set as default" size={24} onClick={() => setDefault(t)}>
                      <Star size={12} />
                    </IconButton>
                  )}
                  <IconButton
                    label="Duplicate"
                    size={24}
                    onClick={async () => {
                      await db.templates.add({
                        ...t,
                        id: uid('tpl'),
                        name: `${t.name} (copy)`,
                        isDefault: false,
                        updatedAt: new Date().toISOString(),
                      })
                      toast.success('Template duplicated')
                    }}
                  >
                    <Copy size={12} />
                  </IconButton>
                  <IconButton label="Edit" size={24} onClick={() => setEditing(t)}>
                    <LayoutTemplate size={12} />
                  </IconButton>
                  <IconButton
                    label="Delete"
                    size={24}
                    className="hover:text-danger"
                    onClick={async () => {
                      if (t.isDefault) {
                        toast.error('Cannot delete', 'Set another template as default first.')
                        return
                      }
                      await db.templates.delete(t.id)
                      toast.success('Template deleted')
                    }}
                  >
                    <Trash2 size={12} />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <TemplateEditor template={editing} onClose={() => setEditing(null)} />}
      {newOpen && <TemplateEditor kind={kind} onClose={() => setNewOpen(false)} />}
    </AdminShell>
  )
}

/* --------------------------------------------------------------- Editor */

function TemplateEditor({
  template,
  kind,
  onClose,
}: {
  template?: Template
  kind?: TemplateKind
  onClose: () => void
}) {
  const isNew = !template
  const [name, setName] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [blocks, setBlocks] = useState<string[]>(template?.blocks ?? ['Section 1'])
  const [saving, setSaving] = useState(false)

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBlocks(next)
  }

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const clean = blocks.map((b) => b.trim()).filter(Boolean)
      const payload = {
        name: name.trim(),
        description: description.trim() || 'No description.',
        blocks: clean.length > 0 ? clean : ['Section 1'],
        updatedAt: new Date().toISOString(),
      }
      if (template) {
        await db.templates.update(template.id, payload)
        toast.success('Template saved')
      } else {
        await db.templates.add({ id: uid('tpl'), kind: kind ?? 'report', isDefault: false, ...payload })
        toast.success('Template created')
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'New template' : `Edit ${template!.name}`}
      description="Sections appear in this order when the template is applied."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!name.trim()}>
            {isNew ? 'Create template' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Investigation Report" />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When should someone reach for this?" />
        </Field>

        <Field label="Sections" hint="Order matters — this is the running order applied to new documents.">
          <div className="space-y-1.5">
            {blocks.map((b, i) => (
              <div key={i} className="group flex items-center gap-2">
                <span className="flex w-5 shrink-0 items-center justify-center text-[10px] text-ink-4 tnum">{i + 1}</span>
                <GripVertical size={12} className="shrink-0 text-ink-4 opacity-40" />
                <Input
                  value={b}
                  onChange={(e) => {
                    const next = [...blocks]
                    next[i] = e.target.value
                    setBlocks(next)
                  }}
                  className="h-8 text-[12px]"
                />
                <div className="flex shrink-0 gap-0.5">
                  <IconButton label="Move up" size={24} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ChevronUp size={11} />
                  </IconButton>
                  <IconButton label="Move down" size={24} disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>
                    <ChevronDown size={11} />
                  </IconButton>
                  <IconButton
                    label="Remove section"
                    size={24}
                    className="hover:text-danger"
                    disabled={blocks.length === 1}
                    onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}
                  >
                    <X size={11} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setBlocks([...blocks, `Section ${blocks.length + 1}`])}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong py-2 text-[11.5px] text-ink-3 transition-colors hover:border-brand/50 hover:text-brand-bright"
          >
            <Plus size={12} /> Add section
          </button>
        </Field>
      </div>
    </Modal>
  )
}
