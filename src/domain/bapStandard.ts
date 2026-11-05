import type { BapIdentity, Interviewee, Question } from './types'

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

/** A fresh identity form, started from what the case already knows. */
export function newIdentity(person: Interviewee, matter: string): BapIdentity {
  return {
    timezone: 'WIB',
    matter,
    fullName: person.name,
    gender: '',
    occupation: '',
    position: person.position === '—' ? '' : person.position,
    company: '',
    education: '',
    birthPlace: '',
    birthDate: '',
    religion: '',
    maritalStatus: '',
    nationality: 'Indonesia',
    address: person.address ?? '',
  }
}

const IDENTITY_REQUIRED: [keyof BapIdentity, string][] = [
  ['fullName', 'Nama lengkap'],
  ['gender', 'Jenis kelamin'],
  ['birthPlace', 'Tempat lahir'],
  ['birthDate', 'Tanggal lahir'],
  ['religion', 'Agama'],
  ['maritalStatus', 'Status'],
  ['nationality', 'Kewarganegaraan'],
  ['education', 'Pendidikan'],
  ['occupation', 'Pekerjaan'],
  ['position', 'Jabatan'],
  ['company', 'Perusahaan'],
  ['address', 'Alamat tempat tinggal'],
  ['matter', 'Permasalahan'],
]

/** What still has to be filled in before the examination may begin. */
export function identityMissing(i: BapIdentity, location: string): string[] {
  const missing = IDENTITY_REQUIRED.filter(([k]) => !String(i[k] ?? '').trim()).map(([, label]) => label)
  if (!location.trim() || location === 'Belum ditentukan') missing.unshift('Tempat pemeriksaan')
  return missing
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
  const pemeriksa = investigators.length ? investigators.join(' bersama dengan ') : '…'
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
