/**
 * Calendar Core Types (Backend)
 *
 * Interne Typen für das Kalender-Modul.
 */

import type { Timestamp } from 'firebase-admin/firestore';

/**
 * TimeEntry Dokument (aus time-tracking).
 * Reduzierte Fassung für Kalender-Queries.
 */
export interface TimeEntryDocForCalendar {
  uid: string;
  email: string;
  clockIn: Timestamp;
  clockOut: Timestamp | null;
  status: 'running' | 'completed';
  durationMinutes: number | null;
  note?: string;
}

/**
 * Shift Dokument (aus shift-pool).
 * Reduzierte Fassung für Kalender-Queries.
 */
export interface ShiftDocForCalendar {
  title: string;
  location: {
    name: string;
    address?: string;
  };
  startsAt: Timestamp;
  endsAt: Timestamp;
  requiredCount: number;
  filledCount: number;
  status: string;
  createdByUid: string;
}

/**
 * Query-Parameter für getCalendarEvents.
 */
export interface CalendarQueryParams {
  from: Date;
  to: Date;
  includeModules?: string[];
}
