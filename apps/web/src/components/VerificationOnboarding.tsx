/**
 * Verification Onboarding
 *
 * Modernes Onboarding für die Freelancer-Verifizierung als Modal.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { VerificationUploadForm } from './VerificationUploadForm';
import type { VerificationStatus } from '../modules/freelancer/api';
import styles from './VerificationOnboarding.module.css';

interface VerificationOnboardingProps {
  currentStatus?: VerificationStatus;
  onStatusChange?: (status: VerificationStatus) => void;
  onComplete?: () => void;
  open?: boolean;
  onClose?: () => void;
}

export function VerificationOnboarding({
  currentStatus,
  onStatusChange,
  onComplete,
  open = true,
  onClose,
}: VerificationOnboardingProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC-Taste zum Schließen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Backdrop Click
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalRef.current) {
      onClose?.();
    }
  }, [onClose]);

  // Wenn bereits approved, Modal nicht anzeigen
  if (currentStatus === 'approved' || !open) {
    return null;
  }

  // Wenn rejected, direkt zum Upload-Schritt
  const initialStep = currentStatus === 'rejected' ? 2 : 0;
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Wenn Status sich ändert, Step anpassen
  useEffect(() => {
    if (currentStatus === 'rejected') {
      setCurrentStep(2);
    } else if (currentStatus === 'pending') {
      setCurrentStep(3); // Status-Anzeige Schritt
    }
  }, [currentStatus]);

  const steps = [
    {
      title: 'Warum Verifizierung?',
      icon: '🎯',
      description: 'Mit einer verifizierten Gewerbeanmeldung können Sie sich auf Schichten bewerben und Rechnungen schreiben.',
      benefits: [
        'Bewerbung auf Schichten möglich',
        'Rechnungen schreiben',
        'Vertrauen bei Unternehmen',
        'Professionelles Profil',
      ],
    },
    {
      title: 'Was wird benötigt?',
      icon: '📄',
      description: 'Laden Sie Ihren Gewerbeschein hoch. Wir prüfen ihn schnell und unkompliziert.',
      requirements: [
        'Gewerbeschein als PDF oder Foto',
        'Maximale Dateigröße: 10MB',
        'Erlaubte Formate: PDF, JPG, PNG',
        'Prüfung dauert meist 1-2 Werktage',
      ],
    },
    {
      title: 'Dokument hochladen',
      icon: '📤',
      description: 'Laden Sie jetzt Ihren Gewerbeschein hoch.',
      showUpload: true,
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStatusChange = (status: VerificationStatus) => {
    if (status === 'pending') {
      // Wenn pending, zum letzten Schritt (Status-Anzeige)
      setCurrentStep(steps.length);
    }
    onStatusChange?.(status);
  };

  // Status-Anzeige Schritt (nach Upload)
  if (currentStep >= steps.length) {
    return (
      <div className={styles.modalOverlay} ref={modalRef} onClick={handleBackdropClick}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          {onClose && (
            <button
              onClick={() => {
                onClose();
              }}
              className={styles.modalClose}
              aria-label="Schließen"
              type="button"
            >
              ✕
            </button>
          )}
          <div className={styles.statusHeader}>
            <span className={styles.statusIcon}>⏳</span>
            <h2 className={styles.statusTitle}>Verifizierung eingereicht</h2>
          </div>
          <div className={styles.statusContent}>
            <p className={styles.statusDescription}>
              Ihr Gewerbeschein wurde erfolgreich hochgeladen und wird nun geprüft.
            </p>
            <div className={styles.statusInfo}>
              <div className={styles.statusInfoItem}>
                <span className={styles.statusInfoIcon}>📋</span>
                <div>
                  <strong>Prüfung läuft</strong>
                  <p>Ihr Dokument wird von unserem Team geprüft</p>
                </div>
              </div>
              <div className={styles.statusInfoItem}>
                <span className={styles.statusInfoIcon}>⏱️</span>
                <div>
                  <strong>Dauer</strong>
                  <p>Meist 1-2 Werktage</p>
                </div>
              </div>
              <div className={styles.statusInfoItem}>
                <span className={styles.statusInfoIcon}>🔔</span>
                <div>
                  <strong>Benachrichtigung</strong>
                  <p>Sie erhalten eine E-Mail, sobald die Prüfung abgeschlossen ist</p>
                </div>
              </div>
            </div>
            {currentStatus === 'rejected' && (
              <div className={styles.rejectionNotice}>
                <strong>Hinweis:</strong> Falls Ihre Verifizierung abgelehnt wurde, können Sie ein neues Dokument hochladen.
              </div>
            )}
            <div className={styles.modalActions}>
              <button 
                onClick={() => {
                  onClose?.();
                  onComplete?.();
                }} 
                className={styles.modalActionButton}
                type="button"
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const step = steps[currentStep];

  return (
    <div className={styles.modalOverlay} ref={modalRef} onClick={handleBackdropClick}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        {onClose && (
          <button
            onClick={() => {
              onClose();
            }}
            className={styles.modalClose}
            aria-label="Schließen"
            type="button"
          >
            ✕
          </button>
        )}

        {/* Progress Bar */}
        <div className={styles.progressBar}>
          {steps.map((_, index) => (
            <div
              key={index}
              className={`${styles.progressStep} ${index <= currentStep ? styles.progressStepActive : ''}`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className={styles.stepContent}>
          <div className={styles.stepHeader}>
            <span className={styles.stepIcon}>{step.icon}</span>
            <h2 className={styles.stepTitle}>{step.title}</h2>
          </div>

          <p className={styles.stepDescription}>{step.description}</p>

          {/* Benefits List */}
          {step.benefits && (
            <div className={styles.benefitsList}>
              {step.benefits.map((benefit, index) => (
                <div key={index} className={styles.benefitItem}>
                  <span className={styles.benefitIcon}>✓</span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          )}

          {/* Requirements List */}
          {step.requirements && (
            <div className={styles.requirementsList}>
              {step.requirements.map((requirement, index) => (
                <div key={index} className={styles.requirementItem}>
                  <span className={styles.requirementIcon}>•</span>
                  <span>{requirement}</span>
                </div>
              ))}
            </div>
          )}

          {/* Upload Form */}
          {step.showUpload && (
            <div className={styles.uploadContainer}>
              <VerificationUploadForm
                currentStatus={currentStatus}
                onStatusChange={handleStatusChange}
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className={styles.navigation}>
          {currentStep > 0 && (
            <button onClick={handleBack} className={styles.navButton} type="button">
              ← Zurück
            </button>
          )}
          <div className={styles.navSpacer} />
          {currentStep < steps.length - 1 && !step.showUpload && (
            <button onClick={handleNext} className={`${styles.navButton} ${styles.navButtonPrimary}`} type="button">
              Weiter →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

