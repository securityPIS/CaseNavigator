import type { EntityKind, CasePriority, CaseStatus, RiskLevel } from '@/domain/types'

/** Tiny classnames joiner — we don't need clsx's full surface. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export const uid = (prefix = 'id'): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/* --------------------------------------------------------------- Formats */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${formatDate(iso)}, ${h12}:${m} ${ampm}`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m} ${ampm}`
}

/** "3 days ago" / "in 2 weeks" — Intl handles the pluralisation. */
const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
export function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const min = 60_000
  const hour = 3_600_000
  const day = 86_400_000
  if (abs < min) return 'just now'
  if (abs < hour) return RTF.format(Math.round(diff / min), 'minute')
  if (abs < day) return RTF.format(Math.round(diff / hour), 'hour')
  if (abs < day * 30) return RTF.format(Math.round(diff / day), 'day')
  if (abs < day * 365) return RTF.format(Math.round(diff / (day * 30)), 'month')
  return RTF.format(Math.round(diff / (day * 365)), 'year')
}

/** Calendar-day grouping label used by the mail list. */
export function mailDateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return formatTime(iso)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  if (d.getFullYear() === now.getFullYear()) return `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return formatDate(iso)
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const v = bytes / Math.pow(1024, i)
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

/* ---------------------------------------------------------------- Tokens */

export const ENTITY_COLORS: Record<EntityKind, string> = {
  person: '#38BDF8',
  organization: '#A855F7',
  location: '#F59E0B',
  device: '#22D3EE',
  document: '#3B82F6',
  communication: '#8B5CF6',
  transaction: '#10B981',
  vehicle: '#F43F5E',
  witness: '#EAB308',
  evidence: '#EF4444',
}

export const ENTITY_LABELS: Record<EntityKind, string> = {
  person: 'Person',
  organization: 'Organization',
  location: 'Location',
  device: 'Device',
  document: 'Document',
  communication: 'Communication',
  transaction: 'Transaction',
  vehicle: 'Vehicle',
  witness: 'Witness',
  evidence: 'Evidence',
}

export const RISK_META: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  low: { label: 'Low Risk', color: '#10B981', bg: 'rgb(16 185 129 / 0.14)' },
  medium: { label: 'Medium Risk', color: '#F59E0B', bg: 'rgb(245 158 11 / 0.14)' },
  high: { label: 'High Risk', color: '#F43F5E', bg: 'rgb(244 63 94 / 0.14)' },
  critical: { label: 'Critical', color: '#EF4444', bg: 'rgb(239 68 68 / 0.18)' },
}

export const PRIORITY_META: Record<CasePriority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#6A7FA3' },
  medium: { label: 'Medium', color: '#38BDF8' },
  high: { label: 'High Priority', color: '#F43F5E' },
  critical: { label: 'Critical', color: '#EF4444' },
}

export const STATUS_META: Record<CaseStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: '#10B981' },
  pending: { label: 'Pending', color: '#F59E0B' },
  review: { label: 'In Review', color: '#8B5CF6' },
  closed: { label: 'Closed', color: '#6A7FA3' },
  archived: { label: 'Archived', color: '#43567A' },
}

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

/** Highlights query matches for search results without dangerouslySetInnerHTML. */
export function splitHighlight(text: string, query: string): { text: string; hit: boolean }[] {
  if (!query.trim()) return [{ text, hit: false }]
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (i === -1) return [{ text, hit: false }]
  return [
    { text: text.slice(0, i), hit: false },
    { text: text.slice(i, i + query.length), hit: true },
    { text: text.slice(i + query.length), hit: false },
  ].filter((p) => p.text.length > 0)
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
