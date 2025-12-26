/**
 * MFA Setup Modal
 *
 * Modal für MFA-Setup mit QR-Code und Code-Verifizierung.
 */

import { useState, useEffect, useRef } from 'react';
import { setupMfa, verifySetupMfa } from '../core/mfa/api';
import { useTenant } from '../core/tenant';
import { ENTITLEMENT_KEYS } from '@timeam/shared';
import styles from './MfaSetupModal.module.css';

interface MfaSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type SetupStep = 'qr' | 'verify';

export function MfaSetupModal({ open, onClose, onSuccess }: MfaSetupModalProps) {
  const { hasEntitlement } = useTenant();
  const mfaModuleEnabled = hasEntitlement(ENTITLEMENT_KEYS.MODULE_MFA);
  const modalRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<SetupStep>('qr');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);

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

  // Setup starten - nur wenn Modul aktiviert ist
  useEffect(() => {
    if (open && step === 'qr' && !qrCode && mfaModuleEnabled) {
      startSetup();
    } else if (open && !mfaModuleEnabled) {
      setError('MFA-Modul ist nicht aktiviert. Bitte kontaktieren Sie Ihren Administrator.');
    }
  }, [open, step, qrCode, mfaModuleEnabled]);

  const startSetup = async () => {
    // Sicherheitscheck: Modul muss aktiviert sein
    if (!mfaModuleEnabled) {
      setError('MFA-Modul ist nicht aktiviert. Bitte kontaktieren Sie Ihren Administrator.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await setupMfa();
      setQrCode(response.qrCode);
      setSecret(response.secret);
      setBackupCodes(response.backupCodes);
    } catch (err) {
      // Nur Fehler loggen, wenn es kein Entitlement-Fehler ist
      if (err instanceof Error && !err.message.includes('Missing entitlements')) {
        setError(err.message);
      } else {
        setError('MFA-Modul ist nicht aktiviert. Bitte kontaktieren Sie Ihren Administrator.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Bitte geben Sie einen 6-stelligen Code ein');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verifySetupMfa(verificationCode);
      setShowBackupCodes(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ungültiger Code. Bitte versuchen Sie es erneut.');
      setVerificationCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    onSuccess?.();
    onClose();
    // Reset
    setStep('qr');
    setQrCode(null);
    setSecret(null);
    setBackupCodes([]);
    setVerificationCode('');
    setShowBackupCodes(false);
    setError(null);
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
              {step === 'qr' 
                ? 'Scannen Sie den QR-Code mit Ihrer Authenticator-App'
                : showBackupCodes
                ? 'MFA erfolgreich aktiviert!'
                : 'Geben Sie den Code aus Ihrer App ein'}
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
          {loading && !qrCode && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Setup wird vorbereitet...</p>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          {step === 'qr' && qrCode && (
            <div className={styles.setupContent}>
              <div className={styles.qrContainer}>
                {/* Backend gibt bereits Base64-encoded QR-Code zurück */}
                <img src={qrCode} alt="MFA QR Code" style={{ width: '256px', height: '256px' }} />
              </div>
              
              <div className={styles.instructions}>
                <h3>Schritt 1: QR-Code scannen</h3>
                <ol>
                  <li>Öffnen Sie eine Authenticator-App auf Ihrem Smartphone (z.B. Google Authenticator, Authy, Microsoft Authenticator)</li>
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
                onClick={handleVerify}
                disabled={loading || verificationCode.length !== 6}
                className={styles.verifyButton}
              >
                {loading ? 'Wird verifiziert...' : 'Code verifizieren'}
              </button>
            </div>
          )}

          {showBackupCodes && (
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
        </div>
      </div>
    </div>
  );
}

