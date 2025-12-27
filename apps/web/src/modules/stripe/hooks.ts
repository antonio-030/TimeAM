/**
 * Stripe Module Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getPricingPlans,
  getPricingAddons,
  getTenantSubscriptions,
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
      const data = await getTenantSubscriptions(tenantId);
      setSubscriptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { subscriptions, loading, error, refresh };
}

