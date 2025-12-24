/**
 * Verification Badge
 *
 * Badge-Komponente zur Anzeige des Verifizierungsstatus.
 */

import type { VerificationStatus } from '../modules/freelancer/api';
import styles from './VerificationBadge.module.css';

interface VerificationBadgeProps {
  status?: VerificationStatus;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export function VerificationBadge({
  status,
  size = 'medium',
  showLabel = true,
}: VerificationBadgeProps) {
  if (!status || status === 'rejected') {
    return null;
  }

  if (status === 'approved') {
    return (
      <span className={`${styles.badge} ${styles.approved} ${styles[size]}`} title="Verifiziert">
        <span className={styles.icon}>✓</span>
        {showLabel && <span className={styles.label}>Verifiziert</span>}
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span className={`${styles.badge} ${styles.pending} ${styles[size]}`} title="Verifizierung ausstehend">
        <span className={styles.icon}>⏳</span>
        {showLabel && <span className={styles.label}>In Prüfung</span>}
      </span>
    );
  }

  return null;
}

