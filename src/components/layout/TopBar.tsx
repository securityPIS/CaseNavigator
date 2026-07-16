import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, Check, ChevronDown, HelpCircle, LogOut, Moon, Repeat2, Search, Settings, Sun, UserCircle } from 'lucide-react'
import { db } from '@/domain/db'
import { useApp } from '@/stores/app'
import { useSession } from '@/stores/session'
import { cn, isMac, relativeTime } from '@/lib/utils'
import { Avatar, Badge, IconButton, Tooltip } from '@/components/ui/primitives'
import { useNavigate } from 'react-router-dom'

export function TopBar() {
  const setCommandOpen = useApp((s) => s.setCommandOpen)
  const { userId, signInAs, theme, toggleTheme } = useSession()
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const navigate = useNavigate()

  const me = useLiveQuery(() => db.users.get(userId), [userId])
  const myRole = useLiveQuery(async () => (me ? db.roles.get(me.role) : undefined), [me?.role])
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const roles = useLiveQuery(() => db.roles.toArray(), [], [])
  const notifications = useLiveQuery(() => db.notifications.orderBy('at').reverse().toArray(), [], [])
  const unread = notifications.filter((n) => !n.read).length

  const markAllRead = async () => {
    await db.notifications.toCollection().modify({ read: true })
  }

  return (
    <header className="relative z-40 flex h-[68px] shrink-0 items-center gap-3 border-b border-line-soft bg-void/70 px-4 backdrop-blur-xl sm:gap-4 sm:px-5">
      {/* Compact brand — the sidebar (which carries the full logo) is hidden on
          phones, so the top bar isn't left headless. */}
      <div className="flex shrink-0 items-center gap-2 md:hidden">
        <svg viewBox="0 0 64 64" className="size-8" fill="none" aria-hidden>
          <defs>
            <linearGradient id="tb-g" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
              <stop stopColor="#60A5FA" />
              <stop offset="0.55" stopColor="#3B82F6" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <path d="M32 3.5 55.7 17v30L32 60.5 8.3 47V17L32 3.5Z" fill="url(#tb-g)" fillOpacity="0.16" stroke="url(#tb-g)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M22 44V21l20 22V20" stroke="url(#tb-g)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="22" cy="20.5" r="4" fill="#0B1222" stroke="#60A5FA" strokeWidth="2.5" />
          <circle cx="42" cy="43.5" r="4" fill="#0B1222" stroke="#8B5CF6" strokeWidth="2.5" />
        </svg>
      </div>

      {/* Search trigger — opens the palette rather than doing inline search,
          so there's exactly one search surface in the app. */}
      <button
        onClick={() => setCommandOpen(true)}
        className={cn(
          'group mx-auto flex h-9 w-full max-w-[480px] items-center gap-2.5 rounded-lg px-3',
          'border border-line bg-abyss/50 text-ink-4 transition-all duration-200',
          'hover:border-line-strong hover:bg-abyss/70 hover:text-ink-3',
        )}
      >
        <Search size={15} className="shrink-0" />
        <span className="flex-1 truncate text-left text-[13px]">Search cases, entities, documents, emails…</span>
        <span className="hidden items-center gap-0.5 text-[11px] text-ink-4 sm:flex">
          <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-sans">
            {isMac ? '⌘' : 'Ctrl'}
          </kbd>
          <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-sans">K</kbd>
        </span>
      </button>

      <div className="flex items-center gap-1.5">
        {/* Notifications */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}
          trigger={
            <IconButton label="Notifications" active={notifOpen} onClick={() => setNotifOpen((v) => !v)} className="relative">
              <Bell size={17} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white tnum ring-2 ring-void">
                  {unread}
                </span>
              )}
            </IconButton>
          }
        >
          <div className="w-[360px]">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <h3 className="text-[13px] font-semibold text-ink">Notifications</h3>
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] text-brand-bright hover:text-brand transition-colors">
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-ink-4">Nothing new.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      db.notifications.update(n.id, { read: true })
                      if (n.caseId) navigate(`/cases/${n.caseId}`)
                      setNotifOpen(false)
                    }}
                    className="flex w-full gap-3 border-b border-line-soft/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-tint/4"
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        n.read ? 'bg-ink-4' : n.kind === 'warn' ? 'bg-warn' : n.kind === 'success' ? 'bg-ok' : 'bg-info',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[12.5px] leading-snug', n.read ? 'text-ink-2' : 'font-medium text-ink')}>
                        {n.title}
                      </span>
                      <span className="mt-1 block text-[11.5px] leading-relaxed text-ink-4">{n.body}</span>
                      <span className="mt-1.5 block text-[10.5px] text-ink-4">{relativeTime(n.at)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </Popover>

        <Tooltip label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} side="bottom">
          <IconButton label="Toggle theme" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </IconButton>
        </Tooltip>

        <IconButton label="Help" onClick={() => setCommandOpen(true)}>
          <HelpCircle size={17} />
        </IconButton>

        <div className="mx-1.5 h-6 w-px bg-line" />

        {/* User */}
        <Popover open={userOpen} onOpenChange={setUserOpen}
          trigger={
            <button
              onClick={() => setUserOpen((v) => !v)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2 transition-colors duration-150',
                userOpen ? 'bg-tint/7' : 'hover:bg-tint/5',
              )}
            >
              <Avatar src={me?.avatar} name={me?.name ?? 'User'} size={32} />
              <span className="hidden text-left lg:block">
                <span className="block text-[12.5px] font-medium leading-tight text-ink">{me?.name}</span>
                <span className="block text-[11px] leading-tight text-ink-3">{me?.title}</span>
              </span>
              <ChevronDown size={14} className={cn('text-ink-3 transition-transform duration-200', userOpen && 'rotate-180')} />
            </button>
          }
        >
          <div className="w-[268px] py-1.5">
            <div className="border-b border-line-soft px-3.5 pb-3 pt-2">
              <p className="text-[13px] font-medium text-ink">{me?.name}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{me?.email}</p>
              {myRole && (
                <Badge color={myRole.color} size="sm" className="mt-2">
                  {myRole.name}
                </Badge>
              )}
            </div>

            {/* Switching user switches whose SPRINT assignments apply — this
                build has no auth, and access is now per-user, so being able to
                see the workspace as someone else is the only way to check it. */}
            <div className="border-b border-line-soft p-1.5">
              <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-4">
                <Repeat2 size={11} /> Sign in as
              </p>
              <div className="max-h-[212px] overflow-y-auto">
                {users
                  .filter((u) => u.active)
                  .map((u) => {
                    const role = roles.find((r) => r.id === u.role)
                    const current = u.id === userId
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          signInAs(u.id)
                          setUserOpen(false)
                          navigate('/')
                        }}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
                          current ? 'bg-brand/12' : 'hover:bg-tint/6',
                        )}
                      >
                        <Avatar src={u.avatar} name={u.name} size={24} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-[12px]', current ? 'font-medium text-ink' : 'text-ink-2')}>
                            {u.name}
                          </span>
                          <span className="block truncate text-[10px] text-ink-4">{role?.name ?? 'No role'}</span>
                        </span>
                        {current && <Check size={12} className="shrink-0 text-brand-bright" />}
                      </button>
                    )
                  })}
              </div>
            </div>

            <div className="p-1.5">
              {[
                { icon: UserCircle, label: 'Profile' },
                { icon: Settings, label: 'Preferences' },
              ].map((it) => (
                <button
                  key={it.label}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] text-ink-2 transition-colors hover:bg-tint/6 hover:text-ink"
                >
                  <it.icon size={15} />
                  {it.label}
                </button>
              ))}
              <div className="my-1.5 h-px bg-line-soft" />
              <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] text-danger transition-colors hover:bg-danger/10">
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
        </Popover>
      </div>
    </header>
  )
}

/** Click-outside popover anchored to the right of its trigger. */
function Popover({
  open,
  onOpenChange,
  trigger,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  trigger: React.ReactNode
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 glass-strong rounded-xl shadow-[var(--shadow-panel)] overflow-hidden animate-scale-in origin-top-right">
          {children}
        </div>
      )}
    </div>
  )
}
