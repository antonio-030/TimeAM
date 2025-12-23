/**
 * Consent Context
 * 
 * React Context für DSGVO-konforme Einwilligungsverwaltung.
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { ConsentSettings, ConsentContextType } from './types';
import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from './types';

const ConsentContext = createContext<ConsentContextType | null>(null);

interface ConsentProviderProps {
  children: ReactNode;
}

/**
 * Lädt gespeicherte Consent-Einstellungen aus LocalStorage.
 */
function loadStoredConsent(): ConsentSettings | null {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as ConsentSettings;
    
    // Prüfe Version - bei neuer Version erneute Zustimmung erforderlich
    if (parsed.version !== CONSENT_VERSION) {
      localStorage.removeItem(CONSENT_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Speichert Consent-Einstellungen in LocalStorage.
 */
function saveConsent(settings: ConsentSettings): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save consent settings:', error);
  }
}

/**
 * Consent Provider Komponente.
 */
export function ConsentProvider({ children }: ConsentProviderProps) {
  const [settings, setSettings] = useState<ConsentSettings | null>(() => loadStoredConsent());

  // Alle Cookies akzeptieren
  const acceptAll = useCallback(() => {
    const newSettings: ConsentSettings = {
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    setSettings(newSettings);
    saveConsent(newSettings);
  }, []);

  // Nur notwendige Cookies
  const acceptNecessary = useCallback(() => {
    const newSettings: ConsentSettings = {
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    setSettings(newSettings);
    saveConsent(newSettings);
  }, []);

  // Benutzerdefinierte Einstellungen
  const saveSettings = useCallback((customSettings: Partial<Omit<ConsentSettings, 'necessary' | 'timestamp' | 'version'>>) => {
    const newSettings: ConsentSettings = {
      necessary: true,
      analytics: customSettings.analytics ?? false,
      marketing: customSettings.marketing ?? false,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    setSettings(newSettings);
    saveConsent(newSettings);
  }, []);

  // Consent zurücksetzen
  const resetConsent = useCallback(() => {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    setSettings(null);
  }, []);

  // Prüfen ob Kategorie erlaubt
  const isAllowed = useCallback((category: keyof Omit<ConsentSettings, 'timestamp' | 'version'>): boolean => {
    if (!settings) return false;
    return settings[category];
  }, [settings]);

  const value = useMemo<ConsentContextType>(() => ({
    settings,
    hasDecided: settings !== null,
    acceptAll,
    acceptNecessary,
    saveSettings,
    resetConsent,
    isAllowed,
  }), [settings, acceptAll, acceptNecessary, saveSettings, resetConsent, isAllowed]);

  return (
    <ConsentContext.Provider value={value}>
      {children}
    </ConsentContext.Provider>
  );
}

/**
 * Hook für Consent-Zugriff.
 */
export function useConsent(): ConsentContextType {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}
