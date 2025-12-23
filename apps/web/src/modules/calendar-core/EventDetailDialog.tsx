/**
 * Event Detail Dialog
 *
 * Modal/Bottom-Sheet für Event-Details.
 * Vollständig barrierefrei (Fokus-Management, ESC, ARIA).
 */

import { useRef, useEffect, useCallback } from 'react';
import type { CalendarEvent } from '@timeam/shared';
import styles from './CalendarPage.module.css';

interface EventDetailDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}

/**
 * Formatiert ISO-Datum für Anzeige.
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatiert nur Zeit.
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Berechnet Dauer in Stunden und Minuten.
 */
function formatDuration(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) {
    return `${minutes} Min.`;
  }
  if (minutes === 0) {
    return `${hours} Std.`;
  }
  return `${hours} Std. ${minutes} Min.`;
}

export function EventDetailDialog({
  event,
  open,
  onClose,
  isMobile,
}: EventDetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Dialog öffnen/schließen
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
      // Fokus auf Close-Button setzen
      closeButtonRef.current?.focus();
    } else {
      dialog.close();
    }
  }, [open]);

  // ESC Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Backdrop Click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  if (!event) return null;

  const isShift = event.sourceModule === 'shift-pool';
  const isRunning = event.meta?.isRunning ?? false;
  const badge = isShift ? '📋' : '⏱️';
  const typeLabel = isShift ? 'Schicht' : 'Arbeitszeit';

  // Deep Link zur Detailseite
  const detailLink = isShift
    ? `/shifts/${event.ref.id}`
    : `/time-tracking/${event.ref.id}`;

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${isMobile ? styles.dialogBottomSheet : ''}`}
      onClick={handleBackdropClick}
      aria-labelledby="event-dialog-title"
      aria-describedby="event-dialog-description"
    >
      <div className={styles.dialogContent}>
        {/* Header */}
        <div className={styles.dialogHeader}>
          <div className={styles.dialogTitleRow}>
            <span className={styles.dialogBadge} aria-hidden="true">
              {badge}
            </span>
            <h2 id="event-dialog-title" className={styles.dialogTitle}>
              {event.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={styles.dialogCloseButton}
            aria-label="Dialog schließen"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div id="event-dialog-description" className={styles.dialogBody}>
          {/* Typ */}
          <div className={styles.dialogRow}>
            <span className={styles.dialogLabel}>Typ:</span>
            <span className={styles.dialogValue}>
              {typeLabel}
              {isRunning && (
                <span className={styles.runningBadge}>läuft</span>
              )}
            </span>
          </div>

          {/* Datum */}
          <div className={styles.dialogRow}>
            <span className={styles.dialogLabel}>Datum:</span>
            <span className={styles.dialogValue}>
              {formatDateTime(event.startsAt).split(',')[0]}
            </span>
          </div>

          {/* Zeit */}
          <div className={styles.dialogRow}>
            <span className={styles.dialogLabel}>Zeit:</span>
            <span className={styles.dialogValue}>
              {formatTime(event.startsAt)} - {formatTime(event.endsAt)}
            </span>
          </div>

          {/* Dauer */}
          <div className={styles.dialogRow}>
            <span className={styles.dialogLabel}>Dauer:</span>
            <span className={styles.dialogValue}>
              {event.meta?.durationMinutes
                ? `${Math.floor(event.meta.durationMinutes / 60)} Std. ${event.meta.durationMinutes % 60} Min.`
                : formatDuration(event.startsAt, event.endsAt)}
            </span>
          </div>

          {/* Ort */}
          {event.location && (
            <div className={styles.dialogRow}>
              <span className={styles.dialogLabel}>Ort:</span>
              <span className={styles.dialogValue}>{event.location}</span>
            </div>
          )}

          {/* Status */}
          {event.status && (
            <div className={styles.dialogRow}>
              <span className={styles.dialogLabel}>Status:</span>
              <span className={styles.dialogValue}>{event.status}</span>
            </div>
          )}

          {/* Schicht-spezifisch: Freie Plätze */}
          {isShift && event.meta?.freeSlots !== undefined && (
            <div className={styles.dialogRow}>
              <span className={styles.dialogLabel}>Freie Plätze:</span>
              <span className={styles.dialogValue}>{event.meta.freeSlots}</span>
            </div>
          )}

          {/* Schicht-spezifisch: Bewerbungsstatus */}
          {isShift && event.meta?.myApplicationStatus && (
            <div className={styles.dialogRow}>
              <span className={styles.dialogLabel}>Meine Bewerbung:</span>
              <span className={styles.dialogValue}>
                {event.meta.myApplicationStatus}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.dialogFooter}>
          <button
            type="button"
            onClick={onClose}
            className={styles.dialogSecondaryButton}
          >
            Schließen
          </button>
          {/* Deep-Link zu Modul-Detailseite - vorerst als Hinweis */}
          <button
            type="button"
            className={styles.dialogPrimaryButton}
            onClick={() => {
              // TODO: Navigation zur Detailseite implementieren
              console.log('Navigate to:', detailLink);
              alert(`Navigation zu ${detailLink} - wird in Zukunft implementiert`);
            }}
          >
            Details öffnen
          </button>
        </div>
      </div>
    </dialog>
  );
}
