/**
 * Time Tracking API Client
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../../core/api';

/** TimeEntry Response */
export interface TimeEntry {
  id: string;
  uid: string;
  email: string;
  clockIn: string;
  clockOut: string | null;
  status: 'running' | 'completed';
  durationMinutes: number | null;
  note?: string;
}

/** Status Response */
export interface TimeTrackingStatus {
  isRunning: boolean;
  runningEntry: TimeEntry | null;
  today: {
    totalMinutes: number;
    entriesCount: number;
  };
}

/** Entries List Response */
export interface TimeEntriesResponse {
  entries: TimeEntry[];
  count: number;
}

/** Clock In/Out Response */
export interface ClockResponse {
  message: string;
  entry: TimeEntry;
}

/** Entry Response */
export interface EntryResponse {
  message?: string;
  entry: TimeEntry;
}

/** Delete Response */
export interface DeleteResponse {
  success: boolean;
  message?: string;
}

/** Create Entry Request */
export interface CreateTimeEntryRequest {
  clockIn: string;
  clockOut: string;
  note?: string;
}

/** Update Entry Request */
export interface UpdateTimeEntryRequest {
  clockIn?: string;
  clockOut?: string;
  note?: string;
}

/**
 * Holt den aktuellen Status.
 */
export function getStatus(): Promise<TimeTrackingStatus> {
  return apiGet<TimeTrackingStatus>('/api/time-tracking/status');
}

/**
 * Clock-In.
 */
export function clockIn(note?: string): Promise<ClockResponse> {
  return apiPost<ClockResponse>('/api/time-tracking/clock-in', { note });
}

/**
 * Clock-Out.
 */
export function clockOut(note?: string): Promise<ClockResponse> {
  return apiPost<ClockResponse>('/api/time-tracking/clock-out', { note });
}

/**
 * Holt TimeEntries.
 */
export function getEntries(limit = 50): Promise<TimeEntriesResponse> {
  return apiGet<TimeEntriesResponse>(`/api/time-tracking/entries?limit=${limit}`);
}

/**
 * Holt einen einzelnen TimeEntry.
 */
export function getEntry(entryId: string): Promise<EntryResponse> {
  return apiGet<EntryResponse>(`/api/time-tracking/entries/${entryId}`);
}

/**
 * Erstellt einen manuellen TimeEntry.
 */
export function createEntry(data: CreateTimeEntryRequest): Promise<EntryResponse> {
  return apiPost<EntryResponse>('/api/time-tracking/entries', data);
}

/**
 * Aktualisiert einen TimeEntry.
 */
export function updateEntry(entryId: string, data: UpdateTimeEntryRequest): Promise<EntryResponse> {
  return apiPut<EntryResponse>(`/api/time-tracking/entries/${entryId}`, data);
}

/**
 * Löscht einen TimeEntry.
 */
export function deleteEntry(entryId: string): Promise<DeleteResponse> {
  return apiDelete<DeleteResponse>(`/api/time-tracking/entries/${entryId}`);
}

// =============================================================================
// Time Account API
// =============================================================================

import type {
  TimeAccount,
  TimeAccountTarget,
  TimeAccountResponse,
  TimeAccountHistoryResponse,
  TimeAccountTargetResponse,
  UpdateTimeAccountTargetRequest,
  AddTimeAccountAdjustmentRequest,
  TimeAccount,
  TimeAccountTarget,
} from '@timeam/shared';

/**
 * Holt das Zeitkonto für einen Monat.
 */
export function getTimeAccount(year: number, month: number): Promise<TimeAccountResponse> {
  return apiGet<TimeAccountResponse>(`/api/time-tracking/time-account/${year}/${month}`);
}

/**
 * Holt die Historie der Zeitkonten.
 */
export function getTimeAccountHistory(limit = 12): Promise<TimeAccountHistoryResponse> {
  return apiGet<TimeAccountHistoryResponse>(`/api/time-tracking/time-account/history?limit=${limit}`);
}

/**
 * Holt die Zielstunden für einen User.
 */
export function getTimeAccountTarget(userId: string): Promise<TimeAccountTargetResponse> {
  return apiGet<TimeAccountTargetResponse>(`/api/time-tracking/time-account/target/${userId}`);
}

/**
 * Setzt die Zielstunden für einen User.
 */
export function updateTimeAccountTarget(
  userId: string,
  monthlyTargetHours: number,
  employmentType?: import('@timeam/shared').EmploymentType,
  weeklyHours?: number
): Promise<TimeAccountTargetResponse> {
  return apiPut<TimeAccountTargetResponse>('/api/time-tracking/time-account/target', {
    userId,
    monthlyTargetHours,
    employmentType,
    weeklyHours,
  });
}

// Export Types für Hooks
export type { TimeAccount, TimeAccountTarget };

/**
 * Fügt eine manuelle Anpassung hinzu.
 */
export function addTimeAccountAdjustment(
  year: number,
  month: number,
  data: AddTimeAccountAdjustmentRequest & { userId: string }
): Promise<TimeAccountResponse> {
  return apiPost<TimeAccountResponse>(
    `/api/time-tracking/time-account/${year}/${month}/adjust`,
    data
  );
}

/**
 * Exportiert Zeitkonto-Daten (DSGVO).
 */
export function exportTimeAccountData(
  format: 'json' | 'csv' = 'json',
  startYear?: number,
  startMonth?: number,
  endYear?: number,
  endMonth?: number
): Promise<TimeAccountHistoryResponse | Blob> {
  const params = new URLSearchParams();
  params.set('format', format);
  if (startYear !== undefined) params.set('startYear', startYear.toString());
  if (startMonth !== undefined) params.set('startMonth', startMonth.toString());
  if (endYear !== undefined) params.set('endYear', endYear.toString());
  if (endMonth !== undefined) params.set('endMonth', endMonth.toString());

  if (format === 'csv') {
    // CSV als Blob zurückgeben
    return fetch(`/api/time-tracking/time-account/export?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
    }).then((res) => res.blob());
  }

  return apiGet<TimeAccountHistoryResponse>(`/api/time-tracking/time-account/export?${params.toString()}`);
}