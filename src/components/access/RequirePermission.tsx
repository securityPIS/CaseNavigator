import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { ALL_PERMISSIONS } from '@/domain/roles'
import type { Permission } from '@/domain/types'
import { can } from '@/domain/access'
import { useMe } from '@/hooks/useAccess'
import { PageSpinner } from '@/components/ui/PageSpinner'

export function permissionLabel(p: Permission): string {
  return ALL_PERMISSIONS.find((x) => x.id === p)?.label ?? p
}

/**
 * Renders its children only for a signed-in, active user whose role holds the
 * permission. Everyone else sees why they are stopped, and by which permission,
 * so an admin reading the Role Setting page knows which switch to flip.
 */
export function RequirePermission({
  permission,
  children,
  back = { to: '/', label: 'Back to dashboard' },
}: {
  permission: Permission
  children: ReactNode
  back?: { to: string; label: string } | null
}) {
  const { me, role, ready } = useMe()
  if (!ready) return <PageSpinner />
  if (me?.active && can(role, permission)) return <>{children}</>
  return <NoPermission permission={permission} roleName={role?.name} inactive={!!me && !me.active} back={back} />
}

export function NoPermission({
  permission,
  roleName,
  inactive,
  back = { to: '/', label: 'Back to dashboard' },
}: {
  permission: Permission
  roleName?: string
  inactive?: boolean
  back?: { to: string; label: string } | null
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-[420px] text-center animate-fade-up">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-warn/30 bg-warn/10 text-warn">
          <Lock size={22} />
        </span>
        <h1 className="text-[16px] font-semibold text-ink">
          {inactive ? 'This account is inactive' : 'You don’t have access to this page'}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          {inactive ? (
            'An administrator deactivated this account, so it holds no permissions. Ask them to reactivate it.'
          ) : (
            <>
              It needs the <span className="font-medium text-ink-2">{permissionLabel(permission)}</span> permission
              {roleName ? (
                <>
                  , which the <span className="font-medium text-ink-2">{roleName}</span> role does not grant
                </>
              ) : null}
              . An administrator can turn it on in Admin Panel → User Setting → User Role Setting.
            </>
          )}
        </p>
        {back && (
          <Link
            to={back.to}
            className="mt-5 inline-block rounded-lg border border-line-strong px-3.5 py-2 text-[12.5px] text-ink-2 transition-colors hover:border-brand/60 hover:text-ink"
          >
            {back.label}
          </Link>
        )}
      </div>
    </div>
  )
}
