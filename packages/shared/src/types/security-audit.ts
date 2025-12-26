/**
 * Security Audit Types
 *
 * Types für das Security-Audit-Modul.
 */

/**
 * Security Event Types
 */
export const SECURITY_EVENT_TYPES = {
  // Authentication Events
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_RATE_LIMIT_EXCEEDED: 'auth.rate_limit_exceeded',
  
  // Data Access Events
  DATA_ACCESS_PERSONAL: 'data.access.personal',
  DATA_MODIFY_SENSITIVE: 'data.modify.sensitive',
  
  // API Access Events
  API_ACCESS_PROTECTED: 'api.access.protected',
  
  // MFA Events
  MFA_SETUP: 'mfa.setup',
  MFA_VERIFY_SUCCESS: 'mfa.verify.success',
  MFA_VERIFY_FAILED: 'mfa.verify.failed',
  MFA_RESET: 'mfa.reset',
  
  // Account Change Events
  ACCOUNT_PASSWORD_CHANGE: 'account.password_change',
  ACCOUNT_EMAIL_CHANGE: 'account.email_change',
  ACCOUNT_DELETION_REQUEST: 'account.deletion_request',
} as const;

export type SecurityEventType =
  (typeof SECURITY_EVENT_TYPES)[keyof typeof SECURITY_EVENT_TYPES];

/**
 * Security Event Severity
 */
export const SECURITY_EVENT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type SecurityEventSeverity =
  (typeof SECURITY_EVENT_SEVERITY)[keyof typeof SECURITY_EVENT_SEVERITY];

/**
 * Security Event Document (Firestore)
 */
export interface SecurityEventDoc {
  eventType: SecurityEventType;
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  severity: SecurityEventSeverity;
  timestamp: import('firebase-admin/firestore').Timestamp;
  tenantId?: string; // Nur in globaler Collection
}

/**
 * Security Event Response (API)
 */
export interface SecurityEvent {
  id: string;
  eventType: SecurityEventType;
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  severity: SecurityEventSeverity;
  timestamp: string;
  tenantId?: string;
}

/**
 * Rate Limit Document (Firestore)
 */
export interface RateLimitDoc {
  attempts: number;
  firstAttempt: import('firebase-admin/firestore').Timestamp;
  lastAttempt: import('firebase-admin/firestore').Timestamp;
  blockedUntil?: import('firebase-admin/firestore').Timestamp;
}

/**
 * Rate Limit Response (API)
 */
export interface RateLimit {
  identifier: string; // email or IP
  attempts: number;
  firstAttempt: string;
  lastAttempt: string;
  blockedUntil?: string;
  isBlocked: boolean;
}

/**
 * Security Events List Response
 */
export interface SecurityEventsListResponse {
  events: SecurityEvent[];
  count: number;
  total?: number;
}

/**
 * Security Event Detail Response
 */
export interface SecurityEventDetailResponse {
  event: SecurityEvent;
}

/**
 * Security Stats Response
 */
export interface SecurityStatsResponse {
  failedLogins: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  rateLimited: {
    current: number;
    last24h: number;
  };
  eventTypes: Array<{
    type: SecurityEventType;
    count: number;
  }>;
  topIpAddresses: Array<{
    ip: string;
    count: number;
  }>;
}

/**
 * Rate Limits List Response
 */
export interface RateLimitsListResponse {
  rateLimits: RateLimit[];
  count: number;
}

/**
 * Security Events Query Parameters
 */
export interface SecurityEventsQueryParams {
  eventType?: SecurityEventType;
  severity?: SecurityEventSeverity;
  userId?: string;
  email?: string;
  ipAddress?: string;
  from?: string; // ISO date string
  to?: string; // ISO date string
  limit?: number;
  offset?: number;
}

/**
 * Prüft, ob ein Security Event Type gültig ist.
 */
export function isValidSecurityEventType(
  value: string
): value is SecurityEventType {
  return Object.values(SECURITY_EVENT_TYPES).includes(
    value as SecurityEventType
  );
}

/**
 * Prüft, ob ein Security Event Severity gültig ist.
 */
export function isValidSecurityEventSeverity(
  value: string
): value is SecurityEventSeverity {
  return Object.values(SECURITY_EVENT_SEVERITY).includes(
    value as SecurityEventSeverity
  );
}

/**
 * Bestimmt die Severity basierend auf dem Event Type.
 */
export function getSeverityForEventType(
  eventType: SecurityEventType
): SecurityEventSeverity {
  switch (eventType) {
    case SECURITY_EVENT_TYPES.AUTH_RATE_LIMIT_EXCEEDED:
    case SECURITY_EVENT_TYPES.ACCOUNT_DELETION_REQUEST:
      return SECURITY_EVENT_SEVERITY.CRITICAL;
    case SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED:
    case SECURITY_EVENT_TYPES.MFA_VERIFY_FAILED:
    case SECURITY_EVENT_TYPES.DATA_MODIFY_SENSITIVE:
      return SECURITY_EVENT_SEVERITY.HIGH;
    case SECURITY_EVENT_TYPES.DATA_ACCESS_PERSONAL:
    case SECURITY_EVENT_TYPES.API_ACCESS_PROTECTED:
    case SECURITY_EVENT_TYPES.ACCOUNT_PASSWORD_CHANGE:
    case SECURITY_EVENT_TYPES.ACCOUNT_EMAIL_CHANGE:
      return SECURITY_EVENT_SEVERITY.MEDIUM;
    case SECURITY_EVENT_TYPES.AUTH_LOGIN_SUCCESS:
    case SECURITY_EVENT_TYPES.AUTH_LOGOUT:
    case SECURITY_EVENT_TYPES.MFA_SETUP:
    case SECURITY_EVENT_TYPES.MFA_VERIFY_SUCCESS:
      return SECURITY_EVENT_SEVERITY.LOW;
    default:
      return SECURITY_EVENT_SEVERITY.MEDIUM;
  }
}

