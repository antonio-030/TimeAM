/**
 * MFA Verify Modal
 *
 * Modal für MFA-Code-Verifizierung beim Login.
 * Unterstützt TOTP und Phone Auth.
 */

import { useState, useEffect, useRef } from 'react';
import { verifyMfa, verifyPhoneMfa, getMfaStatus } from '../core/mfa/api';
import { getFirebaseAuth } from '../core/firebase';
// @ts-expect-error - Firebase types are namespaces, but we need them as types
import { signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { createRecaptchaVerifier, clearRecaptchaVerifier } from '../core/firebase';
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
  const [mfaMethod, setMfaMethod] = useState<'totp' | 'phone' | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [smsSent, setSmsSent] = useState(false);

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

  // MFA-Methode beim Öffnen ermitteln
  useEffect(() => {
    if (open) {
      setCode('');
      setError(null);
      setLoading(false);
      setSmsSent(false);
      setConfirmationResult(null);
      clearRecaptchaVerifier();
      
      // MFA-Status abrufen, um Methode zu ermitteln
      getMfaStatus()
        .then((status) => {
          if (status.method === 'phone') {
            setMfaMethod('phone');
            // Telefonnummer aus Backend holen (wird maskiert zurückgegeben)
            // Für Phone Auth müssen wir die Telefonnummer aus dem User-Objekt holen
            // oder einen separaten API-Call machen
            // Hier vereinfacht: User muss Telefonnummer erneut eingeben
          } else {
            setMfaMethod('totp');
          }
        })
        .catch((err) => {
          console.error('Fehler beim Abrufen des MFA-Status:', err);
          // Fallback: TOTP annehmen
          setMfaMethod('totp');
        });
    }
  }, [open]);

  // SMS senden für Phone Auth
  const sendSms = async () => {
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      setError('Bitte geben Sie eine gültige Telefonnummer im internationalen Format ein (z.B. +491234567890)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const auth = getFirebaseAuth();
      const recaptchaVerifier = await createRecaptchaVerifier();
      
      // SMS senden
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      setConfirmationResult(confirmation);
      setSmsSent(true);
    } catch (err) {
      clearRecaptchaVerifier();
      if (err instanceof Error) {
        if (err.message.includes('reCAPTCHA')) {
          setError('reCAPTCHA-Fehler. Bitte versuchen Sie es erneut.');
        } else if (err.message.includes('invalid-phone-number')) {
          setError('Ungültige Telefonnummer. Bitte verwenden Sie das internationale Format (z.B. +491234567890)');
        } else {
          setError(err.message);
        }
      } else {
        setError('Fehler beim Senden der SMS. Bitte versuchen Sie es erneut.');
      }
    } finally {
      setLoading(false);
    }
  };

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
      if (mfaMethod === 'phone') {
        // Phone Auth: Code mit Firebase verifizieren, dann Backend benachrichtigen
        if (!confirmationResult) {
          setError('SMS-Verifizierung nicht gestartet. Bitte senden Sie zuerst eine SMS.');
          setLoading(false);
          sessionStorage.removeItem('mfa_verifying');
          return;
        }
        
        // Firebase Phone Auth: Code verifizieren
        await confirmationResult.confirm(code);
        
        // Backend: Phone MFA Session als verifiziert markieren
        await verifyPhoneMfa();
      } else {
        // TOTP: Code mit Backend verifizieren
        await verifyMfa(code);
      }
      
      clearRecaptchaVerifier();
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
              {mfaMethod === 'phone' 
                ? (smsSent 
                    ? 'Geben Sie den SMS-Code ein, den wir Ihnen gesendet haben'
                    : 'Geben Sie Ihre Telefonnummer ein, um einen SMS-Code zu erhalten')
                : 'Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein'}
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

            {mfaMethod === 'phone' && !smsSent && (
              <div className={styles.codeInput}>
                <label className={styles.label}>Telefonnummer</label>
                <input
                  type="tel"
                  value={phoneNumber || ''}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setError(null);
                  }}
                  placeholder="+491234567890"
                  className={styles.input}
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={sendSms}
                  disabled={loading || !phoneNumber || !phoneNumber.startsWith('+')}
                  className={styles.verifyButton}
                  style={{ marginTop: '1rem' }}
                >
                  {loading ? 'SMS wird gesendet...' : 'SMS-Code senden'}
                </button>
              </div>
            )}

            {(mfaMethod === 'totp' || (mfaMethod === 'phone' && smsSent)) && (
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
                  <label className={styles.label}>
                    {mfaMethod === 'phone' ? '6-stelliger SMS-Code' : '6-stelliger Code'}
                  </label>
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
            )}

            {(mfaMethod === 'totp' || (mfaMethod === 'phone' && smsSent)) && (
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
            )}

            {mfaMethod === 'phone' && !smsSent && (
              <div className={styles.actions}>
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
            )}

            {mfaMethod === 'totp' && (
              <p className={styles.hint}>
                Sie können auch einen Backup-Code verwenden, falls Sie keinen Zugriff auf Ihre Authenticator-App haben.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

