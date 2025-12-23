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

