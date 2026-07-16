/**
 * Deterministic, offline avatar generator.
 *
 * Real photos would mean network requests (and licensing questions), so
 * identities get a stable gradient + initials mark derived from their id.
 */

const PALETTES: [string, string][] = [
  ['#3B82F6', '#8B5CF6'],
  ['#06B6D4', '#3B82F6'],
  ['#10B981', '#06B6D4'],
  ['#F59E0B', '#EF4444'],
  ['#8B5CF6', '#EC4899'],
  ['#0EA5E9', '#22D3EE'],
  ['#EF4444', '#F59E0B'],
  ['#6366F1', '#0EA5E9'],
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Returns a self-contained SVG data URI — safe in <img src> and CSS. */
export function avatarDataUri(name: string, seed = name): string {
  const h = hash(seed)
  const [a, b] = PALETTES[h % PALETTES.length]
  const angle = h % 360
  const text = initials(name)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
<defs><linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="80" height="80" fill="url(#g)"/>
<circle cx="${16 + (h % 48)}" cy="${12 + (h % 30)}" r="${18 + (h % 16)}" fill="#fff" fill-opacity="0.12"/>
<text x="40" y="40" fill="#fff" font-family="Inter,system-ui,sans-serif" font-size="30" font-weight="600"
 text-anchor="middle" dominant-baseline="central" letter-spacing="0.5">${text}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
