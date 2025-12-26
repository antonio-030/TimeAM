/**
 * Security Audit Hooks
 *
 * React Hooks für das Security-Audit-Modul.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  getSecurityEvents,
  getSecurityEvent,
  getSecurityStats,
  getRateLimits,
  type SecurityEventsQueryParams,
} from './api';
import type {
  SecurityEventsListResponse,
  SecurityEventDetailResponse,
  SecurityStatsResponse,
  RateLimitsListResponse,
} from '@timeam/shared';

/**
 * Hook: Security-Events laden
 * @param autoRefresh - Automatisches Refresh alle 30 Sekunden (Standard: true)
 */
export function useSecurityEvents(params?: SecurityEventsQueryParams, autoRefresh = true) {
  const [events, setEvents] = useState<SecurityEventsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSecurityEvents(params);
      setEvents(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Laden der Events';
      setError(errorMessage);
      console.error('Error loading security events:', err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]); // Verwende JSON.stringify für stabile Dependency

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-Refresh alle 30 Sekunden
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchEvents();
    }, 30000); // 30 Sekunden

    return () => clearInterval(interval);
  }, [fetchEvents, autoRefresh]);

  return { events, loading, error, refetch: fetchEvents };
}

/**
 * Hook: Einzelnes Security-Event laden
 */
export function useSecurityEvent(eventId: string | null) {
  const [event, setEvent] = useState<SecurityEventDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchEvent() {
      setLoading(true);
      setError(null);

      try {
        const data = await getSecurityEvent(eventId);
        if (!cancelled) {
          setEvent(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Fehler beim Laden des Events');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchEvent();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return { event, loading, error };
}

/**
 * Hook: Security-Statistiken laden
 * @param autoRefresh - Automatisches Refresh alle 60 Sekunden (Standard: true)
 */
export function useSecurityStats(autoRefresh = true) {
  const [stats, setStats] = useState<SecurityStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSecurityStats();
      setStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Laden der Statistiken';
      setError(errorMessage);
      console.error('Error loading security stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-Refresh alle 60 Sekunden
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats();
    }, 60000); // 60 Sekunden

    return () => clearInterval(interval);
  }, [fetchStats, autoRefresh]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Hook: Rate-Limits laden
 */
export function useRateLimits() {
  const [rateLimits, setRateLimits] = useState<RateLimitsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRateLimits = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getRateLimits();
      setRateLimits(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Rate-Limits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRateLimits();
  }, [fetchRateLimits]);

  return { rateLimits, loading, error, refetch: fetchRateLimits };
}

