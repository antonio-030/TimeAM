/**
 * Stripe Module Types
 *
 * Types für die Stripe-Integration (Preise, Abonnements, Module-Verwaltung).
 */

/**
 * Pricing Plan (Basis-Plan)
 */
export interface PricingPlan {
  id: string; // 'basic', 'pro', 'business'
  name: string;
  description: string;
  pricePerUser: number; // in Cent
  minimumPrice: number; // in Cent
  pricePerUserYearly?: number; // in Cent (mit 15% Rabatt)
  minimumPriceYearly?: number; // in Cent (mit 15% Rabatt)
  includedModules: string[]; // Module-IDs
  features: string[];
  targetGroup?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Pricing Addon (Optionales Modul)
 */
export interface PricingAddon {
  id: string; // z.B. 'work-time-compliance'
  moduleId: string; // Entspricht Modul-ID
  name: string;
  description: string;
  pricePerUser: number; // in Cent
  minimumPrice: number; // in Cent
  pricePerUserYearly?: number; // in Cent (mit 15% Rabatt)
  minimumPriceYearly?: number; // in Cent (mit 15% Rabatt)
  icon?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Subscription (Abo für einen Tenant)
 */
export interface Subscription {
  id: string;
  tenantId: string;
  planId: string; // 'basic', 'pro', 'business'
  addonIds: string[]; // IDs der aktivierten Add-ons
  userCount: number; // Anzahl aktiver Nutzer
  billingCycle: 'monthly' | 'yearly';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart: FirebaseFirestore.Timestamp;
  currentPeriodEnd: FirebaseFirestore.Timestamp;
  cancelAtPeriodEnd?: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Stripe Customer Data
 */
export interface StripeCustomer {
  id: string;
  tenantId: string;
  stripeCustomerId: string;
  email?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Request: Pricing Plan erstellen/aktualisieren
 */
export interface UpsertPricingPlanRequest {
  id: string;
  name: string;
  description: string;
  pricePerUser: number; // in Cent
  minimumPrice: number; // in Cent
  pricePerUserYearly?: number; // in Cent
  minimumPriceYearly?: number; // in Cent
  includedModules: string[];
  features: string[];
  targetGroup?: string;
}

/**
 * Request: Pricing Addon erstellen/aktualisieren
 */
export interface UpsertPricingAddonRequest {
  id: string;
  moduleId: string;
  name: string;
  description: string;
  pricePerUser: number; // in Cent
  minimumPrice: number; // in Cent
  pricePerUserYearly?: number; // in Cent
  minimumPriceYearly?: number; // in Cent
  icon?: string;
}

/**
 * Request: Subscription erstellen
 */
export interface CreateSubscriptionRequest {
  tenantId: string;
  planId: string;
  addonIds?: string[];
  userCount: number;
  billingCycle: 'monthly' | 'yearly';
}

/**
 * Request: Subscription aktualisieren
 */
export interface UpdateSubscriptionRequest {
  planId?: string;
  addonIds?: string[];
  userCount?: number;
  billingCycle?: 'monthly' | 'yearly';
  cancelAtPeriodEnd?: boolean;
}

/**
 * Response: Pricing Plans
 */
export interface PricingPlansResponse {
  plans: PricingPlan[];
}

/**
 * Response: Pricing Addons
 */
export interface PricingAddonsResponse {
  addons: PricingAddon[];
}

/**
 * Response: Subscription
 */
export interface SubscriptionResponse {
  subscription: Subscription;
  plan?: PricingPlan;
  addons?: PricingAddon[];
}

/**
 * Response: Subscriptions für einen Tenant
 */
export interface TenantSubscriptionsResponse {
  subscriptions: Subscription[];
  plans: Record<string, PricingPlan>;
  addons: Record<string, PricingAddon>;
}

/**
 * Response: Checkout Session
 */
export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

