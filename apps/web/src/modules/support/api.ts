/**
 * Support API Client
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../../core/api';
import type { VerificationStatus } from '../freelancer/api';

// =============================================================================
// Types
// =============================================================================

export interface VerificationOverview {
  freelancerUid: string;
  email: string;
  displayName: string;
  companyName?: string;
  verificationStatus: VerificationStatus | null;
  verificationSubmittedAt?: string;
  verificationReviewedAt?: string;
  verificationReviewedBy?: string;
  verificationRejectionReason?: string;
  businessLicenseNumber?: string;
}

export type DevStaffRole = 'super-admin' | 'dev-staff';

export interface DevStaff {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  createdBy: string;
  role: DevStaffRole;
  permissions: string[];
  passwordResetLink?: string; // Optional: Password-Reset-Link (nur beim Erstellen)
}

export interface CreateDevStaffRequest {
  email: string;
  displayName: string;
  role?: DevStaffRole; // Optional, default: 'dev-staff'. Nur Super-Admins können 'super-admin' setzen
  permissions: string[];
}

export interface UpdateDevStaffPermissionsRequest {
  role?: DevStaffRole; // Optional. Nur Super-Admins können 'super-admin' setzen
  permissions: string[];
}

export interface ApproveVerificationRequest {
  freelancerUid: string;
  companyName?: string; // Firmenname für Tenant-Erstellung
}

export interface RejectVerificationRequest {
  freelancerUid: string;
  reason: string;
}

// =============================================================================
// API Functions
// =============================================================================

interface GetVerificationsResponse {
  verifications: VerificationOverview[];
}

interface GetVerificationDocumentResponse {
  url: string;
}

interface GetDevStaffResponse {
  devStaff: DevStaff[];
}

interface GetDevStaffItemResponse {
  devStaff: DevStaff;
}

interface CreateDevStaffResponse {
  devStaff: DevStaff;
  message?: string;
}

interface CheckDevStaffResponse {
  isDevStaff: boolean;
}

/**
 * Prüft ob User ein Dev-Mitarbeiter ist.
 */
export function checkDevStaff(): Promise<CheckDevStaffResponse> {
  return apiGet<CheckDevStaffResponse>('/api/support/check');
}

/**
 * Lädt alle Verifizierungen.
 */
export function getVerifications(): Promise<GetVerificationsResponse> {
  return apiGet<GetVerificationsResponse>('/api/support/verifications');
}

/**
 * Genehmigt eine Verifizierung.
 */
export function approveVerification(data: ApproveVerificationRequest): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/api/support/verifications/${data.freelancerUid}/approve`, {
    companyName: data.companyName,
  });
}

/**
 * Lehnt eine Verifizierung ab.
 */
export function rejectVerification(data: RejectVerificationRequest): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/api/support/verifications/${data.freelancerUid}/reject`, {
    reason: data.reason,
  });
}

/**
 * Lädt die Download-URL für ein Verifizierungs-Dokument.
 */
export function getVerificationDocumentUrl(freelancerUid: string): Promise<GetVerificationDocumentResponse> {
  return apiGet<GetVerificationDocumentResponse>(`/api/support/verifications/${freelancerUid}/document`);
}

/**
 * Lädt alle Dev-Mitarbeiter (nur Super-Admin).
 */
export function getDevStaff(): Promise<GetDevStaffResponse> {
  return apiGet<GetDevStaffResponse>('/api/admin/dev-staff');
}

/**
 * Erstellt einen neuen Dev-Mitarbeiter (nur Super-Admin).
 */
export function createDevStaff(data: CreateDevStaffRequest): Promise<CreateDevStaffResponse> {
  return apiPost<CreateDevStaffResponse>('/api/admin/dev-staff', data);
}

/**
 * Aktualisiert die Rechte eines Dev-Mitarbeiters (nur Super-Admin).
 */
export function updateDevStaffPermissions(
  uid: string,
  data: UpdateDevStaffPermissionsRequest
): Promise<GetDevStaffItemResponse> {
  return apiPut<GetDevStaffItemResponse>(`/api/admin/dev-staff/${uid}/permissions`, data);
}

/**
 * Entfernt einen Dev-Mitarbeiter (nur Super-Admin).
 */
export function deleteDevStaff(uid: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/api/admin/dev-staff/${uid}`);
}

// =============================================================================
// Account Deletion Requests
// =============================================================================

export type DeletionRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface AccountDeletionRequestOverview {
  uid: string;
  email: string;
  displayName: string;
  userType: 'freelancer' | 'employee' | 'dev-staff';
  status: DeletionRequestStatus;
  requestedAt: string;
  requestedReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  scheduledDeletionAt?: string;
  deletedAt?: string;
  deletedBy?: string;
}

interface GetDeletionRequestsResponse {
  requests: AccountDeletionRequestOverview[];
}

interface ApproveDeletionRequestRequest {
  reason?: string;
}

interface RejectDeletionRequestRequest {
  reason: string;
}

/**
 * Lädt alle Löschaufträge (nur Dev-Mitarbeiter).
 */
export function getDeletionRequests(): Promise<GetDeletionRequestsResponse> {
  return apiGet<GetDeletionRequestsResponse>('/api/support/deletion-requests');
}

/**
 * Genehmigt einen Löschauftrag (nur Dev-Mitarbeiter).
 */
export function approveDeletionRequest(uid: string, data?: ApproveDeletionRequestRequest): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/api/support/deletion-requests/${uid}/approve`, data || {});
}

/**
 * Lehnt einen Löschauftrag ab (nur Dev-Mitarbeiter).
 */
export function rejectDeletionRequest(uid: string, data: RejectDeletionRequestRequest): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/api/support/deletion-requests/${uid}/reject`, data);
}

/**
 * Führt die tatsächliche Löschung durch (nur Dev-Mitarbeiter).
 */
export function executeDeletionRequest(uid: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`/api/support/deletion-requests/${uid}/execute`, {});
}

