/**
 * Time Tracking Service
 *
 * Firestore-Operationen für Zeiterfassung.
 */

import { getAdminFirestore } from '../../core/firebase/index.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  TIME_ENTRY_STATUS,
  type TimeEntryDoc,
  type TimeEntryResponse,
  type CreateTimeEntryRequest,
  type UpdateTimeEntryRequest,
} from './types.js';

/**
 * Konvertiert Firestore TimeEntryDoc zu API Response.
 */
function toResponse(id: string, doc: TimeEntryDoc): TimeEntryResponse {
  return {
    id,
    uid: doc.uid,
    email: doc.email,
    clockIn: doc.clockIn.toDate().toISOString(),
    clockOut: doc.clockOut?.toDate().toISOString() ?? null,
    status: doc.status,
    durationMinutes: doc.durationMinutes,
    note: doc.note,
  };
}

/**
 * Prüft, ob der User einen laufenden TimeEntry hat.
 */
export async function getRunningEntry(
  tenantId: string,
  uid: string
): Promise<TimeEntryResponse | null> {
  const db = getAdminFirestore();

  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .where('uid', '==', uid)
    .where('status', '==', TIME_ENTRY_STATUS.RUNNING)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return toResponse(doc.id, doc.data() as TimeEntryDoc);
}

/**
 * Clock-In: Startet einen neuen TimeEntry.
 */
export async function clockIn(
  tenantId: string,
  uid: string,
  email: string,
  note?: string
): Promise<TimeEntryResponse> {
  const db = getAdminFirestore();

  // Prüfen, ob bereits ein laufender Entry existiert
  const running = await getRunningEntry(tenantId, uid);
  if (running) {
    throw new Error('Already clocked in');
  }

  // Neuen Entry erstellen
  const entryRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .doc();

  // Basis-Daten (ohne undefined Werte)
  const entryData: Record<string, unknown> = {
    uid,
    email,
    clockIn: FieldValue.serverTimestamp(),
    clockOut: null,
    status: TIME_ENTRY_STATUS.RUNNING,
    durationMinutes: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Note nur hinzufügen wenn vorhanden
  if (note !== undefined && note !== null && note.trim() !== '') {
    entryData.note = note.trim();
  }

  await entryRef.set(entryData);

  // Entry zurücklesen für genaue Timestamps
  const savedDoc = await entryRef.get();
  return toResponse(entryRef.id, savedDoc.data() as TimeEntryDoc);
}

/**
 * Clock-Out: Beendet den laufenden TimeEntry.
 */
export async function clockOut(
  tenantId: string,
  uid: string,
  note?: string
): Promise<TimeEntryResponse> {
  const db = getAdminFirestore();

  // Laufenden Entry finden
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .where('uid', '==', uid)
    .where('status', '==', TIME_ENTRY_STATUS.RUNNING)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error('No running time entry');
  }

  const entryDoc = snapshot.docs[0];
  const entryData = entryDoc.data() as TimeEntryDoc;
  const entryRef = entryDoc.ref;

  // Dauer berechnen
  const clockInTime = entryData.clockIn.toDate();
  const clockOutTime = new Date();
  const durationMinutes = Math.round(
    (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60)
  );

  // Update-Daten
  const updateData: Record<string, unknown> = {
    clockOut: FieldValue.serverTimestamp(),
    status: TIME_ENTRY_STATUS.COMPLETED,
    durationMinutes,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Notiz hinzufügen/aktualisieren wenn angegeben
  if (note !== undefined && note !== null && note.trim() !== '') {
    updateData.note = entryData.note
      ? `${entryData.note}\n${note.trim()}`
      : note.trim();
  }

  await entryRef.update(updateData);

  // Entry zurücklesen
  const savedDoc = await entryRef.get();
  return toResponse(entryRef.id, savedDoc.data() as TimeEntryDoc);
}

/**
 * Lädt TimeEntries für einen User.
 * 
 * HINWEIS: Ohne Composite Index wird clientseitig sortiert und gefiltert.
 * Für Production sollte der Index erstellt werden:
 * Collection: timeEntries, Fields: uid (ASC), clockIn (DESC)
 */
export async function getMyTimeEntries(
  tenantId: string,
  uid: string,
  options: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<TimeEntryResponse[]> {
  const db = getAdminFirestore();
  const { limit = 50, startDate, endDate } = options;

  // Einfache Query ohne orderBy (kein Composite Index nötig)
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .where('uid', '==', uid)
    .get();

  // Client-seitig filtern und sortieren
  let entries = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      data: doc.data() as TimeEntryDoc,
    }))
    .filter((entry) => {
      const clockIn = entry.data.clockIn.toDate();
      if (startDate && clockIn < startDate) return false;
      if (endDate && clockIn > endDate) return false;
      return true;
    })
    // Nach clockIn DESC sortieren
    .sort((a, b) => b.data.clockIn.toMillis() - a.data.clockIn.toMillis())
    // Limit anwenden
    .slice(0, limit);

  return entries.map((entry) => toResponse(entry.id, entry.data));
}

/**
 * Berechnet die Gesamtarbeitszeit für heute.
 * 
 * HINWEIS: Ohne Composite Index wird clientseitig gefiltert.
 * Für Production sollte der Index erstellt werden:
 * Collection: timeEntries, Fields: uid (ASC), clockIn (ASC)
 */
export async function getTodayStats(
  tenantId: string,
  uid: string
): Promise<{
  totalMinutes: number;
  entriesCount: number;
  isRunning: boolean;
  runningEntry: TimeEntryResponse | null;
}> {
  const db = getAdminFirestore();

  // Heute Mitternacht
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Einfache Query ohne Datum-Filter (kein Composite Index nötig)
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .where('uid', '==', uid)
    .get();

  let totalMinutes = 0;
  let runningEntry: TimeEntryResponse | null = null;
  let todayEntriesCount = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as TimeEntryDoc;
    const clockInTime = data.clockIn.toDate();

    // Client-seitig nach heute filtern
    if (clockInTime < today) {
      return;
    }

    todayEntriesCount++;

    if (data.status === TIME_ENTRY_STATUS.COMPLETED && data.durationMinutes) {
      totalMinutes += data.durationMinutes;
    } else if (data.status === TIME_ENTRY_STATUS.RUNNING) {
      // Laufende Zeit berechnen
      const currentMinutes = Math.round(
        (Date.now() - clockInTime.getTime()) / (1000 * 60)
      );
      totalMinutes += currentMinutes;
      runningEntry = toResponse(doc.id, data);
    }
  });

  return {
    totalMinutes,
    entriesCount: todayEntriesCount,
    isRunning: runningEntry !== null,
    runningEntry,
  };
}

/**
 * Erstellt einen manuellen TimeEntry.
 */
export async function createTimeEntry(
  tenantId: string,
  uid: string,
  email: string,
  data: CreateTimeEntryRequest
): Promise<TimeEntryResponse> {
  const db = getAdminFirestore();

  // Validierung
  const clockIn = new Date(data.clockIn);
  const clockOut = new Date(data.clockOut);

  if (isNaN(clockIn.getTime()) || isNaN(clockOut.getTime())) {
    throw new Error('Ungültiges Datum');
  }

  if (clockIn >= clockOut) {
    throw new Error('Startzeit muss vor Endzeit liegen');
  }

  // Maximale Dauer: 24 Stunden
  const durationMs = clockOut.getTime() - clockIn.getTime();
  if (durationMs > 24 * 60 * 60 * 1000) {
    throw new Error('Maximale Dauer ist 24 Stunden');
  }

  // Dauer berechnen
  const durationMinutes = Math.round(durationMs / (1000 * 60));

  // Entry erstellen
  const entryRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .doc();

  const entryData: Record<string, unknown> = {
    uid,
    email,
    clockIn: Timestamp.fromDate(clockIn),
    clockOut: Timestamp.fromDate(clockOut),
    status: TIME_ENTRY_STATUS.COMPLETED,
    durationMinutes,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (data.note?.trim()) {
    entryData.note = data.note.trim();
  }

  await entryRef.set(entryData);

  const savedDoc = await entryRef.get();
  return toResponse(entryRef.id, savedDoc.data() as TimeEntryDoc);
}

/**
 * Aktualisiert einen TimeEntry.
 */
export async function updateTimeEntry(
  tenantId: string,
  entryId: string,
  uid: string,
  data: UpdateTimeEntryRequest
): Promise<TimeEntryResponse> {
  const db = getAdminFirestore();

  const entryRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .doc(entryId);

  const entrySnap = await entryRef.get();

  if (!entrySnap.exists) {
    throw new Error('Eintrag nicht gefunden');
  }

  const entryData = entrySnap.data() as TimeEntryDoc;

  // Nur eigene Einträge bearbeiten
  if (entryData.uid !== uid) {
    throw new Error('Keine Berechtigung');
  }

  // Laufende Einträge können nicht bearbeitet werden
  if (entryData.status === TIME_ENTRY_STATUS.RUNNING) {
    throw new Error('Laufende Einträge können nicht bearbeitet werden');
  }

  // Update-Daten zusammenstellen
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  let newClockIn = entryData.clockIn.toDate();
  let newClockOut = entryData.clockOut?.toDate() || new Date();

  if (data.clockIn !== undefined) {
    const parsed = new Date(data.clockIn);
    if (isNaN(parsed.getTime())) {
      throw new Error('Ungültige Startzeit');
    }
    newClockIn = parsed;
    updateData.clockIn = Timestamp.fromDate(parsed);
  }

  if (data.clockOut !== undefined) {
    const parsed = new Date(data.clockOut);
    if (isNaN(parsed.getTime())) {
      throw new Error('Ungültige Endzeit');
    }
    newClockOut = parsed;
    updateData.clockOut = Timestamp.fromDate(parsed);
  }

  // Validierung
  if (newClockIn >= newClockOut) {
    throw new Error('Startzeit muss vor Endzeit liegen');
  }

  // Dauer neu berechnen
  const durationMinutes = Math.round(
    (newClockOut.getTime() - newClockIn.getTime()) / (1000 * 60)
  );
  updateData.durationMinutes = durationMinutes;

  if (data.note !== undefined) {
    updateData.note = data.note?.trim() || FieldValue.delete();
  }

  await entryRef.update(updateData);

  const savedDoc = await entryRef.get();
  return toResponse(entryId, savedDoc.data() as TimeEntryDoc);
}

/**
 * Löscht einen TimeEntry.
 */
export async function deleteTimeEntry(
  tenantId: string,
  entryId: string,
  uid: string
): Promise<void> {
  const db = getAdminFirestore();

  const entryRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .doc(entryId);

  const entrySnap = await entryRef.get();

  if (!entrySnap.exists) {
    throw new Error('Eintrag nicht gefunden');
  }

  const entryData = entrySnap.data() as TimeEntryDoc;

  // Nur eigene Einträge löschen
  if (entryData.uid !== uid) {
    throw new Error('Keine Berechtigung');
  }

  // Laufende Einträge können nicht gelöscht werden
  if (entryData.status === TIME_ENTRY_STATUS.RUNNING) {
    throw new Error('Laufende Einträge können nicht gelöscht werden. Bitte zuerst ausstempeln.');
  }

  await entryRef.delete();
}

/**
 * Lädt einen einzelnen TimeEntry.
 */
export async function getTimeEntryById(
  tenantId: string,
  entryId: string,
  uid: string
): Promise<TimeEntryResponse | null> {
  const db = getAdminFirestore();

  const entryRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .doc(entryId);

  const entrySnap = await entryRef.get();

  if (!entrySnap.exists) {
    return null;
  }

  const entryData = entrySnap.data() as TimeEntryDoc;

  // Nur eigene Einträge anzeigen
  if (entryData.uid !== uid) {
    return null;
  }

  return toResponse(entryId, entryData);
}
