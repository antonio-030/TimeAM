/**
 * Deletion Requests Review Page
 *
 * Übersicht aller Löschaufträge für Dev-Mitarbeiter.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest,
  executeDeletionRequest,
  type AccountDeletionRequestOverview,
} from './api';
import styles from './DeletionRequestsPage.module.css';

export function DeletionRequestsPage() {
  const [requests, setRequests] = useState<AccountDeletionRequestOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<AccountDeletionRequestOverview | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState<string | null>(null);
  const [approveNote, setApproveNote] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getDeletionRequests();
      setRequests(data.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApproveClick = (uid: string) => {
    setShowApproveModal(uid);
    setApproveNote('');
  };

  const handleApprove = async (uid: string) => {
    setActionInProgress(uid);

    try {
      await approveDeletionRequest(uid, approveNote ? { reason: approveNote } : undefined);
      await loadRequests();
      setShowApproveModal(null);
      setApproveNote('');
      if (selectedRequest?.uid === uid) {
        setSelectedRequest(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Genehmigen');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (uid: string) => {
    if (!rejectReason.trim() || rejectReason.trim().length < 3) {
      alert('Bitte geben Sie einen Ablehnungsgrund ein (mindestens 3 Zeichen)');
      return;
    }

    if (!confirm('Löschauftrag wirklich ablehnen?')) {
      return;
    }

    setActionInProgress(uid);

    try {
      await rejectDeletionRequest(uid, { reason: rejectReason.trim() });
      await loadRequests();
      setRejectReason('');
      if (selectedRequest?.uid === uid) {
        setSelectedRequest(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Ablehnen');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleExecute = async (uid: string) => {
    if (!confirm('Konto wirklich jetzt löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
      return;
    }

    setActionInProgress(uid);

    try {
      await executeDeletionRequest(uid);
      await loadRequests();
      if (selectedRequest?.uid === uid) {
        setSelectedRequest(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Ausführen der Löschung');
    } finally {
      setActionInProgress(null);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳ Ausstehend';
      case 'approved':
        return '✅ Genehmigt';
      case 'rejected':
        return '❌ Abgelehnt';
      case 'completed':
        return '🗑️ Gelöscht';
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending':
        return styles.statusPending;
      case 'approved':
        return styles.statusApproved;
      case 'rejected':
        return styles.statusRejected;
      case 'completed':
        return styles.statusCompleted;
      default:
        return '';
    }
  };

  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case 'freelancer':
        return '🎯 Freelancer';
      case 'employee':
        return '👤 Mitarbeiter';
      case 'dev-staff':
        return '🛠️ Dev-Mitarbeiter';
      default:
        return userType;
    }
  };

  const canExecute = (request: AccountDeletionRequestOverview) => {
    if (request.status !== 'approved') return false;
    if (!request.scheduledDeletionAt) return false;
    const scheduledDate = new Date(request.scheduledDeletionAt);
    const now = new Date();
    return now >= scheduledDate;
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const rejectedRequests = requests.filter((r) => r.status === 'rejected');
  const completedRequests = requests.filter((r) => r.status === 'completed');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Löschaufträge</h1>
        <p className={styles.subtitle}>Kontolöschungen prüfen und verwalten</p>
      </div>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={loadRequests} className={styles.retryBtn}>
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
              <div className={styles.statValue}>{pendingRequests.length}</div>
              <div className={styles.statLabel}>Ausstehend</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{approvedRequests.length}</div>
              <div className={styles.statLabel}>Genehmigt</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{rejectedRequests.length}</div>
              <div className={styles.statLabel}>Abgelehnt</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{completedRequests.length}</div>
              <div className={styles.statLabel}>Gelöscht</div>
            </div>
          </div>

          <div className={styles.content}>
            <div className={styles.list}>
              <h2 className={styles.sectionTitle}>Ausstehende Löschaufträge</h2>
              {pendingRequests.length === 0 ? (
                <div className={styles.empty}>
                  <p>Keine ausstehenden Löschaufträge</p>
                </div>
              ) : (
                <div className={styles.requestList}>
                  {pendingRequests.map((request) => (
                    <div key={request.uid} className={styles.requestCard}>
                      <div className={styles.requestInfo}>
                        <h3 className={styles.requestName}>{request.displayName}</h3>
                        <p className={styles.requestEmail}>{request.email}</p>
                        <p className={styles.requestType}>{getUserTypeLabel(request.userType)}</p>
                        {request.requestedReason && (
                          <p className={styles.requestReason}>
                            <strong>Grund:</strong> {request.requestedReason}
                          </p>
                        )}
                        {request.requestedAt && (
                          <p className={styles.requestDate}>
                            Beantragt: {new Date(request.requestedAt).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                      <div className={styles.requestActions}>
                        <button
                          onClick={() => handleApproveClick(request.uid)}
                          disabled={actionInProgress === request.uid}
                          className={`${styles.button} ${styles.buttonSuccess}`}
                        >
                          {actionInProgress === request.uid ? '...' : '✓ Genehmigen'}
                        </button>
                        <button
                          onClick={() => handleReject(request.uid)}
                          disabled={actionInProgress === request.uid}
                          className={`${styles.button} ${styles.buttonDanger}`}
                        >
                          {actionInProgress === request.uid ? '...' : '✗ Ablehnen'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {approvedRequests.length > 0 && (
                <>
                  <h2 className={styles.sectionTitle}>Genehmigte Löschaufträge</h2>
                  <div className={styles.requestList}>
                    {approvedRequests.map((request) => (
                      <div key={request.uid} className={styles.requestCard}>
                        <div className={styles.requestInfo}>
                          <h3 className={styles.requestName}>{request.displayName}</h3>
                          <p className={styles.requestEmail}>{request.email}</p>
                          <p className={styles.requestType}>{getUserTypeLabel(request.userType)}</p>
                          {request.scheduledDeletionAt && (
                            <p className={styles.requestDate}>
                              Geplante Löschung: {new Date(request.scheduledDeletionAt).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                          {canExecute(request) && (
                            <p className={styles.executeNotice}>
                              ⚠️ Löschung kann jetzt ausgeführt werden
                            </p>
                          )}
                        </div>
                        <div className={styles.requestActions}>
                          {canExecute(request) ? (
                            <button
                              onClick={() => handleExecute(request.uid)}
                              disabled={actionInProgress === request.uid}
                              className={`${styles.button} ${styles.buttonDanger}`}
                            >
                              {actionInProgress === request.uid ? '...' : '🗑️ Jetzt löschen'}
                            </button>
                          ) : (
                            <span className={styles.statusBadge}>
                              {getStatusLabel(request.status)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {rejectedRequests.length > 0 && (
                <>
                  <h2 className={styles.sectionTitle}>Abgelehnte Löschaufträge</h2>
                  <div className={styles.requestList}>
                    {rejectedRequests.map((request) => (
                      <div key={request.uid} className={styles.requestCard}>
                        <div className={styles.requestInfo}>
                          <h3 className={styles.requestName}>{request.displayName}</h3>
                          <p className={styles.requestEmail}>{request.email}</p>
                          {request.rejectionReason && (
                            <p className={styles.rejectionReason}>
                              <strong>Ablehnungsgrund:</strong> {request.rejectionReason}
                            </p>
                          )}
                        </div>
                        <div className={styles.requestStatus}>
                          <span className={`${styles.statusBadge} ${getStatusClass(request.status)}`}>
                            {getStatusLabel(request.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {completedRequests.length > 0 && (
                <>
                  <h2 className={styles.sectionTitle}>Gelöschte Konten</h2>
                  <div className={styles.requestList}>
                    {completedRequests.map((request) => (
                      <div key={request.uid} className={styles.requestCard}>
                        <div className={styles.requestInfo}>
                          <h3 className={styles.requestName}>{request.displayName}</h3>
                          <p className={styles.requestEmail}>{request.email}</p>
                          {request.deletedAt && (
                            <p className={styles.requestDate}>
                              Gelöscht: {new Date(request.deletedAt).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                        <div className={styles.requestStatus}>
                          <span className={`${styles.statusBadge} ${getStatusClass(request.status)}`}>
                            {getStatusLabel(request.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className={styles.modalOverlay} onClick={() => setShowApproveModal(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.modalClose}
              onClick={() => {
                setShowApproveModal(null);
                setApproveNote('');
              }}
            >
              ✕
            </button>
            <h3 className={styles.modalTitle}>Löschauftrag genehmigen</h3>
            <p className={styles.modalDescription}>
              Das Konto wird nach Genehmigung noch 30 Tage aufbewahrt, bevor es endgültig gelöscht wird.
            </p>
            <div className={styles.formGroup}>
              <label htmlFor="approveNote" className={styles.label}>
                Notiz (optional)
              </label>
              <textarea
                id="approveNote"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Optionale Notiz für interne Zwecke..."
                className={styles.textarea}
                rows={3}
              />
            </div>
            <div className={styles.modalActions}>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={() => {
                  setShowApproveModal(null);
                  setApproveNote('');
                }}
              >
                Abbrechen
              </button>
              <button
                className={`${styles.button} ${styles.buttonSuccess}`}
                onClick={() => handleApprove(showApproveModal)}
                disabled={actionInProgress === showApproveModal}
              >
                {actionInProgress === showApproveModal ? '...' : '✓ Genehmigen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal (wenn Request ausgewählt) */}
      {selectedRequest && selectedRequest.status === 'pending' && (
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <h3>Löschauftrag: {selectedRequest.displayName}</h3>
            <button
              onClick={() => {
                setSelectedRequest(null);
                setRejectReason('');
              }}
              className={styles.closeButton}
            >
              ✕
            </button>
          </div>
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
                onClick={() => handleApproveClick(selectedRequest.uid)}
                disabled={actionInProgress === selectedRequest.uid}
                className={`${styles.button} ${styles.buttonSuccess}`}
              >
                {actionInProgress === selectedRequest.uid ? '...' : '✓ Genehmigen'}
              </button>
              <button
                onClick={() => handleReject(selectedRequest.uid)}
                disabled={actionInProgress === selectedRequest.uid || !rejectReason.trim()}
                className={`${styles.button} ${styles.buttonDanger}`}
              >
                {actionInProgress === selectedRequest.uid ? '...' : '✗ Ablehnen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

