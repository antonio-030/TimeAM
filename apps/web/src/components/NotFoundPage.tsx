/**
 * 404 Not Found Page Component
 *
 * Zeigt eine benutzerfreundliche 404-Seite an, wenn eine Route nicht gefunden wird.
 */

import { useNavigate } from 'react-router-dom';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.errorCode}>404</div>
        <h1 className={styles.title}>Seite nicht gefunden</h1>
        <p className={styles.description}>
          Die angeforderte Seite existiert leider nicht oder wurde verschoben.
        </p>
        <div className={styles.actions}>
          <button 
            className={styles.buttonPrimary}
            onClick={handleGoHome}
          >
            Zur Startseite
          </button>
          <button 
            className={styles.buttonSecondary}
            onClick={handleGoBack}
          >
            Zurück
          </button>
        </div>
      </div>
    </div>
  );
}

