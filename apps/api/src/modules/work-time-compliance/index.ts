/**
 * Work Time Compliance Module – Public API
 */

export { workTimeComplianceRouter } from './routes.js';

export {
  VIOLATION_TYPE,
  VIOLATION_SEVERITY,
  RULE_SET,
  COMPLIANCE_AUDIT_ACTION,
  DEFAULT_RULE_SETS,
  type ViolationType,
  type ViolationSeverity,
  type RuleSet,
  type RuleConfig,
  type ComplianceViolation,
  type ComplianceRule,
  type ComplianceAuditLog,
  type ComplianceReport,
} from './types.js';

export {
  checkCompliance,
  detectViolations,
  getComplianceRule,
  updateComplianceRule,
  getViolations,
  getViolation,
  acknowledgeViolation,
  generateReport,
  getReport,
  getAuditLogs,
  getComplianceStats,
} from './service.js';

