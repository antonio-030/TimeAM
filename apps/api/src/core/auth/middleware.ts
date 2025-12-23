/**
 * Auth Middleware
 *
 * Middleware für authentifizierte Routen.
 * Framework-agnostisch vorbereitet (Express/Fastify/etc.).
 */

import {
  verifyIdToken,
  extractAuthUser,
  extractTokenFromHeader,
} from './verify-token';
import { AuthError, type AuthUser } from './types';

/**
 * Ergebnis der Auth-Prüfung.
 */
export type AuthResult =
  | { success: true; user: AuthUser }
  | { success: false; error: AuthError };

/**
 * Prüft einen Request auf gültige Authentifizierung.
 *
 * Framework-agnostisch: Nimmt nur den Authorization Header entgegen.
 * Die eigentliche Middleware-Integration erfolgt je nach Framework.
 *
 * @param authorizationHeader - Der Authorization Header
 * @returns AuthResult mit User oder Fehler
 *
 * @example
 * // Express Middleware
 * async function requireAuth(req, res, next) {
 *   const result = await authenticateRequest(req.headers.authorization);
 *   if (!result.success) {
 *     return res.status(result.error.statusCode).json({ error: result.error.message });
 *   }
 *   req.user = result.user;
 *   next();
 * }
 */
export async function authenticateRequest(
  authorizationHeader: string | undefined
): Promise<AuthResult> {
  // Token extrahieren
  const token = extractTokenFromHeader(authorizationHeader);

  if (!token) {
    return {
      success: false,
      error: new AuthError(
        'No authorization token provided',
        'NO_TOKEN'
      ),
    };
  }

  try {
    // Token verifizieren
    const decodedToken = await verifyIdToken(token);

    // User extrahieren
    const user = extractAuthUser(decodedToken);

    return { success: true, user };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error };
    }

    return {
      success: false,
      error: new AuthError('Authentication failed', 'INVALID_TOKEN'),
    };
  }
}

/**
 * Typ-Guard: Prüft, ob ein Request authentifiziert ist.
 */
export function isAuthenticated(
  result: AuthResult
): result is { success: true; user: AuthUser } {
  return result.success;
}

