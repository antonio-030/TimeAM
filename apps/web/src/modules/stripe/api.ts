/**
 * Stripe Module API
 *
 * API-Calls für das Stripe-Modul.
 */

import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '../../core/api';

const API_BASE = '/api/stripe';

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  pricePerUser: number; // in Cent
  minimumPrice: number; // in Cent
  pricePerUserYearly?: number;
  minimumPriceYearly?: number;
  includedModules: string[];
  features: string[];
  targetGroup?: string;
}

export interface PricingAddon {
  id: string;
  moduleId: string;
  name: string;
  description: string;
  pricePerUser: number; // in Cent
  minimumPrice: number; // in Cent
  pricePerUserYearly?: number;
  minimumPriceYearly?: number;
  icon?: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  addonIds: string[];
  userCount: number;
  billingCycle: 'monthly' | 'yearly';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
}

export interface TransactionLog {
  id: string;
  tenantId: string;
  eventType: 'subscription_created' | 'subscription_updated' | 'subscription_canceled' | 'payment_succeeded' | 'payment_failed' | 'checkout_completed';
  subscriptionId?: string;
  planId?: string;
  addonIds?: string[];
  userCount?: number;
  billingCycle?: 'monthly' | 'yearly';
  amount?: number; // in Cent
  currency?: string;
  stripeSessionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeEventId?: string;
  status?: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface UpsertPricingPlanRequest {
  id: string;
  name: string;
  description: string;
  pricePerUser: number;
  minimumPrice: number;
  pricePerUserYearly?: number;
  minimumPriceYearly?: number;
  includedModules: string[];
  features: string[];
  targetGroup?: string;
}

export interface UpsertPricingAddonRequest {
  id: string;
  moduleId: string;
  name: string;
  description: string;
  pricePerUser: number;
  minimumPrice: number;
  pricePerUserYearly?: number;
  minimumPriceYearly?: number;
  icon?: string;
}

export interface CreateSubscriptionRequest {
  tenantId: string;
  planId: string;
  addonIds?: string[];
  userCount: number;
  billingCycle: 'monthly' | 'yearly';
}

export interface UpdateSubscriptionRequest {
  planId?: string;
  addonIds?: string[];
  userCount?: number;
  billingCycle?: 'monthly' | 'yearly';
  cancelAtPeriodEnd?: boolean;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface StripeConfig {
  publishableKey: string;
  webhookSecret?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateStripeConfigRequest {
  publishableKey: string;
  webhookSecret?: string;
}

export interface ModuleStatusItem {
  id: string;
  displayName: string;
  description: string;
  icon: string;
  category: 'core' | 'optional';
  isActive: boolean;
  canToggle: boolean;
}

export interface ModuleStatusResponse {
  modules: ModuleStatusItem[];
}

/**
 * Lädt die Stripe-Konfiguration.
 */
export async function getStripeConfig(): Promise<StripeConfig | null> {
  const data = await apiGet<{ config: StripeConfig | null }>(`${API_BASE}/config`);
  return data.config;
}

/**
 * Aktualisiert die Stripe-Konfiguration.
 */
export async function updateStripeConfig(request: UpdateStripeConfigRequest): Promise<StripeConfig> {
  const data = await apiPut<{ config: StripeConfig }>(`${API_BASE}/config`, request);
  return data.config;
}

/**
 * Validiert die Stripe-Konfiguration.
 */
export async function validateStripeConfig(): Promise<{ valid: boolean; message?: string }> {
  return await apiPost<{ valid: boolean; message?: string }>(`${API_BASE}/config/validate`, {});
}

/**
 * Lädt den Status aller Module für den aktuellen Tenant.
 */
export async function getModuleStatus(): Promise<ModuleStatusItem[]> {
  const data = await apiGet<ModuleStatusResponse>('/api/settings/modules');
  return data.modules || [];
}

/**
 * Lädt alle Pricing Plans.
 * Verwendet public endpoint, damit es auch ohne Auth funktioniert (für PricingPage).
 */
export async function getPricingPlans(): Promise<PricingPlan[]> {
  try {
    // Versuche zuerst den public endpoint (für PricingPage ohne Auth)
    const data = await apiGet<{ plans: PricingPlan[] }>(`${API_BASE}/public/pricing/plans`);
    return data.plans || [];
  } catch (err) {
    // Fallback auf protected endpoint (für StripePage mit Auth)
    const data = await apiGet<{ plans: PricingPlan[] }>(`${API_BASE}/pricing/plans`);
    return data.plans || [];
  }
}

/**
 * Erstellt oder aktualisiert einen Pricing Plan.
 */
export async function upsertPricingPlan(request: UpsertPricingPlanRequest): Promise<PricingPlan> {
  const data = await apiPost<{ plan: PricingPlan }>(`${API_BASE}/pricing/plans`, request);
  return data.plan;
}

/**
 * Löscht einen Pricing Plan.
 */
export async function deletePricingPlan(planId: string): Promise<void> {
  await apiDelete<{ success: boolean; message: string }>(`${API_BASE}/pricing/plans/${planId}`);
}

/**
 * Lädt alle Pricing Addons.
 * Verwendet public endpoint, damit es auch ohne Auth funktioniert (für PricingPage).
 */
export async function getPricingAddons(): Promise<PricingAddon[]> {
  try {
    // Versuche zuerst den public endpoint (für PricingPage ohne Auth)
    const data = await apiGet<{ addons: PricingAddon[] }>(`${API_BASE}/public/pricing/addons`);
    return data.addons || [];
  } catch (err) {
    // Fallback auf protected endpoint (für StripePage mit Auth)
    const data = await apiGet<{ addons: PricingAddon[] }>(`${API_BASE}/pricing/addons`);
    return data.addons || [];
  }
}

/**
 * Erstellt oder aktualisiert ein Pricing Addon.
 */
export async function upsertPricingAddon(request: UpsertPricingAddonRequest): Promise<PricingAddon> {
  const data = await apiPost<{ addon: PricingAddon }>(`${API_BASE}/pricing/addons`, request);
  return data.addon;
}

/**
 * Lädt alle Subscriptions für einen Tenant.
 * Erfordert Stripe-Entitlement (für Admin-Zugriff).
 */
export async function getTenantSubscriptions(tenantId: string): Promise<Subscription[]> {
  const data = await apiGet<{ subscriptions: Subscription[] }>(`${API_BASE}/subscriptions/${tenantId}`);
  return data.subscriptions || [];
}

/**
 * Lädt die aktive Subscription für den aktuellen Tenant des Users.
 * Erfordert nur Auth + Tenant-Membership (für normale User).
 */
export async function getMySubscription(): Promise<Subscription[]> {
  const data = await apiGet<{ subscriptions: Subscription[] }>(`${API_BASE}/my-subscription`);
  return data.subscriptions || [];
}

/**
 * Erstellt eine neue Subscription.
 */
export async function createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
  const data = await apiPost<{ subscription: Subscription }>(`${API_BASE}/subscriptions`, request);
  return data.subscription;
}

/**
 * Aktualisiert eine Subscription.
 */
export async function updateSubscription(
  tenantId: string,
  subscriptionId: string,
  request: UpdateSubscriptionRequest
): Promise<Subscription> {
  const data = await apiPatch<{ subscription: Subscription }>(`${API_BASE}/subscriptions/${tenantId}/${subscriptionId}`, request);
  return data.subscription;
}

/**
 * Kündigt eine Subscription.
 */
export async function cancelSubscription(tenantId: string, subscriptionId: string): Promise<Subscription> {
  const data = await apiPost<{ subscription: Subscription }>(`${API_BASE}/subscriptions/${tenantId}/${subscriptionId}/cancel`);
  return data.subscription;
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
): Promise<CheckoutSessionResponse> {
  return await apiPost<CheckoutSessionResponse>(`${API_BASE}/checkout/create`, {
    tenantId,
    planId,
    addonIds,
    userCount,
    billingCycle,
    successUrl,
    cancelUrl,
  });
}

/**
 * Lädt alle Transaktions-Logs (optional gefiltert nach Tenant).
 */
export async function getTransactionLogs(tenantId?: string): Promise<TransactionLog[]> {
  const url = tenantId 
    ? `${API_BASE}/transactions?tenantId=${encodeURIComponent(tenantId)}`
    : `${API_BASE}/transactions`;
  const data = await apiGet<{ transactions: TransactionLog[] }>(url);
  return data.transactions || [];
}

/**
 * Erstellt eine Subscription aus einer Stripe Checkout Session (Fallback, falls Webhook nicht ausgelöst wurde).
 */
export async function createSubscriptionFromSession(sessionId: string): Promise<{ subscription: Subscription; transactionLog: TransactionLog }> {
  return await apiPost<{ subscription: Subscription; transactionLog: TransactionLog }>(`${API_BASE}/subscriptions/from-session`, { sessionId });
}

