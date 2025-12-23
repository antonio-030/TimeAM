/**
 * Login Form Component
 *
 * Login/Registrierung im TimeAM Design System.
 */

import { useState, type FormEvent } from 'react';
import { useAuth } from '../core/auth';
import styles from './LoginForm.module.css';

export function LoginForm() {
  const { signIn, signUp, error, loading, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (isRegister) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch {
      // Error wird im Context behandelt
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    clearError();
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <img 
              src="/logo.png" 
              alt="TimeAM Logo" 
              className={styles.logoImage}
            />
          </div>
          <h1 className={styles.title}>
            {isRegister ? 'Account erstellen' : 'Willkommen zurück'}
          </h1>
          <p className={styles.subtitle}>
            {isRegister
              ? 'Erstelle deinen Account, um TimeAM zu nutzen.'
              : 'Melde dich an, um fortzufahren.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>E-Mail</label>
            <input
              type="email"
              placeholder="name@firma.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Passwort</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
              className={styles.input}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className={styles.submitBtn}
          >
            {loading
              ? 'Laden...'
              : isRegister
                ? 'Account erstellen'
                : 'Anmelden'}
          </button>
        </form>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerText}>
            {isRegister ? 'Bereits registriert?' : 'Noch kein Account?'}
          </span>
          <button
            onClick={toggleMode}
            disabled={loading}
            className={styles.toggleBtn}
          >
            {isRegister ? 'Anmelden' : 'Registrieren'}
          </button>
        </div>
      </div>
    </div>
  );
}
