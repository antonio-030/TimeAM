/**
 * Tenant Context
 *
 * React Context für Tenant und Entitlements.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth';
import {
  apiGet,
  apiPost,
  type MeResponse,
  type CreateTenantResponse,
  type TenantEntitlements,
  type MemberRole,
} from '../api';

/**
 * Tenant Context State.
 */
interface TenantContextValue {
  /** Wird geladen? */
  loading: boolean;

  /** Fehler */
  error: string | null;

  /** User braucht Onboarding (kein Tenant) */
  needsOnboarding: boolean;

  /** User ist Freelancer */
  isFreelancer: boolean;

  /** Aktueller Tenant */
  tenant: { id: string; name: string } | null;

  /** Rolle des Users im Tenant */
  role: MemberRole | null;

  /** Freigeschaltete Features */
  entitlements: TenantEntitlements;

  /** Prüft, ob ein Entitlement aktiv ist */
  hasEntitlement: (key: string) => boolean;

  /** Erstellt einen neuen Tenant */
  createTenant: (tenantName: string) => Promise<void>;

  /** Lädt Tenant-Daten neu */
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isFreelancer, setIsFreelancer] = useState(false);
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [entitlements, setEntitlements] = useState<TenantEntitlements>({});

  // Stabile User-ID für Dependency
  const userId = user?.uid ?? null;

  // Tenant-Daten laden
  const loadTenantData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setTenant(null);
      setRole(null);
      setEntitlements({});
      setNeedsOnboarding(false);
      setIsFreelancer(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiGet<MeResponse>('/api/me');

      if (data.isFreelancer) {
        setIsFreelancer(true);
        setNeedsOnboarding(false);
        // Freelancer haben auch einen Tenant (ihre eigene Firma)
        setTenant(data.tenant || null);
        setRole(data.role || null);
        setEntitlements(data.entitlements || {});
      } else if (data.needsOnboarding) {
        setIsFreelancer(false);
        setNeedsOnboarding(true);
        setTenant(null);
        setRole(null);
        setEntitlements({});
      } else {
        setIsFreelancer(false);
        setNeedsOnboarding(false);
        setTenant(data.tenant || null);
        setRole(data.role || null);
        setEntitlements(data.entitlements || {});
      }
    } catch (err) {
      console.error('Failed to load tenant data:', err);
      setError('Fehler beim Laden der Tenant-Daten');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Bei User-Änderung neu laden
  useEffect(() => {
    loadTenantData();
  }, [loadTenantData]);

  // Tenant erstellen
  const createTenant = useCallback(async (tenantName: string) => {
    setError(null);

    try {
      const data = await apiPost<CreateTenantResponse>(
        '/api/onboarding/create-tenant',
        { tenantName }
      );

      setTenant(data.tenant);
      setRole(data.role);
      setEntitlements(data.entitlements);
      setNeedsOnboarding(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Erstellen';
      setError(message);
      throw err;
    }
  }, []);

  // Entitlement prüfen
  const hasEntitlement = useCallback((key: string): boolean => {
    const value = entitlements[key];
    return value === true ||
      (typeof value === 'string' && value !== '') ||
      (typeof value === 'number' && value > 0);
  }, [entitlements]);

  const value = useMemo<TenantContextValue>(() => ({
    loading,
    error,
    needsOnboarding,
    isFreelancer,
    tenant,
    role,
    entitlements,
    hasEntitlement,
    createTenant,
    refresh: loadTenantData,
  }), [loading, error, needsOnboarding, isFreelancer, tenant, role, entitlements, hasEntitlement, createTenant, loadTenantData]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);

  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }

  return context;
}

