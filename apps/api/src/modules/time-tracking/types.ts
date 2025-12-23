/**
 * Time Tracking Types
 */

import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Status eines TimeEntry.
 */
export const TIME_ENTRY_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
} as const;

export type TimeEntryStatus = (typeof TIME_ENTRY_STATUS)[keyof typeof TIME_ENTRY_STATUS];

/**
 * TimeEntry Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/timeEntries/{entryId}
 */
export interface TimeEntryDoc {
  /** Firebase Auth UID */
  uid: string;
  
  /** E-Mail (für Anzeige) */
  email: string;
  
  /** Clock-In Zeitpunkt */
  clockIn: Timestamp;
  
  /** Clock-Out Zeitpunkt (null wenn noch running) */
  clockOut: Timestamp | null;
  
  /** Status */
  status: TimeEntryStatus;
  
  /** Dauer in Minuten (berechnet bei clock-out) */
  durationMinutes: number | null;
  
  /** Optionale Notiz */
  note?: string;
  
  /** Erstellungsdatum */
  createdAt: Timestamp;
  
  /** Letzte Änderung */
  updatedAt: Timestamp;
}

/**
 * TimeEntry für API Response (serialisiert).
 */
export interface TimeEntryResponse {
  id: string;
  uid: string;
  email: string;
  clockIn: string;
  clockOut: string | null;
  status: TimeEntryStatus;
  durationMinutes: number | null;
  note?: string;
}

/**
 * Request für Clock-In.
 */
export interface ClockInRequest {
  note?: string;
}

/**
 * Request für Clock-Out.
 */
export interface ClockOutRequest {
  note?: string;
}

/**
 * Request für manuellen TimeEntry.
 */
export interface CreateTimeEntryRequest {
  clockIn: string; // ISO string
  clockOut: string; // ISO string
  note?: string;
}

/**
 * Request für TimeEntry Update.
 */
export interface UpdateTimeEntryRequest {
  clockIn?: string; // ISO string
  clockOut?: string; // ISO string
  note?: string;
}

