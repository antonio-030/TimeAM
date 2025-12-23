/**
 * Members Types (API)
 *
 * Firestore-spezifische Typen für Mitarbeiterverwaltung.
 */

import { Timestamp } from 'firebase-admin/firestore';

// Re-export shared types
export {
  MEMBER_ROLES,
  MEMBER_STATUS,
  type MemberRole,
  type MemberStatus,
  type Member,
  type MemberStats,
  type InviteMemberRequest,
  type UpdateMemberRequest,
  type MembersListResponse,
  type MemberResponse,
} from '@timeam/shared';

/**
 * Mitarbeiter-Dokument in Firestore.
 */
export interface MemberDoc {
  uid: string;
  email: string;
  displayName?: string;
  role: string;
  status: string;
  phone?: string;
  department?: string;
  position?: string;
  hourlyRate?: number;
  skills?: string[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  invitedByUid?: string;
  lastActiveAt?: Timestamp;
}
