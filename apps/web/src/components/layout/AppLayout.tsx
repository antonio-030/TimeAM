/**
 * App Layout
 *
 * Haupt-Layout mit erweiterter Sidebar.
 * - Kalender mit Hover-Tooltip für Termine (echte Daten!)
 * - Filter für alle Nutzer
 * - Mitarbeiter-Suche nur für Admin/Manager
 */

import { type ReactNode, useCallback, useState, useMemo } from 'react';
import { useAuth } from '../../core/auth';
import { useTenant } from '../../core/tenant';
import { useDevStaffCheck } from '../../modules/support/hooks';
import { NotificationBell } from '../../modules/notifications';
import { MiniCalendar } from './MiniCalendar';
import { useSidebarCalendar } from './useSidebarCalendar';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: ReactNode;
  currentPage?: string;
  onNavigate?: (page: string) => void;
  isSuperAdmin?: boolean;
}

export function AppLayout({ children, currentPage = 'dashboard', onNavigate, isSuperAdmin = false }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const { tenant, role, hasEntitlement, isFreelancer } = useTenant();
  const { isDevStaff } = useDevStaffCheck();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Prüfung auf Admin oder Manager Rolle
  const isAdminOrManager = role === 'admin' || role === 'manager';

  // Echte Events laden
  // Admin/Manager: Alle Schichten | Mitarbeiter: Nur eigene
  const hasShiftPoolAccess = hasEntitlement('module.shift_pool');
  const hasTimeTrackingAccess = hasEntitlement('module.time_tracking');
  const hasReportsAccess = hasEntitlement('module.reports');
  
  const { events: calendarEvents, loading: calendarLoading } = useSidebarCalendar({
    role: isFreelancer ? 'freelancer' : (role ?? 'employee'),
    includeShifts: isFreelancer ? true : hasShiftPoolAccess,
    includeTimeEntries: hasTimeTrackingAccess,
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Error handling
    }
  };

  const handleNavClick = (page: string) => {
    onNavigate?.(page);
  };

  // Handler für Notification-Links
  const handleNotificationNavigate = useCallback((path: string) => {
    if (path === '/my-shifts') {
      onNavigate?.('my-shifts');
    } else if (path.startsWith('/shifts')) {
      onNavigate?.('shifts');
    } else if (path.startsWith('/calendar')) {
      onNavigate?.('calendar');
    } else if (path.startsWith('/time-tracking')) {
      onNavigate?.('time-tracking');
    }
  }, [onNavigate]);

  // Handler für Kalender-Event-Klick
  const handleEventClick = useCallback((eventId: string, eventType: string) => {
    // Navigiere basierend auf Event-Typ und Rolle
    switch (eventType) {
      case 'shift':
        // Admin/Manager → Schicht-Verwaltung, Mitarbeiter → Meine Schichten
        onNavigate?.(isAdminOrManager ? 'admin-shifts' : 'my-shifts');
        break;
      case 'time-entry':
        onNavigate?.('time-tracking');
        break;
      case 'appointment':
        onNavigate?.('calendar');
        break;
      default:
        onNavigate?.('calendar');
    }
  }, [onNavigate, isAdminOrManager]);

  // Navigation Items - Dev-Mitarbeiter, Freelancer oder normale Mitarbeiter
  const navItems = isDevStaff ? [
    { id: 'support', label: 'Verifizierungen', icon: '🛠️', enabled: true },
    { id: 'dev-staff-admin', label: 'Dev-Mitarbeiter', icon: '👥', enabled: isSuperAdmin },
    { id: 'dev-dashboard', label: 'Developer', icon: '🔐', enabled: isSuperAdmin },
  ] : isFreelancer ? [
    { id: 'freelancer-dashboard', label: 'Dashboard', icon: '📊', enabled: true },
    { id: 'calendar', label: 'Kalender', icon: '📅', enabled: true },
    { id: 'freelancer-my-shifts', label: 'Meine Schichten', icon: '✅', enabled: true },
    { id: 'freelancer-pool', label: 'Schicht-Pool', icon: '🔍', enabled: true },
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', enabled: true },
    { id: 'time-tracking', label: 'Zeiterfassung', icon: '⏰', enabled: hasTimeTrackingAccess },
    { id: 'calendar', label: 'Kalender', icon: '📅', enabled: true },
    { id: 'shifts', label: 'Schicht-Pool', icon: '📋', enabled: hasShiftPoolAccess },
    { id: 'my-shifts', label: 'Meine Schichten', icon: '✅', enabled: hasShiftPoolAccess },
    { id: 'admin-shifts', label: 'Schicht-Verwaltung', icon: '⚙️', enabled: hasShiftPoolAccess && isAdminOrManager },
    { id: 'reports', label: 'Berichte', icon: '📈', enabled: hasReportsAccess && isAdminOrManager },
    { id: 'members', label: 'Mitarbeiter', icon: '👥', enabled: isAdminOrManager },
    { id: 'dev-dashboard', label: 'Developer', icon: '🔐', enabled: isSuperAdmin },
  ];

  // Sinnvolle Quick-Filter für alle Nutzer
  const quickFilters = useMemo(() => {
    if (isFreelancer) {
      // Freelancer-spezifische Quick-Filter
      const filters = [
        { 
          id: 'freelancer-my-shifts-today', 
          label: 'Heute', 
          icon: '📅',
          page: 'freelancer-my-shifts',
          enabled: true,
        },
        { 
          id: 'freelancer-my-shifts-week', 
          label: 'Diese Woche', 
          icon: '📆',
          page: 'freelancer-my-shifts',
          enabled: true,
        },
        { 
          id: 'freelancer-pool', 
          label: 'Schicht-Pool', 
          icon: '🔍',
          page: 'freelancer-pool',
          enabled: true,
        },
      ];
      return filters.filter(f => f.enabled);
    }
    
    // Normale Mitarbeiter Quick-Filter
    const filters = [
      { 
        id: 'my-shifts-today', 
        label: 'Heute', 
        icon: '📅',
        page: 'my-shifts',
        enabled: hasShiftPoolAccess,
      },
      { 
        id: 'my-shifts-week', 
        label: 'Diese Woche', 
        icon: '📆',
        page: 'my-shifts',
        enabled: hasShiftPoolAccess,
      },
      { 
        id: 'open-shifts', 
        label: 'Offene Schichten', 
        icon: '🔔',
        page: 'shifts',
        enabled: hasShiftPoolAccess,
      },
      { 
        id: 'time-overview', 
        label: 'Stundenkonto', 
        icon: '⏱️',
        page: 'time-tracking',
        enabled: hasTimeTrackingAccess,
      },
    ];
    
    return filters.filter(f => f.enabled);
  }, [isFreelancer, hasShiftPoolAccess, hasTimeTrackingAccess]);

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.logo}>
          <img src="/logo.png" alt="TimeAM Logo" className={styles.logoImage} />
        </div>

        {/* Scrollable Content */}
        <div className={styles.sidebarContent}>
          {/* Navigation */}
          <nav className={styles.nav}>
            {navItems.map((item) => (
              item.enabled && (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`${styles.navItem} ${currentPage === item.id ? styles.navItemActive : ''}`}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            ))}
          </nav>

          {/* Kalender Widget mit echten Events */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>KALENDER</div>
              {calendarLoading && <span className={styles.loadingDot} />}
            </div>
            <MiniCalendar 
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              onEventClick={handleEventClick}
              events={calendarEvents}
            />
          </div>

          {/* Mitarbeiter-Suche - nur für Admin/Manager (nicht für Freelancer) */}
          {!isFreelancer && isAdminOrManager && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>MITARBEITER</div>
              <div className={styles.searchBox}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Mitarbeiter suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
            </div>
          )}

          {/* Quick-Filter für alle */}
          {quickFilters.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>SCHNELLZUGRIFF</div>
              <div className={styles.quickFilters}>
                {quickFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => handleNavClick(filter.page)}
                    className={styles.quickFilterItem}
                  >
                    <span className={styles.quickFilterIcon}>{filter.icon}</span>
                    <span className={styles.quickFilterLabel}>{filter.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className={styles.sidebarFooter}>
          {tenant ? (
            <div className={styles.tenantInfo}>
              <span className={styles.tenantIcon}>{isFreelancer ? '🎯' : '🏢'}</span>
              <div className={styles.tenantDetails}>
                <span className={styles.tenantName}>{tenant.name}</span>
                {role && <span className={styles.tenantRole}>{role}</span>}
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main Content */}
      <div className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            {navItems.find(item => item.id === currentPage)?.label || 'Dashboard'}
          </div>
          <div className={styles.headerActions}>
            {user && (
              <>
                <NotificationBell onNavigate={handleNotificationNavigate} />
                <div className={styles.userMenu}>
                  <span className={styles.userEmail}>{user.email}</span>
                  <button onClick={handleSignOut} className={styles.signOutBtn}>
                    Abmelden
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
