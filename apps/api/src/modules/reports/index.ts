/**
 * Reports & Analytics Module – Public API
 */

export { reportsRouter } from './routes';

export {
  REPORT_PERIOD,
  REPORT_TYPE,
  type ReportPeriod,
  type ReportType,
  type ReportRequest,
  type TimeSummaryReport,
  type ShiftOverviewReport,
  type MemberActivityReport,
  type DashboardWidgets,
} from './types';

export {
  generateTimeSummaryReport,
  generateShiftOverviewReport,
  generateMemberActivityReport,
  getDashboardWidgets,
} from './service';
