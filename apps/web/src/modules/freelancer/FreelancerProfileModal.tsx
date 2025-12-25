/**
 * Freelancer Profile Modal
 * 
 * Modal für Profilbearbeitung und Kontolöschung (DSGVO-konform).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../core/auth';
import { 
  getFreelancer, 
  updateFreelancerProfile, 
  deleteFreelancerAccount,
  type FreelancerResponse,
  type UpdateFreelancerProfileRequest,
} from './api';
import styles from './FreelancerProfileModal.module.css';

interface FreelancerProfileModalProps {
  open: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
  onAccountDeleted?: () => void;
}

type TabId = 'profile' | 'delete';

export function FreelancerProfileModal({ 
  open, 
  onClose,
  onProfileUpdated,
  onAccountDeleted,
}: FreelancerProfileModalProps) {
  const { user, signOut } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Freelancer-Daten
  const [freelancer, setFreelancer] = useState<FreelancerResponse | null>(null);
  
  // Formular-Daten
  const [formData, setFormData] = useState({
    displayName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    companyName: '',
  });
  
  // Löschbestätigung
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Daten laden
  const loadFreelancer = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await getFreelancer();
      setFreelancer(response.freelancer);
      
      // Formular mit aktuellen Daten füllen
      setFormData({
        displayName: response.freelancer.displayName || '',
        firstName: response.freelancer.firstName || '',
        lastName: response.freelancer.lastName || '',
        email: response.freelancer.email || user?.email || '',
        phone: response.freelancer.phone || '',
        address: response.freelancer.address || '',
        companyName: response.freelancer.companyName || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden des Profils');
    } finally {
      setLoading(false);
    }
  }, []);

  // Beim Öffnen laden
  useEffect(() => {
    if (open) {
      loadFreelancer();
      setActiveTab('profile');
      setShowDeleteConfirm(false);
      setDeleteConfirmation('');
      setDeleteReason('');
      setSuccess(null);
    }
  }, [open, loadFreelancer]);

  // ESC zum Schließen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !deleting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, deleting]);

  // Backdrop Click
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalRef.current && !deleting) {
      onClose();
    }
  }, [onClose, deleting]);

  // Formular ändern
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  // Profil speichern
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updateData: UpdateFreelancerProfileRequest = {};
      
      // Nur geänderte Felder senden
      if (formData.displayName !== freelancer?.displayName) {
        updateData.displayName = formData.displayName;
      }
      if (formData.firstName !== freelancer?.firstName) {
        updateData.firstName = formData.firstName;
      }
      if (formData.lastName !== freelancer?.lastName) {
        updateData.lastName = formData.lastName;
      }
      if (formData.email !== freelancer?.email && formData.email !== user?.email) {
        updateData.email = formData.email;
      }
      if (formData.phone !== freelancer?.phone) {
        updateData.phone = formData.phone;
      }
      if (formData.address !== freelancer?.address) {
        updateData.address = formData.address;
      }
      if (formData.companyName !== freelancer?.companyName) {
        updateData.companyName = formData.companyName;
      }

      if (Object.keys(updateData).length === 0) {
        setSuccess('Keine Änderungen vorgenommen');
        return;
      }

      const response = await updateFreelancerProfile(updateData);
      setFreelancer(response.freelancer);
      
      // Formular mit aktualisierten Daten aktualisieren
      setFormData({
        displayName: response.freelancer.displayName || '',
        firstName: response.freelancer.firstName || '',
        lastName: response.freelancer.lastName || '',
        email: response.freelancer.email || '',
        phone: response.freelancer.phone || '',
        address: response.freelancer.address || '',
        companyName: response.freelancer.companyName || '',
      });
      
      setSuccess('Profil erfolgreich aktualisiert!');
      
      // Callback aufrufen, um Parent-Komponente zu informieren
      onProfileUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  // Löschauftrag erstellen
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'LÖSCHEN') {
      setError('Bitte geben Sie "LÖSCHEN" ein, um zu bestätigen');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await deleteFreelancerAccount(deleteReason.trim() || undefined);
      
      // Erfolg - Löschauftrag wurde erstellt
      setSuccess('Löschauftrag erfolgreich eingereicht. Unser Support-Team wird Ihren Antrag prüfen. Ihre Daten werden nach Genehmigung noch 30 Tage aufbewahrt, bevor sie endgültig gelöscht werden.');
      
      // Modal nach 3 Sekunden schließen
      setTimeout(() => {
        onClose();
        onAccountDeleted?.();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen des Löschauftrags');
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} ref={modalRef} onClick={handleBackdropClick}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderInfo}>
            <div className={styles.avatarLarge}>
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className={styles.modalTitle}>Mein Profil</h2>
              <p className={styles.modalSubtitle}>{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={styles.modalClose}
            aria-label="Schließen"
            type="button"
            disabled={deleting}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'profile' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('profile')}
            type="button"
          >
            <span>👤</span> Profil bearbeiten
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'delete' ? styles.tabActive : ''} ${styles.tabDanger}`}
            onClick={() => setActiveTab('delete')}
            type="button"
          >
            <span>🗑️</span> Konto löschen
          </button>
        </div>

        {/* Content */}
        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Profil wird geladen...</p>
            </div>
          ) : activeTab === 'profile' ? (
            <div className={styles.profileForm}>
              {/* Persönliche Daten */}
              <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>Persönliche Daten</h3>
                
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Vorname</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      placeholder="Max"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nachname</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Mustermann"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Anzeigename *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.displayName}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    placeholder="Max Mustermann"
                    required
                  />
                  <span className={styles.formHint}>
                    Wird in der App und bei Bewerbungen angezeigt
                  </span>
                </div>
              </div>

              {/* Kontaktdaten */}
              <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>Kontaktdaten</h3>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Telefon</label>
                  <input
                    type="tel"
                    className={styles.formInput}
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+49 123 456789"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Adresse</label>
                  <textarea
                    className={styles.formTextarea}
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Musterstraße 123&#10;12345 Musterstadt"
                    rows={3}
                  />
                </div>
              </div>

              {/* Unternehmensdaten */}
              <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>Unternehmensdaten</h3>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Firmenname *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="Meine Firma GmbH"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>E-Mail-Adresse *</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="max.mustermann@example.com"
                    required
                  />
                  <span className={styles.formHint}>
                    Ihre E-Mail-Adresse wird auch für die Anmeldung verwendet
                  </span>
                </div>
              </div>

              {/* Fehler/Erfolg Meldungen */}
              {error && (
                <div className={styles.errorMessage}>
                  <span>⚠️</span> {error}
                </div>
              )}
              {success && (
                <div className={styles.successMessage}>
                  <span>✓</span> {success}
                </div>
              )}

              {/* Speichern Button */}
              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={onClose}
                  className={styles.cancelButton}
                  disabled={saving}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className={styles.saveButton}
                  disabled={saving}
                >
                  {saving ? 'Speichern...' : 'Änderungen speichern'}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.deleteSection}>
            <div className={styles.deleteWarning}>
              <div className={styles.deleteWarningIcon}>⚠️</div>
              <h3>Löschauftrag stellen</h3>
              <p>
                Gemäß DSGVO haben Sie das Recht, Ihr Konto und alle zugehörigen Daten 
                vollständig zu löschen. Ihr Löschauftrag wird von unserem Support-Team geprüft.
              </p>
              <div className={styles.deleteWarningInfo}>
                <strong>Wichtige Information:</strong>
                <p>
                  Nach Genehmigung Ihres Löschauftrags werden Ihre Daten noch <strong>30 Tage</strong> aufbewahrt, 
                  bevor sie endgültig gelöscht werden. Dies dient der Sicherheit und ermöglicht es Ihnen, 
                  den Löschauftrag innerhalb dieser Frist zu widerrufen.
                </p>
              </div>
            </div>

              <div className={styles.deleteInfo}>
                <h4>Folgende Daten werden gelöscht:</h4>
                <ul>
                  <li>Ihr Benutzerkonto und Anmeldedaten</li>
                  <li>Ihr Freelancer-Profil</li>
                  <li>Alle hochgeladenen Dokumente (Gewerbeschein etc.)</li>
                  <li>Bewerbungen werden anonymisiert</li>
                  <li>Ihr persönlicher Tenant/Firma</li>
                </ul>
              </div>

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className={styles.deleteInitButton}
                >
                  Ich möchte mein Konto löschen
                </button>
              ) : (
                <div className={styles.deleteConfirmation}>
                  <p className={styles.deleteConfirmText}>
                    Bitte geben Sie <strong>LÖSCHEN</strong> ein, um zu bestätigen:
                  </p>
                  <input
                    type="text"
                    className={styles.deleteConfirmInput}
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="LÖSCHEN"
                    disabled={deleting}
                  />
                  
                  <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                    <label className={styles.formLabel}>Grund (optional)</label>
                    <textarea
                      className={styles.formTextarea}
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="Optional: Bitte teilen Sie uns mit, warum Sie Ihr Konto löschen möchten..."
                      rows={3}
                      disabled={deleting}
                    />
                  </div>
                  
                  {error && (
                    <div className={styles.errorMessage}>
                      <span>⚠️</span> {error}
                    </div>
                  )}
                  
                  {success && (
                    <div className={styles.successMessage}>
                      <span>✓</span> {success}
                    </div>
                  )}

                  <div className={styles.deleteActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmation('');
                        setDeleteReason('');
                        setError(null);
                        setSuccess(null);
                      }}
                      className={styles.cancelButton}
                      disabled={deleting}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className={styles.deleteConfirmButton}
                      disabled={deleting || deleteConfirmation !== 'LÖSCHEN'}
                    >
                      {deleting ? 'Wird eingereicht...' : 'Löschauftrag stellen'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

