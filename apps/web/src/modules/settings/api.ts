/**
 * Settings API
 *
 * API-Funktionen für Admin-Einstellungen.
 */

import { apiPatch } from '../../core/api';

export interface UpdateTenantNameRequest {
  name: string;
}

export interface UpdateTenantNameResponse {
  success: boolean;
  message: string;
  name: string;
}

/**
 * Aktualisiert den Namen des Tenants.
 * Nur für Admins.
 */
export function updateTenantName(data: UpdateTenantNameRequest): Promise<UpdateTenantNameResponse> {
  return apiPatch<UpdateTenantNameResponse>('/api/settings/tenant-name', data);
}

