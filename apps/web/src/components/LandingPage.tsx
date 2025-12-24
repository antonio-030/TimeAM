/**
 * Landing Page Component
 *
 * Öffentliche Landing Page für TimeAM.
 */

import { useState, useEffect } from 'react';
import styles from './LandingPage.module.css';

interface LandingPageProps {
  onGetStarted: () => void;
  onPrivacyClick: () => void;
  onImprintClick: () => void;
  onFreelancerPoolClick?: () => void;
}

export function LandingPage({ onGetStarted, onPrivacyClick, onImprintClick, onFreelancerPoolClick }: LandingPageProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const stats = [
    { value: '10.000+', label: 'Erfasste Arbeitsstunden', icon: '⏱️' },
    { value: '500+', label: 'Verwaltete Schichten', icon: '📋' },
    { value: '98%', label: 'Kundenzufriedenheit', icon: '⭐' },
    { value: '24h', label: 'Durchschn. Implementierungszeit', icon: '🚀' },
  ];

  const useCases = [
    {
      icon: '🏥',
      title: 'Gesundheitswesen',
      description: 'Perfekt für Krankenhäuser, Praxen und Pflegedienste mit komplexen Schichtmodellen.',
    },
    {
      icon: '🏪',
      title: 'Einzelhandel',
      description: 'Flexible Zeiterfassung für Filialnetze mit wechselnden Öffnungszeiten.',
    },
    {
      icon: '🏭',
      title: 'Produktion',
      description: 'Präzise Erfassung für Schichtarbeit in der Fertigung und Logistik.',
    },
    {
      icon: '💼',
      title: 'Dienstleistung',
      description: 'Ideal für Agenturen, Beratungen und Service-Teams mit flexiblen Arbeitszeiten.',
    },
  ];

  const testimonials = [
    {
      quote: 'TimeAM hat unsere Schichtplanung revolutioniert. Was früher Stunden dauerte, erledigen wir jetzt in Minuten.',
      author: 'Maria Schmidt',
      role: 'HR Managerin',
      company: 'MediCare GmbH',
      avatar: '👩‍💼',
    },
    {
      quote: 'Die modulare Struktur ist genial. Wir zahlen nur für das, was wir wirklich brauchen.',
      author: 'Thomas Müller',
      role: 'Geschäftsführer',
      company: 'RetailPro AG',
      avatar: '👨‍💼',
    },
    {
      quote: 'Endlich eine Lösung, die unsere Mitarbeiter gerne nutzen. Die Bedienung ist intuitiv und schnell.',
      author: 'Sarah Weber',
      role: 'Team Lead',
      company: 'LogistikPlus',
      avatar: '👩‍💻',
    },
  ];

  const faqs = [
    {
      question: 'Wie schnell kann ich mit TimeAM starten?',
      answer: 'Die Einrichtung dauert nur wenige Minuten. Nach der Registrierung können Sie sofort mit der Zeiterfassung beginnen und Ihr Team einladen.',
    },
    {
      question: 'Welche Module sind im Basispaket enthalten?',
      answer: 'Das Basispaket umfasst Zeiterfassung, Kalender-Integration und Benachrichtigungen. Weitere Module wie Schichtplanung und Berichte können Sie jederzeit hinzubuchen.',
    },
    {
      question: 'Ist TimeAM DSGVO-konform?',
      answer: 'Ja, TimeAM erfüllt alle Anforderungen der DSGVO. Ihre Daten werden ausschließlich in deutschen Rechenzentren gespeichert und verarbeitet.',
    },
    {
      question: 'Kann ich TimeAM erst testen?',
      answer: 'Selbstverständlich! Sie können TimeAM 30 Tage lang kostenlos und unverbindlich testen. Keine Kreditkarte erforderlich.',
    },
    {
      question: 'Gibt es eine mobile App?',
      answer: 'TimeAM ist als progressive Web-App konzipiert und funktioniert perfekt auf allen Geräten – vom Desktop bis zum Smartphone.',
    },
    {
      question: 'Wie funktioniert der Support?',
      answer: 'Unser deutschsprachiger Support steht Ihnen per E-Mail und Chat zur Verfügung. Premium-Kunden erhalten zusätzlich telefonischen Support.',
    },
  ];

  const trustFeatures = [
    { icon: '🔒', title: 'SSL-Verschlüsselung', description: 'End-to-End verschlüsselte Datenübertragung' },
    { icon: '🇩🇪', title: 'Deutsche Server', description: 'Hosting in zertifizierten deutschen Rechenzentren' },
    { icon: '✅', title: 'DSGVO-konform', description: 'Vollständige Einhaltung aller Datenschutzrichtlinien' },
    { icon: '🔐', title: 'ISO 27001', description: 'Zertifiziertes Informationssicherheits-Management' },
  ];

  const shiftPoolFeatures = [
    {
      icon: '📝',
      title: 'Schichten ausschreiben',
      description: 'Veröffentlichen Sie offene Schichten mit allen Details: Datum, Zeit, Ort und Anforderungen.',
    },
    {
      icon: '👥',
      title: 'Bewerbungen erhalten',
      description: 'Mitarbeiter und Freelancer können sich direkt auf Schichten bewerben - einfach und transparent.',
    },
    {
      icon: '✅',
      title: 'Schnelle Zuweisungen',
      description: 'Bewerbungen prüfen und mit einem Klick die passenden Personen der Schicht zuweisen.',
    },
    {
      icon: '🔔',
      title: 'Automatische Benachrichtigungen',
      description: 'Alle Beteiligten werden automatisch über neue Schichten, Bewerbungen und Zusagen informiert.',
    },
  ];

  const shiftPoolSteps = [
    { step: '1', title: 'Schicht erstellen', description: 'Legen Sie eine neue Schicht mit allen Details an und veröffentlichen Sie diese im Pool.' },
    { step: '2', title: 'Bewerbungen sammeln', description: 'Mitarbeiter und Freelancer sehen die offene Schicht und können sich bewerben.' },
    { step: '3', title: 'Kandidaten prüfen', description: 'Überprüfen Sie die Bewerbungen und Profile der Kandidaten.' },
    { step: '4', title: 'Schicht zuweisen', description: 'Wählen Sie den passenden Kandidaten aus und weisen Sie die Schicht zu.' },
  ];

  return (
    <div className={styles.landing}>
      {/* Sticky Navigation */}
      <nav className={`${styles.nav} ${isScrolled ? styles.navScrolled : ''}`}>
        <div className={styles.navBrand}>
          <img
            src="/logo.png"
            alt="TimeAM Logo"
            className={styles.navLogo}
          />
          <span className={styles.navTitle}>TimeAM</span>
        </div>
        <div className={styles.navLinks}>
          <a 
            href="/freelancer-pool" 
            className={styles.navLink}
            onClick={(e) => {
              if (onFreelancerPoolClick) {
                e.preventDefault();
                onFreelancerPoolClick();
              }
            }}
          >
            Freelancer Pool
          </a>
          <button onClick={onGetStarted} className={styles.navCta}>
            Anmelden
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className={styles.hero}>
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

      {/* Stats Section */}
      <section className={styles.stats} aria-labelledby="stats-heading">
        <div className={styles.sectionHeader}>
          <h2 id="stats-heading" className={styles.sectionTitle}>TimeAM in Zahlen</h2>
          <p className={styles.sectionSubtitle}>
            Vertrauen Sie auf eine bewährte Lösung mit beeindruckenden Ergebnissen.
          </p>
        </div>

        <div className={styles.statsGrid} role="list">
          {stats.map((stat) => (
            <div key={stat.label} className={styles.statCard} role="listitem">
              <div className={styles.statIcon} aria-hidden="true">{stat.icon}</div>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
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

      {/* Use Cases Section */}
      <section className={styles.useCases} aria-labelledby="usecases-heading">
        <div className={styles.sectionHeader}>
          <h2 id="usecases-heading" className={styles.sectionTitle}>Für jede Branche geeignet</h2>
          <p className={styles.sectionSubtitle}>
            TimeAM passt sich flexibel an die Anforderungen verschiedener Branchen an.
          </p>
        </div>

        <div className={styles.useCasesGrid} role="list">
          {useCases.map((useCase) => (
            <article key={useCase.title} className={styles.useCaseCard} role="listitem">
              <div className={styles.useCaseIcon} aria-hidden="true">{useCase.icon}</div>
              <h3 className={styles.useCaseTitle}>{useCase.title}</h3>
              <p className={styles.useCaseDescription}>{useCase.description}</p>
            </article>
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

      {/* Shift Pool Section */}
      <section className={styles.shiftPool} aria-labelledby="shiftpool-heading">
        <div className={styles.shiftPoolContent}>
          <div className={styles.shiftPoolHeader}>
            <span className={styles.shiftPoolBadge}>
              <span className={styles.badgeIconInline}>📋</span>
              Schicht-Pool
            </span>
            <h2 id="shiftpool-heading" className={styles.shiftPoolTitle}>
              Flexible Schichtbesetzung mit dem Schicht-Pool
            </h2>
            <p className={styles.shiftPoolSubtitle}>
              Veröffentlichen Sie offene Schichten und lassen Sie Ihre Mitarbeiter und Freelancer
              sich bewerben. Effiziente Schichtplanung war noch nie so einfach.
            </p>
          </div>

          <div className={styles.shiftPoolFeatures} role="list">
            {shiftPoolFeatures.map((feature) => (
              <div key={feature.title} className={styles.shiftPoolFeatureCard} role="listitem">
                <div className={styles.shiftPoolFeatureIcon} aria-hidden="true">
                  {feature.icon}
                </div>
                <h3 className={styles.shiftPoolFeatureTitle}>{feature.title}</h3>
                <p className={styles.shiftPoolFeatureDescription}>{feature.description}</p>
              </div>
            ))}
          </div>

          <div className={styles.shiftPoolProcess}>
            <h3 className={styles.processTitle}>So funktioniert der Schicht-Pool</h3>
            <div className={styles.processSteps}>
              {shiftPoolSteps.map((item, index) => (
                <div key={item.step} className={styles.processStep}>
                  <div className={styles.processStepNumber}>{item.step}</div>
                  <div className={styles.processStepContent}>
                    <h4 className={styles.processStepTitle}>{item.title}</h4>
                    <p className={styles.processStepDescription}>{item.description}</p>
                  </div>
                  {index < shiftPoolSteps.length - 1 && (
                    <div className={styles.processArrow} aria-hidden="true">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.shiftPoolCta}>
            <div className={styles.shiftPoolCtaCard}>
              <div className={styles.shiftPoolCtaIcon} aria-hidden="true">🚀</div>
              <h3 className={styles.shiftPoolCtaTitle}>
                Ideal für dynamische Teams und Freelancer-Netzwerke
              </h3>
              <p className={styles.shiftPoolCtaText}>
                Sparen Sie Zeit bei der Schichtplanung und geben Sie Ihrem Team mehr Flexibilität.
                Der Schicht-Pool passt sich automatisch an Ihre Bedürfnisse an.
              </p>
              <button onClick={onGetStarted} className={styles.shiftPoolCtaButton}>
                Schicht-Pool testen
                <span className={styles.ctaArrow}>→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className={styles.testimonials} aria-labelledby="testimonials-heading">
        <div className={styles.sectionHeader}>
          <h2 id="testimonials-heading" className={styles.sectionTitle}>Das sagen unsere Kunden</h2>
          <p className={styles.sectionSubtitle}>
            Überzeugen Sie sich von den Erfahrungen zufriedener TimeAM-Nutzer.
          </p>
        </div>

        <div className={styles.testimonialsGrid} role="list">
          {testimonials.map((testimonial) => (
            <article key={testimonial.author} className={styles.testimonialCard} role="listitem">
              <blockquote className={styles.testimonialQuote}>
                {testimonial.quote}
              </blockquote>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar} aria-hidden="true">{testimonial.avatar}</div>
                <div className={styles.testimonialInfo}>
                  <div className={styles.testimonialName}>{testimonial.author}</div>
                  <div className={styles.testimonialRole}>
                    {testimonial.role} bei {testimonial.company}
                  </div>
                </div>
              </div>
            </article>
          ))}
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

      {/* Trust & Security Section */}
      <section className={styles.trust} aria-labelledby="trust-heading">
        <div className={styles.sectionHeader}>
          <h2 id="trust-heading" className={styles.sectionTitle}>Sicherheit hat Priorität</h2>
          <p className={styles.sectionSubtitle}>
            Ihre Daten sind bei uns in besten Händen. Höchste Sicherheitsstandards garantiert.
          </p>
        </div>

        <div className={styles.trustGrid} role="list" aria-label="Sicherheitsfeatures">
          {trustFeatures.map((feature) => (
            <div key={feature.title} className={styles.trustCard} role="listitem">
              <div className={styles.trustIcon} aria-hidden="true">{feature.icon}</div>
              <h3 className={styles.trustTitle}>{feature.title}</h3>
              <p className={styles.trustDescription}>{feature.description}</p>
            </div>
          ))}
        </div>

        <div className={styles.trustBadges} role="list" aria-label="Zertifizierungen und Auszeichnungen">
          <div className={styles.trustBadge} role="listitem">
            <span className={styles.badgeIcon} aria-hidden="true">🏆</span>
            <span className={styles.badgeText}>TÜV-zertifiziert</span>
          </div>
          <div className={styles.trustBadge} role="listitem">
            <span className={styles.badgeIcon} aria-hidden="true">🛡️</span>
            <span className={styles.badgeText}>Geprüfte Datensicherheit</span>
          </div>
          <div className={styles.trustBadge} role="listitem">
            <span className={styles.badgeIcon} aria-hidden="true">⭐</span>
            <span className={styles.badgeText}>Trusted by 500+ Companies</span>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className={styles.faq} aria-labelledby="faq-heading">
        <div className={styles.sectionHeader}>
          <h2 id="faq-heading" className={styles.sectionTitle}>Häufig gestellte Fragen</h2>
          <p className={styles.sectionSubtitle}>
            Hier finden Sie Antworten auf die wichtigsten Fragen zu TimeAM.
          </p>
        </div>

        <div className={styles.faqList} role="list">
          {faqs.map((faq, index) => (
            <div key={index} className={styles.faqItem} role="listitem">
              <h3>
                <button
                  className={styles.faqQuestion}
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  aria-expanded={openFaqIndex === index}
                  aria-controls={`faq-answer-${index}`}
                  id={`faq-question-${index}`}
                >
                  <span>{faq.question}</span>
                  <span
                    className={`${styles.faqIcon} ${openFaqIndex === index ? styles.faqIconOpen : ''}`}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>
              </h3>
              {openFaqIndex === index && (
                <div
                  className={styles.faqAnswer}
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-question-${index}`}
                >
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
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
