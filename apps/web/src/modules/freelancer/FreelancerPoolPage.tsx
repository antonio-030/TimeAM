/**
 * Freelancer Pool Page
 *
 * Öffentliche Seite für Freelancer, um alle öffentlichen Schichten zu sehen.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { getPublicPool, applyToPublicShift } from '../shift-pool/api';
import { APPLICATION_STATUS, type PoolShift, type ApplicationStatus } from '@timeam/shared';
import { openAddressInMaps } from '../shift-pool/mapsUtils';
import { useAuth } from '../../core/auth';
import { getVerificationStatus, type VerificationStatus } from './api';
import styles from './FreelancerPoolPage.module.css';

// =============================================================================
// Types
// =============================================================================

type PublicPoolShift = PoolShift & { tenantName: string; tenantId: string };

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatDateLong(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDuration(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const diffMs = end.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function getRelativeDate(isoString: string): { label: string; isUrgent: boolean; isSoon: boolean } {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays === 0) {
    if (diffHours <= 0) return { label: 'Jetzt', isUrgent: true, isSoon: true };
    if (diffHours <= 3) return { label: `In ${diffHours}h`, isUrgent: true, isSoon: true };
    return { label: 'Heute', isUrgent: false, isSoon: true };
  }
  if (diffDays === 1) return { label: 'Morgen', isUrgent: false, isSoon: true };
  if (diffDays <= 7) return { label: `In ${diffDays} Tagen`, isUrgent: false, isSoon: false };
  return { label: formatDate(isoString), isUrgent: false, isSoon: false };
}

// =============================================================================
// Components
// =============================================================================

interface ShiftCardProps {
  shift: PublicPoolShift;
  onClick: () => void;
}

function ShiftCard({ shift, onClick }: ShiftCardProps) {
  const hasSlots = shift.freeSlots > 0;
  const relativeDate = getRelativeDate(shift.startsAt);
  const duration = getDuration(shift.startsAt, shift.endsAt);

  return (
    <div 
      className={`${styles.shiftCard} ${!hasSlots ? styles.shiftCardFull : ''}`}
      onClick={onClick}
    >
      {relativeDate.isUrgent && (
        <div className={styles.urgentBadge}>⚡ {relativeDate.label}</div>
      )}
      
      <div className={styles.shiftCardHeader}>
        <h3 className={styles.shiftCardTitle}>{shift.title}</h3>
        {shift.payRate && (
          <span className={styles.shiftCardPay}>
            {shift.payRate.toFixed(0)}€<small>/h</small>
          </span>
        )}
      </div>

      <div className={styles.shiftCardBody}>
        <div className={styles.shiftCardInfo}>
          <div className={styles.shiftCardInfoRow}>
            <span className={styles.shiftCardIcon}>🏢</span>
            <span>{shift.tenantName}</span>
          </div>
          <div className={styles.shiftCardInfoRow}>
            <span className={styles.shiftCardIcon}>📍</span>
            <span>{shift.location.name}</span>
          </div>
          <div className={styles.shiftCardInfoRow}>
            <span className={styles.shiftCardIcon}>📅</span>
            <span className={relativeDate.isSoon ? styles.soonDate : ''}>
              {relativeDate.label}
            </span>
            <span className={styles.shiftCardTime}>
              {formatTime(shift.startsAt)} - {formatTime(shift.endsAt)}
            </span>
          </div>
          <div className={styles.shiftCardInfoRow}>
            <span className={styles.shiftCardIcon}>⏱️</span>
            <span>{duration}</span>
          </div>
        </div>
      </div>

      <div className={styles.shiftCardFooter}>
        <div className={styles.shiftCardSlots}>
          <span className={hasSlots ? styles.slotsTextAvailable : styles.slotsTextFull}>
            {hasSlots ? `${shift.freeSlots} von ${shift.requiredCount} Plätzen frei` : 'Ausgebucht'}
          </span>
        </div>
        
        {hasSlots && (
          <button className={styles.applyQuickBtn} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            Bewerben →
          </button>
        )}
        {!hasSlots && (
          <span className={styles.fullLabel}>Ausgebucht</span>
        )}
      </div>
    </div>
  );
}

interface ApplyModalProps {
  shift: PublicPoolShift | null;
  onClose: () => void;
  onApplied: () => void;
  onLoginClick?: () => void;
}

function ApplyModal({ shift, onClose, onApplied, onLoginClick }: ApplyModalProps) {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [loadingVerification, setLoadingVerification] = useState(true);

  // Verifizierungsstatus laden
  useEffect(() => {
    if (user) {
      getVerificationStatus()
        .then((status) => {
          setVerificationStatus(status.verificationStatus || null);
        })
        .catch(() => {
          setVerificationStatus(null);
        })
        .finally(() => {
          setLoadingVerification(false);
        });
    } else {
      setLoadingVerification(false);
    }
  }, [user]);

  const handleApply = async () => {
    if (!shift || !user) {
      setError('Bitte melden Sie sich an, um sich zu bewerben');
      return;
    }

    // Prüfen ob verifiziert
    if (verificationStatus !== 'approved') {
      setError('Bitte verifizieren Sie zuerst Ihr Konto, bevor Sie sich auf Schichten bewerben können');
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      await applyToPublicShift(shift.id, { note: note || undefined });
      setNote('');
      onApplied();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Bewerben';
      // Spezielle Behandlung für Verifizierungsfehler
      if (errorMessage.includes('verifizieren')) {
        setError(errorMessage);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsApplying(false);
    }
  };

  const isVerified = verificationStatus === 'approved';
  const canApply = user && isVerified && !loadingVerification;

  if (!shift) return null;

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>
        
        <h2 className={styles.modalTitle}>{shift.title}</h2>
        <p className={styles.modalSubtitle}>bei {shift.tenantName}</p>

        <div className={styles.quickInfoGrid}>
          <div className={styles.quickInfoCard}>
            <span className={styles.quickInfoIcon}>📅</span>
            <div>
              <div className={styles.quickInfoLabel}>Datum</div>
              <div className={styles.quickInfoValue}>{formatDateLong(shift.startsAt)}</div>
            </div>
          </div>
          <div className={styles.quickInfoCard}>
            <span className={styles.quickInfoIcon}>🕐</span>
            <div>
              <div className={styles.quickInfoLabel}>Zeit</div>
              <div className={styles.quickInfoValue}>
                {formatTime(shift.startsAt)} - {formatTime(shift.endsAt)}
              </div>
            </div>
          </div>
          <div className={styles.quickInfoCard}>
            <span className={styles.quickInfoIcon}>📍</span>
            <div>
              <div className={styles.quickInfoLabel}>Ort</div>
              <div className={styles.quickInfoValue}>
                {shift.location.name}
                {shift.location.address && (
                  <span
                    style={{
                      display: 'block',
                      color: 'var(--color-primary)',
                      marginTop: '4px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: 'var(--font-size-sm)'
                    }}
                    onClick={() => openAddressInMaps(shift.location)}
                    title="In Google Maps öffnen"
                  >
                    🗺️ {shift.location.address}
                  </span>
                )}
              </div>
            </div>
          </div>
          {shift.payRate && (
            <div className={styles.quickInfoCard}>
              <span className={styles.quickInfoIcon}>💰</span>
              <div>
                <div className={styles.quickInfoLabel}>Vergütung</div>
                <div className={styles.quickInfoValue}>{shift.payRate.toFixed(2)} €/h</div>
              </div>
            </div>
          )}
        </div>

        {!user && (
          <div className={styles.loginPrompt}>
            <p>Bitte melden Sie sich an, um sich zu bewerben.</p>
            <div className={styles.loginActions}>
              <button
                onClick={() => {
                  onClose();
                  if (onLoginClick) {
                    onLoginClick();
                  } else {
                    // Fallback: zur Login-Seite navigieren
                    window.location.href = '/';
                  }
                }}
                className={styles.loginLink}
              >
                Anmelden / Registrieren
              </button>
            </div>
          </div>
        )}

        {user && (
          <div className={styles.applySection}>
            {!loadingVerification && !isVerified && (
              <div className={styles.verificationWarning}>
                <strong>⚠️ Verifizierung erforderlich</strong>
                <p>Bitte verifizieren Sie zuerst Ihr Konto, bevor Sie sich auf Schichten bewerben können.</p>
                <p className={styles.verificationHint}>
                  Gehen Sie zu Ihrem Dashboard, um Ihren Gewerbeschein hochzuladen.
                </p>
              </div>
            )}

            {isVerified && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nachricht an den Planer (optional)</label>
                  <textarea
                    className={styles.formTextarea}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="z.B. Ich kann auch früher anfangen..."
                    rows={2}
                  />
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <button
                  className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonLarge}`}
                  onClick={handleApply}
                  disabled={isApplying}
                >
                  {isApplying ? 'Wird gesendet...' : '🎯 Jetzt bewerben'}
                </button>
              </>
            )}

            {loadingVerification && (
              <div className={styles.loading}>Lade Verifizierungsstatus...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface FreelancerPoolPageProps {
  onLoginClick?: () => void;
  onPrivacyClick?: () => void;
  onImprintClick?: () => void;
}

export function FreelancerPoolPage({ onLoginClick, onPrivacyClick, onImprintClick }: FreelancerPoolPageProps = {}) {
  // Prüfen ob eingeloggt (wenn keine Props übergeben werden, ist man eingeloggt)
  const isLoggedIn = !onLoginClick && !onPrivacyClick && !onImprintClick;
  
  const [shifts, setShifts] = useState<PublicPoolShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<PublicPoolShift | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getPublicPool({ q: searchQuery || undefined });
      setShifts(data.shifts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  // Nur zukünftige Schichten anzeigen
  const futureShifts = useMemo(() => {
    const now = new Date();
    return shifts.filter((s) => new Date(s.startsAt) > now);
  }, [shifts]);

  // Filtern nach Suchanfrage
  const filteredShifts = useMemo(() => {
    if (!searchQuery) return futureShifts;
    const query = searchQuery.toLowerCase();
    return futureShifts.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.location.name.toLowerCase().includes(query) ||
        s.tenantName.toLowerCase().includes(query)
    );
  }, [futureShifts, searchQuery]);

  // Stats für eingeloggte Ansicht
  const stats = {
    total: futureShifts.length,
    available: futureShifts.filter((s) => s.freeSlots > 0).length,
  };

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      const handleScroll = () => {
        const scrollPosition = window.scrollY;
        setIsScrolled(scrollPosition > 50);
      };

      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [isLoggedIn]);

  return (
    <div className={isLoggedIn ? styles.poolPage : styles.page}>
      {/* Navigation und Hero nur wenn nicht eingeloggt */}
      {!isLoggedIn && (
        <>
          {/* Sticky Navigation */}
          <nav className={`${styles.nav} ${isScrolled ? styles.navScrolled : ''}`} role="navigation" aria-label="Hauptnavigation">
            <div className={styles.navBrand}>
              <img
                src="/logo.png"
                alt="TimeAM Logo"
                className={styles.navLogo}
              />
              <span className={styles.navTitle}>TimeAM</span>
            </div>
            <div className={styles.navLinks}>
              <a href="/" className={styles.navLink}>
                Zur Startseite
              </a>
              {onLoginClick && (
                <button onClick={onLoginClick} className={styles.navCta} aria-label="Zur Anmeldung">
                  Anmelden
                </button>
              )}
            </div>
          </nav>

          {/* Hero Section */}
          <header className={styles.hero} role="banner">
            <div className={styles.heroContent}>
              <span className={styles.heroBadge}>
                <span className={styles.badgeIconInline}>💼</span>
                Freelancer Pool
              </span>
              <h1 className={styles.heroTitle}>
                Finden Sie <span className={styles.highlight}>passende Schichten</span>
                <br />
                von verschiedenen <span className={styles.highlight}>Firmen</span>
              </h1>
              <p className={styles.heroSubtitle}>
                Flexible Arbeitsmöglichkeiten - einfach bewerben und direkt loslegen
              </p>
            </div>

            {/* Animated Background Elements */}
            <div className={styles.heroDecor}>
              <div className={styles.decorCircle1} />
              <div className={styles.decorCircle2} />
              <div className={styles.decorCircle3} />
            </div>
          </header>

          {/* Search Section */}
          <section className={styles.searchSection} aria-labelledby="search-heading">
            <div className={styles.searchContainer}>
              <div className={styles.searchBar}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="🔍 Schicht, Firma oder Ort suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Schichten durchsuchen"
                />
                <button 
                  className={styles.refreshBtn} 
                  onClick={loadShifts} 
                  title="Aktualisieren"
                  aria-label="Schichten aktualisieren"
                >
                  🔄
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Eingeloggte Ansicht - Header */}
      {isLoggedIn && (
        <section className={styles.poolPageSection} aria-labelledby="shifts-heading">
          <div className={styles.poolPageContainer}>
            <div className={styles.poolPageHeader}>
              <div className={styles.poolPageHeaderLeft}>
                <h1 id="shifts-heading" className={styles.poolPageTitle}>
                  Schicht-Pool
                </h1>
                {!loading && futureShifts.length > 0 && (
                  <div className={styles.poolPageStats}>
                    <span className={styles.poolPageStatItem}>
                      <strong>{stats.available}</strong> verfügbar
                    </span>
                  </div>
                )}
              </div>
              <button
                className={styles.poolPageRefreshBtn}
                onClick={loadShifts}
                aria-label="Schichten aktualisieren"
                title="Aktualisieren"
              >
                🔄
              </button>
            </div>

            {/* Filter Bar für eingeloggte Ansicht */}
            {!loading && futureShifts.length > 0 && (
              <div className={styles.poolFilterBar}>
                <input
                  type="text"
                  className={styles.poolSearchInput}
                  placeholder="🔍 Schicht, Firma oder Ort suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Schichten durchsuchen"
                />
                <button 
                  className={styles.poolPageRefreshBtn}
                  onClick={loadShifts} 
                  title="Aktualisieren"
                  aria-label="Schichten aktualisieren"
                >
                  🔄
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Error State */}
      {error && (
        <section className={isLoggedIn ? styles.poolPageSection : styles.errorSection} role="alert">
          <div className={isLoggedIn ? styles.poolPageContainer : styles.errorContainer}>
            <div className={styles.error}>⚠️ {error}</div>
          </div>
        </section>
      )}

      {/* Loading State */}
      {loading && (
        <section className={isLoggedIn ? styles.poolPageSection : styles.loadingSection} aria-live="polite" aria-busy="true">
          <div className={isLoggedIn ? styles.poolPageContainer : styles.loadingContainer}>
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}></div>
              <p>Schichten werden geladen...</p>
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {!loading && filteredShifts.length === 0 && (
        <section className={isLoggedIn ? styles.poolPageSection : styles.emptySection} aria-live="polite">
          <div className={isLoggedIn ? styles.poolPageContainer : styles.emptyContainer}>
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon} aria-hidden="true">🏖️</div>
              <h2 className={styles.emptyTitle}>Keine Schichten verfügbar</h2>
              <p className={styles.emptyText}>
                Aktuell sind keine offenen Schichten ausgeschrieben.<br />
                Schau später nochmal vorbei!
              </p>
              <button 
                className={`${styles.button} ${styles.buttonPrimary}`} 
                onClick={loadShifts}
                aria-label="Schichtenliste aktualisieren"
              >
                🔄 Aktualisieren
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Shifts Section */}
      {!loading && filteredShifts.length > 0 && (
        <section className={isLoggedIn ? styles.poolPageSection : styles.shiftsSection} aria-labelledby="shifts-heading">
          <div className={isLoggedIn ? styles.poolPageContainer : styles.shiftsContainer}>
            {!isLoggedIn && (
              <h2 id="shifts-heading" className={styles.shiftsTitle}>
                Verfügbare Schichten
              </h2>
            )}
            <div className={styles.shiftsGrid}>
              {filteredShifts.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  onClick={() => setSelectedShift(shift)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedShift && (
        <ApplyModal
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onApplied={loadShifts}
          onLoginClick={onLoginClick}
        />
      )}

      {/* Footer nur wenn nicht eingeloggt */}
      {!isLoggedIn && (
        <footer className={styles.footer} role="contentinfo">
          <div className={styles.footerContent}>
            <div className={styles.footerBrand}>
              <img 
                src="/logo.png" 
                alt="TimeAM Logo" 
                className={styles.footerLogo}
              />
              <span className={styles.footerTitle}>TimeAM</span>
            </div>
            
            <div className={styles.footerLinks}>
              {onPrivacyClick && (
                <button onClick={onPrivacyClick} className={styles.footerLink}>
                  Datenschutz
                </button>
              )}
              {onPrivacyClick && onImprintClick && (
                <span className={styles.footerDivider}>|</span>
              )}
              {onImprintClick && (
                <button onClick={onImprintClick} className={styles.footerLink}>
                  Impressum
                </button>
              )}
            </div>
            
            <p className={styles.footerCopyright}>
              © {new Date().getFullYear()} TimeAM. Alle Rechte vorbehalten.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}

