/**
 * Settings Service
 *
 * Business Logic für die Admin-Einstellungen.
 */

import {
  MODULE_REGISTRY,
  MODULE_CATEGORY,
  getOptionalModules,
  getCoreModules,
  isCoreModule,
} from '@timeam/shared';
import { getEntitlements, setEntitlement } from '../../core/tenancy';
import type { ModuleStatusItem } from './types';

/**
 * Lädt den Status aller Module für einen Tenant.
 */
export async function getModuleStatus(tenantId: string): Promise<ModuleStatusItem[]> {
  const entitlements = await getEntitlements(tenantId);
  
  const modules: ModuleStatusItem[] = [];
  
  // Core-Module sind immer aktiv
  for (const mod of getCoreModules()) {
    modules.push({
      id: mod.id,
      displayName: mod.displayName,
      description: mod.description,
      icon: mod.icon,
      category: 'core',
      isActive: true,
      canToggle: false, // Core-Module können nicht deaktiviert werden
    });
  }
  
  // Optionale Module basierend auf Entitlements
  for (const mod of getOptionalModules()) {
    const entitlementKey = mod.entitlementKey;
    let isActive = false;
    
    if (entitlementKey) {
      const value = entitlements[entitlementKey];
      isActive = value === true || 
        (typeof value === 'string' && value !== '') || 
        (typeof value === 'number' && value > 0);
    }
    
    modules.push({
      id: mod.id,
      displayName: mod.displayName,
      description: mod.description,
      icon: mod.icon,
      category: 'optional',
      isActive,
      canToggle: true, // Optionale Module können getoggelt werden
    });
  }
  
  return modules;
}

/**
 * Aktiviert oder deaktiviert ein Modul für einen Tenant.
 */
export async function toggleModule(
  tenantId: string,
  moduleId: string,
  enabled: boolean
): Promise<{ success: boolean; message: string }> {
  // Prüfe, ob Modul existiert
  const mod = MODULE_REGISTRY[moduleId];
  
  if (!mod) {
    return {
      success: false,
      message: `Modul "${moduleId}" nicht gefunden`,
    };
  }
  
  // Core-Module können nicht deaktiviert werden
  if (isCoreModule(moduleId)) {
    return {
      success: false,
      message: `${mod.displayName} ist ein Core-Modul und kann nicht deaktiviert werden`,
    };
  }
  
  // Entitlement-Key ermitteln
  const entitlementKey = mod.entitlementKey;
  
  if (!entitlementKey) {
    return {
      success: false,
      message: `Modul "${moduleId}" hat keinen Entitlement-Key`,
    };
  }
  
  // Entitlement setzen
  await setEntitlement(tenantId, entitlementKey, enabled);
  
  const action = enabled ? 'aktiviert' : 'deaktiviert';
  
  return {
    success: true,
    message: `${mod.displayName} wurde ${action}`,
  };
}
