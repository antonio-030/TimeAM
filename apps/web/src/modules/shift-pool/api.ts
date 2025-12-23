/**
 * Shift Pool API Client
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../../core/api';
import type {
  Shift,
  PoolShift,
  AdminShift,
  Application,
  Assignment,
  CreateShiftRequest,
  ApplyToShiftRequest,
  PoolQueryParams,
} from '@timeam/shared';

// =============================================================================
// Response Types
// =============================================================================

interface PoolListResponse {
  shifts: PoolShift[];
  count: number;
}

interface ShiftResponse {
  shift: Shift;
  message?: string;
}

interface ShiftDetailResponse {
  shift: PoolShift;
}

interface ApplicationsListResponse {
  applications: Application[];
  count: number;
}

interface ApplicationResponse {
  application: Application;
  message?: string;
}

interface AcceptResponse {
  application: Application;
  assignment: Assignment;
  message?: string;
}

interface AdminShiftsResponse {
  shifts: AdminShift[];
  count: number;
}

// =============================================================================
// Admin API
// =============================================================================

/**
 * Erstellt eine neue Schicht.
 */
export function createShift(data: CreateShiftRequest): Promise<ShiftResponse> {
  return apiPost<ShiftResponse>('/api/shift-pool/shifts', data);
}

/**
 * Lädt alle Schichten (Admin).
 */
export function getAdminShifts(): Promise<AdminShiftsResponse> {
  return apiGet<AdminShiftsResponse>('/api/shift-pool/admin/shifts');
}

/**
 * Aktualisiert eine Schicht.
 */
export function updateShift(shiftId: string, data: Partial<CreateShiftRequest>): Promise<ShiftResponse> {
  return apiPut<ShiftResponse>(`/api/shift-pool/shifts/${shiftId}`, data);
}

/**
 * Löscht eine Schicht (nur Draft).
 */
export function deleteShift(shiftId: string): Promise<{ success: boolean; message?: string }> {
  return apiDelete<{ success: boolean; message?: string }>(`/api/shift-pool/shifts/${shiftId}`);
}

/**
 * Veröffentlicht eine Schicht.
 */
export function publishShift(shiftId: string): Promise<ShiftResponse> {
  return apiPost<ShiftResponse>(`/api/shift-pool/shifts/${shiftId}/publish`);
}

/**
 * Schließt eine Schicht für Bewerbungen.
 */
export function closeShift(shiftId: string): Promise<ShiftResponse> {
  return apiPost<ShiftResponse>(`/api/shift-pool/shifts/${shiftId}/close`);
}

/**
 * Sagt eine Schicht ab.
 */
export function cancelShift(shiftId: string): Promise<ShiftResponse> {
  return apiPost<ShiftResponse>(`/api/shift-pool/shifts/${shiftId}/cancel`);
}

/**
 * Lädt Bewerbungen für eine Schicht.
 */
export function getShiftApplications(shiftId: string): Promise<ApplicationsListResponse> {
  return apiGet<ApplicationsListResponse>(`/api/shift-pool/shifts/${shiftId}/applications`);
}

/**
 * Akzeptiert eine Bewerbung.
 */
export function acceptApplication(applicationId: string): Promise<AcceptResponse> {
  return apiPost<AcceptResponse>(`/api/shift-pool/applications/${applicationId}/accept`);
}

/**
 * Lehnt eine Bewerbung ab.
 */
export function rejectApplication(applicationId: string): Promise<ApplicationResponse> {
  return apiPost<ApplicationResponse>(`/api/shift-pool/applications/${applicationId}/reject`);
}

/**
 * Macht eine akzeptierte Bewerbung rückgängig (storniert Zuweisung).
 */
export function revokeApplication(applicationId: string): Promise<ApplicationResponse> {
  return apiPost<ApplicationResponse>(`/api/shift-pool/applications/${applicationId}/revoke`);
}

// =============================================================================
// Schicht-Zuweisungen (Admin)
// =============================================================================

/**
 * Zuweisung mit Mitarbeiter-Details.
 */
export interface ShiftAssignment {
  assignmentId: string;
  uid: string;
  displayName: string;
  email?: string;
  status: string;
  createdAt: string;
}

interface ShiftAssignmentsResponse {
  assignments: ShiftAssignment[];
  count: number;
}

interface AssignMemberResponse {
  assignment: {
    id: string;
    shiftId: string;
    uid: string;
    status: string;
    createdAt: string;
  };
  message?: string;
}

/**
 * Lädt alle Zuweisungen für eine Schicht.
 */
export function getShiftAssignments(shiftId: string): Promise<ShiftAssignmentsResponse> {
  return apiGet<ShiftAssignmentsResponse>(`/api/shift-pool/shifts/${shiftId}/assignments`);
}

/**
 * Weist einen Mitarbeiter direkt einer Schicht zu.
 */
export function assignMemberToShift(shiftId: string, memberUid: string): Promise<AssignMemberResponse> {
  return apiPost<AssignMemberResponse>(`/api/shift-pool/shifts/${shiftId}/assign`, { memberUid });
}

/**
 * Entfernt eine Zuweisung.
 */
export function removeAssignment(assignmentId: string): Promise<{ success: boolean; message?: string }> {
  return apiDelete<{ success: boolean; message?: string }>(`/api/shift-pool/assignments/${assignmentId}`);
}

// =============================================================================
// User API
// =============================================================================

/**
 * Lädt die Pool-Liste.
 */
export function getPool(params: PoolQueryParams = {}): Promise<PoolListResponse> {
  const searchParams = new URLSearchParams();
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.location) searchParams.set('location', params.location);
  if (params.q) searchParams.set('q', params.q);

  const queryString = searchParams.toString();
  const url = queryString ? `/api/shift-pool/pool?${queryString}` : '/api/shift-pool/pool';
  return apiGet<PoolListResponse>(url);
}

/**
 * Lädt Schicht-Details.
 */
export function getShiftDetail(shiftId: string): Promise<ShiftDetailResponse> {
  return apiGet<ShiftDetailResponse>(`/api/shift-pool/shifts/${shiftId}`);
}

/**
 * Bewirbt sich auf eine Schicht.
 */
export function applyToShift(shiftId: string, data: ApplyToShiftRequest = {}): Promise<ApplicationResponse> {
  return apiPost<ApplicationResponse>(`/api/shift-pool/shifts/${shiftId}/apply`, data);
}

/**
 * Zieht eigene Bewerbung für eine Schicht zurück (über shiftId).
 */
export function withdrawMyApplication(shiftId: string): Promise<ApplicationResponse> {
  return apiPost<ApplicationResponse>(`/api/shift-pool/shifts/${shiftId}/withdraw`);
}

/**
 * Zieht eine Bewerbung zurück (über applicationId).
 */
export function withdrawApplication(applicationId: string): Promise<ApplicationResponse> {
  return apiPost<ApplicationResponse>(`/api/shift-pool/applications/${applicationId}/withdraw`);
}

// =============================================================================
// Meine Schichten
// =============================================================================

/**
 * Schicht mit Zuweisung.
 */
export interface MyShift {
  id: string;
  title: string;
  location: { name: string; address?: string };
  startsAt: string;
  endsAt: string;
  requiredCount: number;
  filledCount: number;
  payRate?: number;
  requirements?: string[];
  status: string;
  assignmentId: string;
  assignmentStatus: string;
  colleagues: Array<{ uid: string; displayName: string }>;
}

interface MyShiftsResponse {
  shifts: MyShift[];
  count: number;
}

/**
 * Lädt alle zugewiesenen Schichten des Users.
 */
export function getMyShifts(options: { includeCompleted?: boolean } = {}): Promise<MyShiftsResponse> {
  const params = new URLSearchParams();
  if (options.includeCompleted) {
    params.set('includeCompleted', 'true');
  }
  
  const queryString = params.toString();
  const url = queryString ? `/api/shift-pool/my-shifts?${queryString}` : '/api/shift-pool/my-shifts';
  return apiGet<MyShiftsResponse>(url);
}
