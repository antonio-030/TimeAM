/**
 * Tenancy Module – Public API
 *
 * Multi-Tenant-Isolation für das TimeAM Backend.
 */

// Types
export {
  type TenantContext,
  type TenantScopedRequest,
  TenantError,
  type TenantErrorCode,
} from './types';

// Service
export {
  getUserDocument,
  getTenantForUser,
  createTenant,
  setEntitlement,
  deleteEntitlement,
  getEntitlements,
  getFreelancerEntitlements,
  setFreelancerEntitlement,
  type TenantDoc,
  type MemberDoc,
  type EntitlementDoc,
  type UserDoc,
} from './service';

