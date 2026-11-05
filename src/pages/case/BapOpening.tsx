import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSignature,
  IdCard,
  Landmark,
  PenLine,
  Pencil,
  Plus,
  Radio,
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
  companionsOf,
  defaultBases,
  examinerOf,
  identityFrom,
  masterBases,
  openingSentence,
  personMissing,
  reportBasisText,
  sprintBasisText,
  tanggalPanjang,
} from '@/domain/bapStandard'
import type {
  Bap,
  BapBasis,
  BapIdentity,
  BapTimezone,
  Interviewee,
  IntervieweeKind,
  QuestionSet,
  ReportSource,
  Sprint,
  User,
} from '@/domain/types'
import { cn, uid } from '@/lib/utils'
import { Avatar, Badge, Button, IconButton, Input, Select, Textarea } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useBlobPreview } from '@/components/ui/BlobPreview'
import { toast } from '@/stores/toast'
import { useSession } from '@/stores/session'

/**
 * The opening of a Berita Acara Pemeriksaan (TKO B14-002 Lampiran 6, page 19),
 * split where the work splits:
 *  - who the terperiksa is — recorded once, when they are added to the case;
 *  - the examination itself — when, where, by whom, on what authority and
 *    about what — recorded when each BAP is opened.
 */

export const KIND_LABEL: Record<IntervieweeKind, string> = {
  terlapor: 'Terlapor',
  saksi: 'Saksi',
  pelapor: 'Pelapor',
  ahli: 'Ahli',
}

/* ------------------------------------------------------------- Shared bits */

function Section({ icon, title, hint, action, children }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
            <span className="text-brand-bright">{icon}</span>
            {title}
          </h4>
          {hint && <p className="mt-1 text-[11px] leading-relaxed text-ink-4">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * A labelled field. A row of buttons uses `group`: wrapping buttons in a
 * <label> would lend the label's text to the first button and click it from
 * the caption.
 */
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

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
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

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/* ----------------------------------------------------- Terperiksa form */

type PersonDraft = Omit<Interviewee, 'id' | 'caseId' | 'createdAt'>

/**
 * Adding — or correcting — a terperiksa: the identity the BAP opens with,
 * taken down once and reused for every examination of this person.
 */
export function TerperiksaFormModal({
  caseId,
  person,
  onClose,
  onSaved,
}: {
  caseId: string
  /** The terperiksa being corrected. Absent = adding one. */
  person?: Interviewee
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const nodes = useLiveQuery(() => db.nodes.where('caseId').equals(caseId).toArray(), [caseId], [])
  const people = nodes.filter((n) => n.kind === 'person' || n.kind === 'witness')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<PersonDraft>(() => ({
    name: person?.name ?? '',
    kind: person?.kind ?? 'saksi',
    position: person?.position === '—' ? '' : (person?.position ?? ''),
    identityNo: person?.identityNo,
    phone: person?.phone,
    address: person?.address,
    nodeId: person?.nodeId,
    gender: person?.gender,
    birthPlace: person?.birthPlace,
    birthDate: person?.birthDate,
    religion: person?.religion,
    maritalStatus: person?.maritalStatus,
    nationality: person?.nationality ?? 'Indonesia',
    education: person?.education,
    occupation: person?.occupation,
    company: person?.company,
    ktpBlobId: person?.ktpBlobId,
  }))
  const [ktpFile, setKtpFile] = useState<File | null>(null)
  const [showMissing, setShowMissing] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof PersonDraft>(k: K, v: PersonDraft[K]) => setForm((f) => ({ ...f, [k]: v }))
  const missing = personMissing(form)
  const isMissing = (label: string) => showMissing && missing.includes(label)

  const stored = useBlobPreview(ktpFile ? undefined : form.ktpBlobId, form.ktpBlobId ? 'image/*' : undefined)
  const pickedUrl = useMemo(() => (ktpFile ? URL.createObjectURL(ktpFile) : null), [ktpFile])
  useEffect(() => () => void (pickedUrl && URL.revokeObjectURL(pickedUrl)), [pickedUrl])
  const ktpUrl = pickedUrl ?? stored.url

  const save = async () => {
    if (missing.length > 0) {
      setShowMissing(true)
      toast.error('Data terperiksa belum lengkap', `${missing.length} isian wajib masih kosong.`)
      return
    }
    setSaving(true)
    try {
      let ktpBlobId = form.ktpBlobId
      if (ktpFile) {
        if (ktpBlobId) await db.blobs.delete(ktpBlobId)
        ktpBlobId = uid('blob')
        await db.blobs.add({ id: ktpBlobId, data: ktpFile })
      } else if (!ktpBlobId && person?.ktpBlobId) {
        await db.blobs.delete(person.ktpBlobId)
      }
      const trim = (v?: string) => v?.trim() || undefined
      const record = {
        ...form,
        name: form.name.trim(),
        position: form.position.trim(),
        identityNo: trim(form.identityNo),
        phone: trim(form.phone),
        address: trim(form.address),
        nodeId: form.nodeId || undefined,
        ktpBlobId,
      }
      if (person) {
        await db.interviewees.update(person.id, record)
        toast.success('Data terperiksa diperbarui', `${record.name}. BAP yang sudah dibuka menyimpan data saat dibuka.`)
        onSaved?.(person.id)
      } else {
        const id = uid('iv')
        await db.interviewees.add({ id, caseId, createdAt: new Date().toISOString(), ...record })
        toast.success('Terperiksa ditambahkan', `${record.name} siap diperiksa.`)
        onSaved?.(id)
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
      size="lg"
      title={person ? `Data terperiksa — ${person.name}` : 'Add terperiksa'}
      description="Identitas terperiksa sesuai pembukaan BAP (Lampiran 6 TKO B14-002). Dicatat sekali dan dipakai di setiap BAP orang ini."
      footer={
        <>
          <button
            type="button"
            onClick={() => setShowMissing(true)}
            className={cn('mr-auto flex items-center gap-1.5 text-[11.5px]', missing.length ? 'text-warn' : 'text-ok')}
          >
            {missing.length ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
            {missing.length ? `${missing.length} isian wajib belum diisi` : 'Data lengkap'}
          </button>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {person ? 'Simpan' : 'Add terperiksa'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {showMissing && missing.length > 0 && (
          <p className="rounded-lg border border-warn/35 bg-warn/8 px-3 py-2 text-[11.5px] leading-relaxed text-ink-3">
            Belum diisi: {missing.join(', ')}.
          </p>
        )}

        <Section icon={<Users size={12} />} title="Terperiksa dalam perkara">
          <div className="grid gap-3 sm:grid-cols-2">
            <Item label="Nama lengkap" required missing={isMissing('Nama lengkap')} className="sm:col-span-2">
              <Input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Sesuai KTP" />
            </Item>
            <Item label="Diperiksa sebagai" group>
              <Segmented<IntervieweeKind>
                value={form.kind}
                onChange={(v) => set('kind', v)}
                options={(Object.keys(KIND_LABEL) as IntervieweeKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
              />
            </Item>
            <Item label="Entitas pada graph">
              <Select
                value={form.nodeId ?? ''}
                onChange={(e) => set('nodeId', e.target.value || undefined)}
                options={[{ value: '', label: '— Tidak ditautkan —' }, ...people.map((n) => ({ value: n.id, label: `${n.label} · ${n.sublabel}` }))]}
              />
            </Item>
          </div>
        </Section>

        <Section icon={<UserRound size={12} />} title="Identitas">
          <div className="grid gap-3 sm:grid-cols-2">
            <Item label="Jenis kelamin" required missing={isMissing('Jenis kelamin')} group>
              <Segmented<NonNullable<Interviewee['gender']> | ''>
                value={form.gender ?? ''}
                onChange={(v) => set('gender', v || undefined)}
                options={[
                  { value: 'laki-laki', label: 'Laki-laki' },
                  { value: 'perempuan', label: 'Perempuan' },
                ]}
              />
            </Item>
            <Item label="Kewarganegaraan" required missing={isMissing('Kewarganegaraan')}>
              <Input value={form.nationality ?? ''} onChange={(e) => set('nationality', e.target.value)} />
            </Item>
            <Item label="Tempat lahir" required missing={isMissing('Tempat lahir')}>
              <Input value={form.birthPlace ?? ''} onChange={(e) => set('birthPlace', e.target.value)} placeholder="Kota" />
            </Item>
            <Item label="Tanggal lahir" required missing={isMissing('Tanggal lahir')}>
              <Input type="date" value={form.birthDate ?? ''} onChange={(e) => set('birthDate', e.target.value)} />
            </Item>
            <Item label="Agama" required missing={isMissing('Agama')}>
              <Select
                value={form.religion ?? ''}
                onChange={(e) => set('religion', e.target.value)}
                options={[{ value: '', label: '— Pilih —' }, ...RELIGIONS.map((r) => ({ value: r, label: r }))]}
              />
            </Item>
            <Item label="Status" required missing={isMissing('Status')}>
              <Select
                value={form.maritalStatus ?? ''}
                onChange={(e) => set('maritalStatus', e.target.value)}
                options={[{ value: '', label: '— Pilih —' }, ...MARITAL.map((r) => ({ value: r, label: r }))]}
              />
            </Item>
            <Item label="Pendidikan terakhir" required missing={isMissing('Pendidikan')}>
              <Select
                value={form.education ?? ''}
                onChange={(e) => set('education', e.target.value)}
                options={[{ value: '', label: '— Pilih —' }, ...EDUCATION.map((r) => ({ value: r, label: r }))]}
              />
            </Item>
            <Item label="Nomor identitas (NIK / nomor pekerja)">
              <Input value={form.identityNo ?? ''} onChange={(e) => set('identityNo', e.target.value)} />
            </Item>
          </div>
        </Section>

        <Section icon={<FileSignature size={12} />} title="Pekerjaan & alamat">
          <div className="grid gap-3 sm:grid-cols-2">
            <Item label="Pekerjaan" required missing={isMissing('Pekerjaan')}>
              <Input value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} placeholder="mis. Pelaut, Karyawan swasta" />
            </Item>
            <Item label="Jabatan" required missing={isMissing('Jabatan')}>
              <Input value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="mis. Chief Officer" />
            </Item>
            <Item label="Perusahaan" required missing={isMissing('Perusahaan')}>
              <Input value={form.company ?? ''} onChange={(e) => set('company', e.target.value)} placeholder="PT … (ship owner)" />
            </Item>
            <Item label="Telepon">
              <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+62…" />
            </Item>
            <Item label="Alamat tempat tinggal" required missing={isMissing('Alamat tempat tinggal')} className="sm:col-span-2">
              <Textarea rows={2} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} placeholder="Alamat lengkap" />
            </Item>
          </div>

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
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------- Investigator picker */

/**
 * Pick from the investigators the SPRINT names, or from anyone else when the
 * examination calls for it. `multiple` picks companions; otherwise one person.
 */
function PersonPicker({
  users,
  sprintUserIds,
  value,
  onChange,
  multiple,
  exclude = [],
}: {
  users: User[]
  sprintUserIds: Set<string>
  value: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean
  exclude?: string[]
}) {
  const [showOthers, setShowOthers] = useState(() => value.some((id) => !sprintUserIds.has(id)))
  const pool = users.filter((u) => u.active && !exclude.includes(u.id))
  const onSprint = pool.filter((u) => sprintUserIds.has(u.id))
  const others = pool.filter((u) => !sprintUserIds.has(u.id))

  const toggle = (id: string) => {
    if (!multiple) return onChange([id])
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }

  const row = (u: User, outside: boolean) => {
    const on = value.includes(u.id)
    return (
      <button
        key={u.id}
        type="button"
        onClick={() => toggle(u.id)}
        className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors', on ? 'bg-brand/10' : 'hover:bg-tint/6')}
      >
        <span
          className={cn(
            'flex size-4 shrink-0 items-center justify-center border',
            multiple ? 'rounded' : 'rounded-full',
            on ? 'border-brand bg-brand text-white' : 'border-line-strong',
          )}
        >
          {on && (multiple ? <CheckCircle2 size={9} /> : <span className="size-1.5 rounded-full bg-white" />)}
        </span>
        <Avatar src={u.avatar} name={u.name} size={22} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] text-ink">{u.name}</span>
          <span className="block truncate text-[10px] text-ink-4">{u.title}</span>
        </span>
        {outside && (
          <Badge color="#F59E0B" size="sm">
            Di luar SPRINT
          </Badge>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-1 rounded-lg border border-line bg-abyss/35 p-2">
      {onSprint.length > 0 ? (
        <>
          <p className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-4">Investigator pada SPRINT</p>
          {onSprint.map((u) => row(u, false))}
        </>
      ) : (
        <p className="px-2 py-1.5 text-[11px] text-warn">Belum ada investigator pada SPRINT aktif.</p>
      )}
      {others.length > 0 &&
        (showOthers ? (
          <>
            <p className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-4">Lainnya</p>
            {others.map((u) => row(u, true))}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowOthers(true)}
            className="w-full rounded-lg px-2 py-1.5 text-left text-[11.5px] text-ink-3 transition-colors hover:bg-tint/6 hover:text-brand-bright"
          >
            + Pilih dari pengguna lain ({others.length})
          </button>
        ))}
    </div>
  )
}

/* ------------------------------------------------------ Dasar pemeriksaan */

const BASIS_META: Record<BapBasis['source'], { label: string; color: string; icon: typeof Scale }> = {
  master: { label: 'Master data', color: '#6A7FA3', icon: Landmark },
  sprint: { label: 'SPRINT', color: '#3B82F6', icon: FileSignature },
  report: { label: 'Sumber laporan', color: '#F59E0B', icon: Radio },
  custom: { label: 'Isian sendiri', color: '#A855F7', icon: PenLine },
}

/** Everything a BAP's dasar can be drawn from. */
interface BasisOption {
  key: string
  source: BapBasis['source']
  title: string
  text: string
}

function BasisEditor({ value, onChange, options }: { value: BapBasis[]; onChange: (next: BapBasis[]) => void; options: BasisOption[] }) {
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menu])

  const used = new Set(value.map((b) => b.text.trim()))
  const free = options.filter((o) => !used.has(o.text.trim()))
  const groups: BapBasis['source'][] = ['master', 'sprint', 'report']

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-[11.5px] text-warn">Belum ada dasar pemeriksaan.</p>}
      {value.map((b, i) => {
        const meta = BASIS_META[b.source]
        return (
          <div key={b.id} className="flex items-start gap-2 rounded-lg border border-line-soft bg-abyss/30 p-2">
            <span className="mt-1.5 w-5 shrink-0 text-right text-[11px] text-ink-4 tnum">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <Badge color={meta.color} size="sm">
                <meta.icon size={9} /> {meta.label}
              </Badge>
              {b.source === 'custom' ? (
                <Textarea
                  rows={2}
                  autoFocus={!b.text}
                  value={b.text}
                  placeholder="Tulis dasar pemeriksaan…"
                  onChange={(e) => onChange(value.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))}
                  className="mt-1.5 text-[12px]"
                />
              ) : (
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{b.text}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col">
              <IconButton label="Naikkan" size={22} disabled={i === 0} onClick={() => move(i, -1)}>
                <ChevronUp size={11} />
              </IconButton>
              <IconButton label="Turunkan" size={22} disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                <ChevronDown size={11} />
              </IconButton>
              <IconButton label="Hapus dasar" size={22} className="hover:text-danger" onClick={() => onChange(value.filter((x) => x.id !== b.id))}>
                <X size={11} />
              </IconButton>
            </div>
          </div>
        )
      })}

      <div ref={ref} className="relative">
        <Button size="sm" variant="outline" icon={<Plus size={12} />} onClick={() => setMenu((v) => !v)}>
          Tambah dasar
          <ChevronDown size={11} className={cn('transition-transform', menu && 'rotate-180')} />
        </Button>
        {menu && (
          <div className="glass-strong absolute left-0 top-[calc(100%+6px)] z-50 max-h-[320px] w-[min(460px,80vw)] overflow-y-auto rounded-xl p-1.5 shadow-[var(--shadow-panel)] animate-scale-in origin-top-left">
            {groups.map((g) => {
              const items = free.filter((o) => o.source === g)
              const all = options.filter((o) => o.source === g)
              if (all.length === 0) return null
              const meta = BASIS_META[g]
              return (
                <div key={g} className="mb-1">
                  <p className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-4">
                    <meta.icon size={10} /> {meta.label}
                  </p>
                  {items.length === 0 && <p className="px-2 pb-1.5 text-[11px] text-ink-4">Semua sudah ditambahkan.</p>}
                  {items.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => {
                        onChange([...value, { id: uid('bb'), source: o.source, text: o.text }])
                        setMenu(false)
                      }}
                      className="block w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-tint/6"
                    >
                      <span className="block text-[11.5px] font-medium text-ink-2">{o.title}</span>
                      <span className="line-clamp-2 block text-[10.5px] leading-snug text-ink-4">{o.text}</span>
                    </button>
                  ))}
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => {
                onChange([...value, { id: uid('bb'), source: 'custom', text: '' }])
                setMenu(false)
              }}
              className="flex w-full items-center gap-2 rounded-lg border-t border-line-soft px-2 py-2 text-left text-[11.5px] text-brand-bright transition-colors hover:bg-tint/6"
            >
              <PenLine size={12} /> Tulis sendiri
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------- BAP opening form */

/**
 * Opening — or amending the opening of — a BAP: number and question set,
 * when and where, the examiner and any companions, the bases it rests on,
 * and what it is about. The terperiksa's identity comes from their record.
 */
export function BapOpeningModal({
  caseId,
  person,
  bap,
  users,
  sets,
  sprintUserIds,
  sprint,
  reportSources,
  caseTitle,
  existing,
  onEditPerson,
  onClose,
}: {
  caseId: string
  person: Interviewee
  /** The BAP whose opening is amended. Absent = a new BAP. */
  bap?: Bap
  users: User[]
  sets: QuestionSet[]
  sprintUserIds: Set<string>
  sprint?: Sprint
  reportSources: ReportSource[]
  caseTitle: string
  /** BAPs already on the case — numbers the next one. */
  existing: number
  onEditPerson: () => void
  onClose: () => void
}) {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const userId = useSession((st) => st.userId)
  // The examiner defaults to whoever opens the BAP, when the SPRINT names
  // them; otherwise the first investigator it names.
  const defaultExaminer = sprintUserIds.has(userId) ? userId : (users.find((u) => sprintUserIds.has(u.id))?.id ?? '')

  const [number, setNumber] = useState(bap?.number ?? `BAP-${String(existing + 1).padStart(2, '0')}/${new Date().getFullYear()}`)
  const [setId, setSetId] = useState(bap?.questionSetId ?? sets.find((s) => s.appliesTo === 'Interviews')?.id ?? sets[0]?.id ?? '')
  const [startedAt, setStartedAt] = useState(() => toLocalInput(bap?.startedAt ?? new Date().toISOString()))
  const [timezone, setTimezone] = useState<BapTimezone>(bap?.identity?.timezone ?? 'WIB')
  const [location, setLocation] = useState(bap && bap.location !== 'Belum ditentukan' ? bap.location : '')
  const [onBoard, setOnBoard] = useState(!!bap?.identity?.vessel)
  const [vessel, setVessel] = useState(bap?.identity?.vessel ?? '')
  const [vesselLocation, setVesselLocation] = useState(bap?.identity?.vesselLocation ?? '')
  const [examinerId, setExaminerId] = useState<string>(() => (bap ? (examinerOf(bap) ?? '') : defaultExaminer))
  const [companionIds, setCompanionIds] = useState<string[]>(() => (bap ? companionsOf(bap) : []))
  const [matter, setMatter] = useState(bap?.identity?.matter ?? sprint?.subject ?? caseTitle)
  const [bases, setBases] = useState<BapBasis[] | null>(bap?.bases ?? null)
  const [saving, setSaving] = useState(false)

  // A new BAP starts from the master list and the SPRINT once settings load.
  useEffect(() => {
    if (bases === null && settings !== undefined) setBases(defaultBases(settings, sprint))
  }, [bases, settings, sprint])

  const options = useMemo<BasisOption[]>(
    () => [
      ...masterBases(settings).map((m, i) => ({ key: `m-${m.id}`, source: 'master' as const, title: `Dasar ${i + 1}`, text: m.text })),
      ...(sprint ? [{ key: `s-${sprint.id}`, source: 'sprint' as const, title: `SPRINT ${sprint.number}`, text: sprintBasisText(sprint) }] : []),
      ...reportSources.map((r, i) => ({
        key: `r-${r.id}`,
        source: 'report' as const,
        title: `Sumber laporan ${i + 1}`,
        text: reportBasisText(r),
      })),
    ],
    [settings, sprint, reportSources],
  )

  const personGaps = personMissing(person)
  const problems = [
    !number.trim() && 'Nomor BAP',
    !bap && !setId && 'Question set',
    !location.trim() && 'Tempat pemeriksaan',
    !examinerId && 'Pemeriksa',
    !(bases ?? []).some((b) => b.text.trim()) && 'Dasar pemeriksaan',
    !matter.trim() && 'Permasalahan',
  ].filter((x): x is string => !!x)

  const examinerName = users.find((u) => u.id === examinerId)?.name
  const companionNames = companionIds.map((id) => users.find((u) => u.id === id)?.name ?? id)
  const startedIso = startedAt ? new Date(startedAt).toISOString() : new Date().toISOString()
  const opening = { timezone, vessel: onBoard ? vessel.trim() || undefined : undefined, vesselLocation: onBoard ? vesselLocation.trim() || undefined : undefined, matter: matter.trim() }
  const preview = openingSentence(identityFrom(person, opening, ''), startedIso, location, examinerName ? [examinerName, ...companionNames] : [])

  const save = async () => {
    if (personGaps.length > 0 || problems.length > 0) {
      toast.error('Belum lengkap', [...problems, ...(personGaps.length ? ['data terperiksa'] : [])].join(', '))
      return
    }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const companions = companionIds.filter((id) => id !== examinerId)
      const fields = {
        number: number.trim(),
        startedAt: startedIso,
        location: location.trim(),
        examinerId,
        companionIds: companions,
        investigatorIds: [examinerId, ...companions],
        bases: (bases ?? []).filter((b) => b.text.trim()).map((b) => ({ ...b, text: b.text.trim() })),
        identity: identityFrom(person, opening, bap?.identity?.completedAt ?? now),
        updatedAt: now,
      }
      if (bap) {
        await db.baps.update(bap.id, fields)
        toast.success('Pembukaan BAP diperbarui', fields.number)
      } else {
        await db.baps.add({
          id: uid('bap'),
          caseId,
          intervieweeId: person.id,
          questionSetId: setId,
          status: 'in_progress',
          answers: [],
          notes: '',
          ...fields,
        })
        toast.success('BAP dibuka', `${fields.number} — ${person.name}.`)
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
      size="lg"
      title={bap ? `Pembukaan ${bap.number}` : `New BAP — ${person.name}`}
      description="Pembukaan Berita Acara Pemeriksaan sesuai Lampiran 6 TKO B14-002: waktu, tempat, pemeriksa, dasar dan permasalahan."
      footer={
        <>
          <span className={cn('mr-auto flex items-center gap-1.5 text-[11.5px]', problems.length || personGaps.length ? 'text-warn' : 'text-ok')}>
            {problems.length || personGaps.length ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
            {problems.length || personGaps.length
              ? `Belum lengkap: ${[...problems, ...(personGaps.length ? ['data terperiksa'] : [])].join(', ')}`
              : 'Siap dibuka'}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={personGaps.length > 0}>
            {bap ? 'Simpan' : 'Open BAP'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Terperiksa */}
        <Section
          icon={<UserRound size={12} />}
          title="Terperiksa"
          action={
            <Button size="xs" variant="ghost" icon={<Pencil size={11} />} onClick={onEditPerson}>
              Ubah data terperiksa
            </Button>
          }
        >
          {personGaps.length > 0 ? (
            <div className="rounded-lg border border-warn/35 bg-warn/8 p-3">
              <p className="text-[12px] font-medium text-ink">Data {person.name} belum lengkap</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-3">Belum diisi: {personGaps.join(', ')}. Lengkapi dulu sebelum membuka BAP.</p>
              <Button className="mt-2.5" size="sm" variant="primary" icon={<Pencil size={12} />} onClick={onEditPerson}>
                Lengkapi data terperiksa
              </Button>
            </div>
          ) : (
            <p className="rounded-lg border border-line-soft bg-abyss/25 px-3 py-2 text-[11.5px] leading-relaxed text-ink-3">
              <span className="font-medium text-ink">{person.name}</span> · {KIND_LABEL[person.kind]} · {person.gender} ·{' '}
              {person.birthPlace}, {person.birthDate ? tanggalPanjang(`${person.birthDate}T00:00:00`) : '—'} · {person.position}, {person.company}
            </p>
          )}
        </Section>

        {/* Number & set */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Item label="Nomor BAP" required>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </Item>
          {!bap && (
            <Item label="Question set" required>
              <Select value={setId} onChange={(e) => setSetId(e.target.value)} options={sets.map((s) => ({ value: s.id, label: `${s.name} · ${s.appliesTo}` }))} />
            </Item>
          )}
        </div>

        {/* When & where */}
        <Section icon={<CalendarClock size={12} />} title="Waktu & tempat">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
            <Item label="Hari, tanggal & pukul" required>
              <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
            </Item>
            <Item label="Zona waktu" required group>
              <Segmented<BapTimezone>
                value={timezone}
                onChange={setTimezone}
                options={[
                  { value: 'WIB', label: 'WIB' },
                  { value: 'WITA', label: 'WITA' },
                  { value: 'WIT', label: 'WIT' },
                ]}
              />
            </Item>
          </div>
          <Item label="Bertempat di" required>
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
                  <Input value={vessel} onChange={(e) => setVessel(e.target.value)} placeholder="mis. MT Gamalama" />
                </Item>
                <Item label="Posisi kapal (di …)">
                  <Input value={vesselLocation} onChange={(e) => setVesselLocation(e.target.value)} placeholder="mis. Pelabuhan Tanjung Priok" />
                </Item>
              </div>
            )}
          </div>
        </Section>

        {/* Examiner & companions */}
        <Section icon={<Users size={12} />} title="Pemeriksa" hint="Investigator yang meminta keterangan. Biasanya dari SPRINT, tetapi bisa dipilih pengguna lain.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11.5px] font-medium text-ink-2">
                Investigator <span className="text-danger">*</span>
              </p>
              <PersonPicker
                users={users}
                sprintUserIds={sprintUserIds}
                value={examinerId ? [examinerId] : []}
                onChange={(ids) => {
                  setExaminerId(ids[0] ?? '')
                  setCompanionIds((c) => c.filter((x) => x !== ids[0]))
                }}
              />
            </div>
            <div>
              <p className="mb-1.5 text-[11.5px] font-medium text-ink-2">
                Investigator pendamping <span className="font-normal text-ink-4">(opsional)</span>
              </p>
              <PersonPicker
                users={users}
                sprintUserIds={sprintUserIds}
                value={companionIds}
                onChange={setCompanionIds}
                multiple
                exclude={examinerId ? [examinerId] : []}
              />
            </div>
          </div>
        </Section>

        {/* Bases */}
        <Section
          icon={<Scale size={12} />}
          title="Dasar pemeriksaan"
          hint="“Selaku Investigator … berdasarkan:” — dari master data, SPRINT, sumber laporan perkara, atau ditulis sendiri."
        >
          {bases === null ? <p className="text-[11.5px] text-ink-4">Memuat…</p> : <BasisEditor value={bases} onChange={setBases} options={options} />}
        </Section>

        {/* Matter */}
        <Item label="Diperiksa sehubungan dengan (permasalahan)" required>
          <Textarea rows={2} value={matter} onChange={(e) => setMatter(e.target.value)} />
        </Item>

        <div className="rounded-xl border border-brand/25 bg-brand/5 p-4">
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-brand-bright">Pratinjau pembukaan BAP</p>
          <p className="font-serif text-[13px] leading-relaxed text-ink-2">{preview}</p>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------- BAP summary */

/** The BAP's opening as recorded, shown above its questions. */
export function BapOpeningSummary({
  bap,
  users,
  sprint,
  editable,
  onEdit,
}: {
  bap: Bap
  users: User[]
  sprint?: Sprint
  editable: boolean
  onEdit: () => void
}) {
  const settings = useLiveQuery(() => db.settings.get('settings'), [])
  const i: BapIdentity | undefined = bap.identity
  const ktp = useBlobPreview(i?.ktpBlobId, i?.ktpBlobId ? 'image/*' : undefined)
  const examiner = users.find((u) => u.id === examinerOf(bap))
  const companions = companionsOf(bap).map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u)
  const bases = bap.bases ?? defaultBases(settings, sprint)

  if (!i) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-warn/6 px-5 py-3">
        <p className="text-[11.5px] text-ink-3">Pembukaan BAP belum lengkap — identitas terperiksa, tempat dan dasar pemeriksaan belum tercatat.</p>
        {editable && (
          <Button size="sm" variant="primary" icon={<Pencil size={12} />} onClick={onEdit}>
            Lengkapi pembukaan
          </Button>
        )}
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
    <div className="space-y-4 border-t border-line-soft p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-serif text-[13px] leading-relaxed text-ink-2">
          {openingSentence(i, bap.startedAt, bap.location, [examiner?.name ?? '…', ...companions.map((u) => u.name)])}
        </p>
        {editable && (
          <Button size="xs" variant="ghost" icon={<Pencil size={11} />} onClick={onEdit}>
            Ubah
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">Pemeriksa</p>
          <div className="flex flex-wrap gap-2">
            {examiner && (
              <span className="flex items-center gap-2 rounded-full border border-brand/35 bg-brand/8 py-1 pl-1 pr-2.5">
                <Avatar src={examiner.avatar} name={examiner.name} size={18} />
                <span className="text-[11px] text-ink-2">{examiner.name}</span>
                <span className="text-[9.5px] text-brand-bright">Investigator</span>
              </span>
            )}
            {companions.map((u) => (
              <span key={u.id} className="flex items-center gap-2 rounded-full border border-line bg-abyss/40 py-1 pl-1 pr-2.5">
                <Avatar src={u.avatar} name={u.name} size={18} />
                <span className="text-[11px] text-ink-2">{u.name}</span>
                <span className="text-[9.5px] text-ink-4">Pendamping</span>
              </span>
            ))}
          </div>
          <p className="mb-2 mt-4 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">Dasar pemeriksaan</p>
          <ol className="list-decimal space-y-1 pl-5 text-[11px] leading-relaxed text-ink-3">
            {bases.map((b) => (
              <li key={b.id}>{b.text}</li>
            ))}
          </ol>
        </div>

        <div>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">Identitas terperiksa</p>
          <div className="flex gap-3">
            <dl className="min-w-0 flex-1 space-y-1">
              {facts.map(([k, v]) => (
                <div key={k} className="flex min-w-0 gap-2 text-[11.5px]">
                  <dt className="w-[112px] shrink-0 text-ink-4">{k}</dt>
                  <dd className="min-w-0 break-words text-ink-2">{v || '—'}</dd>
                </div>
              ))}
            </dl>
            {ktp.url && <img src={ktp.url} alt="KTP" className="hidden h-[76px] shrink-0 rounded-md border border-line object-cover sm:block" />}
          </div>
        </div>
      </div>
    </div>
  )
}
