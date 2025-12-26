/**
 * Time Account Types (Shared)
 *
 * Gemeinsame Typen für Frontend und Backend.
 */

/**
 * Quelle einer Zeitkonto-Anpassung.
 */
export const TIME_ACCOUNT_ADJUSTMENT_SOURCE = {
  TIME_TRACKING: 'time_tracking',
  SHIFT_POOL: 'shift_pool',
  MANUAL: 'manual',
  COMPLIANCE: 'compliance',
} as const;

export type TimeAccountAdjustmentSource =
  (typeof TIME_ACCOUNT_ADJUSTMENT_SOURCE)[keyof typeof TIME_ACCOUNT_ADJUSTMENT_SOURCE];

/**
 * Zeitkonto-Anpassung.
 */
export interface TimeAccountAdjustment {
  id: string;
  amountHours: number; // Positiv = Plus, Negativ = Minus
  reason: string; // Grund (z.B. "Manuelle Korrektur", "Compliance-Verstoß: Ruhezeit")
  adjustedBy: string; // UID des Anpassenden
  adjustedAt: string; // ISO string
  referenceId?: string; // Optional: ID des Compliance-Verstoßes, TimeEntry oder ShiftTimeEntry
  source?: TimeAccountAdjustmentSource; // Quelle der Anpassung
}

/**
 * Zeitkonto für einen Monat.
 */
export interface TimeAccount {
  userId: string;
  year: number;
  month: number; // 1-12
  targetHours: number; // Zielstunden für diesen Monat (z.B. 160)
  actualHours: number; // Tatsächliche Stunden (aus TimeEntries + ShiftTimeEntries)
  timeTrackingHours: number; // Stunden aus time-tracking Modul
  shiftHours: number; // Stunden aus shift-pool Modul
  balanceHours: number; // Saldo = actualHours - targetHours + adjustments (kann negativ sein)
  manualAdjustments: TimeAccountAdjustment[]; // Manuelle Anpassungen
  complianceAdjustments: TimeAccountAdjustment[]; // Anpassungen durch Compliance-Verstöße
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

/**
 * Beschäftigungsart.
 */
export const EMPLOYMENT_TYPE = {
  FULL_TIME: 'FULL_TIME', // Vollzeit
  PART_TIME: 'PART_TIME', // Teilzeit
  CUSTOM: 'CUSTOM', // Individuell
} as const;

export type EmploymentType =
  (typeof EMPLOYMENT_TYPE)[keyof typeof EMPLOYMENT_TYPE];

/**
 * Zielstunden-Konfiguration pro User.
 */
export interface TimeAccountTarget {
  userId: string;
  monthlyTargetHours: number; // Standard: 160h/Monat
  employmentType?: EmploymentType; // Vollzeit/Teilzeit/Individuell
  weeklyHours?: number; // Wöchentliche Stunden (optional, für Berechnung)
  updatedAt: string; // ISO string
  updatedBy: string;
}

/**
 * Request für Zielstunden-Update.
 */
export interface UpdateTimeAccountTargetRequest {
  userId: string;
  monthlyTargetHours: number;
  employmentType?: EmploymentType;
  weeklyHours?: number;
}

/**
 * Request für manuelle Anpassung.
 */
export interface AddTimeAccountAdjustmentRequest {
  amountHours: number;
  reason: string;
}

/**
 * Response für Zeitkonto.
 */
export interface TimeAccountResponse {
  account: TimeAccount;
}

/**
 * Response für Zeitkonto-Historie.
 */
export interface TimeAccountHistoryResponse {
  accounts: TimeAccount[];
  count: number;
}

/**
 * Response für Zielstunden.
 */
export interface TimeAccountTargetResponse {
  target: TimeAccountTarget;
}

/**
 * Query-Parameter für Zeitkonto-Export.
 */
export interface TimeAccountExportQueryParams {
  format?: 'json' | 'csv';
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
}

