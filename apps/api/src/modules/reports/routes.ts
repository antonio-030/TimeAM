/**
 * Reports & Analytics Routes
 *
 * Express Router für Berichts-Endpoints.
 */

import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth';
import { requireEntitlements, type TenantRequest, ENTITLEMENT_KEYS } from '../../core/entitlements';
import {
  generateTimeSummaryReport,
  generateShiftOverviewReport,
  generateMemberActivityReport,
  getDashboardWidgets,
} from './service';
import type { ReportRequest, ReportPeriod, ReportType } from './types';

const router = Router();

// Alle Routes erfordern Auth + reports Entitlement
const reportsGuard = [
  requireAuth,
  requireEntitlements([ENTITLEMENT_KEYS.MODULE_REPORTS]),
];

// Nur Admin/Manager können Mitarbeiter-Reports sehen
const adminReportsGuard = [
  requireAuth,
  requireEntitlements([ENTITLEMENT_KEYS.MODULE_REPORTS]),
];

/**
 * Validiert Report-Periode.
 */
function isValidPeriod(period: string): period is ReportPeriod {
  const validPeriods = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom'];
  return validPeriods.includes(period);
}

/**
 * Validiert Report-Typ.
 */
function isValidReportType(type: string): type is ReportType {
  const validTypes = ['time_summary', 'shift_overview', 'member_activity'];
  return validTypes.includes(type);
}

/**
 * GET /api/reports/dashboard
 *
 * Lädt Dashboard-Widget-Daten.
 */
router.get('/dashboard', ...reportsGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;

  try {
    const widgets = await getDashboardWidgets(tenant.id);

    res.json({
      success: true,
      data: widgets,
    });
  } catch (error) {
    console.error('Error in GET /reports/dashboard:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Laden des Dashboards';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/reports/time-summary
 *
 * Generiert Zeit-Zusammenfassungs-Report.
 */
router.get('/time-summary', ...reportsGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const period = (req.query.period as string) || 'this_week';
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  if (!isValidPeriod(period)) {
    res.status(400).json({ error: 'Ungültiger Zeitraum', code: 'INVALID_PERIOD' });
    return;
  }

  if (period === 'custom' && (!startDate || !endDate)) {
    res.status(400).json({ 
      error: 'Start- und Enddatum erforderlich für benutzerdefinierten Zeitraum', 
      code: 'MISSING_DATES' 
    });
    return;
  }

  try {
    const report = await generateTimeSummaryReport(tenant.id, period, startDate, endDate);

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error in GET /reports/time-summary:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Generieren des Reports';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/reports/shift-overview
 *
 * Generiert Schicht-Übersichts-Report.
 */
router.get('/shift-overview', ...reportsGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const period = (req.query.period as string) || 'this_week';
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  if (!isValidPeriod(period)) {
    res.status(400).json({ error: 'Ungültiger Zeitraum', code: 'INVALID_PERIOD' });
    return;
  }

  if (period === 'custom' && (!startDate || !endDate)) {
    res.status(400).json({ 
      error: 'Start- und Enddatum erforderlich für benutzerdefinierten Zeitraum', 
      code: 'MISSING_DATES' 
    });
    return;
  }

  try {
    const report = await generateShiftOverviewReport(tenant.id, period, startDate, endDate);

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error in GET /reports/shift-overview:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Generieren des Reports';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/reports/member-activity
 *
 * Generiert Mitarbeiter-Aktivitäts-Report (nur Admin/Manager).
 */
router.get('/member-activity', ...adminReportsGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const period = (req.query.period as string) || 'this_week';
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  if (!isValidPeriod(period)) {
    res.status(400).json({ error: 'Ungültiger Zeitraum', code: 'INVALID_PERIOD' });
    return;
  }

  if (period === 'custom' && (!startDate || !endDate)) {
    res.status(400).json({ 
      error: 'Start- und Enddatum erforderlich für benutzerdefinierten Zeitraum', 
      code: 'MISSING_DATES' 
    });
    return;
  }

  try {
    const report = await generateMemberActivityReport(tenant.id, period, startDate, endDate);

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error in GET /reports/member-activity:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Generieren des Reports';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/reports/generate
 *
 * Generiert einen Report basierend auf Typ und Parametern.
 */
router.post('/generate', ...reportsGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const body = req.body as ReportRequest;

  // Validierung
  if (!body.type || !isValidReportType(body.type)) {
    res.status(400).json({ error: 'Ungültiger Report-Typ', code: 'INVALID_TYPE' });
    return;
  }

  const period = body.period || 'this_week';
  if (!isValidPeriod(period)) {
    res.status(400).json({ error: 'Ungültiger Zeitraum', code: 'INVALID_PERIOD' });
    return;
  }

  if (period === 'custom' && (!body.startDate || !body.endDate)) {
    res.status(400).json({ 
      error: 'Start- und Enddatum erforderlich für benutzerdefinierten Zeitraum', 
      code: 'MISSING_DATES' 
    });
    return;
  }

  try {
    let report;

    switch (body.type) {
      case 'time_summary':
        report = await generateTimeSummaryReport(tenant.id, period, body.startDate, body.endDate);
        break;
      case 'shift_overview':
        report = await generateShiftOverviewReport(tenant.id, period, body.startDate, body.endDate);
        break;
      case 'member_activity':
        report = await generateMemberActivityReport(tenant.id, period, body.startDate, body.endDate);
        break;
      default:
        res.status(400).json({ error: 'Unbekannter Report-Typ', code: 'UNKNOWN_TYPE' });
        return;
    }

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error in POST /reports/generate:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Generieren des Reports';
    res.status(500).json({ error: message });
  }
});

export { router as reportsRouter };
