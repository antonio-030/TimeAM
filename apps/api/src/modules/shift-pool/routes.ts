/**
 * Shift Pool Routes
 *
 * Express Router für Schichtausschreibungs-Endpoints.
 */

import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth';
import { requireEntitlements, type TenantRequest, ENTITLEMENT_KEYS } from '../../core/entitlements';
import { MEMBER_ROLES } from '@timeam/shared';
import {
  createShift,
  updateShift,
  deleteShift,
  publishShift,
  closeShift,
  cancelShift,
  getAdminShifts,
  getShiftById,
  getPoolList,
  applyToShift,
  getShiftApplications,
  acceptApplication,
  rejectApplication,
  withdrawApplication,
  revokeAcceptedApplication,
  withdrawMyApplication,
  getMyShifts,
  getShiftAssignments,
  assignMemberToShift,
  removeAssignment,
} from './service';
import type { CreateShiftRequest, ApplyToShiftRequest } from './types';

const router = Router();

// =============================================================================
// Middleware
// =============================================================================

// Alle Routes erfordern Auth + shift_pool Entitlement
const shiftPoolGuard = [
  requireAuth,
  requireEntitlements([ENTITLEMENT_KEYS.MODULE_SHIFT_POOL]),
];

/**
 * Middleware: Prüft Admin-Rolle.
 */
function requireAdmin(req: TenantRequest, res: import('express').Response, next: import('express').NextFunction): void {
  // Member-Rolle wird in TenantRequest mitgeliefert
  // Für MVP: Nur Admin-Check über den Tenant-Kontext
  // Die Rolle wird beim requireEntitlements geladen

  // Da wir die Rolle nicht direkt im TenantRequest haben, prüfen wir sie hier
  // In der Praxis würde man die Rolle aus tenants/{tenantId}/members/{uid} laden
  // Für MVP: Admin-Actions werden in der Route selbst geprüft
  next();
}

// =============================================================================
// Admin Routes
// =============================================================================

/**
 * POST /api/shift-pool/shifts
 * Erstellt eine neue Schicht (Draft).
 */
router.post('/shifts', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const body = req.body as CreateShiftRequest;

  try {
    // TODO: Admin-Rolle prüfen (für MVP akzeptieren wir alle authentifizierten User mit Entitlement)
    const shift = await createShift(tenant.id, user.uid, body);

    res.status(201).json({
      shift,
      message: 'Shift created successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create shift';

    if (message.includes('required') || message.includes('Invalid') || message.includes('must be')) {
      res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in POST /shift-pool/shifts:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/shift-pool/admin/shifts
 * Liste aller Schichten für Admin.
 */
router.get('/admin/shifts', ...shiftPoolGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;

  try {
    const shifts = await getAdminShifts(tenant.id);

    res.json({
      shifts,
      count: shifts.length,
    });
  } catch (error) {
    console.error('Error in GET /shift-pool/admin/shifts:', error);
    const message = error instanceof Error ? error.message : 'Failed to get shifts';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/shift-pool/shifts/:shiftId
 * Aktualisiert eine Schicht.
 */
router.put('/shifts/:shiftId', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;
  const body = req.body as Partial<CreateShiftRequest>;

  try {
    const shift = await updateShift(tenant.id, shiftId, user.uid, body);

    res.json({
      shift,
      message: 'Shift updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update shift';

    if (message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('Cannot edit') || message.includes('Cannot reduce')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }
    if (message.includes('required') || message.includes('Invalid') || message.includes('must be')) {
      res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in PUT /shift-pool/shifts/:shiftId:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/shift-pool/shifts/:shiftId
 * Löscht eine Schicht (nur Draft).
 */
router.delete('/shifts/:shiftId', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    await deleteShift(tenant.id, shiftId, user.uid);

    res.json({
      success: true,
      message: 'Shift deleted successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete shift';

    if (message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('Only draft')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }

    console.error('Error in DELETE /shift-pool/shifts/:shiftId:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/shifts/:shiftId/publish
 * Veröffentlicht eine Schicht.
 */
router.post('/shifts/:shiftId/publish', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    const shift = await publishShift(tenant.id, shiftId, user.uid);

    res.json({
      shift,
      message: 'Shift published successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish shift';

    if (message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('Cannot publish')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }

    console.error('Error in POST /shift-pool/shifts/:shiftId/publish:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/shifts/:shiftId/close
 * Schließt eine Schicht für Bewerbungen.
 */
router.post('/shifts/:shiftId/close', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    const shift = await closeShift(tenant.id, shiftId, user.uid);

    res.json({
      shift,
      message: 'Shift closed successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to close shift';

    if (message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('Only published')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }

    console.error('Error in POST /shift-pool/shifts/:shiftId/close:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/shifts/:shiftId/cancel
 * Sagt eine Schicht ab.
 */
router.post('/shifts/:shiftId/cancel', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    const shift = await cancelShift(tenant.id, shiftId, user.uid);

    res.json({
      shift,
      message: 'Shift cancelled successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel shift';

    if (message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('already cancelled')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }

    console.error('Error in POST /shift-pool/shifts/:shiftId/cancel:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/shift-pool/shifts/:shiftId/applications
 * Liste der Bewerbungen für eine Schicht (Admin).
 */
router.get('/shifts/:shiftId/applications', ...shiftPoolGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    const applications = await getShiftApplications(tenant.id, shiftId);

    res.json({
      applications,
      count: applications.length,
    });
  } catch (error) {
    console.error('Error in GET /shift-pool/shifts/:shiftId/applications:', error);
    const message = error instanceof Error ? error.message : 'Failed to get applications';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/applications/:applicationId/accept
 * Akzeptiert eine Bewerbung.
 */
router.post('/applications/:applicationId/accept', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { applicationId } = req.params;

  try {
    const result = await acceptApplication(tenant.id, applicationId, user.uid);

    res.json({
      ...result,
      message: 'Application accepted successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to accept application';

    if (message === 'Application not found' || message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('Cannot accept') || message === 'Shift is not published') {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }
    if (message === 'No free slots available') {
      res.status(409).json({ error: message, code: 'NO_SLOTS' });
      return;
    }

    console.error('Error in POST /shift-pool/applications/:applicationId/accept:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/applications/:applicationId/reject
 * Lehnt eine Bewerbung ab.
 */
router.post('/applications/:applicationId/reject', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { applicationId } = req.params;

  try {
    const application = await rejectApplication(tenant.id, applicationId, user.uid);

    res.json({
      application,
      message: 'Application rejected',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject application';

    if (message === 'Application not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('Cannot reject')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }

    console.error('Error in POST /shift-pool/applications/:applicationId/reject:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/applications/:applicationId/revoke
 * Macht eine akzeptierte Bewerbung rückgängig (storniert Zuweisung).
 */
router.post('/applications/:applicationId/revoke', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { applicationId } = req.params;

  try {
    const application = await revokeAcceptedApplication(tenant.id, applicationId, user.uid);

    res.json({
      application,
      message: 'Application revoked - assignment cancelled',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke application';

    if (message === 'Application not found' || message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('Cannot revoke')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }

    console.error('Error in POST /shift-pool/applications/:applicationId/revoke:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/shift-pool/shifts/:shiftId/assignments
 * Lädt alle Zuweisungen für eine Schicht (Admin).
 */
router.get('/shifts/:shiftId/assignments', ...shiftPoolGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    const assignments = await getShiftAssignments(tenant.id, shiftId);
    res.json({ assignments, count: assignments.length });
  } catch (error) {
    console.error('Error in GET /shift-pool/shifts/:shiftId/assignments:', error);
    const message = error instanceof Error ? error.message : 'Failed to get assignments';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/shifts/:shiftId/assign
 * Weist einen Mitarbeiter direkt einer Schicht zu (Admin).
 */
router.post('/shifts/:shiftId/assign', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;
  const { memberUid } = req.body;

  if (!memberUid) {
    res.status(400).json({ error: 'memberUid is required' });
    return;
  }

  try {
    const assignment = await assignMemberToShift(tenant.id, shiftId, memberUid, user.uid);
    res.status(201).json({
      assignment,
      message: 'Member assigned to shift',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign member';

    if (message === 'Shift not found' || message === 'Member not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'Member is already assigned to this shift') {
      res.status(409).json({ error: message, code: 'ALREADY_ASSIGNED' });
      return;
    }
    if (message === 'No free slots available') {
      res.status(409).json({ error: message, code: 'NO_SLOTS' });
      return;
    }

    console.error('Error in POST /shift-pool/shifts/:shiftId/assign:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/shift-pool/assignments/:assignmentId
 * Entfernt eine Zuweisung (Admin).
 */
router.delete('/assignments/:assignmentId', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { assignmentId } = req.params;

  try {
    await removeAssignment(tenant.id, assignmentId, user.uid);
    res.json({ success: true, message: 'Assignment removed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove assignment';

    if (message === 'Assignment not found' || message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }

    console.error('Error in DELETE /shift-pool/assignments/:assignmentId:', error);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// User Routes
// =============================================================================

/**
 * GET /api/shift-pool/pool
 * Liste der verfügbaren Schichten (nur PUBLISHED).
 */
router.get('/pool', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { from, to, location, q } = req.query;

  try {
    const shifts = await getPoolList(tenant.id, user.uid, {
      from: from as string | undefined,
      to: to as string | undefined,
      location: location as string | undefined,
      q: q as string | undefined,
    });

    res.json({
      shifts,
      count: shifts.length,
    });
  } catch (error) {
    console.error('Error in GET /shift-pool/pool:', error);
    const message = error instanceof Error ? error.message : 'Failed to get pool';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/shift-pool/my-shifts
 * Meine zugewiesenen Schichten.
 */
router.get('/my-shifts', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { includeCompleted } = req.query;

  try {
    const shifts = await getMyShifts(tenant.id, user.uid, {
      includeCompleted: includeCompleted === 'true',
    });

    res.json({
      shifts,
      count: shifts.length,
    });
  } catch (error) {
    console.error('Error in GET /shift-pool/my-shifts:', error);
    const message = error instanceof Error ? error.message : 'Failed to get my shifts';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/shift-pool/shifts/:shiftId
 * Details einer Schicht.
 */
router.get('/shifts/:shiftId', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    // Für MVP: Alle authentifizierten User sind "nicht-Admin" in dieser Route
    // Admin-Funktionalität kommt über /admin/shifts
    const shift = await getShiftById(tenant.id, shiftId, user.uid, false);

    if (!shift) {
      res.status(404).json({ error: 'Shift not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({ shift });
  } catch (error) {
    console.error('Error in GET /shift-pool/shifts/:shiftId:', error);
    const message = error instanceof Error ? error.message : 'Failed to get shift';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/shifts/:shiftId/apply
 * Bewirbt sich auf eine Schicht.
 */
router.post('/shifts/:shiftId/apply', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;
  const body = req.body as ApplyToShiftRequest;

  try {
    const application = await applyToShift(
      tenant.id,
      shiftId,
      user.uid,
      user.email || '',
      body.note
    );

    res.status(201).json({
      application,
      message: 'Application submitted successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply';

    if (message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'Already applied to this shift') {
      res.status(409).json({ error: message, code: 'ALREADY_APPLIED' });
      return;
    }
    if (message === 'Shift is not available for applications') {
      res.status(409).json({ error: message, code: 'NOT_AVAILABLE' });
      return;
    }
    if (message === 'Application deadline has passed') {
      res.status(409).json({ error: message, code: 'DEADLINE_PASSED' });
      return;
    }

    console.error('Error in POST /shift-pool/shifts/:shiftId/apply:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/shifts/:shiftId/withdraw
 * Zieht eigene Bewerbung für eine Schicht zurück (über shiftId).
 */
router.post('/shifts/:shiftId/withdraw', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    const application = await withdrawMyApplication(tenant.id, shiftId, user.uid);

    res.json({
      application,
      message: 'Application withdrawn',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to withdraw application';

    if (message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'No pending application found for this shift') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('Cannot withdraw')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }

    console.error('Error in POST /shift-pool/shifts/:shiftId/withdraw:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/applications/:applicationId/withdraw
 * Zieht eigene Bewerbung zurück.
 */
router.post('/applications/:applicationId/withdraw', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { applicationId } = req.params;

  try {
    const application = await withdrawApplication(tenant.id, applicationId, user.uid);

    res.json({
      application,
      message: 'Application withdrawn',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to withdraw application';

    if (message === 'Application not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'Cannot withdraw application of another user') {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }
    if (message.includes('Cannot withdraw')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }

    console.error('Error in POST /shift-pool/applications/:applicationId/withdraw:', error);
    res.status(500).json({ error: message });
  }
});

export { router as shiftPoolRouter };
