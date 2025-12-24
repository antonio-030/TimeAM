/**
 * Firebase Admin SDK Initialization
 *
 * Zentrale Initialisierung des Admin SDK.
 * Stellt Zugriff auf Auth, Firestore und Storage bereit.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let app: App | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let storageInstance: Storage | null = null;

/**
 * Initialisiert die Firebase Admin App (Singleton).
 */
export function initializeFirebaseAdmin(): App {
  if (app) {
    return app;
  }

  // Prüfe, ob bereits initialisiert (z.B. durch Tests)
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  // Helper: Bestimmt Storage Bucket Name
  const getStorageBucket = (serviceAccount?: { project_id?: string }): string | undefined => {
    // 1. Explizite ENV-Variable (höchste Priorität)
    if (storageBucket) {
      return storageBucket;
    }
    // 2. Neues Firebase Storage Format (project_id.firebasestorage.app)
    if (serviceAccount?.project_id) {
      return `${serviceAccount.project_id}.firebasestorage.app`;
    }
    // 3. Fallback: Altes Format (project_id.appspot.com)
    if (serviceAccount?.project_id) {
      return `${serviceAccount.project_id}.appspot.com`;
    }
    // 4. Aus Project ID (neues Format)
    if (projectId) {
      return `${projectId}.firebasestorage.app`;
    }
    return undefined;
  };

  // Option 1: Service Account als JSON String (für Cloud Deployments)
  if (serviceAccountJson) {
    console.log('🔐 Firebase Admin: Using FIREBASE_SERVICE_ACCOUNT env');
    const serviceAccount = JSON.parse(serviceAccountJson);
    const bucket = getStorageBucket(serviceAccount);
    
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId || serviceAccount.project_id,
      storageBucket: bucket,
    });
    
    if (bucket) {
      console.log(`📦 Storage bucket: ${bucket}`);
    }
    return app;
  }

  // Option 2: Service Account aus Datei laden
  if (credentialsPath) {
    // Pfad relativ zum API-Verzeichnis auflösen
    const absolutePath = resolve(process.cwd(), credentialsPath);
    console.log(`🔐 Firebase Admin: Loading service account from ${absolutePath}`);

    try {
      const serviceAccountContent = readFileSync(absolutePath, 'utf-8');
      const serviceAccount = JSON.parse(serviceAccountContent);
      const bucket = getStorageBucket(serviceAccount);

      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: projectId || serviceAccount.project_id,
        storageBucket: bucket,
      });

      console.log(`✅ Firebase Admin initialized for project: ${serviceAccount.project_id}`);
      if (bucket) {
        console.log(`📦 Storage bucket: ${bucket}`);
      }
      return app;
    } catch (error) {
      console.error(`❌ Failed to load service account from ${absolutePath}:`, error);
      throw new Error(`Cannot load Firebase service account: ${absolutePath}`);
    }
  }

  // Fallback: Nur Project ID (für GCP mit impliziten Credentials)
  if (projectId) {
    console.log(`🔐 Firebase Admin: Using project ID only (${projectId})`);
    const bucket = getStorageBucket();
    app = initializeApp({ 
      projectId,
      storageBucket: bucket,
    });
    if (bucket) {
      console.log(`📦 Storage bucket: ${bucket}`);
    }
    return app;
  }

  throw new Error(
    'Firebase Admin SDK: No credentials configured. ' +
    'Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.'
  );
}

/**
 * Gibt die Firebase Admin App zurück.
 */
export function getAdminApp(): App {
  if (!app) {
    throw new Error(
      'Firebase Admin not initialized. Call initializeFirebaseAdmin() first.'
    );
  }
  return app;
}

/**
 * Gibt die Firebase Auth Admin Instanz zurück.
 */
export function getAdminAuth(): Auth {
  if (!authInstance) {
    getAdminApp(); // Sicherstellen, dass initialisiert
    authInstance = getAuth();
  }
  return authInstance;
}

/**
 * Gibt die Firestore Admin Instanz zurück.
 */
export function getAdminFirestore(): Firestore {
  if (!firestoreInstance) {
    getAdminApp(); // Sicherstellen, dass initialisiert
    firestoreInstance = getFirestore();
  }
  return firestoreInstance;
}

/**
 * Gibt die Storage Admin Instanz zurück.
 */
export function getAdminStorage(): Storage {
  if (!storageInstance) {
    getAdminApp(); // Sicherstellen, dass initialisiert
    storageInstance = getStorage();
  }
  return storageInstance;
}
