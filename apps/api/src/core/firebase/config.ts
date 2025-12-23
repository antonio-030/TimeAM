/**
 * Firebase Admin SDK Configuration
 *
 * Lädt die Konfiguration aus Environment Variables.
 * WICHTIG: Service Account ist ein Secret!
 */

/**
 * Konfigurationsoptionen für Firebase Admin.
 */
export interface FirebaseAdminConfig {
  projectId: string;
  credential: 'applicationDefault' | 'serviceAccount';
  serviceAccountPath?: string;
  serviceAccountJson?: string;
}

/**
 * Lädt die Firebase Admin Konfiguration aus ENV.
 */
export function getFirebaseAdminConfig(): FirebaseAdminConfig {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  // Option 1: GOOGLE_APPLICATION_CREDENTIALS (Pfad zur JSON)
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  // Option 2: FIREBASE_SERVICE_ACCOUNT (JSON als String)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (credentialsPath) {
    return {
      projectId: projectId || '',
      credential: 'applicationDefault',
      serviceAccountPath: credentialsPath,
    };
  }

  if (serviceAccountJson) {
    return {
      projectId: projectId || '',
      credential: 'serviceAccount',
      serviceAccountJson,
    };
  }

  // Fallback: Versuche Application Default Credentials (GCP)
  return {
    projectId: projectId || '',
    credential: 'applicationDefault',
  };
}

/**
 * Validiert die Firebase Admin Konfiguration.
 */
export function validateFirebaseAdminConfig(): void {
  const hasCredentialsPath = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasServiceAccountJson = !!process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!hasCredentialsPath && !hasServiceAccountJson) {
    console.warn(
      'Warning: No Firebase credentials configured. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT. ' +
        'Falling back to Application Default Credentials.'
    );
  }
}

