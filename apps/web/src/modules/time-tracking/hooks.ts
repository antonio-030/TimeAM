/**
 * Time Tracking Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getStatus,
  clockIn as apiClockIn,
  clockOut as apiClockOut,
  getEntries,
  createEntry as apiCreateEntry,
  updateEntry as apiUpdateEntry,
  deleteEntry as apiDeleteEntry,
  type TimeTrackingStatus,
  type TimeEntry,
  type CreateTimeEntryRequest,
  type UpdateTimeEntryRequest,
} from './api';

/**
 * Hook für Time Tracking Status.
 */
export function useTimeTrackingStatus() {
  const [status, setStatus] = useState<TimeTrackingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clockIn = useCallback(async (note?: string) => {
    setError(null);
    try {
      await apiClockIn(note);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Einstempeln';
      setError(message);
      throw err;
    }
  }, [refresh]);

  const clockOut = useCallback(async (note?: string) => {
    setError(null);
    try {
      await apiClockOut(note);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Ausstempeln';
      setError(message);
      throw err;
    }
  }, [refresh]);

  return {
    status,
    loading,
    error,
    refresh,
    clockIn,
    clockOut,
  };
}

/**
 * Hook für TimeEntries Liste mit CRUD-Operationen.
 */
export function useTimeEntries(limit = 50) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getEntries(limit);
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createEntry = useCallback(async (data: CreateTimeEntryRequest) => {
    setError(null);
    try {
      const result = await apiCreateEntry(data);
      await refresh();
      return result.entry;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Erstellen';
      setError(message);
      throw err;
    }
  }, [refresh]);

  const updateEntry = useCallback(async (entryId: string, data: UpdateTimeEntryRequest) => {
    setError(null);
    try {
      const result = await apiUpdateEntry(entryId, data);
      await refresh();
      return result.entry;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren';
      setError(message);
      throw err;
    }
  }, [refresh]);

  const deleteEntry = useCallback(async (entryId: string) => {
    setError(null);
    try {
      await apiDeleteEntry(entryId);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Löschen';
      setError(message);
      throw err;
    }
  }, [refresh]);

  return {
    entries,
    loading,
    error,
    refresh,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}
