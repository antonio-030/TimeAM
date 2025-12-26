/**
 * Work Time Compliance API Client
 */

import { apiGet, apiPost, apiPut } from '../../core/api';

/**
 * Compliance Violation
 */
export interface ComplianceViolation {
  id: string;
  userId: string;
  violationType: string;
  severity: 'warning' | 'error';
  detectedAt: string;
  periodStart: string;
  periodEnd: string;
  ruleSet: string;
  details: {
    expected: string;
    actual: string;
    affectedEntries: string[];
  };
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

/**
 * Compliance Rule
 */
export interface ComplianceRule {
  id: string;
  ruleSet: string;
  config: {
    ruleSet: string;
    dailyRestPeriodMinutes: number;
    weeklyRestPeriodMinutes: number;
    maxDailyWorkingTimeMinutes: number;
    maxDailyWorkingTimeWithCompensationMinutes: number;
    maxWeeklyWorkingTimeMinutes: number;
    breakRequiredAfterMinutes: number;
    breakDurationMinutes: number;
    breakRequiredAfterMinutes2?: number;
    breakDurationMinutes2?: number;
  };
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Compliance Report
 */
export interface ComplianceReport {
  id: string;
  generatedBy: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  format: 'csv' | 'pdf';
  ruleSet: string;
  filters?: {
    userId?: string;
    violationType?: string;
    severity?: 'warning' | 'error';
  };
  summary: {
    totalViolations: number;
    violationsByType: Record<string, number>;
    violationsBySeverity: Record<string, number>;
  };
  downloadUrl: string;
  hash: string;
}

/**
 * Compliance Audit Log
 */
export interface ComplianceAuditLog {
  id: string;
  action: string;
  actorUid: string;
  timestamp: string;
  details: {
    reportId?: string;
    violationId?: string;
    ruleSet?: string;
    exportFormat?: 'csv' | 'pdf';
    periodStart?: string;
    periodEnd?: string;
  };
}

/**
 * Compliance Stats
 */
export interface ComplianceStats {
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
    type: string;
    count: number;
  }>;
}

/**
 * Violations List Response
 */
export interface ViolationsListResponse {
  violations: ComplianceViolation[];
  count: number;
  total: number;
}

/**
 * Violation Detail Response
 */
export interface ViolationDetailResponse {
  violation: ComplianceViolation;
}

/**
 * Rule Response
 */
export interface RuleResponse {
  rule: ComplianceRule;
}

/**
 * Report Response
 */
export interface ReportResponse {
  report: ComplianceReport;
}

/**
 * Audit Logs List Response
 */
export interface AuditLogsListResponse {
  logs: ComplianceAuditLog[];
  count: number;
  total: number;
}

/**
 * Update Rule Set Request
 */
export interface UpdateRuleSetRequest {
  ruleSet: string;
  config?: Partial<ComplianceRule['config']>;
}

/**
 * Check Compliance Request
 */
export interface CheckComplianceRequest {
  userId?: string;
  startDate: string;
  endDate: string;
}

/**
 * Generate Report Request
 */
export interface GenerateReportRequest {
  periodStart: string;
  periodEnd: string;
  format: 'csv' | 'pdf';
  filters?: {
    userId?: string;
    violationType?: string;
    severity?: 'warning' | 'error';
  };
}

/**
 * Acknowledge Violation Request
 */
export interface AcknowledgeViolationRequest {
  acknowledged: boolean;
}

/**
 * Holt Compliance-Statistiken.
 */
export function getStats(): Promise<ComplianceStats> {
  return apiGet<ComplianceStats>('/api/work-time-compliance/stats');
}

/**
 * Holt Verstöße.
 */
export function getViolations(params?: {
  userId?: string;
  violationType?: string;
  severity?: 'warning' | 'error';
  acknowledged?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<ViolationsListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.userId) queryParams.append('userId', params.userId);
  if (params?.violationType) queryParams.append('violationType', params.violationType);
  if (params?.severity) queryParams.append('severity', params.severity);
  if (params?.acknowledged !== undefined) queryParams.append('acknowledged', String(params.acknowledged));
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));

  const url = `/api/work-time-compliance/violations${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiGet<ViolationsListResponse>(url);
}

/**
 * Holt einen einzelnen Verstoß.
 */
export function getViolation(violationId: string): Promise<ViolationDetailResponse> {
  return apiGet<ViolationDetailResponse>(`/api/work-time-compliance/violations/${violationId}`);
}

/**
 * Markiert einen Verstoß als erkannt.
 */
export function acknowledgeViolation(
  violationId: string,
  acknowledged: boolean
): Promise<ViolationDetailResponse> {
  return apiPost<ViolationDetailResponse>(
    `/api/work-time-compliance/violations/${violationId}/acknowledge`,
    { acknowledged }
  );
}

/**
 * Holt das aktuelle Regel-Set.
 */
export function getRules(): Promise<RuleResponse> {
  return apiGet<RuleResponse>('/api/work-time-compliance/rules');
}

/**
 * Aktualisiert das Regel-Set.
 */
export function updateRules(data: UpdateRuleSetRequest): Promise<RuleResponse> {
  return apiPut<RuleResponse>('/api/work-time-compliance/rules', data);
}

/**
 * Führt eine manuelle Compliance-Prüfung durch.
 */
export function checkCompliance(data: CheckComplianceRequest): Promise<{ violations: ComplianceViolation[]; count: number }> {
  return apiPost<{ violations: ComplianceViolation[]; count: number }>('/api/work-time-compliance/check', data);
}

/**
 * Generiert einen Report.
 */
export function generateReport(data: GenerateReportRequest): Promise<ReportResponse> {
  return apiPost<ReportResponse>('/api/work-time-compliance/reports/generate', data);
}

/**
 * Holt einen Report.
 */
export function getReport(reportId: string): Promise<ReportResponse> {
  return apiGet<ReportResponse>(`/api/work-time-compliance/reports/${reportId}`);
}

/**
 * Holt Audit-Logs.
 */
export function getAuditLogs(params?: {
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogsListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.action) queryParams.append('action', params.action);
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));

  const url = `/api/work-time-compliance/audit-logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiGet<AuditLogsListResponse>(url);
}

