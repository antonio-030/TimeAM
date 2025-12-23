/**
 * Sidebar Calendar Hook
 *
 * Lädt echte Schichten und Zeiterfassungen für den Mini-Kalender.
 * 
 * Rollen-basierte Ansicht:
 * - Admin/Manager: ALLE vergebenen Schichten (komplette Übersicht)
 * - Mitarbeiter: Nur eigene angenommene Schichten + eigene Zeiten
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMyShifts, getAdminShifts, type MyShift, type AdminShift } from '../../modules/shift-pool/api';
import { getEntries, type TimeEntry } from '../../modules/time-tracking/api';
import type { CalendarDayEvent } from './MiniCalendar';

type UserRole = 'admin' | 'manager' | 'employee' | null;

interface UseSidebarCalendarOptions {
  /** Benutzer-Rolle für rollenbasierte Ansicht */
  role?: UserRole;
  /** Modul-Filter */
  includeShifts?: boolean;
  includeTimeEntries?: boolean;
}

interface UseSidebarCalendarResult {
  events: Record<string, CalendarDayEvent[]>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Formatiert ein Datum als YYYY-MM-DD Key
 */
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formatiert Uhrzeit als HH:MM
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Konvertiert eigene Schichten (Mitarbeiter) zu Kalender-Events.
 * NUR angenommene Schichten (assignmentStatus = 'CONFIRMED')
 */
function myShiftsToEvents(shifts: MyShift[]): Record<string, CalendarDayEvent[]> {
  const events: Record<string, CalendarDayEvent[]> = {};

  for (const shift of shifts) {
    // Nur bestätigte Schichten anzeigen (Status ist UPPERCASE)
    if (shift.assignmentStatus !== 'CONFIRMED') continue;

    const dateKey = formatDateKey(new Date(shift.startsAt));
    const startTime = formatTime(shift.startsAt);
    const endTime = formatTime(shift.endsAt);

    if (!events[dateKey]) {
      events[dateKey] = [];
    }

    events[dateKey].push({
      id: shift.id,
      title: shift.title,
      type: 'shift',
      time: `${startTime} - ${endTime}`,
    });
  }

  return events;
}

/**
 * Konvertiert Admin-Schichten zu Kalender-Events.
 * Zeigt ALLE vergebenen Schichten (status = 'PUBLISHED' oder 'CLOSED' mit Zuweisungen)
 */
function adminShiftsToEvents(shifts: AdminShift[]): Record<string, CalendarDayEvent[]> {
  const events: Record<string, CalendarDayEvent[]> = {};

  for (const shift of shifts) {
    // Nur veröffentlichte Schichten anzeigen (Status ist UPPERCASE)
    // Draft und Cancelled werden ausgeblendet
    if (shift.status === 'DRAFT' || shift.status === 'CANCELLED') continue;

    const dateKey = formatDateKey(new Date(shift.startsAt));
    const startTime = formatTime(shift.startsAt);
    const endTime = formatTime(shift.endsAt);

    if (!events[dateKey]) {
      events[dateKey] = [];
    }

    // Zeige Besetzungsstatus im Titel
    const occupancy = `${shift.filledCount}/${shift.requiredCount}`;
    const statusLabel = shift.filledCount >= shift.requiredCount ? '✓' : '⚠️';

    events[dateKey].push({
      id: shift.id,
      title: `${shift.title} (${occupancy}) ${statusLabel}`,
      type: 'shift',
      time: `${startTime} - ${endTime}`,
    });
  }

  return events;
}

/**
 * Konvertiert Zeiterfassungen zu Kalender-Events.
 */
function timeEntriesToEvents(entries: TimeEntry[]): Record<string, CalendarDayEvent[]> {
  const events: Record<string, CalendarDayEvent[]> = {};

  for (const entry of entries) {
    const dateKey = formatDateKey(new Date(entry.clockIn));
    const startTime = formatTime(entry.clockIn);
    const endTime = entry.clockOut ? formatTime(entry.clockOut) : 'läuft...';
    
    // Dauer berechnen
    let duration = '';
    if (entry.durationMinutes) {
      const hours = Math.floor(entry.durationMinutes / 60);
      const mins = entry.durationMinutes % 60;
      duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    if (!events[dateKey]) {
      events[dateKey] = [];
    }

    events[dateKey].push({
      id: entry.id,
      title: entry.status === 'running' ? 'Arbeitszeit läuft' : `Arbeitszeit: ${duration}`,
      type: 'time-entry',
      time: entry.status === 'running' ? `${startTime} - läuft` : `${startTime} - ${endTime}`,
    });
  }

  return events;
}

/**
 * Merged zwei Event-Records zusammen.
 */
function mergeEvents(
  ...records: Record<string, CalendarDayEvent[]>[]
): Record<string, CalendarDayEvent[]> {
  const merged: Record<string, CalendarDayEvent[]> = {};

  for (const record of records) {
    for (const [key, events] of Object.entries(record)) {
      if (!merged[key]) {
        merged[key] = [];
      }
      merged[key].push(...events);
    }
  }

  // Sortiere Events nach Zeit
  for (const key of Object.keys(merged)) {
    merged[key].sort((a, b) => {
      const timeA = a.time?.split(' - ')[0] ?? '';
      const timeB = b.time?.split(' - ')[0] ?? '';
      return timeA.localeCompare(timeB);
    });
  }

  return merged;
}

/**
 * Hook zum Laden von Kalender-Events für die Sidebar.
 * 
 * Rollenbasiert:
 * - Admin/Manager: Alle vergebenen Schichten
 * - Mitarbeiter: Nur eigene angenommene Schichten
 */
export function useSidebarCalendar(
  options: UseSidebarCalendarOptions = {}
): UseSidebarCalendarResult {
  const { 
    role = 'employee', 
    includeShifts = true, 
    includeTimeEntries = true 
  } = options;
  
  const isAdminOrManager = role === 'admin' || role === 'manager';
  
  const [myShifts, setMyShifts] = useState<MyShift[]>([]);
  const [adminShifts, setAdminShifts] = useState<AdminShift[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const promises: Promise<void>[] = [];

      if (includeShifts) {
        if (isAdminOrManager) {
          // Admin/Manager: Alle Schichten laden
          promises.push(
            getAdminShifts()
              .then((res) => setAdminShifts(res.shifts))
              .catch(() => setAdminShifts([]))
          );
        } else {
          // Mitarbeiter: Nur eigene Schichten
          promises.push(
            getMyShifts({ includeCompleted: true })
              .then((res) => setMyShifts(res.shifts))
              .catch(() => setMyShifts([]))
          );
        }
      }

      if (includeTimeEntries) {
        promises.push(
          getEntries(100)
            .then((res) => setTimeEntries(res.entries))
            .catch(() => setTimeEntries([]))
        );
      }

      await Promise.all(promises);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [includeShifts, includeTimeEntries, isAdminOrManager]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Konvertiere zu Events basierend auf Rolle
  const events = useMemo(() => {
    let shiftEvents: Record<string, CalendarDayEvent[]> = {};
    
    if (includeShifts) {
      if (isAdminOrManager) {
        // Admin/Manager sehen alle vergebenen Schichten
        shiftEvents = adminShiftsToEvents(adminShifts);
      } else {
        // Mitarbeiter sehen nur eigene angenommene Schichten
        shiftEvents = myShiftsToEvents(myShifts);
      }
    }
    
    const timeEvents = includeTimeEntries ? timeEntriesToEvents(timeEntries) : {};
    return mergeEvents(shiftEvents, timeEvents);
  }, [myShifts, adminShifts, timeEntries, includeShifts, includeTimeEntries, isAdminOrManager]);

  return {
    events,
    loading,
    error,
    refetch: fetchData,
  };
}
