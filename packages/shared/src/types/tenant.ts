/**
 * Tenant Types
 *
 * Gemeinsame Typen für Multi-Tenancy.
 */

/**
 * Tenant (Firma/Organisation).
 */
export interface Tenant {
  id: string;
  name: string;
  createdAt: Date;
  createdBy: string;
}

/**
 * Rollen innerhalb eines Tenants.
 */
export const MEMBER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
} as const;

export type MemberRole = (typeof MEMBER_ROLES)[keyof typeof MEMBER_ROLES];

/**
 * Mitglied eines Tenants.
 */
export interface TenantMember {
  uid: string;
  email: string;
  role: MemberRole;
  joinedAt: Date;
  invitedBy?: string;
}

/**
 * User-Dokument (globales Mapping).
 */
export interface UserDocument {
  email: string;
  displayName?: string;
  defaultTenantId?: string;
  createdAt: Date;
}


