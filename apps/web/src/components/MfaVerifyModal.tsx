/**
 * MFA Verify Modal
 *
 * Modal für MFA-Code-Verifizierung beim Login.
 */

import { useState, useEffect, useRef } from 'react';
import { verifyMfa } from '../core/mfa/api';
import styles from './MfaVerifyModal.module.css';

interface MfaVerifyModalProps {
  open: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function MfaVerifyModal({ open, onSuccess, onCancel }: MfaVerifyModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC zum Schließen (nur wenn onCancel vorhanden)
  useEffect(() => {
    if (!open || !onCancel) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, loading, onCancel]);

  // Reset beim Öffnen
  useEffect(() => {
    if (open) {
      setCode('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleVerify = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!code || code.length !== 6) {
      setError('Bitte geben Sie einen 6-stelligen Code ein');
      return;
    }

    // Flag setzen, um zu verhindern, dass das Modal während der Verifizierung wieder geöffnet wird
    sessionStorage.setItem('mfa_verifying', 'true');
    setLoading(true);
    setError(null);

    try {
      await verifyMfa(code);
      // Flag löschen vor onSuccess, damit das Modal nicht wieder geöffnet wird
      sessionStorage.removeItem('mfa_verifying');
      onSuccess();
    } catch (err) {
      // Flag löschen auch bei Fehler
      sessionStorage.removeItem('mfa_verifying');
      const errorMessage = err instanceof Error ? err.message : 'Ungültiger Code. Bitte versuchen Sie es erneut.';
      
      // Spezielle Behandlung für korrupte Secrets
      // WICHTIG: Bei korrupten Secrets wird der User NICHT automatisch eingeloggt!
      // Der User muss Support kontaktieren, um MFA zurückzusetzen.
      if (err instanceof Error && (
        err.message.includes('corrupted') || 
        (err as any).code === 'MFA_SECRET_CORRUPTED'
      )) {
        setError('Ihr MFA-Secret ist beschädigt. Bitte kontaktieren Sie den Support, um MFA zurückzusetzen. Sie werden jetzt ausgeloggt.');
        // Nach 5 Sekunden ausloggen
        setTimeout(() => {
          if (onCancel) {
            onCancel();
          }
        }, 5000);
      } else if (err instanceof Error && (
        err.message.includes('reset') || 
        err.message.includes('requiresNewSetup') ||
        (err as any).code === 'MFA_SECRET_NOT_FOUND'
      )) {
        // Secret nicht gefunden - MFA wurde nie eingerichtet
        setError('MFA wurde noch nicht eingerichtet. Bitte richten Sie MFA in den Einstellungen ein.');
        // Nach 3 Sekunden ausloggen
        setTimeout(() => {
          if (onCancel) {
            onCancel();
          }
        }, 3000);
      } else {
        setError(errorMessage);
        setCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length === 6 && !loading) {
      e.preventDefault();
      e.stopPropagation();
      handleVerify();
    }
  };

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} ref={modalRef}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Zwei-Faktor-Authentifizierung</h2>
            <p className={styles.modalSubtitle}>
              Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein
            </p>
          </div>
        </div>

        {/* Content */}
        <div className={styles.modalBody}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.verifyContent}>
            <div className={styles.iconContainer}>
              <div className={styles.icon}>🔐</div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (code.length === 6 && !loading) {
                  handleVerify();
                }
              }}
            >
              <div className={styles.codeInput}>
                <label className={styles.label}>6-stelliger Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(value);
                    setError(null);
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="000000"
                  className={styles.input}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </form>

            <div className={styles.actions}>
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className={styles.verifyButton}
              >
                {loading ? 'Wird verifiziert...' : 'Verifizieren'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onCancel) {
                    onCancel();
                  }
                }}
                disabled={loading}
                className={styles.cancelButton}
              >
                Abbrechen
              </button>
            </div>

            <p className={styles.hint}>
              Sie können auch einen Backup-Code verwenden, falls Sie keinen Zugriff auf Ihre Authenticator-App haben.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

