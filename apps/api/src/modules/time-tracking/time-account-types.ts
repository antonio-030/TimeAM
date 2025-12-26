/**
 * Time Account Types (Backend)
 *
 * Backend-spezifische Types für Firestore-Dokumente.
 */

import type { Timestamp } from 'firebase-admin/firestore';
import type {
  TimeAccountAdjustmentSource,
  TimeAccountAdjustment as SharedTimeAccountAdjustment,
} from '@timeam/shared';

/**
 * Zeitkonto-Anpassung (Firestore-Format).
 */
export interface TimeAccountAdjustmentDoc {
  id: string;
  amountHours: number;
  reason: string;
  adjustedBy: string;
  adjustedAt: Timestamp;
  referenceId?: string;
  source?: TimeAccountAdjustmentSource;
}

/**
 * Zeitkonto-Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/timeAccounts/{userId}_{year}_{month}
 */
export interface TimeAccountDoc {
  userId: string;
  year: number;
  month: number; // 1-12
  targetHours: number;
  actualHours: number;
  timeTrackingHours: number;
  shiftHours: number;
  balanceHours: number;
  manualAdjustments: TimeAccountAdjustmentDoc[];
  complianceAdjustments: TimeAccountAdjustmentDoc[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Zielstunden-Dokument in Firestore.
 * Pfad: /tenants/{tenantId}/timeAccountTargets/{userId}
 */
export interface TimeAccountTargetDoc {
  userId: string;
  monthlyTargetHours: number;
  employmentType?: string; // 'FULL_TIME' | 'PART_TIME' | 'CUSTOM'
  weeklyHours?: number;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Konvertiert Firestore TimeAccountAdjustmentDoc zu Shared Type.
 */
export function adjustmentToResponse(
  doc: TimeAccountAdjustmentDoc
): SharedTimeAccountAdjustment {
  return {
    id: doc.id,
    amountHours: doc.amountHours,
    reason: doc.reason,
    adjustedBy: doc.adjustedBy,
    adjustedAt: doc.adjustedAt.toDate().toISOString(),
    referenceId: doc.referenceId,
    source: doc.source,
  };
}

