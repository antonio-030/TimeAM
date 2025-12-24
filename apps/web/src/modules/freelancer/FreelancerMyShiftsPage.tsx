/**
 * Freelancer My Shifts Page
 *
 * Übersicht aller angenommenen Schichten für Freelancer.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getFreelancerShifts, type FreelancerShift } from './api';
import { openAddressInMaps } from '../shift-pool/mapsUtils';
import styles from './FreelancerMyShiftsPage.module.css';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(isoString: string): string {
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

function formatDateShort(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function getTimeUntil(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMs < 0) {
    return 'Vergangen';
  }
  if (diffDays === 0) {
    if (diffMinutes < 60) {
      return diffMinutes <= 1 ? 'Jetzt' : `In ${diffMinutes} Min`;
    }
    return diffHours === 1 ? 'In 1 Stunde' : `In ${diffHours} Stunden`;
  }
  if (diffDays === 1) {
    return 'Morgen';
  }
  if (diffDays < 7) {
    return `In ${diffDays} Tagen`;
  }
  const weeks = Math.floor(diffDays / 7);
  return weeks === 1 ? 'In 1 Woche' : `In ${weeks} Wochen`;
}

function isUpcoming(isoString: string): boolean {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = date.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours > 0 && diffHours <= 24;
}

function isToday(isoString: string): boolean {
  const now = new Date();
  const date = new Date(isoString);
  return date.toDateString() === now.toDateString();
}

function isThisWeek(isoString: string): boolean {
  const now = new Date();
  const date = new Date(isoString);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return date >= weekStart && date < weekEnd && !isToday(isoString);
}

// =============================================================================
// Components
// =============================================================================

interface ShiftCardProps {
  shift: FreelancerShift;
  onClick: () => void;
}

function ShiftCard({ shift, onClick }: ShiftCardProps) {
  const upcoming = isUpcoming(shift.startsAt);
  const today = isToday(shift.startsAt);
  const timeUntil = getTimeUntil(shift.startsAt);
  const duration = Math.round((new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()) / (1000 * 60 * 60 * 100)) / 10;

  return (
    <div 
      className={`${styles.card} ${upcoming ? styles.cardUpcoming : ''} ${today ? styles.cardToday : ''}`} 
      onClick={onClick}
    >
      {upcoming && (
        <div className={styles.upcomingBadge}>
          {today ? '🔴 Heute' : '⏰ Bald'}
        </div>
      )}
      
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleWrapper}>
          <h3 className={styles.cardTitle}>{shift.title}</h3>
          <div className={styles.tenantBadge}>{shift.tenantName}</div>
        </div>
        <span className={`${styles.timeUntil} ${today ? styles.timeUntilToday : ''}`}>
          {timeUntil}
        </span>
      </div>

      <div className={styles.cardMeta}>
        <div className={styles.cardMetaRow}>
          <div className={styles.cardMetaItem}>
            <span className={styles.cardMetaIcon}>📍</span>
            <span className={styles.cardMetaText}>{shift.location.name}</span>
          </div>
        </div>
        
        <div className={styles.cardMetaRow}>
          <div className={styles.cardMetaItem}>
            <span className={styles.cardMetaIcon}>📅</span>
            <span className={styles.cardMetaText}>
              {formatDateShort(shift.startsAt)}
            </span>
          </div>
          <div className={styles.cardMetaItem}>
            <span className={styles.cardMetaIcon}>🕐</span>
            <span className={styles.cardMetaText}>
              {formatTime(shift.startsAt)} - {formatTime(shift.endsAt)}
            </span>
          </div>
        </div>

        {shift.payRate && (
          <div className={styles.cardMetaRow}>
            <div className={styles.cardMetaItem}>
              <span className={styles.cardMetaIcon}>💰</span>
              <span className={styles.cardMetaText}>
                {shift.payRate.toFixed(2)} €/h
                {duration > 0 && (
                  <span className={styles.duration}> • {duration}h</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Kollegen */}
      {shift.colleagues && shift.colleagues.length > 0 && (
        <div className={styles.cardColleagues}>
          <span className={styles.cardMetaIcon}>👥</span>
          <span className={styles.colleaguesText}>
            {shift.colleagues.length === 1 
              ? `Mit ${shift.colleagues[0].displayName}`
              : `Mit ${shift.colleagues.length} Kollegen`}
          </span>
        </div>
      )}
    </div>
  );
}

interface ShiftDetailModalProps {
  shift: FreelancerShift;
  onClose: () => void;
}

function ShiftDetailModal({ shift, onClose }: ShiftDetailModalProps) {
  const handleMapClick = () => {
    if (shift.location.coordinates) {
      openAddressInMaps(shift.location.coordinates.lat, shift.location.coordinates.lng);
    } else if (shift.location.address) {
      openAddressInMaps(shift.location.address);
    }
  };

  const duration = Math.round((new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()) / (1000 * 60 * 60 * 100)) / 10;
  const totalPay = shift.payRate && duration ? (shift.payRate * duration).toFixed(2) : null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <h2 className={styles.modalTitle}>{shift.title}</h2>
            <div className={styles.modalBadge}>{shift.tenantName}</div>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.modalInfoGrid}>
            <div className={styles.modalInfoItem}>
              <div className={styles.modalInfoIcon}>📍</div>
              <div className={styles.modalInfoContent}>
                <div className={styles.modalInfoLabel}>Standort</div>
                <div className={styles.modalInfoValue}>{shift.location.name}</div>
                {shift.location.address && (
                  <div className={styles.modalInfoSubtext}>{shift.location.address}</div>
                )}
                {(shift.location.coordinates || shift.location.address) && (
                  <button className={styles.mapButton} onClick={handleMapClick}>
                    🗺️ In Karten öffnen
                  </button>
                )}
              </div>
            </div>

            <div className={styles.modalInfoItem}>
              <div className={styles.modalInfoIcon}>📅</div>
              <div className={styles.modalInfoContent}>
                <div className={styles.modalInfoLabel}>Datum</div>
                <div className={styles.modalInfoValue}>{formatDate(shift.startsAt)}</div>
              </div>
            </div>

            <div className={styles.modalInfoItem}>
              <div className={styles.modalInfoIcon}>🕐</div>
              <div className={styles.modalInfoContent}>
                <div className={styles.modalInfoLabel}>Uhrzeit</div>
                <div className={styles.modalInfoValue}>
                  {formatTime(shift.startsAt)} - {formatTime(shift.endsAt)}
                </div>
                {duration > 0 && (
                  <div className={styles.modalInfoSubtext}>Dauer: {duration} Stunden</div>
                )}
              </div>
            </div>

            {shift.payRate && (
              <div className={styles.modalInfoItem}>
                <div className={styles.modalInfoIcon}>💰</div>
                <div className={styles.modalInfoContent}>
                  <div className={styles.modalInfoLabel}>Vergütung</div>
                  <div className={styles.modalInfoValue}>
                    {shift.payRate.toFixed(2)} €/h
                  </div>
                  {totalPay && (
                    <div className={styles.modalInfoSubtext}>
                      Gesamt: {totalPay} €
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {shift.colleagues && shift.colleagues.length > 0 && (
            <div className={styles.modalColleaguesSection}>
              <h3 className={styles.modalColleaguesTitle}>
                👥 Kollegen ({shift.colleagues.length})
              </h3>
              <div className={styles.colleaguesList}>
                {shift.colleagues.map((colleague) => (
                  <div key={colleague.uid} className={styles.colleagueItem}>
                    <div className={styles.colleagueAvatar}>
                      {colleague.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.colleagueName}>{colleague.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function FreelancerMyShiftsPage() {
  const [shifts, setShifts] = useState<FreelancerShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<FreelancerShift | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getFreelancerShifts(showCompleted);
      setShifts(data.shifts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [showCompleted]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  // Filter und gruppiere Schichten
  const filteredShifts = useMemo(() => {
    let filtered = shifts;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          s.location.name.toLowerCase().includes(query) ||
          s.tenantName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [shifts, searchQuery]);

  const todayShifts = useMemo(
    () => filteredShifts.filter((s) => isToday(s.startsAt) && new Date(s.startsAt) > new Date()),
    [filteredShifts]
  );

  const thisWeekShifts = useMemo(
    () => filteredShifts.filter((s) => isThisWeek(s.startsAt) && new Date(s.startsAt) > new Date()),
    [filteredShifts]
  );

  const upcomingShifts = useMemo(
    () => filteredShifts.filter((s) => {
      const date = new Date(s.startsAt);
      return date > new Date() && !isToday(s.startsAt) && !isThisWeek(s.startsAt);
    }),
    [filteredShifts]
  );

  const pastShifts = useMemo(
    () => filteredShifts.filter((s) => new Date(s.startsAt) <= new Date()),
    [filteredShifts]
  );

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Schichten werden geladen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>{error}</p>
        <button onClick={loadShifts} className={styles.retryButton}>
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <span className={styles.titleIcon}>📋</span>
            Meine Schichten
          </h1>
          {shifts.length > 0 && (
            <div className={styles.stats}>
              <span className={styles.statItem}>
                <span className={styles.statNumber}>{filteredShifts.length}</span>
                <span className={styles.statLabel}>Gesamt</span>
              </span>
              {todayShifts.length > 0 && (
                <span className={styles.statItem}>
                  <span className={styles.statNumber}>{todayShifts.length}</span>
                  <span className={styles.statLabel}>Heute</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          {shifts.length > 0 && (
            <div className={styles.searchWrapper}>
              <input
                type="text"
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              <span className={styles.searchIcon}>🔍</span>
            </div>
          )}
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className={styles.toggleInput}
            />
            <span>Vergangene anzeigen</span>
          </label>
          <button
            className={styles.refreshButton}
            onClick={loadShifts}
            title="Aktualisieren"
            disabled={loading}
          >
            🔄
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p>Schichten werden geladen...</p>
        </div>
      ) : error ? (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚠️</div>
          <p className={styles.errorText}>{error}</p>
          <button onClick={loadShifts} className={styles.retryButton}>
            Erneut versuchen
          </button>
        </div>
      ) : filteredShifts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <h2 className={styles.emptyTitle}>
            {searchQuery ? 'Keine Ergebnisse gefunden' : 'Noch keine Schichten'}
          </h2>
          <p className={styles.emptyText}>
            {searchQuery
              ? 'Versuche es mit anderen Suchbegriffen.'
              : 'Bewirb dich auf Schichten im Pool, um hier deine zugewiesenen Schichten zu sehen.'}
          </p>
          {searchQuery && (
            <button
              className={styles.clearSearchButton}
              onClick={() => setSearchQuery('')}
            >
              Suche zurücksetzen
            </button>
          )}
        </div>
      ) : (
        <>
          {todayShifts.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>🔴</span>
                  Heute ({todayShifts.length})
                </h2>
              </div>
              <div className={styles.shiftsGrid}>
                {todayShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => setSelectedShift(shift)}
                  />
                ))}
              </div>
            </section>
          )}

          {thisWeekShifts.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>📅</span>
                  Diese Woche ({thisWeekShifts.length})
                </h2>
              </div>
              <div className={styles.shiftsGrid}>
                {thisWeekShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => setSelectedShift(shift)}
                  />
                ))}
              </div>
            </section>
          )}

          {upcomingShifts.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>📆</span>
                  Kommende Schichten ({upcomingShifts.length})
                </h2>
              </div>
              <div className={styles.shiftsGrid}>
                {upcomingShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => setSelectedShift(shift)}
                  />
                ))}
              </div>
            </section>
          )}

          {showCompleted && pastShifts.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>📜</span>
                  Vergangene Schichten ({pastShifts.length})
                </h2>
              </div>
              <div className={styles.shiftsGrid}>
                {pastShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => setSelectedShift(shift)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {selectedShift && (
        <ShiftDetailModal
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
        />
      )}
    </div>
  );
}

