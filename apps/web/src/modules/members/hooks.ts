/**
 * Members Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import type { Member, MemberStats, InviteMemberRequest, UpdateMemberRequest } from '@timeam/shared';
import {
  getMembers as apiGetMembers,
  getMemberShifts as apiGetMemberShifts,
  inviteMember as apiInviteMember,
  updateMember as apiUpdateMember,
  deleteMember as apiDeleteMember,
  activateMember as apiActivateMember,
  deactivateMember as apiDeactivateMember,
  type MemberShift,
} from './api';

/**
 * Hook für Mitarbeiter-Liste.
 */
export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiGetMembers();
      setMembers(data.members);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const inviteMember = useCallback(
    async (data: InviteMemberRequest): Promise<{ member: Member; passwordResetLink?: string }> => {
      setError(null);

      try {
        const result = await apiInviteMember(data);
        await refresh();
        return { member: result.member, passwordResetLink: result.passwordResetLink };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Einladen';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const updateMember = useCallback(
    async (memberId: string, data: UpdateMemberRequest) => {
      setError(null);

      try {
        const result = await apiUpdateMember(memberId, data);
        await refresh();
        return result.member;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const deleteMember = useCallback(
    async (memberId: string) => {
      setError(null);

      try {
        await apiDeleteMember(memberId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Löschen';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const activateMember = useCallback(
    async (memberId: string) => {
      setError(null);

      try {
        const result = await apiActivateMember(memberId);
        await refresh();
        return result.member;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Aktivieren';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  const deactivateMember = useCallback(
    async (memberId: string) => {
      setError(null);

      try {
        const result = await apiDeactivateMember(memberId);
        await refresh();
        return result.member;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Deaktivieren';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  return {
    members,
    stats,
    loading,
    error,
    refresh,
    inviteMember,
    updateMember,
    deleteMember,
    activateMember,
    deactivateMember,
  };
}

/**
 * Hook für Mitarbeiter-Schichten.
 */
export function useMemberShifts(memberId: string | null) {
  const [shifts, setShifts] = useState<MemberShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeCompleted, setIncludeCompleted] = useState(false);

  const refresh = useCallback(async () => {
    if (!memberId) {
      setShifts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiGetMemberShifts(memberId, { includeCompleted });
      setShifts(data.shifts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Schichten');
    } finally {
      setLoading(false);
    }
  }, [memberId, includeCompleted]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    shifts,
    loading,
    error,
    includeCompleted,
    setIncludeCompleted,
    refresh,
  };
}
