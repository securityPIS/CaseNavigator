import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { seedDatabase } from './domain/seed'
import { applyTheme, useSession } from './stores/session'
import './styles/index.css'

// Paint the persisted theme before React mounts — doing it in an effect would
// show a frame of dark to someone who chose light.
applyTheme(useSession.getState().theme)
useSession.subscribe((s) => applyTheme(s.theme))

/** Seed before first paint so no page has to render an empty state it will never show again. */
seedDatabase()
  .catch((err) => console.error('[CaseNavigator] seed failed', err))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    )
  })
