/**
 * Stripe Module Routes
 *
 * API-Endpunkte für die Stripe-Integration (Preise, Abonnements).
 */

import { Router } from 'express';
import { requireAuth } from '../../core/auth/express-middleware.js';
import { requireEntitlements, requireTenantOnly } from '../../core/entitlements/middleware.js';
import { ENTITLEMENT_KEYS } from '@timeam/shared';
import type { TenantRequest } from '../../core/entitlements/middleware.js';
import type { AuthenticatedRequest } from '../../core/auth/express-middleware.js';
import { getAdminFirestore } from '../../core/firebase/admin.js';
import {
  getPricingPlans,
  upsertPricingPlan,
  deletePricingPlan,
  getPricingAddons,
  upsertPricingAddon,
  getTenantSubscriptions,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  createCheckoutSession,
  handleStripeWebhook,
  getStripeConfig,
  updateStripeConfig,
  validateStripeConfig,
  seedDefaultPlans,
  getTransactionLogs,
  createSubscriptionFromSession,
} from './service.js';
import Stripe from 'stripe';
import type {
  UpsertPricingPlanRequest,
  UpsertPricingAddonRequest,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  UpdateStripeConfigRequest,
} from './types.js';

const router = Router();

// Alle Routes erfordern Auth + Stripe-Entitlement + Super-Admin
const stripeGuard = [
  requireAuth,
  requireEntitlements([ENTITLEMENT_KEYS.MODULE_STRIPE]),
];

// Guard für normale User (nur Auth + Tenant-Membership)
const tenantGuard = [
  requireAuth,
  requireTenantOnly(),
];

// =============================================================================
// Public Routes (ohne Auth - für PricingPage)
// =============================================================================

/**
 * GET /api/stripe/public/pricing/plans
 * Lädt alle Pricing Plans (öffentlich, für PricingPage).
 */
router.get('/public/pricing/plans', async (req, res) => {
  try {
    // Stelle sicher, dass Standard-Plans vorhanden sind
    await seedDefaultPlans();
    const plans = await getPricingPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Error in GET /stripe/public/pricing/plans:', error);
    const message = error instanceof Error ? error.message : 'Failed to get pricing plans';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/stripe/public/pricing/addons
 * Lädt alle Pricing Addons (öffentlich, für PricingPage).
 */
router.get('/public/pricing/addons', async (req, res) => {
  try {
    const addons = await getPricingAddons();
    res.json({ addons });
  } catch (error) {
    console.error('Error in GET /stripe/public/pricing/addons:', error);
    const message = error instanceof Error ? error.message : 'Failed to get pricing addons';
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Stripe Configuration
// =============================================================================

/**
 * GET /api/stripe/config
 * Lädt die Stripe-Konfiguration.
 */
router.get('/config', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const config = await getStripeConfig();
    
    if (!config) {
      res.json({ config: null });
      return;
    }
    
    res.json({ config });
  } catch (error) {
    console.error('Error in GET /stripe/config:', error);
    const message = error instanceof Error ? error.message : 'Failed to get stripe config';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/stripe/config
 * Aktualisiert die Stripe-Konfiguration (nur Publishable Key).
 */
router.put('/config', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const request = req.body as UpdateStripeConfigRequest;
    
    if (!request.publishableKey) {
      res.status(400).json({ error: 'publishableKey ist erforderlich' });
      return;
    }
    
    // Validiere Format
    if (!request.publishableKey.startsWith('pk_')) {
      res.status(400).json({ error: 'Ungültiges Format für Publishable Key (muss mit pk_ beginnen)' });
      return;
    }
    
    const config = await updateStripeConfig(request);
    res.json({ config });
  } catch (error) {
    console.error('Error in PUT /stripe/config:', error);
    const message = error instanceof Error ? error.message : 'Failed to update stripe config';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/stripe/config/validate
 * Validiert die Stripe-Konfiguration.
 */
router.post('/config/validate', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const validation = await validateStripeConfig();
    res.json(validation);
  } catch (error) {
    console.error('Error in POST /stripe/config/validate:', error);
    const message = error instanceof Error ? error.message : 'Failed to validate stripe config';
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Pricing Plans
// =============================================================================

/**
 * GET /api/stripe/pricing/plans
 * Lädt alle Pricing Plans.
 */
router.get('/pricing/plans', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    // Stelle sicher, dass Standard-Plans vorhanden sind
    await seedDefaultPlans();
    const plans = await getPricingPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Error in GET /stripe/pricing/plans:', error);
    const message = error instanceof Error ? error.message : 'Failed to get pricing plans';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/stripe/pricing/plans/seed
 * Erstellt Standard-Plans (falls noch keine vorhanden sind).
 */
router.post('/pricing/plans/seed', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    await seedDefaultPlans();
    const plans = await getPricingPlans();
    res.json({ plans, message: 'Standard-Plans erstellt' });
  } catch (error) {
    console.error('Error in POST /stripe/pricing/plans/seed:', error);
    const message = error instanceof Error ? error.message : 'Failed to seed default plans';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/stripe/pricing/plans
 * Erstellt oder aktualisiert einen Pricing Plan.
 */
router.post('/pricing/plans', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const request = req.body as UpsertPricingPlanRequest;
    
    if (!request.id || !request.name || !request.pricePerUser || !request.minimumPrice) {
      res.status(400).json({ error: 'Fehlende Pflichtfelder: id, name, pricePerUser, minimumPrice' });
      return;
    }
    
    const plan = await upsertPricingPlan(request);
    res.json({ plan });
  } catch (error) {
    console.error('Error in POST /stripe/pricing/plans:', error);
    const message = error instanceof Error ? error.message : 'Failed to upsert pricing plan';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/stripe/pricing/plans/:planId
 * Löscht einen Pricing Plan.
 */
router.delete('/pricing/plans/:planId', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const { planId } = req.params;
    
    if (!planId) {
      res.status(400).json({ error: 'planId ist erforderlich' });
      return;
    }
    
    await deletePricingPlan(planId);
    res.json({ success: true, message: `Plan ${planId} wurde gelöscht` });
  } catch (error) {
    console.error('Error in DELETE /stripe/pricing/plans/:planId:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete pricing plan';
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Pricing Addons
// =============================================================================

/**
 * GET /api/stripe/pricing/addons
 * Lädt alle Pricing Addons.
 */
router.get('/pricing/addons', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const addons = await getPricingAddons();
    res.json({ addons });
  } catch (error) {
    console.error('Error in GET /stripe/pricing/addons:', error);
    const message = error instanceof Error ? error.message : 'Failed to get pricing addons';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/stripe/pricing/addons
 * Erstellt oder aktualisiert ein Pricing Addon.
 */
router.post('/pricing/addons', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const request = req.body as UpsertPricingAddonRequest;
    
    if (!request.id || !request.moduleId || !request.name || !request.pricePerUser || !request.minimumPrice) {
      res.status(400).json({ error: 'Fehlende Pflichtfelder: id, moduleId, name, pricePerUser, minimumPrice' });
      return;
    }
    
    const addon = await upsertPricingAddon(request);
    res.json({ addon });
  } catch (error) {
    console.error('Error in POST /stripe/pricing/addons:', error);
    const message = error instanceof Error ? error.message : 'Failed to upsert pricing addon';
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Subscriptions
// =============================================================================

/**
 * GET /api/stripe/subscriptions/:tenantId
 * Lädt alle Subscriptions für einen Tenant.
 */
router.get('/subscriptions/:tenantId', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId ist erforderlich' });
      return;
    }
    
    const subscriptions = await getTenantSubscriptions(tenantId);
    res.json({ subscriptions });
  } catch (error) {
    console.error('Error in GET /stripe/subscriptions/:tenantId:', error);
    const message = error instanceof Error ? error.message : 'Failed to get subscriptions';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/stripe/my-subscription
 * Lädt die aktive Subscription für den aktuellen Tenant des Users.
 * Erfordert nur Auth + Tenant-Membership (für normale User).
 */
router.get('/my-subscription', ...tenantGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    if (!tenant) {
      res.status(400).json({ error: 'Kein Tenant gefunden' });
      return;
    }
    
    const subscriptions = await getTenantSubscriptions(tenant.id);
    // Nur aktive Subscriptions zurückgeben
    const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active');
    res.json({ subscriptions: activeSubscriptions });
  } catch (error) {
    console.error('Error in GET /stripe/my-subscription:', error);
    const message = error instanceof Error ? error.message : 'Failed to get subscription';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/stripe/subscriptions
 * Erstellt eine neue Subscription.
 */
router.post('/subscriptions', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const request = req.body as CreateSubscriptionRequest;
    
    if (!request.tenantId || !request.planId || !request.userCount || !request.billingCycle) {
      res.status(400).json({ error: 'Fehlende Pflichtfelder: tenantId, planId, userCount, billingCycle' });
      return;
    }
    
    const subscription = await createSubscription(request);
    res.json({ subscription });
  } catch (error) {
    console.error('Error in POST /stripe/subscriptions:', error);
    const message = error instanceof Error ? error.message : 'Failed to create subscription';
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/stripe/subscriptions/:tenantId/:subscriptionId
 * Aktualisiert eine Subscription.
 */
router.patch('/subscriptions/:tenantId/:subscriptionId', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const { tenantId, subscriptionId } = req.params;
    const request = req.body as UpdateSubscriptionRequest;
    
    if (!tenantId || !subscriptionId) {
      res.status(400).json({ error: 'tenantId und subscriptionId sind erforderlich' });
      return;
    }
    
    const subscription = await updateSubscription(tenantId, subscriptionId, request);
    res.json({ subscription });
  } catch (error) {
    console.error('Error in PATCH /stripe/subscriptions/:tenantId/:subscriptionId:', error);
    const message = error instanceof Error ? error.message : 'Failed to update subscription';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/stripe/subscriptions/:tenantId/:subscriptionId/cancel
 * Kündigt eine Subscription.
 */
router.post('/subscriptions/:tenantId/:subscriptionId/cancel', ...stripeGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    const { tenantId, subscriptionId } = req.params;
    
    if (!tenantId || !subscriptionId) {
      res.status(400).json({ error: 'tenantId und subscriptionId sind erforderlich' });
      return;
    }
    
    const subscription = await cancelSubscription(tenantId, subscriptionId);
    res.json({ subscription });
  } catch (error) {
    console.error('Error in POST /stripe/subscriptions/:tenantId/:subscriptionId/cancel:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel subscription';
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Checkout
// =============================================================================

/**
 * POST /api/stripe/checkout/create
 * Erstellt eine Stripe Checkout Session.
 * 
 * WICHTIG: Dieser Endpoint erfordert nur Auth, NICHT das Stripe-Entitlement,
 * damit normale User Checkout-Sessions erstellen können, um zu zahlen.
 */
router.post('/checkout/create', requireAuth, async (req, res) => {
  try {
    const { tenantId, planId, addonIds, userCount, billingCycle, successUrl, cancelUrl } = req.body;
    const { user } = req as AuthenticatedRequest;
    
    if (!tenantId || !planId || !userCount || !billingCycle || !successUrl || !cancelUrl) {
      res.status(400).json({ error: 'Fehlende Pflichtfelder: tenantId, planId, userCount, billingCycle, successUrl, cancelUrl' });
      return;
    }
    
    // Prüfe, ob der User Zugriff auf den Tenant hat
    const db = getAdminFirestore();
    const memberRef = db
      .collection('tenants')
      .doc(tenantId)
      .collection('members')
      .doc(user.uid);
    const memberSnap = await memberRef.get();
    
    if (!memberSnap.exists) {
      res.status(403).json({ error: 'No tenant membership' });
      return;
    }
    
    const session = await createCheckoutSession(
      tenantId,
      planId,
      addonIds || [],
      userCount,
      billingCycle,
      successUrl,
      cancelUrl
    );
    
    res.json(session);
  } catch (error) {
    console.error('Error in POST /stripe/checkout/create:', error);
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Webhooks
// =============================================================================

/**
 * POST /api/stripe/webhooks
 * Stripe Webhook Handler (ohne Auth, da von Stripe aufgerufen).
 */
router.post('/webhooks', async (req, res) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!stripeSecretKey || !webhookSecret) {
    res.status(500).json({ error: 'Stripe nicht konfiguriert' });
    return;
  }
  
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-12-15.clover',
  });
  
  const sig = req.headers['stripe-signature'];
  
  if (!sig) {
    res.status(400).json({ error: 'Fehlende Stripe-Signatur' });
    return;
  }
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).json({ error: 'Ungültige Webhook-Signatur' });
    return;
  }
  
  try {
    await handleStripeWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Fehler beim Verarbeiten des Webhooks' });
  }
});

/**
 * GET /api/stripe/transactions
 * Lädt alle Transaktions-Logs (optional gefiltert nach Tenant).
 */
router.get('/transactions', ...stripeGuard, async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const logs = await getTransactionLogs(tenantId);
    res.json({ transactions: logs });
  } catch (error) {
    console.error('Error in GET /stripe/transactions:', error);
    const message = error instanceof Error ? error.message : 'Failed to get transaction logs';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/stripe/subscriptions/from-session
 * Erstellt eine Subscription aus einer Stripe Checkout Session (Fallback, falls Webhook nicht ausgelöst wurde).
 */
router.post('/subscriptions/from-session', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId ist erforderlich' });
      return;
    }
    
    const result = await createSubscriptionFromSession(sessionId);
    res.json(result);
  } catch (error) {
    console.error('Error in POST /stripe/subscriptions/from-session:', error);
    const message = error instanceof Error ? error.message : 'Failed to create subscription from session';
    res.status(500).json({ error: message });
  }
});

export { router as stripeRouter };

