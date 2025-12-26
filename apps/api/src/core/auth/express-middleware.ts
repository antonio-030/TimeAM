/**
 * Express Auth Middleware
 *
 * Middleware für authentifizierte Express-Routen.
 */

import type { Request, Response, NextFunction } from 'express';
import { authenticateRequest } from './middleware.js';
import { extractTokenFromHeader, verifyIdToken } from './verify-token.js';
import type { AuthUser } from './types.js';

/**
 * Express Request mit Auth-Informationen.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/**
 * Express Middleware: Erfordert gültige Authentifizierung.
 *
 * Verifiziert den Bearer Token und hängt User-Informationen an den Request.
 *
 * @example
 * app.get('/api/me', requireAuth, (req, res) => {
 *   res.json({ user: req.user });
 * });
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await authenticateRequest(req.headers.authorization);

  if (!result.success) {
    res.status(result.error.statusCode).json({
      error: result.error.message,
      code: result.error.code,
    });
    return;
  }

  // User an Request hängen
  (req as AuthenticatedRequest).user = result.user;
  
  // Token-Issue-Datum (iat) für MFA-Session-Prüfung speichern
  // Dies wird verwendet, um zu prüfen, ob es eine neue Session ist
  const token = extractTokenFromHeader(req.headers.authorization);
  if (token) {
    try {
      const decodedToken = await verifyIdToken(token);
      // iat (issued at) ist in Sekunden, nicht Millisekunden
      (req as any).tokenIssuedAt = decodedToken.iat;
    } catch {
      // Fehler ignorieren, Token wurde bereits verifiziert
    }
  }

  next();
}

/**
 * Express Middleware: Optionale Authentifizierung.
 *
 * Verifiziert Token falls vorhanden, aber lässt auch nicht-authentifizierte Requests durch.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const result = await authenticateRequest(authHeader);

  if (result.success) {
    (req as AuthenticatedRequest).user = result.user;
  }

  next();
}

