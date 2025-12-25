/**
 * Notifications Module – Public API
 */

export { notificationsRouter } from './routes.js';
export {
  createNotification,
  createNotificationsForUsers,
  getNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './service.js';
export type { CreateNotificationParams } from './types.js';
