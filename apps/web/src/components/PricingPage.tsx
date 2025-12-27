/**
 * Pricing Page Component
 *
 * Öffentliche Pricing-Seite für TimeAM mit allen Plänen und Add-ons.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePricingPlans, usePricingAddons } from '../modules/stripe/hooks';
import { useAuth } from '../core/auth';
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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { plans: stripePlans, loading: plansLoading } = usePricingPlans();
  const { addons: stripeAddons, loading: addonsLoading } = usePricingAddons();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isScrolled, setIsScrolled] = useState(false);
  const [showCanceledMessage, setShowCanceledMessage] = useState(false);

  // Prüfe ob User von einem abgebrochenen Checkout kommt
  useEffect(() => {
    const canceled = searchParams.get('canceled');
    if (canceled === 'true') {
      setShowCanceledMessage(true);
      // Entferne Parameter aus URL nach 5 Sekunden
      setTimeout(() => {
        setShowCanceledMessage(false);
        navigate('/pricing', { replace: true });
      }, 5000);
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = (planId?: string) => {
    if (planId) {
      // Weiterleitung zu Checkout mit Plan-Kontext
      if (user) {
        // User ist eingeloggt -> direkt zu Checkout
        navigate(`/checkout?planId=${planId}&billingCycle=${billingCycle}`);
      } else {
        // User nicht eingeloggt -> zu Registrierung mit Plan-Kontext
        navigate(`/login?planId=${planId}&billingCycle=${billingCycle}&mode=register`);
      }
    } else {
      // Fallback: Standard-Verhalten
      if (onGetStarted) {
        onGetStarted();
      } else {
        navigate('/login');
      }
    }
  };

  // Transform Stripe Plans to PricingPage format
  const plans = stripePlans.map(plan => {
    const priceMonthly = plan.pricePerUser / 100; // Convert from cents
    const priceYearly = plan.pricePerUserYearly ? plan.pricePerUserYearly / 100 : priceMonthly * 0.85; // 15% discount if not set
    const minimumPriceMonthly = plan.minimumPrice / 100;
    const minimumPriceYearly = plan.minimumPriceYearly ? plan.minimumPriceYearly / 100 : minimumPriceMonthly * 0.85;

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceMonthly,
      priceYearly,
      minimumPriceMonthly,
      minimumPriceYearly,
      targetGroup: plan.targetGroup || '',
      features: plan.features || [],
      includedModules: plan.includedModules || [],
      popular: plan.id === 'pro', // Mark 'pro' as popular by default
    };
  });

  // Transform Stripe Addons to PricingPage format
  const addons = stripeAddons.map(addon => {
    const priceMonthly = addon.pricePerUser / 100;
    const priceYearly = addon.pricePerUserYearly ? addon.pricePerUserYearly / 100 : priceMonthly * 0.85;
    const minimumPriceMonthly = addon.minimumPrice / 100;
    const minimumPriceYearly = addon.minimumPriceYearly ? addon.minimumPriceYearly / 100 : minimumPriceMonthly * 0.85;

    return {
      id: addon.id,
      name: addon.name,
      description: addon.description,
      priceMonthly,
      priceYearly,
      minimumPriceMonthly,
      minimumPriceYearly,
      icon: addon.icon || '🔧',
      moduleId: addon.moduleId,
      features: [], // Addons don't have features in Stripe, but we can add them later
    };
  });

  const calculatePrice = (pricePerUser: number, users: number, minimumPrice: number, isYearly: boolean) => {
    const discount = isYearly ? 0.15 : 0;
    const adjustedPricePerUser = pricePerUser * (1 - discount);
    const total = Math.max(adjustedPricePerUser * users, minimumPrice * (1 - discount));
    return total;
  };

  // Example scenarios for pricing calculator (use first available plans/addons)
  const exampleCalculations = plans.length > 0 && addons.length >= 2 ? [
    {
      scenario: 'Firma mit 20 Nutzern, Plan Pro + Compliance + Integrationen',
      users: 20,
      plan: plans[1] || plans[0],
      addons: [addons[0], addons[2] || addons[1]],
    },
    {
      scenario: 'Firma mit 8 Nutzern, Plan Basic',
      users: 8,
      plan: plans[0],
      addons: [],
    },
  ] : [];

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
          {showCanceledMessage && (
            <div className={styles.canceledMessage}>
              <p>💡 Du hast den Checkout-Prozess abgebrochen. Kein Problem! Du kannst jederzeit einen Plan auswählen und fortfahren.</p>
            </div>
          )}
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
        {plansLoading ? (
          <div className={styles.loading}>Laden...</div>
        ) : plans.length === 0 ? (
          <div className={styles.emptyState}>Keine Pläne verfügbar. Bitte später erneut versuchen.</div>
        ) : (
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
                  onClick={() => handleGetStarted(plan.id)}
                >
                  Jetzt starten
                </button>
              </div>
            );
          })}
          </div>
        )}
      </section>

      {/* Add-ons Section */}
      <section className={styles.addonsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Optionale Add-ons</h2>
          <p className={styles.sectionSubtitle}>
            Erweitere deinen Plan mit zusätzlichen Features. Monatlich zu-/abbuchbar.
          </p>
        </div>
        {addonsLoading ? (
          <div className={styles.loading}>Laden...</div>
        ) : addons.length === 0 ? (
          <div className={styles.emptyState}>Keine Add-ons verfügbar.</div>
        ) : (
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
        )}
      </section>

      {/* Module Details Section - Removed as module details are now in Stripe plans */}

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

