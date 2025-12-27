/// <reference types="vite/client" />

// Suppress Firebase type errors - Firebase v10 includes its own types
declare module 'firebase/app';
declare module 'firebase/auth';
declare module 'firebase/analytics';
declare module 'firebase/app-check';

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_RECAPTCHA_SITE_KEY_V2?: string;
  readonly VITE_RECAPTCHA_SITE_KEY_V3?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

