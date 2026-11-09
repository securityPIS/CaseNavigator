import { useMemo } from 'react'
import { Building2, HelpCircle, LayoutTemplate, Users } from 'lucide-react'
import type { Permission } from '@/domain/types'
import { can } from '@/domain/access'
import { useMe } from '@/hooks/useAccess'

/**
 * The Admin Panel's pages and the permission each one needs. The sidebar, the
 * phone section switcher, the command palette and the /admin landing redirect
 * all read this list, so a page a role cannot open is never offered.
 */
export const ADMIN_ITEMS: {
  to: string
  label: string
  short: string
  icon: typeof Users
  permission: Permission
}[] = [
  { to: '/admin/company', label: 'Company Setting', short: 'Company', icon: Building2, permission: 'admin.settings' },
  { to: '/admin/users', label: 'User Setting', short: 'Users', icon: Users, permission: 'admin.users' },
  { to: '/admin/templates', label: 'Template Customization', short: 'Templates', icon: LayoutTemplate, permission: 'admin.settings' },
  { to: '/admin/questions', label: 'Questions Customization', short: 'Questions', icon: HelpCircle, permission: 'admin.settings' },
]

/** The admin pages the signed-in user may open, in menu order. */
export function useAdminItems(): typeof ADMIN_ITEMS {
  const { me, role } = useMe()
  const granted = me?.active ? (role?.permissions ?? []).join(',') : ''
  // Keyed on the grant list so callers get a stable array between renders.
  return useMemo(
    () => (granted ? ADMIN_ITEMS.filter((it) => can(role, it.permission)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [granted],
  )
}
