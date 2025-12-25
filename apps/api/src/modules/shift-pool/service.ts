/**
 * Shift Pool Service
 *
 * Firestore-Operationen für das Schichtausschreibungs-Modul.
 */

import { getAdminFirestore, getAdminStorage } from '../../core/firebase/index.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  SHIFT_STATUS,
  APPLICATION_STATUS,
  ASSIGNMENT_STATUS,
  AUDIT_ACTIONS,
  type ShiftStatus,
  type ApplicationStatus,
  type AssignmentStatus,
  type Shift,
  type PoolShift,
  type Application,
  type Assignment,
  type CreateShiftRequest,
  type ShiftDoc,
  type ApplicationDoc,
  type AssignmentDoc,
  type AuditLogDoc,
  type ShiftTimeEntry,
  type ShiftTimeEntryDoc,
  type CreateShiftTimeEntryRequest,
  type UpdateShiftTimeEntryRequest,
  type ShiftDocument,
  type ShiftDocumentDoc,
} from './types';
import { NOTIFICATION_TYPES, MEMBER_STATUS } from '@timeam/shared';
import { createNotification, createNotificationsForUsers } from '../notifications/index.js';
import { addTenantToFreelancer, getFreelancer } from '../freelancer/service.js';
import type { FreelancerDoc } from '../freelancer/types.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Konvertiert ShiftDoc zu API Response.
 */
function shiftToResponse(id: string, doc: ShiftDoc): Shift {
  return {
    id,
    title: doc.title,
    location: doc.location,
    startsAt: doc.startsAt.toDate().toISOString(),
    endsAt: doc.endsAt.toDate().toISOString(),
    requiredCount: doc.requiredCount,
    filledCount: doc.filledCount,
    payRate: doc.payRate,
    requirements: doc.requirements,
    applyDeadline: doc.applyDeadline?.toDate().toISOString(),
    status: doc.status as ShiftStatus,
    crewLeaderUid: doc.crewLeaderUid,
    createdByUid: doc.createdByUid,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
    isPublicPool: doc.isPublicPool ?? false,
  };
}

/**
 * Konvertiert ApplicationDoc zu API Response.
 */
function applicationToResponse(id: string, doc: ApplicationDoc): Application {
  return {
    id,
    shiftId: doc.shiftId,
    uid: doc.uid,
    email: doc.email,
    note: doc.note,
    status: doc.status as ApplicationStatus,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
    isFreelancer: doc.isFreelancer ?? false,
  };
}

/**
 * Erstellt einen Audit-Log Eintrag.
 */
async function createAuditLog(
  tenantId: string,
  actorUid: string,
  action: string,
  entity: 'shift' | 'application' | 'assignment',
  entityId: string,
  details?: Record<string, unknown>
): Promise<void> {
  const db = getAdminFirestore();

  // Basis-Dokument
  const logData: Record<string, unknown> = {
    actorUid,
    action,
    entity,
    entityId,
    at: FieldValue.serverTimestamp(),
  };

  // Details nur hinzufügen wenn vorhanden (undefined ist nicht erlaubt)
  if (details !== undefined && Object.keys(details).length > 0) {
    logData.details = details;
  }

  await db.collection('tenants').doc(tenantId).collection('auditLogs').add(logData);
}

// =============================================================================
// Shift Operations (Admin)
// =============================================================================

/**
 * Erstellt eine neue Schicht (Draft).
 */
export async function createShift(
  tenantId: string,
  creatorUid: string,
  data: CreateShiftRequest
): Promise<Shift> {
  const db = getAdminFirestore();

  // Validierung
  if (!data.title || data.title.trim().length < 2) {
    throw new Error('Title is required (min. 2 characters)');
  }
  if (!data.location?.name) {
    throw new Error('Location name is required');
  }
  if (data.requiredCount < 1) {
    throw new Error('Required count must be at least 1');
  }

  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(data.endsAt);
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    throw new Error('Invalid date format');
  }
  if (startsAt >= endsAt) {
    throw new Error('Start time must be before end time');
  }

  // Schicht erstellen
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc();

  // Location-Objekt ohne undefined Werte
  const locationData: { name: string; address?: string; latitude?: number; longitude?: number } = {
    name: data.location.name.trim(),
  };
  if (data.location.address && data.location.address.trim()) {
    locationData.address = data.location.address.trim();
  }
  
  // Koordinaten validieren und speichern
  if (data.location.latitude !== undefined || data.location.longitude !== undefined) {
    if (data.location.latitude === undefined || data.location.longitude === undefined) {
      throw new Error('Both latitude and longitude must be provided if coordinates are set');
    }
    locationData.latitude = data.location.latitude;
    locationData.longitude = data.location.longitude;
  }

  // Basis-Daten ohne undefined Werte
  const shiftData: Record<string, unknown> = {
    title: data.title.trim(),
    location: locationData,
    startsAt: Timestamp.fromDate(startsAt),
    endsAt: Timestamp.fromDate(endsAt),
    requiredCount: data.requiredCount,
    filledCount: 0,
    status: SHIFT_STATUS.DRAFT,
    createdByUid: creatorUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Optionale Felder nur hinzufügen wenn sie Werte haben
  if (data.payRate !== undefined && data.payRate > 0) {
    shiftData.payRate = data.payRate;
  }
  if (data.requirements && data.requirements.length > 0) {
    shiftData.requirements = data.requirements;
  }
  if (data.applyDeadline) {
    const deadline = new Date(data.applyDeadline);
    if (!isNaN(deadline.getTime())) {
      shiftData.applyDeadline = Timestamp.fromDate(deadline);
    }
  }
  if (data.crewLeaderUid) {
    // Validierung: Crew-Leiter muss ein Mitglied des Tenants sein
    const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(data.crewLeaderUid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      throw new Error('Crew leader must be a member of the tenant');
    }
    shiftData.crewLeaderUid = data.crewLeaderUid;
  }
  if (data.isPublicPool !== undefined) {
    shiftData.isPublicPool = data.isPublicPool;
  }

  await shiftRef.set(shiftData);

  // Audit Log
  await createAuditLog(tenantId, creatorUid, AUDIT_ACTIONS.SHIFT_CREATE, 'shift', shiftRef.id);

  // Zurücklesen
  const savedDoc = await shiftRef.get();
  return shiftToResponse(shiftRef.id, savedDoc.data() as ShiftDoc);
}

/**
 * Aktualisiert eine Schicht.
 */
export async function updateShift(
  tenantId: string,
  shiftId: string,
  actorUid: string,
  data: Partial<CreateShiftRequest>
): Promise<Shift> {
  const db = getAdminFirestore();
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);

  const shiftSnap = await shiftRef.get();
  if (!shiftSnap.exists) {
    throw new Error('Shift not found');
  }

  const shiftData = shiftSnap.data() as ShiftDoc;

  // Nur DRAFT und PUBLISHED können bearbeitet werden
  if (shiftData.status !== SHIFT_STATUS.DRAFT && shiftData.status !== SHIFT_STATUS.PUBLISHED) {
    throw new Error(`Cannot edit shift with status ${shiftData.status}`);
  }

  // Update-Daten zusammenstellen
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length < 2) {
      throw new Error('Title must be at least 2 characters');
    }
    updateData.title = data.title.trim();
  }

  if (data.location !== undefined) {
    if (!data.location?.name) {
      throw new Error('Location name is required');
    }
    const locationData: { name: string; address?: string; latitude?: number; longitude?: number } = {
      name: data.location.name.trim(),
    };
    if (data.location.address && data.location.address.trim()) {
      locationData.address = data.location.address.trim();
    }
    
    // Koordinaten validieren und speichern
    if (data.location.latitude !== undefined || data.location.longitude !== undefined) {
      if (data.location.latitude === undefined || data.location.longitude === undefined) {
        throw new Error('Both latitude and longitude must be provided if coordinates are set');
      }
      locationData.latitude = data.location.latitude;
      locationData.longitude = data.location.longitude;
    }
    updateData.location = locationData;
  }

  if (data.startsAt !== undefined || data.endsAt !== undefined) {
    const startsAt = data.startsAt ? new Date(data.startsAt) : shiftData.startsAt.toDate();
    const endsAt = data.endsAt ? new Date(data.endsAt) : shiftData.endsAt.toDate();
    
    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
      throw new Error('Invalid date format');
    }
    if (startsAt >= endsAt) {
      throw new Error('Start time must be before end time');
    }
    
    if (data.startsAt !== undefined) {
      updateData.startsAt = Timestamp.fromDate(startsAt);
    }
    if (data.endsAt !== undefined) {
      updateData.endsAt = Timestamp.fromDate(endsAt);
    }
  }

  if (data.requiredCount !== undefined) {
    if (data.requiredCount < 1) {
      throw new Error('Required count must be at least 1');
    }
    // Wenn bereits Leute angenommen sind, darf requiredCount nicht kleiner werden
    if (data.requiredCount < shiftData.filledCount) {
      throw new Error(`Cannot reduce required count below filled count (${shiftData.filledCount})`);
    }
    updateData.requiredCount = data.requiredCount;
  }

  if (data.payRate !== undefined) {
    updateData.payRate = data.payRate > 0 ? data.payRate : FieldValue.delete();
  }

  if (data.requirements !== undefined) {
    updateData.requirements = data.requirements.length > 0 ? data.requirements : FieldValue.delete();
  }

  if (data.applyDeadline !== undefined) {
    if (data.applyDeadline) {
      const deadline = new Date(data.applyDeadline);
      if (!isNaN(deadline.getTime())) {
        updateData.applyDeadline = Timestamp.fromDate(deadline);
      }
    } else {
      updateData.applyDeadline = FieldValue.delete();
    }
  }

  if (data.crewLeaderUid !== undefined) {
    if (data.crewLeaderUid) {
      // Validierung: Crew-Leiter muss ein Mitglied des Tenants sein
      const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(data.crewLeaderUid);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) {
        throw new Error('Crew leader must be a member of the tenant');
      }
      updateData.crewLeaderUid = data.crewLeaderUid;
    } else {
      updateData.crewLeaderUid = FieldValue.delete();
    }
  }

  if (data.isPublicPool !== undefined) {
    updateData.isPublicPool = data.isPublicPool;
  }

  await shiftRef.update(updateData);

  // Audit Log
  await createAuditLog(tenantId, actorUid, 'SHIFT_UPDATE', 'shift', shiftId);

  // Benachrichtigung bei veröffentlichten Schichten an alle Beteiligten
  if (shiftData.status === SHIFT_STATUS.PUBLISHED) {
    try {
      // Zugewiesene Mitarbeiter
      const assigneesUids = await getAssignedUserIds(tenantId, shiftId);
      
      // Bewerber (mit PENDING Status)
      const applicantsSnapshot = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('applications')
        .where('shiftId', '==', shiftId)
        .where('status', '==', APPLICATION_STATUS.PENDING)
        .get();
      
      const applicantUids = applicantsSnapshot.docs
        .map((doc) => doc.data().uid as string)
        .filter((uid) => !assigneesUids.includes(uid)); // Keine Dopplung

      const allInvolvedUids = [...new Set([...assigneesUids, ...applicantUids])];

      if (allInvolvedUids.length > 0) {
        const startsAt = shiftData.startsAt.toDate();
        const dateStr = startsAt.toLocaleDateString('de-DE', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        });

        // Was hat sich geändert?
        const changes: string[] = [];
        if (updateData.startsAt || updateData.endsAt) changes.push('Zeit');
        if (updateData.location) changes.push('Ort');
        if (updateData.title) changes.push('Titel');
        if (updateData.payRate !== undefined) changes.push('Vergütung');

        const changeText = changes.length > 0 ? changes.join(', ') : 'Details';

        await createNotificationsForUsers(tenantId, allInvolvedUids, {
          type: NOTIFICATION_TYPES.SHIFT_UPDATED,
          title: 'Schicht wurde geändert ✏️',
          message: `"${shiftData.title}" am ${dateStr}: ${changeText} aktualisiert.`,
          ref: { type: 'shift', id: shiftId },
          link: `/shifts/${shiftId}`,
        });
      }
    } catch (notificationError) {
      console.error('Failed to create update notifications:', notificationError);
    }
  }

  // Zurücklesen
  const updatedDoc = await shiftRef.get();
  return shiftToResponse(shiftId, updatedDoc.data() as ShiftDoc);
}

/**
 * Löscht eine Schicht.
 */
export async function deleteShift(
  tenantId: string,
  shiftId: string,
  actorUid: string
): Promise<void> {
  const db = getAdminFirestore();
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);

  const shiftSnap = await shiftRef.get();
  if (!shiftSnap.exists) {
    throw new Error('Shift not found');
  }

  const shiftData = shiftSnap.data() as ShiftDoc;

  // DRAFT und CANCELLED können immer gelöscht werden
  // CLOSED können gelöscht werden, wenn keine aktiven Zuweisungen existieren
  if (shiftData.status === SHIFT_STATUS.DRAFT || shiftData.status === SHIFT_STATUS.CANCELLED) {
    // DRAFT und CANCELLED: Immer löschbar (auch mit Bewerbungen/Zuweisungen)
  } else if (shiftData.status === SHIFT_STATUS.CLOSED) {
    // CLOSED: Prüfen ob aktive Zuweisungen existieren
    const db = getAdminFirestore();
    
    const assignmentsSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('assignments')
      .where('shiftId', '==', shiftId)
      .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
      .limit(1)
      .get();
    
    if (!assignmentsSnapshot.empty) {
      throw new Error('Cannot delete closed shift with active assignments. Please remove assignments first.');
    }
  } else {
    // PUBLISHED, COMPLETED: Nicht löschbar, muss erst abgesagt/geschlossen werden
    throw new Error('Only draft, cancelled, or closed shifts can be deleted. Use cancel for published shifts.');
  }

  // Schicht löschen
  await shiftRef.delete();

  // Audit Log
  await createAuditLog(tenantId, actorUid, 'SHIFT_DELETE', 'shift', shiftId);
}

/**
 * Schließt eine Schicht (keine weiteren Bewerbungen).
 */
export async function closeShift(
  tenantId: string,
  shiftId: string,
  actorUid: string
): Promise<Shift> {
  const db = getAdminFirestore();
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);

  const shiftSnap = await shiftRef.get();
  if (!shiftSnap.exists) {
    throw new Error('Shift not found');
  }

  const shiftData = shiftSnap.data() as ShiftDoc;

  if (shiftData.status !== SHIFT_STATUS.PUBLISHED) {
    throw new Error('Only published shifts can be closed');
  }

  await shiftRef.update({
    status: SHIFT_STATUS.CLOSED,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.SHIFT_CLOSE, 'shift', shiftId);

  // Benachrichtigung an zugewiesene Mitarbeiter
  try {
    const assigneesUids = await getAssignedUserIds(tenantId, shiftId);
    if (assigneesUids.length > 0) {
      const startsAt = shiftData.startsAt.toDate();
      const dateStr = startsAt.toLocaleDateString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      });

      await createNotificationsForUsers(tenantId, assigneesUids, {
        type: NOTIFICATION_TYPES.SHIFT_CLOSED,
        title: 'Schicht geschlossen',
        message: `"${shiftData.title}" am ${dateStr} nimmt keine Bewerbungen mehr an.`,
        ref: { type: 'shift', id: shiftId },
        link: '/my-shifts',
      });
    }
  } catch (notificationError) {
    console.error('Failed to create close notifications:', notificationError);
  }

  const updatedDoc = await shiftRef.get();
  return shiftToResponse(shiftId, updatedDoc.data() as ShiftDoc);
}

/**
 * Sagt eine Schicht ab.
 */
export async function cancelShift(
  tenantId: string,
  shiftId: string,
  actorUid: string
): Promise<Shift> {
  const db = getAdminFirestore();
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);

  const shiftSnap = await shiftRef.get();
  if (!shiftSnap.exists) {
    throw new Error('Shift not found');
  }

  const shiftData = shiftSnap.data() as ShiftDoc;

  if (shiftData.status === SHIFT_STATUS.CANCELLED) {
    throw new Error('Shift is already cancelled');
  }

  // Zugewiesene Mitarbeiter VOR der Absage ermitteln
  const assigneesUids = await getAssignedUserIds(tenantId, shiftId);

  await shiftRef.update({
    status: SHIFT_STATUS.CANCELLED,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.SHIFT_CANCEL, 'shift', shiftId);

  // Benachrichtigung an zugewiesene Mitarbeiter und Freelancer mit Bewerbungen
  try {
    const startsAt = shiftData.startsAt.toDate();
    const dateStr = startsAt.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

    // Benachrichtigung an zugewiesene Mitarbeiter
    if (assigneesUids.length > 0) {
      await createNotificationsForUsers(tenantId, assigneesUids, {
        type: NOTIFICATION_TYPES.SHIFT_CANCELLED,
        title: 'Schicht abgesagt! ⚠️',
        message: `"${shiftData.title}" am ${dateStr} wurde abgesagt.`,
        ref: { type: 'shift', id: shiftId },
        link: '/my-shifts',
      });
    }

    // Benachrichtigung an Freelancer mit Bewerbungen (auch wenn nicht zugewiesen)
    const applicationsSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('applications')
      .where('shiftId', '==', shiftId)
      .where('isFreelancer', '==', true)
      .get();

    for (const appDoc of applicationsSnapshot.docs) {
      const appData = appDoc.data() as ApplicationDoc;
      const freelancer = await getFreelancer(appData.uid);
      
      if (freelancer?.tenantId) {
        await createNotification(freelancer.tenantId, {
          type: NOTIFICATION_TYPES.SHIFT_CANCELLED,
          title: 'Schicht abgesagt! ⚠️',
          message: `"${shiftData.title}" am ${dateStr} wurde abgesagt.`,
          recipientUid: appData.uid,
          ref: { type: 'shift', id: shiftId },
          link: '/freelancer-security-pool',
        });
      }
    }
  } catch (notificationError) {
    console.error('Failed to create cancel notifications:', notificationError);
  }

  const updatedDoc = await shiftRef.get();
  return shiftToResponse(shiftId, updatedDoc.data() as ShiftDoc);
}

/**
 * Hilfsfunktion: Lädt die User-IDs der zugewiesenen Mitarbeiter.
 */
async function getAssignedUserIds(tenantId: string, shiftId: string): Promise<string[]> {
  const db = getAdminFirestore();

  const assignmentsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('assignments')
    .where('shiftId', '==', shiftId)
    .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
    .get();

  return assignmentsSnapshot.docs.map((doc) => doc.data().uid as string);
}

/**
 * Hilfsfunktion: Lädt die User-IDs aller Admins und Manager.
 */
async function getAdminAndManagerUids(tenantId: string): Promise<string[]> {
  const db = getAdminFirestore();

  const membersSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .get();

  return membersSnapshot.docs
    .filter((doc) => {
      const role = doc.data().role;
      return role === 'admin' || role === 'manager';
    })
    .map((doc) => doc.id);
}

/**
 * Veröffentlicht eine Schicht.
 */
export async function publishShift(
  tenantId: string,
  shiftId: string,
  actorUid: string
): Promise<Shift> {
  const db = getAdminFirestore();
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);

  const shiftSnap = await shiftRef.get();
  if (!shiftSnap.exists) {
    throw new Error('Shift not found');
  }

  const shiftData = shiftSnap.data() as ShiftDoc;

  // Nur DRAFT kann published werden (idempotent wenn bereits PUBLISHED)
  if (shiftData.status !== SHIFT_STATUS.DRAFT && shiftData.status !== SHIFT_STATUS.PUBLISHED) {
    throw new Error(`Cannot publish shift with status ${shiftData.status}`);
  }

  if (shiftData.status === SHIFT_STATUS.DRAFT) {
    await shiftRef.update({
      status: SHIFT_STATUS.PUBLISHED,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.SHIFT_PUBLISH, 'shift', shiftId);

    const startsAt = shiftData.startsAt.toDate();
    const dateStr = startsAt.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

    // Benachrichtigung für alle Mitarbeiter erstellen (außer dem Ersteller)
    try {
      const membersSnapshot = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('members')
        .get();

      const recipientUids = membersSnapshot.docs
        .map((doc) => doc.id)
        .filter((uid) => uid !== actorUid);

      if (recipientUids.length > 0) {
        await createNotificationsForUsers(tenantId, recipientUids, {
          type: NOTIFICATION_TYPES.SHIFT_NEW,
          title: 'Neue Schicht verfügbar',
          message: `"${shiftData.title}" am ${dateStr} - ${shiftData.requiredCount} Plätze`,
          ref: { type: 'shift', id: shiftId },
          link: `/shifts/${shiftId}`,
        });
      }
    } catch (notificationError) {
      // Notification-Fehler sollten nicht den Hauptprozess blockieren
      console.error('Failed to create shift notifications:', notificationError);
    }

    // Wenn Schicht öffentlich ist: Benachrichtigung an alle verifizierten Freelancer
    if (shiftData.isPublicPool) {
      try {
        // Alle verifizierten Freelancer laden
        const freelancersSnapshot = await db
          .collection('freelancers')
          .where('verificationStatus', '==', 'approved')
          .get();

        const freelancerUids = freelancersSnapshot.docs.map((doc) => doc.id);

        if (freelancerUids.length > 0) {
          // Für jeden Freelancer: Benachrichtigung in seinem Tenant erstellen
          for (const freelancerUid of freelancerUids) {
            const freelancerDoc = freelancersSnapshot.docs.find((d) => d.id === freelancerUid);
            if (!freelancerDoc) continue;

            const freelancerData = freelancerDoc.data() as FreelancerDoc;
            const freelancerTenantId = freelancerData.tenantId;

            // Nur wenn Freelancer einen Tenant hat
            if (freelancerTenantId) {
              await createNotification(freelancerTenantId, {
                type: NOTIFICATION_TYPES.SHIFT_NEW,
                title: 'Neue Schicht im Freelancer Pool 🎯',
                message: `"${shiftData.title}" am ${dateStr} - ${shiftData.requiredCount} Plätze`,
                recipientUid: freelancerUid,
                ref: { type: 'shift', id: shiftId },
                link: `/freelancer-security-pool`,
              });
            }
          }
        }
      } catch (freelancerNotificationError) {
        console.error('Failed to create freelancer notifications:', freelancerNotificationError);
      }
    }
  }

  const updatedDoc = await shiftRef.get();
  return shiftToResponse(shiftId, updatedDoc.data() as ShiftDoc);
}

/**
 * Lädt alle Schichten eines Tenants (Admin-Sicht).
 */
/**
 * Schicht mit Bewerbungs-Statistiken für Admin-Ansicht.
 */
export interface AdminShift extends Shift {
  /** Anzahl ausstehender Bewerbungen */
  pendingApplications: number;
  /** Anzahl aller Bewerbungen */
  totalApplications: number;
}

export async function getAdminShifts(
  tenantId: string,
  creatorUid?: string
): Promise<AdminShift[]> {
  const db = getAdminFirestore();

  // Einfache Query ohne Composite Index
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shifts')
    .get();

  let shifts = snapshot.docs.map((doc) =>
    shiftToResponse(doc.id, doc.data() as ShiftDoc)
  );

  // Optional: nur eigene Schichten
  if (creatorUid) {
    shifts = shifts.filter((s) => s.createdByUid === creatorUid);
  }

  // Alle Bewerbungen laden um Zähler zu ermitteln
  const applicationsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .get();

  // Bewerbungen pro Schicht gruppieren
  const applicationCounts = new Map<string, { pending: number; total: number }>();
  
  applicationsSnapshot.docs.forEach((doc) => {
    const data = doc.data() as ApplicationDoc;
    const existing = applicationCounts.get(data.shiftId) || { pending: 0, total: 0 };
    
    // Nur nicht-zurückgezogene zählen für total
    if (data.status !== APPLICATION_STATUS.WITHDRAWN) {
      existing.total++;
    }
    // Nur PENDING zählen für pending
    if (data.status === APPLICATION_STATUS.PENDING) {
      existing.pending++;
    }
    
    applicationCounts.set(data.shiftId, existing);
  });

  // Shifts mit Bewerbungszahlen anreichern
  const adminShifts: AdminShift[] = shifts.map((shift) => {
    const counts = applicationCounts.get(shift.id) || { pending: 0, total: 0 };
    return {
      ...shift,
      pendingApplications: counts.pending,
      totalApplications: counts.total,
    };
  });

  // Nach startsAt sortieren (neueste zuerst)
  return adminShifts.sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
  );
}

/**
 * Lädt eine einzelne Schicht.
 */
export async function getShiftById(
  tenantId: string,
  shiftId: string,
  requestingUid: string,
  isAdmin: boolean
): Promise<PoolShift | null> {
  const db = getAdminFirestore();

  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);
  const shiftSnap = await shiftRef.get();

  if (!shiftSnap.exists) {
    return null;
  }

  const shiftData = shiftSnap.data() as ShiftDoc;

  // User darf nur PUBLISHED sehen (Admin darf alles)
  if (!isAdmin && shiftData.status !== SHIFT_STATUS.PUBLISHED) {
    return null;
  }

  const shift = shiftToResponse(shiftId, shiftData);

  // Bewerbungsstatus des Users laden
  const appSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .where('shiftId', '==', shiftId)
    .where('uid', '==', requestingUid)
    .limit(1)
    .get();

  const myApplicationStatus = appSnapshot.empty
    ? undefined
    : (appSnapshot.docs[0].data() as ApplicationDoc).status as ApplicationStatus;

  // Zugewiesene Kollegen laden (Assignments mit Status CONFIRMED)
  const assigneesData = await getShiftAssignees(tenantId, shiftId);

  return {
    ...shift,
    freeSlots: shift.requiredCount - shift.filledCount,
    myApplicationStatus,
    assignees: assigneesData,
  };
}

/**
 * Lädt die zugewiesenen Kollegen für eine Schicht.
 */
async function getShiftAssignees(
  tenantId: string,
  shiftId: string
): Promise<Array<{ uid: string; displayName: string; email?: string }>> {
  const db = getAdminFirestore();

  // Assignments laden
  const assignmentsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('assignments')
    .where('shiftId', '==', shiftId)
    .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
    .get();

  if (assignmentsSnapshot.empty) {
    return [];
  }

  // User-IDs sammeln
  const userIds = assignmentsSnapshot.docs.map((doc) => doc.data().uid as string);

  // Member-Daten laden (aus members collection)
  const membersSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .get();

  const membersMap = new Map<string, { displayName?: string; email?: string }>();
  membersSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    membersMap.set(doc.id, {
      displayName: data.displayName,
      email: data.email,
    });
  });

  // Assignees mit Namen zurückgeben
  return userIds.map((uid) => {
    const member = membersMap.get(uid);
    return {
      uid,
      displayName: member?.displayName || member?.email?.split('@')[0] || 'Unbekannt',
      email: member?.email,
    };
  });
}

// =============================================================================
// Pool Operations (User)
// =============================================================================

/**
 * Lädt die öffentliche Pool-Liste (alle PUBLISHED Schichten mit isPublicPool: true aus allen Tenants).
 */
export async function getPublicPoolList(params: {
  from?: string;
  to?: string;
  location?: string;
  q?: string;
} = {}): Promise<Array<PoolShift & { tenantName: string; tenantId: string }>> {
  const db = getAdminFirestore();

  // Alternative zu Collection Group Query: Alle Tenants durchgehen
  // Collection Group Queries benötigen spezielle Indizes, daher verwenden wir diesen Ansatz
  const tenantsSnapshot = await db.collection('tenants').get();
  
  const allShifts: Array<{ doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>; tenantId: string; tenantName: string }> = [];
  const tenantNames = new Map<string, string>();

  // Für jeden Tenant: Öffentliche Schichten laden
  for (const tenantDoc of tenantsSnapshot.docs) {
    const tenantId = tenantDoc.id;
    const tenantData = tenantDoc.data();
    const tenantName = tenantData?.name || 'Unbekannte Firma';
    tenantNames.set(tenantId, tenantName);

    // Schichten mit isPublicPool: true laden
    const shiftsSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('shifts')
      .where('isPublicPool', '==', true)
      .get();

    // Clientseitig nach PUBLISHED Status filtern
    shiftsSnapshot.docs.forEach((shiftDoc) => {
      const shiftData = shiftDoc.data() as ShiftDoc;
      if (shiftData.status === SHIFT_STATUS.PUBLISHED) {
        allShifts.push({ doc: shiftDoc, tenantId, tenantName });
      }
    });
  }

  // Schichten mit Tenant-Info zusammenstellen
  let shifts = allShifts.map(({ doc, tenantId, tenantName }) => {
    const data = doc.data() as ShiftDoc;
    
    return {
      ...shiftToResponse(doc.id, data),
      freeSlots: data.requiredCount - data.filledCount,
      tenantId,
      tenantName,
    };
  });

  // Filter: Datumsbereich
  if (params.from) {
    const fromDate = new Date(params.from);
    shifts = shifts.filter((s) => new Date(s.startsAt) >= fromDate);
  }
  if (params.to) {
    const toDate = new Date(params.to);
    shifts = shifts.filter((s) => new Date(s.startsAt) <= toDate);
  }

  // Filter: Location
  if (params.location) {
    const locLower = params.location.toLowerCase();
    shifts = shifts.filter((s) =>
      s.location.name.toLowerCase().includes(locLower)
    );
  }

  // Filter: Textsuche
  if (params.q) {
    const qLower = params.q.toLowerCase();
    shifts = shifts.filter(
      (s) =>
        s.title.toLowerCase().includes(qLower) ||
        s.location.name.toLowerCase().includes(qLower) ||
        s.tenantName.toLowerCase().includes(qLower)
    );
  }

  // Nach startsAt sortieren
  shifts.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return shifts;
}

/**
 * Lädt alle Bewerbungen eines Freelancers über alle Tenants hinweg.
 */
export async function getFreelancerApplications(freelancerUid: string): Promise<Array<Application & { tenantId: string; tenantName: string; shiftTitle: string; shiftStartsAt: string }>> {
  const db = getAdminFirestore();
  
  // Alle Tenants durchgehen
  const tenantsSnapshot = await db.collection('tenants').get();
  const allApplications: Array<Application & { tenantId: string; tenantName: string; shiftTitle: string; shiftStartsAt: string }> = [];
  
  for (const tenantDoc of tenantsSnapshot.docs) {
    const tenantId = tenantDoc.id;
    const tenantData = tenantDoc.data();
    const tenantName = tenantData?.name || 'Unbekannte Firma';
    
    // Bewerbungen des Freelancers in diesem Tenant laden
    const appsSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('applications')
      .where('uid', '==', freelancerUid)
      .where('isFreelancer', '==', true)
      .get();
    
    // Schicht-Daten für jede Bewerbung laden
    for (const appDoc of appsSnapshot.docs) {
      const appData = appDoc.data() as ApplicationDoc;
      const shiftDoc = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('shifts')
        .doc(appData.shiftId)
        .get();
      
      if (shiftDoc.exists) {
        const shiftData = shiftDoc.data() as ShiftDoc;
        allApplications.push({
          ...applicationToResponse(appDoc.id, appData),
          tenantId,
          tenantName,
          shiftTitle: shiftData.title,
          shiftStartsAt: shiftData.startsAt.toDate().toISOString(),
        });
      }
    }
  }
  
  // Nach Erstellungsdatum sortieren (neueste zuerst)
  return allApplications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Lädt die Pool-Liste (nur PUBLISHED Schichten).
 */
export async function getPoolList(
  tenantId: string,
  requestingUid: string,
  params: {
    from?: string;
    to?: string;
    location?: string;
    q?: string;
  } = {}
): Promise<PoolShift[]> {
  const db = getAdminFirestore();

  // Einfache Query - Filter werden clientseitig angewendet
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shifts')
    .where('status', '==', SHIFT_STATUS.PUBLISHED)
    .get();

  let shifts = snapshot.docs.map((doc) => {
    const data = doc.data() as ShiftDoc;
    return {
      ...shiftToResponse(doc.id, data),
      freeSlots: data.requiredCount - data.filledCount,
    };
  });

  // Filter: Datumsbereich
  if (params.from) {
    const fromDate = new Date(params.from);
    shifts = shifts.filter((s) => new Date(s.startsAt) >= fromDate);
  }
  if (params.to) {
    const toDate = new Date(params.to);
    shifts = shifts.filter((s) => new Date(s.startsAt) <= toDate);
  }

  // Filter: Location
  if (params.location) {
    const locLower = params.location.toLowerCase();
    shifts = shifts.filter((s) =>
      s.location.name.toLowerCase().includes(locLower)
    );
  }

  // Filter: Textsuche
  if (params.q) {
    const qLower = params.q.toLowerCase();
    shifts = shifts.filter(
      (s) =>
        s.title.toLowerCase().includes(qLower) ||
        s.location.name.toLowerCase().includes(qLower)
    );
  }

  // Nach startsAt sortieren
  shifts.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  // User-Bewerbungen laden
  const appSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .where('uid', '==', requestingUid)
    .get();

  const userApps = new Map<string, ApplicationStatus>();
  appSnapshot.docs.forEach((doc) => {
    const data = doc.data() as ApplicationDoc;
    userApps.set(data.shiftId, data.status as ApplicationStatus);
  });

  // Bewerbungsstatus hinzufügen
  return shifts.map((shift) => ({
    ...shift,
    myApplicationStatus: userApps.get(shift.id),
  }));
}

// =============================================================================
// Application Operations
// =============================================================================

/**
 * Bewirbt sich auf eine öffentliche Schicht als Freelancer.
 */
export async function applyToPublicShift(
  shiftId: string,
  applicantUid: string,
  applicantEmail: string,
  note?: string
): Promise<Application & { tenantId: string }> {
  const db = getAdminFirestore();

  // Schicht finden: Alle Tenants durchgehen und nach shiftId suchen
  // Collection Group Queries benötigen spezielle Indizes, daher verwenden wir diesen Ansatz
  const tenantsSnapshot = await db.collection('tenants').get();
  
  let shiftDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;
  let tenantId = '';

  // Für jeden Tenant: Schicht mit shiftId suchen
  for (const tenantDoc of tenantsSnapshot.docs) {
    const currentTenantId = tenantDoc.id;
    const shiftRef = db
      .collection('tenants')
      .doc(currentTenantId)
      .collection('shifts')
      .doc(shiftId);
    
    const shiftSnap = await shiftRef.get();
    
    if (shiftSnap.exists) {
      const shiftData = shiftSnap.data() as ShiftDoc;
      // Prüfen ob Schicht öffentlich und veröffentlicht ist
      if (shiftData.isPublicPool && shiftData.status === SHIFT_STATUS.PUBLISHED) {
        shiftDoc = shiftSnap as import('firebase-admin/firestore').QueryDocumentSnapshot<import('firebase-admin/firestore').DocumentData>;
        tenantId = currentTenantId;
        break;
      }
    }
  }

  if (!shiftDoc || !tenantId) {
    throw new Error('Public shift not found or not available');
  }

  const shiftData = shiftDoc.data() as ShiftDoc;

  // Prüfen ob User ein Freelancer ist
  const freelancerDoc = await db.collection('freelancers').doc(applicantUid).get();
  if (!freelancerDoc.exists) {
    throw new Error('Only freelancers can apply to public shifts');
  }

  // Prüfen ob Freelancer verifiziert ist
  const freelancerData = freelancerDoc.data();
  if (freelancerData?.verificationStatus !== 'approved') {
    throw new Error('Bitte verifizieren Sie zuerst Ihr Konto, bevor Sie sich auf Schichten bewerben können');
  }

  // Hinweis: Ein User kann sowohl Freelancer als auch Tenant-Member sein.
  // In diesem Fall erlauben wir die Bewerbung als Freelancer auf öffentliche Schichten,
  // auch wenn er zufällig auch ein Member des Tenants ist, der die Schicht erstellt hat.
  // Die Member-Prüfung wird hier nicht durchgeführt, da Freelancer sich immer
  // als Freelancer auf öffentliche Schichten bewerben können sollen.

  // Deadline prüfen
  if (shiftData.applyDeadline) {
    const now = new Date();
    if (now > shiftData.applyDeadline.toDate()) {
      throw new Error('Application deadline has passed');
    }
  }

  // Prüfen ob bereits beworben (nicht WITHDRAWN)
  const existingApp = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .where('shiftId', '==', shiftId)
    .where('uid', '==', applicantUid)
    .get();

  const activeApp = existingApp.docs.find(
    (doc) => (doc.data() as ApplicationDoc).status !== APPLICATION_STATUS.WITHDRAWN
  );

  if (activeApp) {
    throw new Error('Sie haben sich bereits auf diese Schicht beworben');
  }

  // Freelancer-Name aus bereits geladenen Daten verwenden
  const freelancerName = freelancerData?.displayName || applicantEmail.split('@')[0];

  // Bewerbung erstellen
  const appRef = db.collection('tenants').doc(tenantId).collection('applications').doc();

  const appData: Omit<ApplicationDoc, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
    updatedAt: ReturnType<typeof FieldValue.serverTimestamp>;
  } = {
    shiftId,
    uid: applicantUid,
    email: applicantEmail,
    status: APPLICATION_STATUS.PENDING,
    isFreelancer: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (note && note.trim()) {
    (appData as Record<string, unknown>).note = note.trim();
  }

  await appRef.set(appData);

  await createAuditLog(tenantId, applicantUid, AUDIT_ACTIONS.APP_CREATE, 'application', appRef.id, {
    shiftId,
    isFreelancer: true,
  });

  // Benachrichtigung an Admins und Manager
  try {
    const adminManagerUids = await getAdminAndManagerUids(tenantId);
    
    if (adminManagerUids.length > 0) {
      const startsAt = shiftData.startsAt.toDate();
      const dateStr = startsAt.toLocaleDateString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      });

      await createNotificationsForUsers(tenantId, adminManagerUids, {
        type: NOTIFICATION_TYPES.APPLICATION_NEW,
        title: 'Neue Freelancer-Bewerbung 📩',
        message: `${freelancerName} (Freelancer) hat sich für "${shiftData.title}" am ${dateStr} beworben.`,
        ref: { type: 'application', id: appRef.id },
        link: `/admin-shifts`,
      });
    }
  } catch (notificationError) {
    console.error('Failed to create application notification:', notificationError);
  }

  const savedDoc = await appRef.get();
  const application = applicationToResponse(appRef.id, savedDoc.data() as ApplicationDoc);
  return { ...application, tenantId };
}

/**
 * Bewirbt sich auf eine Schicht.
 */
export async function applyToShift(
  tenantId: string,
  shiftId: string,
  applicantUid: string,
  applicantEmail: string,
  note?: string
): Promise<Application> {
  const db = getAdminFirestore();

  // Schicht laden und prüfen
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);
  const shiftSnap = await shiftRef.get();

  if (!shiftSnap.exists) {
    throw new Error('Shift not found');
  }

  const shiftData = shiftSnap.data() as ShiftDoc;

  if (shiftData.status !== SHIFT_STATUS.PUBLISHED) {
    throw new Error('Shift is not available for applications');
  }

  // Deadline prüfen
  if (shiftData.applyDeadline) {
    const now = new Date();
    if (now > shiftData.applyDeadline.toDate()) {
      throw new Error('Application deadline has passed');
    }
  }

  // Prüfen ob bereits beworben (nicht WITHDRAWN)
  const existingApp = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .where('shiftId', '==', shiftId)
    .where('uid', '==', applicantUid)
    .get();

  const activeApp = existingApp.docs.find(
    (doc) => (doc.data() as ApplicationDoc).status !== APPLICATION_STATUS.WITHDRAWN
  );

  if (activeApp) {
    throw new Error('Sie haben sich bereits auf diese Schicht beworben');
  }

  // Bewerbung erstellen
  const appRef = db.collection('tenants').doc(tenantId).collection('applications').doc();

  const appData: Omit<ApplicationDoc, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
    updatedAt: ReturnType<typeof FieldValue.serverTimestamp>;
  } = {
    shiftId,
    uid: applicantUid,
    email: applicantEmail,
    status: APPLICATION_STATUS.PENDING,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (note && note.trim()) {
    (appData as Record<string, unknown>).note = note.trim();
  }

  await appRef.set(appData);

  await createAuditLog(tenantId, applicantUid, AUDIT_ACTIONS.APP_CREATE, 'application', appRef.id, {
    shiftId,
  });

  // Benachrichtigung an Admins und Manager
  try {
    const adminManagerUids = await getAdminAndManagerUids(tenantId);
    
    if (adminManagerUids.length > 0) {
      const startsAt = shiftData.startsAt.toDate();
      const dateStr = startsAt.toLocaleDateString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      });

      // Bewerber-Namen holen
      const memberDoc = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('members')
        .doc(applicantUid)
        .get();
      
      const memberData = memberDoc.data();
      const applicantName = memberData?.displayName || applicantEmail.split('@')[0];

      await createNotificationsForUsers(tenantId, adminManagerUids, {
        type: NOTIFICATION_TYPES.APPLICATION_NEW,
        title: 'Neue Bewerbung 📩',
        message: `${applicantName} hat sich für "${shiftData.title}" am ${dateStr} beworben.`,
        ref: { type: 'application', id: appRef.id },
        link: `/admin-shifts`,
      });
    }
  } catch (notificationError) {
    console.error('Failed to create application notification:', notificationError);
  }

  const savedDoc = await appRef.get();
  return applicationToResponse(appRef.id, savedDoc.data() as ApplicationDoc);
}

/**
 * Lädt Bewerbungen für eine Schicht (Admin).
 * Erweitert um vollständige Freelancer-Informationen für Security-Firmen.
 */
export async function getShiftApplications(
  tenantId: string,
  shiftId: string
): Promise<Array<Application & { 
  verificationStatus?: string;
  freelancerProfile?: {
    displayName: string;
    companyName?: string;
    phone?: string;
    address?: string;
    businessLicenseNumber?: string;
    verificationStatus?: string;
    verificationSubmittedAt?: string;
    verificationReviewedAt?: string;
  };
  memberName?: string;
}>> {
  const db = getAdminFirestore();

  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .where('shiftId', '==', shiftId)
    .get();

  const applications = snapshot.docs
    .map((doc) => applicationToResponse(doc.id, doc.data() as ApplicationDoc))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Vollständige Freelancer-Daten für alle Freelancer-Bewerbungen laden
  const freelancerUids = applications
    .filter((app) => app.isFreelancer)
    .map((app) => app.uid);

  // Member-Namen für alle Nicht-Freelancer-Bewerbungen laden
  const memberUids = applications
    .filter((app) => !app.isFreelancer)
    .map((app) => app.uid);

  const memberNameMap = new Map<string, string>();
  if (memberUids.length > 0) {
    const membersSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('members')
      .get();
    
    membersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const uid = doc.id; // Member-Dokument-ID ist die UID
      if (memberUids.includes(uid)) {
        memberNameMap.set(uid, data.displayName || data.email?.split('@')[0] || 'Unbekannt');
      }
    });
  }

  if (freelancerUids.length > 0) {
    const freelancerDocs = await Promise.all(
      freelancerUids.map((uid) => db.collection('freelancers').doc(uid).get())
    );

    const freelancerProfileMap = new Map<string, {
      displayName: string;
      companyName?: string;
      phone?: string;
      address?: string;
      businessLicenseNumber?: string;
      verificationStatus?: string;
      verificationSubmittedAt?: string;
      verificationReviewedAt?: string;
    }>();

    freelancerDocs.forEach((doc) => {
      if (doc.exists) {
        const data = doc.data() as FreelancerDoc;
        freelancerProfileMap.set(doc.id, {
          displayName: data.displayName,
          companyName: data.companyName,
          phone: data.phone,
          address: data.address,
          businessLicenseNumber: data.businessLicenseNumber,
          verificationStatus: data.verificationStatus,
          verificationSubmittedAt: data.verificationSubmittedAt?.toDate().toISOString(),
          verificationReviewedAt: data.verificationReviewedAt?.toDate().toISOString(),
        });
      }
    });

    return applications.map((app) => ({
      ...app,
      verificationStatus: app.isFreelancer ? freelancerProfileMap.get(app.uid)?.verificationStatus : undefined,
      freelancerProfile: app.isFreelancer ? freelancerProfileMap.get(app.uid) : undefined,
      memberName: !app.isFreelancer ? memberNameMap.get(app.uid) : undefined,
    }));
  }

  return applications.map((app) => ({
    ...app,
    memberName: !app.isFreelancer ? memberNameMap.get(app.uid) : undefined,
  }));
}

/**
 * Akzeptiert eine Bewerbung (mit Transaktion).
 */
export async function acceptApplication(
  tenantId: string,
  applicationId: string,
  actorUid: string
): Promise<{ application: Application; assignment: Assignment }> {
  const db = getAdminFirestore();

  // Bewerbung außerhalb der Transaktion laden, um appData später zu verwenden
  const appRef = db.collection('tenants').doc(tenantId).collection('applications').doc(applicationId);
  const appSnapBefore = await appRef.get();
  
  if (!appSnapBefore.exists) {
    throw new Error('Application not found');
  }

  const appData = appSnapBefore.data() as ApplicationDoc;

  // Prüfen ob bereits akzeptiert
  if (appData.status === APPLICATION_STATUS.ACCEPTED) {
    // Prüfen ob bereits ein Assignment existiert
    const existingAssignment = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('assignments')
      .where('shiftId', '==', appData.shiftId)
      .where('uid', '==', appData.uid)
      .limit(1)
      .get();

    if (!existingAssignment.empty) {
      // Bewerbung wurde bereits akzeptiert und Assignment existiert
      const assignmentDoc = existingAssignment.docs[0];
      const assignment = assignmentDoc.data() as AssignmentDoc;
      const application = applicationToResponse(applicationId, appData);
      
      return {
        application,
        assignment: {
          id: assignmentDoc.id,
          shiftId: assignment.shiftId,
          uid: assignment.uid,
          status: assignment.status as AssignmentStatus,
          createdAt: assignment.createdAt.toDate().toISOString(),
        },
      };
    }
  }

  if (appData.status !== APPLICATION_STATUS.PENDING) {
    throw new Error(`Bewerbung kann nicht akzeptiert werden. Status: ${appData.status === APPLICATION_STATUS.ACCEPTED ? 'bereits akzeptiert' : appData.status}`);
  }

  const result = await db.runTransaction(async (transaction) => {
    // Bewerbung erneut in Transaktion laden
    const appSnap = await transaction.get(appRef);

    if (!appSnap.exists) {
      throw new Error('Application not found');
    }

    const appDataInTransaction = appSnap.data() as ApplicationDoc;

    if (appDataInTransaction.status !== APPLICATION_STATUS.PENDING) {
      throw new Error(`Cannot accept application with status ${appDataInTransaction.status}`);
    }

    // Schicht laden
    const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(appDataInTransaction.shiftId);
    const shiftSnap = await transaction.get(shiftRef);

    if (!shiftSnap.exists) {
      throw new Error('Shift not found');
    }

    const shiftData = shiftSnap.data() as ShiftDoc;

    if (shiftData.status !== SHIFT_STATUS.PUBLISHED) {
      throw new Error('Shift is not published');
    }

    // Freie Plätze prüfen
    if (shiftData.filledCount >= shiftData.requiredCount) {
      throw new Error('No free slots available');
    }

    // Bewerbung akzeptieren
    transaction.update(appRef, {
      status: APPLICATION_STATUS.ACCEPTED,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Assignment erstellen
    const assignmentRef = db.collection('tenants').doc(tenantId).collection('assignments').doc();
    transaction.set(assignmentRef, {
      shiftId: appDataInTransaction.shiftId,
      uid: appDataInTransaction.uid,
      status: ASSIGNMENT_STATUS.CONFIRMED,
      createdAt: FieldValue.serverTimestamp(),
    });

    // filledCount erhöhen
    transaction.update(shiftRef, {
      filledCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      applicationId,
      assignmentId: assignmentRef.id,
      shiftId: appDataInTransaction.shiftId,
      uid: appDataInTransaction.uid,
    };
  });

  // Wenn Freelancer-Bewerbung: Freelancer als Member hinzufügen
  if (appData.isFreelancer) {
    try {
      const freelancer = await getFreelancer(result.uid);
      if (freelancer) {
        // Prüfen ob bereits Member
        const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(result.uid);
        const memberSnap = await memberRef.get();
        
        if (!memberSnap.exists) {
          // Freelancer als Member hinzufügen
          await memberRef.set({
            uid: result.uid,
            email: appData.email,
            displayName: freelancer.displayName,
            role: 'freelancer',
            status: MEMBER_STATUS.ACTIVE,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          // Tenant-ID zum Freelancer-Profil hinzufügen
          await addTenantToFreelancer(result.uid, tenantId);
        }
      }
    } catch (freelancerError) {
      console.error('Failed to add freelancer as member:', freelancerError);
      // Nicht kritisch - Assignment wurde bereits erstellt
    }
  }

  // Audit Logs
  await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.APP_ACCEPT, 'application', applicationId, {
    shiftId: result.shiftId,
    isFreelancer: appData.isFreelancer || false,
  });
  await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.ASSIGNMENT_CREATE, 'assignment', result.assignmentId, {
    shiftId: result.shiftId,
    uid: result.uid,
  });

  // Benachrichtigung für den Bewerber erstellen
  try {
    const shiftSnap = await db.collection('tenants').doc(tenantId).collection('shifts').doc(result.shiftId).get();
    const shiftData = shiftSnap.data() as ShiftDoc;
    const startsAt = shiftData.startsAt.toDate();
    const dateStr = startsAt.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

    // Wenn Freelancer: Benachrichtigung in seinem eigenen Tenant erstellen
    if (appData.isFreelancer) {
      const freelancer = await getFreelancer(result.uid);
      if (freelancer?.tenantId) {
        await createNotification(freelancer.tenantId, {
          type: NOTIFICATION_TYPES.APPLICATION_ACCEPTED,
          title: 'Bewerbung angenommen! 🎉',
          message: `Deine Bewerbung für "${shiftData.title}" am ${dateStr} wurde angenommen.`,
          recipientUid: result.uid,
          ref: { type: 'shift', id: result.shiftId },
          link: `/freelancer-my-shifts`,
        });
      }
    } else {
      // Normale Mitarbeiter: Benachrichtigung im Firmen-Tenant
      await createNotification(tenantId, {
        type: NOTIFICATION_TYPES.APPLICATION_ACCEPTED,
        title: 'Bewerbung angenommen! 🎉',
        message: `Deine Bewerbung für "${shiftData.title}" am ${dateStr} wurde angenommen.`,
        recipientUid: result.uid,
        ref: { type: 'shift', id: result.shiftId },
        link: `/shifts/${result.shiftId}`,
      });
    }
  } catch (notificationError) {
    console.error('Failed to create acceptance notification:', notificationError);
  }

  // Aktualisierte Daten zurücklesen
  const updatedApp = await db.collection('tenants').doc(tenantId).collection('applications').doc(applicationId).get();
  const assignment = await db.collection('tenants').doc(tenantId).collection('assignments').doc(result.assignmentId).get();

  return {
    application: applicationToResponse(applicationId, updatedApp.data() as ApplicationDoc),
    assignment: {
      id: result.assignmentId,
      shiftId: result.shiftId,
      uid: result.uid,
      status: ASSIGNMENT_STATUS.CONFIRMED,
      createdAt: (assignment.data() as AssignmentDoc).createdAt.toDate().toISOString(),
    },
  };
}

/**
 * Lehnt eine Bewerbung ab.
 */
export async function rejectApplication(
  tenantId: string,
  applicationId: string,
  actorUid: string
): Promise<Application> {
  const db = getAdminFirestore();

  const appRef = db.collection('tenants').doc(tenantId).collection('applications').doc(applicationId);
  const appSnap = await appRef.get();

  if (!appSnap.exists) {
    throw new Error('Application not found');
  }

  const appData = appSnap.data() as ApplicationDoc;

  if (appData.status !== APPLICATION_STATUS.PENDING) {
    throw new Error(`Cannot reject application with status ${appData.status}`);
  }

  await appRef.update({
    status: APPLICATION_STATUS.REJECTED,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.APP_REJECT, 'application', applicationId, {
    shiftId: appData.shiftId,
  });

  // Benachrichtigung für den Bewerber erstellen
  try {
    const shiftSnap = await db.collection('tenants').doc(tenantId).collection('shifts').doc(appData.shiftId).get();
    const shiftData = shiftSnap.data() as ShiftDoc;
    const startsAt = shiftData.startsAt.toDate();
    const dateStr = startsAt.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

    // Wenn Freelancer: Benachrichtigung in seinem eigenen Tenant erstellen
    if (appData.isFreelancer) {
      const freelancer = await getFreelancer(appData.uid);
      if (freelancer?.tenantId) {
        await createNotification(freelancer.tenantId, {
          type: NOTIFICATION_TYPES.APPLICATION_REJECTED,
          title: 'Bewerbung abgelehnt',
          message: `Deine Bewerbung für "${shiftData.title}" am ${dateStr} wurde leider abgelehnt.`,
          recipientUid: appData.uid,
          ref: { type: 'shift', id: appData.shiftId },
          link: '/freelancer-security-pool',
        });
      }
    } else {
      // Normale Mitarbeiter: Benachrichtigung im Firmen-Tenant
      await createNotification(tenantId, {
        type: NOTIFICATION_TYPES.APPLICATION_REJECTED,
        title: 'Bewerbung abgelehnt',
        message: `Deine Bewerbung für "${shiftData.title}" am ${dateStr} wurde leider abgelehnt.`,
        recipientUid: appData.uid,
        ref: { type: 'shift', id: appData.shiftId },
        link: '/shifts',
      });
    }
  } catch (notificationError) {
    console.error('Failed to create rejection notification:', notificationError);
  }

  const updatedDoc = await appRef.get();
  return applicationToResponse(applicationId, updatedDoc.data() as ApplicationDoc);
}

/**
 * Zieht eine Ablehnung zurück (setzt Status zurück auf PENDING).
 */
export async function unrejectApplication(
  tenantId: string,
  applicationId: string,
  actorUid: string
): Promise<Application> {
  const db = getAdminFirestore();

  const appRef = db.collection('tenants').doc(tenantId).collection('applications').doc(applicationId);
  const appSnap = await appRef.get();

  if (!appSnap.exists) {
    throw new Error('Application not found');
  }

  const appData = appSnap.data() as ApplicationDoc;

  if (appData.status !== APPLICATION_STATUS.REJECTED) {
    throw new Error(`Cannot unreject application with status ${appData.status}`);
  }

  await appRef.update({
    status: APPLICATION_STATUS.PENDING,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.APP_UNREJECT, 'application', applicationId, {
    shiftId: appData.shiftId,
  });

  // Benachrichtigung für den Bewerber erstellen
  try {
    const shiftSnap = await db.collection('tenants').doc(tenantId).collection('shifts').doc(appData.shiftId).get();
    const shiftData = shiftSnap.data() as ShiftDoc;
    const startsAt = shiftData.startsAt.toDate();
    const dateStr = startsAt.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

    // Wenn Freelancer: Benachrichtigung in seinem eigenen Tenant erstellen
    if (appData.isFreelancer) {
      const freelancer = await getFreelancer(appData.uid);
      if (freelancer?.tenantId) {
        await createNotification(freelancer.tenantId, {
          type: NOTIFICATION_TYPES.APPLICATION_ACCEPTED, // Verwende ACCEPTED als positive Nachricht
          title: 'Bewerbung erneut in Prüfung 🔄',
          message: `Deine Bewerbung für "${shiftData.title}" am ${dateStr} wurde erneut zur Prüfung freigegeben.`,
          recipientUid: appData.uid,
          ref: { type: 'shift', id: appData.shiftId },
          link: '/freelancer-security-pool',
        });
      }
    } else {
      // Normale Mitarbeiter: Benachrichtigung im Firmen-Tenant
      await createNotification(tenantId, {
        type: NOTIFICATION_TYPES.APPLICATION_ACCEPTED,
        title: 'Bewerbung erneut in Prüfung 🔄',
        message: `Deine Bewerbung für "${shiftData.title}" am ${dateStr} wurde erneut zur Prüfung freigegeben.`,
        recipientUid: appData.uid,
        ref: { type: 'shift', id: appData.shiftId },
        link: '/shifts',
      });
    }
  } catch (notificationError) {
    console.error('Failed to create unreject notification:', notificationError);
  }

  const updatedDoc = await appRef.get();
  return applicationToResponse(applicationId, updatedDoc.data() as ApplicationDoc);
}

/**
 * Zieht eine Bewerbung zurück.
 */
export async function withdrawApplication(
  tenantId: string,
  applicationId: string,
  applicantUid: string
): Promise<Application> {
  const db = getAdminFirestore();

  const appRef = db.collection('tenants').doc(tenantId).collection('applications').doc(applicationId);
  const appSnap = await appRef.get();

  if (!appSnap.exists) {
    throw new Error('Application not found');
  }

  const appData = appSnap.data() as ApplicationDoc;

  // Nur eigene Bewerbung zurückziehen
  if (appData.uid !== applicantUid) {
    throw new Error('Cannot withdraw application of another user');
  }

  if (appData.status !== APPLICATION_STATUS.PENDING) {
    throw new Error(`Cannot withdraw application with status ${appData.status}`);
  }

  await appRef.update({
    status: APPLICATION_STATUS.WITHDRAWN,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(tenantId, applicantUid, AUDIT_ACTIONS.APP_WITHDRAW, 'application', applicationId, {
    shiftId: appData.shiftId,
  });

  // Benachrichtigung an Admins und Manager
  try {
    const adminManagerUids = await getAdminAndManagerUids(tenantId);
    
    if (adminManagerUids.length > 0) {
      // Schicht laden für Details
      const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(appData.shiftId);
      const shiftSnap = await shiftRef.get();
      
      if (shiftSnap.exists) {
        const shiftData = shiftSnap.data() as ShiftDoc;
        const startsAt = shiftData.startsAt.toDate();
        const dateStr = startsAt.toLocaleDateString('de-DE', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        });

        // Bewerber-Namen holen
        const memberDoc = await db
          .collection('tenants')
          .doc(tenantId)
          .collection('members')
          .doc(applicantUid)
          .get();
        
        const memberData = memberDoc.data();
        const applicantName = memberData?.displayName || appData.email.split('@')[0];

        await createNotificationsForUsers(tenantId, adminManagerUids, {
          type: NOTIFICATION_TYPES.APPLICATION_WITHDRAWN,
          title: 'Bewerbung zurückgezogen ↩️',
          message: `${applicantName} hat die Bewerbung für "${shiftData.title}" am ${dateStr} zurückgezogen.`,
          ref: { type: 'shift', id: appData.shiftId },
          link: `/admin-shifts`,
        });
      }
    }
  } catch (notificationError) {
    console.error('Failed to create withdraw notification:', notificationError);
  }

  const updatedDoc = await appRef.get();
  return applicationToResponse(applicationId, updatedDoc.data() as ApplicationDoc);
}

/**
 * Storniert eine akzeptierte Bewerbung (macht Annahme rückgängig).
 * Setzt Bewerbung zurück auf PENDING und verringert filledCount.
 */
export async function revokeAcceptedApplication(
  tenantId: string,
  applicationId: string,
  actorUid: string
): Promise<Application> {
  const db = getAdminFirestore();

  const result = await db.runTransaction(async (transaction) => {
    // Bewerbung laden
    const appRef = db.collection('tenants').doc(tenantId).collection('applications').doc(applicationId);
    const appSnap = await transaction.get(appRef);

    if (!appSnap.exists) {
      throw new Error('Application not found');
    }

    const appData = appSnap.data() as ApplicationDoc;

    if (appData.status !== APPLICATION_STATUS.ACCEPTED) {
      throw new Error(`Cannot revoke application with status ${appData.status}. Only ACCEPTED applications can be revoked.`);
    }

    // Schicht laden
    const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(appData.shiftId);
    const shiftSnap = await transaction.get(shiftRef);

    if (!shiftSnap.exists) {
      throw new Error('Shift not found');
    }

    const shiftData = shiftSnap.data() as ShiftDoc;

    // Assignment finden und auf CANCELLED setzen
    const assignmentsSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('assignments')
      .where('shiftId', '==', appData.shiftId)
      .where('uid', '==', appData.uid)
      .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
      .limit(1)
      .get();

    // Bewerbung zurück auf PENDING setzen
    transaction.update(appRef, {
      status: APPLICATION_STATUS.PENDING,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Assignment auf CANCELLED setzen wenn vorhanden
    if (!assignmentsSnapshot.empty) {
      const assignmentRef = assignmentsSnapshot.docs[0].ref;
      transaction.update(assignmentRef, {
        status: ASSIGNMENT_STATUS.CANCELLED,
        cancelledAt: FieldValue.serverTimestamp(),
      });
    }

    // filledCount verringern (nur wenn > 0)
    if (shiftData.filledCount > 0) {
      transaction.update(shiftRef, {
        filledCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      applicationId,
      shiftId: appData.shiftId,
      uid: appData.uid,
      assignmentId: assignmentsSnapshot.empty ? null : assignmentsSnapshot.docs[0].id,
    };
  });

  // Audit Logs
  await createAuditLog(tenantId, actorUid, 'APP_REVOKE', 'application', applicationId, {
    shiftId: result.shiftId,
    uid: result.uid,
  });
  
  if (result.assignmentId) {
    await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.ASSIGNMENT_CANCEL, 'assignment', result.assignmentId, {
      shiftId: result.shiftId,
      uid: result.uid,
    });
  }

  // Aktualisierte Bewerbung zurücklesen
  const updatedApp = await db.collection('tenants').doc(tenantId).collection('applications').doc(applicationId).get();
  return applicationToResponse(applicationId, updatedApp.data() as ApplicationDoc);
}

/**
 * Zieht eigene Bewerbung für eine Schicht zurück (über shiftId).
 * Einfachere Variante für User, die ihre applicationId nicht kennen.
 */
export async function withdrawMyApplication(
  tenantId: string,
  shiftId: string,
  applicantUid: string
): Promise<Application> {
  const db = getAdminFirestore();

  // Bewerbung des Users für diese Schicht finden
  const appSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .where('shiftId', '==', shiftId)
    .where('uid', '==', applicantUid)
    .where('status', '==', APPLICATION_STATUS.PENDING)
    .limit(1)
    .get();

  if (appSnapshot.empty) {
    throw new Error('No pending application found for this shift');
  }

  const appDoc = appSnapshot.docs[0];
  const applicationId = appDoc.id;

  // Bestehende withdrawApplication-Funktion nutzen
  return withdrawApplication(tenantId, applicationId, applicantUid);
}

// =============================================================================
// Meine Schichten (User View)
// =============================================================================

/**
 * Schicht mit Zuweisung für "Meine Schichten" Ansicht.
 */
export interface MyShift extends Shift {
  /** Status der Zuweisung */
  assignmentStatus: string;
  /** ID der Zuweisung */
  assignmentId: string;
  /** Kollegen, die auch zugewiesen sind */
  colleagues: Array<{ uid: string; displayName: string }>;
}

/**
 * Lädt alle Schichten, bei denen der User eine bestätigte Zuweisung hat.
 */
export async function getMyShifts(
  tenantId: string,
  uid: string,
  options: { includeCompleted?: boolean } = {}
): Promise<MyShift[]> {
  const db = getAdminFirestore();
  const { includeCompleted = false } = options;

  // 1. Alle Zuweisungen des Users laden
  const assignmentsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('assignments')
    .where('uid', '==', uid)
    .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
    .get();

  if (assignmentsSnapshot.empty) {
    return [];
  }

  // 2. Schicht-IDs sammeln
  const shiftAssignments = new Map<string, { assignmentId: string; status: string }>();
  assignmentsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    shiftAssignments.set(data.shiftId, {
      assignmentId: doc.id,
      status: data.status,
    });
  });

  // 3. Alle Schichten auf einmal laden
  const shiftsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shifts')
    .get();

  // 4. Relevante Schichten filtern und anreichern
  const now = new Date();
  const myShifts: MyShift[] = [];

  for (const doc of shiftsSnapshot.docs) {
    const assignment = shiftAssignments.get(doc.id);
    if (!assignment) continue;

    const shiftData = doc.data() as ShiftDoc;
    const shift = shiftToResponse(doc.id, shiftData);
    const endsAt = new Date(shift.endsAt);

    // Vergangene Schichten nur wenn includeCompleted
    if (!includeCompleted && endsAt < now) {
      continue;
    }

    // Abgesagte Schichten nicht anzeigen
    if (shift.status === SHIFT_STATUS.CANCELLED) {
      continue;
    }

    // Kollegen laden (andere Zuweisungen für diese Schicht)
    const colleagueAssignments = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('assignments')
      .where('shiftId', '==', doc.id)
      .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
      .get();

    const colleagueUids = colleagueAssignments.docs
      .map((d) => d.data().uid as string)
      .filter((u) => u !== uid);

    // Member- und Freelancer-Namen laden
    let colleagues: Array<{ uid: string; displayName: string }> = [];
    if (colleagueUids.length > 0) {
      const membersSnapshot = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('members')
        .get();

      const membersMap = new Map<string, { displayName: string; role?: string }>();
      membersSnapshot.docs.forEach((m) => {
        const data = m.data();
        membersMap.set(m.id, {
          displayName: data.displayName || data.email?.split('@')[0] || 'Unbekannt',
          role: data.role,
        });
      });

      // Freelancer-Daten für alle UIDs laden (auch wenn sie als Member existieren, um Firmenname zu bekommen)
      const freelancerDocs = await Promise.all(
        colleagueUids.map((uid) => db.collection('freelancers').doc(uid).get())
      );
      
      const freelancersMap = new Map<string, { displayName: string; companyName?: string }>();
      freelancerDocs.forEach((doc) => {
        if (doc.exists) {
          const data = doc.data() as FreelancerDoc;
          freelancersMap.set(doc.id, {
            displayName: data.displayName,
            companyName: data.companyName,
          });
        }
      });

      colleagues = colleagueUids.map((u) => {
        const member = membersMap.get(u);
        const freelancer = freelancersMap.get(u);
        const isFreelancer = member?.role === 'freelancer' || !!freelancer;
        
        // Priorität: Freelancer-Firmenname > Member-Name > Freelancer-Name > Fallback
        let displayName: string;
        if (isFreelancer && freelancer?.companyName) {
          displayName = freelancer.companyName;
        } else {
          displayName = member?.displayName || freelancer?.displayName || 'Unbekannt';
        }
        
        return {
          uid: u,
          displayName,
        };
      });
    }

    myShifts.push({
      ...shift,
      assignmentId: assignment.assignmentId,
      assignmentStatus: assignment.status,
      colleagues,
    });
  }

  // Nach Startzeit sortieren (nächste zuerst)
  myShifts.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return myShifts;
}

/**
 * Lädt alle Schichten eines Freelancers über alle Tenants hinweg.
 * Nur Schichten, bei denen der Freelancer eine bestätigte Zuweisung hat.
 */
export async function getFreelancerShifts(
  freelancerUid: string,
  options: { includeCompleted?: boolean } = {}
): Promise<Array<MyShift & { tenantId: string; tenantName: string }>> {
  const db = getAdminFirestore();
  const { includeCompleted = false } = options;
  
  // Alle Tenants durchgehen
  const tenantsSnapshot = await db.collection('tenants').get();
  const allShifts: Array<MyShift & { tenantId: string; tenantName: string }> = [];
  
  for (const tenantDoc of tenantsSnapshot.docs) {
    const tenantId = tenantDoc.id;
    const tenantData = tenantDoc.data();
    const tenantName = tenantData?.name || 'Unbekannte Firma';
    
    // Assignments des Freelancers in diesem Tenant laden
    const assignmentsSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('assignments')
      .where('uid', '==', freelancerUid)
      .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
      .get();
    
    if (assignmentsSnapshot.empty) {
      continue;
    }
    
    // Schicht-IDs sammeln
    const shiftAssignments = new Map<string, { assignmentId: string; status: string }>();
    assignmentsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      shiftAssignments.set(data.shiftId, {
        assignmentId: doc.id,
        status: data.status,
      });
    });
    
    // Alle Schichten dieses Tenants laden
    const shiftsSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('shifts')
      .get();
    
    // Relevante Schichten filtern und anreichern
    const now = new Date();
    
    for (const doc of shiftsSnapshot.docs) {
      const assignment = shiftAssignments.get(doc.id);
      if (!assignment) continue;
      
      const shiftData = doc.data() as ShiftDoc;
      const shift = shiftToResponse(doc.id, shiftData);
      const endsAt = new Date(shift.endsAt);
      
      // Vergangene Schichten nur wenn includeCompleted
      if (!includeCompleted && endsAt < now) {
        continue;
      }
      
      // Abgesagte Schichten nicht anzeigen
      if (shift.status === SHIFT_STATUS.CANCELLED) {
        continue;
      }
      
      // Kollegen laden (andere Zuweisungen für diese Schicht)
      const colleagueAssignments = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('assignments')
        .where('shiftId', '==', doc.id)
        .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
        .get();
      
      const colleagueUids = colleagueAssignments.docs
        .map((d) => d.data().uid as string)
        .filter((u) => u !== freelancerUid);
      
      // Member-Namen laden (auch Freelancer können Kollegen sein)
      let colleagues: Array<{ uid: string; displayName: string }> = [];
      if (colleagueUids.length > 0) {
        const membersSnapshot = await db
          .collection('tenants')
          .doc(tenantId)
          .collection('members')
          .get();
        
        const membersMap = new Map<string, string>();
        membersSnapshot.docs.forEach((m) => {
          const data = m.data();
          membersMap.set(m.id, data.displayName || data.email?.split('@')[0] || 'Unbekannt');
        });
        
        // Auch Freelancer-Daten prüfen
        for (const uid of colleagueUids) {
          if (!membersMap.has(uid)) {
            const freelancerDoc = await db.collection('freelancers').doc(uid).get();
            if (freelancerDoc.exists) {
              const freelancerData = freelancerDoc.data();
              membersMap.set(uid, freelancerData?.displayName || 'Freelancer');
            }
          }
        }
        
        colleagues = colleagueUids.map((u) => ({
          uid: u,
          displayName: membersMap.get(u) || 'Unbekannt',
        }));
      }
      
      allShifts.push({
        ...shift,
        assignmentId: assignment.assignmentId,
        assignmentStatus: assignment.status,
        colleagues,
        tenantId,
        tenantName,
      });
    }
  }
  
  // Nach Startzeit sortieren (nächste zuerst)
  allShifts.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  
  return allShifts;
}

// =============================================================================
// Admin: Direkte Mitarbeiter-Zuweisung
// =============================================================================

/**
 * Zuweisung mit Mitarbeiter-Details.
 */
export interface ShiftAssignmentWithMember {
  assignmentId: string;
  uid: string;
  displayName: string;
  email?: string;
  status: string;
  createdAt: string;
  isFreelancer?: boolean;
  companyName?: string;
}

/**
 * Lädt alle Zuweisungen für eine Schicht (Admin).
 * Lädt auch Freelancer-Daten, wenn es Freelancer-Zuweisungen sind.
 */
export async function getShiftAssignments(
  tenantId: string,
  shiftId: string
): Promise<ShiftAssignmentWithMember[]> {
  const db = getAdminFirestore();

  // Zuweisungen laden (nur CONFIRMED, nicht CANCELLED)
  const assignmentsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('assignments')
    .where('shiftId', '==', shiftId)
    .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
    .get();

  if (assignmentsSnapshot.empty) {
    return [];
  }

  // UIDs sammeln
  const uids = assignmentsSnapshot.docs.map((doc) => doc.data().uid as string);

  // Member-Daten laden
  const membersSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .get();

  const membersMap = new Map<string, { displayName?: string; email?: string; role?: string }>();
  membersSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    membersMap.set(doc.id, {
      displayName: data.displayName,
      email: data.email,
      role: data.role,
    });
  });

  // Freelancer-Daten für ALLE UIDs laden (auch wenn sie als Member existieren, um Firmenname zu bekommen)
  const freelancersMap = new Map<string, { displayName?: string; email?: string; companyName?: string }>();
  const freelancerDocs = await Promise.all(
    uids.map((uid) => db.collection('freelancers').doc(uid).get())
  );
  
  freelancerDocs.forEach((doc) => {
    if (doc.exists) {
      const data = doc.data() as FreelancerDoc;
      freelancersMap.set(doc.id, {
        displayName: data.displayName,
        email: data.email,
        companyName: data.companyName,
      });
    }
  });

  // Zuweisungen mit Member- oder Freelancer-Details anreichern
  return assignmentsSnapshot.docs.map((doc) => {
    const data = doc.data();
    const member = membersMap.get(data.uid);
    const freelancer = freelancersMap.get(data.uid);
    const isFreelancer = member?.role === 'freelancer' || !!freelancer;
    
    // Priorität: Freelancer-Firmenname > Member-Name > Freelancer-Name > Email
    let displayName: string;
    if (isFreelancer && freelancer?.companyName) {
      displayName = freelancer.companyName;
    } else {
      displayName = member?.displayName || freelancer?.displayName || member?.email?.split('@')[0] || freelancer?.email?.split('@')[0] || 'Unbekannt';
    }
    
    const email = member?.email || freelancer?.email;
    
    return {
      assignmentId: doc.id,
      uid: data.uid,
      displayName,
      email,
      status: data.status,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      isFreelancer,
      companyName: freelancer?.companyName,
    };
  });
}

/**
 * Weist einen Mitarbeiter direkt einer Schicht zu (ohne Bewerbung).
 */
export async function assignMemberToShift(
  tenantId: string,
  shiftId: string,
  memberUid: string,
  actorUid: string
): Promise<Assignment> {
  const db = getAdminFirestore();

  const result = await db.runTransaction(async (transaction) => {
    // Schicht laden
    const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);
    const shiftSnap = await transaction.get(shiftRef);

    if (!shiftSnap.exists) {
      throw new Error('Shift not found');
    }

    const shiftData = shiftSnap.data() as ShiftDoc;

    // Schicht muss DRAFT oder PUBLISHED sein
    if (shiftData.status !== SHIFT_STATUS.DRAFT && shiftData.status !== SHIFT_STATUS.PUBLISHED) {
      throw new Error(`Cannot assign to shift with status ${shiftData.status}`);
    }

    // Freie Plätze prüfen
    if (shiftData.filledCount >= shiftData.requiredCount) {
      throw new Error('No free slots available');
    }

    // Prüfen ob Mitarbeiter bereits zugewiesen
    const existingAssignment = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('assignments')
      .where('shiftId', '==', shiftId)
      .where('uid', '==', memberUid)
      .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
      .limit(1)
      .get();

    if (!existingAssignment.empty) {
      throw new Error('Member is already assigned to this shift');
    }

    // Prüfen ob Mitarbeiter existiert
    const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(memberUid);
    const memberSnap = await transaction.get(memberRef);

    if (!memberSnap.exists) {
      throw new Error('Member not found');
    }

    // Assignment erstellen
    const assignmentRef = db.collection('tenants').doc(tenantId).collection('assignments').doc();
    transaction.set(assignmentRef, {
      shiftId,
      uid: memberUid,
      status: ASSIGNMENT_STATUS.CONFIRMED,
      createdAt: FieldValue.serverTimestamp(),
    });

    // filledCount erhöhen
    transaction.update(shiftRef, {
      filledCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      assignmentId: assignmentRef.id,
      memberUid,
      shiftTitle: shiftData.title,
      startsAt: shiftData.startsAt,
    };
  });

  // Audit Log
  await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.ASSIGNMENT_CREATE, 'assignment', result.assignmentId, {
    shiftId,
    memberUid,
    directAssignment: true,
  });

  // Benachrichtigung an den zugewiesenen Mitarbeiter
  try {
    const startsAt = result.startsAt.toDate();
    const dateStr = startsAt.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

    await createNotification(tenantId, {
      type: NOTIFICATION_TYPES.APPLICATION_ACCEPTED,
      title: 'Du wurdest eingeteilt! ✅',
      message: `Du wurdest für "${result.shiftTitle}" am ${dateStr} eingeteilt.`,
      recipientUid: memberUid,
      ref: { type: 'shift', id: shiftId },
      link: '/my-shifts',
    });
  } catch (notificationError) {
    console.error('Failed to create assignment notification:', notificationError);
  }

  return {
    id: result.assignmentId,
    shiftId,
    uid: memberUid,
    status: ASSIGNMENT_STATUS.CONFIRMED,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Entfernt eine Zuweisung (Admin).
 */
export async function removeAssignment(
  tenantId: string,
  assignmentId: string,
  actorUid: string
): Promise<void> {
  const db = getAdminFirestore();

  // Zuerst Assignment außerhalb der Transaktion laden, um shiftId und uid zu bekommen
  const assignmentRef = db.collection('tenants').doc(tenantId).collection('assignments').doc(assignmentId);
  const assignmentSnap = await assignmentRef.get();

  if (!assignmentSnap.exists) {
    throw new Error('Assignment not found');
  }

  const assignmentData = assignmentSnap.data();
  
  if (!assignmentData) {
    throw new Error('Assignment data not found');
  }

  if (assignmentData.status !== ASSIGNMENT_STATUS.CONFIRMED) {
    throw new Error('Assignment is not active');
  }

  // Zugehörige Bewerbung finden (außerhalb der Transaktion)
  const applicationsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .where('shiftId', '==', assignmentData.shiftId)
    .where('uid', '==', assignmentData.uid)
    .where('status', '==', APPLICATION_STATUS.ACCEPTED)
    .limit(1)
    .get();

  const applicationId = applicationsSnapshot.empty ? null : applicationsSnapshot.docs[0].id;

  await db.runTransaction(async (transaction) => {
    // Assignment erneut in Transaktion laden (für Konsistenz)
    const assignmentSnapInTransaction = await transaction.get(assignmentRef);

    if (!assignmentSnapInTransaction.exists) {
      throw new Error('Assignment not found');
    }

    const assignmentDataInTransaction = assignmentSnapInTransaction.data();
    
    if (!assignmentDataInTransaction) {
      throw new Error('Assignment data not found in transaction');
    }

    if (assignmentDataInTransaction.status !== ASSIGNMENT_STATUS.CONFIRMED) {
      throw new Error('Assignment is not active');
    }

    // Schicht laden
    const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(assignmentData!.shiftId);
    const shiftSnap = await transaction.get(shiftRef);

    if (!shiftSnap.exists) {
      throw new Error('Shift not found');
    }

    const shiftData = shiftSnap.data() as ShiftDoc;

    // Zugehörige Bewerbung auf PENDING zurücksetzen (wenn gefunden)
    if (applicationId) {
      const applicationRef = db.collection('tenants').doc(tenantId).collection('applications').doc(applicationId);
      const applicationSnap = await transaction.get(applicationRef);

      if (applicationSnap.exists) {
        const appData = applicationSnap.data() as ApplicationDoc;
        // Nur zurücksetzen, wenn Status noch ACCEPTED ist (könnte sich zwischenzeitlich geändert haben)
        if (appData.status === APPLICATION_STATUS.ACCEPTED) {
          transaction.update(applicationRef, {
            status: APPLICATION_STATUS.PENDING,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    // Assignment auf CANCELLED setzen
    transaction.update(assignmentRef, {
      status: ASSIGNMENT_STATUS.CANCELLED,
      cancelledAt: FieldValue.serverTimestamp(),
    });

    // filledCount verringern
    transaction.update(shiftRef, {
      filledCount: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Daten für Benachrichtigung merken
    return {
      memberUid: assignmentData!.uid,
      shiftTitle: shiftData.title,
      startsAt: shiftData.startsAt,
      shiftId: assignmentData!.shiftId,
    };
  }).then(async (result) => {
    // Audit Log
    await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.ASSIGNMENT_CANCEL, 'assignment', assignmentId);

    // Benachrichtigung an den entfernten Mitarbeiter
    if (result) {
      try {
        const startsAt = result.startsAt.toDate();
        const dateStr = startsAt.toLocaleDateString('de-DE', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        });

        await createNotification(tenantId, {
          type: NOTIFICATION_TYPES.ASSIGNMENT_CANCELLED,
          title: 'Zuweisung aufgehoben ❌',
          message: `Deine Zuweisung zu "${result.shiftTitle}" am ${dateStr} wurde aufgehoben.`,
          recipientUid: result.memberUid,
          ref: { type: 'shift', id: result.shiftId },
          link: '/shifts',
        });
      } catch (notificationError) {
        console.error('Failed to create cancellation notification:', notificationError);
      }
    }
  });
}

// =============================================================================
// Helper Functions für Berechtigungen
// =============================================================================

/**
 * Prüft, ob ein User ein zugewiesener Mitarbeiter einer Schicht ist.
 */
async function isAssignedToShift(
  tenantId: string,
  shiftId: string,
  uid: string
): Promise<boolean> {
  const db = getAdminFirestore();
  const assignmentsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('assignments')
    .where('shiftId', '==', shiftId)
    .where('uid', '==', uid)
    .where('status', '==', ASSIGNMENT_STATUS.CONFIRMED)
    .limit(1)
    .get();

  return !assignmentsSnapshot.empty;
}

/**
 * Prüft, ob ein User Admin oder Manager ist.
 */
async function isAdminOrManager(
  tenantId: string,
  uid: string
): Promise<boolean> {
  const db = getAdminFirestore();
  const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(uid);
  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    return false;
  }

  const role = memberSnap.data()?.role;
  return role === 'admin' || role === 'manager';
}

/**
 * Prüft, ob ein User Crew-Leiter einer Schicht ist.
 */
async function isCrewLeader(
  tenantId: string,
  shiftId: string,
  uid: string
): Promise<boolean> {
  const db = getAdminFirestore();
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);
  const shiftSnap = await shiftRef.get();

  if (!shiftSnap.exists) {
    return false;
  }

  const shiftData = shiftSnap.data() as ShiftDoc;
  return shiftData.crewLeaderUid === uid;
}

// =============================================================================
// Shift Completion
// =============================================================================

/**
 * Beendet eine Schicht (nur Crew-Leiter).
 */
export async function completeShift(
  tenantId: string,
  shiftId: string,
  actorUid: string
): Promise<Shift> {
  const db = getAdminFirestore();
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);

  const shiftSnap = await shiftRef.get();
  if (!shiftSnap.exists) {
    throw new Error('Shift not found');
  }

  const shiftData = shiftSnap.data() as ShiftDoc;

  // Prüfen ob Schicht bereits beendet ist
  if (shiftData.status === SHIFT_STATUS.COMPLETED) {
    throw new Error('Shift is already completed');
  }

  // Prüfen ob Schicht abgesagt ist
  if (shiftData.status === SHIFT_STATUS.CANCELLED) {
    throw new Error('Cannot complete a cancelled shift');
  }

  // Prüfen ob Schicht bereits gestartet hat
  const startsAt = shiftData.startsAt.toDate();
  const now = new Date();
  if (startsAt > now) {
    throw new Error('Cannot complete shift before it has started');
  }

  // Prüfen ob User Crew-Leiter, Manager oder Admin ist
  const isLeader = await isCrewLeader(tenantId, shiftId, actorUid);
  const hasAdminOrManagerRole = await isAdminOrManager(tenantId, actorUid);
  
  if (!isLeader && !hasAdminOrManagerRole) {
    throw new Error('Only the crew leader, manager or admin can complete a shift');
  }

  await shiftRef.update({
    status: SHIFT_STATUS.COMPLETED,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.SHIFT_COMPLETE, 'shift', shiftId);

  // Automatisch Zeiteinträge für alle zugewiesenen Mitarbeiter erstellen
  try {
    const assigneesUids = await getAssignedUserIds(tenantId, shiftId);
    const endsAt = shiftData.endsAt.toDate();
    
    for (const uid of assigneesUids) {
      // Prüfen ob bereits ein Eintrag existiert
      const existingSnapshot = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('shiftTimeEntries')
        .where('shiftId', '==', shiftId)
        .where('uid', '==', uid)
        .limit(1)
        .get();

      // Nur erstellen wenn noch kein Eintrag existiert
      if (existingSnapshot.empty) {
        const durationMs = endsAt.getTime() - startsAt.getTime();
        const durationMinutes = Math.round(durationMs / (1000 * 60));

        const entryRef = db
          .collection('tenants')
          .doc(tenantId)
          .collection('shiftTimeEntries')
          .doc();

        await entryRef.set({
          shiftId,
          uid,
          actualClockIn: Timestamp.fromDate(startsAt),
          actualClockOut: Timestamp.fromDate(endsAt),
          durationMinutes,
          enteredByUid: actorUid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  } catch (timeEntryError) {
    // Fehler bei Zeiteinträgen sollten nicht die Schicht-Beendigung blockieren
    console.error('Failed to create automatic time entries:', timeEntryError);
  }

  // Benachrichtigung an zugewiesene Mitarbeiter
  try {
    const assigneesUids = await getAssignedUserIds(tenantId, shiftId);
    if (assigneesUids.length > 0) {
      const dateStr = startsAt.toLocaleDateString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      });

      await createNotificationsForUsers(tenantId, assigneesUids, {
        type: NOTIFICATION_TYPES.SHIFT_CLOSED,
        title: 'Schicht beendet ✓',
        message: `"${shiftData.title}" am ${dateStr} wurde beendet.`,
        ref: { type: 'shift', id: shiftId },
        link: '/my-shifts',
      });
    }
  } catch (notificationError) {
    console.error('Failed to create completion notifications:', notificationError);
  }

  const updatedDoc = await shiftRef.get();
  return shiftToResponse(shiftId, updatedDoc.data() as ShiftDoc);
}

// =============================================================================
// Shift Time Entries
// =============================================================================

/**
 * Konvertiert ShiftTimeEntryDoc zu API Response.
 */
function shiftTimeEntryToResponse(id: string, doc: ShiftTimeEntryDoc): ShiftTimeEntry {
  return {
    id,
    shiftId: doc.shiftId,
    uid: doc.uid,
    actualClockIn: doc.actualClockIn.toDate().toISOString(),
    actualClockOut: doc.actualClockOut.toDate().toISOString(),
    durationMinutes: doc.durationMinutes,
    enteredByUid: doc.enteredByUid,
    note: doc.note,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}

/**
 * Lädt alle Zeiteinträge einer Schicht.
 */
export async function getShiftTimeEntries(
  tenantId: string,
  shiftId: string
): Promise<ShiftTimeEntry[]> {
  const db = getAdminFirestore();

  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shiftTimeEntries')
    .where('shiftId', '==', shiftId)
    .get();

  return snapshot.docs.map((doc) =>
    shiftTimeEntryToResponse(doc.id, doc.data() as ShiftTimeEntryDoc)
  );
}

/**
 * Erstellt oder aktualisiert einen Zeiteintrag für einen Mitarbeiter.
 */
export async function createShiftTimeEntry(
  tenantId: string,
  shiftId: string,
  actorUid: string,
  data: CreateShiftTimeEntryRequest
): Promise<ShiftTimeEntry> {
  const db = getAdminFirestore();

  // Schicht laden und prüfen
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);
  const shiftSnap = await shiftRef.get();

  if (!shiftSnap.exists) {
    throw new Error('Shift not found');
  }

  const shiftData = shiftSnap.data() as ShiftDoc;

  // Prüfen ob Mitarbeiter zugewiesen ist
  const isAssigned = await isAssignedToShift(tenantId, shiftId, data.uid);
  if (!isAssigned) {
    throw new Error('User is not assigned to this shift');
  }

  // Berechtigung prüfen: Crew-Leiter, Manager oder Admin
  const isLeader = await isCrewLeader(tenantId, shiftId, actorUid);
  const isAdminManager = await isAdminOrManager(tenantId, actorUid);

  if (!isLeader && !isAdminManager) {
    throw new Error('Only crew leader, manager or admin can create time entries');
  }

  // Validierung
  const clockIn = new Date(data.actualClockIn);
  const clockOut = new Date(data.actualClockOut);

  if (isNaN(clockIn.getTime()) || isNaN(clockOut.getTime())) {
    throw new Error('Invalid date format');
  }

  if (clockIn >= clockOut) {
    throw new Error('Clock-in time must be before clock-out time');
  }

  // Maximale Dauer: 24 Stunden
  const durationMs = clockOut.getTime() - clockIn.getTime();
  if (durationMs > 24 * 60 * 60 * 1000) {
    throw new Error('Maximum duration is 24 hours');
  }

  const durationMinutes = Math.round(durationMs / (1000 * 60));

  // Prüfen ob bereits ein Eintrag existiert
  const existingSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shiftTimeEntries')
    .where('shiftId', '==', shiftId)
    .where('uid', '==', data.uid)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    // Aktualisieren
    const entryRef = existingSnapshot.docs[0].ref;
    await entryRef.update({
      actualClockIn: Timestamp.fromDate(clockIn),
      actualClockOut: Timestamp.fromDate(clockOut),
      durationMinutes,
      enteredByUid: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
      ...(data.note ? { note: data.note.trim() } : {}),
    });

    const updatedDoc = await entryRef.get();
    return shiftTimeEntryToResponse(entryRef.id, updatedDoc.data() as ShiftTimeEntryDoc);
  }

  // Erstellen
  const entryRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('shiftTimeEntries')
    .doc();

  const entryData: Record<string, unknown> = {
    shiftId,
    uid: data.uid,
    actualClockIn: Timestamp.fromDate(clockIn),
    actualClockOut: Timestamp.fromDate(clockOut),
    durationMinutes,
    enteredByUid: actorUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (data.note?.trim()) {
    entryData.note = data.note.trim();
  }

  await entryRef.set(entryData);

  const savedDoc = await entryRef.get();
  return shiftTimeEntryToResponse(entryRef.id, savedDoc.data() as ShiftTimeEntryDoc);
}

/**
 * Aktualisiert einen Zeiteintrag.
 */
export async function updateShiftTimeEntry(
  tenantId: string,
  shiftId: string,
  entryId: string,
  actorUid: string,
  data: UpdateShiftTimeEntryRequest
): Promise<ShiftTimeEntry> {
  const db = getAdminFirestore();

  // Eintrag laden
  const entryRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('shiftTimeEntries')
    .doc(entryId);

  const entrySnap = await entryRef.get();
  if (!entrySnap.exists) {
    throw new Error('Time entry not found');
  }

  const entryData = entrySnap.data() as ShiftTimeEntryDoc;

  // Prüfen ob Eintrag zur Schicht gehört
  if (entryData.shiftId !== shiftId) {
    throw new Error('Time entry does not belong to this shift');
  }

  // Berechtigung prüfen: Crew-Leiter, Manager oder Admin
  const isLeader = await isCrewLeader(tenantId, shiftId, actorUid);
  const isAdminManager = await isAdminOrManager(tenantId, actorUid);

  if (!isLeader && !isAdminManager) {
    throw new Error('Only crew leader, manager or admin can update time entries');
  }

  // Update-Daten zusammenstellen
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  let clockIn = entryData.actualClockIn.toDate();
  let clockOut = entryData.actualClockOut.toDate();

  if (data.actualClockIn !== undefined) {
    clockIn = new Date(data.actualClockIn);
    if (isNaN(clockIn.getTime())) {
      throw new Error('Invalid clock-in date format');
    }
    updateData.actualClockIn = Timestamp.fromDate(clockIn);
  }

  if (data.actualClockOut !== undefined) {
    clockOut = new Date(data.actualClockOut);
    if (isNaN(clockOut.getTime())) {
      throw new Error('Invalid clock-out date format');
    }
    updateData.actualClockOut = Timestamp.fromDate(clockOut);
  }

  // Validierung
  if (clockIn >= clockOut) {
    throw new Error('Clock-in time must be before clock-out time');
  }

  // Maximale Dauer: 24 Stunden
  const durationMs = clockOut.getTime() - clockIn.getTime();
  if (durationMs > 24 * 60 * 60 * 1000) {
    throw new Error('Maximum duration is 24 hours');
  }

  const durationMinutes = Math.round(durationMs / (1000 * 60));
  updateData.durationMinutes = durationMinutes;
  updateData.enteredByUid = actorUid;

  if (data.note !== undefined) {
    if (data.note?.trim()) {
      updateData.note = data.note.trim();
    } else {
      updateData.note = FieldValue.delete();
    }
  }

  await entryRef.update(updateData);

  const updatedDoc = await entryRef.get();
  return shiftTimeEntryToResponse(entryId, updatedDoc.data() as ShiftTimeEntryDoc);
}

// =============================================================================
// Shift Documents
// =============================================================================

/**
 * Konvertiert ShiftDocumentDoc zu API Response.
 */
function shiftDocumentToResponse(id: string, doc: ShiftDocumentDoc): ShiftDocument {
  return {
    id,
    shiftId: doc.shiftId,
    uploadedByUid: doc.uploadedByUid,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    createdAt: doc.createdAt.toDate().toISOString(),
  };
}

/**
 * Lädt alle Dokumente einer Schicht (nur für Admin, Manager oder Crew-Leiter).
 */
export async function getShiftDocuments(
  tenantId: string,
  shiftId: string,
  requestingUid: string
): Promise<ShiftDocument[]> {
  const db = getAdminFirestore();

  // Berechtigung prüfen: Admin, Manager oder Crew-Leiter
  const isLeader = await isCrewLeader(tenantId, shiftId, requestingUid);
  const isAdminManager = await isAdminOrManager(tenantId, requestingUid);

  if (!isLeader && !isAdminManager) {
    throw new Error('Only crew leader, manager or admin can view documents');
  }

  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shiftDocuments')
    .where('shiftId', '==', shiftId)
    .get();

  // Im Code sortieren (neueste zuerst)
  const documents = snapshot.docs
    .map((doc) => shiftDocumentToResponse(doc.id, doc.data() as ShiftDocumentDoc))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return documents;
}

/**
 * Lädt ein Dokument hoch.
 */
export async function uploadShiftDocument(
  tenantId: string,
  shiftId: string,
  uploadedByUid: string,
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }
): Promise<ShiftDocument> {
  const db = getAdminFirestore();
  const storage = getAdminStorage();

  // Schicht laden und prüfen
  const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(shiftId);
  const shiftSnap = await shiftRef.get();

  if (!shiftSnap.exists) {
    throw new Error('Shift not found');
  }

  // Prüfen ob User zugewiesener Mitarbeiter ist
  const isAssigned = await isAssignedToShift(tenantId, shiftId, uploadedByUid);
  if (!isAssigned) {
    throw new Error('Only assigned members can upload documents');
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

  // Dokument-ID generieren
  const documentId = db.collection('tenants').doc(tenantId).collection('shiftDocuments').doc().id;

  // Storage-Pfad
  const storagePath = `tenants/${tenantId}/shifts/${shiftId}/documents/${documentId}.${ext}`;

  // Datei in Firebase Storage hochladen
  const bucket = storage.bucket();
  const fileRef = bucket.file(storagePath);

  await fileRef.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
      metadata: {
        uploadedBy: uploadedByUid,
        shiftId,
        tenantId,
      },
    },
  });

  // Firestore-Dokument erstellen
  const documentRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('shiftDocuments')
    .doc(documentId);

  const documentData: Omit<ShiftDocumentDoc, 'createdAt'> & {
    createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
  } = {
    shiftId,
    uploadedByUid,
    fileName: file.originalname,
    filePath: storagePath,
    fileType: file.mimetype,
    fileSize: file.size,
    createdAt: FieldValue.serverTimestamp(),
  };

  await documentRef.set(documentData);

  // Zurücklesen
  const savedDoc = await documentRef.get();
  return shiftDocumentToResponse(documentId, savedDoc.data() as ShiftDocumentDoc);
}

/**
 * Generiert eine Download-URL für ein Dokument (signed URL, 1 Stunde gültig).
 */
export async function downloadShiftDocument(
  tenantId: string,
  shiftId: string,
  documentId: string,
  requestingUid: string
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const db = getAdminFirestore();
  const storage = getAdminStorage();

  // Dokument laden
  const documentRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('shiftDocuments')
    .doc(documentId);

  const documentSnap = await documentRef.get();
  if (!documentSnap.exists) {
    throw new Error('Document not found');
  }

  const documentData = documentSnap.data() as ShiftDocumentDoc;

  // Prüfen ob Dokument zur Schicht gehört
  if (documentData.shiftId !== shiftId) {
    throw new Error('Document does not belong to this shift');
  }

  // Berechtigung prüfen: Admin, Manager oder Crew-Leiter
  const isLeader = await isCrewLeader(tenantId, shiftId, requestingUid);
  const isAdminManager = await isAdminOrManager(tenantId, requestingUid);

  if (!isLeader && !isAdminManager) {
    throw new Error('Only crew leader, manager or admin can download documents');
  }

  // Signed URL generieren (1 Stunde gültig)
  const bucket = storage.bucket();
  const fileRef = bucket.file(documentData.filePath);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  const [downloadUrl] = await fileRef.getSignedUrl({
    action: 'read',
    expires: expiresAt,
  });

  return {
    downloadUrl,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Löscht ein Dokument.
 */
export async function deleteShiftDocument(
  tenantId: string,
  shiftId: string,
  documentId: string,
  actorUid: string
): Promise<void> {
  const db = getAdminFirestore();
  const storage = getAdminStorage();

  // Dokument laden
  const documentRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('shiftDocuments')
    .doc(documentId);

  const documentSnap = await documentRef.get();
  if (!documentSnap.exists) {
    throw new Error('Document not found');
  }

  const documentData = documentSnap.data() as ShiftDocumentDoc;

  // Prüfen ob Dokument zur Schicht gehört
  if (documentData.shiftId !== shiftId) {
    throw new Error('Document does not belong to this shift');
  }

  // Berechtigung prüfen: Admin, Manager, Crew-Leiter oder der Uploader selbst
  const isLeader = await isCrewLeader(tenantId, shiftId, actorUid);
  const isAdminManager = await isAdminOrManager(tenantId, actorUid);
  const isUploader = documentData.uploadedByUid === actorUid;

  if (!isLeader && !isAdminManager && !isUploader) {
    throw new Error('Only crew leader, manager, admin or the uploader can delete documents');
  }

  // Datei aus Storage löschen
  try {
    const bucket = storage.bucket();
    const fileRef = bucket.file(documentData.filePath);
    await fileRef.delete();
  } catch (storageError) {
    // Wenn Datei nicht existiert, trotzdem Firestore-Dokument löschen
    console.warn('Failed to delete file from storage:', storageError);
  }

  // Firestore-Dokument löschen
  await documentRef.delete();

  // Audit Log
  await createAuditLog(tenantId, actorUid, 'SHIFT_DOCUMENT_DELETE', 'shift', shiftId);
}
