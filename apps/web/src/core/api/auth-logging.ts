/**
 * Auth Logging API
 *
 * API-Calls für Login-Event-Logging.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Loggt ein Auth-Event (Login, Logout, fehlgeschlagener Versuch).
 * Öffentlich zugänglich (kein Token erforderlich).
 * 
 * WICHTIG: Diese Funktion wirft nur Rate-Limit-Fehler, alle anderen Fehler werden ignoriert,
 * damit das Logging den Login-Flow nicht blockiert.
 */
export async function logAuthEvent(data: {
  eventType: 'auth.login.success' | 'auth.login.failed' | 'auth.logout';
  email?: string;
  userId?: string;
  errorMessage?: string;
}): Promise<void> {
  // Timeout für Logging-Request (5 Sekunden)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/security-audit/auth/log-auth-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Rate-Limit-Fehler weiterwerfen (sollte den Login blockieren)
    if (response.status === 429) {
      try {
        const errorData = await response.json();
        const error = new Error(errorData.error || 'Too many failed login attempts');
        (error as any).code = errorData.code || 'RATE_LIMIT_EXCEEDED';
        (error as any).blockedUntil = errorData.blockedUntil;
        throw error;
      } catch (jsonError) {
        // Falls JSON-Parsing fehlschlägt, trotzdem Rate-Limit-Fehler werfen
        const error = new Error('Too many failed login attempts');
        (error as any).code = 'RATE_LIMIT_EXCEEDED';
        throw error;
      }
    }

    // Andere Fehler ignorieren (Logging sollte nicht den Login-Flow blockieren)
    if (!response.ok) {
      console.warn('Failed to log auth event:', response.status, response.statusText);
    }
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Rate-Limit-Fehler weiterwerfen (sollte den Login blockieren)
    if (error?.code === 'RATE_LIMIT_EXCEEDED' || error?.name === 'AbortError') {
      // AbortError (Timeout) wird als Rate-Limit behandelt, um sicherzugehen
      // Aber eigentlich sollten wir Timeouts ignorieren
      if (error?.name === 'AbortError') {
        console.warn('Logging request timed out, ignoring');
        return;
      }
      throw error;
    }
    
    // Alle anderen Fehler ignorieren (sollten den Login nicht blockieren)
    console.warn('Error logging auth event (ignored):', error?.message || error);
  }
}

