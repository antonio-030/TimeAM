/**
 * Support Routes
 *
 * Express Router für Support-Endpoints.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth';
import { requireSuperAdmin } from '../../core/super-admin';
import { getAdminFirestore } from '../../core/firebase';
import {
  createDevStaff,
  getAllDevStaff,
  getDevStaff,
  updateDevStaffPermissions,
  deleteDevStaff,
  isDevStaff,
  getAllVerifications,
  approveVerification,
  rejectVerification,
  getVerificationDocumentUrlForDev,
} from './service';
import type {
  CreateDevStaffRequest,
  ApproveVerificationRequest,
  RejectVerificationRequest,
  UpdateDevStaffPermissionsRequest,
} from './types';

const router = Router();

// =============================================================================
// Dev Staff Management (nur Super-Admin)
// =============================================================================

/**
 * POST /api/admin/dev-staff
 * Erstellt einen neuen Dev-Mitarbeiter (nur Super-Admin).
 */
router.post('/admin/dev-staff', requireAuth, requireSuperAdmin, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const body = req.body as CreateDevStaffRequest;

  try {
    // Dev-Tenant erstellen (falls noch nicht vorhanden)
    const { getOrCreateDevTenant } = await import('./service');
    await getOrCreateDevTenant(user.uid);

    const devStaff = await createDevStaff(body, user.uid);

    res.status(201).json({
      devStaff,
      message: 'Dev staff member created successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create dev staff';

    if (message.includes('required') || message.includes('Valid') || message.includes('must be')) {
      res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }
    if (message.includes('already exists')) {
      res.status(409).json({ error: message, code: 'DUPLICATE' });
      return;
    }
    if (message.includes('Failed to create user account')) {
      res.status(500).json({ error: message, code: 'AUTH_ERROR' });
      return;
    }

    console.error('Error in POST /admin/dev-staff:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/dev-staff
 * Lädt alle Dev-Mitarbeiter (nur Super-Admin).
 */
router.get('/admin/dev-staff', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const devStaff = await getAllDevStaff();

    res.json({ devStaff });
  } catch (error) {
    console.error('Error in GET /admin/dev-staff:', error);
    const message = error instanceof Error ? error.message : 'Failed to get dev staff';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/admin/dev-staff/:uid
 * Lädt einen Dev-Mitarbeiter (nur Super-Admin).
 */
router.get('/admin/dev-staff/:uid', requireAuth, requireSuperAdmin, async (req, res) => {
  const { uid } = req.params;

  try {
    const devStaff = await getDevStaff(uid);

    if (!devStaff) {
      res.status(404).json({ error: 'Dev staff member not found' });
      return;
    }

    res.json({ devStaff });
  } catch (error) {
    console.error('Error in GET /admin/dev-staff/:uid:', error);
    const message = error instanceof Error ? error.message : 'Failed to get dev staff';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/admin/dev-staff/:uid/permissions
 * Aktualisiert die Rechte eines Dev-Mitarbeiters (nur Super-Admin).
 */
router.put('/admin/dev-staff/:uid/permissions', requireAuth, requireSuperAdmin, async (req, res) => {
  const { uid } = req.params;
  const body = req.body as UpdateDevStaffPermissionsRequest;

  try {
    const devStaff = await updateDevStaffPermissions(uid, body);

    res.json({
      devStaff,
      message: 'Permissions updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update permissions';

    if (message === 'Dev staff member not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('required')) {
      res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in PUT /admin/dev-staff/:uid/permissions:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/admin/dev-staff/:uid
 * Entfernt einen Dev-Mitarbeiter (nur Super-Admin).
 */
router.delete('/admin/dev-staff/:uid', requireAuth, requireSuperAdmin, async (req, res) => {
  const { uid } = req.params;

  try {
    await deleteDevStaff(uid);

    res.json({ message: 'Dev staff member deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete dev staff';

    if (message === 'Dev staff member not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }

    console.error('Error in DELETE /admin/dev-staff/:uid:', error);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Verification Review (Dev-Mitarbeiter)
// =============================================================================

// Middleware requireDevStaff wird direkt in den Routes verwendet

/**
 * GET /api/support/check
 * Prüft ob User ein Dev-Mitarbeiter ist.
 */
router.get('/support/check', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    const isDev = await isDevStaff(user.uid);
    res.json({ isDevStaff: isDev });
  } catch (error) {
    console.error('Error in GET /support/check:', error);
    const message = error instanceof Error ? error.message : 'Failed to check dev staff status';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/support/verifications
 * Lädt alle Verifizierungen (nur Dev-Mitarbeiter).
 */
router.get('/support/verifications', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Prüfen ob User ein Dev-Mitarbeiter ist
    const isDev = await isDevStaff(user.uid);
    if (!isDev) {
      res.status(403).json({ error: 'Dev staff access required' });
      return;
    }

    const verifications = await getAllVerifications();

    res.json({ verifications });
  } catch (error) {
    console.error('Error in GET /support/verifications:', error);
    const message = error instanceof Error ? error.message : 'Failed to get verifications';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/support/verifications/:freelancerUid/approve
 * Genehmigt eine Verifizierung (nur Dev-Mitarbeiter).
 */
router.post('/support/verifications/:freelancerUid/approve', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { freelancerUid } = req.params;
  const body = req.body as ApproveVerificationRequest;

  try {
    // Prüfen ob User ein Dev-Mitarbeiter ist
    const isDev = await isDevStaff(user.uid);
    if (!isDev) {
      res.status(403).json({ error: 'Dev staff access required' });
      return;
    }

    await approveVerification(freelancerUid, user.uid, body.companyName);

    res.json({ message: 'Verification approved successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve verification';

    if (message === 'Freelancer not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }

    console.error('Error in POST /support/verifications/:freelancerUid/approve:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/support/verifications/:freelancerUid/reject
 * Lehnt eine Verifizierung ab (nur Dev-Mitarbeiter).
 */
router.post('/support/verifications/:freelancerUid/reject', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { freelancerUid } = req.params;
  const body = req.body as RejectVerificationRequest;

  try {
    // Prüfen ob User ein Dev-Mitarbeiter ist
    const isDev = await isDevStaff(user.uid);
    if (!isDev) {
      res.status(403).json({ error: 'Dev staff access required' });
      return;
    }

    if (!body.reason || body.reason.trim().length < 3) {
      res.status(422).json({ error: 'Rejection reason is required (min. 3 characters)', code: 'VALIDATION_ERROR' });
      return;
    }

    await rejectVerification(freelancerUid, user.uid, body.reason);

    res.json({ message: 'Verification rejected successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject verification';

    if (message === 'Freelancer not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message.includes('required')) {
      res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Error in POST /support/verifications/:freelancerUid/reject:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/support/verifications/:freelancerUid/document
 * Lädt die Download-URL für ein Verifizierungs-Dokument (nur Dev-Mitarbeiter).
 */
router.get('/support/verifications/:freelancerUid/document', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { freelancerUid } = req.params;

  try {
    // Prüfen ob User ein Dev-Mitarbeiter ist
    const isDev = await isDevStaff(user.uid);
    if (!isDev) {
      res.status(403).json({ error: 'Dev staff access required' });
      return;
    }

    const url = await getVerificationDocumentUrlForDev(freelancerUid);

    res.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get document URL';

    if (message === 'Freelancer not found' || message === 'Verification document not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }

    console.error('Error in GET /support/verifications/:freelancerUid/document:', error);
    res.status(500).json({ error: message });
  }
});

export { router as supportRouter };

