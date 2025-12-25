/**
 * Freelancer API Client
 */

import { apiGet, apiPost, apiRequest, apiPatch, apiDelete } from '../../core/api';

// =============================================================================
// Types
// =============================================================================

export interface RegisterFreelancerRequest {
  email: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  address?: string;
  businessLicenseNumber?: string;
}

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface FreelancerResponse {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  tenantId?: string;
  phone?: string;
  address?: string;
  businessLicenseNumber?: string;
  // Verifizierungsfelder
  verificationStatus?: VerificationStatus;
  verificationSubmittedAt?: string;
  verificationReviewedAt?: string;
  verificationReviewedBy?: string;
  verificationRejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface RegisterFreelancerResponse {
  freelancer: FreelancerResponse;
  message?: string;
}

interface GetFreelancerResponse {
  freelancer: FreelancerResponse;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Registriert einen neuen Freelancer.
 */
export function registerFreelancer(data: RegisterFreelancerRequest): Promise<RegisterFreelancerResponse> {
  return apiPost<RegisterFreelancerResponse>('/api/freelancer/register', data);
}

/**
 * Lädt das eigene Freelancer-Profil.
 */
export function getFreelancer(): Promise<GetFreelancerResponse> {
  return apiGet<GetFreelancerResponse>('/api/freelancer/me');
}

/**
 * Lädt alle Bewerbungen des Freelancers.
 */
export interface FreelancerApplication {
  id: string;
  shiftId: string;
  uid: string;
  email: string;
  note?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  isFreelancer: boolean;
  tenantId: string;
  tenantName: string;
  shiftTitle: string;
  shiftStartsAt: string;
}

interface GetFreelancerApplicationsResponse {
  applications: FreelancerApplication[];
  count: number;
}

export function getFreelancerApplications(): Promise<GetFreelancerApplicationsResponse> {
  return apiGet<GetFreelancerApplicationsResponse>('/api/shift-pool/freelancer/applications');
}

/**
 * Freelancer-Schicht (mit Tenant-Info)
 */
export interface FreelancerShift {
  id: string;
  title: string;
  location: {
    name: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  };
  startsAt: string;
  endsAt: string;
  requiredCount: number;
  filledCount: number;
  payRate?: number;
  status: string;
  assignmentId: string;
  assignmentStatus: string;
  colleagues: Array<{ uid: string; displayName: string }>;
  tenantId: string;
  tenantName: string;
}

interface GetFreelancerShiftsResponse {
  shifts: FreelancerShift[];
  count: number;
}

export function getFreelancerShifts(includeCompleted?: boolean): Promise<GetFreelancerShiftsResponse> {
  const params = includeCompleted ? '?includeCompleted=true' : '';
  return apiGet<GetFreelancerShiftsResponse>(`/api/shift-pool/freelancer/shifts${params}`);
}

// =============================================================================
// Verification
// =============================================================================

interface UploadVerificationResponse {
  documentPath: string;
  message?: string;
}

interface VerificationStatusResponse {
  verificationStatus: VerificationStatus | null;
  verificationSubmittedAt?: string;
  verificationReviewedAt?: string;
  verificationRejectionReason?: string;
}

interface VerificationDocumentResponse {
  url: string;
}

/**
 * Lädt einen Gewerbeschein hoch.
 */
export async function uploadVerificationDocument(
  file: File
): Promise<UploadVerificationResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest<UploadVerificationResponse>(
    '/api/freelancer/verification/upload',
    {
      method: 'POST',
      body: formData,
      headers: {}, // Kein Content-Type Header, Browser setzt automatisch mit Boundary
    }
  );
}

/**
 * Lädt den Verifizierungsstatus.
 */
export function getVerificationStatus(): Promise<VerificationStatusResponse> {
  return apiGet<VerificationStatusResponse>('/api/freelancer/verification/status');
}

/**
 * Lädt die Download-URL für das Verifizierungs-Dokument.
 */
export function getVerificationDocumentUrl(): Promise<VerificationDocumentResponse> {
  return apiGet<VerificationDocumentResponse>('/api/freelancer/verification/document');
}

// =============================================================================
// Profile Update & Delete
// =============================================================================

export interface UpdateFreelancerProfileRequest {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  companyName?: string;
}

interface UpdateFreelancerProfileResponse {
  freelancer: FreelancerResponse;
  message: string;
}

/**
 * Aktualisiert das eigene Freelancer-Profil.
 */
export function updateFreelancerProfile(
  data: UpdateFreelancerProfileRequest
): Promise<UpdateFreelancerProfileResponse> {
  return apiPatch<UpdateFreelancerProfileResponse>('/api/freelancer/me', data);
}

interface DeleteAccountResponse {
  message: string;
  deleted: boolean;
}

/**
 * Erstellt einen Löschauftrag für das eigene Freelancer-Konto (DSGVO-konform).
 * Erfordert Bestätigung mit "DELETE_MY_ACCOUNT".
 * Das Konto wird nicht sofort gelöscht, sondern ein Antrag wird an das Support-Team gesendet.
 */
export function deleteFreelancerAccount(reason?: string): Promise<DeleteAccountResponse> {
  return apiDelete<DeleteAccountResponse>('/api/freelancer/me', { 
    confirmation: 'DELETE_MY_ACCOUNT',
    reason,
  });
}

