/**
 * Verification Review Page
 *
 * Übersicht aller Verifizierungen für Dev-Mitarbeiter.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getVerifications,
  approveVerification,
  rejectVerification,
  getVerificationDocumentUrl,
  type VerificationOverview,
} from './api';
import styles from './VerificationReviewPage.module.css';

export function VerificationReviewPage() {
  const [verifications, setVerifications] = useState<VerificationOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerification, setSelectedVerification] = useState<VerificationOverview | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');

  const loadVerifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getVerifications();
      setVerifications(data.verifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVerifications();
  }, [loadVerifications]);

  const handleViewDocument = async (verification: VerificationOverview) => {
    setSelectedVerification(verification);
    setDocumentUrl(null);

    try {
      const response = await getVerificationDocumentUrl(verification.freelancerUid);
      setDocumentUrl(response.url);
    } catch (err) {
      console.error('Fehler beim Laden des Dokuments:', err);
      setError('Fehler beim Laden des Dokuments');
    }
  };

  const handleApproveClick = (freelancerUid: string) => {
    const verification = verifications.find(v => v.freelancerUid === freelancerUid);
    setCompanyName(verification?.companyName || '');
    setShowApproveModal(freelancerUid);
  };

  const handleApprove = async (freelancerUid: string) => {
    if (!companyName.trim() || companyName.trim().length < 2) {
      alert('Bitte geben Sie einen Firmennamen ein (mindestens 2 Zeichen)');
      return;
    }

    setActionInProgress(freelancerUid);

    try {
      await approveVerification({ freelancerUid, companyName: companyName.trim() });
      await loadVerifications();
      setShowApproveModal(null);
      setCompanyName('');
      if (selectedVerification?.freelancerUid === freelancerUid) {
        setSelectedVerification(null);
        setDocumentUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Genehmigen');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (freelancerUid: string) => {
    if (!rejectReason.trim() || rejectReason.trim().length < 3) {
      alert('Bitte geben Sie einen Ablehnungsgrund ein (mindestens 3 Zeichen)');
      return;
    }

    if (!confirm('Verifizierung wirklich ablehnen?')) {
      return;
    }

    setActionInProgress(freelancerUid);

    try {
      await rejectVerification({ freelancerUid, reason: rejectReason.trim() });
      await loadVerifications();
      setRejectReason('');
      if (selectedVerification?.freelancerUid === freelancerUid) {
        setSelectedVerification(null);
        setDocumentUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Ablehnen');
    } finally {
      setActionInProgress(null);
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'pending':
        return '⏳ Ausstehend';
      case 'approved':
        return '✅ Genehmigt';
      case 'rejected':
        return '❌ Abgelehnt';
      default:
        return 'Nicht eingereicht';
    }
  };

  const getStatusClass = (status: string | null) => {
    switch (status) {
      case 'pending':
        return styles.statusPending;
      case 'approved':
        return styles.statusApproved;
      case 'rejected':
        return styles.statusRejected;
      default:
        return '';
    }
  };

  const pendingVerifications = verifications.filter((v) => v.verificationStatus === 'pending');
  const approvedVerifications = verifications.filter((v) => v.verificationStatus === 'approved');
  const rejectedVerifications = verifications.filter((v) => v.verificationStatus === 'rejected');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Verifizierungen</h1>
        <p className={styles.subtitle}>Gewerbescheine prüfen und freigeben</p>
      </div>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={loadVerifications} className={styles.retryBtn}>
            Erneut versuchen
          </button>
        </div>
      )}

      {loading && (
        <div className={styles.loading}>
          <p>Laden...</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{pendingVerifications.length}</div>
              <div className={styles.statLabel}>Ausstehend</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{approvedVerifications.length}</div>
              <div className={styles.statLabel}>Genehmigt</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{rejectedVerifications.length}</div>
              <div className={styles.statLabel}>Abgelehnt</div>
            </div>
          </div>

          <div className={styles.content}>
            <div className={styles.list}>
              <h2 className={styles.sectionTitle}>Ausstehende Verifizierungen</h2>
              {pendingVerifications.length === 0 ? (
                <div className={styles.empty}>
                  <p>Keine ausstehenden Verifizierungen</p>
                </div>
              ) : (
                <div className={styles.verificationList}>
                  {pendingVerifications.map((verification) => (
                    <div key={verification.freelancerUid} className={styles.verificationCard}>
                      <div className={styles.verificationInfo}>
                        <h3 className={styles.verificationName}>{verification.displayName}</h3>
                        <p className={styles.verificationEmail}>{verification.email}</p>
                        {verification.companyName && (
                          <p className={styles.verificationCompany}>Firma: {verification.companyName}</p>
                        )}
                        {verification.businessLicenseNumber && (
                          <p className={styles.verificationLicense}>
                            Gewerbeschein-Nr.: {verification.businessLicenseNumber}
                          </p>
                        )}
                        {verification.verificationSubmittedAt && (
                          <p className={styles.verificationDate}>
                            Eingereicht: {new Date(verification.verificationSubmittedAt).toLocaleDateString('de-DE')}
                          </p>
                        )}
                      </div>
                      <div className={styles.verificationActions}>
                        <button
                          onClick={() => handleViewDocument(verification)}
                          className={`${styles.button} ${styles.buttonPrimary}`}
                        >
                          📄 Dokument ansehen
                        </button>
                        <button
                          onClick={() => handleApproveClick(verification.freelancerUid)}
                          disabled={actionInProgress === verification.freelancerUid}
                          className={`${styles.button} ${styles.buttonSuccess}`}
                        >
                          {actionInProgress === verification.freelancerUid ? '...' : '✓ Genehmigen'}
                        </button>
                        <button
                          onClick={() => handleReject(verification.freelancerUid)}
                          disabled={actionInProgress === verification.freelancerUid}
                          className={`${styles.button} ${styles.buttonDanger}`}
                        >
                          {actionInProgress === verification.freelancerUid ? '...' : '✗ Ablehnen'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {approvedVerifications.length > 0 && (
                <>
                  <h2 className={styles.sectionTitle}>Genehmigte Verifizierungen</h2>
                  <div className={styles.verificationList}>
                    {approvedVerifications.map((verification) => (
                      <div key={verification.freelancerUid} className={styles.verificationCard}>
                        <div className={styles.verificationInfo}>
                          <h3 className={styles.verificationName}>{verification.displayName}</h3>
                          <p className={styles.verificationEmail}>{verification.email}</p>
                          {verification.verificationReviewedAt && (
                            <p className={styles.verificationDate}>
                              Genehmigt: {new Date(verification.verificationReviewedAt).toLocaleDateString('de-DE')}
                            </p>
                          )}
                        </div>
                        <div className={styles.verificationStatus}>
                          <span className={`${styles.statusBadge} ${styles.statusApproved}`}>
                            {getStatusLabel(verification.verificationStatus)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {rejectedVerifications.length > 0 && (
                <>
                  <h2 className={styles.sectionTitle}>Abgelehnte Verifizierungen</h2>
                  <div className={styles.verificationList}>
                    {rejectedVerifications.map((verification) => (
                      <div key={verification.freelancerUid} className={styles.verificationCard}>
                        <div className={styles.verificationInfo}>
                          <h3 className={styles.verificationName}>{verification.displayName}</h3>
                          <p className={styles.verificationEmail}>{verification.email}</p>
                          {verification.verificationRejectionReason && (
                            <p className={styles.rejectionReason}>
                              Grund: {verification.verificationRejectionReason}
                            </p>
                          )}
                          {verification.verificationReviewedAt && (
                            <p className={styles.verificationDate}>
                              Abgelehnt: {new Date(verification.verificationReviewedAt).toLocaleDateString('de-DE')}
                            </p>
                          )}
                        </div>
                        <div className={styles.verificationStatus}>
                          <span className={`${styles.statusBadge} ${styles.statusRejected}`}>
                            {getStatusLabel(verification.verificationStatus)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {selectedVerification && (
              <div className={styles.detailPanel}>
                <div className={styles.detailHeader}>
                  <h3>Dokument: {selectedVerification.displayName}</h3>
                  <button
                    onClick={() => {
                      setSelectedVerification(null);
                      setDocumentUrl(null);
                    }}
                    className={styles.closeButton}
                  >
                    ✕
                  </button>
                </div>
                {documentUrl ? (
                  <div className={styles.documentViewer}>
                    <iframe src={documentUrl} className={styles.documentFrame} title="Verifizierungs-Dokument" />
                  </div>
                ) : (
                  <div className={styles.loading}>Lade Dokument...</div>
                )}
                {selectedVerification.verificationStatus === 'pending' && (
                  <div className={styles.detailActions}>
                    <div className={styles.rejectSection}>
                      <label htmlFor="rejectReason" className={styles.label}>
                        Ablehnungsgrund:
                      </label>
                      <textarea
                        id="rejectReason"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Grund für die Ablehnung..."
                        className={styles.textarea}
                        rows={3}
                      />
                    </div>
                    <div className={styles.actionButtons}>
                      <button
                        onClick={() => handleApproveClick(selectedVerification.freelancerUid)}
                        disabled={actionInProgress === selectedVerification.freelancerUid}
                        className={`${styles.button} ${styles.buttonSuccess}`}
                      >
                        {actionInProgress === selectedVerification.freelancerUid ? '...' : '✓ Genehmigen'}
                      </button>
                      <button
                        onClick={() => handleReject(selectedVerification.freelancerUid)}
                        disabled={actionInProgress === selectedVerification.freelancerUid || !rejectReason.trim()}
                        className={`${styles.button} ${styles.buttonDanger}`}
                      >
                        {actionInProgress === selectedVerification.freelancerUid ? '...' : '✗ Ablehnen'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Approve Modal mit Firmennamen-Eingabe */}
      {showApproveModal && (
        <div className={styles.modalOverlay} onClick={() => setShowApproveModal(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.modalClose}
              onClick={() => {
                setShowApproveModal(null);
                setCompanyName('');
              }}
            >
              ✕
            </button>
            <h3 className={styles.modalTitle}>Verifizierung genehmigen</h3>
            <p className={styles.modalDescription}>
              Bitte geben Sie den Firmennamen des Freelancers ein. Dieser wird für die Tenant-Erstellung verwendet.
            </p>
            <div className={styles.formGroup}>
              <label htmlFor="companyName" className={styles.label}>
                Firmenname *
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="z.B. Security Services GmbH"
                className={styles.input}
                autoFocus
              />
              <p className={styles.formHint}>
                Der Freelancer erhält einen eigenen Tenant mit diesem Firmennamen.
              </p>
            </div>
            <div className={styles.modalActions}>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={() => {
                  setShowApproveModal(null);
                  setCompanyName('');
                }}
              >
                Abbrechen
              </button>
              <button
                className={`${styles.button} ${styles.buttonSuccess}`}
                onClick={() => handleApprove(showApproveModal)}
                disabled={!companyName.trim() || companyName.trim().length < 2 || actionInProgress === showApproveModal}
              >
                {actionInProgress === showApproveModal ? '...' : '✓ Genehmigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

