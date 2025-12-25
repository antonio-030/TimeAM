/**
 * Freelancer Types (Backend)
 *
 * Firestore-spezifische Typen für das Freelancer-Modul.
 */

import type { Timestamp } from 'firebase-admin/firestore';

// =============================================================================
// Firestore Document Types
// =============================================================================

/**
 * Verifizierungsstatus für Freelancer
 */
export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type VerificationStatus = (typeof VERIFICATION_STATUS)[keyof typeof VERIFICATION_STATUS];

/**
 * Freelancer-Dokument in Firestore.
 * Pfad: /freelancers/{uid}
 */
export interface FreelancerDoc {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string; // Vorname
  lastName?: string; // Nachname
  companyName?: string; // Firmenname (Tenant-Name)
  tenantId?: string; // Haupt-Tenant-ID (eigene Firma)
  phone?: string;
  address?: string;
  businessLicenseNumber?: string; // Gewerbeschein-Nummer
  businessLicenseDocumentPath?: string; // Pfad zum Gewerbeschein-Dokument
  // Verifizierungsfelder
  verificationStatus?: VerificationStatus; // 'pending' | 'approved' | 'rejected'
  verificationDocumentPath?: string; // Storage-Pfad zum Gewerbeschein
  verificationSubmittedAt?: Timestamp; // Wann wurde der Antrag eingereicht
  verificationReviewedAt?: Timestamp; // Wann wurde der Antrag geprüft
  verificationReviewedBy?: string; // UID des Dev-Mitarbeiters
  verificationRejectionReason?: string; // Grund bei Ablehnung
  createdAt: Timestamp;
  updatedAt: Timestamp;
  tenantIds?: string[]; // Liste der Tenants, bei denen der Freelancer als Member ist
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Request: Freelancer registrieren.
 */
export interface RegisterFreelancerRequest {
  email: string;
  password: string;
  displayName: string;
  firstName?: string; // Vorname
  lastName?: string; // Nachname
  companyName?: string; // Firmenname (wird als Tenant-Name verwendet)
  phone?: string;
  address?: string;
  businessLicenseNumber?: string;
}

/**
 * Response: Freelancer-Profil.
 */
export interface FreelancerResponse {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string; // Vorname
  lastName?: string; // Nachname
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

