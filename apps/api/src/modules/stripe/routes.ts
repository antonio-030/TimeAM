/**
 * Stripe Module Routes
 *
 * API-Endpunkte für die Stripe-Integration (Preise, Abonnements).
 */

import { Router, express } from 'express';
import { requireAuth } from '../../core/auth/express-middleware.js';
import { requireEntitlements } from '../../core/entitlements/middleware.js';
import { ENTITLEMENT_KEYS } from '@timeam/shared';
import type { TenantRequest } from '../../core/entitlements/middleware.js';
import {
  getPricingPlans,
  upsertPricingPlan,
  getPricingAddons,
  upsertPricingAddon,
  getTenantSubscriptions,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  createCheckoutSession,
  handleStripeWebhook,
} from './service.js';
import Stripe from 'stripe';
import type {
  UpsertPricingPlanRequest,
  UpsertPricingAddonRequest,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
} from './types.js';

const router = Router();

// Alle Routes erfordern Auth + Stripe-Entitlement + Super-Admin
const stripeGuard = [
  requireAuth,
  requireEntitlements([ENTITLEMENT_KEYS.MODULE_STRIPE]),
];

// =============================================================================
// Pricing Plans
// =============================================================================

/**
 * GET /api/stripe/pricing/plans
 * Lädt alle Pricing Plans.
 */
router.get('/pricing/plans', ...stripeGuard, async (req: TenantRequest, res) => {
  try {
    const plans = await getPricingPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Error in GET /stripe/pricing/plans:', error);
    const message = error instanceof Error ? error.message : 'Failed to get pricing plans';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/stripe/pricing/plans
 * Erstellt oder aktualisiert einen Pricing Plan.
 */
router.post('/pricing/plans', ...stripeGuard, async (req: TenantRequest, res) => {
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

// =============================================================================
// Pricing Addons
// =============================================================================

/**
 * GET /api/stripe/pricing/addons
 * Lädt alle Pricing Addons.
 */
router.get('/pricing/addons', ...stripeGuard, async (req: TenantRequest, res) => {
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
router.post('/pricing/addons', ...stripeGuard, async (req: TenantRequest, res) => {
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
router.get('/subscriptions/:tenantId', ...stripeGuard, async (req: TenantRequest, res) => {
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
 * POST /api/stripe/subscriptions
 * Erstellt eine neue Subscription.
 */
router.post('/subscriptions', ...stripeGuard, async (req: TenantRequest, res) => {
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
router.patch('/subscriptions/:tenantId/:subscriptionId', ...stripeGuard, async (req: TenantRequest, res) => {
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
router.post('/subscriptions/:tenantId/:subscriptionId/cancel', ...stripeGuard, async (req: TenantRequest, res) => {
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
 */
router.post('/checkout/create', ...stripeGuard, async (req: TenantRequest, res) => {
  try {
    const { tenantId, planId, addonIds, userCount, billingCycle, successUrl, cancelUrl } = req.body;
    
    if (!tenantId || !planId || !userCount || !billingCycle || !successUrl || !cancelUrl) {
      res.status(400).json({ error: 'Fehlende Pflichtfelder: tenantId, planId, userCount, billingCycle, successUrl, cancelUrl' });
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
    apiVersion: '2024-11-20.acacia',
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

export { router as stripeRouter };

