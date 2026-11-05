import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  IdCard,
  Pencil,
  Scale,
  Ship,
  Upload,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { db } from '@/domain/db'
import {
  EDUCATION,
  MARITAL,
  RELIGIONS,
  identityMissing,
  newIdentity,
  openingSentence,
  tanggalPanjang,
} from '@/domain/bapStandard'
import type { Bap, BapIdentity, BapTimezone, Interviewee, Sprint, User } from '@/domain/types'
import { cn, uid } from '@/lib/utils'
import { Avatar, Badge, Button, IconButton, Input, Select, Textarea } from '@/components/ui/primitives'
import { useBlobPreview } from '@/components/ui/BlobPreview'
import { toast } from '@/stores/toast'

/** ISO → value for <input type="datetime-local">, in local time. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
          <span className="text-brand-bright">{icon}</span>
          {title}
        </h4>
        {hint && <p className="mt-1 text-[11px] leading-relaxed text-ink-4">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** A form field whose label marks it as required, highlighted when the
    examination can't start without it. */
function Item({
  label,
  required,
  missing,
  group,
  className,
  children,
}: {
  label: string
  required?: boolean
  missing?: boolean
  /** For a row of buttons: a labelled group, not a <label>, which would
      lend its text to the first button and click it from the caption. */
  group?: boolean
  className?: string
  children: ReactNode
}) {
  const caption = (
    <span className={cn('mb-1.5 block text-[11.5px] font-medium', missing ? 'text-warn' : 'text-ink-2')}>
      {label}
      {required && <span className="ml-1 text-danger">*</span>}
    </span>
  )
  if (group) {
    return (
      <div role="group" aria-label={label} className={cn('block', className)}>
        {caption}
        {children}
      </div>
    )
  }
  return (
    <label className={cn('block', className)}>
      {caption}
      {children}
    </label>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 flex-1 rounded-lg border px-3 text-[12px] transition-colors',
            value === o.value ? 'border-brand/50 bg-brand/12 font-medium text-brand-bright' : 'border-line bg-abyss/40 text-ink-3 hover:border-line-strong',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Step 1 of a BAP: the opening the TKO puts on page 19 — when and where the
 * examination takes place, who examines, on what authority, and who the
 * terperiksa is. The questions stay closed until this is complete.
 */
export function BapIdentityForm({
  bap,
  person,
  users,
  sprint,
  caseTitle,
  onDone,
  onCancel,
}: {
  bap: Bap
  person: Interviewee
  users: User[]
  sprint?: Sprint
  caseTitle: string
  onDone: () => void
  /** Present when editing an identity already completed. */
  onCancel?: () => void
}) {
  const [form, setForm] = useState<BapIdentity>(() => bap.identity ?? newIdentity(person, sprint?.subject || caseTitle))
  const [startedAt, setStartedAt] = useState(() => toLocalInput(bap.startedAt))
  const [location, setLocation] = useState(bap.location === 'Belum ditentukan' ? '' : bap.location)
  const [onBoard, setOnBoard] = useState(!!bap.identity?.vessel)
  const [ktpFile, setKtpFile] = useState<File | null>(null)
  const [showMissing, setShowMissing] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof BapIdentity>(k: K, v: BapIdentity[K]) => setForm((f) => ({ ...f, [k]: v }))
  const startedIso = startedAt ? new Date(startedAt).toISOString() : bap.startedAt
  const missing = identityMissing(form, location)
  const isMissing = (label: string) => showMissing && missing.includes(label)

  const investigators = bap.investigatorIds.map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u)
  const sentence = openingSentence(form, startedIso, location, investigators.map((u) => u.name))

  // KTP photo: the file just picked, or the one already on record.
  const stored = useBlobPreview(ktpFile ? undefined : form.ktpBlobId, form.ktpBlobId ? 'image/*' : undefined)
  const pickedUrl = useMemo(() => (ktpFile ? URL.createObjectURL(ktpFile) : null), [ktpFile])
  useEffect(() => () => void (pickedUrl && URL.revokeObjectURL(pickedUrl)), [pickedUrl])
  const ktpUrl = pickedUrl ?? stored.url

  const save = async (complete: boolean) => {
    if (complete && missing.length > 0) {
      setShowMissing(true)
      toast.error('Identitas belum lengkap', `${missing.length} isian wajib masih kosong.`)
      return
    }
    setSaving(true)
    try {
      let ktpBlobId = form.ktpBlobId
      if (ktpFile) {
        if (ktpBlobId) await db.blobs.delete(ktpBlobId)
        ktpBlobId = uid('blob')
        await db.blobs.add({ id: ktpBlobId, data: ktpFile })
      }
      const identity: BapIdentity = {
        ...form,
        vessel: onBoard ? form.vessel?.trim() || undefined : undefined,
        vesselLocation: onBoard ? form.vesselLocation?.trim() || undefined : undefined,
        ktpBlobId,
        completedAt: complete ? (form.completedAt ?? new Date().toISOString()) : form.completedAt,
      }
      await db.baps.update(bap.id, {
        identity,
        startedAt: startedIso,
        location: location.trim() || 'Belum ditentukan',
        // Filling in the identity is where the examination starts.
        ...(complete && bap.status === 'draft' ? { status: 'in_progress' as const } : {}),
        updatedAt: new Date().toISOString(),
      })
      toast.success(complete ? 'Identitas tersimpan' : 'Draft disimpan', complete ? 'Pemeriksaan dapat dimulai.' : undefined)
      if (complete) onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-line-soft">
      <div className="space-y-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-brand-bright">Langkah 1 dari 2</p>
            <h3 className="mt-1 text-[15px] font-semibold text-ink">Identitas Terperiksa</h3>
            <p className="mt-1 max-w-[560px] text-[11.5px] leading-relaxed text-ink-4">
              Pembukaan BAP sesuai Lampiran 6 TKO B14-002. Diisi bersama terperiksa sebelum pertanyaan pertama — pertanyaan
              pemeriksaan terbuka setelah form ini lengkap.
            </p>
          </div>
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Batal
            </Button>
          )}
        </div>

        {/* A ─ When & where */}
        <Section icon={<CalendarClock size={12} />} title="Waktu & tempat pemeriksaan">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
            <Item label="Hari, tanggal & pukul" required>
              <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
            </Item>
            <Item label="Zona waktu" required group>
              <Segmented<BapTimezone>
                value={form.timezone}
                onChange={(v) => set('timezone', v)}
                options={[
                  { value: 'WIB', label: 'WIB' },
                  { value: 'WITA', label: 'WITA' },
                  { value: 'WIT', label: 'WIT' },
                ]}
              />
            </Item>
          </div>
          <Item label="Bertempat di" required missing={isMissing('Tempat pemeriksaan')}>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="mis. Kantor PT PIS Jakarta — Ruang Rapat 4B" />
          </Item>
          <div className="rounded-lg border border-line-soft bg-abyss/25 p-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-ink-2">
              <input type="checkbox" checked={onBoard} onChange={(e) => setOnBoard(e.target.checked)} className="size-4 accent-[#3B82F6]" />
              <Ship size={13} className="text-ink-3" /> Pemeriksaan dilakukan di atas kapal
            </label>
            {onBoard && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Item label="Nama kapal">
                  <Input value={form.vessel ?? ''} onChange={(e) => set('vessel', e.target.value)} placeholder="mis. MT Gamalama" />
                </Item>
                <Item label="Posisi kapal (di …)">
                  <Input value={form.vesselLocation ?? ''} onChange={(e) => set('vesselLocation', e.target.value)} placeholder="mis. Pelabuhan Tanjung Priok" />
                </Item>
              </div>
            )}
          </div>
        </Section>

        {/* B ─ Who examines, on what authority */}
        <Section icon={<Scale size={12} />} title="Pemeriksa & dasar pemeriksaan" hint="Diambil dari BAP dan SPRINT perkara.">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1.5 rounded-lg border border-line-soft bg-abyss/25 p-3">
              {investigators.length === 0 && <p className="text-[11.5px] text-warn">Belum ada pemeriksa pada BAP ini.</p>}
              {investigators.map((u, i) => (
                <div key={u.id} className="flex items-center gap-2.5">
                  <Avatar src={u.avatar} name={u.name} size={24} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-ink">{u.name}</p>
                    <p className="truncate text-[10.5px] text-ink-4">{u.title}</p>
                  </div>
                  <Badge color={i === 0 ? '#3B82F6' : '#6A7FA3'} size="sm">
                    {i === 0 ? 'Investigator' : 'Pendamping'}
                  </Badge>
                </div>
              ))}
            </div>
            <ol className="list-decimal space-y-1 rounded-lg border border-line-soft bg-abyss/25 py-3 pl-7 pr-3 text-[11px] leading-relaxed text-ink-3">
              <li>Kpts Direktur Utama Pertamina No. 66/C00000/2012-S0 tentang kewenangan pembuatan BAP oleh Fungsi Security.</li>
              <li>Kpts Direksi PT Pertamina No. 47/C00000/2019-S0 tentang Kebijakan Pokok Pengawasan.</li>
              <li>
                {sprint ? (
                  <>
                    Surat Perintah VP HSSE PT PIS No. <span className="text-ink-2 tnum">{sprint.number}</span> tanggal{' '}
                    {tanggalPanjang(sprint.issuedAt)} perihal {sprint.subject}.
                  </>
                ) : (
                  <span className="text-warn">Perkara ini belum memiliki SPRINT.</span>
                )}
              </li>
            </ol>
          </div>
        </Section>

        {/* C ─ The terperiksa */}
        <Section icon={<UserRound size={12} />} title="Identitas terperiksa">
          <div className="grid gap-3 sm:grid-cols-2">
            <Item label="Nama lengkap" required missing={isMissing('Nama lengkap')} className="sm:col-span-2">
              <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Sesuai KTP" />
            </Item>
            <Item label="Jenis kelamin" required missing={isMissing('Jenis kelamin')} group>
              <Segmented<BapIdentity['gender']>
                value={form.gender}
                onChange={(v) => set('gender', v)}
                options={[
                  { value: 'laki-laki', label: 'Laki-laki' },
                  { value: 'perempuan', label: 'Perempuan' },
                ]}
              />
            </Item>
            <Item label="Kewarganegaraan" required missing={isMissing('Kewarganegaraan')}>
              <Input value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
            </Item>
            <Item label="Tempat lahir" required missing={isMissing('Tempat lahir')}>
              <Input value={form.birthPlace} onChange={(e) => set('birthPlace', e.target.value)} placeholder="Kota" />
            </Item>
            <Item label="Tanggal lahir" required missing={isMissing('Tanggal lahir')}>
              <Input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
            </Item>
            <Item label="Agama" required missing={isMissing('Agama')}>
              <Select
                value={form.religion}
                onChange={(e) => set('religion', e.target.value)}
                options={[{ value: '', label: '— Pilih —' }, ...RELIGIONS.map((r) => ({ value: r, label: r }))]}
              />
            </Item>
            <Item label="Status" required missing={isMissing('Status')}>
              <Select
                value={form.maritalStatus}
                onChange={(e) => set('maritalStatus', e.target.value)}
                options={[{ value: '', label: '— Pilih —' }, ...MARITAL.map((r) => ({ value: r, label: r }))]}
              />
            </Item>
            <Item label="Pendidikan terakhir" required missing={isMissing('Pendidikan')}>
              <Select
                value={form.education}
                onChange={(e) => set('education', e.target.value)}
                options={[{ value: '', label: '— Pilih —' }, ...EDUCATION.map((r) => ({ value: r, label: r }))]}
              />
            </Item>
            <Item label="Pekerjaan" required missing={isMissing('Pekerjaan')}>
              <Input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} placeholder="mis. Pelaut, Karyawan swasta" />
            </Item>
            <Item label="Jabatan" required missing={isMissing('Jabatan')}>
              <Input value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="mis. Chief Officer" />
            </Item>
            <Item label="Perusahaan" required missing={isMissing('Perusahaan')}>
              <Input value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="PT … (ship owner)" />
            </Item>
            <Item label="Alamat tempat tinggal" required missing={isMissing('Alamat tempat tinggal')} className="sm:col-span-2">
              <Textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Alamat lengkap" />
            </Item>
          </div>

          {/* KTP */}
          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-ink-2">
              <IdCard size={12} /> Foto KTP <span className="font-normal text-ink-4">(opsional)</span>
            </span>
            {ktpUrl ? (
              <div className="relative inline-block">
                <img src={ktpUrl} alt="KTP" className="h-[120px] rounded-lg border border-line object-cover" />
                <div className="absolute right-1.5 top-1.5 flex gap-1">
                  <IconButton label="Ganti foto" size={24} className="bg-void/80" onClick={() => fileRef.current?.click()}>
                    <Pencil size={11} />
                  </IconButton>
                  <IconButton
                    label="Hapus foto"
                    size={24}
                    className="bg-void/80 hover:text-danger"
                    onClick={() => {
                      setKtpFile(null)
                      set('ktpBlobId', undefined)
                    }}
                  >
                    <X size={11} />
                  </IconButton>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-[88px] w-full max-w-[260px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-strong bg-abyss/35 text-[11.5px] text-ink-3 transition-colors hover:border-brand/60 hover:text-brand-bright"
              >
                <Upload size={15} />
                <span className="mt-1">Unggah foto KTP</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                setKtpFile(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </div>
        </Section>

        {/* D ─ What the examination is about */}
        <Section icon={<Users size={12} />} title="Diperiksa sebagai terperiksa sehubungan dengan">
          <Item label="Permasalahan" required missing={isMissing('Permasalahan')}>
            <Textarea rows={2} value={form.matter} onChange={(e) => set('matter', e.target.value)} placeholder="Permasalahan yang diperiksa" />
          </Item>
        </Section>

        {/* Live preview of how the BAP opens */}
        <div className="rounded-xl border border-brand/25 bg-brand/5 p-4">
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-brand-bright">Pratinjau pembukaan BAP</p>
          <p className="font-serif text-[13px] leading-relaxed text-ink-2">{sentence}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft bg-abyss/25 px-5 py-3.5">
        <button
          type="button"
          onClick={() => setShowMissing(true)}
          className={cn('mr-auto flex items-center gap-1.5 text-[11.5px]', missing.length ? 'text-warn' : 'text-ok')}
        >
          {missing.length ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
          {missing.length ? `${missing.length} isian wajib belum diisi` : 'Identitas lengkap'}
        </button>
        <Button variant="ghost" onClick={() => save(false)} loading={saving}>
          Simpan draft
        </Button>
        <Button variant="primary" icon={<ArrowRight size={13} />} onClick={() => save(true)} loading={saving}>
          {bap.identity?.completedAt ? 'Simpan identitas' : 'Mulai pemeriksaan'}
        </Button>
      </div>
      {showMissing && missing.length > 0 && (
        <p className="border-t border-line-soft bg-warn/6 px-5 py-2.5 text-[11px] leading-relaxed text-ink-3">
          Belum diisi: {missing.join(', ')}.
        </p>
      )}
    </div>
  )
}

/** The completed identity, folded into a summary above the questions. */
export function BapIdentitySummary({
  bap,
  editable,
  onEdit,
}: {
  bap: Bap
  editable: boolean
  onEdit: () => void
}) {
  const i = bap.identity
  const ktp = useBlobPreview(i?.ktpBlobId, i?.ktpBlobId ? 'image/*' : undefined)

  if (!i) {
    return (
      <div className="border-t border-line-soft px-5 py-3 text-[11.5px] text-ink-4">
        Identitas terperiksa tidak tercatat pada BAP ini.
      </div>
    )
  }

  const facts: [string, string][] = [
    ['Jenis kelamin', i.gender],
    ['Tempat / tgl. lahir', `${i.birthPlace}, ${i.birthDate ? tanggalPanjang(`${i.birthDate}T00:00:00`) : '—'}`],
    ['Agama', i.religion],
    ['Status', i.maritalStatus],
    ['Kewarganegaraan', i.nationality],
    ['Pendidikan', i.education],
    ['Pekerjaan', i.occupation],
    ['Jabatan', `${i.position} — ${i.company}`],
    ['Alamat', i.address],
  ]

  return (
    <div className="border-t border-line-soft p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
          <CheckCircle2 size={12} className="text-ok" /> Identitas terperiksa
        </h4>
        {editable && (
          <Button size="xs" variant="ghost" icon={<Pencil size={11} />} onClick={onEdit}>
            Ubah
          </Button>
        )}
      </div>
      <div className="flex gap-4">
        <dl className="grid min-w-0 flex-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="flex min-w-0 gap-2 text-[11.5px]">
              <dt className="w-[112px] shrink-0 text-ink-4">{k}</dt>
              <dd className="min-w-0 break-words text-ink-2">{v || '—'}</dd>
            </div>
          ))}
        </dl>
        {ktp.url && <img src={ktp.url} alt="KTP" className="hidden h-[84px] shrink-0 rounded-md border border-line object-cover sm:block" />}
      </div>
      <p className="mt-3 rounded-lg border border-line-soft bg-abyss/25 px-3 py-2 text-[11.5px] leading-relaxed text-ink-3">
        Diperiksa sehubungan dengan <span className="text-ink-2">{i.matter}</span>
        {i.vessel && (
          <>
            {' '}
            · di atas Kapal <span className="text-ink-2">{i.vessel}</span>
            {i.vesselLocation ? ` (${i.vesselLocation})` : ''}
          </>
        )}
        {' '}· zona waktu {i.timezone}
      </p>
    </div>
  )
}
