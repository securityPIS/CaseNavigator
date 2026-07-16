import type { CSSProperties } from 'react'

/**
 * Corkboard surface behind the investigation board.
 *
 * Replaces the atmospheric starfield: an evidence board wants a pinboard, not
 * deep space. Pure CSS (layered radial gradients fake the cork grain), so it
 * costs nothing to paint and needs no WebGL. Theme-aware — a warm dark cork in
 * dark mode, a light tan board in light mode so the surface never goes dark on
 * a light page.
 */

interface Props {
  theme: 'dark' | 'light'
}

/* Fine speckle that reads as cork grain, tiled over a warm base. The first
   layer is a vignette that keeps the middle — where the board lives — clean. */
const DARK: CSSProperties = {
  backgroundColor: '#241a10',
  backgroundImage:
    'radial-gradient(125% 125% at 50% 35%, transparent 52%, rgba(0,0,0,0.55) 100%),' +
    'radial-gradient(circle at 28% 18%, rgba(214,166,104,0.10), transparent 46%),' +
    'radial-gradient(circle at 82% 88%, rgba(120,78,38,0.14), transparent 52%),' +
    'radial-gradient(rgba(0,0,0,0.34) 0.8px, transparent 1.5px),' +
    'radial-gradient(rgba(196,146,86,0.12) 0.8px, transparent 1.5px)',
  backgroundSize: '100% 100%, 100% 100%, 100% 100%, 6px 6px, 9px 9px',
  backgroundPosition: '0 0, 0 0, 0 0, 0 0, 3px 4px',
}

const LIGHT: CSSProperties = {
  backgroundColor: '#e3cfa6',
  backgroundImage:
    'radial-gradient(125% 125% at 50% 35%, transparent 58%, rgba(120,88,46,0.20) 100%),' +
    'radial-gradient(circle at 28% 18%, rgba(255,252,240,0.45), transparent 48%),' +
    'radial-gradient(circle at 82% 88%, rgba(163,120,64,0.16), transparent 52%),' +
    'radial-gradient(rgba(120,85,44,0.16) 0.8px, transparent 1.5px),' +
    'radial-gradient(rgba(90,60,28,0.10) 0.8px, transparent 1.5px)',
  backgroundSize: '100% 100%, 100% 100%, 100% 100%, 6px 6px, 9px 9px',
  backgroundPosition: '0 0, 0 0, 0 0, 0 0, 3px 4px',
}

export function BoardBackground({ theme }: Props) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={theme === 'light' ? LIGHT : DARK}
    />
  )
}
