/**
 * Stripe Module API
 *
 * API-Calls für das Stripe-Modul.
 */

import { apiGet, apiPost, apiPatch } from '../../core/api';

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

/**
 * Lädt alle Pricing Plans.
 */
export async function getPricingPlans(): Promise<PricingPlan[]> {
  const data = await apiGet<{ plans: PricingPlan[] }>(`${API_BASE}/pricing/plans`);
  return data.plans || [];
}

/**
 * Erstellt oder aktualisiert einen Pricing Plan.
 */
export async function upsertPricingPlan(request: UpsertPricingPlanRequest): Promise<PricingPlan> {
  const data = await apiPost<{ plan: PricingPlan }>(`${API_BASE}/pricing/plans`, request);
  return data.plan;
}

/**
 * Lädt alle Pricing Addons.
 */
export async function getPricingAddons(): Promise<PricingAddon[]> {
  const data = await apiGet<{ addons: PricingAddon[] }>(`${API_BASE}/pricing/addons`);
  return data.addons || [];
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
 */
export async function getTenantSubscriptions(tenantId: string): Promise<Subscription[]> {
  const data = await apiGet<{ subscriptions: Subscription[] }>(`${API_BASE}/subscriptions/${tenantId}`);
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

