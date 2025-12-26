/**
 * API Client
 *
 * HTTP Client für Backend-Kommunikation.
 * Sendet automatisch den Firebase ID Token mit.
 */

import { getIdToken } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * API Response Wrapper.
 */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

/**
 * API Error.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Führt einen authentifizierten API-Request aus.
 *
 * @param endpoint - API Endpoint (z.B. '/api/me')
 * @param options - Fetch Optionen
 * @returns Response Daten
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Token holen
  const token = await getIdToken();

  // Headers zusammenbauen
  // Wenn FormData verwendet wird, Content-Type nicht setzen (Browser setzt automatisch mit Boundary)
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  // Authorization Header hinzufügen wenn Token vorhanden
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Request ausführen
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Response parsen
  const data = await response.json().catch(() => null);

  // Fehlerbehandlung
  if (!response.ok) {
    // Spezielle Behandlung für MFA_REQUIRED Fehler
    if (response.status === 403 && data?.code === 'MFA_REQUIRED') {
      throw new ApiError(
        data?.error || 'MFA verification required',
        response.status,
        data?.code
      );
    }
    
    // Spezielle Behandlung für korrupte MFA-Secrets
    // WICHTIG: Bei korrupten Secrets wird der Login blockiert (403), nicht automatisch zurückgesetzt!
    if ((response.status === 403 || response.status === 400) && (data?.code === 'MFA_SECRET_CORRUPTED' || data?.code === 'MFA_SECRET_NOT_FOUND')) {
      const error = new ApiError(
        data?.error || 'MFA secret is corrupted. Please contact support to reset MFA.',
        response.status,
        data?.code
      );
      // Zusätzliche Information für Frontend
      (error as any).requiresSupport = data?.requiresSupport || false;
      (error as any).requiresNewSetup = data?.requiresNewSetup || false;
      throw error;
    }
    
    throw new ApiError(
      data?.error || `Request failed with status ${response.status}`,
      response.status,
      data?.code
    );
  }

  return data as T;
}

/**
 * GET Request.
 */
export function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET' });
}

/**
 * POST Request.
 */
export function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT Request.
 */
export function apiPut<T>(endpoint: string, body?: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE Request.
 */
export function apiDelete<T>(endpoint: string, body?: unknown): Promise<T> {
  return apiRequest<T>(endpoint, { 
    method: 'DELETE',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH Request.
 */
export function apiPatch<T>(endpoint: string, body?: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

