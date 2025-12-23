/**
 * Reports & Analytics API Client
 */

import { apiGet, apiPost } from '../../core/api';

/** Report Zeiträume */
export type ReportPeriod = 
  | 'today' 
  | 'yesterday' 
  | 'this_week' 
  | 'last_week' 
  | 'this_month' 
  | 'last_month' 
  | 'custom';

/** Report Typen */
export type ReportType = 'time_summary' | 'shift_overview' | 'member_activity';

/** Zeit-Zusammenfassung Statistiken */
export interface TimeSummaryStats {
  totalMinutes: number;
  totalEntries: number;
  averageMinutesPerDay: number;
  averageMinutesPerEntry: number;
  daysWithEntries: number;
}

/** Zeit-Zusammenfassung pro Mitarbeiter */
export interface MemberTimeSummary {
  memberId: string;
  memberEmail: string;
  memberName: string;
  totalMinutes: number;
  entriesCount: number;
}

/** Zeit-Zusammenfassungs-Report */
export interface TimeSummaryReport {
  type: 'time_summary';
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  stats: TimeSummaryStats;
  byMember: MemberTimeSummary[];
  generatedAt: string;
}

/** Schicht-Übersicht Statistiken */
export interface ShiftOverviewStats {
  totalShifts: number;
  publishedShifts: number;
  assignedShifts: number;
  completedShifts: number;
  cancelledShifts: number;
  averageShiftDuration: number;
}

/** Schicht-Übersichts-Report */
export interface ShiftOverviewReport {
  type: 'shift_overview';
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  stats: ShiftOverviewStats;
  generatedAt: string;
}

/** Mitarbeiter-Aktivität */
export interface MemberActivityStats {
  memberId: string;
  memberEmail: string;
  memberName: string;
  role: string;
  timeEntries: number;
  totalTimeMinutes: number;
  shiftsAssigned: number;
  shiftsCompleted: number;
  lastActivity: string | null;
}

/** Mitarbeiter-Aktivitäts-Report */
export interface MemberActivityReport {
  type: 'member_activity';
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  members: MemberActivityStats[];
  generatedAt: string;
}

/** Dashboard-Widgets Daten */
export interface DashboardWidgets {
  todayStats: {
    totalTimeMinutes: number;
    activeUsers: number;
    runningEntries: number;
  };
  weeklyTrend: Array<{
    date: string;
    totalMinutes: number;
    entriesCount: number;
  }>;
  topMembers: Array<{
    memberId: string;
    memberName: string;
    totalMinutes: number;
  }>;
}

/** API Responses */
export interface DashboardResponse {
  success: boolean;
  data: DashboardWidgets;
}

export interface ReportResponse<T> {
  success: boolean;
  report: T;
}

/**
 * Lädt Dashboard-Widget-Daten.
 */
export function getDashboard(): Promise<DashboardResponse> {
  return apiGet<DashboardResponse>('/api/reports/dashboard');
}

/**
 * Lädt Zeit-Zusammenfassungs-Report.
 */
export function getTimeSummary(
  period: ReportPeriod = 'this_week',
  startDate?: string,
  endDate?: string
): Promise<ReportResponse<TimeSummaryReport>> {
  let url = `/api/reports/time-summary?period=${period}`;
  if (period === 'custom' && startDate && endDate) {
    url += `&startDate=${startDate}&endDate=${endDate}`;
  }
  return apiGet<ReportResponse<TimeSummaryReport>>(url);
}

/**
 * Lädt Schicht-Übersichts-Report.
 */
export function getShiftOverview(
  period: ReportPeriod = 'this_week',
  startDate?: string,
  endDate?: string
): Promise<ReportResponse<ShiftOverviewReport>> {
  let url = `/api/reports/shift-overview?period=${period}`;
  if (period === 'custom' && startDate && endDate) {
    url += `&startDate=${startDate}&endDate=${endDate}`;
  }
  return apiGet<ReportResponse<ShiftOverviewReport>>(url);
}

/**
 * Lädt Mitarbeiter-Aktivitäts-Report.
 */
export function getMemberActivity(
  period: ReportPeriod = 'this_week',
  startDate?: string,
  endDate?: string
): Promise<ReportResponse<MemberActivityReport>> {
  let url = `/api/reports/member-activity?period=${period}`;
  if (period === 'custom' && startDate && endDate) {
    url += `&startDate=${startDate}&endDate=${endDate}`;
  }
  return apiGet<ReportResponse<MemberActivityReport>>(url);
}

/**
 * Generiert einen benutzerdefinierten Report.
 */
export function generateReport(
  type: ReportType,
  period: ReportPeriod,
  startDate?: string,
  endDate?: string
): Promise<ReportResponse<TimeSummaryReport | ShiftOverviewReport | MemberActivityReport>> {
  return apiPost('/api/reports/generate', {
    type,
    period,
    startDate,
    endDate,
  });
}
