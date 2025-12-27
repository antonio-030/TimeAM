/**
 * Subscription Management Page
 *
 * Verwaltung von Abonnements für Tenants.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMySubscription, useUpdateUserCount, useUpdatePlan, useManageAddons } from './hooks';
import { usePricingPlans, usePricingAddons } from '../../modules/stripe/hooks';
import styles from './SubscriptionManagementPage.module.css';

export function SubscriptionManagementPage() {
  const navigate = useNavigate();
  const { subscription, loading, error, refresh } = useMySubscription();
  const { plans } = usePricingPlans();
  const { addons } = usePricingAddons();
  const { update: updateUserCount, loading: updatingUserCount } = useUpdateUserCount();
  const { update: updatePlan, loading: updatingPlan } = useUpdatePlan();
  const { add: addAddon, remove: removeAddon, loading: managingAddons } = useManageAddons();

  const [newUserCount, setNewUserCount] = useState(1);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [proratedPreview, setProratedPreview] = useState<{
    immediateCharge: number;
    nextPeriodAmount: number;
    daysRemaining: number;
  } | null>(null);

  useEffect(() => {
    if (subscription) {
      console.log('🔄 Subscription geladen, setze newUserCount:', subscription.subscription.userCount);
      setNewUserCount(subscription.subscription.userCount);
    }
  }, [subscription]);

  useEffect(() => {
    if (subscription) {
      console.log('🔄 Berechne anteilige Vorschau für newUserCount:', newUserCount);
      // Verwende setTimeout, um sicherzustellen, dass der State aktualisiert ist
      const timer = setTimeout(() => {
        calculateProratedPreview();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [subscription, newUserCount]);

  const calculateProratedPreview = () => {
    console.log('📊 calculateProratedPreview aufgerufen');
    console.log('📊 subscription:', subscription ? 'vorhanden' : 'fehlt');
    console.log('📊 newUserCount:', newUserCount);
    console.log('📊 subscription.userCount:', subscription?.subscription.userCount);
    
    if (!subscription) {
      console.log('⚠️ Keine Subscription, setze proratedPreview auf null');
      setProratedPreview(null);
      return;
    }
    
    if (newUserCount <= subscription.subscription.userCount) {
      console.log('⚠️ newUserCount <= subscription.userCount, setze proratedPreview auf null');
      setProratedPreview(null);
      return;
    }
    
    console.log('✅ Berechne anteilige Vorschau...');

    const isYearly = subscription.subscription.billingCycle === 'yearly';
    const pricePerUser = isYearly && subscription.plan.pricePerUserYearly
      ? subscription.plan.pricePerUserYearly
      : subscription.plan.pricePerUser;

    console.log('📊 Preis pro Nutzer:', pricePerUser, 'Cent');
    console.log('📊 Billing Cycle:', subscription.subscription.billingCycle);

    const periodStart = new Date(subscription.subscription.currentPeriodStart);
    const periodEnd = new Date(subscription.subscription.currentPeriodEnd);
    const now = new Date();

    console.log('📅 Period Start:', periodStart.toISOString());
    console.log('📅 Period End:', periodEnd.toISOString());
    console.log('📅 Jetzt:', now.toISOString());

    const totalDaysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    console.log('📅 Tage im Period:', totalDaysInPeriod);
    console.log('📅 Verbleibende Tage:', daysRemaining);

    if (daysRemaining <= 0) {
      console.log('⚠️ Tage <= 0, Periode ist abgelaufen');
      console.log('💡 Berechne für nächste Periode...');
      
      // Wenn Periode abgelaufen, berechne für die nächste Periode
      // Setze periodEnd auf periodStart + 1 Monat/Jahr
      const nextPeriodEnd = new Date(periodEnd);
      if (subscription.subscription.billingCycle === 'yearly') {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      } else {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
      }
      
      const nextTotalDays = Math.ceil((nextPeriodEnd.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));
      const userDifference = newUserCount - subscription.subscription.userCount;
      const immediateCharge = 0; // Keine sofortige Zahlung, da Periode abgelaufen
      const nextPeriodAmount = pricePerUser * newUserCount;
      
      console.log('💰 Nächste Period Zahlung (neue Periode):', nextPeriodAmount, 'Cent');
      
      const preview = {
        immediateCharge: 0,
        nextPeriodAmount,
        daysRemaining: nextTotalDays,
      };
      
      console.log('✅ Setze proratedPreview (nächste Periode):', preview);
      setProratedPreview(preview);
      return;
    }

    const userDifference = newUserCount - subscription.subscription.userCount;
    console.log('👥 Nutzer-Differenz:', userDifference);
    
    const proratedAmountPerUser = (pricePerUser * daysRemaining) / totalDaysInPeriod;
    const immediateCharge = Math.round(proratedAmountPerUser * userDifference);
    const nextPeriodAmount = pricePerUser * newUserCount;

    console.log('💰 Anteiliger Betrag pro Nutzer:', proratedAmountPerUser, 'Cent');
    console.log('💰 Sofortige Zahlung:', immediateCharge, 'Cent');
    console.log('💰 Nächste Period Zahlung:', nextPeriodAmount, 'Cent');

    const preview = {
      immediateCharge,
      nextPeriodAmount,
      daysRemaining,
    };
    
    console.log('✅ Setze proratedPreview:', preview);
    setProratedPreview(preview);
    console.log('✅ proratedPreview gesetzt');
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleUpdateUserCount = async () => {
    if (!subscription) {
      console.error('❌ Keine Subscription gefunden');
      alert('Fehler: Keine Subscription gefunden');
      return;
    }
    
    console.log('🔄 Starte Nutzeranzahl-Update...');
    console.log('📊 Aktuelle Nutzeranzahl:', subscription.subscription.userCount);
    console.log('📊 Neue Nutzeranzahl:', newUserCount);
    console.log('📊 Aktuelle Mitgliederanzahl:', subscription.currentMemberCount);
    
    if (newUserCount < subscription.currentMemberCount) {
      const message = `Die Nutzeranzahl muss mindestens ${subscription.currentMemberCount} sein (aktuelle Mitgliederanzahl).`;
      console.error('❌ Validierung fehlgeschlagen:', message);
      alert(message);
      return;
    }
    
    if (newUserCount === subscription.subscription.userCount) {
      console.log('ℹ️ Keine Änderung - Nutzeranzahl ist bereits', newUserCount);
      return; // Keine Änderung
    }
    
    if (newUserCount < subscription.subscription.userCount) {
      const message = 'Die Nutzeranzahl kann nur erhöht, nicht verringert werden.';
      console.error('❌ Validierung fehlgeschlagen:', message);
      alert(message);
      return;
    }
    
    try {
      console.log('📡 Sende Update-Request an API...');
      const result = await updateUserCount(newUserCount);
      console.log('✅ API-Response erhalten:', result);
      
      console.log('🔄 Lade Subscription neu...');
      await refresh();
      console.log('✅ Subscription neu geladen');
      
      // Zeige anteilige Berechnung, falls vorhanden
      if (result.proratedAmount.immediateCharge > 0) {
        const message = `Nutzeranzahl erfolgreich aktualisiert!\n\nSofortige Zahlung: ${formatPrice(result.proratedAmount.immediateCharge)} €\nNächste Zahlung: ${formatPrice(result.proratedAmount.nextPeriodAmount)} €`;
        console.log('💰 Zahlungsinfo:', message);
        alert(message);
      } else {
        console.log('✅ Nutzeranzahl aktualisiert (keine sofortige Zahlung)');
        alert('Nutzeranzahl erfolgreich aktualisiert!');
      }
    } catch (err) {
      console.error('❌ Fehler beim Aktualisieren der Nutzeranzahl:', err);
      const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren der Nutzeranzahl';
      console.error('❌ Fehlermeldung:', message);
      alert(`Fehler: ${message}`);
    }
  };

  const handleUpdatePlan = async () => {
    if (!subscription || !selectedPlanId) return;
    
    try {
      await updatePlan(selectedPlanId);
      await refresh();
      setShowPlanModal(false);
      alert('Plan erfolgreich gewechselt!');
    } catch (err) {
      console.error('Error updating plan:', err);
      alert('Fehler beim Wechseln des Plans');
    }
  };

  const handleToggleAddon = async (addonId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await removeAddon(addonId);
      } else {
        await addAddon(addonId);
      }
      await refresh();
    } catch (err) {
      console.error('Error toggling addon:', err);
      alert('Fehler beim Ändern des Addons');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Laden...</div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Keine aktive Subscription gefunden</h2>
          <p>{error || 'Sie haben noch kein Abo aktiviert.'}</p>
          <button onClick={() => navigate('/pricing')} className={styles.ctaButton}>
            Jetzt Abo buchen
          </button>
        </div>
      </div>
    );
  }

  const isYearly = subscription.subscription.billingCycle === 'yearly';
  const pricePerUser = isYearly && subscription.plan.pricePerUserYearly
    ? subscription.plan.pricePerUserYearly
    : subscription.plan.pricePerUser;
  const minimumPrice = isYearly && subscription.plan.minimumPriceYearly
    ? subscription.plan.minimumPriceYearly
    : subscription.plan.minimumPrice;

  const currentPrice = Math.max(pricePerUser * subscription.subscription.userCount, minimumPrice);
  const nextPeriodPrice = subscription.proratedInfo
    ? subscription.proratedInfo.nextPeriodAmount
    : currentPrice;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Abonnement verwalten</h1>
        <p>Verwalten Sie Ihr Abo, Nutzeranzahl und Add-ons</p>
      </div>

      {/* Aktueller Plan */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Aktueller Plan</h2>
          <button
            onClick={() => setShowPlanModal(true)}
            className={styles.editButton}
            disabled={updatingPlan}
          >
            Plan ändern
          </button>
        </div>
        <div className={styles.planCard}>
          <h3>{subscription.plan.name}</h3>
          <p>{subscription.plan.description}</p>
          <div className={styles.planDetails}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Abrechnungszyklus:</span>
              <span className={styles.detailValue}>
                {subscription.subscription.billingCycle === 'monthly' ? 'Monatlich' : 'Jährlich'}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Nächste Abrechnung:</span>
              <span className={styles.detailValue}>
                {formatDate(subscription.subscription.currentPeriodEnd)}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Aktueller Preis:</span>
              <span className={styles.detailValue}>
                {formatPrice(currentPrice)} € / {subscription.subscription.billingCycle === 'monthly' ? 'Monat' : 'Jahr'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Nutzeranzahl */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Nutzeranzahl</h2>
        </div>
        <div className={styles.userCountCard}>
          <div className={styles.userCountInfo}>
            <div className={styles.userCountCurrent}>
              <span className={styles.userCountLabel}>Aktuell:</span>
              <span className={styles.userCountValue}>{subscription.currentMemberCount} / {subscription.subscription.userCount}</span>
            </div>
            {!subscription.canAddMoreMembers && (
              <div className={styles.warning}>
                ⚠️ Nutzergrenze erreicht! Erhöhen Sie die Nutzeranzahl in Ihrem Abo, um weitere Nutzer hinzuzufügen.
              </div>
            )}
          </div>
          
          <div className={styles.pricePerUserInfo}>
            <div className={styles.pricePerUserRow}>
              <span className={styles.pricePerUserLabel}>Preis pro Nutzer:</span>
              <span className={styles.pricePerUserValue}>
                {formatPrice(pricePerUser)} € / {subscription.subscription.billingCycle === 'monthly' ? 'Monat' : 'Jahr'}
              </span>
            </div>
            <div className={styles.pricePerUserRow}>
              <span className={styles.pricePerUserLabel}>Aktueller Gesamtpreis:</span>
              <span className={styles.pricePerUserValue}>
                {formatPrice(currentPrice)} € / {subscription.subscription.billingCycle === 'monthly' ? 'Monat' : 'Jahr'}
              </span>
            </div>
          </div>
          
          <div className={styles.userCountEditor}>
            <label className={styles.userCountInputLabel}>
              Nutzeranzahl im Abo erhöhen:
              <div className={styles.userCountInputWrapper}>
                <input
                  type="number"
                  min={subscription.currentMemberCount}
                  value={newUserCount}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    console.log('📝 Input geändert:', inputValue);
                    const value = Math.max(subscription.currentMemberCount, parseInt(inputValue, 10) || subscription.currentMemberCount);
                    console.log('📝 Neue Nutzeranzahl gesetzt:', value);
                    setNewUserCount(value);
                  }}
                  className={styles.userCountInput}
                  disabled={updatingUserCount}
                />
                <span className={styles.userCountUnit}>Nutzer</span>
                <span className={styles.pricePerUserInline}>
                  × {formatPrice(pricePerUser)} € = {formatPrice(pricePerUser * newUserCount)} €
                </span>
                {(() => {
                  const isIncreased = newUserCount > subscription.subscription.userCount;
                  const hasProratedPreview = proratedPreview && proratedPreview.immediateCharge > 0;
                  const isDisabled = updatingUserCount || newUserCount < subscription.currentMemberCount || newUserCount === subscription.subscription.userCount;
                  
                  console.log('🔘 Button-Zustand:', {
                    newUserCount,
                    currentUserCount: subscription.subscription.userCount,
                    currentMemberCount: subscription.currentMemberCount,
                    isIncreased,
                    hasProratedPreview,
                    proratedPreview,
                    isDisabled,
                    updatingUserCount,
                  });
                  
                  // Wenn erhöht, zeige immer "Jetzt kaufen" Button (auch wenn proratedPreview noch nicht berechnet)
                  if (isIncreased) {
                    const chargeAmount = proratedPreview?.immediateCharge || 0;
                    return (
                      <button
                        onClick={handleUpdateUserCount}
                        className={styles.buyButton}
                        disabled={isDisabled}
                      >
                        {updatingUserCount ? 'Wird verarbeitet...' : chargeAmount > 0 ? `Jetzt kaufen (${formatPrice(chargeAmount)} €)` : 'Jetzt kaufen'}
                      </button>
                    );
                  } else {
                    return (
                      <button
                        onClick={handleUpdateUserCount}
                        className={styles.updateButton}
                        disabled={isDisabled}
                      >
                        {updatingUserCount ? 'Aktualisiere...' : 'Aktualisieren'}
                      </button>
                    );
                  }
                })()}
              </div>
            </label>
            
            {newUserCount > subscription.subscription.userCount && proratedPreview && (
              <div className={styles.pricePreview}>
                <p className={styles.pricePreviewLabel}>Kostenübersicht bei Erhöhung:</p>
                <div className={styles.pricePreviewDetails}>
                  <div className={styles.pricePreviewRow}>
                    <span>Aktueller Preis ({subscription.subscription.userCount} Nutzer):</span>
                    <span>{formatPrice(currentPrice)} € / {subscription.subscription.billingCycle === 'monthly' ? 'Monat' : 'Jahr'}</span>
                  </div>
                  <div className={styles.pricePreviewRow}>
                    <span>Neuer Preis ({newUserCount} Nutzer):</span>
                    <span className={styles.pricePreviewNew}>
                      {formatPrice(Math.max(pricePerUser * newUserCount, minimumPrice))} € / {subscription.subscription.billingCycle === 'monthly' ? 'Monat' : 'Jahr'}
                    </span>
                  </div>
                  {proratedPreview.immediateCharge > 0 && (
                    <div className={styles.pricePreviewRowHighlight}>
                      <span>💰 Sofortige Zahlung (anteilig für Rest des Monats):</span>
                      <span className={styles.pricePreviewImmediate}>
                        {formatPrice(proratedPreview.immediateCharge)} €
                        <span className={styles.pricePreviewDays}>
                          {' '}({proratedPreview.daysRemaining} Tage)
                        </span>
                      </span>
                    </div>
                  )}
                  <div className={styles.pricePreviewRow}>
                    <span>📅 Nächste {subscription.subscription.billingCycle === 'monthly' ? 'monatliche' : 'jährliche'} Abrechnung ({formatDate(subscription.subscription.currentPeriodEnd)}):</span>
                    <span className={styles.pricePreviewNext}>
                      {formatPrice(proratedPreview.nextPeriodAmount)} €
                    </span>
                  </div>
                </div>
                <p className={styles.pricePreviewNote}>
                  ℹ️ Die sofortige Zahlung wird sofort abgebucht. Ab dem {formatDate(subscription.subscription.currentPeriodEnd)} wird dann {subscription.subscription.billingCycle === 'monthly' ? 'monatlich' : 'jährlich'} der neue Preis ({formatPrice(Math.max(pricePerUser * newUserCount, minimumPrice))} €) abgerechnet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add-ons */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Add-ons</h2>
        </div>
        <div className={styles.addonsGrid}>
          {addons.map((addon) => {
            const isActive = subscription.subscription.addonIds.includes(addon.id);
            const addonPrice = isYearly && addon.pricePerUserYearly
              ? addon.pricePerUserYearly
              : addon.pricePerUser;
            const addonMinimum = isYearly && addon.minimumPriceYearly
              ? addon.minimumPriceYearly
              : addon.minimumPrice;
            const addonTotal = Math.max(addonPrice * subscription.subscription.userCount, addonMinimum);

            return (
              <div key={addon.id} className={`${styles.addonCard} ${isActive ? styles.addonActive : ''}`}>
                <div className={styles.addonHeader}>
                  <h3>{addon.name}</h3>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleToggleAddon(addon.id, isActive)}
                      disabled={managingAddons}
                    />
                    <span className={styles.toggleSlider}></span>
                  </label>
                </div>
                <p className={styles.addonDescription}>{addon.description}</p>
                <div className={styles.addonPrice}>
                  {formatPrice(addonTotal)} € / {subscription.subscription.billingCycle === 'monthly' ? 'Monat' : 'Jahr'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showPlanModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPlanModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Plan wechseln</h3>
            <div className={styles.modalContent}>
              <label>
                Neuer Plan:
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="">Bitte wählen...</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {formatPrice(isYearly && plan.pricePerUserYearly ? plan.pricePerUserYearly : plan.pricePerUser)} € / Nutzer
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.modalActions}>
              <button onClick={() => setShowPlanModal(false)} className={styles.cancelButton}>
                Abbrechen
              </button>
              <button onClick={handleUpdatePlan} className={styles.saveButton} disabled={updatingPlan || !selectedPlanId}>
                {updatingPlan ? 'Wechseln...' : 'Plan wechseln'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

