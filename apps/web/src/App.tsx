/**
 * TimeAM Web – Root App Component
 */

import { useState } from 'react';
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
import styles from './App.module.css';

type Page = 'dashboard' | 'time-tracking' | 'calendar' | 'shifts' | 'my-shifts' | 'admin-shifts' | 'members' | 'reports' | 'dev-dashboard';
type LegalPage = 'privacy' | 'imprint' | null;

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { needsOnboarding, loading: tenantLoading, hasEntitlement, role } = useTenant();
  const { isSuperAdmin } = useSuperAdminCheck();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
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

  // Nicht eingeloggt → Landing Page oder Login-Screen
  if (!user) {
    if (showLanding) {
      return (
        <>
          <LandingPage 
            onGetStarted={() => setShowLanding(false)}
            onPrivacyClick={() => setLegalPage('privacy')}
            onImprintClick={() => setLegalPage('imprint')}
          />
          <CookieBanner onPrivacyClick={() => setLegalPage('privacy')} />
        </>
      );
    }
    return (
      <>
        <LoginForm />
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

  // Entitlement- und Rollen-geprüfte Navigation
  const handleNavigate = (page: string) => {
    // Prüfe Entitlements für geschützte Seiten
    if (page === 'time-tracking' && !hasEntitlement('module.time_tracking')) {
      return;
    }
    if (page === 'shifts' && !hasEntitlement('module.shift_pool')) {
      return;
    }
    if (page === 'my-shifts' && !hasEntitlement('module.shift_pool')) {
      return;
    }
    // Kalender ist Core-Modul, immer verfügbar (kein Entitlement-Check)
    // Admin-Shifts nur für Admin/Manager
    if (page === 'admin-shifts' && (!hasEntitlement('module.shift_pool') || !isAdminOrManager)) {
      return;
    }
    // Mitarbeiter-Modul nur für Admin/Manager
    if (page === 'members' && !isAdminOrManager) {
      return;
    }
    // Reports nur für Admin/Manager mit Entitlement
    if (page === 'reports' && (!hasEntitlement('module.reports') || !isAdminOrManager)) {
      return;
    }
    // Developer Dashboard nur für Super-Admins
    if (page === 'dev-dashboard' && !isSuperAdmin) {
      return;
    }
    setCurrentPage(page as Page);
  };

  // Render aktuelle Seite
  const renderPage = () => {
    switch (currentPage) {
      case 'time-tracking':
        return hasEntitlement('module.time_tracking') ? (
          <ModuleBoundary moduleId="time-tracking" moduleName="Zeiterfassung">
            <TimeTrackingPage />
          </ModuleBoundary>
        ) : (
          <div className={styles.noAccess}>
            <span>🔒</span>
            <p>Kein Zugriff auf Zeiterfassung</p>
          </div>
        );

      case 'calendar':
        // Kalender ist Core-Modul, immer verfügbar
        return <CalendarPage />;

      case 'shifts':
        return hasEntitlement('module.shift_pool') ? (
          <ModuleBoundary moduleId="shift-pool" moduleName="Schicht-Pool">
            <PoolPage />
          </ModuleBoundary>
        ) : (
          <div className={styles.noAccess}>
            <span>🔒</span>
            <p>Kein Zugriff auf Schichtplanung</p>
          </div>
        );

      case 'my-shifts':
        return hasEntitlement('module.shift_pool') ? (
          <ModuleBoundary moduleId="shift-pool" moduleName="Meine Schichten">
            <MyShiftsPage />
          </ModuleBoundary>
        ) : (
          <div className={styles.noAccess}>
            <span>🔒</span>
            <p>Kein Zugriff auf Meine Schichten</p>
          </div>
        );

      case 'admin-shifts':
        return hasEntitlement('module.shift_pool') && isAdminOrManager ? (
          <ModuleBoundary moduleId="shift-pool" moduleName="Schicht-Verwaltung">
            <AdminShiftsPage />
          </ModuleBoundary>
        ) : (
          <div className={styles.noAccess}>
            <span>🔒</span>
            <p>Kein Zugriff auf Schicht-Verwaltung</p>
          </div>
        );

      case 'members':
        return isAdminOrManager ? (
          <MembersPage />
        ) : (
          <div className={styles.noAccess}>
            <span>🔒</span>
            <p>Kein Zugriff auf Mitarbeiterverwaltung</p>
          </div>
        );

      case 'reports':
        return hasEntitlement('module.reports') && isAdminOrManager ? (
          <ModuleBoundary moduleId="reports" moduleName="Berichte & Analytics">
            <ReportsPage />
          </ModuleBoundary>
        ) : (
          <div className={styles.noAccess}>
            <span>🔒</span>
            <p>Kein Zugriff auf Berichte & Analytics</p>
          </div>
        );

      case 'dev-dashboard':
        return isSuperAdmin ? (
          <AdminDashboard />
        ) : (
          <div className={styles.noAccess}>
            <span>🔒</span>
            <p>Kein Zugriff auf Developer Dashboard</p>
          </div>
        );

      case 'dashboard':
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  // Eingeloggt mit Tenant → Layout mit Navigation
  return (
    <AppLayout 
      currentPage={currentPage} 
      onNavigate={handleNavigate}
      isSuperAdmin={isSuperAdmin}
    >
      {renderPage()}
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
