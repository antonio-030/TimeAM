/**
 * Auth Types
 *
 * Typen für authentifizierte Requests.
 */

/**
 * User-Kontext aus dem verifizierten Firebase Token.
 */
export interface AuthUser {
  /** Firebase User ID */
  uid: string;

  /** E-Mail (falls vorhanden) */
  email?: string;

  /** E-Mail verifiziert? */
  emailVerified: boolean;

  /** Tenant-ID aus Custom Claims */
  tenantId?: string;

  /** Rolle aus Custom Claims */
  role?: string;

  /** Alle Custom Claims */
  claims: Record<string, unknown>;
}

/**
 * Request mit authentifiziertem User.
 * Wird von requireAuth Middleware gesetzt.
 */
export interface AuthenticatedRequest {
  user: AuthUser;
}

/**
 * Fehler bei der Authentifizierung.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Auth-Fehlercodes.
 */
export type AuthErrorCode =
  | 'NO_TOKEN'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'USER_DISABLED'
  | 'USER_NOT_FOUND';

