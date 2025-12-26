/**
 * App Layout
 *
 * Haupt-Layout mit erweiterter Sidebar.
 * - Kalender mit Hover-Tooltip für Termine (echte Daten!)
 * - Filter für alle Nutzer
 * - Mitarbeiter-Suche nur für Admin/Manager
 */

import { type ReactNode, useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { useTenant } from '../../core/tenant';
import { useDevStaffCheck } from '../../modules/support/hooks';
import { useSuperAdminCheck } from '../../modules/admin';
import { NotificationBell } from '../../modules/notifications';
import { MiniCalendar } from './MiniCalendar';
import { useSidebarCalendar } from './useSidebarCalendar';
import { FreelancerProfileModal } from '../../modules/freelancer/FreelancerProfileModal';
import { getFreelancer, type FreelancerResponse } from '../../modules/freelancer/api';
import { MemberProfileModal } from '../../modules/members/MemberProfileModal';
import { getMemberProfile, getMembers } from '../../modules/members/api';
import { MEMBER_ROLES, getMemberRoleLabel, type Member } from '@timeam/shared';
import { EditTenantNameModal } from './EditTenantNameModal';
import { SettingsModal } from '../SettingsModal';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Debug: Log Navigation-Änderungen
  useEffect(() => {
    console.log('🔴 AppLayout - Location geändert:', location.pathname);
  }, [location.pathname]);
  const { isSuperAdmin } = useSuperAdminCheck();
  const { user, signOut } = useAuth();
  const { tenant, role, hasEntitlement, isFreelancer, refresh: refreshTenant } = useTenant();
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
  const [showEditTenantNameModal, setShowEditTenantNameModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  // Autocomplete für Mitarbeiter-Suche
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Debug: Log State-Änderungen
  useEffect(() => {
    console.log('🔴 AppLayout - showSettingsModal State geändert zu:', showSettingsModal);
  }, [showSettingsModal]);

  // WICHTIG: Verhindere, dass das Modal geschlossen wird, wenn die Location sich ändert
  // Das Modal sollte nur durch explizites Schließen geschlossen werden
  useEffect(() => {
    // Wenn das Modal offen ist und die Location sich ändert, NICHT schließen
    // Das Modal bleibt offen, auch wenn die Location sich ändert
  }, [location.pathname, showSettingsModal]);

  // Prüfen ob User Admin oder Manager ist
  const isAdminOrManager = useMemo(() => {
    return role === MEMBER_ROLES.ADMIN || role === MEMBER_ROLES.MANAGER;
  }, [role]);

  // Mitglieder für Autocomplete laden (nur für Admin/Manager)
  useEffect(() => {
    if (!isFreelancer && isAdminOrManager) {
      getMembers()
        .then((response) => {
          setAllMembers(response.members);
        })
        .catch((err) => {
          console.error('Fehler beim Laden der Mitglieder für Suche:', err);
        });
    }
  }, [isFreelancer, isAdminOrManager]);

  // Gefilterte Mitglieder für Autocomplete
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return allMembers
      .filter((member) => {
        const name = member.displayName?.toLowerCase() || '';
        const email = member.email.toLowerCase();
        const firstName = member.firstName?.toLowerCase() || '';
        const lastName = member.lastName?.toLowerCase() || '';
        
        return (
          name.includes(query) ||
          email.includes(query) ||
          firstName.includes(query) ||
          lastName.includes(query) ||
          `${firstName} ${lastName}`.trim().includes(query)
        );
      })
      .slice(0, 5); // Maximal 5 Vorschläge
  }, [searchQuery, allMembers]);

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

  // Member-Profil laden (für alle Mitglieder im User-Menü)
  useEffect(() => {
    if (!isFreelancer && user) {
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
  }, [isFreelancer, user]);

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
    } else if (!isFreelancer && user) {
      getMemberProfile()
        .then((response) => {
          setMemberProfile(response.member);
        })
        .catch((err) => {
          console.error('Fehler beim Neuladen des Member-Profils:', err);
        });
    }
  }, [isFreelancer, user]);

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
      // Für alle Mitglieder: Vollständiger Name aus Profil
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
      // Für alle Mitglieder: Initialen aus Vor- und Nachname
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

  // Handler für Settings-Button
  const handleSettingsClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('🔵 handleSettingsClick aufgerufen');
    
    // Verhindere ALLES: Default, Propagation
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
    
    // Verhindere auch Navigation
    if (e.nativeEvent && e.nativeEvent.preventDefault) {
      e.nativeEvent.preventDefault();
    }
    
    // Modal sofort öffnen
    console.log('🔵 Öffne Settings-Modal');
    setShowSettingsModal(true);
    
    // Menü sofort schließen
    setIsUserMenuOpen(false);
    
    // Verhindere weitere Event-Propagation
    return false;
  }, []);

  // Mapping von Page-IDs zu URL-Pfaden
  const getPagePath = (pageId: string): string => {
    const pathMap: Record<string, string> = {
      'dashboard': '/dashboard',
      'time-tracking': '/time-tracking',
      'calendar': '/calendar',
      'shifts': '/shifts',
      'my-shifts': '/my-shifts',
      'admin-shifts': '/admin-shifts',
      'members': '/members',
      'reports': '/reports',
      'dev-dashboard': '/dev-dashboard',
      'support': '/support',
      'dev-staff-admin': '/dev-staff-admin',
      'freelancer-dashboard': '/freelancer-dashboard',
      'freelancer-my-shifts': '/freelancer-my-shifts',
      'freelancer-pool': '/freelancer-pool',
    };
    return pathMap[pageId] || '/dashboard';
  };

  const handleNavClick = (page: string) => {
    const path = getPagePath(page);
    navigate(path);
    // Sidebar auf mobilen Geräten schließen nach Navigation
    if (window.innerWidth <= 768) {
      setIsMenuOpen(false);
    }
  };

  // Aktuelle Seite aus URL ableiten
  const currentPage = useMemo(() => {
    const path = location.pathname;
    if (path === '/dashboard') return 'dashboard';
    if (path === '/time-tracking') return 'time-tracking';
    if (path === '/calendar') return 'calendar';
    if (path === '/shifts') return 'shifts';
    if (path === '/my-shifts') return 'my-shifts';
    if (path === '/admin-shifts') return 'admin-shifts';
    if (path === '/members') return 'members';
    if (path === '/reports') return 'reports';
    if (path === '/dev-dashboard') return 'dev-dashboard';
    if (path === '/support') return 'support';
    if (path === '/dev-staff-admin') return 'dev-staff-admin';
    if (path === '/freelancer-dashboard') return 'freelancer-dashboard';
    if (path === '/freelancer-my-shifts') return 'freelancer-my-shifts';
    if (path === '/freelancer-pool') return 'freelancer-pool';
    return 'dashboard';
  }, [location.pathname]);

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
    if (!isUserMenuOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Prüfe ob Menü noch offen ist (könnte sich während des Event-Handlings geändert haben)
      if (!isUserMenuOpen) {
        return;
      }
      
      if (!target || !userMenuRef.current) {
        return;
      }
      
      // Prüfe ob Klick auf Button oder innerhalb des Dropdowns ist
      const isButton = target.tagName === 'BUTTON' || target.closest('button');
      const isInDropdown = userMenuRef.current.contains(target);
      
      // Wenn Button im Dropdown geklickt wird, NICHT schließen und NICHT navigieren
      if (isButton && isInDropdown) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // Nur schließen wenn wirklich außerhalb
      if (!isInDropdown) {
        setIsUserMenuOpen(false);
      }
    };
    
    // Verwende click statt mousedown, um sicherzustellen, dass Buttons zuerst reagieren können
    // OHNE Capture-Phase, damit Buttons zuerst reagieren können
    document.addEventListener('click', handleClickOutside, false);
    return () => {
      document.removeEventListener('click', handleClickOutside, false);
    };
  }, [isUserMenuOpen]);

  // Handler für Notification-Links
  const handleNotificationNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // Handler für Kalender-Event-Klick
  const handleEventClick = useCallback((eventId: string, eventType: string) => {
    // Navigiere basierend auf Event-Typ und Rolle
    switch (eventType) {
      case 'shift':
        // Admin/Manager → Schicht-Verwaltung, Mitarbeiter → Meine Schichten
        navigate(isAdminOrManager ? '/admin-shifts' : '/my-shifts');
        break;
      case 'time-entry':
        navigate('/time-tracking');
        break;
      case 'appointment':
        navigate('/calendar');
        break;
      default:
        navigate('/calendar');
    }
  }, [navigate, isAdminOrManager]);

  // Rolle in lesbare Form umwandeln
  const displayRole = useMemo(() => {
    if (!role) return null;
    return getMemberRoleLabel(role);
  }, [role]);

  // Firmenname für Anzeige: Für Freelancer companyName aus Profil, sonst tenant.name
  const displayCompanyName = useMemo(() => {
    if (isFreelancer && freelancerProfile?.companyName) {
      return freelancerProfile.companyName;
    }
    return tenant?.name || '';
  }, [isFreelancer, freelancerProfile, tenant]);

  // Handler für Tenant-Name-Update
  const handleTenantNameUpdated = useCallback(async (newName: string) => {
    // Tenant-Context neu laden
    await refreshTenant();
  }, [refreshTenant]);

  // Prüfen ob User Admin ist (für klickbaren Firmennamen)
  const isAdmin = useMemo(() => {
    return role === MEMBER_ROLES.ADMIN;
  }, [role]);

  // Navigation Items - Dev-Mitarbeiter, Freelancer oder normale Mitarbeiter
  const navItems = isDevStaff ? [
    { id: 'support', label: 'Verifizierungen', icon: '🛠️', enabled: true },
    { id: 'dev-staff-admin', label: 'Dev-Mitarbeiter', icon: '👥', enabled: isSuperAdmin },
    { id: 'dev-dashboard', label: 'Developer', icon: '🔐', enabled: isSuperAdmin },
  ] : isFreelancer ? [
    { id: 'freelancer-dashboard', label: 'Dashboard', icon: '📊', enabled: true },
    { id: 'time-tracking', label: 'Zeiterfassung', icon: '⏰', enabled: hasTimeTrackingAccess },
    { id: 'calendar', label: 'Kalender', icon: '📅', enabled: true },
    { id: 'freelancer-my-shifts', label: 'Meine Schichten', icon: '✅', enabled: true },
    { id: 'freelancer-pool', label: 'Schicht-Pool', icon: '🔍', enabled: true },
    { id: 'freelancer-admin-shifts', label: 'Schicht-Verwaltung', icon: '⚙️', enabled: hasShiftPoolAccess },
    { id: 'reports', label: 'Berichte', icon: '📈', enabled: hasReportsAccess },
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

  // Handler für Mitarbeiter-Suche
  const handleMemberSearch = useCallback((e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigiere zur Members-Seite mit Suchbegriff als Query-Parameter
      navigate(`/members?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery(''); // Suche zurücksetzen
      setShowAutocomplete(false);
    } else {
      // Wenn keine Suche, einfach zur Members-Seite navigieren
      navigate('/members');
      setShowAutocomplete(false);
    }
    // Sidebar auf mobilen Geräten schließen
    if (window.innerWidth <= 768) {
      setIsMenuOpen(false);
    }
  }, [searchQuery, navigate]);

  // Handler für Enter-Taste in der Suche
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleMemberSearch(e);
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  }, [handleMemberSearch]);

  // Handler für Auswahl eines Mitglieds aus Autocomplete
  const handleMemberSelect = useCallback((member: Member) => {
    navigate(`/members?search=${encodeURIComponent(member.displayName || member.email)}`);
    setSearchQuery('');
    setShowAutocomplete(false);
    // Sidebar auf mobilen Geräten schließen
    if (window.innerWidth <= 768) {
      setIsMenuOpen(false);
    }
  }, [navigate]);

  // Klick außerhalb schließt Autocomplete
  useEffect(() => {
    if (!showAutocomplete) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAutocomplete]);

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
      { 
        id: 'members', 
        label: 'Mitarbeiter', 
        icon: '👥',
        page: 'members',
        enabled: isAdminOrManager,
      },
    ];
    
    return filters.filter(f => f.enabled);
  }, [isFreelancer, hasShiftPoolAccess, hasTimeTrackingAccess, isAdminOrManager]);

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
              <div className={styles.searchContainer} ref={searchBoxRef}>
                <form onSubmit={handleMemberSearch} className={styles.searchBox}>
                  <span className={styles.searchIcon}>🔍</span>
                  <input
                    type="text"
                    placeholder="Mitarbeiter suchen..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowAutocomplete(e.target.value.trim().length > 0);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => {
                      if (searchQuery.trim().length > 0) {
                        setShowAutocomplete(true);
                      }
                    }}
                    className={styles.searchInput}
                  />
                </form>
                {showAutocomplete && filteredMembers.length > 0 && (
                  <div className={styles.autocompleteDropdown}>
                    {filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className={styles.autocompleteItem}
                        onClick={() => handleMemberSelect(member)}
                      >
                        <div className={styles.autocompleteItemName}>
                          {member.displayName || 
                           (member.firstName && member.lastName
                             ? `${member.firstName} ${member.lastName}`.trim()
                             : member.email.split('@')[0])}
                        </div>
                        <div className={styles.autocompleteItemEmail}>{member.email}</div>
                      </button>
                    ))}
                  </div>
                )}
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
          {tenant || displayCompanyName ? (
            <div className={styles.tenantInfo}>
              <span className={styles.tenantIcon}>{isFreelancer ? '🎯' : '🏢'}</span>
              <div className={styles.tenantDetails}>
                {isAdmin && !isFreelancer ? (
                  <button
                    className={styles.tenantNameButton}
                    onClick={() => setShowEditTenantNameModal(true)}
                    title="Firmenname bearbeiten"
                  >
                    {displayCompanyName}
                  </button>
                ) : (
                  <span className={styles.tenantName}>{displayCompanyName}</span>
                )}
                {displayRole && <span className={styles.tenantRole}>{displayRole}</span>}
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsUserMenuOpen(!isUserMenuOpen);
                    }}
                    aria-label="Benutzermenü"
                    type="button"
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
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsUserMenuOpen(false);
                              setShowProfileModal(true);
                            }} 
                            className={styles.userMenuItem}
                            type="button"
                          >
                            <span className={styles.userMenuItemIcon}>👤</span>
                            <span>Profil bearbeiten</span>
                          </button>
                          <div className={styles.userMenuDivider} />
                        </>
                      )}
                      {/* Profil bearbeiten - für alle Mitglieder (Admin/Manager/Employee) */}
                      {!isFreelancer && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsUserMenuOpen(false);
                              setShowMemberProfileModal(true);
                            }} 
                            className={styles.userMenuItem}
                            type="button"
                          >
                            <span className={styles.userMenuItemIcon}>👤</span>
                            <span>Profil bearbeiten</span>
                          </button>
                          <div className={styles.userMenuDivider} />
                        </>
                      )}
                      <button
                        className={styles.userMenuItem}
                        onClick={handleSettingsClick}
                        type="button"
                        onMouseDown={(e) => {
                          console.log('🟡 Einstellungen-Button onMouseDown');
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.nativeEvent) {
                            e.nativeEvent.preventDefault();
                            e.nativeEvent.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }
                        }}
                        onMouseUp={(e) => {
                          console.log('🟢 Einstellungen-Button onMouseUp');
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.nativeEvent) {
                            e.nativeEvent.preventDefault();
                            e.nativeEvent.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onPointerUp={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <span className={styles.userMenuItemIcon}>⚙️</span>
                        <span>Einstellungen</span>
                      </button>
                      <div className={styles.userMenuDivider} />
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSignOut();
                          setIsUserMenuOpen(false);
                        }} 
                        className={styles.userMenuItem}
                        type="button"
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

      {/* Profil-Modal für alle Mitglieder (Admin/Manager/Employee) */}
      {!isFreelancer && (
        <MemberProfileModal
          open={showMemberProfileModal}
          onClose={() => setShowMemberProfileModal(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      )}

      {/* Edit Tenant Name Modal (nur für Admins) */}
      {tenant && (
        <EditTenantNameModal
          open={showEditTenantNameModal}
          currentName={tenant.name}
          onClose={() => setShowEditTenantNameModal(false)}
          onSuccess={handleTenantNameUpdated}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        open={showSettingsModal}
        onClose={() => {
          console.log('🔴 SettingsModal onClose aufgerufen');
          setShowSettingsModal(false);
        }}
      />
    </div>
  );
}
