/**
 * Landing Page Component
 *
 * Öffentliche Landing Page für TimeAM.
 */

import styles from './LandingPage.module.css';

interface LandingPageProps {
  onGetStarted: () => void;
  onPrivacyClick: () => void;
  onImprintClick: () => void;
}

export function LandingPage({ onGetStarted, onPrivacyClick, onImprintClick }: LandingPageProps) {
  const features = [
    {
      icon: '⏱️',
      title: 'Zeiterfassung',
      description: 'Einfache und präzise Arbeitszeiterfassung mit Clock In/Out. Behalte den Überblick über deine geleisteten Stunden.',
    },
    {
      icon: '📋',
      title: 'Schichtplanung',
      description: 'Flexible Schichtverwaltung für Teams. Veröffentliche offene Schichten und lass Mitarbeiter sich bewerben.',
    },
    {
      icon: '📅',
      title: 'Kalender',
      description: 'Integrierter Kalender mit Übersicht aller Termine, Schichten und Zeiteinträge an einem Ort.',
    },
    {
      icon: '👥',
      title: 'Team Management',
      description: 'Verwalte dein Team mit Rollen und Berechtigungen. Genehmigungen und Benachrichtigungen inklusive.',
    },
  ];

  const modules = [
    {
      icon: '⏰',
      name: 'Zeiterfassung',
      description: 'Clock In/Out, Timesheets, Stundenübersicht',
      included: true,
    },
    {
      icon: '📋',
      name: 'Schichtplanung',
      description: 'Schichten veröffentlichen, Bewerbungen, Zuweisungen',
      included: false,
    },
    {
      icon: '📊',
      name: 'Berichte & Analytics',
      description: 'Auswertungen, Exporte, Statistiken',
      included: false,
    },
    {
      icon: '🔔',
      name: 'Benachrichtigungen',
      description: 'Push, E-Mail, In-App Alerts',
      included: true,
    },
  ];

  const benefits = [
    { value: '100%', label: 'Cloud-basiert' },
    { value: '24/7', label: 'Verfügbar' },
    { value: '∞', label: 'Skalierbar' },
  ];

  return (
    <div className={styles.landing}>
      {/* Hero Section */}
      <header className={styles.hero}>
        <nav className={styles.nav}>
          <div className={styles.navBrand}>
            <img 
              src="/logo.png" 
              alt="TimeAM Logo" 
              className={styles.navLogo}
            />
            <span className={styles.navTitle}>TimeAM</span>
          </div>
          <button onClick={onGetStarted} className={styles.navCta}>
            Anmelden
          </button>
        </nav>

        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Zeit <span className={styles.highlight}>effizient</span> erfassen.
            <br />
            Schichten <span className={styles.highlight}>smart</span> planen.
          </h1>
          <p className={styles.heroSubtitle}>
            Die moderne Lösung für Zeiterfassung und Schichtplanung. 
            Entwickelt für Teams jeder Größe.
          </p>
          <div className={styles.heroCtas}>
            <button onClick={onGetStarted} className={styles.ctaPrimary}>
              Jetzt starten
              <span className={styles.ctaArrow}>→</span>
            </button>
            <a href="#features" className={styles.ctaSecondary}>
              Mehr erfahren
            </a>
          </div>
        </div>

        {/* Animated Background Elements */}
        <div className={styles.heroDecor}>
          <div className={styles.decorCircle1} />
          <div className={styles.decorCircle2} />
          <div className={styles.decorCircle3} />
        </div>
      </header>

      {/* Benefits Bar */}
      <section className={styles.benefitsBar}>
        {benefits.map((benefit) => (
          <div key={benefit.label} className={styles.benefitItem}>
            <span className={styles.benefitValue}>{benefit.value}</span>
            <span className={styles.benefitLabel}>{benefit.label}</span>
          </div>
        ))}
      </section>

      {/* Features Section */}
      <section id="features" className={styles.features}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Alles was du brauchst</h2>
          <p className={styles.sectionSubtitle}>
            TimeAM vereint alle wichtigen Funktionen für modernes Arbeitszeitmanagement.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((feature) => (
            <div key={feature.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works Section */}
      <section className={styles.howItWorks}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>So einfach geht's</h2>
          <p className={styles.sectionSubtitle}>
            In drei Schritten zur effizienten Zeiterfassung.
          </p>
        </div>

        <div className={styles.stepsGrid}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <h3 className={styles.stepTitle}>Account erstellen</h3>
            <p className={styles.stepDescription}>
              Registriere dich kostenlos und erstelle deine Organisation.
            </p>
          </div>
          <div className={styles.stepConnector}>
            <div className={styles.connectorLine} />
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <h3 className={styles.stepTitle}>Team einladen</h3>
            <p className={styles.stepDescription}>
              Lade deine Teammitglieder ein und weise Rollen zu.
            </p>
          </div>
          <div className={styles.stepConnector}>
            <div className={styles.connectorLine} />
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <h3 className={styles.stepTitle}>Loslegen</h3>
            <p className={styles.stepDescription}>
              Beginne mit der Zeiterfassung und Schichtplanung.
            </p>
          </div>
        </div>
      </section>

      {/* Modular Section */}
      <section className={styles.modular}>
        <div className={styles.modularContent}>
          <div className={styles.modularInfo}>
            <span className={styles.modularBadge}>🧩 Modular</span>
            <h2 className={styles.modularTitle}>
              Flexibel wie dein Unternehmen
            </h2>
            <p className={styles.modularDescription}>
              TimeAM ist <strong>modular aufgebaut</strong>. Du zahlst nur für die 
              Funktionen, die du wirklich brauchst. Aktiviere oder deaktiviere 
              Module jederzeit – ganz ohne technischen Aufwand.
            </p>
            <ul className={styles.modularBenefits}>
              <li>
                <span className={styles.checkIcon}>✓</span>
                Module jederzeit hinzubuchen oder abwählen
              </li>
              <li>
                <span className={styles.checkIcon}>✓</span>
                Nur zahlen was du nutzt – keine versteckten Kosten
              </li>
              <li>
                <span className={styles.checkIcon}>✓</span>
                Nahtlose Integration aller Komponenten
              </li>
              <li>
                <span className={styles.checkIcon}>✓</span>
                Mitwachsen mit deinem Unternehmen
              </li>
            </ul>
          </div>

          <div className={styles.modulesShowcase}>
            <div className={styles.modulesHeader}>
              <span className={styles.modulesTitle}>Verfügbare Module</span>
            </div>
            <div className={styles.modulesList}>
              {modules.map((module) => (
                <div 
                  key={module.name} 
                  className={`${styles.moduleItem} ${module.included ? styles.moduleIncluded : ''}`}
                >
                  <div className={styles.moduleIcon}>{module.icon}</div>
                  <div className={styles.moduleInfo}>
                    <span className={styles.moduleName}>{module.name}</span>
                    <span className={styles.moduleDesc}>{module.description}</span>
                  </div>
                  <div className={styles.moduleStatus}>
                    {module.included ? (
                      <span className={styles.includedBadge}>Inklusive</span>
                    ) : (
                      <span className={styles.optionalBadge}>Optional</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className={styles.modulesNote}>
              * Weitere Module in Entwicklung
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaCard}>
          <h2 className={styles.ctaSectionTitle}>
            Bereit, deine Zeiterfassung zu revolutionieren?
          </h2>
          <p className={styles.ctaSectionSubtitle}>
            Starte jetzt kostenlos und überzeuge dich selbst.
          </p>
          <button onClick={onGetStarted} className={styles.ctaPrimary}>
            Kostenlos starten
            <span className={styles.ctaArrow}>→</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <img 
              src="/logo.png" 
              alt="TimeAM Logo" 
              className={styles.footerLogo}
            />
            <span className={styles.footerTitle}>TimeAM</span>
          </div>
          
          <div className={styles.footerLinks}>
            <button onClick={onPrivacyClick} className={styles.footerLink}>
              Datenschutz
            </button>
            <span className={styles.footerDivider}>|</span>
            <button onClick={onImprintClick} className={styles.footerLink}>
              Impressum
            </button>
          </div>
          
          <p className={styles.footerCopyright}>
            © {new Date().getFullYear()} TimeAM. Alle Rechte vorbehalten.
          </p>
        </div>
      </footer>
    </div>
  );
}
