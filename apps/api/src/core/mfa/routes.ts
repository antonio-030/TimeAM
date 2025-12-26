/**
 * MFA Routes
 *
 * API-Endpunkte für Multi-Factor Authentication.
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../auth/index.js';
import { requireEntitlementsOrFreelancer, ENTITLEMENT_KEYS } from '../entitlements/index.js';
import {
  generateMfaSecret,
  saveMfaSecret,
  enableMfa,
  disableMfa,
  getMfaSecret,
  isMfaEnabled,
  isMfaSetupInProgress,
  verifyMfaCode,
  generateBackupCodes,
  verifyBackupCode,
  encrypt,
} from './service.js';
import { getAdminAuth } from '../firebase/index.js';
import type {
  MfaSetupResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
  MfaStatusResponse,
  MfaDisableRequest,
} from '@timeam/shared';

export const mfaRouter = Router();

// Alle MFA-Routes erfordern Auth + MFA Entitlement
const mfaGuard = [
  requireAuth,
  requireEntitlementsOrFreelancer([ENTITLEMENT_KEYS.MODULE_MFA]),
];

/**
 * GET /api/mfa/status
 *
 * Gibt den MFA-Status des aktuellen Users zurück.
 */
mfaRouter.get('/status', ...mfaGuard, async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;

  try {
    const enabled = await isMfaEnabled(user.uid);
    const setupInProgress = await isMfaSetupInProgress(user.uid);

    const response: MfaStatusResponse = {
      enabled,
      setupInProgress: setupInProgress || undefined,
    };

    res.json(response);
  } catch (error) {
    console.error('Error in GET /api/mfa/status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/mfa/status/:memberId
 *
 * Gibt den MFA-Status eines anderen Mitarbeiters zurück.
 * 
 * WICHTIG: 
 * - Nur Admins und Manager können den MFA-Status anderer Mitarbeiter abrufen
 * - Kann NICHT für Freelancer verwendet werden
 */
mfaRouter.get('/status/:memberId', requireAuth, async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { memberId } = req.params;

  try {
    // Prüfen, ob User Admin oder Manager ist
    const { getTenantForUser } = await import('../tenancy/index.js');
    const tenantData = await getTenantForUser(user.uid);
    
    if (!tenantData) {
      return res.status(403).json({ 
        error: 'No tenant membership',
        code: 'NO_TENANT'
      });
    }

    const role = tenantData.member.role;
    
    // Nur Admins und Manager können MFA-Status abrufen
    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ 
        error: 'Only admins and managers can view MFA status of other members',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Prüfen, ob Ziel-User im gleichen Tenant ist
    const targetTenantData = await getTenantForUser(memberId);
    
    if (!targetTenantData || targetTenantData.tenant.id !== tenantData.tenant.id) {
      return res.status(404).json({ 
        error: 'Member not found in your tenant',
        code: 'MEMBER_NOT_FOUND'
      });
    }

    // Prüfen, ob Ziel-User ein Freelancer ist
    const db = (await import('../firebase/index.js')).getAdminFirestore();
    const targetUserDoc = await db.collection('users').doc(memberId).get();
    const targetUserData = targetUserDoc.data();
    const isTargetFreelancer = targetUserData?.isFreelancer === true;

    // Kann nicht für Freelancer verwendet werden
    if (isTargetFreelancer) {
      return res.status(403).json({ 
        error: 'Cannot view MFA status for freelancers',
        code: 'CANNOT_VIEW_FREELANCER_MFA'
      });
    }

    // MFA-Status abrufen
    const enabled = await isMfaEnabled(memberId);
    const setupInProgress = await isMfaSetupInProgress(memberId);

    const response: MfaStatusResponse = {
      enabled,
      setupInProgress: setupInProgress || undefined,
    };

    res.json(response);
  } catch (error) {
    console.error('Error in GET /api/mfa/status/:memberId:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * POST /api/mfa/setup
 *
 * Startet MFA-Setup und gibt QR-Code zurück.
 */
mfaRouter.post('/setup', ...mfaGuard, async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Prüfen ob MFA bereits aktiviert ist
    const alreadyEnabled = await isMfaEnabled(user.uid);
    if (alreadyEnabled) {
      return res.status(400).json({ error: 'MFA is already enabled' });
    }

    // Prüfen ob Setup bereits in Progress ist
    const setupInProgress = await isMfaSetupInProgress(user.uid);
    if (setupInProgress) {
      // Secret bereits vorhanden - QR-Code neu generieren
      const secret = await getMfaSecret(user.uid);
      if (!secret) {
        return res.status(500).json({ error: 'Setup in progress but secret not found' });
      }

      // QR-Code neu generieren (Secret bleibt gleich)
      const otpAuthUrl = (await import('otplib')).authenticator.keyuri(
        user.email || '',
        'TimeAM',
        secret
      );
      const QRCode = (await import('qrcode')).default;
      const qrCode = await QRCode.toDataURL(otpAuthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
      });

      // Backup-Codes aus Firestore holen (falls vorhanden)
      const db = (await import('../firebase/index.js')).getAdminFirestore();
      const userDoc = await db.collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      
      // Backup-Codes entschlüsseln (falls vorhanden)
      let backupCodes: string[] = [];
      if (userData?.mfaBackupCodes && Array.isArray(userData.mfaBackupCodes)) {
        const { decrypt } = await import('./service.js');
        try {
          backupCodes = userData.mfaBackupCodes.map((encrypted: string) => {
            try {
              return decrypt(encrypted);
            } catch {
              return '';
            }
          }).filter(code => code !== '');
        } catch (err) {
          // Falls Entschlüsselung fehlschlägt, neue Codes generieren
          backupCodes = generateBackupCodes();
          const encryptedBackupCodes = backupCodes.map(code => encrypt(code));
          await db.collection('users').doc(user.uid).update({
            mfaBackupCodes: encryptedBackupCodes,
          });
        }
      } else {
        // Neue Backup-Codes generieren
        backupCodes = generateBackupCodes();
        const encryptedBackupCodes = backupCodes.map(code => encrypt(code));
        await db.collection('users').doc(user.uid).update({
          mfaBackupCodes: encryptedBackupCodes,
        });
      }

      const response: MfaSetupResponse = {
        qrCode,
        secret,
        backupCodes,
      };

      return res.json(response);
    }

    // Neues Setup starten
    if (!user.email) {
      return res.status(400).json({ error: 'Email is required for MFA setup' });
    }

    const { secret, qrCode } = await generateMfaSecret(user.uid, user.email);
    const backupCodes = generateBackupCodes();

    // Secret und Backup-Codes speichern
    await saveMfaSecret(user.uid, secret, backupCodes);

    const response: MfaSetupResponse = {
      qrCode,
      secret,
      backupCodes,
    };

    res.json(response);
  } catch (error) {
    console.error('Error in POST /api/mfa/setup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/mfa/verify-setup
 *
 * Verifiziert Setup-Code und aktiviert MFA.
 */
mfaRouter.post('/verify-setup', ...mfaGuard, async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { code } = req.body as MfaVerifyRequest;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Code is required' });
  }

  try {
    // Prüfen ob Setup in Progress ist
    const setupInProgress = await isMfaSetupInProgress(user.uid);
    if (!setupInProgress) {
      return res.status(400).json({ error: 'No MFA setup in progress' });
    }

    // Secret holen
    const secret = await getMfaSecret(user.uid);
    if (!secret) {
      return res.status(400).json({ error: 'MFA secret not found' });
    }

    // Code verifizieren
    const isValid = verifyMfaCode(secret, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    // MFA aktivieren
    await enableMfa(user.uid);

    const response: MfaVerifyResponse = {
      verified: true,
    };

    res.json(response);
  } catch (error) {
    console.error('Error in POST /api/mfa/verify-setup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/mfa/verify
 *
 * Verifiziert MFA-Code beim Login.
 * 
 * Hinweis: Diese Route erfordert KEIN Entitlement, da sie beim Login verwendet wird,
 * bevor der Tenant-Kontext vollständig geladen ist. Die MFA-Verifizierung erfolgt
 * nur, wenn MFA bereits aktiviert wurde (was das Entitlement erfordert).
 */
mfaRouter.post('/verify', requireAuth, async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { code } = req.body as MfaVerifyRequest;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Code is required' });
  }

  try {
    // Prüfen ob MFA aktiviert ist
    const enabled = await isMfaEnabled(user.uid);
    if (!enabled) {
      return res.status(400).json({ error: 'MFA is not enabled' });
    }

    // Secret holen
    let secret: string | null = null;
    try {
      secret = await getMfaSecret(user.uid);
    } catch (secretError) {
      console.error('Error getting MFA secret:', secretError);
      const errorMessage = secretError instanceof Error ? secretError.message : 'Unknown error';
      
      // WICHTIG: Bei korrupten Secrets wird MFA NICHT automatisch zurückgesetzt!
      // Dies wäre ein Sicherheitsrisiko. Stattdessen wird der Login blockiert.
      if (errorMessage.includes('corrupted')) {
        return res.status(403).json({ 
          error: 'MFA secret is corrupted. Please contact support to reset MFA.',
          code: 'MFA_SECRET_CORRUPTED',
          requiresSupport: true
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to retrieve MFA secret',
        details: errorMessage
      });
    }
    
    if (!secret) {
      // Secret nicht gefunden - MFA ist nicht aktiviert oder wurde nie eingerichtet
      return res.status(400).json({ 
        error: 'MFA secret not found. Please set up MFA first.',
        code: 'MFA_SECRET_NOT_FOUND',
        requiresNewSetup: true
      });
    }

    // Code verifizieren (TOTP oder Backup-Code)
    let isValidTOTP = false;
    let isValidBackup = false;
    
    try {
      isValidTOTP = verifyMfaCode(secret, code);
    } catch (totpError) {
      console.error('Error verifying TOTP code:', totpError);
      // Weiter mit Backup-Code-Prüfung
    }
    
    try {
      isValidBackup = await verifyBackupCode(user.uid, code);
    } catch (backupError) {
      console.error('Error verifying backup code:', backupError);
      // Weiter mit Fehlerbehandlung
    }

    if (!isValidTOTP && !isValidBackup) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    // Nach erfolgreicher Verifizierung: mfaSetupInProgress temporär auf true setzen
    // UND mfaVerifiedAt (Timestamp der Verifizierung) speichern
    // Damit wird mfaRequired auf false gesetzt (mfaRequired = mfaEnabled && !mfaSetupInProgress)
    // Dies markiert, dass MFA für diese Session verifiziert wurde
    // WICHTIG: mfaSetupInProgress wird beim nächsten /api/me Call wieder auf false zurückgesetzt,
    // wenn das Token nach der Verifizierung ausgestellt wurde (neue Session)
    try {
      const db = (await import('../firebase/index.js')).getAdminFirestore();
      const now = Math.floor(Date.now() / 1000); // Unix Timestamp in Sekunden
      await db.collection('users').doc(user.uid).update({
        mfaSetupInProgress: true, // Temporär auf true, damit mfaRequired = false wird
        mfaVerifiedAt: now, // Timestamp der Verifizierung für Session-Prüfung
      });
    } catch (updateError) {
      console.error('Error updating mfaSetupInProgress:', updateError);
      // Trotzdem Erfolg zurückgeben, da Code verifiziert wurde
    }

    const response: MfaVerifyResponse = {
      verified: true,
    };

    res.json(response);
  } catch (error) {
    console.error('Error in POST /api/mfa/verify:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

/**
 * POST /api/mfa/disable
 *
 * Deaktiviert MFA für den aktuellen User.
 * 
 * WICHTIG: 
 * - Nur normale Mitarbeiter (employee) können ihr eigenes MFA deaktivieren
 * - Admins und Manager können ihr eigenes MFA NICHT selbst deaktivieren (Sicherheit)
 * - Freelancer können ihr eigenes MFA NICHT selbst deaktivieren (Sicherheit)
 * - MFA muss bereits verifiziert sein (User muss eingeloggt sein)
 */
mfaRouter.post('/disable', ...mfaGuard, async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Prüfen ob MFA aktiviert ist
    const enabled = await isMfaEnabled(user.uid);
    if (!enabled) {
      return res.status(400).json({ error: 'MFA is not enabled' });
    }

    // WICHTIG: Prüfen, ob MFA bereits verifiziert wurde
    // Wenn nicht, kann der User MFA nicht deaktivieren
    const setupInProgress = await isMfaSetupInProgress(user.uid);
    if (!setupInProgress) {
      return res.status(403).json({ 
        error: 'MFA verification required before disabling MFA',
        code: 'MFA_VERIFICATION_REQUIRED'
      });
    }

    // Prüfen, ob User ein Freelancer ist
    const db = (await import('../firebase/index.js')).getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    const isFreelancer = userData?.isFreelancer === true;

    // Freelancer können ihr eigenes MFA NICHT selbst deaktivieren
    if (isFreelancer) {
      return res.status(403).json({ 
        error: 'Freelancers cannot disable their own MFA. Please contact support.',
        code: 'MFA_DISABLE_NOT_ALLOWED'
      });
    }

    // Prüfen, ob User Admin oder Manager ist
    const { getTenantForUser } = await import('../tenancy/index.js');
    const tenantData = await getTenantForUser(user.uid);
    
    if (tenantData) {
      const role = tenantData.member.role;
      
      // Admins und Manager können ihr eigenes MFA NICHT selbst deaktivieren
      if (role === 'admin' || role === 'manager') {
        return res.status(403).json({ 
          error: 'Admins and managers cannot disable their own MFA. Please contact support or use the admin reset function.',
          code: 'MFA_DISABLE_NOT_ALLOWED'
        });
      }
    }

    // Nur normale Mitarbeiter (employee) können ihr eigenes MFA deaktivieren
    // MFA deaktivieren
    await disableMfa(user.uid);

    res.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/mfa/disable:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * POST /api/mfa/reset/:memberId
 *
 * Setzt MFA für einen anderen Mitarbeiter zurück.
 * 
 * WICHTIG: 
 * - Nur Admins und Manager können MFA für andere Mitarbeiter zurücksetzen
 * - Kann NICHT für sich selbst verwendet werden (Sicherheit)
 * - Kann NICHT für Freelancer verwendet werden
 */
mfaRouter.post('/reset/:memberId', requireAuth, async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;
  const { memberId } = req.params;

  try {
    // Prüfen, ob User Admin oder Manager ist
    const { getTenantForUser } = await import('../tenancy/index.js');
    const tenantData = await getTenantForUser(user.uid);
    
    if (!tenantData) {
      return res.status(403).json({ 
        error: 'No tenant membership',
        code: 'NO_TENANT'
      });
    }

    const role = tenantData.member.role;
    
    // Nur Admins und Manager können MFA zurücksetzen
    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ 
        error: 'Only admins and managers can reset MFA for other members',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Kann nicht für sich selbst verwendet werden
    if (user.uid === memberId) {
      return res.status(403).json({ 
        error: 'Cannot reset your own MFA. Please contact support.',
        code: 'CANNOT_RESET_OWN_MFA'
      });
    }

    // Prüfen, ob Ziel-User im gleichen Tenant ist
    const targetTenantData = await getTenantForUser(memberId);
    
    if (!targetTenantData || targetTenantData.tenant.id !== tenantData.tenant.id) {
      return res.status(404).json({ 
        error: 'Member not found in your tenant',
        code: 'MEMBER_NOT_FOUND'
      });
    }

    // Prüfen, ob Ziel-User ein Freelancer ist
    const db = (await import('../firebase/index.js')).getAdminFirestore();
    const targetUserDoc = await db.collection('users').doc(memberId).get();
    const targetUserData = targetUserDoc.data();
    const isTargetFreelancer = targetUserData?.isFreelancer === true;

    // Kann nicht für Freelancer verwendet werden
    if (isTargetFreelancer) {
      return res.status(403).json({ 
        error: 'Cannot reset MFA for freelancers',
        code: 'CANNOT_RESET_FREELANCER_MFA'
      });
    }

    // MFA zurücksetzen
    await disableMfa(memberId);

    res.json({ 
      success: true,
      message: 'MFA has been reset for the member'
    });
  } catch (error) {
    console.error('Error in POST /api/mfa/reset/:memberId:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: errorMessage });
  }
});

