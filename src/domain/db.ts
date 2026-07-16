import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_ROLES, DEFAULT_ROLE_ID, LEGACY_ROLE_MAP } from './roles'
import type {
  Activity,
  Bap,
  BlobRecord,
  Case,
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

class CaseNavigatorDB extends Dexie {
  cases!: EntityTable<Case, 'id'>
  nodes!: EntityTable<GraphNode, 'id'>
  edges!: EntityTable<GraphEdge, 'id'>
  mails!: EntityTable<Mail, 'id'>
  evidence!: EntityTable<Evidence, 'id'>
  blobs!: EntityTable<BlobRecord, 'id'>
  decks!: EntityTable<Deck, 'id'>
  slides!: EntityTable<Slide, 'id'>
  reports!: EntityTable<Report, 'id'>
  recommendations!: EntityTable<Recommendation, 'id'>
  users!: EntityTable<User, 'id'>
  roles!: EntityTable<Role, 'id'>
  settings!: EntityTable<CompanySettings, 'id'>
  templates!: EntityTable<Template, 'id'>
  questionSets!: EntityTable<QuestionSet, 'id'>
  questions!: EntityTable<Question, 'id'>
  activities!: EntityTable<Activity, 'id'>
  notifications!: EntityTable<Notification, 'id'>
  sprints!: EntityTable<Sprint, 'id'>
  interviewees!: EntityTable<Interviewee, 'id'>
  baps!: EntityTable<Bap, 'id'>
  gelarPerkara!: EntityTable<GelarPerkara, 'id'>

  constructor() {
    super('casenavigator')
    this.version(1).stores({
      cases: 'id, code, status, priority, assigneeId, updatedAt',
      nodes: 'id, caseId, kind, label, risk',
      edges: 'id, caseId, source, target, kind',
      mails: 'id, caseId, threadId, folder, sentAt, read, starred',
      evidence: 'id, caseId, kind, status, ref, collectedAt',
      blobs: 'id',
      decks: 'id, caseId',
      slides: 'id, caseId, deckId, index',
      reports: 'id, caseId',
      recommendations: 'id, caseId, column, order',
      users: 'id, email, role',
      roles: 'id, name',
      settings: 'id',
      templates: 'id, kind, isDefault',
      questionSets: 'id, active',
      questions: 'id, setId, order',
      activities: 'id, caseId, at, kind',
      notifications: 'id, at, read',
    })

    /**
     * v2 — SPRINT, Interview/BAP, and the five-role model.
     *
     * A browser that already has data never re-runs the seed, so everything the
     * new model needs has to be built here. Two things would otherwise break an
     * existing workspace on first load:
     *
     *  - Users still point at role ids that no longer exist, leaving them with
     *    no permissions at all.
     *  - Case access now comes from SPRINT, and an upgraded database has no
     *    orders — so every investigator would open the app to an empty
     *    workspace. The team is already recorded on each case, so that team
     *    becomes the case's founding order.
     */
    this.version(2)
      .stores({
        sprints: 'id, caseId, number',
        interviewees: 'id, caseId, kind',
        baps: 'id, caseId, intervieweeId, status',
      })
      .upgrade(async (tx) => {
        await tx.table('roles').clear()
        await tx.table('roles').bulkPut(DEFAULT_ROLES)
        await tx
          .table('users')
          .toCollection()
          .modify((u: User) => {
            u.role = LEGACY_ROLE_MAP[u.role] ?? (DEFAULT_ROLES.some((r) => r.id === u.role) ? u.role : DEFAULT_ROLE_ID)
          })

        const cases: Case[] = await tx.table('cases').toArray()
        const sprints: Sprint[] = []
        const docs: BlobRecord[] = []

        for (const [i, c] of cases.entries()) {
          // Lead the order with the case's assignee; the rest of the recorded
          // team follows as anggota.
          const memberIds = [c.assigneeId, ...c.teamIds.filter((id) => id !== c.assigneeId)].filter(Boolean)
          if (memberIds.length === 0) continue

          const docBlobId = `blob-mig-sp-${c.id}`
          const year = new Date(c.openedAt).getFullYear()
          const number = `SPRINT-${String(i + 1).padStart(3, '0')}/INV/${year}`
          const body =
            `SURAT PERINTAH INVESTIGASI\nNomor: ${number}\n\n` +
            `Perihal: ${c.title}\nPerkara: ${c.code}\n\n` +
            'Dokumen ini dibuat otomatis saat pemutakhiran sistem, dari susunan tim\n' +
            'yang sudah tercatat pada perkara. Unggah hasil pindai surat perintah\n' +
            'yang asli untuk menggantikannya.'
          const data = new Blob([body], { type: 'text/plain' })
          docs.push({ id: docBlobId, data })

          sprints.push({
            id: `sp-mig-${c.id}`,
            caseId: c.id,
            number,
            subject: c.title,
            issuedBy: 'Migrated from case team',
            issuedAt: c.openedAt,
            validFrom: c.openedAt,
            revoked: false,
            members: memberIds.map((userId, idx) => ({
              userId,
              position: idx === 0 ? 'ketua' : 'anggota',
              addedAt: c.openedAt,
            })),
            docBlobId,
            docName: `${number.replace(/\//g, '-')}.txt`,
            docMime: 'text/plain',
            docSize: data.size,
            notes: 'Created automatically when this workspace moved to SPRINT-based access. Replace the placeholder document with the signed order.',
            createdAt: c.openedAt,
            updatedAt: new Date().toISOString(),
          })
        }

        if (sprints.length > 0) {
          await tx.table('blobs').bulkPut(docs)
          await tx.table('sprints').bulkPut(sprints)
        }
      })

    /**
     * v3 — Gelar Perkara (case conference) register. Purely additive: an
     * upgraded workspace simply gains an empty table, populated as the team
     * records its conferences.
     */
    this.version(3).stores({
      gelarPerkara: 'id, caseId, scheduledAt, status',
    })

    /**
     * v4 — Gelar Perkara reshaped. The status is now the conference decision
     * (lanjut-sprint / gelar-lanjutan / close) rather than a schedule state,
     * and "evidence discussed" moved from register links (evidenceIds) to
     * uploaded file previews (evidence: GelarDoc[]). Old links can't be turned
     * back into files, so they are dropped and the collection starts empty.
     */
    this.version(4)
      .stores({
        gelarPerkara: 'id, caseId, scheduledAt, status',
      })
      .upgrade(async (tx) => {
        const STATUS_MAP: Record<string, string> = {
          dijadwalkan: 'gelar-lanjutan',
          selesai: 'close',
        }
        await tx
          .table('gelarPerkara')
          .toCollection()
          .modify((g: Record<string, unknown>) => {
            g.status = STATUS_MAP[g.status as string] ?? 'gelar-lanjutan'
            if (!Array.isArray(g.evidence)) g.evidence = []
            delete g.evidenceIds
          })
      })
  }
}

export const db = new CaseNavigatorDB()

/** Wipes and re-seeds. Exposed in the Admin Panel for demo resets. */
export async function resetDatabase() {
  await db.delete()
  await db.open()
  const { seedDatabase } = await import('./seed')
  await seedDatabase(true)
}
