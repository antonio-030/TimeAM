/**
 * Dashboard Hooks
 * 
 * React Hooks für Dashboard-Daten.
 * LIVE Time-Tracking + Schichten-Integration.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getTimeStatus,
  getTeamMembers,
  getDashboardWidgets,
  getMyShifts,
  getOpenShifts,
  type TimeTrackingStatus,
  type TeamMemberStatus,
  type DashboardStats,
  type DashboardShift,
} from './api';

interface UseDashboardResult {
  // Daten
  timeStatus: TimeTrackingStatus | null;
  stats: DashboardStats | null;
  teamMembers: TeamMemberStatus[];
  myShifts: DashboardShift[];
  openShifts: DashboardShift[];
  
  // Live-berechnete Werte
  liveRunningMinutes: number;
  liveTodayMinutes: number;
  
  // Status
  loading: boolean;
  error: string | null;
  
  // Aktionen
  refresh: () => Promise<void>;
  refreshTimeStatus: () => Promise<void>;
}

/**
 * Hook für alle Dashboard-Daten.
 * Lädt Daten parallel und berechnet Zeit LIVE.
 */
export function useDashboard(isAdminOrManager: boolean): UseDashboardResult {
  const [timeStatus, setTimeStatus] = useState<TimeTrackingStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberStatus[]>([]);
  const [myShifts, setMyShifts] = useState<DashboardShift[]>([]);
  const [openShifts, setOpenShifts] = useState<DashboardShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Live-Timer für laufende Zeiterfassung
  const [tick, setTick] = useState(0);

  // Berechne live Minuten basierend auf clockIn-Zeit
  const liveRunningMinutes = useMemo(() => {
    if (!timeStatus?.isRunning || !timeStatus.runningEntry?.clockIn) {
      return 0;
    }
    const clockInTime = new Date(timeStatus.runningEntry.clockIn).getTime();
    const now = Date.now();
    return Math.floor((now - clockInTime) / 60000);
  }, [timeStatus?.isRunning, timeStatus?.runningEntry?.clockIn, tick]);

  // Berechne live "Heute"-Minuten (abgeschlossen + laufend)
  const liveTodayMinutes = useMemo(() => {
    const completedMinutes = timeStatus?.today?.totalMinutes || 0;
    // Wenn läuft, addiere live Minuten statt Server-Minuten
    if (timeStatus?.isRunning) {
      return completedMinutes + liveRunningMinutes;
    }
    return completedMinutes;
  }, [timeStatus?.today?.totalMinutes, timeStatus?.isRunning, liveRunningMinutes]);

  // Live-Timer: Aktualisiere jede Sekunde wenn Zeiterfassung läuft
  useEffect(() => {
    if (!timeStatus?.isRunning) return;
    
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timeStatus?.isRunning]);

  // Lade Zeiterfassungs-Status
  const loadTimeStatus = useCallback(async () => {
    try {
      const status = await getTimeStatus();
      setTimeStatus(status);
    } catch (err) {
      console.debug('Time status not available:', err);
    }
  }, []);

  // Lade Schichten
  const loadShifts = useCallback(async () => {
    try {
      const [my, open] = await Promise.all([
        getMyShifts(),
        getOpenShifts(),
      ]);
      setMyShifts(my);
      setOpenShifts(open);
    } catch (err) {
      console.debug('Shifts not available:', err);
    }
  }, []);

  // Lade alle Dashboard-Daten
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Parallel laden
      await Promise.allSettled([
        loadTimeStatus(),
        loadShifts(),
        getDashboardWidgets().then(setStats).catch(() => {
          setStats({
            todayWorkedMinutes: 0,
            weekWorkedMinutes: 0,
            monthWorkedMinutes: 0,
          });
        }),
        isAdminOrManager 
          ? getTeamMembers().then(setTeamMembers).catch(() => setTeamMembers([]))
          : Promise.resolve(),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden';
      if (message.includes('Quota exceeded')) {
        setError('Firebase-Limit erreicht. Bitte warte einen Moment.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdminOrManager, loadTimeStatus, loadShifts]);

  // Initial laden
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-Refresh Status alle 30 Sekunden (wenn aktiv)
  useEffect(() => {
    const interval = setInterval(() => {
      if (timeStatus?.isRunning) {
        loadTimeStatus();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadTimeStatus, timeStatus?.isRunning]);

  return {
    timeStatus,
    stats,
    teamMembers,
    myShifts,
    openShifts,
    liveRunningMinutes,
    liveTodayMinutes,
    loading,
    error,
    refresh: loadAll,
    refreshTimeStatus: loadTimeStatus,
  };
}

/**
 * Formatiert Minuten zu "Xh Ym".
 */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0h 0m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Formatiert Zeit zu HH:MM.
 */
export function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

/**
 * Formatiert Datum relativ (Heute, Morgen, etc).
 */
export function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    if (isToday) return 'Heute';
    if (isTomorrow) return 'Morgen';
    
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

/**
 * Formatiert Schichtzeit zu "HH:MM - HH:MM".
 */
export function formatShiftTime(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)} - ${formatTime(endsAt)}`;
}
