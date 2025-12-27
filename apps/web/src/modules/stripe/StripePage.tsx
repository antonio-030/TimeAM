/**
 * Stripe Page
 *
 * Verwaltung von Modulen, Preisen und Abonnements für Dev-Tenant.
 */

import { useState } from 'react';
import { usePricingPlans, usePricingAddons, useTenantSubscriptions } from './hooks';
import { useAllTenants } from '../admin/hooks';
import styles from './StripePage.module.css';

export function StripePage() {
  const { plans, loading: plansLoading, refresh: refreshPlans } = usePricingPlans();
  const { addons, loading: addonsLoading, refresh: refreshAddons } = usePricingAddons();
  const { tenants } = useAllTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const { subscriptions, loading: subscriptionsLoading, refresh: refreshSubscriptions } = useTenantSubscriptions(selectedTenantId);

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  return (
    <div className={styles.stripePage}>
      <header className={styles.header}>
        <h1 className={styles.title}>Stripe Verwaltung</h1>
        <p className={styles.subtitle}>Verwaltung von Modulen, Preisen und Abonnements</p>
      </header>

      <div className={styles.content}>
        {/* Pricing Plans */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Pricing Plans</h2>
          {plansLoading ? (
            <p>Laden...</p>
          ) : plans.length === 0 ? (
            <p>Keine Plans gefunden. Erstelle den ersten Plan.</p>
          ) : (
            <div className={styles.plansGrid}>
              {plans.map((plan) => (
                <div key={plan.id} className={styles.planCard}>
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                  <div className={styles.price}>
                    {formatPrice(plan.pricePerUser)} € / Nutzer / Monat
                  </div>
                  <div className={styles.minimum}>
                    Mindestpreis: {formatPrice(plan.minimumPrice)} € / Monat
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pricing Addons */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Pricing Addons</h2>
          {addonsLoading ? (
            <p>Laden...</p>
          ) : addons.length === 0 ? (
            <p>Keine Addons gefunden.</p>
          ) : (
            <div className={styles.addonsGrid}>
              {addons.map((addon) => (
                <div key={addon.id} className={styles.addonCard}>
                  <h3>{addon.name}</h3>
                  <p>{addon.description}</p>
                  <div className={styles.price}>
                    {formatPrice(addon.pricePerUser)} € / Nutzer / Monat
                  </div>
                  <div className={styles.minimum}>
                    Mindestpreis: {formatPrice(addon.minimumPrice)} € / Monat
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Subscriptions */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Subscriptions</h2>
          <div className={styles.tenantSelector}>
            <label>Tenant auswählen:</label>
            <select
              value={selectedTenantId || ''}
              onChange={(e) => setSelectedTenantId(e.target.value || null)}
            >
              <option value="">-- Bitte wählen --</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.id})
                </option>
              ))}
            </select>
          </div>

          {selectedTenantId && (
            <>
              {subscriptionsLoading ? (
                <p>Laden...</p>
              ) : subscriptions.length === 0 ? (
                <p>Keine Subscriptions für diesen Tenant gefunden.</p>
              ) : (
                <div className={styles.subscriptionsList}>
                  {subscriptions.map((subscription) => (
                    <div key={subscription.id} className={styles.subscriptionCard}>
                      <h3>Plan: {subscription.planId}</h3>
                      <p>Status: {subscription.status}</p>
                      <p>Nutzer: {subscription.userCount}</p>
                      <p>Billing: {subscription.billingCycle}</p>
                      <p>Addons: {subscription.addonIds.join(', ') || 'Keine'}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

