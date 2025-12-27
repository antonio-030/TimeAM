/**
 * Work Time Compliance Service
 *
 * Business-Logik für Compliance-Prüfung, Verstoß-Erkennung und Reports.
 */

import { getAdminFirestore, getAdminStorage } from '../../core/firebase/index.js';
import { FieldValue, Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type {
  RuleSet,
  RuleConfig,
  ComplianceRuleDoc,
  ComplianceViolationDoc,
  ComplianceAuditLogDoc,
  ComplianceReportDoc,
  ComplianceViolation,
  ComplianceRule,
  ComplianceAuditLog,
  ComplianceReport,
  ComplianceViolationsQueryParams,
  ComplianceAuditLogsQueryParams,
  ComplianceStatsResponse,
  ViolationType,
  ViolationSeverity,
} from './types.js';
import {
  DEFAULT_RULE_SETS,
  RULE_SET,
  COMPLIANCE_AUDIT_ACTION,
  VIOLATION_TYPE,
  VIOLATION_SEVERITY,
} from './types.js';
import {
  checkComplianceRules,
  type ComplianceTimeEntry,
  type DetectedViolation,
} from './rules/rule-engine.js';
import type { TimeEntryDoc } from '../time-tracking/types.js';
import type { ShiftTimeEntryDoc } from '../shift-pool/types.js';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import type { PDFDocument as PDFDocumentType } from 'pdfkit';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Konvertiert Firestore ComplianceRuleDoc zu API Response.
 */
function ruleToResponse(id: string, doc: ComplianceRuleDoc): ComplianceRule {
  return {
    id,
    ruleSet: doc.ruleSet,
    config: doc.config,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
    updatedBy: doc.updatedBy,
  };
}

/**
 * Konvertiert Firestore ComplianceViolationDoc zu API Response.
 */
function violationToResponse(
  id: string,
  doc: ComplianceViolationDoc
): ComplianceViolation {
  return {
    id,
    userId: doc.userId,
    violationType: doc.violationType,
    severity: doc.severity,
    detectedAt: doc.detectedAt.toDate().toISOString(),
    periodStart: doc.periodStart.toDate().toISOString(),
    periodEnd: doc.periodEnd.toDate().toISOString(),
    ruleSet: doc.ruleSet,
    details: doc.details,
    acknowledgedAt: doc.acknowledgedAt?.toDate().toISOString(),
    acknowledgedBy: doc.acknowledgedBy,
  };
}

/**
 * Konvertiert Firestore ComplianceAuditLogDoc zu API Response.
 */
function auditLogToResponse(
  id: string,
  doc: ComplianceAuditLogDoc
): ComplianceAuditLog {
  return {
    id,
    action: doc.action,
    actorUid: doc.actorUid,
    timestamp: doc.timestamp.toDate().toISOString(),
    details: doc.details,
  };
}

/**
 * Konvertiert Firestore ComplianceReportDoc zu API Response.
 */
async function reportToResponse(
  id: string,
  doc: ComplianceReportDoc
): Promise<ComplianceReport> {
  const storage = getAdminStorage();
  const bucket = storage.bucket();
  const file = bucket.file(doc.storagePath);

  // Generiere Download-URL (gültig für 1 Stunde)
  const [downloadUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 Stunde
  });

  return {
    id,
    generatedBy: doc.generatedBy,
    generatedAt: doc.generatedAt.toDate().toISOString(),
    periodStart: doc.periodStart.toDate().toISOString(),
    periodEnd: doc.periodEnd.toDate().toISOString(),
    format: doc.format,
    ruleSet: doc.ruleSet,
    filters: doc.filters,
    summary: doc.summary,
    downloadUrl,
    hash: doc.hash,
  };
}

// =============================================================================
// Rule Management
// =============================================================================

/**
 * Lädt das aktuelle Compliance-Regel-Set für einen Tenant.
 */
export async function getComplianceRule(
  tenantId: string
): Promise<ComplianceRule> {
  const db = getAdminFirestore();

  const ruleRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceRules')
    .doc('default');

  const ruleSnap = await ruleRef.get();

  // Wenn kein Regel-Set existiert, erstelle Standard (EU)
  if (!ruleSnap.exists) {
    const defaultRule: ComplianceRuleDoc = {
      ruleSet: RULE_SET.EU,
      config: DEFAULT_RULE_SETS[RULE_SET.EU],
      createdAt: FieldValue.serverTimestamp() as Timestamp,
      updatedAt: FieldValue.serverTimestamp() as Timestamp,
      updatedBy: 'system',
    };

    await ruleRef.set(defaultRule);

    // Nochmal laden für Response
    const newRuleSnap = await ruleRef.get();
    return ruleToResponse(newRuleSnap.id, newRuleSnap.data() as ComplianceRuleDoc);
  }

  return ruleToResponse(ruleSnap.id, ruleSnap.data() as ComplianceRuleDoc);
}

/**
 * Aktualisiert das Compliance-Regel-Set.
 */
export async function updateComplianceRule(
  tenantId: string,
  request: { ruleSet: RuleSet; config?: Partial<RuleConfig> },
  updatedBy: string
): Promise<ComplianceRule> {
  const db = getAdminFirestore();

  const ruleRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceRules')
    .doc('default');

  // Lade Standard-Konfiguration für das Regel-Set
  const baseConfig = DEFAULT_RULE_SETS[request.ruleSet];

  // Merge mit benutzerdefinierten Werten
  const config: RuleConfig = {
    ...baseConfig,
    ...request.config,
    ruleSet: request.ruleSet,
  };

  const ruleData: ComplianceRuleDoc = {
    ruleSet: request.ruleSet,
    config,
    updatedAt: FieldValue.serverTimestamp() as Timestamp,
    updatedBy,
    createdAt: FieldValue.serverTimestamp() as Timestamp, // Wird überschrieben wenn existiert
  };

  // Prüfe ob bereits existiert
  const existingSnap = await ruleRef.get();
  if (existingSnap.exists) {
    // Nur aktualisieren
    await ruleRef.update({
      ruleSet: request.ruleSet,
      config,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy,
    });
  } else {
    // Erstellen
    ruleData.createdAt = FieldValue.serverTimestamp() as Timestamp;
    await ruleRef.set(ruleData);
  }

  // Audit-Log erstellen
  await createAuditLog(tenantId, updatedBy, COMPLIANCE_AUDIT_ACTION.RULE_SET_CHANGED, {
    ruleSet: request.ruleSet,
  });

  // Nochmal laden für Response
  const updatedSnap = await ruleRef.get();
  return ruleToResponse(updatedSnap.id, updatedSnap.data() as ComplianceRuleDoc);
}

// =============================================================================
// Violation Detection
// =============================================================================

/**
 * Lädt Time Entries für Compliance-Prüfung.
 * Optimiert: Wenn userId vorhanden ist, filtern wir zuerst nach uid (benötigt keinen Index),
 * dann filtern wir im Code nach Datum.
 */
async function loadTimeEntriesForCompliance(
  tenantId: string,
  userId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<ComplianceTimeEntry[]> {
  const db = getAdminFirestore();
  const entries: ComplianceTimeEntry[] = [];
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  // Lade time-tracking Entries
  // Optimierung: Wenn userId vorhanden ist, filtern wir zuerst nach uid (einfacher Index)
  // und dann im Code nach Datum, um den zusammengesetzten Index zu vermeiden
  if (userId) {
    // Query mit nur uid-Filter (benötigt keinen zusammengesetzten Index)
    const timeEntriesSnap = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('timeEntries')
      .where('uid', '==', userId)
      .get();

    // Filter im Code nach Datum
    for (const doc of timeEntriesSnap.docs) {
      const data = doc.data() as TimeEntryDoc;
      const clockIn = data.clockIn.toDate();
      
      // Nur Einträge im Zeitraum berücksichtigen
      if (clockIn >= startDate && clockIn <= endDate) {
        entries.push({
          id: doc.id,
          userId: data.uid,
          clockIn,
          clockOut: data.clockOut?.toDate() || null,
          durationMinutes: data.durationMinutes,
        });
      }
    }
  } else {
    // Wenn kein userId, verwenden wir die ursprüngliche Query (nur Datum)
    // Diese benötigt nur einen einfachen Index auf clockIn
    const timeEntriesSnap = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('timeEntries')
      .where('clockIn', '>=', startTimestamp)
      .where('clockIn', '<=', endTimestamp)
      .get();

    for (const doc of timeEntriesSnap.docs) {
      const data = doc.data() as TimeEntryDoc;
      entries.push({
        id: doc.id,
        userId: data.uid,
        clockIn: data.clockIn.toDate(),
        clockOut: data.clockOut?.toDate() || null,
        durationMinutes: data.durationMinutes,
      });
    }
  }

  // Lade shift-time-entries
  // Gleiche Optimierung wie oben
  if (userId) {
    const shiftTimeEntriesSnap = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('shiftTimeEntries')
      .where('uid', '==', userId)
      .get();

    // Filter im Code nach Datum
    for (const doc of shiftTimeEntriesSnap.docs) {
      const data = doc.data() as ShiftTimeEntryDoc;
      const clockIn = data.actualClockIn.toDate();
      
      // Nur Einträge im Zeitraum berücksichtigen
      if (clockIn >= startDate && clockIn <= endDate) {
        entries.push({
          id: doc.id,
          userId: data.uid,
          clockIn,
          clockOut: data.actualClockOut.toDate(),
          durationMinutes: data.durationMinutes,
        });
      }
    }
  } else {
    // Wenn kein userId, verwenden wir die ursprüngliche Query (nur Datum)
    const shiftTimeEntriesSnap = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('shiftTimeEntries')
      .where('actualClockIn', '>=', startTimestamp)
      .where('actualClockIn', '<=', endTimestamp)
      .get();

    for (const doc of shiftTimeEntriesSnap.docs) {
      const data = doc.data() as ShiftTimeEntryDoc;
      entries.push({
        id: doc.id,
        userId: data.uid,
        clockIn: data.actualClockIn.toDate(),
        clockOut: data.actualClockOut.toDate(),
        durationMinutes: data.durationMinutes,
      });
    }
  }

  return entries;
}

/**
 * Speichert einen erkannten Verstoß.
 */
async function storeViolation(
  tenantId: string,
  userId: string,
  violation: DetectedViolation,
  ruleSet: RuleSet
): Promise<string> {
  const db = getAdminFirestore();

  const violationData: ComplianceViolationDoc = {
    userId,
    violationType: violation.violationType,
    severity: violation.severity,
    detectedAt: FieldValue.serverTimestamp() as Timestamp,
    periodStart: Timestamp.fromDate(violation.periodStart),
    periodEnd: Timestamp.fromDate(violation.periodEnd),
    ruleSet,
    details: violation.details,
  };

  const violationRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceViolations')
    .doc();

  await violationRef.set(violationData);

  return violationRef.id;
}

/**
 * Prüft Compliance für einen Zeitraum.
 */
export async function checkCompliance(
  tenantId: string,
  userId: string | undefined,
  startDate: Date,
  endDate: Date
): Promise<ComplianceViolation[]> {
  const db = getAdminFirestore();
  // Lade Regel-Set
  const rule = await getComplianceRule(tenantId);

  // Lade Time Entries
  const entries = await loadTimeEntriesForCompliance(
    tenantId,
    userId,
    startDate,
    endDate
  );

  // Gruppiere nach User
  const entriesByUser = new Map<string, ComplianceTimeEntry[]>();
  for (const entry of entries) {
    if (!entriesByUser.has(entry.userId)) {
      entriesByUser.set(entry.userId, []);
    }
    entriesByUser.get(entry.userId)!.push(entry);
  }

  // Prüfe Compliance für jeden User
  const allViolations: ComplianceViolation[] = [];

  for (const [userId, userEntries] of entriesByUser) {
    const detectedViolations = checkComplianceRules(userEntries, rule.config);

    // Speichere Verstöße
    for (const violation of detectedViolations) {
      const violationId = await storeViolation(
        tenantId,
        userId,
        violation,
        rule.ruleSet
      );

      // Lade gespeicherten Verstoß für Response
      const violationRef = db
        .collection('tenants')
        .doc(tenantId)
        .collection('complianceViolations')
        .doc(violationId);

      const violationSnap = await violationRef.get();
      const savedViolation = violationToResponse(
        violationSnap.id,
        violationSnap.data() as ComplianceViolationDoc
      );
      allViolations.push(savedViolation);

      // Zeitkonto-Anpassung hinzufügen (asynchron, nicht blockierend)
      applyComplianceAdjustmentToTimeAccount(
        tenantId,
        userId,
        savedViolation,
        violationId
      ).catch((error) => {
        console.error('Error applying compliance adjustment to time account:', error);
      });
    }
  }

  // Audit-Log erstellen
  if (userId) {
    await createAuditLog(tenantId, 'system', COMPLIANCE_AUDIT_ACTION.MANUAL_CHECK, {
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
    });
  }

  return allViolations;
}

/**
 * Erkennt Verstöße automatisch (wird von Hooks aufgerufen).
 */
export async function detectViolations(
  tenantId: string,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  // Führe Compliance-Prüfung durch (speichert automatisch Verstöße)
  await checkCompliance(tenantId, userId, startDate, endDate);
}

/**
 * Wendet Compliance-Anpassungen auf das Zeitkonto an.
 */
async function applyComplianceAdjustmentToTimeAccount(
  tenantId: string,
  userId: string,
  violation: ComplianceViolation,
  violationId: string
): Promise<void> {
  try {
    const { addComplianceAdjustment } = await import('../time-tracking/time-account-service.js');

    // Mapping: Verstoß-Typ → Stunden-Anpassung
    const adjustmentMap: Record<ViolationType, number> = {
      [VIOLATION_TYPE.REST_PERIOD_VIOLATION]: -0.5,
      [VIOLATION_TYPE.SHIFT_DURATION_VIOLATION]: -1.0,
      [VIOLATION_TYPE.BREAK_MISSING]: -0.25,
      [VIOLATION_TYPE.WEEKLY_REST_VIOLATION]: -1.0,
      [VIOLATION_TYPE.MAX_WORKING_TIME_EXCEEDED]: -2.0,
    };

    const amountHours = adjustmentMap[violation.violationType] || 0;

    if (amountHours === 0) {
      return; // Keine Anpassung für diesen Verstoß-Typ
    }

    // Monat des Verstoßes bestimmen
    const detectedDate = new Date(violation.detectedAt);
    const year = detectedDate.getFullYear();
    const month = detectedDate.getMonth() + 1;

    // Grund für Anpassung
    const reason = `Compliance-Verstoß: ${violation.violationType}`;

    // Anpassung hinzufügen
    await addComplianceAdjustment(
      tenantId,
      userId,
      year,
      month,
      amountHours,
      reason,
      violationId,
      'system'
    );
  } catch (error) {
    // Ignoriere Fehler (Modul möglicherweise nicht aktiv oder andere Fehler)
    if (error instanceof Error && error.message.includes('Missing entitlements')) {
      return; // Modul nicht aktiv
    }
    // Logge Fehler, aber blockiere nicht
    console.error('Error applying compliance adjustment to time account:', error);
  }
}

// =============================================================================
// Violation Management
// =============================================================================

/**
 * Lädt Verstöße mit Filterung.
 */
export async function getViolations(
  tenantId: string,
  params: ComplianceViolationsQueryParams = {}
): Promise<{ violations: ComplianceViolation[]; total: number }> {
  const db = getAdminFirestore();

  let query: any = db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceViolations');

  // Filter anwenden
  if (params.userId) {
    query = query.where('userId', '==', params.userId);
  }

  if (params.violationType) {
    query = query.where('violationType', '==', params.violationType);
  }

  if (params.severity) {
    query = query.where('severity', '==', params.severity);
  }

  if (params.from) {
    query = query.where('detectedAt', '>=', Timestamp.fromDate(new Date(params.from)));
  }

  if (params.to) {
    query = query.where('detectedAt', '<=', Timestamp.fromDate(new Date(params.to)));
  }

  // Sortierung
  query = query.orderBy('detectedAt', 'desc');

  // Pagination
  const limit = params.limit || 100;
  const offset = params.offset || 0;

  let snapshot;
  if (offset > 0) {
    const offsetSnapshot = await query.limit(offset).get();
    const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    snapshot = await query.limit(limit).get();
  } else {
    snapshot = await query.limit(limit).get();
  }

  let violations = snapshot.docs.map((doc: QueryDocumentSnapshot<ComplianceViolationDoc>) =>
    violationToResponse(doc.id, doc.data() as ComplianceViolationDoc)
  );

  // Filter acknowledged (wenn angegeben)
  if (params.acknowledged !== undefined) {
    violations = violations.filter(
      (v: ComplianceViolation) => (v.acknowledgedAt !== undefined) === params.acknowledged
    );
  }

  // Total count (vereinfacht)
  const totalSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceViolations')
    .count()
    .get();

  const total = totalSnapshot.data().count;

  return { violations, total };
}

/**
 * Lädt einen einzelnen Verstoß.
 */
export async function getViolation(
  tenantId: string,
  violationId: string
): Promise<ComplianceViolation | null> {
  const db = getAdminFirestore();

  const violationRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceViolations')
    .doc(violationId);

  const violationSnap = await violationRef.get();

  if (!violationSnap.exists) {
    return null;
  }

  return violationToResponse(
    violationSnap.id,
    violationSnap.data() as ComplianceViolationDoc
  );
}

/**
 * Markiert einen Verstoß als erkannt.
 */
export async function acknowledgeViolation(
  tenantId: string,
  violationId: string,
  acknowledgedBy: string,
  acknowledged: boolean
): Promise<ComplianceViolation> {
  const db = getAdminFirestore();

  const violationRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceViolations')
    .doc(violationId);

  const violationSnap = await violationRef.get();

  if (!violationSnap.exists) {
    throw new Error('Violation not found');
  }

  if (acknowledged) {
    await violationRef.update({
      acknowledgedAt: FieldValue.serverTimestamp(),
      acknowledgedBy,
    });
  } else {
    await violationRef.update({
      acknowledgedAt: FieldValue.delete(),
      acknowledgedBy: FieldValue.delete(),
    });
  }

  // Audit-Log erstellen
  await createAuditLog(tenantId, acknowledgedBy, COMPLIANCE_AUDIT_ACTION.VIOLATION_ACKNOWLEDGED, {
    violationId,
  });

  const updatedSnap = await violationRef.get();
  return violationToResponse(
    updatedSnap.id,
    updatedSnap.data() as ComplianceViolationDoc
  );
}

// =============================================================================
// Audit Logging
// =============================================================================

/**
 * Erstellt einen Audit-Log Eintrag.
 */
async function createAuditLog(
  tenantId: string,
  actorUid: string,
  action: string,
  details: {
    reportId?: string;
    violationId?: string;
    ruleSet?: RuleSet;
    exportFormat?: 'csv' | 'pdf';
    periodStart?: string;
    periodEnd?: string;
  } = {}
): Promise<void> {
  const db = getAdminFirestore();

  const logData: ComplianceAuditLogDoc = {
    action: action as any,
    actorUid,
    timestamp: FieldValue.serverTimestamp() as Timestamp,
    details,
  };

  await db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceAuditLogs')
    .add(logData);
}

/**
 * Lädt Audit-Logs.
 */
export async function getAuditLogs(
  tenantId: string,
  params: ComplianceAuditLogsQueryParams = {}
): Promise<{ logs: ComplianceAuditLog[]; total: number }> {
  const db = getAdminFirestore();

  let query: any = db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceAuditLogs');

  if (params.action) {
    query = query.where('action', '==', params.action);
  }

  if (params.from) {
    query = query.where('timestamp', '>=', Timestamp.fromDate(new Date(params.from)));
  }

  if (params.to) {
    query = query.where('timestamp', '<=', Timestamp.fromDate(new Date(params.to)));
  }

  query = query.orderBy('timestamp', 'desc');

  const limit = params.limit || 100;
  const offset = params.offset || 0;

  let snapshot;
  if (offset > 0) {
    const offsetSnapshot = await query.limit(offset).get();
    const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    snapshot = await query.limit(limit).get();
  } else {
    snapshot = await query.limit(limit).get();
  }

  const logs = snapshot.docs.map((doc: QueryDocumentSnapshot<ComplianceAuditLogDoc>) =>
    auditLogToResponse(doc.id, doc.data() as ComplianceAuditLogDoc)
  );

  const totalSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceAuditLogs')
    .count()
    .get();

  const total = totalSnapshot.data().count;

  return { logs, total };
}

// =============================================================================
// Statistics
// =============================================================================

/**
 * Lädt Compliance-Statistiken.
 */
export async function getComplianceStats(
  tenantId: string
): Promise<ComplianceStatsResponse> {
  const db = getAdminFirestore();
  const now = new Date();

  // Heute
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Diese Woche (Montag)
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay() + 1);
  thisWeekStart.setHours(0, 0, 0, 0);

  // Dieser Monat
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Lade alle Verstöße (vereinfacht - in Production sollte man filtern)
  const violationsSnap = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceViolations')
    .orderBy('detectedAt', 'desc')
    .limit(1000)
    .get();

  const violations = violationsSnap.docs.map((doc) =>
    violationToResponse(doc.id, doc.data() as ComplianceViolationDoc)
  );

  // Filtere nach Zeitraum
  const todayViolations = violations.filter((v) => {
    const detectedAt = new Date(v.detectedAt);
    return detectedAt >= todayStart;
  });

  const thisWeekViolations = violations.filter((v) => {
    const detectedAt = new Date(v.detectedAt);
    return detectedAt >= thisWeekStart;
  });

  const thisMonthViolations = violations.filter((v) => {
    const detectedAt = new Date(v.detectedAt);
    return detectedAt >= thisMonthStart;
  });

  // Zähle nach Typ
  const violationsByType = new Map<ViolationType, number>();
  for (const violation of violations) {
    violationsByType.set(
      violation.violationType,
      (violationsByType.get(violation.violationType) || 0) + 1
    );
  }

  return {
    today: {
      violations: todayViolations.length,
      warnings: todayViolations.filter((v) => v.severity === VIOLATION_SEVERITY.WARNING).length,
      errors: todayViolations.filter((v) => v.severity === VIOLATION_SEVERITY.ERROR).length,
    },
    thisWeek: {
      violations: thisWeekViolations.length,
      warnings: thisWeekViolations.filter((v) => v.severity === VIOLATION_SEVERITY.WARNING).length,
      errors: thisWeekViolations.filter((v) => v.severity === VIOLATION_SEVERITY.ERROR).length,
    },
    thisMonth: {
      violations: thisMonthViolations.length,
      warnings: thisMonthViolations.filter((v) => v.severity === VIOLATION_SEVERITY.WARNING).length,
      errors: thisMonthViolations.filter((v) => v.severity === VIOLATION_SEVERITY.ERROR).length,
    },
    violationsByType: Array.from(violationsByType.entries()).map(([type, count]) => ({
      type,
      count,
    })),
  };
}

// =============================================================================
// Report Generation
// =============================================================================

/**
 * Generiert einen Compliance-Report (CSV oder PDF).
 */
export async function generateReport(
  tenantId: string,
  generatedBy: string,
  periodStart: Date,
  periodEnd: Date,
  format: 'csv' | 'pdf',
  filters?: {
    userId?: string;
    violationType?: ViolationType;
    severity?: ViolationSeverity;
  }
): Promise<ComplianceReport> {
  const db = getAdminFirestore();
  const storage = getAdminStorage();

  // Lade Regel-Set
  const rule = await getComplianceRule(tenantId);

  // Lade Verstöße
  const violationsResult = await getViolations(tenantId, {
    from: periodStart.toISOString(),
    to: periodEnd.toISOString(),
    userId: filters?.userId,
    violationType: filters?.violationType,
    severity: filters?.severity,
  });

  const violations = violationsResult.violations;

  // Berechne Zusammenfassung
  const violationsByType = new Map<ViolationType, number>();
  const violationsBySeverity = new Map<ViolationSeverity, number>();

  for (const violation of violations) {
    violationsByType.set(
      violation.violationType,
      (violationsByType.get(violation.violationType) || 0) + 1
    );
    violationsBySeverity.set(
      violation.severity,
      (violationsBySeverity.get(violation.severity) || 0) + 1
    );
  }

  const summary = {
    totalViolations: violations.length,
    violationsByType: Object.fromEntries(violationsByType) as Record<ViolationType, number>,
    violationsBySeverity: Object.fromEntries(violationsBySeverity) as Record<ViolationSeverity, number>,
  };

  // Generiere Report-Datei
  const reportId = db.collection('tenants').doc(tenantId).collection('complianceReports').doc().id;
  const storagePath = `tenants/${tenantId}/compliance-reports/${reportId}.${format}`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  let fileBuffer: Buffer;
  let hash: string;

  if (format === 'csv') {
    fileBuffer = await generateCsvReport(violations, rule, periodStart, periodEnd);
  } else {
    fileBuffer = await generatePdfReport(violations, rule, periodStart, periodEnd, summary);
  }

  // Berechne Hash
  hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // Upload zu Firebase Storage
  await file.save(fileBuffer, {
    metadata: {
      contentType: format === 'csv' ? 'text/csv' : 'application/pdf',
      metadata: {
        tenantId,
        reportId,
        generatedBy,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        hash,
      },
    },
  });

  // Speichere Report-Metadaten
  const reportData: ComplianceReportDoc = {
    generatedBy,
    generatedAt: FieldValue.serverTimestamp() as Timestamp,
    periodStart: Timestamp.fromDate(periodStart),
    periodEnd: Timestamp.fromDate(periodEnd),
    format,
    ruleSet: rule.ruleSet,
    filters,
    summary,
    storagePath,
    hash,
  };

  const reportRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceReports')
    .doc(reportId);

  await reportRef.set(reportData);

  // Audit-Log erstellen
  await createAuditLog(tenantId, generatedBy, COMPLIANCE_AUDIT_ACTION.REPORT_GENERATED, {
    reportId,
    exportFormat: format,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  });

  // Lade Report für Response
  const reportSnap = await reportRef.get();
  return await reportToResponse(reportSnap.id, reportSnap.data() as ComplianceReportDoc);
}

/**
 * Generiert CSV-Report.
 */
async function generateCsvReport(
  violations: ComplianceViolation[],
  rule: ComplianceRule,
  periodStart: Date,
  periodEnd: Date
): Promise<Buffer> {
  // CSV Header mit UTF-8 BOM für Excel-Kompatibilität
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const lines: string[] = [];

  // Header
  lines.push('Datum,User ID,Verstoß-Typ,Severity,Erwartet,Tatsächlich,Beeinträchtigte Einträge,Status');
  lines.push('');

  // Daten
  for (const violation of violations) {
    const date = new Date(violation.detectedAt).toLocaleDateString('de-DE');
    const status = violation.acknowledgedAt ? 'Erkannt' : 'Offen';
    const affectedEntries = violation.details.affectedEntries.join('; ');

    lines.push(
      [
        date,
        violation.userId,
        violation.violationType,
        violation.severity,
        `"${violation.details.expected}"`,
        `"${violation.details.actual}"`,
        `"${affectedEntries}"`,
        status,
      ].join(',')
    );
  }

  const csvContent = lines.join('\n');
  return Buffer.concat([bom, Buffer.from(csvContent, 'utf-8')]);
}

/**
 * Generiert PDF-Report.
 */
async function generatePdfReport(
  violations: ComplianceViolation[],
  rule: ComplianceRule,
  periodStart: Date,
  periodEnd: Date,
  summary: {
    totalViolations: number;
    violationsByType: Record<ViolationType, number>;
    violationsBySeverity: Record<ViolationSeverity, number>;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('Compliance-Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Zeitraum: ${periodStart.toLocaleDateString('de-DE')} - ${periodEnd.toLocaleDateString('de-DE')}`, { align: 'center' });
    doc.text(`Regel-Set: ${rule.ruleSet.toUpperCase()}`, { align: 'center' });
    doc.moveDown(2);

    // Zusammenfassung
    doc.fontSize(16).text('Zusammenfassung');
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Gesamt Verstöße: ${summary.totalViolations}`);
    doc.text(`Warnungen: ${summary.violationsBySeverity.warning || 0}`);
    doc.text(`Fehler: ${summary.violationsBySeverity.error || 0}`);
    doc.moveDown(2);

    // Detailliste
    doc.fontSize(16).text('Detailliste');
    doc.moveDown();

    for (const violation of violations) {
      doc.fontSize(12);
      doc.text(`Datum: ${new Date(violation.detectedAt).toLocaleDateString('de-DE')}`, { continued: false });
      doc.text(`Typ: ${violation.violationType}`, { indent: 20 });
      doc.text(`Severity: ${violation.severity}`, { indent: 20 });
      doc.text(`Erwartet: ${violation.details.expected}`, { indent: 20 });
      doc.text(`Tatsächlich: ${violation.details.actual}`, { indent: 20 });
      doc.moveDown();
    }

    // Footer
    doc.fontSize(10);
    doc.text(`Generiert am: ${new Date().toLocaleString('de-DE')}`, 50, doc.page.height - 50, { align: 'left' });

    doc.end();
  });
}

/**
 * Lädt einen Report.
 */
export async function getReport(
  tenantId: string,
  reportId: string
): Promise<ComplianceReport | null> {
  const db = getAdminFirestore();

  const reportRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('complianceReports')
    .doc(reportId);

  const reportSnap = await reportRef.get();

  if (!reportSnap.exists) {
    return null;
  }

  return await reportToResponse(reportSnap.id, reportSnap.data() as ComplianceReportDoc);
}

