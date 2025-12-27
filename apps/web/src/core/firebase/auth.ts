/**
 * Firebase Authentication
 *
 * Wrapper für Firebase Auth mit Hilfsfunktionen.
 * Das Frontend nutzt nur Firebase Auth – keine direkten Firestore-Zugriffe.
 */

import {
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'firebase/auth';
// @ts-ignore - Firebase exports types as namespaces, extract types from function returns
type Auth = ReturnType<typeof getAuth>;
type User = Auth['currentUser'] extends infer U ? (U extends null ? null : NonNullable<U>) : never;
type Unsubscribe = ReturnType<typeof onAuthStateChanged>;
import { getFirebaseApp } from './app';

let auth: Auth | null = null;

/**
 * Gibt die Firebase Auth Instanz zurück (Singleton).
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    const app = getFirebaseApp();
    auth = getAuth(app);
  }
  return auth;
}

/**
 * Holt den aktuellen ID Token für API-Requests.
 * Gibt null zurück, wenn kein User eingeloggt ist.
 *
 * @param forceRefresh - Token neu vom Server holen (bei Claim-Änderungen)
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) {
    return null;
  }
  return currentUser.getIdToken(forceRefresh);
}

/**
 * Registriert einen Listener für Auth-State-Änderungen.
 *
 * @returns Unsubscribe-Funktion
 */
export function onAuthStateChange(
  callback: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

/**
 * Loggt den aktuellen User aus.
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

/**
 * Gibt den aktuellen User zurück oder null.
 */
export function getCurrentUser(): User | null {
  return getFirebaseAuth().currentUser;
}

