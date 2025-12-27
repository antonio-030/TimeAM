/**
 * Subscription Management API
 *
 * API-Calls für das Subscription-Management Core-Modul.
 */

import { apiGet, apiPatch, apiPost, apiDelete } from '../api';

const API_BASE = '/api/subscription-management';

export interface SubscriptionDetails {
  subscription: {
    id: string;
    tenantId: string;
    planId: string;
    addonIds: string[];
    userCount: number;
    billingCycle: 'monthly' | 'yearly';
    status: 'active' | 'canceled' | 'past_due' | 'trialing';
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  plan: {
    id: string;
    name: string;
    description: string;
    pricePerUser: number; // in Cent
    minimumPrice: number; // in Cent
    pricePerUserYearly?: number;
    minimumPriceYearly?: number;
  };
  addons: Array<{
    id: string;
    name: string;
    description: string;
    pricePerUser: number; // in Cent
    minimumPrice: number; // in Cent
  }>;
  currentMemberCount: number;
  canAddMoreMembers: boolean;
  proratedInfo?: {
    proratedAmount: number; // in Cent
    immediateCharge: number; // in Cent
    nextPeriodAmount: number; // in Cent
    daysRemaining: number;
    totalDaysInPeriod: number;
  };
}

export interface UpdateUserCountResponse {
  subscription: SubscriptionDetails['subscription'];
  proratedAmount: {
    proratedAmount: number; // in Cent
    immediateCharge: number; // in Cent
    nextPeriodAmount: number; // in Cent
    daysRemaining: number;
    totalDaysInPeriod: number;
  };
}

/**
 * Lädt die aktive Subscription für den aktuellen Tenant.
 */
export async function getMySubscription(): Promise<SubscriptionDetails> {
  return apiGet<SubscriptionDetails>(`${API_BASE}/my-subscription`);
}

/**
 * Aktualisiert die Nutzeranzahl der aktiven Subscription.
 */
export async function updateSubscriptionUserCount(newUserCount: number): Promise<UpdateUserCountResponse> {
  console.log('📡 Frontend: Sende Update-Request...');
  console.log('📡 Neue Nutzeranzahl:', newUserCount);
  console.log('📡 API Endpoint:', `${API_BASE}/my-subscription/user-count`);
  
  try {
    const result = await apiPatch<UpdateUserCountResponse>(`${API_BASE}/my-subscription/user-count`, {
      newUserCount,
    });
    console.log('✅ Frontend: Update erfolgreich:', result);
    return result;
  } catch (error) {
    console.error('❌ Frontend: Fehler beim Update:', error);
    throw error;
  }
}

/**
 * Wechselt den Plan der aktiven Subscription.
 */
export async function updateSubscriptionPlan(newPlanId: string): Promise<{ subscription: SubscriptionDetails['subscription'] }> {
  return apiPatch<{ subscription: SubscriptionDetails['subscription'] }>(`${API_BASE}/my-subscription/plan`, {
    newPlanId,
  });
}

/**
 * Fügt ein Addon zur aktiven Subscription hinzu.
 */
export async function addSubscriptionAddon(addonId: string): Promise<{ subscription: SubscriptionDetails['subscription'] }> {
  return apiPost<{ subscription: SubscriptionDetails['subscription'] }>(`${API_BASE}/my-subscription/addons`, {
    addonId,
  });
}

/**
 * Entfernt ein Addon von der aktiven Subscription.
 */
export async function removeSubscriptionAddon(addonId: string): Promise<{ subscription: SubscriptionDetails['subscription'] }> {
  return apiDelete<{ subscription: SubscriptionDetails['subscription'] }>(`${API_BASE}/my-subscription/addons/${addonId}`);
}

