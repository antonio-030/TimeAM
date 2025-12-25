/**
 * Reports & Analytics Module – Public API
 */

export { reportsRouter } from './routes.js';

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
} from './types.js';

export {
  generateTimeSummaryReport,
  generateShiftOverviewReport,
  generateMemberActivityReport,
  getDashboardWidgets,
} from './service.js';
