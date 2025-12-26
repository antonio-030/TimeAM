/**
 * Work Time Compliance Types (Backend)
 *
 * Backend-spezifische Types für das Work-Time-Compliance-Modul.
 */

export type {
  ViolationType,
  ViolationSeverity,
  RuleSet,
  RuleConfig,
  ComplianceRuleDoc,
  ComplianceViolationDoc,
  ComplianceAuditLogDoc,
  ComplianceAuditAction,
  ComplianceReportDoc,
  ComplianceViolation,
  ComplianceRule,
  ComplianceAuditLog,
  ComplianceReport,
  UpdateRuleSetRequest,
  CheckComplianceRequest,
  GenerateReportRequest,
  AcknowledgeViolationRequest,
  ComplianceViolationsQueryParams,
  ComplianceAuditLogsQueryParams,
  ComplianceViolationsListResponse,
  ComplianceViolationDetailResponse,
  ComplianceRuleResponse,
  ComplianceReportResponse,
  ComplianceAuditLogsListResponse,
  ComplianceStatsResponse,
} from '@timeam/shared';

export {
  VIOLATION_TYPE,
  VIOLATION_SEVERITY,
  RULE_SET,
  COMPLIANCE_AUDIT_ACTION,
  DEFAULT_RULE_SETS,
  isValidViolationType,
  isValidViolationSeverity,
  isValidRuleSet,
} from '@timeam/shared';

