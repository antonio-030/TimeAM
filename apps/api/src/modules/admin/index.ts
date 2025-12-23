/**
 * Admin Module
 *
 * Super-Admin / Developer Dashboard API.
 */

export { adminRouter } from './routes';
export type {
  TenantOverview,
  TenantsListResponse,
  TenantDetail,
  TenantMemberInfo,
  TenantModuleStatus,
  ToggleTenantModuleRequest,
  ToggleTenantModuleResponse,
} from './types';
