/**
 * API Types
 *
 * Response-Typen für API-Calls.
 */

/** Rolle innerhalb eines Tenants */
export type MemberRole = 'admin' | 'manager' | 'employee';

/** Entitlements (Key-Value) */
export type TenantEntitlements = Record<string, boolean | string | number>;

/** Response von GET /api/me */
export interface MeResponse {
  uid: string;
  email?: string;
  emailVerified: boolean;
  needsOnboarding: boolean;
  isFreelancer?: boolean;
  tenant?: {
    id: string;
    name: string;
  };
  role?: MemberRole;
  entitlements?: TenantEntitlements;
}

/** Request für POST /api/onboarding/create-tenant */
export interface CreateTenantRequest {
  tenantName: string;
}

/** Response von POST /api/onboarding/create-tenant */
export interface CreateTenantResponse {
  tenant: {
    id: string;
    name: string;
  };
  role: MemberRole;
  entitlements: TenantEntitlements;
}


