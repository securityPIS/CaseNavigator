import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, KeyRound, Lock, Minus, Plus, Search, Shield, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { db } from '@/domain/db'
import { avatarDataUri } from '@/domain/avatar'
import { can } from '@/domain/access'
import { ALL_PERMISSIONS, DEFAULT_ROLE_ID, PERMISSION_GROUPS } from '@/domain/roles'
import type { Permission, Role, User } from '@/domain/types'
import { cn, relativeTime, uid } from '@/lib/utils'
import { Avatar, Badge, Button, Card, Input, Select, Switch, tone, Tooltip } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { AdminSection, AdminShell } from './AdminShell'
import { Field } from '@/pages/CasesPage'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'

type Tab = 'members' | 'roles'

/** Someone who can still open this page: active, on a role holding admin.users. */
function holdsUserAdmin(u: User, roles: Role[]): boolean {
  return u.active && can(roles.find((r) => r.id === u.role), 'admin.users')
}

/**
 * User Setting — the workspace's people and the roles they hold, as two tabs.
 * Workspace Member is who is here; User Role Setting is what each role may do.
 *
 * Every change that would leave nobody able to open this page is refused: with
 * no auth in this build there is no other way back in.
 */
export function UserSettingPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'roles' ? 'roles' : 'members'
  const setTab = (t: Tab) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (t === 'members') next.delete('tab')
        else next.set('tab', t)
        return next
      },
      { replace: true },
    )

  const roles = useLiveQuery(() => db.roles.toArray(), [], [])
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const meId = useSession((s) => s.userId)

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [newRoleOpen, setNewRoleOpen] = useState(false)
  const [newUserOpen, setNewUserOpen] = useState(false)

  const TABS: { id: Tab; label: string; icon: typeof Users; count: number }[] = [
    { id: 'members', label: 'Workspace Member', icon: Users, count: users.length },
    { id: 'roles', label: 'User Role Setting', icon: ShieldCheck, count: roles.length },
  ]

  return (
    <AdminShell
      title="User Setting"
      description="Who is in the workspace and what each of them may do. A member gets exactly what their role grants — every permission is an ON/OFF switch on the role."
      actions={
        tab === 'members' ? (
          <Button variant="primary" icon={<UserPlus size={13} />} onClick={() => setNewUserOpen(true)}>
            Add user
          </Button>
        ) : (
          <Button variant="primary" icon={<Plus size={13} />} onClick={() => setNewRoleOpen(true)}>
            New role
          </Button>
        )
      }
    >
      {/* Tabs */}
      <div role="tablist" aria-label="User Setting" className="mb-6 flex gap-1 overflow-x-auto border-b border-line-soft no-scrollbar animate-fade-up">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              id={`us-tab-${t.id}`}
              aria-selected={active}
              aria-controls={`us-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative -mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[12.5px] font-medium transition-colors duration-150',
                active ? 'border-brand-bright text-ink' : 'border-transparent text-ink-3 hover:text-ink-2',
              )}
            >
              <t.icon size={15} className={cn('shrink-0', active && 'text-brand-bright')} />
              <span className="whitespace-nowrap">{t.label}</span>
              <span
                className={cn(
                  'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tnum',
                  active ? 'bg-brand/20 text-brand-bright' : 'bg-surface-3 text-ink-3',
                )}
              >
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={`us-panel-${tab}`} aria-labelledby={`us-tab-${tab}`}>
        {tab === 'members' ? (
          <MembersTab users={users} roles={roles} meId={meId} onAdd={() => setNewUserOpen(true)} />
        ) : (
          <RolesTab
            users={users}
            roles={roles}
            meId={meId}
            selectedId={selectedRoleId}
            onSelect={setSelectedRoleId}
          />
        )}
      </div>

      <NewRoleModal
        open={newRoleOpen}
        onClose={() => setNewRoleOpen(false)}
        onCreated={(id) => {
          setSelectedRoleId(id)
          setTab('roles')
        }}
      />
      <NewUserModal open={newUserOpen} onClose={() => setNewUserOpen(false)} roles={roles} />
    </AdminShell>
  )
}

/* ------------------------------------------------------- Workspace Member */

function MembersTab({
  users,
  roles,
  meId,
  onAdd,
}: {
  users: User[]
  roles: Role[]
  meId: string
  onAdd: () => void
}) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...users]
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
      .filter((u) => {
        if (roleFilter !== 'all' && u.role !== roleFilter) return false
        if (!q) return true
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.title.toLowerCase().includes(q)
      })
  }, [users, query, roleFilter])

  const activeCount = users.filter((u) => u.active).length

  const changeRole = async (u: User, roleId: string) => {
    const next = users.map((x) => (x.id === u.id ? { ...x, role: roleId } : x))
    if (!next.some((x) => holdsUserAdmin(x, roles))) {
      toast.error('Role not changed', 'Nobody active would be left who can manage users.')
      return
    }
    if (u.id === meId && !holdsUserAdmin(next.find((x) => x.id === u.id)!, roles)) {
      toast.error('Role not changed', 'That role cannot manage users — you would lock yourself out of this page.')
      return
    }
    await db.users.update(u.id, { role: roleId })
    toast.success('Role changed', `${u.name} is now ${roles.find((r) => r.id === roleId)?.name}.`)
  }

  const setActive = async (u: User, active: boolean) => {
    if (!active && u.id === meId) {
      toast.error('Not deactivated', 'You cannot deactivate the account you are signed in with.')
      return
    }
    const next = users.map((x) => (x.id === u.id ? { ...x, active } : x))
    if (!next.some((x) => holdsUserAdmin(x, roles))) {
      toast.error('Not deactivated', 'Nobody active would be left who can manage users.')
      return
    }
    await db.users.update(u.id, { active })
    toast.success(active ? 'Member activated' : 'Member deactivated', active ? `${u.name} can sign in again.` : `${u.name} can no longer open anything.`)
  }

  return (
    <AdminSection
      title="Workspace Members"
      description="Adding someone here gives them a role. It does not give them a case — an investigator reaches a case only once a SPRINT names them. A deactivated member keeps their history but holds no permission."
      action={
        <span className="text-[10.5px] text-ink-4 tnum">
          {activeCount} active · {users.length - activeCount} inactive
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="w-full max-w-[280px]">
          <Input
            icon={<Search size={13} />}
            placeholder="Search name, email or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-[12px]"
          />
        </div>
        <div className="w-[180px]">
          <Select
            className="h-8 text-[12px]"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
            options={[{ value: 'all', label: 'All roles' }, ...roles.map((r) => ({ value: r.id, label: r.name }))]}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.07em] text-ink-4">
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft/70">
              {shown.map((u) => {
                const role = roles.find((r) => r.id === u.role)
                const isMe = u.id === meId
                return (
                  <tr key={u.id} className="transition-colors hover:bg-tint/4">
                    <td className="px-4 py-3">
                      <div className={cn('flex items-center gap-2.5', !u.active && 'opacity-55')}>
                        <Avatar src={u.avatar} name={u.name} size={30} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-ink">
                            {u.name}
                            {isMe && (
                              <Badge color="#3B82F6" size="sm">
                                You
                              </Badge>
                            )}
                          </p>
                          <p className="truncate text-[10.5px] text-ink-4">
                            {u.email} · {u.title}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: role?.color ?? '#6A7FA3' }}
                          aria-hidden
                        />
                        <div className="w-[176px]">
                          <Select
                            className="h-7 text-[11.5px]"
                            value={u.role}
                            aria-label={`Role for ${u.name}`}
                            onChange={(e) => void changeRole(u, e.target.value)}
                            options={roles.map((r) => ({ value: r.id, label: r.name }))}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={u.active}
                          disabled={isMe}
                          onChange={(v) => void setActive(u, v)}
                          label={`${u.name} active`}
                        />
                        <span className={cn('text-[11.5px]', u.active ? 'text-ok' : 'text-ink-4')}>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-ink-4">{relativeTime(u.lastSeenAt)}</td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[12px] text-ink-4">
                    {users.length === 0 ? (
                      <>
                        No members yet.{' '}
                        <button onClick={onAdd} className="text-brand-bright hover:underline">
                          Add the first one
                        </button>
                      </>
                    ) : (
                      'No member matches this search.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminSection>
  )
}

/* ------------------------------------------------------ User Role Setting */

function RolesTab({
  users,
  roles,
  meId,
  selectedId,
  onSelect,
}: {
  users: User[]
  roles: Role[]
  meId: string
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null
  const me = users.find((u) => u.id === meId)
  const memberCount = (roleId: string) => users.filter((u) => u.role === roleId).length

  /** Admin keeps its administration rights — the workspace's way back in. */
  const isLocked = (role: Role, perm: Permission) => role.system && perm.startsWith('admin.')

  const toggle = async (role: Role, perm: Permission, on: boolean) => {
    if (isLocked(role, perm)) {
      toast.error('Locked', 'Administration permissions on system roles cannot be changed.')
      return
    }
    const permissions = on ? [...new Set([...role.permissions, perm])] : role.permissions.filter((p) => p !== perm)
    if (!on && perm === 'admin.users') {
      const nextRoles = roles.map((r) => (r.id === role.id ? { ...r, permissions } : r))
      if (me && me.role === role.id) {
        toast.error('Not turned off', 'You hold this role — turning it off would lock you out of User Setting.')
        return
      }
      if (!users.some((u) => holdsUserAdmin(u, nextRoles))) {
        toast.error('Not turned off', 'Nobody active would be left who can manage users.')
        return
      }
    }
    await db.roles.update(role.id, { permissions })
    const label = ALL_PERMISSIONS.find((p) => p.id === perm)?.label ?? perm
    toast.success(`${label} ${on ? 'ON' : 'OFF'}`, `${role.name}: takes effect now for its ${memberCount(role.id)} member(s).`)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[248px_1fr]">
      {/* Role list */}
      <div className="space-y-2">
        {roles.map((r) => {
          const count = memberCount(r.id)
          const active = selected?.id === r.id
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              aria-pressed={active}
              className={cn(
                'group w-full rounded-xl border p-3 text-left transition-all duration-200',
                active ? 'border-brand/50 bg-brand/8' : 'border-line-soft bg-abyss/30 hover:border-line-strong hover:bg-tint/4',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="tone flex size-7 shrink-0 items-center justify-center rounded-lg border" style={tone(r.color)}>
                  <Shield size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium text-ink">{r.name}</span>
                    {r.system && (
                      <Tooltip label="System role — cannot be deleted">
                        <Lock size={9} className="shrink-0 text-ink-4" />
                      </Tooltip>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-ink-4 tnum">
                    {count} {count === 1 ? 'member' : 'members'} · {r.permissions.length}/{ALL_PERMISSIONS.length} ON
                  </span>
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Detail */}
      {selected && (
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-ink">{selected.name}</h2>
                  {selected.system && (
                    <Badge color="#6A7FA3" size="sm">
                      <Lock size={8} /> System
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 max-w-[520px] text-[12px] leading-relaxed text-ink-3">{selected.description}</p>
              </div>

              {!selected.system && (
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 size={12} />}
                  onClick={async () => {
                    if (memberCount(selected.id) > 0) {
                      toast.error('Role in use', 'Move its members to another role first.')
                      return
                    }
                    await db.roles.delete(selected.id)
                    onSelect(null)
                    toast.success('Role deleted')
                  }}
                >
                  Delete
                </Button>
              )}
            </div>

            {/* Members */}
            <div className="mt-4 border-t border-line-soft pt-4">
              <h3 className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">Members</h3>
              <div className="flex flex-wrap gap-2">
                {users
                  .filter((u) => u.role === selected.id)
                  .map((u) => (
                    <span
                      key={u.id}
                      className={cn(
                        'flex items-center gap-2 rounded-full border border-line bg-abyss/40 py-1 pl-1 pr-3',
                        !u.active && 'opacity-50',
                      )}
                    >
                      <Avatar src={u.avatar} name={u.name} size={20} />
                      <span className="text-[11.5px] text-ink-2">{u.name}</span>
                      {!u.active && <span className="text-[9px] text-ink-4">inactive</span>}
                    </span>
                  ))}
                {memberCount(selected.id) === 0 && <p className="text-[11.5px] text-ink-4">No members in this role.</p>}
              </div>
            </div>
          </Card>

          {/* Permission matrix */}
          <AdminSection
            title="Permissions"
            description="Each switch is ON or OFF for everyone in this role, and takes effect immediately — menus, pages and buttons follow it."
            action={
              <span className="text-[10.5px] text-ink-4 tnum">
                {selected.permissions.length} of {ALL_PERMISSIONS.length} ON
              </span>
            }
          >
            <Card className="divide-y divide-line-soft/70">
              {PERMISSION_GROUPS.map((g) => {
                const onCount = g.items.filter((p) => selected.permissions.includes(p.id)).length
                return (
                  <div key={g.group} className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">{g.group}</h3>
                      <span className="text-[10px] text-ink-4 tnum">
                        {onCount}/{g.items.length} ON
                      </span>
                    </div>
                    <div className="space-y-1">
                      {g.items.map((p) => {
                        const on = selected.permissions.includes(p.id)
                        const locked = isLocked(selected, p.id)
                        const toggleEl = (
                          <Switch
                            checked={on}
                            disabled={locked}
                            onChange={(v) => void toggle(selected, p.id, v)}
                            label={p.label}
                          />
                        )
                        return (
                          <div
                            key={p.id}
                            className={cn(
                              'flex items-center justify-between gap-4 rounded-lg px-2.5 py-2 transition-colors',
                              on ? 'bg-brand/6' : 'hover:bg-tint/3',
                            )}
                          >
                            <div className="min-w-0">
                              <p className={cn('flex items-center gap-1.5 text-[12px]', on ? 'font-medium text-ink' : 'text-ink-3')}>
                                {p.label}
                                {locked && <Lock size={10} className="shrink-0 text-ink-4" aria-label="Locked" />}
                              </p>
                              <p className="mt-0.5 text-[10.5px] text-ink-4">{p.hint}</p>
                            </div>
                            {locked ? <Tooltip label="Locked on system roles">{toggleEl}</Tooltip> : toggleEl}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </Card>
          </AdminSection>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- New user */

function NewUserModal({ open, onClose, roles }: { open: boolean; onClose: () => void; roles: Role[] }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [roleId, setRoleId] = useState(DEFAULT_ROLE_ID)

  const role = roles.find((r) => r.id === roleId)
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valid = name.trim().length > 1 && emailOk && roles.length > 0

  const reset = () => {
    setName('')
    setEmail('')
    setTitle('')
    setRoleId(DEFAULT_ROLE_ID)
  }

  const close = () => {
    reset()
    onClose()
  }

  const create = async () => {
    if (!valid) return
    const clean = email.trim().toLowerCase()
    if (await db.users.where('email').equals(clean).first()) {
      toast.error('Email already in use', 'Someone in this workspace already has that address.')
      return
    }
    await db.users.add({
      id: uid('u'),
      name: name.trim(),
      email: clean,
      role: roleId,
      title: title.trim() || role?.name || 'Member',
      active: true,
      lastSeenAt: new Date().toISOString(),
      avatar: avatarDataUri(name.trim()),
    })
    toast.success('User added', `${name.trim()} joined as ${role?.name}.`)
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add user"
      description="New members start active and can sign in straight away."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={!valid}>
            Add user
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rina Hartono" />
        </Field>

        <Field label="Email" required hint={email && !emailOk ? 'That does not look like an email address.' : undefined}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className={cn(email && !emailOk && 'border-danger/60')}
          />
        </Field>

        <Field label="Job title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the role name" />
        </Field>

        <Field label="Role" required>
          <Select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
          />
        </Field>

        {role && (
          <div className="rounded-lg border border-line-soft bg-abyss/35 px-3.5 py-3">
            <p className="text-[11.5px] leading-relaxed text-ink-3">{role.description}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-2">
              <KeyRound size={11} className="shrink-0 text-brand-bright" />
              {role.permissions.includes('case.viewAll')
                ? 'Sees every case in the workspace.'
                : 'Sees only the cases whose SPRINT names them.'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function NewRoleModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [perms, setPerms] = useState<Permission[]>(['case.view', 'evidence.view', 'report.view'])

  const reset = () => {
    setName('')
    setDescription('')
    setColor('#3B82F6')
    setPerms(['case.view', 'evidence.view', 'report.view'])
  }

  const create = async () => {
    if (!name.trim()) return
    const id = uid('role')
    await db.roles.add({ id, name: name.trim(), description: description.trim() || 'No description.', color, permissions: perms })
    toast.success('Role created', `${name.trim()} is ready to assign.`)
    onCreated(id)
    reset()
    onClose()
  }

  const close = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New role"
      description="Start from the minimum a person needs, then add. It is easier to grant than to take away."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={!name.trim()}>
            Create role
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Role name" required>
          <Input autoFocus placeholder="e.g. External Counsel" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Input placeholder="What is this role for?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Colour">
          <div className="flex gap-2">
            {['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#6A7FA3'].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={c}
                className={cn(
                  'flex size-7 items-center justify-center rounded-lg border-2 transition-transform hover:scale-110',
                  color === c ? 'border-tint/60' : 'border-transparent',
                )}
                style={{ background: c }}
              >
                {color === c && <Check size={12} className="text-white" />}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Permissions" hint={`${perms.length} of ${ALL_PERMISSIONS.length} selected`}>
          <div className="max-h-[192px] space-y-1 overflow-y-auto rounded-lg border border-line bg-abyss/35 p-2">
            {PERMISSION_GROUPS.map((g) => (
              <div key={g.group}>
                <p className="px-1 pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-wide text-ink-4">{g.group}</p>
                {g.items.map((p) => {
                  const on = perms.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPerms(on ? perms.filter((x) => x !== p.id) : [...perms, p.id])}
                      className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-tint/6"
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                          on ? 'border-brand bg-brand text-white' : 'border-line-strong',
                        )}
                      >
                        {on ? <Check size={9} /> : <Minus size={7} className="text-ink-4" />}
                      </span>
                      <span className={cn('text-[11.5px]', on ? 'text-ink-2' : 'text-ink-4')}>{p.label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

