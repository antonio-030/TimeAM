/**
 * Modules Core – Public API
 *
 * Error Boundaries und Modul-Registry für das Frontend.
 */

export { ModuleBoundary } from './ModuleBoundary';

// Re-export Module-Registry aus shared
export {
  MODULE_CATEGORY,
  MODULE_REGISTRY,
  type ModuleCategory,
  type ModuleDefinition,
  getCoreModules,
  getOptionalModules,
  getModuleById,
  isCoreModule,
  isModuleActive,
} from '@timeam/shared';
