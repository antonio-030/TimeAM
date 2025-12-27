/**
 * Subscription Management Service
 *
 * Business Logic für das Subscription-Management (Core-Modul).
 */

import Stripe from 'stripe';
import { getAdminFirestore } from '../firebase/index.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getTenantSubscriptions } from '../../modules/stripe/service.js';
import { getPricingPlans, getPricingAddons } from '../../modules/stripe/service.js';
import type {
  Subscription,
  PricingPlan,
  PricingAddon,
} from '../../modules/stripe/types.js';
import type {
  UpdateSubscriptionUserCountRequest,
  UpdateSubscriptionPlanRequest,
  AddSubscriptionAddonRequest,
  RemoveSubscriptionAddonRequest,
  ProratedAmountResponse,
  SubscriptionDetailsResponse,
} from './types.js';

// Stripe Client initialisieren
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn('⚠️ STRIPE_SECRET_KEY nicht gesetzt. Stripe-Funktionen werden nicht verfügbar sein.');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2025-12-15.clover',
}) : null;

/**
 * Lädt die aktive Subscription für einen Tenant mit Details.
 */
export async function getMySubscription(tenantId: string): Promise<SubscriptionDetailsResponse | null> {
  const db = getAdminFirestore();
  
  // Lade aktive Subscription
  const subscriptions = await getTenantSubscriptions(tenantId);
  const activeSubscription = subscriptions.find(sub => sub.status === 'active');
  
  if (!activeSubscription) {
    return null;
  }
  
  // Lade Plan und Addons
  const plans = await getPricingPlans();
  const addons = await getPricingAddons();
  
  const plan = plans.find(p => p.id === activeSubscription.planId);
  if (!plan) {
    throw new Error(`Plan ${activeSubscription.planId} nicht gefunden`);
  }
  
  const subscriptionAddons = addons.filter(a => activeSubscription.addonIds.includes(a.id));
  
  // Zähle aktuelle Mitglieder (ACTIVE oder PENDING - Großbuchstaben!)
  console.log(`\n📊 ========== MITGLIEDER ZÄHLEN ==========`);
  console.log(`📊 Tenant ID: ${tenantId}`);
  
  const membersSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .get();
  
  // Filtere manuell, da Firestore 'in' Queries case-sensitive sind
  const allMembers = membersSnapshot.docs.map(doc => doc.data());
  const activeOrPendingMembers = allMembers.filter(m => 
    m.status === 'ACTIVE' || m.status === 'active' || 
    m.status === 'PENDING' || m.status === 'pending'
  );
  
  const currentMemberCount = activeOrPendingMembers.length;
  const maxUserCount = activeSubscription.userCount;
  const canAddMoreMembers = currentMemberCount < maxUserCount;
  
  console.log(`📊 Gesamt Mitglieder: ${allMembers.length}`);
  console.log(`📊 Aktive/Pending Mitglieder: ${currentMemberCount}`);
  console.log(`📊 Max. Nutzeranzahl: ${maxUserCount}`);
  console.log(`📊 Kann weitere Nutzer hinzufügen: ${canAddMoreMembers ? '✅ JA' : '❌ NEIN'}`);
  console.log(`📊 ========== ZÄHLUNG ABGESCHLOSSEN ==========\n`);
  
  return {
    subscription: activeSubscription,
    plan,
    addons: subscriptionAddons,
    currentMemberCount,
    canAddMoreMembers,
  };
}

/**
 * Berechnet anteiligen Betrag für eine Änderung.
 */
export function calculateProratedAmount(
  currentUserCount: number,
  newUserCount: number,
  pricePerUser: number, // in Cent
  currentPeriodStart: Timestamp | string,
  currentPeriodEnd: Timestamp | string,
  billingCycle: 'monthly' | 'yearly'
): ProratedAmountResponse {
  // Konvertiere Timestamps zu Date-Objekten
  const periodStart = currentPeriodStart instanceof Timestamp
    ? currentPeriodStart.toDate()
    : new Date(currentPeriodStart);
  const periodEnd = currentPeriodEnd instanceof Timestamp
    ? currentPeriodEnd.toDate()
    : new Date(currentPeriodEnd);
  
  const now = new Date();
  
  // Berechne verbleibende Tage
  const totalDaysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysRemaining <= 0) {
    // Periode ist bereits abgelaufen, keine anteilige Berechnung
    const userDifference = newUserCount - currentUserCount;
    const nextPeriodAmount = pricePerUser * newUserCount;
    
    return {
      proratedAmount: 0,
      immediateCharge: 0,
      nextPeriodAmount,
      daysRemaining: 0,
      totalDaysInPeriod,
    };
  }
  
  // Berechne anteiligen Betrag für die Differenz
  const userDifference = newUserCount - currentUserCount;
  const proratedAmountPerUser = (pricePerUser * daysRemaining) / totalDaysInPeriod;
  const proratedAmount = Math.round(proratedAmountPerUser * userDifference);
  
  // Nächste reguläre Zahlung
  const nextPeriodAmount = pricePerUser * newUserCount;
  
  return {
    proratedAmount,
    immediateCharge: proratedAmount, // Sofortige Zahlung = anteiliger Betrag
    nextPeriodAmount,
    daysRemaining,
    totalDaysInPeriod,
  };
}

/**
 * Aktualisiert die Nutzeranzahl einer Subscription mit anteiliger Berechnung.
 */
export async function updateSubscriptionUserCount(
  tenantId: string,
  subscriptionId: string,
  request: UpdateSubscriptionUserCountRequest
): Promise<{ subscription: Subscription; proratedAmount: ProratedAmountResponse }> {
  console.log(`\n👥 ========== NUTZERANZAHL AKTUALISIEREN ==========`);
  console.log(`👥 Tenant ID: ${tenantId}`);
  console.log(`👥 Subscription ID: ${subscriptionId}`);
  console.log(`👥 Neue Nutzeranzahl: ${request.newUserCount}`);
  
  const db = getAdminFirestore();
  const subscriptionRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('subscriptions')
    .doc(subscriptionId);
  
  const subscriptionSnap = await subscriptionRef.get();
  if (!subscriptionSnap.exists) {
    throw new Error(`Subscription ${subscriptionId} nicht gefunden`);
  }
  
  const subscription = {
    id: subscriptionSnap.id,
    ...(subscriptionSnap.data() as Omit<Subscription, 'id'>),
  };
  
  if (subscription.status !== 'active') {
    throw new Error('Subscription ist nicht aktiv');
  }
  
  console.log(`📊 Subscription Details:`, {
    stripeSubscriptionId: subscription.stripeSubscriptionId || 'FEHLT',
    stripeCustomerId: subscription.stripeCustomerId || 'FEHLT',
    status: subscription.status,
  });
  
  // Wenn keine Stripe Subscription ID vorhanden, nur Firestore aktualisieren
  if (!subscription.stripeSubscriptionId) {
    console.warn('⚠️ Keine Stripe Subscription ID vorhanden - nur Firestore wird aktualisiert');
    console.log('💡 Tipp: Die Subscription wurde möglicherweise manuell erstellt. Für vollständige Stripe-Integration sollte eine neue Subscription über Stripe Checkout erstellt werden.');
  }
  
  // Lade Plan für Preisberechnung
  const plans = await getPricingPlans();
  const plan = plans.find(p => p.id === subscription.planId);
  if (!plan) {
    throw new Error(`Plan ${subscription.planId} nicht gefunden`);
  }
  
  const isYearly = subscription.billingCycle === 'yearly';
  const pricePerUser = isYearly && plan.pricePerUserYearly
    ? plan.pricePerUserYearly
    : plan.pricePerUser;
  
  // Berechne anteiligen Betrag
  const proratedAmount = calculateProratedAmount(
    subscription.userCount,
    request.newUserCount,
    pricePerUser,
    subscription.currentPeriodStart,
    subscription.currentPeriodEnd,
    subscription.billingCycle
  );
  
  // Aktualisiere Stripe Subscription (falls Stripe konfiguriert ist und Subscription ID vorhanden)
  if (stripe && subscription.stripeSubscriptionId) {
    console.log(`💳 Stripe Subscription ID gefunden: ${subscription.stripeSubscriptionId}`);
    try {
      console.log(`🔄 Lade Stripe Subscription...`);
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      console.log(`✅ Stripe Subscription geladen: ${stripeSubscription.id}`);
      console.log(`📊 Aktuelle Quantity in Stripe: ${stripeSubscription.items.data[0]?.quantity || 'unbekannt'}`);
      
      // Finde das Haupt-Subscription-Item (Plan)
      const planItem = stripeSubscription.items.data.find(item => 
        item.price.recurring && item.price.metadata?.type === 'plan'
      ) || stripeSubscription.items.data[0];
      
      if (planItem) {
        console.log(`🔄 Aktualisiere Stripe Subscription Quantity: ${planItem.quantity} → ${request.newUserCount}`);
        // Aktualisiere Quantity mit anteiliger Berechnung
        const updatedSubscription = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [{
            id: planItem.id,
            quantity: request.newUserCount,
          }],
          proration_behavior: 'always_invoice', // Sofortige anteilige Rechnung
        });
        console.log(`✅ Stripe Subscription aktualisiert: ${updatedSubscription.id}`);
        console.log(`📊 Neue Quantity in Stripe: ${updatedSubscription.items.data[0]?.quantity || 'unbekannt'}`);
        
        // Erstelle sofortige Invoice für anteiligen Betrag
        if (proratedAmount.immediateCharge > 0) {
          console.log(`💰 Erstelle anteilige Invoice: ${proratedAmount.immediateCharge / 100} €`);
          const invoice = await stripe.invoices.create({
            customer: subscription.stripeCustomerId || stripeSubscription.customer as string,
            subscription: subscription.stripeSubscriptionId,
            auto_advance: true, // Automatisch bezahlen
          });
          
          console.log(`✅ Anteilige Invoice erstellt: ${invoice.id}`);
          console.log(`💰 Invoice Betrag: ${invoice.amount_due / 100} €`);
          console.log(`📄 Invoice Status: ${invoice.status}`);
        } else {
          console.log(`ℹ️ Keine sofortige Zahlung erforderlich (anteiliger Betrag: 0)`);
        }
      } else {
        console.warn(`⚠️ Kein Subscription-Item gefunden in Stripe`);
      }
    } catch (stripeError) {
      console.error(`❌ Fehler beim Aktualisieren der Stripe Subscription:`, stripeError);
      // Weiter mit Firestore-Update, auch wenn Stripe fehlschlägt
    }
  } else {
    if (!stripe) {
      console.warn('⚠️ Stripe nicht konfiguriert (STRIPE_SECRET_KEY fehlt)');
    }
    if (!subscription.stripeSubscriptionId) {
      console.warn('⚠️ Keine Stripe Subscription ID vorhanden');
    }
    console.warn('⚠️ Nur Firestore wird aktualisiert (keine Stripe-Synchronisation)');
  }
  
  // Aktualisiere Firestore
  console.log(`💾 Aktualisiere Firestore Subscription...`);
  await subscriptionRef.update({
    userCount: request.newUserCount,
    updatedAt: FieldValue.serverTimestamp() as Timestamp,
  });
  console.log(`✅ Firestore Subscription aktualisiert`);
  
  // Lade aktualisierte Subscription
  const updatedSnap = await subscriptionRef.get();
  const updatedSubscription = {
    id: updatedSnap.id,
    ...(updatedSnap.data() as Omit<Subscription, 'id'>),
  };
  
  console.log(`✅ Nutzeranzahl erfolgreich aktualisiert: ${subscription.userCount} → ${request.newUserCount}`);
  console.log(`👥 ========== AKTUALISIERUNG ABGESCHLOSSEN ==========\n`);
  
  return {
    subscription: updatedSubscription,
    proratedAmount,
  };
}

/**
 * Wechselt den Plan einer Subscription.
 */
export async function updateSubscriptionPlan(
  tenantId: string,
  subscriptionId: string,
  request: UpdateSubscriptionPlanRequest
): Promise<Subscription> {
  
  const db = getAdminFirestore();
  const subscriptionRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('subscriptions')
    .doc(subscriptionId);
  
  const subscriptionSnap = await subscriptionRef.get();
  if (!subscriptionSnap.exists) {
    throw new Error(`Subscription ${subscriptionId} nicht gefunden`);
  }
  
  const subscription = {
    id: subscriptionSnap.id,
    ...(subscriptionSnap.data() as Omit<Subscription, 'id'>),
  };
  
  if (subscription.status !== 'active') {
    throw new Error('Subscription ist nicht aktiv');
  }
  
  if (!subscription.stripeSubscriptionId) {
    throw new Error('Stripe Subscription ID fehlt');
  }
  
  // Prüfe ob neuer Plan existiert
  const plans = await getPricingPlans();
  const newPlan = plans.find(p => p.id === request.newPlanId);
  if (!newPlan) {
    throw new Error(`Plan ${request.newPlanId} nicht gefunden`);
  }
  
  // TODO: Stripe Subscription Update für Plan-Wechsel
  // Dies erfordert das Erstellen eines neuen Subscription-Items und das Entfernen des alten
  if (stripe && subscription.stripeSubscriptionId) {
    try {
      // TODO: Implementiere Plan-Wechsel in Stripe
      console.log(`⚠️ Plan-Wechsel in Stripe noch nicht implementiert für Subscription ${subscription.stripeSubscriptionId}`);
    } catch (stripeError) {
      console.warn('⚠️ Fehler beim Aktualisieren der Stripe Subscription:', stripeError);
    }
  }
  
  // Aktualisiere Firestore
  await subscriptionRef.update({
    planId: request.newPlanId,
    updatedAt: FieldValue.serverTimestamp() as Timestamp,
  });
  
  // Lade aktualisierte Subscription
  const updatedSnap = await subscriptionRef.get();
  return {
    id: updatedSnap.id,
    ...(updatedSnap.data() as Omit<Subscription, 'id'>),
  };
}

/**
 * Fügt ein Addon zu einer Subscription hinzu.
 */
export async function addSubscriptionAddon(
  tenantId: string,
  subscriptionId: string,
  request: AddSubscriptionAddonRequest
): Promise<Subscription> {
  
  const db = getAdminFirestore();
  const subscriptionRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('subscriptions')
    .doc(subscriptionId);
  
  const subscriptionSnap = await subscriptionRef.get();
  if (!subscriptionSnap.exists) {
    throw new Error(`Subscription ${subscriptionId} nicht gefunden`);
  }
  
  const subscription = {
    id: subscriptionSnap.id,
    ...(subscriptionSnap.data() as Omit<Subscription, 'id'>),
  };
  
  if (subscription.status !== 'active') {
    throw new Error('Subscription ist nicht aktiv');
  }
  
  if (subscription.addonIds.includes(request.addonId)) {
    throw new Error('Addon ist bereits aktiviert');
  }
  
  // Prüfe ob Addon existiert
  const addons = await getPricingAddons();
  const addon = addons.find(a => a.id === request.addonId);
  if (!addon) {
    throw new Error(`Addon ${request.addonId} nicht gefunden`);
  }
  
  // TODO: Stripe Subscription Update für Addon hinzufügen
  if (stripe && subscription.stripeSubscriptionId) {
    try {
      // TODO: Implementiere Addon hinzufügen in Stripe
      console.log(`⚠️ Addon hinzufügen in Stripe noch nicht implementiert für Subscription ${subscription.stripeSubscriptionId}`);
    } catch (stripeError) {
      console.warn('⚠️ Fehler beim Hinzufügen des Addons in Stripe:', stripeError);
    }
  }
  
  // Aktualisiere Firestore
  const updatedAddonIds = [...subscription.addonIds, request.addonId];
  await subscriptionRef.update({
    addonIds: updatedAddonIds,
    updatedAt: FieldValue.serverTimestamp() as Timestamp,
  });
  
  // Lade aktualisierte Subscription
  const updatedSnap = await subscriptionRef.get();
  return {
    id: updatedSnap.id,
    ...(updatedSnap.data() as Omit<Subscription, 'id'>),
  };
}

/**
 * Entfernt ein Addon von einer Subscription.
 */
export async function removeSubscriptionAddon(
  tenantId: string,
  subscriptionId: string,
  request: RemoveSubscriptionAddonRequest
): Promise<Subscription> {
  
  const db = getAdminFirestore();
  const subscriptionRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('subscriptions')
    .doc(subscriptionId);
  
  const subscriptionSnap = await subscriptionRef.get();
  if (!subscriptionSnap.exists) {
    throw new Error(`Subscription ${subscriptionId} nicht gefunden`);
  }
  
  const subscription = {
    id: subscriptionSnap.id,
    ...(subscriptionSnap.data() as Omit<Subscription, 'id'>),
  };
  
  if (subscription.status !== 'active') {
    throw new Error('Subscription ist nicht aktiv');
  }
  
  if (!subscription.addonIds.includes(request.addonId)) {
    throw new Error('Addon ist nicht aktiviert');
  }
  
  // TODO: Stripe Subscription Update für Addon entfernen
  if (stripe && subscription.stripeSubscriptionId) {
    try {
      // TODO: Implementiere Addon entfernen in Stripe
      console.log(`⚠️ Addon entfernen in Stripe noch nicht implementiert für Subscription ${subscription.stripeSubscriptionId}`);
    } catch (stripeError) {
      console.warn('⚠️ Fehler beim Entfernen des Addons in Stripe:', stripeError);
    }
  }
  
  // Aktualisiere Firestore
  const updatedAddonIds = subscription.addonIds.filter(id => id !== request.addonId);
  await subscriptionRef.update({
    addonIds: updatedAddonIds,
    updatedAt: FieldValue.serverTimestamp() as Timestamp,
  });
  
  // Lade aktualisierte Subscription
  const updatedSnap = await subscriptionRef.get();
  return {
    id: updatedSnap.id,
    ...(updatedSnap.data() as Omit<Subscription, 'id'>),
  };
}

