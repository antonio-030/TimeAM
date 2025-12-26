/**
 * Entitlement Types (Shared)
 *
 * Gemeinsame Typen für Frontend und Backend.
 */

/**
 * Bekannte Entitlement-Keys.
 * Erweitern für neue Module/Features.
 */
export const ENTITLEMENT_KEYS = {
  // Module
  MODULE_CALENDAR_CORE: 'module.calendar_core',
  MODULE_TIME_TRACKING: 'module.time_tracking',
  MODULE_SHIFT_POOL: 'module.shift_pool',
  MODULE_REPORTS: 'module.reports',
  MODULE_MFA: 'module.mfa',
  MODULE_WORK_TIME_COMPLIANCE: 'module.work_time_compliance',

  // Freelancer Module
  MODULE_FREELANCER_MY_SHIFTS: 'module.freelancer_my_shifts',
  MODULE_FREELANCER_POOL: 'module.freelancer_pool',

  // Dev-spezifische Module
  MODULE_DEV_ANALYTICS: 'module.dev_analytics',
  MODULE_DEV_LOGS: 'module.dev_logs',
  MODULE_DEV_API_TESTING: 'module.dev_api_testing',
  MODULE_DEV_DATABASE: 'module.dev_database',
  MODULE_SECURITY_AUDIT: 'module.security_audit',

  // Firmen-spezifische Module
  MODULE_COMPANY_BRANDING: 'module.company_branding',
  MODULE_COMPANY_INTEGRATIONS: 'module.company_integrations',
  MODULE_COMPANY_ADVANCED_REPORTS: 'module.company_advanced_reports',
  MODULE_COMPANY_SSO: 'module.company_sso',

  // Features
  TIME_TRACKING_APPROVALS: 'time_tracking.approvals',
  SHIFT_POOL_NOTIFICATIONS: 'shift_pool.notifications',
  REPORTS_EXPORT: 'reports.export',
} as const;

export type EntitlementKey =
  (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS];

/**
 * Entitlement-Wert (true/false oder String/Zahl für Limits).
 */
export type EntitlementValue = boolean | string | number;

/**
 * Entitlements eines Tenants.
 */
export type TenantEntitlements = Partial<Record<EntitlementKey, EntitlementValue>>;

/**
 * Prüft, ob ein Entitlement aktiv ist.
 */
export function hasEntitlement(
  entitlements: TenantEntitlements,
  key: EntitlementKey
): boolean {
  const value = entitlements[key];
  return value === true || (typeof value === 'string' && value !== '') || (typeof value === 'number' && value > 0);
}

