import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import LoginPage from '@/pages/LoginPage';
import LandingPage from '@/pages/LandingPage';

// ---------------------------------------------------------------------------
// Lazy-loaded page components — code-split per route.
// ---------------------------------------------------------------------------

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TestCasesPage = lazy(() => import('./pages/TestCasesPage'));
const TestSuitesPage = lazy(() => import('./pages/TestSuitesPage'));
const TestExecutionsPage = lazy(() => import('./pages/TestExecutionsPage'));
const EvidencePage = lazy(() => import('./pages/EvidencePage'));
const ReleasesPage = lazy(() => import('./pages/ReleasesPage'));
const QualityGatesPage = lazy(() => import('./pages/QualityGatesPage'));
const GovernancePage = lazy(() => import('./pages/GovernancePage'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const MetricsPage = lazy(() => import('./pages/MetricsPage'));
const AIInsightsPage = lazy(() => import('./pages/AIInsightsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AdoptionPage = lazy(() => import('./pages/AdoptionPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));

// ---------------------------------------------------------------------------
// Suspense fallback — centered spinner shown while a lazy chunk loads.
// ---------------------------------------------------------------------------

function SuspenseFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// App — root component.
//
// Provider order (outermost → innermost):
//   AuthProvider → ThemeProvider → ToastProvider → BrowserRouter
//
// Public routes:  /login, /
// Protected routes: everything else, wrapped in ProtectedRoute + Layout.
// Catch-all: redirect to /
// ---------------------------------------------------------------------------

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* ── Public routes ── */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<LandingPage />} />

              {/* ── Protected routes (inside Layout shell) ── */}
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route
                  path="/dashboard"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/test-cases"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <TestCasesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/test-suites"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <TestSuitesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/test-executions"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <TestExecutionsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/evidence"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <EvidencePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/releases"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <ReleasesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/quality-gates"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <QualityGatesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/governance"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <GovernancePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/integrations"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <IntegrationsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/metrics"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <MetricsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/ai-insights"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <AIInsightsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <ReportsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/adoption"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <AdoptionPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <UsersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/roles"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <RolesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/audit-logs"
                  element={
                    <Suspense fallback={<SuspenseFallback />}>
                      <AuditLogsPage />
                    </Suspense>
                  }
                />
              </Route>

              {/* ── Catch-all: redirect to root ── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
