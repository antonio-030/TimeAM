/**
 * Pricing Page Component
 *
 * Öffentliche Pricing-Seite für TimeAM mit allen Plänen und Add-ons.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './PricingPage.module.css';
import landingStyles from './LandingPage.module.css';

interface PricingPageProps {
  onGetStarted?: () => void;
  onPrivacyClick?: () => void;
  onImprintClick?: () => void;
  onFreelancerPoolClick?: () => void;
}

export function PricingPage({ onGetStarted, onPrivacyClick, onImprintClick, onFreelancerPoolClick }: PricingPageProps) {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = () => {
    if (onGetStarted) {
      onGetStarted();
    } else {
      navigate('/login');
    }
  };

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      description: 'Für kleine Teams, "kommt schnell live"',
      priceMonthly: 4.50,
      priceYearly: 3.83, // 15% Rabatt
      minimumPriceMonthly: 45,
      minimumPriceYearly: 38.25, // 15% Rabatt
      targetGroup: '1–30 MA',
      features: [
        'Core-Module (Dashboard, Kalender, Mitarbeiter)',
        'Schichtplanung mit Freelancer-Pool',
        'Zeiterfassung (Clock In/Out, Timesheets)',
        'Standardberichte/Exports',
        'Benachrichtigungen',
        'Freelancer-Pool: Schichten öffentlich veröffentlichen',
      ],
      includedModules: ['dashboard', 'calendar-core', 'members', 'notifications', 'time-tracking', 'shift-pool', 'reports'],
      moduleDetails: {
        'time-tracking': {
          name: 'Zeiterfassung',
          description: 'Einfache und präzise Arbeitszeiterfassung. Clock In/Out mit einem Klick, automatische Stundenberechnung, Übersicht über deine geleisteten Stunden und flexible Timesheet-Verwaltung. Perfekt für Einzelpersonen oder Teams.',
          features: ['Clock In/Out', 'Stundenkonto', 'Timesheets', 'Pausen-Erfassung', 'Projekt-Zuordnung'],
        },
        'shift-pool': {
          name: 'Schichtplanung',
          description: 'Flexible Schichtverwaltung für Teams. Veröffentliche offene Schichten im Freelancer-Pool und lass Mitarbeiter oder externe Freelancer sich bewerben. Ideal für Unternehmen, die flexible Besetzung benötigen.',
          features: ['Schichten erstellen', 'Freelancer-Pool Integration', 'Bewerbungen verwalten', 'Automatische Benachrichtigungen', 'Schicht-Zuweisungen'],
        },
        'reports': {
          name: 'Berichte & Analytics',
          description: 'Auswertungen, Statistiken und Export-Funktionen. Behalte den Überblick über Arbeitszeiten, Schichten und Team-Performance mit übersichtlichen Dashboards und detaillierten Reports.',
          features: ['Zeiterfassungs-Reports', 'Schicht-Übersichten', 'Export-Funktionen (PDF, Excel)', 'Statistiken & Kennzahlen'],
        },
      },
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Für Teams, die mehr Steuerung/Reporting wollen',
      priceMonthly: 6.50,
      priceYearly: 5.53, // 15% Rabatt
      minimumPriceMonthly: 79,
      minimumPriceYearly: 67.15, // 15% Rabatt
      targetGroup: '10–50 MA',
      features: [
        'Alles aus Basic',
        'Erweiterte Analytics-Ansichten',
        'Mehr Exportoptionen',
        'Rollen/Rechte "Pro"',
        'Prioritäts-Support',
      ],
      includedModules: ['dashboard', 'calendar-core', 'members', 'notifications', 'time-tracking', 'shift-pool', 'reports'],
      popular: true,
    },
    {
      id: 'business',
      name: 'Business',
      description: 'Für größere Firmen / mehrere Standorte',
      priceMonthly: 8.50,
      priceYearly: 7.23, // 15% Rabatt
      minimumPriceMonthly: 129,
      minimumPriceYearly: 109.65, // 15% Rabatt
      targetGroup: '50+ MA',
      features: [
        'Alles aus Pro',
        'Multi-Standort-Features',
        'Erweiterte Auswertungen/Filter',
        'Prioritäts-Support',
        'Dedicated Account Manager',
      ],
      includedModules: ['dashboard', 'calendar-core', 'members', 'notifications', 'time-tracking', 'shift-pool', 'reports'],
    },
  ];

  const addons = [
    {
      id: 'work-time-compliance',
      name: 'Arbeitszeit-Compliance',
      description: 'Automatische Verstoß-Erkennung und Prüfungs-Exports für Arbeitszeitgesetze',
      detailedDescription: 'Erkenne automatisch Verstöße gegen Arbeitszeitgesetze (z.B. maximale Arbeitszeit, Ruhezeiten, Pausen). Generiere Prüfungs-Exports für Behörden und Audits. Ideal für Unternehmen, die Compliance-Anforderungen erfüllen müssen.',
      priceMonthly: 1.20,
      priceYearly: 1.02, // 15% Rabatt
      minimumPriceMonthly: 19,
      minimumPriceYearly: 16.15, // 15% Rabatt
      icon: '⚖️',
      moduleId: 'work-time-compliance',
      features: ['Automatische Verstoß-Erkennung', 'Prüfungs-Exports', 'Compliance-Reports', 'Warnungen bei Regelverstößen'],
    },
    {
      id: 'company-branding',
      name: 'Custom Branding',
      description: 'Eigene Farben, Logo und Branding für deine Firma',
      detailedDescription: 'Passe TimeAM an dein Corporate Design an. Eigene Farben, Logo, und Branding-Elemente sorgen für eine konsistente Markenerfahrung. Deine Mitarbeiter sehen dein Branding statt des Standard-Designs.',
      priceMonthly: 0.60,
      priceYearly: 0.51, // 15% Rabatt
      minimumPriceMonthly: 15,
      minimumPriceYearly: 12.75, // 15% Rabatt
      icon: '🎨',
      moduleId: 'company-branding',
      features: ['Eigenes Logo', 'Farbanpassung', 'Custom Branding', 'White-Label Option'],
    },
    {
      id: 'company-integrations',
      name: 'Integrationen',
      description: 'HR/Payroll/API-Connectoren für nahtlose Datenübertragung',
      detailedDescription: 'Integriere TimeAM mit deinen bestehenden Systemen. Verbinde dich mit HR-Systemen, Payroll-Lösungen und anderen Tools über unsere API oder vorkonfigurierte Connectors. Automatisiere Datenübertragungen und spare Zeit.',
      priceMonthly: 1.80,
      priceYearly: 1.53, // 15% Rabatt
      minimumPriceMonthly: 39,
      minimumPriceYearly: 33.15, // 15% Rabatt
      icon: '🔌',
      moduleId: 'company-integrations',
      features: ['HR-System Integration', 'Payroll-Anbindung', 'API-Zugriff', 'Webhook-Support', 'Automatisierte Datenübertragung'],
    },
    {
      id: 'company-advanced-reports',
      name: 'Erweiterte Berichte',
      description: 'Custom Exports und zusätzliche Report-Funktionen',
      detailedDescription: 'Erweiterte Reporting-Funktionen für detaillierte Analysen. Erstelle custom Reports, erweiterte Export-Formate und automatisierte Report-Zustellungen. Perfekt für Unternehmen, die tiefere Einblicke benötigen.',
      priceMonthly: 0.90,
      priceYearly: 0.77, // 15% Rabatt
      minimumPriceMonthly: 19,
      minimumPriceYearly: 16.15, // 15% Rabatt
      icon: '📑',
      moduleId: 'company-advanced-reports',
      features: ['Custom Reports', 'Erweiterte Export-Formate', 'Automatisierte Report-Zustellung', 'Detaillierte Analysen'],
    },
    {
      id: 'company-sso',
      name: 'Single Sign-On (SSO)',
      description: 'SSO-Integration für sicheren Firmen-Login',
      detailedDescription: 'Integriere TimeAM mit deinem bestehenden SSO-System (SAML, OAuth, etc.). Deine Mitarbeiter können sich mit ihren Firmen-Credentials anmelden, ohne separate Accounts zu verwalten. Erhöht Sicherheit und Benutzerfreundlichkeit.',
      priceMonthly: 2.50,
      priceYearly: 2.13, // 15% Rabatt
      minimumPriceMonthly: 79,
      minimumPriceYearly: 67.15, // 15% Rabatt
      icon: '🔐',
      moduleId: 'company-sso',
      features: ['SAML-Support', 'OAuth-Integration', 'Zentrale Authentifizierung', 'Enterprise-Sicherheit'],
    },
  ];

  const calculatePrice = (pricePerUser: number, users: number, minimumPrice: number, isYearly: boolean) => {
    const discount = isYearly ? 0.15 : 0;
    const adjustedPricePerUser = pricePerUser * (1 - discount);
    const total = Math.max(adjustedPricePerUser * users, minimumPrice * (1 - discount));
    return total;
  };

  const exampleCalculations = [
    {
      scenario: 'Firma mit 20 Nutzern, Plan Pro + Compliance + Integrationen',
      users: 20,
      plan: plans[1],
      addons: [addons[0], addons[2]],
    },
    {
      scenario: 'Firma mit 8 Nutzern, Plan Basic',
      users: 8,
      plan: plans[0],
      addons: [],
    },
  ];

  return (
    <div className={styles.pricing}>
      {/* Sticky Navigation */}
      <nav className={`${landingStyles.nav} ${isScrolled ? landingStyles.navScrolled : ''}`}>
        <div className={landingStyles.navBrand}>
          <img
            src="/logo.png"
            alt="TimeAM Logo"
            className={landingStyles.navLogo}
            onClick={() => navigate('/')}
            style={{ cursor: 'pointer' }}
          />
          <span className={landingStyles.navTitle}>TimeAM</span>
        </div>
        <div className={landingStyles.navLinks}>
          <a 
            href="/pricing" 
            className={landingStyles.navLink}
            onClick={(e) => {
              e.preventDefault();
            }}
            style={{ opacity: 0.8, cursor: 'default' }}
          >
            Preise
          </a>
          <a 
            href="/freelancer-pool" 
            className={landingStyles.navLink}
            onClick={(e) => {
              e.preventDefault();
              if (onFreelancerPoolClick) {
                onFreelancerPoolClick();
              } else {
                navigate('/freelancer-pool');
              }
            }}
          >
            Freelancer Pool
          </a>
          <button onClick={handleGetStarted} className={landingStyles.navCta}>
            Anmelden
          </button>
        </div>
      </nav>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Preise & Leistungen</h1>
          <p className={styles.subtitle}>
            Einfache, transparente Preise. Zahl nur für das, was du brauchst.
          </p>
        </div>
      </header>

      {/* Billing Cycle Toggle */}
      <div className={styles.billingToggle}>
        <button
          className={`${styles.toggleButton} ${billingCycle === 'monthly' ? styles.active : ''}`}
          onClick={() => setBillingCycle('monthly')}
        >
          Monatlich
        </button>
        <button
          className={`${styles.toggleButton} ${billingCycle === 'yearly' ? styles.active : ''}`}
          onClick={() => setBillingCycle('yearly')}
        >
          Jährlich
          <span className={styles.discountBadge}>-15%</span>
        </button>
      </div>

      {/* Pricing Plans */}
      <section className={styles.plansSection}>
        <div className={styles.plansGrid}>
          {plans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
            const minimumPrice = billingCycle === 'monthly' ? plan.minimumPriceMonthly : plan.minimumPriceYearly;

            return (
              <div
                key={plan.id}
                className={`${styles.planCard} ${plan.popular ? styles.planPopular : ''}`}
              >
                {plan.popular && <div className={styles.popularBadge}>Beliebt</div>}
                <div className={styles.planHeader}>
                  <h3 className={styles.planName}>{plan.name}</h3>
                  <p className={styles.planDescription}>{plan.description}</p>
                  <div className={styles.planPrice}>
                    <span className={styles.priceAmount}>{price.toFixed(2)} €</span>
                    <span className={styles.priceUnit}>/ Nutzer / {billingCycle === 'monthly' ? 'Monat' : 'Jahr'}</span>
                  </div>
                  <div className={styles.planMinimum}>
                    Mindestpreis: {minimumPrice.toFixed(2)} € / {billingCycle === 'monthly' ? 'Monat' : 'Jahr'}
                  </div>
                  <div className={styles.planTarget}>{plan.targetGroup}</div>
                </div>
                <ul className={styles.planFeatures}>
                  {plan.features.map((feature, index) => (
                    <li key={index} className={styles.featureItem}>
                      <span className={styles.checkIcon}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  className={styles.planButton}
                  onClick={handleGetStarted}
                >
                  Jetzt starten
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add-ons Section */}
      <section className={styles.addonsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Optionale Add-ons</h2>
          <p className={styles.sectionSubtitle}>
            Erweitere deinen Plan mit zusätzlichen Features. Monatlich zu-/abbuchbar.
          </p>
        </div>
        <div className={styles.addonsGrid}>
          {addons.map((addon) => {
            const price = billingCycle === 'monthly' ? addon.priceMonthly : addon.priceYearly;
            const minimumPrice = billingCycle === 'monthly' ? addon.minimumPriceMonthly : addon.minimumPriceYearly;

            return (
              <div key={addon.id} className={styles.addonCard}>
                <div className={styles.addonIcon}>{addon.icon}</div>
                <h3 className={styles.addonName}>{addon.name}</h3>
                <p className={styles.addonDescription}>{addon.description}</p>
                {addon.detailedDescription && (
                  <p className={styles.addonDetailedDescription}>{addon.detailedDescription}</p>
                )}
                {addon.features && (
                  <ul className={styles.addonFeatures}>
                    {addon.features.map((feature, idx) => (
                      <li key={idx}>
                        <span className={styles.checkIcon}>✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
                <div className={styles.addonPrice}>
                  <span className={styles.priceAmount}>{price.toFixed(2)} €</span>
                  <span className={styles.priceUnit}>/ Nutzer / {billingCycle === 'monthly' ? 'Monat' : 'Jahr'}</span>
                </div>
                <div className={styles.addonMinimum}>
                  Mindestpreis: {minimumPrice.toFixed(2)} € / {billingCycle === 'monthly' ? 'Monat' : 'Jahr'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Module Details Section */}
      <section className={styles.modulesSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Was können die Module?</h2>
          <p className={styles.sectionSubtitle}>
            Detaillierte Informationen zu den Hauptmodulen, die in allen Plänen enthalten sind.
          </p>
        </div>
        <div className={styles.modulesDetailsGrid}>
          {plans[0].moduleDetails && Object.entries(plans[0].moduleDetails).map(([key, module]: [string, any]) => (
            <div key={key} className={styles.moduleDetailCard}>
              <h3 className={styles.moduleDetailName}>{module.name}</h3>
              <p className={styles.moduleDetailDescription}>{module.description}</p>
              <ul className={styles.moduleDetailFeatures}>
                {module.features.map((feature: string, idx: number) => (
                  <li key={idx}>
                    <span className={styles.checkIcon}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Freelancer Pool Section */}
      <section className={styles.freelancerSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Freelancer-Pool: So funktioniert's</h2>
          <p className={styles.sectionSubtitle}>
            Veröffentliche Schichten im Freelancer-Pool und finde passende Mitarbeiter oder externe Freelancer.
          </p>
        </div>
        <div className={styles.freelancerContent}>
          <div className={styles.freelancerSteps}>
            <div className={styles.freelancerStep}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <h3>Schicht erstellen</h3>
                <p>Erstelle eine neue Schicht mit allen Details: Datum, Zeit, Ort, Anforderungen und Stundenlohn.</p>
              </div>
            </div>
            <div className={styles.freelancerStep}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <h3>Im Pool veröffentlichen</h3>
                <p>Veröffentliche die Schicht im Freelancer-Pool. Sie wird für alle registrierten Freelancer und deine Mitarbeiter sichtbar.</p>
              </div>
            </div>
            <div className={styles.freelancerStep}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <h3>Bewerbungen erhalten</h3>
                <p>Freelancer und Mitarbeiter können sich direkt auf die Schicht bewerben. Du erhältst alle Bewerbungen übersichtlich.</p>
              </div>
            </div>
            <div className={styles.freelancerStep}>
              <div className={styles.stepNumber}>4</div>
              <div className={styles.stepContent}>
                <h3>Zuweisen und loslegen</h3>
                <p>Wähle den passenden Kandidaten aus und weise die Schicht zu. Automatische Benachrichtigungen informieren alle Beteiligten.</p>
              </div>
            </div>
          </div>
          <div className={styles.freelancerBenefits}>
            <h3>Vorteile des Freelancer-Pools:</h3>
            <ul>
              <li>✓ Flexibilität: Finde schnell passende Besetzung für spontane Schichten</li>
              <li>✓ Transparenz: Alle Details auf einen Blick</li>
              <li>✓ Einfach: Bewerbungen und Zuweisungen mit wenigen Klicks</li>
              <li>✓ Automatisch: Benachrichtigungen für alle Beteiligten</li>
              <li>✓ Kostenlos für Freelancer: Freelancer zahlen nichts, nur Firmen zahlen</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Flexibility Section */}
      <section className={styles.flexibilitySection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Flexibel für jeden Bedarf</h2>
          <p className={styles.sectionSubtitle}>
            TimeAM passt sich an – ob Einzelperson oder großes Unternehmen.
          </p>
        </div>
        <div className={styles.flexibilityGrid}>
          <div className={styles.flexibilityCard}>
            <div className={styles.flexibilityIcon}>👤</div>
            <h3>Für Einzelpersonen</h3>
            <p>
              Auch als Einzelperson kannst du TimeAM nutzen! Erfasse deine eigenen Arbeitszeiten, 
              behalte den Überblick über deine Stunden und exportiere Reports für deine Kunden. 
              Ab einer Person – perfekt für Freelancer, Selbstständige und Solopreneure.
            </p>
            <p className={styles.flexibilityNote}>
              <strong>Mindestpreis:</strong> Auch bei nur einem Nutzer greift der Mindestpreis (z.B. 45 €/Monat für Basic). 
              Ideal wenn du professionelle Zeiterfassung brauchst.
            </p>
          </div>
          <div className={styles.flexibilityCard}>
            <div className={styles.flexibilityIcon}>🏢</div>
            <h3>Für Unternehmen</h3>
            <p>
              Skaliere mit deinem Team. Von kleinen Teams (5-30 MA) bis zu großen Unternehmen (50+ MA) – 
              TimeAM wächst mit dir. Nutze den Freelancer-Pool, um flexibel Schichten zu besetzen, 
              oder verwalte nur dein internes Team.
            </p>
            <p className={styles.flexibilityNote}>
              <strong>Freelancer-Pool:</strong> In allen Plänen enthalten! Veröffentliche Schichten öffentlich 
              und finde passende Freelancer oder interne Mitarbeiter.
            </p>
          </div>
          <div className={styles.flexibilityCard}>
            <div className={styles.flexibilityIcon}>🔄</div>
            <h3>Jederzeit anpassbar</h3>
            <p>
              Module und Add-ons können monatlich zu- oder abgebucht werden. Keine langfristigen Verträge, 
              keine versteckten Kosten. Passe deinen Plan an deine aktuellen Bedürfnisse an.
            </p>
            <p className={styles.flexibilityNote}>
              <strong>Flexibilität:</strong> Starte klein und erweitere nach Bedarf. Oder reduziere, 
              wenn du bestimmte Features nicht mehr brauchst.
            </p>
          </div>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section className={styles.comingSoonSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Weitere Module in Entwicklung</h2>
          <p className={styles.sectionSubtitle}>
            Wir arbeiten kontinuierlich an neuen Features und Modulen.
          </p>
        </div>
        <div className={styles.comingSoonGrid}>
          <div className={styles.comingSoonCard}>
            <div className={styles.comingSoonIcon}>📱</div>
            <h3>Mobile App</h3>
            <p>Native iOS und Android Apps für noch bessere Mobilität</p>
          </div>
          <div className={styles.comingSoonCard}>
            <div className={styles.comingSoonIcon}>🤖</div>
            <h3>KI-gestützte Planung</h3>
            <p>Automatische Schichtplanung basierend auf historischen Daten</p>
          </div>
          <div className={styles.comingSoonCard}>
            <div className={styles.comingSoonIcon}>💬</div>
            <h3>Team-Chat</h3>
            <p>Integrierte Kommunikation für dein Team</p>
          </div>
          <div className={styles.comingSoonCard}>
            <div className={styles.comingSoonIcon}>📊</div>
            <h3>Erweiterte Analytics</h3>
            <p>Noch detailliertere Auswertungen und Vorhersagen</p>
          </div>
        </div>
        <p className={styles.comingSoonNote}>
          <em>Hast du Wünsche für neue Features? Kontaktiere uns – wir freuen uns auf dein Feedback!</em>
        </p>
      </section>

      {/* Example Calculations */}
      <section className={styles.examplesSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Beispielpreise</h2>
          <p className={styles.sectionSubtitle}>
            So sehen die Preise in der Praxis aus.
          </p>
        </div>
        <div className={styles.examplesGrid}>
          {exampleCalculations.map((example, index) => {
            const isYearly = billingCycle === 'yearly';
            const planPrice = calculatePrice(
              example.plan.priceMonthly,
              example.users,
              example.plan.minimumPriceMonthly,
              isYearly
            );
            const addonPrices = example.addons.reduce((sum, addon) => {
              return sum + calculatePrice(
                addon.priceMonthly,
                example.users,
                addon.minimumPriceMonthly,
                isYearly
              );
            }, 0);
            const total = planPrice + addonPrices;

            return (
              <div key={index} className={styles.exampleCard}>
                <h3 className={styles.exampleTitle}>{example.scenario}</h3>
                <div className={styles.exampleBreakdown}>
                  <div className={styles.breakdownRow}>
                    <span>{example.plan.name}:</span>
                    <span>{example.users} × {isYearly ? example.plan.priceYearly.toFixed(2) : example.plan.priceMonthly.toFixed(2)} € = {planPrice.toFixed(2)} €</span>
                  </div>
                  {example.addons.map((addon) => {
                    const addonPrice = calculatePrice(
                      addon.priceMonthly,
                      example.users,
                      addon.minimumPriceMonthly,
                      isYearly
                    );
                    return (
                      <div key={addon.id} className={styles.breakdownRow}>
                        <span>{addon.name}:</span>
                        <span>{example.users} × {isYearly ? addon.priceYearly.toFixed(2) : addon.priceMonthly.toFixed(2)} € = {addonPrice.toFixed(2)} €</span>
                      </div>
                    );
                  })}
                  <div className={styles.breakdownTotal}>
                    <span>Gesamt:</span>
                    <span>{total.toFixed(2)} € / {billingCycle === 'monthly' ? 'Monat' : 'Jahr'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaCard}>
          <h2 className={styles.ctaTitle}>Bereit loszulegen?</h2>
          <p className={styles.ctaSubtitle}>
            Starte jetzt kostenlos und überzeuge dich selbst. Keine Kreditkarte erforderlich.
          </p>
          <button onClick={handleGetStarted} className={styles.ctaButton}>
            Kostenlos starten
            <span className={styles.ctaArrow}>→</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={landingStyles.footer}>
        <div className={landingStyles.footerContent}>
          <div className={landingStyles.footerBrand}>
            <img 
              src="/logo.png" 
              alt="TimeAM Logo" 
              className={landingStyles.footerLogo}
            />
            <span className={landingStyles.footerTitle}>TimeAM</span>
          </div>
          
          <div className={landingStyles.footerLinks}>
            <button 
              onClick={() => {
                if (onPrivacyClick) {
                  onPrivacyClick();
                } else {
                  navigate('/privacy');
                }
              }} 
              className={landingStyles.footerLink}
            >
              Datenschutz
            </button>
            <span className={landingStyles.footerDivider}>|</span>
            <button 
              onClick={() => {
                if (onImprintClick) {
                  onImprintClick();
                } else {
                  navigate('/imprint');
                }
              }} 
              className={landingStyles.footerLink}
            >
              Impressum
            </button>
          </div>
          
          <p className={landingStyles.footerCopyright}>
            © {new Date().getFullYear()} TimeAM. Alle Rechte vorbehalten.
          </p>
        </div>
      </footer>
    </div>
  );
}

