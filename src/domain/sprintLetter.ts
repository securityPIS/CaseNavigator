import type {
  ReportSource,
  Sprint,
  SprintLetter,
  SprintPosition,
  SprintTeamEntry,
  SprintTeamRole,
  SprintTemplateBody,
  Template,
  User,
} from './types'

/**
 * Surat Perintah drafted from a template.
 *
 * The template is a document, edited like a Word file: everything typed in it
 * is fixed wording, and the parts each order fills in are field chips. The
 * SPRINT form on a case supplies those values; rendering swaps every chip for
 * its value and gives the letter as one self-contained HTML document, which
 * is previewed, printed and downloaded from the same source.
 */

/* ---------------------------------------------------------------- Fields */

export type SprintFieldKind = 'text' | 'list' | 'team' | 'logo'

export interface SprintField {
  key: string
  label: string
  kind: SprintFieldKind
  hint: string
}

/**
 * Every field a template can place. "list" fields expand into one numbered
 * point each when their chip sits alone in a list item, and vanish when the
 * form leaves them empty.
 */
export const SPRINT_FIELDS: SprintField[] = [
  { key: 'nomor', label: 'Nomor surat', kind: 'text', hint: 'Built from the number pattern, sequence and year' },
  { key: 'perihal', label: 'Perihal kasus', kind: 'text', hint: 'The case under investigation' },
  { key: 'menimbang', label: 'Dasar permintaan', kind: 'text', hint: 'Request / report that triggered the order' },
  { key: 'menimbang_tambahan', label: 'Menimbang tambahan', kind: 'list', hint: 'Extra considerations for this case' },
  { key: 'dasar_tambahan', label: 'Dasar tambahan', kind: 'list', hint: 'Extra legal basis for this case' },
  { key: 'objek', label: 'Objek investigasi', kind: 'text', hint: 'What is investigated' },
  { key: 'untuk_tambahan', label: 'Tugas tambahan', kind: 'list', hint: 'Extra tasks for this case' },
  { key: 'tempat', label: 'Tempat ditetapkan', kind: 'text', hint: 'Ditetapkan di …' },
  { key: 'tanggal', label: 'Tanggal ditetapkan', kind: 'text', hint: 'Pada tanggal … — the order is in force from it' },
  { key: 'jabatan_penandatangan', label: 'Jabatan penandatangan', kind: 'text', hint: 'e.g. VP HSSE' },
  { key: 'nama_penandatangan', label: 'Nama penandatangan', kind: 'text', hint: 'Full name of the signatory' },
  { key: 'susunan_tim', label: 'Tabel susunan tim', kind: 'team', hint: 'The team table — one row per person' },
  { key: 'logo', label: 'Logo perusahaan', kind: 'logo', hint: 'From Company Setting' },
]

const FIELD_MAP = new Map(SPRINT_FIELDS.map((f) => [f.key, f]))

export function fieldChip(key: string): string {
  const f = FIELD_MAP.get(key)
  return `<span class="field" data-field="${key}" contenteditable="false">${f ? f.label : key}</span>`
}

/** The fields a template's document actually uses. */
export function fieldsIn(html: string): Set<string> {
  const out = new Set<string>()
  for (const m of html.matchAll(/data-field="([a-z_]+)"/g)) out.add(m[1])
  return out
}

/* -------------------------------------------------------------- Defaults */

export const DEFAULT_SPRINT_ROLES: SprintTeamRole[] = [
  { id: 'pembina', label: 'Pembina', min: 1, max: 1, hint: 'Level Manager' },
  { id: 'advisor', label: 'Advisor Holding', min: 0, max: 2, hint: 'Opsional — bisa ada bisa tidak' },
  { id: 'koordinator', label: 'Koordinator Investigasi', min: 1, max: 1, access: 'ketua', hint: 'Level Manager' },
  { id: 'anggota', label: 'Anggota', min: 1, access: 'anggota' },
]

/**
 * The structured shape SPRINT templates had before the document editor.
 * Kept to build the standard document and to convert stored templates and
 * letters (see the v6 upgrade in db.ts).
 */
export interface LegacySprintBody {
  lampiranCode: string
  headerTitle: string
  letterTitle: string
  numberPattern: string
  tentang: string
  issuerTitle: string
  menimbangFixed: string[]
  dasar: string[]
  kepada: string
  untukIntro: string
  untukObjekPrefix: string
  untukFixed: string[]
  penutup: string[]
  defaultPlace: string
  lampiranTitle: string
  roles: SprintTeamRole[]
}

/** The order format of TKO B14-002/PIS0420/2024-S9, Lampiran 5. */
const TKO_WORDING: LegacySprintBody = {
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

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** User text → HTML, keeping line breaks. */
const text = (s: string) => esc(s).replace(/\n/g, '<br>')

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())

/** Lays the structured wording out as an editable document. `dasar`
    overrides the template's list — an old letter's edited Dasar. */
export function legacyBodyToHtml(b: LegacySprintBody, dasar = b.dasar): string {
  const fixed = (s: string) =>
    text(s)
      .replace(/\{\{\s*jabatan_penerbit\s*\}\}/g, esc(b.issuerTitle))
      .replace(/\{\{\s*perihal\s*\}\}/g, fieldChip('perihal'))
  const li = (items: string[]) => items.filter((s) => s.trim()).map((s) => `<li>${fixed(s)}</li>`).join('')
  const C = 'style="text-align: center;"'

  return [
    '<table class="layout"><tbody><tr>',
    `<td>${b.lampiranCode.trim() ? `<p>${esc(b.lampiranCode)}</p>` : ''}<p><b>${esc(b.headerTitle)}</b></p></td>`,
    `<td style="text-align: right;">${fieldChip('logo')}</td>`,
    '</tr></tbody></table>',
    '<p><br></p>',
    `<p ${C}><b><u>${esc(b.letterTitle)}</u></b><br>No. ${fieldChip('nomor')}</p>`,
    `<p ${C}><b>TENTANG</b><br><b>${esc(b.tentang)}</b><br>(${fieldChip('perihal')})</p>`,
    `<p ${C}><b>${esc(b.issuerTitle)}</b></p>`,
    '<table class="clause"><tbody>',
    `<tr><td>Menimbang</td><td>:</td><td><ol><li>${fieldChip('menimbang')}</li><li>${fieldChip('menimbang_tambahan')}</li>${li(b.menimbangFixed)}</ol></td></tr>`,
    `<tr><td>Dasar</td><td>:</td><td><ol>${li(dasar)}<li>${fieldChip('dasar_tambahan')}</li></ol></td></tr>`,
    '</tbody></table>',
    `<p ${C}><b>MEMERINTAHKAN</b></p>`,
    '<table class="clause"><tbody>',
    `<tr><td>Kepada</td><td>:</td><td><p style="text-align: justify;">${fixed(b.kepada)}</p></td></tr>`,
    `<tr><td>Untuk</td><td>:</td><td><p style="text-align: justify;">${fixed(b.untukIntro)}</p>` +
      `<ol><li>${fixed(b.untukObjekPrefix)} ${fieldChip('objek')}</li><li>${fieldChip('untuk_tambahan')}</li>${li(b.untukFixed)}</ol></td></tr>`,
    '</tbody></table>',
    `<p>${b.penutup.filter((s) => s.trim()).map(fixed).join('<br>')}</p>`,
    '<table class="layout"><tbody><tr><td style="width: 45%;"></td><td>',
    `<p>${esc(titleCase(b.letterTitle))}<br><u>Nomor : ${fieldChip('nomor')}</u></p>`,
    `<p>Ditetapkan di ${fieldChip('tempat')}<br>Pada tanggal ${fieldChip('tanggal')}</p>`,
    '<hr>',
    `<p>${fieldChip('jabatan_penandatangan')},</p>`,
    '<p><br></p><p><br></p><p><br></p>',
    `<p>(${fieldChip('nama_penandatangan')})</p>`,
    '</td></tr></tbody></table>',
    '<div class="page-break"></div>',
    `<p style="text-align: right;">${fieldChip('logo')}</p>`,
    `<p ${C}><b>${esc(b.lampiranTitle)}</b><br>${fieldChip('perihal')}</p>`,
    '<p><br></p>',
    `<p>${fieldChip('susunan_tim')}</p>`,
  ].join('')
}

export function legacyToBody(b: LegacySprintBody, dasar?: string[]): SprintTemplateBody {
  return {
    html: legacyBodyToHtml(b, dasar),
    numberPattern: b.numberPattern,
    defaultPlace: b.defaultPlace,
    issuerTitle: b.issuerTitle,
    roles: b.roles,
  }
}

export const DEFAULT_SPRINT_BODY: SprintTemplateBody = legacyToBody(TKO_WORDING)

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
  const used = fieldsIn(body.html)
  return [
    `Nomor ${body.numberPattern}`,
    `Ditandatangani ${body.issuerTitle || '—'}`,
    `${used.size} form fields in the document`,
    `Tim — ${body.roles.map((r) => r.label).join(', ') || 'tanpa peran'}`,
  ]
}

/* ------------------------------------------------------------ Sanitizing */

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN', 'DIV', 'FONT', 'OL', 'UL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'COLGROUP', 'COL', 'HR',
  'H1', 'H2', 'H3', 'H4', 'SUP', 'SUB', 'BLOCKQUOTE', 'IMG',
])
/** Removed with their content — never unwrapped into text. */
const DROPPED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TITLE', 'HEAD', 'SVG', 'MATH',
  'TEMPLATE', 'NOSCRIPT', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'VIDEO', 'AUDIO', 'CANVAS',
])
const ALLOWED_ATTRS = new Set(['style', 'class', 'colspan', 'rowspan', 'align', 'size', 'face', 'color', 'width', 'valign'])
const ALLOWED_CLASSES = new Set(['layout', 'clause', 'page-break'])
const ALLOWED_STYLES = new Set([
  'text-align', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'font-size', 'font-family',
  'color', 'background-color', 'margin-left', 'margin-top', 'margin-bottom', 'padding-left', 'text-indent',
  'width', 'vertical-align', 'line-height', 'list-style-type',
])

function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((d) => d.trim())
    .filter((d) => {
      const [prop, ...rest] = d.split(':')
      const value = rest.join(':').toLowerCase()
      return ALLOWED_STYLES.has(prop?.trim().toLowerCase() ?? '') && !/url\(|expression|javascript:/.test(value)
    })
    .join('; ')
}

function cleanNode(node: Node): void {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove()
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const el = child as HTMLElement
    const tag = el.tagName.toUpperCase()

    // Field chips are rebuilt from the catalogue, whatever they arrived as.
    const field = el.getAttribute('data-field')
    if (field !== null) {
      if (FIELD_MAP.has(field)) {
        const chip = el.ownerDocument.createElement('span')
        chip.className = 'field'
        chip.setAttribute('data-field', field)
        chip.setAttribute('contenteditable', 'false')
        chip.textContent = FIELD_MAP.get(field)!.label
        el.replaceWith(chip)
      } else {
        el.replaceWith(el.ownerDocument.createTextNode(el.textContent ?? ''))
      }
      continue
    }

    if (DROPPED_TAGS.has(tag) || tag.includes(':')) {
      // Word's <o:p> and friends carry nothing worth keeping.
      if (tag.includes(':')) el.replaceWith(...el.childNodes)
      else el.remove()
      continue
    }
    if (!ALLOWED_TAGS.has(tag)) {
      cleanNode(el)
      el.replaceWith(...el.childNodes)
      continue
    }

    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      if (tag === 'IMG' && name === 'src') {
        if (!/^data:image\/(png|jpe?g|gif|webp);/i.test(attr.value)) el.remove()
        continue
      }
      if (!ALLOWED_ATTRS.has(name)) el.removeAttribute(attr.name)
      else if (name === 'style') {
        const s = cleanStyle(attr.value)
        if (s) el.setAttribute('style', s)
        else el.removeAttribute('style')
      } else if (name === 'class') {
        const c = attr.value.split(/\s+/).filter((x) => ALLOWED_CLASSES.has(x)).join(' ')
        if (c) el.setAttribute('class', c)
        else el.removeAttribute('class')
      }
    }
    if (tag === 'IMG' && !el.getAttribute('src')) {
      el.remove()
      continue
    }
    cleanNode(el)
  }
}

/**
 * Template HTML as it may be stored: known tags, harmless attributes, field
 * chips rebuilt from the catalogue. Applied to everything saved from the
 * editor and to every paste — Word's clipboard included.
 */
export function sanitizeTemplateHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body><div id="root">${html}</div></body>`, 'text/html')
  const root = doc.getElementById('root')!
  cleanNode(root)
  return root.innerHTML
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
    dasarExtra: [],
    objek: '',
    untukExtra: [],
    place: body.defaultPlace,
    dateIssued,
    signerName: '',
    signerTitle: body.issuerTitle,
    team: [],
  }
}

/** How one sumber laporan reads inside Menimbang point 1. */
function sourcePhrase(src: ReportSource): string {
  switch (src.kind) {
    case 'wbs':
      return `laporan melalui Whistle Blower System (WBS) Nomor ${src.wbsNumber?.trim() || '…'}`
    case 'management':
      return `Management Report berupa Nota Dinas Nomor ${src.notaDinasNumber?.trim() || '…'}`
    case 'internal':
      return `Internal Report berupa Investigation Notes tanggal ${formatTanggal(src.recordedAt.slice(0, 10))}`
  }
}

/**
 * Menimbang point 1 as suggested by the case's sumber laporan — every report
 * that triggered the order, in one sentence. Only a starting point; the form
 * keeps it editable.
 */
export function menimbangFromSources(sources: ReportSource[] | undefined, perihal: string): string | undefined {
  if (!sources?.length) return undefined
  const phrases = sources.map(sourcePhrase)
  const joined = phrases.length === 1 ? phrases[0] : `${phrases.slice(0, -1).join(', ')} dan ${phrases[phrases.length - 1]}`
  const about = perihal.trim() ? ` perihal ${perihal.trim()}` : ''
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}${about}.`
}

/* ------------------------------------------- Letters for existing orders */

/** Stable, plausible employee number for a person — demo filler only. */
function dummyEmployeeNo(key: string): string {
  let h = 7
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 1_000_000
  return `19${String(h).padStart(6, '0')}`
}

/**
 * The letter for an order that has none of its own — one recorded from a
 * scan, or seeded before letters existed — so it can still be shown as the
 * template document. The order's own facts (number, perihal, date, team) are
 * used as they are; what the record never captured (Pembina, employee
 * numbers, the signatory's name) is filled with placeholder data.
 */
export function letterFromSprint(
  sprint: Sprint,
  ctx: { users: User[]; caseTitle?: string; reportSources?: ReportSource[]; template?: Template },
): SprintLetter {
  const base = ctx.template?.sprint ?? DEFAULT_SPRINT_BODY
  // The order already has its number; print it verbatim.
  const body: SprintTemplateBody = { ...structuredClone(base), numberPattern: sprint.number.replace(/[{}]/g, '') }
  const roles = body.roles
  const lead = roles.find((r) => r.access === 'ketua') ?? roles.find((r) => r.access)
  const member = [...roles].reverse().find((r) => r.access === 'anggota') ?? lead
  const patron = roles.find((r) => !r.access && r.min > 0)

  const team: SprintTeamEntry[] = []
  if (patron) {
    team.push({ id: `${sprint.id}-pembina`, roleId: patron.id, name: 'Ir. Bambang Setiawan', employeeNo: '19720315', jobTitle: 'Manager Security' })
  }
  for (const m of sprint.members) {
    const role = m.position === 'ketua' ? lead : member
    if (!role) continue
    const u = ctx.users.find((x) => x.id === m.userId)
    team.push({
      id: `${sprint.id}-${m.userId}`,
      roleId: role.id,
      userId: m.userId,
      name: u?.name ?? m.userId,
      employeeNo: dummyEmployeeNo(m.userId),
      jobTitle: u?.title ?? 'Pekerja',
    })
  }

  const [signer] = sprint.issuedBy.split(/\s+—\s+/)
  const date = sprint.issuedAt.slice(0, 10)
  return {
    templateId: ctx.template?.id ?? DEFAULT_SPRINT_TEMPLATE_ID,
    templateName: ctx.template?.name ?? 'Surat Perintah Investigasi',
    body,
    seq: '',
    year: date.slice(0, 4),
    perihal: sprint.subject,
    menimbang:
      menimbangFromSources(ctx.reportSources, ctx.caseTitle ?? sprint.subject) ??
      `Laporan adanya indikasi pelanggaran terkait ${ctx.caseTitle ?? sprint.subject}.`,
    menimbangExtra: [],
    dasarExtra: [],
    objek: (ctx.caseTitle ?? sprint.subject).toLowerCase(),
    untukExtra: [],
    place: body.defaultPlace,
    dateIssued: date,
    signerName: signer?.trim() || 'Nama Lengkap',
    signerTitle: body.issuerTitle,
    team,
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
  const used = fieldsIn(letter.body.html)
  const p: string[] = []
  const need = (v: string, label: string, field?: string) => {
    if (field && !used.has(field)) return
    if (!v.trim()) p.push(`${label} belum diisi.`)
  }
  need(letter.seq, 'Nomor urut')
  need(letter.year, 'Tahun')
  need(letter.perihal, 'Perihal kasus')
  need(letter.menimbang, 'Menimbang — dasar permintaan', 'menimbang')
  need(letter.objek, 'Objek investigasi', 'objek')
  need(letter.place, 'Tempat ditetapkan', 'tempat')
  need(letter.dateIssued, 'Tanggal ditetapkan')
  need(letter.signerName, 'Nama penandatangan', 'nama_penandatangan')
  need(letter.signerTitle, 'Jabatan penandatangan', 'jabatan_penandatangan')

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

/* -------------------------------------------------------------- Styling */

/**
 * The letter's typography, shared by the template editor and the rendered
 * letter so the editing page and the printed page match. Scoped to
 * .sprint-doc because the editor lives inside the app's own styles.
 */
export const SPRINT_DOC_CSS = `
.sprint-doc { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.4; color: #111; text-align: left; }
.sprint-doc p { margin: 0 0 3mm; }
.sprint-doc h1 { font-size: 16pt; font-weight: 700; margin: 0 0 3mm; }
.sprint-doc h2 { font-size: 14pt; font-weight: 700; margin: 0 0 3mm; }
.sprint-doc h3 { font-size: 12pt; font-weight: 700; margin: 0 0 3mm; }
.sprint-doc b, .sprint-doc strong { font-weight: 700; }
.sprint-doc i, .sprint-doc em { font-style: italic; }
.sprint-doc u { text-decoration: underline; }
.sprint-doc s, .sprint-doc strike { text-decoration: line-through; }
.sprint-doc ol { list-style: decimal; margin: 0 0 2mm; padding-left: 6mm; }
.sprint-doc ul { list-style: disc; margin: 0 0 2mm; padding-left: 6mm; }
.sprint-doc li { margin-bottom: 0.8mm; text-align: justify; }
.sprint-doc li > p { margin: 0; }
.sprint-doc table { width: 100%; border-collapse: collapse; margin: 0 0 2mm; }
.sprint-doc td, .sprint-doc th { vertical-align: top; padding: 0 1.5mm 2mm 0; }
.sprint-doc td > p:last-child { margin-bottom: 0; }
/* A row is one unit on paper — the signature block above all must never split. */
.sprint-doc tr { break-inside: avoid; }
.sprint-doc table.clause > tbody > tr > td:first-child { width: 25mm; }
.sprint-doc table.clause > tbody > tr > td:nth-child(2) { width: 5mm; }
.sprint-doc hr { border: 0; border-top: 1px solid #111; margin: 2mm 0 3mm; }
.sprint-doc img { max-width: 100%; }
.sprint-doc .logo img { max-height: 18mm; max-width: 75mm; }
.sprint-doc .logo-name { font-weight: 700; font-size: 13pt; }
.sprint-doc .ph { color: #8a8f98; }
.sprint-doc table.team td { padding: 0 2mm 1.5mm 0; }
.sprint-doc table.team td.r { width: 32mm; }
.sprint-doc table.team td.c { width: 4mm; }
.sprint-doc table.team td.no { width: 26mm; }
.sprint-doc table.team td.jb { width: 48mm; }
`

/* -------------------------------------------------------------- Renderer */

const PH = '<span class="ph">……………………</span>'
const val = (s: string, placeholder = PH) => (s.trim() ? text(s.trim()) : placeholder)

export interface RenderOptions {
  logoDataUrl?: string
  companyName?: string
}

const PAGE_CSS = `
@page { size: A4; margin: 20mm 20mm 20mm 25mm; }
* { box-sizing: border-box; }
html { background: #d9dde3; }
body { margin: 0; padding: 8mm 0; }
.page { background: #fff; width: 210mm; min-height: 297mm; margin: 0 auto 8mm; padding: 20mm 20mm 20mm 25mm; box-shadow: 0 2px 12px rgb(0 0 0 / 0.18); }
@media print {
  html { background: #fff; }
  body { padding: 0; }
  .page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .page + .page { break-before: page; }
  .page-break { break-before: page; }
}
`

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
  return `<table class="team"><tbody>${rows.join('')}</tbody></table>`
}

function textValue(key: string, letter: SprintLetter): string {
  switch (key) {
    case 'nomor':
      return esc(sprintNumber(letter.body, letter.seq, letter.year))
    case 'perihal':
      return val(letter.perihal, '<span class="ph">…berisi kasus yang akan diinvestigasi…</span>')
    case 'menimbang':
      return val(letter.menimbang, '<span class="ph">… berisi surat permintaan investigasi / laporan adanya indikasi tindak fraud / kejahatan keamanan lainnya …</span>')
    case 'objek':
      return val(letter.objek)
    case 'tempat':
      return val(letter.place)
    case 'tanggal':
      return letter.dateIssued ? esc(formatTanggal(letter.dateIssued)) : '<span class="ph">(tanggal, bulan, tahun)</span>'
    case 'jabatan_penandatangan':
      return val(letter.signerTitle)
    case 'nama_penandatangan':
      return val(letter.signerName, '<span class="ph">Nama Lengkap</span>')
    default:
      return ''
  }
}

function listValue(key: string, letter: SprintLetter): string[] {
  const list =
    key === 'menimbang_tambahan' ? letter.menimbangExtra : key === 'dasar_tambahan' ? letter.dasarExtra : letter.untukExtra
  return list.map((s) => s.trim()).filter(Boolean)
}

/** True when `el` is all `box` holds, bar whitespace and line breaks. */
function aloneIn(box: Element, el: Element): boolean {
  if ((box.textContent ?? '').trim() !== (el.textContent ?? '').trim()) return false
  return [...box.querySelectorAll('*')].every((x) => x === el || el.contains(x) || x.tagName === 'BR')
}

function fragment(doc: Document, html: string): DocumentFragment {
  const t = doc.createElement('template')
  t.innerHTML = html
  return t.content
}

/** Swaps every field chip in the template for the letter's value. */
function fillDocument(letter: SprintLetter, o: RenderOptions): string {
  const doc = new DOMParser().parseFromString(`<body><div id="root">${letter.body.html}</div></body>`, 'text/html')
  const root = doc.getElementById('root')!

  for (const el of [...root.querySelectorAll('[data-field]')]) {
    const key = el.getAttribute('data-field') ?? ''
    const f = FIELD_MAP.get(key)
    if (!f) {
      el.remove()
      continue
    }

    if (f.kind === 'list') {
      const items = listValue(key, letter)
      const li = el.closest('li')
      if (li && aloneIn(li, el)) {
        // Its own list item: one numbered point per entry, or none at all.
        for (const item of items) {
          const n = doc.createElement('li')
          n.innerHTML = text(item)
          li.before(n)
        }
        li.remove()
      } else {
        el.replaceWith(fragment(doc, items.map(text).join('<br>')))
      }
      continue
    }

    if (f.kind === 'team') {
      const table = fragment(doc, teamTable(letter))
      const block = el.parentElement?.closest('p, div')
      if (block && block !== root && aloneIn(block, el)) block.replaceWith(table)
      else el.replaceWith(table)
      continue
    }

    if (f.kind === 'logo') {
      const html = o.logoDataUrl
        ? `<span class="logo"><img src="${esc(o.logoDataUrl)}" alt=""></span>`
        : o.companyName
          ? `<span class="logo-name">${esc(o.companyName)}</span>`
          : ''
      el.replaceWith(fragment(doc, html))
      continue
    }

    el.replaceWith(fragment(doc, textValue(key, letter)))
  }

  // Each top-level page break starts a new sheet.
  const pages: string[] = []
  let current = ''
  for (const node of [...root.childNodes]) {
    if (node instanceof Element && node.classList.contains('page-break')) {
      pages.push(current)
      current = ''
      continue
    }
    current += node instanceof Element ? node.outerHTML : node.textContent ?? ''
  }
  pages.push(current)
  return pages.map((p) => `<section class="page sprint-doc">${p}</section>`).join('\n')
}

/** The whole letter as a standalone HTML document. */
export function renderSprintLetterHtml(letter: SprintLetter, o: RenderOptions = {}): string {
  const number = sprintNumber(letter.body, letter.seq, letter.year)
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Surat Perintah ${esc(number)}</title><style>${PAGE_CSS}${SPRINT_DOC_CSS}</style></head><body>
${fillDocument(letter, o)}
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
