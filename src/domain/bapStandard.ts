import type {
  Bap,
  BapBasis,
  BapIdentity,
  CompanySettings,
  ExaminationBasis,
  Interviewee,
  Question,
  ReportSource,
  Sprint,
} from './types'

/**
 * The fixed parts of a Berita Acara Pemeriksaan under TKO B14-002/PIS0420/
 * 2024-S9, Lampiran 6.
 *
 * Every BAP opens with the terperiksa's identity (page 19) and asks fourteen
 * mandatory questions: ten before the case questions (page 20–21) and four
 * after them (page 22). The question set from Questions Customization fills
 * the middle.
 */

/* ------------------------------------------------------------ Questions */

/** Answers to standard questions are stored under these ids. */
export const STD_PREFIX = 'std-'

interface StdQuestion {
  /** Number in the TKO template — kept in the id so answers never move. */
  no: number
  label: (ctx: StdContext) => string
  type: 'text' | 'textarea'
  hint?: string
}

export interface StdContext {
  matter: string
  vessel: string
  company: string
  position: string
}

const OPENING: StdQuestion[] = [
  {
    no: 1,
    type: 'textarea',
    label: () =>
      'Apakah saudara dalam keadaan sehat jasmani dan rohani, serta bersediakah saudara diperiksa dan akan memberikan keterangan yang sebenarnya?',
  },
  {
    no: 2,
    type: 'textarea',
    label: (c) =>
      `Dijelaskan kepada saudara bahwa Security PT PIS saat ini sedang melakukan pemeriksaan sehubungan dengan ${c.matter}. Apakah atas penjelasan tersebut saudara mengerti dan bersedia untuk diminta keterangannya sebagai terperiksa?`,
  },
  {
    no: 3,
    type: 'textarea',
    label: () =>
      'Apabila dikemudian hari ternyata keterangan yang telah saudara sampaikan kepada pemeriksa dinilai tidak benar, apakah saudara bersedia mempertanggungjawabkan kepada pihak yang berwajib (Polisi)?',
  },
  {
    no: 4,
    type: 'textarea',
    label: () => 'Apakah dalam pemeriksaan ini akan ada yang mendampingi atau akan saudara hadapi sendiri? Jelaskan!',
  },
  {
    no: 5,
    type: 'textarea',
    label: (c) =>
      `Apakah Saudara pernah dihukum atau diberi sanksi selama bekerja ${
        c.vessel ? `di kapal ${c.vessel} yang dicarter oleh pihak PT PIS` : `di ${c.company}`
      }? Bila Saudara pernah dihukum atau diberi sanksi, dalam perkara apa, kapan, di mana dan berupa apa sanksi atau hukuman tersebut? Jelaskan!`,
  },
  {
    no: 6,
    type: 'textarea',
    label: () => 'Jelaskan riwayat hidup saudara, secara singkat dan jelas?',
    hint: 'Tempat & tanggal lahir, nama ibu dan ayah, anak ke berapa dari berapa bersaudara, status, alamat, riwayat pendidikan dan pekerjaan.',
  },
  {
    no: 7,
    type: 'textarea',
    label: (c) => `Sejak kapan saudara bekerja di ${c.company} dan sebagai apa?`,
  },
  {
    no: 8,
    type: 'textarea',
    label: () =>
      'Jelaskan siapa yang menggaji Saudara, berapa besar gaji yang Saudara terima sesuai dengan PKL/Kontrak serta bagaimana sistem pembayarannya?',
  },
  {
    no: 9,
    type: 'textarea',
    label: () => 'Apakah ada tambahan uang lainnya/premi/bonus dsb selain dari uang gaji dan tunjangan resmi lainnya? Jelaskan!',
  },
  {
    no: 10,
    type: 'textarea',
    label: (c) => `Apa tugas dan tanggung jawab Saudara sebagai ${c.position}?`,
  },
]

const CLOSING: StdQuestion[] = [
  {
    no: 19,
    type: 'textarea',
    label: () =>
      'Apakah di kapal saudara terdapat adanya himbauan dari PT Pertamina apabila ada crew yang menyalahgunakan cargo atau bunker agar memberikan laporan ke Pertamina? Apakah saudara sudah mengetahui dan melaksanakan himbauan tersebut?',
  },
  {
    no: 20,
    type: 'textarea',
    label: () =>
      'Apakah keterangan yang Saudara berikan sudah yang sebenarnya dan dapat dipertanggungjawabkan sesuai dengan hukum yang berlaku?',
  },
  {
    no: 21,
    type: 'textarea',
    label: () => 'Apakah ada keterangan lain yang akan Saudara tambahkan sehubungan dengan pemeriksaan ini?',
  },
  {
    no: 22,
    type: 'textarea',
    label: () =>
      'Apakah di dalam pemeriksaan sekarang ini Saudara merasa terpaksa atau dipaksa orang lain atau pemeriksa sehingga memberikan keterangan di atas?',
  },
]

const stdId = (no: number) => `${STD_PREFIX}${String(no).padStart(2, '0')}`

export function stdContext(identity: BapIdentity | undefined, person: Pick<Interviewee, 'position'>): StdContext {
  const or = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback)
  return {
    matter: or(identity?.matter, '…(permasalahan)…'),
    vessel: identity?.vessel?.trim() ?? '',
    company: or(identity?.company, '…(perusahaan)…'),
    position: or(identity?.position, or(person.position === '—' ? '' : person.position, '…(jabatan)…')),
  }
}

const toQuestion = (q: StdQuestion, ctx: StdContext, order: number): Question => ({
  id: stdId(q.no),
  setId: '__standard__',
  order,
  label: q.label(ctx),
  hint: q.hint,
  type: q.type,
  required: true,
})

/** The ten mandatory questions asked before the case questions. */
export function openingQuestions(ctx: StdContext): Question[] {
  return OPENING.map((q, i) => toQuestion(q, ctx, -100 + i))
}

/** The four mandatory questions that close every BAP. */
export function closingQuestions(ctx: StdContext): Question[] {
  return CLOSING.map((q, i) => toQuestion(q, ctx, 100_000 + i))
}

export const isStandardQuestion = (id: string) => id.startsWith(STD_PREFIX)

/** Label of a standard question by id, with neutral placeholders — for
    places that show an answer outside its BAP. */
export function standardQuestionLabel(id: string): string | undefined {
  const q = [...OPENING, ...CLOSING].find((x) => stdId(x.no) === id)
  return q?.label({ matter: '…', vessel: '', company: 'perusahaan', position: 'jabatan saat ini' })
}

/* ------------------------------------------------------------- Identity */

export const RELIGIONS = ['Islam', 'Kristen Protestan', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya']
export const MARITAL = ['Belum menikah', 'Menikah', 'Cerai hidup', 'Cerai mati']
export const EDUCATION = ['SD', 'SMP', 'SMA / SMK', 'D3', 'D4 / S1', 'S2', 'S3']

const PERSON_REQUIRED: [keyof Interviewee, string][] = [
  ['name', 'Nama lengkap'],
  ['gender', 'Jenis kelamin'],
  ['nationality', 'Kewarganegaraan'],
  ['birthPlace', 'Tempat lahir'],
  ['birthDate', 'Tanggal lahir'],
  ['religion', 'Agama'],
  ['maritalStatus', 'Status'],
  ['education', 'Pendidikan'],
  ['occupation', 'Pekerjaan'],
  ['position', 'Jabatan'],
  ['company', 'Perusahaan'],
  ['address', 'Alamat tempat tinggal'],
]

/** What the terperiksa form still lacks before a BAP can be opened. */
export function personMissing(p: Partial<Interviewee>): string[] {
  return PERSON_REQUIRED.filter(([k]) => {
    const v = String(p[k] ?? '').trim()
    return !v || v === '—'
  }).map(([, label]) => label)
}

/** The BAP's snapshot of the terperiksa, plus the BAP's own opening details. */
export function identityFrom(
  p: Interviewee,
  opening: Pick<BapIdentity, 'timezone' | 'vessel' | 'vesselLocation' | 'matter'>,
  completedAt: string,
): BapIdentity {
  return {
    ...opening,
    fullName: p.name,
    gender: p.gender ?? '',
    occupation: p.occupation ?? '',
    position: p.position === '—' ? '' : p.position,
    company: p.company ?? '',
    education: p.education ?? '',
    birthPlace: p.birthPlace ?? '',
    birthDate: p.birthDate ?? '',
    religion: p.religion ?? '',
    maritalStatus: p.maritalStatus ?? '',
    nationality: p.nationality ?? '',
    address: p.address ?? '',
    ktpBlobId: p.ktpBlobId,
    completedAt,
  }
}

/* ------------------------------------------------------- Pemeriksa & dasar */

/** The examiner and the companions of a BAP. BAPs from before the split
    keep everyone in investigatorIds, the examiner first. */
export function examinerOf(bap: Pick<Bap, 'examinerId' | 'investigatorIds'>): string | undefined {
  return bap.examinerId ?? bap.investigatorIds[0]
}
export function companionsOf(bap: Pick<Bap, 'examinerId' | 'companionIds' | 'investigatorIds'>): string[] {
  return bap.companionIds ?? bap.investigatorIds.filter((id) => id !== examinerOf(bap))
}

/** The standing bases every PIS Security BAP cites (TKO page 19). */
export const DEFAULT_EXAMINATION_BASES: ExaminationBasis[] = [
  {
    id: 'eb-kpts-66',
    text: 'Surat Keputusan Direktur Utama Pertamina No: Kpts 66/C00000/2012-S0 tanggal 18 Desember 2012, tentang pemberian kewenangan pembuatan Berita Acara Pemeriksaan (BAP) kepada Fungsi Security.',
  },
  {
    id: 'eb-kpts-47',
    text: 'Surat Keputusan Direksi PT Pertamina No. Kpts 47/C00000/2019-S0 tanggal 31 Desember 2019, tentang Kebijakan Pokok Pengawasan.',
  },
]

export const masterBases = (settings: CompanySettings | undefined): ExaminationBasis[] =>
  settings?.examinationBases ?? DEFAULT_EXAMINATION_BASES

export function sprintBasisText(sp: Sprint): string {
  return `Surat Perintah VP HSSE PT Pertamina International Shipping No. ${sp.number} tanggal ${tanggalPanjang(sp.issuedAt)} perihal Pelaksanaan Investigasi ${sp.subject}.`
}

export function reportBasisText(src: ReportSource): string {
  switch (src.kind) {
    case 'wbs':
      return `Laporan melalui Whistle Blower System (WBS) Nomor ${src.wbsNumber ?? '…'} tanggal ${tanggalPanjang(src.recordedAt)}.`
    case 'management':
      return `Nota Dinas Nomor ${src.notaDinasNumber ?? '…'} (Management Report) tanggal ${tanggalPanjang(src.recordedAt)}.`
    case 'internal':
      return `Investigation Notes (Internal Report) tanggal ${tanggalPanjang(src.recordedAt)}.`
  }
}

/** The bases a new BAP starts with: the master list, then the SPRINT. */
export function defaultBases(settings: CompanySettings | undefined, sprint: Sprint | undefined): BapBasis[] {
  return [
    ...masterBases(settings).map((m) => ({ id: `b-${m.id}`, source: 'master' as const, text: m.text })),
    ...(sprint ? [{ id: `b-sprint-${sprint.id}`, source: 'sprint' as const, text: sprintBasisText(sprint) }] : []),
  ]
}

/* ------------------------------------------------------------- Wording */

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export function tanggalPanjang(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * The opening paragraph as the BAP prints it:
 * "Pada hari … tanggal … pukul … bertempat di … meminta keterangan terhadap
 * seorang … yang mengaku bernama …".
 */
export function openingSentence(i: BapIdentity, startedAt: string, location: string, investigators: string[]): string {
  const d = new Date(startedAt)
  const pukul = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
  const tempat = location.trim() && location !== 'Belum ditentukan' ? location.trim() : '…'
  const kapal = i.vessel?.trim() ? `, saat Kapal ${i.vessel.trim()}${i.vesselLocation?.trim() ? ` di ${i.vesselLocation.trim()}` : ''}` : ''
  const [examiner, ...companions] = investigators
  const pemeriksa = examiner ? (companions.length ? `${examiner} bersama dengan ${companions.join(', ')}` : examiner) : '…'
  return (
    `Pada hari ${HARI[d.getDay()]} tanggal ${tanggalPanjang(startedAt)}, pukul ${pukul} ${i.timezone}, bertempat di ${tempat}${kapal}, ` +
    `${pemeriksa} meminta keterangan terhadap seorang ${i.gender || '…'} yang mengaku bernama ${i.fullName.trim() || '…'}, ` +
    `untuk diperiksa dan didengar keterangannya sebagai Terperiksa sehubungan dengan ${i.matter.trim() || '…'}.`
  )
}

/** Starting text for question 6 (riwayat hidup), built from the identity form. */
export function riwayatHidupDraft(i: BapIdentity): string {
  const lahir = i.birthDate ? tanggalPanjang(`${i.birthDate}T00:00:00`) : '…'
  return [
    `Dilahirkan di ${i.birthPlace || '…'}, ${lahir}, dari seorang Ibu bernama … dan ayah bernama …, anak ke … dari … bersaudara. Status ${(i.maritalStatus || '…').toLowerCase()}, saat ini saya tinggal di ${i.address || '…'}.`,
    `Pendidikan: ${i.education || '…'}.`,
    `Pekerjaan: ${i.occupation || '…'} — ${i.position || '…'}, ${i.company || '…'}.`,
  ].join('\n')
}
