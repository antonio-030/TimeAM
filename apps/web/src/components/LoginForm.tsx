/**
 * Login Form Component
 *
 * Login/Registrierung im TimeAM Design System.
 */

import { useState, type FormEvent } from 'react';
import { useAuth } from '../core/auth';
import { useTenant } from '../core/tenant';
import { registerFreelancer } from '../modules/freelancer/api';
import styles from './LoginForm.module.css';

type UserType = 'employee' | 'freelancer';
type Mode = 'login' | 'register';

interface LoginFormProps {
  defaultUserType?: UserType;
  onSuccess?: () => void;
}

export function LoginForm({ defaultUserType = 'employee', onSuccess }: LoginFormProps) {
  const { signIn, signUp, error, loading, clearError } = useAuth();
  const { refresh } = useTenant();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [businessLicenseNumber, setBusinessLicenseNumber] = useState('');
  const [userType, setUserType] = useState<UserType>(defaultUserType);
  const [mode, setMode] = useState<Mode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);

    try {
      if (userType === 'freelancer') {
        if (mode === 'register') {
          // Freelancer-Registrierung
          if (!companyName || companyName.trim().length < 2) {
            throw new Error('Firmenname ist erforderlich (min. 2 Zeichen)');
          }
          await registerFreelancer({
            email,
            password,
            displayName,
            companyName: companyName.trim(),
            phone: phone || undefined,
            address: address || undefined,
            businessLicenseNumber: businessLicenseNumber || undefined,
          });
          // Automatisch einloggen
          await signIn(email, password);
        } else {
          // Freelancer-Login
          await signIn(email, password);
        }
      } else {
        // Mitarbeiter-Login/Registrierung
        if (mode === 'register') {
          await signUp(email, password);
        } else {
          await signIn(email, password);
        }
      }
      
      // Nach erfolgreichem Login/Registrierung: Tenant-Context neu laden
      // (wichtig für Freelancer-Erkennung)
      // Warte kurz, damit Firebase Auth aktualisiert wird
      await new Promise(resolve => setTimeout(resolve, 500));
      // Tenant-Context explizit neu laden
      await refresh();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Error wird im Context behandelt
      console.error('Login/Register error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    clearError();
  };

  const toggleUserType = () => {
    setUserType(userType === 'employee' ? 'freelancer' : 'employee');
    clearError();
  };

  const isRegister = mode === 'register';
  const isLoading = loading || isSubmitting;

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
            {isRegister 
              ? (userType === 'freelancer' ? 'Freelancer Registrierung' : 'Account erstellen')
              : (userType === 'freelancer' ? 'Freelancer Anmeldung' : 'Willkommen zurück')}
          </h1>
          <p className={styles.subtitle}>
            {isRegister
              ? (userType === 'freelancer' 
                  ? 'Erstelle dein Freelancer-Profil, um dich auf Schichten zu bewerben.'
                  : 'Erstelle deinen Account, um TimeAM zu nutzen.')
              : (userType === 'freelancer'
                  ? 'Melde dich als Freelancer an.'
                  : 'Melde dich an, um fortzufahren.')}
          </p>
        </div>

        {/* User Type Toggle */}
        <div className={styles.userTypeToggle}>
          <button
            type="button"
            onClick={toggleUserType}
            className={`${styles.userTypeBtn} ${userType === 'employee' ? styles.active : ''}`}
            disabled={isLoading}
          >
            👔 Mitarbeiter
          </button>
          <button
            type="button"
            onClick={toggleUserType}
            className={`${styles.userTypeBtn} ${userType === 'freelancer' ? styles.active : ''}`}
            disabled={isLoading}
          >
            🎯 Freelancer
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {isRegister && userType === 'freelancer' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Name *</label>
                <input
                  type="text"
                  placeholder="Vor- und Nachname"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={2}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Firmenname *</label>
                <input
                  type="text"
                  placeholder="Name Ihrer Firma"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={2}
                  className={styles.input}
                />
              </div>
            </>
          )}

          <div className={styles.field}>
            <label className={styles.label}>E-Mail</label>
            <input
              type="email"
              placeholder={userType === 'freelancer' ? "name@example.de" : "name@firma.de"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
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
              disabled={isLoading}
              minLength={6}
              className={styles.input}
            />
          </div>

          {isRegister && userType === 'freelancer' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Telefon (optional)</label>
                <input
                  type="tel"
                  placeholder="+49 123 456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Adresse (optional)</label>
                <input
                  type="text"
                  placeholder="Straße, PLZ Ort"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Gewerbeschein-Nummer (optional)</label>
                <input
                  type="text"
                  placeholder="z.B. HRB 12345"
                  value={businessLicenseNumber}
                  onChange={(e) => setBusinessLicenseNumber(e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                />
                <p className={styles.hint}>
                  Falls du ein Gewerbe angemeldet hast, gib hier die Gewerbeschein-Nummer ein.
                </p>
              </div>
            </>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className={styles.submitBtn}
          >
            {isLoading
              ? 'Laden...'
              : isRegister
                ? (userType === 'freelancer' ? 'Registrieren' : 'Account erstellen')
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
