/**
 * Shift Pool Routes
 *
 * Express Router für Schichtausschreibungs-Endpoints.
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth';
import { requireEntitlements, requireEntitlementsOrFreelancer, type TenantRequest, ENTITLEMENT_KEYS } from '../../core/entitlements';
import { getAdminFirestore } from '../../core/firebase';
import { MEMBER_ROLES } from '@timeam/shared';
import {
  createShift,
  updateShift,
  deleteShift,
  publishShift,
  closeShift,
  cancelShift,
  completeShift,
  getAdminShifts,
  getShiftById,
  getPoolList,
  getPublicPoolList,
  applyToShift,
  applyToPublicShift,
  getShiftApplications,
  getFreelancerApplications,
  getFreelancerShifts,
  acceptApplication,
  rejectApplication,
  unrejectApplication,
  withdrawApplication,
  revokeAcceptedApplication,
  withdrawMyApplication,
  getMyShifts,
  getShiftAssignments,
  assignMemberToShift,
  removeAssignment,
  getShiftTimeEntries,
  createShiftTimeEntry,
  updateShiftTimeEntry,
  uploadShiftDocument,
  getShiftDocuments,
  downloadShiftDocument,
  deleteShiftDocument,
} from './service';
import type {
  CreateShiftRequest,
  ApplyToShiftRequest,
  CreateShiftTimeEntryRequest,
  UpdateShiftTimeEntryRequest,
} from './types';

const router = Router();

// =============================================================================
// Middleware
// =============================================================================

// Multer für File-Uploads (Memory Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Alle Routes erfordern Auth + shift_pool Entitlement (für Tenants)
const shiftPoolGuard = [
  requireAuth,
  requireEntitlements([ENTITLEMENT_KEYS.MODULE_SHIFT_POOL]),
];

// Guard für Freelancer mit aktiviertem shift_pool Modul
const shiftPoolGuardOrFreelancer = [
  requireAuth,
  requireEntitlementsOrFreelancer([ENTITLEMENT_KEYS.MODULE_SHIFT_POOL]),
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.post('/shifts', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.get('/admin/shifts', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.put('/shifts/:shiftId', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.delete('/shifts/:shiftId', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.post('/shifts/:shiftId/publish', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.post('/shifts/:shiftId/close', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.post('/shifts/:shiftId/cancel', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.get('/shifts/:shiftId/applications', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.post('/applications/:applicationId/accept', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.post('/applications/:applicationId/reject', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * POST /api/shift-pool/applications/:applicationId/unreject
 * Zieht eine Ablehnung zurück (setzt Status zurück auf PENDING).
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.post('/applications/:applicationId/unreject', ...shiftPoolGuardOrFreelancer, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { applicationId } = req.params;

  try {
    const application = await unrejectApplication(tenant.id, applicationId, user.uid);

    res.json({
      application,
      message: 'Rejection undone - application is pending again',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unreject application';

    if (message === 'Application not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('Cannot unreject')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }

    console.error('Error in POST /shift-pool/applications/:applicationId/unreject:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/applications/:applicationId/revoke
 * Macht eine akzeptierte Bewerbung rückgängig (storniert Zuweisung).
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.post('/applications/:applicationId/revoke', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.get('/shifts/:shiftId/assignments', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.post('/shifts/:shiftId/assign', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.delete('/assignments/:assignmentId', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
// Public Routes (ohne Auth)
// =============================================================================

/**
 * GET /api/shift-pool/public/pool
 * Öffentliche Pool-Liste (alle Schichten mit isPublicPool: true aus allen Tenants).
 * Kein Auth erforderlich.
 */
router.get('/public/pool', async (req, res) => {
  const { from, to, location, q } = req.query;

  try {
    const shifts = await getPublicPoolList({
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
    console.error('Error in GET /shift-pool/public/pool:', error);
    const message = error instanceof Error ? error.message : 'Failed to get public pool';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/shift-pool/freelancer/applications
 * Lädt alle Bewerbungen des eingeloggten Freelancers.
 */
router.get('/freelancer/applications', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Prüfen ob User ein Freelancer ist
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isFreelancer) {
      res.status(403).json({ error: 'Only freelancers can access this endpoint' });
      return;
    }

    const applications = await getFreelancerApplications(user.uid);

    res.json({
      applications,
      count: applications.length,
    });
  } catch (error) {
    console.error('Error in GET /shift-pool/freelancer/applications:', error);
    const message = error instanceof Error ? error.message : 'Failed to get applications';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/shift-pool/freelancer/shifts
 * Lädt alle Schichten des eingeloggten Freelancers (angenommene Bewerbungen).
 */
router.get('/freelancer/shifts', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { includeCompleted } = req.query;

  try {
    // Prüfen ob User ein Freelancer ist
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isFreelancer) {
      res.status(403).json({ error: 'Only freelancers can access this endpoint' });
      return;
    }

    const shifts = await getFreelancerShifts(user.uid, {
      includeCompleted: includeCompleted === 'true',
    });

    res.json({
      shifts,
      count: shifts.length,
    });
  } catch (error) {
    console.error('Error in GET /shift-pool/freelancer/shifts:', error);
    const message = error instanceof Error ? error.message : 'Failed to get shifts';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/public/shifts/:shiftId/apply
 * Bewerbung auf öffentliche Schicht als Freelancer.
 * Auth erforderlich (Freelancer-Account).
 */
router.post('/public/shifts/:shiftId/apply', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { shiftId } = req.params;
  const body = req.body as ApplyToShiftRequest;

  try {
    const application = await applyToPublicShift(
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
    const message = error instanceof Error ? error.message : 'Failed to apply to shift';

    if (message.includes('not found') || message.includes('not available')) {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('deadline') || message.includes('bereits auf diese Schicht beworben')) {
      res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }
    if (message.includes('Only freelancers') || message.includes('Tenant members')) {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }

    console.error('Error in POST /shift-pool/public/shifts/:shiftId/apply:', error);
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
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.get('/shifts/:shiftId', ...shiftPoolGuardOrFreelancer, async (req, res) => {
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
    if (message === 'Sie haben sich bereits auf diese Schicht beworben') {
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

// =============================================================================
// Shift Completion
// =============================================================================

/**
 * POST /api/shift-pool/shifts/:shiftId/complete
 * Beendet eine Schicht (nur Crew-Leiter).
 * Erlaubt auch Freelancern mit aktiviertem shift_pool Modul.
 */
router.post('/shifts/:shiftId/complete', ...shiftPoolGuardOrFreelancer, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    const shift = await completeShift(tenant.id, shiftId, user.uid);

    res.json({
      shift,
      message: 'Shift completed successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete shift';

    if (message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('Only the crew leader') || message.includes('manager or admin')) {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }
    if (message.includes('already completed') || message.includes('Cannot complete')) {
      res.status(409).json({ error: message, code: 'INVALID_STATUS' });
      return;
    }

    console.error('Error in POST /shift-pool/shifts/:shiftId/complete:', error);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Shift Time Entries
// =============================================================================

/**
 * GET /api/shift-pool/shifts/:shiftId/time-entries
 * Lädt alle Zeiteinträge einer Schicht.
 */
router.get('/shifts/:shiftId/time-entries', ...shiftPoolGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    const entries = await getShiftTimeEntries(tenant.id, shiftId);

    res.json({
      entries,
      count: entries.length,
    });
  } catch (error) {
    console.error('Error in GET /shift-pool/shifts/:shiftId/time-entries:', error);
    const message = error instanceof Error ? error.message : 'Failed to get time entries';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/shift-pool/shifts/:shiftId/time-entries
 * Erstellt oder aktualisiert einen Zeiteintrag.
 */
router.post('/shifts/:shiftId/time-entries', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;
  const body = req.body as CreateShiftTimeEntryRequest;

  try {
    const entry = await createShiftTimeEntry(tenant.id, shiftId, user.uid, body);

    res.status(201).json({
      entry,
      message: 'Time entry created successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create time entry';

    if (message === 'Shift not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'User is not assigned to this shift') {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }
    if (message.includes('Only crew leader')) {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }
    if (message.includes('Invalid') || message.includes('must be') || message.includes('Maximum')) {
      res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in POST /shift-pool/shifts/:shiftId/time-entries:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/shift-pool/shifts/:shiftId/time-entries/:entryId
 * Aktualisiert einen Zeiteintrag.
 */
router.put('/shifts/:shiftId/time-entries/:entryId', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId, entryId } = req.params;
  const body = req.body as UpdateShiftTimeEntryRequest;

  try {
    const entry = await updateShiftTimeEntry(tenant.id, shiftId, entryId, user.uid, body);

    res.json({
      entry,
      message: 'Time entry updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update time entry';

    if (message === 'Time entry not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'Time entry does not belong to this shift') {
      res.status(409).json({ error: message, code: 'INVALID_SHIFT' });
      return;
    }
    if (message.includes('Only crew leader')) {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }
    if (message.includes('Invalid') || message.includes('must be') || message.includes('Maximum')) {
      res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in PUT /shift-pool/shifts/:shiftId/time-entries/:entryId:', error);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Shift Documents
// =============================================================================

/**
 * POST /api/shift-pool/shifts/:shiftId/documents
 * Lädt ein Dokument hoch.
 */
router.post(
  '/shifts/:shiftId/documents',
  ...shiftPoolGuard,
  upload.single('file'),
  async (req, res) => {
    const { user } = req as AuthenticatedRequest;
    const { tenant } = req as TenantRequest;
    const { shiftId } = req.params;

    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded', code: 'MISSING_FILE' });
        return;
      }

      const document = await uploadShiftDocument(tenant.id, shiftId, user.uid, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      res.status(201).json({
        document,
        message: 'Document uploaded successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload document';

      if (message === 'Shift not found') {
        res.status(404).json({ error: message, code: 'NOT_FOUND' });
        return;
      }
      if (message === 'Only assigned members can upload documents') {
        res.status(403).json({ error: message, code: 'FORBIDDEN' });
        return;
      }
      if (message.includes('Invalid file type') || message.includes('File size exceeds')) {
        res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
        return;
      }

      console.error('Error in POST /shift-pool/shifts/:shiftId/documents:', error);
      res.status(500).json({ error: message });
    }
  }
);

/**
 * GET /api/shift-pool/shifts/:shiftId/documents
 * Lädt alle Dokumente einer Schicht (nur Admin, Manager oder Crew-Leiter).
 */
router.get('/shifts/:shiftId/documents', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId } = req.params;

  try {
    const documents = await getShiftDocuments(tenant.id, shiftId, user.uid);

    res.json({
      documents,
      count: documents.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get documents';

    if (message.includes('Only crew leader')) {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }

    console.error('Error in GET /shift-pool/shifts/:shiftId/documents:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/shift-pool/shifts/:shiftId/documents/:documentId/download
 * Generiert eine Download-URL für ein Dokument.
 */
router.get('/shifts/:shiftId/documents/:documentId/download', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId, documentId } = req.params;

  try {
    const result = await downloadShiftDocument(tenant.id, shiftId, documentId, user.uid);

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate download URL';

    if (message === 'Document not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'Document does not belong to this shift') {
      res.status(409).json({ error: message, code: 'INVALID_SHIFT' });
      return;
    }
    if (message.includes('Only crew leader')) {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }

    console.error('Error in GET /shift-pool/shifts/:shiftId/documents/:documentId/download:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/shift-pool/shifts/:shiftId/documents/:documentId
 * Löscht ein Dokument.
 */
router.delete('/shifts/:shiftId/documents/:documentId', ...shiftPoolGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { shiftId, documentId } = req.params;

  try {
    await deleteShiftDocument(tenant.id, shiftId, documentId, user.uid);

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete document';

    if (message === 'Document not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'Document does not belong to this shift') {
      res.status(409).json({ error: message, code: 'INVALID_SHIFT' });
      return;
    }
    if (message.includes('Only crew leader')) {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }

    console.error('Error in DELETE /shift-pool/shifts/:shiftId/documents/:documentId:', error);
    res.status(500).json({ error: message });
  }
});

export { router as shiftPoolRouter };
