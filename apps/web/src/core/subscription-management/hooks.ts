/**
 * Subscription Management Hooks
 *
 * React Hooks für das Subscription-Management Core-Modul.
 */

import { useState, useEffect } from 'react';
import { getMySubscription, updateSubscriptionUserCount, updateSubscriptionPlan, addSubscriptionAddon, removeSubscriptionAddon } from './api';
import type { SubscriptionDetails } from './api';

export function useMySubscription() {
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMySubscription();
      setSubscription(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load subscription';
      setError(message);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { subscription, loading, error, refresh };
}

export function useUpdateUserCount() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (newUserCount: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateSubscriptionUserCount(newUserCount);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user count';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
}

export function useUpdatePlan() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (newPlanId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateSubscriptionPlan(newPlanId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update plan';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
}

export function useManageAddons() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (addonId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await addSubscriptionAddon(addonId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add addon';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const remove = async (addonId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await removeSubscriptionAddon(addonId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove addon';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { add, remove, loading, error };
}

