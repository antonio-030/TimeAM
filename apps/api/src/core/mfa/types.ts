/**
 * MFA Types
 *
 * Backend-spezifische MFA-Typen.
 */

export interface MfaUserData {
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaBackupCodes?: string[];
  mfaSetupInProgress?: boolean;
}

