/**
 * Notifications API Client
 *
 * Kommunikation mit dem Backend Notifications-Service.
 */

import { apiGet, apiPost, apiDelete } from '../../core/api';
import type {
  NotificationsListResponse,
  NotificationResponse,
  UnreadCountResponse,
} from '@timeam/shared';

/**
 * Lädt alle Benachrichtigungen des Users.
 */
export async function fetchNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<NotificationsListResponse> {
  const params = new URLSearchParams();
  
  if (options?.limit) {
    params.set('limit', String(options.limit));
  }
  if (options?.unreadOnly) {
    params.set('unreadOnly', 'true');
  }

  const queryString = params.toString();
  const url = queryString
    ? `/api/notifications?${queryString}`
    : '/api/notifications';

  return apiGet<NotificationsListResponse>(url);
}

/**
 * Lädt die Anzahl ungelesener Benachrichtigungen.
 */
export async function fetchUnreadCount(): Promise<UnreadCountResponse> {
  return apiGet<UnreadCountResponse>('/api/notifications/unread-count');
}

/**
 * Markiert eine Benachrichtigung als gelesen.
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<NotificationResponse> {
  return apiPost<NotificationResponse>(
    `/api/notifications/${notificationId}/read`,
    {}
  );
}

/**
 * Markiert alle Benachrichtigungen als gelesen.
 */
export async function markAllNotificationsAsRead(): Promise<{ markedCount: number }> {
  return apiPost<{ markedCount: number }>('/api/notifications/read-all', {});
}

/**
 * Löscht eine Benachrichtigung.
 */
export async function deleteNotification(
  notificationId: string
): Promise<{ deleted: boolean }> {
  return apiDelete<{ deleted: boolean }>(`/api/notifications/${notificationId}`);
}
