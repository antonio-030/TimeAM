/**
 * Time Account Adjustment Dialog
 *
 * Dialog für manuelle Zeitkonto-Anpassungen (nur Admin/Manager).
 * WCAG 2.2 AA konform.
 */

import { useState, useEffect, useRef } from 'react';
import { useTimeAccountAdjustment } from './hooks';
import { useTenant } from '../../core/tenant';
import styles from './TimeAccountAdjustmentDialog.module.css';

interface TimeAccountAdjustmentDialogProps {
  year: number;
  month: number;
  onClose: () => void;
}

export function TimeAccountAdjustmentDialog({
  year,
  month,
  onClose,
}: TimeAccountAdjustmentDialogProps) {
  const { role } = useTenant();
  const { addAdjustment, loading, error } = useTimeAccountAdjustment();
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState('');
  const [amountHours, setAmountHours] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ESC zum Schließen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isSubmitting]);

  // Fokus auf erstes Input-Feld
  useEffect(() => {
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, []);

  // Backdrop-Klick schließt Dialog
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalRef.current && !isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!userId.trim()) {
      setSubmitError('User-ID ist erforderlich');
      return;
    }

    const amount = parseFloat(amountHours);
    if (isNaN(amount) || amount === 0) {
      setSubmitError('Ungültiger Betrag');
      return;
    }

    if (!reason.trim()) {
      setSubmitError('Grund ist erforderlich');
      return;
    }

    setIsSubmitting(true);

    try {
      await addAdjustment(year, month, {
        userId: userId.trim(),
        amountHours: amount,
        reason: reason.trim(),
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      ref={modalRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-labelledby="adjustment-dialog-title"
      aria-modal="true"
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 id="adjustment-dialog-title" className={styles.modalTitle}>
            Zeitkonto-Anpassung hinzufügen
          </h2>
          <button
            onClick={onClose}
            className={styles.modalClose}
            aria-label="Schließen"
            type="button"
            disabled={isSubmitting}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {(error || submitError) && (
            <div className={styles.error} role="alert" aria-live="polite">
              {error || submitError}
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="userId" className={styles.formLabel}>
              User-ID <span aria-label="erforderlich">*</span>
            </label>
            <input
              id="userId"
              ref={firstInputRef}
              type="text"
              className={styles.formInput}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="uid123"
              required
              aria-required="true"
              aria-describedby={submitError ? 'userId-error' : undefined}
              disabled={isSubmitting}
            />
            {submitError && (
              <span id="userId-error" className={styles.formError} aria-live="polite">
                {submitError}
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="amountHours" className={styles.formLabel}>
              Betrag (Stunden) <span aria-label="erforderlich">*</span>
            </label>
            <input
              id="amountHours"
              type="number"
              step="0.25"
              className={styles.formInput}
              value={amountHours}
              onChange={(e) => setAmountHours(e.target.value)}
              placeholder="2.5"
              required
              aria-required="true"
              aria-describedby="amountHours-help"
              disabled={isSubmitting}
            />
            <span id="amountHours-help" className={styles.formHelp}>
              Positiv für Plusstunden, negativ für Minusstunden
            </span>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="reason" className={styles.formLabel}>
              Grund <span aria-label="erforderlich">*</span>
            </label>
            <textarea
              id="reason"
              className={styles.formTextarea}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z.B. Manuelle Korrektur, Überstundenauszahlung"
              required
              aria-required="true"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isSubmitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting || loading}
              aria-busy={isSubmitting || loading}
            >
              {isSubmitting || loading ? 'Wird hinzugefügt...' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

