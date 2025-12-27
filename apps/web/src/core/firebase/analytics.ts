/**
 * Firebase Analytics (Optional, DSGVO-konform)
 *
 * Analytics wird nur initialisiert, wenn:
 * - Der Nutzer zugestimmt hat (Consent)
 * - measurementId konfiguriert ist
 * - Browser-Unterstützung vorhanden ist
 */

import {
  getAnalytics,
  isSupported,
  setAnalyticsCollectionEnabled,
  // @ts-expect-error - Firebase types are namespaces, but we need them as types
  type Analytics,
} from 'firebase/analytics';
import { getFirebaseApp } from './app';

let analytics: Analytics | null = null;
let initPromise: Promise<Analytics | null> | null = null;
let consentGiven = false;

/**
 * Initialisiert Firebase Analytics (lazy, guarded, consent-aware).
 * Gibt null zurück, wenn Analytics nicht verfügbar/gewünscht ist.
 * 
 * DSGVO: Analytics wird nur aktiviert, wenn hasConsent = true
 */
export async function initializeAnalytics(hasConsent: boolean = false): Promise<Analytics | null> {
  consentGiven = hasConsent;

  // Ohne Consent nicht initialisieren
  if (!hasConsent) {
    console.info('Firebase Analytics disabled (no consent)');
    // Falls bereits initialisiert, Datensammlung deaktivieren
    if (analytics) {
      setAnalyticsCollectionEnabled(analytics, false);
    }
    return null;
  }

  // Bereits initialisiert - nur Collection aktivieren
  if (analytics) {
    setAnalyticsCollectionEnabled(analytics, true);
    return analytics;
  }

  // Bereits in Initialisierung
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Prüfe Browser-Unterstützung
      const supported = await isSupported();
      if (!supported) {
        console.info('Firebase Analytics not supported in this browser');
        return null;
      }

      // Prüfe measurementId
      const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
      if (!measurementId) {
        console.info('Firebase Analytics disabled (no measurementId)');
        return null;
      }

      const app = getFirebaseApp();
      analytics = getAnalytics(app);
      
      // Datensammlung basierend auf Consent
      setAnalyticsCollectionEnabled(analytics, consentGiven);
      
      console.info('Firebase Analytics initialized with consent:', consentGiven);

      return analytics;
    } catch (error) {
      console.warn('Failed to initialize Firebase Analytics:', error);
      return null;
    }
  })();

  return initPromise;
}

/**
 * Gibt die Analytics-Instanz zurück (oder null).
 * Nicht-blockierend – gibt null zurück, wenn noch nicht initialisiert.
 */
export function getFirebaseAnalytics(): Analytics | null {
  return analytics;
}

/**
 * Aktualisiert den Consent-Status für Analytics.
 * DSGVO: Erlaubt es, Analytics nachträglich zu aktivieren/deaktivieren.
 */
export function updateAnalyticsConsent(hasConsent: boolean): void {
  consentGiven = hasConsent;
  if (analytics) {
    setAnalyticsCollectionEnabled(analytics, hasConsent);
    console.info('Analytics consent updated:', hasConsent);
  } else if (hasConsent) {
    // Wenn Consent gegeben aber nicht initialisiert, jetzt initialisieren
    initializeAnalytics(true);
  }
}

