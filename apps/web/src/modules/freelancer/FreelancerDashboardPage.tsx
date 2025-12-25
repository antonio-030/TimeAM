/**
 * Freelancer Dashboard Page
 * 
 * Dashboard für Freelancer mit Widgets und Statistiken.
 */

import { useId, useCallback, useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../core/auth';
import { useTenant } from '../../core/tenant';
import { getFreelancerApplications, getFreelancer, getVerificationStatus, type FreelancerApplication, type VerificationStatus } from './api';
import { APPLICATION_STATUS } from '@timeam/shared';
import { VerificationOnboarding } from '../../components/VerificationOnboarding';
import styles from './FreelancerDashboardPage.module.css';

// ============= Types =============

export interface FreelancerDashboardPageProps {
  onNavigate?: (page: string) => void;
}

// ============= Sub-Components =============

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  subtitle?: string;
  onClick?: () => void;
}

function StatCard({ icon, label, value, color, subtitle, onClick }: StatCardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`${styles.statCard} ${styles[`statCard${color.charAt(0).toUpperCase()}${color.slice(1)}`]} ${onClick ? styles.statCardClickable : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span className={styles.statIcon} aria-hidden="true">{icon}</span>
      <div className={styles.statContent}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
        {subtitle && <span className={styles.statSubtitle}>{subtitle}</span>}
      </div>
    </Tag>
  );
}

interface ApplicationsWidgetProps {
  applications: FreelancerApplication[];
  onViewMore: () => void;
}

function ApplicationsWidget({ applications, onViewMore }: ApplicationsWidgetProps) {
  const widgetId = useId();
  
  const pendingApps = applications.filter((app) => app.status === APPLICATION_STATUS.PENDING);
  const acceptedApps = applications.filter((app) => app.status === APPLICATION_STATUS.ACCEPTED);
  const upcomingShifts = useMemo(() => {
    const now = new Date();
    return acceptedApps
      .filter((app) => new Date(app.shiftStartsAt) > now)
      .slice(0, 3)
      .sort((a, b) => new Date(a.shiftStartsAt).getTime() - new Date(b.shiftStartsAt).getTime());
  }, [acceptedApps]);

  return (
    <section className={styles.moduleWidget} aria-labelledby={widgetId}>
      <div className={styles.widgetHeader}>
        <h3 id={widgetId} className={styles.widgetTitle}>
          <span>📋</span> Bewerbungen
        </h3>
        <button className={styles.widgetLink} onClick={onViewMore}>
          Alle ansehen →
        </button>
      </div>
      
      <div className={styles.widgetContent}>
        <div className={styles.applicationsStats}>
          <div className={styles.appStatItem}>
            <span className={styles.appStatValue}>{pendingApps.length}</span>
            <span className={styles.appStatLabel}>Ausstehend</span>
          </div>
          <div className={styles.appStatItem}>
            <span className={styles.appStatValue}>{acceptedApps.length}</span>
            <span className={styles.appStatLabel}>Angenommen</span>
          </div>
        </div>

        {upcomingShifts.length > 0 && (
          <div className={styles.upcomingShifts}>
            <h4 className={styles.upcomingTitle}>Kommende Schichten</h4>
            <div className={styles.upcomingList}>
              {upcomingShifts.map((app) => (
                <div key={app.id} className={styles.upcomingItem}>
                  <div className={styles.upcomingDate}>
                    {new Date(app.shiftStartsAt).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </div>
                  <div className={styles.upcomingDetails}>
                    <div className={styles.upcomingShiftTitle}>{app.shiftTitle}</div>
                    <div className={styles.upcomingCompany}>{app.tenantName}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {applications.length === 0 && (
          <div className={styles.emptyState}>
            <p>Noch keine Bewerbungen</p>
            <button onClick={onViewMore} className={styles.emptyAction}>
              Schichten durchsuchen
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

interface CalendarWidgetProps {
  onViewMore: () => void;
}

function CalendarWidget({ onViewMore }: CalendarWidgetProps) {
  const widgetId = useId();
  const today = new Date();
  const dayName = today.toLocaleDateString('de-DE', { weekday: 'long' });
  const dayNumber = today.getDate();
  const monthName = today.toLocaleDateString('de-DE', { month: 'long' });

  return (
    <section className={styles.moduleWidget} aria-labelledby={widgetId}>
      <div className={styles.widgetHeader}>
        <h3 id={widgetId} className={styles.widgetTitle}>
          <span>📅</span> Kalender
        </h3>
        <button className={styles.widgetLink} onClick={onViewMore}>
          Öffnen →
        </button>
      </div>
      
      <div className={styles.widgetContent}>
        <div className={styles.calendarPreview}>
          <div className={styles.calendarDay}>{dayNumber}</div>
          <div className={styles.calendarInfo}>
            <div className={styles.calendarWeekday}>{dayName}</div>
            <div className={styles.calendarMonth}>{monthName}</div>
          </div>
        </div>
        <p className={styles.calendarHint}>
          Alle deine Schichten und Termine auf einen Blick
        </p>
      </div>
    </section>
  );
}

interface PoolWidgetProps {
  onViewMore: () => void;
}

function PoolWidget({ onViewMore }: PoolWidgetProps) {
  const widgetId = useId();

  return (
    <section className={styles.moduleWidget} aria-labelledby={widgetId}>
      <div className={styles.widgetHeader}>
        <h3 id={widgetId} className={styles.widgetTitle}>
          <span>🔍</span> Schicht-Pool
        </h3>
        <button className={styles.widgetLink} onClick={onViewMore}>
          Durchsuchen →
        </button>
      </div>
      
      <div className={styles.widgetContent}>
        <p className={styles.poolHint}>
          Durchsuche öffentliche Schichten und bewerbe dich auf passende Angebote
        </p>
        <button onClick={onViewMore} className={styles.poolAction}>
          Schichten anzeigen
        </button>
      </div>
    </section>
  );
}

// ============= Main Component =============

export function FreelancerDashboardPage({ onNavigate }: FreelancerDashboardPageProps) {
  const { user } = useAuth();
  const { hasEntitlement } = useTenant();
  const [applications, setApplications] = useState<FreelancerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | undefined>(undefined);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [applicationsData, freelancerData] = await Promise.all([
        getFreelancerApplications(),
        getFreelancer(),
      ]);
      setApplications(applicationsData.applications);
      setVerificationStatus(freelancerData.freelancer.verificationStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVerificationStatus = useCallback(async () => {
    try {
      const statusResponse = await getVerificationStatus();
      setVerificationStatus(statusResponse.verificationStatus || undefined);
    } catch (err) {
      console.error('Fehler beim Laden des Verifizierungsstatus:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  // Modal automatisch öffnen wenn nicht verifiziert
  useEffect(() => {
    if (!loading && verificationStatus !== 'approved' && verificationStatus !== 'pending') {
      setShowVerificationModal(true);
    }
  }, [loading, verificationStatus]);

  // Navigation Handler
  const navigate = useCallback((page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  }, [onNavigate]);

  if (!user) return null;

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Dashboard wird geladen...</p>
      </div>
    );
  }

  const userName = user.displayName || user.email?.split('@')[0] || 'Freelancer';
  const greeting = getGreetingTime();

  // Statistiken berechnen
  const pendingApps = applications.filter((app) => app.status === APPLICATION_STATUS.PENDING);
  const acceptedApps = applications.filter((app) => app.status === APPLICATION_STATUS.ACCEPTED);
  const rejectedApps = applications.filter((app) => app.status === APPLICATION_STATUS.REJECTED);
  const upcomingShifts = acceptedApps.filter((app) => new Date(app.shiftStartsAt) > new Date());

  // Aktive Module zählen
  const activeModules = [
    true, // Dashboard ist immer aktiv
    true, // Kalender ist immer aktiv
    true, // Meine Schichten ist Core-Modul
    true, // Schicht-Pool ist Core-Modul
  ].filter(Boolean).length;

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitleRow}>
            <h1 className={styles.greeting}>
              {greeting === 'Morgen' ? '🌅' : greeting === 'Tag' ? '☀️' : '🌙'} Guten {greeting}, {userName}!
            </h1>
            {/* Verifizierungs-Badge */}
            <button
              className={`${styles.verificationBadge} ${
                verificationStatus === 'approved' 
                  ? styles.verificationBadgeApproved 
                  : verificationStatus === 'pending'
                    ? styles.verificationBadgePending
                    : styles.verificationBadgeNotVerified
              }`}
              onClick={() => setShowVerificationModal(true)}
              title={
                verificationStatus === 'approved' 
                  ? 'Verifiziert - Klicken für Details' 
                  : verificationStatus === 'pending'
                    ? 'Verifizierung wird geprüft'
                    : 'Noch nicht verifiziert - Jetzt verifizieren'
              }
            >
              {verificationStatus === 'approved' ? (
                <>
                  <span className={styles.verificationBadgeIcon}>✓</span>
                  <span className={styles.verificationBadgeText}>Verifiziert</span>
                </>
              ) : verificationStatus === 'pending' ? (
                <>
                  <span className={styles.verificationBadgeIcon}>⏳</span>
                  <span className={styles.verificationBadgeText}>In Prüfung</span>
                </>
              ) : (
                <>
                  <span className={styles.verificationBadgeIcon}>⚠️</span>
                  <span className={styles.verificationBadgeText}>Noch zu verifizieren</span>
                </>
              )}
            </button>
          </div>
          <p className={styles.subtitle}>
            Freelancer Account • {activeModules} Module aktiv
          </p>
        </div>
        <button 
          onClick={loadApplications} 
          className={styles.refreshButton}
          title="Aktualisieren"
        >
          🔄
        </button>
      </header>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={loadApplications} className={styles.retryBtn}>
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Verifizierungs-Onboarding Modal */}
      {showVerificationModal && (
        <VerificationOnboarding
          currentStatus={verificationStatus}
          open={showVerificationModal}
          onClose={() => {
            setShowVerificationModal(false);
          }}
          onStatusChange={(status) => {
            setVerificationStatus(status);
            loadVerificationStatus();
            // Wenn pending, Modal offen lassen
            if (status === 'pending') {
              setShowVerificationModal(true);
            }
          }}
        />
      )}

      {/* Button zum Öffnen des Modals (wenn nicht approved und Modal geschlossen) */}
      {verificationStatus !== 'approved' && !showVerificationModal && (
        <div className={styles.verificationPrompt}>
          <div className={styles.verificationPromptContent}>
            <span className={styles.verificationPromptIcon}>⚠️</span>
            <div className={styles.verificationPromptText}>
              <strong>Konto verifizieren erforderlich</strong>
              <p>Verifizieren Sie Ihr Konto, um sich auf Schichten bewerben zu können.</p>
            </div>
            <button
              onClick={() => setShowVerificationModal(true)}
              className={styles.verificationPromptButton}
            >
              Jetzt verifizieren
            </button>
          </div>
        </div>
      )}


      {/* Stats */}
      <section className={styles.statsSection}>
        <div className={styles.statsGrid}>
          <StatCard
            icon="⏳"
            label="Ausstehend"
            value={String(pendingApps.length)}
            color="orange"
            onClick={() => navigate('freelancer-dashboard')}
          />
          
          <StatCard
            icon="✅"
            label="Angenommen"
            value={String(acceptedApps.length)}
            color="green"
            subtitle={upcomingShifts.length > 0 ? `${upcomingShifts.length} kommend` : undefined}
            onClick={() => navigate('freelancer-my-shifts')}
          />
          
          <StatCard
            icon="❌"
            label="Abgelehnt"
            value={String(rejectedApps.length)}
            color="red"
          />
          
          <StatCard
            icon="📊"
            label="Gesamt"
            value={String(applications.length)}
            color="blue"
          />
        </div>
      </section>


      {/* Module Widgets Grid */}
      <section className={styles.widgetsSection}>
        <h2 className={styles.sectionTitle}>📦 Aktive Module</h2>
        
        <div className={styles.widgetsGrid}>
          {/* Bewerbungen Widget */}
          <ApplicationsWidget
            applications={applications}
            onViewMore={() => navigate('freelancer-dashboard')}
          />

          {/* Kalender Widget - immer aktiv */}
          <CalendarWidget onViewMore={() => navigate('calendar')} />

          {/* Meine Schichten Widget - Core-Modul, immer verfügbar */}
          <section className={styles.moduleWidget}>
            <div className={styles.widgetHeader}>
              <h3 className={styles.widgetTitle}>
                <span>✅</span> Meine Schichten
              </h3>
              <button className={styles.widgetLink} onClick={() => navigate('freelancer-my-shifts')}>
                Alle ansehen →
              </button>
            </div>
            <div className={styles.widgetContent}>
              <p className={styles.poolHint}>
                Übersicht aller angenommenen Schichten
              </p>
              <button onClick={() => navigate('freelancer-my-shifts')} className={styles.poolAction}>
                Schichten anzeigen
              </button>
            </div>
          </section>

          {/* Pool Widget - Core-Modul, immer verfügbar */}
          <PoolWidget onViewMore={() => navigate('freelancer-pool')} />
        </div>
      </section>

      {/* Quick Info für Freelancer */}
      <section className={styles.infoSection}>
        <div className={styles.infoCard}>
          <div className={styles.infoCardContent}>
            <span className={styles.infoCardIcon}>🎯</span>
            <div>
              <p className={styles.infoCardTitle}>{userName}</p>
              <p className={styles.infoCardSubtitle}>{user.email}</p>
            </div>
          </div>
          <span className={styles.infoCardBadge}>Freelancer</span>
        </div>
        
        <div className={styles.tipCard}>
          <span className={styles.tipIcon}>💡</span>
          <div>
            <strong>Tipp:</strong> {getDailyTip()}
          </div>
        </div>
      </section>
    </div>
  );
}

// Helper functions
function getGreetingTime(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morgen';
  if (hour < 18) return 'Tag';
  return 'Abend';
}

function getDailyTip(): string {
  const tips = [
    'Bewirb dich frühzeitig auf interessante Schichten',
    'Halte dein Profil aktuell für bessere Chancen',
    'Prüfe regelmäßig neue Schichten im Pool',
    'Kontaktiere Firmen bei Fragen zu Schichten',
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

