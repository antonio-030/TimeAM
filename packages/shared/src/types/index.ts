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
  MODULE_REGISTRY,
  type ModuleCategory,
  type ModuleDefinition,
  type ModuleStatusResponse,
  type ToggleModuleRequest,
  getCoreModules,
  getOptionalModules,
  getModuleById,
  isCoreModule,
  isModuleActive,
} from './modules.js';

// MFA
export {
  type MfaStatusResponse,
  type MfaSetupResponse,
  type MfaVerifyRequest,
  type MfaVerifyResponse,
  type MfaDisableRequest,
} from './mfa.js';
