/**
 * Stripe Service
 *
 * Business Logic für die Stripe-Integration (Preise, Abonnements).
 */

import Stripe from 'stripe';
import { getAdminFirestore } from '../../core/firebase/index.js';
import { FieldValue } from 'firebase-admin/firestore';
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
      console.log('✅ Standard-Plans bereits vorhanden');
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
  console.log(`🔄 Starte Module-Aktivierung für Tenant ${tenantId}, Plan ${planId}, Addons: ${addonIds.join(', ') || 'keine'}`);
  
  // Lade Plan
  const plans = await getPricingPlans();
  const plan = plans.find(p => p.id === planId);
  
  if (!plan) {
    console.error(`❌ Plan ${planId} nicht gefunden für Tenant ${tenantId}`);
    console.log(`Verfügbare Plans: ${plans.map(p => p.id).join(', ')}`);
    return;
  }

  console.log(`📋 Plan gefunden: ${plan.name}, includedModules: ${plan.includedModules?.join(', ') || 'keine'}`);

  // Aktiviere Module aus Plan
  // WICHTIG: Core-Module haben kein entitlementKey und sind immer aktiv
  // Nur optionale Module mit entitlementKey werden aktiviert
  let activatedCount = 0;
  for (const moduleId of plan.includedModules || []) {
    const entitlementKey = getEntitlementKeyForModule(moduleId);
    if (entitlementKey) {
      try {
        await setEntitlement(tenantId, entitlementKey, true);
        console.log(`✅ Modul ${moduleId} (${entitlementKey}) für Tenant ${tenantId} aktiviert`);
        activatedCount++;
      } catch (err) {
        console.error(`❌ Fehler beim Aktivieren von Modul ${moduleId} (${entitlementKey}):`, err);
      }
    } else {
      // Core-Module haben kein entitlementKey - das ist normal
      const module = MODULE_REGISTRY[moduleId];
      if (module && module.category === 'core') {
        console.log(`ℹ️ Modul ${moduleId} ist ein Core-Modul und immer aktiv (kein Entitlement nötig)`);
      } else {
        console.warn(`⚠️ Kein Entitlement-Key für Modul ${moduleId} gefunden. Modul in Registry: ${module ? 'ja' : 'nein'}`);
      }
    }
  }

  // Aktiviere Module aus Addons
  const addons = await getPricingAddons();
  for (const addonId of addonIds) {
    if (!addonId) continue; // Leere Strings überspringen
    
    const addon = addons.find(a => a.id === addonId);
    if (addon && addon.moduleId) {
      const entitlementKey = getEntitlementKeyForModule(addon.moduleId);
      if (entitlementKey) {
        try {
          await setEntitlement(tenantId, entitlementKey, true);
          console.log(`✅ Modul ${addon.moduleId} (${entitlementKey}) aus Addon ${addonId} für Tenant ${tenantId} aktiviert`);
          activatedCount++;
        } catch (err) {
          console.error(`❌ Fehler beim Aktivieren von Modul ${addon.moduleId} aus Addon ${addonId}:`, err);
        }
      } else {
        console.warn(`⚠️ Kein Entitlement-Key für Modul ${addon.moduleId} (Addon ${addonId}) gefunden`);
      }
    } else {
      console.warn(`⚠️ Addon ${addonId} nicht gefunden oder hat kein moduleId`);
    }
  }

  console.log(`✅ Module-Aktivierung abgeschlossen: ${activatedCount} Module aktiviert für Tenant ${tenantId}`);
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
    subscriptions.push({
      id: doc.id,
      ...(doc.data() as Omit<Subscription, 'id'>),
    });
  }
  
  return subscriptions;
}

/**
 * Erstellt eine neue Subscription.
 */
export async function createSubscription(
  request: CreateSubscriptionRequest
): Promise<Subscription> {
  const db = getAdminFirestore();
  const subscriptionsRef = db
    .collection('tenants')
    .doc(request.tenantId)
    .collection('subscriptions');
  
  const subscription: Omit<Subscription, 'id'> = {
    tenantId: request.tenantId,
    planId: request.planId,
    addonIds: request.addonIds || [],
    userCount: request.userCount,
    billingCycle: request.billingCycle,
    status: 'active',
    currentPeriodStart: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    currentPeriodEnd: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
  };
  
  const docRef = await subscriptionsRef.add(subscription);
  
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
  
  const customer: Omit<StripeCustomer, 'id'> = {
    tenantId,
    stripeCustomerId,
    email,
    createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
  };
  
  await customersRef.set(
    {
      [stripeCustomerId]: customer,
    },
    { merge: true }
  );
  
  return {
    id: stripeCustomerId,
    ...customer,
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
      console.log('🎉 Stripe Webhook: checkout.session.completed');
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const planId = session.metadata?.planId;
      const addonIdsStr = session.metadata?.addonIds || '';
      const addonIds = addonIdsStr ? addonIdsStr.split(',').filter(id => id.trim()) : [];
      const userCount = parseInt(session.metadata?.userCount || '0', 10);
      const billingCycle = (session.metadata?.billingCycle || 'monthly') as 'monthly' | 'yearly';
      
      console.log(`📦 Webhook Metadata: tenantId=${tenantId}, planId=${planId}, addonIds=${addonIds.join(', ') || 'keine'}, userCount=${userCount}, billingCycle=${billingCycle}`);
      
      if (!tenantId || !planId) {
        console.error('❌ Fehlende Metadata in Checkout Session:', session.id);
        console.error('Metadata:', session.metadata);
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
      
      // Erstelle Subscription
      await createSubscription({
        tenantId,
        planId,
        addonIds,
        userCount,
        billingCycle,
      });
      console.log(`📝 Subscription erstellt für Tenant ${tenantId}, Plan ${planId}`);
      
      // Module aktivieren
      await activateModulesForSubscription(tenantId, planId, addonIds);
      
      console.log(`✅ Webhook-Verarbeitung abgeschlossen für Tenant ${tenantId}`);
      break;
    }
    
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      // TODO: Subscription in Firestore aktualisieren
      console.log('Subscription updated:', subscription.id);
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      // TODO: Subscription in Firestore als canceled markieren
      console.log('Subscription deleted:', subscription.id);
      break;
    }
    
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

