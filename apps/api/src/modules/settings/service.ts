/**
 * Settings Service
 *
 * Business Logic für die Admin-Einstellungen.
 */

import {
  MODULE_REGISTRY,
  MODULE_CATEGORY,
  MODULE_TARGET_TENANT,
  getOptionalModules,
  getCoreModules,
  isCoreModule,
  getModulesForTenant,
} from '@timeam/shared';
import { getEntitlements, setEntitlement } from '../../core/tenancy/index.js';
import type { ModuleStatusItem } from './types.js';

/**
 * Lädt den Status aller Module für einen Tenant.
 */
export async function getModuleStatus(tenantId: string): Promise<ModuleStatusItem[]> {
  const entitlements = await getEntitlements(tenantId);
  
  const modules: ModuleStatusItem[] = [];
  
  // WICHTIG: Nur Module laden, die für diesen Tenant-Typ verfügbar sind
  const availableModules = getModulesForTenant(tenantId);
  
  // Core-Module sind immer aktiv
  const coreModules = availableModules.filter(m => m.category === MODULE_CATEGORY.CORE);
  for (const mod of coreModules) {
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
  
  // Optionale Module basierend auf Entitlements (nur für diesen Tenant-Typ verfügbare)
  const optionalModules = availableModules.filter(m => m.category === MODULE_CATEGORY.OPTIONAL);
  for (const mod of optionalModules) {
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
