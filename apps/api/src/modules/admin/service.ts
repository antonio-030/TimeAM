/**
 * Admin Service
 *
 * Business Logic für das Super-Admin / Developer Dashboard.
 */

import { getAdminFirestore } from '../../core/firebase';
import { getEntitlements, setEntitlement } from '../../core/tenancy';
import {
  MODULE_REGISTRY,
  getOptionalModules,
  getCoreModules,
  isCoreModule,
} from '@timeam/shared';
import type {
  TenantOverview,
  TenantDetail,
  TenantMemberInfo,
  TenantModuleStatus,
} from './types';

/**
 * Lädt alle Tenants für das Developer Dashboard.
 */
export async function getAllTenants(): Promise<TenantOverview[]> {
  const db = getAdminFirestore();
  const tenantsSnap = await db.collection('tenants').get();
  
  const tenants: TenantOverview[] = [];
  
  for (const doc of tenantsSnap.docs) {
    const data = doc.data();
    
    // Member-Count laden
    const membersSnap = await doc.ref.collection('members').get();
    
    // Entitlements laden
    const entitlements = await getEntitlements(doc.id);
    
    // Aktive optionale Module ermitteln
    const activeModules: string[] = [];
    for (const mod of getOptionalModules()) {
      if (mod.entitlementKey && entitlements[mod.entitlementKey] === true) {
        activeModules.push(mod.id);
      }
    }
    
    tenants.push({
      id: doc.id,
      name: data.name || 'Unbekannt',
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      memberCount: membersSnap.size,
      activeModules,
    });
  }
  
  // Nach Erstellungsdatum sortieren (neueste zuerst)
  tenants.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return tenants;
}

/**
 * Lädt Detail-Informationen zu einem Tenant.
 */
export async function getTenantDetail(tenantId: string): Promise<TenantDetail | null> {
  const db = getAdminFirestore();
  const tenantRef = db.collection('tenants').doc(tenantId);
  const tenantSnap = await tenantRef.get();
  
  if (!tenantSnap.exists) {
    return null;
  }
  
  const data = tenantSnap.data()!;
  
  // Members laden
  const membersSnap = await tenantRef.collection('members').get();
  const members: TenantMemberInfo[] = membersSnap.docs.map(doc => {
    const memberData = doc.data();
    return {
      uid: doc.id,
      email: memberData.email || '',
      role: memberData.role || 'employee',
      joinedAt: memberData.joinedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  });
  
  // Modul-Status ermitteln
  const entitlements = await getEntitlements(tenantId);
  const modules: TenantModuleStatus[] = [];
  
  // Core-Module
  for (const mod of getCoreModules()) {
    modules.push({
      id: mod.id,
      displayName: mod.displayName,
      description: mod.description,
      icon: mod.icon,
      category: 'core',
      isActive: true,
      canToggle: false,
    });
  }
  
  // Optionale Module
  for (const mod of getOptionalModules()) {
    const entitlementKey = mod.entitlementKey;
    let isActive = false;
    
    if (entitlementKey) {
      const value = entitlements[entitlementKey];
      isActive = value === true;
    }
    
    modules.push({
      id: mod.id,
      displayName: mod.displayName,
      description: mod.description,
      icon: mod.icon,
      category: 'optional',
      isActive,
      canToggle: true,
    });
  }
  
  return {
    id: tenantId,
    name: data.name || 'Unbekannt',
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    createdBy: data.createdBy || '',
    members,
    modules,
  };
}

/**
 * Aktiviert oder deaktiviert ein Modul für einen Tenant.
 * Nur für Super-Admins.
 */
export async function toggleTenantModule(
  tenantId: string,
  moduleId: string,
  enabled: boolean
): Promise<{ success: boolean; message: string }> {
  const mod = MODULE_REGISTRY[moduleId];
  
  if (!mod) {
    return {
      success: false,
      message: `Modul "${moduleId}" nicht gefunden`,
    };
  }
  
  if (isCoreModule(moduleId)) {
    return {
      success: false,
      message: `${mod.displayName} ist ein Core-Modul und kann nicht geändert werden`,
    };
  }
  
  const entitlementKey = mod.entitlementKey;
  
  if (!entitlementKey) {
    return {
      success: false,
      message: `Modul "${moduleId}" hat keinen Entitlement-Key`,
    };
  }
  
  // Prüfe ob Tenant existiert
  const db = getAdminFirestore();
  const tenantSnap = await db.collection('tenants').doc(tenantId).get();
  
  if (!tenantSnap.exists) {
    return {
      success: false,
      message: `Tenant "${tenantId}" nicht gefunden`,
    };
  }
  
  // Entitlement setzen
  await setEntitlement(tenantId, entitlementKey, enabled);
  
  const action = enabled ? 'aktiviert' : 'deaktiviert';
  const tenantName = tenantSnap.data()?.name || tenantId;
  
  console.log(`🔧 Super-Admin: ${mod.displayName} ${action} für ${tenantName}`);
  
  return {
    success: true,
    message: `${mod.displayName} wurde für "${tenantName}" ${action}`,
  };
}
