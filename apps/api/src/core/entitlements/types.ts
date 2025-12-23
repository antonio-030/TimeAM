/**
 * Entitlement Types
 *
 * Typen für Feature-Freischaltung pro Tenant.
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
 * Fehler bei Entitlement-Prüfung.
 */
export class EntitlementError extends Error {
  constructor(
    message: string,
    public readonly requiredEntitlement: EntitlementKey,
    public readonly statusCode: number = 403
  ) {
    super(message);
    this.name = 'EntitlementError';
  }
}

