/**
 * Firebase App Check
 *
 * Initialisiert Firebase App Check mit reCAPTCHA v3.
 * Schützt die API vor Requests von nicht-autorisierten Clients.
 */

import { 
  initializeAppCheck as firebaseInitializeAppCheck, 
  ReCaptchaV3Provider,
  // @ts-expect-error - Firebase types are namespaces, but we need them as types
  type AppCheck,
} from 'firebase/app-check';
import { getFirebaseApp } from './app';

let appCheck: AppCheck | null = null;
let appCheckInitialized = false;
let appCheckDisabled = false;

/**
 * Deaktiviert App Check temporär (z.B. für Phone Auth).
 * WICHTIG: App Check wird deaktiviert, um Konflikte mit reCAPTCHA v2 zu vermeiden.
 */
export function disableAppCheck(): void {
  appCheckDisabled = true;
  console.log('⚠️  App Check temporär deaktiviert (für Phone Auth)');
}

/**
 * Aktiviert App Check wieder (nach Phone Auth).
 */
export function enableAppCheck(): void {
  appCheckDisabled = false;
  console.log('✅ App Check wieder aktiviert');
}

/**
 * Initialisiert Firebase App Check mit reCAPTCHA v3.
 * Wird einmal beim App-Start aufgerufen.
 * WICHTIG: App Check wird nicht initialisiert, wenn es deaktiviert ist (z.B. für Phone Auth).
 */
export function initializeAppCheck(): AppCheck | null {
  // Wenn bereits initialisiert, zurückgeben
  if (appCheck) {
    return appCheck;
  }

  // Wenn App Check deaktiviert ist, nicht initialisieren
  if (appCheckDisabled) {
    console.log('⚠️  App Check ist deaktiviert (für Phone Auth) - wird nicht initialisiert');
    return null;
  }

  // Prüfe, ob reCAPTCHA v3 Site Key vorhanden ist
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY_V3;
  
  if (!recaptchaSiteKey) {
    // App Check ist optional - nur warnen, nicht blockieren
    console.warn('⚠️  VITE_RECAPTCHA_SITE_KEY_V3 nicht gesetzt. App Check wird nicht aktiviert.');
    return null;
  }

  try {
    const app = getFirebaseApp();
    
    // ReCAPTCHA v3 Provider erstellen
    const provider = new ReCaptchaV3Provider(recaptchaSiteKey);
    
    // App Check initialisieren (Firebase-Funktion mit umbenanntem Import)
    appCheck = firebaseInitializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true, // Token wird automatisch erneuert (Standard: 1 Stunde)
    });

    appCheckInitialized = true;
    console.log('✅ Firebase App Check initialisiert (reCAPTCHA v3)');
    return appCheck;
  } catch (error) {
    console.error('❌ Fehler beim Initialisieren von App Check:', error);
    // Graceful degradation: App Check Fehler blockieren nicht
    return null;
  }
}

/**
 * Gibt das App Check Token zurück.
 * Wird bei API-Requests verwendet.
 * 
 * @returns App Check Token oder null, wenn App Check nicht aktiviert ist
 */
export async function getAppCheckTokenValue(): Promise<string | null> {
  if (!appCheck) {
    return null;
  }

  try {
    // In Firebase v10 wird getToken() auf der AppCheck-Instanz verwendet
    // Versuche verschiedene Methoden, um das Token zu erhalten
    
    // Methode 1: getToken() auf der AppCheck-Instanz
    if (appCheck && typeof (appCheck as any).getToken === 'function') {
      try {
        const tokenResult = await (appCheck as any).getToken();
        if (tokenResult?.token) {
          return tokenResult.token;
        }
      } catch (tokenError) {
        // Ignoriere Token-Fehler
      }
    }
    
    // Methode 2: Direkter Import (falls verfügbar)
    try {
      const appCheckModule = await import('firebase/app-check');
      if ('getToken' in appCheckModule && typeof appCheckModule.getToken === 'function') {
        const tokenResult = await appCheckModule.getToken(appCheck);
        if (tokenResult?.token) {
          return tokenResult.token;
        }
      }
    } catch (importError) {
      // Ignoriere Import-Fehler
    }
    
    // Für jetzt: App Check Token ist optional - Warnung unterdrücken
    // Das Token wird automatisch bei Bedarf von Firebase generiert
    return null;
  } catch (error) {
    // Graceful degradation: App Check Fehler blockieren nicht
    // Token ist optional - App funktioniert auch ohne
    return null;
  }
}

/**
 * Gibt die App Check Instanz zurück.
 */
export function getFirebaseAppCheck(): AppCheck | null {
  return appCheck;
}
