/**
 * Super-Admin Module
 *
 * Plattform-Betreiber (CEO/Developer) können alle Tenants und Module verwalten.
 * Super-Admins werden über UIDs in der Umgebungsvariable SUPER_ADMIN_UIDS konfiguriert.
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth';

/**
 * Lädt die Super-Admin UIDs aus der Umgebungsvariable.
 * Format: Komma-separierte Liste von Firebase Auth UIDs
 * Beispiel: SUPER_ADMIN_UIDS=uid1,uid2,uid3
 */
export function getSuperAdminUids(): string[] {
  const uidsString = process.env.SUPER_ADMIN_UIDS || '';
  return uidsString
    .split(',')
    .map(uid => uid.trim())
    .filter(uid => uid.length > 0);
}

/**
 * Prüft, ob ein User ein Super-Admin ist.
 */
export function isSuperAdmin(uid: string): boolean {
  const superAdminUids = getSuperAdminUids();
  return superAdminUids.includes(uid);
}

/**
 * Middleware: Erfordert Super-Admin-Rechte.
 * Muss NACH requireAuth verwendet werden.
 */
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (!isSuperAdmin(authReq.user.uid)) {
    res.status(403).json({
      error: 'Super-Admin access required',
      code: 'SUPER_ADMIN_REQUIRED',
    });
    return;
  }

  next();
}

export type { AuthenticatedRequest };
