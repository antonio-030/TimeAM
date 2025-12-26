/**
 * Time Account Service
 *
 * Business-Logik für Zeitkonto-Verwaltung.
 */

import { getAdminFirestore } from '../../core/firebase/index.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type {
  TimeAccountDoc,
  TimeAccountTargetDoc,
  TimeAccountAdjustmentDoc,
} from './time-account-types.js';
import { adjustmentToResponse } from './time-account-types.js';
import type {
  TimeAccount,
  TimeAccountTarget,
  TimeAccountAdjustment,
  EmploymentType,
} from '@timeam/shared';
import { TIME_ACCOUNT_ADJUSTMENT_SOURCE, EMPLOYMENT_TYPE } from '@timeam/shared';
import type { TimeEntryDoc } from './types.js';
import { TIME_ENTRY_STATUS } from './types.js';
import type { ShiftTimeEntryDoc } from '../shift-pool/types.js';
import { SHIFT_STATUS } from '@timeam/shared';

const DEFAULT_MONTHLY_TARGET_HOURS = 160; // 40h/Woche × 4 Wochen

/**
 * Generiert die Dokument-ID für ein Zeitkonto.
 */
function getTimeAccountDocId(userId: string, year: number, month: number): string {
  return `${userId}_${year}_${month}`;
}

/**
 * Konvertiert Firestore TimeAccountDoc zu API Response.
 */
function timeAccountToResponse(doc: TimeAccountDoc): TimeAccount {
  return {
    userId: doc.userId,
    year: doc.year,
    month: doc.month,
    targetHours: doc.targetHours,
    actualHours: doc.actualHours,
    timeTrackingHours: doc.timeTrackingHours,
    shiftHours: doc.shiftHours,
    balanceHours: doc.balanceHours,
    manualAdjustments: doc.manualAdjustments.map(adjustmentToResponse),
    complianceAdjustments: doc.complianceAdjustments.map(adjustmentToResponse),
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}

/**
 * Konvertiert Firestore TimeAccountTargetDoc zu API Response.
 */
export function timeAccountTargetToResponse(doc: TimeAccountTargetDoc): TimeAccountTarget {
  return {
    userId: doc.userId,
    monthlyTargetHours: doc.monthlyTargetHours,
    employmentType: doc.employmentType as EmploymentType | undefined,
    weeklyHours: doc.weeklyHours,
    updatedAt: doc.updatedAt.toDate().toISOString(),
    updatedBy: doc.updatedBy,
  };
}

/**
 * Lädt die Zielstunden für einen User.
 */
async function getTimeAccountTarget(
  tenantId: string,
  userId: string
): Promise<number> {
  const db = getAdminFirestore();
  const targetRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeAccountTargets')
    .doc(userId);

  const targetSnap = await targetRef.get();
  if (targetSnap.exists) {
    const data = targetSnap.data() as TimeAccountTargetDoc;
    return data.monthlyTargetHours;
  }

  return DEFAULT_MONTHLY_TARGET_HOURS;
}

/**
 * Lädt alle TimeEntries eines Monats für einen User.
 */
async function loadTimeEntriesForMonth(
  tenantId: string,
  userId: string,
  year: number,
  month: number
): Promise<TimeEntryDoc[]> {
  const db = getAdminFirestore();

  // Monatsanfang und -ende berechnen
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  // Alle TimeEntries des Users laden (client-seitig filtern)
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .where('uid', '==', userId)
    .get();

  // Client-seitig nach Monat filtern
  return snapshot.docs
    .map((doc) => doc.data() as TimeEntryDoc)
    .filter((entry) => {
      const clockIn = entry.clockIn.toDate();
      return clockIn >= startDate && clockIn <= endDate;
    })
    .filter((entry) => entry.status === TIME_ENTRY_STATUS.COMPLETED && entry.durationMinutes !== null);
}

/**
 * Lädt alle ShiftTimeEntries eines Monats für einen User.
 * Nur abgeschlossene Schichten werden berücksichtigt.
 */
async function loadShiftTimeEntriesForMonth(
  tenantId: string,
  userId: string,
  year: number,
  month: number
): Promise<ShiftTimeEntryDoc[]> {
  const db = getAdminFirestore();

  // Monatsanfang und -ende berechnen
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // Alle ShiftTimeEntries des Users laden (client-seitig filtern)
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shiftTimeEntries')
    .where('uid', '==', userId)
    .get();

  // Client-seitig nach Monat filtern und prüfen ob Schicht abgeschlossen ist
  const entries = snapshot.docs
    .map((doc) => doc.data() as ShiftTimeEntryDoc)
    .filter((entry) => {
      const clockIn = entry.actualClockIn.toDate();
      return clockIn >= startDate && clockIn <= endDate;
    });

  // Prüfen ob zugehörige Schicht abgeschlossen ist
  const validEntries: ShiftTimeEntryDoc[] = [];
  for (const entry of entries) {
    const shiftRef = db
      .collection('tenants')
      .doc(tenantId)
      .collection('shifts')
      .doc(entry.shiftId);
    const shiftSnap = await shiftRef.get();
    if (shiftSnap.exists) {
      const shiftData = shiftSnap.data();
      if (shiftData?.status === SHIFT_STATUS.COMPLETED) {
        validEntries.push(entry);
      }
    }
  }

  return validEntries;
}

/**
 * Berechnet das Zeitkonto für einen Monat neu.
 */
export async function calculateTimeAccount(
  tenantId: string,
  userId: string,
  year: number,
  month: number
): Promise<TimeAccount> {
  const db = getAdminFirestore();

  // TimeEntries laden
  const timeEntries = await loadTimeEntriesForMonth(tenantId, userId, year, month);
  const timeTrackingHours = timeEntries.reduce((sum, entry) => {
    return sum + (entry.durationMinutes || 0) / 60;
  }, 0);

  // ShiftTimeEntries laden
  const shiftTimeEntries = await loadShiftTimeEntriesForMonth(tenantId, userId, year, month);
  const shiftHours = shiftTimeEntries.reduce((sum, entry) => {
    return sum + entry.durationMinutes / 60;
  }, 0);

  // Zielstunden laden
  const targetHours = await getTimeAccountTarget(tenantId, userId);

  // Bestehendes Zeitkonto laden (falls vorhanden)
  const accountDocId = getTimeAccountDocId(userId, year, month);
  const accountRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeAccounts')
    .doc(accountDocId);

  const accountSnap = await accountRef.get();

  let manualAdjustments: TimeAccountAdjustmentDoc[] = [];
  let complianceAdjustments: TimeAccountAdjustmentDoc[] = [];

  if (accountSnap.exists) {
    const existingData = accountSnap.data() as TimeAccountDoc;
    manualAdjustments = existingData.manualAdjustments || [];
    complianceAdjustments = existingData.complianceAdjustments || [];
  }

  // Saldo berechnen
  const actualHours = timeTrackingHours + shiftHours;
  const manualAdjustmentSum = manualAdjustments.reduce((sum, adj) => sum + adj.amountHours, 0);
  const complianceAdjustmentSum = complianceAdjustments.reduce((sum, adj) => sum + adj.amountHours, 0);
  const balanceHours = actualHours - targetHours + manualAdjustmentSum + complianceAdjustmentSum;

  // Zeitkonto speichern oder aktualisieren
  const accountData: TimeAccountDoc = {
    userId,
    year,
    month,
    targetHours,
    actualHours,
    timeTrackingHours,
    shiftHours,
    balanceHours,
    manualAdjustments,
    complianceAdjustments,
    createdAt: accountSnap.exists
      ? (accountSnap.data() as TimeAccountDoc).createdAt
      : FieldValue.serverTimestamp() as Timestamp,
    updatedAt: FieldValue.serverTimestamp() as Timestamp,
  };

  await accountRef.set(accountData, { merge: true });

  // Aktualisiertes Dokument zurücklesen
  const updatedSnap = await accountRef.get();
  return timeAccountToResponse(updatedSnap.data() as TimeAccountDoc);
}

/**
 * Lädt das Zeitkonto für einen Monat.
 */
export async function getTimeAccount(
  tenantId: string,
  userId: string,
  year: number,
  month: number
): Promise<TimeAccount | null> {
  const db = getAdminFirestore();
  const accountDocId = getTimeAccountDocId(userId, year, month);
  const accountRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeAccounts')
    .doc(accountDocId);

  const accountSnap = await accountRef.get();

  if (!accountSnap.exists) {
    // Zeitkonto automatisch erstellen
    return await calculateTimeAccount(tenantId, userId, year, month);
  }

  return timeAccountToResponse(accountSnap.data() as TimeAccountDoc);
}

/**
 * Lädt die Historie der Zeitkonten.
 */
export async function getTimeAccountHistory(
  tenantId: string,
  userId: string,
  limit: number = 12
): Promise<TimeAccount[]> {
  const db = getAdminFirestore();

  // Alle Zeitkonten des Users laden (client-seitig sortieren)
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeAccounts')
    .where('userId', '==', userId)
    .get();

  const accounts = snapshot.docs
    .map((doc) => timeAccountToResponse(doc.data() as TimeAccountDoc))
    .sort((a, b) => {
      // Nach Jahr und Monat sortieren (neueste zuerst)
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      return b.month - a.month;
    })
    .slice(0, limit);

  return accounts;
}

/**
 * Setzt die Zielstunden für einen User.
 */
export async function updateTimeAccountTarget(
  tenantId: string,
  userId: string,
  monthlyTargetHours: number,
  updatedBy: string,
  employmentType?: EmploymentType,
  weeklyHours?: number
): Promise<TimeAccountTarget> {
  const db = getAdminFirestore();

  if (monthlyTargetHours < 0 || monthlyTargetHours > 1000) {
    throw new Error('Ungültige Zielstunden (muss zwischen 0 und 1000 liegen)');
  }

  if (weeklyHours !== undefined && (weeklyHours < 0 || weeklyHours > 168)) {
    throw new Error('Ungültige Wochenstunden (muss zwischen 0 und 168 liegen)');
  }

  const targetRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeAccountTargets')
    .doc(userId);

  const targetData: TimeAccountTargetDoc = {
    userId,
    monthlyTargetHours,
    updatedAt: FieldValue.serverTimestamp() as Timestamp,
    updatedBy,
  };

  if (employmentType !== undefined) {
    targetData.employmentType = employmentType;
  }

  if (weeklyHours !== undefined) {
    targetData.weeklyHours = weeklyHours;
  }

  await targetRef.set(targetData, { merge: true });

  // Aktualisiertes Dokument zurücklesen
  const updatedSnap = await targetRef.get();
  return timeAccountTargetToResponse(updatedSnap.data() as TimeAccountTargetDoc);
}

/**
 * Fügt eine manuelle Anpassung hinzu.
 */
export async function addManualAdjustment(
  tenantId: string,
  userId: string,
  year: number,
  month: number,
  amountHours: number,
  reason: string,
  adjustedBy: string
): Promise<TimeAccount> {
  const db = getAdminFirestore();
  const accountDocId = getTimeAccountDocId(userId, year, month);
  const accountRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeAccounts')
    .doc(accountDocId);

  // Zeitkonto laden oder erstellen
  let accountData: TimeAccountDoc;
  const accountSnap = await accountRef.get();

  if (!accountSnap.exists) {
    // Zeitkonto erstellen
    await calculateTimeAccount(tenantId, userId, year, month);
    const newSnap = await accountRef.get();
    accountData = newSnap.data() as TimeAccountDoc;
  } else {
    accountData = accountSnap.data() as TimeAccountDoc;
  }

  // Anpassung hinzufügen
  const adjustment: TimeAccountAdjustmentDoc = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amountHours,
    reason: reason.trim(),
    adjustedBy,
    adjustedAt: FieldValue.serverTimestamp() as Timestamp,
    source: TIME_ACCOUNT_ADJUSTMENT_SOURCE.MANUAL,
  };

  const manualAdjustments = [...(accountData.manualAdjustments || []), adjustment];

  // Saldo neu berechnen
  const manualAdjustmentSum = manualAdjustments.reduce((sum, adj) => sum + adj.amountHours, 0);
  const complianceAdjustmentSum = (accountData.complianceAdjustments || []).reduce(
    (sum, adj) => sum + adj.amountHours,
    0
  );
  const balanceHours =
    accountData.actualHours - accountData.targetHours + manualAdjustmentSum + complianceAdjustmentSum;

  // Aktualisieren
  await accountRef.update({
    manualAdjustments,
    balanceHours,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Aktualisiertes Dokument zurücklesen
  const updatedSnap = await accountRef.get();
  return timeAccountToResponse(updatedSnap.data() as TimeAccountDoc);
}

/**
 * Fügt eine Compliance-Anpassung hinzu.
 */
export async function addComplianceAdjustment(
  tenantId: string,
  userId: string,
  year: number,
  month: number,
  amountHours: number,
  reason: string,
  violationId: string,
  adjustedBy: string
): Promise<TimeAccount> {
  const db = getAdminFirestore();
  const accountDocId = getTimeAccountDocId(userId, year, month);
  const accountRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeAccounts')
    .doc(accountDocId);

  // Zeitkonto laden oder erstellen
  let accountData: TimeAccountDoc;
  const accountSnap = await accountRef.get();

  if (!accountSnap.exists) {
    // Zeitkonto erstellen
    await calculateTimeAccount(tenantId, userId, year, month);
    const newSnap = await accountRef.get();
    accountData = newSnap.data() as TimeAccountDoc;
  } else {
    accountData = accountSnap.data() as TimeAccountDoc;
  }

  // Anpassung hinzufügen
  const adjustment: TimeAccountAdjustmentDoc = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amountHours,
    reason: reason.trim(),
    adjustedBy,
    adjustedAt: FieldValue.serverTimestamp() as Timestamp,
    referenceId: violationId,
    source: TIME_ACCOUNT_ADJUSTMENT_SOURCE.COMPLIANCE,
  };

  const complianceAdjustments = [...(accountData.complianceAdjustments || []), adjustment];

  // Saldo neu berechnen
  const manualAdjustmentSum = (accountData.manualAdjustments || []).reduce(
    (sum, adj) => sum + adj.amountHours,
    0
  );
  const complianceAdjustmentSum = complianceAdjustments.reduce((sum, adj) => sum + adj.amountHours, 0);
  const balanceHours =
    accountData.actualHours - accountData.targetHours + manualAdjustmentSum + complianceAdjustmentSum;

  // Aktualisieren
  await accountRef.update({
    complianceAdjustments,
    balanceHours,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Aktualisiertes Dokument zurücklesen
  const updatedSnap = await accountRef.get();
  return timeAccountToResponse(updatedSnap.data() as TimeAccountDoc);
}

/**
 * Exportiert Zeitkonto-Daten für DSGVO (Art. 15).
 */
export async function exportTimeAccountData(
  tenantId: string,
  userId: string,
  startYear?: number,
  startMonth?: number,
  endYear?: number,
  endMonth?: number
): Promise<TimeAccount[]> {
  const db = getAdminFirestore();

  // Alle Zeitkonten des Users laden
  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeAccounts')
    .where('userId', '==', userId)
    .get();

  let accounts = snapshot.docs.map((doc) => timeAccountToResponse(doc.data() as TimeAccountDoc));

  // Filter anwenden (falls angegeben)
  if (startYear !== undefined && startMonth !== undefined) {
    accounts = accounts.filter((acc) => {
      if (acc.year < startYear) return false;
      if (acc.year === startYear && acc.month < startMonth) return false;
      return true;
    });
  }

  if (endYear !== undefined && endMonth !== undefined) {
    accounts = accounts.filter((acc) => {
      if (acc.year > endYear) return false;
      if (acc.year === endYear && acc.month > endMonth) return false;
      return true;
    });
  }

  // Sortieren (neueste zuerst)
  accounts.sort((a, b) => {
    if (a.year !== b.year) {
      return b.year - a.year;
    }
    return b.month - a.month;
  });

  return accounts;
}

