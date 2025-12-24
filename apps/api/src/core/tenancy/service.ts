/**
 * Tenancy Service
 *
 * Firestore-basierte Tenant-Verwaltung.
 */

import { getAdminFirestore } from '../firebase';
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

  // 2. Wenn kein defaultTenantId, suche nach Membership in allen Tenants
  if (!tenantId) {
    console.log(`🔍 No defaultTenantId for user ${uid}, searching for memberships...`);
    
    // Suche nach Member-Dokument mit dieser UID (Dokument-ID = UID)
    const tenantsSnap = await db.collection('tenants').get();
    
    for (const tenantDoc of tenantsSnap.docs) {
      const memberSnap = await tenantDoc.ref.collection('members').doc(uid).get();
      
      if (memberSnap.exists) {
        tenantId = tenantDoc.id;
        console.log(`✅ Found membership for user ${uid} in tenant ${tenantId}`);
        
        // User-Dokument aktualisieren mit defaultTenantId
        await db.collection('users').doc(uid).set({
          defaultTenantId: tenantId,
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        
        console.log(`📝 Updated user document with defaultTenantId: ${tenantId}`);
        break;
      }
    }
  }

  // Immer noch kein Tenant gefunden
  if (!tenantId) {
    console.log(`❌ No tenant found for user ${uid}`);
    return null;
  }

  // 3. Tenant laden
  const tenantRef = db.collection('tenants').doc(tenantId);
  const tenantSnap = await tenantRef.get();

  if (!tenantSnap.exists) {
    return null;
  }

  // 4. Membership prüfen
  const memberRef = tenantRef.collection('members').doc(uid);
  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
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
    console.log(`✅ Updated entitlement ${key} = ${value} for freelancer ${freelancerUid}`);
  } else {
    // Neues Entitlement erstellen
    await freelancerRef.collection('entitlements').doc().set({
      key,
      value,
      grantedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Created entitlement ${key} = ${value} for freelancer ${freelancerUid}`);
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

  console.log(`Creating tenant: ${tenantId} for user: ${uid}`);

  try {
    // 1. Tenant-Dokument erstellen
    await tenantRef.set({
      name: tenantName,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    });

    console.log(`Tenant document created: ${tenantId}`);

    // 2. Member (Admin) erstellen
    await tenantRef.collection('members').doc(uid).set({
      uid,
      email,
      role: 'admin',
      joinedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Member document created for: ${uid}`);

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

    console.log(`Entitlements created for tenant: ${tenantId}`);

    // 4. User-Dokument erstellen/aktualisieren
    await db.collection('users').doc(uid).set({
      email,
      defaultTenantId: tenantId,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`User document updated for: ${uid}`);

    return {
      tenantId,
      entitlements: defaultEntitlements,
    };
  } catch (error) {
    console.error('Error creating tenant:', error);
    throw error;
  }
}
