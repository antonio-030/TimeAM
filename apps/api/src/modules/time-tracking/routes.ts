/**
 * Time Tracking Routes
 *
 * Express Router für Zeiterfassungs-Endpoints.
 */

import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth/index.js';
import { requireEntitlements, type TenantRequest, ENTITLEMENT_KEYS } from '../../core/entitlements/index.js';
import {
  clockIn,
  clockOut,
  getMyTimeEntries,
  getTodayStats,
  getRunningEntry,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getTimeEntryById,
} from './service.js';
import type { CreateTimeEntryRequest, UpdateTimeEntryRequest } from './types.js';

const router = Router();

// Alle Routes erfordern Auth + time_tracking Entitlement
const timeTrackingGuard = [
  requireAuth,
  requireEntitlements([ENTITLEMENT_KEYS.MODULE_TIME_TRACKING]),
];

/**
 * GET /api/time-tracking/status
 *
 * Gibt den aktuellen Status zurück (laufender Entry, heute-Stats).
 */
router.get('/status', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;

  try {
    const stats = await getTodayStats(tenant.id, user.uid);

    res.json({
      isRunning: stats.isRunning,
      runningEntry: stats.runningEntry,
      today: {
        totalMinutes: stats.totalMinutes,
        entriesCount: stats.entriesCount,
      },
    });
  } catch (error) {
    console.error('Error in GET /time-tracking/status:', error);
    const message = error instanceof Error ? error.message : 'Failed to get status';
    res.status(500).json({ error: message, details: String(error) });
  }
});

/**
 * POST /api/time-tracking/clock-in
 *
 * Startet die Zeiterfassung.
 */
router.post('/clock-in', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { note } = req.body as { note?: string };

  try {
    const entry = await clockIn(tenant.id, user.uid, user.email || '', note);

    res.status(201).json({
      message: 'Clocked in successfully',
      entry,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clock in';

    if (message === 'Already clocked in') {
      res.status(409).json({ error: message, code: 'ALREADY_CLOCKED_IN' });
      return;
    }

    console.error('Error in POST /time-tracking/clock-in:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/time-tracking/clock-out
 *
 * Beendet die Zeiterfassung.
 */
router.post('/clock-out', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { note } = req.body as { note?: string };

  try {
    const entry = await clockOut(tenant.id, user.uid, note);

    res.json({
      message: 'Clocked out successfully',
      entry,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clock out';

    if (message === 'No running time entry') {
      res.status(409).json({ error: message, code: 'NOT_CLOCKED_IN' });
      return;
    }

    console.error('Error in POST /time-tracking/clock-out:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/time-tracking/entries
 *
 * Listet TimeEntries des aktuellen Users.
 */
router.get('/entries', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  try {
    const entries = await getMyTimeEntries(tenant.id, user.uid, { limit });

    res.json({
      entries,
      count: entries.length,
    });
  } catch (error) {
    console.error('Error in GET /time-tracking/entries:', error);
    const message = error instanceof Error ? error.message : 'Failed to get entries';
    res.status(500).json({ error: message, details: String(error) });
  }
});

/**
 * GET /api/time-tracking/running
 *
 * Gibt den aktuell laufenden Entry zurück (falls vorhanden).
 */
router.get('/running', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;

  try {
    const entry = await getRunningEntry(tenant.id, user.uid);

    res.json({
      isRunning: entry !== null,
      entry,
    });
  } catch (error) {
    console.error('Error in GET /time-tracking/running:', error);
    res.status(500).json({ error: 'Failed to get running entry' });
  }
});

/**
 * POST /api/time-tracking/entries
 *
 * Erstellt einen manuellen TimeEntry.
 */
router.post('/entries', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const body = req.body as CreateTimeEntryRequest;

  try {
    // Validierung
    if (!body.clockIn || !body.clockOut) {
      res.status(400).json({ 
        error: 'Start- und Endzeit sind erforderlich', 
        code: 'VALIDATION_ERROR' 
      });
      return;
    }

    const entry = await createTimeEntry(tenant.id, user.uid, user.email || '', body);

    res.status(201).json({
      message: 'Eintrag erstellt',
      entry,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fehler beim Erstellen';
    
    if (message.includes('Ungültig') || message.includes('muss vor') || message.includes('Maximal')) {
      res.status(400).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in POST /time-tracking/entries:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/time-tracking/entries/:entryId
 *
 * Lädt einen einzelnen TimeEntry.
 */
router.get('/entries/:entryId', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { entryId } = req.params;

  try {
    const entry = await getTimeEntryById(tenant.id, entryId, user.uid);

    if (!entry) {
      res.status(404).json({ error: 'Eintrag nicht gefunden', code: 'NOT_FOUND' });
      return;
    }

    res.json({ entry });
  } catch (error) {
    console.error('Error in GET /time-tracking/entries/:entryId:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

/**
 * PUT /api/time-tracking/entries/:entryId
 *
 * Aktualisiert einen TimeEntry.
 */
router.put('/entries/:entryId', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { entryId } = req.params;
  const body = req.body as UpdateTimeEntryRequest;

  try {
    const entry = await updateTimeEntry(tenant.id, entryId, user.uid, body);

    res.json({
      message: 'Eintrag aktualisiert',
      entry,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fehler beim Aktualisieren';

    if (message === 'Eintrag nicht gefunden') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'Keine Berechtigung') {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }
    if (message.includes('Laufende') || message.includes('Ungültig') || message.includes('muss vor')) {
      res.status(400).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in PUT /time-tracking/entries/:entryId:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/time-tracking/entries/:entryId
 *
 * Löscht einen TimeEntry.
 */
router.delete('/entries/:entryId', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { entryId } = req.params;

  try {
    await deleteTimeEntry(tenant.id, entryId, user.uid);

    res.json({
      success: true,
      message: 'Eintrag gelöscht',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fehler beim Löschen';

    if (message === 'Eintrag nicht gefunden') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'Keine Berechtigung') {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }
    if (message.includes('Laufende')) {
      res.status(400).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in DELETE /time-tracking/entries/:entryId:', error);
    res.status(500).json({ error: message });
  }
});

export { router as timeTrackingRouter };

