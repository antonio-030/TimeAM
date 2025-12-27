/**
 * Stripe Service
 *
 * Business Logic für die Stripe-Integration (Preise, Abonnements).
 */

import Stripe from 'stripe';
import { getAdminFirestore } from '../../core/firebase/index.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { MODULE_REGISTRY } from '@timeam/shared';
import { setEntitlement } from '../../core/tenancy/index.js';
import type {
  PricingPlan,
  PricingAddon,
  Subscription,
  StripeCustomer,
  StripeConfig,
  UpsertPricingPlanRequest,
  UpsertPricingAddonRequest,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  UpdateStripeConfigRequest,
  TransactionLog,
} from './types.js';

// Stripe Client initialisieren
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn('⚠️ STRIPE_SECRET_KEY nicht gesetzt. Stripe-Funktionen werden nicht verfügbar sein.');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2025-12-15.clover',
}) : null;

const DEV_TENANT_ID = 'dev-tenant';

/**
 * Erstellt Standard-Plans in der Datenbank (falls noch keine vorhanden sind).
 */
export async function seedDefaultPlans(): Promise<void> {
  const db = getAdminFirestore();
  const plansRef = db
    .collection('tenants')
    .doc(DEV_TENANT_ID)
    .collection('pricing')
    .doc('plans');
  
  const plansDoc = await plansRef.get();
  
  // Prüfe ob bereits Plans vorhanden sind
  if (plansDoc.exists) {
    const data = plansDoc.data();
    if (data && Object.keys(data).length > 0) {
      return;
    }
  }
  
  // Erstelle Standard-Plans
  const defaultPlans = {
    'basic': {
      name: 'Basic',
      description: 'Für kleine Teams, "kommt schnell live"',
      pricePerUser: 450, // 4.50 € in Cent
      minimumPrice: 4500, // 45.00 € in Cent
      pricePerUserYearly: 383, // 3.83 € in Cent (15% Rabatt)
      minimumPriceYearly: 3825, // 38.25 € in Cent (15% Rabatt)
      includedModules: ['dashboard', 'calendar-core', 'members', 'notifications', 'time-tracking', 'shift-pool', 'reports'],
      features: [
        'Core-Module (Dashboard, Kalender, Mitarbeiter)',
        'Schichtplanung mit Freelancer-Pool',
        'Zeiterfassung (Clock In/Out, Timesheets)',
        'Standardberichte/Exports',
        'Benachrichtigungen',
        'Freelancer-Pool: Schichten öffentlich veröffentlichen',
      ],
      targetGroup: '1–30 MA',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    'pro': {
      name: 'Pro',
      description: 'Für Teams, die mehr Steuerung/Reporting wollen',
      pricePerUser: 650, // 6.50 € in Cent
      minimumPrice: 7900, // 79.00 € in Cent
      pricePerUserYearly: 553, // 5.53 € in Cent (15% Rabatt)
      minimumPriceYearly: 6715, // 67.15 € in Cent (15% Rabatt)
      includedModules: ['dashboard', 'calendar-core', 'members', 'notifications', 'time-tracking', 'shift-pool', 'reports'],
      features: [
        'Alles aus Basic',
        'Erweiterte Analytics-Ansichten',
        'Mehr Exportoptionen',
        'Rollen/Rechte "Pro"',
        'Prioritäts-Support',
      ],
      targetGroup: '10–50 MA',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    'business': {
      name: 'Business',
      description: 'Für größere Firmen / mehrere Standorte',
      pricePerUser: 850, // 8.50 € in Cent
      minimumPrice: 12900, // 129.00 € in Cent
      pricePerUserYearly: 723, // 7.23 € in Cent (15% Rabatt)
      minimumPriceYearly: 10965, // 109.65 € in Cent (15% Rabatt)
      includedModules: ['dashboard', 'calendar-core', 'members', 'notifications', 'time-tracking', 'shift-pool', 'reports'],
      features: [
        'Alles aus Pro',
        'Multi-Standort-Features',
        'Erweiterte Auswertungen/Filter',
        'Prioritäts-Support',
        'Dedicated Account Manager',
      ],
      targetGroup: '50+ MA',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  };
  
  await plansRef.set(defaultPlans, { merge: true });
  console.log('✅ Standard-Plans erstellt: basic, pro, business');
}

/**
 * Mappt eine Module-ID zu einem Entitlement-Key.
 */
function getEntitlementKeyForModule(moduleId: string): string | null {
  const module = MODULE_REGISTRY[moduleId];
  if (!module || !module.entitlementKey) {
    return null;
  }
  return module.entitlementKey;
}

/**
 * Aktiviert Module für eine Subscription.
 */
async function activateModulesForSubscription(
  tenantId: string,
  planId: string,
  addonIds: string[]
): Promise<void> {
  console.log(`\n🔄 ========== MODULE-AKTIVIERUNG START ==========`);
  console.log(`🔄 Tenant ID: ${tenantId}`);
  console.log(`🔄 Plan ID: ${planId}`);
  console.log(`🔄 Addon IDs: ${addonIds.join(', ') || 'keine'}`);
  
  // Lade Plan
  const plans = await getPricingPlans();
  console.log(`📋 Verfügbare Plans in DB: ${plans.length}`);
  plans.forEach(p => {
    console.log(`  - Plan ID: ${p.id}, Name: ${p.name}, Module: ${p.includedModules?.join(', ') || 'keine'} (${p.includedModules?.length || 0})`);
  });
  
  const plan = plans.find(p => p.id === planId);
  
  if (!plan) {
    console.error(`❌ Plan ${planId} nicht gefunden für Tenant ${tenantId}`);
    console.log(`❌ Verfügbare Plans: ${plans.map(p => `${p.id} (${p.name})`).join(', ')}`);
    console.log(`🔄 ========== MODULE-AKTIVIERUNG FEHLGESCHLAGEN ==========\n`);
    return;
  }

  console.log(`✅ Plan gefunden: ${plan.name} (ID: ${plan.id})`);
  console.log(`📋 Plan Beschreibung: ${plan.description || 'keine'}`);
  console.log(`📋 Plan Module (${plan.includedModules?.length || 0}): ${plan.includedModules?.join(', ') || 'keine'}`);
  
  // Zeige Details für jedes Modul im Plan
  if (plan.includedModules && plan.includedModules.length > 0) {
    console.log(`\n📦 Module-Details im Plan:`);
    plan.includedModules.forEach((moduleId, index) => {
      const module = MODULE_REGISTRY[moduleId];
      const moduleName = module?.displayName || moduleId;
      const moduleCategory = module?.category || 'unbekannt';
      const entitlementKey = getEntitlementKeyForModule(moduleId);
      console.log(`  ${index + 1}. ${moduleName} (${moduleId})`);
      console.log(`     - Kategorie: ${moduleCategory}`);
      console.log(`     - Entitlement Key: ${entitlementKey || 'kein (Core-Modul)'}`);
    });
  }

  // Aktiviere Module aus Plan
  // WICHTIG: Core-Module haben kein entitlementKey und sind immer aktiv
  // Nur optionale Module mit entitlementKey werden aktiviert
  let activatedCount = 0;
  let coreModulesCount = 0;
  let skippedCount = 0;
  
  console.log(`\n📦 Aktiviere Module aus Plan:`);
  for (const moduleId of plan.includedModules || []) {
    const module = MODULE_REGISTRY[moduleId];
    const moduleName = module?.displayName || moduleId;
    const entitlementKey = getEntitlementKeyForModule(moduleId);
    
    if (entitlementKey) {
      try {
        console.log(`  🔄 Aktiviere Modul: ${moduleName} (${moduleId}) mit Entitlement: ${entitlementKey}`);
        await setEntitlement(tenantId, entitlementKey, true);
        console.log(`  ✅ Modul ${moduleName} (${moduleId}) erfolgreich aktiviert`);
        activatedCount++;
      } catch (err) {
        console.error(`  ❌ Fehler beim Aktivieren von Modul ${moduleName} (${moduleId}):`, err);
      }
    } else {
      // Core-Module haben kein entitlementKey - das ist normal
      if (module && module.category === 'core') {
        console.log(`  ℹ️ Modul ${moduleName} (${moduleId}) ist ein Core-Modul - immer aktiv (kein Entitlement nötig)`);
        coreModulesCount++;
      } else {
        console.warn(`  ⚠️ Kein Entitlement-Key für Modul ${moduleName} (${moduleId}) gefunden. Modul in Registry: ${module ? 'ja' : 'nein'}`);
        skippedCount++;
      }
    }
  }

  // Aktiviere Module aus Addons
  if (addonIds.length > 0) {
    console.log(`\n📦 Aktiviere Module aus Addons:`);
    const addons = await getPricingAddons();
    for (const addonId of addonIds) {
      if (!addonId) continue; // Leere Strings überspringen
      
      const addon = addons.find(a => a.id === addonId);
      if (addon && addon.moduleId) {
        const module = MODULE_REGISTRY[addon.moduleId];
        const moduleName = module?.displayName || addon.moduleId;
        const entitlementKey = getEntitlementKeyForModule(addon.moduleId);
        
        if (entitlementKey) {
          try {
            console.log(`  🔄 Aktiviere Modul: ${moduleName} (${addon.moduleId}) aus Addon: ${addon.name} (${addonId})`);
            await setEntitlement(tenantId, entitlementKey, true);
            console.log(`  ✅ Modul ${moduleName} (${addon.moduleId}) aus Addon ${addon.name} erfolgreich aktiviert`);
            activatedCount++;
          } catch (err) {
            console.error(`  ❌ Fehler beim Aktivieren von Modul ${moduleName} (${addon.moduleId}) aus Addon ${addon.name}:`, err);
          }
        } else {
          console.warn(`  ⚠️ Kein Entitlement-Key für Modul ${moduleName} (${addon.moduleId}) aus Addon ${addon.name} gefunden`);
        }
      } else {
        console.warn(`  ⚠️ Addon ${addonId} nicht gefunden oder hat kein moduleId`);
      }
    }
  }

  console.log(`\n📊 ========== MODULE-AKTIVIERUNG ZUSAMMENFASSUNG ==========`);
  console.log(`📊 Optionale Module aktiviert: ${activatedCount}`);
  console.log(`📊 Core-Module (immer aktiv): ${coreModulesCount}`);
  console.log(`📊 Übersprungene Module: ${skippedCount}`);
  console.log(`📊 Gesamt Module im Plan: ${(plan.includedModules?.length || 0) + addonIds.length}`);
  console.log(`✅ Module-Aktivierung abgeschlossen für Tenant ${tenantId}`);
  console.log(`🔄 ========== MODULE-AKTIVIERUNG ENDE ==========\n`);
}

/**
 * Deaktiviert Module für eine gekündigte Subscription.
 */
async function deactivateModulesForSubscription(
  tenantId: string,
  planId: string,
  addonIds: string[]
): Promise<void> {
  console.log(`\n🔄 ========== MODULE-DEAKTIVIERUNG START ==========`);
  console.log(`🔄 Tenant ID: ${tenantId}`);
  console.log(`🔄 Plan ID: ${planId}`);
  console.log(`🔄 Addon IDs: ${addonIds.join(', ') || 'keine'}`);
  
  // Lade Plan
  const plans = await getPricingPlans();
  const plan = plans.find(p => p.id === planId);
  
  if (!plan) {
    console.error(`❌ Plan ${planId} nicht gefunden für Tenant ${tenantId}`);
    console.log(`🔄 ========== MODULE-DEAKTIVIERUNG FEHLGESCHLAGEN ==========\n`);
    return;
  }

  console.log(`✅ Plan gefunden: ${plan.name} (ID: ${plan.id})`);
  console.log(`📋 Plan Module (${plan.includedModules?.length || 0}): ${plan.includedModules?.join(', ') || 'keine'}`);
  
  let deactivatedCount = 0;
  let skippedCount = 0;
  
  console.log(`\n📦 Deaktiviere Module aus Plan:`);
  for (const moduleId of plan.includedModules || []) {
    const module = MODULE_REGISTRY[moduleId];
    const moduleName = module?.displayName || moduleId;
    const entitlementKey = getEntitlementKeyForModule(moduleId);
    
    // Core-Module werden nicht deaktiviert
    if (module && module.category === 'core') {
      console.log(`  ℹ️ Modul ${moduleName} (${moduleId}) ist ein Core-Modul - bleibt aktiv`);
      skippedCount++;
      continue;
    }
    
    if (entitlementKey) {
      try {
        console.log(`  🔄 Deaktiviere Modul: ${moduleName} (${moduleId}) mit Entitlement: ${entitlementKey}`);
        await setEntitlement(tenantId, entitlementKey, false);
        console.log(`  ✅ Modul ${moduleName} (${moduleId}) erfolgreich deaktiviert`);
        deactivatedCount++;
      } catch (err) {
        console.error(`  ❌ Fehler beim Deaktivieren von Modul ${moduleName} (${moduleId}):`, err);
      }
    } else {
      console.warn(`  ⚠️ Kein Entitlement-Key für Modul ${moduleName} (${moduleId}) gefunden`);
      skippedCount++;
    }
  }

  // Deaktiviere Module aus Addons
  if (addonIds.length > 0) {
    console.log(`\n📦 Deaktiviere Module aus Addons:`);
    const addons = await getPricingAddons();
    for (const addonId of addonIds) {
      if (!addonId) continue;
      
      const addon = addons.find(a => a.id === addonId);
      if (addon && addon.moduleId) {
        const module = MODULE_REGISTRY[addon.moduleId];
        const moduleName = module?.displayName || addon.moduleId;
        const entitlementKey = getEntitlementKeyForModule(addon.moduleId);
        
        if (entitlementKey) {
          try {
            console.log(`  🔄 Deaktiviere Modul: ${moduleName} (${addon.moduleId}) aus Addon: ${addon.name} (${addonId})`);
            await setEntitlement(tenantId, entitlementKey, false);
            console.log(`  ✅ Modul ${moduleName} (${addon.moduleId}) aus Addon ${addon.name} erfolgreich deaktiviert`);
            deactivatedCount++;
          } catch (err) {
            console.error(`  ❌ Fehler beim Deaktivieren von Modul ${moduleName} (${addon.moduleId}) aus Addon ${addon.name}:`, err);
          }
        } else {
          console.warn(`  ⚠️ Kein Entitlement-Key für Modul ${moduleName} (${addon.moduleId}) aus Addon ${addon.name} gefunden`);
        }
      } else {
        console.warn(`  ⚠️ Addon ${addonId} nicht gefunden oder hat kein moduleId`);
      }
    }
  }

  console.log(`\n📊 ========== MODULE-DEAKTIVIERUNG ZUSAMMENFASSUNG ==========`);
  console.log(`📊 Module deaktiviert: ${deactivatedCount}`);
  console.log(`📊 Übersprungene Module (Core): ${skippedCount}`);
  console.log(`✅ Module-Deaktivierung abgeschlossen für Tenant ${tenantId}`);
  console.log(`🔄 ========== MODULE-DEAKTIVIERUNG ENDE ==========\n`);
}

/**
 * Lädt die Stripe-Konfiguration.
 */
export async function getStripeConfig(): Promise<StripeConfig | null> {
  const db = getAdminFirestore();
  const configRef = db
    .collection('tenants')
    .doc(DEV_TENANT_ID)
    .collection('stripe')
    .doc('config');
  
  const configDoc = await configRef.get();
  
  if (!configDoc.exists) {
    return null;
  }
  
  const data = configDoc.data();
  if (!data) {
    return null;
  }
  
  return data as StripeConfig;
}

/**
 * Aktualisiert die Stripe-Konfiguration.
 * Nur Publishable Key wird gespeichert (Secret Key bleibt in .env).
 */
export async function updateStripeConfig(
  request: UpdateStripeConfigRequest
): Promise<StripeConfig> {
  const db = getAdminFirestore();
  const configRef = db
    .collection('tenants')
    .doc(DEV_TENANT_ID)
    .collection('stripe')
    .doc('config');
  
  const existingConfig = await getStripeConfig();
  
  // Erstelle Config-Objekt ohne undefined-Werte
  const configData: Record<string, unknown> = {
    publishableKey: request.publishableKey,
    createdAt: existingConfig?.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  
  // Nur webhookSecret hinzufügen, wenn es gesetzt ist
  if (request.webhookSecret) {
    configData.webhookSecret = request.webhookSecret;
  }
  
  await configRef.set(configData, { merge: true });
  
  // Lade die gespeicherte Config zurück, um sie zu retournieren
  const savedConfig = await getStripeConfig();
  if (!savedConfig) {
    throw new Error('Fehler beim Speichern der Konfiguration');
  }
  
  return savedConfig;
}

/**
 * Validiert die Stripe-Konfiguration.
 * Prüft ob Publishable Key das richtige Format hat.
 */
export async function validateStripeConfig(): Promise<{ valid: boolean; message?: string }> {
  const config = await getStripeConfig();
  
  if (!config) {
    return { valid: false, message: 'Keine Stripe-Konfiguration gefunden' };
  }
  
  if (!config.publishableKey) {
    return { valid: false, message: 'Publishable Key fehlt' };
  }
  
  // Prüfe Format: Publishable Keys beginnen mit pk_
  if (!config.publishableKey.startsWith('pk_')) {
    return { valid: false, message: 'Ungültiges Format für Publishable Key (muss mit pk_ beginnen)' };
  }
  
  // Prüfe ob Secret Key in .env gesetzt ist (zur Laufzeit prüfen, nicht beim Start)
  const currentSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!currentSecretKey) {
    return { valid: false, message: 'Secret Key fehlt in Umgebungsvariablen. Bitte STRIPE_SECRET_KEY in der .env-Datei setzen und Server neu starten.' };
  }
  
  // Prüfe Format: Secret Keys beginnen mit sk_
  if (!currentSecretKey.startsWith('sk_')) {
    return { valid: false, message: 'Ungültiges Format für Secret Key (muss mit sk_ beginnen)' };
  }
  
  return { valid: true };
}

/**
 * Lädt alle Pricing Plans.
 */
export async function getPricingPlans(): Promise<PricingPlan[]> {
  const db = getAdminFirestore();
  const plansRef = db
    .collection('tenants')
    .doc(DEV_TENANT_ID)
    .collection('pricing')
    .doc('plans');
  
  const plansDoc = await plansRef.get();
  
  if (!plansDoc.exists) {
    return [];
  }
  
  const data = plansDoc.data();
  const plans: PricingPlan[] = [];
  
  if (data) {
    for (const [id, planData] of Object.entries(data)) {
      if (typeof planData === 'object' && planData !== null) {
        plans.push({
          id,
          ...(planData as Omit<PricingPlan, 'id'>),
        });
      }
    }
  }
  
  return plans;
}

/**
 * Erstellt oder aktualisiert einen Pricing Plan.
 */
export async function upsertPricingPlan(
  request: UpsertPricingPlanRequest
): Promise<PricingPlan> {
  const db = getAdminFirestore();
  const plansRef = db
    .collection('tenants')
    .doc(DEV_TENANT_ID)
    .collection('pricing')
    .doc('plans');
  
  // Erstelle Plan-Objekt ohne undefined-Werte
  const planData: Record<string, unknown> = {
    name: request.name,
    description: request.description,
    pricePerUser: request.pricePerUser,
    minimumPrice: request.minimumPrice,
    includedModules: request.includedModules,
    features: request.features,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  
  // Nur optionale Felder hinzufügen, wenn sie gesetzt sind
  if (request.pricePerUserYearly !== undefined && request.pricePerUserYearly !== null) {
    planData.pricePerUserYearly = request.pricePerUserYearly;
  }
  
  if (request.minimumPriceYearly !== undefined && request.minimumPriceYearly !== null) {
    planData.minimumPriceYearly = request.minimumPriceYearly;
  }
  
  if (request.targetGroup !== undefined && request.targetGroup !== null && request.targetGroup !== '') {
    planData.targetGroup = request.targetGroup;
  }
  
  await plansRef.set(
    {
      [request.id]: planData,
    },
    { merge: true }
  );
  
  // Lade den gespeicherten Plan zurück
  const plans = await getPricingPlans();
  const savedPlan = plans.find(p => p.id === request.id);
  
  if (!savedPlan) {
    throw new Error('Fehler beim Speichern des Plans');
  }
  
  return savedPlan;
}

/**
 * Löscht einen Pricing Plan.
 */
export async function deletePricingPlan(planId: string): Promise<void> {
  const db = getAdminFirestore();
  const plansRef = db
    .collection('tenants')
    .doc(DEV_TENANT_ID)
    .collection('pricing')
    .doc('plans');
  
  const plansDoc = await plansRef.get();
  
  if (!plansDoc.exists) {
    throw new Error('Plans-Dokument nicht gefunden');
  }
  
  const data = plansDoc.data();
  if (!data || !data[planId]) {
    throw new Error(`Plan ${planId} nicht gefunden`);
  }
  
  // Lösche den Plan aus dem Dokument
  await plansRef.update({
    [planId]: FieldValue.delete(),
  });
}

/**
 * Lädt alle Pricing Addons.
 */
export async function getPricingAddons(): Promise<PricingAddon[]> {
  const db = getAdminFirestore();
  const addonsRef = db
    .collection('tenants')
    .doc(DEV_TENANT_ID)
    .collection('pricing')
    .doc('addons');
  
  const addonsDoc = await addonsRef.get();
  
  if (!addonsDoc.exists) {
    return [];
  }
  
  const data = addonsDoc.data();
  const addons: PricingAddon[] = [];
  
  if (data) {
    for (const [id, addonData] of Object.entries(data)) {
      if (typeof addonData === 'object' && addonData !== null) {
        addons.push({
          id,
          ...(addonData as Omit<PricingAddon, 'id'>),
        });
      }
    }
  }
  
  return addons;
}

/**
 * Erstellt oder aktualisiert ein Pricing Addon.
 */
export async function upsertPricingAddon(
  request: UpsertPricingAddonRequest
): Promise<PricingAddon> {
  const db = getAdminFirestore();
  const addonsRef = db
    .collection('tenants')
    .doc(DEV_TENANT_ID)
    .collection('pricing')
    .doc('addons');
  
  // Erstelle Addon-Objekt ohne undefined-Werte
  const addonData: Record<string, unknown> = {
    moduleId: request.moduleId,
    name: request.name,
    description: request.description,
    pricePerUser: request.pricePerUser,
    minimumPrice: request.minimumPrice,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  
  // Nur optionale Felder hinzufügen, wenn sie gesetzt sind
  if (request.pricePerUserYearly !== undefined && request.pricePerUserYearly !== null) {
    addonData.pricePerUserYearly = request.pricePerUserYearly;
  }
  
  if (request.minimumPriceYearly !== undefined && request.minimumPriceYearly !== null) {
    addonData.minimumPriceYearly = request.minimumPriceYearly;
  }
  
  if (request.icon !== undefined && request.icon !== null && request.icon !== '') {
    addonData.icon = request.icon;
  }
  
  await addonsRef.set(
    {
      [request.id]: addonData,
    },
    { merge: true }
  );
  
  // Lade das gespeicherte Addon zurück
  const addons = await getPricingAddons();
  const savedAddon = addons.find(a => a.id === request.id);
  
  if (!savedAddon) {
    throw new Error('Fehler beim Speichern des Addons');
  }
  
  return savedAddon;
}

/**
 * Lädt alle Subscriptions für einen Tenant.
 */
export async function getTenantSubscriptions(tenantId: string): Promise<Subscription[]> {
  const db = getAdminFirestore();
  const subscriptionsRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('subscriptions');
  
  const subscriptionsSnap = await subscriptionsRef.get();
  
  const subscriptions: Subscription[] = [];
  
  for (const doc of subscriptionsSnap.docs) {
    const data = doc.data() as Omit<Subscription, 'id'>;
    
    // Konvertiere Timestamps zu ISO-Strings für Frontend
    const convertTimestamp = (ts: FirebaseFirestore.Timestamp | string | undefined): string => {
      if (!ts) return new Date().toISOString();
      if (typeof ts === 'string') return ts;
      if (ts && typeof ts === 'object' && 'toDate' in ts) {
        return ts.toDate().toISOString();
      }
      return new Date().toISOString();
    };
    
    subscriptions.push({
      id: doc.id,
      ...data,
      currentPeriodStart: convertTimestamp(data.currentPeriodStart as FirebaseFirestore.Timestamp | string | undefined),
      currentPeriodEnd: convertTimestamp(data.currentPeriodEnd as FirebaseFirestore.Timestamp | string | undefined),
      createdAt: convertTimestamp(data.createdAt as FirebaseFirestore.Timestamp | string | undefined),
      updatedAt: convertTimestamp(data.updatedAt as FirebaseFirestore.Timestamp | string | undefined),
    } as any); // Type assertion, da wir Timestamps zu Strings konvertieren
  }
  
  return subscriptions;
}

/**
 * Erstellt eine neue Subscription.
 */
export async function createSubscription(
  request: CreateSubscriptionRequest
): Promise<Subscription> {
  console.log(`\n📦 ========== SUBSCRIPTION ERSTELLEN ==========`);
  console.log(`📋 Tenant ID: ${request.tenantId}`);
  console.log(`📋 Plan ID: ${request.planId}`);
  console.log(`📋 Addon IDs: ${request.addonIds?.join(', ') || 'keine'}`);
  console.log(`📋 Nutzer: ${request.userCount}`);
  console.log(`📋 Billing Cycle: ${request.billingCycle}`);
  
  // Lade Plan-Details für Logging
  const plans = await getPricingPlans();
  const plan = plans.find(p => p.id === request.planId);
  if (plan) {
    console.log(`📋 Plan Name: ${plan.name}`);
    console.log(`📋 Plan Module: ${plan.includedModules?.join(', ') || 'keine'}`);
    console.log(`📋 Plan Module-Anzahl: ${plan.includedModules?.length || 0}`);
  } else {
    console.warn(`⚠️ Plan ${request.planId} nicht gefunden beim Erstellen der Subscription`);
  }
  
  const db = getAdminFirestore();
  const subscriptionsRef = db
    .collection('tenants')
    .doc(request.tenantId)
    .collection('subscriptions');
  
  // Berechne Abrechnungsperioden
  const now = new Date();
  const periodStart = new Date(now);
  const periodEnd = new Date(now);
  
  if (request.billingCycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }
  
  const subscription: Omit<Subscription, 'id'> = {
    tenantId: request.tenantId,
    planId: request.planId,
    addonIds: request.addonIds || [],
    userCount: request.userCount,
    billingCycle: request.billingCycle,
    status: 'active',
    currentPeriodStart: Timestamp.fromDate(periodStart),
    currentPeriodEnd: Timestamp.fromDate(periodEnd),
    createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
  };
  
  console.log(`💾 Speichere Subscription in Firestore...`);
  const docRef = await subscriptionsRef.add(subscription);
  console.log(`✅ Subscription gespeichert mit ID: ${docRef.id}`);
  console.log(`📦 ========== SUBSCRIPTION ERSTELLT ==========\n`);
  
  return {
    id: docRef.id,
    ...subscription,
  };
}

/**
 * Aktualisiert eine Subscription.
 */
export async function updateSubscription(
  tenantId: string,
  subscriptionId: string,
  request: UpdateSubscriptionRequest
): Promise<Subscription> {
  const db = getAdminFirestore();
  const subscriptionRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('subscriptions')
    .doc(subscriptionId);
  
  const updateData: Partial<Subscription> = {
    updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
  };
  
  if (request.planId !== undefined) {
    updateData.planId = request.planId;
  }
  
  if (request.addonIds !== undefined) {
    updateData.addonIds = request.addonIds;
  }
  
  if (request.userCount !== undefined) {
    updateData.userCount = request.userCount;
  }
  
  if (request.billingCycle !== undefined) {
    updateData.billingCycle = request.billingCycle;
  }
  
  if (request.cancelAtPeriodEnd !== undefined) {
    updateData.cancelAtPeriodEnd = request.cancelAtPeriodEnd;
  }
  
  await subscriptionRef.update(updateData);
  
  const subscriptionSnap = await subscriptionRef.get();
  
  if (!subscriptionSnap.exists) {
    throw new Error(`Subscription ${subscriptionId} nicht gefunden`);
  }
  
  return {
    id: subscriptionSnap.id,
    ...(subscriptionSnap.data() as Omit<Subscription, 'id'>),
  };
}

/**
 * Kündigt eine Subscription.
 */
export async function cancelSubscription(
  tenantId: string,
  subscriptionId: string
): Promise<Subscription> {
  return updateSubscription(tenantId, subscriptionId, {
    cancelAtPeriodEnd: true,
  });
}

/**
 * Speichert Stripe Customer Data.
 */
export async function saveStripeCustomer(
  tenantId: string,
  stripeCustomerId: string,
  email?: string
): Promise<StripeCustomer> {
  const db = getAdminFirestore();
  const customersRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('stripe')
    .doc('customers');
  
  // Erstelle Customer-Objekt ohne undefined-Werte
  const customerData: Record<string, unknown> = {
    tenantId,
    stripeCustomerId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  
  // Füge email nur hinzu, wenn es definiert ist
  if (email !== undefined && email !== null) {
    customerData.email = email;
  }
  
  await customersRef.set(
    {
      [stripeCustomerId]: customerData,
    },
    { merge: true }
  );
  
  return {
    id: stripeCustomerId,
    tenantId,
    stripeCustomerId,
    email: email || undefined,
    createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
  };
}

/**
 * Erstellt eine Stripe Checkout Session.
 */
export async function createCheckoutSession(
  tenantId: string,
  planId: string,
  addonIds: string[],
  userCount: number,
  billingCycle: 'monthly' | 'yearly',
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  // Prüfe zur Laufzeit, ob Stripe konfiguriert ist (falls .env zur Laufzeit geladen wurde)
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('Stripe ist nicht konfiguriert. STRIPE_SECRET_KEY fehlt in der .env-Datei. Bitte prüfe, ob die Variable gesetzt ist und starte den Server neu.');
  }
  
  // Erstelle Stripe-Client zur Laufzeit (falls er beim Import noch nicht verfügbar war)
  const stripeClient = stripe || new Stripe(stripeSecretKey, {
    apiVersion: '2025-12-15.clover',
  });
  
  // Lade Plan und Addons
  const plans = await getPricingPlans();
  const addons = await getPricingAddons();
  
  const plan = plans.find(p => p.id === planId);
  if (!plan) {
    throw new Error(`Plan ${planId} nicht gefunden`);
  }
  
  const selectedAddons = addons.filter(a => addonIds.includes(a.id));
  
  // Berechne Gesamtpreis
  const isYearly = billingCycle === 'yearly';
  const discount = isYearly ? 0.15 : 0;
  
  const planPricePerUser = isYearly && plan.pricePerUserYearly 
    ? plan.pricePerUserYearly 
    : plan.pricePerUser;
  const planMinimum = isYearly && plan.minimumPriceYearly 
    ? plan.minimumPriceYearly 
    : plan.minimumPrice;
  
  const planTotal = Math.max(planPricePerUser * userCount, planMinimum) * (1 - discount);
  
  let addonTotal = 0;
  for (const addon of selectedAddons) {
    const addonPricePerUser = isYearly && addon.pricePerUserYearly 
      ? addon.pricePerUserYearly 
      : addon.pricePerUser;
    const addonMinimum = isYearly && addon.minimumPriceYearly 
      ? addon.minimumPriceYearly 
      : addon.minimumPrice;
    const addonPrice = Math.max(addonPricePerUser * userCount, addonMinimum) * (1 - discount);
    addonTotal += addonPrice;
  }
  
  const totalAmount = Math.round((planTotal + addonTotal) * 100); // In Cent
  
  // Erstelle oder lade Stripe Customer
  let customerId: string | undefined;
  const customersRef = getAdminFirestore()
    .collection('tenants')
    .doc(tenantId)
    .collection('stripe')
    .doc('customers');
  const customersDoc = await customersRef.get();
  
  if (customersDoc.exists) {
    const data = customersDoc.data();
    if (data) {
      const firstCustomer = Object.values(data)[0] as StripeCustomer | undefined;
      if (firstCustomer) {
        customerId = firstCustomer.stripeCustomerId;
      }
    }
  }
  
  // Erstelle Checkout Session
  // WICHTIG: Preise sind bereits in Cent (nicht in Euro)!
  // planPricePerUser, planMinimum, etc. sind bereits in Cent
  // Stripe erwartet unit_amount in Cent, daher KEINE Multiplikation mit 100!
  const interval: 'month' | 'year' = billingCycle === 'monthly' ? 'month' : 'year';
  
  // Berechne effektiven Preis pro User in Cent (berücksichtigt Mindestpreis)
  // planTotal ist bereits in Cent, daher ist effectivePlanPricePerUser auch in Cent
  const effectivePlanPricePerUser = planTotal / userCount;
  
  // Für Addons: Berechne auch effektiven Preis pro User in Cent
  const addonLineItems = selectedAddons.map(addon => {
    const addonPricePerUser = isYearly && addon.pricePerUserYearly 
      ? addon.pricePerUserYearly 
      : addon.pricePerUser;
    const addonMinimum = isYearly && addon.minimumPriceYearly 
      ? addon.minimumPriceYearly 
      : addon.minimumPrice;
    const addonPrice = Math.max(addonPricePerUser * userCount, addonMinimum) * (1 - discount);
    const effectiveAddonPricePerUser = addonPrice / userCount;
    
    return {
      price_data: {
        currency: 'eur',
        product_data: {
          name: addon.name,
          description: addon.description,
        },
        unit_amount: Math.round(effectiveAddonPricePerUser), // Bereits in Cent, keine Multiplikation!
        recurring: {
          interval,
        },
      },
      quantity: userCount,
    };
  });
  
  const session = await stripeClient.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${plan.name} Plan`,
            description: plan.description,
          },
          unit_amount: Math.round(effectivePlanPricePerUser), // Bereits in Cent, keine Multiplikation!
          recurring: {
            interval,
          },
        },
        quantity: userCount,
      },
      ...addonLineItems,
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      tenantId,
      planId,
      addonIds: addonIds.join(','),
      userCount: userCount.toString(),
      billingCycle,
    },
  });
  
  return {
    sessionId: session.id,
    url: session.url || '',
  };
}

/**
 * Erstellt eine Subscription aus einer Stripe Checkout Session (Fallback, falls Webhook nicht ausgelöst wurde).
 */
export async function createSubscriptionFromSession(sessionId: string): Promise<{ subscription: Subscription; transactionLog: TransactionLog }> {
  console.log(`\n🎯 ========== SUBSCRIPTION AUS SESSION ERSTELLEN ==========`);
  console.log(`🎯 Session ID: ${sessionId}`);
  
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error(`❌ STRIPE_SECRET_KEY fehlt`);
    throw new Error('Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt).');
  }
  console.log(`✅ Stripe Secret Key gefunden`);

  // Initialisiere Stripe Client
  const stripeClient = stripe || new Stripe(stripeSecretKey, {
    apiVersion: '2025-12-15.clover',
  });

  // Lade Session von Stripe
  console.log(`🔄 Lade Stripe Checkout Session...`);
  const session = await stripeClient.checkout.sessions.retrieve(sessionId, {
    expand: ['customer', 'subscription'],
  });
  console.log(`✅ Session geladen: ${session.id}`);
  console.log(`📋 Session Status: ${session.status}`);
  console.log(`📋 Payment Status: ${session.payment_status}`);

  const tenantId = session.metadata?.tenantId;
  const planId = session.metadata?.planId;
  const addonIdsStr = session.metadata?.addonIds || '';
  const addonIds = addonIdsStr ? addonIdsStr.split(',').filter(id => id.trim()) : [];
  const userCount = parseInt(session.metadata?.userCount || '0', 10);
  const billingCycle = (session.metadata?.billingCycle || 'monthly') as 'monthly' | 'yearly';

  console.log(`📋 Session Metadata:`);
  console.log(`  - Tenant ID: ${tenantId}`);
  console.log(`  - Plan ID: ${planId}`);
  console.log(`  - Addon IDs: ${addonIds.join(', ') || 'keine'}`);
  console.log(`  - User Count: ${userCount}`);
  console.log(`  - Billing Cycle: ${billingCycle}`);

  if (!tenantId || !planId) {
    console.error(`❌ Fehlende Metadata: tenantId=${tenantId}, planId=${planId}`);
    throw new Error(`Fehlende Metadata in Checkout Session: tenantId=${tenantId}, planId=${planId}`);
  }

  // Prüfe, ob Subscription bereits existiert
  console.log(`🔍 Prüfe ob Subscription bereits existiert...`);
  const existingSubscriptions = await getTenantSubscriptions(tenantId);
  console.log(`📋 Gefundene Subscriptions: ${existingSubscriptions.length}`);
  
  const existingSubscription = existingSubscriptions.find(sub => 
    sub.planId === planId && 
    JSON.stringify(sub.addonIds?.sort()) === JSON.stringify(addonIds.sort()) &&
    sub.userCount === userCount &&
    sub.billingCycle === billingCycle
  );

  if (existingSubscription) {
    console.log(`ℹ️ Subscription existiert bereits für Tenant ${tenantId}, Plan ${planId}`);
    console.log(`ℹ️ Subscription ID: ${existingSubscription.id}`);
    // Erstelle trotzdem ein Transaktions-Log, falls noch nicht vorhanden
    const amountTotal = session.amount_total || 0;
    console.log(`💾 Erstelle Transaktions-Log für existierende Subscription...`);
    const transactionLog = await logTransaction({
      tenantId,
      eventType: 'checkout_completed',
      subscriptionId: existingSubscription.id,
      planId,
      addonIds,
      userCount,
      billingCycle,
      amount: amountTotal,
      currency: session.currency || 'eur',
      stripeSessionId: session.id,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      status: 'success',
      metadata: {
        customer_email: session.customer_email || '',
        payment_status: session.payment_status || '',
        created_from_session: 'true',
      },
    });
    console.log(`✅ Transaktions-Log erstellt: ${transactionLog.id}`);
    console.log(`🎯 ========== SUBSCRIPTION AUS SESSION ABGESCHLOSSEN (EXISTIERT) ==========\n`);
    return { subscription: existingSubscription, transactionLog };
  }

  // Speichere Customer
  if (session.customer) {
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
    console.log(`💳 Speichere Stripe Customer: ${customerId}`);
    await saveStripeCustomer(
      tenantId,
      customerId,
      session.customer_email || undefined
    );
    console.log(`✅ Stripe Customer gespeichert für Tenant ${tenantId}`);
  }

  // Erstelle Subscription
  console.log(`\n📦 Erstelle neue Subscription...`);
  const subscription = await createSubscription({
    tenantId,
    planId,
    addonIds,
    userCount,
    billingCycle,
  });

  // Berechne Gesamtbetrag aus Session
  const amountTotal = session.amount_total || 0;
  console.log(`💰 Betrag: ${(amountTotal / 100).toFixed(2)} ${session.currency?.toUpperCase() || 'EUR'}`);

  // Speichere Transaktions-Log
  console.log(`💾 Erstelle Transaktions-Log...`);
  const transactionLog = await logTransaction({
    tenantId,
    eventType: 'checkout_completed',
    subscriptionId: subscription.id,
    planId,
    addonIds,
    userCount,
    billingCycle,
    amount: amountTotal,
    currency: session.currency || 'eur',
    stripeSessionId: session.id,
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    status: 'success',
    metadata: {
      customer_email: session.customer_email || '',
      payment_status: session.payment_status || '',
      created_from_session: 'true',
    },
  });
  console.log(`✅ Transaktions-Log erstellt: ${transactionLog.id}`);

  // Module aktivieren
  console.log(`\n🔄 Starte Module-Aktivierung...`);
  await activateModulesForSubscription(tenantId, planId, addonIds);

  console.log(`\n✅ ========== SUBSCRIPTION AUS SESSION ERFOLGREICH ERSTELLT ==========`);
  console.log(`✅ Subscription ID: ${subscription.id}`);
  console.log(`✅ Transaction Log ID: ${transactionLog.id}`);
  console.log(`✅ Tenant ID: ${tenantId}`);
  console.log(`🎯 ========== SUBSCRIPTION AUS SESSION ABGESCHLOSSEN ==========\n`);

  return { subscription, transactionLog };
}

/**
 * Verarbeitet Stripe Webhook Events.
 */
export async function handleStripeWebhook(
  event: Stripe.Event
): Promise<void> {
  if (!stripe) {
    throw new Error('Stripe ist nicht konfiguriert.');
  }
  
  const db = getAdminFirestore();
  
  switch (event.type) {
    case 'checkout.session.completed': {
      console.log('\n🎉 ========== STRIPE WEBHOOK: CHECKOUT ABGESCHLOSSEN ==========');
      console.log(`🎉 Event Type: checkout.session.completed`);
      console.log(`🎉 Event ID: ${event.id}`);
      console.log(`🎉 Zeitpunkt: ${new Date().toISOString()}`);
      
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`🎉 Session ID: ${session.id}`);
      console.log(`🎉 Payment Status: ${session.payment_status}`);
      console.log(`🎉 Betrag: ${session.amount_total ? (session.amount_total / 100).toFixed(2) + ' ' + (session.currency?.toUpperCase() || 'EUR') : 'keine'}`);
      
      const tenantId = session.metadata?.tenantId;
      const planId = session.metadata?.planId;
      const addonIdsStr = session.metadata?.addonIds || '';
      const addonIds = addonIdsStr ? addonIdsStr.split(',').filter(id => id.trim()) : [];
      const userCount = parseInt(session.metadata?.userCount || '0', 10);
      const billingCycle = (session.metadata?.billingCycle || 'monthly') as 'monthly' | 'yearly';
      
      console.log(`📦 Webhook Metadata:`);
      console.log(`  - Tenant ID: ${tenantId}`);
      console.log(`  - Plan ID: ${planId}`);
      console.log(`  - Addon IDs: ${addonIds.join(', ') || 'keine'}`);
      console.log(`  - User Count: ${userCount}`);
      console.log(`  - Billing Cycle: ${billingCycle}`);
      
      if (!tenantId || !planId) {
        console.error('❌ Fehlende Metadata in Checkout Session:', session.id);
        console.error('❌ Metadata:', session.metadata);
        console.log('🎉 ========== WEBHOOK ABGEBROCHEN ==========\n');
        return;
      }
      
      // Speichere Customer
      if (session.customer) {
        await saveStripeCustomer(
          tenantId,
          typeof session.customer === 'string' ? session.customer : session.customer.id,
          session.customer_email || undefined
        );
        console.log(`💳 Stripe Customer gespeichert für Tenant ${tenantId}`);
      }
      
      // Lade Stripe Subscription ID aus Session
      let stripeSubscriptionId: string | undefined;
      if (session.subscription) {
        stripeSubscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;
      }
      
      // Erstelle Subscription
      const subscription = await createSubscription({
        tenantId,
        planId,
        addonIds,
        userCount,
        billingCycle,
      });
      
      // Aktualisiere Subscription mit Stripe IDs
      if (stripeSubscriptionId || session.customer) {
        const subscriptionRef = db
          .collection('tenants')
          .doc(tenantId)
          .collection('subscriptions')
          .doc(subscription.id);
        
        const updateData: Partial<Subscription> = {};
        if (stripeSubscriptionId) {
          updateData.stripeSubscriptionId = stripeSubscriptionId;
        }
        if (session.customer) {
          updateData.stripeCustomerId = typeof session.customer === 'string'
            ? session.customer
            : session.customer.id;
        }
        
        await subscriptionRef.update(updateData);
      }
      
      console.log(`📝 Subscription erstellt für Tenant ${tenantId}, Plan ${planId}`);
      
      // Berechne Gesamtbetrag aus Session
      const amountTotal = session.amount_total || 0; // in Cent
      
      // Speichere Transaktions-Log
      await logTransaction({
        tenantId,
        eventType: 'checkout_completed',
        subscriptionId: subscription.id,
        planId,
        addonIds,
        userCount,
        billingCycle,
        amount: amountTotal,
        currency: session.currency || 'eur',
        stripeSessionId: session.id,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
        stripeEventId: event.id,
        status: 'success',
        metadata: {
          customer_email: session.customer_email || '',
          payment_status: session.payment_status || '',
        },
      });
      
      // Module aktivieren
      console.log(`\n🔄 Aktiviere Module für neue Subscription...`);
      await activateModulesForSubscription(tenantId, planId, addonIds);
      console.log(`✅ Module aktiviert`);
      
      console.log(`\n✅ ========== CHECKOUT ABGESCHLOSSEN ==========`);
      console.log(`✅ Tenant: ${tenantId}`);
      console.log(`✅ Plan: ${planId}`);
      console.log(`✅ Nutzeranzahl: ${userCount}`);
      console.log(`✅ Billing Cycle: ${billingCycle}`);
      console.log(`✅ Subscription erstellt: ${subscription.id}`);
      console.log(`🎉 ========== WEBHOOK ABGESCHLOSSEN ==========\n`);
      break;
    }
    
    case 'invoice.payment_succeeded': {
      console.log('\n💳 ========== STRIPE WEBHOOK: WIEDERKEHRENDE ABRECHNUNG ==========');
      console.log(`💳 Event Type: invoice.payment_succeeded`);
      console.log(`💳 Event ID: ${event.id}`);
      console.log(`💳 Zeitpunkt: ${new Date().toISOString()}`);
      
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`💳 Invoice ID: ${invoice.id}`);
      console.log(`💳 Invoice Number: ${invoice.number || 'keine'}`);
      console.log(`💳 Betrag: ${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency?.toUpperCase() || 'EUR'}`);
      console.log(`💳 Billing Reason: ${invoice.billing_reason || 'unbekannt'}`);
      
      // Invoice.subscription kann string, Subscription oder null sein
      const invoiceSubscription = (invoice as any).subscription as string | Stripe.Subscription | null;
      if (!invoiceSubscription) {
        console.log('⚠️ Invoice hat keine Subscription, überspringe');
        console.log('💳 ========== WEBHOOK ABGESCHLOSSEN ==========\n');
        break;
      }
      
      const stripeSubscriptionId = typeof invoiceSubscription === 'string'
        ? invoiceSubscription
        : invoiceSubscription.id;
      console.log(`💳 Stripe Subscription ID: ${stripeSubscriptionId}`);
      
      // Prüfe ob es eine wiederkehrende Abrechnung ist
      const isRecurring = invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create';
      console.log(`💳 Wiederkehrende Abrechnung: ${isRecurring ? '✅ JA' : '❌ NEIN (Erstzahlung/Manuell)'}`);
      
      // Finde Subscription in Firestore
      console.log(`🔍 Suche Subscription in Firestore...`);
      const subscriptionsSnapshot = await db
        .collectionGroup('subscriptions')
        .where('stripeSubscriptionId', '==', stripeSubscriptionId)
        .limit(1)
        .get();
      
      if (subscriptionsSnapshot.empty) {
        console.warn(`⚠️ Subscription ${stripeSubscriptionId} nicht in Firestore gefunden`);
        console.log('💳 ========== WEBHOOK ABGEBROCHEN ==========\n');
        break;
      }
      
      const subscriptionDoc = subscriptionsSnapshot.docs[0];
      const subscriptionData = subscriptionDoc.data() as Omit<Subscription, 'id'>;
      const tenantId = subscriptionData.tenantId;
      console.log(`✅ Subscription gefunden in Firestore`);
      console.log(`💳 Tenant ID: ${tenantId}`);
      console.log(`💳 Subscription ID (Firestore): ${subscriptionDoc.id}`);
      console.log(`💳 Plan: ${subscriptionData.planId}`);
      console.log(`💳 Nutzeranzahl: ${subscriptionData.userCount}`);
      console.log(`💳 Billing Cycle: ${subscriptionData.billingCycle}`);
      
      // Aktualisiere Abrechnungsperioden
      console.log(`\n🔄 Lade aktuelle Stripe Subscription...`);
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      // Stripe Subscription hat current_period_start und current_period_end als number (Unix timestamp)
      const periodStartValue = (stripeSubscription as any).current_period_start as number;
      const periodEndValue = (stripeSubscription as any).current_period_end as number;
      const periodStart = Timestamp.fromDate(new Date(periodStartValue * 1000));
      const periodEnd = Timestamp.fromDate(new Date(periodEndValue * 1000));
      
      console.log(`📅 Aktuelle Periode Start: ${new Date(periodStartValue * 1000).toISOString()}`);
      console.log(`📅 Aktuelle Periode Ende: ${new Date(periodEndValue * 1000).toISOString()}`);
      
      console.log(`💾 Aktualisiere Subscription in Firestore...`);
      await subscriptionDoc.ref.update({
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        status: 'active',
        updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      });
      console.log(`✅ Subscription aktualisiert`);
      
      // Erstelle TransactionLog
      console.log(`\n💾 Erstelle TransactionLog...`);
      await logTransaction({
        tenantId,
        eventType: 'payment_succeeded',
        subscriptionId: subscriptionDoc.id,
        planId: subscriptionData.planId,
        addonIds: subscriptionData.addonIds,
        userCount: subscriptionData.userCount,
        billingCycle: subscriptionData.billingCycle,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
        stripeSubscriptionId,
        stripeEventId: event.id,
        status: 'success',
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.number || '',
          billing_reason: invoice.billing_reason || '',
          is_recurring: isRecurring ? 'true' : 'false',
        },
      });
      
      console.log(`\n✅ ========== WIEDERKEHRENDE ABRECHNUNG ERFOLGREICH VERARBEITET ==========`);
      console.log(`✅ Tenant: ${tenantId}`);
      console.log(`✅ Betrag: ${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency?.toUpperCase() || 'EUR'}`);
      console.log(`✅ Nächste Abrechnung: ${new Date(periodEndValue * 1000).toLocaleDateString('de-DE')}`);
      console.log(`💳 ========== WEBHOOK ABGESCHLOSSEN ==========\n`);
      break;
    }
    
    case 'invoice.payment_failed': {
      console.log('\n❌ ========== STRIPE WEBHOOK: ZAHLUNG FEHLGESCHLAGEN ==========');
      console.log(`❌ Event Type: invoice.payment_failed`);
      console.log(`❌ Event ID: ${event.id}`);
      console.log(`❌ Zeitpunkt: ${new Date().toISOString()}`);
      
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`❌ Invoice ID: ${invoice.id}`);
      console.log(`❌ Invoice Number: ${invoice.number || 'keine'}`);
      console.log(`❌ Betrag: ${(invoice.amount_due / 100).toFixed(2)} ${invoice.currency?.toUpperCase() || 'EUR'}`);
      console.log(`❌ Versuche: ${invoice.attempt_count || 0}`);
      
      // Invoice.subscription kann string, Subscription oder null sein
      const invoiceSubscription = (invoice as any).subscription as string | Stripe.Subscription | null;
      if (!invoiceSubscription) {
        console.log('⚠️ Invoice hat keine Subscription, überspringe');
        console.log('❌ ========== WEBHOOK ABGESCHLOSSEN ==========\n');
        break;
      }
      
      const stripeSubscriptionId = typeof invoiceSubscription === 'string'
        ? invoiceSubscription
        : invoiceSubscription.id;
      console.log(`❌ Stripe Subscription ID: ${stripeSubscriptionId}`);
      
      // Finde Subscription in Firestore
      console.log(`🔍 Suche Subscription in Firestore...`);
      const subscriptionsSnapshot = await db
        .collectionGroup('subscriptions')
        .where('stripeSubscriptionId', '==', stripeSubscriptionId)
        .limit(1)
        .get();
      
      if (subscriptionsSnapshot.empty) {
        console.warn(`⚠️ Subscription ${stripeSubscriptionId} nicht in Firestore gefunden`);
        console.log('❌ ========== WEBHOOK ABGEBROCHEN ==========\n');
        break;
      }
      
      const subscriptionDoc = subscriptionsSnapshot.docs[0];
      const subscriptionData = subscriptionDoc.data() as Omit<Subscription, 'id'>;
      const tenantId = subscriptionData.tenantId;
      console.log(`✅ Subscription gefunden in Firestore`);
      console.log(`❌ Tenant ID: ${tenantId}`);
      console.log(`❌ Subscription ID (Firestore): ${subscriptionDoc.id}`);
      console.log(`❌ Plan: ${subscriptionData.planId}`);
      
      const lastPaymentError = (invoice as any).last_payment_error as { message?: string; type?: string } | null | undefined;
      const errorMessage = lastPaymentError?.message || 'Zahlung fehlgeschlagen';
      console.log(`❌ Fehlermeldung: ${errorMessage}`);
      
      // Setze Status auf past_due
      console.log(`💾 Setze Subscription-Status auf 'past_due'...`);
      await subscriptionDoc.ref.update({
        status: 'past_due',
        updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      });
      console.log(`✅ Subscription-Status aktualisiert`);
      
      // Erstelle TransactionLog
      console.log(`\n💾 Erstelle TransactionLog...`);
      await logTransaction({
        tenantId,
        eventType: 'payment_failed',
        subscriptionId: subscriptionDoc.id,
        planId: subscriptionData.planId,
        addonIds: subscriptionData.addonIds,
        userCount: subscriptionData.userCount,
        billingCycle: subscriptionData.billingCycle,
        amount: invoice.amount_due,
        currency: invoice.currency,
        stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
        stripeSubscriptionId,
        stripeEventId: event.id,
        status: 'failed',
        errorMessage,
        metadata: {
          invoice_id: invoice.id,
          attempt_count: invoice.attempt_count?.toString() || '0',
          error_type: lastPaymentError?.type || 'unknown',
        },
      });
      
      console.log(`\n❌ ========== ZAHLUNGSFEHLER VERARBEITET ==========`);
      console.log(`❌ Tenant: ${tenantId}`);
      console.log(`❌ Betrag: ${(invoice.amount_due / 100).toFixed(2)} ${invoice.currency?.toUpperCase() || 'EUR'}`);
      console.log(`❌ Status: past_due`);
      console.log(`❌ ========== WEBHOOK ABGESCHLOSSEN ==========\n`);
      break;
    }
    
    case 'customer.subscription.updated': {
      console.log('\n🔄 ========== STRIPE WEBHOOK: SUBSCRIPTION AKTUALISIERT ==========');
      console.log(`🔄 Event Type: customer.subscription.updated`);
      console.log(`🔄 Event ID: ${event.id}`);
      console.log(`🔄 Zeitpunkt: ${new Date().toISOString()}`);
      
      const stripeSubscription = event.data.object as Stripe.Subscription;
      console.log(`🔄 Stripe Subscription ID: ${stripeSubscription.id}`);
      console.log(`🔄 Stripe Status: ${stripeSubscription.status}`);
      console.log(`🔄 Cancel at Period End: ${stripeSubscription.cancel_at_period_end ? '✅ JA' : '❌ NEIN'}`);
      
      // Finde Subscription in Firestore
      console.log(`🔍 Suche Subscription in Firestore...`);
      const subscriptionsSnapshot = await db
        .collectionGroup('subscriptions')
        .where('stripeSubscriptionId', '==', stripeSubscription.id)
        .limit(1)
        .get();
      
      if (subscriptionsSnapshot.empty) {
        console.warn(`⚠️ Subscription ${stripeSubscription.id} nicht in Firestore gefunden`);
        console.log('🔄 ========== WEBHOOK ABGEBROCHEN ==========\n');
        break;
      }
      
      const subscriptionDoc = subscriptionsSnapshot.docs[0];
      const subscriptionData = subscriptionDoc.data() as Omit<Subscription, 'id'>;
      const tenantId = subscriptionData.tenantId;
      console.log(`✅ Subscription gefunden in Firestore`);
      console.log(`🔄 Tenant ID: ${tenantId}`);
      console.log(`🔄 Subscription ID (Firestore): ${subscriptionDoc.id}`);
      console.log(`🔄 Alte Nutzeranzahl: ${subscriptionData.userCount}`);
      console.log(`🔄 Alter Status: ${subscriptionData.status}`);
      
      // Aktualisiere Firestore mit Daten aus Stripe
      // Stripe.Subscription hat current_period_start und current_period_end als number (Unix timestamp)
      const periodStartValue = (stripeSubscription as any).current_period_start as number;
      const periodEndValue = (stripeSubscription as any).current_period_end as number;
      const periodStart = Timestamp.fromDate(new Date(periodStartValue * 1000));
      const periodEnd = Timestamp.fromDate(new Date(periodEndValue * 1000));
      
      const updateData: Partial<Subscription> = {
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        status: stripeSubscription.status === 'active' ? 'active' : 
               stripeSubscription.status === 'canceled' ? 'canceled' :
               stripeSubscription.status === 'past_due' ? 'past_due' : 'active',
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      };
      
      // Prüfe auf Quantity-Änderungen (Nutzeranzahl)
      const planItem = stripeSubscription.items.data[0];
      if (planItem && planItem.quantity !== subscriptionData.userCount) {
        updateData.userCount = planItem.quantity;
        console.log(`📊 Nutzeranzahl geändert: ${subscriptionData.userCount} → ${planItem.quantity}`);
      }
      
      if (subscriptionData.status !== updateData.status) {
        console.log(`📊 Status geändert: ${subscriptionData.status} → ${updateData.status}`);
      }
      
      console.log(`💾 Aktualisiere Subscription in Firestore...`);
      await subscriptionDoc.ref.update(updateData);
      console.log(`✅ Subscription aktualisiert`);
      
      // Erstelle TransactionLog
      console.log(`\n💾 Erstelle TransactionLog...`);
      await logTransaction({
        tenantId: subscriptionData.tenantId,
        eventType: 'subscription_updated',
        subscriptionId: subscriptionDoc.id,
        planId: subscriptionData.planId,
        addonIds: subscriptionData.addonIds,
        userCount: updateData.userCount || subscriptionData.userCount,
        billingCycle: subscriptionData.billingCycle,
        stripeSubscriptionId: stripeSubscription.id,
        stripeEventId: event.id,
        status: 'success',
        metadata: {
          stripe_status: stripeSubscription.status,
          old_user_count: subscriptionData.userCount.toString(),
          new_user_count: (updateData.userCount || subscriptionData.userCount).toString(),
          cancel_at_period_end: stripeSubscription.cancel_at_period_end ? 'true' : 'false',
        },
      });
      
      console.log(`\n✅ ========== SUBSCRIPTION-AKTUALISIERUNG ABGESCHLOSSEN ==========`);
      console.log(`✅ Tenant: ${tenantId}`);
      console.log(`✅ Neuer Status: ${updateData.status}`);
      console.log(`✅ Nutzeranzahl: ${updateData.userCount || subscriptionData.userCount}`);
      console.log(`🔄 ========== WEBHOOK ABGESCHLOSSEN ==========\n`);
      break;
    }
    
    case 'customer.subscription.deleted': {
      console.log('\n🗑️ ========== STRIPE WEBHOOK: SUBSCRIPTION GEKÜNDIGT ==========');
      console.log(`🗑️ Event Type: customer.subscription.deleted`);
      console.log(`🗑️ Event ID: ${event.id}`);
      console.log(`🗑️ Zeitpunkt: ${new Date().toISOString()}`);
      
      const stripeSubscription = event.data.object as Stripe.Subscription;
      console.log(`🗑️ Stripe Subscription ID: ${stripeSubscription.id}`);
      console.log(`🗑️ Stripe Status: ${stripeSubscription.status}`);
      
      // Finde Subscription in Firestore
      console.log(`🔍 Suche Subscription in Firestore...`);
      const subscriptionsSnapshot = await db
        .collectionGroup('subscriptions')
        .where('stripeSubscriptionId', '==', stripeSubscription.id)
        .limit(1)
        .get();
      
      if (subscriptionsSnapshot.empty) {
        console.warn(`⚠️ Subscription ${stripeSubscription.id} nicht in Firestore gefunden`);
        console.log('🗑️ ========== WEBHOOK ABGEBROCHEN ==========\n');
        break;
      }
      
      const subscriptionDoc = subscriptionsSnapshot.docs[0];
      const subscriptionData = subscriptionDoc.data() as Omit<Subscription, 'id'>;
      const tenantId = subscriptionData.tenantId;
      console.log(`✅ Subscription gefunden in Firestore`);
      console.log(`🗑️ Tenant ID: ${tenantId}`);
      console.log(`🗑️ Subscription ID (Firestore): ${subscriptionDoc.id}`);
      console.log(`🗑️ Plan: ${subscriptionData.planId}`);
      console.log(`🗑️ Nutzeranzahl: ${subscriptionData.userCount}`);
      
      // Setze Status auf canceled
      console.log(`💾 Setze Subscription-Status auf 'canceled'...`);
      await subscriptionDoc.ref.update({
        status: 'canceled',
        updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      });
      console.log(`✅ Subscription-Status aktualisiert`);
      
      // Deaktiviere Module
      console.log(`\n🔄 Deaktiviere Module für gekündigte Subscription...`);
      await deactivateModulesForSubscription(
        tenantId,
        subscriptionData.planId,
        subscriptionData.addonIds || []
      );
      console.log(`✅ Module deaktiviert`);
      
      // Erstelle TransactionLog
      console.log(`\n💾 Erstelle TransactionLog...`);
      await logTransaction({
        tenantId: subscriptionData.tenantId,
        eventType: 'subscription_canceled',
        subscriptionId: subscriptionDoc.id,
        planId: subscriptionData.planId,
        addonIds: subscriptionData.addonIds,
        userCount: subscriptionData.userCount,
        billingCycle: subscriptionData.billingCycle,
        stripeSubscriptionId: stripeSubscription.id,
        stripeEventId: event.id,
        status: 'success',
        metadata: {
          canceled_at: new Date().toISOString(),
        },
      });
      
      console.log(`\n✅ ========== SUBSCRIPTION-KÜNDIGUNG ABGESCHLOSSEN ==========`);
      console.log(`✅ Tenant: ${tenantId}`);
      console.log(`✅ Plan: ${subscriptionData.planId}`);
      console.log(`✅ Module wurden deaktiviert`);
      console.log(`🗑️ ========== WEBHOOK ABGESCHLOSSEN ==========\n`);
      break;
    }
    
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

/**
 * Speichert einen Transaktions-Log-Eintrag.
 */
export async function logTransaction(
  data: Omit<TransactionLog, 'id' | 'createdAt'>
): Promise<TransactionLog> {
  console.log(`\n💾 ========== TRANSACTIONS-LOG ERSTELLEN ==========`);
  console.log(`💾 Event Type: ${data.eventType}`);
  console.log(`💾 Tenant ID: ${data.tenantId}`);
  console.log(`💾 Plan ID: ${data.planId || 'keine'}`);
  console.log(`💾 Subscription ID: ${data.subscriptionId || 'keine'}`);
  console.log(`💾 Addon IDs: ${data.addonIds?.join(', ') || 'keine'}`);
  console.log(`💾 User Count: ${data.userCount || 'keine'}`);
  console.log(`💾 Billing Cycle: ${data.billingCycle || 'keine'}`);
  console.log(`💾 Amount: ${data.amount ? (data.amount / 100).toFixed(2) + ' ' + (data.currency?.toUpperCase() || 'EUR') : 'keine'}`);
  console.log(`💾 Status: ${data.status || 'keine'}`);
  console.log(`💾 Stripe Session ID: ${data.stripeSessionId || 'keine'}`);
  
  const db = getAdminFirestore();
  const transactionsRef = db.collection('transaction_logs');
  
  const transaction: Omit<TransactionLog, 'id'> = {
    ...data,
    createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
  };
  
  const docRef = await transactionsRef.add(transaction);
  console.log(`✅ Transaktions-Log gespeichert mit ID: ${docRef.id}`);
  console.log(`💾 ========== TRANSACTIONS-LOG ERSTELLT ==========\n`);
  
  return {
    id: docRef.id,
    ...transaction,
  };
}

/**
 * Lädt alle Transaktions-Logs (optional gefiltert nach Tenant).
 */
export async function getTransactionLogs(tenantId?: string): Promise<TransactionLog[]> {
  const db = getAdminFirestore();
  let query: FirebaseFirestore.Query = db.collection('transaction_logs');
  
  if (tenantId) {
    query = query.where('tenantId', '==', tenantId);
  }
  
  // Sortiere nach Datum (neueste zuerst)
  query = query.orderBy('createdAt', 'desc').limit(1000);
  
  const snapshot = await query.get();
  
  const logs: TransactionLog[] = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data() as Omit<TransactionLog, 'id'>;
    logs.push({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    } as any);
  }
  
  return logs;
}

