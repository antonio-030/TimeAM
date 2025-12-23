/**
 * Reports & Analytics Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getDashboard,
  getTimeSummary,
  getShiftOverview,
  getMemberActivity,
  type DashboardWidgets,
  type TimeSummaryReport,
  type ShiftOverviewReport,
  type MemberActivityReport,
  type ReportPeriod,
} from './api';

/**
 * Hook für Dashboard-Widgets.
 */
export function useDashboardWidgets() {
  const [data, setData] = useState<DashboardWidgets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getDashboard();
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook für Zeit-Zusammenfassungs-Report.
 */
export function useTimeSummaryReport(initialPeriod: ReportPeriod = 'this_week') {
  const [report, setReport] = useState<TimeSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [customDates, setCustomDates] = useState<{ start: string; end: string } | null>(null);

  const loadReport = useCallback(async (
    newPeriod: ReportPeriod = period,
    startDate?: string,
    endDate?: string
  ) => {
    setLoading(true);
    setError(null);
    setPeriod(newPeriod);

    if (newPeriod === 'custom' && startDate && endDate) {
      setCustomDates({ start: startDate, end: endDate });
    }

    try {
      const response = await getTimeSummary(newPeriod, startDate, endDate);
      setReport(response.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadReport(initialPeriod);
  }, []);

  return {
    report,
    loading,
    error,
    period,
    customDates,
    loadReport,
    refresh: () => loadReport(period, customDates?.start, customDates?.end),
  };
}

/**
 * Hook für Schicht-Übersichts-Report.
 */
export function useShiftOverviewReport(initialPeriod: ReportPeriod = 'this_week') {
  const [report, setReport] = useState<ShiftOverviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [customDates, setCustomDates] = useState<{ start: string; end: string } | null>(null);

  const loadReport = useCallback(async (
    newPeriod: ReportPeriod = period,
    startDate?: string,
    endDate?: string
  ) => {
    setLoading(true);
    setError(null);
    setPeriod(newPeriod);

    if (newPeriod === 'custom' && startDate && endDate) {
      setCustomDates({ start: startDate, end: endDate });
    }

    try {
      const response = await getShiftOverview(newPeriod, startDate, endDate);
      setReport(response.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadReport(initialPeriod);
  }, []);

  return {
    report,
    loading,
    error,
    period,
    customDates,
    loadReport,
    refresh: () => loadReport(period, customDates?.start, customDates?.end),
  };
}

/**
 * Hook für Mitarbeiter-Aktivitäts-Report.
 */
export function useMemberActivityReport(initialPeriod: ReportPeriod = 'this_week') {
  const [report, setReport] = useState<MemberActivityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [customDates, setCustomDates] = useState<{ start: string; end: string } | null>(null);

  const loadReport = useCallback(async (
    newPeriod: ReportPeriod = period,
    startDate?: string,
    endDate?: string
  ) => {
    setLoading(true);
    setError(null);
    setPeriod(newPeriod);

    if (newPeriod === 'custom' && startDate && endDate) {
      setCustomDates({ start: startDate, end: endDate });
    }

    try {
      const response = await getMemberActivity(newPeriod, startDate, endDate);
      setReport(response.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadReport(initialPeriod);
  }, []);

  return {
    report,
    loading,
    error,
    period,
    customDates,
    loadReport,
    refresh: () => loadReport(period, customDates?.start, customDates?.end),
  };
}
