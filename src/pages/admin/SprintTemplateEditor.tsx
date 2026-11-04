import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { db } from '@/domain/db'
import type { SprintPosition, SprintTeamRole, SprintTemplateBody, Template } from '@/domain/types'
import {
  DEFAULT_SPRINT_BODY,
  newLetter,
  renderSprintLetterHtml,
  summarizeSprintTemplate,
} from '@/domain/sprintLetter'
import { uid } from '@/lib/utils'
import { Button, IconButton, Input, Select, Textarea } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { FormSection, LetterPreview, ListEditor } from '@/components/sprint/LetterParts'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'

const ACCESS_OPTIONS: { value: '' | SprintPosition; label: string }[] = [
  { value: '', label: 'No access — listed only' },
  { value: 'ketua', label: 'Access as Ketua Tim' },
  { value: 'sekretaris', label: 'Access as Sekretaris' },
  { value: 'anggota', label: 'Access as Anggota' },
]

const PLACEHOLDER_HINT = (
  <>
    Placeholders: <code className="text-ink-3">{'{{jabatan_penerbit}}'}</code> is replaced with the issuing office,{' '}
    <code className="text-ink-3">{'{{perihal}}'}</code> with the case under investigation.
  </>
)

/** What makes a SPRINT template unusable. Empty = can be saved. */
function templateProblems(name: string, b: SprintTemplateBody): string[] {
  const p: string[] = []
  if (!name.trim()) p.push('Template name is required.')
  if (!b.numberPattern.includes('{urut}')) p.push('Number pattern must contain {urut}.')
  if (!b.issuerTitle.trim()) p.push('Issuing office is required.')
  if (b.roles.length === 0) p.push('Add at least one team role.')
  if (b.roles.some((r) => !r.label.trim())) p.push('Every team role needs a name.')
  if (b.roles.some((r) => r.max !== undefined && r.max < Math.max(r.min, 1))) p.push('A role’s maximum cannot be below its minimum.')
  if (!b.roles.some((r) => r.access)) p.push('At least one role must grant case access — otherwise no order from this template opens the case to anyone.')
  return p
}

/**
 * Editor for the fixed half of a Surat Perintah. Everything here is the same
 * on every order; the SPRINT form on a case supplies the rest. The preview
 * shows the template exactly as a blank form, with the fields still to fill
 * left as dotted lines.
 */
export function SprintTemplateEditor({ template, onClose }: { template?: Template; onClose: () => void }) {
  const isNew = !template
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const [name, setName] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [body, setBody] = useState<SprintTemplateBody>(() => structuredClone(template?.sprint ?? DEFAULT_SPRINT_BODY))
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof SprintTemplateBody>(key: K, value: SprintTemplateBody[K]) =>
    setBody((b) => ({ ...b, [key]: value }))

  const problems = templateProblems(name, body)

  const html = useMemo(() => {
    const draft: Template = {
      id: template?.id ?? 'preview',
      kind: 'sprint',
      name,
      description,
      updatedAt: '',
      isDefault: false,
      blocks: [],
      sprint: body,
    }
    return renderSprintLetterHtml(newLetter(draft, { dateIssued: '' }), {
      logoDataUrl: settings?.logoDataUrl,
      companyName: settings?.legalName,
    })
  }, [body, name, description, settings, template?.id])

  const setRole = (i: number, patch: Partial<SprintTeamRole>) =>
    set(
      'roles',
      body.roles.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    )

  const moveRole = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= body.roles.length) return
    const next = [...body.roles]
    ;[next[i], next[j]] = [next[j], next[i]]
    set('roles', next)
  }

  const save = async () => {
    if (problems.length > 0) return
    setSaving(true)
    try {
      const clean: SprintTemplateBody = {
        ...body,
        menimbangFixed: body.menimbangFixed.map((s) => s.trim()).filter(Boolean),
        dasar: body.dasar.map((s) => s.trim()).filter(Boolean),
        untukFixed: body.untukFixed.map((s) => s.trim()).filter(Boolean),
        penutup: body.penutup.map((s) => s.trim()).filter(Boolean),
        roles: body.roles.map((r) => ({ ...r, label: r.label.trim(), hint: r.hint?.trim() || undefined })),
      }
      const payload = {
        name: name.trim(),
        description: description.trim() || 'No description.',
        blocks: summarizeSprintTemplate(clean),
        sprint: clean,
        updatedAt: new Date().toISOString(),
      }
      if (template) {
        await db.templates.update(template.id, payload)
        toast.success('Template saved', 'Orders already drafted keep the wording they were written with.')
      } else {
        const first = (await db.templates.where('kind').equals('sprint').count()) === 0
        await db.templates.add({ id: uid('tpl'), kind: 'sprint', isDefault: first, ...payload })
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
      title={isNew ? 'New Surat Perintah template' : `Edit ${template!.name}`}
      description="The fixed wording of every order drafted from this template. Case details, the team and the signatory are filled in on the case's SPRINT tab."
      size="xl"
      footer={
        <>
          {problems.length > 0 && (
            <span className="mr-auto max-w-[60%] truncate text-[11px] text-warn" title={problems.join('\n')}>
              {problems[0]}
              {problems.length > 1 && ` (+${problems.length - 1} more)`}
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={problems.length > 0}>
            {isNew ? 'Create template' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template name" required>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Surat Perintah Investigasi" />
            </Field>
            <Field label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When should someone use this?" />
            </Field>
          </div>

          <FormSection title="Kop & nomor surat">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kode lampiran" hint="Small reference printed top-left. Leave empty to omit.">
                <Input value={body.lampiranCode} onChange={(e) => set('lampiranCode', e.target.value)} />
              </Field>
              <Field label="Judul kop">
                <Input value={body.headerTitle} onChange={(e) => set('headerTitle', e.target.value)} />
              </Field>
              <Field label="Judul surat">
                <Input value={body.letterTitle} onChange={(e) => set('letterTitle', e.target.value)} />
              </Field>
              <Field label="Pola nomor" required hint="{urut} and {tahun} are filled from the form.">
                <Input value={body.numberPattern} onChange={(e) => set('numberPattern', e.target.value)} className="font-mono text-[12px]" />
              </Field>
              <Field label="Tentang">
                <Input value={body.tentang} onChange={(e) => set('tentang', e.target.value)} />
              </Field>
              <Field label="Jabatan penerbit" required hint="Printed under the title and as the signing office.">
                <Input value={body.issuerTitle} onChange={(e) => set('issuerTitle', e.target.value)} />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Menimbang — poin baku"
            hint="Printed after the case-specific consideration (point 1), which the form supplies."
          >
            <ListEditor
              items={body.menimbangFixed}
              onChange={(v) => set('menimbangFixed', v)}
              numberFrom={2}
              addLabel="Add consideration"
            />
          </FormSection>

          <FormSection title="Dasar — default" hint="Copied into each new order, where it can still be edited for that case.">
            <ListEditor items={body.dasar} onChange={(v) => set('dasar', v)} addLabel="Add legal basis" />
          </FormSection>

          <FormSection title="Memerintahkan" hint={PLACEHOLDER_HINT}>
            <Field label="Kepada">
              <Textarea rows={2} value={body.kepada} onChange={(e) => set('kepada', e.target.value)} className="text-[12px]" />
            </Field>
            <Field label="Untuk — kalimat pembuka">
              <Input value={body.untukIntro} onChange={(e) => set('untukIntro', e.target.value)} />
            </Field>
            <Field label="Untuk poin 1 — awalan" hint="The form completes this sentence with the object of the investigation.">
              <Input value={body.untukObjekPrefix} onChange={(e) => set('untukObjekPrefix', e.target.value)} />
            </Field>
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-ink-2">Untuk — tugas baku</p>
              <ListEditor items={body.untukFixed} onChange={(v) => set('untukFixed', v)} numberFrom={2} addLabel="Add task" />
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-ink-2">Kalimat penutup</p>
              <ListEditor items={body.penutup} onChange={(v) => set('penutup', v)} addLabel="Add closing line" />
            </div>
          </FormSection>

          <FormSection title="Penetapan & lampiran">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tempat ditetapkan (default)">
                <Input value={body.defaultPlace} onChange={(e) => set('defaultPlace', e.target.value)} />
              </Field>
              <Field label="Judul lampiran">
                <Input value={body.lampiranTitle} onChange={(e) => set('lampiranTitle', e.target.value)} />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Susunan tim — peran"
            hint="The roles listed on the attachment, in order. Only app users named in a role that grants access can open the case."
            action={
              <Button
                size="xs"
                variant="ghost"
                icon={<Plus size={11} />}
                onClick={() => set('roles', [...body.roles, { id: uid('role'), label: '', min: 0 }])}
              >
                Add role
              </Button>
            }
          >
            <div className="space-y-2">
              {body.roles.map((r, i) => (
                <div key={r.id} className="rounded-lg border border-line-soft bg-abyss/30 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-[10.5px] text-ink-4 tnum">{i + 1}</span>
                    <Input
                      value={r.label}
                      placeholder="Role name, e.g. Pembina"
                      onChange={(e) => setRole(i, { label: e.target.value })}
                      className="h-8 text-[12px]"
                    />
                    <IconButton label="Move up" size={24} disabled={i === 0} onClick={() => moveRole(i, -1)}>
                      <ChevronUp size={11} />
                    </IconButton>
                    <IconButton label="Move down" size={24} disabled={i === body.roles.length - 1} onClick={() => moveRole(i, 1)}>
                      <ChevronDown size={11} />
                    </IconButton>
                    <IconButton
                      label="Remove role"
                      size={24}
                      className="hover:text-danger"
                      onClick={() => set('roles', body.roles.filter((_, j) => j !== i))}
                    >
                      <X size={11} />
                    </IconButton>
                  </div>
                  <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-[72px_72px_minmax(0,1fr)]">
                    <label className="block">
                      <span className="mb-1 block text-[10.5px] text-ink-4">Min</span>
                      <Input
                        type="number"
                        min={0}
                        value={r.min}
                        onChange={(e) => setRole(i, { min: Math.max(0, Number(e.target.value) || 0) })}
                        className="h-8 text-[12px]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10.5px] text-ink-4">Max</span>
                      <Input
                        type="number"
                        min={1}
                        value={r.max ?? ''}
                        placeholder="∞"
                        onChange={(e) => setRole(i, { max: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })}
                        className="h-8 text-[12px]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10.5px] text-ink-4">Case access</span>
                      <Select
                        className="h-8 text-[12px]"
                        value={r.access ?? ''}
                        onChange={(e) => setRole(i, { access: (e.target.value || undefined) as SprintPosition | undefined })}
                        options={ACCESS_OPTIONS}
                      />
                    </label>
                  </div>
                  <div className="mt-2 pl-6">
                    <Input
                      value={r.hint ?? ''}
                      placeholder="Guidance on the form, e.g. Level Manager"
                      onChange={(e) => setRole(i, { hint: e.target.value })}
                      className="h-8 text-[11.5px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </FormSection>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-0">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">Preview — blank form</p>
            <LetterPreview html={html} className="max-h-[70dvh] overflow-y-auto rounded-lg border border-line-soft" />
          </div>
        </div>
      </div>
    </Modal>
  )
}
