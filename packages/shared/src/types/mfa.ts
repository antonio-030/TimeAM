/**
 * MFA Types
 *
 * Gemeinsame Typen für Multi-Factor Authentication.
 */

/**
 * MFA Methode
 */
export type MfaMethod = 'totp' | 'phone';

/**
 * MFA Status Response
 */
export interface MfaStatusResponse {
  enabled: boolean;
  setupInProgress?: boolean;
  method?: MfaMethod; // Welche MFA-Methode ist aktiviert
}

/**
 * MFA Setup Response
 */
export interface MfaSetupResponse {
  qrCode?: string; // Base64-encoded QR Code (nur für TOTP)
  secret?: string; // TOTP Secret (für manuelle Eingabe, nur für TOTP)
  backupCodes?: string[]; // Backup-Codes für Notfall-Zugriff (nur für TOTP)
  method?: MfaMethod; // Welche Methode wird eingerichtet
  phoneNumber?: string; // Telefonnummer (nur für Phone Auth, maskiert)
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

/**
 * MFA Phone Setup Request
 */
export interface MfaPhoneSetupRequest {
  phoneNumber: string; // Internationales Format (z.B. +491234567890)
}

/**
 * MFA Phone Verify Request (für Setup-Verifizierung)
 */
export interface MfaPhoneVerifyRequest {
  code: string; // SMS-Code
}

