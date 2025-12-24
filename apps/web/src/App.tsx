/**
 * TimeAM Web – Root App Component
 */

import { useState, useEffect, useMemo } from 'react';
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
import { FreelancerDashboard } from './modules/freelancer/FreelancerDashboard';
import { FreelancerDashboardPage } from './modules/freelancer/FreelancerDashboardPage';
import { FreelancerMyShiftsPage } from './modules/freelancer/FreelancerMyShiftsPage';
import styles from './App.module.css';

type Page = 'dashboard' | 'time-tracking' | 'calendar' | 'shifts' | 'my-shifts' | 'admin-shifts' | 'members' | 'reports' | 'dev-dashboard' | 'support' | 'dev-staff-admin' | 'freelancer-dashboard' | 'freelancer-my-shifts' | 'freelancer-pool';
type LegalPage = 'privacy' | 'imprint' | null;

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { needsOnboarding, isFreelancer, loading: tenantLoading, hasEntitlement, role } = useTenant();
  const { isSuperAdmin } = useSuperAdminCheck();
  const { isDevStaff } = useDevStaffCheck();
  
  // Initial page basierend auf User-Typ
  const getInitialPage = (): Page => {
    if (isDevStaff) {
      return 'support';
    }
    if (isFreelancer) {
      return 'freelancer-dashboard';
    }
    return 'dashboard';
  };
  
  const [currentPage, setCurrentPage] = useState<Page>(getInitialPage());
  
  // Update page wenn isFreelancer oder isDevStaff sich ändert
  useEffect(() => {
    if (!tenantLoading) {
      setCurrentPage(getInitialPage());
    }
  }, [isFreelancer, isDevStaff, tenantLoading]);
  const [showLanding, setShowLanding] = useState(true);
  const [legalPage, setLegalPage] = useState<LegalPage>(null);
  const [showFreelancerPool, setShowFreelancerPool] = useState(false);
  const [showFreelancerLogin, setShowFreelancerLogin] = useState(false);
  const [showFreelancerRegister, setShowFreelancerRegister] = useState(false);

  // Prüfe URL-Parameter für Freelancer Pool
  useEffect(() => {
    if (window.location.pathname === '/freelancer-pool' || window.location.pathname.includes('freelancer-pool')) {
      setShowFreelancerPool(true);
      setShowLanding(false);
    }
  }, []);

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

  // Nicht eingeloggt → Landing Page, Freelancer Pool, Freelancer Login/Register oder Login-Screen
  if (!user) {
    if (showFreelancerRegister) {
      return (
        <>
          <FreelancerRegisterForm
            onSuccess={() => {
              setShowFreelancerRegister(false);
              setShowFreelancerPool(true);
            }}
            onCancel={() => {
              setShowFreelancerRegister(false);
              setShowFreelancerLogin(true);
            }}
          />
          <CookieBanner onPrivacyClick={() => setLegalPage('privacy')} />
        </>
      );
    }
    if (showFreelancerLogin) {
      return (
        <>
          <FreelancerLoginForm
            onSuccess={() => {
              setShowFreelancerLogin(false);
              setShowFreelancerPool(true);
            }}
            onRegisterClick={() => {
              setShowFreelancerLogin(false);
              setShowFreelancerRegister(true);
            }}
          />
          <CookieBanner onPrivacyClick={() => setLegalPage('privacy')} />
        </>
      );
    }
    if (showFreelancerPool) {
      return (
        <>
          <FreelancerPoolPage 
            onLoginClick={() => {
              setShowFreelancerPool(false);
              setShowFreelancerLogin(true);
            }}
            onPrivacyClick={() => setLegalPage('privacy')}
            onImprintClick={() => setLegalPage('imprint')}
          />
          <CookieBanner onPrivacyClick={() => setLegalPage('privacy')} />
        </>
      );
    }
    if (showLanding) {
      return (
        <>
          <LandingPage
            onGetStarted={() => setShowLanding(false)}
            onPrivacyClick={() => setLegalPage('privacy')}
            onImprintClick={() => setLegalPage('imprint')}
            onFreelancerPoolClick={() => {
              setShowFreelancerPool(true);
              setShowLanding(false);
            }}
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

  // User braucht Onboarding → Tenant erstellen (auch für Freelancer)
  if (needsOnboarding) {
    return <CreateTenantForm />;
  }

  // Entitlement- und Rollen-geprüfte Navigation
  const handleNavigate = (page: string) => {
    // Freelancer-Navigation
    if (isFreelancer) {
      // Freelancer-Dashboard ist immer verfügbar
      if (page === 'freelancer-dashboard') {
        setCurrentPage('freelancer-dashboard');
        return;
      }
      // Kalender ist Core-Modul, immer verfügbar
      if (page === 'calendar') {
        setCurrentPage('calendar');
        return;
      }
      // Freelancer "Meine Schichten" - Core-Modul, immer verfügbar
      if (page === 'freelancer-my-shifts') {
        setCurrentPage('freelancer-my-shifts');
        return;
      }
      // Freelancer-Pool - Core-Modul, immer verfügbar
      if (page === 'freelancer-pool') {
        setCurrentPage('freelancer-pool');
        return;
      }
      // Andere Seiten nicht für Freelancer
      return;
    }

    // Normale Mitarbeiter-Navigation
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
    // Support nur für Dev-Mitarbeiter
    if (page === 'support' && !isDevStaff) {
      return;
    }
    // Dev-Mitarbeiter Verwaltung nur für Super-Admins
    if (page === 'dev-staff-admin' && !isSuperAdmin) {
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

      case 'support':
        return isDevStaff ? (
          <SupportDashboard />
        ) : (
          <div className={styles.noAccess}>
            <span>🔒</span>
            <p>Kein Zugriff auf Support</p>
          </div>
        );

      case 'dev-staff-admin':
        return isSuperAdmin ? (
          <DevStaffAdminPage />
        ) : (
          <div className={styles.noAccess}>
            <span>🔒</span>
            <p>Kein Zugriff auf Dev-Mitarbeiter Verwaltung</p>
          </div>
        );

      case 'freelancer-dashboard':
        return (
          <ModuleBoundary moduleId="freelancer-dashboard" moduleName="Freelancer Dashboard">
            <FreelancerDashboardPage onNavigate={handleNavigate} />
          </ModuleBoundary>
        );

      case 'freelancer-my-shifts':
        return (
          <ModuleBoundary moduleId="freelancer-my-shifts" moduleName="Meine Schichten">
            <FreelancerMyShiftsPage />
          </ModuleBoundary>
        );

      case 'freelancer-pool':
        return (
          <ModuleBoundary moduleId="freelancer-pool" moduleName="Schicht-Pool">
            <FreelancerPoolPage />
          </ModuleBoundary>
        );

      case 'dashboard':
      default:
        // Für Freelancer: Standard-Dashboard ist Freelancer-Dashboard
        if (isFreelancer) {
          return (
            <ModuleBoundary moduleId="freelancer-dashboard" moduleName="Freelancer Dashboard">
              <FreelancerDashboardPage onNavigate={handleNavigate} />
            </ModuleBoundary>
          );
        }
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
