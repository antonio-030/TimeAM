/**
 * Stripe Page
 *
 * Verwaltung von Modulen, Preisen und Abonnements für Dev-Tenant.
 */

import { useState, useEffect } from 'react';
import { usePricingPlans, usePricingAddons, useTenantSubscriptions } from './hooks';
import { useAllTenants } from '../admin/hooks';
import { getStripeConfig, updateStripeConfig, validateStripeConfig, type StripeConfig, upsertPricingPlan, deletePricingPlan, upsertPricingAddon, type PricingPlan, type PricingAddon, type UpsertPricingPlanRequest, type UpsertPricingAddonRequest, getModuleStatus, type ModuleStatusItem } from './api';
import { MODULE_REGISTRY, MODULE_CATEGORY, getCoreModules } from '../../core/modules';
import styles from './StripePage.module.css';

export function StripePage() {
  const { plans, loading: plansLoading, refresh: refreshPlans } = usePricingPlans();
  const { addons, loading: addonsLoading, refresh: refreshAddons } = usePricingAddons();
  const { tenants } = useAllTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const { subscriptions, loading: subscriptionsLoading, refresh: refreshSubscriptions } = useTenantSubscriptions(selectedTenantId);
  
  // Stripe Config State
  const [config, setConfig] = useState<StripeConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [publishableKey, setPublishableKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  // Load Stripe Config
  useEffect(() => {
    async function loadConfig() {
      setConfigLoading(true);
      try {
        const loadedConfig = await getStripeConfig();
        setConfig(loadedConfig);
        if (loadedConfig) {
          setPublishableKey(loadedConfig.publishableKey || '');
          setWebhookSecret(loadedConfig.webhookSecret || '');
        }
      } catch (err) {
        console.error('Error loading Stripe config:', err);
      } finally {
        setConfigLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSaveConfig = async () => {
    if (!publishableKey || !publishableKey.startsWith('pk_')) {
      setConfigError('Ungültiges Format für Publishable Key (muss mit pk_ beginnen)');
      return;
    }

    setIsSaving(true);
    setConfigError(null);
    setConfigSuccess(null);

    try {
      const updatedConfig = await updateStripeConfig({
        publishableKey,
        webhookSecret: webhookSecret || undefined,
      });
      setConfig(updatedConfig);
      setConfigSuccess('Konfiguration erfolgreich gespeichert');
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidateConfig = async () => {
    setConfigError(null);
    setConfigSuccess(null);
    try {
      const validation = await validateStripeConfig();
      if (validation.valid) {
        setConfigSuccess('Konfiguration ist gültig');
      } else {
        setConfigError(validation.message || 'Konfiguration ist ungültig');
      }
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Fehler bei der Validierung');
    }
  };

  // Plan Edit Modal State
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [isNewPlan, setIsNewPlan] = useState(false);
  const [planFormData, setPlanFormData] = useState<Partial<UpsertPricingPlanRequest>>({
    id: '',
    name: '',
    description: '',
    pricePerUser: 0,
    minimumPrice: 0,
    pricePerUserYearly: 0,
    minimumPriceYearly: 0,
    includedModules: [],
    features: [],
    targetGroup: '',
  });
  // Euro-Werte für die Eingabe (z.B. 2.99 statt 299 Cent)
  const [planPricePerUserEuro, setPlanPricePerUserEuro] = useState<string>('0');
  const [planMinimumPriceEuro, setPlanMinimumPriceEuro] = useState<string>('0');
  const [planPricePerUserYearlyEuro, setPlanPricePerUserYearlyEuro] = useState<string>('0');
  const [planMinimumPriceYearlyEuro, setPlanMinimumPriceYearlyEuro] = useState<string>('0');
  const [planFeaturesText, setPlanFeaturesText] = useState('');
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Load active modules for dev-tenant
  const [activeModules, setActiveModules] = useState<ModuleStatusItem[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);

  useEffect(() => {
    async function loadActiveModules() {
      setModulesLoading(true);
      try {
        const modules = await getModuleStatus();
        // Nur aktive optionale Module, die nicht für dev-only sind
        const activeOptionalModules = modules.filter(
          mod => mod.category === 'optional' && mod.isActive
        );
        setActiveModules(activeOptionalModules);
      } catch (err) {
        console.error('Error loading active modules:', err);
        // Fallback: Alle optionalen Module anzeigen (wenn API fehlschlägt)
        const fallbackModules = Object.values(MODULE_REGISTRY).filter(
          mod => mod.category === MODULE_CATEGORY.OPTIONAL && mod.targetTenantType !== 'dev'
        );
        setActiveModules(fallbackModules.map(mod => ({
          id: mod.id,
          displayName: mod.displayName,
          description: mod.description,
          icon: mod.icon,
          category: 'optional' as const,
          isActive: true,
          canToggle: true,
        })));
      } finally {
        setModulesLoading(false);
      }
    }
    loadActiveModules();
  }, []);

  // Get available modules (only active optional modules for plans)
  const availableModules = activeModules.map(mod => MODULE_REGISTRY[mod.id]).filter(Boolean);
  
  // Get core modules (always included in plans)
  // Filtere nur Core-Module, die für Firmen-Tenants verfügbar sind (nicht dev-only)
  const coreModules = getCoreModules().filter(mod => 
    !mod.targetTenantType || mod.targetTenantType === 'all' || mod.targetTenantType === 'company'
  );

  // Hilfsfunktion: Cent zu Euro (für Anzeige)
  const centToEuro = (cents: number): string => {
    return (cents / 100).toFixed(2);
  };

  // Hilfsfunktion: Euro zu Cent (für Speicherung)
  const euroToCent = (euro: string): number => {
    const value = parseFloat(euro) || 0;
    return Math.round(value * 100);
  };

  const openPlanEditModal = (plan?: PricingPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setIsNewPlan(false);
      setPlanFormData({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        pricePerUser: plan.pricePerUser,
        minimumPrice: plan.minimumPrice,
        pricePerUserYearly: plan.pricePerUserYearly || 0,
        minimumPriceYearly: plan.minimumPriceYearly || 0,
        includedModules: plan.includedModules || [],
        features: plan.features || [],
        targetGroup: plan.targetGroup || '',
      });
      // Setze Euro-Werte für Eingabe
      setPlanPricePerUserEuro(centToEuro(plan.pricePerUser));
      setPlanMinimumPriceEuro(centToEuro(plan.minimumPrice));
      setPlanPricePerUserYearlyEuro(plan.pricePerUserYearly ? centToEuro(plan.pricePerUserYearly) : '0');
      setPlanMinimumPriceYearlyEuro(plan.minimumPriceYearly ? centToEuro(plan.minimumPriceYearly) : '0');
      setPlanFeaturesText((plan.features || []).join('\n'));
    } else {
      setEditingPlan(null);
      setIsNewPlan(true);
      // Bei neuen Plans: Core-Module standardmäßig auswählen
      const defaultCoreModuleIds = coreModules.map(mod => mod.id);
      setPlanFormData({
        id: '',
        name: '',
        description: '',
        pricePerUser: 0,
        minimumPrice: 0,
        pricePerUserYearly: 0,
        minimumPriceYearly: 0,
        includedModules: defaultCoreModuleIds,
        features: [],
        targetGroup: '',
      });
      setPlanPricePerUserEuro('0');
      setPlanMinimumPriceEuro('0');
      setPlanPricePerUserYearlyEuro('0');
      setPlanMinimumPriceYearlyEuro('0');
      setPlanFeaturesText('');
    }
    setPlanError(null);
  };

  const closePlanEditModal = () => {
    setEditingPlan(null);
    setIsNewPlan(false);
    setPlanFormData({
      id: '',
      name: '',
      description: '',
      pricePerUser: 0,
      minimumPrice: 0,
      pricePerUserYearly: 0,
      minimumPriceYearly: 0,
      includedModules: [],
      features: [],
      targetGroup: '',
    });
    setPlanPricePerUserEuro('0');
    setPlanMinimumPriceEuro('0');
    setPlanPricePerUserYearlyEuro('0');
    setPlanMinimumPriceYearlyEuro('0');
    setPlanFeaturesText('');
    setPlanError(null);
  };

  const handlePlanModuleToggle = (moduleId: string) => {
    const currentModules = planFormData.includedModules || [];
    // Core-Module können nicht deaktiviert werden
    const isCoreModule = coreModules.some(mod => mod.id === moduleId);
    if (isCoreModule) {
      return; // Core-Module sind immer aktiv
    }
    
    if (currentModules.includes(moduleId)) {
      setPlanFormData({
        ...planFormData,
        includedModules: currentModules.filter(id => id !== moduleId),
      });
    } else {
      setPlanFormData({
        ...planFormData,
        includedModules: [...currentModules, moduleId],
      });
    }
  };
  
  const handleDeletePlan = async (planId: string) => {
    if (!confirm(`Möchten Sie den Plan "${planId}" wirklich löschen?`)) {
      return;
    }
    
    try {
      await deletePricingPlan(planId);
      await refreshPlans();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Löschen des Plans');
    }
  };

  const handleSavePlan = async () => {
    // Konvertiere Euro zu Cent
    const pricePerUserCent = euroToCent(planPricePerUserEuro);
    const minimumPriceCent = euroToCent(planMinimumPriceEuro);
    const pricePerUserYearlyCent = planPricePerUserYearlyEuro && parseFloat(planPricePerUserYearlyEuro) > 0 
      ? euroToCent(planPricePerUserYearlyEuro) 
      : undefined;
    const minimumPriceYearlyCent = planMinimumPriceYearlyEuro && parseFloat(planMinimumPriceYearlyEuro) > 0
      ? euroToCent(planMinimumPriceYearlyEuro)
      : undefined;

    if (!planFormData.id || !planFormData.name || !pricePerUserCent || !minimumPriceCent) {
      setPlanError('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    setPlanSaving(true);
    setPlanError(null);

    try {
      const features = planFeaturesText.split('\n').filter(f => f.trim()).map(f => f.trim());
      
      // Stelle sicher, dass Core-Module immer enthalten sind
      const coreModuleIds = coreModules.map(mod => mod.id);
      const currentModules = planFormData.includedModules || [];
      const allModules = [...new Set([...coreModuleIds, ...currentModules])];
      
      const request: UpsertPricingPlanRequest = {
        id: planFormData.id,
        name: planFormData.name,
        description: planFormData.description || '',
        pricePerUser: pricePerUserCent,
        minimumPrice: minimumPriceCent,
        pricePerUserYearly: pricePerUserYearlyCent,
        minimumPriceYearly: minimumPriceYearlyCent,
        includedModules: allModules,
        features,
        targetGroup: planFormData.targetGroup || undefined,
      };

      await upsertPricingPlan(request);
      await refreshPlans();
      closePlanEditModal();
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setPlanSaving(false);
    }
  };

  // Addon Edit Modal State
  const [editingAddon, setEditingAddon] = useState<PricingAddon | null>(null);
  const [isNewAddon, setIsNewAddon] = useState(false);
  const [addonFormData, setAddonFormData] = useState<Partial<UpsertPricingAddonRequest>>({
    id: '',
    moduleId: '',
    name: '',
    description: '',
    pricePerUser: 0,
    minimumPrice: 0,
    pricePerUserYearly: 0,
    minimumPriceYearly: 0,
    icon: '',
  });
  // Euro-Werte für die Eingabe (z.B. 2.99 statt 299 Cent)
  const [addonPricePerUserEuro, setAddonPricePerUserEuro] = useState<string>('0');
  const [addonMinimumPriceEuro, setAddonMinimumPriceEuro] = useState<string>('0');
  const [addonPricePerUserYearlyEuro, setAddonPricePerUserYearlyEuro] = useState<string>('0');
  const [addonMinimumPriceYearlyEuro, setAddonMinimumPriceYearlyEuro] = useState<string>('0');
  const [addonSaving, setAddonSaving] = useState(false);
  const [addonError, setAddonError] = useState<string | null>(null);

  const openAddonEditModal = (addon?: PricingAddon) => {
    if (addon) {
      setEditingAddon(addon);
      setIsNewAddon(false);
      setAddonFormData({
        id: addon.id,
        moduleId: addon.moduleId,
        name: addon.name,
        description: addon.description,
        pricePerUser: addon.pricePerUser,
        minimumPrice: addon.minimumPrice,
        pricePerUserYearly: addon.pricePerUserYearly || 0,
        minimumPriceYearly: addon.minimumPriceYearly || 0,
        icon: addon.icon || '',
      });
      // Setze Euro-Werte für Eingabe
      setAddonPricePerUserEuro(centToEuro(addon.pricePerUser));
      setAddonMinimumPriceEuro(centToEuro(addon.minimumPrice));
      setAddonPricePerUserYearlyEuro(addon.pricePerUserYearly ? centToEuro(addon.pricePerUserYearly) : '0');
      setAddonMinimumPriceYearlyEuro(addon.minimumPriceYearly ? centToEuro(addon.minimumPriceYearly) : '0');
    } else {
      setEditingAddon(null);
      setIsNewAddon(true);
      setAddonFormData({
        id: '',
        moduleId: '',
        name: '',
        description: '',
        pricePerUser: 0,
        minimumPrice: 0,
        pricePerUserYearly: 0,
        minimumPriceYearly: 0,
        icon: '',
      });
      setAddonPricePerUserEuro('0');
      setAddonMinimumPriceEuro('0');
      setAddonPricePerUserYearlyEuro('0');
      setAddonMinimumPriceYearlyEuro('0');
    }
    setAddonError(null);
  };

  const closeAddonEditModal = () => {
    setEditingAddon(null);
    setIsNewAddon(false);
    setAddonFormData({
      id: '',
      moduleId: '',
      name: '',
      description: '',
      pricePerUser: 0,
      minimumPrice: 0,
      pricePerUserYearly: 0,
      minimumPriceYearly: 0,
      icon: '',
    });
    setAddonPricePerUserEuro('0');
    setAddonMinimumPriceEuro('0');
    setAddonPricePerUserYearlyEuro('0');
    setAddonMinimumPriceYearlyEuro('0');
    setAddonError(null);
  };

  const handleSaveAddon = async () => {
    // Konvertiere Euro zu Cent
    const pricePerUserCent = euroToCent(addonPricePerUserEuro);
    const minimumPriceCent = euroToCent(addonMinimumPriceEuro);
    const pricePerUserYearlyCent = addonPricePerUserYearlyEuro && parseFloat(addonPricePerUserYearlyEuro) > 0
      ? euroToCent(addonPricePerUserYearlyEuro)
      : undefined;
    const minimumPriceYearlyCent = addonMinimumPriceYearlyEuro && parseFloat(addonMinimumPriceYearlyEuro) > 0
      ? euroToCent(addonMinimumPriceYearlyEuro)
      : undefined;

    if (!addonFormData.id || !addonFormData.moduleId || !addonFormData.name || !pricePerUserCent || !minimumPriceCent) {
      setAddonError('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    setAddonSaving(true);
    setAddonError(null);

    try {
      const request: UpsertPricingAddonRequest = {
        id: addonFormData.id,
        moduleId: addonFormData.moduleId,
        name: addonFormData.name,
        description: addonFormData.description || '',
        pricePerUser: pricePerUserCent,
        minimumPrice: minimumPriceCent,
        pricePerUserYearly: pricePerUserYearlyCent,
        minimumPriceYearly: minimumPriceYearlyCent,
        icon: addonFormData.icon || undefined,
      };

      await upsertPricingAddon(request);
      await refreshAddons();
      closeAddonEditModal();
    } catch (err) {
      setAddonError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setAddonSaving(false);
    }
  };

  return (
    <div className={styles.stripePage}>
      <header className={styles.header}>
        <h1 className={styles.title}>Stripe Verwaltung</h1>
        <p className={styles.subtitle}>Verwaltung von Modulen, Preisen und Abonnements</p>
      </header>

      <div className={styles.content}>
        {/* Stripe Configuration */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Stripe-Konfiguration</h2>
          {configLoading ? (
            <p>Laden...</p>
          ) : (
            <div className={styles.configForm}>
              <div className={styles.formGroup}>
                <label htmlFor="publishableKey">Veröffentlichbarer Schlüssel (Publishable Key):</label>
                <input
                  id="publishableKey"
                  type="text"
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                  placeholder="pk_..."
                  className={styles.input}
                />
                <small>Der Publishable Key beginnt mit "pk_" und kann öffentlich verwendet werden.</small>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="webhookSecret">Webhook Secret (optional):</label>
                <input
                  id="webhookSecret"
                  type="text"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="whsec_..."
                  className={styles.input}
                />
                <small>Der Webhook Secret beginnt mit "whsec_" und wird für die Webhook-Validierung verwendet.</small>
              </div>

              <div className={styles.formGroup}>
                <small>
                  <strong>Hinweis:</strong> Der Geheimschlüssel (Secret Key) wird in der .env-Datei gespeichert und ist hier nicht sichtbar.
                </small>
              </div>

              {configError && (
                <div className={styles.errorMessage}>{configError}</div>
              )}

              {configSuccess && (
                <div className={styles.successMessage}>{configSuccess}</div>
              )}

              <div className={styles.buttonGroup}>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving || !publishableKey}
                  className={styles.button}
                >
                  {isSaving ? 'Speichern...' : 'Konfiguration speichern'}
                </button>
                <button
                  onClick={handleValidateConfig}
                  disabled={isSaving}
                  className={styles.buttonSecondary}
                >
                  Konfiguration testen
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Pricing Plans */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Pricing Plans</h2>
            <button
              onClick={() => openPlanEditModal()}
              className={styles.addButton}
            >
              + Neuer Plan
            </button>
          </div>
          {plansLoading ? (
            <p>Laden...</p>
          ) : plans.length === 0 ? (
            <p>Keine Plans gefunden. Erstelle den ersten Plan.</p>
          ) : (
            <div className={styles.plansGrid}>
              {plans.map((plan) => (
                <div key={plan.id} className={styles.planCard}>
                  <div className={styles.planCardHeader}>
                    <h3>{plan.name}</h3>
                    <div className={styles.planCardActions}>
                      <button
                        onClick={() => openPlanEditModal(plan)}
                        className={styles.editButton}
                        title="Plan bearbeiten"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className={styles.deleteButton}
                        title="Plan löschen"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <p>{plan.description}</p>
                  <div className={styles.price}>
                    {formatPrice(plan.pricePerUser)} € / Nutzer / Monat
                  </div>
                  {plan.pricePerUserYearly && (
                    <div className={styles.price}>
                      {formatPrice(plan.pricePerUserYearly)} € / Nutzer / Jahr
                    </div>
                  )}
                  <div className={styles.minimum}>
                    Mindestpreis: {formatPrice(plan.minimumPrice)} € / Monat
                  </div>
                  {plan.minimumPriceYearly && (
                    <div className={styles.minimum}>
                      Mindestpreis (Jahr): {formatPrice(plan.minimumPriceYearly)} € / Jahr
                    </div>
                  )}
                  {plan.includedModules && plan.includedModules.length > 0 && (
                    <div className={styles.modulesList}>
                      <strong>Module:</strong> {plan.includedModules.length}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pricing Addons */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Pricing Addons</h2>
            <button
              onClick={() => openAddonEditModal()}
              className={styles.addButton}
            >
              + Neues Addon
            </button>
          </div>
          {addonsLoading ? (
            <p>Laden...</p>
          ) : addons.length === 0 ? (
            <p>Keine Addons gefunden.</p>
          ) : (
            <div className={styles.addonsGrid}>
              {addons.map((addon) => (
                <div key={addon.id} className={styles.addonCard}>
                  <div className={styles.planCardHeader}>
                    <h3>{addon.icon} {addon.name}</h3>
                    <button
                      onClick={() => openAddonEditModal(addon)}
                      className={styles.editButton}
                      title="Addon bearbeiten"
                    >
                      ✏️
                    </button>
                  </div>
                  <p>{addon.description}</p>
                  <div className={styles.price}>
                    {formatPrice(addon.pricePerUser)} € / Nutzer / Monat
                  </div>
                  {addon.pricePerUserYearly && (
                    <div className={styles.price}>
                      {formatPrice(addon.pricePerUserYearly)} € / Nutzer / Jahr
                    </div>
                  )}
                  <div className={styles.minimum}>
                    Mindestpreis: {formatPrice(addon.minimumPrice)} € / Monat
                  </div>
                  {addon.minimumPriceYearly && (
                    <div className={styles.minimum}>
                      Mindestpreis (Jahr): {formatPrice(addon.minimumPriceYearly)} € / Jahr
                    </div>
                  )}
                  {addon.moduleId && (
                    <div className={styles.modulesList}>
                      <strong>Modul:</strong> {MODULE_REGISTRY[addon.moduleId]?.displayName || addon.moduleId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Subscriptions */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Subscriptions</h2>
          <div className={styles.tenantSelector}>
            <label>Tenant auswählen:</label>
            <select
              value={selectedTenantId || ''}
              onChange={(e) => setSelectedTenantId(e.target.value || null)}
            >
              <option value="">-- Bitte wählen --</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.id})
                </option>
              ))}
            </select>
          </div>

          {selectedTenantId && (
            <>
              {subscriptionsLoading ? (
                <p>Laden...</p>
              ) : subscriptions.length === 0 ? (
                <p>Keine Subscriptions für diesen Tenant gefunden.</p>
              ) : (
                <div className={styles.subscriptionsList}>
                  {subscriptions.map((subscription) => (
                    <div key={subscription.id} className={styles.subscriptionCard}>
                      <h3>Plan: {subscription.planId}</h3>
                      <p>Status: {subscription.status}</p>
                      <p>Nutzer: {subscription.userCount}</p>
                      <p>Billing: {subscription.billingCycle}</p>
                      <p>Addons: {subscription.addonIds.join(', ') || 'Keine'}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Plan Edit Modal */}
      {(editingPlan !== null || isNewPlan) && (
        <div className={styles.modalOverlay} onClick={closePlanEditModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {isNewPlan ? 'Neuer Plan' : 'Plan bearbeiten'}
              </h2>
              <button className={styles.modalCloseButton} onClick={closePlanEditModal}>
                ✕
              </button>
            </div>

            <div className={styles.modalContent}>
              {planError && <div className={styles.errorMessage}>{planError}</div>}

              <div className={styles.formGroup}>
                <label htmlFor="planId">Plan-ID *</label>
                <input
                  id="planId"
                  type="text"
                  value={planFormData.id || ''}
                  onChange={(e) => setPlanFormData({ ...planFormData, id: e.target.value })}
                  placeholder="z.B. basic, pro, business"
                  disabled={!isNewPlan}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="planName">Name *</label>
                <input
                  id="planName"
                  type="text"
                  value={planFormData.name || ''}
                  onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                  placeholder="z.B. Basic, Pro, Business"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="planDescription">Beschreibung *</label>
                <textarea
                  id="planDescription"
                  value={planFormData.description || ''}
                  onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                  placeholder="Kurze Beschreibung des Plans"
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="pricePerUser">Preis pro Nutzer (€) *</label>
                  <input
                    id="pricePerUser"
                    type="number"
                    step="0.01"
                    value={planPricePerUserEuro}
                    onChange={(e) => setPlanPricePerUserEuro(e.target.value)}
                    className={styles.input}
                    min="0"
                    placeholder="z.B. 4.50"
                  />
                  <small>z.B. 4.50 für 4,50 €</small>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="minimumPrice">Mindestpreis (€) *</label>
                  <input
                    id="minimumPrice"
                    type="number"
                    step="0.01"
                    value={planMinimumPriceEuro}
                    onChange={(e) => setPlanMinimumPriceEuro(e.target.value)}
                    className={styles.input}
                    min="0"
                    placeholder="z.B. 45.00"
                  />
                  <small>z.B. 45.00 für 45,00 €</small>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="pricePerUserYearly">Preis pro Nutzer/Jahr (€, optional)</label>
                  <input
                    id="pricePerUserYearly"
                    type="number"
                    step="0.01"
                    value={planPricePerUserYearlyEuro}
                    onChange={(e) => setPlanPricePerUserYearlyEuro(e.target.value)}
                    className={styles.input}
                    min="0"
                    placeholder="z.B. 3.83"
                  />
                  <small>z.B. 3.83 für 3,83 € (mit 15% Rabatt)</small>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="minimumPriceYearly">Mindestpreis/Jahr (€, optional)</label>
                  <input
                    id="minimumPriceYearly"
                    type="number"
                    step="0.01"
                    value={planMinimumPriceYearlyEuro}
                    onChange={(e) => setPlanMinimumPriceYearlyEuro(e.target.value)}
                    className={styles.input}
                    min="0"
                    placeholder="z.B. 38.25"
                  />
                  <small>z.B. 38.25 für 38,25 € (mit 15% Rabatt)</small>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="targetGroup">Zielgruppe (optional)</label>
                <input
                  id="targetGroup"
                  type="text"
                  value={planFormData.targetGroup || ''}
                  onChange={(e) => setPlanFormData({ ...planFormData, targetGroup: e.target.value })}
                  placeholder="z.B. 1-30 MA, 31-100 MA"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>
                  Enthaltene Module
                  {modulesLoading ? (
                    <span className={styles.moduleCount}> (Laden...)</span>
                  ) : (
                    <span className={styles.moduleCount}>
                      {' '}({coreModules.length} Basis-Module, {availableModules.length} optionale)
                    </span>
                  )}
                </label>
                {modulesLoading ? (
                  <div className={styles.loading}>Module werden geladen...</div>
                ) : (
                  <>
                    {/* Core-Module (immer aktiv, nicht deaktivierbar) */}
                    {coreModules.length > 0 && (
                      <div className={styles.modulesSection}>
                        <h4 className={styles.modulesSectionTitle}>Basis-Module (immer enthalten)</h4>
                        <div className={styles.modulesCheckboxGrid}>
                          {coreModules.map((mod) => (
                            <label key={mod.id} className={styles.moduleCheckbox}>
                              <input
                                type="checkbox"
                                checked={true}
                                disabled={true}
                                readOnly
                              />
                              <span className={styles.moduleCheckboxLabel}>
                                {mod.icon} {mod.displayName}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Optionale Module */}
                    {availableModules.length === 0 ? (
                      <div className={styles.warning}>
                        Keine optionalen Module verfügbar. Bitte aktivieren Sie zuerst Module in den Einstellungen.
                      </div>
                    ) : (
                      <div className={styles.modulesSection}>
                        <h4 className={styles.modulesSectionTitle}>Optionale Module</h4>
                        <div className={styles.modulesCheckboxGrid}>
                          {availableModules.map((mod) => (
                            <label key={mod.id} className={styles.moduleCheckbox}>
                              <input
                                type="checkbox"
                                checked={(planFormData.includedModules || []).includes(mod.id)}
                                onChange={() => handlePlanModuleToggle(mod.id)}
                              />
                              <span className={styles.moduleCheckboxLabel}>
                                {mod.icon} {mod.displayName}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="planFeatures">Features (eine pro Zeile)</label>
                <textarea
                  id="planFeatures"
                  value={planFeaturesText}
                  onChange={(e) => setPlanFeaturesText(e.target.value)}
                  placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                  className={styles.textarea}
                  rows={6}
                />
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={closePlanEditModal}
                className={styles.cancelButton}
                disabled={planSaving}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSavePlan}
                className={styles.saveButton}
                disabled={planSaving || !planFormData.id || !planFormData.name || !planPricePerUserEuro || !planMinimumPriceEuro || parseFloat(planPricePerUserEuro) <= 0 || parseFloat(planMinimumPriceEuro) <= 0}
              >
                {planSaving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Addon Edit Modal */}
      {(editingAddon !== null || isNewAddon) && (
        <div className={styles.modalOverlay} onClick={closeAddonEditModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {isNewAddon ? 'Neues Addon' : 'Addon bearbeiten'}
              </h2>
              <button className={styles.modalCloseButton} onClick={closeAddonEditModal}>
                ✕
              </button>
            </div>

            <div className={styles.modalContent}>
              {addonError && <div className={styles.errorMessage}>{addonError}</div>}

              <div className={styles.formGroup}>
                <label htmlFor="addonId">Addon-ID *</label>
                <input
                  id="addonId"
                  type="text"
                  value={addonFormData.id || ''}
                  onChange={(e) => setAddonFormData({ ...addonFormData, id: e.target.value })}
                  placeholder="z.B. work-time-compliance"
                  disabled={!isNewAddon}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="addonModuleId">Modul *</label>
                <select
                  id="addonModuleId"
                  value={addonFormData.moduleId || ''}
                  onChange={(e) => setAddonFormData({ ...addonFormData, moduleId: e.target.value })}
                  className={styles.input}
                >
                  <option value="">-- Modul auswählen --</option>
                  {availableModules.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {mod.icon} {mod.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="addonName">Name *</label>
                <input
                  id="addonName"
                  type="text"
                  value={addonFormData.name || ''}
                  onChange={(e) => setAddonFormData({ ...addonFormData, name: e.target.value })}
                  placeholder="z.B. Arbeitszeit-Compliance"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="addonDescription">Beschreibung *</label>
                <textarea
                  id="addonDescription"
                  value={addonFormData.description || ''}
                  onChange={(e) => setAddonFormData({ ...addonFormData, description: e.target.value })}
                  placeholder="Kurze Beschreibung des Addons"
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="addonIcon">Icon (optional)</label>
                <input
                  id="addonIcon"
                  type="text"
                  value={addonFormData.icon || ''}
                  onChange={(e) => setAddonFormData({ ...addonFormData, icon: e.target.value })}
                  placeholder="z.B. ⚖️"
                  className={styles.input}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="addonPricePerUser">Preis pro Nutzer (€) *</label>
                  <input
                    id="addonPricePerUser"
                    type="number"
                    step="0.01"
                    value={addonPricePerUserEuro}
                    onChange={(e) => setAddonPricePerUserEuro(e.target.value)}
                    className={styles.input}
                    min="0"
                    placeholder="z.B. 2.99"
                  />
                  <small>z.B. 2.99 für 2,99 €</small>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="addonMinimumPrice">Mindestpreis (€) *</label>
                  <input
                    id="addonMinimumPrice"
                    type="number"
                    step="0.01"
                    value={addonMinimumPriceEuro}
                    onChange={(e) => setAddonMinimumPriceEuro(e.target.value)}
                    className={styles.input}
                    min="0"
                    placeholder="z.B. 10.00"
                  />
                  <small>z.B. 10.00 für 10,00 €</small>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="addonPricePerUserYearly">Preis pro Nutzer/Jahr (€, optional)</label>
                  <input
                    id="addonPricePerUserYearly"
                    type="number"
                    step="0.01"
                    value={addonPricePerUserYearlyEuro}
                    onChange={(e) => setAddonPricePerUserYearlyEuro(e.target.value)}
                    className={styles.input}
                    min="0"
                    placeholder="z.B. 2.54"
                  />
                  <small>z.B. 2.54 für 2,54 € (mit 15% Rabatt)</small>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="addonMinimumPriceYearly">Mindestpreis/Jahr (€, optional)</label>
                  <input
                    id="addonMinimumPriceYearly"
                    type="number"
                    step="0.01"
                    value={addonMinimumPriceYearlyEuro}
                    onChange={(e) => setAddonMinimumPriceYearlyEuro(e.target.value)}
                    className={styles.input}
                    min="0"
                    placeholder="z.B. 8.50"
                  />
                  <small>z.B. 8.50 für 8,50 € (mit 15% Rabatt)</small>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={closeAddonEditModal}
                className={styles.cancelButton}
                disabled={addonSaving}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveAddon}
                className={styles.saveButton}
                disabled={addonSaving || !addonFormData.id || !addonFormData.moduleId || !addonFormData.name || !addonPricePerUserEuro || !addonMinimumPriceEuro || parseFloat(addonPricePerUserEuro) <= 0 || parseFloat(addonMinimumPriceEuro) <= 0}
              >
                {addonSaving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

