/**
 * Security Audit Service
 *
 * Business-Logik für Security-Event-Logging und Rate-Limiting.
 */

import { getAdminFirestore } from '../../core/firebase/index.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  SECURITY_EVENT_TYPES,
  SECURITY_EVENT_SEVERITY,
  getSeverityForEventType,
  type SecurityEventType,
  type SecurityEventSeverity,
  type SecurityEventDoc,
  type SecurityEvent,
  type RateLimitDoc,
  type RateLimit,
  type SecurityEventsQueryParams,
  type SecurityStatsResponse,
} from '@timeam/shared';

// Rate-Limiting Konfiguration
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 Minuten
const RATE_LIMIT_BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 Minuten Block

// =============================================================================
// Security Event Logging
// =============================================================================

/**
 * Erstellt einen Security-Event-Log Eintrag.
 * Speichert sowohl tenant-scoped als auch global.
 */
export async function logSecurityEvent(
  tenantId: string | null,
  eventType: SecurityEventType,
  options: {
    userId?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
    severity?: SecurityEventSeverity;
  } = {}
): Promise<void> {
  const db = getAdminFirestore();
  const severity = options.severity || getSeverityForEventType(eventType);
  const timestamp = FieldValue.serverTimestamp();

  const logData: Omit<SecurityEventDoc, 'timestamp'> & {
    timestamp: any;
  } = {
    eventType,
    severity,
    timestamp,
  };

  if (options.userId) logData.userId = options.userId;
  if (options.email) logData.email = options.email;
  if (options.ipAddress) logData.ipAddress = options.ipAddress;
  if (options.userAgent) logData.userAgent = options.userAgent;
  if (options.details && Object.keys(options.details).length > 0) {
    logData.details = options.details;
  }

  // Tenant-scoped Log (wenn tenantId vorhanden)
  if (tenantId) {
    await db
      .collection('tenants')
      .doc(tenantId)
      .collection('securityLogs')
      .add(logData);
  }

  // Globales Log (immer, mit tenantId falls vorhanden)
  const globalLogData = { ...logData };
  if (tenantId) {
    (globalLogData as any).tenantId = tenantId;
  }
  await db.collection('securityLogs').add(globalLogData);
}

/**
 * Loggt ein Auth-Event (Login, Logout, fehlgeschlagener Versuch).
 */
export async function logAuthEvent(
  tenantId: string | null,
  eventType: 'auth.login.success' | 'auth.login.failed' | 'auth.logout' | 'auth.rate_limit_exceeded',
  options: {
    userId?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    errorMessage?: string;
  }
): Promise<void> {
  const details: Record<string, unknown> = {};
  if (options.errorMessage) {
    details.errorMessage = options.errorMessage;
  }

  await logSecurityEvent(tenantId, eventType, {
    userId: options.userId,
    email: options.email,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    details: Object.keys(details).length > 0 ? details : undefined,
  });
}

/**
 * Loggt einen Datenzugriff auf personenbezogene Daten.
 */
export async function logDataAccess(
  tenantId: string,
  userId: string,
  dataType: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const details: Record<string, unknown> = {
    dataType,
    ...options.details,
  };

  await logSecurityEvent(tenantId, SECURITY_EVENT_TYPES.DATA_ACCESS_PERSONAL, {
    userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    details,
  });
}

/**
 * Loggt eine Änderung an sensiblen Daten.
 */
export async function logDataModification(
  tenantId: string,
  userId: string,
  dataType: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const details: Record<string, unknown> = {
    dataType,
    ...options.details,
  };

  await logSecurityEvent(
    tenantId,
    SECURITY_EVENT_TYPES.DATA_MODIFY_SENSITIVE,
    {
      userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      details,
    }
  );
}

/**
 * Loggt einen API-Zugriff auf einen geschützten Endpoint.
 */
export async function logApiAccess(
  tenantId: string | null,
  userId: string,
  endpoint: string,
  method: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const details: Record<string, unknown> = {
    endpoint,
    method,
    ...options.details,
  };

  await logSecurityEvent(tenantId, SECURITY_EVENT_TYPES.API_ACCESS_PROTECTED, {
    userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    details,
  });
}

/**
 * Loggt ein MFA-Event.
 */
export async function logMfaEvent(
  tenantId: string | null,
  eventType:
    | 'mfa.setup'
    | 'mfa.verify.success'
    | 'mfa.verify.failed'
    | 'mfa.reset',
  userId: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  } = {}
): Promise<void> {
  await logSecurityEvent(tenantId, eventType, {
    userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    details: options.details,
  });
}

/**
 * Loggt eine Account-Änderung.
 */
export async function logAccountChange(
  tenantId: string | null,
  eventType:
    | 'account.password_change'
    | 'account.email_change'
    | 'account.deletion_request',
  userId: string,
  options: {
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  } = {}
): Promise<void> {
  await logSecurityEvent(tenantId, eventType, {
    userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    details: options.details,
  });
}

// =============================================================================
// Rate-Limiting
// =============================================================================

/**
 * Prüft, ob ein Rate-Limit überschritten wurde.
 * @param identifier - Email oder IP-Adresse
 * @returns true wenn blockiert, false wenn erlaubt
 */
export async function checkRateLimit(
  identifier: string
): Promise<{ blocked: boolean; remainingAttempts?: number; blockedUntil?: Date }> {
  const db = getAdminFirestore();
  const rateLimitRef = db.collection('security-rate-limits').doc(identifier);
  const rateLimitSnap = await rateLimitRef.get();

  if (!rateLimitSnap.exists) {
    return { blocked: false, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS };
  }

  const data = rateLimitSnap.data() as RateLimitDoc;
  const now = new Date();

  // Prüfe ob aktuell blockiert
  if (data.blockedUntil) {
    const blockedUntil = data.blockedUntil.toDate();
    if (blockedUntil > now) {
      return {
        blocked: true,
        blockedUntil,
      };
    }
    // Block ist abgelaufen, zurücksetzen
    await rateLimitRef.delete();
    return { blocked: false, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS };
  }

  // Prüfe ob Zeitfenster abgelaufen ist
  const firstAttempt = data.firstAttempt.toDate();
  const windowEnd = new Date(firstAttempt.getTime() + RATE_LIMIT_WINDOW_MS);

  if (now > windowEnd) {
    // Zeitfenster abgelaufen, zurücksetzen
    await rateLimitRef.delete();
    return { blocked: false, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS };
  }

  // Prüfe Anzahl der Versuche
  if (data.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    // Blockieren
    const blockedUntil = new Date(now.getTime() + RATE_LIMIT_BLOCK_DURATION_MS);
    await rateLimitRef.update({
      blockedUntil: Timestamp.fromDate(blockedUntil),
    });

    return {
      blocked: true,
      blockedUntil,
    };
  }

  const remainingAttempts = RATE_LIMIT_MAX_ATTEMPTS - data.attempts;
  return { blocked: false, remainingAttempts };
}

/**
 * Zeichnet einen fehlgeschlagenen Login-Versuch auf.
 */
export async function recordFailedAttempt(
  identifier: string
): Promise<{ blocked: boolean; attempts: number; blockedUntil?: Date }> {
  const db = getAdminFirestore();
  const rateLimitRef = db.collection('security-rate-limits').doc(identifier);
  const rateLimitSnap = await rateLimitRef.get();
  const now = new Date();

  if (!rateLimitSnap.exists) {
    // Erster Versuch
    await rateLimitRef.set({
      attempts: 1,
      firstAttempt: Timestamp.fromDate(now),
      lastAttempt: Timestamp.fromDate(now),
    });

    return { blocked: false, attempts: 1 };
  }

  const data = rateLimitSnap.data() as RateLimitDoc;
  const firstAttempt = data.firstAttempt.toDate();
  const windowEnd = new Date(firstAttempt.getTime() + RATE_LIMIT_WINDOW_MS);

  // Prüfe ob Zeitfenster abgelaufen ist
  if (now > windowEnd) {
    // Zeitfenster abgelaufen, neu starten
    await rateLimitRef.set({
      attempts: 1,
      firstAttempt: Timestamp.fromDate(now),
      lastAttempt: Timestamp.fromDate(now),
    });

    return { blocked: false, attempts: 1 };
  }

  // Erhöhe Versuche
  const newAttempts = data.attempts + 1;
  const updateData: Partial<RateLimitDoc> = {
    attempts: newAttempts,
    lastAttempt: Timestamp.fromDate(now),
  };

  // Wenn Limit erreicht, blockieren
  if (newAttempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    const blockedUntil = new Date(now.getTime() + RATE_LIMIT_BLOCK_DURATION_MS);
    updateData.blockedUntil = Timestamp.fromDate(blockedUntil);
    await rateLimitRef.update(updateData);

    return {
      blocked: true,
      attempts: newAttempts,
      blockedUntil,
    };
  }

  await rateLimitRef.update(updateData);
  return { blocked: false, attempts: newAttempts };
}

/**
 * Setzt das Rate-Limit nach erfolgreichem Login zurück.
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  const db = getAdminFirestore();
  const rateLimitRef = db.collection('security-rate-limits').doc(identifier);
  await rateLimitRef.delete();
}

// =============================================================================
// Event Queries
// =============================================================================

/**
 * Lädt Security-Events mit Filterung.
 */
export async function getSecurityEvents(
  tenantId: string | null,
  params: SecurityEventsQueryParams = {}
): Promise<{ events: SecurityEvent[]; total: number }> {
  const db = getAdminFirestore();
  let query:
    | FirebaseFirestore.Query<SecurityEventDoc>
    | FirebaseFirestore.CollectionReference<SecurityEventDoc>;

  // Collection auswählen (tenant-scoped oder global)
  if (tenantId) {
    query = db
      .collection('tenants')
      .doc(tenantId)
      .collection('securityLogs') as FirebaseFirestore.CollectionReference<SecurityEventDoc>;
  } else {
    query = db.collection('securityLogs') as FirebaseFirestore.CollectionReference<SecurityEventDoc>;
  }

  // Filter anwenden - Vorsicht: Firestore erlaubt nur bestimmte Kombinationen
  // Strategie: Lade alle Events und filtere im Code, wenn Index-Fehler auftreten
  let useCodeFiltering = false;
  
  try {
    // Versuche Query mit Filtern zu erstellen
    if (params.from) {
      const fromDate = Timestamp.fromDate(new Date(params.from));
      query = query.where('timestamp', '>=', fromDate);
    }
    if (params.to) {
      const toDate = Timestamp.fromDate(new Date(params.to));
      query = query.where('timestamp', '<=', toDate);
    }
    
    // Sortierung (neueste zuerst) - muss nach where() kommen
    query = query.orderBy('timestamp', 'desc');
    
    // Weitere Filter (können Index-Probleme verursachen)
    if (params.eventType) {
      query = query.where('eventType', '==', params.eventType);
    }
    if (params.severity) {
      query = query.where('severity', '==', params.severity);
    }
    if (params.userId) {
      query = query.where('userId', '==', params.userId);
    }
    if (params.email) {
      query = query.where('email', '==', params.email);
    }
    if (params.ipAddress) {
      query = query.where('ipAddress', '==', params.ipAddress);
    }
  } catch (error: any) {
    // Falls Index-Fehler, verwende Code-Filtering
    if (error.message?.includes('index') || error.code === 9) {
      useCodeFiltering = true;
      // Baue Query ohne problematische Filter neu auf
      if (tenantId) {
        query = db
          .collection('tenants')
          .doc(tenantId)
          .collection('securityLogs') as FirebaseFirestore.CollectionReference<SecurityEventDoc>;
      } else {
        query = db.collection('securityLogs') as FirebaseFirestore.CollectionReference<SecurityEventDoc>;
      }
      
      // Nur Datum-Filter und Sortierung
      if (params.from) {
        const fromDate = Timestamp.fromDate(new Date(params.from));
        query = query.where('timestamp', '>=', fromDate);
      }
      if (params.to) {
        const toDate = Timestamp.fromDate(new Date(params.to));
        query = query.where('timestamp', '<=', toDate);
      }
      query = query.orderBy('timestamp', 'desc');
    } else {
      throw error;
    }
  }

  // Pagination
  const limit = params.limit || 100;
  const offset = params.offset || 0;

  // Versuche Query auszuführen, falls Index-Fehler auftreten, verwende Code-Filtering
  let snapshot: FirebaseFirestore.QuerySnapshot<SecurityEventDoc>;
  try {
    if (offset > 0 && !useCodeFiltering) {
      const offsetSnapshot = await query.limit(offset).get();
      const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
    }

    // Lade mehr Events wenn Code-Filtering verwendet wird (für Filterung im Code)
    const loadLimit = useCodeFiltering ? Math.min(limit * 10, 1000) : limit;
    snapshot = await query.limit(loadLimit).get();
  } catch (error: any) {
    // Falls Index-Fehler beim Ausführen, verwende Code-Filtering
    if ((error.message?.includes('index') || error.code === 9) && !useCodeFiltering) {
      useCodeFiltering = true;
      
      // Baue Query ohne problematische Filter neu auf
      if (tenantId) {
        query = db
          .collection('tenants')
          .doc(tenantId)
          .collection('securityLogs') as FirebaseFirestore.CollectionReference<SecurityEventDoc>;
      } else {
        query = db.collection('securityLogs') as FirebaseFirestore.CollectionReference<SecurityEventDoc>;
      }
      
      // Nur Datum-Filter und Sortierung
      if (params.from) {
        const fromDate = Timestamp.fromDate(new Date(params.from));
        query = query.where('timestamp', '>=', fromDate);
      }
      if (params.to) {
        const toDate = Timestamp.fromDate(new Date(params.to));
        query = query.where('timestamp', '<=', toDate);
      }
      query = query.orderBy('timestamp', 'desc');
      
      // Erneut versuchen
      const loadLimit = Math.min(limit * 10, 1000);
      snapshot = await query.limit(loadLimit).get();
    } else {
      throw error;
    }
  }

  // Events aus Docs extrahieren
  let events: SecurityEvent[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      eventType: data.eventType,
      userId: data.userId,
      email: data.email,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      details: data.details,
      severity: data.severity,
      timestamp: data.timestamp.toDate().toISOString(),
      tenantId: (data as any).tenantId,
    };
  });

  // Code-Filtering anwenden (falls nötig)
  if (useCodeFiltering) {
    if (params.eventType) {
      events = events.filter((e) => e.eventType === params.eventType);
    }
    if (params.severity) {
      events = events.filter((e) => e.severity === params.severity);
    }
    if (params.userId) {
      events = events.filter((e) => e.userId === params.userId);
    }
    if (params.email) {
      events = events.filter((e) => e.email === params.email);
    }
    if (params.ipAddress) {
      events = events.filter((e) => e.ipAddress === params.ipAddress);
    }
    
    // Sortierung sicherstellen (neueste zuerst)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Limit anwenden
    events = events.slice(0, limit);
  }

  // Total count (vereinfacht - für große Collections könnte das langsam sein)
  // In Produktion sollte man hier einen Counter verwenden
  let total: number;
  if (useCodeFiltering || Object.keys(params).length > 0) {
    // Wenn gefiltert wird, verwende die gefilterte Anzahl
    total = events.length;
  } else {
    // Nur wenn keine Filter, zähle alle
    try {
      const totalSnapshot = await (tenantId
        ? db
            .collection('tenants')
            .doc(tenantId)
            .collection('securityLogs')
        : db.collection('securityLogs')
      ).count().get();
      total = totalSnapshot.data().count;
    } catch {
      // Fallback: verwende Anzahl der geladenen Events
      total = events.length;
    }
  }

  return { events, total };
}

/**
 * Lädt ein einzelnes Security-Event.
 */
export async function getSecurityEvent(
  tenantId: string | null,
  eventId: string
): Promise<SecurityEvent | null> {
  const db = getAdminFirestore();
  let docRef: FirebaseFirestore.DocumentReference<SecurityEventDoc>;

  if (tenantId) {
    docRef = db
      .collection('tenants')
      .doc(tenantId)
      .collection('securityLogs')
      .doc(eventId) as FirebaseFirestore.DocumentReference<SecurityEventDoc>;
  } else {
    docRef = db
      .collection('securityLogs')
      .doc(eventId) as FirebaseFirestore.DocumentReference<SecurityEventDoc>;
  }

  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  return {
    id: doc.id,
    eventType: data.eventType,
    userId: data.userId,
    email: data.email,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    details: data.details,
    severity: data.severity,
    timestamp: data.timestamp.toDate().toISOString(),
    tenantId: (data as any).tenantId,
  };
}

/**
 * Lädt Statistiken über Security-Events.
 */
export async function getSecurityStats(
  tenantId: string | null
): Promise<SecurityStatsResponse> {
  const db = getAdminFirestore();
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const collection = tenantId
    ? db.collection('tenants').doc(tenantId).collection('securityLogs')
    : db.collection('securityLogs');

  // Fehlgeschlagene Logins - Filterung im Code statt in Query (um Index-Fehler zu vermeiden)
  // Lade alle Events der letzten 30 Tage und filtere im Code
  // Fallback: Wenn Index-Fehler, lade alle Events (limit 1000) und filtere im Code
  let allEvents30dDocs: Array<FirebaseFirestore.QueryDocumentSnapshot<SecurityEventDoc>>;
  try {
    const allEvents30d = await collection
      .where('timestamp', '>=', Timestamp.fromDate(last30d))
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();
    allEvents30dDocs = allEvents30d.docs as Array<FirebaseFirestore.QueryDocumentSnapshot<SecurityEventDoc>>;
  } catch (error: any) {
    // Fallback: Wenn Index-Fehler, lade einfach alle Events (limit 1000) ohne Filter
    console.warn('Index-Fehler bei getSecurityStats, verwende Fallback:', error.message);
    try {
      const allEvents = await collection
        .orderBy('timestamp', 'desc')
        .limit(1000)
        .get();
      
      // Filtere im Code nach Datum
      allEvents30dDocs = allEvents.docs.filter((doc) => {
        const data = doc.data() as SecurityEventDoc;
        const eventTime = data.timestamp.toDate();
        return eventTime >= last30d;
      }) as Array<FirebaseFirestore.QueryDocumentSnapshot<SecurityEventDoc>>;
    } catch (fallbackError: any) {
      // Zweiter Fallback: Lade alle Events ohne orderBy und sortiere im Code
      console.warn('Auch orderBy-Fallback fehlgeschlagen, verwende einfachen Fallback:', fallbackError.message);
      const allEvents = await collection.limit(1000).get();
      
      // Filtere und sortiere im Code
      const filteredAndSorted = allEvents.docs
        .map((doc) => {
          const data = doc.data() as SecurityEventDoc;
          return { doc, data, eventTime: data.timestamp.toDate() };
        })
        .filter((item) => item.eventTime >= last30d)
        .sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime())
        .slice(0, 1000);
      
      allEvents30dDocs = filteredAndSorted.map((item) => item.doc) as Array<FirebaseFirestore.QueryDocumentSnapshot<SecurityEventDoc>>;
    }
  }

  // Filtere im Code nach Event-Typ
  const failedLogins24h = allEvents30dDocs.filter((doc: FirebaseFirestore.QueryDocumentSnapshot<SecurityEventDoc>) => {
    const data = doc.data();
    const eventTime = data.timestamp.toDate();
    return (
      data.eventType === SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED &&
      eventTime >= last24h
    );
  });

  const failedLogins7d = allEvents30dDocs.filter((doc: FirebaseFirestore.QueryDocumentSnapshot<SecurityEventDoc>) => {
    const data = doc.data();
    const eventTime = data.timestamp.toDate();
    return (
      data.eventType === SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED &&
      eventTime >= last7d
    );
  });

  const failedLogins30d = allEvents30dDocs.filter((doc: FirebaseFirestore.QueryDocumentSnapshot<SecurityEventDoc>) => {
    const data = doc.data();
    return data.eventType === SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED;
  });

  // Rate-Limited
  const rateLimited24h = allEvents30dDocs.filter((doc: FirebaseFirestore.QueryDocumentSnapshot<SecurityEventDoc>) => {
    const data = doc.data();
    const eventTime = data.timestamp.toDate();
    return (
      data.eventType === SECURITY_EVENT_TYPES.AUTH_RATE_LIMIT_EXCEEDED &&
      eventTime >= last24h
    );
  });

  // Aktuelle Rate-Limits
  const rateLimitsSnap = await db.collection('security-rate-limits').get();
  const currentRateLimited = rateLimitsSnap.docs.filter((doc) => {
    const data = doc.data() as RateLimitDoc;
    if (data.blockedUntil) {
      return data.blockedUntil.toDate() > now;
    }
    return false;
  }).length;

  // Event-Typen (verwende bereits geladene Events)
  const eventTypeCounts = new Map<SecurityEventType, number>();
  allEvents30dDocs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot<SecurityEventDoc>) => {
    const eventType = doc.data().eventType as SecurityEventType;
    eventTypeCounts.set(
      eventType,
      (eventTypeCounts.get(eventType) || 0) + 1
    );
  });

  // Top IP-Adressen (verwende bereits geladene Events)
  const ipCounts = new Map<string, number>();
  allEvents30dDocs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot<SecurityEventDoc>) => {
    const ip = doc.data().ipAddress;
    if (ip) {
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    }
  });

  return {
    failedLogins: {
      last24h: failedLogins24h.length,
      last7d: failedLogins7d.length,
      last30d: failedLogins30d.length,
    },
    rateLimited: {
      current: currentRateLimited,
      last24h: rateLimited24h.length,
    },
    eventTypes: Array.from(eventTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topIpAddresses: Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

/**
 * Lädt alle Rate-Limits.
 */
export async function getRateLimits(): Promise<RateLimit[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection('security-rate-limits').get();
  const now = new Date();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as RateLimitDoc;
    const blockedUntil = data.blockedUntil?.toDate();
    const isBlocked = blockedUntil ? blockedUntil > now : false;

    return {
      identifier: doc.id,
      attempts: data.attempts,
      firstAttempt: data.firstAttempt.toDate().toISOString(),
      lastAttempt: data.lastAttempt.toDate().toISOString(),
      blockedUntil: blockedUntil?.toISOString(),
      isBlocked,
    };
  });
}

