/**
 * Checkout Page
 *
 * Seite für den Checkout-Prozess nach Plan-Auswahl.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../core/auth';
import { useTenant } from '../core/tenant';
import { getPricingPlans, createCheckoutSession } from '../modules/stripe/api';
import type { PricingPlan } from '../modules/stripe/api';
import styles from './CheckoutPage.module.css';

export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { tenant, refresh: refreshTenant, loading: tenantLoading } = useTenant();
  const tenantCheckRef = useRef(false);
  
  const planId = searchParams.get('planId');
  const billingCycleParam = searchParams.get('billingCycle') || 'monthly';
  const billingCycle = billingCycleParam === 'yearly' ? 'yearly' : 'monthly';
  
  const [plan, setPlan] = useState<PricingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCount, setUserCount] = useState(1);
  const [selectedAddons] = useState<string[]>([]); // Addons werden später implementiert
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    if (!planId) {
      setError('Kein Plan ausgewählt');
      setLoading(false);
      return;
    }

    if (!user) {
      // User muss eingeloggt sein
      navigate(`/login?planId=${planId}&billingCycle=${billingCycle}&mode=register`);
      return;
    }

    // Wenn Tenant noch nicht geladen ist, versuche ihn zu laden
    if (!tenant && !tenantLoading && !tenantCheckRef.current) {
      tenantCheckRef.current = true;
      const loadTenantAndPlan = async () => {
        try {
          // Versuche Tenant-Context neu zu laden
          await refreshTenant();
          
          // Warte kurz, damit der State aktualisiert ist
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Prüfe nochmal, ob Tenant jetzt vorhanden ist
          // (tenant wird durch useEffect aktualisiert, daher müssen wir warten)
          // Da wir tenant aus useTenant() bekommen, wird es automatisch aktualisiert
        } catch (err) {
          console.error('Fehler beim Laden des Tenants:', err);
        }
      };
      
      loadTenantAndPlan();
      return;
    }

    // Wenn Tenant noch nicht geladen ist, warte noch
    if (!tenant) {
      return;
    }

    // Tenant ist vorhanden, lade Plan
    async function loadPlan() {
      try {
        const plans = await getPricingPlans();
        const foundPlan = plans.find(p => p.id === planId);
        if (!foundPlan) {
          setError(`Plan "${planId}" nicht gefunden`);
          return;
        }
        setPlan(foundPlan);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden des Plans');
      } finally {
        setLoading(false);
      }
    }

    loadPlan();
  }, [planId, user, tenant, tenantLoading, navigate, billingCycle, refreshTenant]);

  const handleCancel = async () => {
    if (!plan || isCanceling) {
      return;
    }

    setIsCanceling(true);
    setError(null);

    try {
      // Speichere Checkout-Kontext in localStorage (für späteren Login)
      const checkoutContext = {
        planId: plan.id,
        billingCycle,
        userCount,
        addonIds: selectedAddons,
        timestamp: Date.now(),
      };
      localStorage.setItem('pendingCheckout', JSON.stringify(checkoutContext));

      // User ausloggen
      await signOut();

      // Zur Login-Seite weiterleiten
      navigate('/login?checkout=canceled', { replace: true });
    } catch (err) {
      console.error('Fehler beim Abbrechen:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Abbrechen');
      setIsCanceling(false);
    }
  };

  const handleCheckout = async () => {
    if (!plan || !tenant) {
      return;
    }

    setIsCreatingSession(true);
    setError(null);

    try {
      // Speichere Checkout-Kontext in localStorage (für späteren Login)
      const checkoutContext = {
        planId: plan.id,
        billingCycle,
        userCount,
        addonIds: selectedAddons,
        timestamp: Date.now(),
      };
      localStorage.setItem('pendingCheckout', JSON.stringify(checkoutContext));

      const successUrl = `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`;
      // Bei Abbruch: User wird ausgeloggt und zur Login-Seite weitergeleitet
      // Beim erneuten Login wird er automatisch zum Checkout weitergeleitet
      const cancelUrl = `${window.location.origin}/checkout-cancel`;

      const session = await createCheckoutSession(
        tenant.id,
        plan.id,
        selectedAddons,
        userCount,
        billingCycle,
        successUrl,
        cancelUrl
      );

      // Weiterleitung zu Stripe Checkout
      if (session.url) {
        window.location.href = session.url;
      } else {
        setError('Keine Checkout-URL erhalten');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen der Checkout-Session');
      setIsCreatingSession(false);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const calculateTotal = () => {
    if (!plan) return 0;

    const isYearly = billingCycle === 'yearly';
    const discount = isYearly ? 0.15 : 0;
    
    const planPricePerUser = isYearly && plan.pricePerUserYearly 
      ? plan.pricePerUserYearly 
      : plan.pricePerUser;
    const planMinimum = isYearly && plan.minimumPriceYearly 
      ? plan.minimumPriceYearly 
      : plan.minimumPrice;
    
    const planTotal = Math.max(planPricePerUser * userCount, planMinimum) * (1 - discount);
    
    // TODO: Add addon prices if addons are selected
    return planTotal;
  };

  if (loading) {
    return (
      <div className={styles.checkoutPage}>
        <div className={styles.loading}>Laden...</div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className={styles.checkoutPage}>
        <div className={styles.error}>{error}</div>
        <button onClick={() => navigate('/pricing')} className={styles.button}>
          Zurück zur Preisseite
        </button>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className={styles.checkoutPage}>
      <div className={styles.container}>
        <h1 className={styles.title}>Checkout</h1>
        
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.content}>
          <div className={styles.planDetails}>
            <h2 className={styles.planName}>{plan.name}</h2>
            <p className={styles.planDescription}>{plan.description}</p>
            
            {plan.features && plan.features.length > 0 && (
              <div className={styles.features}>
                <h3>Enthaltene Features:</h3>
                <ul>
                  {plan.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className={styles.billingCycle}>
              <button
                className={`${styles.cycleButton} ${billingCycle === 'monthly' ? styles.active : ''}`}
                onClick={() => navigate(`/checkout?planId=${planId}&billingCycle=monthly`)}
              >
                Monatlich
              </button>
              <button
                className={`${styles.cycleButton} ${billingCycle === 'yearly' ? styles.active : ''}`}
                onClick={() => navigate(`/checkout?planId=${planId}&billingCycle=yearly`)}
              >
                Jährlich (-15%)
              </button>
            </div>

            <div className={styles.userCount}>
              <label htmlFor="userCount">Anzahl Nutzer:</label>
              <input
                id="userCount"
                type="number"
                min="1"
                value={userCount}
                onChange={(e) => setUserCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className={styles.input}
              />
            </div>

            <div className={styles.priceSummary}>
              <div className={styles.priceRow}>
                <span>Plan ({userCount} Nutzer):</span>
                <span>{formatPrice(calculateTotal())} € / {billingCycle === 'monthly' ? 'Monat' : 'Jahr'}</span>
              </div>
              <div className={styles.priceTotal}>
                <span>Gesamt:</span>
                <span>{formatPrice(calculateTotal())} € / {billingCycle === 'monthly' ? 'Monat' : 'Jahr'}</span>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              onClick={handleCancel}
              className={styles.cancelButton}
              disabled={isCreatingSession || isCanceling}
            >
              {isCanceling ? 'Wird abgebrochen...' : 'Abbrechen'}
            </button>
            <button
              onClick={handleCheckout}
              className={styles.checkoutButton}
              disabled={isCreatingSession || isCanceling || userCount < 1 || !plan}
            >
              {isCreatingSession ? 'Wird vorbereitet...' : 'Zur Zahlung mit Stripe'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

