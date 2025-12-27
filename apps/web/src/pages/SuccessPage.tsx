/**
 * Success Page
 *
 * Seite nach erfolgreicher Stripe-Zahlung.
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../core/auth';
import { useTenant } from '../core/tenant';
import { createSubscriptionFromSession } from '../modules/stripe/api';
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
  const processingPromise = useRef<Promise<void> | null>(null); // Verhindert parallele Ausführung

  useEffect(() => {
    // Verhindere mehrfache Ausführung
    if (hasProcessed.current || processingPromise.current) {
      console.log('⏭️ Success-Page: Bereits verarbeitet oder läuft bereits, überspringe...');
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
      
      // Speichere Promise, um parallele Ausführung zu verhindern
      const promise = (async () => {

      // Lösche pending checkout aus localStorage (Zahlung erfolgreich)
      localStorage.removeItem('pendingCheckout');

      // Warte kurz, damit der Webhook Zeit hat, die Module zu aktivieren
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fallback: Erstelle Subscription manuell, falls Webhook nicht ausgelöst wurde
      try {
        console.log('\n🔄 ========== SUCCESS PAGE: SUBSCRIPTION ERSTELLEN (FALLBACK) ==========');
        console.log('🔄 Session ID:', sessionId);
        console.log('🔄 Versuche Subscription aus Session zu erstellen (Fallback)...');
        
        const result = await createSubscriptionFromSession(sessionId);
        
        console.log('✅ Subscription erfolgreich erstellt (Fallback)');
        console.log('✅ Subscription ID:', result.subscription.id);
        console.log('✅ Transaction Log ID:', result.transactionLog.id);
        console.log('✅ Plan ID:', result.subscription.planId);
        console.log('✅ Addon IDs:', result.subscription.addonIds?.join(', ') || 'keine');
        console.log('✅ User Count:', result.subscription.userCount);
        console.log('✅ Billing Cycle:', result.subscription.billingCycle);
        console.log('🔄 ========== SUCCESS PAGE: SUBSCRIPTION ERSTELLT ==========\n');
      } catch (err) {
        // Wenn Subscription bereits existiert, ist das OK
        if (err instanceof Error && err.message.includes('bereits')) {
          console.log('ℹ️ Subscription existiert bereits (OK)');
        } else {
          console.warn('⚠️ Fehler beim Erstellen der Subscription (Fallback):', err);
          console.error('⚠️ Error Details:', err instanceof Error ? err.message : String(err));
          // Nicht kritisch - Webhook könnte die Subscription bereits erstellt haben
        }
      }

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
      })();
      
      processingPromise.current = promise;
      await promise;
      processingPromise.current = null;
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

