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
  calculateBreakSuggestion,
  getTimeEntriesForUser,
  getTimeEntryByIdForAdmin,
  createTimeEntryForAdmin,
  updateTimeEntryForAdmin,
  deleteTimeEntryForAdmin,
} from './service.js';
import type { CreateTimeEntryRequest, UpdateTimeEntryRequest } from './types.js';
import {
  getTimeAccount,
  getTimeAccountHistory,
  updateTimeAccountTarget,
  addManualAdjustment,
  exportTimeAccountData,
} from './time-account-service.js';
import { getAdminFirestore } from '../../core/firebase/index.js';
import type { TimeAccountTargetDoc } from './time-account-types.js';
import { timeAccountTargetToResponse } from './time-account-service.js';
import { EMPLOYMENT_TYPE } from '@timeam/shared';
import type {
  UpdateTimeAccountTargetRequest,
  AddTimeAccountAdjustmentRequest,
} from '@timeam/shared';
import { getTenantForUser } from '../../core/tenancy/service.js';

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

/**
 * GET /api/time-tracking/break-suggestion
 *
 * Berechnet einen Pausen-Vorschlag basierend auf ArbZG.
 */
router.get('/break-suggestion', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const dateParam = req.query.date as string | undefined;

  try {
    const date = dateParam ? new Date(dateParam) : undefined;
    const suggestion = await calculateBreakSuggestion(tenant.id, user.uid, date);

    if (suggestion) {
      res.json({
        suggestion: {
          requiredMinutes: suggestion.requiredMinutes,
          reason: suggestion.reason,
        },
      });
    } else {
      res.json({
        suggestion: null,
      });
    }
  } catch (error) {
    console.error('Error in GET /time-tracking/break-suggestion:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Berechnen';
    res.status(500).json({ error: message });
  }
});

/**
 * Middleware: Prüft Admin- oder Manager-Rolle.
 */
async function requireAdminOrManager(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantReq = req as TenantRequest;

  if (!authReq.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const tenantData = await getTenantForUser(authReq.user.uid);

    if (!tenantData) {
      res.status(403).json({
        error: 'No tenant membership',
        code: 'NO_TENANT',
      });
      return;
    }

    const role = tenantData.member.role;
    if (role !== 'admin' && role !== 'manager') {
      res.status(403).json({
        error: 'Admin or Manager role required',
        code: 'ADMIN_OR_MANAGER_REQUIRED',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error in requireAdminOrManager:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}

// Admin/Manager-only Routes
const adminGuard = [
  requireAuth,
  requireEntitlements([ENTITLEMENT_KEYS.MODULE_TIME_TRACKING]),
  requireAdminOrManager,
];

// =============================================================================
// Admin Routes
// =============================================================================

/**
 * GET /api/time-tracking/admin/entries
 *
 * Lädt TimeEntries für einen User (Admin/Manager).
 */
router.get('/admin/entries', ...adminGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const userId = req.query.userId as string | undefined;

  if (!userId) {
    res.status(400).json({ error: 'userId Parameter erforderlich', code: 'VALIDATION_ERROR' });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  try {
    const entries = await getTimeEntriesForUser(tenant.id, userId, { limit });

    res.json({
      entries,
      count: entries.length,
    });
  } catch (error) {
    console.error('Error in GET /time-tracking/admin/entries:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Laden';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/time-tracking/admin/entries/:entryId
 *
 * Lädt einen einzelnen TimeEntry (Admin/Manager).
 */
router.get('/admin/entries/:entryId', ...adminGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { entryId } = req.params;

  try {
    const entry = await getTimeEntryByIdForAdmin(tenant.id, entryId);

    if (!entry) {
      res.status(404).json({ error: 'Eintrag nicht gefunden', code: 'NOT_FOUND' });
      return;
    }

    res.json({ entry });
  } catch (error) {
    console.error('Error in GET /time-tracking/admin/entries/:entryId:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Laden';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/time-tracking/admin/entries
 *
 * Erstellt einen TimeEntry für einen User (Admin/Manager).
 */
router.post('/admin/entries', ...adminGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const body = req.body as CreateTimeEntryRequest & { userId: string; email?: string };

  if (!body.userId) {
    res.status(400).json({ error: 'userId ist erforderlich', code: 'VALIDATION_ERROR' });
    return;
  }

  if (!body.clockIn || !body.clockOut) {
    res.status(400).json({ error: 'Start- und Endzeit sind erforderlich', code: 'VALIDATION_ERROR' });
    return;
  }

  try {
    const email = body.email || '';
    const entry = await createTimeEntryForAdmin(tenant.id, body.userId, email, {
      clockIn: body.clockIn,
      clockOut: body.clockOut,
      entryType: body.entryType,
      note: body.note,
    });

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

    console.error('Error in POST /time-tracking/admin/entries:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/time-tracking/admin/entries/:entryId
 *
 * Aktualisiert einen TimeEntry (Admin/Manager).
 */
router.put('/admin/entries/:entryId', ...adminGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { entryId } = req.params;
  const body = req.body as UpdateTimeEntryRequest;

  try {
    const entry = await updateTimeEntryForAdmin(tenant.id, entryId, body);

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
    if (message.includes('Laufende') || message.includes('Ungültig') || message.includes('muss vor')) {
      res.status(400).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in PUT /time-tracking/admin/entries/:entryId:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/time-tracking/admin/entries/:entryId
 *
 * Löscht einen TimeEntry (Admin/Manager).
 */
router.delete('/admin/entries/:entryId', ...adminGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { entryId } = req.params;

  try {
    await deleteTimeEntryForAdmin(tenant.id, entryId);

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
    if (message.includes('Laufende')) {
      res.status(400).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in DELETE /time-tracking/admin/entries/:entryId:', error);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Time Account Routes
// =============================================================================

/**
 * GET /api/time-tracking/time-account/:year/:month
 *
 * Lädt das Zeitkonto für einen Monat.
 */
router.get('/time-account/:year/:month', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);

  try {
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ error: 'Ungültiges Jahr oder Monat', code: 'VALIDATION_ERROR' });
      return;
    }

    const account = await getTimeAccount(tenant.id, user.uid, year, month);

    if (!account) {
      res.status(404).json({ error: 'Zeitkonto nicht gefunden', code: 'NOT_FOUND' });
      return;
    }

    res.json({ account });
  } catch (error) {
    console.error('Error in GET /time-tracking/time-account/:year/:month:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Laden';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/time-tracking/time-account/history
 *
 * Lädt die Historie der Zeitkonten.
 */
router.get('/time-account/history', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const limit = Math.min(parseInt(req.query.limit as string) || 12, 24);

  try {
    const accounts = await getTimeAccountHistory(tenant.id, user.uid, limit);

    res.json({
      accounts,
      count: accounts.length,
    });
  } catch (error) {
    console.error('Error in GET /time-tracking/time-account/history:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Laden';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/time-tracking/time-account/target/:userId
 *
 * Lädt die Zielstunden für einen User (nur Admin/Manager).
 */
router.get('/time-account/target/:userId', ...adminGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const userId = req.params.userId;

  try {
    // Validierung
    if (!userId || userId.trim() === '') {
      res.status(400).json({
        error: 'userId ist erforderlich',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (!tenant || !tenant.id) {
      res.status(400).json({
        error: 'Tenant-Kontext fehlt',
        code: 'MISSING_TENANT',
      });
      return;
    }

    const db = getAdminFirestore();
    const targetRef = db
      .collection('tenants')
      .doc(tenant.id)
      .collection('timeAccountTargets')
      .doc(userId);

    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      // Fallback: Standardwert
      res.json({
        target: {
          userId,
          monthlyTargetHours: 160,
          employmentType: EMPLOYMENT_TYPE.FULL_TIME,
          weeklyHours: 40,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
        },
      });
      return;
    }

    const targetData = targetSnap.data() as TimeAccountTargetDoc;
    const target = timeAccountTargetToResponse(targetData);

    res.json({ target });
  } catch (error) {
    console.error('Error in GET /time-tracking/time-account/target/:userId:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Laden';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/time-tracking/time-account/target
 *
 * Setzt die Zielstunden für einen User (nur Admin/Manager).
 */
router.put('/time-account/target', ...adminGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { user } = req as AuthenticatedRequest;
  const body = req.body as UpdateTimeAccountTargetRequest;

  try {
    if (!body.userId || body.monthlyTargetHours === undefined) {
      res.status(400).json({
        error: 'userId und monthlyTargetHours sind erforderlich',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const target = await updateTimeAccountTarget(
      tenant.id,
      body.userId,
      body.monthlyTargetHours,
      user.uid,
      body.employmentType,
      body.weeklyHours
    );

    res.json({ target });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fehler beim Aktualisieren';

    if (message.includes('Ungültige')) {
      res.status(400).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in PUT /time-tracking/time-account/target:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/time-tracking/time-account/:year/:month/adjust
 *
 * Fügt eine manuelle Anpassung hinzu (nur Admin/Manager).
 */
router.post('/time-account/:year/:month/adjust', ...adminGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { user } = req as AuthenticatedRequest;
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);
  const body = req.body as AddTimeAccountAdjustmentRequest & { userId: string };

  try {
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ error: 'Ungültiges Jahr oder Monat', code: 'VALIDATION_ERROR' });
      return;
    }

    if (!body.userId || body.amountHours === undefined || !body.reason) {
      res.status(400).json({
        error: 'userId, amountHours und reason sind erforderlich',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const account = await addManualAdjustment(
      tenant.id,
      body.userId,
      year,
      month,
      body.amountHours,
      body.reason,
      user.uid
    );

    res.json({ account });
  } catch (error) {
    console.error('Error in POST /time-tracking/time-account/:year/:month/adjust:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Hinzufügen';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/time-tracking/time-account/export
 *
 * Exportiert Zeitkonto-Daten für DSGVO (Art. 15).
 */
router.get('/time-account/export', ...timeTrackingGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const format = (req.query.format as 'json' | 'csv') || 'json';
  const startYear = req.query.startYear ? parseInt(req.query.startYear as string) : undefined;
  const startMonth = req.query.startMonth ? parseInt(req.query.startMonth as string) : undefined;
  const endYear = req.query.endYear ? parseInt(req.query.endYear as string) : undefined;
  const endMonth = req.query.endMonth ? parseInt(req.query.endMonth as string) : undefined;

  try {
    const accounts = await exportTimeAccountData(
      tenant.id,
      user.uid,
      startYear,
      startMonth,
      endYear,
      endMonth
    );

    if (format === 'csv') {
      // CSV-Export
      const csvHeader = 'Jahr,Monat,Zielstunden,Ist-Stunden (Zeiterfassung),Ist-Stunden (Schichten),Saldo,Erstellt,Zuletzt aktualisiert\n';
      const csvRows = accounts.map((acc) => {
        return `${acc.year},${acc.month},${acc.targetHours},${acc.timeTrackingHours},${acc.shiftHours},${acc.balanceHours},${acc.createdAt},${acc.updatedAt}`;
      });
      const csv = csvHeader + csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="zeitkonto-export-${Date.now()}.csv"`);
      res.send('\ufeff' + csv); // UTF-8 BOM für Excel-Kompatibilität
    } else {
      // JSON-Export
      res.json({ accounts, count: accounts.length });
    }
  } catch (error) {
    console.error('Error in GET /time-tracking/time-account/export:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Export';
    res.status(500).json({ error: message });
  }
});

export { router as timeTrackingRouter };

