/**
 * Dashboard Module - Public API
 */

export { DashboardPage } from './DashboardPage';
export type { DashboardPageProps } from './DashboardPage';
export { 
  useDashboard, 
  formatDuration, 
  formatTime, 
  formatRelativeDate,
  formatShiftTime,
} from './hooks';
export type {
  TimeTrackingStatus,
  TeamMemberStatus,
  DashboardStats,
  DashboardShift,
} from './api';
