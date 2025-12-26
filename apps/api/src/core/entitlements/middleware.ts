/**
 * Entitlement Middleware
 *
 * Express Middleware für Entitlement-basierte Zugriffskontrolle.
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth/index.js';
import { getTenantForUser, getFreelancerEntitlements } from '../tenancy/index.js';
import { getAdminFirestore } from '../firebase/index.js';
import { type EntitlementKey } from './types.js';

/**
 * Request mit Tenant-Kontext.
 */
export interface TenantRequest extends AuthenticatedRequest {
  tenant: {
    id: string;
    name: string;
  };
  entitlements: Record<string, boolean | string | number>;
}

/**
 * Middleware Factory: Erfordert bestimmte Entitlements.
 *
 * @param requiredEntitlements - Liste der benötigten Entitlement-Keys
 *
 * @example
 * app.get('/api/time-tracking/entries',
 *   requireAuth,
 *   requireEntitlements(['module.time_tracking']),
 *   handler
 * );
 */
export function requireEntitlements(requiredEntitlements: EntitlementKey[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    try {
      // Tenant-Daten laden
      let tenantData = await getTenantForUser(authReq.user.uid);

      // WICHTIG: Wenn kein Tenant gefunden und User ist Super Admin, Dev-Tenant erstellen/zuordnen
      if (!tenantData) {
        const { isSuperAdmin } = await import('../super-admin/index.js');
        const isSuper = isSuperAdmin(authReq.user.uid);
        
        if (isSuper) {
          const { getOrCreateDevTenant, assignDevStaffToTenant } = await import('../../modules/support/service.js');
          
          const tenantId = await getOrCreateDevTenant(authReq.user.uid);
          await assignDevStaffToTenant(authReq.user.uid, authReq.user.email || '');
          
          // Kurz warten, damit Firestore die Änderungen propagiert
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Nochmal versuchen
          tenantData = await getTenantForUser(authReq.user.uid);
        }
      }

      if (!tenantData) {
        res.status(403).json({
          error: 'No tenant membership',
          code: 'NO_TENANT',
        });
        return;
      }

      // Entitlements prüfen
      const missingEntitlements: string[] = [];

      for (const key of requiredEntitlements) {
        const value = tenantData.entitlements[key];
        const hasEntitlement = value === true ||
          (typeof value === 'string' && value !== '') ||
          (typeof value === 'number' && value > 0);

        if (!hasEntitlement) {
          missingEntitlements.push(key);
        }
      }

      if (missingEntitlements.length > 0) {
        res.status(403).json({
          error: `Missing entitlements: ${missingEntitlements.join(', ')}`,
          code: 'MISSING_ENTITLEMENT',
          missingEntitlements,
        });
        return;
      }

      // Tenant-Kontext an Request hängen
      (req as TenantRequest).tenant = {
        id: tenantData.tenant.id,
        name: tenantData.tenant.name,
      };
      (req as TenantRequest).entitlements = tenantData.entitlements;

      // Tenant context set

      next();
    } catch (error) {
      console.error('Error in requireEntitlements:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: message, details: String(error) });
    }
  };
}

/**
 * Prüft, ob ein Entitlement aktiv ist.
 */
export function hasEntitlement(
  entitlements: Record<string, boolean | string | number>,
  key: string
): boolean {
  const value = entitlements[key];
  return value === true ||
    (typeof value === 'string' && value !== '') ||
    (typeof value === 'number' && value > 0);
}

/**
 * Middleware: Nur Tenant-Zugehörigkeit prüfen (ohne Entitlement-Check).
 * Für Core-Module wie den Kalender, die immer verfügbar sein sollen.
 */
export function requireTenantOnly() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    try {
      // Tenant-Daten laden
      let tenantData = await getTenantForUser(authReq.user.uid);

      // WICHTIG: Wenn kein Tenant gefunden und User ist Super Admin, Dev-Tenant erstellen/zuordnen
      if (!tenantData) {
        const { isSuperAdmin } = await import('../super-admin/index.js');
        const isSuper = isSuperAdmin(authReq.user.uid);
        
        if (isSuper) {
          const { getOrCreateDevTenant, assignDevStaffToTenant } = await import('../../modules/support/service.js');
          
          const tenantId = await getOrCreateDevTenant(authReq.user.uid);
          await assignDevStaffToTenant(authReq.user.uid, authReq.user.email || '');
          
          // Kurz warten, damit Firestore die Änderungen propagiert
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Nochmal versuchen
          tenantData = await getTenantForUser(authReq.user.uid);
        }
      }

      if (!tenantData) {
        res.status(403).json({
          error: 'No tenant membership',
          code: 'NO_TENANT',
        });
        return;
      }

      // Tenant-Kontext an Request hängen (ohne Entitlement-Check)
      (req as TenantRequest).tenant = {
        id: tenantData.tenant.id,
        name: tenantData.tenant.name,
      };
      (req as TenantRequest).entitlements = tenantData.entitlements;

      next();
    } catch (error) {
      console.error('Error in requireTenantOnly:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: message, details: String(error) });
    }
  };
}

/**
 * Middleware Factory: Erfordert bestimmte Entitlements (für Tenant oder Freelancer).
 * Prüft zuerst Tenant-Entitlements, dann Freelancer-Entitlements.
 *
 * @param requiredEntitlements - Liste der benötigten Entitlement-Keys
 */
export function requireEntitlementsOrFreelancer(requiredEntitlements: EntitlementKey[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    try {
      // Prüfe ob User ein Freelancer ist
      const db = getAdminFirestore();
      const userDoc = await db.collection('users').doc(authReq.user.uid).get();
      const userData = userDoc.data();
      const isFreelancer = userData?.isFreelancer === true;

      let entitlements: Record<string, boolean | string | number> = {};
      let tenant: { id: string; name: string } | null = null;

      if (isFreelancer) {
        // Freelancer: Entitlements aus Freelancer-Dokument laden
        entitlements = await getFreelancerEntitlements(authReq.user.uid);
        
        // Tenant-Daten für Freelancer laden (Freelancer haben auch einen Tenant)
        const tenantData = await getTenantForUser(authReq.user.uid);
        if (tenantData) {
          tenant = {
            id: tenantData.tenant.id,
            name: tenantData.tenant.name,
          };
        }
      } else {
        // Normale User: Tenant-Daten laden
        const tenantData = await getTenantForUser(authReq.user.uid);
        
        if (!tenantData) {
          res.status(403).json({
            error: 'No tenant membership',
            code: 'NO_TENANT',
          });
          return;
        }

        tenant = {
          id: tenantData.tenant.id,
          name: tenantData.tenant.name,
        };
        entitlements = tenantData.entitlements;
      }

      // Entitlements prüfen
      const missingEntitlements: string[] = [];

      for (const key of requiredEntitlements) {
        const value = entitlements[key];
        const hasEntitlement = value === true ||
          (typeof value === 'string' && value !== '') ||
          (typeof value === 'number' && value > 0);

        if (!hasEntitlement) {
          missingEntitlements.push(key);
        }
      }

      if (missingEntitlements.length > 0) {
        res.status(403).json({
          error: `Missing entitlements: ${missingEntitlements.join(', ')}`,
          code: 'MISSING_ENTITLEMENT',
          missingEntitlements,
        });
        return;
      }

      // Tenant-Kontext an Request hängen
      if (tenant) {
        (req as TenantRequest).tenant = tenant;
        (req as TenantRequest).entitlements = entitlements;
      }

      next();
    } catch (error) {
      console.error('Error in requireEntitlementsOrFreelancer:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: message, details: String(error) });
    }
  };
}

