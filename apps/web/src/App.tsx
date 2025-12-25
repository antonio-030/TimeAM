/**
 * TimeAM Web – Root App Component
 */

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/auth';
import { TenantProvider, useTenant } from './core/tenant';
import { ConsentProvider } from './core/consent';
import { ModuleBoundary } from './core/modules';
import { LandingPage } from './components/LandingPage';
import { LoginForm } from './components/LoginForm';
import { CreateTenantForm } from './components/CreateTenantForm';
import { AppLayout } from './components/layout';
import { DashboardPage } from './modules/dashboard';
import { CookieBanner } from './components/CookieBanner';
import { PrivacyPage, ImprintPage } from './components/LegalPage';
import { TimeTrackingPage } from './modules/time-tracking';
import { PoolPage, AdminShiftsPage, MyShiftsPage } from './modules/shift-pool';
import { MembersPage } from './modules/members';
import { CalendarPage } from './modules/calendar-core';
import { AdminDashboard, useSuperAdminCheck } from './modules/admin';
import { ReportsPage } from './modules/reports';
import { SupportDashboard, DevStaffAdminPage, useDevStaffCheck } from './modules/support';
import { FreelancerPoolPage } from './modules/freelancer/FreelancerPoolPage';
import { FreelancerLoginForm } from './modules/freelancer/FreelancerLoginForm';
import { FreelancerRegisterForm } from './modules/freelancer/FreelancerRegisterForm';
import { FreelancerDashboardPage } from './modules/freelancer/FreelancerDashboardPage';
import { FreelancerMyShiftsPage } from './modules/freelancer/FreelancerMyShiftsPage';
import styles from './App.module.css';

type LegalPage = 'privacy' | 'imprint' | null;

// Protected Route Component für Entitlement-Checks
function ProtectedRoute({ 
  children, 
  requiredEntitlement, 
  requiredRole,
  requireSuperAdmin,
  requireDevStaff 
}: { 
  children: React.ReactNode;
  requiredEntitlement?: string;
  requiredRole?: 'admin' | 'manager';
  requireSuperAdmin?: boolean;
  requireDevStaff?: boolean;
}) {
  const { hasEntitlement, role, isFreelancer } = useTenant();
  const { isSuperAdmin } = useSuperAdminCheck();
  const { isDevStaff } = useDevStaffCheck();

  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className={styles.noAccess}>
        <span>🔒</span>
        <p>Kein Zugriff</p>
      </div>
    );
  }

  if (requireDevStaff && !isDevStaff) {
    return (
      <div className={styles.noAccess}>
        <span>🔒</span>
        <p>Kein Zugriff</p>
      </div>
    );
  }

  if (requiredEntitlement && !hasEntitlement(requiredEntitlement)) {
    return (
      <div className={styles.noAccess}>
        <span>🔒</span>
        <p>Kein Zugriff</p>
      </div>
    );
  }

  if (requiredRole) {
    const isAdminOrManager = role === 'admin' || role === 'manager';
    if (!isAdminOrManager) {
      return (
        <div className={styles.noAccess}>
          <span>🔒</span>
          <p>Kein Zugriff</p>
        </div>
      );
    }
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { needsOnboarding, isFreelancer, loading: tenantLoading, hasEntitlement, role } = useTenant();
  const { isSuperAdmin } = useSuperAdminCheck();
  const { isDevStaff } = useDevStaffCheck();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [showLanding, setShowLanding] = useState(true);
  const [legalPage, setLegalPage] = useState<LegalPage>(null);

  // Prüfung auf Admin oder Manager Rolle
  const isAdminOrManager = role === 'admin' || role === 'manager';

  // Legal Pages anzeigen (immer verfügbar)
  if (legalPage === 'privacy') {
    return <PrivacyPage onBack={() => setLegalPage(null)} />;
  }
  if (legalPage === 'imprint') {
    return <ImprintPage onBack={() => setLegalPage(null)} />;
  }

  // Auth wird noch geladen
  if (authLoading) {
    return (
      <>
        <div className={styles.loading}>
          <div className={styles.spinner}>
            <span className={styles.spinnerIcon}>⏱️</span>
          </div>
          <p className={styles.loadingText}>Laden...</p>
        </div>
        <CookieBanner onPrivacyClick={() => setLegalPage('privacy')} />
      </>
    );
  }

  // Nicht eingeloggt → Public Routes
  if (!user) {
    return (
      <>
        <Routes>
          <Route 
            path="/" 
            element={
              showLanding ? (
                <LandingPage
                  onGetStarted={() => {
                    setShowLanding(false);
                    navigate('/login');
                  }}
                  onPrivacyClick={() => setLegalPage('privacy')}
                  onImprintClick={() => setLegalPage('imprint')}
                  onFreelancerPoolClick={() => navigate('/freelancer-pool')}
                />
              ) : (
                <LoginForm />
              )
            } 
          />
          <Route 
            path="/login" 
            element={<LoginForm />} 
          />
          <Route 
            path="/freelancer-pool" 
            element={
              <FreelancerPoolPage 
                onLoginClick={() => navigate('/freelancer-login')}
                onPrivacyClick={() => setLegalPage('privacy')}
                onImprintClick={() => setLegalPage('imprint')}
              />
            } 
          />
          <Route 
            path="/freelancer-login" 
            element={
              <FreelancerLoginForm
                onSuccess={() => navigate('/freelancer-dashboard')}
                onRegisterClick={() => navigate('/freelancer-register')}
              />
            } 
          />
          <Route 
            path="/freelancer-register" 
            element={
              <FreelancerRegisterForm
                onSuccess={() => navigate('/freelancer-pool')}
                onCancel={() => navigate('/freelancer-login')}
              />
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CookieBanner onPrivacyClick={() => setLegalPage('privacy')} />
      </>
    );
  }

  // Tenant-Daten werden geladen
  if (tenantLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}>
          <span className={styles.spinnerIcon}>🏢</span>
        </div>
        <p className={styles.loadingText}>Organisation wird geladen...</p>
      </div>
    );
  }

  // User braucht Onboarding → Tenant erstellen
  if (needsOnboarding) {
    return <CreateTenantForm />;
  }

  // Bestimme Standard-Route basierend auf User-Typ
  const getDefaultRoute = () => {
    if (isDevStaff) {
      return '/support';
    }
    if (isFreelancer) {
      return '/freelancer-dashboard';
    }
    return '/dashboard';
  };

  // Eingeloggt mit Tenant → Protected Routes mit Layout
  return (
    <AppLayout>
      <Routes>
        {/* Freelancer Routes */}
        {isFreelancer && (
          <>
            <Route 
              path="/freelancer-dashboard" 
              element={
                <ModuleBoundary moduleId="freelancer-dashboard" moduleName="Freelancer Dashboard">
                  <FreelancerDashboardPage />
                </ModuleBoundary>
              } 
            />
            <Route 
              path="/freelancer-my-shifts" 
              element={
                <ModuleBoundary moduleId="freelancer-my-shifts" moduleName="Meine Schichten">
                  <FreelancerMyShiftsPage />
                </ModuleBoundary>
              } 
            />
            <Route 
              path="/freelancer-pool" 
              element={
                <ModuleBoundary moduleId="freelancer-pool" moduleName="Schicht-Pool">
                  <FreelancerPoolPage />
                </ModuleBoundary>
              } 
            />
            <Route 
              path="/freelancer-admin-shifts" 
              element={
                <ProtectedRoute requiredEntitlement="module.shift_pool">
                  <ModuleBoundary moduleId="shift-pool" moduleName="Schicht-Verwaltung">
                    <AdminShiftsPage />
                  </ModuleBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/time-tracking" 
              element={
                <ProtectedRoute requiredEntitlement="module.time_tracking">
                  <ModuleBoundary moduleId="time-tracking" moduleName="Zeiterfassung">
                    <TimeTrackingPage />
                  </ModuleBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute requiredEntitlement="module.reports">
                  <ModuleBoundary moduleId="reports" moduleName="Berichte & Analytics">
                    <ReportsPage />
                  </ModuleBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/calendar" 
              element={<CalendarPage />} 
            />
          </>
        )}

        {/* Dev Staff Routes */}
        {isDevStaff && (
          <>
            <Route 
              path="/support" 
              element={
                <ProtectedRoute requireDevStaff>
                  <SupportDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dev-staff-admin" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  <DevStaffAdminPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dev-dashboard" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
          </>
        )}

        {/* Normale Mitarbeiter Routes */}
        {!isFreelancer && (
          <>
            <Route 
              path="/dashboard" 
              element={<DashboardPage />} 
            />
            <Route 
              path="/time-tracking" 
              element={
                <ProtectedRoute requiredEntitlement="module.time_tracking">
                  <ModuleBoundary moduleId="time-tracking" moduleName="Zeiterfassung">
                    <TimeTrackingPage />
                  </ModuleBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/calendar" 
              element={<CalendarPage />} 
            />
            <Route 
              path="/shifts" 
              element={
                <ProtectedRoute requiredEntitlement="module.shift_pool">
                  <ModuleBoundary moduleId="shift-pool" moduleName="Schicht-Pool">
                    <PoolPage />
                  </ModuleBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/my-shifts" 
              element={
                <ProtectedRoute requiredEntitlement="module.shift_pool">
                  <ModuleBoundary moduleId="shift-pool" moduleName="Meine Schichten">
                    <MyShiftsPage />
                  </ModuleBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin-shifts" 
              element={
                <ProtectedRoute requiredEntitlement="module.shift_pool" requiredRole="admin">
                  <ModuleBoundary moduleId="shift-pool" moduleName="Schicht-Verwaltung">
                    <AdminShiftsPage />
                  </ModuleBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/members" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <MembersPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute requiredEntitlement="module.reports" requiredRole="admin">
                  <ModuleBoundary moduleId="reports" moduleName="Berichte & Analytics">
                    <ReportsPage />
                  </ModuleBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dev-dashboard" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
          </>
        )}

        {/* Default Route - Redirect zu passender Startseite */}
        <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
        <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
      </Routes>
    </AppLayout>
  );
}

/**
 * App mit Providern.
 */
export function App() {
  return (
    <ConsentProvider>
      <AuthProvider>
        <TenantProvider>
          <AppContent />
        </TenantProvider>
      </AuthProvider>
    </ConsentProvider>
  );
}
