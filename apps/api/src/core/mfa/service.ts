/**
 * MFA Service
 *
 * Service für Multi-Factor Authentication mit TOTP.
 */

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { getAdminFirestore } from '../firebase/index.js';
import crypto from 'crypto';

// TOTP-Konfiguration
const TOTP_ISSUER = 'TimeAM';
const TOTP_WINDOW = 2; // Erlaubt ±2 Zeitfenster für Clock-Skew

// Verschlüsselungs-Key (in Production aus Environment Variable)
// aes-256-gcm benötigt 32 Bytes (64 hex-Zeichen)
// WICHTIG: Lazy initialization, da .env beim Modul-Import noch nicht geladen ist
let ENCRYPTION_KEY: Buffer | null = null;

const getEncryptionKey = (): Buffer => {
  // Cache den Key nach der ersten Initialisierung
  if (ENCRYPTION_KEY !== null) {
    return ENCRYPTION_KEY;
  }

  if (process.env.MFA_ENCRYPTION_KEY) {
    // Environment Variable: Erwartet 64 hex-Zeichen (32 Bytes)
    // WICHTIG: trim() entfernt Whitespace, aber prüfe auch auf Zeilenumbrüche
    let keyHex = process.env.MFA_ENCRYPTION_KEY.trim();
    // Entferne alle Zeilenumbrüche und zusätzliche Whitespace
    keyHex = keyHex.replace(/\s+/g, '');
    
    if (keyHex.length < 64) {
      console.error(`❌ MFA_ENCRYPTION_KEY is too short: ${keyHex.length} characters (expected 64)`);
      console.error(`Key (first 20 chars): ${keyHex.substring(0, 20)}...`);
      throw new Error(`MFA_ENCRYPTION_KEY must be at least 64 hex characters (32 bytes), got ${keyHex.length}`);
    }
    
    // Validiere, dass es nur hex-Zeichen sind
    if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
      console.error(`❌ MFA_ENCRYPTION_KEY contains invalid characters (must be hex only)`);
      throw new Error('MFA_ENCRYPTION_KEY must contain only hexadecimal characters (0-9, a-f, A-F)');
    }
    
    // Verwende genau 64 Zeichen (32 Bytes)
    const keyHex64 = keyHex.slice(0, 64);
    ENCRYPTION_KEY = Buffer.from(keyHex64, 'hex');
    
    // Logge Key-Hash (nicht den Key selbst!) für Debugging
    const keyHash = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('hex').substring(0, 16);
    console.log(`✅ MFA_ENCRYPTION_KEY loaded successfully (hash: ${keyHash}...)`);
    
    return ENCRYPTION_KEY;
  }
  // WICHTIG: In Production MUSS MFA_ENCRYPTION_KEY gesetzt sein!
  // Ohne festen Schlüssel wird bei jedem Neustart ein neuer Schlüssel generiert,
  // was dazu führt, dass alle MFA-Secrets korrupt werden
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MFA_ENCRYPTION_KEY must be set in production environment');
  }
  // Fallback für Development: Generiere 32 Bytes (64 hex-Zeichen)
  // WARNUNG: Dieser Schlüssel ändert sich bei jedem Neustart!
  console.warn('⚠️  WARNING: MFA_ENCRYPTION_KEY not set. Using random key (will change on restart).');
  console.warn('⚠️  Set MFA_ENCRYPTION_KEY in .env file for persistent encryption.');
  ENCRYPTION_KEY = crypto.randomBytes(32);
  const keyHash = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('hex').substring(0, 16);
  console.warn(`⚠️  Generated random key (hash: ${keyHash}...) - THIS WILL CHANGE ON RESTART!`);
  return ENCRYPTION_KEY;
};

const ALGORITHM = 'aes-256-gcm';

/**
 * Verschlüsselt einen String.
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // IV + AuthTag + Encrypted Data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Entschlüsselt einen String.
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error(`Invalid encrypted format: expected 3 parts, got ${parts.length}`);
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    if (iv.length !== 16) {
      throw new Error(`Invalid IV length: expected 16 bytes, got ${iv.length}`);
    }
    
    if (authTag.length !== 16) {
      throw new Error(`Invalid auth tag length: expected 16 bytes, got ${authTag.length}`);
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    console.error('Encrypted text (first 50 chars):', encryptedText.substring(0, 50));
    throw new Error(`Failed to decrypt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generiert ein TOTP Secret für einen User.
 */
export async function generateMfaSecret(uid: string, email: string): Promise<{
  secret: string;
  qrCode: string;
}> {
  // Secret generieren
  const secret = authenticator.generateSecret();
  
  // TOTP-URI für QR-Code
  const otpAuthUrl = authenticator.keyuri(email, TOTP_ISSUER, secret);
  
  // QR-Code generieren (Base64)
  const qrCode = await QRCode.toDataURL(otpAuthUrl, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 300,
  });
  
  return {
    secret,
    qrCode,
  };
}

/**
 * Verifiziert einen TOTP-Code.
 */
export function verifyMfaCode(secret: string, code: string): boolean {
  try {
    // otplib authenticator.verify unterstützt window als Option
    return authenticator.verify({
      token: code,
      secret,
      window: TOTP_WINDOW,
    } as any); // Type assertion, da otplib Types nicht vollständig sind
  } catch (error) {
    console.error('MFA verification error:', error);
    return false;
  }
}

/**
 * Speichert MFA Secret für einen User.
 */
export async function saveMfaSecret(uid: string, secret: string, backupCodes: string[]): Promise<void> {
  const db = getAdminFirestore();
  const encryptedSecret = encrypt(secret);
  const encryptedBackupCodes = backupCodes.map(code => encrypt(code));
  
  await db.collection('users').doc(uid).update({
    mfaSecret: encryptedSecret,
    mfaBackupCodes: encryptedBackupCodes,
    mfaEnabled: false, // Wird erst nach Verifizierung aktiviert
    mfaSetupInProgress: true,
  });
}

/**
 * Aktiviert MFA für einen User.
 */
export async function enableMfa(uid: string): Promise<void> {
  const db = getAdminFirestore();
  await db.collection('users').doc(uid).update({
    mfaEnabled: true,
    mfaSetupInProgress: false,
  });
}

/**
 * Deaktiviert MFA für einen User.
 */
export async function disableMfa(uid: string): Promise<void> {
  const db = getAdminFirestore();
  await db.collection('users').doc(uid).update({
    mfaEnabled: false,
    mfaSetupInProgress: false,
    mfaSecret: null,
    mfaBackupCodes: null,
  });
}

/**
 * Repariert ein korruptes MFA Secret, indem MFA zurückgesetzt wird.
 */
async function repairCorruptedMfaSecret(uid: string): Promise<void> {
  console.warn(`MFA secret for user ${uid} is corrupted. Resetting MFA.`);
  const db = getAdminFirestore();
  // WICHTIG: mfaEnabled auf false setzen, damit mfaRequired auch false wird
  // und der User nicht mehr im MFA-Modal hängen bleibt
  await db.collection('users').doc(uid).update({
    mfaEnabled: false,
    mfaSetupInProgress: false,
    mfaSecret: null,
    mfaBackupCodes: null,
  });
  console.log(`MFA reset completed for user ${uid}. User needs to set up MFA again.`);
}

/**
 * Holt MFA Secret für einen User.
 * 
 * WICHTIG: Bei korrupten Secrets wird MFA NICHT automatisch zurückgesetzt!
 * Dies wäre ein Sicherheitsrisiko, da ein Angreifer mit Passwort+Email
 * sich anmelden könnte, wenn MFA automatisch deaktiviert wird.
 * 
 * AUSNAHME: Für SUPER_ADMINs wird MFA automatisch zurückgesetzt, wenn das Secret korrupt ist.
 * Dies ist notwendig, damit Entwickler/Plattform-Betreiber immer Zugang haben.
 * 
 * Stattdessen wird ein Fehler geworfen, der den Login blockiert.
 * Der User muss MFA manuell über einen Recovery-Prozess zurücksetzen.
 */
export async function getMfaSecret(uid: string): Promise<string | null> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();
  
  if (!userData?.mfaSecret) {
    return null;
  }
  
  // Prüfe Format: Sollte 3 Teile haben (IV:AuthTag:EncryptedData)
  const secretStr = typeof userData.mfaSecret === 'string' ? userData.mfaSecret : String(userData.mfaSecret);
  const parts = secretStr.split(':');
  
  if (parts.length !== 3) {
    console.error(`Invalid MFA secret format for user ${uid}: expected 3 parts, got ${parts.length}`);
    console.error('Secret (first 100 chars):', secretStr.substring(0, 100));
    
    // AUSNAHME: Für SUPER_ADMINs MFA automatisch zurücksetzen
    const { isSuperAdmin } = await import('../super-admin/index.js');
    if (isSuperAdmin(uid)) {
      console.warn(`⚠️ SUPER_ADMIN ${uid}: MFA secret is corrupted. Automatically resetting MFA.`);
      await repairCorruptedMfaSecret(uid);
      return null; // MFA wurde zurückgesetzt, kein Secret mehr vorhanden
    }
    
    // Secret ist korrupt - NICHT automatisch zurücksetzen (Sicherheitsrisiko!)
    // Stattdessen Fehler werfen, der den Login blockiert
    throw new Error(`MFA secret is corrupted. Please contact support to reset MFA.`);
  }
  
  try {
    return decrypt(secretStr);
  } catch (error) {
    console.error(`❌ Error decrypting MFA secret for user ${uid}:`, error);
    console.error('Secret format (first 100 chars):', secretStr.substring(0, 100));
    
    // Debug: Prüfe, ob der Key sich geändert hat
    const currentKey = getEncryptionKey();
    const currentKeyHash = crypto.createHash('sha256').update(currentKey).digest('hex').substring(0, 16);
    console.error(`Current encryption key hash: ${currentKeyHash}...`);
    console.error(`Error details:`, error instanceof Error ? error.message : String(error));
    
    // AUSNAHME: Für SUPER_ADMINs MFA automatisch zurücksetzen
    const { isSuperAdmin } = await import('../super-admin/index.js');
    if (isSuperAdmin(uid)) {
      console.warn(`⚠️ SUPER_ADMIN ${uid}: MFA secret decryption failed. Automatically resetting MFA.`);
      await repairCorruptedMfaSecret(uid);
      return null; // MFA wurde zurückgesetzt, kein Secret mehr vorhanden
    }
    
    // Secret ist korrupt - NICHT automatisch zurücksetzen (Sicherheitsrisiko!)
    // Stattdessen Fehler werfen, der den Login blockiert
    throw new Error(`MFA secret is corrupted. Please contact support to reset MFA.`);
  }
}

/**
 * Prüft ob MFA für einen User aktiviert ist.
 */
export async function isMfaEnabled(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();
  
  return userData?.mfaEnabled === true;
}

/**
 * Prüft ob MFA-Setup in Progress ist.
 * 
 * WICHTIG: Diese Funktion wird nur für den initialen Setup-Flow verwendet.
 * Für die Session-Verifizierung wird ein separater Mechanismus verwendet.
 */
export async function isMfaSetupInProgress(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();
  
  return userData?.mfaSetupInProgress === true;
}

/**
 * Prüft, ob MFA-Verifizierung für eine neue Session zurückgesetzt werden muss.
 * Wird aufgerufen, wenn ein User sich neu einloggt.
 * 
 * WICHTIG: Diese Funktion prüft, ob mfaSetupInProgress zurückgesetzt werden muss,
 * basierend auf dem Token-Issue-Datum (iat). Wenn das Token neu ist (z.B. nach Logout/Login),
 * wird mfaSetupInProgress auf false zurückgesetzt, damit MFA erneut verlangt wird.
 */
export async function checkAndResetMfaForNewSession(uid: string, tokenIssuedAt?: number): Promise<void> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();
  
  // Nur prüfen, wenn MFA aktiviert ist
  if (userData?.mfaEnabled !== true) {
    return;
  }
  
  // Wenn kein Token-Issue-Datum vorhanden ist, immer zurücksetzen (sicherer Ansatz)
  // Dies stellt sicher, dass MFA bei jedem /api/me Call erneut verlangt wird,
  // außer es wurde gerade verifiziert
  if (!tokenIssuedAt) {
    // Immer zurücksetzen, damit MFA bei jedem Login erneut verlangt wird
    await db.collection('users').doc(uid).update({
      mfaSetupInProgress: false,
    });
    return;
  }
  
  // Prüfe, ob mfaVerifiedAt (letzte Verifizierung) vorhanden ist
  const mfaVerifiedAt = userData?.mfaVerifiedAt as number | undefined;
  
  // Wenn mfaVerifiedAt vorhanden ist und älter als das Token-Issue-Datum,
  // bedeutet dies, dass das Token nach der letzten Verifizierung ausgestellt wurde
  // → Neue Session, MFA zurücksetzen
  if (mfaVerifiedAt && mfaVerifiedAt < tokenIssuedAt) {
    await db.collection('users').doc(uid).update({
      mfaSetupInProgress: false,
    });
  } else if (!mfaVerifiedAt) {
    // Wenn mfaVerifiedAt nicht vorhanden ist, immer zurücksetzen
    await db.collection('users').doc(uid).update({
      mfaSetupInProgress: false,
    });
  }
}

/**
 * Generiert Backup-Codes.
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 8-stellige Codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Verifiziert einen Backup-Code.
 */
export async function verifyBackupCode(uid: string, code: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();
  
  if (!userData?.mfaBackupCodes || !Array.isArray(userData.mfaBackupCodes)) {
    return false;
  }
  
  // Backup-Codes durchgehen und prüfen
  for (let i = 0; i < userData.mfaBackupCodes.length; i++) {
    try {
      const decryptedCode = decrypt(userData.mfaBackupCodes[i]);
      if (decryptedCode === code.toUpperCase()) {
        // Code gefunden - entfernen (Einmalverwendung)
        const updatedCodes = [...userData.mfaBackupCodes];
        updatedCodes.splice(i, 1);
        await db.collection('users').doc(uid).update({
          mfaBackupCodes: updatedCodes,
        });
        return true;
      }
    } catch (error) {
      // Fehler beim Entschlüsseln - weiter zum nächsten Code
      continue;
    }
  }
  
  return false;
}

