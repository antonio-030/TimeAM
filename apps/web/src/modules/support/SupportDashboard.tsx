/**
 * Support Dashboard
 *
 * Haupt-Dashboard für Dev-Mitarbeiter.
 */

import { useState } from 'react';
import { VerificationReviewPage } from './VerificationReviewPage';
import { DeletionRequestsPage } from './DeletionRequestsPage';
import styles from './SupportDashboard.module.css';

export function SupportDashboard() {
  const [activeTab, setActiveTab] = useState<'verifications' | 'deletions'>('verifications');

  return (
    <div className={styles.dashboard}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'verifications' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('verifications')}
          type="button"
        >
          <span>✅</span> Verifizierungen
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'deletions' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('deletions')}
          type="button"
        >
          <span>🗑️</span> Löschaufträge
        </button>
      </div>
      
      <div className={styles.tabContent}>
        {activeTab === 'verifications' ? (
          <VerificationReviewPage />
        ) : (
          <DeletionRequestsPage />
        )}
      </div>
    </div>
  );
}

