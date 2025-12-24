/**
 * Freelancer Dashboard
 *
 * Übersicht für Freelancer mit allen Bewerbungen.
 */

import { useState, useEffect, useCallback } from 'react';
import { getFreelancerApplications, type FreelancerApplication, getFreelancer, getVerificationStatus, type VerificationStatus } from './api';
import { APPLICATION_STATUS } from '@timeam/shared';
import { VerificationUploadForm } from '../../components/VerificationUploadForm';
import styles from './FreelancerDashboard.module.css';

export function FreelancerDashboard() {
  const [applications, setApplications] = useState<FreelancerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | undefined>(undefined);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [applicationsData, freelancerData] = await Promise.all([
        getFreelancerApplications(),
        getFreelancer(),
      ]);
      setApplications(applicationsData.applications);
      setVerificationStatus(freelancerData.freelancer.verificationStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVerificationStatus = useCallback(async () => {
    try {
      const statusResponse = await getVerificationStatus();
      setVerificationStatus(statusResponse.verificationStatus || undefined);
    } catch (err) {
      console.error('Fehler beim Laden des Verifizierungsstatus:', err);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case APPLICATION_STATUS.PENDING:
        return '⏳ Ausstehend';
      case APPLICATION_STATUS.ACCEPTED:
        return '✅ Angenommen';
      case APPLICATION_STATUS.REJECTED:
        return '❌ Abgelehnt';
      case APPLICATION_STATUS.WITHDRAWN:
        return '↩️ Zurückgezogen';
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case APPLICATION_STATUS.PENDING:
        return styles.statusPending;
      case APPLICATION_STATUS.ACCEPTED:
        return styles.statusAccepted;
      case APPLICATION_STATUS.REJECTED:
        return styles.statusRejected;
      case APPLICATION_STATUS.WITHDRAWN:
        return styles.statusWithdrawn;
      default:
        return '';
    }
  };

  const pendingApps = applications.filter((app) => app.status === APPLICATION_STATUS.PENDING);
  const acceptedApps = applications.filter((app) => app.status === APPLICATION_STATUS.ACCEPTED);
  const rejectedApps = applications.filter((app) => app.status === APPLICATION_STATUS.REJECTED);

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>Freelancer Dashboard</h1>
        <p className={styles.subtitle}>Übersicht deiner Bewerbungen</p>
      </div>

      {loading && (
        <div className={styles.loading}>
          <p>Laden...</p>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={loadApplications} className={styles.retryBtn}>
            Erneut versuchen
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <VerificationUploadForm
            currentStatus={verificationStatus}
            onStatusChange={(status) => {
              setVerificationStatus(status);
              loadVerificationStatus();
            }}
          />

          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{pendingApps.length}</div>
              <div className={styles.statLabel}>Ausstehend</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{acceptedApps.length}</div>
              <div className={styles.statLabel}>Angenommen</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{rejectedApps.length}</div>
              <div className={styles.statLabel}>Abgelehnt</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{applications.length}</div>
              <div className={styles.statLabel}>Gesamt</div>
            </div>
          </div>

          <div className={styles.applications}>
            <h2 className={styles.sectionTitle}>Meine Bewerbungen</h2>

            {applications.length === 0 ? (
              <div className={styles.empty}>
                <p>Du hast noch keine Bewerbungen abgegeben.</p>
                <a href="/freelancer-pool" className={styles.linkToPool}>
                  Zu den verfügbaren Schichten
                </a>
              </div>
            ) : (
              <div className={styles.applicationsList}>
                {applications.map((app) => (
                  <div key={app.id} className={styles.applicationCard}>
                    <div className={styles.applicationHeader}>
                      <h3 className={styles.shiftTitle}>{app.shiftTitle}</h3>
                      <span className={`${styles.status} ${getStatusClass(app.status)}`}>
                        {getStatusLabel(app.status)}
                      </span>
                    </div>
                    <div className={styles.applicationDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Firma:</span>
                        <span className={styles.detailValue}>{app.tenantName}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Datum:</span>
                        <span className={styles.detailValue}>{formatDate(app.shiftStartsAt)}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Zeit:</span>
                        <span className={styles.detailValue}>{formatTime(app.shiftStartsAt)}</span>
                      </div>
                      {app.note && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Nachricht:</span>
                          <span className={styles.detailValue}>{app.note}</span>
                        </div>
                      )}
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Beworben am:</span>
                        <span className={styles.detailValue}>{formatDate(app.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

