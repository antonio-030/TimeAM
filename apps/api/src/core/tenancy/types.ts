/**
 * Tenancy Types
 *
 * Typen für Multi-Tenant-Architektur.
 */

/**
 * Tenant-Kontext für einen Request.
 */
export interface TenantContext {
  /** Eindeutige Tenant-ID */
  tenantId: string;

  /** Tenant-Name (optional, für Logging) */
  tenantName?: string;
}

/**
 * Request mit Tenant-Kontext.
 * Wird von requireTenant Middleware gesetzt.
 */
export interface TenantScopedRequest {
  tenant: TenantContext;
}

/**
 * Fehler bei Tenant-Zugriff.
 */
export class TenantError extends Error {
  constructor(
    message: string,
    public readonly code: TenantErrorCode,
    public readonly statusCode: number = 403
  ) {
    super(message);
    this.name = 'TenantError';
  }
}

/**
 * Tenant-Fehlercodes.
 */
export type TenantErrorCode =
  | 'NO_TENANT'
  | 'TENANT_MISMATCH'
  | 'TENANT_DISABLED'
  | 'TENANT_NOT_FOUND';

