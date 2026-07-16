import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebar: (v: boolean) => void

  commandOpen: boolean
  setCommandOpen: (v: boolean) => void

  /** Case ids expanded in the sidebar tree. */
  casesExpanded: boolean
  adminExpanded: boolean
  toggleCasesExpanded: () => void
  toggleAdminExpanded: () => void
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebar: (v) => set({ sidebarCollapsed: v }),

      commandOpen: false,
      setCommandOpen: (v) => set({ commandOpen: v }),

      casesExpanded: true,
      adminExpanded: true,
      toggleCasesExpanded: () => set((s) => ({ casesExpanded: !s.casesExpanded })),
      toggleAdminExpanded: () => set((s) => ({ adminExpanded: !s.adminExpanded })),
    }),
    {
      name: 'cn-app',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        casesExpanded: s.casesExpanded,
        adminExpanded: s.adminExpanded,
      }),
    },
  ),
)
