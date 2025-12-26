/**
 * Public Freelancer Pool Page
 *
 * Öffentliche Seite für die Suche nach verfügbaren Schichten.
 * Modern gestaltet mit Landing Page Design.
 */

import { useState, useMemo } from 'react';
import { usePool, useShiftDetail } from './hooks';
import { APPLICATION_STATUS, MEMBER_ROLES, type PoolShift, type ApplicationStatus } from '@timeam/shared';
import { useTenant } from '../../core/tenant';
import { openAddressInMaps } from './mapsUtils';
import styles from './ShiftPool.module.css';

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

function formatDateTime(isoString: string): string {
  return `${formatDateLong(isoString)} ${formatTime(isoString)}`;
}

function getStatusBadgeClass(status: ApplicationStatus): string {
  switch (status) {
    case APPLICATION_STATUS.PENDING:
      return styles.statusPending;
    case APPLICATION_STATUS.ACCEPTED:
      return styles.statusAccepted;
    case APPLICATION_STATUS.REJECTED:
      return styles.statusRejected;
    case APPLICATION_STATUS.WITHDRAWN:
      return styles.statusWithdrawn;
    default:
      return '';
  }
}

function getStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case APPLICATION_STATUS.PENDING:
      return 'Ausstehend';
    case APPLICATION_STATUS.ACCEPTED:
      return 'Angenommen';
    case APPLICATION_STATUS.REJECTED:
      return 'Abgelehnt';
    case APPLICATION_STATUS.WITHDRAWN:
      return 'Zurückgezogen';
    default:
      return status;
  }
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

function getDuration(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const diffMs = end.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

// =============================================================================
// Filter & Sort Types
// =============================================================================

type SortOption = 'date-asc' | 'date-desc' | 'pay-desc' | 'slots-desc';
type AvailabilityFilter = 'all' | 'available' | 'applied';

// =============================================================================
// Components
// =============================================================================

interface PoolShiftCardProps {
  shift: PoolShift;
  onClick: () => void;
  showPayRate?: boolean;
}

function PoolShiftCard({ shift, onClick, showPayRate = false }: PoolShiftCardProps) {
  const hasSlots = shift.freeSlots > 0;
  const relativeDate = getRelativeDate(shift.startsAt);
  const duration = getDuration(shift.startsAt, shift.endsAt);
  
  // Status-Indikatoren
  const isApplied = shift.myApplicationStatus && shift.myApplicationStatus !== APPLICATION_STATUS.WITHDRAWN;
  const isAccepted = shift.myApplicationStatus === APPLICATION_STATUS.ACCEPTED;
  const isPending = shift.myApplicationStatus === APPLICATION_STATUS.PENDING;

  return (
    <div 
      className={`${styles.poolCard} ${!hasSlots ? styles.poolCardFull : ''} ${isAccepted ? styles.poolCardAccepted : ''} ${isPending ? styles.poolCardPending : ''}`}
      onClick={onClick}
    >
      {/* Urgency Badge */}
      {relativeDate.isUrgent && (
        <div className={styles.urgentBadge}>⚡ {relativeDate.label}</div>
      )}
      
      {/* Status Badge (eigene Bewerbung) */}
      {isApplied && (
        <div className={`${styles.myStatusBadge} ${getStatusBadgeClass(shift.myApplicationStatus!)}`}>
          {isAccepted ? '✓ Dabei' : isPending ? '⏳ Beworben' : getStatusLabel(shift.myApplicationStatus!)}
        </div>
      )}

      {/* Header */}
      <div className={styles.poolCardHeader}>
        <h3 className={styles.poolCardTitle}>{shift.title}</h3>
        {showPayRate && shift.payRate && (
          <span className={styles.poolCardPay}>
            {shift.payRate.toFixed(0)}€<small>/h</small>
          </span>
        )}
      </div>

      {/* Main Info */}
      <div className={styles.poolCardBody}>
        <div className={styles.poolCardInfo}>
          <div className={styles.poolCardInfoRow}>
            <span className={styles.poolCardIcon}>📍</span>
            <span>{shift.location.name}</span>
          </div>
          <div className={styles.poolCardInfoRow}>
            <span className={styles.poolCardIcon}>📅</span>
            <span className={relativeDate.isSoon ? styles.soonDate : ''}>
              {relativeDate.label}
            </span>
            <span className={styles.poolCardTime}>
              {formatTime(shift.startsAt)} - {formatTime(shift.endsAt)}
            </span>
          </div>
          <div className={styles.poolCardInfoRow}>
            <span className={styles.poolCardIcon}>⏱️</span>
            <span>{duration}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.poolCardFooter}>
        <div className={styles.poolCardSlots}>
          <div className={styles.slotsIndicator}>
            {Array.from({ length: shift.requiredCount }).map((_, i) => (
              <span 
                key={i} 
                className={`${styles.slotDot} ${i < shift.filledCount ? styles.slotDotFilled : ''}`}
              />
            ))}
          </div>
          <span className={hasSlots ? styles.slotsTextAvailable : styles.slotsTextFull}>
            {hasSlots ? `${shift.freeSlots} frei` : 'Voll'}
          </span>
        </div>
        
        {!isApplied && hasSlots && (
          <button className={styles.applyQuickBtn} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            Bewerben →
          </button>
        )}
        {isApplied && (
          <button className={styles.detailsBtn} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            Details
          </button>
        )}
        {!hasSlots && !isApplied && (
          <span className={styles.fullLabel}>Ausgebucht</span>
        )}
      </div>
    </div>
  );
}

interface ShiftDetailModalProps {
  shiftId: string;
  onClose: () => void;
}

function ShiftDetailModal({ shiftId, onClose }: ShiftDetailModalProps) {
  const { shift, loading, error, apply, withdraw } = useShiftDetail(shiftId);
  const { role, isFreelancer } = useTenant();
  const [note, setNote] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Stundenlohn nur für Freelancer, Admins und Manager anzeigen
  const showPayRate = isFreelancer || role === MEMBER_ROLES.ADMIN || role === MEMBER_ROLES.MANAGER;

  const handleApply = async () => {
    setIsApplying(true);
    setApplyError(null);

    try {
      await apply(note || undefined);
      setNote('');
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Fehler beim Bewerben');
    } finally {
      setIsApplying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!confirm('Bewerbung wirklich zurückziehen?')) {
      return;
    }
    setIsWithdrawing(true);
    setApplyError(null);

    try {
      await withdraw();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Fehler beim Zurückziehen');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Kann bewerben wenn: Plätze frei UND (kein Status ODER Status ist WITHDRAWN)
  const canApply =
    shift &&
    shift.freeSlots > 0 &&
    (!shift.myApplicationStatus || shift.myApplicationStatus === APPLICATION_STATUS.WITHDRAWN);

  const hasApplied = shift?.myApplicationStatus && shift.myApplicationStatus !== APPLICATION_STATUS.WITHDRAWN;
  const canWithdraw = shift?.myApplicationStatus === APPLICATION_STATUS.PENDING;
  const isAccepted = shift?.myApplicationStatus === APPLICATION_STATUS.ACCEPTED;

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>
        
        {loading && <div className={styles.loading}>Laden...</div>}
        {error && <div className={styles.error}>{error}</div>}

        {shift && (
          <>
            {/* Status Banner */}
            {hasApplied && (
              <div className={`${styles.statusBanner} ${isAccepted ? styles.statusBannerAccepted : styles.statusBannerPending}`}>
                {isAccepted ? (
                  <>✅ Du bist für diese Schicht eingeteilt!</>
                ) : (
                  <>⏳ Deine Bewerbung wird geprüft</>
                )}
              </div>
            )}

            <h2 className={styles.modalTitle}>{shift.title}</h2>

            {/* Quick Info Cards */}
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
              {showPayRate && shift.payRate && (
                <div className={styles.quickInfoCard}>
                  <span className={styles.quickInfoIcon}>💰</span>
                  <div>
                    <div className={styles.quickInfoLabel}>Vergütung</div>
                    <div className={styles.quickInfoValue}>{shift.payRate.toFixed(2)} €/h</div>
                  </div>
                </div>
              )}
            </div>

            {/* Zusätzliche Details */}
            <div className={styles.detailSection}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Freie Plätze</span>
                <span className={styles.detailValue}>
                  <strong>{shift.freeSlots}</strong> von {shift.requiredCount}
                </span>
              </div>
              {shift.applyDeadline && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Bewerbungsfrist</span>
                  <span className={styles.detailValue}>{formatDateTime(shift.applyDeadline)}</span>
                </div>
              )}
              {shift.requirements && shift.requirements.length > 0 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Anforderungen</span>
                  <span className={styles.detailValue}>{shift.requirements.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Kollegen Anzeige */}
            {shift.assignees && shift.assignees.length > 0 && (
              <div className={styles.colleaguesSection}>
                <h4 className={styles.colleaguesTitle}>
                  👥 Deine Kollegen ({shift.assignees.length})
                </h4>
                <div className={styles.colleaguesList}>
                  {shift.assignees.map((assignee) => (
                    <div key={assignee.uid} className={styles.colleagueItem}>
                      <span className={styles.colleagueAvatar}>
                        {assignee.displayName.charAt(0).toUpperCase()}
                      </span>
                      <span className={styles.colleagueName}>
                        {assignee.displayName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bewerbungs-Aktionen */}
            {hasApplied && canWithdraw && (
              <div className={styles.actionSection}>
                <button
                  className={`${styles.button} ${styles.buttonDanger}`}
                  onClick={handleWithdraw}
                  disabled={isWithdrawing}
                >
                  {isWithdrawing ? 'Wird zurückgezogen...' : '↩️ Bewerbung zurückziehen'}
                </button>
              </div>
            )}

            {canApply && (
              <div className={styles.applySection}>
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

                {applyError && <div className={styles.error}>{applyError}</div>}

                <button
                  className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonLarge}`}
                  onClick={handleApply}
                  disabled={isApplying}
                >
                  {isApplying ? 'Wird gesendet...' : '🎯 Jetzt bewerben'}
                </button>
              </div>
            )}

            {!canApply && !hasApplied && shift.freeSlots === 0 && (
              <div className={styles.fullMessage}>
                😕 Diese Schicht ist leider bereits ausgebucht.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface PoolPageProps {
  onLoginClick?: () => void;
  onPrivacyClick?: () => void;
  onImprintClick?: () => void;
}

export function PoolPage({ onLoginClick, onPrivacyClick, onImprintClick }: PoolPageProps = {}) {
  // Prüfen ob eingeloggt (wenn keine Props übergeben werden, ist man eingeloggt)
  const isLoggedIn = !onLoginClick && !onPrivacyClick && !onImprintClick;
  const { shifts, loading, error, refresh } = usePool();
  const { role, isFreelancer } = useTenant();
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date-asc');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');

  // Stundenlohn nur für Freelancer, Admins und Manager anzeigen
  const showPayRate = useMemo(() => {
    if (isFreelancer) return true;
    if (role === MEMBER_ROLES.ADMIN || role === MEMBER_ROLES.MANAGER) return true;
    return false;
  }, [isFreelancer, role]);

  // Nur zukünftige Schichten anzeigen (nicht in der Vergangenheit)
  const futureShifts = useMemo(() => {
    const now = new Date();
    return shifts.filter((s) => new Date(s.startsAt) > now);
  }, [shifts]);

  // Filtern und Sortieren
  const filteredAndSortedShifts = useMemo(() => {
    let result = [...futureShifts];

    // Textsuche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          s.location.name.toLowerCase().includes(query)
      );
    }

    // Verfügbarkeits-Filter
    if (availabilityFilter === 'available') {
      result = result.filter((s) => s.freeSlots > 0 && !s.myApplicationStatus);
    } else if (availabilityFilter === 'applied') {
      result = result.filter((s) => s.myApplicationStatus && s.myApplicationStatus !== APPLICATION_STATUS.WITHDRAWN);
    }

    // Sortieren
    result.sort((a, b) => {
      switch (sortOption) {
        case 'date-asc':
          return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
        case 'date-desc':
          return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
        case 'pay-desc':
          return (b.payRate || 0) - (a.payRate || 0);
        case 'slots-desc':
          return b.freeSlots - a.freeSlots;
        default:
          return 0;
      }
    });

    return result;
  }, [futureShifts, searchQuery, sortOption, availabilityFilter]);

  // Stats (nur zukünftige Schichten)
  const stats = {
    total: futureShifts.length,
    available: futureShifts.filter((s) => s.freeSlots > 0).length,
    applied: futureShifts.filter((s) => s.myApplicationStatus && s.myApplicationStatus !== APPLICATION_STATUS.WITHDRAWN).length,
    accepted: futureShifts.filter((s) => s.myApplicationStatus === APPLICATION_STATUS.ACCEPTED).length,
  };

  return (
    <div className={isLoggedIn ? styles.poolPage : styles.publicPoolPage}>
      {/* Header nur wenn nicht eingeloggt */}
      {!isLoggedIn && (
        <section className={styles.publicShiftsSection} aria-labelledby="shifts-heading">
          <div className={styles.publicShiftsContainer}>
            <div className={styles.publicShiftsHeader}>
              <div className={styles.publicShiftsHeaderLeft}>
                <h2 id="shifts-heading" className={styles.publicShiftsTitle}>
                  Verfügbare Schichten
                </h2>
                {!loading && futureShifts.length > 0 && (
                  <div className={styles.compactStats}>
                    <span className={styles.compactStatItem}>
                      <strong>{stats.available}</strong> verfügbar
                    </span>
                    {stats.applied > 0 && (
                      <>
                        <span className={styles.compactStatDivider}>•</span>
                        <span className={styles.compactStatItem}>
                          <strong>{stats.applied}</strong> beworben
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                className={styles.publicRefreshBtn}
                onClick={refresh}
                aria-label="Schichten aktualisieren"
                title="Aktualisieren"
              >
                🔄
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Schichten Section */}
      <section className={isLoggedIn ? styles.poolPageSection : styles.publicShiftsSection} aria-labelledby="shifts-heading">
        <div className={isLoggedIn ? styles.poolPageContainer : styles.publicShiftsContainer}>
          {/* Header für eingeloggte Ansicht */}
          {isLoggedIn && (
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
                    {stats.applied > 0 && (
                      <>
                        <span className={styles.poolPageStatDivider}>•</span>
                        <span className={styles.poolPageStatItem}>
                          <strong>{stats.applied}</strong> beworben
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                className={styles.poolPageRefreshBtn}
                onClick={refresh}
                aria-label="Schichten aktualisieren"
                title="Aktualisieren"
              >
                🔄
              </button>
            </div>
          )}

          {/* Filter Bar */}
          {!loading && futureShifts.length > 0 && (
            <div className={styles.poolFilterBar}>
          <input
            type="text"
            className={styles.poolSearchInput}
            placeholder="🔍 Schicht oder Ort suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          <div className={styles.poolFilters}>
            <select
              className={styles.poolSelect}
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as AvailabilityFilter)}
            >
              <option value="all">Alle Schichten</option>
              <option value="available">🟢 Noch frei</option>
              <option value="applied">📋 Meine Bewerbungen</option>
            </select>

            <select
              className={styles.poolSelect}
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
            >
              <option value="date-asc">📅 Datum (nächste)</option>
              <option value="date-desc">📅 Datum (späteste)</option>
              <option value="pay-desc">💰 Vergütung</option>
              <option value="slots-desc">👥 Freie Plätze</option>
            </select>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {loading && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <p>Schichten werden geladen...</p>
        </div>
      )}

      {!loading && futureShifts.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🏖️</div>
          <h2 className={styles.emptyTitle}>Keine Schichten verfügbar</h2>
          <p className={styles.emptyText}>
            Aktuell sind keine offenen Schichten ausgeschrieben.<br />
            Schau später nochmal vorbei!
          </p>
          <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={refresh}>
            🔄 Aktualisieren
          </button>
        </div>
      )}

      {!loading && futureShifts.length > 0 && filteredAndSortedShifts.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p className={styles.emptyText}>Keine Schichten gefunden</p>
          <button
            className={`${styles.button} ${styles.buttonGhost}`}
            onClick={() => {
              setSearchQuery('');
              setAvailabilityFilter('all');
            }}
          >
            Filter zurücksetzen
          </button>
        </div>
      )}

      {/* Schichten nach Verfügbarkeit gruppiert */}
      {!loading && filteredAndSortedShifts.length > 0 && (
        <>
          {/* Verfügbare Schichten */}
          {(() => {
            const availableShifts = filteredAndSortedShifts.filter((s) => s.freeSlots > 0);
            const fullShifts = filteredAndSortedShifts.filter((s) => s.freeSlots === 0);
            
            return (
              <>
                {availableShifts.length > 0 && (
                  <div className={styles.poolSection}>
                    <div className={styles.poolSectionHeader}>
                      <span className={styles.poolSectionIcon}>🟢</span>
                      <h2 className={styles.poolSectionTitle}>Verfügbare Schichten</h2>
                      <span className={styles.poolSectionCount}>{availableShifts.length}</span>
                    </div>
                    <div className={styles.poolGrid}>
                      {availableShifts.map((shift) => (
                        <PoolShiftCard
                          key={shift.id}
                          shift={shift}
                          onClick={() => setSelectedShiftId(shift.id)}
                          showPayRate={showPayRate}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {fullShifts.length > 0 && (
                  <div className={styles.poolSection}>
                    <div className={styles.poolSectionHeader}>
                      <span className={styles.poolSectionIcon}>🔴</span>
                      <h2 className={styles.poolSectionTitle}>Ausgebucht</h2>
                      <span className={styles.poolSectionCount}>{fullShifts.length}</span>
                    </div>
                    <div className={styles.poolGrid}>
                      {fullShifts.map((shift) => (
                        <PoolShiftCard
                          key={shift.id}
                          shift={shift}
                          onClick={() => setSelectedShiftId(shift.id)}
                          showPayRate={showPayRate}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          
          <div className={styles.resultCount}>
            {filteredAndSortedShifts.length} von {futureShifts.length} Schichten
          </div>
        </>
      )}

      {selectedShiftId && (
        <ShiftDetailModal
          shiftId={selectedShiftId}
          onClose={() => {
            setSelectedShiftId(null);
            refresh();
          }}
        />
      )}
        </div>
      </section>
    </div>
  );
}
