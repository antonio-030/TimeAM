/**
 * MFA Middleware
 *
 * Middleware, die prüft, ob MFA verifiziert wurde, wenn MFA aktiviert ist.
 * Blockiert alle API-Requests, wenn MFA erforderlich aber nicht verifiziert wurde.
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth/index.js';
import { isMfaEnabled, isMfaSetupInProgress } from './service.js';
import { getTenantForUser } from '../tenancy/index.js';
import { ENTITLEMENT_KEYS } from '../entitlements/types.js';
import { isSuperAdmin } from '../super-admin/index.js';

/**
 * Pfade, die auch ohne MFA-Verifizierung zugänglich sein sollen.
 */
const ALLOWED_WITHOUT_MFA_VERIFICATION = [
  '/api/me', // Benötigt für MFA-Status-Prüfung
  '/api/mfa/verify', // MFA-Verifizierungs-Endpoint
  '/api/mfa/status', // MFA-Status-Endpoint
  '/api/onboarding/create-tenant', // Onboarding sollte auch ohne MFA möglich sein
];

/**
 * Middleware: Prüft, ob MFA verifiziert wurde, wenn MFA aktiviert ist.
 *
 * Blockiert alle API-Requests mit 403 Forbidden, wenn:
 * - MFA aktiviert ist (mfaEnabled = true)
 * - MFA nicht verifiziert wurde (mfaSetupInProgress = false)
 *
 * Ausnahmen:
 * - `/api/me` - Benötigt für MFA-Status-Prüfung
 * - `/api/mfa/verify` - MFA-Verifizierungs-Endpoint
 * - `/api/mfa/status` - MFA-Status-Endpoint
 * - `/api/onboarding/create-tenant` - Onboarding
 */
export async function requireMfaVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Nur für authentifizierte Requests
  if (!('user' in req)) {
    next();
    return;
  }

  const { user } = req as AuthenticatedRequest;
  const path = req.path;

  // Ausnahmen: Diese Pfade sind auch ohne MFA-Verifizierung zugänglich
  if (ALLOWED_WITHOUT_MFA_VERIFICATION.some(allowed => path.startsWith(allowed))) {
    next();
    return;
  }

  try {
    // WICHTIG: SUPER_ADMINs können MFA nur umgehen, wenn das Secret korrupt ist (Notfall-Zugang)
    // Wenn MFA aktiviert ist und das Secret korrekt ist, muss auch der SUPER_ADMIN MFA verifizieren
    if (isSuperAdmin(user.uid)) {
      // Prüfen, ob MFA aktiviert ist
      const mfaEnabled = await isMfaEnabled(user.uid);
      
      if (mfaEnabled) {
        // Versuche, das Secret zu holen - wenn es korrupt ist, wird ein Fehler geworfen
        try {
          const { getMfaSecret } = await import('./service.js');
          const secret = await getMfaSecret(user.uid);
          
          // Wenn Secret vorhanden und nicht null, ist es korrekt → MFA-Verifizierung erforderlich
          if (secret !== null) {
            // Secret ist korrekt, prüfe ob MFA verifiziert wurde
            const mfaSetupInProgress = await isMfaSetupInProgress(user.uid);
            
            if (!mfaSetupInProgress) {
              res.status(403).json({
                error: 'MFA verification required',
                code: 'MFA_REQUIRED',
                mfaRequired: true,
              });
              return;
            }
            // MFA ist verifiziert → Request durchlassen
            next();
            return;
          }
          // Wenn secret === null, wurde MFA zurückgesetzt (korruptes Secret) → Bypass aktivieren
          console.log(`⚠️ SUPER_ADMIN ${user.uid} umgeht MFA-Verifizierung (MFA zurückgesetzt - Notfall-Zugang)`);
          next();
          return;
        } catch (secretError) {
          // Secret ist korrupt → Bypass aktivieren (Notfall-Zugang)
          const errorMessage = secretError instanceof Error ? secretError.message : 'Unknown error';
          if (errorMessage.includes('corrupted')) {
            console.log(`⚠️ SUPER_ADMIN ${user.uid} umgeht MFA-Verifizierung (korruptes Secret - Notfall-Zugang)`);
            next();
            return;
          }
          // Anderer Fehler → weiter mit normaler Prüfung
        }
      }
      // Wenn MFA nicht aktiviert ist, Request durchlassen
    }

    // Tenant-Daten laden, um Entitlements zu prüfen
    const tenantData = await getTenantForUser(user.uid);
    
    // Wenn kein Tenant vorhanden (z.B. während Onboarding), Request durchlassen
    if (!tenantData) {
      next();
      return;
    }
    
    // Prüfen, ob MFA-Modul aktiviert ist
    // Für Freelancer: Entitlements aus getFreelancerEntitlements verwenden
    let hasMfaEntitlement = tenantData?.entitlements?.[ENTITLEMENT_KEYS.MODULE_MFA] === true;
    
    // Wenn nicht im Tenant-Entitlements, prüfe Freelancer-Entitlements
    if (!hasMfaEntitlement) {
      const db = (await import('../firebase/index.js')).getAdminFirestore();
      const userDoc = await db.collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      const isFreelancer = userData?.isFreelancer === true;
      
      if (isFreelancer) {
        const { getFreelancerEntitlements } = await import('../tenancy/index.js');
        const freelancerEntitlements = await getFreelancerEntitlements(user.uid);
        hasMfaEntitlement = freelancerEntitlements?.[ENTITLEMENT_KEYS.MODULE_MFA] === true;
      }
    }
    
    // Wenn MFA-Modul nicht aktiviert ist, Request durchlassen
    if (!hasMfaEntitlement) {
      next();
      return;
    }

    // Prüfen, ob MFA aktiviert ist
    const mfaEnabled = await isMfaEnabled(user.uid);
    
    // Wenn MFA nicht aktiviert ist, Request durchlassen
    if (!mfaEnabled) {
      next();
      return;
    }

    // Prüfen, ob MFA verifiziert wurde (mfaSetupInProgress = true bedeutet, dass MFA für diese Session verifiziert wurde)
    const mfaSetupInProgress = await isMfaSetupInProgress(user.uid);
    
    // Wenn MFA nicht verifiziert wurde, Request blockieren
    if (!mfaSetupInProgress) {
      res.status(403).json({
        error: 'MFA verification required',
        code: 'MFA_REQUIRED',
        mfaRequired: true,
      });
      return;
    }

    // MFA ist aktiviert und verifiziert → Request durchlassen
    next();
  } catch (error) {
    console.error('Error in requireMfaVerification middleware:', error);
    // Bei Fehler Request blockieren (fail-closed für Sicherheit)
    // Wenn MFA aktiviert ist, aber die Prüfung fehlschlägt, sollte der User nicht zugreifen können
    res.status(500).json({
      error: 'MFA verification check failed',
      code: 'MFA_CHECK_ERROR',
      mfaRequired: true,
    });
    return;
  }
}

