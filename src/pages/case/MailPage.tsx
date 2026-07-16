import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Archive,
  ArrowLeft,
  Award,
  CornerUpLeft,
  Flag,
  Forward,
  Inbox,
  Mail as MailIcon,
  Paperclip,
  Search,
  Send,
  Shapes,
  Star,
  Trash2,
} from 'lucide-react'
import { db } from '@/domain/db'
import type { EntityKind, Mail } from '@/domain/types'
import { cn, ENTITY_COLORS, formatBytes, formatDateTime, mailDateLabel } from '@/lib/utils'
import { avatarDataUri, initials } from '@/domain/avatar'
import { EmptyState, IconButton, Input, tone, Tooltip } from '@/components/ui/primitives'
import { ENTITY_ICONS } from '@/components/graph/EntityNode'
import { toast } from '@/stores/toast'

type Folder = 'inbox' | 'sent' | 'evidence' | 'archive' | 'flagged' | 'starred'

const FOLDERS: { id: Folder; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'evidence', label: 'Evidence', icon: Award },
  { id: 'flagged', label: 'Flagged', icon: Flag },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'archive', label: 'Archive', icon: Archive },
]

export function MailPage() {
  const { caseId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const openId = params.get('id')

  const [folder, setFolder] = useState<Folder>('inbox')
  const [query, setQuery] = useState('')

  const mails = useLiveQuery(
    () => db.mails.where('caseId').equals(caseId).reverse().sortBy('sentAt'),
    [caseId],
    [],
  )
  const nodes = useLiveQuery(() => db.nodes.where('caseId').equals(caseId).toArray(), [caseId], [])

  const counts = useMemo(() => {
    const c: Record<Folder, number> = { inbox: 0, sent: 0, evidence: 0, archive: 0, flagged: 0, starred: 0 }
    for (const m of mails) {
      c[m.folder] += 1
      if (m.flagged) c.flagged += 1
      if (m.starred) c.starred += 1
    }
    return c
  }, [mails])

  const unreadInbox = mails.filter((m) => m.folder === 'inbox' && !m.read).length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return mails.filter((m) => {
      const inFolder = folder === 'flagged' ? m.flagged : folder === 'starred' ? m.starred : m.folder === folder
      if (!inFolder) return false
      if (!q) return true
      return (
        m.subject.toLowerCase().includes(q) ||
        m.fromName.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q)
      )
    })
  }, [mails, folder, query])

  const open = useMemo(() => mails.find((m) => m.id === openId) ?? null, [mails, openId])

  // A message opened from a deep link may live in another folder — follow it.
  const syncedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!open || syncedFor.current === open.id) return
    syncedFor.current = open.id
    if (open.folder !== folder && folder !== 'flagged' && folder !== 'starred') setFolder(open.folder)
  }, [open, folder])

  const select = (id: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('id', id)
        else next.delete('id')
        return next
      },
      { replace: true },
    )
    if (id) db.mails.update(id, { read: true })
  }

  return (
    <div className="flex h-full">
      {/* Folders */}
      <nav className="hidden w-[176px] shrink-0 flex-col border-r border-line-soft p-3 md:flex">
        <ul className="space-y-0.5">
          {FOLDERS.map((f) => {
            const active = folder === f.id
            const badge = f.id === 'inbox' ? unreadInbox : counts[f.id]
            return (
              <li key={f.id}>
                <button
                  onClick={() => setFolder(f.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-150',
                    active ? 'bg-brand/12 text-ink' : 'text-ink-3 hover:bg-tint/5 hover:text-ink-2',
                  )}
                >
                  <f.icon size={15} className={cn('shrink-0', active && 'text-brand-bright')} />
                  <span className="flex-1 text-left text-[12.5px] font-medium">{f.label}</span>
                  {badge > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px text-[10px] font-semibold tnum',
                        f.id === 'inbox' && unreadInbox > 0 ? 'bg-brand text-white' : 'bg-surface-3 text-ink-3',
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-auto rounded-xl border border-line-soft bg-abyss/35 p-3">
          <p className="text-[10.5px] leading-relaxed text-ink-4">
            Messages marked <span className="text-ink-3">Evidence</span> are part of the case record and cannot be
            deleted from here.
          </p>
        </div>
      </nav>

      {/* List */}
      <div className={cn('flex w-full shrink-0 flex-col border-r border-line-soft md:w-[336px]', open && 'hidden md:flex')}>
        <div className="shrink-0 border-b border-line-soft p-3">
          <Input
            icon={<Search size={13} />}
            placeholder="Search this case's mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-[12px]"
          />
          <p className="mt-2 px-0.5 text-[10.5px] text-ink-4 tnum">
            {filtered.length} {filtered.length === 1 ? 'message' : 'messages'}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<MailIcon size={20} />}
              title="Nothing here"
              description={query ? `No messages match “${query}”.` : 'This folder is empty.'}
            />
          ) : (
            <ul>
              {filtered.map((m) => (
                <li key={m.id}>
                  <MailRow mail={m} active={m.id === openId} onClick={() => select(m.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Reader */}
      <div className={cn('min-w-0 flex-1', !open && 'hidden md:block')}>
        {open ? (
          <MailReader key={open.id} mail={open} nodes={nodes} caseId={caseId} onBack={() => select(null)} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<MailIcon size={22} />}
              title="No message selected"
              description="Pick a message from the list. Messages linked to graph entities show those links here."
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Row */

function MailRow({ mail, active, onClick }: { mail: Mail; active: boolean; onClick: () => void }) {
  const toggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await db.mails.update(mail.id, { starred: !mail.starred })
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex w-full gap-3 border-b border-line-soft/60 px-3 py-3 text-left transition-colors duration-150',
        active ? 'bg-brand/12' : 'hover:bg-tint/4',
      )}
    >
      {active && <span className="absolute inset-y-0 left-0 w-[2.5px] bg-brand-bright" />}
      {!mail.read && (
        <span className="absolute left-[9px] top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-brand shadow-[0_0_6px_rgb(59_130_246)]" />
      )}

      <img src={avatarDataUri(mail.fromName)} alt="" className="ml-3 size-8 shrink-0 rounded-full object-cover" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-[12.5px]', mail.read ? 'text-ink-2' : 'font-semibold text-ink')}>
            {mail.fromName}
          </span>
          <span className="shrink-0 text-[10px] text-ink-4 tnum">{mailDateLabel(mail.sentAt)}</span>
        </div>

        <p className={cn('mt-0.5 truncate text-[12px]', mail.read ? 'text-ink-3' : 'font-medium text-ink-2')}>
          {mail.subject}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-ink-4">{mail.body.replace(/\n+/g, ' ')}</p>

        <div className="mt-1.5 flex items-center gap-2">
          {mail.importance === 'high' && (
            <span className="rounded border border-danger/30 bg-danger/10 px-1 py-px text-[9px] font-medium text-danger">
              High
            </span>
          )}
          {mail.flagged && <Flag size={10} className="text-warn" />}
          {mail.attachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[9.5px] text-ink-4">
              <Paperclip size={9} /> <span className="tnum">{mail.attachments.length}</span>
            </span>
          )}
          {mail.linkedNodeIds.length > 0 && (
            <span className="flex items-center gap-0.5 text-[9.5px] text-ink-4">
              <Shapes size={9} /> <span className="tnum">{mail.linkedNodeIds.length}</span>
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={toggleStar}
            onKeyDown={(e) => e.key === 'Enter' && toggleStar(e as unknown as React.MouseEvent)}
            aria-label={mail.starred ? 'Unstar' : 'Star'}
            className="ml-auto text-ink-4 transition-colors hover:text-warn"
          >
            <Star size={12} className={cn(mail.starred && 'fill-warn text-warn')} />
          </span>
        </div>
      </div>
    </button>
  )
}

/* --------------------------------------------------------------- Reader */

function MailReader({
  mail,
  nodes,
  caseId,
  onBack,
}: {
  mail: Mail
  nodes: { id: string; label: string; kind: EntityKind }[]
  caseId: string
  onBack: () => void
}) {
  const thread = useLiveQuery(() => db.mails.where('threadId').equals(mail.threadId).sortBy('sentAt'), [mail.threadId], [])
  const linked = nodes.filter((n) => mail.linkedNodeIds.includes(n.id))

  const act = (label: string) => toast.info(label, 'Composing is not available in this build.')

  return (
    <div className="flex h-full flex-col animate-fade-in">
      {/* Toolbar */}
      <header className="flex shrink-0 items-center gap-1 border-b border-line-soft px-3 py-2.5">
        <IconButton label="Back to list" className="md:hidden" onClick={onBack}>
          <ArrowLeft size={16} />
        </IconButton>

        <Tooltip label="Reply">
          <IconButton label="Reply" onClick={() => act('Reply')}>
            <CornerUpLeft size={15} />
          </IconButton>
        </Tooltip>
        <Tooltip label="Forward">
          <IconButton label="Forward" onClick={() => act('Forward')}>
            <Forward size={15} />
          </IconButton>
        </Tooltip>

        <span className="mx-1 h-5 w-px bg-line" />

        <Tooltip label={mail.starred ? 'Unstar' : 'Star'}>
          <IconButton label="Star" active={mail.starred} onClick={() => db.mails.update(mail.id, { starred: !mail.starred })}>
            <Star size={15} className={cn(mail.starred && 'fill-warn text-warn')} />
          </IconButton>
        </Tooltip>
        <Tooltip label={mail.flagged ? 'Remove flag' : 'Flag'}>
          <IconButton label="Flag" active={mail.flagged} onClick={() => db.mails.update(mail.id, { flagged: !mail.flagged })}>
            <Flag size={15} className={cn(mail.flagged && 'fill-warn text-warn')} />
          </IconButton>
        </Tooltip>
        <Tooltip label="Archive">
          <IconButton
            label="Archive"
            disabled={mail.folder === 'evidence'}
            onClick={() => {
              db.mails.update(mail.id, { folder: 'archive' })
              toast.success('Archived', `“${mail.subject}” moved to Archive.`)
            }}
          >
            <Archive size={15} />
          </IconButton>
        </Tooltip>
        <Tooltip label={mail.folder === 'evidence' ? 'Evidence mail cannot be deleted' : 'Delete'}>
          <IconButton label="Delete" disabled={mail.folder === 'evidence'} onClick={() => act('Delete')}>
            <Trash2 size={15} />
          </IconButton>
        </Tooltip>

        {mail.folder === 'evidence' && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-entity-witness/30 bg-entity-witness/10 px-2.5 py-1 text-[10.5px] font-medium text-entity-witness">
            <Award size={11} /> Case record
          </span>
        )}
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-6 py-6">
          <h1 className="text-[20px] font-semibold leading-snug tracking-tight text-ink">{mail.subject}</h1>

          <div className="mt-4 flex items-start gap-3 border-b border-line-soft pb-5">
            <img src={avatarDataUri(mail.fromName)} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13.5px] font-medium text-ink">{mail.fromName}</span>
                <span className="text-[11.5px] text-ink-4">&lt;{mail.fromAddress}&gt;</span>
              </div>
              <p className="mt-1 text-[11.5px] text-ink-3">
                to {mail.to.map((t) => t.name).join(', ')}
                {mail.cc && mail.cc.length > 0 && (
                  <span className="text-ink-4"> · cc {mail.cc.map((c) => c.name).join(', ')}</span>
                )}
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-ink-4 tnum">{formatDateTime(mail.sentAt)}</span>
          </div>

          <div className="mt-5 whitespace-pre-wrap text-[13.5px] leading-[1.75] text-ink-2">{mail.body}</div>

          {/* Attachments */}
          {mail.attachments.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
                <Paperclip size={11} /> {mail.attachments.length} attachment{mail.attachments.length > 1 ? 's' : ''}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {mail.attachments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => toast.info('Attachment', 'Seeded attachments have no file payload in this build.')}
                    className="group flex items-center gap-3 rounded-xl border border-line bg-abyss/40 p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand/6"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-[9px] font-bold uppercase text-ink-3">
                      {a.name.split('.').pop()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-ink-2 transition-colors group-hover:text-ink">{a.name}</span>
                      <span className="mt-0.5 block text-[10.5px] text-ink-4 tnum">{formatBytes(a.size)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Linked entities */}
          {linked.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
                <Shapes size={11} /> Linked entities
              </h2>
              <div className="flex flex-wrap gap-2">
                {linked.map((n) => {
                  const color = ENTITY_COLORS[n.kind]
                  const Icon = ENTITY_ICONS[n.kind]
                  return (
                    <Link
                      key={n.id}
                      to={`/cases/${caseId}/graph?node=${n.id}`}
                      className="tone flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11.5px] transition-transform hover:scale-[1.03]"
                      style={tone(color)}
                    >
                      <Icon size={12} />
                      {n.label}
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Thread */}
          {thread.length > 1 && (
            <section className="mt-7 border-t border-line-soft pt-5">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
                Thread · {thread.length} messages
              </h2>
              <ol className="space-y-2">
                {thread.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/cases/${caseId}/mail?id=${t.id}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                        t.id === mail.id
                          ? 'border-brand/40 bg-brand/10'
                          : 'border-line-soft bg-abyss/30 hover:border-line-strong hover:bg-tint/4',
                      )}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[9px] font-semibold text-ink-2">
                        {initials(t.fromName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] text-ink-2">{t.fromName}</span>
                        <span className="mt-0.5 block truncate text-[10.5px] text-ink-4">
                          {t.body.slice(0, 76).replace(/\n+/g, ' ')}…
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] text-ink-4 tnum">{mailDateLabel(t.sentAt)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
