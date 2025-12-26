/**
 * Work Time Compliance Types
 *
 * Gemeinsame Typen für das Arbeitszeit-Compliance-Modul.
 */

import type { Timestamp } from 'firebase-admin/firestore';

// =============================================================================
// Violation Types
// =============================================================================

/**
 * Typen von Compliance-Verstößen.
 */
export const VIOLATION_TYPE = {
  REST_PERIOD_VIOLATION: 'REST_PERIOD_VIOLATION',
  SHIFT_DURATION_VIOLATION: 'SHIFT_DURATION_VIOLATION',
  BREAK_MISSING: 'BREAK_MISSING',
  WEEKLY_REST_VIOLATION: 'WEEKLY_REST_VIOLATION',
  MAX_WORKING_TIME_EXCEEDED: 'MAX_WORKING_TIME_EXCEEDED',
} as const;

export type ViolationType =
  (typeof VIOLATION_TYPE)[keyof typeof VIOLATION_TYPE];

/**
 * Prüft, ob ein String ein gültiger ViolationType ist.
 */
export function isValidViolationType(
  type: string
): type is ViolationType {
  return Object.values(VIOLATION_TYPE).includes(type as ViolationType);
}

/**
 * Severity eines Verstoßes.
 */
export const VIOLATION_SEVERITY = {
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export type ViolationSeverity =
  (typeof VIOLATION_SEVERITY)[keyof typeof VIOLATION_SEVERITY];

/**
 * Prüft, ob ein String ein gültiger ViolationSeverity ist.
 */
export function isValidViolationSeverity(
  severity: string
): severity is ViolationSeverity {
  return Object.values(VIOLATION_SEVERITY).includes(severity as ViolationSeverity);
}

// =============================================================================
// Rule Sets
// =============================================================================

/**
 * Verfügbare Regel-Sets.
 */
export const RULE_SET = {
  EU: 'eu',
  DE: 'de',
} as const;

export type RuleSet = (typeof RULE_SET)[keyof typeof RULE_SET];

/**
 * Prüft, ob ein String ein gültiges RuleSet ist.
 */
export function isValidRuleSet(set: string): set is RuleSet {
  return Object.values(RULE_SET).includes(set as RuleSet);
}

/**
 * Regel-Konfiguration.
 */
export interface RuleConfig {
  /** Regel-Set ID (eu, de, etc.) */
  ruleSet: RuleSet;
  
  /** 11 Stunden tägliche Ruhezeit (in Minuten) */
  dailyRestPeriodMinutes: number;
  
  /** 24 Stunden wöchentliche Ruhezeit (in Minuten) */
  weeklyRestPeriodMinutes: number;
  
  /** Maximale tägliche Arbeitszeit (in Minuten) */
  maxDailyWorkingTimeMinutes: number;
  
  /** Maximale tägliche Arbeitszeit mit Ausgleich (in Minuten) */
  maxDailyWorkingTimeWithCompensationMinutes: number;
  
  /** Maximale wöchentliche Arbeitszeit (in Minuten, Durchschnitt) */
  maxWeeklyWorkingTimeMinutes: number;
  
  /** Pause erforderlich ab X Stunden (in Minuten) */
  breakRequiredAfterMinutes: number;
  
  /** Pausendauer bei breakRequiredAfterMinutes (in Minuten) */
  breakDurationMinutes: number;
  
  /** Pause erforderlich ab X Stunden (in Minuten) - zweite Stufe */
  breakRequiredAfterMinutes2?: number;
  
  /** Pausendauer bei breakRequiredAfterMinutes2 (in Minuten) */
  breakDurationMinutes2?: number;
}

/**
 * Standard-Regel-Sets.
 */
export const DEFAULT_RULE_SETS: Record<RuleSet, RuleConfig> = {
  [RULE_SET.EU]: {
    ruleSet: RULE_SET.EU,
    dailyRestPeriodMinutes: 11 * 60, // 11 Stunden
    weeklyRestPeriodMinutes: 24 * 60, // 24 Stunden
    maxDailyWorkingTimeMinutes: 8 * 60, // 8 Stunden
    maxDailyWorkingTimeWithCompensationMinutes: 10 * 60, // 10 Stunden
    maxWeeklyWorkingTimeMinutes: 48 * 60, // 48 Stunden (Durchschnitt)
    breakRequiredAfterMinutes: 6 * 60, // 6 Stunden
    breakDurationMinutes: 30, // 30 Minuten
    breakRequiredAfterMinutes2: 9 * 60, // 9 Stunden
    breakDurationMinutes2: 45, // 45 Minuten
  },
  [RULE_SET.DE]: {
    ruleSet: RULE_SET.DE,
    dailyRestPeriodMinutes: 11 * 60, // 11 Stunden
    weeklyRestPeriodMinutes: 24 * 60, // 24 Stunden
    maxDailyWorkingTimeMinutes: 8 * 60, // 8 Stunden
    maxDailyWorkingTimeWithCompensationMinutes: 10 * 60, // 10 Stunden
    maxWeeklyWorkingTimeMinutes: 48 * 60, // 48 Stunden (Durchschnitt)
    breakRequiredAfterMinutes: 6 * 60, // 6 Stunden
    breakDurationMinutes: 30, // 30 Minuten
    breakRequiredAfterMinutes2: 9 * 60, // 9 Stunden
    breakDurationMinutes2: 45, // 45 Minuten
  },
};

// =============================================================================
// Firestore Document Types
// =============================================================================

/**
 * Compliance-Regel-Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/complianceRules/{ruleId}
 */
export interface ComplianceRuleDoc {
  ruleSet: RuleSet;
  config: RuleConfig;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Compliance-Verstoß-Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/complianceViolations/{violationId}
 */
export interface ComplianceViolationDoc {
  userId: string;
  violationType: ViolationType;
  severity: ViolationSeverity;
  detectedAt: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  ruleSet: RuleSet;
  details: {
    expected: string;
    actual: string;
    affectedEntries: string[]; // TimeEntry IDs
  };
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: string;
}

/**
 * Compliance-Audit-Log-Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/complianceAuditLogs/{logId}
 */
export interface ComplianceAuditLogDoc {
  action: ComplianceAuditAction;
  actorUid: string;
  timestamp: Timestamp;
  details: {
    reportId?: string;
    violationId?: string;
    ruleSet?: RuleSet;
    exportFormat?: 'csv' | 'pdf';
    periodStart?: string;
    periodEnd?: string;
  };
}

/**
 * Compliance-Audit-Aktionen.
 */
export const COMPLIANCE_AUDIT_ACTION = {
  REPORT_GENERATED: 'report_generated',
  VIOLATION_ACKNOWLEDGED: 'violation_acknowledged',
  RULE_SET_CHANGED: 'rule_set_changed',
  MANUAL_CHECK: 'manual_check',
} as const;

export type ComplianceAuditAction =
  (typeof COMPLIANCE_AUDIT_ACTION)[keyof typeof COMPLIANCE_AUDIT_ACTION];

/**
 * Compliance-Report-Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/complianceReports/{reportId}
 */
export interface ComplianceReportDoc {
  generatedBy: string;
  generatedAt: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  format: 'csv' | 'pdf';
  ruleSet: RuleSet;
  filters?: {
    userId?: string;
    violationType?: ViolationType;
    severity?: ViolationSeverity;
  };
  summary: {
    totalViolations: number;
    violationsByType: Record<ViolationType, number>;
    violationsBySeverity: Record<ViolationSeverity, number>;
  };
  storagePath: string; // Firebase Storage path
  hash: string; // SHA-256 hash für Unveränderbarkeit
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Compliance-Verstoß (API Response).
 */
export interface ComplianceViolation {
  id: string;
  userId: string;
  violationType: ViolationType;
  severity: ViolationSeverity;
  detectedAt: string; // ISO string
  periodStart: string; // ISO string
  periodEnd: string; // ISO string
  ruleSet: RuleSet;
  details: {
    expected: string;
    actual: string;
    affectedEntries: string[];
  };
  acknowledgedAt?: string; // ISO string
  acknowledgedBy?: string;
}

/**
 * Compliance-Regel (API Response).
 */
export interface ComplianceRule {
  id: string;
  ruleSet: RuleSet;
  config: RuleConfig;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  updatedBy: string;
}

/**
 * Compliance-Audit-Log (API Response).
 */
export interface ComplianceAuditLog {
  id: string;
  action: ComplianceAuditAction;
  actorUid: string;
  timestamp: string; // ISO string
  details: {
    reportId?: string;
    violationId?: string;
    ruleSet?: RuleSet;
    exportFormat?: 'csv' | 'pdf';
    periodStart?: string;
    periodEnd?: string;
  };
}

/**
 * Compliance-Report (API Response).
 */
export interface ComplianceReport {
  id: string;
  generatedBy: string;
  generatedAt: string; // ISO string
  periodStart: string; // ISO string
  periodEnd: string; // ISO string
  format: 'csv' | 'pdf';
  ruleSet: RuleSet;
  filters?: {
    userId?: string;
    violationType?: ViolationType;
    severity?: ViolationSeverity;
  };
  summary: {
    totalViolations: number;
    violationsByType: Record<ViolationType, number>;
    violationsBySeverity: Record<ViolationSeverity, number>;
  };
  downloadUrl: string;
  hash: string;
}

// =============================================================================
// API Request Types
// =============================================================================

/**
 * Request zum Aktualisieren des Regel-Sets.
 */
export interface UpdateRuleSetRequest {
  ruleSet: RuleSet;
  config?: Partial<RuleConfig>;
}

/**
 * Request für manuelle Compliance-Prüfung.
 */
export interface CheckComplianceRequest {
  userId?: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
}

/**
 * Request zum Generieren eines Reports.
 */
export interface GenerateReportRequest {
  periodStart: string; // ISO string
  periodEnd: string; // ISO string
  format: 'csv' | 'pdf';
  filters?: {
    userId?: string;
    violationType?: ViolationType;
    severity?: ViolationSeverity;
  };
}

/**
 * Request zum Bestätigen eines Verstoßes.
 */
export interface AcknowledgeViolationRequest {
  acknowledged: boolean;
}

// =============================================================================
// Query Parameters
// =============================================================================

/**
 * Query-Parameter für Verstoß-Liste.
 */
export interface ComplianceViolationsQueryParams {
  userId?: string;
  violationType?: ViolationType;
  severity?: ViolationSeverity;
  acknowledged?: boolean;
  from?: string; // ISO string
  to?: string; // ISO string
  limit?: number;
  offset?: number;
}

/**
 * Query-Parameter für Audit-Logs.
 */
export interface ComplianceAuditLogsQueryParams {
  action?: ComplianceAuditAction;
  from?: string; // ISO string
  to?: string; // ISO string
  limit?: number;
  offset?: number;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Liste von Compliance-Verstößen.
 */
export interface ComplianceViolationsListResponse {
  violations: ComplianceViolation[];
  count: number;
  total: number;
}

/**
 * Einzelner Compliance-Verstoß.
 */
export interface ComplianceViolationDetailResponse {
  violation: ComplianceViolation;
}

/**
 * Compliance-Regel-Response.
 */
export interface ComplianceRuleResponse {
  rule: ComplianceRule;
}

/**
 * Compliance-Report-Response.
 */
export interface ComplianceReportResponse {
  report: ComplianceReport;
}

/**
 * Compliance-Audit-Logs-Response.
 */
export interface ComplianceAuditLogsListResponse {
  logs: ComplianceAuditLog[];
  count: number;
  total: number;
}

/**
 * Compliance-Statistik-Response.
 */
export interface ComplianceStatsResponse {
  today: {
    violations: number;
    warnings: number;
    errors: number;
  };
  thisWeek: {
    violations: number;
    warnings: number;
    errors: number;
  };
  thisMonth: {
    violations: number;
    warnings: number;
    errors: number;
  };
  violationsByType: Array<{
    type: ViolationType;
    count: number;
  }>;
}

