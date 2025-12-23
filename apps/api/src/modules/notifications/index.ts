/**
 * Notifications Module – Public API
 */

export { notificationsRouter } from './routes';
export {
  createNotification,
  createNotificationsForUsers,
  getNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './service';
export type { CreateNotificationParams } from './types';
