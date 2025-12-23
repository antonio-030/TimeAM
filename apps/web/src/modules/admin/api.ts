/**
 * Admin API Client
 *
 * API-Funktionen für das Super-Admin / Developer Dashboard.
 */

import { apiGet, apiPut } from '../../core/api';

/**
 * Super-Admin Check Response
 */
export interface SuperAdminCheckResponse {
  isSuperAdmin: boolean;
  uid: string;
}

/**
 * Tenant-Übersicht
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
 * Mitarbeiter-Info
 */
export interface TenantMemberInfo {
  uid: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  joinedAt: string;
}

/**
 * Modul-Status
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
 * Tenant-Detail
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
 * Prüft, ob der aktuelle User ein Super-Admin ist.
 */
export async function checkSuperAdmin(): Promise<SuperAdminCheckResponse> {
  return apiGet<SuperAdminCheckResponse>('/api/admin/check');
}

/**
 * Lädt alle Tenants.
 */
export async function fetchAllTenants(): Promise<TenantsListResponse> {
  return apiGet<TenantsListResponse>('/api/admin/tenants');
}

/**
 * Lädt Detail-Informationen zu einem Tenant.
 */
export async function fetchTenantDetail(tenantId: string): Promise<TenantDetail> {
  return apiGet<TenantDetail>(`/api/admin/tenants/${tenantId}`);
}

/**
 * Aktiviert oder deaktiviert ein Modul für einen Tenant.
 */
export async function toggleTenantModule(
  tenantId: string,
  moduleId: string,
  enabled: boolean
): Promise<ToggleTenantModuleResponse> {
  return apiPut<ToggleTenantModuleResponse>(
    `/api/admin/tenants/${tenantId}/modules/${moduleId}`,
    { enabled }
  );
}
