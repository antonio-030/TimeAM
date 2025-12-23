/**
 * Entitlements Module – Public API
 *
 * Feature-Freischaltung pro Tenant.
 */

// Types
export {
  ENTITLEMENT_KEYS,
  type EntitlementKey,
  type EntitlementValue,
  type TenantEntitlements,
  EntitlementError,
} from './types';

// Middleware
export {
  requireEntitlements,
  requireTenantOnly,
  hasEntitlement,
  type TenantRequest,
} from './middleware';

