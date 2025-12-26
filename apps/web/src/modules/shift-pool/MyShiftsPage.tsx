/**
 * My Shifts Page
 *
 * Übersicht der eigenen zugewiesenen Schichten.
 */

import { useState, useMemo, useEffect } from 'react';
import { useMyShifts } from './hooks';
import { useAuth } from '../../core/auth';
import { useTenant } from '../../core/tenant';
import { completeShift } from './api';
import { ShiftTimeEntryList } from './ShiftTimeEntryList';
import { ShiftDocumentList } from './ShiftDocumentList';
import { openAddressInMaps } from './mapsUtils';
import { getMembers } from '../members/api';
import { getMemberFullName, getMemberInitials } from '../../utils/memberNames';
import type { MyShift } from './api';
import type { Member } from '@timeam/shared';
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

// =============================================================================
// Components
// =============================================================================

interface ShiftCardProps {
  shift: MyShift;
  onClick: () => void;
  members: Member[];
}

function ShiftCard({ shift, onClick, members }: ShiftCardProps) {
  const upcoming = isUpcoming(shift.startsAt);
  const today = new Date(shift.startsAt).toDateString() === new Date().toDateString();
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
          {shift.crewLeaderUid && (
            <div className={styles.crewLeaderBadge}>👑 Crew-Leiter</div>
          )}
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
              ? (() => {
                  const member = members.find(m => m.uid === shift.colleagues[0].uid);
                  const name = member ? getMemberFullName(member) : shift.colleagues[0].displayName;
                  return `Mit ${name}`;
                })()
              : `Mit ${shift.colleagues.length} Kollegen`}
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
  members: Member[];
}

function ShiftDetailModal({ shift, onClose, onComplete, isCrewLeader, isCompleted, members }: ShiftDetailModalProps) {
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

  // Button immer anzeigen für Crew-Leiter/Admin/Manager, aber nur aktivieren wenn Schicht in Vergangenheit liegt
  const canSeeCompleteButton = isCrewLeader || role === 'admin' || role === 'manager';
  const canComplete = canSeeCompleteButton && !isCompleted && new Date(shift.startsAt) <= new Date();
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
      <div className={`${styles.modalContent} ${styles.modalContentWide}`} onClick={(e) => e.stopPropagation()}>
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
              {shift.colleagues.map((colleague) => {
                const member = members.find(m => m.uid === colleague.uid);
                const displayName = member ? getMemberFullName(member) : colleague.displayName;
                const initials = member ? getMemberInitials(member) : colleague.displayName.charAt(0).toUpperCase();
                
                return (
                <div key={colleague.uid} className={styles.colleagueItem}>
                  <span className={styles.colleagueAvatar}>
                    {initials}
                  </span>
                  <span className={styles.colleagueName}>
                    {displayName}
                  </span>
                </div>
                );
              })}
            </div>
          </div>
        )}

            {completeError && (
              <div className={styles.error} style={{ marginBottom: '1rem' }}>
                ⚠️ {completeError}
              </div>
            )}

            <div className={styles.formActions}>
              {canSeeCompleteButton && (
                <button
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  onClick={handleComplete}
                  disabled={completing || !canComplete}
                  title={!canComplete && new Date(shift.startsAt) > new Date() ? 'Schicht muss erst gestartet sein' : isCompleted ? 'Schicht bereits beendet' : 'Schicht beenden'}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  
  // Mitglieder laden für vollständige Namen
  useEffect(() => {
    getMembers()
      .then((data) => setMembers(data.members))
      .catch(() => {
        // Fehler ignorieren
      });
  }, []);

  // Filter Schichten nach Suchbegriff
  const filteredShifts = useMemo(() => {
    if (!searchQuery.trim()) return shifts;
    
    const query = searchQuery.toLowerCase();
    return shifts.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.location.name.toLowerCase().includes(query)
    );
  }, [shifts, searchQuery]);

  // Gruppiere Schichten nach Zeitraum
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayShifts = useMemo(() => filteredShifts.filter((s) => {
    const start = new Date(s.startsAt);
    return start <= todayEnd && start >= now;
  }), [filteredShifts, todayEnd, now]);

  const thisWeekShifts = useMemo(() => filteredShifts.filter((s) => {
    const start = new Date(s.startsAt);
    return start > todayEnd && start <= weekEnd;
  }), [filteredShifts, todayEnd, weekEnd]);

  const laterShifts = useMemo(() => filteredShifts.filter((s) => {
    const start = new Date(s.startsAt);
    return start > weekEnd;
  }), [filteredShifts, weekEnd]);

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

        <div className={styles.filters}>
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
            disabled={loading}
          >
            🔄
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚠️</div>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Schichten werden geladen...</p>
        </div>
      ) : filteredShifts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📭</div>
          <h2 className={styles.emptyTitle}>
            {searchQuery ? 'Keine Ergebnisse gefunden' : 'Keine zugewiesenen Schichten'}
          </h2>
          <p className={styles.emptyText}>
            {searchQuery
              ? 'Versuche es mit anderen Suchbegriffen.'
              : 'Du hast aktuell keine Schichten, für die du eingeteilt bist.'}
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
          {/* Heute */}
          {todayShifts.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>🔴</span>
                  Heute ({todayShifts.length})
                </h2>
              </div>
              <div className={styles.grid}>
                {todayShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => setSelectedShift(shift)}
                    members={members}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Diese Woche */}
          {thisWeekShifts.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>📅</span>
                  Diese Woche ({thisWeekShifts.length})
                </h2>
              </div>
              <div className={styles.grid}>
                {thisWeekShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => setSelectedShift(shift)}
                    members={members}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Später */}
          {laterShifts.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>📆</span>
                  Später ({laterShifts.length})
                </h2>
              </div>
              <div className={styles.grid}>
                {laterShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => setSelectedShift(shift)}
                    members={members}
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
          onComplete={refresh}
          isCrewLeader={user?.uid === selectedShift.crewLeaderUid}
          isCompleted={selectedShift.status === 'COMPLETED'}
          members={members}
        />
      )}
    </div>
  );
}
