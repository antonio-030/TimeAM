/**
 * Shift Pool Types (Backend)
 *
 * Firestore-spezifische Typen für das Schichtausschreibungs-Modul.
 */

import type { Timestamp } from 'firebase-admin/firestore';

// Re-export shared types
export {
  SHIFT_STATUS,
  APPLICATION_STATUS,
  ASSIGNMENT_STATUS,
  AUDIT_ACTIONS,
  type ShiftStatus,
  type ApplicationStatus,
  type AssignmentStatus,
  type AuditAction,
  type ShiftLocation,
  type Shift,
  type PoolShift,
  type Application,
  type Assignment,
  type CreateShiftRequest,
  type ApplyToShiftRequest,
  type PoolQueryParams,
} from '@timeam/shared';

// =============================================================================
// Firestore Document Types
// =============================================================================

/**
 * Schicht-Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/shifts/{shiftId}
 */
export interface ShiftDoc {
  title: string;
  location: {
    name: string;
    address?: string;
  };
  startsAt: Timestamp;
  endsAt: Timestamp;
  requiredCount: number;
  filledCount: number;
  payRate?: number;
  requirements?: string[];
  applyDeadline?: Timestamp;
  status: string; // ShiftStatus
  createdByUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Bewerbungs-Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/applications/{applicationId}
 */
export interface ApplicationDoc {
  shiftId: string;
  uid: string;
  email: string;
  note?: string;
  status: string; // ApplicationStatus
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Zuweisungs-Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/assignments/{assignmentId}
 */
export interface AssignmentDoc {
  shiftId: string;
  uid: string;
  status: string; // AssignmentStatus
  createdAt: Timestamp;
}

/**
 * Audit-Log-Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/auditLogs/{auditId}
 */
export interface AuditLogDoc {
  actorUid: string;
  action: string; // AuditAction
  entity: 'shift' | 'application' | 'assignment';
  entityId: string;
  at: Timestamp;
  details?: Record<string, unknown>;
}
