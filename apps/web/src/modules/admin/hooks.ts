/**
 * Admin Hooks
 *
 * React Hooks für das Super-Admin / Developer Dashboard.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../core/auth';
import {
  checkSuperAdmin,
  fetchAllTenants,
  fetchTenantDetail,
  toggleTenantModule,
  type TenantOverview,
  type TenantDetail,
} from './api';

/**
 * Hook: Super-Admin-Status prüfen
 * 
 * Wartet auf vollständige Authentifizierung, bevor der Check ausgeführt wird.
 */
export function useSuperAdminCheck() {
  const { user, loading: authLoading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stabiler User-ID Wert für Dependencies
  const userId = user?.uid ?? null;

  useEffect(() => {
    // Warten bis Auth geladen ist
    if (authLoading) {
      return;
    }

    // Kein User → kein Super-Admin
    if (!userId) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    // Super-Admin-Status prüfen
    let cancelled = false;
    
    async function check() {
      setLoading(true);
      setError(null);
      
      try {
        const result = await checkSuperAdmin();
        if (!cancelled) {
          setIsSuperAdmin(result.isSuperAdmin);
        }
      } catch (err) {
        if (!cancelled) {
          // Bei 401 ist der User einfach kein Super-Admin
          if (err instanceof Error && err.message.includes('401')) {
            setIsSuperAdmin(false);
          } else {
            setError(err instanceof Error ? err.message : 'Fehler');
          }
          setIsSuperAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    check();

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading]);

  return { 
    isSuperAdmin, 
    loading: authLoading || loading, 
    error 
  };
}

/**
 * Hook: Alle Tenants laden
 */
export function useAllTenants() {
  const [tenants, setTenants] = useState<TenantOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAllTenants();
      setTenants(response.tenants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { tenants, loading, error, refresh: load };
}

/**
 * Hook: Tenant-Detail laden und Module verwalten
 */
export function useTenantDetail(tenantId: string | null) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Tenant laden
  const load = useCallback(async () => {
    if (!tenantId) {
      setTenant(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const detail = await fetchTenantDetail(tenantId);
      setTenant(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  // Modul aktivieren/deaktivieren
  const handleToggleModule = useCallback(async (moduleId: string, enabled: boolean) => {
    if (!tenantId || !tenant) return null;

    setToggling(moduleId);
    try {
      const result = await toggleTenantModule(tenantId, moduleId, enabled);

      if (result.success) {
        // Lokalen State aktualisieren
        setTenant(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            modules: prev.modules.map(m =>
              m.id === moduleId ? { ...m, isActive: enabled } : m
            ),
          };
        });
      }

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
      throw err;
    } finally {
      setToggling(null);
    }
  }, [tenantId, tenant]);

  return {
    tenant,
    loading,
    error,
    toggling,
    handleToggleModule,
    refresh: load,
  };
}
