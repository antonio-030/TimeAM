/**
 * Settings Modal
 *
 * Modernes Einstellungs-Modal für Dark/Light Mode, MFA und weitere Einstellungen.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../core/auth';
import { useTenant } from '../core/tenant';
import { MfaSetupModal } from './MfaSetupModal';
import { getMfaStatus, disableMfa } from '../core/mfa/api';
import { ENTITLEMENT_KEYS } from '@timeam/shared';
import type { MfaStatusResponse } from '@timeam/shared';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'security' | 'appearance';

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { user } = useAuth();
  const { hasEntitlement, role } = useTenant();
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [darkMode, setDarkMode] = useState(() => {
    // Prüfe localStorage oder System-Präferenz
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // MFA
  const { entitlements, refresh: refreshTenant } = useTenant();
  const mfaModuleEnabled = hasEntitlement(ENTITLEMENT_KEYS.MODULE_MFA);
  const [mfaStatus, setMfaStatus] = useState<MfaStatusResponse | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [disablingMfa, setDisablingMfa] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null);


  // Dark Mode anwenden
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // MFA-Status laden
  const loadMfaStatus = useCallback(async () => {
    if (!mfaModuleEnabled) {
      setMfaStatus(null);
      return;
    }
    setMfaLoading(true);
    try {
      const status = await getMfaStatus();
      setMfaStatus(status);
    } catch (err) {
      // Nur Fehler loggen, wenn es kein Entitlement-Fehler ist
      if (err instanceof Error && !err.message.includes('Missing entitlements')) {
        console.error('Fehler beim Laden des MFA-Status:', err);
      }
      setMfaStatus(null);
    } finally {
      setMfaLoading(false);
    }
  }, [mfaModuleEnabled]);

  // Beim Öffnen laden
  useEffect(() => {
    if (!open) return;
    
    // Modal sofort öffnen, ohne zu warten
    setActiveTab('general');
    setMfaError(null);
    setMfaSuccess(null);
    
    // MFA-Status direkt laden, wenn Modul aktiviert ist (ohne refreshTenant)
    if (mfaModuleEnabled) {
      loadMfaStatus().catch((err) => {
        // Fehler stillschweigend behandeln
        if (err instanceof Error && !err.message.includes('Missing entitlements')) {
          console.error('Fehler beim Laden des MFA-Status:', err);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mfaModuleEnabled]);

  // ESC zum Schließen
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Backdrop-Klick schließt Modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <div className={styles.modalOverlay} ref={modalRef} onClick={handleBackdropClick}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className={styles.modalHeader}>
            <div className={styles.headerContent}>
              <div className={styles.headerIcon}>⚙️</div>
              <div>
                <h2 className={styles.modalTitle}>Einstellungen</h2>
                <p className={styles.modalSubtitle}>Verwalten Sie Ihre Kontoeinstellungen</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={styles.modalClose}
              aria-label="Schließen"
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'general' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('general')}
              type="button"
            >
              <svg className={styles.tabIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L2 7L10 12L18 7L10 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L10 12L18 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L10 7L18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Allgemein</span>
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'appearance' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('appearance')}
              type="button"
            >
              <svg className={styles.tabIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18C14.42 18 18 14.42 18 10C18 5.58 14.42 2 10 2Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 6V14M6 10H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Darstellung</span>
            </button>
            {mfaModuleEnabled && (
              <button
                className={`${styles.tab} ${activeTab === 'security' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('security')}
                type="button"
              >
                <svg className={styles.tabIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 9H5C3.89543 9 3 9.89543 3 11V16C3 17.1046 3.89543 18 5 18H15C16.1046 18 17 17.1046 17 16V11C17 9.89543 16.1046 9 15 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 9V5C10 3.89543 9.10457 3 8 3C6.89543 3 6 3.89543 6 5V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Sicherheit</span>
                {mfaStatus?.enabled && <span className={styles.tabBadge}>Aktiv</span>}
              </button>
            )}
          </div>

          {/* Content */}
          <div className={styles.modalBody}>
            {activeTab === 'general' && (
              <div className={styles.settingsSection}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Allgemeine Einstellungen</h3>
                  <p className={styles.sectionDescription}>Verwalten Sie Ihre grundlegenden Kontoeinstellungen</p>
                </div>
                
                {/* Profil-Info Card */}
                <div className={styles.infoCard}>
                  <div className={styles.infoCardIcon}>👤</div>
                  <div className={styles.infoCardContent}>
                    <div className={styles.infoCardTitle}>Profil</div>
                    <div className={styles.infoCardText}>
                      {user?.email || 'Keine E-Mail'}
                      {role && <span className={styles.roleBadge}>{role}</span>}
                    </div>
                  </div>
                </div>

                {/* Platzhalter für zukünftige Einstellungen */}
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <div className={styles.settingIcon}>🌐</div>
                    <div className={styles.settingInfo}>
                      <label className={styles.settingLabel}>Sprache</label>
                      <p className={styles.settingDescription}>Wählen Sie Ihre bevorzugte Sprache</p>
                    </div>
                  </div>
                  <div className={styles.settingValue}>
                    <select className={styles.select} disabled>
                      <option>Deutsch (DE)</option>
                      <option>English (EN)</option>
                    </select>
                    <span className={styles.comingSoon}>Bald verfügbar</span>
                  </div>
                </div>

                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <div className={styles.settingIcon}>🔔</div>
                    <div className={styles.settingInfo}>
                      <label className={styles.settingLabel}>Benachrichtigungen</label>
                      <p className={styles.settingDescription}>E-Mail und Push-Benachrichtigungen verwalten</p>
                    </div>
                  </div>
                  <div className={styles.settingValue}>
                    <button className={styles.buttonSecondary} disabled>
                      Konfigurieren
                    </button>
                    <span className={styles.comingSoon}>Bald verfügbar</span>
                  </div>
                </div>

                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <div className={styles.settingIcon}>🔒</div>
                    <div className={styles.settingInfo}>
                      <label className={styles.settingLabel}>Datenschutz</label>
                      <p className={styles.settingDescription}>Datenschutzeinstellungen und Cookie-Präferenzen</p>
                    </div>
                  </div>
                  <div className={styles.settingValue}>
                    <button className={styles.buttonSecondary} disabled>
                      Verwalten
                    </button>
                    <span className={styles.comingSoon}>Bald verfügbar</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className={styles.settingsSection}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Darstellung</h3>
                  <p className={styles.sectionDescription}>Passen Sie das Aussehen der Anwendung an</p>
                </div>
                
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <div className={styles.settingIcon}>{darkMode ? '🌙' : '☀️'}</div>
                    <div className={styles.settingInfo}>
                      <label className={styles.settingLabel}>Design-Modus</label>
                      <p className={styles.settingDescription}>Wählen Sie zwischen hellem und dunklem Design</p>
                    </div>
                  </div>
                  <div className={styles.settingValue}>
                    <div className={styles.themeToggleContainer}>
                      <div className={`${styles.themeOption} ${!darkMode ? styles.themeOptionActive : ''}`}>
                        <div className={styles.themeOptionIcon}>☀️</div>
                        <div className={styles.themeOptionLabel}>Hell</div>
                      </div>
                      <label className={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={darkMode}
                          onChange={(e) => setDarkMode(e.target.checked)}
                        />
                        <span className={styles.toggleSlider}></span>
                      </label>
                      <div className={`${styles.themeOption} ${darkMode ? styles.themeOptionActive : ''}`}>
                        <div className={styles.themeOptionIcon}>🌙</div>
                        <div className={styles.themeOptionLabel}>Dunkel</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Platzhalter für weitere Darstellungsoptionen */}
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <div className={styles.settingIcon}>📝</div>
                    <div className={styles.settingInfo}>
                      <label className={styles.settingLabel}>Schriftgröße</label>
                      <p className={styles.settingDescription}>Anpassen der Schriftgröße für bessere Lesbarkeit</p>
                    </div>
                  </div>
                  <div className={styles.settingValue}>
                    <button className={styles.buttonSecondary} disabled>
                      Anpassen
                    </button>
                    <span className={styles.comingSoon}>Bald verfügbar</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && mfaModuleEnabled && (
              <div className={styles.settingsSection}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Sicherheit</h3>
                  <p className={styles.sectionDescription}>Schützen Sie Ihr Konto mit erweiterten Sicherheitsfunktionen</p>
                </div>
                
                {/* MFA Card - Hervorgehoben */}
                <div className={`${styles.settingCard} ${mfaStatus?.enabled ? styles.settingCardActive : ''}`}>
                  <div className={styles.settingCardHeader}>
                    <div className={`${styles.settingIcon} ${styles.settingIconSecurity}`}>
                      {mfaStatus?.enabled ? '🔐' : '🔓'}
                    </div>
                    <div className={styles.settingInfo}>
                      <label className={styles.settingLabel}>
                        Zwei-Faktor-Authentifizierung (MFA)
                        {mfaStatus?.enabled && <span className={styles.securityBadge}>Aktiv</span>}
                      </label>
                      <p className={styles.settingDescription}>
                        {mfaStatus?.enabled 
                          ? 'Ihr Account ist durch MFA geschützt. Sie müssen bei jeder Anmeldung einen Code eingeben.'
                          : 'Schützen Sie Ihren Account mit zusätzlicher Sicherheit durch einen zeitbasierten Code'}
                      </p>
                    </div>
                  </div>
                  <div className={styles.settingValue}>
                    {mfaLoading ? (
                      <div className={styles.loadingSpinner}></div>
                    ) : mfaStatus?.enabled ? (
                      <div className={styles.mfaStatusContainer}>
                        <div className={styles.mfaStatusActive}>
                          <svg className={styles.mfaStatusIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M16.7071 5.29289C17.0976 5.68342 17.0976 6.31658 16.7071 6.70711L8.70711 14.7071C8.31658 15.0976 7.68342 15.0976 7.29289 14.7071L3.29289 10.7071C2.90237 10.3166 2.90237 9.68342 3.29289 9.29289C3.68342 8.90237 4.31658 8.90237 4.70711 9.29289L8 12.5858L15.2929 5.29289C15.6834 4.90237 16.3166 4.90237 16.7071 5.29289Z" fill="currentColor"/>
                          </svg>
                          <span>Aktiviert</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Möchten Sie MFA wirklich deaktivieren? Dies reduziert die Sicherheit Ihres Accounts erheblich.')) {
                              return;
                            }
                            setDisablingMfa(true);
                            setMfaError(null);
                            setMfaSuccess(null);
                            try {
                              await disableMfa('');
                              await loadMfaStatus();
                              setMfaSuccess('MFA wurde erfolgreich deaktiviert.');
                              setTimeout(() => setMfaSuccess(null), 5000);
                            } catch (err) {
                              setMfaError(err instanceof Error ? err.message : 'Fehler beim Deaktivieren von MFA');
                              setTimeout(() => setMfaError(null), 5000);
                            } finally {
                              setDisablingMfa(false);
                            }
                          }}
                          className={styles.buttonDanger}
                          disabled={disablingMfa}
                        >
                          {disablingMfa ? (
                            <>
                              <span className={styles.buttonSpinner}></span>
                              Wird deaktiviert...
                            </>
                          ) : (
                            'Deaktivieren'
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!mfaModuleEnabled) return;
                          setShowMfaSetup(true);
                        }}
                        className={styles.buttonPrimary}
                        disabled={!mfaModuleEnabled}
                      >
                        <svg className={styles.buttonIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        MFA aktivieren
                      </button>
                    )}
                  </div>
                </div>

                {mfaError && (
                  <div className={styles.alertMessage} role="alert">
                    <svg className={styles.alertIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M10 6V10M10 14H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>{mfaError}</span>
                  </div>
                )}

                {mfaSuccess && (
                  <div className={`${styles.alertMessage} ${styles.alertMessageSuccess}`} role="alert">
                    <svg className={styles.alertIcon} width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M16.7071 5.29289C17.0976 5.68342 17.0976 6.31658 16.7071 6.70711L8.70711 14.7071C8.31658 15.0976 7.68342 15.0976 7.29289 14.7071L3.29289 10.7071C2.90237 10.3166 2.90237 9.68342 3.29289 9.29289C3.68342 8.90237 4.31658 8.90237 4.70711 9.29289L8 12.5858L15.2929 5.29289C15.6834 4.90237 16.3166 4.90237 16.7071 5.29289Z" fill="currentColor"/>
                    </svg>
                    <span>{mfaSuccess}</span>
                  </div>
                )}

                {/* Platzhalter für weitere Sicherheitseinstellungen */}
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <div className={styles.settingIcon}>🖥️</div>
                    <div className={styles.settingInfo}>
                      <label className={styles.settingLabel}>Aktive Sitzungen</label>
                      <p className={styles.settingDescription}>Verwalten Sie Ihre aktiven Anmeldungen auf verschiedenen Geräten</p>
                    </div>
                  </div>
                  <div className={styles.settingValue}>
                    <button className={styles.buttonSecondary} disabled>
                      Anzeigen
                    </button>
                    <span className={styles.comingSoon}>Bald verfügbar</span>
                  </div>
                </div>

                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <div className={styles.settingIcon}>🔑</div>
                    <div className={styles.settingInfo}>
                      <label className={styles.settingLabel}>Passwort ändern</label>
                      <p className={styles.settingDescription}>Aktualisieren Sie Ihr Passwort für mehr Sicherheit</p>
                    </div>
                  </div>
                  <div className={styles.settingValue}>
                    <button className={styles.buttonSecondary} disabled>
                      Ändern
                    </button>
                    <span className={styles.comingSoon}>Bald verfügbar</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MFA Setup Modal */}
      <MfaSetupModal
        open={showMfaSetup}
        onClose={() => {
          setShowMfaSetup(false);
          loadMfaStatus();
        }}
        onSuccess={() => {
          setShowMfaSetup(false);
          loadMfaStatus();
          setMfaSuccess('MFA wurde erfolgreich aktiviert.');
        }}
      />
    </>
  );
}

