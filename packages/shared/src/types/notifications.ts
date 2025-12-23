/**
 * Notification Types (Shared)
 *
 * Gemeinsame Typen für das Benachrichtigungs-System.
 */

// =============================================================================
// Notification Types
// =============================================================================

/**
 * Benachrichtigungstypen.
 */
export const NOTIFICATION_TYPES = {
  // Schicht-bezogen
  SHIFT_NEW: 'SHIFT_NEW',                    // Neue Schicht im Pool
  SHIFT_UPDATED: 'SHIFT_UPDATED',            // Schicht wurde geändert (Zeit, Ort, etc.)
  SHIFT_CANCELLED: 'SHIFT_CANCELLED',        // Schicht abgesagt
  SHIFT_CLOSED: 'SHIFT_CLOSED',              // Schicht geschlossen (keine Bewerbungen mehr)
  SHIFT_REMINDER: 'SHIFT_REMINDER',          // Erinnerung an bevorstehende Schicht
  
  // Bewerbungs-bezogen
  APPLICATION_ACCEPTED: 'APPLICATION_ACCEPTED',   // Bewerbung angenommen
  APPLICATION_REJECTED: 'APPLICATION_REJECTED',   // Bewerbung abgelehnt
  APPLICATION_NEW: 'APPLICATION_NEW',             // Neue Bewerbung (für Admin)
  APPLICATION_WITHDRAWN: 'APPLICATION_WITHDRAWN', // Bewerbung zurückgezogen (für Admin)
  
  // Zuweisung
  ASSIGNMENT_CANCELLED: 'ASSIGNMENT_CANCELLED',   // Zuweisung wurde storniert
  
  // System
  SYSTEM_INFO: 'SYSTEM_INFO',                // Systemnachricht
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// =============================================================================
// Notification DTO
// =============================================================================

/**
 * Benachrichtigung (API Response).
 */
export interface Notification {
  /** Eindeutige ID */
  id: string;
  
  /** Typ der Benachrichtigung */
  type: NotificationType;
  
  /** Titel */
  title: string;
  
  /** Nachrichtentext */
  message: string;
  
  /** Gelesen? */
  read: boolean;
  
  /** Erstellungszeitpunkt (ISO 8601) */
  createdAt: string;
  
  /** Optionale Referenz auf zugehöriges Objekt */
  ref?: {
    type: 'shift' | 'application' | 'assignment';
    id: string;
  };
  
  /** Optionaler Deep-Link Pfad */
  link?: string;
}

/**
 * Benachrichtigung in Firestore.
 */
export interface NotificationDoc {
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  recipientUid: string;
  createdAt: FirebaseFirestore.Timestamp;
  ref?: {
    type: 'shift' | 'application' | 'assignment';
    id: string;
  };
  link?: string;
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Response: Notifications Liste.
 */
export interface NotificationsListResponse {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
}

/**
 * Response: Einzelne Notification.
 */
export interface NotificationResponse {
  notification: Notification;
}

/**
 * Response: Unread Count.
 */
export interface UnreadCountResponse {
  unreadCount: number;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Prüft, ob ein Notification-Type gültig ist.
 */
export function isValidNotificationType(
  type: string
): type is NotificationType {
  return Object.values(NOTIFICATION_TYPES).includes(type as NotificationType);
}

/**
 * Gibt ein Icon für den Notification-Type zurück.
 */
export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case NOTIFICATION_TYPES.SHIFT_NEW:
      return '📋';
    case NOTIFICATION_TYPES.SHIFT_UPDATED:
      return '✏️';
    case NOTIFICATION_TYPES.SHIFT_CANCELLED:
      return '❌';
    case NOTIFICATION_TYPES.SHIFT_CLOSED:
      return '🔒';
    case NOTIFICATION_TYPES.SHIFT_REMINDER:
      return '⏰';
    case NOTIFICATION_TYPES.APPLICATION_ACCEPTED:
      return '✅';
    case NOTIFICATION_TYPES.APPLICATION_REJECTED:
      return '❌';
    case NOTIFICATION_TYPES.APPLICATION_NEW:
      return '📩';
    case NOTIFICATION_TYPES.APPLICATION_WITHDRAWN:
      return '↩️';
    case NOTIFICATION_TYPES.ASSIGNMENT_CANCELLED:
      return '🚫';
    case NOTIFICATION_TYPES.SYSTEM_INFO:
    default:
      return 'ℹ️';
  }
}
