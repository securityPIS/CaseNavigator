import type {
  SprintLetter,
  SprintPosition,
  SprintTeamEntry,
  SprintTeamRole,
  SprintTemplateBody,
  Template,
} from './types'

/**
 * Surat Perintah drafted from a template.
 *
 * A template holds the wording that never changes between orders (Dasar,
 * standing tasks, closing lines, the team roles). The form fills in what does
 * (number, case, the triggering report, the team). Rendering both together
 * gives the letter, as one self-contained HTML document that is previewed,
 * printed and downloaded from the same source.
 */

/* -------------------------------------------------------------- Defaults */

export const DEFAULT_SPRINT_ROLES: SprintTeamRole[] = [
  { id: 'pembina', label: 'Pembina', min: 1, max: 1, hint: 'Level Manager' },
  { id: 'advisor', label: 'Advisor Holding', min: 0, max: 2, hint: 'Opsional — bisa ada bisa tidak' },
  { id: 'koordinator', label: 'Koordinator Investigasi', min: 1, max: 1, access: 'ketua', hint: 'Level Manager' },
  { id: 'anggota', label: 'Anggota', min: 1, access: 'anggota' },
]

/** The order format of TKO B14-002/PIS0420/2024-S9, Lampiran 5. */
export const DEFAULT_SPRINT_BODY: SprintTemplateBody = {
  lampiranCode: 'Lampiran 5-TKO No. B14-002/PIS0420/2024-S9',
  headerTitle: 'SURAT PERINTAH INVESTIGASI',
  letterTitle: 'SURAT PERINTAH',
  numberPattern: 'Prin-{urut}/PIS0400/{tahun}-S0',
  tentang: 'PELAKSANAAN INVESTIGASI',
  issuerTitle: 'VP HSSE',
  menimbangFixed: [
    'Bahwa dipandang perlu untuk memerintahkan Personil Security PT Pertamina International Shipping sebagai Tim Investigasi HSSE untuk menindaklanjutinya.',
  ],
  dasar: [
    'Surat Keputusan Direktur Utama Pertamina No: Kpts 66/C00000/2012-S0 tanggal 18 Desember 2012, tentang pemberian kewenangan pembuatan Berita Acara Pemeriksaan (BAP) kepada Fungsi Security.',
    'Surat Keputusan Direksi PT Pertamina No. Kpts 47/C00000/2019-S0 tanggal 31 Desember 2019, tentang Kebijakan Pokok Pengawasan.',
  ],
  kepada: 'Para pekerja sesuai dengan susunan keanggotaan seperti yang tercantum pada lampiran surat perintah ini.',
  untukIntro: 'Melaksanakan koordinasi investigasi dengan detail kegiatan sebagai berikut:',
  untukObjekPrefix: 'Melakukan kegiatan investigasi terkait dengan',
  untukFixed: [
    'Melaksanakan tugas terhitung mulai ditetapkannya Surat Perintah ini sampai dengan selesai dan biaya yang timbul menjadi beban perusahaan.',
    'Melaksanakan koordinasi dan kerjasama dengan fungsi terkait.',
    'Bertanggung jawab dan melaporkan hasil pelaksanaannya kepada {{jabatan_penerbit}} PT PIS.',
  ],
  penutup: [
    'Surat perintah ini berlaku terhitung mulai tanggal ditetapkan.',
    'Agar surat perintah ini dilaksanakan dengan penuh rasa Tanggung jawab.',
  ],
  defaultPlace: 'Jakarta',
  lampiranTitle: 'SUSUNAN TIM INVESTIGASI',
  roles: DEFAULT_SPRINT_ROLES,
}

export const DEFAULT_SPRINT_TEMPLATE_ID = 'tpl-sprint-1'

export function defaultSprintTemplate(updatedAt: string): Template {
  return {
    id: DEFAULT_SPRINT_TEMPLATE_ID,
    kind: 'sprint',
    name: 'Surat Perintah Investigasi — TKO B14-002',
    description: 'Format Lampiran 5 TKO Pelaksanaan Investigasi Security, diterbitkan VP HSSE dengan lampiran Susunan Tim Investigasi.',
    updatedAt,
    isDefault: true,
    blocks: summarizeSprintTemplate(DEFAULT_SPRINT_BODY),
    sprint: DEFAULT_SPRINT_BODY,
  }
}

/** The short outline shown on a SPRINT template's card. */
export function summarizeSprintTemplate(body: SprintTemplateBody): string[] {
  return [
    `Nomor ${body.numberPattern}`,
    `Diterbitkan ${body.issuerTitle || '—'}`,
    `Dasar — ${body.dasar.length} ketentuan`,
    `Untuk — ${body.untukFixed.length + 1} tugas`,
    `Tim — ${body.roles.map((r) => r.label).join(', ') || 'tanpa peran'}`,
  ]
}

/* --------------------------------------------------------------- Helpers */

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** "2026-11-04" → "4 November 2026". */
export function formatTanggal(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

export function sprintNumber(body: SprintTemplateBody, seq: string, year: string): string {
  return body.numberPattern
    .replace(/\{urut\}/g, seq.trim() || '...')
    .replace(/\{tahun\}/g, year.trim() || '....')
}

function fill(text: string, letter: SprintLetter): string {
  return text
    .replace(/\{\{\s*jabatan_penerbit\s*\}\}/g, letter.body.issuerTitle)
    .replace(/\{\{\s*perihal\s*\}\}/g, letter.perihal.trim() || '…')
}

export function roleOf(body: SprintTemplateBody, roleId: string): SprintTeamRole | undefined {
  return body.roles.find((r) => r.id === roleId)
}

/** A fresh letter from a template, with every template default applied. */
export function newLetter(
  template: Template,
  init: { perihal?: string; seq?: string; dateIssued?: string } = {},
): SprintLetter {
  const body = structuredClone(template.sprint ?? DEFAULT_SPRINT_BODY)
  const dateIssued = init.dateIssued ?? new Date().toISOString().slice(0, 10)
  return {
    templateId: template.id,
    templateName: template.name,
    body,
    seq: init.seq ?? '',
    year: dateIssued.slice(0, 4),
    perihal: init.perihal ?? '',
    menimbang: '',
    menimbangExtra: [],
    dasar: [...body.dasar],
    objek: '',
    untukExtra: [],
    place: body.defaultPlace,
    dateIssued,
    signerName: '',
    signerTitle: body.issuerTitle,
    team: [],
  }
}

/* ------------------------------------------------------- Access & checks */

const POSITION_RANK: Record<SprintPosition, number> = { ketua: 0, sekretaris: 1, anggota: 2 }

/**
 * The access list the letter grants: app users named in a role that carries
 * access. Someone named twice keeps their senior position.
 */
export function membersFromLetter(letter: SprintLetter): { userId: string; position: SprintPosition }[] {
  const out = new Map<string, SprintPosition>()
  for (const e of letter.team) {
    const position = roleOf(letter.body, e.roleId)?.access
    if (!e.userId || !position) continue
    const prev = out.get(e.userId)
    if (!prev || POSITION_RANK[position] < POSITION_RANK[prev]) out.set(e.userId, position)
  }
  return [...out].map(([userId, position]) => ({ userId, position }))
}

export function teamFor(letter: SprintLetter, roleId: string): SprintTeamEntry[] {
  return letter.team.filter((e) => e.roleId === roleId)
}

/** Everything that stops the letter from being issued. Empty = ready. */
export function letterProblems(letter: SprintLetter): string[] {
  const p: string[] = []
  const need = (v: string, label: string) => {
    if (!v.trim()) p.push(`${label} belum diisi.`)
  }
  need(letter.seq, 'Nomor urut')
  need(letter.year, 'Tahun')
  need(letter.perihal, 'Perihal kasus')
  need(letter.menimbang, 'Menimbang poin 1')
  if (!letter.dasar.some((d) => d.trim())) p.push('Dasar minimal satu ketentuan.')
  need(letter.objek, 'Objek investigasi')
  need(letter.place, 'Tempat ditetapkan')
  need(letter.dateIssued, 'Tanggal ditetapkan')
  need(letter.signerName, 'Nama penandatangan')
  need(letter.signerTitle, 'Jabatan penandatangan')

  for (const role of letter.body.roles) {
    const n = teamFor(letter, role.id).length
    if (n < role.min) p.push(`${role.label}: minimal ${role.min} orang.`)
    if (role.max !== undefined && n > role.max) p.push(`${role.label}: maksimal ${role.max} orang.`)
  }
  for (const e of letter.team) {
    const label = roleOf(letter.body, e.roleId)?.label ?? 'Tim'
    if (!e.name.trim()) p.push(`${label}: nama lengkap belum diisi.`)
    else if (!e.jobTitle.trim()) p.push(`${label}: jabatan ${e.name} belum diisi.`)
  }
  if (membersFromLetter(letter).length === 0) {
    p.push('Belum ada pengguna aplikasi pada peran yang memberi akses — surat ini tidak akan membuka kasus bagi siapa pun.')
  }
  return p
}

/* -------------------------------------------------------------- Renderer */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** User text → HTML, keeping line breaks. */
const text = (s: string) => esc(s).replace(/\n/g, '<br>')

const PH = '<span class="ph">……………………</span>'
const val = (s: string, placeholder = PH) => (s.trim() ? text(s.trim()) : placeholder)

function ol(items: string[]): string {
  return `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`
}

export interface RenderOptions {
  logoDataUrl?: string
  companyName?: string
}

const STYLE = `
@page { size: A4; margin: 20mm 20mm 20mm 25mm; }
* { box-sizing: border-box; }
html { background: #d9dde3; }
body { margin: 0; padding: 8mm 0; font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.4; color: #111; }
.page { background: #fff; width: 210mm; min-height: 297mm; margin: 0 auto 8mm; padding: 20mm 20mm 20mm 25mm; box-shadow: 0 2px 12px rgb(0 0 0 / 0.18); }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10mm; }
.head p { margin: 0; }
.code { margin-bottom: 6mm !important; }
.logo { text-align: right; }
.logo img { max-height: 18mm; max-width: 75mm; }
.logo .name { font-weight: 700; font-size: 13pt; }
.center { text-align: center; }
.b { font-weight: 700; }
.u { text-decoration: underline; }
.title { margin-top: 10mm; }
.gap { margin-top: 5mm; }
table.cl { width: 100%; border-collapse: collapse; margin-top: 5mm; }
table.cl td { vertical-align: top; padding: 0 0 3mm; }
td.lbl { width: 25mm; }
td.col { width: 5mm; }
ol { margin: 0; padding-left: 6mm; }
li { text-align: justify; margin-bottom: 0.8mm; }
.just { text-align: justify; }
.close p { margin: 0; }
.ph { color: #8a8f98; }
.sign { margin: 12mm 0 0 45%; break-inside: avoid; }
.sign p { margin: 0; }
.sign .rule { border-top: 1px solid #111; margin: 2mm 0 2mm -35%; }
.sign .space { height: 22mm; }
table.team { width: 100%; border-collapse: collapse; margin-top: 8mm; }
table.team td { vertical-align: top; padding: 0 2mm 1.5mm 0; }
table.team td.r { width: 32mm; }
table.team td.c { width: 4mm; }
table.team td.no { width: 26mm; }
table.team td.jb { width: 48mm; }
@media print {
  html { background: #fff; }
  body { padding: 0; }
  .page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .page + .page { break-before: page; }
}
`

function logoBlock(o: RenderOptions): string {
  if (o.logoDataUrl) return `<div class="logo"><img src="${esc(o.logoDataUrl)}" alt=""></div>`
  if (o.companyName) return `<div class="logo"><div class="name">${esc(o.companyName)}</div></div>`
  return '<div class="logo"></div>'
}

function teamTable(letter: SprintLetter): string {
  const blank = letter.team.length === 0
  const rows: string[] = []
  for (const role of letter.body.roles) {
    const entries = teamFor(letter, role.id)
    // An optional role with nobody in it is left off the letter, except on an
    // untouched form, where every role shows as a blank line to fill.
    if (entries.length === 0 && role.min === 0 && !blank) continue
    const many = role.max !== 1
    const lines: (SprintTeamEntry | null)[] = entries.length > 0 ? entries : [null]
    lines.forEach((e, i) => {
      const n = many ? `${i + 1}.&nbsp;` : ''
      rows.push(
        `<tr><td class="r">${i === 0 ? esc(role.label) : ''}</td><td class="c">${i === 0 ? ':' : ''}</td>` +
          `<td>${n}${e ? val(e.name) : PH}</td>` +
          `<td class="no">${e ? val(e.employeeNo, '<span class="ph">………</span>') : '<span class="ph">(Nomor Pekerja)</span>'}</td>` +
          `<td class="jb">${e ? val(e.jobTitle) : '<span class="ph">(Jabatan Lengkap)</span>'}</td></tr>`,
      )
    })
  }
  return `<table class="team">${rows.join('')}</table>`
}

/** The whole letter — body, penetapan and the team attachment — as HTML. */
export function renderSprintLetterHtml(letter: SprintLetter, o: RenderOptions = {}): string {
  const b = letter.body
  const number = sprintNumber(b, letter.seq, letter.year)
  const perihal = val(letter.perihal, '<span class="ph">…berisi kasus yang akan diinvestigasi…</span>')

  const menimbang = [
    val(letter.menimbang, '<span class="ph">… berisi surat permintaan investigasi / laporan adanya indikasi tindak fraud / kejahatan keamanan lainnya …</span>'),
    ...letter.menimbangExtra.filter((s) => s.trim()).map((s) => text(s.trim())),
    ...b.menimbangFixed.filter((s) => s.trim()).map((s) => text(fill(s, letter))),
  ]
  const dasar = letter.dasar.filter((s) => s.trim()).map((s) => text(fill(s, letter)))
  const untuk = [
    `${text(b.untukObjekPrefix)} ${val(letter.objek)}`,
    ...letter.untukExtra.filter((s) => s.trim()).map((s) => text(s.trim())),
    ...b.untukFixed.filter((s) => s.trim()).map((s) => text(fill(s, letter))),
  ]

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>${esc(b.letterTitle)} ${esc(number)}</title><style>${STYLE}</style></head><body>
<section class="page">
  <div class="head">
    <div>
      ${b.lampiranCode.trim() ? `<p class="code">${esc(b.lampiranCode)}</p>` : ''}
      <p class="b">${esc(b.headerTitle)}</p>
    </div>
    ${logoBlock(o)}
  </div>

  <div class="center title">
    <div class="b u">${esc(b.letterTitle)}</div>
    <div>No. ${esc(number)}</div>
  </div>
  <div class="center gap">
    <div class="b">TENTANG</div>
    <div class="b">${esc(b.tentang)}</div>
    <div>(${perihal})</div>
  </div>
  <div class="center gap b">${esc(b.issuerTitle)}</div>

  <table class="cl">
    <tr><td class="lbl">Menimbang</td><td class="col">:</td><td>${ol(menimbang)}</td></tr>
    <tr><td class="lbl">Dasar</td><td class="col">:</td><td>${dasar.length ? ol(dasar) : PH}</td></tr>
  </table>

  <div class="center b gap">MEMERINTAHKAN</div>

  <table class="cl">
    <tr><td class="lbl">Kepada</td><td class="col">:</td><td class="just">${text(fill(b.kepada, letter))}</td></tr>
    <tr><td class="lbl">Untuk</td><td class="col">:</td><td>
      <div class="just">${text(fill(b.untukIntro, letter))}</div>
      ${ol(untuk)}
    </td></tr>
  </table>
  <div class="close">${b.penutup.filter((s) => s.trim()).map((s) => `<p>${text(fill(s, letter))}</p>`).join('')}</div>

  <div class="sign">
    <p>${esc(b.letterTitle.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()))}</p>
    <p class="u">Nomor : ${esc(number)}</p>
    <p style="margin-top:4mm">Ditetapkan di ${val(letter.place)}</p>
    <p>Pada tanggal ${letter.dateIssued ? esc(formatTanggal(letter.dateIssued)) : '<span class="ph">(tanggal, bulan, tahun)</span>'}</p>
    <div class="rule"></div>
    <p>${val(letter.signerTitle)},</p>
    <div class="space"></div>
    <p>(${val(letter.signerName, '<span class="ph">Nama Lengkap</span>')})</p>
  </div>
</section>

<section class="page">
  <div class="head"><div></div>${logoBlock(o)}</div>
  <div class="center gap">
    <div class="b">${esc(b.lampiranTitle)}</div>
    <div>${letter.perihal.trim() ? text(letter.perihal.trim()) : '<span class="ph">…(berisi kasus yang akan diinvestigasi)…</span>'}</div>
  </div>
  ${teamTable(letter)}
</section>
</body></html>`
}

/* ------------------------------------------------------- Print / export */

/** Prints the letter through a hidden frame, so the app's own styles never
    leak onto the paper. */
export function printLetterHtml(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  frame.srcdoc = html
  frame.onload = () => {
    const w = frame.contentWindow
    if (!w) return
    w.focus()
    w.print()
    // Give the print dialog time to take its snapshot before tearing down.
    setTimeout(() => frame.remove(), 1000)
  }
  document.body.appendChild(frame)
}

export function downloadLetterHtml(html: string, number: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${number.replace(/[\\/:*?"<>|]+/g, '-')}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
