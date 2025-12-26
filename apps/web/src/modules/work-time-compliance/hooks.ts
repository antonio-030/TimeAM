/**
 * Work Time Compliance Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getStats,
  getViolations,
  getViolation,
  acknowledgeViolation as apiAcknowledgeViolation,
  getRules,
  updateRules as apiUpdateRules,
  checkCompliance as apiCheckCompliance,
  generateReport as apiGenerateReport,
  getReport,
  getAuditLogs,
  type ComplianceStats,
  type ComplianceViolation,
  type ComplianceRule,
  type ComplianceReport,
  type ComplianceAuditLog,
  type UpdateRuleSetRequest,
  type CheckComplianceRequest,
  type GenerateReportRequest,
} from './api';

/**
 * Hook für Compliance-Statistiken.
 */
export function useComplianceStats() {
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    stats,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook für Verstöße.
 */
export function useViolations(params?: {
  userId?: string;
  violationType?: string;
  severity?: 'warning' | 'error';
  acknowledged?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  const [violations, setViolations] = useState<ComplianceViolation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getViolations(params);
      setViolations(data.violations);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [params?.userId, params?.violationType, params?.severity, params?.acknowledged, params?.from, params?.to, params?.limit, params?.offset]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const acknowledge = useCallback(async (violationId: string, acknowledged: boolean) => {
    setError(null);
    try {
      await apiAcknowledgeViolation(violationId, acknowledged);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Bestätigen';
      setError(message);
      throw err;
    }
  }, [refresh]);

  return {
    violations,
    total,
    loading,
    error,
    refresh,
    acknowledge,
  };
}

/**
 * Hook für Compliance-Regeln.
 */
export function useComplianceRules() {
  const [rule, setRule] = useState<ComplianceRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getRules();
      setRule(data.rule);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(async (data: UpdateRuleSetRequest) => {
    setError(null);
    try {
      const result = await apiUpdateRules(data);
      setRule(result.rule);
      return result.rule;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren';
      setError(message);
      throw err;
    }
  }, []);

  return {
    rule,
    loading,
    error,
    refresh,
    update,
  };
}

/**
 * Hook für Compliance-Prüfung.
 */
export function useComplianceCheck() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (data: CheckComplianceRequest) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCheckCompliance(data);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der Prüfung';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    check,
  };
}

/**
 * Hook für Report-Generierung.
 */
export function useReportGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (data: GenerateReportRequest) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiGenerateReport(data);
      return result.report;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der Report-Generierung';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    generate,
  };
}

/**
 * Hook für Audit-Logs.
 */
export function useAuditLogs(params?: {
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  const [logs, setLogs] = useState<ComplianceAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAuditLogs(params);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [params?.action, params?.from, params?.to, params?.limit, params?.offset]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    logs,
    total,
    loading,
    error,
    refresh,
  };
}

