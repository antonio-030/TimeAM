/**
 * Time Tracking Page
 *
 * Zeiterfassung mit Clock UI, Einträge-Liste, Bearbeiten und Löschen.
 * Barrierefrei gestaltet mit ARIA-Labels und Keyboard-Navigation.
 */

import { useState, useEffect, useRef } from 'react';
import { useTimeTrackingStatus, useTimeEntries } from './hooks';
import type { TimeEntry, CreateTimeEntryRequest, UpdateTimeEntryRequest } from './api';
import { getBreakSuggestion } from './api';
import { formatTime, formatDate, formatDateShort } from '../../utils/dateTime';
import { TimeAccountSection } from './TimeAccountSection';
import { TimeAccountManagementSection } from './TimeAccountManagementSection';
import { AdminTimeTrackingSection } from './AdminTimeTrackingSection';
import { BreakSuggestionDialog } from './BreakSuggestionDialog';
import { useTenant } from '../../core/tenant';
import styles from './TimeTrackingPage.module.css';

// =============================================================================
// Helper Functions
// =============================================================================

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
 * Berechnet laufende Dauer.
 */
function getRunningDuration(clockInIso: string): number {
  const clockIn = new Date(clockInIso);
  return Math.floor((Date.now() - clockIn.getTime()) / (1000 * 60));
}

/**
 * Formatiert ISO-String für datetime-local input.
 */
function toDateTimeLocal(isoString: string): string {
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

/**
 * Konvertiert datetime-local zu ISO String.
 */
function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
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

// =============================================================================
// Entry Modal (Erstellen/Bearbeiten)
// =============================================================================

export interface EntryModalProps {
  entry?: TimeEntry;
  onSubmit: (data: CreateTimeEntryRequest | UpdateTimeEntryRequest) => Promise<void>;
  onClose: () => void;
}

export function EntryModal({ entry, onSubmit, onClose }: EntryModalProps) {
  const isEdit = !!entry;
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [clockIn, setClockIn] = useState(
    entry ? toDateTimeLocal(entry.clockIn) : ''
  );
  const [clockOut, setClockOut] = useState(
    entry?.clockOut ? toDateTimeLocal(entry.clockOut) : ''
  );
  const [entryType, setEntryType] = useState<'work' | 'break'>(
    entry?.entryType || 'work'
  );
  const [note, setNote] = useState(entry?.note || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default für neue Einträge: aktuelle Zeit
  useEffect(() => {
    if (!entry) {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      setClockIn(toDateTimeLocal(oneHourAgo.toISOString()));
      setClockOut(toDateTimeLocal(now.toISOString()));
    }
  }, [entry]);

  // Focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    modalRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isEdit) {
        await onSubmit({
          clockIn: fromDateTimeLocal(clockIn),
          clockOut: fromDateTimeLocal(clockOut),
          entryType,
          note: note.trim() || undefined,
        } as UpdateTimeEntryRequest);
      } else {
        await onSubmit({
          clockIn: fromDateTimeLocal(clockIn),
          clockOut: fromDateTimeLocal(clockOut),
          entryType,
          note: note.trim() || undefined,
        } as CreateTimeEntryRequest);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
      setIsSubmitting(false);
    }
  };

  // Dauer berechnen
  const calculatedDuration = clockIn && clockOut
    ? Math.max(0, Math.round((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60)))
    : 0;

  return (
    <div 
      className={styles.modalOverlay} 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className={styles.modal} 
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <h2 id="modal-title" className={styles.modalTitle}>
          {isEdit ? '✏️ Eintrag bearbeiten' : '➕ Neuer Eintrag'}
        </h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="clockIn" className={styles.formLabel}>
                Startzeit *
              </label>
              <input
                type="datetime-local"
                id="clockIn"
                className={styles.formInput}
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                required
                aria-required="true"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="clockOut" className={styles.formLabel}>
                Endzeit *
              </label>
              <input
                type="datetime-local"
                id="clockOut"
                className={styles.formInput}
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                required
                aria-required="true"
              />
            </div>
          </div>

          {calculatedDuration > 0 && (
            <div className={styles.durationPreview} aria-live="polite">
              <span className={styles.durationPreviewLabel}>Dauer:</span>
              <span className={styles.durationPreviewValue}>
                {formatDuration(calculatedDuration)}
              </span>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="entryType" className={styles.formLabel}>
              Typ *
            </label>
            <select
              id="entryType"
              className={styles.formInput}
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as 'work' | 'break')}
              required
              aria-required="true"
            >
              <option value="work">⏱️ Arbeitszeit</option>
              <option value="break">☕ Pause</option>
            </select>
            <span className={styles.formHint}>
              Wähle, ob dies Arbeitszeit oder eine Pause ist.
            </span>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="note" className={styles.formLabel}>
              Notiz (optional)
            </label>
            <textarea
              id="note"
              className={styles.formTextarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. Projekt, Tätigkeit..."
              rows={3}
              aria-describedby="note-hint"
            />
            <span id="note-hint" className={styles.formHint}>
              Optional: Beschreibe, woran du gearbeitet hast.
            </span>
          </div>

          {error && (
            <div className={styles.error} role="alert">
              ⚠️ {error}
            </div>
          )}

          <div className={styles.modalActions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles.buttonPrimary}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Wird gespeichert...' : isEdit ? '💾 Speichern' : '➕ Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Confirm Delete Modal
// =============================================================================

interface ConfirmDeleteModalProps {
  entry: TimeEntry;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function ConfirmDeleteModal({ entry, onConfirm, onClose }: ConfirmDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className={styles.modalOverlay} 
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 id="delete-title" className={styles.modalTitle}>
          🗑️ Eintrag löschen?
        </h2>

        <p id="delete-description" className={styles.modalText}>
          Möchtest du diesen Eintrag wirklich löschen?
        </p>

        <div className={styles.deleteEntryPreview}>
          <div className={styles.deleteEntryDate}>
            {formatDateShort(entry.clockIn)}
          </div>
          <div className={styles.deleteEntryTimes}>
            {formatTime(entry.clockIn)} → {entry.clockOut ? formatTime(entry.clockOut) : '--:--'}
          </div>
          <div className={styles.deleteEntryDuration}>
            {entry.durationMinutes ? formatDuration(entry.durationMinutes) : '--'}
          </div>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            ⚠️ {error}
          </div>
        )}

        <div className={styles.modalActions}>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={onClose}
            disabled={isDeleting}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonDanger}`}
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Wird gelöscht...' : '🗑️ Löschen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Time Entry Row
// =============================================================================

interface TimeEntryRowProps {
  entry: TimeEntry;
  onEdit: () => void;
  onDelete: () => void;
}

function TimeEntryRow({ entry, onEdit, onDelete }: TimeEntryRowProps) {
  const isRunning = entry.status === 'running';
  const isBreak = entry.entryType === 'break';

  return (
    <div 
      className={`${styles.entryRow} ${isRunning ? styles.entryRunning : ''} ${isBreak ? styles.entryBreak : ''}`}
      role="listitem"
    >
      <div className={styles.entryTypeIcon} aria-label={isBreak ? 'Pause' : 'Arbeitszeit'}>
        {isBreak ? '☕' : '⏱️'}
      </div>
      
      <div className={styles.entryTimes}>
        <span className={styles.entryTime}>{formatTime(entry.clockIn)}</span>
        <span className={styles.entryArrow} aria-hidden="true">→</span>
        <span className={styles.entryTime}>
          {entry.clockOut ? formatTime(entry.clockOut) : '--:--'}
        </span>
      </div>
      
      <div className={styles.entryDuration}>
        {isRunning ? (
          <span className={styles.runningIndicator} aria-label="Läuft gerade">
            ● Läuft
          </span>
        ) : entry.durationMinutes !== null ? (
          <span aria-label={`Dauer: ${formatDuration(entry.durationMinutes)}`}>
            {formatDuration(entry.durationMinutes)}
          </span>
        ) : (
          '--'
        )}
      </div>

      {entry.note && (
        <div className={styles.entryNote} title={entry.note}>
          💬 {entry.note.length > 30 ? entry.note.slice(0, 30) + '...' : entry.note}
        </div>
      )}

      {!isRunning && (
        <div className={styles.entryActions}>
          <button
            className={`${styles.iconButton}`}
            onClick={onEdit}
            title="Bearbeiten"
            aria-label={`Eintrag bearbeiten: ${formatTime(entry.clockIn)}`}
          >
            ✏️
          </button>
          <button
            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
            onClick={onDelete}
            title="Löschen"
            aria-label={`Eintrag löschen: ${formatTime(entry.clockIn)}`}
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

type TabId = 'tracking' | 'account' | 'management' | 'admin';

export function TimeTrackingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('tracking');
  
  const {
    status,
    loading: statusLoading,
    error: statusError,
    clockIn,
    clockOut,
    refresh: refreshStatus,
  } = useTimeTrackingStatus();

  const {
    entries,
    loading: entriesLoading,
    error: entriesError,
    refresh: refreshEntries,
    createEntry,
    updateEntry,
    deleteEntry,
  } = useTimeEntries(50);

  const [isClocking, setIsClocking] = useState(false);
  const [runningTime, setRunningTime] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | null>(null);
  const [breakSuggestion, setBreakSuggestion] = useState<{
    requiredMinutes: number;
    reason: string;
  } | null>(null);

  // Timer für laufende Zeit
  useEffect(() => {
    if (!status?.isRunning || !status.runningEntry) {
      setRunningTime(0);
      return;
    }

    setRunningTime(getRunningDuration(status.runningEntry.clockIn));

    const interval = setInterval(() => {
      if (status.runningEntry) {
        setRunningTime(getRunningDuration(status.runningEntry.clockIn));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status?.isRunning, status?.runningEntry]);

  const handleClock = async () => {
    setIsClocking(true);
    try {
      if (status?.isRunning) {
        await clockOut();
        // Nach Clock-Out Pausen-Vorschlag prüfen
        try {
          const suggestion = await getBreakSuggestion();
          if (suggestion.suggestion) {
            setBreakSuggestion(suggestion.suggestion);
          }
        } catch {
          // Fehler beim Abrufen des Vorschlags ignorieren
        }
      } else {
        await clockIn();
      }
      await refreshEntries();
    } catch {
      // Error wird in Hook behandelt
    } finally {
      setIsClocking(false);
    }
  };

  const handleCreateEntry = async (data: CreateTimeEntryRequest) => {
    await createEntry(data);
    await refreshStatus();
    // Nach Erstellen Pausen-Vorschlag prüfen (nur für Arbeitszeit)
    if (data.entryType !== 'break') {
      try {
        const suggestion = await getBreakSuggestion();
        if (suggestion.suggestion) {
          setBreakSuggestion(suggestion.suggestion);
        }
      } catch {
        // Fehler beim Abrufen des Vorschlags ignorieren
      }
    }
  };

  const handleUpdateEntry = async (data: UpdateTimeEntryRequest) => {
    if (!editingEntry) return;
    await updateEntry(editingEntry.id, data);
    await refreshStatus();
    // Nach Update Pausen-Vorschlag prüfen (nur für Arbeitszeit)
    if (data.entryType !== 'break' && editingEntry.entryType !== 'break') {
      try {
        const suggestion = await getBreakSuggestion();
        if (suggestion.suggestion) {
          setBreakSuggestion(suggestion.suggestion);
        }
      } catch {
        // Fehler beim Abrufen des Vorschlags ignorieren
      }
    }
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return;
    await deleteEntry(deletingEntry.id);
    await refreshStatus();
  };

  const isRunning = status?.isRunning ?? false;
  const todayMinutes = status?.today.totalMinutes ?? 0;

  // Einträge nach Datum gruppieren
  const groupedEntries = groupEntriesByDate(entries);

  const { role } = useTenant();
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const isFreelancer = !role; // Freelancer haben keine role
  const canManageTargets = isAdminOrManager || isFreelancer;

  // Keyboard Navigation für Tabs
  const handleTabKeyDown = (e: React.KeyboardEvent, tabId: TabId) => {
    const tabs: TabId[] = [
      'tracking',
      'account',
      ...(canManageTargets ? ['management' as TabId] : []),
      ...(isAdminOrManager ? ['admin' as TabId] : []),
    ];
    const currentIndex = tabs.indexOf(activeTab);
    let newIndex = currentIndex;

    if (e.key === 'ArrowLeft') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      e.preventDefault();
    } else if (e.key === 'Home') {
      newIndex = 0;
      e.preventDefault();
    } else if (e.key === 'End') {
      newIndex = tabs.length - 1;
      e.preventDefault();
    }

    if (newIndex !== currentIndex) {
      setActiveTab(tabs[newIndex]);
      const newTab = document.getElementById(`${tabs[newIndex]}-tab`);
      if (newTab) {
        (newTab as HTMLElement).focus();
      }
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageIcon} aria-hidden="true">⏱️</span>
          <span className={styles.pageTitleText}>Zeiterfassung</span>
        </h1>
        {activeTab === 'tracking' && (
          <button
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={() => setShowCreateModal(true)}
            aria-label="Neuen Zeiteintrag manuell hinzufügen"
          >
            <span className={styles.buttonIcon} aria-hidden="true">➕</span>
            <span className={styles.buttonText}>Eintrag hinzufügen</span>
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className={styles.tabs} role="tablist" aria-label="Zeiterfassung Tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tracking'}
          aria-controls="tracking-panel"
          aria-label="Zeiterfassung"
          id="tracking-tab"
          className={activeTab === 'tracking' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('tracking')}
          onKeyDown={(e) => handleTabKeyDown(e, 'tracking')}
        >
          <span className={styles.tabIcon} aria-hidden="true">⏱️</span>
          <span className={styles.tabText}>Zeiterfassung</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'account'}
          aria-controls="account-panel"
          aria-label="Zeitkonto"
          id="account-tab"
          className={activeTab === 'account' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('account')}
          onKeyDown={(e) => handleTabKeyDown(e, 'account')}
        >
          <span className={styles.tabIcon} aria-hidden="true">📊</span>
          <span className={styles.tabText}>Zeitkonto</span>
        </button>
        {canManageTargets && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'management'}
            aria-controls="management-panel"
            aria-label="Stunden-Verwaltung"
            id="management-tab"
            className={activeTab === 'management' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('management')}
            onKeyDown={(e) => handleTabKeyDown(e, 'management')}
          >
            <span className={styles.tabIcon} aria-hidden="true">⚙️</span>
            <span className={styles.tabText}>Verwaltung</span>
          </button>
        )}
        {isAdminOrManager && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'admin'}
            aria-controls="admin-panel"
            aria-label="Zeiten-Verwaltung"
            id="admin-tab"
            className={activeTab === 'admin' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('admin')}
            onKeyDown={(e) => handleTabKeyDown(e, 'admin')}
          >
            <span className={styles.tabIcon} aria-hidden="true">👥</span>
            <span className={styles.tabText}>Zeiten-Verwaltung</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <main className={styles.content}>
        <div
          role="tabpanel"
          id="tracking-panel"
          aria-labelledby="tracking-tab"
          hidden={activeTab !== 'tracking'}
        >
          {activeTab === 'tracking' && (
            <div className={styles.trackingContent}>
        {/* Clock Card */}
        <section className={styles.clockCard} aria-labelledby="clock-title">
          <div className={styles.clockHeader}>
            <h2 id="clock-title" className={styles.clockTitle}>
              Stempeluhr
            </h2>
            <span 
              className={`${styles.statusBadge} ${isRunning ? styles.running : styles.stopped}`}
              role="status"
              aria-live="polite"
            >
              {isRunning ? '● Läuft' : '○ Gestoppt'}
            </span>
          </div>

          <div 
            className={styles.clockDisplay}
            aria-live="polite"
            aria-atomic="true"
          >
            {statusLoading ? (
              <span className={styles.clockTime}>--:--</span>
            ) : isRunning ? (
              <>
                <span className={styles.clockTime}>{formatDuration(runningTime)}</span>
                <span className={styles.clockLabel}>Aktuelle Schicht</span>
                {status?.runningEntry && (
                  <span className={styles.clockStartTime}>
                    Begonnen um {formatTime(status.runningEntry.clockIn)}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className={styles.clockTime}>{formatDuration(todayMinutes)}</span>
                <span className={styles.clockLabel}>Heute gearbeitet</span>
              </>
            )}
          </div>

          {statusError && (
            <div className={styles.error} role="alert">
              ⚠️ {statusError}
            </div>
          )}

          <button
            onClick={handleClock}
            disabled={statusLoading || isClocking}
            className={`${styles.clockButton} ${isRunning ? styles.clockOut : styles.clockIn}`}
            aria-label={isRunning ? 'Ausstempeln' : 'Einstempeln'}
          >
            {isClocking ? (
              'Wird verarbeitet...'
            ) : isRunning ? (
              <>
                <span className={styles.clockIcon} aria-hidden="true">⏹️</span>
                Ausstempeln
              </>
            ) : (
              <>
                <span className={styles.clockIcon} aria-hidden="true">▶️</span>
                Einstempeln
              </>
            )}
          </button>

          {/* Today Stats */}
          <div className={styles.todayStats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{formatDuration(todayMinutes)}</span>
              <span className={styles.statLabel}>Heute gesamt</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{status?.today.entriesCount ?? 0}</span>
              <span className={styles.statLabel}>Einträge heute</span>
            </div>
          </div>
        </section>

        {/* Entries List */}
        <section className={styles.entriesCard} aria-labelledby="entries-title">
          <div className={styles.entriesHeader}>
            <h2 id="entries-title" className={styles.entriesTitle}>
              📋 Zeiteinträge
            </h2>
            <button 
              onClick={() => {
                refreshEntries();
                refreshStatus();
              }} 
              className={styles.refreshButton}
              aria-label="Liste aktualisieren"
            >
              🔄 Aktualisieren
            </button>
          </div>

          {entriesLoading && (
            <div className={styles.loading} role="status" aria-live="polite">
              <div className={styles.loadingSpinner} aria-hidden="true"></div>
              <span>Einträge werden geladen...</span>
            </div>
          )}
          
          {entriesError && (
            <div className={styles.error} role="alert">
              ⚠️ {entriesError}
            </div>
          )}

          {!entriesLoading && entries.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">📭</span>
              <p className={styles.emptyText}>Noch keine Einträge vorhanden.</p>
              <p className={styles.emptyHint}>
                Stempel dich ein oder füge manuell einen Eintrag hinzu.
              </p>
            </div>
          )}

          {!entriesLoading && entries.length > 0 && (
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
                    <TimeEntryRow
                      key={entry.id}
                      entry={entry}
                      onEdit={() => setEditingEntry(entry)}
                      onDelete={() => setDeletingEntry(entry)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
            </div>
          )}
        </div>

        <div
          role="tabpanel"
          id="account-panel"
          aria-labelledby="account-tab"
          hidden={activeTab !== 'account'}
        >
          {activeTab === 'account' && (
            <TimeAccountSection
              year={new Date().getFullYear()}
              month={new Date().getMonth() + 1}
            />
          )}
        </div>

        {canManageTargets && (
          <div
            role="tabpanel"
            id="management-panel"
            aria-labelledby="management-tab"
            hidden={activeTab !== 'management'}
          >
            {activeTab === 'management' && <TimeAccountManagementSection />}
          </div>
        )}

        {isAdminOrManager && (
          <div
            role="tabpanel"
            id="admin-panel"
            aria-labelledby="admin-tab"
            hidden={activeTab !== 'admin'}
          >
            {activeTab === 'admin' && <AdminTimeTrackingSection />}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <EntryModal
          onSubmit={async (data) => {
            if ('clockIn' in data && 'clockOut' in data) {
              await handleCreateEntry(data as CreateTimeEntryRequest);
            }
          }}
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

      {deletingEntry && (
        <ConfirmDeleteModal
          entry={deletingEntry}
          onConfirm={handleDeleteEntry}
          onClose={() => setDeletingEntry(null)}
        />
      )}

      {breakSuggestion && (
        <BreakSuggestionDialog
          requiredMinutes={breakSuggestion.requiredMinutes}
          reason={breakSuggestion.reason}
          onAccept={() => {
            setBreakSuggestion(null);
            refreshEntries();
            refreshStatus();
          }}
          onDismiss={() => setBreakSuggestion(null)}
        />
      )}
    </div>
  );
}
