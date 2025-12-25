/**
 * Members Service
 *
 * Firestore-Operationen für Mitarbeiterverwaltung.
 */

import { getAdminFirestore, getAdminAuth } from '../../core/firebase';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  MEMBER_ROLES,
  MEMBER_STATUS,
  type MemberRole,
  type MemberStatus,
  type Member,
  type MemberStats,
  type InviteMemberRequest,
  type UpdateMemberRequest,
  type MemberDoc,
} from './types';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Hilfsfunktion: Timestamp zu ISO String (mit Fallback).
 */
function timestampToISO(ts: Timestamp | Date | undefined | null): string {
  if (!ts) {
    return new Date().toISOString();
  }
  if (ts instanceof Timestamp) {
    return ts.toDate().toISOString();
  }
  if (ts instanceof Date) {
    return ts.toISOString();
  }
  // Falls es ein Firestore Timestamp-like Objekt ist
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return (ts as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

/**
 * Konvertiert MemberDoc zu API Response.
 * Kompatibel mit alten und neuen Dokumentformaten.
 */
function memberToResponse(id: string, doc: Record<string, unknown>): Member {
  // Unterstütze sowohl alte (joinedAt) als auch neue (createdAt) Formate
  const createdAt = (doc.createdAt || doc.joinedAt) as Timestamp | Date | undefined;
  const updatedAt = (doc.updatedAt || doc.createdAt || doc.joinedAt) as Timestamp | Date | undefined;
  
  // Status: alte Dokumente haben möglicherweise keinen Status
  const status = (doc.status as string) || MEMBER_STATUS.ACTIVE;
  
  return {
    id,
    uid: (doc.uid as string) || id, // Fallback: Dokument-ID als UID
    email: (doc.email as string) || '',
    displayName: doc.displayName as string | undefined,
    firstName: doc.firstName as string | undefined,
    lastName: doc.lastName as string | undefined,
    address: doc.address as string | undefined,
    employeeNumber: doc.employeeNumber as string | undefined,
    role: (doc.role as MemberRole) || MEMBER_ROLES.EMPLOYEE,
    status: status as MemberStatus,
    phone: doc.phone as string | undefined,
    department: doc.department as string | undefined,
    position: doc.position as string | undefined,
    hourlyRate: doc.hourlyRate as number | undefined,
    skills: doc.skills as string[] | undefined,
    notes: doc.notes as string | undefined,
    // Security-spezifische Qualifikationen
    hasSachkunde: doc.hasSachkunde as boolean | undefined,
    hasFuehrerschein: doc.hasFuehrerschein as boolean | undefined,
    hasUnterweisung: doc.hasUnterweisung as boolean | undefined,
    securityQualifications: doc.securityQualifications as string[] | undefined,
    createdAt: timestampToISO(createdAt),
    updatedAt: timestampToISO(updatedAt),
    invitedByUid: (doc.invitedByUid || doc.invitedBy) as string | undefined,
    lastActiveAt: doc.lastActiveAt ? timestampToISO(doc.lastActiveAt as Timestamp) : undefined,
  };
}

/**
 * Berechnet Mitarbeiter-Statistiken.
 */
function calculateStats(members: Member[]): MemberStats {
  return {
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.status === MEMBER_STATUS.ACTIVE).length,
    inactiveMembers: members.filter((m) => m.status === MEMBER_STATUS.INACTIVE).length,
    pendingMembers: members.filter((m) => m.status === MEMBER_STATUS.PENDING).length,
    adminCount: members.filter((m) => m.role === MEMBER_ROLES.ADMIN).length,
    memberCount: members.filter((m) => m.role === MEMBER_ROLES.EMPLOYEE).length,
    freelancerCount: members.filter((m) => m.role === MEMBER_ROLES.MANAGER).length,
  };
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Lädt alle Mitarbeiter eines Tenants.
 */
export async function getMembers(tenantId: string): Promise<{ members: Member[]; stats: MemberStats }> {
  const db = getAdminFirestore();

  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .get();

  const members = snapshot.docs.map((doc) =>
    memberToResponse(doc.id, doc.data())
  );

  // Sortiere nach Name/Email
  members.sort((a, b) => {
    const nameA = a.displayName || a.email;
    const nameB = b.displayName || b.email;
    return nameA.localeCompare(nameB);
  });

  return {
    members,
    stats: calculateStats(members),
  };
}

/**
 * Lädt einen einzelnen Mitarbeiter.
 */
export async function getMemberById(
  tenantId: string,
  memberId: string
): Promise<Member | null> {
  const db = getAdminFirestore();

  const memberRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .doc(memberId);

  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    return null;
  }

  return memberToResponse(memberId, memberSnap.data() || {});
}

/**
 * Lädt Mitarbeiter anhand der UID.
 */
export async function getMemberByUid(
  tenantId: string,
  uid: string
): Promise<Member | null> {
  const db = getAdminFirestore();

  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .where('uid', '==', uid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return memberToResponse(doc.id, doc.data() || {});
}

/**
 * Erstellt einen neuen Mitarbeiter (Einladung).
 * Erstellt auch einen Firebase Auth User und generiert einen Password Reset Link.
 */
export async function inviteMember(
  tenantId: string,
  inviterUid: string,
  data: InviteMemberRequest
): Promise<{ member: Member; passwordResetLink?: string }> {
  const db = getAdminFirestore();
  const auth = getAdminAuth();

  // Validierung
  if (!data.email || !data.email.includes('@')) {
    throw new Error('Valid email is required');
  }
  if (!data.role) {
    throw new Error('Role is required');
  }

  const email = data.email.toLowerCase().trim();

  // Prüfen ob E-Mail bereits im Tenant existiert
  const existingSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    throw new Error('A member with this email already exists');
  }

  // Firebase Auth User erstellen oder existierenden finden
  let uid: string;
  let passwordResetLink: string | undefined;

  try {
    // Prüfe ob User bereits in Firebase Auth existiert
    const existingUser = await auth.getUserByEmail(email).catch(() => null);

    if (existingUser) {
      uid = existingUser.uid;
      console.log(`📧 User ${email} exists in Firebase Auth (uid: ${uid})`);
    } else {
      // Neuen Firebase Auth User erstellen mit temporärem Passwort
      const tempPassword = `Temp${Math.random().toString(36).slice(2)}!${Date.now()}`;
      
      const newUser = await auth.createUser({
        email,
        password: tempPassword,
        displayName: data.displayName?.trim() || undefined,
        disabled: false,
      });
      
      uid = newUser.uid;
      console.log(`✅ Created Firebase Auth user: ${email} (uid: ${uid})`);
    }

    // Password Reset Link generieren
    try {
      passwordResetLink = await auth.generatePasswordResetLink(email);
      console.log(`🔗 Password reset link generated for: ${email}`);
    } catch (linkError) {
      console.warn(`⚠️ Could not generate password reset link:`, linkError);
      // Nicht kritisch - User kann auch "Passwort vergessen" nutzen
    }
  } catch (authError) {
    console.error('❌ Firebase Auth error:', authError);
    throw new Error(`Failed to create user account: ${authError instanceof Error ? authError.message : 'Unknown error'}`);
  }

  // Mitarbeiter in Firestore erstellen
  const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(uid);

  const memberData: Record<string, unknown> = {
    uid,
    email,
    role: data.role,
    status: MEMBER_STATUS.PENDING,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    invitedByUid: inviterUid,
  };

  // Optionale Felder nur hinzufügen wenn sie Werte haben
  if (data.displayName?.trim()) {
    memberData.displayName = data.displayName.trim();
  }
  if (data.firstName?.trim()) {
    memberData.firstName = data.firstName.trim();
  }
  if (data.lastName?.trim()) {
    memberData.lastName = data.lastName.trim();
  }
  if (data.address?.trim()) {
    memberData.address = data.address.trim();
  }
  if (data.employeeNumber?.trim()) {
    memberData.employeeNumber = data.employeeNumber.trim();
  }
  if (data.department?.trim()) {
    memberData.department = data.department.trim();
  }
  if (data.position?.trim()) {
    memberData.position = data.position.trim();
  }
  if (data.hourlyRate !== undefined && data.hourlyRate > 0) {
    memberData.hourlyRate = data.hourlyRate;
  }
  if (data.skills && data.skills.length > 0) {
    memberData.skills = data.skills;
  }
  if (data.notes?.trim()) {
    memberData.notes = data.notes.trim();
  }
  // Security-spezifische Qualifikationen
  if (data.hasSachkunde !== undefined) {
    memberData.hasSachkunde = data.hasSachkunde;
  }
  if (data.hasFuehrerschein !== undefined) {
    memberData.hasFuehrerschein = data.hasFuehrerschein;
  }
  if (data.hasUnterweisung !== undefined) {
    memberData.hasUnterweisung = data.hasUnterweisung;
  }
  if (data.securityQualifications && data.securityQualifications.length > 0) {
    memberData.securityQualifications = data.securityQualifications;
  }

  await memberRef.set(memberData);

  // User-Dokument erstellen/aktualisieren mit defaultTenantId
  // Damit der User beim Login direkt dem Tenant zugeordnet wird
  await db.collection('users').doc(uid).set({
    email,
    defaultTenantId: tenantId,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  
  console.log(`📝 User document updated for ${email} with tenant ${tenantId}`);

  // Zurücklesen
  const savedDoc = await memberRef.get();
  const member = memberToResponse(memberRef.id, savedDoc.data() || {});

  return { member, passwordResetLink };
}

/**
 * Aktualisiert einen Mitarbeiter.
 */
export async function updateMember(
  tenantId: string,
  memberId: string,
  data: UpdateMemberRequest
): Promise<Member> {
  const db = getAdminFirestore();

  const memberRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .doc(memberId);

  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    throw new Error('Member not found');
  }

  // Update-Daten zusammenstellen
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Nur geänderte Felder hinzufügen
  if (data.displayName !== undefined) {
    updateData.displayName = data.displayName?.trim() || null;
  }
  if (data.firstName !== undefined) {
    updateData.firstName = data.firstName?.trim() || null;
  }
  if (data.lastName !== undefined) {
    updateData.lastName = data.lastName?.trim() || null;
  }
  if (data.address !== undefined) {
    updateData.address = data.address?.trim() || null;
  }
  if (data.employeeNumber !== undefined) {
    updateData.employeeNumber = data.employeeNumber?.trim() || null;
  }
  if (data.role !== undefined) {
    updateData.role = data.role;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.phone !== undefined) {
    updateData.phone = data.phone?.trim() || null;
  }
  if (data.department !== undefined) {
    updateData.department = data.department?.trim() || null;
  }
  if (data.position !== undefined) {
    updateData.position = data.position?.trim() || null;
  }
  if (data.hourlyRate !== undefined) {
    updateData.hourlyRate = data.hourlyRate > 0 ? data.hourlyRate : null;
  }
  if (data.skills !== undefined) {
    updateData.skills = data.skills.length > 0 ? data.skills : null;
  }
  if (data.notes !== undefined) {
    updateData.notes = data.notes?.trim() || null;
  }
  // Security-spezifische Qualifikationen
  if (data.hasSachkunde !== undefined) {
    updateData.hasSachkunde = data.hasSachkunde;
  }
  if (data.hasFuehrerschein !== undefined) {
    updateData.hasFuehrerschein = data.hasFuehrerschein;
  }
  if (data.hasUnterweisung !== undefined) {
    updateData.hasUnterweisung = data.hasUnterweisung;
  }
  if (data.securityQualifications !== undefined) {
    updateData.securityQualifications = data.securityQualifications.length > 0 ? data.securityQualifications : null;
  }

  await memberRef.update(updateData);

  // Zurücklesen
  const updatedDoc = await memberRef.get();
  return memberToResponse(memberId, updatedDoc.data() || {});
}

/**
 * Löscht einen Mitarbeiter.
 */
export async function deleteMember(
  tenantId: string,
  memberId: string,
  actorUid: string
): Promise<void> {
  const db = getAdminFirestore();

  const memberRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .doc(memberId);

  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    throw new Error('Member not found');
  }

  const memberData = memberSnap.data() || {};

  // Verhindern, dass man sich selbst löscht
  if (memberData.uid === actorUid) {
    throw new Error('Cannot delete yourself');
  }

  await memberRef.delete();
}

/**
 * Aktiviert einen Mitarbeiter.
 */
export async function activateMember(
  tenantId: string,
  memberId: string
): Promise<Member> {
  return updateMember(tenantId, memberId, { status: MEMBER_STATUS.ACTIVE });
}

/**
 * Deaktiviert einen Mitarbeiter.
 */
export async function deactivateMember(
  tenantId: string,
  memberId: string
): Promise<Member> {
  return updateMember(tenantId, memberId, { status: MEMBER_STATUS.INACTIVE });
}

/**
 * Generiert einen neuen Password Reset Link für einen bestehenden Mitarbeiter.
 */
export async function generatePasswordResetLink(
  tenantId: string,
  memberId: string
): Promise<string> {
  const db = getAdminFirestore();
  const auth = getAdminAuth();

  // Mitarbeiter laden
  const member = await getMemberById(tenantId, memberId);
  if (!member) {
    throw new Error('Member not found');
  }

  // Password Reset Link generieren
  try {
    const passwordResetLink = await auth.generatePasswordResetLink(member.email);
    console.log(`🔗 Password reset link generated for: ${member.email}`);
    return passwordResetLink;
  } catch (linkError) {
    console.error('❌ Could not generate password reset link:', linkError);
    throw new Error(`Failed to generate password reset link: ${linkError instanceof Error ? linkError.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Member Shifts
// =============================================================================

/**
 * Schicht mit Zuweisung für Mitarbeiter-Detailansicht.
 */
export interface MemberShift {
  id: string;
  title: string;
  location: { name: string; address?: string };
  startsAt: string;
  endsAt: string;
  status: string;
  assignmentStatus: string;
  assignmentId: string;
  assignmentType: 'accepted' | 'direct';
  createdAt: string;
}

/**
 * Lädt alle Schichten eines Mitarbeiters (zugewiesen + angenommen).
 */
export async function getMemberShifts(
  tenantId: string,
  uid: string,
  options: { includeCompleted?: boolean } = {}
): Promise<MemberShift[]> {
  const db = getAdminFirestore();
  const { includeCompleted = false } = options;

  // Alle Zuweisungen des Users laden
  const assignmentsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('assignments')
    .where('uid', '==', uid)
    .get();

  if (assignmentsSnapshot.empty) {
    return [];
  }

  // Schicht-IDs und Assignment-Daten sammeln
  const shiftAssignments = new Map<string, { 
    assignmentId: string; 
    status: string; 
    createdAt: Timestamp;
  }>();
  
  assignmentsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    shiftAssignments.set(data.shiftId, {
      assignmentId: doc.id,
      status: data.status,
      createdAt: data.createdAt,
    });
  });

  // Alle Schichten laden
  const shiftsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shifts')
    .get();

  // Bewerbungen laden um den Zuweisungstyp zu bestimmen
  const applicationsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .where('uid', '==', uid)
    .get();

  const applicationShiftIds = new Set<string>();
  applicationsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.status === 'ACCEPTED') {
      applicationShiftIds.add(data.shiftId);
    }
  });

  // Relevante Schichten filtern und anreichern
  const now = new Date();
  const shifts: MemberShift[] = [];

  for (const doc of shiftsSnapshot.docs) {
    const assignment = shiftAssignments.get(doc.id);
    if (!assignment) continue;

    const data = doc.data();
    const endsAt = data.endsAt.toDate();

    // Vergangene Schichten nur wenn includeCompleted
    if (!includeCompleted && endsAt < now) {
      continue;
    }

    // Zuweisungstyp bestimmen
    const assignmentType = applicationShiftIds.has(doc.id) ? 'accepted' : 'direct';

    shifts.push({
      id: doc.id,
      title: data.title,
      location: data.location,
      startsAt: data.startsAt.toDate().toISOString(),
      endsAt: data.endsAt.toDate().toISOString(),
      status: data.status,
      assignmentStatus: assignment.status,
      assignmentId: assignment.assignmentId,
      assignmentType,
      createdAt: assignment.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    });
  }

  // Nach Startzeit sortieren (nächste zuerst)
  shifts.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return shifts;
}
