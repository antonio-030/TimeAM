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
// WICHTIG: MeResponse sollte aus @timeam/shared importiert werden, nicht lokal definiert
// Diese Datei wird möglicherweise nicht mehr benötigt, wenn alle Types aus @timeam/shared importiert werden
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
  /** MFA aktiviert? */
  mfaEnabled?: boolean;
  /** MFA-Verifizierung erforderlich? (true wenn MFA aktiviert aber noch nicht verifiziert) */
  mfaRequired?: boolean;
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


