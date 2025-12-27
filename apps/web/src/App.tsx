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
import { NotFoundPage } from './components/NotFoundPage';
import { PricingPage } from './components/PricingPage';
import { TimeTrackingPage } from './modules/time-tracking';
import { PoolPage, AdminShiftsPage, MyShiftsPage } from './modules/shift-pool';
import { MembersPage } from './modules/members';
import { CalendarPage } from './modules/calendar-core';
import { AdminDashboard, useSuperAdminCheck } from './modules/admin';
import { ReportsPage } from './modules/reports';
import { CompliancePage } from './modules/work-time-compliance';
import { SupportDashboard, DevStaffAdminPage, useDevStaffCheck } from './modules/support';
import { SecurityAuditPage } from './modules/security-audit';
import { StripePage } from './modules/stripe';
import { FreelancerPoolPage } from './modules/freelancer/FreelancerPoolPage';
import { FreelancerDashboardPage } from './modules/freelancer/FreelancerDashboardPage';
import { FreelancerMyShiftsPage } from './modules/freelancer/FreelancerMyShiftsPage';
import { MfaVerifyModal } from './components/MfaVerifyModal';
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
  const { user, loading: authLoading, signOut } = useAuth();
  const { needsOnboarding, isFreelancer, loading: tenantLoading, hasEntitlement, role, mfaRequired, refresh, tenant } = useTenant();
  
  // Prüfe ob MFA-Modul aktiviert ist
  const mfaModuleEnabled = hasEntitlement('module.mfa');
  const { isSuperAdmin } = useSuperAdminCheck();
  const { isDevStaff } = useDevStaffCheck();
  const isDevTenant = tenant?.id === 'dev-tenant';
  const location = useLocation();
  const navigate = useNavigate();
  
  const [showLanding, setShowLanding] = useState(true);
  const [legalPage, setLegalPage] = useState<LegalPage>(null);
  const [showMfaVerify, setShowMfaVerify] = useState(false);

  // WICHTIG: Nach erfolgreichem Login von /login weg navigieren
  // UND: Nach Logout/Login zu korrekter Route navigieren
  // WICHTIG: Warte bis ALLE Daten geladen sind (Tenant, MFA, etc.)
  useEffect(() => {
    // Wenn User eingeloggt ist und ALLE Daten geladen sind
    if (user && !tenantLoading && !mfaRequired && tenant !== undefined) {
      // Nur von /login weiterleiten
      if (location.pathname === '/login') {
        // Bestimme Standard-Route basierend auf User-Typ
        let defaultRoute = '/dashboard';
        if (isFreelancer) {
          defaultRoute = '/freelancer-dashboard';
        }
        navigate(defaultRoute, { replace: true });
      }
    }
  }, [user, location.pathname, tenantLoading, mfaRequired, isFreelancer, tenant, navigate]);

  // Route-Guard: Freelancer von /dashboard auf /freelancer-dashboard umleiten
  useEffect(() => {
    if (user && !tenantLoading && !mfaRequired && isFreelancer) {
      if (location.pathname === '/dashboard') {
        navigate('/freelancer-dashboard', { replace: true });
      }
    }
  }, [user, location.pathname, tenantLoading, mfaRequired, isFreelancer, navigate]);

  // MFA-Verifizierung erforderlich (nur wenn MFA-Modul aktiviert ist)
  // WICHTIG: useEffect muss vor allen frühen Returns stehen!
  useEffect(() => {
    // Prüfe, ob User gerade MFA abgebrochen hat
    const mfaCanceled = sessionStorage.getItem('mfa_canceled') === 'true';
    const mfaVerifying = sessionStorage.getItem('mfa_verifying') === 'true';
    
    // Nur Modal öffnen, wenn alle Bedingungen erfüllt sind UND Modal noch nicht geöffnet ist
    // UND User hat MFA nicht gerade abgebrochen UND Verifizierung läuft nicht
    // WICHTIG: Prüfe auch während tenantLoading, damit das Modal sofort angezeigt wird
    if (user && mfaRequired && mfaModuleEnabled && !showMfaVerify && !mfaCanceled && !mfaVerifying) {
      setShowMfaVerify(true);
    }
    
    // Wenn mfaRequired false wird (z.B. nach erfolgreicher Verifizierung), Modal schließen
    if (!mfaRequired && showMfaVerify) {
      setShowMfaVerify(false);
      sessionStorage.removeItem('mfa_verifying');
    }
    
    // Wenn User nicht mehr eingeloggt ist, Flags löschen
    if (!user) {
      sessionStorage.removeItem('mfa_canceled');
      sessionStorage.removeItem('mfa_verifying');
    }
  }, [user, mfaRequired, mfaModuleEnabled, showMfaVerify]);

  const handleMfaVerifySuccess = async () => {
    // Flag setzen, um zu verhindern, dass das Modal während des Refreshs wieder geöffnet wird
    sessionStorage.setItem('mfa_verifying', 'true');
    setShowMfaVerify(false);
    // Tenant-Daten neu laden (mfaRequired sollte jetzt false sein)
    await refresh();
    // Flag löschen nach erfolgreichem Refresh
    sessionStorage.removeItem('mfa_verifying');
  };

  const handleMfaVerifyCancel = async () => {
    // User ausloggen, wenn MFA-Verifizierung abgebrochen wird
    setShowMfaVerify(false);
    
    // Flag setzen, um zu verhindern, dass das Modal wieder geöffnet wird
    // während der Logout-Prozess läuft
    sessionStorage.setItem('mfa_canceled', 'true');
    
    try {
      // WICHTIG: Warten, bis signOut() abgeschlossen ist, damit die Firebase Session gelöscht wird
      // Sonst bleibt der User eingeloggt und wird wieder zum MFA-Modal weitergeleitet
      await signOut();
      
      // Flag löschen nach erfolgreichem Logout
      sessionStorage.removeItem('mfa_canceled');
      
      // Nach erfolgreichem Logout zur Login-Seite navigieren
      // Verwende navigate() statt window.location.href, da der User jetzt ausgeloggt ist
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Fehler beim Abmelden:', error);
      // Flag löschen auch bei Fehler
      sessionStorage.removeItem('mfa_canceled');
      // Fallback: Zur Login-Seite navigieren, auch wenn signOut fehlgeschlagen ist
      navigate('/login', { replace: true });
    }
  };

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
                onLoginClick={() => navigate('/login')}
                onPrivacyClick={() => setLegalPage('privacy')}
                onImprintClick={() => setLegalPage('imprint')}
              />
            } 
          />
          <Route 
            path="/pricing" 
            element={
              <PricingPage 
                onGetStarted={() => {
                  setShowLanding(false);
                  navigate('/login');
                }}
                onPrivacyClick={() => setLegalPage('privacy')}
                onImprintClick={() => setLegalPage('imprint')}
                onFreelancerPoolClick={() => navigate('/freelancer-pool')}
              />
            } 
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <CookieBanner onPrivacyClick={() => setLegalPage('privacy')} />
      </>
    );
  }

  // MFA-Verifizierung erforderlich → Modal anzeigen (nur wenn MFA-Modul aktiviert ist)
  // WICHTIG: Diese Prüfung muss VOR allen anderen Checks stehen, damit der User nicht auf die App zugreifen kann
  // Auch während tenantLoading prüfen, damit keine App-Inhalte kurz angezeigt werden
  if (user && mfaRequired && mfaModuleEnabled) {
    // User darf nicht auf die App zugreifen, bis MFA verifiziert wurde
    // Zeige nur das MFA-Modal, keine Lade-Animationen oder App-Inhalte
    return (
      <MfaVerifyModal
        open={showMfaVerify}
        onSuccess={handleMfaVerifySuccess}
        onCancel={handleMfaVerifyCancel}
      />
    );
  }

  // Tenant-Daten werden geladen (nur wenn MFA nicht erforderlich ist)
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
  // WICHTIG: Super Admins (Dev-Staff) brauchen kein Onboarding, sie haben bereits einen Dev-Tenant
  if (needsOnboarding && !isSuperAdmin && !isDevStaff) {
    return (
      <>
        <CreateTenantForm />
        {showMfaVerify && (
          <MfaVerifyModal
            open={showMfaVerify}
            onSuccess={handleMfaVerifySuccess}
            onCancel={handleMfaVerifyCancel}
          />
        )}
      </>
    );
  }

  // Bestimme Standard-Route basierend auf User-Typ
  // Bestimme Standard-Route basierend auf User-Typ
  const getDefaultRoute = () => {
    // Dev-Staff kommt auf Dashboard (kann auch Support nutzen)
    if (isFreelancer) {
      return '/freelancer-dashboard';
    }
    // Alle anderen (inkl. Dev-Staff) kommen auf Dashboard
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
            <Route 
              path="/security-audit" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  {isDevTenant && hasEntitlement('module.security_audit') ? (
                    <ModuleBoundary moduleId="security-audit" moduleName="Security Audit">
                      <SecurityAuditPage />
                    </ModuleBoundary>
                  ) : (
                    <div className={styles.noAccess}>
                      <span>🔒</span>
                      <p>Security Audit ist nur im Dev-Tenant verfügbar</p>
                    </div>
                  )}
                </ProtectedRoute>
              } 
            />
            {/* Dashboard auch für Dev-Staff verfügbar */}
            <Route 
              path="/dashboard" 
              element={<DashboardPage />} 
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
              path="/work-time-compliance" 
              element={
                <ProtectedRoute requiredEntitlement="module.work_time_compliance">
                  <ModuleBoundary moduleId="work-time-compliance" moduleName="Arbeitszeit-Compliance">
                    <CompliancePage />
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
            <Route 
              path="/security-audit" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  {isDevTenant && hasEntitlement('module.security_audit') ? (
                    <ModuleBoundary moduleId="security-audit" moduleName="Security Audit">
                      <SecurityAuditPage />
                    </ModuleBoundary>
                  ) : (
                    <div className={styles.noAccess}>
                      <span>🔒</span>
                      <p>Security Audit ist nur im Dev-Tenant verfügbar</p>
                    </div>
                  )}
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/stripe" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  {isDevTenant && hasEntitlement('module.stripe') ? (
                    <ModuleBoundary moduleId="stripe" moduleName="Stripe Verwaltung">
                      <StripePage />
                    </ModuleBoundary>
                  ) : (
                    <div className={styles.noAccess}>
                      <span>🔒</span>
                      <p>Stripe Verwaltung ist nur im Dev-Tenant verfügbar</p>
                    </div>
                  )}
                </ProtectedRoute>
              } 
            />
          </>
        )}

        {/* Login Route - auch für eingeloggte User verfügbar (z.B. während Logout) */}
        <Route 
          path="/login" 
          element={<LoginForm />} 
        />

        {/* Default Route - Redirect zu passender Startseite */}
        <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
        <Route path="*" element={<NotFoundPage />} />
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
