/**
 * Date/Time Utilities
 *
 * Zentrale Funktionen für Datum- und Zeitformatierung.
 * Verwendet immer Berliner Zeitzone (Europe/Berlin).
 */

const TIMEZONE = 'Europe/Berlin';
const LOCALE = 'de-DE';

/**
 * Formatiert ISO-String als Zeit (HH:MM).
 */
export function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString(LOCALE, {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
}

/**
 * Formatiert ISO-String als Datum (TT.MM.JJJJ).
 */
export function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(LOCALE, {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '--';
  }
}

/**
 * Formatiert ISO-String als Datum mit Wochentag (Wochentag, TT.MM.JJJJ).
 */
export function formatDateWithWeekday(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(LOCALE, {
      timeZone: TIMEZONE,
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '--';
  }
}

/**
 * Formatiert ISO-String als kurzes Datum (TT.MM.).
 */
export function formatDateShort(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(LOCALE, {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '--';
  }
}

/**
 * Formatiert ISO-String als Datum und Zeit (TT.MM.JJJJ, HH:MM).
 */
export function formatDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString(LOCALE, {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--';
  }
}

/**
 * Formatiert ISO-String als lange Datum/Zeit-Format (Wochentag, TT.MM.JJJJ, HH:MM).
 */
export function formatDateTimeLong(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString(LOCALE, {
      timeZone: TIMEZONE,
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--';
  }
}

/**
 * Formatiert Wochentag kurz (Mo, Di, etc.).
 */
export function formatWeekday(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(LOCALE, {
      timeZone: TIMEZONE,
      weekday: 'short',
    });
  } catch {
    return '--';
  }
}

/**
 * Formatiert Datum relativ (Heute, Morgen, etc.).
 */
export function formatRelativeDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Vergleiche nur Datum (ohne Zeit)
    const dateStr = date.toLocaleDateString(LOCALE, { timeZone: TIMEZONE });
    const todayStr = today.toLocaleDateString(LOCALE, { timeZone: TIMEZONE });
    const tomorrowStr = tomorrow.toLocaleDateString(LOCALE, { timeZone: TIMEZONE });
    
    if (dateStr === todayStr) return 'Heute';
    if (dateStr === tomorrowStr) return 'Morgen';
    
    return date.toLocaleDateString(LOCALE, { 
      timeZone: TIMEZONE,
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  } catch {
    return isoString;
  }
}

/**
 * Formatiert Schichtzeit zu "HH:MM - HH:MM".
 */
export function formatShiftTime(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)} - ${formatTime(endsAt)}`;
}

/**
 * Gibt die aktuelle Zeit in Berliner Zeitzone zurück.
 */
export function getCurrentTimeInBerlin(): Date {
  const now = new Date();
  // Konvertiere UTC-Zeit zu Berliner Zeit
  const berlinTime = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  return berlinTime;
}

/**
 * Konvertiert ein Datum zu Berliner Zeitzone.
 */
export function toBerlinTime(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const berlinTime = new Date(d.toLocaleString('en-US', { timeZone: TIMEZONE }));
  return berlinTime;
}

