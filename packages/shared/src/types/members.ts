/**
 * Members Types
 *
 * Typen für die Mitarbeiterverwaltung.
 */

import { MEMBER_ROLES, type MemberRole } from './tenant';

// Re-export for convenience
export { MEMBER_ROLES, type MemberRole };

// =============================================================================
// Member Status
// =============================================================================

/**
 * Status eines Mitarbeiters.
 */
export const MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
} as const;

export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];

// =============================================================================
// Member Types
// =============================================================================

/**
 * Mitarbeiter (API Response).
 */
export interface Member {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  role: MemberRole;
  status: MemberStatus;
  phone?: string;
  department?: string;
  position?: string;
  hourlyRate?: number;
  skills?: string[];
  notes?: string;
  // Security-spezifische Qualifikationen
  hasSachkunde?: boolean; // Sachkunde/Einweisung
  hasFuehrerschein?: boolean; // Führerschein
  hasUnterweisung?: boolean; // Unterweisung
  securityQualifications?: string[]; // Weitere Security-Qualifikationen
  createdAt: string;
  updatedAt: string;
  invitedByUid?: string;
  lastActiveAt?: string;
}

/**
 * Mitarbeiter-Statistiken.
 */
export interface MemberStats {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  pendingMembers: number;
  adminCount: number;
  memberCount: number;
  freelancerCount: number;
}

// =============================================================================
// Request Types
// =============================================================================

/**
 * Request: Mitarbeiter einladen.
 */
export interface InviteMemberRequest {
  email: string;
  displayName?: string;
  role: MemberRole;
  department?: string;
  position?: string;
  hourlyRate?: number;
  skills?: string[];
  notes?: string;
  // Security-spezifische Qualifikationen
  hasSachkunde?: boolean;
  hasFuehrerschein?: boolean;
  hasUnterweisung?: boolean;
  securityQualifications?: string[];
}

/**
 * Request: Mitarbeiter aktualisieren.
 */
export interface UpdateMemberRequest {
  displayName?: string;
  role?: MemberRole;
  status?: MemberStatus;
  phone?: string;
  department?: string;
  position?: string;
  hourlyRate?: number;
  skills?: string[];
  notes?: string;
  // Security-spezifische Qualifikationen
  hasSachkunde?: boolean;
  hasFuehrerschein?: boolean;
  hasUnterweisung?: boolean;
  securityQualifications?: string[];
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Response: Mitarbeiter-Liste.
 */
export interface MembersListResponse {
  members: Member[];
  count: number;
  stats: MemberStats;
}

/**
 * Response: Einzelner Mitarbeiter.
 */
export interface MemberResponse {
  member: Member;
  message?: string;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Prüft, ob eine Rolle gültig ist.
 */
export function isValidMemberRole(role: string): role is MemberRole {
  return Object.values(MEMBER_ROLES).includes(role as MemberRole);
}

/**
 * Prüft, ob ein Status gültig ist.
 */
export function isValidMemberStatus(status: string): status is MemberStatus {
  return Object.values(MEMBER_STATUS).includes(status as MemberStatus);
}

/**
 * Gibt das Label für eine Rolle zurück.
 */
export function getMemberRoleLabel(role: MemberRole): string {
  switch (role) {
    case MEMBER_ROLES.ADMIN:
      return 'Administrator';
    case MEMBER_ROLES.MANAGER:
      return 'Manager';
    case MEMBER_ROLES.EMPLOYEE:
      return 'Mitarbeiter';
    default:
      return role;
  }
}

/**
 * Gibt das Label für einen Status zurück.
 */
export function getMemberStatusLabel(status: MemberStatus): string {
  switch (status) {
    case MEMBER_STATUS.ACTIVE:
      return 'Aktiv';
    case MEMBER_STATUS.INACTIVE:
      return 'Inaktiv';
    case MEMBER_STATUS.PENDING:
      return 'Ausstehend';
    default:
      return status;
  }
}
