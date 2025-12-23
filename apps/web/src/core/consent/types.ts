/**
 * Consent Types
 * 
 * Typen für die DSGVO-konforme Einwilligungsverwaltung.
 */

/** Einwilligungseinstellungen des Nutzers */
export interface ConsentSettings {
  /** Notwendige Cookies - immer aktiv, nicht abwählbar */
  necessary: true;
  /** Analytics/Statistik-Cookies (z.B. Firebase Analytics) */
  analytics: boolean;
  /** Marketing/Werbe-Cookies */
  marketing: boolean;
  /** Zeitstempel der Einwilligung */
  timestamp: string;
  /** Version der Consent-Konfiguration */
  version: string;
}

/** Consent Context Type */
export interface ConsentContextType {
  /** Aktuelle Einstellungen (null = noch keine Entscheidung) */
  settings: ConsentSettings | null;
  /** Wurde bereits eine Entscheidung getroffen? */
  hasDecided: boolean;
  /** Alle Cookies akzeptieren */
  acceptAll: () => void;
  /** Nur notwendige Cookies akzeptieren */
  acceptNecessary: () => void;
  /** Benutzerdefinierte Einstellungen speichern */
  saveSettings: (settings: Partial<Omit<ConsentSettings, 'necessary' | 'timestamp' | 'version'>>) => void;
  /** Einstellungen zurücksetzen (Banner erneut zeigen) */
  resetConsent: () => void;
  /** Prüfen ob bestimmte Kategorie erlaubt ist */
  isAllowed: (category: keyof Omit<ConsentSettings, 'timestamp' | 'version'>) => boolean;
}

/** LocalStorage Key für Consent */
export const CONSENT_STORAGE_KEY = 'timeam_consent';

/** Aktuelle Version der Consent-Konfiguration */
export const CONSENT_VERSION = '1.0';
