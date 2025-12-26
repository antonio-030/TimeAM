/**
 * Members Page
 *
 * Mitarbeiterverwaltung für Admins - mit Detailansicht und Schichten.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMembers, useMemberShifts } from './hooks';
import { useTenant } from '../../core/tenant';
import { useAuth } from '../../core/auth';
import { useSuperAdminCheck } from '../admin';
import { useDevStaffCheck } from '../support';
import {
  MEMBER_ROLES,
  MEMBER_STATUS,
  type Member,
  type MemberRole,
  type MemberStatus,
  type InviteMemberRequest,
  type UpdateMemberRequest,
  getMemberRoleLabel,
  getMemberStatusLabel,
} from '@timeam/shared';
import type { MemberShift } from './api';
import { generateInviteLink, resetMemberMfa } from './api';
import { getMemberMfaStatus } from '../../core/mfa/api';
import { getMemberFullName, getMemberInitials } from '../../utils/memberNames';
import styles from './Members.module.css';

// =============================================================================
// Helper Functions
// =============================================================================

function getRoleBadgeClass(role: MemberRole): string {
  switch (role) {
    case MEMBER_ROLES.ADMIN:
      return styles.badgeAdmin;
    case MEMBER_ROLES.MANAGER:
      return styles.badgeManager;
    case MEMBER_ROLES.EMPLOYEE:
      return styles.badgeEmployee;
    default:
      return '';
  }
}

function getStatusBadgeClass(status: MemberStatus): string {
  switch (status) {
    case MEMBER_STATUS.ACTIVE:
      return styles.badgeActive;
    case MEMBER_STATUS.INACTIVE:
      return styles.badgeInactive;
    case MEMBER_STATUS.PENDING:
      return styles.badgePending;
    default:
      return '';
  }
}

// getInitials wird jetzt durch getMemberInitials aus utils/memberNames ersetzt

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getShiftStatusLabel(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'Entwurf';
    case 'PUBLISHED':
      return 'Veröffentlicht';
    case 'CLOSED':
      return 'Geschlossen';
    case 'CANCELLED':
      return 'Abgesagt';
    default:
      return status;
  }
}

function getAssignmentStatusLabel(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Bestätigt';
    case 'CANCELLED':
      return 'Storniert';
    default:
      return status;
  }
}

// =============================================================================
// Invite Member Modal
// =============================================================================

interface InviteMemberModalProps {
  onSubmit: (data: InviteMemberRequest) => Promise<void>;
  onClose: () => void;
}

function InviteMemberModal({ onSubmit, onClose }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [role, setRole] = useState<MemberRole>(MEMBER_ROLES.EMPLOYEE);
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  // Security-Qualifikationen
  const [hasSachkunde, setHasSachkunde] = useState(false);
  const [hasFuehrerschein, setHasFuehrerschein] = useState(false);
  const [hasUnterweisung, setHasUnterweisung] = useState(false);
  const [securityQualifications, setSecurityQualifications] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        email: email.trim(),
        displayName: displayName.trim() || undefined,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        address: address.trim() || undefined,
        employeeNumber: employeeNumber.trim() || undefined,
        role,
        department: department.trim() || undefined,
        position: position.trim() || undefined,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        // Security-Qualifikationen
        hasSachkunde: hasSachkunde || undefined,
        hasFuehrerschein: hasFuehrerschein || undefined,
        hasUnterweisung: hasUnterweisung || undefined,
        securityQualifications: securityQualifications.trim() 
          ? securityQualifications.split(',').map(q => q.trim()).filter(q => q.length > 0)
          : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Einladen');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>👤 Mitarbeiter einladen</h2>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>E-Mail *</label>
            <input
              type="email"
              className={styles.formInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mitarbeiter@firma.de"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Name</label>
            <input
              type="text"
              className={styles.formInput}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Max Mustermann"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Vorname</label>
              <input
                type="text"
                className={styles.formInput}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Max"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nachname</label>
              <input
                type="text"
                className={styles.formInput}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Mustermann"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Adresse</label>
            <input
              type="text"
              className={styles.formInput}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Musterstraße 123, 12345 Musterstadt"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Personalnummer</label>
            <input
              type="text"
              className={styles.formInput}
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder="z.B. 12345"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Rolle *</label>
              <select
                className={styles.formSelect}
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
              >
                <option value={MEMBER_ROLES.EMPLOYEE}>Mitarbeiter</option>
                <option value={MEMBER_ROLES.MANAGER}>Manager</option>
                <option value={MEMBER_ROLES.ADMIN}>Administrator</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Stundenlohn</label>
              <input
                type="number"
                className={styles.formInput}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                step="0.01"
                min="0"
                placeholder="€/h"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Abteilung</label>
              <input
                type="text"
                className={styles.formInput}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="z.B. Vertrieb"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Position</label>
              <input
                type="text"
                className={styles.formInput}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="z.B. Teamleiter"
              />
            </div>
          </div>

          {/* Security-Qualifikationen */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel} style={{ marginBottom: 'var(--spacing-sm)' }}>
              🔐 Security-Qualifikationen
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasSachkunde}
                  onChange={(e) => setHasSachkunde(e.target.checked)}
                />
                <span>📜 Sachkunde/Einweisung</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasFuehrerschein}
                  onChange={(e) => setHasFuehrerschein(e.target.checked)}
                />
                <span>🚗 Führerschein</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasUnterweisung}
                  onChange={(e) => setHasUnterweisung(e.target.checked)}
                />
                <span>✅ Unterweisung</span>
              </label>
            </div>
            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              <label className={styles.formLabel} style={{ fontSize: 'var(--font-size-sm)' }}>
                Weitere Qualifikationen (komma-separiert)
              </label>
              <input
                type="text"
                className={styles.formInput}
                value={securityQualifications}
                onChange={(e) => setSecurityQualifications(e.target.value)}
                placeholder="z.B. Brandschutzhelfer, Erste Hilfe"
                style={{ fontSize: 'var(--font-size-sm)' }}
              />
            </div>
          </div>

          {error && <div className={styles.error}>⚠️ {error}</div>}

          <div className={styles.formActions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles.buttonPrimary}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Wird eingeladen...' : '✉️ Einladen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Success Modal (zeigt Password Reset Link)
// =============================================================================

interface InviteSuccessModalProps {
  member: Member;
  passwordResetLink?: string;
  onClose: () => void;
}

function InviteSuccessModal({ member, passwordResetLink, onClose }: InviteSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (passwordResetLink) {
      await navigator.clipboard.writeText(passwordResetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>✅ Mitarbeiter eingeladen!</h2>
        
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <p style={{ marginBottom: 'var(--spacing-md)' }}>
            <strong>{getMemberFullName(member)}</strong> wurde erfolgreich angelegt.
          </p>
          
          {passwordResetLink ? (
            <div className={styles.infoBox}>
              <p style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                🔗 Login-Link für den Mitarbeiter:
              </p>
              <p className={styles.infoText}>
                Teile diesen Link mit dem Mitarbeiter, damit er sein Passwort setzen kann:
              </p>
              <div className={styles.linkCopyRow}>
                <input
                  type="text"
                  className={styles.formInput}
                  value={passwordResetLink}
                  readOnly
                  style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  onClick={handleCopy}
                >
                  {copied ? '✅ Kopiert!' : '📋 Kopieren'}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.infoBoxMuted}>
              <p className={styles.infoText}>
                💡 Der Mitarbeiter kann sich über "Passwort vergessen" auf der Login-Seite 
                ein neues Passwort setzen.
              </p>
            </div>
          )}
        </div>

        <div className={styles.formActions}>
          <button
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={onClose}
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Edit Member Modal
// =============================================================================

interface EditMemberModalProps {
  member: Member;
  onSubmit: (memberId: string, data: UpdateMemberRequest) => Promise<void>;
  onClose: () => void;
}

function EditMemberModal({ member, onSubmit, onClose }: EditMemberModalProps) {
  const [displayName, setDisplayName] = useState(member.displayName || '');
  const [firstName, setFirstName] = useState(member.firstName || '');
  const [lastName, setLastName] = useState(member.lastName || '');
  const [address, setAddress] = useState(member.address || '');
  const [employeeNumber, setEmployeeNumber] = useState(member.employeeNumber || '');
  const [role, setRole] = useState<MemberRole>(member.role);
  const [department, setDepartment] = useState(member.department || '');
  const [position, setPosition] = useState(member.position || '');
  const [hourlyRate, setHourlyRate] = useState(member.hourlyRate?.toString() || '');
  const [phone, setPhone] = useState(member.phone || '');
  // Security-Qualifikationen
  const [hasSachkunde, setHasSachkunde] = useState(member.hasSachkunde || false);
  const [hasFuehrerschein, setHasFuehrerschein] = useState(member.hasFuehrerschein || false);
  const [hasUnterweisung, setHasUnterweisung] = useState(member.hasUnterweisung || false);
  const [securityQualifications, setSecurityQualifications] = useState(
    member.securityQualifications?.join(', ') || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(member.id, {
        displayName: displayName.trim() || undefined,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        address: address.trim() || undefined,
        employeeNumber: employeeNumber.trim() || undefined,
        role,
        department: department.trim() || undefined,
        position: position.trim() || undefined,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        phone: phone.trim() || undefined,
        // Security-Qualifikationen
        hasSachkunde: hasSachkunde || undefined,
        hasFuehrerschein: hasFuehrerschein || undefined,
        hasUnterweisung: hasUnterweisung || undefined,
        securityQualifications: securityQualifications.trim() 
          ? securityQualifications.split(',').map(q => q.trim()).filter(q => q.length > 0)
          : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>✏️ Mitarbeiter bearbeiten</h2>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>E-Mail</label>
            <input
              type="email"
              className={styles.formInput}
              value={member.email}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Name</label>
            <input
              type="text"
              className={styles.formInput}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Max Mustermann"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Vorname</label>
              <input
                type="text"
                className={styles.formInput}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Max"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nachname</label>
              <input
                type="text"
                className={styles.formInput}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Mustermann"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Adresse</label>
            <input
              type="text"
              className={styles.formInput}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Musterstraße 123, 12345 Musterstadt"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Personalnummer</label>
            <input
              type="text"
              className={styles.formInput}
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder="z.B. 12345"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Rolle</label>
              <select
                className={styles.formSelect}
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
              >
                <option value={MEMBER_ROLES.EMPLOYEE}>Mitarbeiter</option>
                <option value={MEMBER_ROLES.MANAGER}>Manager</option>
                <option value={MEMBER_ROLES.ADMIN}>Administrator</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Stundenlohn</label>
              <input
                type="number"
                className={styles.formInput}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                step="0.01"
                min="0"
                placeholder="€/h"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Abteilung</label>
              <input
                type="text"
                className={styles.formInput}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="z.B. Vertrieb"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Position</label>
              <input
                type="text"
                className={styles.formInput}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="z.B. Teamleiter"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Telefon</label>
            <input
              type="tel"
              className={styles.formInput}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 123 456789"
            />
          </div>

          {/* Security-Qualifikationen */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel} style={{ marginBottom: 'var(--spacing-sm)' }}>
              🔐 Security-Qualifikationen
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasSachkunde}
                  onChange={(e) => setHasSachkunde(e.target.checked)}
                />
                <span>📜 Sachkunde/Einweisung</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasFuehrerschein}
                  onChange={(e) => setHasFuehrerschein(e.target.checked)}
                />
                <span>🚗 Führerschein</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasUnterweisung}
                  onChange={(e) => setHasUnterweisung(e.target.checked)}
                />
                <span>✅ Unterweisung</span>
              </label>
            </div>
            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              <label className={styles.formLabel} style={{ fontSize: 'var(--font-size-sm)' }}>
                Weitere Qualifikationen (komma-separiert)
              </label>
              <input
                type="text"
                className={styles.formInput}
                value={securityQualifications}
                onChange={(e) => setSecurityQualifications(e.target.value)}
                placeholder="z.B. Brandschutzhelfer, Erste Hilfe"
                style={{ fontSize: 'var(--font-size-sm)' }}
              />
            </div>
          </div>

          {error && <div className={styles.error}>⚠️ {error}</div>}

          <div className={styles.formActions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={onClose}
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
      </div>
    </div>
  );
}

// =============================================================================
// Member Shifts Panel (Schichten eines Mitarbeiters)
// =============================================================================

interface MemberShiftsPanelProps {
  member: Member;
}

function MemberShiftsPanel({ member }: MemberShiftsPanelProps) {
  const { shifts, loading, error, includeCompleted, setIncludeCompleted, refresh } = 
    useMemberShifts(member.id);

  // Gruppiere Schichten nach Status
  const upcomingShifts = shifts.filter(
    (s) => s.assignmentStatus === 'CONFIRMED' && new Date(s.startsAt) > new Date()
  );
  const activeShifts = shifts.filter(
    (s) => s.assignmentStatus === 'CONFIRMED' && 
           new Date(s.startsAt) <= new Date() && 
           new Date(s.endsAt) > new Date()
  );
  const completedShifts = shifts.filter(
    (s) => new Date(s.endsAt) <= new Date() || s.assignmentStatus === 'CANCELLED'
  );

  const renderShiftCard = (shift: MemberShift) => {
    const isActive = new Date(shift.startsAt) <= new Date() && new Date(shift.endsAt) > new Date();
    const isPast = new Date(shift.endsAt) <= new Date();
    const isCancelled = shift.assignmentStatus === 'CANCELLED' || shift.status === 'CANCELLED';

    return (
      <div 
        key={shift.id} 
        className={`${styles.shiftCard} ${
          isCancelled ? styles.shiftCardCancelled : 
          isPast ? styles.shiftCardPast : 
          isActive ? styles.shiftCardActive : ''
        }`}
      >
        <div className={styles.shiftCardHeader}>
          <span className={styles.shiftTitle}>{shift.title}</span>
          <span className={`${styles.assignmentTypeBadge} ${
            shift.assignmentType === 'accepted' ? styles.badgeAccepted : styles.badgeDirect
          }`}>
            {shift.assignmentType === 'accepted' ? '✋ Beworben' : '👤 Zugewiesen'}
          </span>
        </div>
        <div className={styles.shiftCardBody}>
          <div className={styles.shiftInfo}>
            <span className={styles.shiftInfoIcon}>📍</span>
            <span>{shift.location.name}</span>
          </div>
          <div className={styles.shiftInfo}>
            <span className={styles.shiftInfoIcon}>📅</span>
            <span>{formatDate(shift.startsAt)}</span>
          </div>
          <div className={styles.shiftInfo}>
            <span className={styles.shiftInfoIcon}>⏰</span>
            <span>{formatTime(shift.startsAt)} – {formatTime(shift.endsAt)}</span>
          </div>
        </div>
        <div className={styles.shiftCardFooter}>
          <span className={`${styles.badge} ${
            isCancelled ? styles.badgeInactive : 
            isPast ? styles.badgePending : 
            styles.badgeActive
          }`}>
            {isCancelled ? 'Storniert' : isPast ? 'Abgeschlossen' : isActive ? 'Läuft' : 'Geplant'}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.panelLoading}>
        <div className={styles.loadingSpinner}></div>
        <p>Schichten werden geladen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        ⚠️ {error}
        <button onClick={refresh} className={`${styles.button} ${styles.buttonGhost}`}>
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className={styles.shiftsPanel}>
      <div className={styles.shiftsPanelHeader}>
        <h3 className={styles.shiftsPanelTitle}>
          📋 Schichten ({shifts.length})
        </h3>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={(e) => setIncludeCompleted(e.target.checked)}
          />
          Abgeschlossene anzeigen
        </label>
      </div>

      {shifts.length === 0 ? (
        <div className={styles.emptyPanel}>
          <span className={styles.emptyIcon}>📭</span>
          <p>Keine Schichten gefunden</p>
        </div>
      ) : (
        <div className={styles.shiftsGrid}>
          {activeShifts.length > 0 && (
            <div className={styles.shiftsSection}>
              <h4 className={styles.shiftsSectionTitle}>🟢 Aktiv</h4>
              {activeShifts.map(renderShiftCard)}
            </div>
          )}
          
          {upcomingShifts.length > 0 && (
            <div className={styles.shiftsSection}>
              <h4 className={styles.shiftsSectionTitle}>📆 Bevorstehend ({upcomingShifts.length})</h4>
              {upcomingShifts.map(renderShiftCard)}
            </div>
          )}
          
          {includeCompleted && completedShifts.length > 0 && (
            <div className={styles.shiftsSection}>
              <h4 className={styles.shiftsSectionTitle}>✅ Vergangen ({completedShifts.length})</h4>
              {completedShifts.map(renderShiftCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Member Detail Panel
// =============================================================================

interface MemberDetailPanelProps {
  member: Member;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onClose: () => void;
  actionInProgress: boolean;
  onRefresh?: () => void;
}

function MemberDetailPanel({ 
  member, 
  onEdit, 
  onToggleStatus, 
  onDelete, 
  onClose,
  actionInProgress,
  onRefresh
}: MemberDetailPanelProps) {
  const { role, hasEntitlement } = useTenant();
  const [activeTab, setActiveTab] = useState<'info' | 'shifts'>('info');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isResettingMfa, setIsResettingMfa] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean; setupInProgress?: boolean } | null>(null);
  const [mfaStatusLoading, setMfaStatusLoading] = useState(false);
  const [showMfaDropdown, setShowMfaDropdown] = useState(false);
  
  // Prüfen, ob User Admin oder Manager ist
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const mfaModuleEnabled = hasEntitlement('module.mfa');
  
  // MFA-Status laden (nur wenn Modul aktiviert ist und User Admin/Manager ist)
  useEffect(() => {
    if (mfaModuleEnabled && isAdminOrManager && member.id) {
      setMfaStatusLoading(true);
      getMemberMfaStatus(member.id)
        .then((status) => {
          setMfaStatus(status);
        })
        .catch((err) => {
          console.error('Fehler beim Laden des MFA-Status:', err);
          // Bei Fehler Status auf null setzen (unbekannt)
          setMfaStatus(null);
        })
        .finally(() => {
          setMfaStatusLoading(false);
        });
    }
  }, [member.id, mfaModuleEnabled, isAdminOrManager]);

  const handleCopyInviteLink = async () => {
    setIsGeneratingLink(true);
    setCopied(false);
    try {
      const result = await generateInviteLink(member.id);
      await navigator.clipboard.writeText(result.passwordResetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Generieren des Links');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleResetMfa = async () => {
    if (!confirm(`MFA für "${getMemberFullName(member)}" wirklich zurücksetzen? Der Mitarbeiter muss MFA danach neu einrichten.`)) {
      return;
    }
    
    setIsResettingMfa(true);
    try {
      await resetMemberMfa(member.id);
      alert('MFA wurde erfolgreich zurückgesetzt.');
      // MFA-Status neu laden
      if (mfaModuleEnabled && isAdminOrManager) {
        const status = await getMemberMfaStatus(member.id);
        setMfaStatus(status);
      }
      onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Zurücksetzen von MFA');
    } finally {
      setIsResettingMfa(false);
    }
  };

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailPanelHeader}>
        <button 
          className={`${styles.button} ${styles.buttonGhost} ${styles.buttonIcon}`}
          onClick={onClose}
          title="Schließen"
        >
          ✕
        </button>
        <div className={styles.detailPanelAvatar}>
          {getMemberInitials(member)}
        </div>
        <h2 className={styles.detailPanelName}>
          {getMemberFullName(member)}
        </h2>
        <p className={styles.detailPanelEmail}>{member.email}</p>
        <div className={styles.detailPanelBadges}>
          <span className={`${styles.badge} ${getRoleBadgeClass(member.role)}`}>
            {getMemberRoleLabel(member.role)}
          </span>
          <span className={`${styles.badge} ${getStatusBadgeClass(member.status)}`}>
            {getMemberStatusLabel(member.status)}
          </span>
        </div>
      </div>

      <div className={styles.detailPanelTabs}>
        <button
          className={`${styles.tabButton} ${activeTab === 'info' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('info')}
        >
          ℹ️ Infos
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'shifts' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('shifts')}
        >
          📅 Schichten
        </button>
      </div>

      <div className={styles.detailPanelContent}>
        {activeTab === 'info' ? (
          <div className={styles.infoGrid}>
            {member.department && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Abteilung</span>
                <span className={styles.infoValue}>{member.department}</span>
              </div>
            )}
            {member.position && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Position</span>
                <span className={styles.infoValue}>{member.position}</span>
              </div>
            )}
            {member.phone && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Telefon</span>
                <span className={styles.infoValue}>{member.phone}</span>
              </div>
            )}
            {member.hourlyRate !== undefined && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Stundenlohn</span>
                <span className={styles.infoValue}>{member.hourlyRate.toFixed(2)} €/h</span>
              </div>
            )}
            {/* Security-Qualifikationen */}
            {(member.hasSachkunde || member.hasFuehrerschein || member.hasUnterweisung || 
              (member.securityQualifications && member.securityQualifications.length > 0)) && (
              <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
                <span className={styles.infoLabel}>🔐 Security-Qualifikationen</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)' }}>
                  {member.hasSachkunde && (
                    <span style={{ 
                      background: 'var(--color-bg-secondary)', 
                      padding: '4px 8px', 
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-sm)'
                    }}>
                      📜 Sachkunde
                    </span>
                  )}
                  {member.hasFuehrerschein && (
                    <span style={{ 
                      background: 'var(--color-bg-secondary)', 
                      padding: '4px 8px', 
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-sm)'
                    }}>
                      🚗 Führerschein
                    </span>
                  )}
                  {member.hasUnterweisung && (
                    <span style={{ 
                      background: 'var(--color-bg-secondary)', 
                      padding: '4px 8px', 
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-sm)'
                    }}>
                      ✅ Unterweisung
                    </span>
                  )}
                  {member.securityQualifications?.map((q, idx) => (
                    <span key={idx} style={{ 
                      background: 'var(--color-bg-secondary)', 
                      padding: '4px 8px', 
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-sm)'
                    }}>
                      🔐 {q}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Erstellt am</span>
              <span className={styles.infoValue}>{formatDate(member.createdAt)}</span>
            </div>
            {member.lastActiveAt && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Zuletzt aktiv</span>
                <span className={styles.infoValue}>{formatDate(member.lastActiveAt)}</span>
              </div>
            )}
            {/* MFA-Status und Reset-Button (nur für Admins/Manager, wenn MFA-Modul aktiviert ist) */}
            {isAdminOrManager && mfaModuleEnabled && (
              <div className={styles.infoItem} style={{ gridColumn: '1 / -1', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                  <span className={styles.infoLabel}>🔐 Zwei-Faktor-Authentifizierung</span>
                  <button
                    className={`${styles.button} ${styles.buttonGhost} ${styles.buttonIcon}`}
                    onClick={() => setShowMfaDropdown(!showMfaDropdown)}
                    style={{ 
                      fontSize: 'var(--font-size-sm)',
                      padding: '4px 8px',
                      minHeight: 'auto',
                      opacity: 0.7
                    }}
                    title="MFA-Optionen"
                  >
                    {showMfaDropdown ? '▲' : '▼'}
                  </button>
                </div>
                <div style={{ marginTop: 'var(--spacing-xs)' }}>
                  {mfaStatusLoading ? (
                    <span className={styles.infoValue} style={{ opacity: 0.7, fontSize: 'var(--font-size-sm)' }}>
                      Wird geladen...
                    </span>
                  ) : (
                    <span className={styles.infoValue} style={{ opacity: 0.7, fontSize: 'var(--font-size-sm)' }}>
                      {mfaStatus?.enabled ? '✅ Aktiviert' : mfaStatus === null ? '❓ Status unbekannt' : '❌ Nicht aktiviert'}
                    </span>
                  )}
                </div>
                {showMfaDropdown && (
                  <div style={{ 
                    marginTop: 'var(--spacing-sm)',
                    padding: 'var(--spacing-sm)',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)'
                  }}>
                    <p style={{ 
                      fontSize: 'var(--font-size-sm)', 
                      color: 'var(--color-text-secondary)', 
                      marginBottom: 'var(--spacing-sm)'
                    }}>
                      Setzt MFA für diesen Mitarbeiter zurück. Der Mitarbeiter muss MFA danach neu einrichten.
                    </p>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary}`}
                      onClick={handleResetMfa}
                      disabled={isResettingMfa || actionInProgress || mfaStatusLoading}
                      style={{ 
                        fontSize: 'var(--font-size-sm)',
                        padding: '6px 12px',
                        width: '100%'
                      }}
                    >
                      {isResettingMfa ? '⏳ Wird zurückgesetzt...' : '🔄 MFA zurücksetzen'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <MemberShiftsPanel member={member} />
        )}
      </div>

      <div className={styles.detailPanelActions}>
        <button
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={handleCopyInviteLink}
          disabled={isGeneratingLink || actionInProgress}
          title="Einladungslink kopieren"
        >
          {isGeneratingLink ? '⏳ Wird generiert...' : copied ? '✅ Kopiert!' : '🔗 Link kopieren'}
        </button>
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={onEdit}
        >
          ✏️ Bearbeiten
        </button>
        <button
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={onToggleStatus}
          disabled={actionInProgress}
        >
          {member.status === MEMBER_STATUS.ACTIVE ? '⏸️ Deaktivieren' : '▶️ Aktivieren'}
        </button>
        <button
          className={`${styles.button} ${styles.buttonDanger}`}
          onClick={onDelete}
          disabled={actionInProgress}
        >
          🗑️ Löschen
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Member Card (für Grid-Ansicht)
// =============================================================================

interface MemberCardProps {
  member: Member;
  isSelected: boolean;
  onClick: () => void;
}

function MemberCard({ member, isSelected, onClick }: MemberCardProps) {
  return (
    <div 
      className={`${styles.memberCard} ${isSelected ? styles.memberCardSelected : ''}`}
      onClick={onClick}
    >
      <div className={styles.memberCardAvatar}>
        {getMemberInitials(member)}
      </div>
      <div className={styles.memberCardInfo}>
        <span className={styles.memberCardName}>
          {getMemberFullName(member)}
        </span>
        <span className={styles.memberCardEmail}>{member.email}</span>
        <div className={styles.memberCardBadges}>
          <span className={`${styles.badgeSmall} ${getRoleBadgeClass(member.role)}`}>
            {getMemberRoleLabel(member.role)}
          </span>
          <span className={`${styles.badgeSmall} ${getStatusBadgeClass(member.status)}`}>
            {getMemberStatusLabel(member.status)}
          </span>
        </div>
      </div>
      {member.department && (
        <div className={styles.memberCardDept}>{member.department}</div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function MembersPage() {
  const { role } = useTenant();
  const { user } = useAuth();
  const { isSuperAdmin } = useSuperAdminCheck();
  const { isDevStaff } = useDevStaffCheck();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    members,
    stats,
    loading,
    error,
    refresh,
    inviteMember,
    updateMember,
    deleteMember,
    activateMember,
    deactivateMember,
  } = useMembers();
  
  // Prüfen ob User Admin oder Manager ist
  const isAdminOrManager = role === MEMBER_ROLES.ADMIN || role === MEMBER_ROLES.MANAGER;
  const isEmployee = role === MEMBER_ROLES.EMPLOYEE;
  
  // Super Admin kann alle sehen (aber nicht Dev-Staff, die sollen wie normale Mitarbeiter behandelt werden)
  // Dev-Staff soll nur eigene Daten sehen, auch wenn sie Admin/Manager sind
  const canSeeAllMembers = (isAdminOrManager || isSuperAdmin) && !isDevStaff;

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<{ member: Member; passwordResetLink?: string } | null>(null);
  
  // Initialisiere searchQuery aus URL-Parameter
  const urlSearchQuery = searchParams.get('search') || '';
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [roleFilter, setRoleFilter] = useState<MemberRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | ''>('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // URL-Parameter beim ersten Laden lesen
  useEffect(() => {
    if (urlSearchQuery && urlSearchQuery !== searchQuery) {
      setSearchQuery(urlSearchQuery);
    }
  }, [urlSearchQuery]);

  // Filter members
  // Für normale Mitarbeiter UND Dev-Staff: Nur eigenes Profil anzeigen
  // Super Admin (nicht Dev-Staff) und Admin/Manager (nicht Dev-Staff) sehen alle
  const filteredMembers = members.filter((member) => {
    // Dev-Staff und normale Mitarbeiter sehen nur sich selbst
    if ((isDevStaff || (isEmployee && !isSuperAdmin)) && user && member.uid !== user.uid) {
      return false;
    }
    
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      member.email.toLowerCase().includes(query) ||
      member.displayName?.toLowerCase().includes(query) ||
      member.firstName?.toLowerCase().includes(query) ||
      member.lastName?.toLowerCase().includes(query) ||
      (member.firstName && member.lastName && `${member.firstName} ${member.lastName}`.toLowerCase().includes(query));
    const matchesRole = !roleFilter || member.role === roleFilter;
    const matchesStatus = !statusFilter || member.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleInvite = async (data: InviteMemberRequest) => {
    const result = await inviteMember(data);
    setShowInviteModal(false);
    setInviteSuccess(result);
  };

  const handleUpdate = async (memberId: string, data: UpdateMemberRequest) => {
    await updateMember(memberId, data);
    // Aktualisiere selectedMember wenn nötig
    if (selectedMember?.id === memberId) {
      const updated = members.find(m => m.id === memberId);
      if (updated) setSelectedMember(updated);
    }
  };

  const handleDelete = async (member: Member) => {
    if (!confirm(`Mitarbeiter "${getMemberFullName(member)}" wirklich löschen?`)) {
      return;
    }
    setActionInProgress(member.id);
    try {
      await deleteMember(member.id);
      if (selectedMember?.id === member.id) {
        setSelectedMember(null);
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleStatus = async (member: Member) => {
    setActionInProgress(member.id);
    try {
      if (member.status === MEMBER_STATUS.ACTIVE) {
        await deactivateMember(member.id);
      } else {
        await activateMember(member.id);
      }
      // Refresh um aktuellen Status zu bekommen
      await refresh();
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className={styles.pageLayout}>
      {/* Hauptbereich */}
      <div className={`${styles.mainContent} ${selectedMember ? styles.mainContentWithPanel : ''}`}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>
              <span className={styles.titleIcon}>👥</span>
              {isEmployee ? 'Mein Profil' : 'Mitarbeiter'}
            </h1>
            {stats && (
              <div className={styles.headerStats}>
                <span className={styles.headerStat}>
                  <strong>{stats.totalMembers}</strong> Gesamt
                </span>
                <span className={`${styles.headerStat} ${styles.headerStatActive}`}>
                  <strong>{stats.activeMembers}</strong> Aktiv
                </span>
                <span className={`${styles.headerStat} ${styles.headerStatPending}`}>
                  <strong>{stats.pendingMembers}</strong> Ausstehend
                </span>
              </div>
            )}
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.button} ${styles.buttonGhost} ${styles.buttonIcon}`}
              onClick={refresh}
              title="Aktualisieren"
            >
              🔄
            </button>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleBtnActive : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid-Ansicht"
              >
                ▦
              </button>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.viewToggleBtnActive : ''}`}
                onClick={() => setViewMode('table')}
                title="Tabellen-Ansicht"
              >
                ☰
              </button>
            </div>
            {canSeeAllMembers && (
              <button
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={() => setShowInviteModal(true)}
              >
                ➕ Einladen
              </button>
            )}
          </div>
        </div>

        {/* Filters - nur für Admin/Manager/SuperAdmin */}
        {canSeeAllMembers && (
          <div className={styles.filtersBar}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="🔍 Name oder E-Mail suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className={styles.filterSelect}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as MemberRole | '')}
            >
              <option value="">Alle Rollen</option>
              <option value={MEMBER_ROLES.ADMIN}>Administrator</option>
              <option value={MEMBER_ROLES.MANAGER}>Manager</option>
              <option value={MEMBER_ROLES.EMPLOYEE}>Mitarbeiter</option>
            </select>
            <select
              className={styles.filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MemberStatus | '')}
            >
              <option value="">Alle Status</option>
              <option value={MEMBER_STATUS.ACTIVE}>Aktiv</option>
              <option value={MEMBER_STATUS.INACTIVE}>Inaktiv</option>
              <option value={MEMBER_STATUS.PENDING}>Ausstehend</option>
            </select>
          </div>
        )}

        {error && <div className={styles.error}>⚠️ {error}</div>}

        {loading && (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}></div>
            <p>Mitarbeiter werden geladen...</p>
          </div>
        )}

        {!loading && filteredMembers.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>👥</div>
            <p className={styles.emptyText}>
              {searchQuery || roleFilter || statusFilter
                ? 'Keine Mitarbeiter gefunden'
                : 'Noch keine Mitarbeiter vorhanden'}
            </p>
            {!searchQuery && !roleFilter && !statusFilter && (
              <button
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={() => setShowInviteModal(true)}
              >
                ➕ Ersten Mitarbeiter einladen
              </button>
            )}
          </div>
        )}

        {!loading && filteredMembers.length > 0 && viewMode === 'grid' && (
          <div className={styles.membersGrid}>
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                isSelected={selectedMember?.id === member.id}
                onClick={() => setSelectedMember(
                  selectedMember?.id === member.id ? null : member
                )}
              />
            ))}
          </div>
        )}

        {!loading && filteredMembers.length > 0 && viewMode === 'table' && (
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <div>Mitarbeiter</div>
              <div>Rolle</div>
              <div>Status</div>
              <div>Abteilung</div>
              <div>Aktionen</div>
            </div>
            {filteredMembers.map((member) => (
              <div 
                key={member.id} 
                className={`${styles.tableRow} ${selectedMember?.id === member.id ? styles.tableRowSelected : ''}`}
                onClick={() => setSelectedMember(
                  selectedMember?.id === member.id ? null : member
                )}
              >
                <div className={styles.memberInfo}>
                  <div className={styles.avatar}>
                    {getMemberInitials(member)}
                  </div>
                  <div className={styles.memberDetails}>
                    <span className={styles.memberName}>
                      {getMemberFullName(member)}
                    </span>
                    <span className={styles.memberEmail}>{member.email}</span>
                  </div>
                </div>
                <div>
                  <span className={`${styles.badge} ${getRoleBadgeClass(member.role)}`}>
                    {getMemberRoleLabel(member.role)}
                  </span>
                </div>
                <div>
                  <span className={`${styles.badge} ${getStatusBadgeClass(member.status)}`}>
                    {getMemberStatusLabel(member.status)}
                  </span>
                </div>
                <div style={{ color: 'var(--color-text-secondary)' }}>
                  {member.department || '—'}
                </div>
                <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`${styles.button} ${styles.buttonGhost} ${styles.buttonIcon}`}
                    onClick={() => setEditingMember(member)}
                    title="Bearbeiten"
                  >
                    ✏️
                  </button>
                  <button
                    className={`${styles.button} ${styles.buttonGhost} ${styles.buttonIcon}`}
                    onClick={() => handleToggleStatus(member)}
                    disabled={actionInProgress === member.id}
                    title={member.status === MEMBER_STATUS.ACTIVE ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    {member.status === MEMBER_STATUS.ACTIVE ? '⏸️' : '▶️'}
                  </button>
                  <button
                    className={`${styles.button} ${styles.buttonGhost} ${styles.buttonIcon}`}
                    onClick={() => handleDelete(member)}
                    disabled={actionInProgress === member.id}
                    title="Löschen"
                    style={{ color: 'var(--color-red)' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel (Sidebar) */}
      {selectedMember && (
        <MemberDetailPanel
          member={selectedMember}
          onEdit={() => setEditingMember(selectedMember)}
          onToggleStatus={() => handleToggleStatus(selectedMember)}
          onDelete={() => handleDelete(selectedMember)}
          onClose={() => setSelectedMember(null)}
          actionInProgress={actionInProgress === selectedMember.id}
          onRefresh={refresh}
        />
      )}

      {/* Modals */}
      {showInviteModal && (
        <InviteMemberModal
          onSubmit={handleInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {inviteSuccess && (
        <InviteSuccessModal
          member={inviteSuccess.member}
          passwordResetLink={inviteSuccess.passwordResetLink}
          onClose={() => setInviteSuccess(null)}
        />
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onSubmit={handleUpdate}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}
