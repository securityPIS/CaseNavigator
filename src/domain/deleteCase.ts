import { db } from './db'

/** Every table whose rows belong to one case, keyed by an indexed caseId. */
const CASE_TABLES = [
  'nodes',
  'edges',
  'mails',
  'evidence',
  'decks',
  'slides',
  'reports',
  'recommendations',
  'activities',
  'sprints',
  'interviewees',
  'baps',
  'gelarPerkara',
] as const

/**
 * Files hang off case records under several names (blobId, docBlobId,
 * ktpBlobId…) and at several depths, so walk the records for any key ending in
 * "blobId" rather than keep a list that goes stale with the next feature.
 */
function collectBlobIds(value: unknown, out: Set<string>) {
  if (Array.isArray(value)) {
    for (const v of value) collectBlobIds(v, out)
    return
  }
  if (!value || typeof value !== 'object' || value instanceof Blob) return
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' && /blobid$/i.test(k)) out.add(v)
    else collectBlobIds(v, out)
  }
}

/**
 * Permanently remove a case and everything filed under it — graph, evidence,
 * SPRINT, interviews, reports, decks, files — in one transaction, so a failure
 * leaves the case whole rather than half gone.
 */
export async function deleteCase(caseId: string): Promise<void> {
  const tables = [db.cases, db.blobs, db.notifications, ...CASE_TABLES.map((t) => db.table(t))]
  await db.transaction('rw', tables, async () => {
    const blobIds = new Set<string>()
    collectBlobIds(await db.cases.get(caseId), blobIds)
    for (const t of CASE_TABLES) {
      const rows = db.table(t).where('caseId').equals(caseId)
      collectBlobIds(await rows.toArray(), blobIds)
      await rows.delete()
    }
    await db.notifications.filter((n) => n.caseId === caseId).delete()
    await db.blobs.bulkDelete([...blobIds])
    await db.cases.delete(caseId)
  })
}
