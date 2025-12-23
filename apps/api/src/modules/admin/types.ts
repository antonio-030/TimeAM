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
  createdBy: string;
  members: TenantMemberInfo[];
  modules: TenantModuleStatus[];
}

/**
 * Mitarbeiter-Info (minimal)
 */
export interface TenantMemberInfo {
  uid: string;
  email: string;
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
