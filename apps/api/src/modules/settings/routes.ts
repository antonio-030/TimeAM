/**
 * Settings Routes
 *
 * API-Endpoints für Admin-Einstellungen (Modul-Verwaltung).
 * Nur für Admins zugänglich.
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../core/auth/index.js';
import { requireTenantOnly, type TenantRequest } from '../../core/entitlements/index.js';
import { getTenantForUser, updateTenantName } from '../../core/tenancy/index.js';
import { getModuleStatus, toggleModule } from './service.js';
import type { ToggleModuleRequest, ModuleStatusResponse, ToggleModuleResponse } from './types.js';

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

/**
 * PATCH /api/settings/tenant-name
 *
 * Aktualisiert den Namen des Tenants.
 * Nur für Admins.
 */
router.patch(
  '/tenant-name',
  requireAuth,
  requireTenantOnly(),
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const tenantReq = req as TenantRequest;
    const { name } = req.body as { name?: string };
    
    // Validierung
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ 
        error: 'Name ist erforderlich (min. 2 Zeichen)',
        code: 'INVALID_NAME',
      });
      return;
    }
    
    try {
      await updateTenantName(tenantReq.tenant.id, name.trim());
      
      res.json({
        success: true,
        message: 'Tenant-Name erfolgreich aktualisiert',
        name: name.trim(),
      });
    } catch (error) {
      console.error('Error in PATCH /api/settings/tenant-name:', error);
      const message = error instanceof Error ? error.message : 'Fehler beim Aktualisieren des Tenant-Namens';
      res.status(500).json({ error: message });
    }
  }
);

export const settingsRouter = router;
