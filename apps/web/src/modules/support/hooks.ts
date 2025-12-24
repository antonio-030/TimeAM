/**
 * Support Hooks
 *
 * React Hooks für das Support-Modul.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../core/auth';
import { checkDevStaff } from './api';

/**
 * Hook: Dev-Mitarbeiter-Status prüfen
 * 
 * Wartet auf vollständige Authentifizierung, bevor der Check ausgeführt wird.
 */
export function useDevStaffCheck() {
  const { user, loading: authLoading } = useAuth();
  const [isDevStaff, setIsDevStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stabiler User-ID Wert für Dependencies
  const userId = user?.uid ?? null;

  useEffect(() => {
    // Warten bis Auth geladen ist
    if (authLoading) {
      return;
    }

    // Kein User → kein Dev-Mitarbeiter
    if (!userId) {
      setIsDevStaff(false);
      setLoading(false);
      return;
    }

    // Dev-Mitarbeiter-Status prüfen
    let cancelled = false;
    
    async function check() {
      setLoading(true);
      setError(null);
      
      try {
        const result = await checkDevStaff();
        if (!cancelled) {
          setIsDevStaff(result.isDevStaff);
        }
      } catch (err) {
        if (!cancelled) {
          // Bei 401 ist der User einfach kein Dev-Mitarbeiter
          if (err instanceof Error && err.message.includes('401')) {
            setIsDevStaff(false);
          } else {
            setError(err instanceof Error ? err.message : 'Fehler');
          }
          setIsDevStaff(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    check();

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading]);

  return { 
    isDevStaff, 
    loading: authLoading || loading, 
    error 
  };
}

