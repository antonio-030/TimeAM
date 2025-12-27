/**
 * Time Account Management Section
 *
 * Moderne, benutzerfreundliche Verwaltung der Zielstunden für alle Mitarbeiter.
 * Mit Vollzeit/Teilzeit-Unterstützung und barrierefreier Bedienung.
 * Nur für Admin/Manager/Freelancer sichtbar.
 * Mobile-optimiert.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useMembers } from '../members/hooks';
import { useTimeAccountTarget } from './hooks';
import { useTenant } from '../../core/tenant';
import { useAuth } from '../../core/auth';
import { MEMBER_ROLES, EMPLOYMENT_TYPE, type EmploymentType } from '@timeam/shared';
import { getMemberFullName } from '../../utils/memberNames';
import styles from './TimeAccountManagementSection.module.css';

// =============================================================================
// Constants
// =============================================================================

const EMPLOYMENT_PRESETS = {
  [EMPLOYMENT_TYPE.FULL_TIME]: {
    label: 'Vollzeit',
    monthlyHours: 160,
    weeklyHours: 40,
    icon: '⏰',
    description: '40 Stunden/Woche',
  },
  [EMPLOYMENT_TYPE.PART_TIME]: {
    label: 'Teilzeit',
    monthlyHours: 80,
    weeklyHours: 20,
    icon: '📅',
    description: '20 Stunden/Woche',
  },
  [EMPLOYMENT_TYPE.CUSTOM]: {
    label: 'Individuell',
    monthlyHours: 0,
    weeklyHours: 0,
    icon: '⚙️',
    description: 'Eigene Einstellung',
  },
} as const;

// =============================================================================
// Main Component
// =============================================================================

export function TimeAccountManagementSection() {
  const { role } = useTenant();
  const { user } = useAuth();
  const { members, loading: membersLoading, error: membersError } = useMembers();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const isAdminOrManager = role === MEMBER_ROLES.ADMIN || role === MEMBER_ROLES.MANAGER;
  const isFreelancer = !role; // Freelancer haben keine role

  // Nur Admin/Manager/Freelancer können diese Seite sehen
  if (!isAdminOrManager && !isFreelancer) {
    return null;
  }

  // Filter Mitglieder
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    
    const query = searchQuery.toLowerCase();
    return members.filter((member) => {
      // Freelancer sehen nur sich selbst
      if (isFreelancer && user && member.uid !== user.uid) {
        return false;
      }
      
      const matchesSearch =
        !searchQuery ||
        member.email.toLowerCase().includes(query) ||
        member.displayName?.toLowerCase().includes(query) ||
        member.firstName?.toLowerCase().includes(query) ||
        member.lastName?.toLowerCase().includes(query) ||
        (member.firstName && member.lastName && `${member.firstName} ${member.lastName}`.toLowerCase().includes(query));
      
      return matchesSearch;
    });
  }, [members, searchQuery, isFreelancer, user]);

  const handleSave = async (userId: string) => {
    setSavingUserId(userId);
    try {
      // Der Hook updateTarget wird in MemberTargetRow aufgerufen
      setEditingUserId(null);
    } catch (error) {
      console.error('Error updating target hours:', error);
    } finally {
      setSavingUserId(null);
    }
  };

  if (membersLoading) {
    return (
      <section className={styles.section} aria-label="Stunden-Verwaltung wird geladen">
        <div className={styles.loading} role="status" aria-live="polite">
          <span className={styles.loadingSpinner} aria-hidden="true"></span>
          Lädt Mitarbeiter...
        </div>
      </section>
    );
  }

  if (membersError) {
    return (
      <section className={styles.section} aria-label="Stunden-Verwaltung Fehler">
        <div className={styles.error} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">⚠️</span>
          {membersError}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-label="Stunden-Verwaltung">
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span className={styles.titleIcon} aria-hidden="true">⚙️</span>
          Stunden-Verwaltung
        </h2>
        <p className={styles.subtitle}>
          Definieren Sie die monatlichen Zielstunden für jeden Mitarbeiter
        </p>
      </div>

      {/* Suchfeld */}
      <div className={styles.searchContainer}>
        <label htmlFor="member-search" className={styles.searchLabel}>
          Mitarbeiter suchen
        </label>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon} aria-hidden="true">🔍</span>
          <input
            type="text"
            id="member-search"
            placeholder="Nach Name oder E-Mail suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Mitarbeiter suchen"
          />
        </div>
      </div>

      {/* Mitglieder-Liste */}
      {filteredMembers.length === 0 ? (
        <div className={styles.empty} role="status">
          <span className={styles.emptyIcon} aria-hidden="true">👥</span>
          <p>Keine Mitarbeiter gefunden.</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={styles.clearSearch}
              aria-label="Suche zurücksetzen"
            >
              Suche zurücksetzen
            </button>
          )}
        </div>
      ) : (
        <div className={styles.membersList} role="list">
          {filteredMembers.map((member) => (
            <MemberTargetRow
              key={member.id}
              member={member}
              isEditing={editingUserId === member.uid}
              isSaving={savingUserId === member.uid}
              onEdit={() => setEditingUserId(member.uid)}
              onCancel={() => setEditingUserId(null)}
              onSave={() => handleSave(member.uid)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// =============================================================================
// Member Target Row Component
// =============================================================================

interface MemberTargetRowProps {
  member: import('@timeam/shared').Member;
  isEditing: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}

function MemberTargetRow({
  member,
  isEditing,
  isSaving,
  onEdit,
  onCancel,
  onSave,
}: MemberTargetRowProps) {
  const { target, loading, updateTarget } = useTimeAccountTarget(member.uid);
  const [newTargetHours, setNewTargetHours] = useState(
    target?.monthlyTargetHours || 160
  );
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    target?.employmentType || EMPLOYMENT_TYPE.FULL_TIME
  );
  const [weeklyHours, setWeeklyHours] = useState(
    target?.weeklyHours || 40
  );
  const [customHours, setCustomHours] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const memberName = getMemberFullName(member);

  // Aktualisiere Werte wenn target sich ändert
  useEffect(() => {
    if (target?.monthlyTargetHours !== undefined) {
      setNewTargetHours(target.monthlyTargetHours);
    }
    if (target?.employmentType) {
      setEmploymentType(target.employmentType);
    }
    if (target?.weeklyHours !== undefined) {
      setWeeklyHours(target.weeklyHours);
    }
  }, [target?.monthlyTargetHours, target?.employmentType, target?.weeklyHours]);

  // Berechne monatliche Stunden basierend auf Beschäftigungsart
  useEffect(() => {
    if (!isEditing) return;

    if (employmentType === EMPLOYMENT_TYPE.FULL_TIME) {
      setNewTargetHours(EMPLOYMENT_PRESETS[EMPLOYMENT_TYPE.FULL_TIME].monthlyHours);
      setWeeklyHours(EMPLOYMENT_PRESETS[EMPLOYMENT_TYPE.FULL_TIME].weeklyHours);
      setCustomHours(false);
    } else if (employmentType === EMPLOYMENT_TYPE.PART_TIME) {
      setNewTargetHours(EMPLOYMENT_PRESETS[EMPLOYMENT_TYPE.PART_TIME].monthlyHours);
      setWeeklyHours(EMPLOYMENT_PRESETS[EMPLOYMENT_TYPE.PART_TIME].weeklyHours);
      setCustomHours(false);
    } else {
      setCustomHours(true);
    }
  }, [employmentType, isEditing]);

  // Berechne monatliche Stunden aus wöchentlichen Stunden
  const handleWeeklyHoursChange = (hours: number) => {
    setWeeklyHours(hours);
    // Monatliche Stunden = wöchentliche Stunden × 4.33 (Durchschnitt)
    setNewTargetHours(Math.round(hours * 4.33 * 10) / 10);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newTargetHours < 0 || newTargetHours > 1000) {
      alert('Zielstunden müssen zwischen 0 und 1000 liegen.');
      return;
    }

    if (weeklyHours < 0 || weeklyHours > 168) {
      alert('Wochenstunden müssen zwischen 0 und 168 liegen.');
      return;
    }

    try {
      await updateTarget(newTargetHours, employmentType, weeklyHours);
      await onSave();
    } catch (error) {
      console.error('Error saving target hours:', error);
      alert('Fehler beim Speichern der Zielstunden');
    }
  };

  const handleEmploymentTypeChange = (type: EmploymentType) => {
    setEmploymentType(type);
  };

  if (isEditing) {
    return (
      <div className={styles.memberRow} role="listitem">
        <form ref={formRef} onSubmit={handleSave} className={styles.editForm}>
          <div className={styles.memberInfo}>
            <div className={styles.memberName}>{memberName}</div>
            <div className={styles.memberEmail}>{member.email}</div>
          </div>

          <div className={styles.editContent}>
            {/* Beschäftigungsart-Auswahl */}
            <div className={styles.formGroup}>
              <label htmlFor={`employment-type-${member.id}`} className={styles.formLabel}>
                Beschäftigungsart
              </label>
              <div className={styles.employmentTypeButtons} role="radiogroup" aria-label="Beschäftigungsart">
                {Object.entries(EMPLOYMENT_PRESETS).map(([type, preset]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleEmploymentTypeChange(type as EmploymentType)}
                    className={`${styles.employmentTypeButton} ${
                      employmentType === type ? styles.employmentTypeButtonActive : ''
                    }`}
                    aria-pressed={employmentType === type}
                    aria-label={`${preset.label}: ${preset.description}`}
                  >
                    <span className={styles.employmentTypeIcon} aria-hidden="true">
                      {preset.icon}
                    </span>
                    <span className={styles.employmentTypeLabel}>{preset.label}</span>
                    <span className={styles.employmentTypeDescription}>{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Wochenstunden (wenn nicht Custom) */}
            {employmentType !== EMPLOYMENT_TYPE.CUSTOM && (
              <div className={styles.formGroup}>
                <label htmlFor={`weekly-hours-${member.id}`} className={styles.formLabel}>
                  Wochenstunden
                </label>
                <div className={styles.inputWrapper}>
                  <input
                    type="number"
                    id={`weekly-hours-${member.id}`}
                    min="0"
                    max="168"
                    step="0.5"
                    value={weeklyHours}
                    onChange={(e) => handleWeeklyHoursChange(parseFloat(e.target.value) || 0)}
                    className={styles.numberInput}
                    disabled={isSaving || employmentType !== EMPLOYMENT_TYPE.CUSTOM}
                    aria-label="Wochenstunden"
                    aria-describedby={`weekly-hours-desc-${member.id}`}
                  />
                  <span className={styles.inputSuffix}>h/Woche</span>
                </div>
                <p id={`weekly-hours-desc-${member.id}`} className={styles.inputDescription}>
                  Monatliche Stunden werden automatisch berechnet: {newTargetHours.toFixed(1)}h/Monat
                </p>
              </div>
            )}

            {/* Monatliche Stunden (wenn Custom oder zur Anzeige) */}
            <div className={styles.formGroup}>
              <label htmlFor={`monthly-hours-${member.id}`} className={styles.formLabel}>
                Monatliche Zielstunden
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="number"
                  id={`monthly-hours-${member.id}`}
                  min="0"
                  max="1000"
                  step="0.5"
                  value={newTargetHours}
                  onChange={(e) => setNewTargetHours(parseFloat(e.target.value) || 0)}
                  className={styles.numberInput}
                  disabled={isSaving || !customHours}
                  required
                  aria-label="Monatliche Zielstunden"
                  aria-describedby={`monthly-hours-desc-${member.id}`}
                />
                <span className={styles.inputSuffix}>h/Monat</span>
              </div>
              {customHours && (
                <p id={`monthly-hours-desc-${member.id}`} className={styles.inputDescription}>
                  Individuelle Einstellung
                </p>
              )}
            </div>

            {/* Aktions-Buttons */}
            <div className={styles.actionButtons}>
              <button
                type="button"
                onClick={onCancel}
                className={styles.buttonCancel}
                disabled={isSaving}
                aria-label="Abbrechen"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className={styles.buttonSave}
                disabled={isSaving}
                aria-label="Speichern"
              >
                {isSaving ? (
                  <>
                    <span className={styles.buttonSpinner} aria-hidden="true"></span>
                    Speichern...
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">✓</span>
                    Speichern
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  const employmentType = (target?.employmentType || EMPLOYMENT_TYPE.FULL_TIME) as keyof typeof EMPLOYMENT_PRESETS;
  const preset = EMPLOYMENT_PRESETS[employmentType];
  const displayHours = loading ? '...' : target?.monthlyTargetHours || 160;

  return (
    <div className={styles.memberRow} role="listitem">
      <div className={styles.memberInfo}>
        <div className={styles.memberName}>{memberName}</div>
        <div className={styles.memberEmail}>{member.email}</div>
      </div>
      <div className={styles.memberTarget}>
        <div className={styles.targetDisplay}>
          <span className={styles.targetIcon} aria-hidden="true">
            {preset.icon}
          </span>
          <div className={styles.targetInfo}>
            <span className={styles.targetValue}>
              {displayHours}h/Monat
            </span>
            {target?.employmentType && (
              <span className={styles.targetType}>
                {EMPLOYMENT_PRESETS[target.employmentType as keyof typeof EMPLOYMENT_PRESETS].label}
              </span>
            )}
            {target?.weeklyHours && (
              <span className={styles.targetWeekly}>
                ({target.weeklyHours}h/Woche)
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          className={styles.buttonEdit}
          aria-label={`Zielstunden für ${memberName} bearbeiten`}
        >
          <span aria-hidden="true">✏️</span>
          Bearbeiten
        </button>
      </div>
    </div>
  );
}
