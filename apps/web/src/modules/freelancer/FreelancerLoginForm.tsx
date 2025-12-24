/**
 * Freelancer Login Form
 *
 * Anmeldeformular für Freelancer.
 */

import { useState, type FormEvent } from 'react';
import { useAuth } from '../../core/auth';
import styles from './FreelancerLoginForm.module.css';

interface FreelancerLoginFormProps {
  onSuccess?: () => void;
  onRegisterClick?: () => void;
}

export function FreelancerLoginForm({ onSuccess, onRegisterClick }: FreelancerLoginFormProps) {
  const { signIn, error, loading, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await signIn(email, password);
      if (onSuccess) {
        onSuccess();
      }
    } catch {
      // Error wird im Context behandelt
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <img 
              src="/logo.png" 
              alt="TimeAM Logo" 
              className={styles.logoImage}
            />
          </div>
          <h1 className={styles.title}>Freelancer Anmeldung</h1>
          <p className={styles.subtitle}>
            Melde dich an, um dich auf Schichten zu bewerben.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>E-Mail</label>
            <input
              type="email"
              placeholder="name@example.de"
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
              className={styles.input}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className={styles.submitBtn}
          >
            {loading ? 'Laden...' : 'Anmelden'}
          </button>
        </form>

        <div className={styles.footer}>
          <span className={styles.footerText}>Noch kein Account?</span>
          <button
            onClick={onRegisterClick}
            disabled={loading}
            className={styles.toggleBtn}
          >
            Registrieren
          </button>
        </div>
      </div>
    </div>
  );
}

