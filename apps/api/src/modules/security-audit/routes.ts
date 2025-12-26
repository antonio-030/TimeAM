/**
 * Security Audit Routes
 *
 * Express Router für Security-Audit-Endpoints.
 * Nur für Super-Admins im Dev-Tenant verfügbar.
 */

import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth/index.js';
import { requireSuperAdmin } from '../../core/super-admin/index.js';
import { getTenantForUser } from '../../core/tenancy/index.js';
import {
  getSecurityEvents,
  getSecurityEvent,
  getSecurityStats,
  getRateLimits,
} from './service.js';
import { authLoggingRouter } from './auth-logging.js';
import {
  isValidSecurityEventType,
  isValidSecurityEventSeverity,
  type SecurityEventType,
  type SecurityEventSeverity,
  type SecurityEventsQueryParams,
} from '@timeam/shared';

const router = Router();

// =============================================================================
// Public Routes (kein Auth erforderlich)
// =============================================================================

// Auth-Logging (öffentlich, für fehlgeschlagene Logins)
router.use('/auth', authLoggingRouter);

// =============================================================================
// Middleware: Prüft Dev-Tenant
// =============================================================================

/**
 * Middleware: Prüft, ob der User im Dev-Tenant ist.
 * Muss NACH requireAuth und requireSuperAdmin verwendet werden.
 */
function requireDevTenant() {
  return async (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const { user } = authReq;

    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    try {
      const tenantData = await getTenantForUser(user.uid);

      if (!tenantData) {
        res.status(403).json({
          error: 'No tenant membership',
          code: 'NO_TENANT',
        });
        return;
      }

      // Prüfe ob Dev-Tenant
      if (tenantData.tenant.id !== 'dev-tenant') {
        res.status(403).json({
          error: 'Security Audit module is only available in Dev-Tenant',
          code: 'DEV_TENANT_REQUIRED',
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Error in requireDevTenant:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: message });
    }
  };
}

// Alle Routes erfordern Auth + Super-Admin + Dev-Tenant
const securityAuditGuard = [requireAuth, requireSuperAdmin, requireDevTenant()];

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/security-audit/events
 * Liste aller Security-Events (mit Filterung).
 */
router.get('/events', ...securityAuditGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Tenant-Daten laden (für tenant-scoped Queries)
    const tenantData = await getTenantForUser(user.uid);
    const tenantId = tenantData?.tenant.id || null;

    // Query-Parameter parsen
    const params: SecurityEventsQueryParams = {};

    if (req.query.eventType) {
      const eventType = req.query.eventType as string;
      if (isValidSecurityEventType(eventType)) {
        params.eventType = eventType as SecurityEventType;
      } else {
        res.status(422).json({
          error: 'Invalid eventType',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
    }

    if (req.query.severity) {
      const severity = req.query.severity as string;
      if (isValidSecurityEventSeverity(severity)) {
        params.severity = severity as SecurityEventSeverity;
      } else {
        res.status(422).json({
          error: 'Invalid severity',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
    }

    if (req.query.userId) {
      params.userId = req.query.userId as string;
    }

    if (req.query.email) {
      params.email = req.query.email as string;
    }

    if (req.query.ipAddress) {
      params.ipAddress = req.query.ipAddress as string;
    }

    if (req.query.from) {
      params.from = req.query.from as string;
    }

    if (req.query.to) {
      params.to = req.query.to as string;
    }

    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string, 10);
      if (!isNaN(limit) && limit > 0) {
        params.limit = limit;
      }
    }

    if (req.query.offset) {
      const offset = parseInt(req.query.offset as string, 10);
      if (!isNaN(offset) && offset >= 0) {
        params.offset = offset;
      }
    }

    const result = await getSecurityEvents(tenantId, params);

    res.json({
      events: result.events,
      count: result.events.length,
      total: result.total,
    });
  } catch (error) {
    console.error('Error in GET /security-audit/events:', error);
    const errorObj = error as any;
    
    // Detaillierte Fehlerinformationen für Debugging
    const message = error instanceof Error ? error.message : 'Failed to get events';
    const details = errorObj.code === 9 
      ? 'Firestore index required. Please create the index or wait for it to be created.'
      : errorObj.details || undefined;
    
    res.status(500).json({ 
      error: message,
      code: errorObj.code,
      details,
    });
  }
});

/**
 * GET /api/security-audit/events/:eventId
 * Einzelnes Security-Event.
 */
router.get('/events/:eventId', ...securityAuditGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { eventId } = req.params;

  try {
    // Tenant-Daten laden (für tenant-scoped Queries)
    const tenantData = await getTenantForUser(user.uid);
    const tenantId = tenantData?.tenant.id || null;

    const event = await getSecurityEvent(tenantId, eventId);

    if (!event) {
      res.status(404).json({
        error: 'Event not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    res.json({ event });
  } catch (error) {
    console.error('Error in GET /security-audit/events/:eventId:', error);
    const message = error instanceof Error ? error.message : 'Failed to get event';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/security-audit/stats
 * Statistiken über Security-Events.
 */
router.get('/stats', ...securityAuditGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Tenant-Daten laden (für tenant-scoped Queries)
    const tenantData = await getTenantForUser(user.uid);
    const tenantId = tenantData?.tenant.id || null;

    const stats = await getSecurityStats(tenantId);

    res.json(stats);
  } catch (error) {
    console.error('Error in GET /security-audit/stats:', error);
    const message = error instanceof Error ? error.message : 'Failed to get stats';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/security-audit/rate-limits
 * Liste aller aktuellen Rate-Limits.
 */
router.get('/rate-limits', ...securityAuditGuard, async (_req, res) => {
  try {
    const rateLimits = await getRateLimits();

    res.json({
      rateLimits,
      count: rateLimits.length,
    });
  } catch (error) {
    console.error('Error in GET /security-audit/rate-limits:', error);
    const message = error instanceof Error ? error.message : 'Failed to get rate limits';
    res.status(500).json({ error: message });
  }
});

export { router as securityAuditRouter };

