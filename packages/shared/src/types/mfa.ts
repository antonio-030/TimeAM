/**
 * MFA Types
 *
 * Gemeinsame Typen für Multi-Factor Authentication.
 */

/**
 * MFA Status Response
 */
export interface MfaStatusResponse {
  enabled: boolean;
  setupInProgress?: boolean;
}

/**
 * MFA Setup Response
 */
export interface MfaSetupResponse {
  qrCode: string; // Base64-encoded QR Code
  secret: string; // TOTP Secret (für manuelle Eingabe)
  backupCodes: string[]; // Backup-Codes für Notfall-Zugriff
}

/**
 * MFA Verify Request
 */
export interface MfaVerifyRequest {
  code: string;
}

/**
 * MFA Verify Response
 */
export interface MfaVerifyResponse {
  verified: boolean;
}

/**
 * MFA Disable Request
 */
export interface MfaDisableRequest {
  password: string;
}

