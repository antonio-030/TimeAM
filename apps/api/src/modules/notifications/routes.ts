/**
 * Notifications Routes
 *
 * API-Endpunkte für Benachrichtigungen.
 */

import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth';
import { requireTenantOnly, type TenantRequest } from '../../core/entitlements';
import {
  getNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from './service';

const router = Router();

// =============================================================================
// Middleware Chain
// =============================================================================

// Notifications benötigen Auth + Tenant (kein spezielles Entitlement)
const notificationsMiddleware = [requireAuth, requireTenantOnly()];

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/notifications
 *
 * Lädt Benachrichtigungen des aktuellen Users.
 *
 * Query-Parameter:
 * - limit: Max. Anzahl (default: 50)
 * - unreadOnly: Nur ungelesene (default: false)
 */
router.get('/', notificationsMiddleware, async (req: import('express').Request, res: import('express').Response) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { limit, unreadOnly } = req.query;

  try {
    const result = await getNotificationsForUser(tenant.id, user.uid, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
      unreadOnly: unreadOnly === 'true',
    });

    res.json({
      notifications: result.notifications,
      unreadCount: result.unreadCount,
      totalCount: result.notifications.length,
    });
  } catch (error) {
    console.error('Error in GET /api/notifications:', error);
    res.status(500).json({
      error: 'Failed to load notifications',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/notifications/unread-count
 *
 * Gibt nur die Anzahl ungelesener Benachrichtigungen zurück.
 */
router.get('/unread-count', notificationsMiddleware, async (req: import('express').Request, res: import('express').Response) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;

  try {
    const unreadCount = await getUnreadCount(tenant.id, user.uid);
    res.json({ unreadCount });
  } catch (error) {
    console.error('Error in GET /api/notifications/unread-count:', error);
    res.status(500).json({
      error: 'Failed to get unread count',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/notifications/:id/read
 *
 * Markiert eine Benachrichtigung als gelesen.
 */
router.post('/:id/read', notificationsMiddleware, async (req: import('express').Request, res: import('express').Response) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { id } = req.params;

  try {
    const notification = await markAsRead(tenant.id, id, user.uid);

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ notification });
  } catch (error) {
    console.error('Error in POST /api/notifications/:id/read:', error);
    res.status(500).json({
      error: 'Failed to mark as read',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/notifications/read-all
 *
 * Markiert alle Benachrichtigungen als gelesen.
 */
router.post('/read-all', notificationsMiddleware, async (req: import('express').Request, res: import('express').Response) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;

  try {
    const count = await markAllAsRead(tenant.id, user.uid);
    res.json({ markedCount: count });
  } catch (error) {
    console.error('Error in POST /api/notifications/read-all:', error);
    res.status(500).json({
      error: 'Failed to mark all as read',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/notifications/:id
 *
 * Löscht eine Benachrichtigung.
 */
router.delete('/:id', notificationsMiddleware, async (req: import('express').Request, res: import('express').Response) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { id } = req.params;

  try {
    const deleted = await deleteNotification(tenant.id, id, user.uid);

    if (!deleted) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ deleted: true });
  } catch (error) {
    console.error('Error in DELETE /api/notifications/:id:', error);
    res.status(500).json({
      error: 'Failed to delete notification',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as notificationsRouter };
