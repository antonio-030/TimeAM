/**
 * Shift Time Entry List
 *
 * Zeigt alle Zeiteinträge einer Schicht an.
 */

import { useState, useEffect } from 'react';
import { useShiftTimeEntries } from './hooks';
import { useAuth } from '../../core/auth';
import { useTenant } from '../../core/tenant';
import { getMembers } from '../members/api';
import { getShiftAssignments } from './api';
import type { ShiftTimeEntry, CreateShiftTimeEntryRequest } from '@timeam/shared';
import styles from './ShiftPool.module.css';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins} Min`;
  }
  return `${hours}h ${mins} Min`;
}

// =============================================================================
// Components
// =============================================================================

interface ShiftTimeEntryListProps {
  shiftId: string;
  canEdit: boolean;
  assignedMemberUids: string[];
  shiftStartsAt?: string;
  shiftEndsAt?: string;
}

export function ShiftTimeEntryList({
  shiftId,
  canEdit,
  assignedMemberUids,
  shiftStartsAt,
  shiftEndsAt,
}: ShiftTimeEntryListProps) {
  const { user } = useAuth();
  const { role } = useTenant();
  const { entries, loading, error, refresh, createEntry, updateEntry } = useShiftTimeEntries(shiftId);
  const [editingEntry, setEditingEntry] = useState<ShiftTimeEntry | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [members, setMembers] = useState<Array<{ 
    id: string; 
    displayName: string; 
    email: string;
    isFreelancer?: boolean;
    companyName?: string;
  }>>([]);

  // Mitglieder und Freelancer-Informationen laden
  useEffect(() => {
    async function loadMemberData() {
      try {
        // Mitglieder laden
        const membersData = await getMembers();
        const membersList = membersData.members
          .filter((m) => assignedMemberUids.includes(m.id))
          .map((m) => ({
            id: m.id,
            displayName: m.displayName || m.email.split('@')[0],
            email: m.email,
            role: m.role,
          }));

        // Assignments laden, um Freelancer-Informationen zu bekommen
        try {
          const assignmentsData = await getShiftAssignments(shiftId);
          const assignmentsMap = new Map(
            assignmentsData.assignments.map((a) => [a.uid, a])
          );

          // Mitglieder mit Freelancer-Informationen anreichern
          const enrichedMembers = membersList.map((member) => {
            const assignment = assignmentsMap.get(member.id);
            // Prüfe ob Freelancer (entweder über Assignment oder über role)
            const isFreelancer = assignment?.isFreelancer || (member.role as string) === 'freelancer';
            if (isFreelancer) {
              return {
                ...member,
                isFreelancer: true,
                companyName: assignment?.companyName,
                // Für Freelancer: Firmenname als Display-Name verwenden, falls vorhanden
                displayName: assignment?.companyName || assignment?.displayName || member.displayName,
              };
            }
            return member;
          });

          setMembers(enrichedMembers);
        } catch {
          // Falls Assignments nicht geladen werden können, nur Members verwenden
          setMembers(membersList);
        }
      } catch {
        // Fehler beim Laden ignorieren
      }
    }
    loadMemberData();
  }, [assignedMemberUids, shiftId]);

  const handleSubmit = async (data: CreateShiftTimeEntryRequest) => {
    try {
      // Nur aktualisieren wenn editingEntry eine ID hat (existierender Eintrag)
      if (editingEntry && editingEntry.id) {
        await updateEntry(editingEntry.id, data);
      } else {
        // Neuen Eintrag erstellen
        await createEntry(data);
      }
      setShowForm(false);
      setEditingEntry(null);
    } catch (err) {
      // Error wird vom Hook behandelt
    }
  };

  const handleEdit = (entry: ShiftTimeEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const getMemberName = (uid: string): string => {
    const member = members.find((m) => m.id === uid);
    return member?.displayName || uid;
  };

  const isAdminOrManager = role === 'admin' || role === 'manager';

  if (!canEdit && !isAdminOrManager) {
    return null;
  }

  return (
    <div className={styles.timeEntriesSection}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>⏱️ Zeiterfassung</h3>
        {canEdit && (
          <button
            className={`${styles.button} ${styles.buttonSmall} ${styles.buttonPrimary}`}
            onClick={() => {
              setEditingEntry(null);
              setShowForm(true);
            }}
          >
            ➕ Zeit eintragen
          </button>
        )}
      </div>

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {loading && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <p>Zeiteinträge werden geladen...</p>
        </div>
      )}

      {!loading && entries.length === 0 && members.length === 0 && (
        <div className={styles.empty}>
          <p>Noch keine Zeiteinträge vorhanden</p>
        </div>
      )}

      {!loading && (entries.length > 0 || members.length > 0) && (
        <div className={styles.timeEntriesList}>
          {/* Zeige alle zugewiesenen Mitarbeiter, auch wenn noch kein Eintrag existiert */}
          {members.map((member) => {
            const entry = entries.find((e) => e.uid === member.id);
            
            if (entry) {
              // Eintrag existiert bereits
              return (
                <div key={entry.id} className={styles.timeEntryCard}>
                  <div className={styles.timeEntryHeader}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: entry.note ? '0.25rem' : 0 }}>
                        <strong style={{ fontSize: '1.1rem' }}>
                          {member.isFreelancer && member.companyName 
                            ? member.companyName 
                            : getMemberName(entry.uid)}
                        </strong>
                        {member.isFreelancer && (
                          <span style={{
                            background: 'var(--color-primary-light)',
                            color: 'var(--color-primary)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 500
                          }}>
                            💼 Freelancer
                          </span>
                        )}
                      </div>
                      {entry.note && (
                        <p className={styles.timeEntryNote} style={{ marginTop: '0.25rem' }}>
                          📝 {entry.note}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <button
                        className={`${styles.button} ${styles.buttonSmall} ${styles.buttonGhost}`}
                        onClick={() => handleEdit(entry)}
                        title="Zeiteintrag bearbeiten"
                      >
                        ✏️ Bearbeiten
                      </button>
                    )}
                  </div>
                  <div className={styles.timeEntryDetails} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '0.75rem',
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)'
                  }}>
                    <div className={styles.timeEntryDetail}>
                      <span className={styles.timeEntryLabel} style={{ display: 'block', marginBottom: '0.25rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Startzeit</span>
                      <span style={{ fontWeight: 500 }}>{formatDateTime(entry.actualClockIn)}</span>
                    </div>
                    <div className={styles.timeEntryDetail}>
                      <span className={styles.timeEntryLabel} style={{ display: 'block', marginBottom: '0.25rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Endzeit</span>
                      <span style={{ fontWeight: 500 }}>{formatDateTime(entry.actualClockOut)}</span>
                    </div>
                    <div className={styles.timeEntryDetail}>
                      <span className={styles.timeEntryLabel} style={{ display: 'block', marginBottom: '0.25rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Dauer</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--color-primary)' }}>{formatDuration(entry.durationMinutes)}</strong>
                    </div>
                  </div>
                </div>
              );
            } else {
              // Noch kein Eintrag - zeige Platzhalter mit Schichtzeiten
              return (
                <div key={member.id} className={styles.timeEntryCard} style={{ 
                  opacity: 0.85,
                  border: '1px dashed var(--color-border)',
                  background: 'var(--color-bg-secondary)'
                }}>
                  <div className={styles.timeEntryHeader}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '1.1rem' }}>
                          {member.isFreelancer && member.companyName 
                            ? member.companyName 
                            : member.displayName}
                        </strong>
                        {member.isFreelancer && (
                          <span style={{
                            background: 'var(--color-primary-light)',
                            color: 'var(--color-primary)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 500
                          }}>
                            💼 Freelancer
                          </span>
                        )}
                      </div>
                      <p style={{ 
                        fontStyle: 'italic', 
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
                        margin: 0
                      }}>
                        ⏳ Noch kein Zeiteintrag
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        className={`${styles.button} ${styles.buttonSmall} ${styles.buttonPrimary}`}
                        onClick={() => {
                          setEditingEntry(null);
                          setSelectedMemberId(member.id);
                          setShowForm(true);
                        }}
                        title="Zeiteintrag für diesen Mitarbeiter erstellen"
                      >
                        ➕ Zeit eintragen
                      </button>
                    )}
                  </div>
                  {shiftStartsAt && shiftEndsAt && (
                    <div className={styles.timeEntryDetails} style={{ 
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: 'var(--color-bg)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)'
                    }}>
                      <div className={styles.timeEntryDetail} style={{ marginBottom: '0.5rem' }}>
                        <span className={styles.timeEntryLabel} style={{ display: 'block', marginBottom: '0.25rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Geplante Startzeit</span>
                        <span>{formatDateTime(shiftStartsAt)}</span>
                      </div>
                      <div className={styles.timeEntryDetail}>
                        <span className={styles.timeEntryLabel} style={{ display: 'block', marginBottom: '0.25rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Geplante Endzeit</span>
                        <span>{formatDateTime(shiftEndsAt)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          })}
        </div>
      )}

      {showForm && (
        <ShiftTimeEntryForm
          shiftId={shiftId}
          entry={editingEntry}
          preselectedMemberId={selectedMemberId}
          members={members}
          shiftStartsAt={shiftStartsAt}
          shiftEndsAt={shiftEndsAt}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingEntry(null);
            setSelectedMemberId(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Time Entry Form
// =============================================================================

interface ShiftTimeEntryFormProps {
  shiftId: string;
  entry: ShiftTimeEntry | null;
  preselectedMemberId?: string | null;
  members: Array<{ id: string; displayName: string; email: string }>;
  shiftStartsAt?: string;
  shiftEndsAt?: string;
  onSubmit: (data: CreateShiftTimeEntryRequest) => Promise<void>;
  onCancel: () => void;
}

function ShiftTimeEntryForm({
  entry,
  preselectedMemberId,
  members,
  shiftStartsAt,
  shiftEndsAt,
  onSubmit,
  onCancel,
}: ShiftTimeEntryFormProps) {
  // Wenn entry.uid existiert, verwende es, sonst preselectedMemberId, sonst den ersten Member
  const initialUid = entry?.uid || preselectedMemberId || members[0]?.id || '';
  const [uid, setUid] = useState(initialUid);
  
  // Standardwerte: Wenn Eintrag vorhanden, diese verwenden, sonst Schicht-Zeiten, sonst aktuelle Zeit
  const getDefaultClockIn = () => {
    if (entry?.actualClockIn) {
      return new Date(entry.actualClockIn).toISOString().slice(0, 16);
    }
    if (shiftStartsAt) {
      return new Date(shiftStartsAt).toISOString().slice(0, 16);
    }
    return new Date().toISOString().slice(0, 16);
  };

  const getDefaultClockOut = () => {
    if (entry?.actualClockOut) {
      return new Date(entry.actualClockOut).toISOString().slice(0, 16);
    }
    if (shiftEndsAt) {
      return new Date(shiftEndsAt).toISOString().slice(0, 16);
    }
    return new Date().toISOString().slice(0, 16);
  };

  const [clockIn, setClockIn] = useState(getDefaultClockIn());
  const [clockOut, setClockOut] = useState(getDefaultClockOut());
  const [note, setNote] = useState(entry?.note || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aktualisiere Zeiten wenn sich der ausgewählte Mitarbeiter ändert und es ein neuer Eintrag ist
  useEffect(() => {
    if (!entry && shiftStartsAt && shiftEndsAt) {
      setClockIn(new Date(shiftStartsAt).toISOString().slice(0, 16));
      setClockOut(new Date(shiftEndsAt).toISOString().slice(0, 16));
    }
  }, [uid, entry, shiftStartsAt, shiftEndsAt]);

  // Aktualisiere uid wenn entry oder preselectedMemberId geändert wird
  useEffect(() => {
    if (entry?.uid) {
      setUid(entry.uid);
    } else if (preselectedMemberId) {
      setUid(preselectedMemberId);
    }
  }, [entry, preselectedMemberId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({
        uid,
        actualClockIn: new Date(clockIn).toISOString(),
        actualClockOut: new Date(clockOut).toISOString(),
        note: note.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
        <h3 className={styles.modalTitle}>
          {entry ? 'Zeiteintrag bearbeiten' : 'Zeiteintrag erstellen'}
        </h3>

        {error && <div className={styles.error}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Mitarbeiter</label>
            <select
              className={styles.input}
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              required
              disabled={!!entry}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Startzeit</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Endzeit</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Notiz (optional)</label>
            <textarea
              className={styles.input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={onCancel}
              disabled={submitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles.buttonPrimary}`}
              disabled={submitting}
            >
              {submitting ? 'Wird gespeichert...' : entry ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

