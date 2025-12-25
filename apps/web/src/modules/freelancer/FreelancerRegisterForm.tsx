/**
 * Freelancer Registration Form
 *
 * Registrierungsformular für Freelancer mit Gewerbeschein-Feldern.
 */

import { useState, type FormEvent } from 'react';
import { useAuth } from '../../core/auth';
import { registerFreelancer } from './api';
import styles from './FreelancerRegisterForm.module.css';

interface FreelancerRegisterFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function FreelancerRegisterForm({ onSuccess, onCancel }: FreelancerRegisterFormProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [businessLicenseNumber, setBusinessLicenseNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Freelancer registrieren
      await registerFreelancer({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        displayName,
        companyName: companyName || undefined,
        phone: phone || undefined,
        address: address || undefined,
        businessLicenseNumber: businessLicenseNumber || undefined,
      });

      // Automatisch einloggen
      await signIn(email, password);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Registrierung');
    } finally {
      setIsSubmitting(false);
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
          <h1 className={styles.title}>Freelancer Registrierung</h1>
          <p className={styles.subtitle}>
            Erstelle dein Freelancer-Profil, um dich auf Schichten zu bewerben.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>E-Mail *</label>
            <input
              type="email"
              placeholder="name@example.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Passwort *</label>
            <input
              type="password"
              placeholder="Mindestens 6 Zeichen"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
              minLength={6}
              className={styles.input}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Vorname *</label>
              <input
                type="text"
                placeholder="Max"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={isSubmitting}
                minLength={1}
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Nachname *</label>
              <input
                type="text"
                placeholder="Mustermann"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={isSubmitting}
                minLength={1}
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
              disabled={isSubmitting}
              minLength={2}
              className={styles.input}
            />
            <p className={styles.hint}>
              Wird in der App und bei Bewerbungen angezeigt
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Firmenname (optional)</label>
            <input
              type="text"
              placeholder="z.B. Mustermann GmbH"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={isSubmitting}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Telefon (optional)</label>
            <input
              type="tel"
              placeholder="+49 123 456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
              className={styles.input}
            />
            <p className={styles.hint}>
              Falls du ein Gewerbe angemeldet hast, gib hier die Gewerbeschein-Nummer ein.
            </p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className={styles.cancelBtn}
              >
                Abbrechen
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className={styles.submitBtn}
            >
              {isSubmitting ? 'Wird registriert...' : 'Registrieren'}
            </button>
          </div>
        </form>

        <div className={styles.footer}>
          <span className={styles.footerText}>Bereits registriert?</span>
          <button
            onClick={() => {
              if (onCancel) {
                onCancel();
              }
            }}
            disabled={isSubmitting}
            className={styles.toggleBtn}
          >
            Zur Anmeldung
          </button>
        </div>
      </div>
    </div>
  );
}

