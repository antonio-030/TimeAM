/**
 * Calendar Core Routes
 *
 * API-Endpunkte für das Kalender-Modul.
 */

import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth';
import { requireTenantOnly, type TenantRequest } from '../../core/entitlements';
import { getCalendarEvents } from './service';

const router = Router();

// =============================================================================
// Middleware Chain
// =============================================================================

// Kalender ist Core-Modul, immer verfügbar:
// 1. Authentifizierung (Firebase Auth)
// 2. Tenant-Zugehörigkeit (ohne spezifisches Entitlement)
const calendarMiddleware = [
  requireAuth,
  requireTenantOnly(),
];

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/calendar/events
 *
 * Lädt Kalender-Events für einen Zeitraum.
 *
 * Query-Parameter:
 * - from: ISO 8601 Datum (required)
 * - to: ISO 8601 Datum (required)
 * - includeModules: Komma-separierte Liste (optional, z.B. "shift-pool,time-tracking")
 */
router.get('/events', calendarMiddleware, async (req: import('express').Request, res: import('express').Response) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant, entitlements } = req as TenantRequest;
  const { from, to, includeModules } = req.query;

  // Validierung: from und to sind required
  if (!from || typeof from !== 'string') {
    res.status(400).json({
      error: 'Missing or invalid "from" parameter (ISO 8601 date required)',
      code: 'INVALID_FROM',
    });
    return;
  }

  if (!to || typeof to !== 'string') {
    res.status(400).json({
      error: 'Missing or invalid "to" parameter (ISO 8601 date required)',
      code: 'INVALID_TO',
    });
    return;
  }

  // Daten parsen
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime())) {
    res.status(400).json({
      error: 'Invalid "from" date format',
      code: 'INVALID_FROM_FORMAT',
    });
    return;
  }

  if (isNaN(toDate.getTime())) {
    res.status(400).json({
      error: 'Invalid "to" date format',
      code: 'INVALID_TO_FORMAT',
    });
    return;
  }

  // from muss vor to liegen
  if (fromDate >= toDate) {
    res.status(400).json({
      error: '"from" must be before "to"',
      code: 'INVALID_RANGE',
    });
    return;
  }

  // Maximaler Zeitraum: 93 Tage (~ 3 Monate)
  const maxRangeMs = 93 * 24 * 60 * 60 * 1000;
  if (toDate.getTime() - fromDate.getTime() > maxRangeMs) {
    res.status(400).json({
      error: 'Date range too large (max 93 days)',
      code: 'RANGE_TOO_LARGE',
    });
    return;
  }

  // includeModules parsen
  let moduleFilter: string[] | undefined;
  if (includeModules && typeof includeModules === 'string') {
    moduleFilter = includeModules.split(',').map((m) => m.trim());
  }

  try {
    const result = await getCalendarEvents(
      tenant.id,
      user.uid,
      entitlements,
      {
        from: fromDate,
        to: toDate,
        includeModules: moduleFilter,
      }
    );

    res.json(result);
  } catch (error) {
    console.error('Error in GET /api/calendar/events:', error);
    res.status(500).json({
      error: 'Failed to load calendar events',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as calendarCoreRouter };
