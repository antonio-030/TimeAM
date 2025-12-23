/**
 * Entitlement Types (Frontend)
 *
 * Gespiegelt aus packages/shared (TODO: Shared Package nutzen).
 */

/**
 * Bekannte Entitlement-Keys.
 */
export const ENTITLEMENT_KEYS = {
  // Module
  MODULE_CALENDAR_CORE: 'module.calendar_core',
  MODULE_TIME_TRACKING: 'module.time_tracking',
  MODULE_SHIFT_POOL: 'module.shift_pool',

  // Features
  TIME_TRACKING_APPROVALS: 'time_tracking.approvals',
  SHIFT_POOL_NOTIFICATIONS: 'shift_pool.notifications',
} as const;

export type EntitlementKey =
  (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS];

/**
 * Entitlement-Wert.
 */
export type EntitlementValue = boolean | string | number;

/**
 * Entitlements eines Tenants.
 */
export type TenantEntitlements = Partial<Record<EntitlementKey, EntitlementValue>>;

