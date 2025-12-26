/**
 * Time Tracking Module – Public API
 */

export { timeTrackingRouter } from './routes.js';

export {
  TIME_ENTRY_STATUS,
  type TimeEntryStatus,
  type TimeEntryDoc,
  type TimeEntryResponse,
  type ClockInRequest,
  type ClockOutRequest,
} from './types.js';

export {
  clockIn,
  clockOut,
  getMyTimeEntries,
  getTodayStats,
  getRunningEntry,
} from './service.js';

export {
  getTimeAccount,
  getTimeAccountHistory,
  updateTimeAccountTarget,
  addManualAdjustment,
  addComplianceAdjustment,
  calculateTimeAccount,
  exportTimeAccountData,
} from './time-account-service.js';

export type {
  TimeAccountDoc,
  TimeAccountTargetDoc,
  TimeAccountAdjustmentDoc,
} from './time-account-types.js';


