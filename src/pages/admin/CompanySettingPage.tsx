import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Building2, Check, Database, RotateCcw, Save, Shield, Upload, X } from 'lucide-react'
import { db, resetDatabase } from '@/domain/db'
import type { CompanySettings } from '@/domain/types'
import { cn } from '@/lib/utils'
import { Button, Card, Input, Select, Switch } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { AdminSection, AdminShell } from './AdminShell'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'

const BRAND_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']

export function CompanySettingPage() {
  const saved = useLiveQuery(() => db.settings.get('settings'), [])
  const [draft, setDraft] = useState<CompanySettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (saved && !draft) setDraft(saved)
  }, [saved, draft])

  if (!saved || !draft) return <PageSpinner />

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) => setDraft({ ...draft, [k]: v })

  const save = async () => {
    setSaving(true)
    try {
      await db.settings.put(draft)
      await db.activities.add({
        id: `ac-${Date.now()}`,
        actorId: 'u-jason',
        verb: 'updated',
        object: 'company settings',
        at: new Date().toISOString(),
        kind: 'admin',
      })
      toast.success('Settings saved', 'Changes apply across the workspace.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      title="Company Setting"
      description="Workspace identity, case numbering, retention and security defaults. These apply to every case in CaseNavigator."
      actions={
        <>
          {dirty && (
            <Button variant="ghost" icon={<X size={13} />} onClick={() => setDraft(saved)}>
              Discard
            </Button>
          )}
          <Button variant="primary" icon={<Save size={13} />} onClick={save} loading={saving} disabled={!dirty}>
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        </>
      }
    >
      {/* Identity */}
      <AdminSection title="Organisation">
        <Card className="p-5">
          <div className="flex flex-wrap items-start gap-5">
            <div className="shrink-0">
              <button
                onClick={() => logoRef.current?.click()}
                className="group relative flex size-[86px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-abyss/50 transition-colors hover:border-brand/50"
              >
                {draft.logoDataUrl ? (
                  <img src={draft.logoDataUrl} alt="Company logo" className="size-full object-cover" />
                ) : (
                  <Building2 size={26} className="text-ink-4 transition-colors group-hover:text-brand-bright" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-void/75 opacity-0 transition-opacity group-hover:opacity-100">
                  <Upload size={16} className="text-brand-bright" />
                </span>
              </button>
              <p className="mt-2 text-center text-[10px] text-ink-4">Logo</p>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const reader = new FileReader()
                  reader.onload = () => set('logoDataUrl', reader.result as string)
                  reader.readAsDataURL(f)
                  e.target.value = ''
                }}
              />
            </div>

            <div className="min-w-[280px] flex-1 space-y-3.5">
              <Field label="Display name">
                <Input value={draft.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field label="Legal name" hint="Appears on report letterheads and exports.">
                <Input value={draft.legalName} onChange={(e) => set('legalName', e.target.value)} />
              </Field>
              <Field label="Registered address">
                <Input value={draft.address} onChange={(e) => set('address', e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>
      </AdminSection>

      {/* Locale + numbering */}
      <AdminSection title="Cases &amp; Locale">
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Case code prefix" hint={`Next case will be ${draft.caseCodePrefix}-${new Date().getFullYear()}-0XX`}>
              <Input value={draft.caseCodePrefix} onChange={(e) => set('caseCodePrefix', e.target.value.toUpperCase().slice(0, 5))} />
            </Field>
            <Field label="Timezone">
              <Select
                value={draft.timezone}
                onChange={(e) => set('timezone', e.target.value)}
                options={[
                  { value: 'America/New_York', label: 'America/New_York (ET)' },
                  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
                  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
                  { value: 'Europe/London', label: 'Europe/London (GMT)' },
                  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB)' },
                  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
                ]}
              />
            </Field>
            <Field label="Date format">
              <Select
                value={draft.dateFormat}
                onChange={(e) => set('dateFormat', e.target.value)}
                options={[
                  { value: 'DD MMM YYYY', label: 'DD MMM YYYY — 15 Jul 2026' },
                  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY — 07/15/2026' },
                  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY — 15/07/2026' },
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD — 2026-07-15' },
                ]}
              />
            </Field>
            <Field label="Retention period" hint={`${(draft.retentionDays / 365).toFixed(1)} years. Closed cases are purged after this.`}>
              <Input
                type="number"
                min={30}
                max={7300}
                value={draft.retentionDays}
                onChange={(e) => set('retentionDays', Number(e.target.value))}
                suffix={<span className="text-[11px]">days</span>}
              />
            </Field>
          </div>

          <div className="mt-4">
            <span className="mb-2 block text-[12px] font-medium text-ink-2">Accent colour</span>
            <div className="flex flex-wrap gap-2">
              {BRAND_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set('primaryColor', c)}
                  aria-label={c}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg border-2 transition-transform hover:scale-110',
                    draft.primaryColor === c ? 'border-tint/60' : 'border-transparent',
                  )}
                  style={{ background: c }}
                >
                  {draft.primaryColor === c && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </AdminSection>

      {/* Security */}
      <AdminSection title="Security">
        <Card className="divide-y divide-line-soft/70">
          <ToggleRow
            icon={<Shield size={15} />}
            title="Require two-factor authentication"
            description="Every member must complete a second factor at sign-in. Recommended for workspaces handling case material."
            checked={draft.requireTwoFactor}
            onChange={(v) => set('requireTwoFactor', v)}
          />
          <ToggleRow
            icon={<AlertTriangle size={15} />}
            title="Watermark exports"
            description="Stamps the recipient's name and a timestamp on exported reports and decks, so a leaked copy is traceable."
            checked={draft.watermarkExports}
            onChange={(v) => set('watermarkExports', v)}
          />
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-3">
                <Database size={15} />
              </span>
              <div>
                <p className="text-[12.5px] font-medium text-ink">Auto-lock after inactivity</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
                  Locks the session on an unattended screen. Set to 0 to disable.
                </p>
              </div>
            </div>
            <div className="w-[104px] shrink-0">
              <Input
                type="number"
                min={0}
                max={240}
                value={draft.autoLockMinutes}
                onChange={(e) => set('autoLockMinutes', Number(e.target.value))}
                suffix={<span className="text-[10.5px]">min</span>}
              />
            </div>
          </div>
        </Card>
      </AdminSection>

      {/* Data */}
      <AdminSection title="Local Data">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-warn/30 bg-warn/10 text-warn">
                <RotateCcw size={15} />
              </span>
              <div className="max-w-[520px]">
                <p className="text-[12.5px] font-medium text-ink">Reset demo data</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
                  CaseNavigator stores everything in this browser (IndexedDB) — nothing is sent to a server. Resetting
                  wipes your edits and uploads, and restores the seeded CN-2026-014 investigation.
                </p>
              </div>
            </div>
            <Button variant="danger" icon={<RotateCcw size={13} />} onClick={() => setResetOpen(true)}>
              Reset
            </Button>
          </div>
        </Card>
      </AdminSection>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all local data?"
        description="This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetDatabase()
                toast.success('Data reset', 'The seeded investigation has been restored.')
                setResetOpen(false)
                window.location.reload()
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Every case, uploaded evidence file, slide edit and report change you have made in this browser will be
          deleted and replaced with the original seed data.
        </p>
      </Modal>
    </AdminShell>
  )
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-3">
          {icon}
        </span>
        <div className="max-w-[560px]">
          <p className="text-[12.5px] font-medium text-ink">{title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-4">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  )
}
