/**
 * Reports & Analytics Types
 */

/**
 * Report-Zeitraum
 */
export const REPORT_PERIOD = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  THIS_WEEK: 'this_week',
  LAST_WEEK: 'last_week',
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  CUSTOM: 'custom',
} as const;

export type ReportPeriod = (typeof REPORT_PERIOD)[keyof typeof REPORT_PERIOD];

/**
 * Report-Typ
 */
export const REPORT_TYPE = {
  TIME_SUMMARY: 'time_summary',
  SHIFT_OVERVIEW: 'shift_overview',
  MEMBER_ACTIVITY: 'member_activity',
} as const;

export type ReportType = (typeof REPORT_TYPE)[keyof typeof REPORT_TYPE];

/**
 * Request für Report-Generierung
 */
export interface ReportRequest {
  type: ReportType;
  period: ReportPeriod;
  startDate?: string; // ISO string, nur bei CUSTOM
  endDate?: string;   // ISO string, nur bei CUSTOM
  memberId?: string;  // Optional: Filtern nach Mitarbeiter
}

/**
 * Zeit-Zusammenfassung Statistiken
 */
export interface TimeSummaryStats {
  totalMinutes: number;
  totalEntries: number;
  averageMinutesPerDay: number;
  averageMinutesPerEntry: number;
  daysWithEntries: number;
}

/**
 * Zeit-Zusammenfassung pro Mitarbeiter
 */
export interface MemberTimeSummary {
  memberId: string;
  memberEmail: string;
  memberName: string;
  totalMinutes: number;
  entriesCount: number;
}

/**
 * Schicht-Übersicht Statistiken
 */
export interface ShiftOverviewStats {
  totalShifts: number;
  publishedShifts: number;
  assignedShifts: number;
  completedShifts: number;
  cancelledShifts: number;
  averageShiftDuration: number;
}

/**
 * Mitarbeiter-Aktivität
 */
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

/**
 * Report Response für Zeit-Zusammenfassung
 */
export interface TimeSummaryReport {
  type: 'time_summary';
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  stats: TimeSummaryStats;
  byMember: MemberTimeSummary[];
  generatedAt: string;
}

/**
 * Report Response für Schicht-Übersicht
 */
export interface ShiftOverviewReport {
  type: 'shift_overview';
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  stats: ShiftOverviewStats;
  generatedAt: string;
}

/**
 * Report Response für Mitarbeiter-Aktivität
 */
export interface MemberActivityReport {
  type: 'member_activity';
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  members: MemberActivityStats[];
  generatedAt: string;
}

/**
 * Dashboard-Widgets Daten
 */
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
