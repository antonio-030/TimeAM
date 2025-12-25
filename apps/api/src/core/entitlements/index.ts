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
} from './types.js';

// Middleware
export {
  requireEntitlements,
  requireEntitlementsOrFreelancer,
  requireTenantOnly,
  hasEntitlement,
  type TenantRequest,
} from './middleware.js';

