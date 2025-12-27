/**
 * Support Service
 *
 * Firestore-Operationen für das Support-Modul.
 */

import { getAdminFirestore, getAdminAuth, getAdminStorage } from '../../core/firebase/index.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getFreelancer } from '../freelancer/service.js';
import { createTenant, getTenantForUser } from '../../core/tenancy/index.js';
import { isSuperAdmin } from '../../core/super-admin/index.js';
import type {
  DevStaffDoc,
  DevStaffResponse,
  VerificationOverview,
  CreateDevStaffRequest,
  UpdateDevStaffPermissionsRequest,
  AccountDeletionRequestDoc,
  AccountDeletionRequestOverview,
  DeletionRequestStatus,
} from './types.js';
import type { VerificationStatus } from '../freelancer/types.js';
import type { FreelancerDoc } from '../freelancer/types.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Konvertiert DevStaffDoc zu API Response.
 */
function devStaffToResponse(doc: DevStaffDoc): DevStaffResponse {
  return {
    uid: doc.uid,
    email: doc.email,
    displayName: doc.displayName,
    createdAt: doc.createdAt.toDate().toISOString(),
    createdBy: doc.createdBy,
    role: doc.role || 'dev-staff', // Fallback für alte Einträge
    permissions: doc.permissions,
  };
}

// =============================================================================
// Dev Staff Operations
// =============================================================================

/**
 * Erstellt einen neuen Dev-Mitarbeiter.
 * Nur Super-Admins (aus SUPER_ADMIN_UIDS) können Dev-Mitarbeiter erstellen.
 * Nur Super-Admins können die Rolle 'super-admin' vergeben.
 */
export async function createDevStaff(
  data: CreateDevStaffRequest,
  createdByUid: string
): Promise<DevStaffResponse> {
  const db = getAdminFirestore();
  const auth = getAdminAuth();
  
  // Validierung: Nur Super-Admins können Dev-Staff erstellen
  if (!isSuperAdmin(createdByUid)) {
    throw new Error('Only super-admins can create dev staff members');
  }

  // Validierung
  if (!data.email || !data.email.includes('@')) {
    throw new Error('Valid email is required');
  }
  if (!data.displayName || data.displayName.trim().length < 2) {
    throw new Error('Display name is required (min. 2 characters)');
  }
  if (!Array.isArray(data.permissions) || data.permissions.length === 0) {
    throw new Error('At least one permission is required');
  }

  // Rolle validieren: Nur Super-Admins können 'super-admin' Rolle vergeben
  const requestedRole = data.role || 'dev-staff';
  if (requestedRole === 'super-admin' && !isSuperAdmin(createdByUid)) {
    throw new Error('Only super-admins can assign the super-admin role');
  }

  const email = data.email.toLowerCase().trim();

  // Prüfen ob Dev-Mitarbeiter bereits existiert
  const existingSnapshot = await db
    .collection('dev-staff')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    throw new Error('A dev staff member with this email already exists');
  }

  // Firebase Auth User erstellen oder finden
  let uid: string;
  try {
    const existingUser = await auth.getUserByEmail(email).catch(() => null);

    if (existingUser) {
      // Prüfe ob User bereits ein Dev-Mitarbeiter ist
      const existingDevStaff = await db
        .collection('dev-staff')
        .doc(existingUser.uid)
        .get();
      
      if (existingDevStaff.exists) {
        throw new Error('A dev staff member with this email already exists');
      }
      
      uid = existingUser.uid;
    } else {
      // Neuen Firebase Auth User erstellen (ohne Passwort, muss per E-Mail-Link einloggen)
      const newUser = await auth.createUser({
        email,
        displayName: data.displayName.trim(),
        disabled: false,
      });
      
      uid = newUser.uid;
    }
  } catch (authError) {
    throw new Error(`Failed to create user account: ${authError instanceof Error ? authError.message : 'Unknown error'}`);
  }

  // Dev-Mitarbeiter-Dokument erstellen
  const devStaffData: DevStaffDoc = {
    uid,
    email,
    displayName: data.displayName.trim(),
    createdAt: FieldValue.serverTimestamp() as Timestamp,
    createdBy: createdByUid,
    role: requestedRole,
    permissions: data.permissions,
  };

  await db.collection('dev-staff').doc(uid).set(devStaffData);

  // Dev-Mitarbeiter zum Dev-Tenant hinzufügen
  await assignDevStaffToTenant(uid, email);

  // Password Reset Link generieren
  let passwordResetLink: string | undefined;
  try {
    passwordResetLink = await auth.generatePasswordResetLink(email);
  } catch (linkError) {
    // Nicht kritisch - User kann auch "Passwort vergessen" nutzen
    console.warn('Could not generate password reset link for dev staff:', linkError);
  }

  // Zurücklesen
  const savedDoc = await db.collection('dev-staff').doc(uid).get();
  const response = devStaffToResponse(savedDoc.data() as DevStaffDoc);
  
  // Password-Reset-Link nur beim Erstellen zurückgeben
  if (passwordResetLink) {
    response.passwordResetLink = passwordResetLink;
  }
  
  return response;
}

/**
 * Lädt alle Dev-Mitarbeiter.
 * Gibt alle Dev-Staff-Einträge zurück (sowohl Super-Admins als auch manuell erstellte).
 */
export async function getAllDevStaff(): Promise<DevStaffResponse[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection('dev-staff').orderBy('createdAt', 'desc').get();

  return snapshot.docs.map(doc => devStaffToResponse(doc.data() as DevStaffDoc));
}

/**
 * Lädt einen Dev-Mitarbeiter.
 * Gibt den Dev-Staff-Eintrag zurück, falls vorhanden.
 */
export async function getDevStaff(uid: string): Promise<DevStaffResponse | null> {
  const db = getAdminFirestore();
  const doc = await db.collection('dev-staff').doc(uid).get();

  if (!doc.exists) {
    return null;
  }

  return devStaffToResponse(doc.data() as DevStaffDoc);
}

/**
 * Prüft ob ein User ein Dev-Mitarbeiter ist.
 * Erkennt sowohl Super-Admins (aus SUPER_ADMIN_UIDS) als auch manuell erstellte Dev-Staff-Einträge.
 */
export async function isDevStaff(uid: string): Promise<boolean> {
  // Super-Admins sind immer Dev-Staff
  if (isSuperAdmin(uid)) {
    return true;
  }

  // Prüfe ob User in dev-staff Collection existiert
  const db = getAdminFirestore();
  const doc = await db.collection('dev-staff').doc(uid).get();
  return doc.exists;
}

/**
 * Erstellt automatisch einen Dev-Staff-Eintrag für Super-Admins (falls nicht vorhanden).
 * Ordnet den Super-Admin auch automatisch dem Dev-Tenant zu.
 */
export async function ensureDevStaffForSuperAdmin(uid: string, email: string): Promise<void> {
  // Nur für Super-Admins
  if (!isSuperAdmin(uid)) {
    return;
  }

  const db = getAdminFirestore();
  const devStaffRef = db.collection('dev-staff').doc(uid);
  const doc = await devStaffRef.get();

  // Wenn bereits vorhanden, nur sicherstellen dass er dem Tenant zugeordnet ist
  if (doc.exists) {
    await assignDevStaffToTenant(uid, email);
    return;
  }

  // Dev-Staff-Eintrag für Super-Admin erstellen
  const auth = getAdminAuth();
  let displayName = email;
  
  try {
    const userRecord = await auth.getUser(uid);
    displayName = userRecord.displayName || email;
  } catch (error) {
    // Falls User nicht gefunden wird, verwenden wir email
    // Could not fetch user for dev staff creation
  }

  await devStaffRef.set({
    uid,
    email,
    displayName,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: 'system', // Super-Admins werden automatisch erstellt
    role: 'super-admin', // Super-Admins haben immer die super-admin Rolle
    permissions: ['verification.review', 'verification.approve', 'verification.reject'], // Standard-Rechte
  });

  // Super-Admin automatisch dem Dev-Tenant zuordnen
  await assignDevStaffToTenant(uid, email);
}

/**
 * Aktualisiert die Rechte und/oder Rolle eines Dev-Mitarbeiters.
 * Nur Super-Admins können die Rolle 'super-admin' vergeben.
 */
export async function updateDevStaffPermissions(
  uid: string,
  data: UpdateDevStaffPermissionsRequest,
  updatedByUid: string
): Promise<DevStaffResponse> {
  const db = getAdminFirestore();
  const devStaffRef = db.collection('dev-staff').doc(uid);

  // Prüfen ob Dev-Mitarbeiter existiert
  const doc = await devStaffRef.get();
  if (!doc.exists) {
    throw new Error('Dev staff member not found');
  }

  // Validierung: Nur Super-Admins können die super-admin Rolle vergeben
  if (data.role === 'super-admin' && !isSuperAdmin(updatedByUid)) {
    throw new Error('Only super-admins can assign the super-admin role');
  }

  // Update-Daten vorbereiten
  const updateData: Partial<DevStaffDoc> = {};

  if (data.permissions !== undefined) {
    if (!Array.isArray(data.permissions) || data.permissions.length === 0) {
      throw new Error('At least one permission is required');
    }
    updateData.permissions = data.permissions;
  }

  if (data.role !== undefined) {
    updateData.role = data.role;
  }

  await devStaffRef.update(updateData);

  // Zurücklesen
  const savedDoc = await devStaffRef.get();
  return devStaffToResponse(savedDoc.data() as DevStaffDoc);
}

/**
 * Entfernt einen Dev-Mitarbeiter.
 */
export async function deleteDevStaff(uid: string): Promise<void> {
  const db = getAdminFirestore();
  const devStaffRef = db.collection('dev-staff').doc(uid);

  // Prüfen ob Dev-Mitarbeiter existiert
  const doc = await devStaffRef.get();
  if (!doc.exists) {
    throw new Error('Dev staff member not found');
  }

  await devStaffRef.delete();
}

// =============================================================================
// Verification Operations
// =============================================================================

/**
 * Lädt alle Verifizierungen.
 */
export async function getAllVerifications(): Promise<VerificationOverview[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection('freelancers').get();

  const verifications: VerificationOverview[] = [];

  for (const doc of snapshot.docs) {
    const freelancerData = doc.data() as FreelancerDoc;
    
    // Nur Freelancer mit Verifizierungsstatus anzeigen
    if (freelancerData.verificationStatus || freelancerData.verificationDocumentPath) {
      verifications.push({
        freelancerUid: freelancerData.uid,
        email: freelancerData.email,
        displayName: freelancerData.displayName,
        companyName: freelancerData.companyName,
        verificationStatus: freelancerData.verificationStatus || null,
        verificationSubmittedAt: freelancerData.verificationSubmittedAt?.toDate().toISOString(),
        verificationReviewedAt: freelancerData.verificationReviewedAt?.toDate().toISOString(),
        verificationReviewedBy: freelancerData.verificationReviewedBy,
        verificationRejectionReason: freelancerData.verificationRejectionReason,
        businessLicenseNumber: freelancerData.businessLicenseNumber,
      });
    }
  }

  // Sortieren: pending zuerst, dann nach SubmittedAt
  verifications.sort((a, b) => {
    if (a.verificationStatus === 'pending' && b.verificationStatus !== 'pending') return -1;
    if (a.verificationStatus !== 'pending' && b.verificationStatus === 'pending') return 1;
    if (a.verificationSubmittedAt && b.verificationSubmittedAt) {
      return new Date(b.verificationSubmittedAt).getTime() - new Date(a.verificationSubmittedAt).getTime();
    }
    return 0;
  });

  return verifications;
}

/**
 * Genehmigt eine Verifizierung.
 * Erstellt automatisch einen Tenant für den Freelancer, falls noch nicht vorhanden.
 */
export async function approveVerification(
  freelancerUid: string,
  reviewedByUid: string,
  companyName?: string
): Promise<void> {
  const db = getAdminFirestore();
  const freelancerRef = db.collection('freelancers').doc(freelancerUid);

  // Prüfen ob Freelancer existiert
  const doc = await freelancerRef.get();
  if (!doc.exists) {
    throw new Error('Freelancer not found');
  }

  const freelancerData = doc.data() as FreelancerDoc;

  // Verifizierung genehmigen
  await freelancerRef.update({
    verificationStatus: 'approved' as VerificationStatus,
    verificationReviewedAt: FieldValue.serverTimestamp(),
    verificationReviewedBy: reviewedByUid,
    verificationRejectionReason: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Tenant erstellen, falls noch nicht vorhanden
  if (!freelancerData.tenantId) {
    const finalCompanyName = companyName || freelancerData.companyName || freelancerData.displayName || 'Freelancer';
    
    try {
      const { tenantId } = await createTenant(freelancerUid, freelancerData.email, finalCompanyName);
      
      // WICHTIG: Rolle von 'admin' auf 'freelancer' ändern
      // createTenant erstellt automatisch einen Admin, aber Freelancer sollten die Rolle 'freelancer' haben
      const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(freelancerUid);
      await memberRef.update({
        role: 'freelancer',
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      // Tenant-ID im Freelancer-Dokument speichern
      await freelancerRef.update({
        tenantId,
        companyName: finalCompanyName,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Created tenant for verified freelancer
      // Updated member role to 'freelancer'
    } catch (tenantError) {
      console.error('Failed to create tenant for verified freelancer:', tenantError);
      // Nicht kritisch - kann später manuell erstellt werden
    }
  }
}

/**
 * Lehnt eine Verifizierung ab.
 */
export async function rejectVerification(
  freelancerUid: string,
  reviewedByUid: string,
  reason: string
): Promise<void> {
  const db = getAdminFirestore();
  const freelancerRef = db.collection('freelancers').doc(freelancerUid);

  // Prüfen ob Freelancer existiert
  const doc = await freelancerRef.get();
  if (!doc.exists) {
    throw new Error('Freelancer not found');
  }

  if (!reason || reason.trim().length < 3) {
    throw new Error('Rejection reason is required (min. 3 characters)');
  }

  await freelancerRef.update({
    verificationStatus: 'rejected' as VerificationStatus,
    verificationReviewedAt: FieldValue.serverTimestamp(),
    verificationReviewedBy: reviewedByUid,
    verificationRejectionReason: reason.trim(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Generiert eine Download-URL für ein Verifizierungs-Dokument (für Dev-Mitarbeiter).
 */
export async function getVerificationDocumentUrlForDev(
  freelancerUid: string
): Promise<string> {
  const db = getAdminFirestore();
  const storage = getAdminStorage();

  // Freelancer-Dokument laden
  const freelancerRef = db.collection('freelancers').doc(freelancerUid);
  const freelancerSnap = await freelancerRef.get();

  if (!freelancerSnap.exists) {
    throw new Error('Freelancer not found');
  }

  const freelancerData = freelancerSnap.data() as FreelancerDoc;

  if (!freelancerData.verificationDocumentPath) {
    throw new Error('Verification document not found');
  }

  // Signed URL generieren (1 Stunde gültig)
  const bucket = storage.bucket();
  const fileRef = bucket.file(freelancerData.verificationDocumentPath);

  const [url] = await fileRef.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 Stunde
  });

  return url;
}

// =============================================================================
// Dev Tenant Operations
// =============================================================================

const DEV_TENANT_ID = 'dev-tenant';

/**
 * Erstellt oder gibt den Dev-Tenant zurück.
 * Wird automatisch beim Erstellen eines Dev-Mitarbeiters aufgerufen.
 */
export async function getOrCreateDevTenant(createdByUid: string): Promise<string> {
  const db = getAdminFirestore();
  const tenantRef = db.collection('tenants').doc(DEV_TENANT_ID);
  const tenantSnap = await tenantRef.get();

  // WICHTIG: Alle Module für Dev-Tenant aktivieren
  // So kann der Entwickler alle Module testen bevor sie veröffentlicht werden
  const allModules = [
    'module.support',
    'module.time_tracking',
    'module.shift_pool',
    'module.reports',
    'module.mfa',
    'module.calendar_core',
    'module.security_audit',
    'module.work_time_compliance',
    'module.stripe',
  ];

  if (!tenantSnap.exists) {
    // Dev-Tenant erstellen
    await tenantRef.set({
      name: 'Dev Support',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: createdByUid,
    });

    // Alle Module aktivieren
    const entitlementsRef = tenantRef.collection('entitlements');
    const batch = db.batch();
    
    for (const moduleKey of allModules) {
      const entitlementRef = entitlementsRef.doc();
      batch.set(entitlementRef, {
        key: moduleKey,
        value: true,
        grantedAt: FieldValue.serverTimestamp(),
      });
    }
    
    await batch.commit();
  } else {
    // Tenant existiert bereits - prüfe ob alle Module aktiviert sind
    const entitlementsRef = tenantRef.collection('entitlements');
    const existingEntitlementsSnap = await entitlementsRef.get();
    const existingKeys = new Set(existingEntitlementsSnap.docs.map(doc => doc.data().key));
    
    // Fehlende Module aktivieren
    const missingModules = allModules.filter(key => !existingKeys.has(key));
    
    if (missingModules.length > 0) {
      const batch = db.batch();
      
      for (const moduleKey of missingModules) {
        const entitlementRef = entitlementsRef.doc();
        batch.set(entitlementRef, {
          key: moduleKey,
          value: true,
          grantedAt: FieldValue.serverTimestamp(),
        });
      }
      
      await batch.commit();
      console.log(`✅ Dev-Tenant: ${missingModules.length} fehlende Module aktiviert: ${missingModules.join(', ')}`);
    }
  }

  return DEV_TENANT_ID;
}

/**
 * Ordnet einen Dev-Mitarbeiter dem Dev-Tenant zu.
 */
export async function assignDevStaffToTenant(uid: string, email: string): Promise<void> {
  const db = getAdminFirestore();
  const tenantId = await getOrCreateDevTenant(uid);

  // Prüfen ob bereits Mitglied
  const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(uid);
  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    // Als Admin zum Dev-Tenant hinzufügen
    await memberRef.set({
      uid,
      email,
      role: 'admin',
      joinedAt: FieldValue.serverTimestamp(),
    });

    // Dev-Mitarbeiter zum Dev-Tenant hinzugefügt
  }

  // WICHTIG: defaultTenantId IMMER setzen, auch wenn Member bereits existiert
  // Das stellt sicher, dass getTenantForUser den Tenant findet
  await db.collection('users').doc(uid).set({
    email,
    defaultTenantId: tenantId,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  
  // WICHTIG: Kurz warten, damit Firestore die Änderungen propagiert
  // Dies hilft bei Race Conditions, wenn getTenantForUser direkt danach aufgerufen wird
  await new Promise(resolve => setTimeout(resolve, 200));
}

// =============================================================================
// Account Deletion Request Operations
// =============================================================================

/**
 * Konvertiert AccountDeletionRequestDoc zu API Response.
 */
function deletionRequestToOverview(doc: AccountDeletionRequestDoc): AccountDeletionRequestOverview {
  return {
    uid: doc.uid,
    email: doc.email,
    displayName: doc.displayName,
    userType: doc.userType,
    status: doc.status,
    requestedAt: doc.requestedAt.toDate().toISOString(),
    requestedReason: doc.requestedReason,
    reviewedAt: doc.reviewedAt?.toDate().toISOString(),
    reviewedBy: doc.reviewedBy,
    rejectionReason: doc.rejectionReason,
    scheduledDeletionAt: doc.scheduledDeletionAt?.toDate().toISOString(),
    deletedAt: doc.deletedAt?.toDate().toISOString(),
    deletedBy: doc.deletedBy,
  };
}

/**
 * Erstellt einen Löschauftrag.
 */
export async function createDeletionRequest(
  uid: string,
  email: string,
  displayName: string,
  userType: 'freelancer' | 'employee' | 'dev-staff',
  reason?: string
): Promise<AccountDeletionRequestOverview> {
  const db = getAdminFirestore();
  const requestRef = db.collection('account-deletion-requests').doc(uid);

  // Prüfen ob bereits ein Antrag existiert
  const existingSnap = await requestRef.get();
  if (existingSnap.exists) {
    const existing = existingSnap.data() as AccountDeletionRequestDoc;
    if (existing.status === 'pending' || existing.status === 'approved') {
      throw new Error('A deletion request already exists for this account');
    }
  }

  const requestData: Record<string, unknown> = {
    uid,
    email,
    displayName,
    userType,
    status: 'pending',
    requestedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // requestedReason nur setzen, wenn reason einen Wert hat (Firestore akzeptiert keine undefined Werte)
  if (reason && reason.trim()) {
    requestData.requestedReason = reason.trim();
  }

  await requestRef.set(requestData);

  const savedDoc = await requestRef.get();
  return deletionRequestToOverview(savedDoc.data() as AccountDeletionRequestDoc);
}

/**
 * Lädt alle Löschaufträge.
 */
export async function getAllDeletionRequests(): Promise<AccountDeletionRequestOverview[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection('account-deletion-requests').get();

  const requests: AccountDeletionRequestOverview[] = [];

  for (const doc of snapshot.docs) {
    requests.push(deletionRequestToOverview(doc.data() as AccountDeletionRequestDoc));
  }

  // Sortieren: pending zuerst, dann nach requestedAt
  requests.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    if (a.requestedAt && b.requestedAt) {
      return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
    }
    return 0;
  });

  return requests;
}

/**
 * Genehmigt einen Löschauftrag.
 * Setzt scheduledDeletionAt auf 30 Tage in der Zukunft.
 */
export async function approveDeletionRequest(
  uid: string,
  reviewedByUid: string,
  reason?: string
): Promise<void> {
  const db = getAdminFirestore();
  const requestRef = db.collection('account-deletion-requests').doc(uid);

  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) {
    throw new Error('Deletion request not found');
  }

  const requestData = requestSnap.data() as AccountDeletionRequestDoc;
  if (requestData.status !== 'pending') {
    throw new Error(`Cannot approve deletion request with status: ${requestData.status}`);
  }

  // 30 Tage in der Zukunft
  const scheduledDeletionDate = new Date();
  scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

  await requestRef.update({
    status: 'approved',
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: reviewedByUid,
    scheduledDeletionAt: Timestamp.fromDate(scheduledDeletionDate),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Deletion request approved
}

/**
 * Lehnt einen Löschauftrag ab.
 */
export async function rejectDeletionRequest(
  uid: string,
  reviewedByUid: string,
  reason: string
): Promise<void> {
  const db = getAdminFirestore();
  const requestRef = db.collection('account-deletion-requests').doc(uid);

  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) {
    throw new Error('Deletion request not found');
  }

  const requestData = requestSnap.data() as AccountDeletionRequestDoc;
  if (requestData.status !== 'pending') {
    throw new Error(`Cannot reject deletion request with status: ${requestData.status}`);
  }

  if (!reason || reason.trim().length < 3) {
    throw new Error('Rejection reason is required (min. 3 characters)');
  }

  await requestRef.update({
    status: 'rejected',
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: reviewedByUid,
    rejectionReason: reason.trim(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Deletion request rejected
}

/**
 * Führt die tatsächliche Löschung eines Kontos durch.
 * Wird vom Support-Mitarbeiter aufgerufen oder automatisch nach 30 Tagen.
 */
export async function executeDeletionRequest(
  uid: string,
  executedByUid: string
): Promise<void> {
  const db = getAdminFirestore();
  const auth = getAdminAuth();
  const storage = getAdminStorage();

  const requestRef = db.collection('account-deletion-requests').doc(uid);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    throw new Error('Deletion request not found');
  }

  const requestData = requestSnap.data() as AccountDeletionRequestDoc;
  if (requestData.status !== 'approved') {
    throw new Error(`Cannot execute deletion request with status: ${requestData.status}`);
  }

  // Prüfen ob scheduledDeletionAt erreicht wurde
  if (requestData.scheduledDeletionAt) {
    const scheduledDate = requestData.scheduledDeletionAt.toDate();
    const now = new Date();
    if (now < scheduledDate) {
      throw new Error(`Deletion is scheduled for ${scheduledDate.toISOString()}. Cannot execute yet.`);
    }
  }

  // Executing deletion for account

  // Je nach User-Typ unterschiedlich löschen
  if (requestData.userType === 'freelancer') {
    // Freelancer-Löschung (aus dem Freelancer-Service)
    const { deleteFreelancerAccount } = await import('../freelancer/service.js');
    await deleteFreelancerAccount(uid);
  } else {
    // Employee oder Dev-Staff - ähnliche Löschung
    // Storage-Dateien löschen
    try {
      const bucket = storage.bucket();
      const [files] = await bucket.getFiles({
        prefix: `users/${uid}/`,
      });

      for (const file of files) {
        await file.delete();
      }
    } catch (storageError) {
      console.warn('⚠️ Error deleting storage files:', storageError);
    }

    // User-Dokument löschen
    await db.collection('users').doc(uid).delete();

    // Firebase Auth User löschen
    try {
      await auth.deleteUser(uid);
    } catch (authError) {
      console.error('❌ Error deleting Firebase Auth user:', authError);
      throw new Error('Failed to delete authentication account');
    }
  }

  // Löschauftrag als completed markieren
  await requestRef.update({
    status: 'completed',
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: executedByUid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Account successfully deleted
}

