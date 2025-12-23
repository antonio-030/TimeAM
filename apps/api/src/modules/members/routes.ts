/**
 * Members Routes
 *
 * Express Router für Mitarbeiterverwaltungs-Endpoints.
 */

import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth';
import { requireEntitlements, type TenantRequest, ENTITLEMENT_KEYS } from '../../core/entitlements';
import {
  getMembers,
  getMemberById,
  getMemberShifts,
  inviteMember,
  updateMember,
  deleteMember,
  activateMember,
  deactivateMember,
} from './service';
import type { InviteMemberRequest, UpdateMemberRequest } from './types';

const router = Router();

// =============================================================================
// Middleware
// =============================================================================

// Alle Routes erfordern Auth (Mitarbeiterverwaltung ist für jeden Tenant verfügbar)
const membersGuard = [requireAuth, requireEntitlements([])];

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/members
 * Liste aller Mitarbeiter.
 */
router.get('/', ...membersGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;

  try {
    const { members, stats } = await getMembers(tenant.id);

    res.json({
      members,
      count: members.length,
      stats,
    });
  } catch (error) {
    console.error('Error in GET /members:', error);
    const message = error instanceof Error ? error.message : 'Failed to get members';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/members/:memberId
 * Details eines Mitarbeiters.
 */
router.get('/:memberId', ...membersGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { memberId } = req.params;

  try {
    const member = await getMemberById(tenant.id, memberId);

    if (!member) {
      res.status(404).json({ error: 'Member not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({ member });
  } catch (error) {
    console.error('Error in GET /members/:memberId:', error);
    const message = error instanceof Error ? error.message : 'Failed to get member';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/members/:memberId/shifts
 * Schichten eines Mitarbeiters (angenommen + zugewiesen).
 */
router.get('/:memberId/shifts', ...membersGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { memberId } = req.params;
  const includeCompleted = req.query.includeCompleted === 'true';

  try {
    const member = await getMemberById(tenant.id, memberId);

    if (!member) {
      res.status(404).json({ error: 'Member not found', code: 'NOT_FOUND' });
      return;
    }

    const shifts = await getMemberShifts(tenant.id, member.uid, { includeCompleted });

    res.json({
      shifts,
      count: shifts.length,
    });
  } catch (error) {
    console.error('Error in GET /members/:memberId/shifts:', error);
    const message = error instanceof Error ? error.message : 'Failed to get member shifts';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/members
 * Neuen Mitarbeiter einladen.
 * Erstellt Firebase Auth User und gibt optional einen Password Reset Link zurück.
 */
router.post('/', ...membersGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const body = req.body as InviteMemberRequest;

  try {
    const { member, passwordResetLink } = await inviteMember(tenant.id, user.uid, body);

    res.status(201).json({
      member,
      passwordResetLink, // Link zum Passwort setzen (nur beim Erstellen verfügbar)
      message: 'Member invited successfully. User can set their password via the reset link.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to invite member';

    if (message.includes('required') || message.includes('Valid')) {
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

    console.error('Error in POST /members:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/members/:memberId
 * Mitarbeiter aktualisieren.
 */
router.put('/:memberId', ...membersGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { memberId } = req.params;
  const body = req.body as UpdateMemberRequest;

  try {
    const member = await updateMember(tenant.id, memberId, body);

    res.json({
      member,
      message: 'Member updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update member';

    if (message === 'Member not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }

    console.error('Error in PUT /members/:memberId:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/members/:memberId
 * Mitarbeiter löschen.
 */
router.delete('/:memberId', ...membersGuard, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenant } = req as TenantRequest;
  const { memberId } = req.params;

  try {
    await deleteMember(tenant.id, memberId, user.uid);

    res.json({
      success: true,
      message: 'Member deleted successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete member';

    if (message === 'Member not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    if (message === 'Cannot delete yourself') {
      res.status(403).json({ error: message, code: 'FORBIDDEN' });
      return;
    }

    console.error('Error in DELETE /members/:memberId:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/members/:memberId/activate
 * Mitarbeiter aktivieren.
 */
router.post('/:memberId/activate', ...membersGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { memberId } = req.params;

  try {
    const member = await activateMember(tenant.id, memberId);

    res.json({
      member,
      message: 'Member activated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to activate member';

    if (message === 'Member not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }

    console.error('Error in POST /members/:memberId/activate:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/members/:memberId/deactivate
 * Mitarbeiter deaktivieren.
 */
router.post('/:memberId/deactivate', ...membersGuard, async (req, res) => {
  const { tenant } = req as TenantRequest;
  const { memberId } = req.params;

  try {
    const member = await deactivateMember(tenant.id, memberId);

    res.json({
      member,
      message: 'Member deactivated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate member';

    if (message === 'Member not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }

    console.error('Error in POST /members/:memberId/deactivate:', error);
    res.status(500).json({ error: message });
  }
});

export { router as membersRouter };
