/**
 * Calendar Core Service
 *
 * Aggregiert Events aus verschiedenen Modulen für die Kalenderansicht.
 */

import { getAdminFirestore } from '../../core/firebase/index.js';
import { Timestamp } from 'firebase-admin/firestore';
import type {
  CalendarEvent,
  CalendarSourceModule,
  CalendarEventsResponse,
} from '@timeam/shared';
import type {
  TimeEntryDocForCalendar,
  ShiftDocForCalendar,
  CalendarQueryParams,
} from './types';

// =============================================================================
// Shift Pool Events
// =============================================================================

/**
 * Lädt veröffentlichte Schichten für den Kalender.
 * 
 * Query-Logik: status == PUBLISHED AND startsAt < to AND endsAt > from (Overlap)
 * 
 * MVP-Lösung: Nur auf status filtern, Datum clientseitig prüfen.
 * Das vermeidet die Notwendigkeit eines Composite Index.
 * 
 * Für Production: Composite Index erstellen oder denormalisiertes Read-Model.
 */
async function getShiftPoolEvents(
  tenantId: string,
  requestingUid: string,
  params: CalendarQueryParams
): Promise<CalendarEvent[]> {
  const db = getAdminFirestore();

  // Query: Nur auf status filtern (kein Composite Index nötig)
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shifts')
    .where('status', '==', 'PUBLISHED')
    .get();

  const events: CalendarEvent[] = [];
  const fromTs = params.from.getTime();
  const toTs = params.to.getTime();

  // User-Bewerbungen laden für myApplicationStatus
  const appSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .where('uid', '==', requestingUid)
    .get();

  const userApps = new Map<string, string>();
  appSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    userApps.set(data.shiftId, data.status);
  });

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as ShiftDocForCalendar;
    const startsAtMs = data.startsAt.toMillis();
    const endsAtMs = data.endsAt.toMillis();

    // Client-seitig: Overlap-Prüfung (startsAt < to AND endsAt > from)
    if (startsAtMs >= toTs || endsAtMs <= fromTs) {
      return;
    }

    const freeSlots = data.requiredCount - data.filledCount;

    events.push({
      id: `shift-pool:${doc.id}`,
      title: data.title,
      startsAt: data.startsAt.toDate().toISOString(),
      endsAt: data.endsAt.toDate().toISOString(),
      sourceModule: 'shift-pool',
      ref: {
        type: 'shift',
        id: doc.id,
      },
      location: data.location.name,
      status: data.status,
      meta: {
        freeSlots,
        myApplicationStatus: userApps.get(doc.id),
      },
    });
  });

  return events;
}

// =============================================================================
// Time Tracking Events
// =============================================================================

/**
 * Lädt Arbeitszeiten des Users für den Kalender.
 * 
 * Query-Logik: clockIn < to AND (clockOut > from OR clockOut IS NULL)
 * 
 * MVP-Lösung: Query auf uid, dann clientseitig filtern.
 */
async function getTimeTrackingEvents(
  tenantId: string,
  requestingUid: string,
  params: CalendarQueryParams
): Promise<CalendarEvent[]> {
  const db = getAdminFirestore();

  // Query: Alle Einträge des Users
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .where('uid', '==', requestingUid)
    .get();

  const events: CalendarEvent[] = [];
  const fromMs = params.from.getTime();
  const toMs = params.to.getTime();

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as TimeEntryDocForCalendar;
    const clockInMs = data.clockIn.toMillis();
    
    // clockIn muss vor to liegen
    if (clockInMs >= toMs) {
      return;
    }

    // clockOut muss nach from liegen (oder NULL für laufende)
    if (data.clockOut) {
      const clockOutMs = data.clockOut.toMillis();
      if (clockOutMs <= fromMs) {
        return;
      }
    }

    const isRunning = data.status === 'running';
    const endsAt = data.clockOut
      ? data.clockOut.toDate().toISOString()
      : new Date().toISOString(); // Laufende: bis jetzt

    events.push({
      id: `time-tracking:${doc.id}`,
      title: isRunning ? 'Arbeitszeit (läuft)' : 'Arbeitszeit',
      startsAt: data.clockIn.toDate().toISOString(),
      endsAt,
      sourceModule: 'time-tracking',
      ref: {
        type: 'timeEntry',
        id: doc.id,
      },
      status: data.status,
      meta: {
        durationMinutes: data.durationMinutes ?? undefined,
        isRunning,
      },
    });
  });

  return events;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Lädt Kalender-Events aus allen aktivierten Modulen.
 */
export async function getCalendarEvents(
  tenantId: string,
  requestingUid: string,
  entitlements: Record<string, boolean | string | number>,
  params: CalendarQueryParams
): Promise<CalendarEventsResponse> {
  const events: CalendarEvent[] = [];
  const loadedModules: CalendarSourceModule[] = [];

  // Module-Filter anwenden
  const includeShiftPool =
    (!params.includeModules || params.includeModules.includes('shift-pool')) &&
    entitlements['module.shift_pool'] === true;

  const includeTimeTracking =
    (!params.includeModules || params.includeModules.includes('time-tracking')) &&
    entitlements['module.time_tracking'] === true;

  // Events parallel laden
  const promises: Promise<CalendarEvent[]>[] = [];

  if (includeShiftPool) {
    promises.push(getShiftPoolEvents(tenantId, requestingUid, params));
    loadedModules.push('shift-pool');
  }

  if (includeTimeTracking) {
    promises.push(getTimeTrackingEvents(tenantId, requestingUid, params));
    loadedModules.push('time-tracking');
  }

  const results = await Promise.all(promises);
  results.forEach((moduleEvents) => {
    events.push(...moduleEvents);
  });

  // Nach Startzeit sortieren
  events.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  return {
    events,
    count: events.length,
    range: {
      from: params.from.toISOString(),
      to: params.to.toISOString(),
    },
    loadedModules,
  };
}
