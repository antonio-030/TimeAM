/**
 * Rule Engine Core
 *
 * Zentrale Logik für Compliance-Regel-Prüfung.
 */

import type {
  RuleConfig,
  ViolationType,
  ViolationSeverity,
} from '@timeam/shared';
import {
  VIOLATION_TYPE,
  VIOLATION_SEVERITY,
} from '@timeam/shared';

/**
 * Zeit-Intervall für Compliance-Prüfung.
 */
export interface TimeInterval {
  start: Date;
  end: Date;
}

/**
 * Time Entry für Compliance-Prüfung.
 */
export interface ComplianceTimeEntry {
  id: string;
  userId: string;
  clockIn: Date;
  clockOut: Date | null;
  durationMinutes: number | null;
}

/**
 * Erkannte Verstoß-Details.
 */
export interface DetectedViolation {
  violationType: ViolationType;
  severity: ViolationSeverity;
  periodStart: Date;
  periodEnd: Date;
  details: {
    expected: string;
    actual: string;
    affectedEntries: string[];
  };
}

/**
 * Prüft tägliche Ruhezeit (11 Stunden).
 */
export function checkDailyRestPeriod(
  entries: ComplianceTimeEntry[],
  config: RuleConfig
): DetectedViolation[] {
  const violations: DetectedViolation[] = [];

  // Sortiere Einträge nach Clock-In Zeit
  const sortedEntries = [...entries].sort(
    (a, b) => a.clockIn.getTime() - b.clockIn.getTime()
  );

  for (let i = 1; i < sortedEntries.length; i++) {
    const prevEntry = sortedEntries[i - 1];
    const currentEntry = sortedEntries[i];

    // Nur prüfen wenn vorheriger Eintrag beendet wurde
    if (!prevEntry.clockOut) {
      continue;
    }

    const restPeriodMinutes =
      (currentEntry.clockIn.getTime() - prevEntry.clockOut.getTime()) / (1000 * 60);

    if (restPeriodMinutes < config.dailyRestPeriodMinutes) {
      violations.push({
        violationType: VIOLATION_TYPE.REST_PERIOD_VIOLATION,
        severity: VIOLATION_SEVERITY.ERROR,
        periodStart: prevEntry.clockOut,
        periodEnd: currentEntry.clockIn,
        details: {
          expected: `${config.dailyRestPeriodMinutes / 60} Stunden`,
          actual: `${Math.round(restPeriodMinutes / 60 * 10) / 10} Stunden`,
          affectedEntries: [prevEntry.id, currentEntry.id],
        },
      });
    }
  }

  return violations;
}

/**
 * Prüft Schichtdauer (max. 8/10 Stunden).
 */
export function checkShiftDuration(
  entries: ComplianceTimeEntry[],
  config: RuleConfig
): DetectedViolation[] {
  const violations: DetectedViolation[] = [];

  for (const entry of entries) {
    if (!entry.clockOut || !entry.durationMinutes) {
      continue;
    }

    const durationHours = entry.durationMinutes / 60;

    // Prüfe maximale tägliche Arbeitszeit
    if (durationHours > config.maxDailyWorkingTimeWithCompensationMinutes / 60) {
      violations.push({
        violationType: VIOLATION_TYPE.SHIFT_DURATION_VIOLATION,
        severity: VIOLATION_SEVERITY.ERROR,
        periodStart: entry.clockIn,
        periodEnd: entry.clockOut,
        details: {
          expected: `Max. ${config.maxDailyWorkingTimeWithCompensationMinutes / 60} Stunden`,
          actual: `${Math.round(durationHours * 10) / 10} Stunden`,
          affectedEntries: [entry.id],
        },
      });
    } else if (durationHours > config.maxDailyWorkingTimeMinutes / 60) {
      violations.push({
        violationType: VIOLATION_TYPE.SHIFT_DURATION_VIOLATION,
        severity: VIOLATION_SEVERITY.WARNING,
        periodStart: entry.clockIn,
        periodEnd: entry.clockOut,
        details: {
          expected: `Max. ${config.maxDailyWorkingTimeMinutes / 60} Stunden (ohne Ausgleich)`,
          actual: `${Math.round(durationHours * 10) / 10} Stunden`,
          affectedEntries: [entry.id],
        },
      });
    }
  }

  return violations;
}

/**
 * Prüft Pausenregelungen.
 */
export function checkBreaks(
  entries: ComplianceTimeEntry[],
  config: RuleConfig
): DetectedViolation[] {
  const violations: DetectedViolation[] = [];

  for (const entry of entries) {
    if (!entry.clockOut || !entry.durationMinutes) {
      continue;
    }

    const durationHours = entry.durationMinutes / 60;

    // Prüfe erste Pausenregel (6+ Stunden = 30 Min Pause)
    if (durationHours >= config.breakRequiredAfterMinutes / 60) {
      // Annahme: Pause wird nicht erfasst, daher Warnung
      // In einer vollständigen Implementierung würde man Pausen-Einträge prüfen
      violations.push({
        violationType: VIOLATION_TYPE.BREAK_MISSING,
        severity: VIOLATION_SEVERITY.WARNING,
        periodStart: entry.clockIn,
        periodEnd: entry.clockOut,
        details: {
          expected: `${config.breakDurationMinutes} Minuten Pause erforderlich`,
          actual: 'Keine Pause erfasst',
          affectedEntries: [entry.id],
        },
      });
    }

    // Prüfe zweite Pausenregel (9+ Stunden = 45 Min Pause)
    if (
      config.breakRequiredAfterMinutes2 &&
      durationHours >= config.breakRequiredAfterMinutes2 / 60
    ) {
      violations.push({
        violationType: VIOLATION_TYPE.BREAK_MISSING,
        severity: VIOLATION_SEVERITY.ERROR,
        periodStart: entry.clockIn,
        periodEnd: entry.clockOut,
        details: {
          expected: `${config.breakDurationMinutes2} Minuten Pause erforderlich`,
          actual: 'Keine ausreichende Pause erfasst',
          affectedEntries: [entry.id],
        },
      });
    }
  }

  return violations;
}

/**
 * Prüft wöchentliche Ruhezeit (24 Stunden).
 */
export function checkWeeklyRestPeriod(
  entries: ComplianceTimeEntry[],
  config: RuleConfig
): DetectedViolation[] {
  const violations: DetectedViolation[] = [];

  // Gruppiere Einträge nach Woche
  const weeklyGroups = new Map<string, ComplianceTimeEntry[]>();

  for (const entry of entries) {
    if (!entry.clockOut) {
      continue;
    }

    // Berechne Woche (ISO-Woche)
    const weekKey = getWeekKey(entry.clockIn);

    if (!weeklyGroups.has(weekKey)) {
      weeklyGroups.set(weekKey, []);
    }

    weeklyGroups.get(weekKey)!.push(entry);
  }

  // Prüfe jede Woche
  for (const [weekKey, weekEntries] of weeklyGroups) {
    const sortedEntries = [...weekEntries].sort(
      (a, b) => a.clockIn.getTime() - b.clockIn.getTime()
    );

    // Finde längste Pause zwischen Einträgen
    let maxRestPeriod = 0;
    let restPeriodStart: Date | null = null;
    let restPeriodEnd: Date | null = null;

    for (let i = 1; i < sortedEntries.length; i++) {
      const prevEntry = sortedEntries[i - 1];
      const currentEntry = sortedEntries[i];

      if (!prevEntry.clockOut) {
        continue;
      }

      const restPeriodMinutes =
        (currentEntry.clockIn.getTime() - prevEntry.clockOut.getTime()) / (1000 * 60);

      if (restPeriodMinutes > maxRestPeriod) {
        maxRestPeriod = restPeriodMinutes;
        restPeriodStart = prevEntry.clockOut;
        restPeriodEnd = currentEntry.clockIn;
      }
    }

    // Prüfe ob wöchentliche Ruhezeit eingehalten wurde
    if (maxRestPeriod < config.weeklyRestPeriodMinutes && sortedEntries.length > 1) {
      violations.push({
        violationType: VIOLATION_TYPE.WEEKLY_REST_VIOLATION,
        severity: VIOLATION_SEVERITY.ERROR,
        periodStart: restPeriodStart || sortedEntries[0].clockIn,
        periodEnd: restPeriodEnd || sortedEntries[sortedEntries.length - 1].clockOut!,
        details: {
          expected: `${config.weeklyRestPeriodMinutes / 60} Stunden wöchentliche Ruhezeit`,
          actual: `${Math.round(maxRestPeriod / 60 * 10) / 10} Stunden`,
          affectedEntries: sortedEntries.map((e) => e.id),
        },
      });
    }
  }

  return violations;
}

/**
 * Prüft maximale wöchentliche Arbeitszeit.
 */
export function checkMaxWeeklyWorkingTime(
  entries: ComplianceTimeEntry[],
  config: RuleConfig
): DetectedViolation[] {
  const violations: DetectedViolation[] = [];

  // Gruppiere Einträge nach Woche
  const weeklyGroups = new Map<string, ComplianceTimeEntry[]>();

  for (const entry of entries) {
    if (!entry.clockOut || !entry.durationMinutes) {
      continue;
    }

    const weekKey = getWeekKey(entry.clockIn);

    if (!weeklyGroups.has(weekKey)) {
      weeklyGroups.set(weekKey, []);
    }

    weeklyGroups.get(weekKey)!.push(entry);
  }

  // Prüfe jede Woche
  for (const [weekKey, weekEntries] of weeklyGroups) {
    const totalMinutes = weekEntries.reduce(
      (sum, entry) => sum + (entry.durationMinutes || 0),
      0
    );

    if (totalMinutes > config.maxWeeklyWorkingTimeMinutes) {
      const weekStart = weekEntries[0].clockIn;
      const weekEnd = weekEntries[weekEntries.length - 1].clockOut!;

      violations.push({
        violationType: VIOLATION_TYPE.MAX_WORKING_TIME_EXCEEDED,
        severity: VIOLATION_SEVERITY.ERROR,
        periodStart: weekStart,
        periodEnd: weekEnd,
        details: {
          expected: `Max. ${config.maxWeeklyWorkingTimeMinutes / 60} Stunden pro Woche`,
          actual: `${Math.round(totalMinutes / 60 * 10) / 10} Stunden`,
          affectedEntries: weekEntries.map((e) => e.id),
        },
      });
    }
  }

  return violations;
}

/**
 * Führt alle Compliance-Prüfungen durch.
 */
export function checkComplianceRules(
  entries: ComplianceTimeEntry[],
  config: RuleConfig
): DetectedViolation[] {
  const violations: DetectedViolation[] = [];

  // Alle Prüfungen durchführen
  violations.push(...checkDailyRestPeriod(entries, config));
  violations.push(...checkShiftDuration(entries, config));
  violations.push(...checkBreaks(entries, config));
  violations.push(...checkWeeklyRestPeriod(entries, config));
  violations.push(...checkMaxWeeklyWorkingTime(entries, config));

  return violations;
}

/**
 * Hilfsfunktion: Berechnet Wochenschlüssel (ISO-Woche).
 */
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

