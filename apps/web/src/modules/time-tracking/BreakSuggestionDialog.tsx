/**
 * Break Suggestion Dialog
 *
 * Zeigt einen Pausen-Vorschlag basierend auf ArbZG an.
 * Ermöglicht es, die vorgeschlagene Pause automatisch zu übernehmen.
 */

import { useState, useEffect, useRef } from 'react';
import { createEntry } from './api';
import type { CreateTimeEntryRequest } from './api';
import styles from './BreakSuggestionDialog.module.css';

interface BreakSuggestionDialogProps {
  requiredMinutes: number;
  reason: string;
  onAccept: () => void;
  onDismiss: () => void;
}

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
 * Berechnet Start- und Endzeit für eine Pause.
 * Die Pause wird in der Mitte des aktuellen Tages platziert.
 */
function calculateBreakTimes(minutes: number): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Pause in der Mitte des Tages (12:00 Uhr)
  const breakStart = new Date(today);
  breakStart.setHours(12, 0, 0, 0);
  
  const breakEnd = new Date(breakStart);
  breakEnd.setMinutes(breakEnd.getMinutes() + minutes);
  
  return {
    start: breakStart.toISOString(),
    end: breakEnd.toISOString(),
  };
}

export function BreakSuggestionDialog({
  requiredMinutes,
  reason,
  onAccept,
  onDismiss,
}: BreakSuggestionDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap und Keyboard-Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
      // Tab-Navigation innerhalb des Dialogs
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    firstButtonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onDismiss]);

  const handleAccept = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const { start, end } = calculateBreakTimes(requiredMinutes);
      
      const breakEntry: CreateTimeEntryRequest = {
        clockIn: start,
        clockOut: end,
        entryType: 'break',
        note: 'Automatisch vorgeschlagene Pause (ArbZG)',
      };

      await createEntry(breakEntry);
      onAccept();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen der Pause');
      setIsCreating(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="break-suggestion-title"
      aria-describedby="break-suggestion-description"
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="document"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div className={styles.icon} aria-hidden="true">
            ☕
          </div>
          <h2 id="break-suggestion-title" className={styles.title}>
            Pausen-Vorschlag
          </h2>
        </div>

        <div className={styles.content}>
          <p id="break-suggestion-description" className={styles.reason}>
            {reason}
          </p>

          <div className={styles.suggestion}>
            <span className={styles.suggestionLabel}>Vorgeschlagene Pause:</span>
            <span className={styles.suggestionValue}>
              {formatDuration(requiredMinutes)}
            </span>
          </div>

          {error && (
            <div className={styles.error} role="alert">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            ref={firstButtonRef}
            type="button"
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={onDismiss}
            disabled={isCreating}
            aria-label="Später erinnern"
          >
            Später
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={handleAccept}
            disabled={isCreating}
            aria-label="Pause übernehmen"
          >
            {isCreating ? 'Wird erstellt...' : '☕ Pause übernehmen'}
          </button>
        </div>
      </div>
    </div>
  );
}

