/**
 * Reports & Analytics Service
 *
 * Firestore-Operationen für Berichte und Statistiken.
 */

import { getAdminFirestore } from '../../core/firebase/index.js';
import type {
  ReportPeriod,
  TimeSummaryReport,
  ShiftOverviewReport,
  MemberActivityReport,
  DashboardWidgets,
  MemberTimeSummary,
  MemberActivityStats,
} from './types.js';

/**
 * Berechnet Start- und Enddatum basierend auf dem Zeitraum.
 */
function getDateRange(period: ReportPeriod, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    
    case 'yesterday': {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return {
        start: yesterday,
        end: new Date(today.getTime() - 1),
      };
    }
    
    case 'this_week': {
      const dayOfWeek = today.getDay();
      const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
      return {
        start: monday,
        end: new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
      };
    }
    
    case 'last_week': {
      const dayOfWeek = today.getDay();
      const thisMonday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
      const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        start: lastMonday,
        end: new Date(thisMonday.getTime() - 1),
      };
    }
    
    case 'this_month': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        start: firstOfMonth,
        end: lastOfMonth,
      };
    }
    
    case 'last_month': {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return {
        start: firstOfLastMonth,
        end: lastOfLastMonth,
      };
    }
    
    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Start- und Enddatum erforderlich für benutzerdefinierten Zeitraum');
      }
      return {
        start: new Date(customStart),
        end: new Date(customEnd),
      };
    
    default:
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
  }
}

/**
 * Generiert Zeit-Zusammenfassungs-Report.
 */
export async function generateTimeSummaryReport(
  tenantId: string,
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string
): Promise<TimeSummaryReport> {
  const db = getAdminFirestore();
  const { start, end } = getDateRange(period, customStart, customEnd);
  
  // TimeEntries laden
  const timeEntriesSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .where('status', '==', 'completed')
    .get();
  
  // Nach Datum filtern (clientseitig wegen Index-Limitierung)
  const filteredEntries = timeEntriesSnapshot.docs.filter(doc => {
    const data = doc.data();
    const clockIn = data.clockIn?.toDate?.() || new Date(data.clockIn);
    return clockIn >= start && clockIn <= end;
  });
  
  // Aggregation
  let totalMinutes = 0;
  const memberMap = new Map<string, MemberTimeSummary>();
  const daysSet = new Set<string>();
  
  filteredEntries.forEach(doc => {
    const data = doc.data();
    const clockIn = data.clockIn?.toDate?.() || new Date(data.clockIn);
    const duration = data.durationMinutes || 0;
    
    totalMinutes += duration;
    daysSet.add(clockIn.toISOString().split('T')[0]);
    
    // Nach Mitarbeiter gruppieren
    const memberId = data.uid;
    const existing = memberMap.get(memberId);
    if (existing) {
      existing.totalMinutes += duration;
      existing.entriesCount += 1;
    } else {
      memberMap.set(memberId, {
        memberId,
        memberEmail: data.email || '',
        memberName: data.email?.split('@')[0] || 'Unbekannt',
        totalMinutes: duration,
        entriesCount: 1,
      });
    }
  });
  
  const daysWithEntries = daysSet.size;
  const totalEntries = filteredEntries.length;
  
  return {
    type: 'time_summary',
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    stats: {
      totalMinutes,
      totalEntries,
      averageMinutesPerDay: daysWithEntries > 0 ? Math.round(totalMinutes / daysWithEntries) : 0,
      averageMinutesPerEntry: totalEntries > 0 ? Math.round(totalMinutes / totalEntries) : 0,
      daysWithEntries,
    },
    byMember: Array.from(memberMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generiert Schicht-Übersichts-Report.
 */
export async function generateShiftOverviewReport(
  tenantId: string,
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string
): Promise<ShiftOverviewReport> {
  const db = getAdminFirestore();
  const { start, end } = getDateRange(period, customStart, customEnd);
  
  // Shifts laden
  const shiftsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shifts')
    .get();
  
  // Nach Datum filtern
  const filteredShifts = shiftsSnapshot.docs.filter(doc => {
    const data = doc.data();
    const shiftStart = data.startTime?.toDate?.() || new Date(data.startTime);
    return shiftStart >= start && shiftStart <= end;
  });
  
  // Aggregation
  let totalDuration = 0;
  let publishedShifts = 0;
  let assignedShifts = 0;
  let completedShifts = 0;
  let cancelledShifts = 0;
  
  filteredShifts.forEach(doc => {
    const data = doc.data();
    const status = data.status;
    
    // Dauer berechnen
    const shiftStart = data.startTime?.toDate?.() || new Date(data.startTime);
    const shiftEnd = data.endTime?.toDate?.() || new Date(data.endTime);
    const duration = Math.round((shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60));
    totalDuration += duration;
    
    // Status zählen
    switch (status) {
      case 'published':
        publishedShifts++;
        break;
      case 'assigned':
        assignedShifts++;
        break;
      case 'completed':
        completedShifts++;
        break;
      case 'cancelled':
        cancelledShifts++;
        break;
    }
  });
  
  const totalShifts = filteredShifts.length;
  
  return {
    type: 'shift_overview',
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    stats: {
      totalShifts,
      publishedShifts,
      assignedShifts,
      completedShifts,
      cancelledShifts,
      averageShiftDuration: totalShifts > 0 ? Math.round(totalDuration / totalShifts) : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generiert Mitarbeiter-Aktivitäts-Report.
 */
export async function generateMemberActivityReport(
  tenantId: string,
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string
): Promise<MemberActivityReport> {
  const db = getAdminFirestore();
  const { start, end } = getDateRange(period, customStart, customEnd);
  
  // Mitglieder laden
  const membersSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('members')
    .get();
  
  // TimeEntries laden
  const timeEntriesSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .where('status', '==', 'completed')
    .get();
  
  // Shifts laden
  const shiftsSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('shifts')
    .get();
  
  // Daten nach Mitarbeiter aggregieren
  const memberStats = new Map<string, MemberActivityStats>();
  
  // Mitglieder initialisieren
  membersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    memberStats.set(data.uid, {
      memberId: data.uid,
      memberEmail: data.email || '',
      memberName: data.displayName || data.email?.split('@')[0] || 'Unbekannt',
      role: data.role || 'employee',
      timeEntries: 0,
      totalTimeMinutes: 0,
      shiftsAssigned: 0,
      shiftsCompleted: 0,
      lastActivity: null,
    });
  });
  
  // TimeEntries aggregieren (gefiltert nach Zeitraum)
  timeEntriesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const clockIn = data.clockIn?.toDate?.() || new Date(data.clockIn);
    
    if (clockIn >= start && clockIn <= end) {
      const stats = memberStats.get(data.uid);
      if (stats) {
        stats.timeEntries += 1;
        stats.totalTimeMinutes += data.durationMinutes || 0;
        
        const activityDate = clockIn.toISOString();
        if (!stats.lastActivity || activityDate > stats.lastActivity) {
          stats.lastActivity = activityDate;
        }
      }
    }
  });
  
  // Shifts aggregieren (gefiltert nach Zeitraum)
  shiftsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const shiftStart = data.startTime?.toDate?.() || new Date(data.startTime);
    
    if (shiftStart >= start && shiftStart <= end && data.assignedTo) {
      const stats = memberStats.get(data.assignedTo);
      if (stats) {
        stats.shiftsAssigned += 1;
        if (data.status === 'completed') {
          stats.shiftsCompleted += 1;
        }
      }
    }
  });
  
  return {
    type: 'member_activity',
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    members: Array.from(memberStats.values()).sort((a, b) => b.totalTimeMinutes - a.totalTimeMinutes),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Lädt Dashboard-Widget-Daten.
 */
export async function getDashboardWidgets(tenantId: string): Promise<DashboardWidgets> {
  const db = getAdminFirestore();
  
  // Heute Mitternacht
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // TimeEntries laden
  const timeEntriesSnapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('timeEntries')
    .get();
  
  // Heute-Statistiken
  let todayTotalMinutes = 0;
  let runningEntries = 0;
  const todayActiveUsers = new Set<string>();
  
  // Wöchentlicher Trend
  const dailyStats = new Map<string, { totalMinutes: number; entriesCount: number }>();
  
  // Top-Mitarbeiter (letzte 7 Tage)
  const memberMinutes = new Map<string, { name: string; minutes: number }>();
  
  timeEntriesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const clockIn = data.clockIn?.toDate?.() || new Date(data.clockIn);
    const duration = data.durationMinutes || 0;
    
    // Laufende Einträge
    if (data.status === 'running') {
      runningEntries++;
      if (clockIn >= today) {
        todayActiveUsers.add(data.uid);
        const runningMinutes = Math.round((Date.now() - clockIn.getTime()) / (1000 * 60));
        todayTotalMinutes += runningMinutes;
      }
    }
    
    // Abgeschlossene Einträge von heute
    if (data.status === 'completed' && clockIn >= today) {
      todayTotalMinutes += duration;
      todayActiveUsers.add(data.uid);
    }
    
    // Wöchentlicher Trend (letzte 7 Tage)
    if (clockIn >= weekAgo && data.status === 'completed') {
      const dateKey = clockIn.toISOString().split('T')[0];
      const existing = dailyStats.get(dateKey);
      if (existing) {
        existing.totalMinutes += duration;
        existing.entriesCount += 1;
      } else {
        dailyStats.set(dateKey, { totalMinutes: duration, entriesCount: 1 });
      }
      
      // Top-Mitarbeiter
      const memberKey = data.uid;
      const memberExisting = memberMinutes.get(memberKey);
      if (memberExisting) {
        memberExisting.minutes += duration;
      } else {
        memberMinutes.set(memberKey, {
          name: data.email?.split('@')[0] || 'Unbekannt',
          minutes: duration,
        });
      }
    }
  });
  
  // Wöchentlicher Trend sortieren
  const weeklyTrend = Array.from(dailyStats.entries())
    .map(([date, stats]) => ({
      date,
      totalMinutes: stats.totalMinutes,
      entriesCount: stats.entriesCount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Top 5 Mitarbeiter
  const topMembers = Array.from(memberMinutes.entries())
    .map(([memberId, data]) => ({
      memberId,
      memberName: data.name,
      totalMinutes: data.minutes,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 5);
  
  return {
    todayStats: {
      totalTimeMinutes: todayTotalMinutes,
      activeUsers: todayActiveUsers.size,
      runningEntries,
    },
    weeklyTrend,
    topMembers,
  };
}
