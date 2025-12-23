/**
 * Calendar Core Hooks
 *
 * React Hooks für das Kalender-Modul.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchCalendarEvents } from './api';
import type { CalendarEvent, CalendarSourceModule } from '@timeam/shared';

interface UseCalendarEventsOptions {
  from: Date;
  to: Date;
  includeModules?: CalendarSourceModule[];
  enabled?: boolean;
}

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook zum Laden von Kalender-Events.
 */
export function useCalendarEvents(
  options: UseCalendarEventsOptions
): UseCalendarEventsResult {
  const { from, to, includeModules, enabled = true } = options;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetchCalendarEvents({
        from,
        to,
        includeModules,
      });
      setEvents(response.events);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden';
      setError(message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [from.toISOString(), to.toISOString(), includeModules?.join(','), enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    events,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook für Responsive Breakpoint Detection.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Hook für prefers-reduced-motion Detection.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}
