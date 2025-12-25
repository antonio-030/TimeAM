/**
 * Member Profile Modal
 * 
 * Modal für Profilbearbeitung von Admins/Managern.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../core/auth';
import { 
  getMemberProfile, 
  updateMemberProfile,
  type Member,
} from './api';
import type { UpdateMemberRequest } from '@timeam/shared';
import styles from './MemberProfileModal.module.css';

interface MemberProfileModalProps {
  open: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export function MemberProfileModal({ 
  open, 
  onClose,
  onProfileUpdated,
}: MemberProfileModalProps) {
  const { user } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Member-Daten
  const [member, setMember] = useState<Member | null>(null);
  
  // Formular-Daten
  const [formData, setFormData] = useState({
    displayName: '',
    firstName: '',
    lastName: '',
    address: '',
    employeeNumber: '',
    phone: '',
    department: '',
    position: '',
  });
  
  // Daten laden
  const loadMember = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await getMemberProfile();
      setMember(response.member);
      
      // Formular mit aktuellen Daten füllen
      setFormData({
        displayName: response.member.displayName || '',
        firstName: response.member.firstName || '',
        lastName: response.member.lastName || '',
        address: response.member.address || '',
        employeeNumber: response.member.employeeNumber || '',
        phone: response.member.phone || '',
        department: response.member.department || '',
        position: response.member.position || '',
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
      loadMember();
      setSuccess(null);
    }
  }, [open, loadMember]);

  // ESC zum Schließen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Backdrop Click
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  }, [onClose]);

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
      const updateData: UpdateMemberRequest = {};
      
      // Nur geänderte Felder senden
      if (formData.displayName !== member?.displayName) {
        updateData.displayName = formData.displayName.trim() || undefined;
      }
      if (formData.firstName !== member?.firstName) {
        updateData.firstName = formData.firstName.trim() || undefined;
      }
      if (formData.lastName !== member?.lastName) {
        updateData.lastName = formData.lastName.trim() || undefined;
      }
      if (formData.address !== member?.address) {
        updateData.address = formData.address.trim() || undefined;
      }
      if (formData.employeeNumber !== member?.employeeNumber) {
        updateData.employeeNumber = formData.employeeNumber.trim() || undefined;
      }
      if (formData.phone !== member?.phone) {
        updateData.phone = formData.phone.trim() || undefined;
      }
      if (formData.department !== member?.department) {
        updateData.department = formData.department.trim() || undefined;
      }
      if (formData.position !== member?.position) {
        updateData.position = formData.position.trim() || undefined;
      }

      if (Object.keys(updateData).length === 0) {
        setSuccess('Keine Änderungen vorgenommen');
        return;
      }

      const response = await updateMemberProfile(updateData);
      setMember(response.member);
      
      // Formular mit aktualisierten Daten aktualisieren
      setFormData({
        displayName: response.member.displayName || '',
        firstName: response.member.firstName || '',
        lastName: response.member.lastName || '',
        address: response.member.address || '',
        employeeNumber: response.member.employeeNumber || '',
        phone: response.member.phone || '',
        department: response.member.department || '',
        position: response.member.position || '',
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

  if (!open) return null;

  const userInitials = member?.firstName && member?.lastName
    ? `${member.firstName[0]}${member.lastName[0]}`.toUpperCase()
    : member?.displayName?.charAt(0) || user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?';

  return (
    <div className={styles.modalOverlay} ref={modalRef} onClick={handleBackdropClick}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderInfo}>
            <div className={styles.avatarLarge}>
              {userInitials}
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
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Profil wird geladen...</p>
            </div>
          ) : (
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
                  <label className={styles.formLabel}>Anzeigename</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.displayName}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    placeholder="Max Mustermann"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Personalnummer</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.employeeNumber}
                    onChange={(e) => handleInputChange('employeeNumber', e.target.value)}
                    placeholder="z.B. 12345"
                  />
                </div>
              </div>

              {/* Kontaktdaten */}
              <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>Kontaktdaten</h3>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>E-Mail</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    value={member?.email || user?.email || ''}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <span className={styles.formHint}>
                    E-Mail-Adresse kann nicht geändert werden
                  </span>
                </div>

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

              {/* Berufliche Daten */}
              <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}>Berufliche Daten</h3>
                
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Abteilung</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData.department}
                      onChange={(e) => handleInputChange('department', e.target.value)}
                      placeholder="z.B. Vertrieb"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Position</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData.position}
                      onChange={(e) => handleInputChange('position', e.target.value)}
                      placeholder="z.B. Teamleiter"
                    />
                  </div>
                </div>
              </div>

              {/* Fehler/Success Messages */}
              {error && (
                <div className={styles.errorMessage}>
                  ⚠️ {error}
                </div>
              )}
              
              {success && (
                <div className={styles.successMessage}>
                  ✅ {success}
                </div>
              )}

              {/* Actions */}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={onClose}
                  disabled={saving}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className={styles.buttonPrimary}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Wird gespeichert...' : 'Speichern'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

