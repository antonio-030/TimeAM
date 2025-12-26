/**
 * Shared Types – Public API
 */

export {
  ENTITLEMENT_KEYS,
  type EntitlementKey,
  type EntitlementValue,
  type TenantEntitlements,
  hasEntitlement,
} from './entitlements.js';

export {
  MEMBER_ROLES,
  type MemberRole,
  type Tenant,
  type TenantMember,
  type UserDocument,
} from './tenant.js';

export {
  type MeResponse,
  type CreateTenantRequest,
  type CreateTenantResponse,
} from './api.js';

// Shift Pool
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
  type AdminShift,
  type Application,
  type Assignment,
  type ShiftAssignee,
  type CreateShiftRequest,
  type ApplyToShiftRequest,
  type PoolQueryParams,
  type PoolListResponse,
  type ShiftDetailResponse,
  type ApplicationsListResponse,
  type ApplicationResponse,
  type ShiftResponse,
  type ShiftTimeEntry,
  type CreateShiftTimeEntryRequest,
  type UpdateShiftTimeEntryRequest,
  type ShiftTimeEntryResponse,
  type ShiftTimeEntriesResponse,
  type ShiftDocument,
  type ShiftDocumentsResponse,
  type ShiftDocumentDownloadResponse,
  isValidShiftStatus,
  isValidApplicationStatus,
} from './shift-pool.js';

// Members
export {
  MEMBER_STATUS,
  type MemberStatus,
  type Member,
  type MemberStats,
  type InviteMemberRequest,
  type UpdateMemberRequest,
  type MembersListResponse,
  type MemberResponse,
  isValidMemberRole,
  isValidMemberStatus,
  getMemberRoleLabel,
  getMemberStatusLabel,
} from './members.js';

// Calendar Core
export {
  CALENDAR_SOURCE_MODULES,
  CALENDAR_EVENT_REF_TYPES,
  type CalendarSourceModule,
  type CalendarEventRefType,
  type CalendarEventRef,
  type CalendarEvent,
  type CalendarEventMeta,
  type CalendarQuery,
  type CalendarEventsResponse,
  isValidSourceModule,
  isValidEventRefType,
} from './calendar.js';

// Notifications
export {
  NOTIFICATION_TYPES,
  type NotificationType,
  type Notification,
  type NotificationDoc,
  type NotificationsListResponse,
  type NotificationResponse,
  type UnreadCountResponse,
  isValidNotificationType,
  getNotificationIcon,
} from './notifications.js';

// Modules Registry
export {
  MODULE_CATEGORY,
  MODULE_TARGET_TENANT,
  MODULE_REGISTRY,
  type ModuleCategory,
  type ModuleTargetTenant,
  type ModuleDefinition,
  type ModuleStatusResponse,
  type ToggleModuleRequest,
  getCoreModules,
  getOptionalModules,
  getModuleById,
  isCoreModule,
  isModuleActive,
  getModulesForTenant,
} from './modules.js';

// MFA
export {
  type MfaMethod,
  type MfaStatusResponse,
  type MfaSetupResponse,
  type MfaVerifyRequest,
  type MfaVerifyResponse,
  type MfaDisableRequest,
  type MfaPhoneSetupRequest,
  type MfaPhoneVerifyRequest,
} from './mfa.js';

// Security Audit
export {
  SECURITY_EVENT_TYPES,
  SECURITY_EVENT_SEVERITY,
  type SecurityEventType,
  type SecurityEventSeverity,
  type SecurityEventDoc,
  type SecurityEvent,
  type RateLimitDoc,
  type RateLimit,
  type SecurityEventsListResponse,
  type SecurityEventDetailResponse,
  type SecurityStatsResponse,
  type RateLimitsListResponse,
  type SecurityEventsQueryParams,
  isValidSecurityEventType,
  isValidSecurityEventSeverity,
  getSeverityForEventType,
} from './security-audit.js';

// Work Time Compliance
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
  type ComplianceRuleDoc,
  type ComplianceViolationDoc,
  type ComplianceAuditLogDoc,
  type ComplianceAuditAction,
  type ComplianceReportDoc,
  type ComplianceViolation,
  type ComplianceRule,
  type ComplianceAuditLog,
  type ComplianceReport,
  type UpdateRuleSetRequest,
  type CheckComplianceRequest,
  type GenerateReportRequest,
  type AcknowledgeViolationRequest,
  type ComplianceViolationsQueryParams,
  type ComplianceAuditLogsQueryParams,
  type ComplianceViolationsListResponse,
  type ComplianceViolationDetailResponse,
  type ComplianceRuleResponse,
  type ComplianceReportResponse,
  type ComplianceAuditLogsListResponse,
  type ComplianceStatsResponse,
  isValidViolationType,
  isValidViolationSeverity,
  isValidRuleSet,
} from './work-time-compliance.js';

// Time Account
export {
  TIME_ACCOUNT_ADJUSTMENT_SOURCE,
  EMPLOYMENT_TYPE,
  type TimeAccountAdjustmentSource,
  type EmploymentType,
  type TimeAccountAdjustment,
  type TimeAccount,
  type TimeAccountTarget,
  type UpdateTimeAccountTargetRequest,
  type AddTimeAccountAdjustmentRequest,
  type TimeAccountResponse,
  type TimeAccountHistoryResponse,
  type TimeAccountTargetResponse,
  type TimeAccountExportQueryParams,
} from './time-account.js';
