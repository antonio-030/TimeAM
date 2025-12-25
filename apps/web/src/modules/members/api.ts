/**
 * Members API Client
 */

import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../../core/api';
import type {
  Member,
  MemberStats,
  InviteMemberRequest,
  UpdateMemberRequest,
} from '@timeam/shared';

// =============================================================================
// Response Types
// =============================================================================

interface MembersListResponse {
  members: Member[];
  count: number;
  stats: MemberStats;
}

interface MemberResponse {
  member: Member;
  message?: string;
}

interface InviteMemberResponse {
  member: Member;
  passwordResetLink?: string; // Link zum Passwort setzen
  message?: string;
}

interface DeleteResponse {
  success: boolean;
  message?: string;
}

/**
 * Schicht eines Mitarbeiters.
 */
export interface MemberShift {
  id: string;
  title: string;
  location: { name: string; address?: string };
  startsAt: string;
  endsAt: string;
  status: string;
  assignmentStatus: string;
  assignmentId: string;
  assignmentType: 'accepted' | 'direct';
  createdAt: string;
}

interface MemberShiftsResponse {
  shifts: MemberShift[];
  count: number;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Lädt alle Mitarbeiter.
 */
export function getMembers(): Promise<MembersListResponse> {
  return apiGet<MembersListResponse>('/api/members');
}

/**
 * Lädt einen einzelnen Mitarbeiter.
 */
export function getMember(memberId: string): Promise<MemberResponse> {
  return apiGet<MemberResponse>(`/api/members/${memberId}`);
}

/**
 * Lädt neuen Mitarbeiter ein.
 * Gibt auch einen Password Reset Link zurück.
 */
export function inviteMember(data: InviteMemberRequest): Promise<InviteMemberResponse> {
  return apiPost<InviteMemberResponse>('/api/members', data);
}

/**
 * Aktualisiert einen Mitarbeiter.
 */
export function updateMember(memberId: string, data: UpdateMemberRequest): Promise<MemberResponse> {
  return apiPut<MemberResponse>(`/api/members/${memberId}`, data);
}

/**
 * Löscht einen Mitarbeiter.
 */
export function deleteMember(memberId: string): Promise<DeleteResponse> {
  return apiDelete<DeleteResponse>(`/api/members/${memberId}`);
}

/**
 * Aktiviert einen Mitarbeiter.
 */
export function activateMember(memberId: string): Promise<MemberResponse> {
  return apiPost<MemberResponse>(`/api/members/${memberId}/activate`);
}

/**
 * Deaktiviert einen Mitarbeiter.
 */
export function deactivateMember(memberId: string): Promise<MemberResponse> {
  return apiPost<MemberResponse>(`/api/members/${memberId}/deactivate`);
}

/**
 * Lädt die Schichten eines Mitarbeiters.
 */
export function getMemberShifts(
  memberId: string, 
  options: { includeCompleted?: boolean } = {}
): Promise<MemberShiftsResponse> {
  const params = new URLSearchParams();
  if (options.includeCompleted) {
    params.set('includeCompleted', 'true');
  }
  
  const queryString = params.toString();
  const url = queryString 
    ? `/api/members/${memberId}/shifts?${queryString}` 
    : `/api/members/${memberId}/shifts`;
  
  return apiGet<MemberShiftsResponse>(url);
}

/**
 * Lädt das eigene Profil (für Admins/Manager).
 */
export function getMemberProfile(): Promise<MemberResponse> {
  return apiGet<MemberResponse>('/api/members/me');
}

/**
 * Aktualisiert das eigene Profil (für Admins/Manager).
 */
export function updateMemberProfile(data: UpdateMemberRequest): Promise<MemberResponse> {
  return apiPatch<MemberResponse>('/api/members/me', data);
}
