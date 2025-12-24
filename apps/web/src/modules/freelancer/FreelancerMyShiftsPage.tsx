/**
 * Freelancer My Shifts Page
 *
 * Übersicht aller angenommenen Schichten für Freelancer.
 */

import { useState, useEffect, useCallback } from 'react';
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

  if (diffMs < 0) {
    return 'Vergangen';
  }
  if (diffDays === 0) {
    if (diffHours <= 1) {
      return 'In Kürze';
    }
    return `In ${diffHours} Stunden`;
  }
  if (diffDays === 1) {
    return 'Morgen';
  }
  if (diffDays < 7) {
    return `In ${diffDays} Tagen`;
  }
  return `In ${Math.floor(diffDays / 7)} Wochen`;
}

function isUpcoming(isoString: string): boolean {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = date.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours > 0 && diffHours <= 24;
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
  const timeUntil = getTimeUntil(shift.startsAt);

  return (
    <div 
      className={`${styles.card} ${upcoming ? styles.cardUpcoming : ''}`} 
      onClick={onClick}
    >
      {upcoming && (
        <div className={styles.upcomingBadge}>
          ⏰ Bald
        </div>
      )}
      
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{shift.title}</h3>
        <span className={styles.timeUntil}>{timeUntil}</span>
      </div>

      <div className={styles.cardMeta}>
        <div className={styles.cardMetaItem}>
          <span className={styles.cardMetaIcon}>🏢</span>
          {shift.tenantName}
        </div>
        <div className={styles.cardMetaItem}>
          <span className={styles.cardMetaIcon}>📍</span>
          {shift.location.name}
        </div>
        <div className={styles.cardMetaItem}>
          <span className={styles.cardMetaIcon}>📅</span>
          {formatDateShort(shift.startsAt)}
        </div>
        <div className={styles.cardMetaItem}>
          <span className={styles.cardMetaIcon}>🕐</span>
          {formatTime(shift.startsAt)} - {formatTime(shift.endsAt)}
        </div>
        {shift.payRate && (
          <div className={styles.cardMetaItem}>
            <span className={styles.cardMetaIcon}>💰</span>
            {shift.payRate.toFixed(2)} €/h
          </div>
        )}
      </div>

      {/* Kollegen */}
      {shift.colleagues && shift.colleagues.length > 0 && (
        <div className={styles.cardColleagues}>
          <span className={styles.cardMetaIcon}>👥</span>
          <span>
            Mit: {shift.colleagues.map((c) => c.displayName).join(', ')}
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

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{shift.title}</h2>
          <button className={styles.modalClose} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>Firma</h3>
            <p className={styles.modalText}>{shift.tenantName}</p>
          </div>

          <div className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>Standort</h3>
            <p className={styles.modalText}>{shift.location.name}</p>
            {shift.location.address && (
              <p className={styles.modalText}>{shift.location.address}</p>
            )}
            {(shift.location.coordinates || shift.location.address) && (
              <button className={styles.mapButton} onClick={handleMapClick}>
                📍 In Karten öffnen
              </button>
            )}
          </div>

          <div className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>Zeit</h3>
            <p className={styles.modalText}>
              {formatDate(shift.startsAt)}
            </p>
            <p className={styles.modalText}>
              {formatTime(shift.startsAt)} - {formatTime(shift.endsAt)}
            </p>
          </div>

          {shift.payRate && (
            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Vergütung</h3>
              <p className={styles.modalText}>
                {shift.payRate.toFixed(2)} €/h
              </p>
            </div>
          )}

          {shift.colleagues && shift.colleagues.length > 0 && (
            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Kollegen</h3>
              <div className={styles.colleaguesList}>
                {shift.colleagues.map((colleague) => (
                  <div key={colleague.uid} className={styles.colleagueItem}>
                    {colleague.displayName}
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

  const upcomingShifts = shifts.filter((s) => new Date(s.startsAt) > new Date());
  const pastShifts = shifts.filter((s) => new Date(s.startsAt) <= new Date());

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
        <h1 className={styles.title}>Meine Schichten</h1>
        <div className={styles.headerActions}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className={styles.toggleInput}
            />
            <span>Vergangene anzeigen</span>
          </label>
        </div>
      </div>

      {shifts.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Du hast noch keine angenommenen Schichten.</p>
          <p className={styles.emptyHint}>
            Bewirb dich auf Schichten im Pool, um hier deine zugewiesenen Schichten zu sehen.
          </p>
        </div>
      ) : (
        <>
          {upcomingShifts.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Kommende Schichten ({upcomingShifts.length})</h2>
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
              <h2 className={styles.sectionTitle}>Vergangene Schichten ({pastShifts.length})</h2>
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

