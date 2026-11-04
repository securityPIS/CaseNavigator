import type { Permission, Role, Sprint, User } from './types'

/**
 * Case access rules.
 *
 * A case is reachable if your role can see every case, if an active SPRINT
 * on that case names you, or if you were added to the case's viewers by hand.
 * Investigators hold no workspace-wide view, so their caseload is the orders
 * they are named on plus any case they were given by hand.
 */

export type SprintState = 'draft' | 'active' | 'scheduled' | 'expired' | 'revoked'

export function sprintState(s: Sprint, now = Date.now()): SprintState {
  if (s.revoked) return 'revoked'
  // Unsigned letters authorise nobody, whatever dates they carry.
  if (s.draft) return 'draft'
  if (new Date(s.validFrom).getTime() > now) return 'scheduled'
  if (s.validUntil && new Date(s.validUntil).getTime() < now) return 'expired'
  return 'active'
}

export const SPRINT_STATE_META: Record<SprintState, { label: string; color: string }> = {
  draft: { label: 'Draft — awaiting signature', color: '#A855F7' },
  active: { label: 'Active', color: '#10B981' },
  scheduled: { label: 'Not yet in force', color: '#F59E0B' },
  expired: { label: 'Expired', color: '#6A7FA3' },
  revoked: { label: 'Revoked', color: '#EF4444' },
}

export function can(role: Role | undefined, permission: Permission): boolean {
  return role?.permissions.includes(permission) ?? false
}

/** Investigators named on an in-force SPRINT for this case. */
export function assignedUserIds(sprints: Sprint[]): Set<string> {
  const ids = new Set<string>()
  for (const s of sprints) {
    if (sprintState(s) !== 'active') continue
    for (const m of s.members) ids.add(m.userId)
  }
  return ids
}

export function canAccessCase(
  user: User | undefined,
  role: Role | undefined,
  caseSprints: Sprint[],
  /** People given access to this case by hand (Case.viewerIds). */
  viewerIds: string[] = [],
): boolean {
  if (!user || !user.active) return false
  if (can(role, 'case.viewAll')) return true
  return assignedUserIds(caseSprints).has(user.id) || viewerIds.includes(user.id)
}

/** Why a case is open to someone — drives the banner on the SPRINT tab. */
export function accessReason(
  user: User | undefined,
  role: Role | undefined,
  caseSprints: Sprint[],
): 'sprint' | 'role' | 'none' {
  if (!user || !user.active) return 'none'
  if (assignedUserIds(caseSprints).has(user.id)) return 'sprint'
  if (can(role, 'case.viewAll')) return 'role'
  return 'none'
}
