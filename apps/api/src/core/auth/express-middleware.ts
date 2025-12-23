/**
 * Express Auth Middleware
 *
 * Middleware für authentifizierte Express-Routen.
 */

import type { Request, Response, NextFunction } from 'express';
import { authenticateRequest } from './middleware';
import type { AuthUser } from './types';

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

