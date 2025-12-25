/**
 * Admin Routes
 *
 * API-Endpoints für das Super-Admin / Developer Dashboard.
 * Nur für Super-Admins (Plattform-Betreiber) zugänglich.
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth/index.js';
import { requireSuperAdmin, isSuperAdmin } from '../../core/super-admin/index.js';
import { getAllTenants, getTenantDetail, toggleTenantModule, getAllFreelancers, getFreelancerDetail, toggleFreelancerModule } from './service.js';
import type {
  TenantsListResponse,
  TenantDetail,
  ToggleTenantModuleResponse,
  FreelancersListResponse,
  FreelancerDetail,
  ToggleFreelancerModuleResponse,
} from './types.js';

const router = Router();

/**
 * GET /api/admin/check
 *
 * Prüft, ob der aktuelle User ein Super-Admin ist.
 * Wird vom Frontend verwendet, um das Developer Dashboard anzuzeigen.
 */
router.get(
  '/check',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    
    res.json({
      isSuperAdmin: isSuperAdmin(authReq.user.uid),
      uid: authReq.user.uid,
    });
  }
);

/**
 * GET /api/admin/tenants
 *
 * Gibt alle registrierten Tenants zurück.
 * Nur für Super-Admins.
 */
router.get(
  '/tenants',
  requireAuth,
  requireSuperAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const tenants = await getAllTenants();
      
      const response: TenantsListResponse = {
        tenants,
        total: tenants.length,
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error in GET /api/admin/tenants:', error);
      res.status(500).json({ error: 'Fehler beim Laden der Tenants' });
    }
  }
);

/**
 * GET /api/admin/tenants/:tenantId
 *
 * Gibt Detail-Informationen zu einem Tenant zurück.
 * Nur für Super-Admins.
 */
router.get(
  '/tenants/:tenantId',
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { tenantId } = req.params;
    
    try {
      const tenant = await getTenantDetail(tenantId);
      
      if (!tenant) {
        res.status(404).json({ error: 'Tenant nicht gefunden' });
        return;
      }
      
      res.json(tenant);
    } catch (error) {
      console.error(`Error in GET /api/admin/tenants/${tenantId}:`, error);
      res.status(500).json({ error: 'Fehler beim Laden des Tenants' });
    }
  }
);

/**
 * PUT /api/admin/tenants/:tenantId/modules/:moduleId
 *
 * Aktiviert oder deaktiviert ein Modul für einen Tenant.
 * Nur für Super-Admins.
 */
router.put(
  '/tenants/:tenantId/modules/:moduleId',
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { tenantId, moduleId } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    
    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        error: 'enabled (boolean) ist erforderlich',
        code: 'INVALID_REQUEST',
      });
      return;
    }
    
    try {
      const result = await toggleTenantModule(tenantId, moduleId, enabled);
      
      if (!result.success) {
        res.status(400).json({
          error: result.message,
          code: 'TOGGLE_FAILED',
        });
        return;
      }
      
      const response: ToggleTenantModuleResponse = {
        success: true,
        tenantId,
        moduleId,
        enabled,
        message: result.message,
      };
      
      res.json(response);
    } catch (error) {
      console.error(`Error in PUT /api/admin/tenants/${tenantId}/modules/${moduleId}:`, error);
      res.status(500).json({ error: 'Fehler beim Ändern des Moduls' });
    }
  }
);

/**
 * GET /api/admin/freelancers
 *
 * Gibt alle registrierten Freelancer zurück.
 * Nur für Super-Admins.
 */
router.get(
  '/freelancers',
  requireAuth,
  requireSuperAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const freelancers = await getAllFreelancers();
      
      const response: FreelancersListResponse = {
        freelancers,
        total: freelancers.length,
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error in GET /api/admin/freelancers:', error);
      res.status(500).json({ error: 'Fehler beim Laden der Freelancer' });
    }
  }
);

/**
 * GET /api/admin/freelancers/:freelancerUid
 *
 * Gibt Detail-Informationen zu einem Freelancer zurück.
 * Nur für Super-Admins.
 */
router.get(
  '/freelancers/:freelancerUid',
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { freelancerUid } = req.params;
    
    try {
      const freelancer = await getFreelancerDetail(freelancerUid);
      
      if (!freelancer) {
        res.status(404).json({ error: 'Freelancer nicht gefunden' });
        return;
      }
      
      res.json(freelancer);
    } catch (error) {
      console.error(`Error in GET /api/admin/freelancers/${freelancerUid}:`, error);
      res.status(500).json({ error: 'Fehler beim Laden des Freelancers' });
    }
  }
);

/**
 * PUT /api/admin/freelancers/:freelancerUid/modules/:moduleId
 *
 * Aktiviert oder deaktiviert ein Modul für einen Freelancer.
 * Nur für Super-Admins.
 */
router.put(
  '/freelancers/:freelancerUid/modules/:moduleId',
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { freelancerUid, moduleId } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    
    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        error: 'enabled (boolean) ist erforderlich',
        code: 'INVALID_REQUEST',
      });
      return;
    }
    
    try {
      const result = await toggleFreelancerModule(freelancerUid, moduleId, enabled);
      
      if (!result.success) {
        res.status(400).json({
          error: result.message,
          code: 'TOGGLE_FAILED',
        });
        return;
      }
      
      const response: ToggleFreelancerModuleResponse = {
        success: true,
        freelancerUid,
        moduleId,
        enabled,
        message: result.message,
      };
      
      res.json(response);
    } catch (error) {
      console.error(`Error in PUT /api/admin/freelancers/${freelancerUid}/modules/${moduleId}:`, error);
      res.status(500).json({ error: 'Fehler beim Ändern des Moduls' });
    }
  }
);

export const adminRouter = router;
