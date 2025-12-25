/**
 * Edit Tenant Name Modal
 *
 * Modal zum Bearbeiten des Firmennamens (nur für Admins).
 */

import { useState, useEffect } from 'react';
import { updateTenantName } from '../../modules/settings/api';
import styles from './EditTenantNameModal.module.css';

interface EditTenantNameModalProps {
  open: boolean;
  currentName: string;
  onClose: () => void;
  onSuccess: (newName: string) => void;
}

export function EditTenantNameModal({
  open,
  currentName,
  onClose,
  onSuccess,
}: EditTenantNameModalProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
    }
  }, [open, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || name.trim().length < 2) {
      setError('Der Firmenname muss mindestens 2 Zeichen lang sein');
      return;
    }

    if (name.trim() === currentName) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateTenantName({ name: name.trim() });
      onSuccess(name.trim());
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren des Firmennamens';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Firmenname bearbeiten</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="tenantName" className={styles.label}>
              Firmenname
            </label>
            <input
              id="tenantName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              placeholder="Firmenname eingeben..."
              disabled={loading}
              autoFocus
              minLength={2}
              required
            />
            {error && <p className={styles.error}>{error}</p>}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading || !name.trim() || name.trim().length < 2}
            >
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

