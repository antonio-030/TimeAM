/**
 * Notifications Types (Backend)
 *
 * Interne Typen für das Benachrichtigungs-Modul.
 */

import type { Timestamp } from 'firebase-admin/firestore';
import type { NotificationType } from '@timeam/shared';

/**
 * Notification Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/notifications/{notificationId}
 */
export interface NotificationDoc {
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  recipientUid: string;
  createdAt: Timestamp;
  ref?: {
    type: 'shift' | 'application' | 'assignment';
    id: string;
  };
  link?: string;
}

/**
 * Parameter zum Erstellen einer Notification.
 */
export interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  recipientUid: string;
  ref?: {
    type: 'shift' | 'application' | 'assignment';
    id: string;
  };
  link?: string;
}
