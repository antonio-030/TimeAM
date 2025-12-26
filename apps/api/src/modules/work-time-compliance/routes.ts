/**
 * Work Time Compliance Routes
 *
 * Express Router für Compliance-Endpoints.
 */

import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth/index.js';
import { requireEntitlements, type TenantRequest, ENTITLEMENT_KEYS } from '../../core/entitlements/index.js';
import { getTenantForUser } from '../../core/tenancy/index.js';
import {
  checkCompliance,
  detectViolations,
  getComplianceRule,
  updateComplianceRule,
  getViolations,
  getViolation,
  acknowledgeViolation,
  generateReport,
  getReport,
  getAuditLogs,
  getComplianceStats,
} from './service.js';
import type {
  CheckComplianceRequest,
  UpdateRuleSetRequest,
  GenerateReportRequest,
  AcknowledgeViolationRequest,
  ComplianceViolationsQueryParams,
  ComplianceAuditLogsQueryParams,
} from './types.js';
import {
  isValidViolationType,
  isValidViolationSeverity,
  isValidRuleSet,
} from '@timeam/shared';

const router = Router();

/**
 * Middleware: Prüft Entitlement und aktiviert es automatisch für Dev-Staff.
 */
async function requireComplianceEntitlement(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    // Prüfe ob User Dev-Staff oder Super-Admin ist
    const { isDevStaff } = await import('../../modules/support/service.js');
    const { isSuperAdmin } = await import('../../core/super-admin/index.js');
    const isDev = await isDevStaff(authReq.user.uid);
    const isSuper = isSuperAdmin(authReq.user.uid);

    // Lade Tenant-Daten
    let tenantData = await getTenantForUser(authReq.user.uid);

    if (!tenantData) {
      console.log(`❌ Compliance: Kein Tenant für User ${authReq.user.uid}`);
      res.status(403).json({
        error: 'No tenant membership',
        code: 'NO_TENANT',
      });
      return;
    }

    const entitlementKey = ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE;
    const entitlementValue = tenantData.entitlements[entitlementKey];
    
    console.log(`🔍 Compliance: Tenant ${tenantData.tenant.id}`);
    console.log(`🔍 Compliance: Entitlement Key: ${entitlementKey}`);
    console.log(`🔍 Compliance: Entitlement Value: ${entitlementValue} (type: ${typeof entitlementValue})`);
    console.log(`🔍 Compliance: Alle Entitlements:`, Object.keys(tenantData.entitlements));

    // Prüfe ob Entitlement fehlt oder nicht true ist
    const hasEntitlement = entitlementValue === true || 
      (typeof entitlementValue === 'string' && entitlementValue !== '') || 
      (typeof entitlementValue === 'number' && entitlementValue > 0);
    console.log(`🔍 Compliance: Entitlement vorhanden: ${hasEntitlement}`);

    if (!hasEntitlement) {
      console.log(`⚠️ Compliance: Entitlement fehlt. isDev: ${isDev}, isSuper: ${isSuper}`);
      // Für Dev-Staff/Super-Admins automatisch aktivieren
      if (isDev || isSuper) {
        const { setEntitlement } = await import('../../core/tenancy/index.js');
        await setEntitlement(
          tenantData.tenant.id,
          ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE,
          true
        );
        console.log(`🔧 Dev-Helper: Work-Time-Compliance Modul für Tenant ${tenantData.tenant.id} aktiviert`);
        
        // Kurz warten, damit Firestore die Änderungen propagiert
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Tenant-Daten neu laden
        tenantData = await getTenantForUser(authReq.user.uid);
        console.log(`🔍 Compliance: Nach Aktivierung - Entitlement vorhanden: ${tenantData?.entitlements[ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE] === true}`);
      } else {
        // Normale User: Entitlement fehlt
        console.log(`❌ Compliance: Normale User ohne Entitlement - 403`);
        res.status(403).json({
          error: `Missing entitlements: ${ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE}`,
          code: 'MISSING_ENTITLEMENT',
          missingEntitlements: [ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE],
        });
        return;
      }
    }

    // Prüfe nochmal (nach Aktivierung)
    if (tenantData && tenantData.entitlements[ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE] !== true) {
      res.status(403).json({
        error: `Missing entitlements: ${ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE}`,
        code: 'MISSING_ENTITLEMENT',
        missingEntitlements: [ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE],
      });
      return;
    }

    // Tenant-Kontext an Request hängen
    if (tenantData) {
      (req as TenantRequest).tenant = {
        id: tenantData.tenant.id,
        name: tenantData.tenant.name,
      };
      (req as TenantRequest).entitlements = tenantData.entitlements;
    }

    next();
  } catch (error) {
    console.error('Error in requireComplianceEntitlement:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}

// Alle Routes erfordern Auth + work_time_compliance Entitlement
// Dev-Helper aktiviert das Modul automatisch für Dev-Staff
const complianceGuard = [
  requireAuth,
  requireComplianceEntitlement,
];

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
  requireEntitlements([ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE]),
  requireAdminOrManager,
];

/**
 * GET /api/work-time-compliance/stats
 *
 * Gibt Compliance-Statistiken zurück.
 */
router.get('/stats', ...complianceGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;

  try {
    const stats = await getComplianceStats(tenant.id);

    res.json(stats);
  } catch (error) {
    console.error('Error in GET /work-time-compliance/stats:', error);
    const message = error instanceof Error ? error.message : 'Failed to get stats';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/work-time-compliance/violations
 *
 * Liste aller Verstöße (mit Filterung).
 */
router.get('/violations', ...complianceGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;

  try {
    const params: ComplianceViolationsQueryParams = {};

    if (req.query.userId) {
      params.userId = req.query.userId as string;
    }

    if (req.query.violationType) {
      const violationType = req.query.violationType as string;
      if (isValidViolationType(violationType)) {
        params.violationType = violationType;
      } else {
        res.status(422).json({
          error: 'Invalid violationType',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
    }

    if (req.query.severity) {
      const severity = req.query.severity as string;
      if (isValidViolationSeverity(severity)) {
        params.severity = severity;
      } else {
        res.status(422).json({
          error: 'Invalid severity',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
    }

    if (req.query.acknowledged !== undefined) {
      params.acknowledged = req.query.acknowledged === 'true';
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

    const result = await getViolations(tenant.id, params);

    res.json({
      violations: result.violations,
      count: result.violations.length,
      total: result.total,
    });
  } catch (error) {
    console.error('Error in GET /work-time-compliance/violations:', error);
    const message = error instanceof Error ? error.message : 'Failed to get violations';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/work-time-compliance/violations/:id
 *
 * Einzelner Verstoß.
 */
router.get('/violations/:id', ...complianceGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { id } = req.params;

  try {
    const violation = await getViolation(tenant.id, id);

    if (!violation) {
      res.status(404).json({
        error: 'Violation not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    res.json({ violation });
  } catch (error) {
    console.error('Error in GET /work-time-compliance/violations/:id:', error);
    const message = error instanceof Error ? error.message : 'Failed to get violation';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/work-time-compliance/violations/:id/acknowledge
 *
 * Verstoß als erkannt markieren.
 */
router.post('/violations/:id/acknowledge', ...complianceGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { user } = req as AuthenticatedRequest;
  const { id } = req.params;
  const body = req.body as AcknowledgeViolationRequest;

  try {
    const violation = await acknowledgeViolation(
      tenant.id,
      id,
      user.uid,
      body.acknowledged
    );

    res.json({ violation });
  } catch (error) {
    console.error('Error in POST /work-time-compliance/violations/:id/acknowledge:', error);
    const message = error instanceof Error ? error.message : 'Failed to acknowledge violation';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/work-time-compliance/rules
 *
 * Aktuelles Regel-Set.
 */
router.get('/rules', ...complianceGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;

  try {
    const rule = await getComplianceRule(tenant.id);

    res.json({ rule });
  } catch (error) {
    console.error('Error in GET /work-time-compliance/rules:', error);
    const message = error instanceof Error ? error.message : 'Failed to get rules';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/work-time-compliance/rules
 *
 * Regel-Set aktualisieren (nur Admin/Manager).
 */
router.put('/rules', ...adminGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { user } = req as AuthenticatedRequest;
  const body = req.body as UpdateRuleSetRequest;

  try {
    if (!body.ruleSet || !isValidRuleSet(body.ruleSet)) {
      res.status(422).json({
        error: 'Invalid ruleSet',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const rule = await updateComplianceRule(tenant.id, body, user.uid);

    res.json({ rule });
  } catch (error) {
    console.error('Error in PUT /work-time-compliance/rules:', error);
    const message = error instanceof Error ? error.message : 'Failed to update rules';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/work-time-compliance/check
 *
 * Manuelle Prüfung (Zeitraum, User).
 */
router.post('/check', ...complianceGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const body = req.body as CheckComplianceRequest;

  try {
    if (!body.startDate || !body.endDate) {
      res.status(400).json({
        error: 'startDate and endDate are required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const violations = await checkCompliance(
      tenant.id,
      body.userId,
      new Date(body.startDate),
      new Date(body.endDate)
    );

    res.json({
      violations,
      count: violations.length,
    });
  } catch (error) {
    console.error('Error in POST /work-time-compliance/check:', error);
    const message = error instanceof Error ? error.message : 'Failed to check compliance';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/work-time-compliance/reports/generate
 *
 * Prüfungs-Report generieren (CSV/PDF).
 */
router.post('/reports/generate', ...adminGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { user } = req as AuthenticatedRequest;
  const body = req.body as GenerateReportRequest;

  try {
    if (!body.periodStart || !body.periodEnd || !body.format) {
      res.status(400).json({
        error: 'periodStart, periodEnd and format are required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (body.format !== 'csv' && body.format !== 'pdf') {
      res.status(422).json({
        error: 'Invalid format. Must be csv or pdf',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const report = await generateReport(
      tenant.id,
      user.uid,
      new Date(body.periodStart),
      new Date(body.periodEnd),
      body.format,
      body.filters
    );

    res.json({ report });
  } catch (error) {
    console.error('Error in POST /work-time-compliance/reports/generate:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate report';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/work-time-compliance/reports/:id
 *
 * Report abrufen.
 */
router.get('/reports/:id', ...complianceGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { id } = req.params;

  try {
    const report = await getReport(tenant.id, id);

    if (!report) {
      res.status(404).json({
        error: 'Report not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    res.json({ report });
  } catch (error) {
    console.error('Error in GET /work-time-compliance/reports/:id:', error);
    const message = error instanceof Error ? error.message : 'Failed to get report';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/work-time-compliance/audit-logs
 *
 * Audit-Timeline.
 */
router.get('/audit-logs', ...complianceGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;

  try {
    const params: ComplianceAuditLogsQueryParams = {};

    if (req.query.action) {
      params.action = req.query.action as any;
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

    const result = await getAuditLogs(tenant.id, params);

    res.json({
      logs: result.logs,
      count: result.logs.length,
      total: result.total,
    });
  } catch (error) {
    console.error('Error in GET /work-time-compliance/audit-logs:', error);
    const message = error instanceof Error ? error.message : 'Failed to get audit logs';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/work-time-compliance/debug
 *
 * Debug-Route: Zeigt Tenant und Entitlements (nur für Dev-Staff).
 */
router.get('/debug', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const { isDevStaff } = await import('../../modules/support/service.js');
    const { isSuperAdmin } = await import('../../core/super-admin/index.js');
    const isDev = await isDevStaff(authReq.user.uid);
    const isSuper = isSuperAdmin(authReq.user.uid);

    if (!isDev && !isSuper) {
      res.status(403).json({ error: 'Only dev staff can access debug route' });
      return;
    }

    const tenantData = await getTenantForUser(authReq.user.uid);
    
    if (!tenantData) {
      res.json({
        user: authReq.user.uid,
        tenant: null,
        entitlements: {},
        hasComplianceEntitlement: false,
      });
      return;
    }

    const hasCompliance = tenantData.entitlements[ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE] === true;

    res.json({
      user: authReq.user.uid,
      tenant: {
        id: tenantData.tenant.id,
        name: tenantData.tenant.name,
      },
      entitlements: tenantData.entitlements,
      hasComplianceEntitlement: hasCompliance,
      complianceEntitlementKey: ENTITLEMENT_KEYS.MODULE_WORK_TIME_COMPLIANCE,
      isDevStaff: isDev,
      isSuperAdmin: isSuper,
    });
  } catch (error) {
    console.error('Error in GET /work-time-compliance/debug:', error);
    const message = error instanceof Error ? error.message : 'Failed to get debug info';
    res.status(500).json({ error: message });
  }
});

export { router as workTimeComplianceRouter };

