/**
 * Freelancer Service
 *
 * Firestore-Operationen für das Freelancer-Modul.
 */

import { getAdminFirestore, getAdminAuth, getAdminStorage } from '../../core/firebase';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createTenant } from '../../core/tenancy';
import type {
  FreelancerDoc,
  RegisterFreelancerRequest,
  FreelancerResponse,
  VerificationStatus,
} from './types';

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
  if (!data.companyName || data.companyName.trim().length < 2) {
    throw new Error('Company name is required (min. 2 characters)');
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

  // Tenant für Freelancer erstellen
  const companyName = data.companyName.trim();
  const { tenantId, entitlements } = await createTenant(uid, email, companyName);
  
  console.log(`✅ Created tenant ${tenantId} for freelancer ${uid} (${companyName})`);

  // Freelancer-Dokument speichern
  const freelancerData: Record<string, unknown> = {
    uid,
    email,
    displayName: data.displayName.trim(),
    companyName: companyName,
    tenantId: tenantId, // Haupt-Tenant-ID speichern
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  
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

