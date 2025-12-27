/**
 * Subscription Management Routes
 *
 * API-Endpunkte für das Subscription-Management (Core-Modul).
 */

import { Router } from 'express';
import { requireAuth } from '../auth/express-middleware.js';
import { requireTenantOnly } from '../entitlements/middleware.js';
import type { TenantRequest } from '../entitlements/middleware.js';
import type { AuthenticatedRequest } from '../auth/express-middleware.js';
import {
  getMySubscription,
  updateSubscriptionUserCount,
  updateSubscriptionPlan,
  addSubscriptionAddon,
  removeSubscriptionAddon,
} from './service.js';
import type {
  UpdateSubscriptionUserCountRequest,
  UpdateSubscriptionPlanRequest,
  AddSubscriptionAddonRequest,
  RemoveSubscriptionAddonRequest,
} from './types.js';

const router = Router();

// Alle Routes erfordern Auth + Tenant-Membership
const tenantGuard = [
  requireAuth,
  requireTenantOnly(),
];

/**
 * GET /api/subscription-management/my-subscription
 * Lädt die aktive Subscription für den aktuellen Tenant.
 */
router.get('/my-subscription', ...tenantGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    if (!tenant) {
      res.status(400).json({ error: 'Kein Tenant gefunden' });
      return;
    }
    
    const subscriptionDetails = await getMySubscription(tenant.id);
    
    if (!subscriptionDetails) {
      res.status(404).json({ error: 'Keine aktive Subscription gefunden' });
      return;
    }
    
    res.json(subscriptionDetails);
  } catch (error) {
    console.error('Error in GET /subscription-management/my-subscription:', error);
    const message = error instanceof Error ? error.message : 'Failed to get subscription';
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/subscription-management/my-subscription/user-count
 * Aktualisiert die Nutzeranzahl der aktiven Subscription.
 */
router.patch('/my-subscription/user-count', ...tenantGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    console.log(`\n📡 ========== API: NUTZERANZAHL AKTUALISIEREN ==========`);
    console.log(`📡 Tenant ID: ${tenant?.id}`);
    console.log(`📡 Request Body:`, req.body);
    
    if (!tenant) {
      console.error('❌ Kein Tenant gefunden');
      res.status(400).json({ error: 'Kein Tenant gefunden' });
      return;
    }
    
    const request = req.body as UpdateSubscriptionUserCountRequest;
    console.log(`📡 Neue Nutzeranzahl: ${request.newUserCount}`);
    
    if (!request.newUserCount || request.newUserCount < 1) {
      console.error('❌ Ungültige Nutzeranzahl:', request.newUserCount);
      res.status(400).json({ error: 'newUserCount muss mindestens 1 sein' });
      return;
    }
    
    // Lade aktive Subscription
    console.log(`🔄 Lade aktive Subscription für Tenant ${tenant.id}...`);
    const subscriptionDetails = await getMySubscription(tenant.id);
    if (!subscriptionDetails) {
      console.error('❌ Keine aktive Subscription gefunden');
      res.status(404).json({ error: 'Keine aktive Subscription gefunden' });
      return;
    }
    
    console.log(`✅ Subscription gefunden:`, {
      subscriptionId: subscriptionDetails.subscription.id,
      currentUserCount: subscriptionDetails.subscription.userCount,
      newUserCount: request.newUserCount,
    });
    
    console.log(`🔄 Starte Update...`);
    const result = await updateSubscriptionUserCount(
      tenant.id,
      subscriptionDetails.subscription.id,
      request
    );
    
    console.log(`✅ Update erfolgreich abgeschlossen`);
    console.log(`📡 ========== API: UPDATE ABGESCHLOSSEN ==========\n`);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error in PATCH /subscription-management/my-subscription/user-count:', error);
    const message = error instanceof Error ? error.message : 'Failed to update user count';
    console.error('❌ Fehlermeldung:', message);
    console.error('❌ Stack:', error instanceof Error ? error.stack : 'Kein Stack verfügbar');
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/subscription-management/my-subscription/plan
 * Wechselt den Plan der aktiven Subscription.
 */
router.patch('/my-subscription/plan', ...tenantGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    if (!tenant) {
      res.status(400).json({ error: 'Kein Tenant gefunden' });
      return;
    }
    
    const request = req.body as UpdateSubscriptionPlanRequest;
    
    if (!request.newPlanId) {
      res.status(400).json({ error: 'newPlanId ist erforderlich' });
      return;
    }
    
    // Lade aktive Subscription
    const subscriptionDetails = await getMySubscription(tenant.id);
    if (!subscriptionDetails) {
      res.status(404).json({ error: 'Keine aktive Subscription gefunden' });
      return;
    }
    
    const subscription = await updateSubscriptionPlan(
      tenant.id,
      subscriptionDetails.subscription.id,
      request
    );
    
    res.json({ subscription });
  } catch (error) {
    console.error('Error in PATCH /subscription-management/my-subscription/plan:', error);
    const message = error instanceof Error ? error.message : 'Failed to update plan';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/subscription-management/my-subscription/addons
 * Fügt ein Addon zur aktiven Subscription hinzu.
 */
router.post('/my-subscription/addons', ...tenantGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    if (!tenant) {
      res.status(400).json({ error: 'Kein Tenant gefunden' });
      return;
    }
    
    const request = req.body as AddSubscriptionAddonRequest;
    
    if (!request.addonId) {
      res.status(400).json({ error: 'addonId ist erforderlich' });
      return;
    }
    
    // Lade aktive Subscription
    const subscriptionDetails = await getMySubscription(tenant.id);
    if (!subscriptionDetails) {
      res.status(404).json({ error: 'Keine aktive Subscription gefunden' });
      return;
    }
    
    const subscription = await addSubscriptionAddon(
      tenant.id,
      subscriptionDetails.subscription.id,
      request
    );
    
    res.json({ subscription });
  } catch (error) {
    console.error('Error in POST /subscription-management/my-subscription/addons:', error);
    const message = error instanceof Error ? error.message : 'Failed to add addon';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/subscription-management/my-subscription/addons/:addonId
 * Entfernt ein Addon von der aktiven Subscription.
 */
router.delete('/my-subscription/addons/:addonId', ...tenantGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  try {
    if (!tenant) {
      res.status(400).json({ error: 'Kein Tenant gefunden' });
      return;
    }
    
    const { addonId } = req.params;
    
    if (!addonId) {
      res.status(400).json({ error: 'addonId ist erforderlich' });
      return;
    }
    
    // Lade aktive Subscription
    const subscriptionDetails = await getMySubscription(tenant.id);
    if (!subscriptionDetails) {
      res.status(404).json({ error: 'Keine aktive Subscription gefunden' });
      return;
    }
    
    const subscription = await removeSubscriptionAddon(
      tenant.id,
      subscriptionDetails.subscription.id,
      { addonId }
    );
    
    res.json({ subscription });
  } catch (error) {
    console.error('Error in DELETE /subscription-management/my-subscription/addons/:addonId:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove addon';
    res.status(500).json({ error: message });
  }
});

export { router as subscriptionManagementRouter };

