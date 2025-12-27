/**
 * Auth Context
 *
 * React Context für Auth-State Management.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
// @ts-expect-error - Firebase types are namespaces, but we need them as types
import type { User } from 'firebase/auth';
import {
  onAuthStateChange,
  signOut as firebaseSignOut,
  getFirebaseAuth,
} from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { logAuthEvent } from '../api/auth-logging';

/**
 * Auth Context State.
 */
interface AuthContextValue {
  /** Aktueller Firebase User (oder null) */
  user: User | null;

  /** Wird Auth-State noch geladen? */
  loading: boolean;

  /** Letzter Fehler */
  error: string | null;

  /** Login mit Email/Password */
  signIn: (email: string, password: string) => Promise<void>;

  /** Registrierung mit Email/Password */
  signUp: (email: string, password: string) => Promise<void>;

  /** Logout */
  signOut: () => Promise<void>;

  /** Fehler zurücksetzen */
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth Provider Props.
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider Component.
 *
 * Wraps die App und stellt Auth-Funktionen bereit.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Login
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // User-State sofort aktualisieren (onAuthStateChanged könnte verzögert sein)
      setUser(userCredential.user);
      setLoading(false);
      
      // Erfolgreichen Login loggen (Fehler ignorieren, sollte Login nicht blockieren)
      try {
        await logAuthEvent({
          eventType: 'auth.login.success',
          email,
          userId: userCredential.user.uid,
        });
      } catch (loggingError) {
        // Logging-Fehler ignorieren, sollte erfolgreichen Login nicht blockieren
        console.warn('Failed to log successful login:', loggingError);
      }
    } catch (err) {
      const message = getAuthErrorMessage(err);
      
      // Fehlgeschlagenen Login loggen (mit Rate-Limiting)
      // WICHTIG: Logging-Fehler sollten den Login-Flow nicht blockieren
      try {
        await logAuthEvent({
          eventType: 'auth.login.failed',
          email,
          errorMessage: message,
        });
      } catch (rateLimitError: any) {
        // Rate-Limit-Fehler weiterwerfen (sollte den Login blockieren)
        if (rateLimitError.code === 'RATE_LIMIT_EXCEEDED') {
          setError(rateLimitError.message || 'Zu viele fehlgeschlagene Login-Versuche. Bitte später erneut versuchen.');
          setLoading(false);
          throw rateLimitError;
        }
        // Andere Logging-Fehler ignorieren (sollten den Login nicht blockieren)
        console.warn('Failed to log auth event:', rateLimitError);
      }
      
      setError(message);
      setLoading(false);
      throw new Error(message);
    }
  }, []);

  // Registrierung
  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // User-State sofort aktualisieren (onAuthStateChanged könnte verzögert sein)
      setUser(userCredential.user);
      setLoading(false);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      setLoading(false);
      throw new Error(message);
    }
  }, []);

  // Logout
  const signOut = useCallback(async () => {
    setError(null);

    try {
      const currentUser = getFirebaseAuth().currentUser;
      await firebaseSignOut();
      
      // Logout loggen
      if (currentUser) {
        await logAuthEvent({
          eventType: 'auth.logout',
          email: currentUser.email || undefined,
          userId: currentUser.uid,
        });
      }
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Error zurücksetzen
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    clearError,
  }), [user, loading, error, signIn, signUp, signOut, clearError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook für Auth Context.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Übersetzt Firebase Auth Fehler in benutzerfreundliche Nachrichten.
 */
function getAuthErrorMessage(error: unknown): string {
  const firebaseError = error as { code?: string; message?: string };

  switch (firebaseError.code) {
    case 'auth/invalid-email':
      return 'Ungültige E-Mail-Adresse';
    case 'auth/user-disabled':
      return 'Dieser Account wurde deaktiviert';
    case 'auth/user-not-found':
      return 'Kein Account mit dieser E-Mail gefunden';
    case 'auth/wrong-password':
      return 'Falsches Passwort';
    case 'auth/invalid-credential':
      return 'Ungültige Anmeldedaten';
    case 'auth/email-already-in-use':
      return 'Diese E-Mail wird bereits verwendet';
    case 'auth/weak-password':
      return 'Passwort ist zu schwach (min. 6 Zeichen)';
    case 'auth/too-many-requests':
      return 'Zu viele Versuche. Bitte später erneut versuchen.';
    default:
      return firebaseError.message || 'Ein Fehler ist aufgetreten';
  }
}

