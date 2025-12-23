/**
 * Settings Routes
 *
 * API-Endpoints für Admin-Einstellungen (Modul-Verwaltung).
 * Nur für Admins zugänglich.
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../core/auth';
import { requireTenantOnly, type TenantRequest } from '../../core/entitlements';
import { getTenantForUser } from '../../core/tenancy';
import { getModuleStatus, toggleModule } from './service';
import type { ToggleModuleRequest, ModuleStatusResponse, ToggleModuleResponse } from './types';

const router = Router();

/**
 * Middleware: Nur Admins dürfen auf Settings zugreifen.
 */
async function requireAdmin(req: Request, res: Response, next: () => void): Promise<void> {
  const tenantReq = req as TenantRequest;
  
  // Lade Member-Info um Rolle zu prüfen
  const tenantData = await getTenantForUser(tenantReq.user.uid);
  
  if (!tenantData) {
    res.status(403).json({ error: 'Kein Tenant-Zugriff' });
    return;
  }
  
  if (tenantData.member.role !== 'admin') {
    res.status(403).json({ 
      error: 'Nur Admins können Einstellungen ändern',
      code: 'ADMIN_REQUIRED',
    });
    return;
  }
  
  next();
}

/**
 * GET /api/settings/modules
 *
 * Gibt den Status aller Module für den aktuellen Tenant zurück.
 * Nur für Admins.
 */
router.get(
  '/modules',
  requireAuth,
  requireTenantOnly(),
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const tenantReq = req as TenantRequest;
    
    try {
      const modules = await getModuleStatus(tenantReq.tenant.id);
      
      const response: ModuleStatusResponse = { modules };
      res.json(response);
    } catch (error) {
      console.error('Error in GET /api/settings/modules:', error);
      res.status(500).json({ error: 'Fehler beim Laden der Module' });
    }
  }
);

/**
 * PUT /api/settings/modules/:moduleId
 *
 * Aktiviert oder deaktiviert ein Modul.
 * Nur für Admins.
 */
router.put(
  '/modules/:moduleId',
  requireAuth,
  requireTenantOnly(),
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const tenantReq = req as TenantRequest;
    const { moduleId } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    
    // Validierung
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ 
        error: 'enabled (boolean) ist erforderlich',
        code: 'INVALID_REQUEST',
      });
      return;
    }
    
    try {
      const result = await toggleModule(tenantReq.tenant.id, moduleId, enabled);
      
      if (!result.success) {
        res.status(400).json({ 
          error: result.message,
          code: 'TOGGLE_FAILED',
        });
        return;
      }
      
      const response: ToggleModuleResponse = {
        success: true,
        moduleId,
        enabled,
        message: result.message,
      };
      
      res.json(response);
    } catch (error) {
      console.error(`Error in PUT /api/settings/modules/${moduleId}:`, error);
      res.status(500).json({ error: 'Fehler beim Ändern des Moduls' });
    }
  }
);

export const settingsRouter = router;
