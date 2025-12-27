/**
 * Security Audit API
 *
 * API-Calls für das Security-Audit-Modul.
 */

import { apiGet } from '../../core/api/client';
import type {
  SecurityEventsListResponse,
  SecurityEventDetailResponse,
  SecurityStatsResponse,
  RateLimitsListResponse,
  SecurityEventsQueryParams,
} from '@timeam/shared';

// Export für Hooks
export type { SecurityEventsQueryParams };

/**
 * Lädt alle Security-Events mit optionalen Filtern.
 */
export async function getSecurityEvents(
  params?: SecurityEventsQueryParams
): Promise<SecurityEventsListResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.eventType) queryParams.append('eventType', params.eventType);
  if (params?.severity) queryParams.append('severity', params.severity);
  if (params?.userId) queryParams.append('userId', params.userId);
  if (params?.email) queryParams.append('email', params.email);
  if (params?.ipAddress) queryParams.append('ipAddress', params.ipAddress);
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const queryString = queryParams.toString();
  const endpoint = `/api/security-audit/events${queryString ? `?${queryString}` : ''}`;
  
  return apiGet<SecurityEventsListResponse>(endpoint);
}

/**
 * Lädt ein einzelnes Security-Event.
 */
export async function getSecurityEvent(
  eventId: string
): Promise<SecurityEventDetailResponse> {
  return apiGet<SecurityEventDetailResponse>(`/api/security-audit/events/${eventId}`);
}

/**
 * Lädt Statistiken über Security-Events.
 */
export async function getSecurityStats(): Promise<SecurityStatsResponse> {
  return apiGet<SecurityStatsResponse>('/api/security-audit/stats');
}

/**
 * Lädt alle aktuellen Rate-Limits.
 */
export async function getRateLimits(): Promise<RateLimitsListResponse> {
  return apiGet<RateLimitsListResponse>('/api/security-audit/rate-limits');
}

