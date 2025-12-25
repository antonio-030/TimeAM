/**
 * App Layout
 *
 * Haupt-Layout mit erweiterter Sidebar.
 * - Kalender mit Hover-Tooltip für Termine (echte Daten!)
 * - Filter für alle Nutzer
 * - Mitarbeiter-Suche nur für Admin/Manager
 */

import { type ReactNode, useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../core/auth';
import { useTenant } from '../../core/tenant';
import { useDevStaffCheck } from '../../modules/support/hooks';
import { NotificationBell } from '../../modules/notifications';
import { MiniCalendar } from './MiniCalendar';
import { useSidebarCalendar } from './useSidebarCalendar';
import { FreelancerProfileModal } from '../../modules/freelancer/FreelancerProfileModal';
import { getFreelancer, type FreelancerResponse } from '../../modules/freelancer/api';
import { MemberProfileModal } from '../../modules/members/MemberProfileModal';
import { getMemberProfile } from '../../modules/members/api';
import { MEMBER_ROLES, type Member } from '@timeam/shared';
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
  
  // State-Deklarationen
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMemberProfileModal, setShowMemberProfileModal] = useState(false);
  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerResponse | null>(null);
  const [memberProfile, setMemberProfile] = useState<Member | null>(null);
  const [loadingFreelancerProfile, setLoadingFreelancerProfile] = useState(false);
  const [loadingMemberProfile, setLoadingMemberProfile] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Prüfen ob User Admin oder Manager ist
  const isAdminOrManager = useMemo(() => {
    return role === MEMBER_ROLES.ADMIN || role === MEMBER_ROLES.MANAGER;
  }, [role]);

  // Freelancer-Profil laden (für User-Menü)
  useEffect(() => {
    if (isFreelancer && user) {
      setLoadingFreelancerProfile(true);
      getFreelancer()
        .then((response) => {
          setFreelancerProfile(response.freelancer);
        })
        .catch((err) => {
          console.error('Fehler beim Laden des Freelancer-Profils:', err);
        })
        .finally(() => {
          setLoadingFreelancerProfile(false);
        });
    } else {
      setFreelancerProfile(null);
    }
  }, [isFreelancer, user]);

  // Member-Profil laden (für Admins/Manager im User-Menü)
  useEffect(() => {
    if (!isFreelancer && isAdminOrManager && user) {
      setLoadingMemberProfile(true);
      getMemberProfile()
        .then((response) => {
          setMemberProfile(response.member);
        })
        .catch((err) => {
          console.error('Fehler beim Laden des Member-Profils:', err);
        })
        .finally(() => {
          setLoadingMemberProfile(false);
        });
    } else {
      setMemberProfile(null);
    }
  }, [isFreelancer, isAdminOrManager, user]);

  // Profil nach Modal-Update neu laden
  const handleProfileUpdated = useCallback(() => {
    if (isFreelancer && user) {
      getFreelancer()
        .then((response) => {
          setFreelancerProfile(response.freelancer);
        })
        .catch((err) => {
          console.error('Fehler beim Neuladen des Freelancer-Profils:', err);
        });
    } else if (!isFreelancer && isAdminOrManager && user) {
      getMemberProfile()
        .then((response) => {
          setMemberProfile(response.member);
        })
        .catch((err) => {
          console.error('Fehler beim Neuladen des Member-Profils:', err);
        });
    }
  }, [isFreelancer, isAdminOrManager, user]);

  // Benutzername extrahieren (für Freelancer/Member aus Profil, sonst aus Auth)
  const userName = useMemo(() => {
    if (isFreelancer && freelancerProfile) {
      // Für Freelancer: Vollständiger Name aus Profil
      if (freelancerProfile.firstName && freelancerProfile.lastName) {
        return `${freelancerProfile.firstName} ${freelancerProfile.lastName}`;
      }
      return freelancerProfile.displayName || freelancerProfile.email?.split('@')[0] || 'Freelancer';
    }
    if (!isFreelancer && memberProfile) {
      // Für Admins/Manager: Vollständiger Name aus Profil
      if (memberProfile.firstName && memberProfile.lastName) {
        return `${memberProfile.firstName} ${memberProfile.lastName}`;
      }
      return memberProfile.displayName || memberProfile.email?.split('@')[0] || 'Nutzer';
    }
    return user?.displayName || user?.email?.split('@')[0] || 'Nutzer';
  }, [isFreelancer, freelancerProfile, memberProfile, user]);

  const userEmail = useMemo(() => {
    if (isFreelancer && freelancerProfile) {
      return freelancerProfile.email || user?.email || '';
    }
    if (!isFreelancer && memberProfile) {
      return memberProfile.email || user?.email || '';
    }
    return user?.email || '';
  }, [isFreelancer, freelancerProfile, memberProfile, user]);

  const userInitials = useMemo(() => {
    if (isFreelancer && freelancerProfile) {
      // Für Freelancer: Initialen aus Vor- und Nachname
      if (freelancerProfile.firstName && freelancerProfile.lastName) {
        return `${freelancerProfile.firstName[0]}${freelancerProfile.lastName[0]}`.toUpperCase();
      }
      // Fallback: Aus displayName
      const name = freelancerProfile.displayName || '';
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase() || freelancerProfile.email?.[0].toUpperCase() || '?';
    }
    if (!isFreelancer && memberProfile) {
      // Für Admins/Manager: Initialen aus Vor- und Nachname
      if (memberProfile.firstName && memberProfile.lastName) {
        return `${memberProfile.firstName[0]}${memberProfile.lastName[0]}`.toUpperCase();
      }
      // Fallback: Aus displayName
      const name = memberProfile.displayName || '';
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase() || memberProfile.email?.[0].toUpperCase() || '?';
    }
    // Normale User: Aus displayName oder Email
    const name = userName;
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || user?.email?.[0].toUpperCase() || '?';
  }, [isFreelancer, freelancerProfile, memberProfile, userName, user]);

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
    // Sidebar auf mobilen Geräten schließen nach Navigation
    if (window.innerWidth <= 768) {
      setIsMenuOpen(false);
    }
  };

  // Sidebar schließen bei Klick außerhalb (Overlay)
  const handleOverlayClick = () => {
    setIsMenuOpen(false);
  };

  // ESC-Taste schließt das Menü
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMenuOpen) {
          setIsMenuOpen(false);
        }
        if (isUserMenuOpen) {
          setIsUserMenuOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMenuOpen, isUserMenuOpen]);

  // Click außerhalb schließt das User-Menü
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen]);

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
      {/* Overlay für mobile Ansicht */}
      {isMenuOpen && <div className={styles.overlay} onClick={handleOverlayClick} />}
      
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}>
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
          <div className={styles.headerLeft}>
            {/* Burger Menu Button für mobile Ansicht */}
            <button 
              className={styles.burgerButton}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menü öffnen/schließen"
            >
              <span className={styles.burgerIcon}>
                {isMenuOpen ? '✕' : '☰'}
              </span>
            </button>
            <div className={styles.headerTitle}>
              {navItems.find(item => item.id === currentPage)?.label || 'Dashboard'}
            </div>
          </div>
          <div className={styles.headerActions}>
            {user && (
              <>
                <NotificationBell onNavigate={handleNotificationNavigate} />
                <div className={styles.userMenu} ref={userMenuRef}>
                  <button 
                    className={styles.userMenuButton}
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-label="Benutzermenü"
                  >
                    <div className={styles.userAvatar}>
                      {userInitials}
                    </div>
                    <span className={styles.userName}>{userName}</span>
                    <span className={styles.userMenuArrow}>
                      {isUserMenuOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {isUserMenuOpen && (
                    <div className={styles.userMenuDropdown}>
                      <div className={styles.userMenuHeader}>
                        <div className={styles.userMenuAvatar}>
                          {userInitials}
                        </div>
                        <div className={styles.userMenuInfo}>
                          <span className={styles.userMenuName}>{userName}</span>
                          <span className={styles.userMenuEmail}>{userEmail}</span>
                        </div>
                      </div>
                      <div className={styles.userMenuDivider} />
                      {/* Profil bearbeiten - für Freelancer */}
                      {isFreelancer && (
                        <>
                          <button 
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              setShowProfileModal(true);
                            }} 
                            className={styles.userMenuItem}
                          >
                            <span className={styles.userMenuItemIcon}>👤</span>
                            <span>Profil bearbeiten</span>
                          </button>
                          <div className={styles.userMenuDivider} />
                        </>
                      )}
                      {/* Profil bearbeiten - für Admins/Manager */}
                      {!isFreelancer && isAdminOrManager && (
                        <>
                          <button 
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              setShowMemberProfileModal(true);
                            }} 
                            className={styles.userMenuItem}
                          >
                            <span className={styles.userMenuItemIcon}>👤</span>
                            <span>Profil bearbeiten</span>
                          </button>
                          <div className={styles.userMenuDivider} />
                        </>
                      )}
                      <button 
                        onClick={() => {
                          handleSignOut();
                          setIsUserMenuOpen(false);
                        }} 
                        className={styles.userMenuItem}
                      >
                        <span className={styles.userMenuItemIcon}>🚪</span>
                        <span>Abmelden</span>
                      </button>
                    </div>
                  )}
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

      {/* Profil-Modal für Freelancer */}
      {isFreelancer && (
        <FreelancerProfileModal
          open={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={handleProfileUpdated}
          onAccountDeleted={() => {
            // Wird aufgerufen wenn Account gelöscht wurde
            // Logout erfolgt automatisch im Modal
          }}
        />
      )}

      {/* Profil-Modal für Admins/Manager */}
      {!isFreelancer && isAdminOrManager && (
        <MemberProfileModal
          open={showMemberProfileModal}
          onClose={() => setShowMemberProfileModal(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </div>
  );
}
