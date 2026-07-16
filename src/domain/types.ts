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

export type RecColumn = 'backlog' | 'proposed' | 'approved' | 'in_progress' | 'done'

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
  /** Nomor Surat Perintah, e.g. SPRINT-014/INV/VII/2026 */
  number: string
  subject: string
  /** Pejabat yang menerbitkan */
  issuedBy: string
  issuedAt: string
  validFrom: string
  /** Undated orders stay valid until revoked. */
  validUntil?: string
  revoked: boolean
  members: SprintMember[]
  /** The scanned Surat Perintah. Required — an order without its document
      grants nothing. */
  docBlobId: string
  docName: string
  docMime: string
  docSize: number
  notes?: string
  createdAt: string
  updatedAt: string
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
  notes: string
  updatedAt: string
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

export type TemplateKind = 'report' | 'deck' | 'mail' | 'evidence-label'

export interface Template {
  id: string
  kind: TemplateKind
  name: string
  description: string
  updatedAt: string
  isDefault: boolean
  /** Section headings for report templates, slide titles for decks. */
  blocks: string[]
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
