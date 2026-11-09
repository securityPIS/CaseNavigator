import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/domain/db'
import { can, canAccessCase } from '@/domain/access'
import type { Case, Permission, Role, User } from '@/domain/types'
import { useSession } from '@/stores/session'

/**
 * The signed-in user and their role, resolved together. `ready` is false while
 * the lookup is in flight, so a gate can wait rather than flash "no access".
 */
export function useMe(): { me?: User; role?: Role; ready: boolean } {
  const userId = useSession((s) => s.userId)
  const found = useLiveQuery(async () => {
    const me = await db.users.get(userId)
    const role = me ? await db.roles.get(me.role) : undefined
    return { me, role }
  }, [userId])
  return found ? { ...found, ready: true } : { ready: false }
}

/**
 * Whether the signed-in user holds a permission. An inactive account holds
 * none — deactivating someone is meant to shut them out, not just flag them.
 */
export function useCan(permission: Permission): boolean {
  const { me, role } = useMe()
  return !!me?.active && can(role, permission)
}

/** Several permissions at once, for pages that gate more than one control. */
export function usePermissions<P extends Permission>(...permissions: P[]): Record<P, boolean> {
  const { me, role } = useMe()
  const out = {} as Record<P, boolean>
  for (const p of permissions) out[p] = !!me?.active && can(role, p)
  return out
}

/**
 * Every case the signed-in user may open.
 *
 * This is the single place the SPRINT rule is applied to a list — the case
 * list, the sidebar, the dashboard and the command palette all read from here,
 * so a case a user cannot open never appears anywhere to be clicked.
 *
 * Returns undefined while loading, so callers can hold their spinner rather
 * than flashing an empty workspace.
 */
export function useVisibleCases(): Case[] | undefined {
  const userId = useSession((s) => s.userId)
  return useLiveQuery(async () => {
    const me = await db.users.get(userId)
    const role = me ? await db.roles.get(me.role) : undefined
    // No case.view, or a deactivated account: no case at all, whatever else
    // the role holds.
    if (!me?.active || !can(role, 'case.view')) return []
    const cases = await db.cases.orderBy('updatedAt').reverse().toArray()
    if (can(role, 'case.viewAll')) return cases

    const sprints = await db.sprints.toArray()
    const byCase = new Map<string, typeof sprints>()
    for (const s of sprints) {
      const list = byCase.get(s.caseId)
      if (list) list.push(s)
      else byCase.set(s.caseId, [s])
    }
    return cases.filter((c) => canAccessCase(me, role, byCase.get(c.id) ?? [], c.viewerIds))
  }, [userId])
}
