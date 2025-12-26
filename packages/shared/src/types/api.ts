/**
 * API Response Types
 *
 * Gemeinsame API-Typen für Frontend und Backend.
 */

import type { MemberRole } from './tenant.js';
import type { TenantEntitlements } from './entitlements.js';

/**
 * Response von GET /api/me
 */
export interface MeResponse {
  uid: string;
  email?: string;
  emailVerified: boolean;

  /** true wenn User noch keinem Tenant zugeordnet ist */
  needsOnboarding: boolean;

  /** Tenant-Daten (nur wenn Mitglied) */
  tenant?: {
    id: string;
    name: string;
  };

  /** Rolle im Tenant */
  role?: MemberRole;

  /** Freigeschaltete Features */
  entitlements?: TenantEntitlements;

  /** MFA aktiviert? */
  mfaEnabled?: boolean;

  /** MFA-Verifizierung erforderlich? (true wenn MFA aktiviert aber noch nicht verifiziert) */
  mfaRequired?: boolean;
}

/**
 * Request für POST /api/onboarding/create-tenant
 */
export interface CreateTenantRequest {
  tenantName: string;
}

/**
 * Response von POST /api/onboarding/create-tenant
 */
export interface CreateTenantResponse {
  tenant: {
    id: string;
    name: string;
  };
  role: MemberRole;
  entitlements: TenantEntitlements;
}


