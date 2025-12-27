/**
 * Create Tenant Form
 *
 * Onboarding-Formular im TimeAM Design System.
 */

import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../core/auth';
import { useTenant } from '../core/tenant';
import styles from './CreateTenantForm.module.css';

export function CreateTenantForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signOut } = useAuth();
  const { createTenant, error, loading, refresh } = useTenant();
  const [tenantName, setTenantName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Plan-Kontext aus URL-Parametern ODER aus localStorage (pendingCheckout) lesen
  const planIdFromUrl = searchParams.get('planId');
  const billingCycleFromUrl = searchParams.get('billingCycle') || 'monthly';
  
  // Prüfe ob ein pending Checkout vorhanden ist (hat Priorität vor URL-Parametern)
  const pendingCheckoutStr = localStorage.getItem('pendingCheckout');
  let planId = planIdFromUrl;
  let billingCycle = billingCycleFromUrl;
  
  if (pendingCheckoutStr) {
    try {
      const pendingCheckout = JSON.parse(pendingCheckoutStr);
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 Tage
      const age = Date.now() - pendingCheckout.timestamp;
      
      if (age < maxAge) {
        // Pending Checkout ist noch gültig -> verwende diese Daten
        planId = pendingCheckout.planId;
        billingCycle = pendingCheckout.billingCycle || 'monthly';
      } else {
        // Zu alt -> löschen
        localStorage.removeItem('pendingCheckout');
      }
    } catch (err) {
      console.error('Fehler beim Parsen des pending Checkouts:', err);
      localStorage.removeItem('pendingCheckout');
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!tenantName.trim() || tenantName.trim().length < 2) {
      return;
    }

    setIsSubmitting(true);

    try {
      await createTenant(tenantName.trim());
      
      // Tenant-Context explizit neu laden, um sicherzustellen, dass alle Daten vom Backend geladen sind
      await refresh();
      
      // Wenn Plan-Kontext vorhanden ist, zum Checkout weiterleiten
      if (planId) {
        // Warte kurz, damit der Tenant-State vollständig aktualisiert ist
        await new Promise(resolve => setTimeout(resolve, 500));
        navigate(`/checkout?planId=${planId}&billingCycle=${billingCycle}`, { replace: true });
        return;
      }
    } catch (err) {
      // Error wird im Context behandelt
      console.error('Fehler beim Erstellen des Tenants:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Error handling
    }
  };

  const isDisabled = loading || isSubmitting;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>⏱️</span>
            <span className={styles.logoText}>TimeAM</span>
          </div>
          <div className={styles.iconCircle}>
            <span className={styles.icon}>🏢</span>
          </div>
          <h1 className={styles.title}>Organisation erstellen</h1>
          <p className={styles.subtitle}>
            Erstelle deine Organisation, um TimeAM mit deinem Team zu nutzen.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Name der Organisation</label>
            <input
              type="text"
              placeholder="z.B. Meine Firma GmbH"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
              disabled={isDisabled}
              minLength={2}
              maxLength={100}
              className={styles.input}
            />
            <span className={styles.hint}>
              Mindestens 2 Zeichen
            </span>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={isDisabled || tenantName.trim().length < 2}
            className={styles.submitBtn}
          >
            {isSubmitting ? 'Wird erstellt...' : 'Organisation erstellen'}
          </button>
        </form>

        {/* Info */}
        <div className={styles.info}>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>✓</span>
            <span>Du wirst automatisch als Administrator hinzugefügt</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>✓</span>
            <span>Zeiterfassung & Schichtplanung sofort verfügbar</span>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button onClick={handleSignOut} className={styles.signOutBtn}>
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
