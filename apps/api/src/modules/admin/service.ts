/**
 * Admin Service
 *
 * Business Logic für das Super-Admin / Developer Dashboard.
 */

import { getAdminFirestore } from '../../core/firebase';
import { getEntitlements, setEntitlement, getUserDocument, getFreelancerEntitlements, setFreelancerEntitlement } from '../../core/tenancy';
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
  FreelancerOverview,
  FreelancerDetail,
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
    
    // User-Daten des Erstellers laden
    const createdByUid = data.createdBy || '';
    let createdByName: string | undefined;
    let createdByEmail: string | undefined;
    
    if (createdByUid) {
      try {
        const userDoc = await getUserDocument(createdByUid);
        if (userDoc) {
          createdByName = userDoc.displayName || undefined;
          createdByEmail = userDoc.email || undefined;
        }
      } catch (err) {
        // User-Dokument nicht gefunden oder Fehler - ignorieren
        console.warn(`Could not load user document for ${createdByUid}:`, err);
      }
    }
    
    tenants.push({
      id: doc.id,
      name: data.name || 'Unbekannt',
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      memberCount: membersSnap.size,
      activeModules,
      createdBy: createdByUid,
      createdByName,
      createdByEmail,
      address: data.address || undefined, // Optional, falls später hinzugefügt
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
      displayName: memberData.displayName || undefined,
      firstName: memberData.firstName || undefined,
      lastName: memberData.lastName || undefined,
      address: memberData.address || undefined,
      role: (memberData.role || 'employee') as 'admin' | 'manager' | 'employee',
      joinedAt: memberData.joinedAt?.toDate?.()?.toISOString() || 
                memberData.createdAt?.toDate?.()?.toISOString() || 
                new Date().toISOString(),
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
  
  // User-Daten des Erstellers laden
  const createdByUid = data.createdBy || '';
  let createdByName: string | undefined;
  let createdByFirstName: string | undefined;
  let createdByLastName: string | undefined;
  let createdByEmail: string | undefined;
  let tenantAddress: string | undefined;
  
  if (createdByUid) {
    try {
      // Zuerst versuchen, Member-Daten zu laden (falls der Ersteller ein Member ist)
      const creatorMember = members.find(m => m.uid === createdByUid);
      if (creatorMember) {
        createdByFirstName = creatorMember.firstName;
        createdByLastName = creatorMember.lastName;
        createdByName = creatorMember.displayName || 
                       (creatorMember.firstName && creatorMember.lastName 
                         ? `${creatorMember.firstName} ${creatorMember.lastName}`
                         : undefined);
        createdByEmail = creatorMember.email;
        // Adresse vom Ersteller-Member holen, falls verfügbar
        tenantAddress = creatorMember.address;
      } else {
        // Fallback: User-Dokument laden
        const userDoc = await getUserDocument(createdByUid);
        if (userDoc) {
          createdByName = userDoc.displayName || undefined;
          createdByEmail = userDoc.email || undefined;
        }
      }
    } catch (err) {
      // User-Dokument nicht gefunden oder Fehler - ignorieren
      console.warn(`Could not load user document for ${createdByUid}:`, err);
    }
  }
  
  // Fallback: Adresse vom Tenant-Dokument, falls nicht vom Member
  if (!tenantAddress) {
    tenantAddress = data.address || undefined;
  }
  
  return {
    id: tenantId,
    name: data.name || 'Unbekannt',
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    createdBy: createdByUid,
    createdByName,
    createdByFirstName,
    createdByLastName,
    createdByEmail,
    address: tenantAddress,
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

/**
 * Lädt alle Freelancer für das Developer Dashboard.
 */
export async function getAllFreelancers(): Promise<FreelancerOverview[]> {
  const db = getAdminFirestore();
  const freelancersSnap = await db.collection('freelancers').get();
  
  const freelancers: FreelancerOverview[] = [];
  
  for (const doc of freelancersSnap.docs) {
    const data = doc.data();
    
    // Entitlements laden
    const entitlements = await getFreelancerEntitlements(doc.id);
    
    // Aktive optionale Module ermitteln
    const activeModules: string[] = [];
    for (const mod of getOptionalModules()) {
      if (mod.entitlementKey && entitlements[mod.entitlementKey] === true) {
        activeModules.push(mod.id);
      }
    }
    
    freelancers.push({
      uid: doc.id,
      email: data.email || '',
      displayName: data.displayName || 'Unbekannt',
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      companyName: data.companyName || undefined,
      address: data.address || undefined,
      tenantId: data.tenantId || undefined,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      activeModules,
      verificationStatus: data.verificationStatus || undefined,
    });
  }
  
  // Nach Erstellungsdatum sortieren (neueste zuerst)
  freelancers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return freelancers;
}

/**
 * Lädt Detail-Informationen zu einem Freelancer.
 */
export async function getFreelancerDetail(freelancerUid: string): Promise<FreelancerDetail | null> {
  const db = getAdminFirestore();
  const freelancerRef = db.collection('freelancers').doc(freelancerUid);
  const freelancerSnap = await freelancerRef.get();
  
  if (!freelancerSnap.exists) {
    return null;
  }
  
  const data = freelancerSnap.data()!;
  
  // Modul-Status ermitteln
  const entitlements = await getFreelancerEntitlements(freelancerUid);
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
    uid: freelancerUid,
    email: data.email || '',
    displayName: data.displayName || 'Unbekannt',
    firstName: data.firstName || undefined,
    lastName: data.lastName || undefined,
    companyName: data.companyName || undefined,
    tenantId: data.tenantId || undefined,
    phone: data.phone || undefined,
    address: data.address || undefined,
    businessLicenseNumber: data.businessLicenseNumber || undefined,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    verificationStatus: data.verificationStatus || undefined,
    modules,
  };
}

/**
 * Aktiviert oder deaktiviert ein Modul für einen Freelancer.
 * Nur für Super-Admins.
 */
export async function toggleFreelancerModule(
  freelancerUid: string,
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
  
  // Prüfe ob Freelancer existiert
  const db = getAdminFirestore();
  const freelancerSnap = await db.collection('freelancers').doc(freelancerUid).get();
  
  if (!freelancerSnap.exists) {
    return {
      success: false,
      message: `Freelancer "${freelancerUid}" nicht gefunden`,
    };
  }
  
  // Entitlement setzen
  await setFreelancerEntitlement(freelancerUid, entitlementKey, enabled);
  
  const action = enabled ? 'aktiviert' : 'deaktiviert';
  const freelancerName = freelancerSnap.data()?.displayName || freelancerUid;
  
  console.log(`🔧 Super-Admin: ${mod.displayName} ${action} für Freelancer ${freelancerName}`);
  
  return {
    success: true,
    message: `${mod.displayName} wurde für "${freelancerName}" ${action}`,
  };
}
