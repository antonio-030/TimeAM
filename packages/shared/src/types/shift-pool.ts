/**
 * Shift Pool Types
 *
 * Gemeinsame Typen für das Schichtausschreibungs-Modul.
 */

// =============================================================================
// Status Enums
// =============================================================================

/**
 * Status einer Schicht.
 */
export const SHIFT_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export type ShiftStatus = (typeof SHIFT_STATUS)[keyof typeof SHIFT_STATUS];

/**
 * Status einer Bewerbung.
 */
export const APPLICATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

export type ApplicationStatus =
  (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

/**
 * Status einer Zuweisung.
 */
export const ASSIGNMENT_STATUS = {
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;

export type AssignmentStatus =
  (typeof ASSIGNMENT_STATUS)[keyof typeof ASSIGNMENT_STATUS];

/**
 * Audit-Log Aktionen.
 */
export const AUDIT_ACTIONS = {
  SHIFT_CREATE: 'SHIFT_CREATE',
  SHIFT_PUBLISH: 'SHIFT_PUBLISH',
  SHIFT_CLOSE: 'SHIFT_CLOSE',
  SHIFT_CANCEL: 'SHIFT_CANCEL',
  APP_CREATE: 'APP_CREATE',
  APP_ACCEPT: 'APP_ACCEPT',
  APP_REJECT: 'APP_REJECT',
  APP_WITHDRAW: 'APP_WITHDRAW',
  ASSIGNMENT_CREATE: 'ASSIGNMENT_CREATE',
  ASSIGNMENT_CANCEL: 'ASSIGNMENT_CANCEL',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// =============================================================================
// Location Type
// =============================================================================

/**
 * Standort einer Schicht.
 */
export interface ShiftLocation {
  name: string;
  address?: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Schicht (API Response).
 */
export interface Shift {
  id: string;
  title: string;
  location: ShiftLocation;
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  requiredCount: number;
  filledCount: number;
  payRate?: number;
  requirements?: string[];
  applyDeadline?: string; // ISO string
  status: ShiftStatus;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Schicht für Pool-Anzeige (mit berechneten Feldern).
 */
export interface PoolShift extends Shift {
  freeSlots: number;
  myApplicationStatus?: ApplicationStatus;
  /** Kollegen, die diese Schicht angenommen haben */
  assignees?: ShiftAssignee[];
}

/**
 * Schicht für Admin-Ansicht (mit Bewerbungs-Statistiken).
 */
export interface AdminShift extends Shift {
  /** Anzahl ausstehender Bewerbungen */
  pendingApplications: number;
  /** Anzahl aller Bewerbungen (außer zurückgezogene) */
  totalApplications: number;
}

/**
 * Bewerbung (API Response).
 */
export interface Application {
  id: string;
  shiftId: string;
  uid: string;
  email?: string; // Für Admin-Ansicht
  note?: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Zuweisung (API Response).
 */
export interface Assignment {
  id: string;
  shiftId: string;
  uid: string;
  status: AssignmentStatus;
  createdAt: string;
}

/**
 * Kollege der einer Schicht zugewiesen ist.
 */
export interface ShiftAssignee {
  uid: string;
  displayName: string;
  email?: string;
}

// =============================================================================
// Request Types
// =============================================================================

/**
 * Request: Schicht erstellen.
 */
export interface CreateShiftRequest {
  title: string;
  location: ShiftLocation;
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  requiredCount: number;
  payRate?: number;
  requirements?: string[];
  applyDeadline?: string; // ISO string
}

/**
 * Request: Auf Schicht bewerben.
 */
export interface ApplyToShiftRequest {
  note?: string;
}

/**
 * Query-Parameter für Pool-Liste.
 */
export interface PoolQueryParams {
  from?: string; // ISO date
  to?: string; // ISO date
  location?: string;
  q?: string; // Textsuche
  status?: ShiftStatus;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Response: Pool-Liste.
 */
export interface PoolListResponse {
  shifts: PoolShift[];
  count: number;
}

/**
 * Response: Shift-Detail.
 */
export interface ShiftDetailResponse {
  shift: PoolShift;
}

/**
 * Response: Bewerbungen einer Schicht.
 */
export interface ApplicationsListResponse {
  applications: Application[];
  count: number;
}

/**
 * Response: Einzelne Bewerbung.
 */
export interface ApplicationResponse {
  application: Application;
}

/**
 * Response: Schicht erstellt/aktualisiert.
 */
export interface ShiftResponse {
  shift: Shift;
  message?: string;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Prüft, ob ein Shift-Status gültig ist.
 */
export function isValidShiftStatus(status: string): status is ShiftStatus {
  return Object.values(SHIFT_STATUS).includes(status as ShiftStatus);
}

/**
 * Prüft, ob ein Application-Status gültig ist.
 */
export function isValidApplicationStatus(
  status: string
): status is ApplicationStatus {
  return Object.values(APPLICATION_STATUS).includes(status as ApplicationStatus);
}
