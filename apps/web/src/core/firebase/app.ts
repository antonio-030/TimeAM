/**
 * Firebase App Initialization
 *
 * Zentrale Initialisierung der Firebase App.
 * Wird einmal beim App-Start aufgerufen.
 */

// @ts-expect-error - Firebase types are namespaces, but we need them as types
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { firebaseConfig, validateFirebaseConfig } from './config';

let app: FirebaseApp | null = null;

/**
 * Initialisiert die Firebase App (Singleton).
 * Kann mehrfach aufgerufen werden, erstellt nur eine Instanz.
 */
export function initializeFirebaseApp(): FirebaseApp {
  if (app) {
    return app;
  }

  // Prüfe, ob bereits eine App existiert (z.B. durch Hot Reload)
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    return app;
  }

  // Validiere Konfiguration
  validateFirebaseConfig();

  // Erstelle neue App
  app = initializeApp(firebaseConfig);

  return app;
}

/**
 * Gibt die Firebase App Instanz zurück.
 * Wirft einen Fehler, wenn die App noch nicht initialisiert wurde.
 */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    throw new Error(
      'Firebase App not initialized. Call initializeFirebaseApp() first.'
    );
  }
  return app;
}

