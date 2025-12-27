/**
 * Admin Time Tracking Section
 *
 * Ermöglicht Admins/Managern, Zeiten für alle Mitarbeiter zu verwalten.
 */

import { useState, useEffect } from 'react';
import { getMembers } from '../members/api';
import type { Member } from '../members/api';
import {
  getAdminEntries,
  createAdminEntry,
  updateAdminEntry,
  deleteAdminEntry,
  type TimeEntry,
  type CreateTimeEntryRequest,
  type UpdateTimeEntryRequest,
} from './api';
import { formatTime, formatDate } from '../../utils/dateTime';
import { EntryModal } from './TimeTrackingPage';
import styles from './AdminTimeTrackingSection.module.css';

/**
 * Formatiert Minuten als "Xh Ym".
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

/**
 * Gruppiert Einträge nach Datum.
 */
function groupEntriesByDate(entries: TimeEntry[]): Map<string, TimeEntry[]> {
  const groups = new Map<string, TimeEntry[]>();

  entries.forEach((entry) => {
    const dateKey = new Date(entry.clockIn).toDateString();
    const existing = groups.get(dateKey) || [];
    existing.push(entry);
    groups.set(dateKey, existing);
  });

  return groups;
}

/**
 * Berechnet die Gesamtdauer für eine Gruppe.
 */
function calculateGroupDuration(entries: TimeEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0);
}

export function AdminTimeTrackingSection() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  // Mitglieder laden
  useEffect(() => {
    async function loadMembers() {
      try {
        const response = await getMembers();
        setMembers(response.members);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Mitarbeiter');
      }
    }
    loadMembers();
  }, []);

  // Einträge laden wenn User ausgewählt
  useEffect(() => {
    if (!selectedUserId) {
      setEntries([]);
      return;
    }

    async function loadEntries() {
      setLoading(true);
      setError(null);
      try {
        const response = await getAdminEntries(selectedUserId, 100);
        setEntries(response.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Zeiten');
      } finally {
        setLoading(false);
      }
    }

    loadEntries();
  }, [selectedUserId]);

  const selectedMember = members.find((m) => m.uid === selectedUserId);

  const handleCreateEntry = async (data: CreateTimeEntryRequest | UpdateTimeEntryRequest) => {
    // Nur CreateTimeEntryRequest wird unterstützt
    if (!('clockIn' in data) || !data.clockIn) {
      throw new Error('clockIn ist erforderlich');
    }
    const createData = data as CreateTimeEntryRequest;
    if (!selectedUserId || !selectedMember) return;

    try {
      await createAdminEntry(selectedUserId, selectedMember.email || '', createData);
      // Einträge neu laden
      const response = await getAdminEntries(selectedUserId, 100);
      setEntries(response.entries);
      setShowCreateModal(false);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateEntry = async (data: UpdateTimeEntryRequest) => {
    if (!editingEntry) return;

    try {
      await updateAdminEntry(editingEntry.id, data);
      // Einträge neu laden
      if (selectedUserId) {
        const response = await getAdminEntries(selectedUserId, 100);
        setEntries(response.entries);
      }
      setEditingEntry(null);
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Möchten Sie diesen Eintrag wirklich löschen?')) return;

    try {
      await deleteAdminEntry(entryId);
      // Einträge neu laden
      if (selectedUserId) {
        const response = await getAdminEntries(selectedUserId, 100);
        setEntries(response.entries);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  const groupedEntries = groupEntriesByDate(entries);

  return (
    <section className={styles.section} aria-label="Zeiten-Verwaltung">
      <h2 className={styles.title}>Zeiten-Verwaltung</h2>
      <p className={styles.description}>
        Verwalten Sie Zeiteinträge für alle Mitarbeiter in Ihrem Tenant.
      </p>

      {/* Mitarbeiter-Auswahl */}
      <div className={styles.memberSelection}>
        <label htmlFor="member-select" className={styles.memberLabel}>
          Mitarbeiter auswählen
        </label>
        <select
          id="member-select"
          className={styles.memberSelect}
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          aria-label="Mitarbeiter auswählen"
          aria-required="true"
          aria-describedby="member-select-hint"
        >
          <option value="">-- Bitte wählen --</option>
          {members.map((member) => (
            <option key={member.uid} value={member.uid}>
              {member.displayName || member.email} {member.role === 'admin' ? '(Admin)' : member.role === 'manager' ? '(Manager)' : ''}
            </option>
          ))}
        </select>
        <span id="member-select-hint" className={styles.memberHint}>
          Wählen Sie einen Mitarbeiter aus, um dessen Zeiteinträge zu verwalten.
        </span>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          ⚠️ {error}
        </div>
      )}

      {selectedUserId && (
        <div className={styles.content}>
          {/* Header mit Aktionen */}
          <div className={styles.header}>
            <h3 className={styles.subtitle}>
              Zeiteinträge für {selectedMember?.displayName || selectedMember?.email}
            </h3>
            <button
              className={styles.addButton}
              onClick={() => setShowCreateModal(true)}
              aria-label="Neuen Zeiteintrag hinzufügen"
            >
              ➕ Eintrag hinzufügen
            </button>
          </div>

          {/* Einträge-Liste */}
          {loading ? (
            <div className={styles.loading}>Lädt Einträge...</div>
          ) : entries.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">📭</span>
              <p className={styles.emptyText}>Noch keine Einträge vorhanden.</p>
            </div>
          ) : (
            <div className={styles.entriesList} role="list" aria-label="Zeiteinträge">
              {Array.from(groupedEntries.entries()).map(([dateKey, dayEntries]) => (
                <div key={dateKey} className={styles.entryGroup}>
                  <div className={styles.entryGroupHeader}>
                    <span className={styles.entryGroupDate}>
                      {formatDate(dayEntries[0].clockIn)}
                    </span>
                    <span className={styles.entryGroupDuration}>
                      Gesamt: {formatDuration(calculateGroupDuration(dayEntries))}
                    </span>
                  </div>
                  {dayEntries.map((entry) => (
                    <div key={entry.id} className={styles.entryRow}>
                      <div className={styles.entryTypeIcon} aria-label={entry.entryType === 'break' ? 'Pause' : 'Arbeitszeit'}>
                        {entry.entryType === 'break' ? '☕' : '⏱️'}
                      </div>
                      <div className={styles.entryTimes}>
                        <span className={styles.entryTime}>{formatTime(entry.clockIn)}</span>
                        <span className={styles.entryArrow} aria-hidden="true">→</span>
                        <span className={styles.entryTime}>
                          {entry.clockOut ? formatTime(entry.clockOut) : '--:--'}
                        </span>
                      </div>
                      <div className={styles.entryDuration}>
                        {entry.durationMinutes !== null
                          ? formatDuration(entry.durationMinutes)
                          : '--'}
                      </div>
                      {entry.note && (
                        <div className={styles.entryNote} title={entry.note}>
                          💬 {entry.note.length > 30 ? entry.note.slice(0, 30) + '...' : entry.note}
                        </div>
                      )}
                      <div className={styles.entryActions}>
                        <button
                          className={styles.iconButton}
                          onClick={() => setEditingEntry(entry)}
                          title="Bearbeiten"
                          aria-label={`Eintrag bearbeiten: ${formatTime(entry.clockIn)}`}
                        >
                          ✏️
                        </button>
                        <button
                          className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                          onClick={() => handleDeleteEntry(entry.id)}
                          title="Löschen"
                          aria-label={`Eintrag löschen: ${formatTime(entry.clockIn)}`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && selectedUserId && selectedMember && (
        <EntryModal
          onSubmit={handleCreateEntry}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingEntry && (
        <EntryModal
          entry={editingEntry}
          onSubmit={handleUpdateEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </section>
  );
}

