import type { Permission, Role, Sprint, User } from './types'

/**
 * Case access rules.
 *
 * The whole model is one sentence: a case is reachable if your role can see
 * every case, or if an active SPRINT on that case names you. Investigators
 * hold no workspace-wide view, so their caseload is exactly the set of orders
 * they have been assigned to — which is the point of issuing orders at all.
 */

export type SprintState = 'active' | 'scheduled' | 'expired' | 'revoked'

export function sprintState(s: Sprint, now = Date.now()): SprintState {
  if (s.revoked) return 'revoked'
  if (new Date(s.validFrom).getTime() > now) return 'scheduled'
  if (s.validUntil && new Date(s.validUntil).getTime() < now) return 'expired'
  return 'active'
}

export const SPRINT_STATE_META: Record<SprintState, { label: string; color: string }> = {
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

export function canAccessCase(user: User | undefined, role: Role | undefined, caseSprints: Sprint[]): boolean {
  if (!user || !user.active) return false
  if (can(role, 'case.viewAll')) return true
  return assignedUserIds(caseSprints).has(user.id)
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
