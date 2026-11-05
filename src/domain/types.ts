/**
 * CaseNavigator domain model.
 *
 * Everything is keyed by string ids and stored in IndexedDB (see db.ts).
 * Records are plain, serialisable objects — no class instances, no Dates
 * (ISO strings only), so they survive structured-clone into Dexie.
 */

export type EntityKind =
  | 'person'
  | 'organization'
  | 'location'
  | 'device'
  | 'document'
  | 'communication'
  | 'transaction'
  | 'vehicle'
  | 'witness'
  | 'evidence'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type CasePriority = 'low' | 'medium' | 'high' | 'critical'
export type CaseStatus = 'active' | 'pending' | 'review' | 'closed' | 'archived'

/* ------------------------------------------------------------------ Case */

export interface Case {
  id: string
  code: string
  title: string
  summary: string
  priority: CasePriority
  status: CaseStatus
  progress: number
  assigneeId: string
  teamIds: string[]
  tags: string[]
  openedAt: string
  dueAt?: string
  updatedAt: string
  /** Free-form investigative context shown on the case overview. */
  jurisdiction?: string
  caseType?: string
  /**
   * Registration documents attached to the case at intake — the report that
   * opened it, the complaint, identity scans, and so on. Shown on the Case
   * Registration tab. The binary payload lives in the blobs table; a manually
   * recorded line has no blobId.
   */
  documents?: CaseDocument[]
  /** Where the reports that opened the case came from — a case can arrive
      through more than one channel. */
  reportSources?: ReportSource[]
  /**
   * People granted view access to this case by hand, on top of the SPRINT
   * team and the roles that see every case — e.g. legal or a line manager.
   */
  viewerIds?: string[]
}

/**
 * Sumber laporan — the channel the case was reported through:
 *  - wbs        — Whistle Blower System, identified by its WBS number.
 *  - management — Management Report, a nota dinas with its number and scan.
 *  - internal   — Internal Report: the team's own investigation notes, which
 *                 carry no number.
 */
export type ReportSourceKind = 'wbs' | 'management' | 'internal'

export interface ReportSource {
  id: string
  kind: ReportSourceKind
  /** WBS only. */
  wbsNumber?: string
  /** Management Report only — nomor nota dinas. */
  notaDinasNumber?: string
  /** Management Report only — the CaseDocument holding the nota dinas. */
  notaDinasDocId?: string
  /** Internal Report only — Investigation Notes. */
  notes?: string
  recordedBy?: string
  recordedAt: string
}

/** One registration document filed against a case. */
export interface CaseDocument {
  id: string
  name: string
  /** Human category, e.g. "Laporan", "Surat Pengaduan", "Identitas". */
  category?: string
  blobId?: string
  mime?: string
  size?: number
  /** Name of whoever filed it. */
  uploadedBy?: string
  uploadedAt: string
  note?: string
}

/* ----------------------------------------------------------------- Graph */

export interface GraphNode {
  id: string
  caseId: string
  kind: EntityKind
  label: string
  sublabel: string
  /** Canvas position; persisted so a moved node stays put. */
  x: number
  y: number
  risk: RiskLevel
  /** Marks the case's central entity — rendered larger with a photo. */
  isFocus?: boolean
  avatar?: string
  tags: string[]
  summary: string
  /** Arbitrary key/value facts rendered in the detail panel. */
  attributes: { label: string; value: string }[]
  createdAt: string
}

export type EdgeKind =
  | 'associate'
  | 'transaction'
  | 'communication'
  | 'ownership'
  | 'employment'
  | 'presence'
  | 'suspected'

export interface GraphEdge {
  id: string
  caseId: string
  source: string
  target: string
  kind: EdgeKind
  label?: string
  /** 0..1 — drives stroke weight and opacity. */
  strength: number
  /** Suspected/unconfirmed links render dashed. */
  confirmed: boolean
}

/* ------------------------------------------------------------------ Mail */

export interface MailAttachment {
  id: string
  name: string
  size: number
  mime: string
}

export interface Mail {
  id: string
  caseId: string
  subject: string
  fromName: string
  fromAddress: string
  to: { name: string; address: string }[]
  cc?: { name: string; address: string }[]
  body: string
  sentAt: string
  read: boolean
  starred: boolean
  flagged: boolean
  folder: 'inbox' | 'sent' | 'evidence' | 'archive'
  /** Graph nodes this message is linked to. */
  linkedNodeIds: string[]
  attachments: MailAttachment[]
  threadId: string
  importance: 'normal' | 'high'
}

/* -------------------------------------------------------------- Evidence */

export type EvidenceKind =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'physical'
  | 'digital'
  | 'financial'

export type EvidenceStatus = 'collected' | 'analyzing' | 'verified' | 'rejected'

export interface CustodyEntry {
  id: string
  actor: string
  action: string
  at: string
  note?: string
}

export interface Evidence {
  id: string
  caseId: string
  ref: string
  name: string
  description: string
  kind: EvidenceKind
  status: EvidenceStatus
  collectedBy: string
  collectedAt: string
  location: string
  tags: string[]
  linkedNodeIds: string[]
  /** Present for user-uploaded files; seeded evidence has none. */
  blobId?: string
  mime?: string
  size?: number
  /** Object-URL-able thumbnail for images. */
  custody: CustodyEntry[]
  /** 0..100 investigator confidence. */
  confidence: number
}

/** Binary payloads live in their own table so evidence rows stay light. */
export interface BlobRecord {
  id: string
  data: Blob
}

/* ------------------------------------------------- Challenge (slide deck) */

export type SlideElementKind = 'text' | 'image' | 'shape' | 'entity'

export interface SlideElement {
  id: string
  kind: SlideElementKind
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  text?: string
  /** Text styling */
  fontSize?: number
  fontWeight?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  fontFamily?: 'sans' | 'serif' | 'mono'
  /** Shape / image */
  fill?: string
  stroke?: string
  radius?: number
  blobId?: string
  src?: string
  /** entity kind → renders a live graph-entity chip */
  nodeId?: string
  z: number
}

export type SlideLayout = 'title' | 'title-content' | 'two-column' | 'blank' | 'section'

export interface Slide {
  id: string
  caseId: string
  deckId: string
  index: number
  layout: SlideLayout
  background: string
  elements: SlideElement[]
  notes: string
  transition?: 'none' | 'fade' | 'slide'
}

export interface Deck {
  id: string
  caseId: string
  title: string
  subtitle: string
  updatedAt: string
  theme: 'midnight' | 'graphite' | 'ivory'
}

/* ---------------------------------------------------------------- Report */

export interface ReportSection {
  id: string
  heading: string
  level: 1 | 2
  /** Sanitised HTML from the contenteditable surface. */
  html: string
}

export interface Report {
  id: string
  caseId: string
  title: string
  classification: 'unclassified' | 'internal' | 'confidential' | 'restricted'
  author: string
  status: 'draft' | 'in_review' | 'final'
  updatedAt: string
  sections: ReportSection[]
}

/* -------------------------------------------------------- Recommendation */

export type RecColumn = 'open' | 'in_progress' | 'closed'

export interface Recommendation {
  id: string
  caseId: string
  column: RecColumn
  order: number
  title: string
  detail: string
  priority: CasePriority
  assigneeId?: string
  dueAt?: string
  tags: string[]
  linkedNodeIds: string[]
  createdAt: string
}

/* ---------------------------------------------------------------- SPRINT */

/** Position an investigator holds on a Surat Perintah. */
export type SprintPosition = 'ketua' | 'anggota' | 'sekretaris'

export interface SprintMember {
  userId: string
  position: SprintPosition
  addedAt: string
}

/**
 * Surat Perintah Investigasi — the order that authorises a named team to work
 * a case. Membership here *is* the case's access list: an investigator who is
 * not on an active SPRINT cannot open the case (see domain/access.ts).
 */
export interface Sprint {
  id: string
  caseId: string
  /** Nomor Surat Perintah, e.g. Prin-014/PIS0400/2026-S0 */
  number: string
  subject: string
  /** Pejabat yang menerbitkan */
  issuedBy: string
  issuedAt: string
  validFrom: string
  /** Undated orders stay valid until revoked. */
  validUntil?: string
  revoked: boolean
  /**
   * A letter still being drafted from a SPRINT template: filled in, printed
   * and sent for signature, but not yet backed by a signed scan. A draft
   * grants nobody access (see domain/access.ts).
   */
  draft?: boolean
  members: SprintMember[]
  /** The filled-in letter, for orders drafted from a SPRINT template. Orders
      recorded by uploading an existing scan have none. */
  letter?: SprintLetter
  /** The scanned, signed Surat Perintah. Every issued order has one — an
      order without its document grants nothing. Only drafts go without. */
  docBlobId?: string
  docName?: string
  docMime?: string
  docSize?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------ SPRINT template */

/**
 * One role in the order's "Susunan Tim" attachment — Pembina, Advisor,
 * Koordinator, Anggota… The template decides which roles exist, how many
 * people each takes, and whether holding it grants access to the case.
 */
export interface SprintTeamRole {
  id: string
  label: string
  /** Fewest people the role needs before the order can be issued. */
  min: number
  /** Most people the role takes. Absent = no limit. */
  max?: number
  /** Access position granted to app users named in this role. Absent = the
      role is listed on the letter but opens nothing (e.g. Pembina). */
  access?: SprintPosition
  /** Guidance shown on the form, e.g. "Level Manager". */
  hint?: string
}

/**
 * A Surat Perintah template: the letter itself as an editable document, plus
 * the few settings the document can't express.
 *
 * `html` is written in the Word-like template editor. Everything typed there
 * is fixed wording; the parts each order fills in are field chips —
 * `<span data-field="perihal">` and so on (see SPRINT_FIELDS in
 * domain/sprintLetter.ts) — replaced with the form's values when the letter
 * is rendered.
 */
export interface SprintTemplateBody {
  html: string
  /** Number pattern behind the {nomor} field; {urut} and {tahun} come from
      the form. */
  numberPattern: string
  /** Pre-filled into the form's "Ditetapkan di". */
  defaultPlace: string
  /** Pre-filled into the form's "Jabatan penandatangan". */
  issuerTitle: string
  /** Roles on the team attachment, in order. */
  roles: SprintTeamRole[]
}

/** One person on the letter's team attachment. */
export interface SprintTeamEntry {
  id: string
  roleId: string
  /** Set when the person is an app user — only then can the order grant
      them access. Pembina and outside advisors usually have none. */
  userId?: string
  /** Snapshot as printed — a later change to the user record never rewrites
      a signed order. */
  name: string
  employeeNo: string
  jobTitle: string
}

/** The filled-in form behind a template-drafted Surat Perintah. */
export interface SprintLetter {
  templateId: string
  templateName: string
  /** Copy of the template at the time of drafting, so editing the template
      never changes an order already written from it. */
  body: SprintTemplateBody
  /** Fills {urut} in the number pattern. */
  seq: string
  /** Fills {tahun} in the number pattern. */
  year: string
  /** The case under investigation — under the title and on the attachment. */
  perihal: string
  /** Menimbang point 1: the request or report that triggered the order. */
  menimbang: string
  /** Further case-specific considerations. */
  menimbangExtra: string[]
  /** Legal basis added for this case, after the template's own. */
  dasarExtra: string[]
  /** What is investigated. */
  objek: string
  /** Further case-specific tasks. */
  untukExtra: string[]
  place: string
  /** YYYY-MM-DD. The order is in force from this date. */
  dateIssued: string
  signerName: string
  signerTitle: string
  team: SprintTeamEntry[]
}

/* ------------------------------------------------------------- Interview */

/** Status of the person being examined. */
export type IntervieweeKind = 'saksi' | 'terlapor' | 'pelapor' | 'ahli'

/** Terperiksa — a person scheduled for or subject to a BAP. */
export interface Interviewee {
  id: string
  caseId: string
  name: string
  kind: IntervieweeKind
  /** Jabatan / posisi */
  position: string
  identityNo?: string
  phone?: string
  address?: string
  /** Links the terperiksa to their graph entity when one exists. */
  nodeId?: string
  createdAt: string
}

export type BapStatus = 'draft' | 'in_progress' | 'completed' | 'signed'

export interface BapAnswer {
  questionId: string
  /** Text, select value, ISO date, number-as-string, or 'yes' / 'no'. */
  value: string
  /** multiselect only. */
  values?: string[]
  /** Investigator's own note on the answer — kept apart from the answer
      itself so the record shows who said what. */
  note?: string
  /** True when the value was produced by voice dictation. The investigator can
      still edit it freely; the flag only records how it first came in. */
  dictated?: boolean
}

/**
 * A question the investigator adds to one BAP on the spot, outside the template
 * question set. It lives on the BAP itself — never on the shared set — so it
 * only ever affects this one examination. Free-text by nature.
 */
export interface BapExtraQuestion {
  id: string
  label: string
  type: 'text' | 'textarea'
  createdAt: string
}

/** Berita Acara Pemeriksaan — one examination of one terperiksa. */
export interface Bap {
  id: string
  caseId: string
  intervieweeId: string
  /** Nomor BAP */
  number: string
  /** The question set from Questions Customization that drives this BAP. */
  questionSetId: string
  /** Investigators conducting it — drawn from the case SPRINT. */
  investigatorIds: string[]
  status: BapStatus
  location: string
  startedAt: string
  completedAt?: string
  answers: BapAnswer[]
  /** Ad-hoc questions the investigator added beyond the template set. */
  extraQuestions?: BapExtraQuestion[]
  /**
   * The opening of the BAP (TKO B14-002 Lampiran 6, page 19): when and where
   * the examination happens and who the terperiksa is. Filled in before any
   * question is asked.
   */
  identity?: BapIdentity
  notes: string
  updatedAt: string
}

export type BapTimezone = 'WIB' | 'WITA' | 'WIT'

/**
 * Identity of the terperiksa as recorded at the start of one examination — a
 * snapshot, so a later change to the person's record never rewrites a BAP.
 */
export interface BapIdentity {
  timezone: BapTimezone
  /** "saat Kapal … di …" — only for examinations held on board. */
  vessel?: string
  vesselLocation?: string
  /** What the terperiksa is examined about — "sehubungan dengan …". */
  matter: string
  fullName: string
  gender: 'laki-laki' | 'perempuan' | ''
  occupation: string
  position: string
  /** Employer, e.g. the ship owner. */
  company: string
  education: string
  birthPlace: string
  /** YYYY-MM-DD */
  birthDate: string
  religion: string
  maritalStatus: string
  nationality: string
  address: string
  /** Photo of the KTP, kept in the blobs table. */
  ktpBlobId?: string
  /** Set once the form is complete and the examination may begin. */
  completedAt?: string
}

/* -------------------------------------------------------- Gelar Perkara */

/**
 * An uploaded file attached to a case conference — an evidence photo/clip
 * reviewed in the session, or documentation such as the minutes, session
 * photos, or an attendance sheet. The binary payload lives in the blobs table;
 * manually recorded lines have no blobId.
 */
export interface GelarDoc {
  id: string
  name: string
  blobId?: string
  mime?: string
  size?: number
  note?: string
}

/**
 * The decision recorded at a gelar perkara:
 *  - lanjut-sprint — perkara diteruskan ke tahap SPRINT.
 *  - gelar-lanjutan — perlu gelar perkara lanjutan.
 *  - close — perkara ditutup.
 */
export type GelarStatus = 'lanjut-sprint' | 'gelar-lanjutan' | 'close'

/**
 * Gelar Perkara — a case conference where the investigation team reviews the
 * evidence gathered so far and records a shared conclusion on where the case
 * stands and what happens next.
 */
export interface GelarPerkara {
  id: string
  caseId: string
  /** Nomor gelar perkara, e.g. GP-014-01. */
  number: string
  /** Judul gelar perkara. */
  title: string
  /** Waktu pelaksanaan (ISO string). */
  scheduledAt: string
  location?: string
  status: GelarStatus
  /** Peserta / attendees — free text so people outside the SPRINT still fit. */
  participants: string[]
  /** Evidence yang dibahas — uploaded image/video/file previews. */
  evidence: GelarDoc[]
  /** Dokumentasi gelar perkara — uploaded minutes, photos, attendance sheet. */
  documents: GelarDoc[]
  /** Kesimpulan hasil gelar perkara. */
  conclusion: string
  createdAt: string
  updatedAt: string
}

/* ----------------------------------------------------------------- Admin */

export interface User {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  title: string
  active: boolean
  lastSeenAt: string
}

export type Permission =
  | 'case.view'
  /** Bypasses SPRINT membership — holders see every case, assigned or not. */
  | 'case.viewAll'
  | 'case.create'
  | 'case.edit'
  | 'case.delete'
  | 'sprint.view'
  | 'sprint.manage'
  | 'interview.view'
  | 'interview.conduct'
  | 'evidence.view'
  | 'evidence.upload'
  | 'evidence.verify'
  | 'report.view'
  | 'report.edit'
  | 'report.publish'
  | 'admin.settings'
  | 'admin.users'

export interface Role {
  id: string
  name: string
  description: string
  color: string
  permissions: Permission[]
  system?: boolean
}

export interface CompanySettings {
  id: string
  name: string
  legalName: string
  logoDataUrl?: string
  address: string
  timezone: string
  dateFormat: string
  caseCodePrefix: string
  retentionDays: number
  primaryColor: string
  requireTwoFactor: boolean
  watermarkExports: boolean
  autoLockMinutes: number
}

export type TemplateKind = 'report' | 'deck' | 'mail' | 'evidence-label' | 'sprint'

export interface Template {
  id: string
  kind: TemplateKind
  name: string
  description: string
  updatedAt: string
  isDefault: boolean
  /** Section headings for report templates, slide titles for decks. For a
      SPRINT template, a short summary shown on the template card. */
  blocks: string[]
  /** The letter wording — SPRINT templates only. */
  sprint?: SprintTemplateBody
}

export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'boolean' | 'date' | 'number'

export interface Question {
  id: string
  setId: string
  order: number
  label: string
  hint?: string
  type: QuestionType
  required: boolean
  options?: string[]
}

export interface QuestionSet {
  id: string
  name: string
  description: string
  appliesTo: string
  updatedAt: string
  active: boolean
}

/* ------------------------------------------------------------- Activity */

export interface Activity {
  id: string
  caseId?: string
  actorId: string
  verb: string
  object: string
  at: string
  kind: 'case' | 'evidence' | 'mail' | 'report' | 'graph' | 'admin' | 'deck'
}

export interface Notification {
  id: string
  title: string
  body: string
  at: string
  read: boolean
  kind: 'info' | 'warn' | 'success'
  caseId?: string
}
