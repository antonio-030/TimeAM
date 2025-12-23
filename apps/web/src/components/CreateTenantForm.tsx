/**
 * Create Tenant Form
 *
 * Onboarding-Formular im TimeAM Design System.
 */

import { useState, type FormEvent } from 'react';
import { useAuth } from '../core/auth';
import { useTenant } from '../core/tenant';
import styles from './CreateTenantForm.module.css';

export function CreateTenantForm() {
  const { signOut } = useAuth();
  const { createTenant, error, loading } = useTenant();
  const [tenantName, setTenantName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!tenantName.trim() || tenantName.trim().length < 2) {
      return;
    }

    setIsSubmitting(true);

    try {
      await createTenant(tenantName.trim());
    } catch {
      // Error wird im Context behandelt
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Error handling
    }
  };

  const isDisabled = loading || isSubmitting;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>⏱️</span>
            <span className={styles.logoText}>TimeAM</span>
          </div>
          <div className={styles.iconCircle}>
            <span className={styles.icon}>🏢</span>
          </div>
          <h1 className={styles.title}>Organisation erstellen</h1>
          <p className={styles.subtitle}>
            Erstelle deine Organisation, um TimeAM mit deinem Team zu nutzen.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Name der Organisation</label>
            <input
              type="text"
              placeholder="z.B. Meine Firma GmbH"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
              disabled={isDisabled}
              minLength={2}
              maxLength={100}
              className={styles.input}
            />
            <span className={styles.hint}>
              Mindestens 2 Zeichen
            </span>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={isDisabled || tenantName.trim().length < 2}
            className={styles.submitBtn}
          >
            {isSubmitting ? 'Wird erstellt...' : 'Organisation erstellen'}
          </button>
        </form>

        {/* Info */}
        <div className={styles.info}>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>✓</span>
            <span>Du wirst automatisch als Administrator hinzugefügt</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>✓</span>
            <span>Zeiterfassung & Schichtplanung sofort verfügbar</span>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button onClick={handleSignOut} className={styles.signOutBtn}>
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
