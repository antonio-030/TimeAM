/**
 * Calendar Core API Client
 *
 * API-Aufrufe für das Kalender-Modul.
 */

import { apiGet } from '../../core/api';
import type { CalendarEventsResponse, CalendarSourceModule } from '@timeam/shared';

/**
 * Lädt Kalender-Events für einen Zeitraum.
 */
export async function fetchCalendarEvents(params: {
  from: Date;
  to: Date;
  includeModules?: CalendarSourceModule[];
}): Promise<CalendarEventsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('from', params.from.toISOString());
  searchParams.set('to', params.to.toISOString());

  if (params.includeModules && params.includeModules.length > 0) {
    searchParams.set('includeModules', params.includeModules.join(','));
  }

  return apiGet<CalendarEventsResponse>(
    `/api/calendar/events?${searchParams.toString()}`
  );
}
