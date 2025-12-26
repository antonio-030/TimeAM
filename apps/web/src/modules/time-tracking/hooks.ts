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
import { useAuth } from '../../core/auth';
import { useTenant } from '../../core/tenant';

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

// =============================================================================
// Time Account Hooks
// =============================================================================

import {
  getTimeAccount,
  getTimeAccountHistory,
  updateTimeAccountTarget,
  addTimeAccountAdjustment,
  exportTimeAccountData,
  type TimeAccount,
  type TimeAccountTarget,
} from './api';
import type {
  UpdateTimeAccountTargetRequest,
  AddTimeAccountAdjustmentRequest,
} from '@timeam/shared';
import { EMPLOYMENT_TYPE } from '@timeam/shared';

/**
 * Hook für Zeitkonto eines Monats.
 */
export function useTimeAccount(year: number, month: number) {
  const [account, setAccount] = useState<TimeAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getTimeAccount(year, month);
      setAccount(data.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    account,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook für Zeitkonto-Historie.
 */
export function useTimeAccountHistory(limit = 12) {
  const [accounts, setAccounts] = useState<TimeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getTimeAccountHistory(limit);
      setAccounts(data.accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    accounts,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook für Zeitkonto-Zielstunden (Admin/Manager).
 */
export function useTimeAccountTarget(userId: string) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [target, setTarget] = useState<TimeAccountTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.uid || !tenant?.id) return;

    setLoading(true);
    setError(null);

    try {
      const { getTimeAccountTarget } = await import('./api.js');
      const response = await getTimeAccountTarget(userId);
      setTarget(response.target);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Zielstunden');
      // Fallback: Standardwert
      setTarget({
        userId: userId,
        monthlyTargetHours: 160,
        employmentType: EMPLOYMENT_TYPE.FULL_TIME,
        weeklyHours: 40,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.uid, tenant?.id, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateTarget = useCallback(async (
    monthlyTargetHours: number,
    employmentType?: import('@timeam/shared').EmploymentType,
    weeklyHours?: number
  ) => {
    if (!user?.uid || !tenant?.id) return;
    setError(null);
    try {
      await apiUpdateTimeAccountTarget(userId, monthlyTargetHours, employmentType, weeklyHours);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren der Zielstunden';
      setError(message);
      throw err;
    }
  }, [user?.uid, tenant?.id, userId, refresh]);

  return {
    target,
    updateTarget,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook für Zeitkonto-Anpassungen (Admin/Manager).
 */
export function useTimeAccountAdjustment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAdjustment = useCallback(
    async (
      year: number,
      month: number,
      data: AddTimeAccountAdjustmentRequest & { userId: string }
    ) => {
      setLoading(true);
      setError(null);

      try {
        const result = await addTimeAccountAdjustment(year, month, data);
        return result.account;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Hinzufügen';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    addAdjustment,
    loading,
    error,
  };
}

/**
 * Hook für Zeitkonto-Export (DSGVO).
 */
export function useTimeAccountExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = useCallback(
    async (
      format: 'json' | 'csv' = 'json',
      startYear?: number,
      startMonth?: number,
      endYear?: number,
      endMonth?: number
    ) => {
      setLoading(true);
      setError(null);

      try {
        const result = await exportTimeAccountData(format, startYear, startMonth, endYear, endMonth);

        if (format === 'csv' && result instanceof Blob) {
          // CSV-Download
          const url = window.URL.createObjectURL(result);
          const a = document.createElement('a');
          a.href = url;
          a.download = `zeitkonto-export-${Date.now()}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          return null;
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Export';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    exportData,
    loading,
    error,
  };
}