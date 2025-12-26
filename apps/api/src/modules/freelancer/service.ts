/**
 * Freelancer Service
 *
 * Firestore-Operationen für das Freelancer-Modul.
 */

import { getAdminFirestore, getAdminAuth, getAdminStorage } from '../../core/firebase/index.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createTenant } from '../../core/tenancy/index.js';
import type {
  FreelancerDoc,
  RegisterFreelancerRequest,
  FreelancerResponse,
  VerificationStatus,
} from './types.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Konvertiert FreelancerDoc zu API Response.
 */
function freelancerToResponse(doc: FreelancerDoc): FreelancerResponse {
  return {
    uid: doc.uid,
    email: doc.email,
    displayName: doc.displayName,
    firstName: doc.firstName,
    lastName: doc.lastName,
    companyName: doc.companyName,
    tenantId: doc.tenantId,
    phone: doc.phone,
    address: doc.address,
    businessLicenseNumber: doc.businessLicenseNumber,
    verificationStatus: doc.verificationStatus,
    verificationSubmittedAt: doc.verificationSubmittedAt?.toDate().toISOString(),
    verificationReviewedAt: doc.verificationReviewedAt?.toDate().toISOString(),
    verificationReviewedBy: doc.verificationReviewedBy,
    verificationRejectionReason: doc.verificationRejectionReason,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}

// =============================================================================
// Freelancer Operations
// =============================================================================

/**
 * Registriert einen neuen Freelancer.
 */
export async function registerFreelancer(
  data: RegisterFreelancerRequest
): Promise<FreelancerResponse> {
  const db = getAdminFirestore();
  const auth = getAdminAuth();

  // Validierung
  if (!data.email || !data.email.includes('@')) {
    throw new Error('Valid email is required');
  }
  if (!data.password || data.password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  if (!data.displayName || data.displayName.trim().length < 2) {
    throw new Error('Display name is required (min. 2 characters)');
  }

  const email = data.email.toLowerCase().trim();

  // Prüfen ob Freelancer bereits existiert
  const freelancerRef = db.collection('freelancers').doc();
  const existingSnapshot = await db
    .collection('freelancers')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    throw new Error('A freelancer with this email already exists');
  }

  // Firebase Auth User erstellen
  let uid: string;
  try {
    // Prüfe ob User bereits in Firebase Auth existiert
    const existingUser = await auth.getUserByEmail(email).catch(() => null);

    if (existingUser) {
      // Prüfe ob User bereits ein Freelancer ist
      const existingFreelancer = await db
        .collection('freelancers')
        .doc(existingUser.uid)
        .get();
      
      if (existingFreelancer.exists) {
        throw new Error('A freelancer with this email already exists');
      }
      
      uid = existingUser.uid;
    } else {
      // Neuen Firebase Auth User erstellen
      const newUser = await auth.createUser({
        email,
        password: data.password,
        displayName: data.displayName.trim(),
        disabled: false,
      });
      
      uid = newUser.uid;
    }
  } catch (authError) {
    console.error('❌ Firebase Auth error:', authError);
    throw new Error(`Failed to create user account: ${authError instanceof Error ? authError.message : 'Unknown error'}`);
  }

  // Tenant für Freelancer erstellen (companyName optional, Fallback auf displayName)
  const companyName = data.companyName?.trim() || data.displayName.trim();
  const { tenantId, entitlements } = await createTenant(uid, email, companyName);
  
  // WICHTIG: Rolle von 'admin' auf 'freelancer' ändern
  // createTenant erstellt automatisch einen Admin, aber Freelancer sollten die Rolle 'freelancer' haben
  const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(uid);
  await memberRef.update({
    role: 'freelancer',
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Freelancer-Dokument speichern
  const freelancerData: Record<string, unknown> = {
    uid,
    email,
    displayName: data.displayName.trim(),
    tenantId: tenantId, // Haupt-Tenant-ID speichern
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  
  if (data.firstName?.trim()) {
    freelancerData.firstName = data.firstName.trim();
  }
  if (data.lastName?.trim()) {
    freelancerData.lastName = data.lastName.trim();
  }
  if (data.companyName?.trim()) {
    freelancerData.companyName = data.companyName.trim();
  }
  if (data.phone?.trim()) {
    freelancerData.phone = data.phone.trim();
  }
  if (data.address?.trim()) {
    freelancerData.address = data.address.trim();
  }
  if (data.businessLicenseNumber?.trim()) {
    freelancerData.businessLicenseNumber = data.businessLicenseNumber.trim();
  }

  await db.collection('freelancers').doc(uid).set(freelancerData);

  // User-Dokument aktualisieren
  await db.collection('users').doc(uid).set({
    email,
    isFreelancer: true,
    defaultTenantId: tenantId, // Tenant-ID setzen
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const savedDoc = await db.collection('freelancers').doc(uid).get();
  return freelancerToResponse(savedDoc.data() as FreelancerDoc);
}

/**
 * Lädt ein Freelancer-Profil.
 */
export async function getFreelancer(uid: string): Promise<FreelancerResponse | null> {
  const db = getAdminFirestore();
  const doc = await db.collection('freelancers').doc(uid).get();

  if (!doc.exists) {
    return null;
  }

  return freelancerToResponse(doc.data() as FreelancerDoc);
}

/**
 * Fügt einen Tenant zur Freelancer-Liste hinzu (wenn Bewerbung angenommen wird).
 */
export async function addTenantToFreelancer(
  freelancerUid: string,
  tenantId: string
): Promise<void> {
  const db = getAdminFirestore();
  const freelancerRef = db.collection('freelancers').doc(freelancerUid);

  await freelancerRef.update({
    tenantIds: FieldValue.arrayUnion(tenantId),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Lädt einen Gewerbeschein für einen Freelancer hoch.
 */
export async function uploadVerificationDocument(
  freelancerUid: string,
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }
): Promise<{ documentPath: string }> {
  const db = getAdminFirestore();
  const storage = getAdminStorage();

  // Prüfen ob Freelancer existiert
  const freelancerRef = db.collection('freelancers').doc(freelancerUid);
  const freelancerSnap = await freelancerRef.get();

  if (!freelancerSnap.exists) {
    throw new Error('Freelancer not found');
  }

  // Validierung: Dateityp
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPG, PNG and PDF are allowed');
  }

  // Validierung: Dateigröße (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error('File size exceeds maximum of 10MB');
  }

  // Dateiendung bestimmen
  const ext = file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg'
    ? 'jpg'
    : file.mimetype === 'image/png'
    ? 'png'
    : 'pdf';

  // Storage-Pfad
  const storagePath = `freelancers/${freelancerUid}/verification/document.${ext}`;

  // Datei in Firebase Storage hochladen
  const bucket = storage.bucket();
  const fileRef = bucket.file(storagePath);

  await fileRef.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
      metadata: {
        uploadedBy: freelancerUid,
        type: 'verification',
      },
    },
  });

  // Freelancer-Dokument aktualisieren
  await freelancerRef.update({
    verificationDocumentPath: storagePath,
    verificationStatus: 'pending',
    verificationSubmittedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { documentPath: storagePath };
}

/**
 * Generiert eine Download-URL für ein Verifizierungs-Dokument (signed URL, 1 Stunde gültig).
 */
export async function getVerificationDocumentUrl(
  freelancerUid: string,
  requestedByUid: string
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

  // Prüfen ob User berechtigt ist (Freelancer selbst oder Dev-Mitarbeiter)
  // TODO: Dev-Mitarbeiter-Check hier einbauen
  if (freelancerUid !== requestedByUid) {
    // Prüfe ob User Dev-Mitarbeiter ist
    const devStaffDoc = await db.collection('dev-staff').doc(requestedByUid).get();
    if (!devStaffDoc.exists) {
      throw new Error('Unauthorized: Only freelancer or dev staff can access verification documents');
    }
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
// Profile Update & Delete (DSGVO)
// =============================================================================

/**
 * Request für Profil-Update
 */
export interface UpdateFreelancerProfileRequest {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string; // Email-Update
  phone?: string;
  address?: string;
  companyName?: string;
}

/**
 * Aktualisiert das Freelancer-Profil.
 */
export async function updateFreelancerProfile(
  uid: string,
  data: UpdateFreelancerProfileRequest
): Promise<FreelancerResponse> {
  const db = getAdminFirestore();
  const auth = getAdminAuth();

  const freelancerRef = db.collection('freelancers').doc(uid);
  const freelancerSnap = await freelancerRef.get();

  if (!freelancerSnap.exists) {
    throw new Error('Freelancer not found');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Nur gesetzte Felder aktualisieren
  if (data.displayName !== undefined) {
    const trimmed = data.displayName.trim();
    if (trimmed.length < 2) {
      throw new Error('Display name must be at least 2 characters');
    }
    updateData.displayName = trimmed;
    
    // Firebase Auth displayName auch aktualisieren
    await auth.updateUser(uid, { displayName: trimmed });
  }

  if (data.firstName !== undefined) {
    updateData.firstName = data.firstName.trim();
  }

  if (data.lastName !== undefined) {
    updateData.lastName = data.lastName.trim();
  }

  // Email-Update (mit Validierung)
  if (data.email !== undefined) {
    const trimmedEmail = data.email.toLowerCase().trim();
    
    // Validierung
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      throw new Error('Valid email is required');
    }

    // Prüfen ob Email bereits von anderem User verwendet wird
    try {
      const existingUser = await auth.getUserByEmail(trimmedEmail).catch(() => null);
      if (existingUser && existingUser.uid !== uid) {
        throw new Error('This email is already in use by another account');
      }
    } catch (emailCheckError) {
      if (emailCheckError instanceof Error && emailCheckError.message.includes('already in use')) {
        throw emailCheckError;
      }
      // Andere Fehler ignorieren (z.B. User nicht gefunden ist OK)
    }

    // Email in Firebase Auth aktualisieren
    await auth.updateUser(uid, { email: trimmedEmail });
    
    // Email in Freelancer-Dokument aktualisieren
    updateData.email = trimmedEmail;
    
    // Email auch in users Collection aktualisieren
    await db.collection('users').doc(uid).update({
      email: trimmedEmail,
    });
  }

  if (data.phone !== undefined) {
    updateData.phone = data.phone.trim();
  }

  if (data.address !== undefined) {
    updateData.address = data.address.trim();
  }

  if (data.companyName !== undefined) {
    const trimmed = data.companyName.trim();
    if (trimmed.length < 2) {
      throw new Error('Company name must be at least 2 characters');
    }
    updateData.companyName = trimmed;
  }

  await freelancerRef.update(updateData);

  const updatedDoc = await freelancerRef.get();
  return freelancerToResponse(updatedDoc.data() as FreelancerDoc);
}

/**
 * Löscht einen Freelancer-Account komplett (DSGVO-konform).
 * - Löscht Firebase Auth User
 * - Löscht Freelancer-Dokument
 * - Löscht User-Dokument
 * - Löscht alle Storage-Dateien (Verifizierungsdokumente)
 * - Löscht Bewerbungen
 */
export async function deleteFreelancerAccount(uid: string): Promise<void> {
  const db = getAdminFirestore();
  const auth = getAdminAuth();
  const storage = getAdminStorage();

  // Freelancer-Dokument prüfen
  const freelancerRef = db.collection('freelancers').doc(uid);
  const freelancerSnap = await freelancerRef.get();

  if (!freelancerSnap.exists) {
    throw new Error('Freelancer not found');
  }

  const freelancerData = freelancerSnap.data() as FreelancerDoc;

  // Deleting freelancer account

  // 1. Storage-Dateien löschen (Verifizierungsdokumente)
  try {
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({
      prefix: `freelancers/${uid}/`,
    });

    for (const file of files) {
      await file.delete();
      console.log(`  ✓ Deleted file: ${file.name}`);
    }
  } catch (storageError) {
    console.warn('⚠️ Error deleting storage files:', storageError);
    // Fahre trotzdem fort
  }

  // 2. Bewerbungen des Freelancers anonymisieren/löschen
  try {
    const applicationsSnap = await db
      .collectionGroup('applications')
      .where('uid', '==', uid)
      .get();

    for (const appDoc of applicationsSnap.docs) {
      // Bewerbung anonymisieren (für Audit-Trail)
      await appDoc.ref.update({
        uid: '[DELETED]',
        email: '[DELETED]',
        note: '[DELETED]',
        freelancerProfile: FieldValue.delete(),
        anonymizedAt: FieldValue.serverTimestamp(),
      });
      console.log(`  ✓ Anonymized application: ${appDoc.id}`);
    }
  } catch (appError) {
    console.warn('⚠️ Error anonymizing applications:', appError);
  }

  // 3. Tenant des Freelancers löschen (falls vorhanden)
  if (freelancerData.tenantId) {
    try {
      // Tenant-Members löschen
      const membersSnap = await db
        .collection('tenants')
        .doc(freelancerData.tenantId)
        .collection('members')
        .get();
      
      for (const memberDoc of membersSnap.docs) {
        await memberDoc.ref.delete();
      }

      // Entitlements löschen
      const entitlementsRef = db
        .collection('tenants')
        .doc(freelancerData.tenantId)
        .collection('entitlements')
        .doc('default');
      await entitlementsRef.delete();

      // Tenant-Dokument löschen
      await db.collection('tenants').doc(freelancerData.tenantId).delete();
      // Deleted tenant
    } catch (tenantError) {
      console.warn('⚠️ Error deleting tenant:', tenantError);
    }
  }

  // 4. Freelancer-Dokument löschen
  await freelancerRef.delete();
  console.log(`  ✓ Deleted freelancer document`);

  // 5. User-Dokument löschen
  const userRef = db.collection('users').doc(uid);
  await userRef.delete();
  console.log(`  ✓ Deleted user document`);

  // 6. Firebase Auth User löschen (zuletzt)
  try {
    await auth.deleteUser(uid);
    console.log(`  ✓ Deleted Firebase Auth user`);
  } catch (authError) {
    console.error('❌ Error deleting Firebase Auth user:', authError);
    throw new Error('Failed to delete authentication account');
  }

  // Freelancer account completely deleted
}

