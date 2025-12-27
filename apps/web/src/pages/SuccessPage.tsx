/**
 * Success Page
 *
 * Seite nach erfolgreicher Stripe-Zahlung.
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../core/auth';
import { useTenant } from '../core/tenant';
import styles from './SuccessPage.module.css';

export function SuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { refresh: refreshTenant } = useTenant();
  
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false); // Verhindert mehrfache Ausführung

  useEffect(() => {
    // Verhindere mehrfache Ausführung
    if (hasProcessed.current) {
      return;
    }

    async function handleSuccess() {
      if (!sessionId) {
        setError('Keine Session-ID gefunden');
        setLoading(false);
        return;
      }

      // Markiere als verarbeitet, um mehrfache Ausführung zu verhindern
      hasProcessed.current = true;

      // Lösche pending checkout aus localStorage (Zahlung erfolgreich)
      localStorage.removeItem('pendingCheckout');

      // Warte kurz, damit der Webhook Zeit hat, die Module zu aktivieren
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Versuche einmal, Tenant-Context neu zu laden
      // Wenn es fehlschlägt, ist das OK - der Webhook wird die Entitlements später aktualisieren
      try {
        await refreshTenant();
      } catch (err) {
        console.warn('Fehler beim Neuladen der Tenant-Daten (nicht kritisch):', err);
        // Nicht kritisch - Webhook wird die Entitlements später aktualisieren
      }
      
      // Weiterleitung zu Dashboard
      setLoading(false);
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1000);
    }

    handleSuccess();
  }, [sessionId, navigate, refreshTenant]);

  if (loading) {
    return (
      <div className={styles.successPage}>
        <div className={styles.container}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Zahlung wird verarbeitet...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.successPage}>
        <div className={styles.container}>
          <div className={styles.error}>
            <h2>Fehler</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/dashboard')} className={styles.button}>
              Zum Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.successPage}>
      <div className={styles.container}>
        <div className={styles.success}>
          <div className={styles.successIcon}>✓</div>
          <h1 className={styles.title}>Zahlung erfolgreich!</h1>
          <p className={styles.message}>
            Vielen Dank für deine Bestellung. Dein Abonnement wurde aktiviert und die Module sind jetzt verfügbar.
          </p>
          <p className={styles.redirectMessage}>
            Du wirst in Kürze zum Dashboard weitergeleitet...
          </p>
          <button onClick={() => navigate('/dashboard')} className={styles.button}>
            Jetzt zum Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

