import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light'

interface SessionState {
  /** The signed-in user. Switchable from the TopBar — this build has no auth,
      so "signing in" is choosing whose access rules apply. */
  userId: string
  signInAs: (id: string) => void

  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}

export const DEFAULT_USER_ID = 'u-jason'

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      userId: DEFAULT_USER_ID,
      signInAs: (id) => set({ userId: id }),

      theme: 'dark',
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'cn-session' },
  ),
)

/** Mirrors the theme onto <html> so CSS variables and `color-scheme` follow. */
export function applyTheme(theme: Theme) {
  const el = document.documentElement
  el.dataset.theme = theme
  el.style.colorScheme = theme
}
