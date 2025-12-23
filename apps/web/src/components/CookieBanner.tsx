/**
 * Cookie Consent Banner
 * 
 * DSGVO-konformer Cookie-Banner mit Einwilligungsoptionen.
 */

import { useState } from 'react';
import { useConsent } from '../core/consent';
import styles from './CookieBanner.module.css';

interface CookieBannerProps {
  onPrivacyClick?: () => void;
}

export function CookieBanner({ onPrivacyClick }: CookieBannerProps) {
  const { hasDecided, acceptAll, acceptNecessary, saveSettings } = useConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(false);

  // Banner nicht anzeigen wenn bereits entschieden
  if (hasDecided) {
    return null;
  }

  const handleSaveCustom = () => {
    saveSettings({
      analytics: analyticsChecked,
      marketing: marketingChecked,
    });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.banner} role="dialog" aria-labelledby="cookie-title" aria-modal="true">
        <div className={styles.content}>
          <h2 id="cookie-title" className={styles.title}>
            🍪 Cookie-Einstellungen
          </h2>
          
          <p className={styles.description}>
            Wir verwenden Cookies, um dir die bestmögliche Erfahrung auf unserer Website zu bieten. 
            Einige Cookies sind für den Betrieb der Website notwendig, während andere uns helfen, 
            die Website zu verbessern.
          </p>

          {showDetails ? (
            <div className={styles.details}>
              <div className={styles.cookieCategory}>
                <div className={styles.categoryHeader}>
                  <label className={styles.categoryLabel}>
                    <input 
                      type="checkbox" 
                      checked={true} 
                      disabled 
                      className={styles.checkbox}
                    />
                    <span className={styles.categoryName}>Notwendige Cookies</span>
                    <span className={styles.required}>(Erforderlich)</span>
                  </label>
                </div>
                <p className={styles.categoryDescription}>
                  Diese Cookies sind für den Betrieb der Website unbedingt erforderlich. 
                  Sie ermöglichen grundlegende Funktionen wie Seitennavigation und Zugriff auf sichere Bereiche.
                </p>
              </div>

              <div className={styles.cookieCategory}>
                <div className={styles.categoryHeader}>
                  <label className={styles.categoryLabel}>
                    <input 
                      type="checkbox" 
                      checked={analyticsChecked}
                      onChange={(e) => setAnalyticsChecked(e.target.checked)}
                      className={styles.checkbox}
                    />
                    <span className={styles.categoryName}>Analyse-Cookies</span>
                  </label>
                </div>
                <p className={styles.categoryDescription}>
                  Diese Cookies helfen uns zu verstehen, wie Besucher mit der Website interagieren. 
                  Die Informationen werden anonymisiert gesammelt und ausgewertet.
                </p>
              </div>

              <div className={styles.cookieCategory}>
                <div className={styles.categoryHeader}>
                  <label className={styles.categoryLabel}>
                    <input 
                      type="checkbox" 
                      checked={marketingChecked}
                      onChange={(e) => setMarketingChecked(e.target.checked)}
                      className={styles.checkbox}
                    />
                    <span className={styles.categoryName}>Marketing-Cookies</span>
                  </label>
                </div>
                <p className={styles.categoryDescription}>
                  Diese Cookies werden verwendet, um Werbung relevanter für dich zu gestalten. 
                  Sie verhindern, dass dieselbe Werbung ständig wieder erscheint.
                </p>
              </div>
            </div>
          ) : null}

          <div className={styles.actions}>
            {showDetails ? (
              <>
                <button 
                  onClick={handleSaveCustom}
                  className={styles.btnPrimary}
                >
                  Auswahl speichern
                </button>
                <button 
                  onClick={() => setShowDetails(false)}
                  className={styles.btnSecondary}
                >
                  Zurück
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={acceptAll}
                  className={styles.btnPrimary}
                >
                  Alle akzeptieren
                </button>
                <button 
                  onClick={acceptNecessary}
                  className={styles.btnSecondary}
                >
                  Nur notwendige
                </button>
                <button 
                  onClick={() => setShowDetails(true)}
                  className={styles.btnLink}
                >
                  Einstellungen anpassen
                </button>
              </>
            )}
          </div>

          <div className={styles.links}>
            <button 
              onClick={onPrivacyClick}
              className={styles.privacyLink}
            >
              Datenschutzerklärung
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
