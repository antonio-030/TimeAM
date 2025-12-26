/**
 * Admin Dashboard (Developer/CEO)
 *
 * Übersicht aller Tenants und Modul-Verwaltung.
 * Nur für Super-Admins (Plattform-Betreiber) sichtbar.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAllTenants, useTenantDetail, useAllFreelancers, useFreelancerDetail } from './hooks';
import { deleteTenant, deactivateTenant, activateTenant } from './api';
import type { TenantOverview, TenantModuleStatus, FreelancerOverview } from './api';
import styles from './AdminDashboard.module.css';

const STORAGE_KEY_SELECTED_TENANT = 'dev-dashboard-selected-tenant';
const STORAGE_KEY_AUTO_REFRESH = 'dev-dashboard-auto-refresh';
const AUTO_REFRESH_INTERVAL = 120000; // 2 Minuten (im Hintergrund)

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
    } ${isToggling ? styles.moduleCardToggling : ''}`}>
      <span className={styles.moduleIcon}>{module.icon}</span>
      <div className={styles.moduleInfo}>
        <p className={styles.moduleName}>
          {module.displayName}
          {isToggling && <span className={styles.togglingIndicator}> ⏳</span>}
        </p>
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
  onModuleToggle?: () => void;
}

function TenantDetailPanel({ tenantId, onModuleToggle }: TenantDetailPanelProps) {
  // WICHTIG: Hooks müssen IMMER in der gleichen Reihenfolge aufgerufen werden
  // Alle Hooks müssen am Anfang stehen, VOR allen frühen Returns
  // Reihenfolge: 1. useAllTenants, 2. useTenantDetail, 3. useState Hooks, 4. useCallback Hooks
  const { tenants, refresh: refreshTenants } = useAllTenants();
  const { tenant, loading, error, toggling, handleToggleModule, refresh } = useTenantDetail(tenantId);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  // Berechnete Werte (keine Hooks, können nach frühen Returns stehen)
  const tenantFromList = tenantId ? tenants.find(t => t.id === tenantId) : null;
  const isActive = tenantFromList?.isActive !== false; // Default: true
  const isDevTenant = tenantId === 'dev-tenant';

  // ALLE useCallback Hooks müssen VOR den frühen Returns stehen
  const onToggle = useCallback(async (moduleId: string, enabled: boolean) => {
    try {
      const result = await handleToggleModule(moduleId, enabled);
      if (result) {
        const action = enabled ? 'aktiviert' : 'deaktiviert';
        setToast({ 
          message: `${result.message} – Daten werden aktualisiert...`, 
          type: 'success' 
        });
        
        // Daten neu laden statt kompletten Page-Reload
        await refresh();
        
        // Tenant-Liste auch aktualisieren (Callback)
        if (onModuleToggle) {
          onModuleToggle();
        }
        
        // Toast nach 3 Sekunden entfernen
        setTimeout(() => {
          setToast(null);
        }, 3000);
      }
    } catch {
      setToast({ message: 'Fehler beim Ändern', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  }, [handleToggleModule, refresh, onModuleToggle]);

  const handleDelete = useCallback(async () => {
    if (!tenantId || isDevTenant || !tenant) return;
    
    const confirmed = window.confirm(
      `⚠️ WARNUNG: Möchten Sie die Organisation "${tenant.name}" wirklich KOMPLETT löschen?\n\n` +
      `Dies löscht:\n` +
      `- Alle Mitglieder\n` +
      `- Alle Schichten\n` +
      `- Alle Zeiterfassungen\n` +
      `- Alle Daten\n\n` +
      `Diese Aktion kann NICHT rückgängig gemacht werden!`
    );
    
    if (!confirmed) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteTenant(tenantId);
      setToast({ message: result.message, type: 'success' });
      await refreshTenants();
      if (onModuleToggle) {
        onModuleToggle();
      }
      // Nach 2 Sekunden zur Liste zurückkehren
      setTimeout(() => {
        window.location.reload(); // Reload um Tenant aus Liste zu entfernen
      }, 2000);
    } catch (err) {
      setToast({ 
        message: err instanceof Error ? err.message : 'Fehler beim Löschen', 
        type: 'error' 
      });
    } finally {
      setIsDeleting(false);
    }
  }, [tenantId, tenant?.name, isDevTenant, refreshTenants, onModuleToggle, tenant]);

  const handleToggleActive = useCallback(async () => {
    if (!tenantId || isDevTenant) return;
    
    setIsTogglingActive(true);
    try {
      const result = isActive 
        ? await deactivateTenant(tenantId)
        : await activateTenant(tenantId);
      
      setToast({ message: result.message, type: 'success' });
      await refreshTenants();
      await refresh();
      if (onModuleToggle) {
        onModuleToggle();
      }
    } catch (err) {
      setToast({ 
        message: err instanceof Error ? err.message : 'Fehler beim Ändern des Status', 
        type: 'error' 
      });
    } finally {
      setIsTogglingActive(false);
    }
  }, [tenantId, isActive, isDevTenant, refreshTenants, refresh, onModuleToggle]);

  // JETZT kommen die frühen Returns
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

  // Ab hier können normale Berechnungen stehen
  const coreModules = tenant.modules.filter(m => m.category === 'core');
  const optionalModules = tenant.modules.filter(m => m.category === 'optional');

  return (
    <div className={styles.detailSection}>
      <div className={styles.detailHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h2 className={styles.detailName}>
              🏢 {tenant.name}
              {!isActive && (
                <span style={{ 
                  marginLeft: '0.5rem', 
                  fontSize: '0.875rem', 
                  color: '#ff6b6b',
                  fontWeight: 'normal'
                }}>
                  (Deaktiviert)
                </span>
              )}
            </h2>
            <div className={styles.detailMeta}>
              <p className={styles.detailId}>ID: {tenant.id}</p>
              <div className={styles.detailInfoGrid}>
                <div className={styles.detailInfoItem}>
                  <span className={styles.detailInfoLabel}>👥 Mitglieder:</span>
                  <span className={styles.detailInfoValue}>{tenant.members.length}</span>
                </div>
                {tenant.createdByFirstName || tenant.createdByLastName || tenant.createdByName ? (
                  <div className={styles.detailInfoItem}>
                    <span className={styles.detailInfoLabel}>👤 Erstellt von:</span>
                    <span className={styles.detailInfoValue}>
                      {tenant.createdByFirstName && tenant.createdByLastName
                        ? `${tenant.createdByFirstName} ${tenant.createdByLastName}`
                        : tenant.createdByName || 'Unbekannt'}
                      {tenant.createdByEmail && ` (${tenant.createdByEmail})`}
                    </span>
                  </div>
                ) : null}
                {tenant.address && (
                  <div className={styles.detailInfoItem}>
                    <span className={styles.detailInfoLabel}>📍 Adresse:</span>
                    <span className={styles.detailInfoValue}>{tenant.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', minWidth: '140px' }}>
            {!isDevTenant && (
              <>
                <button
                  onClick={handleToggleActive}
                  disabled={isTogglingActive}
                  className={`${styles.actionButton} ${!isActive ? styles.actionButtonActivate : styles.actionButtonDeactivate}`}
                  title={isActive ? 'Tenant deaktivieren' : 'Tenant aktivieren'}
                >
                  {isTogglingActive ? '⏳' : isActive ? '🔒 Deaktivieren' : '✅ Aktivieren'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className={`${styles.actionButton} ${styles.actionButtonDelete}`}
                  title="Tenant komplett löschen"
                >
                  {isDeleting ? '⏳' : '🗑️ Löschen'}
                </button>
              </>
            )}
            {isDevTenant && (
              <span style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                Dev-Tenant (geschützt)
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className={styles.detailContent}>
        {/* Optionale Module */}
        <h3 className={styles.modulesTitle}>
          📦 Optionale Module 
          <span className={styles.moduleCount}>
            ({optionalModules.filter(m => m.isActive).length}/{optionalModules.length} aktiv)
          </span>
        </h3>
        <div className={styles.modulesList}>
          {optionalModules.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Keine optionalen Module verfügbar</p>
            </div>
          ) : (
            optionalModules.map(mod => (
              <ModuleCard
                key={mod.id}
                module={mod}
                onToggle={onToggle}
                isToggling={toggling === mod.id}
              />
            ))
          )}
        </div>

        {/* Core Module */}
        <h3 className={styles.modulesTitle} style={{ marginTop: '1.5rem' }}>
          🔒 Core-Module
          <span className={styles.moduleCount}>({coreModules.length})</span>
        </h3>
        <div className={styles.modulesList}>
          {coreModules.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Keine Core-Module verfügbar</p>
            </div>
          ) : (
            coreModules.map(mod => (
              <ModuleCard
                key={mod.id}
                module={mod}
                onToggle={onToggle}
                isToggling={false}
              />
            ))
          )}
        </div>

        {/* Rollen-Statistiken */}
        {(() => {
          const roleCounts = tenant.members.reduce((acc, m) => {
            acc[m.role] = (acc[m.role] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          return (
            <div className={styles.roleStats}>
              <h3 className={styles.membersTitle}>📊 Rollen-Verteilung</h3>
              <div className={styles.roleStatsGrid}>
                {Object.entries(roleCounts).map(([role, count]) => (
                  <div key={role} className={styles.roleStatItem}>
                    <span className={styles.roleStatLabel}>
                      {role === 'admin' ? '👑' : role === 'manager' ? '📋' : '👤'} {role}
                    </span>
                    <span className={styles.roleStatValue}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Mitglieder */}
        <h3 className={styles.membersTitle} style={{ marginTop: '1.5rem' }}>
          👥 Mitglieder ({tenant.members.length})
        </h3>
        <div className={styles.membersList}>
          {tenant.members.map(member => (
            <div key={member.uid} className={styles.memberItem}>
              <div className={styles.memberAvatar}>
                {member.role === 'admin' ? '👑' : member.role === 'manager' ? '📋' : '👤'}
              </div>
              <div className={styles.memberInfo}>
                <p className={styles.memberName}>
                  {member.firstName && member.lastName
                    ? `${member.firstName} ${member.lastName}`
                    : member.displayName || member.email.split('@')[0]}
                </p>
                <p className={styles.memberEmail}>{member.email}</p>
                {member.address && (
                  <p className={styles.memberAddress}>📍 {member.address}</p>
                )}
              </div>
              <span className={`${styles.memberRole} ${styles[`memberRole${member.role.charAt(0).toUpperCase() + member.role.slice(1)}`]}`}>
                {member.role}
              </span>
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
 * Freelancer-Detail-Panel
 */
interface FreelancerDetailPanelProps {
  freelancerUid: string | null;
  onModuleToggle?: () => void;
}

function FreelancerDetailPanel({ freelancerUid, onModuleToggle }: FreelancerDetailPanelProps) {
  const { freelancer, loading, error, toggling, handleToggleModule, refresh } = useFreelancerDetail(freelancerUid);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const onToggle = useCallback(async (moduleId: string, enabled: boolean) => {
    try {
      const result = await handleToggleModule(moduleId, enabled);
      if (result) {
        const action = enabled ? 'aktiviert' : 'deaktiviert';
        setToast({ 
          message: `${result.message} – Daten werden aktualisiert...`, 
          type: 'success' 
        });
        
        // Daten neu laden statt kompletten Page-Reload
        await refresh();
        
        // Freelancer-Liste auch aktualisieren (Callback)
        if (onModuleToggle) {
          onModuleToggle();
        }
        
        // Toast nach 3 Sekunden entfernen
        setTimeout(() => {
          setToast(null);
        }, 3000);
      }
    } catch {
      setToast({ message: 'Fehler beim Ändern', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  }, [handleToggleModule, refresh, onModuleToggle]);

  if (!freelancerUid) {
    return (
      <div className={styles.detailSection}>
        <div className={styles.detailPlaceholder}>
          <span className={styles.detailPlaceholderIcon}>👈</span>
          <p>Wähle einen Freelancer aus der Liste</p>
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

  if (error || !freelancer) {
    return (
      <div className={styles.detailSection}>
        <div className={styles.errorState}>
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorMessage}>{error || 'Freelancer nicht gefunden'}</p>
        </div>
      </div>
    );
  }

  const coreModules = freelancer.modules.filter(m => m.category === 'core');
  const optionalModules = freelancer.modules.filter(m => m.category === 'optional');

  return (
    <div className={styles.detailSection}>
      <div className={styles.detailHeader}>
        <h2 className={styles.detailName}>👤 {freelancer.displayName}</h2>
        <div className={styles.detailMeta}>
          <p className={styles.detailId}>UID: {freelancer.uid}</p>
          <div className={styles.detailInfoGrid}>
            {freelancer.firstName || freelancer.lastName ? (
              <div className={styles.detailInfoItem}>
                <span className={styles.detailInfoLabel}>👤 Name:</span>
                <span className={styles.detailInfoValue}>
                  {freelancer.firstName && freelancer.lastName
                    ? `${freelancer.firstName} ${freelancer.lastName}`
                    : freelancer.displayName}
                </span>
              </div>
            ) : null}
            <div className={styles.detailInfoItem}>
              <span className={styles.detailInfoLabel}>📧 E-Mail:</span>
              <span className={styles.detailInfoValue}>{freelancer.email}</span>
            </div>
            {freelancer.companyName && (
              <div className={styles.detailInfoItem}>
                <span className={styles.detailInfoLabel}>🏢 Firma:</span>
                <span className={styles.detailInfoValue}>{freelancer.companyName}</span>
              </div>
            )}
            {freelancer.address && (
              <div className={styles.detailInfoItem}>
                <span className={styles.detailInfoLabel}>📍 Adresse:</span>
                <span className={styles.detailInfoValue}>{freelancer.address}</span>
              </div>
            )}
            {freelancer.verificationStatus && (
              <div className={styles.detailInfoItem}>
                <span className={styles.detailInfoLabel}>✅ Verifizierung:</span>
                <span className={styles.detailInfoValue}>
                  {freelancer.verificationStatus === 'approved' ? '✅ Genehmigt' :
                   freelancer.verificationStatus === 'pending' ? '⏳ Ausstehend' :
                   '❌ Abgelehnt'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className={styles.detailContent}>
        {/* Optionale Module */}
        <h3 className={styles.modulesTitle}>
          📦 Optionale Module 
          <span className={styles.moduleCount}>
            ({optionalModules.filter(m => m.isActive).length}/{optionalModules.length} aktiv)
          </span>
        </h3>
        <div className={styles.modulesList}>
          {optionalModules.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Keine optionalen Module verfügbar</p>
            </div>
          ) : (
            optionalModules.map(mod => (
              <ModuleCard
                key={mod.id}
                module={mod}
                onToggle={onToggle}
                isToggling={toggling === mod.id}
              />
            ))
          )}
        </div>

        {/* Core Module */}
        <h3 className={styles.modulesTitle} style={{ marginTop: '1.5rem' }}>
          🔒 Core-Module
          <span className={styles.moduleCount}>({coreModules.length})</span>
        </h3>
        <div className={styles.modulesList}>
          {coreModules.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Keine Core-Module verfügbar</p>
            </div>
          ) : (
            coreModules.map(mod => (
              <ModuleCard
                key={mod.id}
                module={mod}
                onToggle={onToggle}
                isToggling={false}
              />
            ))
          )}
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
  const { freelancers, loading: freelancersLoading, error: freelancersError, refresh: refreshFreelancers } = useAllFreelancers();
  
  const [activeTab, setActiveTab] = useState<'tenants' | 'freelancers'>('tenants');
  
  // selectedTenantId aus localStorage wiederherstellen
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedFreelancerUid, setSelectedFreelancerUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTO_REFRESH);
      return stored !== 'false'; // Default: aktiviert
    } catch {
      return true;
    }
  });

  // selectedTenantId aus localStorage wiederherstellen, wenn Tenants geladen sind
  useEffect(() => {
    if (!loading && tenants.length > 0 && selectedTenantId === null) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_SELECTED_TENANT);
        if (stored && tenants.some(t => t.id === stored)) {
          setSelectedTenantId(stored);
        }
      } catch {
        // localStorage nicht verfügbar, ignorieren
      }
    }
  }, [loading, tenants, selectedTenantId]);

  // selectedTenantId validieren - wenn Tenant nicht mehr existiert, zurücksetzen
  useEffect(() => {
    if (selectedTenantId && tenants.length > 0) {
      const tenantExists = tenants.some(t => t.id === selectedTenantId);
      if (!tenantExists) {
        setSelectedTenantId(null);
        try {
          localStorage.removeItem(STORAGE_KEY_SELECTED_TENANT);
        } catch {
          // localStorage nicht verfügbar, ignorieren
        }
      }
    }
  }, [selectedTenantId, tenants]);

  // selectedTenantId im localStorage speichern
  useEffect(() => {
    if (selectedTenantId) {
      try {
        localStorage.setItem(STORAGE_KEY_SELECTED_TENANT, selectedTenantId);
      } catch {
        // localStorage nicht verfügbar, ignorieren
      }
    }
  }, [selectedTenantId]);

  // Auto-Refresh im Hintergrund (nur wenn aktiviert)
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      // Leiser Refresh im Hintergrund - keine sichtbaren Änderungen
      if (activeTab === 'tenants') {
        refresh().then(() => {
          setLastRefresh(new Date());
        }).catch(() => {
          // Fehler stillschweigend ignorieren
        });
      } else {
        refreshFreelancers().then(() => {
          setLastRefresh(new Date());
        }).catch(() => {
          // Fehler stillschweigend ignorieren
        });
      }
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refresh, refreshFreelancers, autoRefreshEnabled, activeTab]);

  // Auto-Refresh Einstellung speichern
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_REFRESH, String(autoRefreshEnabled));
    } catch {
      // localStorage nicht verfügbar, ignorieren
    }
  }, [autoRefreshEnabled]);

  // Gefilterte Tenants basierend auf Suchquery
  const filteredTenants = useMemo(() => {
    if (!searchQuery.trim()) {
      return tenants;
    }
    const query = searchQuery.toLowerCase();
    return tenants.filter(tenant => 
      tenant.name.toLowerCase().includes(query) ||
      tenant.id.toLowerCase().includes(query) ||
      tenant.createdByName?.toLowerCase().includes(query) ||
      tenant.createdByEmail?.toLowerCase().includes(query) ||
      tenant.address?.toLowerCase().includes(query)
    );
  }, [tenants, searchQuery]);

  // Gefilterte Freelancer basierend auf Suchquery
  const filteredFreelancers = useMemo(() => {
    if (!searchQuery.trim()) {
      return freelancers;
    }
    const query = searchQuery.toLowerCase();
    return freelancers.filter(freelancer => 
      freelancer.displayName.toLowerCase().includes(query) ||
      freelancer.email.toLowerCase().includes(query) ||
      freelancer.firstName?.toLowerCase().includes(query) ||
      freelancer.lastName?.toLowerCase().includes(query) ||
      freelancer.companyName?.toLowerCase().includes(query) ||
      freelancer.address?.toLowerCase().includes(query) ||
      freelancer.uid.toLowerCase().includes(query)
    );
  }, [freelancers, searchQuery]);

  // Statistiken
  const totalTenants = tenants.length;
  const totalMembers = tenants.reduce((sum, t) => sum + t.memberCount, 0);
  const tenantsWithShiftPool = tenants.filter(t => 
    t.activeModules.includes('shift-pool')
  ).length;

  // Handler für Tenant-Auswahl
  const handleSelectTenant = useCallback((tenantId: string) => {
    setSelectedTenantId(tenantId);
  }, []);

  // Handler für Modul-Toggle (aktualisiert auch Tenant-Liste)
  const handleModuleToggle = useCallback(() => {
    if (activeTab === 'tenants') {
      refresh().then(() => {
        setLastRefresh(new Date());
      });
    } else {
      refreshFreelancers().then(() => {
        setLastRefresh(new Date());
      });
    }
  }, [refresh, refreshFreelancers, activeTab]);

  if (loading || (activeTab === 'tenants' && loading) || (activeTab === 'freelancers' && freelancersLoading)) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}>🔐</div>
        <p>Developer Dashboard wird geladen...</p>
      </div>
    );
  }

  if (error || (activeTab === 'freelancers' && freelancersError)) {
    return (
      <div className={styles.errorState}>
        <span className={styles.errorIcon}>⚠️</span>
        <p className={styles.errorMessage}>{error || freelancersError}</p>
        <button 
          onClick={() => {
            if (activeTab === 'tenants') {
              refresh();
            } else {
              refreshFreelancers();
            }
          }} 
          className={styles.retryBtn}
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <span className={styles.headerBadge}>🔐 Super-Admin</span>
            <h1 className={styles.title}>Developer Dashboard</h1>
            <p className={styles.subtitle}>
              Verwalte alle Organisationen und deren Module
            </p>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.autoRefreshToggle}>
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
              />
              <span>Auto-Refresh</span>
            </label>
            <button 
              onClick={() => {
                if (activeTab === 'tenants') {
                  refresh().then(() => setLastRefresh(new Date()));
                } else {
                  refreshFreelancers().then(() => setLastRefresh(new Date()));
                }
              }}
              className={styles.refreshBtn}
              title="Jetzt aktualisieren"
            >
              🔄 Aktualisieren
            </button>
            {lastRefresh && (
              <span className={styles.lastRefresh}>
                {lastRefresh.toLocaleTimeString('de-DE')}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'tenants' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('tenants');
            setSearchQuery('');
          }}
          type="button"
        >
          🏢 Organisationen ({tenants.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'freelancers' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('freelancers');
            setSearchQuery('');
          }}
          type="button"
        >
          👤 Freelancer ({freelancers.length})
        </button>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        {activeTab === 'tenants' ? (
          <>
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
          </>
        ) : (
          <>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Freelancer</p>
              <p className={styles.statValue}>{freelancers.length}</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Verifiziert</p>
              <p className={styles.statValue}>
                {freelancers.filter(f => f.verificationStatus === 'approved').length}
              </p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Mit Modulen</p>
              <p className={styles.statValue}>
                {freelancers.filter(f => f.activeModules.length > 0).length}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Layout */}
      <div className={styles.layout}>
        {activeTab === 'tenants' ? (
          <>
            {/* Tenant List */}
            <div className={styles.tenantListSection}>
              <div className={styles.tenantListHeader}>
                <h2 className={styles.tenantListTitle}>🏢 Organisationen ({filteredTenants.length})</h2>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="🔍 Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>
          <div className={styles.tenantList}>
            {filteredTenants.length === 0 && tenants.length > 0 ? (
              <div className={styles.detailPlaceholder}>
                <p>Keine Organisationen gefunden</p>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className={styles.detailPlaceholder}>
                <p>Noch keine Organisationen registriert</p>
              </div>
            ) : (
              filteredTenants.map(tenant => (
                <button
                  key={tenant.id}
                  className={`${styles.tenantItem} ${
                    selectedTenantId === tenant.id ? styles.tenantItemActive : ''
                  }`}
                  onClick={() => handleSelectTenant(tenant.id)}
                >
                  <span className={styles.tenantIcon}>🏢</span>
                  <div className={styles.tenantInfo}>
                    <p className={styles.tenantName}>
                      {tenant.name}
                      {tenant.isActive === false && (
                        <span style={{ 
                          marginLeft: '0.5rem', 
                          fontSize: '0.75rem', 
                          color: '#ff6b6b',
                          fontWeight: 'normal'
                        }}>
                          (Deaktiviert)
                        </span>
                      )}
                    </p>
                    <div className={styles.tenantMeta}>
                      <span>{tenant.memberCount} Mitglieder</span>
                      <span>•</span>
                      <span>{new Date(tenant.createdAt).toLocaleDateString('de-DE')}</span>
                      {tenant.isActive === false && tenant.deactivatedAt && (
                        <>
                          <span>•</span>
                          <span style={{ color: '#ff6b6b' }}>
                            Deaktiviert: {new Date(tenant.deactivatedAt).toLocaleDateString('de-DE')}
                          </span>
                        </>
                      )}
                      {tenant.createdByName && (
                        <>
                          <span>•</span>
                          <span className={styles.tenantCreator}>👤 {tenant.createdByName}</span>
                        </>
                      )}
                      {tenant.createdByEmail && (
                        <>
                          <span>•</span>
                          <span className={styles.tenantEmail}>{tenant.createdByEmail}</span>
                        </>
                      )}
                    </div>
                    {tenant.address && (
                      <p className={styles.tenantAddress}>📍 {tenant.address}</p>
                    )}
                  </div>
                  <div className={styles.tenantModules}>
                    {tenant.activeModules.map(mod => (
                      <span key={mod} className={styles.moduleDot} title={mod} />
                    ))}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

            {/* Detail Panel */}
            <TenantDetailPanel tenantId={selectedTenantId} onModuleToggle={handleModuleToggle} />
          </>
        ) : (
          <>
            {/* Freelancer List */}
            <div className={styles.tenantListSection}>
              <div className={styles.tenantListHeader}>
                <h2 className={styles.tenantListTitle}>👤 Freelancer ({filteredFreelancers.length})</h2>
                <div className={styles.searchContainer}>
                  <input
                    type="text"
                    placeholder="🔍 Suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              </div>
              <div className={styles.tenantList}>
                {filteredFreelancers.length === 0 && freelancers.length > 0 ? (
                  <div className={styles.detailPlaceholder}>
                    <p>Keine Freelancer gefunden</p>
                  </div>
                ) : filteredFreelancers.length === 0 ? (
                  <div className={styles.detailPlaceholder}>
                    <p>Noch keine Freelancer registriert</p>
                  </div>
                ) : (
                  filteredFreelancers.map(freelancer => (
                    <button
                      key={freelancer.uid}
                      className={`${styles.tenantItem} ${
                        selectedFreelancerUid === freelancer.uid ? styles.tenantItemActive : ''
                      }`}
                      onClick={() => setSelectedFreelancerUid(freelancer.uid)}
                    >
                      <span className={styles.tenantIcon}>👤</span>
                      <div className={styles.tenantInfo}>
                        <p className={styles.tenantName}>
                          {freelancer.firstName && freelancer.lastName
                            ? `${freelancer.firstName} ${freelancer.lastName}`
                            : freelancer.displayName}
                        </p>
                        <div className={styles.tenantMeta}>
                          <span>{freelancer.email}</span>
                          {freelancer.companyName && (
                            <>
                              <span>•</span>
                              <span>🏢 {freelancer.companyName}</span>
                            </>
                          )}
                          {freelancer.verificationStatus && (
                            <>
                              <span>•</span>
                              <span>
                                {freelancer.verificationStatus === 'approved' ? '✅' :
                                 freelancer.verificationStatus === 'pending' ? '⏳' : '❌'}
                              </span>
                            </>
                          )}
                        </div>
                        {freelancer.address && (
                          <p className={styles.tenantAddress}>📍 {freelancer.address}</p>
                        )}
                      </div>
                      <div className={styles.tenantModules}>
                        {freelancer.activeModules.map(mod => (
                          <span key={mod} className={styles.moduleDot} title={mod} />
                        ))}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Detail Panel */}
            <FreelancerDetailPanel freelancerUid={selectedFreelancerUid} onModuleToggle={handleModuleToggle} />
          </>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
