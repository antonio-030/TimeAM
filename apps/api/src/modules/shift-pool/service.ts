/**
 * Shift Pool Service
 *
 * Firestore-Operationen für das Schichtausschreibungs-Modul.
 */

import { getAdminFirestore } from '../../core/firebase';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  SHIFT_STATUS,
  APPLICATION_STATUS,
  ASSIGNMENT_STATUS,
  AUDIT_ACTIONS,
  type ShiftStatus,
  type ApplicationStatus,
  type Shift,
  type PoolShift,
  type Application,
  type Assignment,
  type CreateShiftRequest,
  type ShiftDoc,
  type ApplicationDoc,
  type AssignmentDoc,
  type AuditLogDoc,
} from './types';
import { NOTIFICATION_TYPES } from '@timeam/shared';
import { createNotification, createNotificationsForUsers } from '../notifications';

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
    createdByUid: doc.createdByUid,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
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
  const locationData: { name: string; address?: string } = {
    name: data.location.name.trim(),
  };
  if (data.location.address && data.location.address.trim()) {
    locationData.address = data.location.address.trim();
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
    const locationData: { name: string; address?: string } = {
      name: data.location.name.trim(),
    };
    if (data.location.address && data.location.address.trim()) {
      locationData.address = data.location.address.trim();
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

  // Nur DRAFT kann gelöscht werden, PUBLISHED muss abgesagt werden
  if (shiftData.status !== SHIFT_STATUS.DRAFT) {
    throw new Error('Only draft shifts can be deleted. Use cancel for published shifts.');
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

  // Benachrichtigung an zugewiesene Mitarbeiter
  try {
    if (assigneesUids.length > 0) {
      const startsAt = shiftData.startsAt.toDate();
      const dateStr = startsAt.toLocaleDateString('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      });

      await createNotificationsForUsers(tenantId, assigneesUids, {
        type: NOTIFICATION_TYPES.SHIFT_CANCELLED,
        title: 'Schicht abgesagt! ⚠️',
        message: `"${shiftData.title}" am ${dateStr} wurde abgesagt.`,
        ref: { type: 'shift', id: shiftId },
        link: '/my-shifts',
      });
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
        const startsAt = shiftData.startsAt.toDate();
        const dateStr = startsAt.toLocaleDateString('de-DE', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        });

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
    throw new Error('Already applied to this shift');
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
 */
export async function getShiftApplications(
  tenantId: string,
  shiftId: string
): Promise<Application[]> {
  const db = getAdminFirestore();

  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('applications')
    .where('shiftId', '==', shiftId)
    .get();

  return snapshot.docs
    .map((doc) => applicationToResponse(doc.id, doc.data() as ApplicationDoc))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  const result = await db.runTransaction(async (transaction) => {
    // Bewerbung laden
    const appRef = db.collection('tenants').doc(tenantId).collection('applications').doc(applicationId);
    const appSnap = await transaction.get(appRef);

    if (!appSnap.exists) {
      throw new Error('Application not found');
    }

    const appData = appSnap.data() as ApplicationDoc;

    if (appData.status !== APPLICATION_STATUS.PENDING) {
      throw new Error(`Cannot accept application with status ${appData.status}`);
    }

    // Schicht laden
    const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(appData.shiftId);
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
      shiftId: appData.shiftId,
      uid: appData.uid,
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
      shiftId: appData.shiftId,
      uid: appData.uid,
    };
  });

  // Audit Logs
  await createAuditLog(tenantId, actorUid, AUDIT_ACTIONS.APP_ACCEPT, 'application', applicationId, {
    shiftId: result.shiftId,
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

    await createNotification(tenantId, {
      type: NOTIFICATION_TYPES.APPLICATION_ACCEPTED,
      title: 'Bewerbung angenommen! 🎉',
      message: `Deine Bewerbung für "${shiftData.title}" am ${dateStr} wurde angenommen.`,
      recipientUid: result.uid,
      ref: { type: 'shift', id: result.shiftId },
      link: `/shifts/${result.shiftId}`,
    });
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

    await createNotification(tenantId, {
      type: NOTIFICATION_TYPES.APPLICATION_REJECTED,
      title: 'Bewerbung abgelehnt',
      message: `Deine Bewerbung für "${shiftData.title}" am ${dateStr} wurde leider abgelehnt.`,
      recipientUid: appData.uid,
      ref: { type: 'shift', id: appData.shiftId },
      link: '/shifts',
    });
  } catch (notificationError) {
    console.error('Failed to create rejection notification:', notificationError);
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

    // Member-Namen laden
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

      colleagues = colleagueUids.map((u) => ({
        uid: u,
        displayName: membersMap.get(u) || 'Unbekannt',
      }));
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
}

/**
 * Lädt alle Zuweisungen für eine Schicht (Admin).
 */
export async function getShiftAssignments(
  tenantId: string,
  shiftId: string
): Promise<ShiftAssignmentWithMember[]> {
  const db = getAdminFirestore();

  // Zuweisungen laden
  const assignmentsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('assignments')
    .where('shiftId', '==', shiftId)
    .get();

  if (assignmentsSnapshot.empty) {
    return [];
  }

  // Member-Daten laden
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

  // Zuweisungen mit Member-Details anreichern
  return assignmentsSnapshot.docs.map((doc) => {
    const data = doc.data();
    const member = membersMap.get(data.uid);
    return {
      assignmentId: doc.id,
      uid: data.uid,
      displayName: member?.displayName || member?.email?.split('@')[0] || 'Unbekannt',
      email: member?.email,
      status: data.status,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
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

  await db.runTransaction(async (transaction) => {
    // Assignment laden
    const assignmentRef = db.collection('tenants').doc(tenantId).collection('assignments').doc(assignmentId);
    const assignmentSnap = await transaction.get(assignmentRef);

    if (!assignmentSnap.exists) {
      throw new Error('Assignment not found');
    }

    const assignmentData = assignmentSnap.data();

    if (assignmentData.status !== ASSIGNMENT_STATUS.CONFIRMED) {
      throw new Error('Assignment is not active');
    }

    // Schicht laden
    const shiftRef = db.collection('tenants').doc(tenantId).collection('shifts').doc(assignmentData.shiftId);
    const shiftSnap = await transaction.get(shiftRef);

    if (!shiftSnap.exists) {
      throw new Error('Shift not found');
    }

    const shiftData = shiftSnap.data() as ShiftDoc;

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
      memberUid: assignmentData.uid,
      shiftTitle: shiftData.title,
      startsAt: shiftData.startsAt,
      shiftId: assignmentData.shiftId,
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
