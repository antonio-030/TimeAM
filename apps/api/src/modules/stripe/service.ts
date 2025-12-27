/**
 * Stripe Service
 *
 * Business Logic für die Stripe-Integration (Preise, Abonnements).
 */

import Stripe from 'stripe';
import { getAdminFirestore } from '../../core/firebase/index.js';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  PricingPlan,
  PricingAddon,
  Subscription,
  StripeCustomer,
  UpsertPricingPlanRequest,
  UpsertPricingAddonRequest,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
} from './types.js';

// Stripe Client initialisieren
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn('⚠️ STRIPE_SECRET_KEY nicht gesetzt. Stripe-Funktionen werden nicht verfügbar sein.');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2024-11-20.acacia',
}) : null;

const DEV_TENANT_ID = 'dev-tenant';

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
  
  const plan: Omit<PricingPlan, 'id'> = {
    name: request.name,
    description: request.description,
    pricePerUser: request.pricePerUser,
    minimumPrice: request.minimumPrice,
    pricePerUserYearly: request.pricePerUserYearly,
    minimumPriceYearly: request.minimumPriceYearly,
    includedModules: request.includedModules,
    features: request.features,
    targetGroup: request.targetGroup,
    createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
  };
  
  await plansRef.set(
    {
      [request.id]: plan,
    },
    { merge: true }
  );
  
  return {
    id: request.id,
    ...plan,
  };
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
  
  const addon: Omit<PricingAddon, 'id'> = {
    moduleId: request.moduleId,
    name: request.name,
    description: request.description,
    pricePerUser: request.pricePerUser,
    minimumPrice: request.minimumPrice,
    pricePerUserYearly: request.pricePerUserYearly,
    minimumPriceYearly: request.minimumPriceYearly,
    icon: request.icon,
    createdAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
    updatedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
  };
  
  await addonsRef.set(
    {
      [request.id]: addon,
    },
    { merge: true }
  );
  
  return {
    id: request.id,
    ...addon,
  };
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
  if (!stripe) {
    throw new Error('Stripe ist nicht konfiguriert. STRIPE_SECRET_KEY fehlt.');
  }
  
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
  const session = await stripe.checkout.sessions.create({
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
          unit_amount: Math.round(planPricePerUser * 100), // In Cent
          recurring: {
            interval: billingCycle === 'monthly' ? 'month' : 'year',
          },
        },
        quantity: userCount,
      },
      ...selectedAddons.map(addon => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: addon.name,
            description: addon.description,
          },
          unit_amount: Math.round((isYearly && addon.pricePerUserYearly ? addon.pricePerUserYearly : addon.pricePerUser) * 100),
          recurring: {
            interval: billingCycle === 'monthly' ? 'month' : 'year',
          },
        },
        quantity: userCount,
      })),
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
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const planId = session.metadata?.planId;
      const addonIds = session.metadata?.addonIds?.split(',') || [];
      const userCount = parseInt(session.metadata?.userCount || '0', 10);
      const billingCycle = (session.metadata?.billingCycle || 'monthly') as 'monthly' | 'yearly';
      
      if (!tenantId || !planId) {
        console.error('Fehlende Metadata in Checkout Session:', session.id);
        return;
      }
      
      // Speichere Customer
      if (session.customer) {
        await saveStripeCustomer(
          tenantId,
          typeof session.customer === 'string' ? session.customer : session.customer.id,
          session.customer_email || undefined
        );
      }
      
      // Erstelle Subscription
      await createSubscription({
        tenantId,
        planId,
        addonIds,
        userCount,
        billingCycle,
      });
      
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

