/**
 * Subscription Management Types
 *
 * Types für das Subscription-Management Core-Modul.
 */

import type { Subscription, PricingPlan, PricingAddon } from '../../modules/stripe/types.js';

/**
 * Request: Nutzeranzahl aktualisieren
 */
export interface UpdateSubscriptionUserCountRequest {
  newUserCount: number;
}

/**
 * Request: Plan wechseln
 */
export interface UpdateSubscriptionPlanRequest {
  newPlanId: string;
}

/**
 * Request: Addon hinzufügen
 */
export interface AddSubscriptionAddonRequest {
  addonId: string;
}

/**
 * Request: Addon entfernen
 */
export interface RemoveSubscriptionAddonRequest {
  addonId: string;
}

/**
 * Response: Anteiliger Betrag
 */
export interface ProratedAmountResponse {
  proratedAmount: number; // in Cent
  immediateCharge: number; // in Cent (sofortige Zahlung)
  nextPeriodAmount: number; // in Cent (nächste reguläre Zahlung)
  daysRemaining: number; // Tage bis zum Ende der aktuellen Periode
  totalDaysInPeriod: number; // Gesamte Tage in der aktuellen Periode
}

/**
 * Response: Subscription mit Details
 */
export interface SubscriptionDetailsResponse {
  subscription: Subscription;
  plan: PricingPlan;
  addons: PricingAddon[];
  currentMemberCount: number;
  canAddMoreMembers: boolean;
  proratedInfo?: ProratedAmountResponse;
}

