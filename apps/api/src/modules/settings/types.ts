/**
 * Settings Module Types
 *
 * Types für die Admin-Einstellungen (Modul-Verwaltung).
 */

export interface ModuleStatusItem {
  id: string;
  displayName: string;
  description: string;
  icon: string;
  category: 'core' | 'optional';
  isActive: boolean;
  canToggle: boolean;
}

export interface ModuleStatusResponse {
  modules: ModuleStatusItem[];
}

export interface ToggleModuleRequest {
  moduleId: string;
  enabled: boolean;
}

export interface ToggleModuleResponse {
  success: boolean;
  moduleId: string;
  enabled: boolean;
  message: string;
}
