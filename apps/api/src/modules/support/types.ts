/**
 * Support Module Types (Backend)
 *
 * Firestore-spezifische Typen für das Support-Modul.
 */

import type { Timestamp } from 'firebase-admin/firestore';
import type { VerificationStatus } from '../freelancer/types';

// =============================================================================
// Firestore Document Types
// =============================================================================

/**
 * Dev-Mitarbeiter-Dokument in Firestore.
 * Pfad: /dev-staff/{uid}
 */
export interface DevStaffDoc {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  createdBy: string; // UID des Super-Admins
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
  permissions: string[];
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
  permissions: string[];
}

