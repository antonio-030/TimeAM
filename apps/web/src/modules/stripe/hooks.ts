/**
 * Stripe Module Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../core/tenant';
import {
  getPricingPlans,
  getPricingAddons,
  getTenantSubscriptions,
  getMySubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  createCheckoutSession,
  type PricingPlan,
  type PricingAddon,
  type Subscription,
  type CreateSubscriptionRequest,
  type UpdateSubscriptionRequest,
} from './api';

export function usePricingPlans() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPricingPlans();
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plans, loading, error, refresh };
}

export function usePricingAddons() {
  const [addons, setAddons] = useState<PricingAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPricingAddons();
      setAddons(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { addons, loading, error, refresh };
}

export function useTenantSubscriptions(tenantId: string | null) {
  const { tenant, hasEntitlement } = useTenant();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setSubscriptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Prüfe ob User Stripe-Entitlement hat
      const hasStripeEntitlement = hasEntitlement('module.stripe');
      // Prüfe ob der angeforderte Tenant der aktuelle Tenant ist
      const isCurrentTenant = tenant?.id === tenantId;

      if (hasStripeEntitlement) {
        // User hat Stripe-Entitlement → Admin-Endpoint verwenden
        const data = await getTenantSubscriptions(tenantId);
        setSubscriptions(data);
      } else if (isCurrentTenant) {
        // User hat kein Stripe-Entitlement, aber es ist der aktuelle Tenant → öffentlichen Endpoint verwenden
        const data = await getMySubscription();
        setSubscriptions(data);
      } else {
        // User hat kein Stripe-Entitlement und es ist nicht der aktuelle Tenant → Fehler
        throw new Error('Zugriff verweigert: Stripe-Modul-Entitlement erforderlich. Bitte wende dich an einen Administrator.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      console.error('Error loading subscriptions:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenant?.id, hasEntitlement]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { subscriptions, loading, error, refresh };
}

