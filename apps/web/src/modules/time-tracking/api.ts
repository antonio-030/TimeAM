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
