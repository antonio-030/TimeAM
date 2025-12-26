/**
 * Admin Module Types
 *
 * Types für das Super-Admin / Developer Dashboard.
 */

/**
 * Tenant-Übersicht für Developer Dashboard
 */
export interface TenantOverview {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  activeModules: string[];
  createdBy: string; // UID
  createdByName?: string; // Display-Name des Erstellers
  createdByEmail?: string; // Email des Erstellers
  address?: string; // Adresse (optional)
  isActive?: boolean; // Tenant aktiviert/deaktiviert
  deactivatedAt?: string; // Wann deaktiviert wurde
}

/**
 * Response: Alle Tenants
 */
export interface TenantsListResponse {
  tenants: TenantOverview[];
  total: number;
}

/**
 * Tenant-Detail mit Modulen
 */
export interface TenantDetail {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string; // UID
  createdByName?: string; // Display-Name des Erstellers
  createdByFirstName?: string; // Vorname des Erstellers
  createdByLastName?: string; // Nachname des Erstellers
  createdByEmail?: string; // Email des Erstellers
  address?: string; // Adresse (optional)
  members: TenantMemberInfo[];
  modules: TenantModuleStatus[];
}

/**
 * Mitarbeiter-Info (minimal)
 */
export interface TenantMemberInfo {
  uid: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  role: 'admin' | 'manager' | 'employee';
  joinedAt: string;
}

/**
 * Modul-Status für einen Tenant
 */
export interface TenantModuleStatus {
  id: string;
  displayName: string;
  description: string;
  icon: string;
  category: 'core' | 'optional';
  isActive: boolean;
  canToggle: boolean;
}

/**
 * Request: Modul für Tenant aktivieren/deaktivieren
 */
export interface ToggleTenantModuleRequest {
  enabled: boolean;
}

/**
 * Response: Modul-Toggle
 */
export interface ToggleTenantModuleResponse {
  success: boolean;
  tenantId: string;
  moduleId: string;
  enabled: boolean;
  message: string;
}

/**
 * Freelancer-Übersicht für Developer Dashboard
 */
export interface FreelancerOverview {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  address?: string;
  tenantId?: string;
  createdAt: string;
  activeModules: string[];
  verificationStatus?: 'pending' | 'approved' | 'rejected';
}

/**
 * Response: Alle Freelancer
 */
export interface FreelancersListResponse {
  freelancers: FreelancerOverview[];
  total: number;
}

/**
 * Freelancer-Detail mit Modulen
 */
export interface FreelancerDetail {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  tenantId?: string;
  phone?: string;
  address?: string;
  businessLicenseNumber?: string;
  createdAt: string;
  updatedAt: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  modules: TenantModuleStatus[];
}

/**
 * Response: Freelancer-Modul-Toggle
 */
export interface ToggleFreelancerModuleResponse {
  success: boolean;
  freelancerUid: string;
  moduleId: string;
  enabled: boolean;
  message: string;
}
