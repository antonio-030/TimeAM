/**
 * Shift Pool Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import type { Shift, PoolShift, AdminShift, Application, PoolQueryParams } from '@timeam/shared';
import {
  getPool,
  getShiftDetail,
  applyToShift as apiApply,
  withdrawMyApplication as apiWithdraw,
  getAdminShifts,
  getShiftApplications,
  createShift as apiCreateShift,
  updateShift as apiUpdateShift,
  deleteShift as apiDeleteShift,
  publishShift as apiPublishShift,
  closeShift as apiCloseShift,
  cancelShift as apiCancelShift,
  acceptApplication as apiAcceptApplication,
  rejectApplication as apiRejectApplication,
  unrejectApplication as apiUnrejectApplication,
  revokeApplication as apiRevokeApplication,
  getMyShifts,
  getShiftTimeEntries,
  createShiftTimeEntry as apiCreateShiftTimeEntry,
  updateShiftTimeEntry as apiUpdateShiftTimeEntry,
  getShiftDocuments,
  uploadShiftDocument as apiUploadShiftDocument,
  downloadShiftDocument as apiDownloadShiftDocument,
  type MyShift,
} from './api';
import type {
  CreateShiftRequest,
  ShiftTimeEntry,
  CreateShiftTimeEntryRequest,
  UpdateShiftTimeEntryRequest,
  ShiftDocument,
} from '@timeam/shared';

// =============================================================================
// User Hooks
// =============================================================================

/**
 * Hook für Pool-Liste.
 */
export function usePool(initialParams: PoolQueryParams = {}) {
  const [shifts, setShifts] = useState<PoolShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<PoolQueryParams>(initialParams);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getPool(params);
      setShifts(data.shifts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateParams = useCallback((newParams: Partial<PoolQueryParams>) => {
    setParams((prev) => ({ ...prev, ...newParams }));
  }, []);

  return {
    shifts,
    loading,
    error,
    refresh,
    params,
    updateParams,
  };
}

/**
 * Hook für Schicht-Details.
 */
export function useShiftDetail(shiftId: string | null) {
  const [shift, setShift] = useState<PoolShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shiftId) {
      setShift(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getShiftDetail(shiftId);
      setShift(data.shift);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const apply = useCallback(
    async (note?: string) => {
      if (!shiftId) return;
      setError(null);

      try {
        await apiApply(shiftId, { note });
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Bewerben';
        setError(message);
        throw err;
      }
    },
    [shiftId, refresh]
  );

  const withdraw = useCallback(
    async () => {
      if (!shiftId) return;
      setError(null);

      try {
        await apiWithdraw(shiftId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Zurückziehen';
        setError(message);
        throw err;
      }
    },
    [shiftId, refresh]
  );

  return {
    shift,
    loading,
    error,
    refresh,
    apply,
    withdraw,
  };
}

// =============================================================================
// Admin Hooks
// =============================================================================

/**
 * Hook für Admin Schicht-Liste.
 */
export function useAdminShifts() {
  const [shifts, setShifts] = useState<AdminShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAdminShifts();
      setShifts(data.shifts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createShift = useCallback(
    async (data: CreateShiftRequest) => {
      setError(null);

      try {
        const result = await apiCreateShift(data);
        await refresh();
        return result.shift;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Erstellen';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const updateShift = useCallback(
    async (shiftId: string, data: Partial<CreateShiftRequest>) => {
      setError(null);

      try {
        const result = await apiUpdateShift(shiftId, data);
        await refresh();
        return result.shift;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const deleteShift = useCallback(
    async (shiftId: string) => {
      setError(null);

      try {
        await apiDeleteShift(shiftId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Löschen';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const publishShift = useCallback(
    async (shiftId: string) => {
      setError(null);

      try {
        await apiPublishShift(shiftId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Veröffentlichen';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const closeShift = useCallback(
    async (shiftId: string) => {
      setError(null);

      try {
        await apiCloseShift(shiftId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Schließen';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const cancelShift = useCallback(
    async (shiftId: string) => {
      setError(null);

      try {
        await apiCancelShift(shiftId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Absagen';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  return {
    shifts,
    loading,
    error,
    refresh,
    createShift,
    updateShift,
    deleteShift,
    publishShift,
    closeShift,
    cancelShift,
  };
}

/**
 * Hook für Bewerbungen einer Schicht.
 */
export function useShiftApplications(shiftId: string | null) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shiftId) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getShiftApplications(shiftId);
      setApplications(data.applications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const acceptApplication = useCallback(
    async (applicationId: string) => {
      setError(null);

      try {
        await apiAcceptApplication(applicationId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Akzeptieren';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const rejectApplication = useCallback(
    async (applicationId: string) => {
      setError(null);

      try {
        await apiRejectApplication(applicationId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Ablehnen';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const unrejectApplication = useCallback(
    async (applicationId: string) => {
      setError(null);

      try {
        await apiUnrejectApplication(applicationId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Zurückziehen der Ablehnung';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const revokeApplication = useCallback(
    async (applicationId: string) => {
      setError(null);

      try {
        await apiRevokeApplication(applicationId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Rückgängigmachen';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  return {
    applications,
    loading,
    error,
    refresh,
    acceptApplication,
    rejectApplication,
    unrejectApplication,
    revokeApplication,
  };
}

// =============================================================================
// Meine Schichten Hook
// =============================================================================

/**
 * Hook für "Meine Schichten".
 */
export function useMyShifts(options: { includeCompleted?: boolean } = {}) {
  const [shifts, setShifts] = useState<MyShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getMyShifts(options);
      setShifts(data.shifts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [options.includeCompleted]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    shifts,
    loading,
    error,
    refresh,
  };
}

// =============================================================================
// Schicht-Zuweisungen Hook (Admin)
// =============================================================================

import {
  getShiftAssignments,
  assignMemberToShift as apiAssignMember,
  removeAssignment as apiRemoveAssignment,
  type ShiftAssignment,
} from './api';

/**
 * Hook für Schicht-Zuweisungen (Admin).
 */
export function useShiftAssignments(shiftId: string | null) {
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shiftId) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getShiftAssignments(shiftId);
      setAssignments(data.assignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const assignMember = useCallback(
    async (memberUid: string) => {
      if (!shiftId) return;
      setError(null);

      try {
        await apiAssignMember(shiftId, memberUid);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Zuweisen';
        setError(message);
        throw err;
      }
    },
    [shiftId, refresh]
  );

  const removeAssignment = useCallback(
    async (assignmentId: string) => {
      setError(null);

      try {
        await apiRemoveAssignment(assignmentId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Entfernen';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  return {
    assignments,
    loading,
    error,
    refresh,
    assignMember,
    removeAssignment,
  };
}

// =============================================================================
// Shift Time Entries Hooks
// =============================================================================

/**
 * Hook für Zeiteinträge einer Schicht.
 */
export function useShiftTimeEntries(shiftId: string | null) {
  const [entries, setEntries] = useState<ShiftTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shiftId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getShiftTimeEntries(shiftId);
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createEntry = useCallback(
    async (data: CreateShiftTimeEntryRequest) => {
      if (!shiftId) return;
      setError(null);

      try {
        await apiCreateShiftTimeEntry(shiftId, data);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Erstellen';
        setError(message);
        throw err;
      }
    },
    [shiftId, refresh]
  );

  const updateEntry = useCallback(
    async (entryId: string, data: UpdateShiftTimeEntryRequest) => {
      if (!shiftId) return;
      setError(null);

      try {
        await apiUpdateShiftTimeEntry(shiftId, entryId, data);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren';
        setError(message);
        throw err;
      }
    },
    [shiftId, refresh]
  );

  return {
    entries,
    loading,
    error,
    refresh,
    createEntry,
    updateEntry,
  };
}

// =============================================================================
// Shift Documents Hooks
// =============================================================================

/**
 * Hook für Dokumente einer Schicht.
 */
export function useShiftDocuments(shiftId: string | null) {
  const [documents, setDocuments] = useState<ShiftDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shiftId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getShiftDocuments(shiftId);
      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadDocument = useCallback(
    async (file: File) => {
      if (!shiftId) return;
      setError(null);

      try {
        await apiUploadShiftDocument(shiftId, file);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Hochladen';
        setError(message);
        throw err;
      }
    },
    [shiftId, refresh]
  );

  const downloadDocument = useCallback(
    async (documentId: string) => {
      if (!shiftId) return;

      try {
        const result = await apiDownloadShiftDocument(shiftId, documentId);
        window.open(result.downloadUrl, '_blank');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Download';
        throw new Error(message);
      }
    },
    [shiftId]
  );

  const deleteDocument = useCallback(
    async (documentId: string) => {
      if (!shiftId) return;
      setError(null);

      try {
        await apiDeleteShiftDocument(shiftId, documentId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Löschen';
        setError(message);
        throw err;
      }
    },
    [shiftId, refresh]
  );

  return {
    documents,
    loading,
    error,
    refresh,
    uploadDocument,
    downloadDocument,
    deleteDocument,
  };
}
