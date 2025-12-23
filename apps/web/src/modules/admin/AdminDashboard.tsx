/**
 * Admin Dashboard (Developer/CEO)
 *
 * Übersicht aller Tenants und Modul-Verwaltung.
 * Nur für Super-Admins (Plattform-Betreiber) sichtbar.
 */

import { useState, useCallback } from 'react';
import { useAllTenants, useTenantDetail } from './hooks';
import type { TenantOverview, TenantModuleStatus } from './api';
import styles from './AdminDashboard.module.css';

/**
 * Toast-Komponente
 */
interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  setTimeout(onClose, 3000);
  return (
    <div className={`${styles.toast} ${type === 'success' ? styles.toastSuccess : styles.toastError}`}>
      <span>{type === 'success' ? '✅' : '❌'}</span>
      <span>{message}</span>
    </div>
  );
}

/**
 * Modul-Karte
 */
interface ModuleCardProps {
  module: TenantModuleStatus;
  onToggle: (moduleId: string, enabled: boolean) => Promise<void>;
  isToggling: boolean;
}

function ModuleCard({ module, onToggle, isToggling }: ModuleCardProps) {
  const handleToggle = async () => {
    if (!module.canToggle || isToggling) return;
    await onToggle(module.id, !module.isActive);
  };

  return (
    <div className={`${styles.moduleCard} ${
      module.category === 'core' 
        ? styles.moduleCardCore 
        : module.isActive 
          ? styles.moduleCardActive 
          : ''
    }`}>
      <span className={styles.moduleIcon}>{module.icon}</span>
      <div className={styles.moduleInfo}>
        <p className={styles.moduleName}>{module.displayName}</p>
        <p className={styles.moduleDesc}>{module.description}</p>
      </div>
      <div className={styles.moduleStatus}>
        {module.category === 'core' ? (
          <span className={`${styles.statusBadge} ${styles.statusCore}`}>Core</span>
        ) : (
          <>
            <span className={`${styles.statusBadge} ${
              module.isActive ? styles.statusActive : styles.statusInactive
            }`}>
              {module.isActive ? 'Aktiv' : 'Inaktiv'}
            </span>
            <button
              className={`${styles.toggle} ${module.isActive ? styles.toggleActive : ''}`}
              onClick={handleToggle}
              disabled={!module.canToggle || isToggling}
              aria-label={`${module.displayName} ${module.isActive ? 'deaktivieren' : 'aktivieren'}`}
            >
              <span className={styles.toggleKnob} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Tenant-Detail-Panel
 */
interface TenantDetailPanelProps {
  tenantId: string | null;
}

function TenantDetailPanel({ tenantId }: TenantDetailPanelProps) {
  const { tenant, loading, error, toggling, handleToggleModule } = useTenantDetail(tenantId);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const onToggle = useCallback(async (moduleId: string, enabled: boolean) => {
    try {
      const result = await handleToggleModule(moduleId, enabled);
      if (result) {
        const action = enabled ? 'aktiviert' : 'deaktiviert';
        setToast({ 
          message: `${result.message} – Seite wird neu geladen...`, 
          type: 'success' 
        });
        // Seite nach 1.5s neu laden, damit Entitlements aktualisiert werden
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch {
      setToast({ message: 'Fehler beim Ändern', type: 'error' });
    }
  }, [handleToggleModule]);

  if (!tenantId) {
    return (
      <div className={styles.detailSection}>
        <div className={styles.detailPlaceholder}>
          <span className={styles.detailPlaceholderIcon}>👈</span>
          <p>Wähle eine Organisation aus der Liste</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.detailSection}>
        <div className={styles.loading}>
          <div className={styles.spinner}>⏳</div>
          <p>Lade Details...</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className={styles.detailSection}>
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorMessage}>{error || 'Tenant nicht gefunden'}</p>
        </div>
      </div>
    );
  }

  const coreModules = tenant.modules.filter(m => m.category === 'core');
  const optionalModules = tenant.modules.filter(m => m.category === 'optional');

  return (
    <div className={styles.detailSection}>
      <div className={styles.detailHeader}>
        <h2 className={styles.detailName}>🏢 {tenant.name}</h2>
        <p className={styles.detailId}>ID: {tenant.id}</p>
      </div>
      
      <div className={styles.detailContent}>
        {/* Optionale Module */}
        <h3 className={styles.modulesTitle}>📦 Optionale Module</h3>
        <div className={styles.modulesList}>
          {optionalModules.map(mod => (
            <ModuleCard
              key={mod.id}
              module={mod}
              onToggle={onToggle}
              isToggling={toggling === mod.id}
            />
          ))}
        </div>

        {/* Core Module */}
        <h3 className={styles.modulesTitle} style={{ marginTop: '1.5rem' }}>🔒 Core-Module</h3>
        <div className={styles.modulesList}>
          {coreModules.map(mod => (
            <ModuleCard
              key={mod.id}
              module={mod}
              onToggle={onToggle}
              isToggling={false}
            />
          ))}
        </div>

        {/* Mitglieder */}
        <h3 className={styles.membersTitle}>👥 Mitglieder ({tenant.members.length})</h3>
        <div className={styles.membersList}>
          {tenant.members.map(member => (
            <div key={member.uid} className={styles.memberItem}>
              <div className={styles.memberAvatar}>
                {member.role === 'admin' ? '👑' : member.role === 'manager' ? '📋' : '👤'}
              </div>
              <div className={styles.memberInfo}>
                <p className={styles.memberEmail}>{member.email}</p>
              </div>
              <span className={styles.memberRole}>{member.role}</span>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

/**
 * Haupt-Komponente: Admin Dashboard
 */
export function AdminDashboard() {
  const { tenants, loading, error, refresh } = useAllTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Statistiken
  const totalTenants = tenants.length;
  const totalMembers = tenants.reduce((sum, t) => sum + t.memberCount, 0);
  const tenantsWithShiftPool = tenants.filter(t => 
    t.activeModules.includes('shift-pool')
  ).length;

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}>🔐</div>
        <p>Developer Dashboard wird geladen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <span className={styles.errorIcon}>⚠️</span>
        <p className={styles.errorMessage}>{error}</p>
        <button onClick={refresh} className={styles.retryBtn}>
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <span className={styles.headerBadge}>🔐 Super-Admin</span>
        <h1 className={styles.title}>Developer Dashboard</h1>
        <p className={styles.subtitle}>
          Verwalte alle Organisationen und deren Module
        </p>
      </header>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Organisationen</p>
          <p className={styles.statValue}>{totalTenants}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Gesamt-Nutzer</p>
          <p className={styles.statValue}>{totalMembers}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Mit Schichtplanung</p>
          <p className={styles.statValue}>{tenantsWithShiftPool}</p>
        </div>
      </div>

      {/* Layout */}
      <div className={styles.layout}>
        {/* Tenant List */}
        <div className={styles.tenantListSection}>
          <div className={styles.tenantListHeader}>
            <h2 className={styles.tenantListTitle}>🏢 Organisationen</h2>
          </div>
          <div className={styles.tenantList}>
            {tenants.map(tenant => (
              <button
                key={tenant.id}
                className={`${styles.tenantItem} ${
                  selectedTenantId === tenant.id ? styles.tenantItemActive : ''
                }`}
                onClick={() => setSelectedTenantId(tenant.id)}
              >
                <span className={styles.tenantIcon}>🏢</span>
                <div className={styles.tenantInfo}>
                  <p className={styles.tenantName}>{tenant.name}</p>
                  <p className={styles.tenantMeta}>
                    {tenant.memberCount} Mitglieder • {new Date(tenant.createdAt).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <div className={styles.tenantModules}>
                  {tenant.activeModules.map(mod => (
                    <span key={mod} className={styles.moduleDot} title={mod} />
                  ))}
                </div>
              </button>
            ))}
            {tenants.length === 0 && (
              <div className={styles.detailPlaceholder}>
                <p>Noch keine Organisationen registriert</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <TenantDetailPanel tenantId={selectedTenantId} />
      </div>
    </div>
  );
}

export default AdminDashboard;
