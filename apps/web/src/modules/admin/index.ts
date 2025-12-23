/**
 * Admin Module – Public API
 *
 * Super-Admin / Developer Dashboard.
 */

export { AdminDashboard } from './AdminDashboard';
export { useSuperAdminCheck, useAllTenants, useTenantDetail } from './hooks';
export type {
  TenantOverview,
  TenantDetail,
  TenantModuleStatus,
  TenantMemberInfo,
} from './api';
