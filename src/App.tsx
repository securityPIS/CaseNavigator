import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { TopBar } from '@/components/layout/TopBar'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { Toaster } from '@/components/ui/Toaster'
import { PageSpinner } from '@/components/ui/PageSpinner'

import { DashboardPage } from '@/pages/DashboardPage'
import { CasesPage } from '@/pages/CasesPage'
import { CaseLayout } from '@/pages/case/CaseLayout'

/**
 * Only the dashboard and case list are in the initial bundle — they're what a
 * cold start actually lands on. Everything else is a route away, and the graph
 * in particular drags in React Flow and Three.js, which have no business
 * blocking first paint on a PWA that may be opening offline.
 */
const CaseRegistrationPage = lazy(() =>
  import('@/pages/case/CaseRegistrationPage').then((m) => ({ default: m.CaseRegistrationPage })),
)
const NodeGraphPage = lazy(() => import('@/pages/case/NodeGraphPage').then((m) => ({ default: m.NodeGraphPage })))
const SprintPage = lazy(() => import('@/pages/case/SprintPage').then((m) => ({ default: m.SprintPage })))
const InterviewPage = lazy(() => import('@/pages/case/InterviewPage').then((m) => ({ default: m.InterviewPage })))
const MailPage = lazy(() => import('@/pages/case/MailPage').then((m) => ({ default: m.MailPage })))
const EvidencePage = lazy(() => import('@/pages/case/EvidencePage').then((m) => ({ default: m.EvidencePage })))
const ChallengePage = lazy(() => import('@/pages/case/ChallengePage').then((m) => ({ default: m.ChallengePage })))
const ReportPage = lazy(() => import('@/pages/case/ReportPage').then((m) => ({ default: m.ReportPage })))
const RecommendationPage = lazy(() =>
  import('@/pages/case/RecommendationPage').then((m) => ({ default: m.RecommendationPage })),
)
const GelarPerkaraPage = lazy(() =>
  import('@/pages/case/GelarPerkaraPage').then((m) => ({ default: m.GelarPerkaraPage })),
)

const CompanySettingPage = lazy(() =>
  import('@/pages/admin/CompanySettingPage').then((m) => ({ default: m.CompanySettingPage })),
)
const RoleSettingPage = lazy(() => import('@/pages/admin/RoleSettingPage').then((m) => ({ default: m.RoleSettingPage })))
const TemplatePage = lazy(() => import('@/pages/admin/TemplatePage').then((m) => ({ default: m.TemplatePage })))
const QuestionsPage = lazy(() => import('@/pages/admin/QuestionsPage').then((m) => ({ default: m.QuestionsPage })))

export function App() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="relative min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/cases" element={<CasesPage />} />

              <Route path="/cases/:caseId" element={<CaseLayout />}>
                <Route index element={<Navigate to="registration" replace />} />
                <Route path="registration" element={<CaseRegistrationPage />} />
                <Route path="graph" element={<NodeGraphPage />} />
                <Route path="sprint" element={<SprintPage />} />
                <Route path="interview" element={<InterviewPage />} />
                <Route path="mail" element={<MailPage />} />
                <Route path="evidence" element={<EvidencePage />} />
                <Route path="challenge" element={<ChallengePage />} />
                <Route path="gelar" element={<GelarPerkaraPage />} />
                <Route path="report" element={<ReportPage />} />
                <Route path="recommendation" element={<RecommendationPage />} />
              </Route>

              <Route path="/admin" element={<Navigate to="/admin/company" replace />} />
              <Route path="/admin/company" element={<CompanySettingPage />} />
              <Route path="/admin/roles" element={<RoleSettingPage />} />
              <Route path="/admin/templates" element={<TemplatePage />} />
              <Route path="/admin/questions" element={<QuestionsPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        {/* Phone-only bottom navigation; the sidebar handles md and up. */}
        <MobileNav />
      </div>

      <CommandPalette />
      <Toaster />
    </div>
  )
}
