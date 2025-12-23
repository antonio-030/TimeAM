/**
 * Firebase Client SDK – Public API
 *
 * Zentrale Exports für Firebase im Frontend.
 */

// App
export { initializeFirebaseApp, getFirebaseApp } from './app';

// Auth
export {
  getFirebaseAuth,
  getIdToken,
  onAuthStateChange,
  signOut,
  getCurrentUser,
} from './auth';

// Analytics (optional)
export { initializeAnalytics, getFirebaseAnalytics } from './analytics';

// Config (für Debugging)
export { firebaseConfig, validateFirebaseConfig } from './config';

