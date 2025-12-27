/**
 * Support Module Types (Backend)
 *
 * Firestore-spezifische Typen für das Support-Modul.
 */

import type { Timestamp } from 'firebase-admin/firestore';
import type { VerificationStatus } from '../freelancer/types.js';

// =============================================================================
// Firestore Document Types
// =============================================================================

/**
 * Dev-Mitarbeiter-Dokument in Firestore.
 * Pfad: /dev-staff/{uid}
 */
export type DevStaffRole = 'super-admin' | 'dev-staff';

export interface DevStaffDoc {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  createdBy: string; // UID des Super-Admins
  role: DevStaffRole; // 'super-admin' oder 'dev-staff'
  permissions: string[]; // z.B. ['verification.review', 'modules.manage']
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Request: Dev-Mitarbeiter erstellen.
 */
export interface CreateDevStaffRequest {
  email: string;
  displayName: string;
  role?: DevStaffRole; // Optional, default: 'dev-staff'. Nur Super-Admins können 'super-admin' setzen
  permissions: string[];
}

/**
 * Response: Dev-Mitarbeiter.
 */
export interface DevStaffResponse {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  createdBy: string;
  role: DevStaffRole;
  permissions: string[];
  passwordResetLink?: string; // Optional: Password-Reset-Link (nur beim Erstellen)
}

/**
 * Response: Verifizierungs-Übersicht.
 */
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

/**
 * Request: Verifizierung genehmigen.
 */
export interface ApproveVerificationRequest {
  freelancerUid: string;
  companyName?: string; // Firmenname für Tenant-Erstellung
}

/**
 * Request: Verifizierung ablehnen.
 */
export interface RejectVerificationRequest {
  freelancerUid: string;
  reason: string;
}

/**
 * Request: Dev-Mitarbeiter-Rechte aktualisieren.
 */
export interface UpdateDevStaffPermissionsRequest {
  permissions?: string[];
  role?: DevStaffRole; // Optional: Rolle aktualisieren (nur Super-Admins können 'super-admin' setzen)
}

// =============================================================================
// Account Deletion Request Types
// =============================================================================

/**
 * Status für Löschaufträge.
 */
export const DELETION_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
} as const;

export type DeletionRequestStatus = (typeof DELETION_REQUEST_STATUS)[keyof typeof DELETION_REQUEST_STATUS];

/**
 * Löschauftrag-Dokument in Firestore.
 * Pfad: /account-deletion-requests/{uid}
 */
export interface AccountDeletionRequestDoc {
  uid: string; // User-UID
  email: string;
  displayName: string;
  userType: 'freelancer' | 'employee' | 'dev-staff'; // Typ des Benutzers
  status: DeletionRequestStatus;
  requestedAt: Timestamp; // Wann wurde der Antrag gestellt
  requestedReason?: string; // Optional: Grund des Benutzers
  reviewedAt?: Timestamp; // Wann wurde der Antrag geprüft
  reviewedBy?: string; // UID des Dev-Mitarbeiters
  rejectionReason?: string; // Grund bei Ablehnung
  scheduledDeletionAt?: Timestamp; // Wann soll gelöscht werden (30 Tage nach Genehmigung)
  deletedAt?: Timestamp; // Wann wurde tatsächlich gelöscht
  deletedBy?: string; // UID des Dev-Mitarbeiters, der gelöscht hat
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Response: Löschauftrag-Übersicht.
 */
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

/**
 * Request: Löschauftrag genehmigen.
 */
export interface ApproveDeletionRequestRequest {
  reason?: string; // Optional: Notiz des Support-Mitarbeiters
}

/**
 * Request: Löschauftrag ablehnen.
 */
export interface RejectDeletionRequestRequest {
  reason: string; // Begründung der Ablehnung
}

