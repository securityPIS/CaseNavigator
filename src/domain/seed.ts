import { db } from './db'
import { avatarDataUri } from './avatar'
import { DEFAULT_ROLES } from './roles'
import type {
  Activity,
  Bap,
  BlobRecord,
  Case,
  CaseDocument,
  CompanySettings,
  Deck,
  Evidence,
  GelarPerkara,
  GraphEdge,
  GraphNode,
  Interviewee,
  Mail,
  Notification,
  Question,
  QuestionSet,
  Recommendation,
  Report,
  Role,
  Slide,
  Sprint,
  Template,
  User,
} from './types'

/**
 * Seed corpus for CN-2026-014 — a procurement irregularity investigation.
 *
 * The data is internally consistent on purpose: the wire transfer amount
 * matches the PO total, the mail thread references the same figures, and
 * the evidence items back the graph edges. Demos fall apart when numbers
 * disagree, so they don't here.
 */

const NOW = new Date('2026-07-15T09:00:00Z')
const iso = (daysAgo: number, h = 9, m = 0) => {
  const d = new Date(NOW)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  d.setUTCHours(h, m, 0, 0)
  return d.toISOString()
}

/* ----------------------------------------------------------------- Users */

export const USERS: User[] = [
  {
    id: 'u-jason',
    name: 'Jason Bennett',
    email: 'j.bennett@meridian-int.com',
    role: 'r-investigator',
    title: 'Lead Investigator',
    active: true,
    lastSeenAt: iso(0, 8, 42),
    avatar: avatarDataUri('Jason Bennett'),
  },
  {
    id: 'u-amara',
    name: 'Amara Osei',
    email: 'a.osei@meridian-int.com',
    role: 'r-investigator',
    title: 'Financial Analyst',
    active: true,
    lastSeenAt: iso(0, 7, 15),
    avatar: avatarDataUri('Amara Osei'),
  },
  {
    id: 'u-ryan',
    name: 'Ryan Kowalski',
    email: 'r.kowalski@meridian-int.com',
    role: 'r-investigator',
    title: 'Digital Forensics',
    active: true,
    lastSeenAt: iso(1, 17, 30),
    avatar: avatarDataUri('Ryan Kowalski'),
  },
  {
    id: 'u-priya',
    name: 'Priya Raman',
    email: 'p.raman@meridian-int.com',
    role: 'r-management',
    title: 'Compliance Reviewer',
    active: true,
    lastSeenAt: iso(2, 11, 5),
    avatar: avatarDataUri('Priya Raman'),
  },
  {
    id: 'u-dana',
    name: 'Dana Whitfield',
    email: 'd.whitfield@meridian-int.com',
    role: 'r-admin',
    title: 'Case Administrator',
    active: true,
    lastSeenAt: iso(0, 6, 50),
    avatar: avatarDataUri('Dana Whitfield'),
  },
  {
    id: 'u-elena',
    name: 'Elena Vos',
    email: 'e.vos@meridian-int.com',
    role: 'r-executive',
    title: 'Director of Integrity',
    active: true,
    lastSeenAt: iso(0, 8, 5),
    avatar: avatarDataUri('Elena Vos'),
  },
  {
    id: 'u-tom',
    name: 'Tomás Herrera',
    email: 't.herrera@meridian-int.com',
    role: 'r-stakeholder',
    title: 'Legal Counsel',
    active: false,
    lastSeenAt: iso(21, 14, 0),
    avatar: avatarDataUri('Tomás Herrera'),
  },
]

/* ----------------------------------------------------------------- Roles */

/** The five defaults live in roles.ts — the v2 upgrade seeds them too. */
const ROLES: Role[] = DEFAULT_ROLES

/* ----------------------------------------------------------------- Cases */

const CASES: Case[] = [
  {
    id: 'c-014',
    code: 'CN-2026-014',
    title: 'Procurement Irregularity Investigation',
    summary:
      'Allegations that a senior procurement manager steered FY2024 hardware contracts to a single vendor in exchange for undisclosed payments. Triggered by an anonymous ethics-line report on 12 April 2026.',
    priority: 'high',
    status: 'active',
    progress: 68,
    assigneeId: 'u-jason',
    teamIds: ['u-jason', 'u-amara', 'u-ryan', 'u-priya'],
    tags: ['procurement', 'conflict-of-interest', 'FY2024', 'ethics-line'],
    openedAt: iso(94, 10, 0),
    dueAt: iso(-24, 17, 0),
    updatedAt: iso(0, 8, 30),
    jurisdiction: 'Internal — Corporate Ethics',
    caseType: 'Financial Misconduct',
  },
  {
    id: 'c-011',
    code: 'CN-2026-011',
    title: 'Cargo Theft Review',
    summary:
      'Recurring shortfalls on the Northbridge distribution route. Four pallets of consumer electronics unaccounted for across six weeks.',
    priority: 'medium',
    status: 'active',
    progress: 41,
    assigneeId: 'u-ryan',
    teamIds: ['u-ryan', 'u-amara'],
    tags: ['logistics', 'theft', 'northbridge'],
    openedAt: iso(61, 9, 0),
    dueAt: iso(-9, 17, 0),
    updatedAt: iso(3, 15, 12),
    jurisdiction: 'Regional — Law Enforcement Liaison',
    caseType: 'Asset Loss',
  },
  {
    id: 'c-009',
    code: 'CN-2026-009',
    title: 'Internal Fraud Assessment',
    summary:
      'Expense reimbursement anomalies across the regional sales division. Duplicate receipts detected by automated controls.',
    priority: 'high',
    status: 'review',
    progress: 87,
    assigneeId: 'u-amara',
    teamIds: ['u-amara', 'u-priya'],
    tags: ['expenses', 'fraud', 'sales-division'],
    openedAt: iso(120, 9, 0),
    dueAt: iso(6, 17, 0),
    updatedAt: iso(5, 11, 45),
    jurisdiction: 'Internal — Corporate Ethics',
    caseType: 'Financial Misconduct',
  },
  {
    id: 'c-006',
    code: 'CN-2026-006',
    title: 'Vendor Collusion Case',
    summary:
      'Bid-rigging indicators across three facilities-management tenders. Near-identical pricing structures from nominally competing vendors.',
    priority: 'critical',
    status: 'pending',
    progress: 23,
    assigneeId: 'u-jason',
    teamIds: ['u-jason', 'u-priya'],
    tags: ['collusion', 'tender', 'antitrust'],
    openedAt: iso(146, 9, 0),
    updatedAt: iso(12, 10, 20),
    jurisdiction: 'Internal — Legal Hold',
    caseType: 'Competition',
  },
  {
    id: 'c-003',
    code: 'CN-2026-003',
    title: 'Data Exfiltration Incident',
    summary:
      'Departing engineer suspected of copying source repositories to personal storage in the two weeks before resignation.',
    priority: 'medium',
    status: 'closed',
    progress: 100,
    assigneeId: 'u-ryan',
    teamIds: ['u-ryan'],
    tags: ['insider', 'ip-theft', 'closed'],
    openedAt: iso(198, 9, 0),
    updatedAt: iso(38, 16, 0),
    jurisdiction: 'Internal — IT Security',
    caseType: 'Information Security',
  },
]

/* ------------------------------------------------ Registration documents */

/**
 * Documents filed against a case at intake, shown on the Case Registration
 * tab. The first of each is a stand-in "scan" rendered as an SVG so the viewer
 * has an image to show; the rest are text so their content reads inline. The
 * blob payloads are built at seed time (see seedDatabase) and their sizes are
 * filled in from the generated Blob. A real deployment stores the signed PDFs.
 */
const CASE_DOCUMENTS: Record<string, CaseDocument[]> = {
  'c-014': [
    { id: 'cd-014-1', name: 'Laporan Dugaan Pelanggaran Etika.svg', category: 'Laporan', blobId: 'blob-doc-014-1', mime: 'image/svg+xml', size: 0, uploadedBy: 'Elena Vos', uploadedAt: iso(94, 10, 5), note: 'Laporan anonim dari ethics-line yang membuka perkara ini.' },
    { id: 'cd-014-2', name: 'Formulir Registrasi Perkara.txt', category: 'Registrasi', blobId: 'blob-doc-014-2', mime: 'text/plain', size: 0, uploadedBy: 'Dana Whitfield', uploadedAt: iso(94, 10, 30) },
    { id: 'cd-014-3', name: 'Kronologi Pengadaan FY2024.txt', category: 'Kronologi', blobId: 'blob-doc-014-3', mime: 'text/plain', size: 0, uploadedBy: 'Jason Bennett', uploadedAt: iso(90, 11, 0), note: 'Susunan peristiwa pengadaan yang dipersoalkan.' },
    { id: 'cd-014-4', name: 'Nota Dinas Penunjukan Tim.txt', category: 'Nota Dinas', blobId: 'blob-doc-014-4', mime: 'text/plain', size: 0, uploadedBy: 'Elena Vos', uploadedAt: iso(94, 12, 0) },
  ],
  'c-011': [
    { id: 'cd-011-1', name: 'Laporan Kehilangan Kargo.svg', category: 'Laporan', blobId: 'blob-doc-011-1', mime: 'image/svg+xml', size: 0, uploadedBy: 'Ryan Kowalski', uploadedAt: iso(61, 9, 10), note: 'Laporan awal dari kepala gudang Northbridge.' },
    { id: 'cd-011-2', name: 'Formulir Registrasi Perkara.txt', category: 'Registrasi', blobId: 'blob-doc-011-2', mime: 'text/plain', size: 0, uploadedBy: 'Dana Whitfield', uploadedAt: iso(61, 9, 40) },
    { id: 'cd-011-3', name: 'Manifes Pengiriman Northbridge.txt', category: 'Lampiran', blobId: 'blob-doc-011-3', mime: 'text/plain', size: 0, uploadedBy: 'Amara Osei', uploadedAt: iso(60, 14, 0) },
  ],
  'c-009': [
    { id: 'cd-009-1', name: 'Laporan Anomali Reimbursement.svg', category: 'Laporan', blobId: 'blob-doc-009-1', mime: 'image/svg+xml', size: 0, uploadedBy: 'Amara Osei', uploadedAt: iso(120, 9, 10), note: 'Ditemukan oleh kontrol otomatis atas duplikasi kuitansi.' },
    { id: 'cd-009-2', name: 'Formulir Registrasi Perkara.txt', category: 'Registrasi', blobId: 'blob-doc-009-2', mime: 'text/plain', size: 0, uploadedBy: 'Dana Whitfield', uploadedAt: iso(120, 9, 40) },
    { id: 'cd-009-3', name: 'Ringkasan Temuan Kontrol Otomatis.txt', category: 'Lampiran', blobId: 'blob-doc-009-3', mime: 'text/plain', size: 0, uploadedBy: 'Amara Osei', uploadedAt: iso(119, 15, 0) },
  ],
  'c-006': [
    { id: 'cd-006-1', name: 'Laporan Indikasi Persekongkolan Tender.svg', category: 'Laporan', blobId: 'blob-doc-006-1', mime: 'image/svg+xml', size: 0, uploadedBy: 'Jason Bennett', uploadedAt: iso(146, 9, 10) },
    { id: 'cd-006-2', name: 'Formulir Registrasi Perkara.txt', category: 'Registrasi', blobId: 'blob-doc-006-2', mime: 'text/plain', size: 0, uploadedBy: 'Dana Whitfield', uploadedAt: iso(146, 9, 40) },
    { id: 'cd-006-3', name: 'Perbandingan Penawaran Tiga Vendor.txt', category: 'Lampiran', blobId: 'blob-doc-006-3', mime: 'text/plain', size: 0, uploadedBy: 'Priya Raman', uploadedAt: iso(145, 13, 0), note: 'Struktur harga yang nyaris identik antar vendor pesaing.' },
  ],
  'c-003': [
    { id: 'cd-003-1', name: 'Laporan Insiden Keamanan.svg', category: 'Laporan', blobId: 'blob-doc-003-1', mime: 'image/svg+xml', size: 0, uploadedBy: 'Ryan Kowalski', uploadedAt: iso(198, 9, 10) },
    { id: 'cd-003-2', name: 'Formulir Registrasi Perkara.txt', category: 'Registrasi', blobId: 'blob-doc-003-2', mime: 'text/plain', size: 0, uploadedBy: 'Dana Whitfield', uploadedAt: iso(198, 9, 40) },
    { id: 'cd-003-3', name: 'Log Akses Repositori.txt', category: 'Lampiran', blobId: 'blob-doc-003-3', mime: 'text/plain', size: 0, uploadedBy: 'Ryan Kowalski', uploadedAt: iso(197, 16, 0) },
  ],
}

/* ----------------------------------------------------------------- Graph */

const N = (n: GraphNode) => n

const NODES_014: GraphNode[] = [
  N({
    id: 'n-grant',
    caseId: 'c-014',
    kind: 'person',
    label: 'Michael Grant',
    sublabel: 'Person of Interest',
    x: 0,
    y: 0,
    risk: 'medium',
    isFocus: true,
    avatar: avatarDataUri('Michael Grant'),
    tags: ['Procurement', 'Finance', 'Key Contact'],
    summary:
      'Senior procurement manager responsible for vendor selection and contract approvals during FY2024. Sole approver on 11 of the 14 purchase orders issued to Summit Supplies. Holds signing authority up to $250,000.',
    attributes: [
      { label: 'Employee ID', value: 'EMP-4471' },
      { label: 'Department', value: 'Procurement — Hardware' },
      { label: 'Tenure', value: '7 years, 4 months' },
      { label: 'Manager', value: 'Elaine Vos (VP Operations)' },
      { label: 'Signing authority', value: 'Up to $250,000' },
      { label: 'Status', value: 'Active — duties restricted' },
    ],
    createdAt: iso(94),
  }),
  N({
    id: 'n-mitchell',
    caseId: 'c-014',
    kind: 'person',
    label: 'Sarah Mitchell',
    sublabel: 'Employee',
    x: -300,
    y: -230,
    risk: 'low',
    avatar: avatarDataUri('Sarah Mitchell'),
    tags: ['Procurement', 'Witness'],
    summary:
      'Procurement analyst who prepared the FY2024 vendor comparison sheets. Raised concerns about Summit Supplies pricing in an internal email three weeks before the ethics-line report.',
    attributes: [
      { label: 'Employee ID', value: 'EMP-5210' },
      { label: 'Department', value: 'Procurement — Hardware' },
      { label: 'Reports to', value: 'Michael Grant' },
      { label: 'Interview status', value: 'Completed — 17 May 2026' },
      { label: 'Cooperation', value: 'Full' },
    ],
    createdAt: iso(88),
  }),
  N({
    id: 'n-summit',
    caseId: 'c-014',
    kind: 'organization',
    label: 'Summit Supplies',
    sublabel: 'Vendor',
    x: -30,
    y: -320,
    risk: 'high',
    tags: ['Vendor', 'Under Review'],
    summary:
      'Hardware reseller incorporated 14 months before its first contract award. Received $2.1M across 14 purchase orders in FY2024 — 63% of the hardware category spend, up from 4% the prior year.',
    attributes: [
      { label: 'Registration', value: 'DE-8827341' },
      { label: 'Incorporated', value: '3 September 2022' },
      { label: 'Registered address', value: '2100 Wilmington Pike, Suite 210' },
      { label: 'Director', value: 'R. Castellan' },
      { label: 'FY2024 spend', value: '$2,140,880' },
      { label: 'FY2023 spend', value: '$71,200' },
      { label: 'Employees', value: '4 (per filing)' },
    ],
    createdAt: iso(92),
  }),
  N({
    id: 'n-laptop',
    caseId: 'c-014',
    kind: 'device',
    label: 'Dell Laptop',
    sublabel: 'Device',
    x: 300,
    y: -270,
    risk: 'medium',
    tags: ['Forensics', 'Imaged'],
    summary:
      'Corporate-issued laptop assigned to Michael Grant. Forensic image taken 8 May 2026. Contains draft pricing sheets dated before the corresponding vendor submissions.',
    attributes: [
      { label: 'Asset tag', value: 'IT-99120' },
      { label: 'Model', value: 'Dell Latitude 7440' },
      { label: 'Serial', value: '7XKQ2M3' },
      { label: 'Imaged by', value: 'Ryan Kowalski' },
      { label: 'Image hash (SHA-256)', value: '4f2a…c91d' },
      { label: 'Chain of custody', value: 'Unbroken' },
    ],
    createdAt: iso(68),
  }),
  N({
    id: 'n-metro',
    caseId: 'c-014',
    kind: 'location',
    label: 'Metro Office',
    sublabel: 'Location',
    x: -420,
    y: -70,
    risk: 'low',
    tags: ['Site', 'Badge Data'],
    summary:
      'Downtown corporate office housing the procurement department. Badge logs place Grant on site outside business hours on four dates aligning with PO issuance.',
    attributes: [
      { label: 'Address', value: '400 Metro Plaza, Floor 12' },
      { label: 'Badge system', value: 'HID-Gateway v4' },
      { label: 'After-hours entries', value: '4 (Mar–May 2026)' },
      { label: 'CCTV retention', value: '90 days' },
    ],
    createdAt: iso(80),
  }),
  N({
    id: 'n-po',
    caseId: 'c-014',
    kind: 'document',
    label: 'PO-73261-01',
    sublabel: 'Document',
    x: 400,
    y: -30,
    risk: 'high',
    tags: ['Contract', 'Key Evidence'],
    summary:
      'Purchase order issued to Summit Supplies on 3 May 2026 for 220 workstation units at $569.32 each — $125,250.40 total. Approved by Michael Grant without the three-quote comparison required above $100,000.',
    attributes: [
      { label: 'Issued', value: '3 May 2026, 09:40' },
      { label: 'Value', value: '$125,250.40' },
      { label: 'Line items', value: '220 × workstation unit' },
      { label: 'Unit price', value: '$569.32' },
      { label: 'Approver', value: 'Michael Grant (sole)' },
      { label: 'Policy exception', value: 'No competing quotes on file' },
      { label: 'Market benchmark', value: '$412.00/unit (−27.6%)' },
    ],
    createdAt: iso(73),
  }),
  N({
    id: 'n-email',
    caseId: 'c-014',
    kind: 'communication',
    label: 'Re: Price Update',
    sublabel: 'Email',
    x: -400,
    y: 160,
    risk: 'high',
    tags: ['Thread', 'Recovered'],
    summary:
      'Email thread between Grant and a Summit Supplies address discussing unit pricing two days before the vendor formally submitted its quote. Recovered from the forensic image after deletion.',
    attributes: [
      { label: 'Thread', value: '4 messages' },
      { label: 'Span', value: '28 Apr – 1 May 2026' },
      { label: 'Recovered from', value: 'Deleted Items (forensic)' },
      { label: 'External party', value: 'r.castellan@summit-supplies.co' },
      { label: 'Attachments', value: '1 (pricing_v3.xlsx)' },
    ],
    createdAt: iso(66),
  }),
  N({
    id: 'n-wire',
    caseId: 'c-014',
    kind: 'transaction',
    label: 'Wire Transfer',
    sublabel: '$125,250.00',
    x: -290,
    y: 340,
    risk: 'critical',
    tags: ['Financial', 'Flagged'],
    summary:
      'Outbound wire from the company operating account to Summit Supplies, settled 8 May 2026. Amount matches PO-73261-01 to the dollar. A $12,500 onward transfer left the Summit account for a third party within 48 hours.',
    attributes: [
      { label: 'Amount', value: '$125,250.00' },
      { label: 'Settled', value: '8 May 2026, 15:15' },
      { label: 'Originator', value: 'Operating Account ••4409' },
      { label: 'Beneficiary', value: 'Summit Supplies ••8871' },
      { label: 'Institution', value: 'Cardwell Bank' },
      { label: 'Onward transfer', value: '$12,500 → ••2210 (10 May)' },
      { label: 'AML flag', value: 'Raised — rapid pass-through' },
    ],
    createdAt: iso(64),
  }),
  N({
    id: 'n-camry',
    caseId: 'c-014',
    kind: 'vehicle',
    label: 'Toyota Camry',
    sublabel: 'Vehicle',
    x: -60,
    y: 400,
    risk: 'low',
    tags: ['Registration', 'ANPR'],
    summary:
      'Vehicle registered to Michael Grant. ANPR captures place it at the Wilmington Pike address — Summit Supplies’ registered office — on two occasions outside business hours.',
    attributes: [
      { label: 'Plate', value: 'KJP-4471' },
      { label: 'Make / model', value: '2023 Toyota Camry SE' },
      { label: 'Registered to', value: 'Michael Grant' },
      { label: 'ANPR hits', value: '2 (Wilmington Pike)' },
      { label: 'Dates', value: '26 Apr, 7 May 2026' },
    ],
    createdAt: iso(58),
  }),
  N({
    id: 'n-bank',
    caseId: 'c-014',
    kind: 'evidence',
    label: 'Cardwell Bank',
    sublabel: 'Evidence',
    x: 200,
    y: 380,
    risk: 'high',
    tags: ['Records', 'Subpoena'],
    summary:
      'Bank records produced under a records request covering the Summit Supplies account. Statements show the operating-account wire in and the onward transfer out.',
    attributes: [
      { label: 'Institution', value: 'Cardwell Bank, N.A.' },
      { label: 'Records span', value: 'Jan 2024 – May 2026' },
      { label: 'Accounts', value: '2' },
      { label: 'Produced', value: '2 June 2026' },
      { label: 'Format', value: 'Certified PDF + CSV' },
    ],
    createdAt: iso(43),
  }),
  N({
    id: 'n-lee',
    caseId: 'c-014',
    kind: 'witness',
    label: 'David Lee',
    sublabel: 'Witness',
    x: 340,
    y: 240,
    risk: 'low',
    avatar: avatarDataUri('David Lee'),
    tags: ['Witness', 'Interviewed'],
    summary:
      'Warehouse supervisor who received the Summit Supplies shipments. States that delivered quantities fell short of PO line items on at least two occasions and that discrepancy reports went unanswered.',
    attributes: [
      { label: 'Employee ID', value: 'EMP-3388' },
      { label: 'Role', value: 'Warehouse Supervisor' },
      { label: 'Interviewed', value: '21 May 2026' },
      { label: 'Statement', value: 'Signed, 6 pages' },
      { label: 'Cooperation', value: 'Full' },
    ],
    createdAt: iso(55),
  }),
]

const E = (
  id: string,
  source: string,
  target: string,
  kind: GraphEdge['kind'],
  strength: number,
  confirmed: boolean,
  label?: string,
): GraphEdge => ({ id, caseId: 'c-014', source, target, kind, strength, confirmed, label })

const EDGES_014: GraphEdge[] = [
  E('e-1', 'n-grant', 'n-summit', 'suspected', 0.95, false, 'undisclosed interest'),
  E('e-2', 'n-grant', 'n-po', 'ownership', 0.9, true, 'approved'),
  E('e-3', 'n-grant', 'n-laptop', 'ownership', 0.85, true, 'assigned to'),
  E('e-4', 'n-grant', 'n-email', 'communication', 0.9, true, 'participant'),
  E('e-5', 'n-grant', 'n-metro', 'presence', 0.6, true, 'badge log'),
  E('e-6', 'n-grant', 'n-camry', 'ownership', 0.7, true, 'registered'),
  E('e-7', 'n-grant', 'n-mitchell', 'employment', 0.65, true, 'manages'),
  E('e-8', 'n-grant', 'n-wire', 'suspected', 0.75, false, 'benefit'),
  E('e-9', 'n-grant', 'n-lee', 'associate', 0.4, true),
  E('e-10', 'n-summit', 'n-po', 'transaction', 0.9, true, 'supplier'),
  E('e-11', 'n-summit', 'n-email', 'communication', 0.8, true, 'sender'),
  E('e-12', 'n-summit', 'n-wire', 'transaction', 0.95, true, 'beneficiary'),
  E('e-13', 'n-summit', 'n-mitchell', 'associate', 0.35, true, 'flagged pricing'),
  E('e-14', 'n-wire', 'n-bank', 'transaction', 0.9, true, 'settled at'),
  E('e-15', 'n-wire', 'n-camry', 'suspected', 0.3, false),
  E('e-16', 'n-po', 'n-lee', 'associate', 0.5, true, 'received goods'),
  E('e-17', 'n-laptop', 'n-email', 'communication', 0.8, true, 'recovered from'),
  E('e-18', 'n-camry', 'n-bank', 'suspected', 0.25, false),
  E('e-19', 'n-mitchell', 'n-summit', 'associate', 0.3, false),
  E('e-20', 'n-summit', 'n-laptop', 'suspected', 0.4, false),
]

/** Compact graphs for the other cases so every case opens onto something real. */
function otherCaseGraph(caseId: string, specs: [string, GraphNode['kind'], string, string][]): GraphNode[] {
  const R = 300
  return specs.map(([label, kind, sublabel, summary], i) => {
    const angle = (i / (specs.length - 1 || 1)) * Math.PI * 2
    const focus = i === 0
    return N({
      id: `${caseId}-n${i}`,
      caseId,
      kind,
      label,
      sublabel,
      x: focus ? 0 : Math.cos(angle) * R,
      y: focus ? 0 : Math.sin(angle) * R * 0.75,
      risk: focus ? 'high' : i % 3 === 0 ? 'medium' : 'low',
      isFocus: focus,
      avatar: kind === 'person' || kind === 'witness' ? avatarDataUri(label) : undefined,
      tags: [sublabel],
      summary,
      attributes: [{ label: 'Case', value: caseId.toUpperCase() }],
      createdAt: iso(40),
    })
  })
}

const NODES_OTHER: GraphNode[] = [
  ...otherCaseGraph('c-011', [
    ['Marcus Webb', 'person', 'Person of Interest', 'Route driver on all six affected shipments.'],
    ['Northbridge Depot', 'location', 'Location', 'Distribution hub where pallets were last scanned.'],
    ['Pallet NB-4471', 'evidence', 'Evidence', 'Missing consumer electronics pallet, $84,000 declared value.'],
    ['Scan Log', 'document', 'Document', 'Handheld scanner export showing a 41-minute gap.'],
    ['Freightliner M2', 'vehicle', 'Vehicle', 'Tractor unit assigned to the affected route.'],
    ['Gate Camera', 'device', 'Device', 'Depot gate camera; footage overwritten past 30 days.'],
  ]),
  ...otherCaseGraph('c-009', [
    ['Regional Sales Div.', 'organization', 'Business Unit', 'Division with clustered reimbursement anomalies.'],
    ['Duplicate Receipts', 'document', 'Document', '38 receipts submitted across two expense periods.'],
    ['T&E Card ••7712', 'transaction', 'Transaction', 'Card with the highest duplicate-submission rate.'],
    ['Karen Doyle', 'witness', 'Witness', 'Expense approver who flagged the initial pattern.'],
  ]),
  ...otherCaseGraph('c-006', [
    ['Tender FM-19', 'document', 'Tender', 'Facilities tender with near-identical bid structures.'],
    ['Apex Facilities', 'organization', 'Bidder', 'Submitted the winning bid on two of three tenders.'],
    ['Clearline Group', 'organization', 'Bidder', 'Runner-up with a 0.4% pricing delta across all lots.'],
    ['Bid Spreadsheet', 'evidence', 'Evidence', 'Shared document metadata lists the same author.'],
    ['R. Castellan', 'person', 'Director', 'Named director appearing across multiple bidders.'],
  ]),
  ...otherCaseGraph('c-003', [
    ['Alan Pierce', 'person', 'Former Employee', 'Engineer who resigned on 14 December 2025.'],
    ['Repo: core-svc', 'evidence', 'Evidence', 'Repository cloned to an unmanaged device.'],
    ['USB Device', 'device', 'Device', 'Mass-storage device connected 11 December 2025.'],
  ]),
]

function otherCaseEdges(caseId: string, count: number): GraphEdge[] {
  const out: GraphEdge[] = []
  for (let i = 1; i < count; i++) {
    out.push(E(`${caseId}-e${i}`, `${caseId}-n0`, `${caseId}-n${i}`, i % 3 === 0 ? 'suspected' : 'associate', 0.6, i % 3 !== 0))
    ;(out[out.length - 1] as GraphEdge).caseId = caseId
  }
  if (count > 2) {
    const extra = E(`${caseId}-ex`, `${caseId}-n1`, `${caseId}-n2`, 'associate', 0.4, true)
    extra.caseId = caseId
    out.push(extra)
  }
  return out
}

const EDGES_OTHER: GraphEdge[] = [
  ...otherCaseEdges('c-011', 6),
  ...otherCaseEdges('c-009', 4),
  ...otherCaseEdges('c-006', 5),
  ...otherCaseEdges('c-003', 3),
]

/* ------------------------------------------------------------------ Mail */

const MAILS: Mail[] = [
  {
    id: 'm-1',
    caseId: 'c-014',
    threadId: 't-price',
    subject: 'Re: Price Update — Q2 workstation refresh',
    fromName: 'R. Castellan',
    fromAddress: 'r.castellan@summit-supplies.co',
    to: [{ name: 'Michael Grant', address: 'm.grant@meridian-int.com' }],
    body: `Michael,\n\nAttached is v3 of the pricing sheet with the adjustment we discussed on the call. I've held the unit at 569.32 as agreed — that keeps the total just under the threshold you mentioned.\n\nLet me know once the requisition is raised and I'll have the formal quote over the same day so the dates line up.\n\nRegards,\nR. Castellan\nSummit Supplies`,
    sentAt: iso(77, 16, 42),
    read: true,
    starred: true,
    flagged: true,
    folder: 'evidence',
    linkedNodeIds: ['n-grant', 'n-summit', 'n-email', 'n-po'],
    attachments: [{ id: 'a-1', name: 'pricing_v3.xlsx', size: 48213, mime: 'application/vnd.ms-excel' }],
    importance: 'high',
  },
  {
    id: 'm-2',
    caseId: 'c-014',
    threadId: 't-price',
    subject: 'Price Update — Q2 workstation refresh',
    fromName: 'Michael Grant',
    fromAddress: 'm.grant@meridian-int.com',
    to: [{ name: 'R. Castellan', address: 'r.castellan@summit-supplies.co' }],
    body: `R,\n\nBefore you send anything formal — what's the best you can do on the unit? I need the total to land where we talked about. Anything over and it goes to committee, which neither of us wants.\n\nSend it to this address, not the procurement inbox.\n\nM.`,
    sentAt: iso(79, 20, 18),
    read: true,
    starred: false,
    flagged: true,
    folder: 'evidence',
    linkedNodeIds: ['n-grant', 'n-email'],
    attachments: [],
    importance: 'high',
  },
  {
    id: 'm-3',
    caseId: 'c-014',
    threadId: 't-concern',
    subject: 'Summit Supplies pricing — concern',
    fromName: 'Sarah Mitchell',
    fromAddress: 's.mitchell@meridian-int.com',
    to: [{ name: 'Michael Grant', address: 'm.grant@meridian-int.com' }],
    cc: [{ name: 'Elaine Vos', address: 'e.vos@meridian-int.com' }],
    body: `Hi Michael,\n\nI've finished the comparison sheet for the workstation refresh. Summit is coming in about 27% above the market benchmark I pulled from the framework agreement, and they're the only vendor we've quoted this cycle.\n\nPolicy says anything over $100k needs three quotes. Do you want me to reach out to Ardent and Novacore so we have the comparison on file?\n\nSarah`,
    sentAt: iso(84, 11, 5),
    read: true,
    starred: true,
    flagged: false,
    folder: 'evidence',
    linkedNodeIds: ['n-mitchell', 'n-grant', 'n-summit'],
    attachments: [{ id: 'a-2', name: 'vendor_comparison_FY24.xlsx', size: 91442, mime: 'application/vnd.ms-excel' }],
    importance: 'normal',
  },
  {
    id: 'm-4',
    caseId: 'c-014',
    threadId: 't-concern',
    subject: 'Re: Summit Supplies pricing — concern',
    fromName: 'Michael Grant',
    fromAddress: 'm.grant@meridian-int.com',
    to: [{ name: 'Sarah Mitchell', address: 's.mitchell@meridian-int.com' }],
    body: `Sarah,\n\nNo need — Summit is already on the approved list from last year and we're up against the quarter. I'll note the single-source justification myself.\n\nLeave the comparison sheet as is, don't circulate it further.\n\nMichael`,
    sentAt: iso(84, 14, 30),
    read: true,
    starred: false,
    flagged: true,
    folder: 'evidence',
    linkedNodeIds: ['n-grant', 'n-mitchell'],
    attachments: [],
    importance: 'normal',
  },
  {
    id: 'm-5',
    caseId: 'c-014',
    threadId: 't-bank',
    subject: 'Records request CN-2026-014 — production complete',
    fromName: 'Cardwell Bank — Legal',
    fromAddress: 'legal.records@cardwellbank.com',
    to: [{ name: 'Jason Bennett', address: 'j.bennett@meridian-int.com' }],
    body: `Mr. Bennett,\n\nFurther to your request dated 19 May 2026, please find enclosed certified statements for the accounts identified below, covering January 2024 through May 2026.\n\n  • Account ••8871 — Summit Supplies LLC\n  • Account ••2210 — beneficiary of onward transfer\n\nPlease note the rapid pass-through on 10 May 2026 has been separately reported to our financial-crime unit.\n\nRegards,\nLegal Records, Cardwell Bank N.A.`,
    sentAt: iso(43, 9, 20),
    read: true,
    starred: true,
    flagged: false,
    folder: 'inbox',
    linkedNodeIds: ['n-bank', 'n-wire', 'n-summit'],
    attachments: [
      { id: 'a-3', name: 'statements_8871_certified.pdf', size: 2841002, mime: 'application/pdf' },
      { id: 'a-4', name: 'transactions_export.csv', size: 184320, mime: 'text/csv' },
    ],
    importance: 'high',
  },
  {
    id: 'm-6',
    caseId: 'c-014',
    threadId: 't-forensics',
    subject: 'Forensic image IT-99120 — preliminary findings',
    fromName: 'Ryan Kowalski',
    fromAddress: 'r.kowalski@meridian-int.com',
    to: [{ name: 'Jason Bennett', address: 'j.bennett@meridian-int.com' }],
    cc: [{ name: 'Amara Osei', address: 'a.osei@meridian-int.com' }],
    body: `Jason,\n\nImage is complete and hash-verified (SHA-256 4f2a…c91d). Three things worth your attention:\n\n1. Recovered a four-message thread with an external Summit address from Deleted Items. Timestamps put it two days before Summit's formal quote.\n2. Draft pricing sheet "pricing_v3.xlsx" exists locally with a created date preceding the vendor's submission. Author metadata is the external party.\n3. Browser history shows repeated visits to a company-formation service in August 2022, which is a month before Summit was incorporated.\n\nFull report to follow. Nothing here has been altered — working from the image only.\n\nRyan`,
    sentAt: iso(66, 17, 55),
    read: true,
    starred: true,
    flagged: true,
    folder: 'inbox',
    linkedNodeIds: ['n-laptop', 'n-email', 'n-summit', 'n-grant'],
    attachments: [{ id: 'a-5', name: 'prelim_forensics_IT-99120.pdf', size: 640233, mime: 'application/pdf' }],
    importance: 'high',
  },
  {
    id: 'm-7',
    caseId: 'c-014',
    threadId: 't-interview',
    subject: 'Interview scheduled — D. Lee (warehouse)',
    fromName: 'Dana Whitfield',
    fromAddress: 'd.whitfield@meridian-int.com',
    to: [{ name: 'Jason Bennett', address: 'j.bennett@meridian-int.com' }],
    body: `Jason,\n\nDavid Lee is confirmed for Thursday 10:00 in Room 12-B. He's asked whether he can bring his own notes on the delivery discrepancies — I said that's fine and we'd take a copy.\n\nHe mentioned on the phone that he filed two discrepancy reports last spring and never heard back. Might be worth pulling those before you sit down with him.\n\nDana`,
    sentAt: iso(57, 13, 10),
    read: true,
    starred: false,
    flagged: false,
    folder: 'inbox',
    linkedNodeIds: ['n-lee'],
    attachments: [],
    importance: 'normal',
  },
  {
    id: 'm-8',
    caseId: 'c-014',
    threadId: 't-badge',
    subject: 'Badge export — Metro Office, Mar–May',
    fromName: 'Facilities Security',
    fromAddress: 'security@meridian-int.com',
    to: [{ name: 'Jason Bennett', address: 'j.bennett@meridian-int.com' }],
    body: `Attached is the badge export you requested for floor 12, March through May.\n\nNote: CCTV for the same period is past our 90-day retention and is no longer available. Badge records are retained for two years.\n\nFacilities Security`,
    sentAt: iso(50, 8, 45),
    read: false,
    starred: false,
    flagged: false,
    folder: 'inbox',
    linkedNodeIds: ['n-metro', 'n-grant'],
    attachments: [{ id: 'a-6', name: 'badge_export_fl12.csv', size: 33218, mime: 'text/csv' }],
    importance: 'normal',
  },
  {
    id: 'm-9',
    caseId: 'c-014',
    threadId: 't-anpr',
    subject: 'ANPR match — plate KJP-4471',
    fromName: 'Amara Osei',
    fromAddress: 'a.osei@meridian-int.com',
    to: [{ name: 'Jason Bennett', address: 'j.bennett@meridian-int.com' }],
    body: `Two hits on Wilmington Pike, both outside business hours — 26 April 21:14 and 7 May 20:02. That's the same street as Summit's registered office, though the camera doesn't cover the building entrance itself, so it places the vehicle on the street and nothing more.\n\nI'd treat it as supporting, not standalone.\n\nAmara`,
    sentAt: iso(40, 15, 22),
    read: false,
    starred: false,
    flagged: false,
    folder: 'inbox',
    linkedNodeIds: ['n-camry', 'n-summit'],
    attachments: [],
    importance: 'normal',
  },
  {
    id: 'm-10',
    caseId: 'c-014',
    threadId: 't-legal',
    subject: 'Scope question before we go further',
    fromName: 'Tomás Herrera',
    fromAddress: 't.herrera@meridian-int.com',
    to: [{ name: 'Jason Bennett', address: 'j.bennett@meridian-int.com' }],
    body: `Jason,\n\nBefore the next phase — two things from counsel's side.\n\nFirst, keep the personal-device question parked until we have a clearer basis. The corporate laptop is squarely ours; his phone is not.\n\nSecond, the ANPR material came to us via a third party. I want to confirm the provenance before it goes anywhere near a report.\n\nHappy to talk it through.\n\nTomás`,
    sentAt: iso(35, 10, 0),
    read: true,
    starred: false,
    flagged: false,
    folder: 'inbox',
    linkedNodeIds: ['n-camry'],
    attachments: [],
    importance: 'normal',
  },
  {
    id: 'm-11',
    caseId: 'c-014',
    threadId: 't-status',
    subject: 'Weekly status — CN-2026-014',
    fromName: 'Jason Bennett',
    fromAddress: 'j.bennett@meridian-int.com',
    to: [{ name: 'Elaine Vos', address: 'e.vos@meridian-int.com' }],
    body: `Elaine,\n\nWhere we are as of this week:\n\n• Financial trail is documented end to end — PO, wire, and bank production all reconcile.\n• Forensics recovered pre-quote correspondence with the vendor.\n• Two witness interviews complete, both cooperative.\n\nOutstanding: the onward $12,500 beneficiary is not yet identified, and we have no direct evidence of a personal benefit to the subject. Until that gap closes I'd characterise this as a policy breach with strong indicators, not a proven kickback.\n\nJason`,
    sentAt: iso(7, 17, 30),
    read: true,
    starred: false,
    flagged: false,
    folder: 'sent',
    linkedNodeIds: ['n-grant', 'n-wire'],
    attachments: [],
    importance: 'normal',
  },
  {
    id: 'm-12',
    caseId: 'c-014',
    threadId: 't-ethics',
    subject: 'Ethics line report #EL-2026-0412 (anonymous)',
    fromName: 'Ethics Line',
    fromAddress: 'ethics-line@meridian-int.com',
    to: [{ name: 'Case Intake', address: 'intake@meridian-int.com' }],
    body: `ANONYMOUS REPORT — VERBATIM TRANSCRIPT\n\n"There's something wrong with how the hardware contracts are being awarded. One vendor gets everything now and nobody can explain why. The prices are higher than what we used to pay and the person signing them off is the same person who brought the vendor in. People have raised it and been told to leave it alone.\n\nI don't want to give my name because I still work here."\n\nReceived: 12 April 2026, 23:41\nRouted to: Corporate Ethics — Intake`,
    sentAt: iso(94, 23, 41),
    read: true,
    starred: true,
    flagged: false,
    folder: 'inbox',
    linkedNodeIds: ['n-summit', 'n-grant'],
    attachments: [],
    importance: 'high',
  },
]

/* -------------------------------------------------------------- Evidence */

const EVIDENCE: Evidence[] = [
  {
    id: 'ev-1',
    caseId: 'c-014',
    ref: 'EV-014-001',
    name: 'Purchase Order PO-73261-01',
    description:
      'Original purchase order issued to Summit Supplies, 3 May 2026. Sole-approver signature block, no competing quotes attached.',
    kind: 'document',
    status: 'verified',
    collectedBy: 'Jason Bennett',
    collectedAt: iso(73, 9, 40),
    location: 'Procurement system export',
    tags: ['contract', 'key'],
    linkedNodeIds: ['n-po', 'n-grant', 'n-summit'],
    confidence: 98,
    custody: [
      { id: 'cu-1', actor: 'Jason Bennett', action: 'Collected from procurement system', at: iso(73, 9, 40) },
      { id: 'cu-2', actor: 'Priya Raman', action: 'Verified against system of record', at: iso(70, 14, 10) },
    ],
  },
  {
    id: 'ev-2',
    caseId: 'c-014',
    ref: 'EV-014-002',
    name: 'Forensic image — laptop IT-99120',
    description:
      'Full-disk image of the corporate laptop assigned to Michael Grant. SHA-256 verified at acquisition and on transfer.',
    kind: 'digital',
    status: 'verified',
    collectedBy: 'Ryan Kowalski',
    collectedAt: iso(68, 11, 0),
    location: 'Forensics lab — evidence locker 3',
    tags: ['forensics', 'imaged', 'key'],
    linkedNodeIds: ['n-laptop', 'n-grant', 'n-email'],
    confidence: 99,
    custody: [
      { id: 'cu-3', actor: 'Ryan Kowalski', action: 'Device seized from workstation', at: iso(68, 9, 15), note: 'Witnessed by D. Whitfield' },
      { id: 'cu-4', actor: 'Ryan Kowalski', action: 'Image acquired, hash recorded', at: iso(68, 11, 0) },
      { id: 'cu-5', actor: 'Ryan Kowalski', action: 'Sealed in locker 3', at: iso(68, 12, 30) },
    ],
  },
  {
    id: 'ev-3',
    caseId: 'c-014',
    ref: 'EV-014-003',
    name: 'Bank statements — Summit Supplies ••8871',
    description:
      'Certified statements produced by Cardwell Bank covering Jan 2024 – May 2026. Shows the inbound wire and the $12,500 onward transfer.',
    kind: 'financial',
    status: 'verified',
    collectedBy: 'Amara Osei',
    collectedAt: iso(43, 9, 20),
    location: 'Secure file transfer — Cardwell Legal',
    tags: ['financial', 'certified', 'key'],
    linkedNodeIds: ['n-bank', 'n-wire', 'n-summit'],
    confidence: 97,
    custody: [
      { id: 'cu-6', actor: 'Cardwell Bank — Legal', action: 'Produced under records request', at: iso(43, 9, 20) },
      { id: 'cu-7', actor: 'Amara Osei', action: 'Received and logged', at: iso(43, 10, 5) },
      { id: 'cu-8', actor: 'Priya Raman', action: 'Certification verified', at: iso(41, 16, 0) },
    ],
  },
  {
    id: 'ev-4',
    caseId: 'c-014',
    ref: 'EV-014-004',
    name: 'Recovered email thread — "Price Update"',
    description:
      'Four messages recovered from Deleted Items on the forensic image. Predates the vendor’s formal quote by two days.',
    kind: 'digital',
    status: 'verified',
    collectedBy: 'Ryan Kowalski',
    collectedAt: iso(66, 17, 55),
    location: 'Derived from EV-014-002',
    tags: ['recovered', 'correspondence', 'key'],
    linkedNodeIds: ['n-email', 'n-grant', 'n-summit'],
    confidence: 94,
    custody: [
      { id: 'cu-9', actor: 'Ryan Kowalski', action: 'Extracted from image', at: iso(66, 17, 55), note: 'Working copy only; image untouched' },
    ],
  },
  {
    id: 'ev-5',
    caseId: 'c-014',
    ref: 'EV-014-005',
    name: 'Vendor comparison sheet FY2024',
    description:
      'Spreadsheet prepared by Sarah Mitchell showing Summit pricing 27.6% above benchmark. Circulation was discouraged by the subject.',
    kind: 'document',
    status: 'verified',
    collectedBy: 'Jason Bennett',
    collectedAt: iso(84, 11, 5),
    location: 'Mail export — S. Mitchell mailbox',
    tags: ['pricing', 'analysis'],
    linkedNodeIds: ['n-mitchell', 'n-summit'],
    confidence: 92,
    custody: [{ id: 'cu-10', actor: 'Jason Bennett', action: 'Exported with custodian consent', at: iso(84, 11, 5) }],
  },
  {
    id: 'ev-6',
    caseId: 'c-014',
    ref: 'EV-014-006',
    name: 'Badge access log — Metro Office floor 12',
    description:
      'Badge system export, March–May 2026. Four after-hours entries by EMP-4471 align with PO issuance dates.',
    kind: 'digital',
    status: 'analyzing',
    collectedBy: 'Jason Bennett',
    collectedAt: iso(50, 8, 45),
    location: 'Facilities security export',
    tags: ['access', 'timeline'],
    linkedNodeIds: ['n-metro', 'n-grant'],
    confidence: 78,
    custody: [{ id: 'cu-11', actor: 'Facilities Security', action: 'Export produced', at: iso(50, 8, 45) }],
  },
  {
    id: 'ev-7',
    caseId: 'c-014',
    ref: 'EV-014-007',
    name: 'Witness statement — David Lee',
    description:
      'Signed six-page statement covering delivery shortfalls and unanswered discrepancy reports.',
    kind: 'document',
    status: 'verified',
    collectedBy: 'Jason Bennett',
    collectedAt: iso(55, 11, 30),
    location: 'Interview room 12-B',
    tags: ['witness', 'statement'],
    linkedNodeIds: ['n-lee', 'n-po'],
    confidence: 88,
    custody: [
      { id: 'cu-12', actor: 'Jason Bennett', action: 'Statement taken and signed', at: iso(55, 11, 30) },
      { id: 'cu-13', actor: 'Dana Whitfield', action: 'Scanned and filed', at: iso(55, 15, 0) },
    ],
  },
  {
    id: 'ev-8',
    caseId: 'c-014',
    ref: 'EV-014-008',
    name: 'ANPR capture set — plate KJP-4471',
    description:
      'Two automated plate captures on Wilmington Pike outside business hours. Provenance query raised by counsel — see EV note.',
    kind: 'image',
    status: 'analyzing',
    collectedBy: 'Amara Osei',
    collectedAt: iso(40, 15, 22),
    location: 'Third-party ANPR aggregator',
    tags: ['anpr', 'vehicle', 'provenance-query'],
    linkedNodeIds: ['n-camry', 'n-summit'],
    confidence: 54,
    custody: [
      { id: 'cu-14', actor: 'Amara Osei', action: 'Received from aggregator', at: iso(40, 15, 22) },
      { id: 'cu-15', actor: 'Tomás Herrera', action: 'Provenance review requested', at: iso(35, 10, 0), note: 'Do not cite in report pending review' },
    ],
  },
  {
    id: 'ev-9',
    caseId: 'c-014',
    ref: 'EV-014-009',
    name: 'Summit Supplies incorporation filing',
    description:
      'State filing dated 3 September 2022. Lists R. Castellan as sole director; registered agent is a mail-forwarding service.',
    kind: 'document',
    status: 'verified',
    collectedBy: 'Amara Osei',
    collectedAt: iso(60, 13, 0),
    location: 'Public registry',
    tags: ['corporate', 'registry'],
    linkedNodeIds: ['n-summit'],
    confidence: 96,
    custody: [{ id: 'cu-16', actor: 'Amara Osei', action: 'Retrieved from public registry', at: iso(60, 13, 0) }],
  },
  {
    id: 'ev-10',
    caseId: 'c-014',
    ref: 'EV-014-010',
    name: 'Wire confirmation — $125,250.00',
    description:
      'Treasury confirmation for the outbound wire settled 8 May 2026. Amount reconciles to PO-73261-01 exactly.',
    kind: 'financial',
    status: 'verified',
    collectedBy: 'Amara Osei',
    collectedAt: iso(64, 15, 15),
    location: 'Treasury system export',
    tags: ['financial', 'key'],
    linkedNodeIds: ['n-wire', 'n-po', 'n-summit'],
    confidence: 99,
    custody: [{ id: 'cu-17', actor: 'Amara Osei', action: 'Exported from treasury system', at: iso(64, 15, 15) }],
  },
  {
    id: 'ev-11',
    caseId: 'c-014',
    ref: 'EV-014-011',
    name: 'Delivery discrepancy reports (×2)',
    description:
      'Two internal reports filed by warehouse staff citing short deliveries against Summit POs. No recorded response.',
    kind: 'document',
    status: 'collected',
    collectedBy: 'Dana Whitfield',
    collectedAt: iso(53, 9, 0),
    location: 'Warehouse records',
    tags: ['logistics', 'corroboration'],
    linkedNodeIds: ['n-lee', 'n-po'],
    confidence: 70,
    custody: [{ id: 'cu-18', actor: 'Dana Whitfield', action: 'Collected from warehouse files', at: iso(53, 9, 0) }],
  },
  {
    id: 'ev-12',
    caseId: 'c-014',
    ref: 'EV-014-012',
    name: 'Personal device — mobile handset',
    description:
      'Subject’s personal handset. Not seized. Listed for completeness; counsel advised no basis to compel at this stage.',
    kind: 'physical',
    status: 'rejected',
    collectedBy: '—',
    collectedAt: iso(35, 10, 30),
    location: 'Not in custody',
    tags: ['out-of-scope', 'counsel-advice'],
    linkedNodeIds: ['n-grant'],
    confidence: 0,
    custody: [{ id: 'cu-19', actor: 'Tomás Herrera', action: 'Marked out of scope', at: iso(35, 10, 30), note: 'No basis to compel; revisit only with new grounds' }],
  },
]

/* ---------------------------------------------------------- Gelar Perkara */

const GELAR: GelarPerkara[] = [
  {
    id: 'gp-014-1',
    caseId: 'c-014',
    number: 'GP-014-01',
    title: 'Gelar perkara awal — penentuan arah penyelidikan',
    scheduledAt: iso(60, 10, 0),
    location: 'Ruang Rapat Investigasi 2',
    status: 'gelar-lanjutan',
    participants: ['Jason Bennett', 'Amara Osei', 'Priya Raman', 'Tomás Herrera'],
    evidence: [],
    documents: [],
    conclusion:
      'Ditemukan indikasi kuat pengadaan tanpa kompetisi: PO-73261-01 hanya bertanda tangan satu pejabat dan aliran dana ke rekening Summit Supplies cocok dengan nilai PO. Disepakati penyelidikan dilanjutkan dengan fokus pada Michael Grant sebagai terlapor, serta pendalaman jejak transaksi dan pencitraan forensik perangkat.',
    createdAt: iso(61, 9, 0),
    updatedAt: iso(60, 12, 30),
  },
  {
    id: 'gp-014-2',
    caseId: 'c-014',
    number: 'GP-014-02',
    title: 'Gelar perkara lanjutan — evaluasi hasil pemeriksaan',
    scheduledAt: iso(14, 14, 0),
    location: 'Ruang Rapat Investigasi 2',
    status: 'lanjut-sprint',
    participants: ['Jason Bennett', 'Amara Osei', 'Ryan Kowalski'],
    evidence: [],
    documents: [],
    conclusion:
      'Hasil pencitraan forensik laptop dan pemeriksaan saksi memperkuat dugaan. Direkomendasikan penyusunan laporan investigasi dan penyiapan bahan challenge session untuk panel.',
    createdAt: iso(15, 9, 0),
    updatedAt: iso(14, 16, 10),
  },
  {
    id: 'gp-014-3',
    caseId: 'c-014',
    number: 'GP-014-03',
    title: 'Gelar perkara penetapan kesimpulan akhir',
    scheduledAt: iso(-3, 9, 30),
    location: 'Ruang Rapat Investigasi 1',
    status: 'close',
    participants: [],
    evidence: [],
    documents: [],
    conclusion: '',
    createdAt: iso(2, 9, 0),
    updatedAt: iso(2, 9, 0),
  },
]

/* ----------------------------------------------------------------- Decks */

const DECK: Deck = {
  id: 'd-014',
  caseId: 'c-014',
  title: 'CN-2026-014 — Challenge Session',
  subtitle: 'Interim findings for panel review',
  updatedAt: iso(1, 16, 20),
  theme: 'midnight',
}

const T = (
  id: string,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  z: number,
  extra: Partial<Slide['elements'][number]> = {},
): Slide['elements'][number] => ({
  id, kind: 'text', text, x, y, w, h, fontSize, z,
  color: '#EAF1FF', fontWeight: 400, align: 'left', fontFamily: 'sans', ...extra,
})

const SLIDES: Slide[] = [
  {
    id: 's-1', caseId: 'c-014', deckId: 'd-014', index: 0, layout: 'title',
    background: 'gradient-midnight', notes: 'Set the frame: this is an interim position, not a conclusion. 12 minutes, then questions.',
    elements: [
      T('s1-e1', 'Procurement Irregularity', 80, 210, 800, 70, 54, 1, { fontWeight: 700 }),
      T('s1-e2', 'CN-2026-014 — Interim Findings', 80, 285, 800, 44, 26, 2, { color: '#9DB0D0' }),
      T('s1-e3', 'Jason Bennett · Lead Investigator · 15 July 2026', 80, 420, 700, 30, 16, 3, { color: '#6A7FA3' }),
      { id: 's1-e4', kind: 'shape', x: 80, y: 340, w: 120, h: 4, z: 4, fill: '#3B82F6', radius: 2 },
    ],
  },
  {
    id: 's-2', caseId: 'c-014', deckId: 'd-014', index: 1, layout: 'title-content',
    background: 'solid-void', notes: 'Keep this factual. No characterisation yet — that comes at the end.',
    elements: [
      T('s2-e1', 'What triggered the case', 70, 60, 800, 50, 36, 1, { fontWeight: 600 }),
      T('s2-e2',
        '• Anonymous ethics-line report, 12 April 2026\n\n• Alleged single-vendor steering in hardware procurement\n\n• Alleged suppression of internal pricing concerns\n\n• Named approver: senior procurement manager, FY2024',
        70, 140, 820, 300, 22, 2, { color: '#9DB0D0' }),
    ],
  },
  {
    id: 's-3', caseId: 'c-014', deckId: 'd-014', index: 2, layout: 'two-column',
    background: 'solid-void', notes: 'The two columns are deliberately asymmetric — what we can prove vs what we cannot. Expect the panel to push on the right column.',
    elements: [
      T('s3-e1', 'Established vs. open', 70, 60, 800, 50, 36, 1, { fontWeight: 600 }),
      T('s3-e2', 'Established', 70, 140, 380, 34, 20, 2, { fontWeight: 600, color: '#10B981' }),
      T('s3-e3',
        'PO issued without required competing quotes\n\nPricing 27.6% above benchmark\n\nWire reconciles to PO to the dollar\n\nPre-quote correspondence with vendor',
        70, 185, 380, 260, 17, 3, { color: '#9DB0D0' }),
      T('s3-e4', 'Open', 500, 140, 380, 34, 20, 4, { fontWeight: 600, color: '#F59E0B' }),
      T('s3-e5',
        'Beneficiary of $12,500 onward transfer\n\nNo direct evidence of personal benefit\n\nANPR provenance under counsel review\n\nVendor director not yet interviewed',
        500, 185, 380, 260, 17, 5, { color: '#9DB0D0' }),
      { id: 's3-e6', kind: 'shape', x: 478, y: 140, w: 1, h: 300, z: 6, fill: '#2B3D61' },
    ],
  },
  {
    id: 's-4', caseId: 'c-014', deckId: 'd-014', index: 3, layout: 'title-content',
    background: 'solid-surface', notes: 'Walk the graph live if the panel wants it — do not read this slide out.',
    elements: [
      T('s4-e1', 'The financial trail', 70, 60, 800, 50, 36, 1, { fontWeight: 600 }),
      { id: 's4-e2', kind: 'entity', nodeId: 'n-po', x: 70, y: 160, w: 250, h: 96, z: 2 },
      { id: 's4-e3', kind: 'entity', nodeId: 'n-wire', x: 355, y: 160, w: 250, h: 96, z: 3 },
      { id: 's4-e4', kind: 'entity', nodeId: 'n-summit', x: 640, y: 160, w: 250, h: 96, z: 4 },
      T('s4-e5',
        '$125,250.40 authorised → $125,250.00 settled → $12,500 onward within 48 hours',
        70, 300, 820, 40, 18, 5, { color: '#9DB0D0' }),
      T('s4-e6', 'The first two legs are documented and reconciled. The third is where the trail currently stops.',
        70, 350, 820, 60, 16, 6, { color: '#6A7FA3' }),
    ],
  },
  {
    id: 's-5', caseId: 'c-014', deckId: 'd-014', index: 4, layout: 'section',
    background: 'gradient-midnight', notes: 'Pause here. This is the honest answer to "so did he take a kickback" — we do not know yet.',
    elements: [
      T('s5-e1', 'Where we stop short', 80, 230, 800, 60, 42, 1, { fontWeight: 700 }),
      T('s5-e2',
        'The pattern is strong. The proof of personal benefit is not there yet. Until the onward beneficiary is identified, this is a documented policy breach with indicators — not a proven kickback.',
        80, 305, 780, 120, 19, 2, { color: '#9DB0D0' }),
    ],
  },
  {
    id: 's-6', caseId: 'c-014', deckId: 'd-014', index: 5, layout: 'title-content',
    background: 'solid-void', notes: 'Close on the asks. Be specific about what unblocks the case.',
    elements: [
      T('s6-e1', 'What we need to close', 70, 60, 800, 50, 36, 1, { fontWeight: 600 }),
      T('s6-e2',
        '1.  Records request for account ••2210 to identify the onward beneficiary\n\n2.  Counsel decision on ANPR provenance\n\n3.  Approval to approach R. Castellan (vendor director)\n\n4.  Extension to 8 August — current due date is not achievable',
        70, 145, 820, 300, 21, 2, { color: '#9DB0D0' }),
    ],
  },
]

/* ---------------------------------------------------------------- Report */

const REPORT: Report = {
  id: 'rp-014',
  caseId: 'c-014',
  title: 'Investigation Report — CN-2026-014',
  classification: 'confidential',
  author: 'Jason Bennett',
  status: 'draft',
  updatedAt: iso(0, 8, 30),
  sections: [
    {
      id: 'sec-1', level: 1, heading: 'Executive Summary',
      html: `<p>This report sets out interim findings in <strong>CN-2026-014</strong>, opened on 12 April 2026 following an anonymous report to the corporate ethics line. The report alleged that hardware procurement was being steered to a single vendor, <strong>Summit Supplies</strong>, at inflated prices, and that internal concerns about the arrangement had been discouraged.</p><p>The investigation has established that a purchase order valued at <strong>$125,250.40</strong> was approved without the competing quotes required by policy, at a unit price <strong>27.6% above</strong> the applicable market benchmark, and that correspondence between the approver and the vendor predates the vendor's formal quotation by two days.</p><p>The investigation has <em>not</em> established that the approver received a personal benefit. A $12,500 onward transfer from the vendor's account within 48 hours of settlement remains unattributed. On the present record this is properly characterised as a <strong>documented policy breach with strong indicators of an undisclosed interest</strong>, and not as a proven kickback.</p>`,
    },
    {
      id: 'sec-2', level: 1, heading: 'Scope and Methodology',
      html: `<p>The investigation examined hardware category procurement for FY2024, comprising 14 purchase orders totalling $2,140,880 issued to Summit Supplies.</p><p>Evidence was obtained from the procurement and treasury systems of record, a forensic image of the corporate laptop assigned to the subject, certified bank records produced by Cardwell Bank, badge access exports, and two witness interviews. Twelve items are catalogued in the evidence register; ten are verified, one remains under analysis, and one has been marked out of scope on the advice of counsel.</p><p>No personal devices were examined. Counsel advised that no basis exists at this stage to compel production of the subject's personal handset, and that position has been respected.</p>`,
    },
    {
      id: 'sec-3', level: 1, heading: 'Findings',
      html: `<p>The findings below are stated in the order they were established.</p>`,
    },
    {
      id: 'sec-4', level: 2, heading: 'Finding 1 — Policy breach in approval',
      html: `<p>PO-73261-01 was issued to Summit Supplies on 3 May 2026 for 220 workstation units at $569.32 per unit, totalling $125,250.40. Procurement policy requires three competing quotes for any commitment exceeding $100,000. <strong>No competing quotes are on file.</strong> The subject recorded a single-source justification personally, having declined an analyst's offer to obtain comparison quotes from two alternative vendors.</p><p>This finding is documented and not in dispute.</p>`,
    },
    {
      id: 'sec-5', level: 2, heading: 'Finding 2 — Pricing above benchmark',
      html: `<p>The unit price of $569.32 exceeds the framework benchmark of $412.00 by 27.6%. Across the FY2024 purchase orders, the aggregate variance against benchmark is approximately <strong>$412,000</strong>.</p><p>An internal comparison sheet prepared on 22 April 2026 identified this variance before the purchase order was raised. The analyst who prepared it was instructed not to circulate it further.</p>`,
    },
    {
      id: 'sec-6', level: 2, heading: 'Finding 3 — Pre-quote correspondence',
      html: `<p>A four-message thread recovered from the forensic image shows the subject and the vendor's director discussing unit pricing between 28 April and 1 May 2026 — two days before the vendor's formal quotation was submitted. In that exchange the subject asked the vendor to hold a price that would keep the total below the committee-review threshold, and directed the vendor to correspond outside the procurement inbox.</p><p>The thread had been deleted and was recovered forensically. The image hash was verified at acquisition and on transfer; the chain of custody is unbroken.</p>`,
    },
    {
      id: 'sec-7', level: 2, heading: 'Finding 4 — Financial trail, and where it stops',
      html: `<p>A wire of $125,250.00 settled to the vendor's account at Cardwell Bank on 8 May 2026, reconciling to the purchase order. Within 48 hours, $12,500 — approximately 10% of the settled amount — was transferred onward to account ••2210.</p><p>The beneficiary of that onward transfer <strong>has not been identified</strong>. A records request is outstanding. Absent that identification, no evidentiary link exists between the vendor's receipts and any benefit to the subject, and none should be inferred from the timing alone.</p>`,
    },
    {
      id: 'sec-8', level: 1, heading: 'Evidentiary Limitations',
      html: `<p>Three limitations bear on the weight of the findings and are recorded here rather than in a footnote.</p><p><strong>ANPR material.</strong> Two plate captures place a vehicle registered to the subject on the street of the vendor's registered office outside business hours. The camera does not cover the building entrance. The material was obtained via a third-party aggregator and its provenance is under review by counsel; it is not relied upon in the findings above.</p><p><strong>CCTV.</strong> Footage for the relevant period at the Metro Office is past the 90-day retention window and is unavailable. Badge records survive and are relied upon instead.</p><p><strong>Vendor director.</strong> R. Castellan has not been approached. Approval for contact is pending.</p>`,
    },
    {
      id: 'sec-9', level: 1, heading: 'Conclusion',
      html: `<p>On the evidence presently available, the approval of PO-73261-01 breached procurement policy, the pricing was materially above benchmark, and the subject was in undisclosed contact with the vendor before the vendor's quotation was submitted. Those three findings are documented and mutually corroborating.</p><p>The question of personal benefit remains open. It turns on the identity of the beneficiary of the $12,500 onward transfer, which is the subject of an outstanding records request. The investigation should not be closed, and no adverse characterisation of the subject's motive should be recorded, until that request is answered.</p>`,
    },
  ],
}

/* -------------------------------------------------------- Recommendations */

const RECS: Recommendation[] = [
  {
    id: 'rc-1', caseId: 'c-014', column: 'open', order: 0,
    title: 'Records request — account ••2210',
    detail: 'Identify the beneficiary of the $12,500 onward transfer. This is the single item blocking a conclusion on personal benefit.',
    priority: 'critical', assigneeId: 'u-amara', dueAt: iso(-7, 17), tags: ['financial', 'blocking'],
    linkedNodeIds: ['n-wire', 'n-bank'], createdAt: iso(20),
  },
  {
    id: 'rc-2', caseId: 'c-014', column: 'in_progress', order: 0,
    title: 'Reconcile all 14 FY2024 purchase orders',
    detail: 'Extend the benchmark variance analysis from the single PO to the full FY2024 set. Preliminary aggregate variance ≈ $412k.',
    priority: 'high', assigneeId: 'u-amara', dueAt: iso(-3, 17), tags: ['financial', 'analysis'],
    linkedNodeIds: ['n-po', 'n-summit'], createdAt: iso(18),
  },
  {
    id: 'rc-3', caseId: 'c-014', column: 'in_progress', order: 1,
    title: 'Complete forensic report for IT-99120',
    detail: 'Finalise the full forensic report. Preliminary findings already circulated; the formal report is needed before the panel session.',
    priority: 'high', assigneeId: 'u-ryan', dueAt: iso(-2, 17), tags: ['forensics'],
    linkedNodeIds: ['n-laptop'], createdAt: iso(30),
  },
  {
    id: 'rc-4', caseId: 'c-014', column: 'open', order: 1,
    title: 'Interview R. Castellan (vendor director)',
    detail: 'Requires approval before contact. Consider whether approaching the vendor prematurely risks the outstanding records request.',
    priority: 'high', assigneeId: 'u-jason', tags: ['interview', 'approval-needed'],
    linkedNodeIds: ['n-summit'], createdAt: iso(15),
  },
  {
    id: 'rc-5', caseId: 'c-014', column: 'open', order: 2,
    title: 'Second interview — Michael Grant',
    detail: 'Put the recovered pre-quote correspondence to the subject directly. Hold until the forensic report is final so the material is unimpeachable.',
    priority: 'high', assigneeId: 'u-jason', tags: ['interview'],
    linkedNodeIds: ['n-grant', 'n-email'], createdAt: iso(12),
  },
  {
    id: 'rc-6', caseId: 'c-014', column: 'open', order: 3,
    title: 'Resolve ANPR provenance question',
    detail: 'Counsel has asked for the chain from the aggregator before the material is cited anywhere. Currently excluded from the report.',
    priority: 'medium', assigneeId: 'u-priya', tags: ['legal', 'evidence'],
    linkedNodeIds: ['n-camry'], createdAt: iso(35),
  },
  {
    id: 'rc-7', caseId: 'c-014', column: 'open', order: 4,
    title: 'Review remaining vendors on the approved list',
    detail: 'Summit was added to the approved list a year before its first award. Check whether the same route was used for other vendors.',
    priority: 'medium', tags: ['scope', 'systemic'],
    linkedNodeIds: ['n-summit'], createdAt: iso(10),
  },
  {
    id: 'rc-8', caseId: 'c-014', column: 'open', order: 5,
    title: 'Control recommendation — single-source justifications',
    detail: 'Regardless of the outcome for the individual, the control that let one person justify their own exception should be raised with Operations.',
    priority: 'medium', tags: ['controls', 'remediation'],
    linkedNodeIds: [], createdAt: iso(8),
  },
  {
    id: 'rc-9', caseId: 'c-014', column: 'open', order: 6,
    title: 'Request extension to 8 August',
    detail: 'The current due date is not achievable with the records request outstanding. Flag early rather than miss it.',
    priority: 'low', assigneeId: 'u-dana', tags: ['admin'],
    linkedNodeIds: [], createdAt: iso(5),
  },
  {
    id: 'rc-10', caseId: 'c-014', column: 'closed', order: 0,
    title: 'Secure and image corporate laptop',
    detail: 'Completed 8 May. Hash verified, chain of custody unbroken.',
    priority: 'critical', assigneeId: 'u-ryan', tags: ['forensics'],
    linkedNodeIds: ['n-laptop'], createdAt: iso(70),
  },
  {
    id: 'rc-11', caseId: 'c-014', column: 'closed', order: 1,
    title: 'Bank records request — Cardwell',
    detail: 'Produced 2 June, certified. Covers both accounts identified at the time.',
    priority: 'high', assigneeId: 'u-amara', tags: ['financial'],
    linkedNodeIds: ['n-bank'], createdAt: iso(60),
  },
  {
    id: 'rc-12', caseId: 'c-014', column: 'closed', order: 2,
    title: 'Witness interviews — Mitchell, Lee',
    detail: 'Both complete and signed. Both cooperative; neither required a follow-up.',
    priority: 'high', assigneeId: 'u-jason', tags: ['interview'],
    linkedNodeIds: ['n-mitchell', 'n-lee'], createdAt: iso(58),
  },
]

/* ----------------------------------------------------------------- Admin */

const SETTINGS: CompanySettings = {
  id: 'settings',
  name: 'Meridian International',
  legalName: 'Meridian International Holdings, Inc.',
  address: '400 Metro Plaza, Floor 12, Wilmington, DE 19801',
  timezone: 'America/New_York',
  dateFormat: 'DD MMM YYYY',
  caseCodePrefix: 'CN',
  retentionDays: 2555,
  primaryColor: '#3B82F6',
  requireTwoFactor: true,
  watermarkExports: true,
  autoLockMinutes: 15,
}

const TEMPLATES: Template[] = [
  {
    id: 'tpl-1', kind: 'report', name: 'Standard Investigation Report', isDefault: true,
    description: 'Default structure for internal misconduct investigations. Includes the evidentiary limitations section required by counsel.',
    updatedAt: iso(30),
    blocks: ['Executive Summary', 'Scope and Methodology', 'Findings', 'Evidentiary Limitations', 'Conclusion', 'Appendix — Evidence Register'],
  },
  {
    id: 'tpl-2', kind: 'report', name: 'Preliminary Assessment', isDefault: false,
    description: 'Short-form structure for intake triage before a case is formally opened.',
    updatedAt: iso(90),
    blocks: ['Allegation', 'Initial Assessment', 'Recommendation', 'Next Steps'],
  },
  {
    id: 'tpl-3', kind: 'deck', name: 'Challenge Session Deck', isDefault: true,
    description: 'Panel-review deck. Deliberately forces an "established vs. open" split so gaps are stated up front.',
    updatedAt: iso(45),
    blocks: ['Title', 'What triggered the case', 'Established vs. open', 'The evidence trail', 'Where we stop short', 'What we need to close'],
  },
  {
    id: 'tpl-4', kind: 'deck', name: 'Executive Briefing', isDefault: false,
    description: 'Condensed five-slide format for leadership updates.',
    updatedAt: iso(120),
    blocks: ['Title', 'Position', 'Risk', 'Ask', 'Timeline'],
  },
  {
    id: 'tpl-5', kind: 'mail', name: 'Records Request — Financial Institution', isDefault: true,
    description: 'Boilerplate for bank records requests, including the certification clause.',
    updatedAt: iso(60),
    blocks: ['Header', 'Authority', 'Accounts and period', 'Certification requirement', 'Return instructions'],
  },
  {
    id: 'tpl-6', kind: 'evidence-label', name: 'Evidence Register Label', isDefault: true,
    description: 'Physical and digital evidence labels with custody block and hash field.',
    updatedAt: iso(75),
    blocks: ['Reference', 'Description', 'Collected by / at', 'Hash', 'Custody signatures'],
  },
]

const QUESTION_SETS: QuestionSet[] = [
  { id: 'qs-1', name: 'Case Intake', description: 'Completed when a case is opened. Drives triage and priority.', appliesTo: 'All cases', updatedAt: iso(40), active: true },
  { id: 'qs-2', name: 'Witness Interview', description: 'Standard opening questions for a cooperative witness.', appliesTo: 'Interviews', updatedAt: iso(55), active: true },
  { id: 'qs-3', name: 'Evidence Intake', description: 'Recorded for every item entering the register.', appliesTo: 'Evidence', updatedAt: iso(70), active: true },
  { id: 'qs-4', name: 'Case Closure Review', description: 'Sign-off checklist before a case can move to closed.', appliesTo: 'All cases', updatedAt: iso(100), active: false },
]

const QUESTIONS: Question[] = [
  { id: 'q-1', setId: 'qs-1', order: 0, label: 'How was the allegation received?', type: 'select', required: true, options: ['Ethics line (anonymous)', 'Ethics line (named)', 'Direct report to manager', 'Automated control', 'External referral', 'Audit finding'] },
  { id: 'q-2', setId: 'qs-1', order: 1, label: 'Summarise the allegation in the reporter’s own words where possible', type: 'textarea', required: true, hint: 'Avoid paraphrasing at intake — characterisation belongs later.' },
  { id: 'q-3', setId: 'qs-1', order: 2, label: 'Estimated financial exposure', type: 'number', required: false, hint: 'Leave blank if not yet quantifiable. A guess here anchors the whole case.' },
  { id: 'q-4', setId: 'qs-1', order: 3, label: 'Is a legal hold required?', type: 'boolean', required: true },
  { id: 'q-5', setId: 'qs-1', order: 4, label: 'Categories implicated', type: 'multiselect', required: true, options: ['Financial misconduct', 'Conflict of interest', 'Asset loss', 'Information security', 'Competition', 'Workplace conduct'] },
  { id: 'q-6', setId: 'qs-1', order: 5, label: 'Date of alleged conduct (earliest known)', type: 'date', required: false },

  { id: 'q-7', setId: 'qs-2', order: 0, label: 'Has the witness been advised of the purpose of the interview?', type: 'boolean', required: true },
  { id: 'q-8', setId: 'qs-2', order: 1, label: 'Is the witness attending voluntarily?', type: 'boolean', required: true },
  { id: 'q-9', setId: 'qs-2', order: 2, label: 'Describe your role and reporting line', type: 'textarea', required: true },
  { id: 'q-10', setId: 'qs-2', order: 3, label: 'In your own words, what did you observe?', type: 'textarea', required: true, hint: 'Open question first. Do not lead.' },
  { id: 'q-11', setId: 'qs-2', order: 4, label: 'Did you raise this internally? If so, to whom and when?', type: 'textarea', required: false },
  { id: 'q-12', setId: 'qs-2', order: 5, label: 'Are you aware of anyone else with direct knowledge?', type: 'text', required: false },

  { id: 'q-13', setId: 'qs-3', order: 0, label: 'Evidence reference', type: 'text', required: true },
  { id: 'q-14', setId: 'qs-3', order: 1, label: 'Source of the item', type: 'select', required: true, options: ['System of record export', 'Physical seizure', 'Third-party production', 'Public registry', 'Derived from another item', 'Voluntary provision'] },
  { id: 'q-15', setId: 'qs-3', order: 2, label: 'Is the chain of custody unbroken?', type: 'boolean', required: true },
  { id: 'q-16', setId: 'qs-3', order: 3, label: 'Hash (where applicable)', type: 'text', required: false },
  { id: 'q-17', setId: 'qs-3', order: 4, label: 'Any provenance or admissibility concern?', type: 'textarea', required: false, hint: 'Record the concern at intake, not when the report is being written.' },

  { id: 'q-18', setId: 'qs-4', order: 0, label: 'Have all outstanding requests been answered or formally abandoned?', type: 'boolean', required: true },
  { id: 'q-19', setId: 'qs-4', order: 1, label: 'Does the conclusion state what was not established?', type: 'boolean', required: true, hint: 'A conclusion that only lists what was proven is incomplete.' },
  { id: 'q-20', setId: 'qs-4', order: 2, label: 'Reviewer sign-off', type: 'text', required: true },
]

/* ---------------------------------------------------------------- SPRINT */

/**
 * Surat Perintah orders. These are the case access lists: c-003 is left
 * without one on purpose, so it is visible only to roles holding
 * `case.viewAll` — which is the rule made visible.
 */
const SPRINTS: Sprint[] = [
  {
    id: 'sp-014-1',
    caseId: 'c-014',
    number: 'SPRINT-088/INV/IV/2026',
    subject: 'Perintah investigasi awal — dugaan penyimpangan pengadaan FY2024',
    issuedBy: 'Elena Vos — Director of Integrity',
    issuedAt: iso(94, 10, 0),
    validFrom: iso(94, 10, 0),
    validUntil: iso(52, 17, 0),
    revoked: false,
    members: [
      { userId: 'u-jason', position: 'ketua', addedAt: iso(94, 10, 0) },
      { userId: 'u-amara', position: 'anggota', addedAt: iso(94, 10, 0) },
    ],
    docBlobId: 'blob-sp-014-1',
    docName: 'SPRINT-088-INV-IV-2026.txt',
    docMime: 'text/plain',
    docSize: 0,
    notes: 'Superseded by SPRINT-121 when the scope widened to the wire transfer.',
    createdAt: iso(94, 10, 0),
    updatedAt: iso(52, 17, 0),
  },
  {
    id: 'sp-014-2',
    caseId: 'c-014',
    number: 'SPRINT-121/INV/VI/2026',
    subject: 'Perpanjangan dan perluasan lingkup — aliran dana ke Summit Supplies',
    issuedBy: 'Elena Vos — Director of Integrity',
    issuedAt: iso(52, 10, 0),
    validFrom: iso(52, 10, 0),
    validUntil: iso(-30, 17, 0),
    revoked: false,
    members: [
      { userId: 'u-jason', position: 'ketua', addedAt: iso(52, 10, 0) },
      { userId: 'u-amara', position: 'anggota', addedAt: iso(52, 10, 0) },
      { userId: 'u-ryan', position: 'anggota', addedAt: iso(43, 9, 30) },
    ],
    docBlobId: 'blob-sp-014-2',
    docName: 'SPRINT-121-INV-VI-2026.txt',
    docMime: 'text/plain',
    docSize: 0,
    notes: 'Digital forensics added after the laptop image was taken.',
    createdAt: iso(52, 10, 0),
    updatedAt: iso(43, 9, 30),
  },
  {
    id: 'sp-011-1',
    caseId: 'c-011',
    number: 'SPRINT-102/INV/V/2026',
    subject: 'Perintah investigasi — kehilangan kargo rute Northbridge',
    issuedBy: 'Elena Vos — Director of Integrity',
    issuedAt: iso(61, 9, 0),
    validFrom: iso(61, 9, 0),
    revoked: false,
    members: [
      { userId: 'u-ryan', position: 'ketua', addedAt: iso(61, 9, 0) },
      { userId: 'u-amara', position: 'anggota', addedAt: iso(61, 9, 0) },
    ],
    docBlobId: 'blob-sp-011-1',
    docName: 'SPRINT-102-INV-V-2026.txt',
    docMime: 'text/plain',
    docSize: 0,
    createdAt: iso(61, 9, 0),
    updatedAt: iso(61, 9, 0),
  },
  {
    id: 'sp-009-1',
    caseId: 'c-009',
    number: 'SPRINT-071/INV/III/2026',
    subject: 'Perintah investigasi — anomali reimbursement divisi penjualan',
    issuedBy: 'Elena Vos — Director of Integrity',
    issuedAt: iso(120, 9, 0),
    validFrom: iso(120, 9, 0),
    revoked: false,
    members: [{ userId: 'u-amara', position: 'ketua', addedAt: iso(120, 9, 0) }],
    docBlobId: 'blob-sp-009-1',
    docName: 'SPRINT-071-INV-III-2026.txt',
    docMime: 'text/plain',
    docSize: 0,
    createdAt: iso(120, 9, 0),
    updatedAt: iso(120, 9, 0),
  },
  {
    id: 'sp-006-1',
    caseId: 'c-006',
    number: 'SPRINT-063/INV/II/2026',
    subject: 'Perintah investigasi — indikasi persekongkolan tender fasilitas',
    issuedBy: 'Elena Vos — Director of Integrity',
    issuedAt: iso(146, 9, 0),
    validFrom: iso(146, 9, 0),
    revoked: false,
    members: [{ userId: 'u-jason', position: 'ketua', addedAt: iso(146, 9, 0) }],
    docBlobId: 'blob-sp-006-1',
    docName: 'SPRINT-063-INV-II-2026.txt',
    docMime: 'text/plain',
    docSize: 0,
    createdAt: iso(146, 9, 0),
    updatedAt: iso(146, 9, 0),
  },
]

/** Stand-in for the scanned order — a real deployment stores the signed PDF. */
function sprintDocBody(s: Sprint): string {
  const team = s.members
    .map((m, i) => `${i + 1}. ${USERS.find((u) => u.id === m.userId)?.name ?? m.userId} — ${m.position.toUpperCase()}`)
    .join('\n')
  return [
    'SURAT PERINTAH INVESTIGASI',
    `Nomor: ${s.number}`,
    '',
    `Perihal   : ${s.subject}`,
    `Diterbitkan oleh : ${s.issuedBy}`,
    `Tanggal   : ${formatSeedDate(s.issuedAt)}`,
    `Berlaku   : ${formatSeedDate(s.validFrom)}${s.validUntil ? ` s.d. ${formatSeedDate(s.validUntil)}` : ' sampai dicabut'}`,
    '',
    'Memerintahkan kepada:',
    team,
    '',
    'Untuk melaksanakan investigasi sesuai perihal di atas dan melaporkan',
    'hasilnya kepada penerbit surat perintah ini.',
    '',
    '(dokumen contoh — unggahan asli berupa hasil pindai bertanda tangan)',
  ].join('\n')
}

const formatSeedDate = (isoStr: string) => new Date(isoStr).toISOString().slice(0, 10)

/* --------------------------------------- Registration document payloads */

/** Text body for a seeded registration document, so it reads inline. */
function caseDocText(doc: CaseDocument, c: Case): string {
  return [
    'MERIDIAN INTERNATIONAL — INTEGRITY OFFICE',
    (doc.category ?? 'DOKUMEN').toUpperCase(),
    '',
    `Perkara  : ${c.code} — ${c.title}`,
    `Dokumen  : ${doc.name}`,
    `Diajukan : ${doc.uploadedBy ?? '—'} · ${formatSeedDate(doc.uploadedAt)}`,
    '',
    doc.note ?? '',
    doc.note ? '' : null,
    'Ringkasan perkara:',
    c.summary,
    '',
    '— — —',
    'Dokumen contoh untuk pratinjau. Unggah berkas asli untuk menggantikannya.',
  ]
    .filter((line) => line !== null)
    .join('\n')
}

/** A stand-in "scan" cover page rendered as SVG, so the viewer has an image. */
function docScanSvg(doc: CaseDocument, c: Case): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const wrapped = wrapText(c.title, 34)
  const titleLines = wrapped
    .map((line, i) => `<text x="60" y="${232 + i * 30}" font-size="22" font-weight="700" fill="#0f172a">${esc(line)}</text>`)
    .join('')
  const ruled = Array.from({ length: 9 }, (_, i) =>
    `<rect x="60" y="${360 + i * 30}" width="${i === 8 ? 300 : 480}" height="9" rx="4.5" fill="#e2e8f0"/>`,
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="820" viewBox="0 0 600 820" font-family="Georgia, 'Times New Roman', serif">
  <rect width="600" height="820" fill="#ffffff"/>
  <rect x="24" y="24" width="552" height="772" fill="none" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="24" y="24" width="552" height="96" fill="#1e293b"/>
  <text x="60" y="72" font-size="15" letter-spacing="3" fill="#e2e8f0">MERIDIAN INTERNATIONAL</text>
  <text x="60" y="98" font-size="12" letter-spacing="2" fill="#94a3b8">INTEGRITY OFFICE · CASE REGISTRATION</text>
  <text x="60" y="176" font-size="13" letter-spacing="4" fill="#64748b">${esc((doc.category ?? 'DOKUMEN').toUpperCase())}</text>
  <text x="60" y="204" font-size="12" fill="#94a3b8">${esc(c.code)}</text>
  ${titleLines}
  ${ruled}
  <g transform="rotate(-8 430 600)">
    <rect x="360" y="560" width="180" height="72" rx="8" fill="none" stroke="#b91c1c" stroke-width="3"/>
    <text x="450" y="592" font-size="19" font-weight="700" fill="#b91c1c" text-anchor="middle" letter-spacing="2">RAHASIA</text>
    <text x="450" y="616" font-size="11" fill="#b91c1c" text-anchor="middle">${esc(formatSeedDate(doc.uploadedAt))}</text>
  </g>
  <line x1="60" y1="720" x2="300" y2="720" stroke="#94a3b8" stroke-width="1.5"/>
  <text x="60" y="742" font-size="12" fill="#475569">${esc(doc.uploadedBy ?? 'Petugas Registrasi')}</text>
  <text x="60" y="760" font-size="10" fill="#94a3b8">Petugas Registrasi Perkara</text>
</svg>`
}

/** Naive word-wrap for the SVG title, splitting on spaces at a column budget. */
function wrapText(text: string, max: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) {
      lines.push(line)
      line = w
    } else {
      line = (line + ' ' + w).trim()
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

/* ------------------------------------------------------------- Interview */

const INTERVIEWEES: Interviewee[] = [
  {
    id: 'iv-grant',
    caseId: 'c-014',
    name: 'Michael Grant',
    kind: 'terlapor',
    position: 'Senior Procurement Manager',
    identityNo: 'EMP-40218',
    phone: '+1 555 0142',
    address: 'Metro Office, Level 4 — Procurement',
    nodeId: 'n-grant',
    createdAt: iso(60, 9, 0),
  },
  {
    id: 'iv-mitchell',
    caseId: 'c-014',
    name: 'Sarah Mitchell',
    kind: 'saksi',
    position: 'Procurement Analyst',
    identityNo: 'EMP-40887',
    phone: '+1 555 0173',
    address: 'Metro Office, Level 4 — Procurement',
    nodeId: 'n-mitchell',
    createdAt: iso(58, 9, 0),
  },
  {
    id: 'iv-lee',
    caseId: 'c-014',
    name: 'David Lee',
    kind: 'saksi',
    position: 'Facilities Contractor',
    identityNo: 'CTR-1180',
    phone: '+1 555 0219',
    nodeId: 'n-lee',
    createdAt: iso(57, 13, 10),
  },
  {
    id: 'iv-north',
    caseId: 'c-011',
    name: 'Owen Brady',
    kind: 'saksi',
    position: 'Route Driver — Northbridge',
    identityNo: 'EMP-51204',
    createdAt: iso(40, 9, 0),
  },
]

const BAPS: Bap[] = [
  {
    id: 'bap-1',
    caseId: 'c-014',
    intervieweeId: 'iv-mitchell',
    number: 'BAP-014/01/VI/2026',
    questionSetId: 'qs-2',
    investigatorIds: ['u-jason', 'u-amara'],
    status: 'signed',
    location: 'Metro Office — Ruang Rapat 4B',
    startedAt: iso(56, 10, 0),
    completedAt: iso(56, 12, 15),
    notes: 'Kooperatif. Menyerahkan salinan email pengadaan tanpa diminta.',
    updatedAt: iso(56, 12, 15),
    answers: [
      { questionId: 'q-7', value: 'yes' },
      { questionId: 'q-8', value: 'yes' },
      {
        questionId: 'q-9',
        value:
          'Procurement Analyst sejak 2022, melapor langsung kepada Michael Grant. Menyiapkan perbandingan harga vendor untuk paket hardware FY2024.',
      },
      {
        questionId: 'q-10',
        value:
          'Perbandingan harga yang saya susun menempatkan Summit Supplies pada urutan ketiga. Pada revisi berikutnya angka Summit turun menjadi terendah tanpa penjelasan, dan revisi itu bukan saya yang membuat.',
        note: 'Sejalan dengan PO-73261-01 dan thread "Re: Price Update".',
      },
      {
        questionId: 'q-11',
        value: 'Saya menyampaikan secara lisan kepada Michael Grant pada Februari 2026. Tidak ada tindak lanjut tertulis.',
      },
      { questionId: 'q-12', value: 'David Lee (Facilities Contractor) ikut menghadiri walkthrough vendor.' },
    ],
  },
  {
    id: 'bap-2',
    caseId: 'c-014',
    intervieweeId: 'iv-lee',
    number: 'BAP-014/02/VII/2026',
    questionSetId: 'qs-2',
    investigatorIds: ['u-jason'],
    status: 'in_progress',
    location: 'Metro Office — Ruang Rapat 4B',
    startedAt: iso(2, 14, 0),
    notes: '',
    updatedAt: iso(2, 15, 30),
    answers: [
      { questionId: 'q-7', value: 'yes' },
      { questionId: 'q-8', value: 'yes' },
      { questionId: 'q-9', value: 'Kontraktor fasilitas, bekerja pada gedung Metro Office sejak 2021.' },
    ],
  },
  {
    id: 'bap-3',
    caseId: 'c-014',
    intervieweeId: 'iv-grant',
    number: 'BAP-014/03/VII/2026',
    questionSetId: 'qs-2',
    investigatorIds: ['u-jason', 'u-ryan'],
    status: 'draft',
    location: 'Belum ditentukan',
    startedAt: iso(-3, 10, 0),
    notes: 'Menunggu jawaban Cardwell Bank sebelum pemeriksaan terlapor.',
    updatedAt: iso(1, 9, 0),
    answers: [],
  },
]

/* -------------------------------------------------------------- Activity */

const ACTIVITIES: Activity[] = [
  { id: 'ac-1', caseId: 'c-014', actorId: 'u-jason', verb: 'updated the conclusion in', object: 'Investigation Report', at: iso(0, 8, 30), kind: 'report' },
  { id: 'ac-2', caseId: 'c-014', actorId: 'u-amara', verb: 'flagged', object: 'onward transfer ••2210 as unattributed', at: iso(0, 7, 15), kind: 'graph' },
  { id: 'ac-3', caseId: 'c-014', actorId: 'u-jason', verb: 'reordered', object: 'Challenge Session deck', at: iso(1, 16, 20), kind: 'deck' },
  { id: 'ac-4', caseId: 'c-011', actorId: 'u-ryan', verb: 'added', object: 'Gate Camera to the graph', at: iso(3, 15, 12), kind: 'graph' },
  { id: 'ac-5', caseId: 'c-009', actorId: 'u-amara', verb: 'moved', object: 'CN-2026-009 to review', at: iso(5, 11, 45), kind: 'case' },
  { id: 'ac-6', caseId: 'c-014', actorId: 'u-jason', verb: 'sent', object: 'weekly status to E. Vos', at: iso(7, 17, 30), kind: 'mail' },
  { id: 'ac-7', caseId: 'c-006', actorId: 'u-priya', verb: 'placed', object: 'CN-2026-006 under legal hold', at: iso(12, 10, 20), kind: 'case' },
  { id: 'ac-8', caseId: 'c-014', actorId: 'u-tom', verb: 'requested provenance review of', object: 'EV-014-008 (ANPR)', at: iso(35, 10, 0), kind: 'evidence' },
  { id: 'ac-9', caseId: 'c-014', actorId: 'u-amara', verb: 'logged', object: 'EV-014-003 bank statements', at: iso(43, 10, 5), kind: 'evidence' },
  { id: 'ac-10', caseId: 'c-014', actorId: 'u-ryan', verb: 'verified image hash for', object: 'EV-014-002', at: iso(68, 11, 0), kind: 'evidence' },
  { id: 'ac-11', caseId: 'c-014', actorId: 'u-dana', verb: 'scheduled', object: 'interview with D. Lee', at: iso(57, 13, 10), kind: 'case' },
  { id: 'ac-12', caseId: 'c-014', actorId: 'u-jason', verb: 'opened', object: 'CN-2026-014', at: iso(94, 10, 0), kind: 'case' },
]

const NOTIFICATIONS: Notification[] = [
  { id: 'nt-1', title: 'Records request overdue', body: 'Account ••2210 request to Cardwell Bank has passed its expected response date. This is the item blocking CN-2026-014.', at: iso(0, 7, 45), read: false, kind: 'warn', caseId: 'c-014' },
  { id: 'nt-2', title: 'Case due date at risk', body: 'CN-2026-014 is due in 24 days with a blocking request outstanding. An extension request is sitting in the backlog.', at: iso(0, 6, 30), read: false, kind: 'warn', caseId: 'c-014' },
  { id: 'nt-3', title: 'Forensic report finalised', body: 'Ryan Kowalski marked the IT-99120 forensic report ready for review.', at: iso(1, 9, 12), read: false, kind: 'success', caseId: 'c-014' },
  { id: 'nt-4', title: 'CN-2026-009 moved to review', body: 'Amara Osei moved Internal Fraud Assessment into review. Your sign-off is requested.', at: iso(5, 11, 45), read: true, kind: 'info', caseId: 'c-009' },
]

/* ------------------------------------------------------------------ Seed */

export async function seedDatabase(force = false): Promise<void> {
  const existing = await db.cases.count()
  if (existing > 0 && !force) return

  // Every SPRINT carries its order document, so the seed has to produce one
  // before the rows that reference it.
  const sprintDocs: BlobRecord[] = []
  const sprints = SPRINTS.map((s) => {
    const data = new Blob([sprintDocBody(s)], { type: s.docMime })
    sprintDocs.push({ id: s.docBlobId, data })
    return { ...s, docSize: data.size }
  })

  // Registration documents work the same way: build each blob, then attach the
  // document list (with real sizes) to its case.
  const caseDocs: BlobRecord[] = []
  const cases = CASES.map((c) => {
    const documents = (CASE_DOCUMENTS[c.id] ?? []).map((d) => {
      const body = d.mime === 'image/svg+xml' ? docScanSvg(d, c) : caseDocText(d, c)
      const data = new Blob([body], { type: d.mime ?? 'text/plain' })
      if (d.blobId) caseDocs.push({ id: d.blobId, data })
      return { ...d, size: data.size }
    })
    return { ...c, documents }
  })

  await db.transaction(
    'rw',
    [
      db.cases, db.nodes, db.edges, db.mails, db.evidence, db.blobs, db.decks, db.slides,
      db.reports, db.recommendations, db.users, db.roles, db.settings,
      db.templates, db.questionSets, db.questions, db.activities, db.notifications,
      db.sprints, db.interviewees, db.baps, db.gelarPerkara,
    ],
    async () => {
      await Promise.all([
        db.blobs.bulkPut([...sprintDocs, ...caseDocs]),
        db.sprints.bulkPut(sprints),
        db.interviewees.bulkPut(INTERVIEWEES),
        db.baps.bulkPut(BAPS),
        db.gelarPerkara.bulkPut(GELAR),
        db.cases.bulkPut(cases),
        db.nodes.bulkPut([...NODES_014, ...NODES_OTHER]),
        db.edges.bulkPut([...EDGES_014, ...EDGES_OTHER]),
        db.mails.bulkPut(MAILS),
        db.evidence.bulkPut(EVIDENCE),
        db.decks.bulkPut([DECK]),
        db.slides.bulkPut(SLIDES),
        db.reports.bulkPut([REPORT]),
        db.recommendations.bulkPut(RECS),
        db.users.bulkPut(USERS),
        db.roles.bulkPut(ROLES),
        db.settings.put(SETTINGS),
        db.templates.bulkPut(TEMPLATES),
        db.questionSets.bulkPut(QUESTION_SETS),
        db.questions.bulkPut(QUESTIONS),
        db.activities.bulkPut(ACTIVITIES),
        db.notifications.bulkPut(NOTIFICATIONS),
      ])
    },
  )
}

/**
 * The user a fresh install starts as. Who is actually signed in lives in the
 * session store — it is switchable, because access now depends on it.
 */
export const CURRENT_USER_ID = 'u-jason'
