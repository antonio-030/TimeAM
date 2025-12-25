/**
 * Freelancer Detail Modal
 * 
 * Zeigt detaillierte Informationen über einen Freelancer für Security-Firmen.
 */

import { VerificationBadge } from '../../components/VerificationBadge';
import styles from './FreelancerDetailModal.module.css';

interface FreelancerProfile {
  displayName: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  address?: string;
  businessLicenseNumber?: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  verificationSubmittedAt?: string;
  verificationReviewedAt?: string;
}

interface FreelancerDetailModalProps {
  freelancerProfile: FreelancerProfile;
  email: string;
  note?: string;
  onClose: () => void;
}

export function FreelancerDetailModal({
  freelancerProfile,
  email,
  note,
  onClose,
}: FreelancerDetailModalProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '–';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose} aria-label="Schließen">
          ✕
        </button>

        <h2 className={styles.modalTitle}>👤 Freelancer-Profil</h2>

        <div className={styles.profileSection}>
          <div className={styles.profileHeader}>
            <div className={styles.profileInfo}>
              <h3 className={styles.profileName}>
                {freelancerProfile.firstName && freelancerProfile.lastName
                  ? `${freelancerProfile.firstName} ${freelancerProfile.lastName}`
                  : freelancerProfile.displayName}
              </h3>
              <p className={styles.profileEmail}>{email}</p>
            </div>
            {freelancerProfile.verificationStatus && (
              <VerificationBadge
                status={freelancerProfile.verificationStatus}
                size="medium"
                showLabel={true}
              />
            )}
          </div>

          {note && (
            <div className={styles.noteSection}>
              <strong>Nachricht:</strong>
              <p className={styles.noteText}>„{note}"</p>
            </div>
          )}

          <div className={styles.detailsGrid}>
            {freelancerProfile.companyName && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>🏢 Firma:</span>
                <span className={styles.detailValue}>{freelancerProfile.companyName}</span>
              </div>
            )}

            {freelancerProfile.phone && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>📞 Telefon:</span>
                <span className={styles.detailValue}>{freelancerProfile.phone}</span>
              </div>
            )}

            {freelancerProfile.address && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>📍 Adresse:</span>
                <span className={styles.detailValue}>{freelancerProfile.address}</span>
              </div>
            )}

            {freelancerProfile.businessLicenseNumber && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>📄 Gewerbeschein-Nr.:</span>
                <span className={styles.detailValue}>{freelancerProfile.businessLicenseNumber}</span>
              </div>
            )}

            {freelancerProfile.verificationStatus && (
              <>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>✅ Verifizierungsstatus:</span>
                  <span className={styles.detailValue}>
                    {freelancerProfile.verificationStatus === 'approved' && '✓ Verifiziert'}
                    {freelancerProfile.verificationStatus === 'pending' && '⏳ In Prüfung'}
                    {freelancerProfile.verificationStatus === 'rejected' && '✗ Abgelehnt'}
                  </span>
                </div>

                {freelancerProfile.verificationSubmittedAt && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>📅 Eingereicht am:</span>
                    <span className={styles.detailValue}>
                      {formatDate(freelancerProfile.verificationSubmittedAt)}
                    </span>
                  </div>
                )}

                {freelancerProfile.verificationReviewedAt && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>✅ Geprüft am:</span>
                    <span className={styles.detailValue}>
                      {formatDate(freelancerProfile.verificationReviewedAt)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {freelancerProfile.verificationStatus === 'approved' && (
            <div className={styles.verificationInfo}>
              <span className={styles.verificationIcon}>✓</span>
              <div>
                <strong>Verifizierter Freelancer</strong>
                <p>Dieser Freelancer hat seinen Gewerbeschein erfolgreich verifiziert und kann Rechnungen schreiben.</p>
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.button} onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

