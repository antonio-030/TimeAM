/**
 * Module Registry Types (Shared)
 *
 * Definiert Core- und optionale Module für das SaaS-System.
 * Core-Module laufen immer, optionale können pro Tenant aktiviert werden.
 */

import type { EntitlementKey } from './entitlements.js';

/**
 * Modul-Kategorie
 */
export const MODULE_CATEGORY = {
  CORE: 'core',        // Immer aktiv, kann nicht deaktiviert werden
  OPTIONAL: 'optional', // Kann pro Tenant aktiviert/deaktiviert werden
} as const;

export type ModuleCategory = (typeof MODULE_CATEGORY)[keyof typeof MODULE_CATEGORY];

/**
 * Modul-Definition
 */
export interface ModuleDefinition {
  /** Eindeutige Modul-ID */
  id: string;
  
  /** Anzeigename */
  displayName: string;
  
  /** Kurzbeschreibung */
  description: string;
  
  /** Icon (Emoji oder Icon-Name) */
  icon: string;
  
  /** Kategorie: core oder optional */
  category: ModuleCategory;
  
  /** Entitlement-Key für dieses Modul (nur bei optional) */
  entitlementKey?: EntitlementKey;
  
  /** Abhängigkeiten zu anderen Modulen */
  dependencies?: string[];
}

/**
 * Alle definierten Module.
 * Core-Module haben kein entitlementKey, da sie immer aktiv sind.
 */
export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  // ===========================================================================
  // CORE MODULES - Immer aktiv, können nicht deaktiviert werden
  // ===========================================================================
  
  'dashboard': {
    id: 'dashboard',
    displayName: 'Dashboard',
    description: 'Übersichtsseite mit wichtigen Kennzahlen',
    icon: '📊',
    category: MODULE_CATEGORY.CORE,
  },
  
  'calendar-core': {
    id: 'calendar-core',
    displayName: 'Kalender',
    description: 'Zentraler Kalender für alle Termine und Events',
    icon: '📅',
    category: MODULE_CATEGORY.CORE,
  },
  
  'members': {
    id: 'members',
    displayName: 'Mitarbeiter',
    description: 'Mitarbeiterverwaltung und Einladungen',
    icon: '👥',
    category: MODULE_CATEGORY.CORE,
  },
  
  'notifications': {
    id: 'notifications',
    displayName: 'Benachrichtigungen',
    description: 'System-Benachrichtigungen',
    icon: '🔔',
    category: MODULE_CATEGORY.CORE,
  },

  'support': {
    id: 'support',
    displayName: 'Support',
    description: 'Verifizierungen prüfen und verwalten',
    icon: '🛠️',
    category: MODULE_CATEGORY.CORE,
  },
  
  // ===========================================================================
  // OPTIONAL MODULES - Können pro Tenant aktiviert/deaktiviert werden
  // ===========================================================================
  
  'time-tracking': {
    id: 'time-tracking',
    displayName: 'Zeiterfassung',
    description: 'Clock In/Out, Stundenkonto und Timesheets',
    icon: '⏰',
    category: MODULE_CATEGORY.OPTIONAL,
    entitlementKey: 'module.time_tracking',
  },
  
  'shift-pool': {
    id: 'shift-pool',
    displayName: 'Schichtplanung',
    description: 'Schichten erstellen, veröffentlichen und bewerben',
    icon: '📋',
    category: MODULE_CATEGORY.OPTIONAL,
    entitlementKey: 'module.shift_pool',
  },
  
  'reports': {
    id: 'reports',
    displayName: 'Berichte & Analytics',
    description: 'Auswertungen, Statistiken und Export-Funktionen',
    icon: '📈',
    category: MODULE_CATEGORY.OPTIONAL,
    entitlementKey: 'module.reports',
  },

  // ===========================================================================
  // FREELANCER MODULES - Für Freelancer-Accounts
  // ===========================================================================

  'freelancer-dashboard': {
    id: 'freelancer-dashboard',
    displayName: 'Dashboard',
    description: 'Übersicht für Freelancer mit Bewerbungen und Statistiken',
    icon: '📊',
    category: MODULE_CATEGORY.CORE,
  },

  'freelancer-calendar': {
    id: 'freelancer-calendar',
    displayName: 'Kalender',
    description: 'Kalender für Freelancer-Schichten und Termine',
    icon: '📅',
    category: MODULE_CATEGORY.CORE,
    dependencies: ['calendar-core'],
  },

  'freelancer-my-shifts': {
    id: 'freelancer-my-shifts',
    displayName: 'Meine Schichten',
    description: 'Übersicht aller angenommenen Schichten',
    icon: '✅',
    category: MODULE_CATEGORY.CORE,
  },

  'freelancer-pool': {
    id: 'freelancer-pool',
    displayName: 'Security Freelancer Pool',
    description: 'Freelancer-Pool für Sicherheitsfirmen - Öffentliche Schichten ausschreiben und Freelancer-Bewerbungen prüfen',
    icon: '🔒',
    category: MODULE_CATEGORY.CORE,
  },
} as const;

/**
 * Hilfsfunktionen
 */

/**
 * Gibt alle Core-Module zurück.
 */
export function getCoreModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter(m => m.category === MODULE_CATEGORY.CORE);
}

/**
 * Gibt alle optionalen Module zurück.
 */
export function getOptionalModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter(m => m.category === MODULE_CATEGORY.OPTIONAL);
}

/**
 * Gibt ein Modul nach ID zurück.
 */
export function getModuleById(id: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY[id];
}

/**
 * Prüft, ob ein Modul ein Core-Modul ist.
 */
export function isCoreModule(moduleId: string): boolean {
  const module = MODULE_REGISTRY[moduleId];
  return module?.category === MODULE_CATEGORY.CORE;
}

/**
 * Prüft, ob ein optionales Modul aktiv ist (basierend auf Entitlements).
 */
export function isModuleActive(
  moduleId: string,
  entitlements: Record<string, boolean | string | number>
): boolean {
  const module = MODULE_REGISTRY[moduleId];
  
  if (!module) return false;
  
  // Core-Module sind immer aktiv
  if (module.category === MODULE_CATEGORY.CORE) {
    return true;
  }
  
  // Optional: Prüfe Entitlement
  if (module.entitlementKey) {
    const value = entitlements[module.entitlementKey];
    return value === true || 
      (typeof value === 'string' && value !== '') || 
      (typeof value === 'number' && value > 0);
  }
  
  return false;
}

/**
 * API Response für Modul-Status.
 */
export interface ModuleStatusResponse {
  modules: Array<{
    id: string;
    displayName: string;
    description: string;
    icon: string;
    category: ModuleCategory;
    isActive: boolean;
    canToggle: boolean; // false für Core-Module
  }>;
}

/**
 * Request zum Aktivieren/Deaktivieren eines Moduls.
 */
export interface ToggleModuleRequest {
  moduleId: string;
  enabled: boolean;
}
