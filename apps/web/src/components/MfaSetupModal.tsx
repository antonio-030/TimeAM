/**
 * MFA Setup Modal
 *
 * Modal für MFA-Setup mit QR-Code (TOTP) oder Telefonnummer (Phone Auth).
 */

import { useState, useEffect, useRef } from 'react';
import { setupMfa, verifySetupMfa, setupPhoneMfa, verifyPhoneMfaSetup } from '../core/mfa/api';
import { useTenant } from '../core/tenant';
import { ENTITLEMENT_KEYS } from '@timeam/shared';
import { getFirebaseAuth } from '../core/firebase';
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { createRecaptchaVerifier, clearRecaptchaVerifier } from '../core/firebase';
import type { MfaMethod } from '@timeam/shared';
import styles from './MfaSetupModal.module.css';

interface MfaSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type SetupStep = 'method' | 'totp-setup' | 'phone-setup' | 'phone-verify' | 'totp-verify' | 'success';

export function MfaSetupModal({ open, onClose, onSuccess }: MfaSetupModalProps) {
  const { hasEntitlement } = useTenant();
  const mfaModuleEnabled = hasEntitlement(ENTITLEMENT_KEYS.MODULE_MFA);
  const modalRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<SetupStep>('method');
  const [method, setMethod] = useState<MfaMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // TOTP State
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  
  // Phone Auth State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [maskedPhoneNumber, setMaskedPhoneNumber] = useState<string | null>(null);

  // Cleanup reCAPTCHA beim Schließen
  useEffect(() => {
    return () => {
      clearRecaptchaVerifier();
    };
  }, []);

  // Reset beim Öffnen
  useEffect(() => {
    if (open) {
      setStep('method');
      setMethod(null);
      setError(null);
      setQrCode(null);
      setSecret(null);
      setBackupCodes([]);
      setVerificationCode('');
      setPhoneNumber('');
      setSmsCode('');
      setConfirmationResult(null);
      setMaskedPhoneNumber(null);
      clearRecaptchaVerifier();
    }
  }, [open]);

  // ESC zum Schließen
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, loading, onClose]);

  // Backdrop-Klick schließt Modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalRef.current && !loading) {
      onClose();
    }
  };

  // TOTP Setup starten
  const startTotpSetup = async () => {
    if (!mfaModuleEnabled) {
      setError('MFA-Modul ist nicht aktiviert. Bitte kontaktieren Sie Ihren Administrator.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await setupMfa();
      setQrCode(response.qrCode || null);
      setSecret(response.secret || null);
      setBackupCodes(response.backupCodes || []);
      setStep('totp-verify');
    } catch (err) {
      if (err instanceof Error && !err.message.includes('Missing entitlements')) {
        setError(err.message);
      } else {
        setError('MFA-Modul ist nicht aktiviert. Bitte kontaktieren Sie Ihren Administrator.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Phone Auth Setup starten
  const startPhoneSetup = async () => {
    if (!mfaModuleEnabled) {
      setError('MFA-Modul ist nicht aktiviert. Bitte kontaktieren Sie Ihren Administrator.');
      return;
    }

    // Telefonnummer validieren
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      setError('Bitte geben Sie eine gültige Telefonnummer im internationalen Format ein (z.B. +491234567890)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Backend: Telefonnummer speichern
      const response = await setupPhoneMfa(phoneNumber);
      setMaskedPhoneNumber(response.phoneNumber || null);

      // Firebase Phone Auth: SMS senden
      const auth = getFirebaseAuth();
      const recaptchaVerifier = await createRecaptchaVerifier();
      
      // SMS senden
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      setConfirmationResult(confirmation);
      setStep('phone-verify');
    } catch (err) {
      clearRecaptchaVerifier();
      if (err instanceof Error) {
        // Firebase-spezifische Fehler behandeln
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

  // TOTP Code verifizieren
  const handleTotpVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Bitte geben Sie einen 6-stelligen Code ein');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verifySetupMfa(verificationCode);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ungültiger Code. Bitte versuchen Sie es erneut.');
      setVerificationCode('');
    } finally {
      setLoading(false);
    }
  };

  // Phone Auth Code verifizieren
  const handlePhoneVerify = async () => {
    if (!smsCode || smsCode.length !== 6) {
      setError('Bitte geben Sie den 6-stelligen SMS-Code ein');
      return;
    }

    if (!confirmationResult) {
      setError('SMS-Verifizierung nicht gestartet. Bitte versuchen Sie es erneut.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Firebase Phone Auth: Code verifizieren
      await confirmationResult.confirm(smsCode);
      
      // Backend: Phone MFA aktivieren
      await verifyPhoneMfaSetup();
      
      clearRecaptchaVerifier();
      setStep('success');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('invalid-verification-code')) {
          setError('Ungültiger Code. Bitte versuchen Sie es erneut.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Ungültiger Code. Bitte versuchen Sie es erneut.');
      }
      setSmsCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    onSuccess?.();
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} ref={modalRef} onClick={handleBackdropClick}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Zwei-Faktor-Authentifizierung einrichten</h2>
            <p className={styles.modalSubtitle}>
              {step === 'method' && 'Wählen Sie eine MFA-Methode'}
              {step === 'totp-setup' && 'Scannen Sie den QR-Code mit Ihrer Authenticator-App'}
              {step === 'totp-verify' && 'Geben Sie den Code aus Ihrer App ein'}
              {step === 'phone-setup' && 'Geben Sie Ihre Telefonnummer ein'}
              {step === 'phone-verify' && 'Geben Sie den SMS-Code ein'}
              {step === 'success' && 'MFA erfolgreich aktiviert!'}
            </p>
          </div>
          <button
            onClick={onClose}
            className={styles.modalClose}
            aria-label="Schließen"
            type="button"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.modalBody}>
          {error && <div className={styles.error}>{error}</div>}

          {/* Methode-Auswahl */}
          {step === 'method' && (
            <div className={styles.methodSelection}>
              <button
                onClick={() => {
                  setMethod('totp');
                  setStep('totp-setup');
                  startTotpSetup();
                }}
                disabled={loading}
                className={styles.methodButton}
              >
                <div className={styles.methodIcon}>📱</div>
                <div className={styles.methodContent}>
                  <h3>Authenticator-App (TOTP)</h3>
                  <p>Empfohlen: Verwenden Sie eine Authenticator-App wie Google Authenticator oder Authy</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setMethod('phone');
                  setStep('phone-setup');
                }}
                disabled={loading}
                className={styles.methodButton}
              >
                <div className={styles.methodIcon}>📞</div>
                <div className={styles.methodContent}>
                  <h3>SMS (Telefonnummer)</h3>
                  <p>Weniger sicher: Erhalten Sie Codes per SMS auf Ihr Telefon</p>
                </div>
              </button>
            </div>
          )}

          {/* TOTP Setup */}
          {step === 'totp-setup' && loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Setup wird vorbereitet...</p>
            </div>
          )}

          {step === 'totp-verify' && qrCode && (
            <div className={styles.setupContent}>
              <div className={styles.qrContainer}>
                <img src={qrCode} alt="MFA QR Code" style={{ width: '256px', height: '256px' }} />
              </div>
              
              <div className={styles.instructions}>
                <h3>Schritt 1: QR-Code scannen</h3>
                <ol>
                  <li>Öffnen Sie eine Authenticator-App auf Ihrem Smartphone</li>
                  <li>Scannen Sie den QR-Code oben</li>
                  <li>Geben Sie den 6-stelligen Code aus der App ein</li>
                </ol>

                {secret && (
                  <div className={styles.secretContainer}>
                    <p className={styles.secretLabel}>Oder geben Sie diesen Code manuell ein:</p>
                    <code className={styles.secretCode}>{secret}</code>
                  </div>
                )}
              </div>

              <div className={styles.codeInput}>
                <label className={styles.label}>6-stelliger Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerificationCode(value);
                    setError(null);
                  }}
                  placeholder="000000"
                  className={styles.input}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button
                onClick={handleTotpVerify}
                disabled={loading || verificationCode.length !== 6}
                className={styles.verifyButton}
              >
                {loading ? 'Wird verifiziert...' : 'Code verifizieren'}
              </button>
            </div>
          )}

          {/* Phone Auth Setup */}
          {step === 'phone-setup' && (
            <div className={styles.setupContent}>
              <div className={styles.instructions}>
                <h3>Telefonnummer eingeben</h3>
                <p>Geben Sie Ihre Telefonnummer im internationalen Format ein (z.B. +491234567890)</p>
              </div>

              <div className={styles.codeInput}>
                <label className={styles.label}>Telefonnummer</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setError(null);
                  }}
                  placeholder="+491234567890"
                  className={styles.input}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button
                onClick={startPhoneSetup}
                disabled={loading || !phoneNumber.startsWith('+')}
                className={styles.verifyButton}
              >
                {loading ? 'SMS wird gesendet...' : 'SMS-Code senden'}
              </button>
            </div>
          )}

          {/* Phone Auth Verify */}
          {step === 'phone-verify' && (
            <div className={styles.setupContent}>
              <div className={styles.instructions}>
                <h3>SMS-Code eingeben</h3>
                <p>Wir haben einen Code an {maskedPhoneNumber || phoneNumber} gesendet.</p>
              </div>

              <div className={styles.codeInput}>
                <label className={styles.label}>6-stelliger SMS-Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={smsCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setSmsCode(value);
                    setError(null);
                  }}
                  placeholder="000000"
                  className={styles.input}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button
                onClick={handlePhoneVerify}
                disabled={loading || smsCode.length !== 6}
                className={styles.verifyButton}
              >
                {loading ? 'Wird verifiziert...' : 'Code verifizieren'}
              </button>
            </div>
          )}

          {/* Success (nur für TOTP mit Backup-Codes) */}
          {step === 'success' && method === 'totp' && backupCodes.length > 0 && (
            <div className={styles.backupCodesContent}>
              <div className={styles.successMessage}>
                <div className={styles.successIcon}>✓</div>
                <h3>MFA erfolgreich aktiviert!</h3>
                <p>Bewahren Sie diese Backup-Codes sicher auf. Sie können sie verwenden, falls Sie keinen Zugriff auf Ihre Authenticator-App haben.</p>
              </div>

              <div className={styles.backupCodesList}>
                {backupCodes.map((code, index) => (
                  <div key={index} className={styles.backupCode}>
                    {code}
                  </div>
                ))}
              </div>

              <div className={styles.backupCodesWarning}>
                <strong>Wichtig:</strong> Diese Codes werden nur einmal angezeigt. Speichern Sie sie an einem sicheren Ort.
              </div>

              <button
                onClick={handleContinue}
                className={styles.continueButton}
              >
                Fertig
              </button>
            </div>
          )}

          {/* Success (für Phone Auth ohne Backup-Codes) */}
          {step === 'success' && method === 'phone' && (
            <div className={styles.backupCodesContent}>
              <div className={styles.successMessage}>
                <div className={styles.successIcon}>✓</div>
                <h3>MFA erfolgreich aktiviert!</h3>
                <p>Ihre Telefonnummer wurde erfolgreich verifiziert. Sie erhalten bei jedem Login einen SMS-Code.</p>
              </div>

              <button
                onClick={handleContinue}
                className={styles.continueButton}
              >
                Fertig
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
