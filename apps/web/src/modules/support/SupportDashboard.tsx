/**
 * Support Dashboard
 *
 * Haupt-Dashboard für Dev-Mitarbeiter.
 */

import { VerificationReviewPage } from './VerificationReviewPage';
import styles from './SupportDashboard.module.css';

export function SupportDashboard() {
  return (
    <div className={styles.dashboard}>
      <VerificationReviewPage />
    </div>
  );
}

