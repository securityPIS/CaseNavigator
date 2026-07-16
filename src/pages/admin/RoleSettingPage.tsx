import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, KeyRound, Lock, Minus, Plus, Shield, Trash2, UserPlus } from 'lucide-react'
import { db } from '@/domain/db'
import { avatarDataUri } from '@/domain/avatar'
import { ALL_PERMISSIONS, DEFAULT_ROLE_ID, PERMISSION_GROUPS } from '@/domain/roles'
import type { Permission, Role } from '@/domain/types'
import { cn, relativeTime, uid } from '@/lib/utils'
import { Avatar, Badge, Button, Card, Input, Select, Switch, tone, Tooltip } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { AdminSection, AdminShell } from './AdminShell'
import { Field } from '@/pages/CasesPage'
import { toast } from '@/stores/toast'

export function RoleSettingPage() {
  const roles = useLiveQuery(() => db.roles.toArray(), [], [])
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newUserOpen, setNewUserOpen] = useState(false)

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null

  const toggle = async (role: Role, perm: Permission) => {
    if (role.system && perm.startsWith('admin.')) {
      toast.error('Locked', 'Administration permissions on system roles cannot be changed.')
      return
    }
    const next = role.permissions.includes(perm)
      ? role.permissions.filter((p) => p !== perm)
      : [...role.permissions, perm]
    await db.roles.update(role.id, { permissions: next })
  }

  const memberCount = (roleId: string) => users.filter((u) => u.role === roleId).length

  return (
    <AdminShell
      title="User Role Setting"
      description="Roles decide what a member can do. Permissions are additive — a member gets exactly what their role grants, and nothing else."
      actions={
        <Button variant="primary" icon={<Plus size={13} />} onClick={() => setNewOpen(true)}>
          New role
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[248px_1fr]">
        {/* Role list */}
        <div className="space-y-2">
          {roles.map((r) => {
            const count = memberCount(r.id)
            const active = selected?.id === r.id
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
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
                      {count} {count === 1 ? 'member' : 'members'} · {r.permissions.length} permissions
                    </span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail */}
        {selected && (
          <div className="space-y-5">
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
                      setSelectedId(null)
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
              description="Changes take effect immediately for everyone in this role."
              action={
                <span className="text-[10.5px] text-ink-4 tnum">
                  {selected.permissions.length} of {ALL_PERMISSIONS.length} granted
                </span>
              }
            >
              <Card className="divide-y divide-line-soft/70">
                {PERMISSION_GROUPS.map((g) => (
                  <div key={g.group} className="p-4">
                    <h3 className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3">{g.group}</h3>
                    <div className="space-y-2.5">
                      {g.items.map((p) => {
                        const on = selected.permissions.includes(p.id)
                        const locked = selected.system && p.id.startsWith('admin.')
                        return (
                          <div key={p.id} className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className={cn('text-[12px]', on ? 'text-ink' : 'text-ink-3')}>{p.label}</p>
                              <p className="mt-0.5 text-[10.5px] text-ink-4">{p.hint}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {locked && <Lock size={10} className="text-ink-4" />}
                              <Switch checked={on} disabled={locked} onChange={() => toggle(selected, p.id)} label={p.label} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </Card>
            </AdminSection>
          </div>
        )}
      </div>

      {/* Users table */}
      <AdminSection
        title="Workspace Members"
        description="Adding someone here gives them a role. It does not give them a case — an investigator reaches a case only once a SPRINT names them."
        action={
          <Button size="xs" variant="primary" icon={<UserPlus size={11} />} onClick={() => setNewUserOpen(true)}>
            Add user
          </Button>
        }
      >
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.07em] text-ink-4">
                  <th className="px-4 py-3 font-semibold">Member</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft/70">
                {users.map((u) => {
                  const role = roles.find((r) => r.id === u.role)
                  return (
                    <tr key={u.id} className={cn('transition-colors hover:bg-tint/4', !u.active && 'opacity-55')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={u.avatar} name={u.name} size={28} />
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-medium text-ink">{u.name}</p>
                            <p className="truncate text-[10.5px] text-ink-4">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-[152px]">
                          <Select
                            className="h-7 text-[11.5px]"
                            value={u.role}
                            onChange={async (e) => {
                              await db.users.update(u.id, { role: e.target.value })
                              toast.success('Role changed', `${u.name} is now ${roles.find((r) => r.id === e.target.value)?.name}.`)
                            }}
                            options={roles.map((r) => ({ value: r.id, label: r.name }))}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => db.users.update(u.id, { active: !u.active })}
                          className="transition-transform active:scale-95"
                        >
                          <Badge color={u.active ? '#10B981' : '#6A7FA3'} size="sm" dot>
                            {u.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[11px] text-ink-4">{relativeTime(u.lastSeenAt)}</td>
                      <td className="sr-only">{role?.name}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </AdminSection>

      <NewRoleModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={setSelectedId} />
      <NewUserModal open={newUserOpen} onClose={() => setNewUserOpen(false)} roles={roles} />
    </AdminShell>
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

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="New role"
      description="Start from the minimum a person needs, then add. It is easier to grant than to take away."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
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

