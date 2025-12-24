/**
 * My Shifts Page
 *
 * Übersicht der eigenen zugewiesenen Schichten.
 */

import { useState } from 'react';
import { useMyShifts } from './hooks';
import { useAuth } from '../../core/auth';
import { useTenant } from '../../core/tenant';
import { completeShift } from './api';
import { ShiftTimeEntryList } from './ShiftTimeEntryList';
import { ShiftDocumentList } from './ShiftDocumentList';
import { openAddressInMaps } from './mapsUtils';
import type { MyShift } from './api';
import styles from './ShiftPool.module.css';

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
  shift: MyShift;
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
  shift: MyShift;
  onClose: () => void;
  onComplete: () => void;
  isCrewLeader: boolean;
  isCompleted: boolean;
}

function ShiftDetailModal({ shift, onClose, onComplete, isCrewLeader, isCompleted }: ShiftDetailModalProps) {
  const { role } = useTenant();
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'time' | 'documents'>('details');

  const handleComplete = async () => {
    if (!confirm('Möchtest du diese Schicht wirklich beenden?')) {
      return;
    }

    setCompleting(true);
    setCompleteError(null);

    try {
      await completeShift(shift.id);
      onComplete();
      onClose();
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Fehler beim Beenden der Schicht');
    } finally {
      setCompleting(false);
    }
  };

  const canComplete = isCrewLeader && !isCompleted && new Date(shift.startsAt) <= new Date();
  const canEditTime = isCrewLeader || role === 'admin' || role === 'manager';
  const canViewDocuments = isCrewLeader || role === 'admin' || role === 'manager';
  const canUploadDocuments = true; // Alle zugewiesenen Mitarbeiter können hochladen

  // Alle zugewiesenen UIDs sammeln (inkl. aktueller User)
  const { user } = useAuth();
  const assignedMemberUids = [
    ...(user?.uid ? [user.uid] : []),
    ...shift.colleagues.map((c) => c.uid),
  ];

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <h2 className={styles.modalTitle}>{shift.title}</h2>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'details' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('details')}
          >
            📋 Details
          </button>
          {canEditTime && (
            <button
              className={`${styles.tab} ${activeTab === 'time' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('time')}
            >
              ⏱️ Zeiterfassung
            </button>
          )}
          <button
            className={`${styles.tab} ${activeTab === 'documents' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            📎 Dokumente
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <>
            <div className={styles.detailInfo}>
          <div className={styles.detailInfoItem}>
            <span className={styles.detailInfoLabel}>Standort</span>
            <span className={styles.detailInfoValue}>
              {shift.location.name}
              {shift.location.address && (
                <>
                  <br />
                  <span
                    style={{
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                    onClick={() => openAddressInMaps(shift.location)}
                    title="In Google Maps öffnen"
                  >
                    🗺️ {shift.location.address}
                  </span>
                </>
              )}
            </span>
          </div>

          <div className={styles.detailInfoItem}>
            <span className={styles.detailInfoLabel}>Datum</span>
            <span className={styles.detailInfoValue}>{formatDate(shift.startsAt)}</span>
          </div>

          <div className={styles.detailInfoItem}>
            <span className={styles.detailInfoLabel}>Uhrzeit</span>
            <span className={styles.detailInfoValue}>
              {formatTime(shift.startsAt)} - {formatTime(shift.endsAt)}
            </span>
          </div>

          {shift.payRate && (
            <div className={styles.detailInfoItem}>
              <span className={styles.detailInfoLabel}>Vergütung</span>
              <span className={styles.detailInfoValue}>{shift.payRate.toFixed(2)} €/h</span>
            </div>
          )}

          {shift.requirements && shift.requirements.length > 0 && (
            <div className={styles.detailInfoItem}>
              <span className={styles.detailInfoLabel}>Anforderungen</span>
              <span className={styles.detailInfoValue}>{shift.requirements.join(', ')}</span>
            </div>
          )}

          {isCrewLeader && (
            <div className={styles.detailInfoItem}>
              <span className={styles.detailInfoLabel}>Rolle</span>
              <span className={styles.detailInfoValue}>👑 Crew-Leiter</span>
            </div>
          )}

          {isCompleted && (
            <div className={styles.detailInfoItem}>
              <span className={styles.detailInfoLabel}>Status</span>
              <span className={styles.detailInfoValue}>✓ Beendet</span>
            </div>
          )}
        </div>

        {/* Kollegen Anzeige */}
        {shift.colleagues && shift.colleagues.length > 0 && (
          <div className={styles.colleaguesSection}>
            <h4 className={styles.colleaguesTitle}>
              👥 Deine Kollegen ({shift.colleagues.length})
            </h4>
            <div className={styles.colleaguesList}>
              {shift.colleagues.map((colleague) => (
                <div key={colleague.uid} className={styles.colleagueItem}>
                  <span className={styles.colleagueAvatar}>
                    {colleague.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.colleagueName}>
                    {colleague.displayName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

            {completeError && (
              <div className={styles.error} style={{ marginBottom: '1rem' }}>
                ⚠️ {completeError}
              </div>
            )}

            <div className={styles.formActions}>
              {canComplete && (
                <button
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  onClick={handleComplete}
                  disabled={completing}
                >
                  {completing ? 'Wird beendet...' : 'Schicht beenden'}
                </button>
              )}
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={onClose}
              >
                Schließen
              </button>
            </div>
          </>
        )}

        {activeTab === 'time' && canEditTime && (
          <div style={{ marginTop: '1rem' }}>
            <ShiftTimeEntryList
              shiftId={shift.id}
              canEdit={canEditTime}
              assignedMemberUids={assignedMemberUids}
              shiftStartsAt={shift.startsAt}
              shiftEndsAt={shift.endsAt}
            />
            <div className={styles.formActions}>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={onClose}
              >
                Schließen
              </button>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div style={{ marginTop: '1rem' }}>
            <ShiftDocumentList
              shiftId={shift.id}
              canView={canViewDocuments}
              canUpload={canUploadDocuments}
            />
            <div className={styles.formActions}>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={onClose}
              >
                Schließen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function MyShiftsPage() {
  const { user } = useAuth();
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const { shifts, loading, error, refresh } = useMyShifts({ includeCompleted });
  const [selectedShift, setSelectedShift] = useState<MyShift | null>(null);

  // Gruppiere Schichten nach Zeitraum
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayShifts = shifts.filter((s) => {
    const start = new Date(s.startsAt);
    return start <= todayEnd && start >= now;
  });

  const thisWeekShifts = shifts.filter((s) => {
    const start = new Date(s.startsAt);
    return start > todayEnd && start <= weekEnd;
  });

  const laterShifts = shifts.filter((s) => {
    const start = new Date(s.startsAt);
    return start > weekEnd;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>📋</span>
          Meine Schichten
        </h1>

        <div className={styles.filters}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            Vergangene anzeigen
          </label>
          <button
            className={`${styles.button} ${styles.buttonGhost} ${styles.buttonIcon}`}
            onClick={refresh}
            title="Aktualisieren"
          >
            🔄
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {loading && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <p>Schichten werden geladen...</p>
        </div>
      )}

      {!loading && shifts.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📭</div>
          <p className={styles.emptyText}>Keine zugewiesenen Schichten</p>
          <p style={{ color: 'var(--color-text-light)', fontSize: 'var(--font-size-sm)' }}>
            Du hast aktuell keine Schichten, für die du eingeteilt bist.
          </p>
        </div>
      )}

      {!loading && shifts.length > 0 && (
        <>
          {/* Heute */}
          {todayShifts.length > 0 && (
            <>
              <div className={styles.sectionHeader}>
                <span>🔴 Heute</span>
                <span className={styles.sectionCount}>{todayShifts.length}</span>
              </div>
              <div className={styles.grid}>
                {todayShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => setSelectedShift(shift)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Diese Woche */}
          {thisWeekShifts.length > 0 && (
            <>
              <div className={styles.sectionHeader}>
                <span>📅 Diese Woche</span>
                <span className={styles.sectionCount}>{thisWeekShifts.length}</span>
              </div>
              <div className={styles.grid}>
                {thisWeekShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => setSelectedShift(shift)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Später */}
          {laterShifts.length > 0 && (
            <>
              <div className={styles.sectionHeader}>
                <span>📆 Später</span>
                <span className={styles.sectionCount}>{laterShifts.length}</span>
              </div>
              <div className={styles.grid}>
                {laterShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => setSelectedShift(shift)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {selectedShift && (
        <ShiftDetailModal
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onComplete={refresh}
          isCrewLeader={user?.uid === selectedShift.crewLeaderUid}
          isCompleted={selectedShift.status === 'COMPLETED'}
        />
      )}
    </div>
  );
}
