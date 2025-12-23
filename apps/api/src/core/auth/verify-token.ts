/**
 * Token Verification
 *
 * Verifiziert Firebase ID Tokens mit dem Admin SDK.
 */

import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from '../firebase';
import { AuthError, type AuthUser } from './types';

/**
 * Verifiziert einen Firebase ID Token.
 *
 * @param token - Der ID Token aus dem Authorization Header
 * @returns Dekodierter Token mit User-Informationen
 * @throws AuthError bei ungültigem Token
 */
export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token, true);
    return decodedToken;
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };

    if (firebaseError.code === 'auth/id-token-expired') {
      throw new AuthError('Token expired', 'TOKEN_EXPIRED');
    }

    if (firebaseError.code === 'auth/id-token-revoked') {
      throw new AuthError('Token revoked', 'INVALID_TOKEN');
    }

    if (firebaseError.code === 'auth/user-disabled') {
      throw new AuthError('User disabled', 'USER_DISABLED', 403);
    }

    if (firebaseError.code === 'auth/user-not-found') {
      throw new AuthError('User not found', 'USER_NOT_FOUND');
    }

    throw new AuthError(
      firebaseError.message || 'Invalid token',
      'INVALID_TOKEN'
    );
  }
}

/**
 * Extrahiert User-Informationen aus einem dekodierten Token.
 */
export function extractAuthUser(decodedToken: DecodedIdToken): AuthUser {
  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    emailVerified: decodedToken.email_verified ?? false,
    tenantId: decodedToken.tenantId as string | undefined,
    role: decodedToken.role as string | undefined,
    claims: { ...decodedToken },
  };
}

/**
 * Extrahiert den Token aus dem Authorization Header.
 *
 * @param authHeader - Der Authorization Header (z.B. "Bearer xxx")
 * @returns Der Token oder null
 */
export function extractTokenFromHeader(
  authHeader: string | undefined
): string | null {
  if (!authHeader) {
    return null;
  }

  // Format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

