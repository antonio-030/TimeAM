/**
 * Login Form Component
 *
 * Login/Registrierung im TimeAM Design System.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, error, loading, clearError } = useAuth();
  const { refresh, createTenant, tenant, needsOnboarding } = useTenant();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [businessLicenseNumber, setBusinessLicenseNumber] = useState('');
  const [userType, setUserType] = useState<UserType>(defaultUserType);
  const [mode, setMode] = useState<Mode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Plan-Kontext aus URL-Parametern lesen
  const planId = searchParams.get('planId');
  const billingCycle = searchParams.get('billingCycle') || 'monthly';
  const modeParam = searchParams.get('mode');

  useEffect(() => {
    // Wenn mode-Parameter vorhanden ist, Modus setzen
    if (modeParam === 'register') {
      setMode('register');
    }
  }, [modeParam]);

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
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            companyName: companyName.trim(),
            phone: phone.trim() || undefined,
            address: address.trim() || undefined,
            businessLicenseNumber: businessLicenseNumber.trim() || undefined,
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
      // User-State wird jetzt sofort in signIn aktualisiert, daher kein Timeout nötig
      // Tenant-Context explizit neu laden - warte bis alle Daten geladen sind
      await refresh();
      
      // Prüfe IMMER ob ein pending Checkout vorhanden ist (auch wenn User die Domain verlassen hat)
      // Dies hat Priorität vor URL-Parametern, da es der letzte Checkout-Kontext ist
      const pendingCheckoutStr = localStorage.getItem('pendingCheckout');
      if (pendingCheckoutStr) {
        try {
          const pendingCheckout = JSON.parse(pendingCheckoutStr);
          // Prüfe ob der Checkout nicht zu alt ist (max. 7 Tage)
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 Tage in Millisekunden
          const age = Date.now() - pendingCheckout.timestamp;
          
          if (age < maxAge) {
            // Pending Checkout vorhanden und noch gültig
            if (tenant) {
              // Tenant vorhanden -> direkt zum Checkout
              navigate(`/checkout?planId=${pendingCheckout.planId}&billingCycle=${pendingCheckout.billingCycle}`);
              return;
            } else {
              // Kein Tenant -> User wird automatisch zum Onboarding weitergeleitet
              // CreateTenantForm wird den pendingCheckout aus localStorage lesen
              // Keine Navigation hier, App.tsx leitet automatisch zum Onboarding weiter
            }
          } else {
            // Checkout zu alt -> löschen
            localStorage.removeItem('pendingCheckout');
          }
        } catch (err) {
          console.error('Fehler beim Parsen des pending Checkouts:', err);
          localStorage.removeItem('pendingCheckout');
        }
      }
      
      // Wenn Plan-Kontext in URL vorhanden ist UND Tenant bereits existiert, zum Checkout weiterleiten
      // Wenn kein Tenant existiert, wird der User zum Onboarding (CreateTenantForm) weitergeleitet
      // Das CreateTenantForm wird dann nach der Tenant-Erstellung zum Checkout weiterleiten
      if (planId && tenant) {
        navigate(`/checkout?planId=${planId}&billingCycle=${billingCycle}`);
        return;
      }
      
      // Wenn Plan-Kontext vorhanden ist aber kein Tenant, wird der User automatisch
      // zum Onboarding weitergeleitet (needsOnboarding wird true sein)
      // Das CreateTenantForm wird den Plan-Kontext aus der URL lesen und nach
      // der Tenant-Erstellung zum Checkout weiterleiten
      
      // Die Weiterleitung erfolgt dann automatisch in App.tsx
      // Keine manuelle Navigation hier, damit App.tsx die korrekte Route bestimmen kann
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
    // Felder zurücksetzen beim Wechsel
    if (mode === 'register') {
      setDisplayName('');
      setFirstName('');
      setLastName('');
      setCompanyName('');
      setPhone('');
      setAddress('');
      setBusinessLicenseNumber('');
    }
  };

  const toggleUserType = () => {
    setUserType(userType === 'employee' ? 'freelancer' : 'employee');
    clearError();
    // Felder zurücksetzen beim Wechsel
    setDisplayName('');
    setFirstName('');
    setLastName('');
    setCompanyName('');
    setPhone('');
    setAddress('');
    setBusinessLicenseNumber('');
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
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Vorname</label>
                  <input
                    type="text"
                    placeholder="Max"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isLoading}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Nachname</label>
                  <input
                    type="text"
                    placeholder="Mustermann"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isLoading}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Anzeigename *</label>
                <input
                  type="text"
                  placeholder="Max Mustermann"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={2}
                  className={styles.input}
                />
                <p className={styles.hint}>
                  Wird in der App und bei Bewerbungen angezeigt
                </p>
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
