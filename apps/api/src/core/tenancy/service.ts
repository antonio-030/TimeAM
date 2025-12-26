/**
 * Tenancy Service
 *
 * Firestore-basierte Tenant-Verwaltung.
 */

import { getAdminFirestore } from '../firebase/index.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/** Tenant-Dokument */
export interface TenantDoc {
  name: string;
  createdAt: Timestamp;
  createdBy: string;
}

/** Member-Dokument */
export interface MemberDoc {
  uid: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  joinedAt: Timestamp;
  invitedBy?: string;
}

/** Entitlement-Dokument */
export interface EntitlementDoc {
  key: string;
  value: boolean | string | number;
  grantedAt: Timestamp;
}

/** User-Dokument */
export interface UserDoc {
  email: string;
  displayName?: string;
  defaultTenantId?: string;
  createdAt: Timestamp;
}

/**
 * Lädt das User-Dokument aus Firestore.
 */
export async function getUserDocument(uid: string): Promise<UserDoc | null> {
  const db = getAdminFirestore();
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return null;
  }

  return userSnap.data() as UserDoc;
}

/**
 * Lädt Tenant-Daten für einen User.
 * Prüft zuerst defaultTenantId, dann sucht nach bestehenden Memberships.
 * WICHTIG: Validiert, dass der User wirklich Mitglied im ermittelten Tenant ist.
 */
export async function getTenantForUser(uid: string): Promise<{
  tenant: TenantDoc & { id: string };
  member: MemberDoc;
  entitlements: Record<string, boolean | string | number>;
} | null> {
  const db = getAdminFirestore();

  // 1. User-Dokument laden
  const userDoc = await getUserDocument(uid);
  
  let tenantId: string | null = userDoc?.defaultTenantId || null;

  // 2. Wenn defaultTenantId vorhanden, VALIDIERE dass User wirklich Mitglied ist
  if (tenantId) {
    const tenantRef = db.collection('tenants').doc(tenantId);
    const memberRef = tenantRef.collection('members').doc(uid);
    const memberSnap = await memberRef.get();
    
    if (!memberSnap.exists) {
      // Invalid defaultTenantId entfernen
      try {
        await db.collection('users').doc(uid).update({
          defaultTenantId: FieldValue.delete(),
        });
      } catch (updateError) {
        // Silent fail
      }
      
      tenantId = null; // Suche nach anderen Tenants
    }
  }

  // 3. Wenn kein defaultTenantId ODER defaultTenantId war ungültig, suche nach Membership in allen Tenants
  if (!tenantId) {
    
    // Suche nach Member-Dokument mit dieser UID (Dokument-ID = UID)
    const tenantsSnap = await db.collection('tenants').get();
    
    // WICHTIG: Prüfe ob User wirklich Dev-Staff ist, bevor dev-tenant verwendet wird
    let isUserDevStaff = false;
    try {
      const { isDevStaff } = await import('../../modules/support/service.js');
      isUserDevStaff = await isDevStaff(uid);
    } catch (error) {
      // Silent fail
    }
    
    // Suche nach allen Tenants, in denen User Mitglied ist
    const foundTenants: Array<{ tenantId: string; isDevTenant: boolean }> = [];
    
    for (const tenantDoc of tenantsSnap.docs) {
      const memberSnap = await tenantDoc.ref.collection('members').doc(uid).get();
      
      if (memberSnap.exists) {
        const isDevTenant = tenantDoc.id === 'dev-tenant';
        foundTenants.push({ tenantId: tenantDoc.id, isDevTenant });
      }
    }
    
    // WICHTIG: Bevorzuge normale Tenants über dev-tenant
    // Nur wenn User wirklich Dev-Staff ist UND kein normaler Tenant gefunden wurde, verwende dev-tenant
    const normalTenant = foundTenants.find(t => !t.isDevTenant);
    const devTenant = foundTenants.find(t => t.isDevTenant);
    
    let selectedTenant: { tenantId: string; isDevTenant: boolean } | undefined;
    
    if (normalTenant) {
      // Normale Tenants haben Priorität
      selectedTenant = normalTenant;
    } else if (devTenant && isUserDevStaff) {
      // Nur wenn User wirklich Dev-Staff ist, verwende dev-tenant
      selectedTenant = devTenant;
    } else if (devTenant && !isUserDevStaff) {
      // User ist Mitglied im dev-tenant, aber ist kein Dev-Staff - das ist ein Fehler!
      // Suche nach anderen Tenants (falls vorhanden)
      selectedTenant = foundTenants[0]; // Fallback auf ersten gefundenen Tenant
    } else {
      // Kein Tenant gefunden
      selectedTenant = undefined;
    }
    
    if (selectedTenant) {
      tenantId = selectedTenant.tenantId;
      
      // User-Dokument aktualisieren mit defaultTenantId
      await db.collection('users').doc(uid).set({
        defaultTenantId: tenantId,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  // Immer noch kein Tenant gefunden
  if (!tenantId) {
    return null;
  }

  // 4. Tenant laden
  const tenantRef = db.collection('tenants').doc(tenantId);
  const tenantSnap = await tenantRef.get();

  if (!tenantSnap.exists) {
    return null;
  }

  // 5. Membership nochmal prüfen (sollte existieren, aber Defense-in-Depth)
  const memberRef = tenantRef.collection('members').doc(uid);
  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    // WICHTIG: Wenn Member-Dokument nicht existiert, aber defaultTenantId noch gesetzt ist,
    // dann defaultTenantId löschen, damit der User nicht mehr diesem Tenant zugeordnet wird
    if (userDoc?.defaultTenantId === tenantId) {
      try {
        await db.collection('users').doc(uid).update({
          defaultTenantId: FieldValue.delete(),
        });
      } catch (updateError) {
        // Silent fail
      }
    }
    return null;
  }

  // 5. Entitlements laden
  const entitlementsSnap = await tenantRef.collection('entitlements').get();
  const entitlements: Record<string, boolean | string | number> = {};

  entitlementsSnap.forEach((doc) => {
    const data = doc.data() as EntitlementDoc;
    entitlements[data.key] = data.value;
  });

  return {
    tenant: { id: tenantId, ...(tenantSnap.data() as TenantDoc) },
    member: memberSnap.data() as MemberDoc,
    entitlements,
  };
}

/**
 * Setzt ein Entitlement für einen Tenant.
 */
export async function setEntitlement(
  tenantId: string,
  key: string,
  value: boolean | string | number
): Promise<void> {
  const db = getAdminFirestore();
  const tenantRef = db.collection('tenants').doc(tenantId);
  
  // Prüfe, ob Tenant existiert
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new Error(`Tenant ${tenantId} not found`);
  }
  
  // Suche bestehendes Entitlement mit diesem Key
  const entitlementsSnap = await tenantRef.collection('entitlements')
    .where('key', '==', key)
    .limit(1)
    .get();
  
  if (!entitlementsSnap.empty) {
    // Update bestehendes Entitlement
    const docRef = entitlementsSnap.docs[0].ref;
    await docRef.update({
      value,
      grantedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Updated entitlement ${key} = ${value} for tenant ${tenantId}`);
  } else {
    // Neues Entitlement erstellen
    await tenantRef.collection('entitlements').doc().set({
      key,
      value,
      grantedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Created entitlement ${key} = ${value} for tenant ${tenantId}`);
  }
}

/**
 * Löscht ein Entitlement für einen Tenant.
 */
export async function deleteEntitlement(
  tenantId: string,
  key: string
): Promise<void> {
  const db = getAdminFirestore();
  const tenantRef = db.collection('tenants').doc(tenantId);
  
  // Suche Entitlement mit diesem Key
  const entitlementsSnap = await tenantRef.collection('entitlements')
    .where('key', '==', key)
    .get();
  
  for (const doc of entitlementsSnap.docs) {
    await doc.ref.delete();
  }
  
  console.log(`✅ Deleted entitlement ${key} for tenant ${tenantId}`);
}

/**
 * Lädt alle Entitlements für einen Tenant.
 */
export async function getEntitlements(
  tenantId: string
): Promise<Record<string, boolean | string | number>> {
  const db = getAdminFirestore();
  const tenantRef = db.collection('tenants').doc(tenantId);
  
  const entitlementsSnap = await tenantRef.collection('entitlements').get();
  const entitlements: Record<string, boolean | string | number> = {};
  
  entitlementsSnap.forEach((doc) => {
    const data = doc.data() as EntitlementDoc;
    entitlements[data.key] = data.value;
  });
  
  return entitlements;
}

/**
 * Lädt alle Entitlements für einen Freelancer.
 */
export async function getFreelancerEntitlements(
  freelancerUid: string
): Promise<Record<string, boolean | string | number>> {
  const db = getAdminFirestore();
  const freelancerRef = db.collection('freelancers').doc(freelancerUid);
  
  // Prüfe ob Freelancer existiert
  const freelancerSnap = await freelancerRef.get();
  if (!freelancerSnap.exists) {
    return {};
  }
  
  const entitlementsSnap = await freelancerRef.collection('entitlements').get();
  const entitlements: Record<string, boolean | string | number> = {};
  
  entitlementsSnap.forEach((doc) => {
    const data = doc.data() as EntitlementDoc;
    entitlements[data.key] = data.value;
  });
  
  return entitlements;
}

/**
 * Setzt ein Entitlement für einen Freelancer.
 */
export async function setFreelancerEntitlement(
  freelancerUid: string,
  key: string,
  value: boolean | string | number
): Promise<void> {
  const db = getAdminFirestore();
  const freelancerRef = db.collection('freelancers').doc(freelancerUid);
  
  // Prüfe, ob Freelancer existiert
  const freelancerSnap = await freelancerRef.get();
  if (!freelancerSnap.exists) {
    throw new Error(`Freelancer ${freelancerUid} not found`);
  }
  
  // Suche bestehendes Entitlement mit diesem Key
  const entitlementsSnap = await freelancerRef.collection('entitlements')
    .where('key', '==', key)
    .limit(1)
    .get();
  
  if (!entitlementsSnap.empty) {
    // Update bestehendes Entitlement
    const docRef = entitlementsSnap.docs[0].ref;
    await docRef.update({
      value,
      grantedAt: FieldValue.serverTimestamp(),
    });
    // Updated entitlement for freelancer
  } else {
    // Neues Entitlement erstellen
    await freelancerRef.collection('entitlements').doc().set({
      key,
      value,
      grantedAt: FieldValue.serverTimestamp(),
    });
    // Created entitlement for freelancer
  }
}

/**
 * Erstellt einen neuen Tenant mit dem User als Admin.
 */
export async function createTenant(
  uid: string,
  email: string,
  tenantName: string
): Promise<{
  tenantId: string;
  entitlements: Record<string, boolean | string | number>;
}> {
  const db = getAdminFirestore();

  // Tenant-ID generieren
  const tenantRef = db.collection('tenants').doc();
  const tenantId = tenantRef.id;

  // Creating tenant

  try {
    // 1. Tenant-Dokument erstellen
    await tenantRef.set({
      name: tenantName,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    });

    // 2. Member (Admin) erstellen
    await tenantRef.collection('members').doc(uid).set({
      uid,
      email,
      role: 'admin',
      joinedAt: FieldValue.serverTimestamp(),
    });

    // 3. Default Entitlements erstellen
    const defaultEntitlements: Record<string, boolean> = {
      'module.calendar_core': true,
      'module.time_tracking': true,
      'module.shift_pool': true,
      'module.reports': true,
    };

    for (const [key, value] of Object.entries(defaultEntitlements)) {
      await tenantRef.collection('entitlements').doc().set({
        key,
        value,
        grantedAt: FieldValue.serverTimestamp(),
      });
    }

    // 4. User-Dokument erstellen/aktualisieren
    await db.collection('users').doc(uid).set({
      email,
      defaultTenantId: tenantId,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      tenantId,
      entitlements: defaultEntitlements,
    };
  } catch (error) {
    console.error('Error creating tenant:', error);
    throw error;
  }
}

/**
 * Aktualisiert den Namen eines Tenants.
 * Nur für Admins.
 */
export async function updateTenantName(
  tenantId: string,
  newName: string
): Promise<void> {
  const db = getAdminFirestore();
  const tenantRef = db.collection('tenants').doc(tenantId);
  
  // Validierung
  if (!newName || typeof newName !== 'string' || newName.trim().length < 2) {
    throw new Error('Tenant name must be at least 2 characters');
  }
  
  await tenantRef.update({
    name: newName.trim(),
  });
  
  // Tenant name updated
}