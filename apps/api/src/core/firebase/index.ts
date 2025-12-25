/**
 * Firebase Admin SDK – Public API
 *
 * Zentrale Exports für Firebase im Backend.
 */

// Admin App
export {
  initializeFirebaseAdmin,
  getAdminApp,
  getAdminAuth,
  getAdminFirestore,
  getAdminStorage,
} from './admin.js';

// Config
export {
  getFirebaseAdminConfig,
  validateFirebaseAdminConfig,
  type FirebaseAdminConfig,
} from './config.js';

