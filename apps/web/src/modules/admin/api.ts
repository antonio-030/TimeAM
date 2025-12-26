/**
 * Admin API Client
 *
 * API-Funktionen für das Super-Admin / Developer Dashboard.
 */

import { apiGet, apiPut, apiPost, apiDelete } from '../../core/api';

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
 * Mitarbeiter-Info
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

/**
 * Freelancer-Übersicht
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
 * Freelancer-Detail
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

/**
 * Lädt alle Freelancer.
 */
export async function fetchAllFreelancers(): Promise<FreelancersListResponse> {
  return apiGet<FreelancersListResponse>('/api/admin/freelancers');
}

/**
 * Lädt Detail-Informationen zu einem Freelancer.
 */
export async function fetchFreelancerDetail(freelancerUid: string): Promise<FreelancerDetail> {
  return apiGet<FreelancerDetail>(`/api/admin/freelancers/${freelancerUid}`);
}

/**
 * Aktiviert oder deaktiviert ein Modul für einen Freelancer.
 */
export async function toggleFreelancerModule(
  freelancerUid: string,
  moduleId: string,
  enabled: boolean
): Promise<ToggleFreelancerModuleResponse> {
  return apiPut<ToggleFreelancerModuleResponse>(
    `/api/admin/freelancers/${freelancerUid}/modules/${moduleId}`,
    { enabled }
  );
}

/**
 * Löscht einen Tenant komplett.
 */
export async function deleteTenant(tenantId: string): Promise<{ success: boolean; message: string }> {
  return apiDelete<{ success: boolean; message: string }>(`/api/admin/tenants/${tenantId}`);
}

/**
 * Deaktiviert einen Tenant.
 */
export async function deactivateTenant(tenantId: string): Promise<{ success: boolean; message: string }> {
  return apiPost<{ success: boolean; message: string }>(`/api/admin/tenants/${tenantId}/deactivate`);
}

/**
 * Aktiviert einen deaktivierten Tenant.
 */
export async function activateTenant(tenantId: string): Promise<{ success: boolean; message: string }> {
  return apiPost<{ success: boolean; message: string }>(`/api/admin/tenants/${tenantId}/activate`);
}
