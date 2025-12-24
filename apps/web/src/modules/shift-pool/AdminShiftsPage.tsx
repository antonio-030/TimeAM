/**
 * Admin Shifts Page
 *
 * Verwaltung von Schichten für Admins.
 */

import { useState, useEffect } from 'react';
import { useAdminShifts, useShiftApplications, useShiftAssignments, useShiftDocuments } from './hooks';
import { SHIFT_STATUS, APPLICATION_STATUS, type Shift, type AdminShift, type Application, type ShiftStatus, type ApplicationStatus, type CreateShiftRequest, type Member } from '@timeam/shared';
import { FreelancerDetailModal } from './FreelancerDetailModal';
import { getMembers } from '../members/api';
import { assignMemberToShift } from './api';
import { ShiftDocumentList } from './ShiftDocumentList';
import { AddressAutocomplete } from './AddressAutocomplete';
import { openAddressInMaps } from './mapsUtils';
import { VerificationBadge } from '../../components/VerificationBadge';
import styles from './ShiftPool.module.css';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getShiftStatusBadgeClass(status: ShiftStatus): string {
  switch (status) {
    case SHIFT_STATUS.DRAFT:
      return styles.badgeDraft;
    case SHIFT_STATUS.PUBLISHED:
      return styles.badgePublished;
    case SHIFT_STATUS.CLOSED:
      return styles.badgeClosed;
    case SHIFT_STATUS.CANCELLED:
      return styles.badgeCancelled;
    default:
      return '';
  }
}

function getShiftStatusLabel(status: ShiftStatus): string {
  switch (status) {
    case SHIFT_STATUS.DRAFT:
      return 'Entwurf';
    case SHIFT_STATUS.PUBLISHED:
      return 'Veröffentlicht';
    case SHIFT_STATUS.CLOSED:
      return 'Geschlossen';
    case SHIFT_STATUS.CANCELLED:
      return 'Abgesagt';
    default:
      return status;
  }
}

function getAppStatusBadgeClass(status: ApplicationStatus): string {
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
}

function getAppStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case APPLICATION_STATUS.PENDING:
      return 'Ausstehend';
    case APPLICATION_STATUS.ACCEPTED:
      return 'Angenommen';
    case APPLICATION_STATUS.REJECTED:
      return 'Abgelehnt';
    case APPLICATION_STATUS.WITHDRAWN:
      return 'Zurückgezogen';
    default:
      return status;
  }
}

// =============================================================================
// Create Shift Form (mit Mitarbeiter-Vorzuweisung)
// =============================================================================

interface CreateShiftFormProps {
  onSubmit: (data: CreateShiftRequest, preAssignedMembers: string[]) => Promise<void>;
  onCancel: () => void;
}

function CreateShiftForm({ onSubmit, onCancel }: CreateShiftFormProps) {
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLatitude, setLocationLatitude] = useState<number | undefined>(undefined);
  const [locationLongitude, setLocationLongitude] = useState<number | undefined>(undefined);
  
  // Wenn Adresse ausgewählt wird, auch als Standort-Name verwenden (falls Standort leer)
  const handleLocationChange = (location: Partial<ShiftLocation>) => {
    if (location.address) {
      setLocationAddress(location.address);
      // Wenn Standort noch leer ist, verwende die Adresse als Standort-Name
      if (!locationName.trim()) {
        setLocationName(location.address);
      }
    }
    if (location.latitude !== undefined) {
      setLocationLatitude(location.latitude);
    }
    if (location.longitude !== undefined) {
      setLocationLongitude(location.longitude);
    }
  };
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [requiredCount, setRequiredCount] = useState(1);
  const [payRate, setPayRate] = useState('');
  const [applyDeadline, setApplyDeadline] = useState('');
  const [isPublicPool, setIsPublicPool] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Mitarbeiter-Vorzuweisung
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [preAssignedMembers, setPreAssignedMembers] = useState<string[]>([]);
  const [crewLeaderUid, setCrewLeaderUid] = useState<string>('');

  // Mitarbeiter laden
  useEffect(() => {
    async function loadMembers() {
      try {
        const data = await getMembers();
        setMembers(data.members);
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        setMembersLoading(false);
      }
    }
    loadMembers();
  }, []);

  const toggleMember = (uid: string) => {
    setPreAssignedMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // Validierung: Nicht mehr vorab zuweisen als requiredCount
  const canAssignMore = preAssignedMembers.length < requiredCount;
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const location: CreateShiftRequest['location'] = {
        name: locationName.trim(),
      };
      if (locationAddress.trim()) {
        location.address = locationAddress.trim();
      }
      if (locationLatitude !== undefined && locationLongitude !== undefined) {
        location.latitude = locationLatitude;
        location.longitude = locationLongitude;
      }

      const data: CreateShiftRequest = {
        title: title.trim(),
        location,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        requiredCount,
        payRate: payRate ? parseFloat(payRate) : undefined,
        applyDeadline: applyDeadline ? new Date(applyDeadline).toISOString() : undefined,
        isPublicPool,
      };

      await onSubmit(data, preAssignedMembers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Titel *</label>
        <input
          type="text"
          className={styles.formInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Standort *</label>
        <input
          type="text"
          className={styles.formInput}
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="z.B. Hauptbüro, Filiale Nord, Baustelle XY"
          required
        />
        <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-light)' }}>
          Name oder Bezeichnung des Standorts
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Adresse (optional)</label>
        <AddressAutocomplete
          value={locationAddress}
          onChange={(location) => {
            // Nur Adresse setzen, NICHT den Standort-Namen
            if (location.address) {
              setLocationAddress(location.address);
            }
            if (location.latitude !== undefined) {
              setLocationLatitude(location.latitude);
            }
            if (location.longitude !== undefined) {
              setLocationLongitude(location.longitude);
            }
          }}
          placeholder="Straße, PLZ Ort - für Google Maps Navigation"
        />
        <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-light)' }}>
          Vollständige Adresse für Navigation (wird automatisch mit Koordinaten gespeichert)
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Start *</label>
          <input
            type="datetime-local"
            className={styles.formInput}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Ende *</label>
          <input
            type="datetime-local"
            className={styles.formInput}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Benötigte Personen *</label>
          <input
            type="number"
            className={styles.formInput}
            value={requiredCount}
            onChange={(e) => setRequiredCount(parseInt(e.target.value) || 1)}
            min={1}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Stundenlohn (optional)</label>
          <input
            type="number"
            className={styles.formInput}
            value={payRate}
            onChange={(e) => setPayRate(e.target.value)}
            step="0.01"
            min="0"
            placeholder="€/h"
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Bewerbungsfrist (optional)</label>
        <input
          type="datetime-local"
          className={styles.formInput}
          value={applyDeadline}
          onChange={(e) => setApplyDeadline(e.target.value)}
        />
      </div>

      {/* Crew-Leiter auswählen */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>👑 Crew-Leiter (optional)</label>
        <p className={styles.preAssignHint}>
          Der Crew-Leiter kann die Schicht beenden und Zeiten eintragen/korrigieren.
        </p>
        {membersLoading ? (
          <div className={styles.loading}>Mitarbeiter werden geladen...</div>
        ) : (
          <select
            className={styles.formInput}
            value={crewLeaderUid}
            onChange={(e) => setCrewLeaderUid(e.target.value)}
          >
            <option value="">Kein Crew-Leiter</option>
            {members.map((member) => (
              <option key={member.uid} value={member.uid}>
                {member.displayName || member.email}
                {member.role === 'admin' && ' (Admin)'}
                {member.role === 'manager' && ' (Manager)'}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Freelancer Pool Freigabe */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          <input
            type="checkbox"
            checked={isPublicPool}
            onChange={(e) => setIsPublicPool(e.target.checked)}
            className={styles.checkbox}
          />
          Zum Freelancer Pool freigeben
        </label>
        <p className={styles.formHint}>
          Wenn aktiviert, wird diese Schicht im öffentlichen Freelancer Pool angezeigt, 
          sodass externe Freelancer sich darauf bewerben können.
        </p>
      </div>

      {/* Mitarbeiter vorab zuweisen */}
      <div className={styles.preAssignSection}>
        <label className={styles.formLabel}>
          👥 Mitarbeiter vorab zuweisen (optional)
          <span className={styles.preAssignCount}>
            {preAssignedMembers.length}/{requiredCount} ausgewählt
          </span>
        </label>
        <p className={styles.preAssignHint}>
          Mitarbeiter werden nach dem Erstellen automatisch zugewiesen. 
          Die Schicht erscheint weiterhin im Pool, wenn noch Plätze frei sind.
        </p>
        
        {membersLoading ? (
          <div className={styles.loading}>Mitarbeiter werden geladen...</div>
        ) : (
          <div className={styles.memberCheckboxList}>
            {members.map((member) => {
              const isSelected = preAssignedMembers.includes(member.uid);
              const isDisabled = !isSelected && !canAssignMore;
              
              return (
                <label 
                  key={member.uid} 
                  className={`${styles.memberCheckboxItem} ${isSelected ? styles.memberSelected : ''} ${isDisabled ? styles.memberDisabled : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMember(member.uid)}
                    disabled={isDisabled}
                    className={styles.memberCheckbox}
                  />
                  <span className={styles.memberCheckboxAvatar}>
                    {(member.displayName || member.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.memberCheckboxName}>
                    {member.displayName || member.email}
                    {member.role === 'admin' && <span className={styles.memberRole}>Admin</span>}
                    {member.role === 'manager' && <span className={styles.memberRole}>Manager</span>}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.formActions}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Wird erstellt...' : preAssignedMembers.length > 0 
            ? `Erstellen & ${preAssignedMembers.length} Mitarbeiter zuweisen` 
            : 'Erstellen'}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// Shift Assignments Manager (Mitarbeiter-Verwaltung)
// =============================================================================

interface ShiftAssignmentsManagerProps {
  shiftId: string;
  requiredCount: number;
  filledCount: number;
  allowRemove?: boolean; // Erlaube Entfernen von Zuweisungen (default: true)
}

function ShiftAssignmentsManager({ shiftId, requiredCount, filledCount, allowRemove = true }: ShiftAssignmentsManagerProps) {
  const { assignments, loading, error, assignMember, removeAssignment } = useShiftAssignments(shiftId);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Mitarbeiter laden
  useEffect(() => {
    async function loadMembers() {
      try {
        const data = await getMembers();
        setMembers(data.members);
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        setMembersLoading(false);
      }
    }
    loadMembers();
  }, []);

  const handleAssign = async () => {
    if (!selectedMember) return;
    setActionLoading('assign');
    try {
      await assignMember(selectedMember);
      setSelectedMember('');
    } catch {
      // Error wird im Hook behandelt
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (!confirm('Zuweisung wirklich entfernen? Der Mitarbeiter wird benachrichtigt.')) return;
    setActionLoading(assignmentId);
    try {
      await removeAssignment(assignmentId);
      // Erfolgreich entfernt - refresh wird automatisch durch den Hook ausgelöst
    } catch (err) {
      // Fehler anzeigen
      console.error('Fehler beim Entfernen der Zuweisung:', err);
      alert(err instanceof Error ? err.message : 'Fehler beim Entfernen der Zuweisung');
    } finally {
      setActionLoading(null);
    }
  };

  // Bereits zugewiesene Mitarbeiter filtern
  const assignedUids = assignments.map((a) => a.uid);
  const availableMembers = members.filter((m) => !assignedUids.includes(m.uid));
  const freeSlots = requiredCount - filledCount;

  return (
    <div className={styles.assignmentsManager}>
      <h3 className={styles.assignmentsTitle}>
        👥 Zugewiesene Mitarbeiter ({assignments.length}/{requiredCount})
      </h3>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => window.location.reload()} className={styles.retryBtn} style={{ marginLeft: '0.5rem' }}>
            Seite neu laden
          </button>
        </div>
      )}

      {loading && <div className={styles.loading}>Laden...</div>}

      {/* Liste der Zuweisungen */}
      {!loading && assignments.length > 0 && (
        <div className={styles.assignmentsList}>
          {assignments.map((assignment) => (
            <div key={assignment.assignmentId} className={styles.assignmentItem}>
              <div className={styles.assignmentInfo}>
                <span className={styles.assignmentAvatar}>
                  {assignment.displayName.charAt(0).toUpperCase()}
                </span>
                <div className={styles.assignmentDetails}>
                  <span className={styles.assignmentName}>{assignment.displayName}</span>
                  {assignment.email && (
                    <span className={styles.assignmentEmail}>{assignment.email}</span>
                  )}
                  {/* Security-Qualifikationen anzeigen */}
                  {(() => {
                    const member = members.find(m => m.uid === assignment.uid);
                    if (!member) return null;
                    const qualifications: string[] = [];
                    if (member.hasSachkunde) qualifications.push('📜 Sachkunde');
                    if (member.hasFuehrerschein) qualifications.push('🚗 Führerschein');
                    if (member.hasUnterweisung) qualifications.push('✅ Unterweisung');
                    if (member.securityQualifications && member.securityQualifications.length > 0) {
                      qualifications.push(...member.securityQualifications.map(q => `🔐 ${q}`));
                    }
                    if (qualifications.length === 0) return null;
                    return (
                      <div style={{ 
                        display: 'flex', 
                        gap: 'var(--spacing-xs)', 
                        flexWrap: 'wrap',
                        marginTop: 'var(--spacing-xs)',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-light)'
                      }}>
                        {qualifications.map((q, idx) => (
                          <span key={idx} style={{ 
                            background: 'var(--color-bg-secondary)', 
                            padding: '2px 6px', 
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-xs)'
                          }}>
                            {q}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {allowRemove && (
                <button
                  className={`${styles.button} ${styles.buttonDanger} ${styles.buttonSmall}`}
                  onClick={() => handleRemove(assignment.assignmentId)}
                  disabled={actionLoading === assignment.assignmentId}
                  title="Zuweisung entfernen"
                >
                  {actionLoading === assignment.assignmentId ? '...' : '✕'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && assignments.length === 0 && (
        <p className={styles.noAssignments}>Noch keine Mitarbeiter zugewiesen.</p>
      )}

      {/* Mitarbeiter hinzufügen */}
      {freeSlots > 0 && (
        <div className={styles.addAssignment}>
          <div className={styles.addAssignmentHeader}>
            <span>➕ Mitarbeiter direkt zuweisen</span>
            <span className={styles.freeSlots}>{freeSlots} Plätze frei</span>
          </div>
          <div className={styles.addAssignmentForm}>
            <select
              className={styles.memberSelect}
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              disabled={membersLoading || availableMembers.length === 0}
            >
              <option value="">
                {membersLoading
                  ? 'Mitarbeiter werden geladen...'
                  : availableMembers.length === 0
                  ? 'Keine verfügbaren Mitarbeiter'
                  : 'Mitarbeiter auswählen...'}
              </option>
              {availableMembers.map((member) => (
                <option key={member.uid} value={member.uid}>
                  {member.displayName || member.email} {member.role === 'admin' ? '(Admin)' : member.role === 'manager' ? '(Manager)' : ''}
                </option>
              ))}
            </select>
            <button
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={handleAssign}
              disabled={!selectedMember || actionLoading === 'assign'}
            >
              {actionLoading === 'assign' ? 'Wird zugewiesen...' : 'Zuweisen'}
            </button>
          </div>
        </div>
      )}

      {freeSlots === 0 && (
        <div className={styles.shiftFull}>
          ✅ Schicht ist vollständig besetzt
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Edit Shift Form
// =============================================================================

interface EditShiftFormProps {
  shift: Shift;
  onSubmit: (data: CreateShiftRequest) => Promise<void>;
  onCancel: () => void;
}

function EditShiftForm({ shift, onSubmit, onCancel }: EditShiftFormProps) {
  const [title, setTitle] = useState(shift.title);
  // Verwende Adresse als Standort-Name, falls vorhanden, sonst Name
  const initialLocationName = shift.location.address || shift.location.name;
  const [locationName, setLocationName] = useState(initialLocationName);
  const [locationAddress, setLocationAddress] = useState(shift.location.address || shift.location.name || '');
  const [locationLatitude, setLocationLatitude] = useState<number | undefined>(shift.location.latitude);
  const [locationLongitude, setLocationLongitude] = useState<number | undefined>(shift.location.longitude);
  
  // Wenn Adresse ausgewählt wird, auch als Standort-Name verwenden (falls Standort leer)
  const handleLocationChange = (location: Partial<ShiftLocation>) => {
    if (location.address) {
      setLocationAddress(location.address);
      // Wenn Standort noch leer ist, verwende die Adresse als Standort-Name
      if (!locationName.trim()) {
        setLocationName(location.address);
      }
    }
    if (location.latitude !== undefined) {
      setLocationLatitude(location.latitude);
    }
    if (location.longitude !== undefined) {
      setLocationLongitude(location.longitude);
    }
  };
  const [startsAt, setStartsAt] = useState(shift.startsAt.slice(0, 16));
  const [endsAt, setEndsAt] = useState(shift.endsAt.slice(0, 16));
  const [requiredCount, setRequiredCount] = useState(shift.requiredCount);
  const [payRate, setPayRate] = useState(shift.payRate?.toString() || '');
  const [applyDeadline, setApplyDeadline] = useState(shift.applyDeadline?.slice(0, 16) || '');
  const [crewLeaderUid, setCrewLeaderUid] = useState(shift.crewLeaderUid || '');
  const [isPublicPool, setIsPublicPool] = useState(shift.isPublicPool || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Mitglieder für Crew-Leiter-Auswahl
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  useEffect(() => {
    async function loadMembers() {
      try {
        const data = await getMembers();
        setMembers(data.members);
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        setMembersLoading(false);
      }
    }
    loadMembers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const location: CreateShiftRequest['location'] = {
        name: locationName.trim(),
      };
      if (locationAddress.trim()) {
        location.address = locationAddress.trim();
      }
      if (locationLatitude !== undefined && locationLongitude !== undefined) {
        location.latitude = locationLatitude;
        location.longitude = locationLongitude;
      }

      const data: CreateShiftRequest = {
        title: title.trim(),
        location,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        requiredCount,
        payRate: payRate ? parseFloat(payRate) : undefined,
        applyDeadline: applyDeadline ? new Date(applyDeadline).toISOString() : undefined,
        crewLeaderUid: crewLeaderUid || undefined,
        isPublicPool,
      };

      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Titel *</label>
        <input
          type="text"
          className={styles.formInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Standort *</label>
        <AddressAutocomplete
          value={locationName}
          onChange={handleLocationChange}
          placeholder="Adresse eingeben oder auswählen"
          required
        />
        <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-light)' }}>
          Beginne mit der Eingabe, um Adressvorschläge zu sehen
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Start *</label>
          <input
            type="datetime-local"
            className={styles.formInput}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Ende *</label>
          <input
            type="datetime-local"
            className={styles.formInput}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Benötigte Personen * (min. {shift.filledCount})</label>
          <input
            type="number"
            className={styles.formInput}
            value={requiredCount}
            onChange={(e) => setRequiredCount(parseInt(e.target.value) || 1)}
            min={shift.filledCount || 1}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Stundenlohn (optional)</label>
          <input
            type="number"
            className={styles.formInput}
            value={payRate}
            onChange={(e) => setPayRate(e.target.value)}
            step="0.01"
            min="0"
            placeholder="€/h"
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Bewerbungsfrist (optional)</label>
        <input
          type="datetime-local"
          className={styles.formInput}
          value={applyDeadline}
          onChange={(e) => setApplyDeadline(e.target.value)}
        />
      </div>

      {/* Crew-Leiter auswählen */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>👑 Crew-Leiter (optional)</label>
        <p className={styles.preAssignHint}>
          Der Crew-Leiter kann die Schicht beenden und Zeiten eintragen/korrigieren.
        </p>
        {membersLoading ? (
          <div className={styles.loading}>Mitarbeiter werden geladen...</div>
        ) : (
          <select
            className={styles.formInput}
            value={crewLeaderUid}
            onChange={(e) => setCrewLeaderUid(e.target.value)}
          >
            <option value="">Kein Crew-Leiter</option>
            {members.map((member) => (
              <option key={member.uid} value={member.uid}>
                {member.displayName || member.email}
                {member.role === 'admin' && ' (Admin)'}
                {member.role === 'manager' && ' (Manager)'}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Freelancer Pool Freigabe */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          <input
            type="checkbox"
            checked={isPublicPool}
            onChange={(e) => setIsPublicPool(e.target.checked)}
            className={styles.checkbox}
          />
          Zum Freelancer Pool freigeben
        </label>
        <p className={styles.formHint}>
          Wenn aktiviert, wird diese Schicht im öffentlichen Freelancer Pool angezeigt, 
          sodass externe Freelancer sich darauf bewerben können.
        </p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.formActions}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Wird gespeichert...' : '💾 Speichern'}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// Shift Card
// =============================================================================

interface ShiftCardProps {
  shift: AdminShift;
  onPublish: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onCancel: () => void;
  onViewApplications: () => void;
  isLoading: boolean;
}

function ShiftCard({ shift, onPublish, onEdit, onDelete, onClose, onCancel, onViewApplications, isLoading }: ShiftCardProps) {
  const canPublish = shift.status === SHIFT_STATUS.DRAFT;
  const canEdit = shift.status === SHIFT_STATUS.DRAFT || shift.status === SHIFT_STATUS.PUBLISHED;
  const canDelete = shift.status === SHIFT_STATUS.DRAFT;
  const canViewApplications = shift.status === SHIFT_STATUS.PUBLISHED || shift.status === SHIFT_STATUS.CLOSED;
  const canClose = shift.status === SHIFT_STATUS.PUBLISHED;
  const canCancelShift = shift.status !== SHIFT_STATUS.CANCELLED;

  // Bewerbungs-Statistiken
  const hasPendingApplications = shift.pendingApplications > 0;

  return (
    <div className={styles.card} style={{ cursor: 'default' }}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{shift.title}</h3>
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
          {hasPendingApplications && (
            <span 
              className={styles.applicationBadge}
              title={`${shift.pendingApplications} ausstehende Bewerbung(en)`}
            >
              📩 {shift.pendingApplications}
            </span>
          )}
          <span className={`${styles.cardBadge} ${getShiftStatusBadgeClass(shift.status)}`}>
            {getShiftStatusLabel(shift.status)}
          </span>
        </div>
      </div>

      <div className={styles.cardMeta}>
        <div className={styles.cardMetaItem}>
          <span className={styles.cardMetaIcon}>📍</span>
          {shift.location.name}
          {shift.location.address && (
            <span 
              style={{ 
                color: 'var(--color-primary)', 
                marginLeft: '4px', 
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
              onClick={(e) => {
                e.stopPropagation();
                openAddressInMaps(shift.location);
              }}
              title="In Google Maps öffnen"
            >
              🗺️ {shift.location.address}
            </span>
          )}
        </div>
        <div className={styles.cardMetaItem}>
          <span className={styles.cardMetaIcon}>📅</span>
          {formatDate(shift.startsAt)}
        </div>
        <div className={styles.cardMetaItem}>
          <span className={styles.cardMetaIcon}>🕐</span>
          {formatTime(shift.startsAt)} - {formatTime(shift.endsAt)}
        </div>
        <div className={styles.cardMetaItem}>
          <span className={styles.cardMetaIcon}>👥</span>
          <span style={{ 
            color: shift.filledCount >= shift.requiredCount ? 'var(--color-green)' : 'inherit',
            fontWeight: shift.filledCount >= shift.requiredCount ? 600 : 400
          }}>
            {shift.filledCount} / {shift.requiredCount} besetzt
          </span>
          {shift.requiredCount - shift.filledCount > 0 && shift.status === SHIFT_STATUS.PUBLISHED && (
            <span style={{ color: 'var(--color-orange)', marginLeft: '8px' }}>
              ({shift.requiredCount - shift.filledCount} frei)
            </span>
          )}
        </div>
        {shift.payRate && (
          <div className={styles.cardMetaItem}>
            <span className={styles.cardMetaIcon}>💰</span>
            {shift.payRate.toFixed(2)} €/h
          </div>
        )}
        {shift.applyDeadline && (
          <div className={styles.cardMetaItem}>
            <span className={styles.cardMetaIcon}>⏰</span>
            Frist: {formatDateTime(shift.applyDeadline)}
          </div>
        )}
      </div>

      <div className={styles.cardFooter}>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {canEdit && (
            <button
              className={`${styles.button} ${styles.buttonGhost} ${styles.buttonSmall}`}
              onClick={onEdit}
              disabled={isLoading}
              title="Bearbeiten"
            >
              ✏️ Bearbeiten
            </button>
          )}
          {canPublish && (
            <button
              className={`${styles.button} ${styles.buttonSuccess} ${styles.buttonSmall}`}
              onClick={onPublish}
              disabled={isLoading}
            >
              {isLoading ? '...' : '📢 Veröffentlichen'}
            </button>
          )}
          {canViewApplications && (
            <button
              className={`${styles.button} ${hasPendingApplications ? styles.buttonWarning : styles.buttonPrimary} ${styles.buttonSmall}`}
              onClick={onViewApplications}
            >
              📝 Bewerbungen ({shift.pendingApplications}/{shift.totalApplications})
            </button>
          )}
          {canClose && (
            <button
              className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}
              onClick={onClose}
              disabled={isLoading}
              title="Keine weiteren Bewerbungen"
            >
              🔒 Schließen
            </button>
          )}
          {canDelete && (
            <button
              className={`${styles.button} ${styles.buttonDanger} ${styles.buttonSmall}`}
              onClick={onDelete}
              disabled={isLoading}
              title="Löschen"
            >
              🗑️
            </button>
          )}
          {canCancelShift && shift.status !== SHIFT_STATUS.DRAFT && (
            <button
              className={`${styles.button} ${styles.buttonDanger} ${styles.buttonSmall}`}
              onClick={onCancel}
              disabled={isLoading}
              title="Absagen"
            >
              ❌ Absagen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Applications Modal
// =============================================================================

interface ApplicationsModalProps {
  shiftId: string;
  shiftTitle: string;
  onClose: () => void;
}

function ApplicationsModal({ shiftId, shiftTitle, onClose }: ApplicationsModalProps) {
  const { applications, loading, error, acceptApplication, rejectApplication, revokeApplication } = useShiftApplications(shiftId);
  const [selectedFreelancer, setSelectedFreelancer] = useState<{
    profile: any;
    email: string;
    note?: string;
  } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handleAccept = async (applicationId: string) => {
    setActionInProgress(applicationId);
    try {
      await acceptApplication(applicationId);
    } catch {
      // Error handled in hook
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (applicationId: string) => {
    setActionInProgress(applicationId);
    try {
      await rejectApplication(applicationId);
    } catch {
      // Error handled in hook
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRevoke = async (applicationId: string) => {
    if (!confirm('Annahme wirklich rückgängig machen? Die Person wird aus der Schicht entfernt.')) {
      return;
    }
    setActionInProgress(applicationId);
    try {
      await revokeApplication(applicationId);
    } catch {
      // Error handled in hook
    } finally {
      setActionInProgress(null);
    }
  };

  const pendingApplications = applications.filter((a) => a.status === APPLICATION_STATUS.PENDING);
  const acceptedApplications = applications.filter((a) => a.status === APPLICATION_STATUS.ACCEPTED);
  const otherApplications = applications.filter((a) => 
    a.status !== APPLICATION_STATUS.PENDING && a.status !== APPLICATION_STATUS.ACCEPTED
  );

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={`${styles.modalContent} ${styles.modalContentWide}`} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>📝 Bewerbungen: {shiftTitle}</h2>

        {loading && (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}></div>
            <p>Bewerbungen werden geladen...</p>
          </div>
        )}
        {error && <div className={styles.error}>⚠️ {error}</div>}

        {!loading && applications.length === 0 && (
          <div className={styles.empty} style={{ padding: 'var(--spacing-xl)' }}>
            <div className={styles.emptyIcon}>📭</div>
            <p>Noch keine Bewerbungen eingegangen.</p>
          </div>
        )}

        {pendingApplications.length > 0 && (
          <>
            <div className={styles.sectionHeader}>
              <span>⏳ Ausstehend</span>
              <span className={styles.sectionCount}>{pendingApplications.length}</span>
            </div>
            <div className={styles.applicationsList}>
              {pendingApplications.map((app) => (
                <div key={app.id} className={styles.applicationRow}>
                  <div className={styles.applicationInfo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={styles.applicationEmail}>{app.email || app.uid}</span>
                      {app.isFreelancer && (app as any).verificationStatus && (
                        <VerificationBadge
                          status={(app as any).verificationStatus}
                          size="small"
                          showLabel={false}
                        />
                      )}
                    </div>
                    {app.note && <span className={styles.applicationNote}>„{app.note}"</span>}
                    <span className={styles.applicationDate}>
                      📅 Beworben am {formatDateTime(app.createdAt)}
                    </span>
                  </div>
                  <div className={styles.applicationActions}>
                    {app.isFreelancer && (app as any).freelancerProfile && (
                      <button
                        className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}
                        onClick={() => setSelectedFreelancer({
                          profile: (app as any).freelancerProfile,
                          email: app.email || app.uid,
                          note: app.note,
                        })}
                        title="Freelancer-Details anzeigen"
                      >
                        👤 Details
                      </button>
                    )}
                    <button
                      className={`${styles.button} ${styles.buttonSuccess} ${styles.buttonSmall}`}
                      onClick={() => handleAccept(app.id)}
                      disabled={actionInProgress === app.id}
                    >
                      ✓ Annehmen
                    </button>
                    <button
                      className={`${styles.button} ${styles.buttonDanger} ${styles.buttonSmall}`}
                      onClick={() => handleReject(app.id)}
                      disabled={actionInProgress === app.id}
                    >
                      ✗ Ablehnen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {acceptedApplications.length > 0 && (
          <>
            <div className={styles.sectionHeader}>
              <span>✅ Angenommen</span>
              <span className={styles.sectionCount}>{acceptedApplications.length}</span>
            </div>
            <div className={styles.applicationsList}>
              {acceptedApplications.map((app) => (
                <div key={app.id} className={styles.applicationRow}>
                  <div className={styles.applicationInfo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={styles.applicationEmail}>{app.email || app.uid}</span>
                      {app.isFreelancer && (app as any).verificationStatus && (
                        <VerificationBadge
                          status={(app as any).verificationStatus}
                          size="small"
                          showLabel={false}
                        />
                      )}
                    </div>
                    {app.note && <span className={styles.applicationNote}>„{app.note}"</span>}
                    <span className={styles.applicationDate}>
                      📅 Beworben am {formatDateTime(app.createdAt)}
                    </span>
                  </div>
                  <div className={styles.applicationActions}>
                    <span className={`${styles.statusBadge} ${getAppStatusBadgeClass(app.status)}`}>
                      {getAppStatusLabel(app.status)}
                    </span>
                    <button
                      className={`${styles.button} ${styles.buttonDanger} ${styles.buttonSmall}`}
                      onClick={() => handleRevoke(app.id)}
                      disabled={actionInProgress === app.id}
                      title="Annahme rückgängig machen"
                    >
                      ↩️ Rückgängig
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {otherApplications.length > 0 && (
          <>
            <div className={styles.sectionHeader}>
              <span>📋 Sonstige</span>
              <span className={styles.sectionCount}>{otherApplications.length}</span>
            </div>
            <div className={styles.applicationsList}>
              {otherApplications.map((app) => (
                <div key={app.id} className={styles.applicationRow}>
                  <div className={styles.applicationInfo}>
                    <span className={styles.applicationEmail}>{app.email || app.uid}</span>
                    {app.note && <span className={styles.applicationNote}>„{app.note}"</span>}
                    <span className={styles.applicationDate}>
                      📅 Beworben am {formatDateTime(app.createdAt)}
                    </span>
                  </div>
                  <span className={`${styles.statusBadge} ${getAppStatusBadgeClass(app.status)}`}>
                    {getAppStatusLabel(app.status)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.formActions}>
          <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>

      {selectedFreelancer && (
        <FreelancerDetailModal
          freelancerProfile={selectedFreelancer.profile}
          email={selectedFreelancer.email}
          note={selectedFreelancer.note}
          onClose={() => setSelectedFreelancer(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

type View = 'list' | 'create' | 'edit';
type ViewMode = 'table' | 'cards';
type SortField = 'date' | 'title' | 'applications' | 'status';
type SortDirection = 'asc' | 'desc';

interface Filters {
  status: ShiftStatus | 'all';
  occupancy: 'all' | 'available' | 'full';
  search: string;
}

export function AdminShiftsPage() {
  const { shifts, loading, error, refresh, createShift, updateShift, deleteShift, publishShift, closeShift, cancelShift } = useAdminShifts();
  const [view, setView] = useState<View>('list');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [loadingShiftId, setLoadingShiftId] = useState<string | null>(null);
  const [selectedShiftForApps, setSelectedShiftForApps] = useState<AdminShift | null>(null);
  const [editingShift, setEditingShift] = useState<AdminShift | null>(null);
  
  // Filter & Sortierung
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    occupancy: 'all',
    search: '',
  });
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleCreateShift = async (data: CreateShiftRequest, preAssignedMembers: string[] = []) => {
    const shift = await createShift(data);
    
    // Vorausgewählte Mitarbeiter zuweisen
    if (preAssignedMembers.length > 0 && shift) {
      for (const memberUid of preAssignedMembers) {
        try {
          await assignMemberToShift(shift.id, memberUid);
        } catch (err) {
          console.error(`Failed to assign member ${memberUid}:`, err);
        }
      }
      // Refresh um die Zuweisungen anzuzeigen
      await refresh();
    }
    
    setView('list');
  };

  const handleUpdateShift = async (data: CreateShiftRequest) => {
    if (!editingShift) return;
    await updateShift(editingShift.id, data);
    setEditingShift(null);
    setView('list');
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Schicht wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }
    setLoadingShiftId(shiftId);
    try {
      await deleteShift(shiftId);
      // Zurück zur Liste nach erfolgreichem Löschen
      if (view === 'edit' && editingShift?.id === shiftId) {
        setView('list');
        setEditingShift(null);
      }
      await refresh();
    } catch {
      // Error handled in hook
    } finally {
      setLoadingShiftId(null);
    }
  };

  const handlePublish = async (shiftId: string) => {
    setLoadingShiftId(shiftId);
    try {
      await publishShift(shiftId);
    } catch {
      // Error handled in hook
    } finally {
      setLoadingShiftId(null);
    }
  };

  const handleClose = async (shiftId: string) => {
    if (!confirm('Schicht schließen? Es können keine neuen Bewerbungen mehr eingehen.')) {
      return;
    }
    setLoadingShiftId(shiftId);
    try {
      await closeShift(shiftId);
    } catch {
      // Error handled in hook
    } finally {
      setLoadingShiftId(null);
    }
  };

  const handleCancel = async (shiftId: string) => {
    if (!confirm('Schicht wirklich absagen? Alle Bewerber werden benachrichtigt.')) {
      return;
    }
    setLoadingShiftId(shiftId);
    try {
      await cancelShift(shiftId);
    } catch {
      // Error handled in hook
    } finally {
      setLoadingShiftId(null);
    }
  };

  const handleEdit = (shift: AdminShift) => {
    setEditingShift(shift);
    setView('edit');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtern
  const filteredShifts = shifts.filter((shift) => {
    // Status-Filter
    if (filters.status !== 'all' && shift.status !== filters.status) {
      return false;
    }
    // Besetzungs-Filter
    if (filters.occupancy === 'available' && shift.filledCount >= shift.requiredCount) {
      return false;
    }
    if (filters.occupancy === 'full' && shift.filledCount < shift.requiredCount) {
      return false;
    }
    // Suchfilter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        shift.title.toLowerCase().includes(searchLower) ||
        shift.location.name.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Sortieren
  const sortedShifts = [...filteredShifts].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'date':
        comparison = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'applications':
        comparison = b.pendingApplications - a.pendingApplications;
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Stats
  const stats = {
    total: shifts.length,
    draft: shifts.filter((s) => s.status === SHIFT_STATUS.DRAFT).length,
    published: shifts.filter((s) => s.status === SHIFT_STATUS.PUBLISHED).length,
    pendingApps: shifts.reduce((sum, s) => sum + s.pendingApplications, 0),
  };

  if (view === 'create') {
    return (
      <div className={styles.page}>
        <button className={styles.backButton} onClick={() => setView('list')}>
          ← Zurück zur Übersicht
        </button>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>➕</span>
          Neue Schicht erstellen
        </h1>
        <div className={styles.detail}>
          <CreateShiftForm onSubmit={handleCreateShift} onCancel={() => setView('list')} />
        </div>
      </div>
    );
  }

  if (view === 'edit' && editingShift) {
    return (
      <div className={styles.page}>
        <button className={styles.backButton} onClick={() => { setView('list'); setEditingShift(null); }}>
          ← Zurück zur Übersicht
        </button>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>✏️</span>
          Schicht bearbeiten: {editingShift.title}
        </h1>
        
        <div className={styles.editLayout}>
          {/* Linke Spalte: Formular */}
          <div className={styles.editFormSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
              <h2 className={styles.editSectionTitle} style={{ margin: 0 }}>📝 Schichtdaten</h2>
              {(editingShift.status === SHIFT_STATUS.DRAFT || editingShift.status === SHIFT_STATUS.CANCELLED) && (
                <button
                  className={`${styles.button} ${styles.buttonDanger} ${styles.buttonSmall}`}
                  onClick={() => {
                    if (confirm('Schicht wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
                      handleDeleteShift(editingShift.id);
                    }
                  }}
                  disabled={loadingShiftId === editingShift.id}
                  title="Schicht löschen"
                >
                  🗑️ Löschen
                </button>
              )}
            </div>
            <EditShiftForm 
              shift={editingShift} 
              onSubmit={handleUpdateShift} 
              onCancel={() => { setView('list'); setEditingShift(null); }} 
            />
          </div>

          {/* Rechte Spalte: Mitarbeiter-Verwaltung + Dokumente */}
          <div className={styles.editAssignmentsSection}>
            <ShiftAssignmentsManager 
              shiftId={editingShift.id}
              requiredCount={editingShift.requiredCount}
              filledCount={editingShift.filledCount}
              allowRemove={true}
            />
            
            {/* Dokumente */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
              <ShiftDocumentList
                shiftId={editingShift.id}
                canView={true}
                canUpload={true}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Kompakter Header */}
      <div className={styles.adminHeader}>
        <div className={styles.adminHeaderLeft}>
          <h1 className={styles.adminTitle}>Schicht-Verwaltung</h1>
          {stats.pendingApps > 0 && (
            <span className={styles.pendingBadge}>
              {stats.pendingApps} ausstehend
            </span>
          )}
        </div>
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={() => setView('create')}
        >
          ➕ Neue Schicht
        </button>
      </div>

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {/* Kompakte Stats */}
      {!loading && shifts.length > 0 && (
        <div className={styles.miniStats}>
          <span className={styles.miniStat}>
            <strong>{stats.total}</strong> gesamt
          </span>
          <span className={styles.miniStatDivider}>|</span>
          <span className={styles.miniStat}>
            <strong>{stats.draft}</strong> Entwürfe
          </span>
          <span className={styles.miniStatDivider}>|</span>
          <span className={styles.miniStat} style={{ color: 'var(--color-green)' }}>
            <strong>{stats.published}</strong> aktiv
          </span>
        </div>
      )}

      {/* Filter & Sortierung */}
      {!loading && shifts.length > 0 && (
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            {/* Suche */}
            <input
              type="text"
              className={styles.searchInput}
              placeholder="🔍 Suchen..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />

            {/* Status-Filter */}
            <select
              className={styles.filterSelect}
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters['status'] })}
            >
              <option value="all">Alle Status</option>
              <option value={SHIFT_STATUS.DRAFT}>📝 Entwürfe</option>
              <option value={SHIFT_STATUS.PUBLISHED}>✅ Veröffentlicht</option>
              <option value={SHIFT_STATUS.CLOSED}>🔒 Geschlossen</option>
              <option value={SHIFT_STATUS.CANCELLED}>❌ Abgesagt</option>
            </select>

            {/* Besetzungs-Filter */}
            <select
              className={styles.filterSelect}
              value={filters.occupancy}
              onChange={(e) => setFilters({ ...filters, occupancy: e.target.value as Filters['occupancy'] })}
            >
              <option value="all">Alle Plätze</option>
              <option value="available">🟢 Noch frei</option>
              <option value="full">🔴 Ausgebucht</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            {/* Sortierung */}
            <select
              className={styles.filterSelect}
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('-');
                setSortField(field as SortField);
                setSortDirection(dir as SortDirection);
              }}
            >
              <option value="date-asc">📅 Datum ↑</option>
              <option value="date-desc">📅 Datum ↓</option>
              <option value="title-asc">🔤 Titel A-Z</option>
              <option value="title-desc">🔤 Titel Z-A</option>
              <option value="applications-desc">📩 Bewerbungen ↓</option>
            </select>

            {/* Ansicht wechseln */}
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.active : ''}`}
                onClick={() => setViewMode('table')}
                title="Tabellenansicht"
              >
                ☰
              </button>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === 'cards' ? styles.active : ''}`}
                onClick={() => setViewMode('cards')}
                title="Kartenansicht"
              >
                ▦
              </button>
            </div>

            <button
              className={styles.refreshBtn}
              onClick={refresh}
              title="Aktualisieren"
            >
              🔄
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <p>Schichten werden geladen...</p>
        </div>
      )}

      {!loading && shifts.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📝</div>
          <p className={styles.emptyText}>Noch keine Schichten erstellt</p>
          <p style={{ color: 'var(--color-text-light)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-lg)' }}>
            Erstelle deine erste Schicht und veröffentliche sie im Pool.
          </p>
          <button
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={() => setView('create')}
          >
            ➕ Erste Schicht erstellen
          </button>
        </div>
      )}

      {!loading && sortedShifts.length === 0 && shifts.length > 0 && (
        <div className={styles.empty} style={{ padding: 'var(--spacing-xl)' }}>
          <p>Keine Schichten entsprechen den Filterkriterien.</p>
          <button
            className={`${styles.button} ${styles.buttonGhost}`}
            onClick={() => setFilters({ status: 'all', occupancy: 'all', search: '' })}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            Filter zurücksetzen
          </button>
        </div>
      )}

      {/* Tabellen-Ansicht */}
      {!loading && sortedShifts.length > 0 && viewMode === 'table' && (
        <div className={styles.tableWrapper}>
          <table className={styles.shiftsTable}>
            <thead>
              <tr>
                <th onClick={() => handleSort('status')} className={styles.sortableHeader}>
                  Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('title')} className={styles.sortableHeader}>
                  Schicht {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('date')} className={styles.sortableHeader}>
                  Datum {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>Besetzung</th>
                <th onClick={() => handleSort('applications')} className={styles.sortableHeader}>
                  Bewerbungen {sortField === 'applications' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedShifts.map((shift) => (
                <tr key={shift.id} className={shift.pendingApplications > 0 ? styles.hasApplications : ''}>
                  <td>
                    <span className={`${styles.statusPill} ${getShiftStatusBadgeClass(shift.status)}`}>
                      {getShiftStatusLabel(shift.status)}
                    </span>
                  </td>
                  <td>
                    <div className={styles.shiftCell}>
                      <strong>{shift.title}</strong>
                      <span className={styles.locationText}>📍 {shift.location.name}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.dateCell}>
                      <span>{formatDate(shift.startsAt)}</span>
                      <span className={styles.timeText}>
                        {formatTime(shift.startsAt)} - {formatTime(shift.endsAt)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.occupancyCell}>
                      <div className={styles.occupancyBar}>
                        <div 
                          className={styles.occupancyFill} 
                          style={{ 
                            width: `${shift.requiredCount > 0 ? Math.min((shift.filledCount / shift.requiredCount) * 100, 100) : 0}%`,
                            background: shift.filledCount >= shift.requiredCount 
                              ? 'var(--color-green)' 
                              : 'var(--color-primary)'
                          }}
                        />
                      </div>
                      <span className={styles.occupancyText}>
                        {shift.filledCount}/{shift.requiredCount}
                      </span>
                    </div>
                  </td>
                  <td>
                    {shift.pendingApplications > 0 ? (
                      <button
                        className={styles.applicationsPill}
                        onClick={() => setSelectedShiftForApps(shift)}
                      >
                        📩 {shift.pendingApplications} neu
                      </button>
                    ) : shift.totalApplications > 0 ? (
                      <button
                        className={styles.applicationsLink}
                        onClick={() => setSelectedShiftForApps(shift)}
                      >
                        {shift.totalApplications} gesamt
                      </button>
                    ) : (
                      <span className={styles.noApplications}>–</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      {shift.status === SHIFT_STATUS.DRAFT && (
                        <button
                          className={styles.actionBtn}
                          onClick={() => handlePublish(shift.id)}
                          disabled={loadingShiftId === shift.id}
                          title="Veröffentlichen"
                        >
                          📢
                        </button>
                      )}
                      {(shift.status === SHIFT_STATUS.DRAFT || shift.status === SHIFT_STATUS.PUBLISHED) && (
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleEdit(shift)}
                          title="Bearbeiten"
                        >
                          ✏️
                        </button>
                      )}
                      {shift.status === SHIFT_STATUS.PUBLISHED && (
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleClose(shift.id)}
                          disabled={loadingShiftId === shift.id}
                          title="Schließen"
                        >
                          🔒
                        </button>
                      )}
                      {/* Löschen: DRAFT und CANCELLED */}
                      {(shift.status === SHIFT_STATUS.DRAFT || shift.status === SHIFT_STATUS.CANCELLED) && (
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => handleDeleteShift(shift.id)}
                          disabled={loadingShiftId === shift.id}
                          title="Löschen"
                        >
                          🗑️
                        </button>
                      )}
                      {/* Absagen: Für PUBLISHED, CLOSED, COMPLETED */}
                      {shift.status !== SHIFT_STATUS.CANCELLED && shift.status !== SHIFT_STATUS.DRAFT && (
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => handleCancel(shift.id)}
                          disabled={loadingShiftId === shift.id}
                          title="Absagen"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Karten-Ansicht */}
      {!loading && sortedShifts.length > 0 && viewMode === 'cards' && (
        <div className={styles.grid}>
          {sortedShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              onPublish={() => handlePublish(shift.id)}
              onEdit={() => handleEdit(shift)}
              onDelete={() => handleDeleteShift(shift.id)}
              onClose={() => handleClose(shift.id)}
              onCancel={() => handleCancel(shift.id)}
              onViewApplications={() => setSelectedShiftForApps(shift)}
              isLoading={loadingShiftId === shift.id}
            />
          ))}
        </div>
      )}

      {/* Ergebniszähler */}
      {!loading && sortedShifts.length > 0 && (
        <div className={styles.resultCount}>
          {sortedShifts.length} von {shifts.length} Schichten
        </div>
      )}

      {selectedShiftForApps && (
        <ApplicationsModal
          shiftId={selectedShiftForApps.id}
          shiftTitle={selectedShiftForApps.title}
          onClose={() => {
            setSelectedShiftForApps(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
