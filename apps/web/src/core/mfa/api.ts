/**
 * MFA API Client
 *
 * API-Calls für Multi-Factor Authentication.
 */

import { apiPost, apiGet } from '../api/client.js';
import type {
  MfaStatusResponse,
  MfaSetupResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
  MfaDisableRequest,
  MfaPhoneSetupRequest,
  MfaPhoneVerifyRequest,
} from '@timeam/shared';

/**
 * Holt den MFA-Status.
 */
export async function getMfaStatus(): Promise<MfaStatusResponse> {
  return apiGet<MfaStatusResponse>('/api/mfa/status');
}

/**
 * Startet MFA-Setup und gibt QR-Code zurück.
 */
export async function setupMfa(): Promise<MfaSetupResponse> {
  return apiPost<MfaSetupResponse>('/api/mfa/setup', {});
}

/**
 * Verifiziert Setup-Code und aktiviert MFA.
 */
export async function verifySetupMfa(code: string): Promise<MfaVerifyResponse> {
  const request: MfaVerifyRequest = { code };
  return apiPost<MfaVerifyResponse>('/api/mfa/verify-setup', request);
}

/**
 * Verifiziert MFA-Code beim Login.
 */
export async function verifyMfa(code: string): Promise<MfaVerifyResponse> {
  const request: MfaVerifyRequest = { code };
  return apiPost<MfaVerifyResponse>('/api/mfa/verify', request);
}

/**
 * Deaktiviert MFA.
 */
export async function disableMfa(password: string): Promise<{ success: boolean }> {
  const request: MfaDisableRequest = { password };
  return apiPost<{ success: boolean }>('/api/mfa/disable', request);
}

/**
 * Holt den MFA-Status eines anderen Mitarbeiters (nur für Admins/Manager).
 */
export async function getMemberMfaStatus(memberId: string): Promise<MfaStatusResponse> {
  return apiGet<MfaStatusResponse>(`/api/mfa/status/${memberId}`);
}

/**
 * Startet Phone MFA Setup.
 */
export async function setupPhoneMfa(phoneNumber: string): Promise<MfaSetupResponse> {
  const request: MfaPhoneSetupRequest = { phoneNumber };
  return apiPost<MfaSetupResponse>('/api/mfa/setup-phone', request);
}

/**
 * Verifiziert Phone MFA Setup und aktiviert MFA.
 */
export async function verifyPhoneMfaSetup(): Promise<MfaVerifyResponse> {
  return apiPost<MfaVerifyResponse>('/api/mfa/verify-phone-setup', {});
}

/**
 * Verifiziert Phone MFA Code beim Login.
 */
export async function verifyPhoneMfa(): Promise<MfaVerifyResponse> {
  return apiPost<MfaVerifyResponse>('/api/mfa/verify-phone', {});
}

