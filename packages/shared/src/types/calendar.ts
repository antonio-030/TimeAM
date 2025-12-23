/**
 * Calendar Types (Shared)
 *
 * Gemeinsame Typen für das Kalender-Core-Modul.
 */

// =============================================================================
// Source Module Types
// =============================================================================

/**
 * Module, die Events zum Kalender liefern können.
 */
export const CALENDAR_SOURCE_MODULES = {
  TIME_TRACKING: 'time-tracking',
  SHIFT_POOL: 'shift-pool',
} as const;

export type CalendarSourceModule =
  (typeof CALENDAR_SOURCE_MODULES)[keyof typeof CALENDAR_SOURCE_MODULES];

/**
 * Event-Referenz-Typen.
 */
export const CALENDAR_EVENT_REF_TYPES = {
  SHIFT: 'shift',
  TIME_ENTRY: 'timeEntry',
} as const;

export type CalendarEventRefType =
  (typeof CALENDAR_EVENT_REF_TYPES)[keyof typeof CALENDAR_EVENT_REF_TYPES];

// =============================================================================
// Calendar Event DTO
// =============================================================================

/**
 * Referenz auf das Quelldokument.
 */
export interface CalendarEventRef {
  /** Typ der Referenz */
  type: CalendarEventRefType;
  /** ID des referenzierten Dokuments */
  id: string;
}

/**
 * Kalender-Event DTO.
 * 
 * Wird vom Backend aggregiert und ans Frontend geliefert.
 */
export interface CalendarEvent {
  /** Eindeutige ID (zusammengesetzt aus sourceModule + ref.id) */
  id: string;
  
  /** Titel des Events */
  title: string;
  
  /** Startzeit (ISO 8601 UTC) */
  startsAt: string;
  
  /** Endzeit (ISO 8601 UTC) */
  endsAt: string;
  
  /** Quell-Modul */
  sourceModule: CalendarSourceModule;
  
  /** Referenz auf Quelldokument */
  ref: CalendarEventRef;
  
  /** Ort (optional) */
  location?: string;
  
  /** Status (optional, modulspezifisch) */
  status?: string;
  
  /** Zusätzliche Metadaten (optional, klein halten) */
  meta?: CalendarEventMeta;
}

/**
 * Optionale Metadaten für Events.
 * Modulspezifisch, aber typisiert.
 */
export interface CalendarEventMeta {
  /** Für Schichten: Freie Plätze */
  freeSlots?: number;
  /** Für Schichten: Eigener Bewerbungsstatus */
  myApplicationStatus?: string;
  /** Für Arbeitszeiten: Dauer in Minuten */
  durationMinutes?: number;
  /** Für Arbeitszeiten: Laufend? */
  isRunning?: boolean;
}

// =============================================================================
// Calendar Query DTO
// =============================================================================

/**
 * Query-Parameter für Kalender-Events.
 */
export interface CalendarQuery {
  /** Start des Zeitraums (ISO 8601 UTC) */
  from: string;
  
  /** Ende des Zeitraums (ISO 8601 UTC) */
  to: string;
  
  /** Nur Events dieser Module laden (optional) */
  includeModules?: CalendarSourceModule[];
  
  /** Timezone für Anzeige (optional, Default: Europe/Berlin) */
  tz?: string;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Response: Kalender-Events Liste.
 */
export interface CalendarEventsResponse {
  /** Liste der Events */
  events: CalendarEvent[];
  
  /** Gesamtanzahl */
  count: number;
  
  /** Angefragter Zeitraum */
  range: {
    from: string;
    to: string;
  };
  
  /** Geladene Module */
  loadedModules: CalendarSourceModule[];
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Prüft, ob ein Source-Modul gültig ist.
 */
export function isValidSourceModule(
  module: string
): module is CalendarSourceModule {
  return Object.values(CALENDAR_SOURCE_MODULES).includes(
    module as CalendarSourceModule
  );
}

/**
 * Prüft, ob eine Event-Referenz gültig ist.
 */
export function isValidEventRefType(
  type: string
): type is CalendarEventRefType {
  return Object.values(CALENDAR_EVENT_REF_TYPES).includes(
    type as CalendarEventRefType
  );
}
