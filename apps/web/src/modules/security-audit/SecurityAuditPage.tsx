/**
 * Security Audit Page
 *
 * Haupt-Komponente für das Security-Audit-Modul.
 * Zeigt alle Security-Events, Statistiken und Rate-Limits an.
 */

import { useState, useMemo } from 'react';
import {
  useSecurityEvents,
  useSecurityStats,
  useRateLimits,
} from './hooks';
import {
  SECURITY_EVENT_TYPES,
  SECURITY_EVENT_SEVERITY,
  type SecurityEventType,
  type SecurityEventSeverity,
  type SecurityEvent,
} from '@timeam/shared';
import styles from './SecurityAuditPage.module.css';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getSeverityBadgeClass(severity: SecurityEventSeverity): string {
  switch (severity) {
    case SECURITY_EVENT_SEVERITY.CRITICAL:
      return styles.severityCritical;
    case SECURITY_EVENT_SEVERITY.HIGH:
      return styles.severityHigh;
    case SECURITY_EVENT_SEVERITY.MEDIUM:
      return styles.severityMedium;
    case SECURITY_EVENT_SEVERITY.LOW:
      return styles.severityLow;
    default:
      return '';
  }
}

function getSeverityLabel(severity: SecurityEventSeverity): string {
  switch (severity) {
    case SECURITY_EVENT_SEVERITY.CRITICAL:
      return 'Kritisch';
    case SECURITY_EVENT_SEVERITY.HIGH:
      return 'Hoch';
    case SECURITY_EVENT_SEVERITY.MEDIUM:
      return 'Mittel';
    case SECURITY_EVENT_SEVERITY.LOW:
      return 'Niedrig';
    default:
      return severity;
  }
}

function getEventTypeLabel(eventType: SecurityEventType): string {
  const labels: Record<SecurityEventType, string> = {
    [SECURITY_EVENT_TYPES.AUTH_LOGIN_SUCCESS]: 'Login erfolgreich',
    [SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED]: 'Login fehlgeschlagen',
    [SECURITY_EVENT_TYPES.AUTH_LOGOUT]: 'Logout',
    [SECURITY_EVENT_TYPES.AUTH_RATE_LIMIT_EXCEEDED]: 'Rate-Limit überschritten',
    [SECURITY_EVENT_TYPES.DATA_ACCESS_PERSONAL]: 'Zugriff auf personenbezogene Daten',
    [SECURITY_EVENT_TYPES.DATA_MODIFY_SENSITIVE]: 'Änderung sensibler Daten',
    [SECURITY_EVENT_TYPES.API_ACCESS_PROTECTED]: 'API-Zugriff (geschützt)',
    [SECURITY_EVENT_TYPES.MFA_SETUP]: 'MFA eingerichtet',
    [SECURITY_EVENT_TYPES.MFA_VERIFY_SUCCESS]: 'MFA-Verifizierung erfolgreich',
    [SECURITY_EVENT_TYPES.MFA_VERIFY_FAILED]: 'MFA-Verifizierung fehlgeschlagen',
    [SECURITY_EVENT_TYPES.MFA_RESET]: 'MFA zurückgesetzt',
    [SECURITY_EVENT_TYPES.ACCOUNT_PASSWORD_CHANGE]: 'Passwort geändert',
    [SECURITY_EVENT_TYPES.ACCOUNT_EMAIL_CHANGE]: 'E-Mail geändert',
    [SECURITY_EVENT_TYPES.ACCOUNT_DELETION_REQUEST]: 'Account-Löschung beantragt',
  };
  return labels[eventType] || eventType;
}

// =============================================================================
// Components
// =============================================================================

function EventTable({ events }: { events: SecurityEvent[] }) {
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  return (
    <>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>Event-Typ</th>
              <th>Severity</th>
              <th>User</th>
              <th>E-Mail</th>
              <th>IP-Adresse</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className={styles.tableRow}
              >
                <td>{formatDateTime(event.timestamp)}</td>
                <td>{getEventTypeLabel(event.eventType)}</td>
                <td>
                  <span className={getSeverityBadgeClass(event.severity)}>
                    {getSeverityLabel(event.severity)}
                  </span>
                </td>
                <td>{event.userId || '-'}</td>
                <td>{event.email || '-'}</td>
                <td>{event.ipAddress || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEvent && (
        <div className={styles.modalOverlay} onClick={() => setSelectedEvent(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Event-Details</h2>
              <button
                className={styles.closeButton}
                onClick={() => setSelectedEvent(null)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.detailRow}>
                <strong>Event-Typ:</strong>
                <span>{getEventTypeLabel(selectedEvent.eventType)}</span>
              </div>
              <div className={styles.detailRow}>
                <strong>Severity:</strong>
                <span className={getSeverityBadgeClass(selectedEvent.severity)}>
                  {getSeverityLabel(selectedEvent.severity)}
                </span>
              </div>
              <div className={styles.detailRow}>
                <strong>Zeitpunkt:</strong>
                <span>{formatDateTime(selectedEvent.timestamp)}</span>
              </div>
              {selectedEvent.userId && (
                <div className={styles.detailRow}>
                  <strong>User ID:</strong>
                  <span>{selectedEvent.userId}</span>
                </div>
              )}
              {selectedEvent.email && (
                <div className={styles.detailRow}>
                  <strong>E-Mail:</strong>
                  <span>{selectedEvent.email}</span>
                </div>
              )}
              {selectedEvent.ipAddress && (
                <div className={styles.detailRow}>
                  <strong>IP-Adresse:</strong>
                  <span>{selectedEvent.ipAddress}</span>
                </div>
              )}
              {selectedEvent.userAgent && (
                <div className={styles.detailRow}>
                  <strong>User-Agent:</strong>
                  <span>{selectedEvent.userAgent}</span>
                </div>
              )}
              {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 && (
                <div className={styles.detailRow}>
                  <strong>Details:</strong>
                  <div>
                    <pre className={styles.detailsJson}>
                      {JSON.stringify(selectedEvent.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatsCards({ stats }: { stats: any }) {
  if (!stats) return null;

  return (
    <div className={styles.statsGrid}>
      <div className={styles.statCard}>
        <h3>Fehlgeschlagene Logins</h3>
        <div className={styles.statValue}>{stats.failedLogins.last24h}</div>
        <div className={styles.statLabel}>Letzte 24h</div>
        <div className={styles.statSubValue}>
          {stats.failedLogins.last7d} (7d) / {stats.failedLogins.last30d} (30d)
        </div>
      </div>
      <div className={styles.statCard}>
        <h3>Rate-Limited</h3>
        <div className={styles.statValue}>{stats.rateLimited.current}</div>
        <div className={styles.statLabel}>Aktuell blockiert</div>
        <div className={styles.statSubValue}>
          {stats.rateLimited.last24h} in den letzten 24h
        </div>
      </div>
      <div className={styles.statCard}>
        <h3>Top Event-Typen</h3>
        <div className={styles.statList}>
          {stats.eventTypes.slice(0, 5).map((item: any) => (
            <div key={item.type} className={styles.statListItem}>
              <span>{getEventTypeLabel(item.type)}</span>
              <span className={styles.statListValue}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.statCard}>
        <h3>Top IP-Adressen</h3>
        <div className={styles.statList}>
          {stats.topIpAddresses.slice(0, 5).map((item: any) => (
            <div key={item.ip} className={styles.statListItem}>
              <span>{item.ip}</span>
              <span className={styles.statListValue}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RateLimitsTable({ rateLimits }: { rateLimits: any[] }) {
  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Identifier</th>
            <th>Versuche</th>
            <th>Erster Versuch</th>
            <th>Letzter Versuch</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rateLimits.map((limit) => (
            <tr key={limit.identifier}>
              <td>{limit.identifier}</td>
              <td>{limit.attempts}</td>
              <td>{formatDateTime(limit.firstAttempt)}</td>
              <td>{formatDateTime(limit.lastAttempt)}</td>
              <td>
                {limit.isBlocked ? (
                  <span className={styles.blockedBadge}>
                    Blockiert bis {limit.blockedUntil ? formatDateTime(limit.blockedUntil) : 'unbekannt'}
                  </span>
                ) : (
                  <span className={styles.activeBadge}>Aktiv</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SecurityAuditPage() {
  const [activeTab, setActiveTab] = useState<'events' | 'stats' | 'rateLimits'>('events');
  const [filters, setFilters] = useState<{
    eventType?: SecurityEventType;
    severity?: SecurityEventSeverity;
  }>({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { events, loading: eventsLoading, error: eventsError, refetch: refetchEvents } = useSecurityEvents({
    ...filters,
    limit: 100,
  }, autoRefresh && activeTab === 'events');

  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useSecurityStats(autoRefresh && activeTab === 'stats');
  const { rateLimits, loading: rateLimitsLoading, error: rateLimitsError, refetch: refetchRateLimits } = useRateLimits();

  const handleRefresh = () => {
    setLastRefresh(new Date());
    if (activeTab === 'events') {
      refetchEvents();
    } else if (activeTab === 'stats') {
      refetchStats();
    } else {
      refetchRateLimits();
    }
  };

  const handleFilterChange = (key: 'eventType' | 'severity', value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === '' ? undefined : value,
    }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>🔒 Security Audit</h1>
          <p>Sicherheits-Logs und Audit-Trail für die gesamte Anwendung</p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.autoRefreshToggle}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-Refresh</span>
          </label>
          <button onClick={handleRefresh} className={styles.refreshButton} disabled={eventsLoading || statsLoading || rateLimitsLoading}>
            🔄 Aktualisieren
          </button>
          {lastRefresh && (
            <span className={styles.lastRefresh}>
              Letzte Aktualisierung: {lastRefresh.toLocaleTimeString('de-DE')}
            </span>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={activeTab === 'events' ? styles.activeTab : ''}
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
        <button
          className={activeTab === 'stats' ? styles.activeTab : ''}
          onClick={() => setActiveTab('stats')}
        >
          Statistiken
        </button>
        <button
          className={activeTab === 'rateLimits' ? styles.activeTab : ''}
          onClick={() => setActiveTab('rateLimits')}
        >
          Rate-Limits
        </button>
      </div>

      {activeTab === 'events' && (
        <div className={styles.content}>
          <div className={styles.filters}>
            <select
              value={filters.eventType || ''}
              onChange={(e) => handleFilterChange('eventType', e.target.value)}
            >
              <option value="">Alle Event-Typen</option>
              {Object.values(SECURITY_EVENT_TYPES).map((type) => (
                <option key={type} value={type}>
                  {getEventTypeLabel(type)}
                </option>
              ))}
            </select>
            <select
              value={filters.severity || ''}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
            >
              <option value="">Alle Severities</option>
              {Object.values(SECURITY_EVENT_SEVERITY).map((severity) => (
                <option key={severity} value={severity}>
                  {getSeverityLabel(severity)}
                </option>
              ))}
            </select>
          </div>

          {eventsLoading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              Lade Events...
            </div>
          )}
          {eventsError && (
            <div className={styles.error}>
              <strong>Fehler beim Laden:</strong> {eventsError}
              <button onClick={handleRefresh} className={styles.retryButton}>
                Erneut versuchen
              </button>
            </div>
          )}
          {events && events.events && (
            <>
              <div className={styles.info}>
                {events.count} Events geladen (Gesamt: {events.total || 'unbekannt'})
              </div>
              <EventTable events={events.events} />
            </>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className={styles.content}>
          {statsLoading && <div className={styles.loading}>Lade Statistiken...</div>}
          {statsError && <div className={styles.error}>Fehler: {statsError}</div>}
          {stats && <StatsCards stats={stats} />}
          <button onClick={() => refetchStats()} className={styles.refreshButton}>
            Aktualisieren
          </button>
        </div>
      )}

      {activeTab === 'rateLimits' && (
        <div className={styles.content}>
          {rateLimitsLoading && <div className={styles.loading}>Lade Rate-Limits...</div>}
          {rateLimitsError && <div className={styles.error}>Fehler: {rateLimitsError}</div>}
          {rateLimits && rateLimits.rateLimits && (
            <>
              <div className={styles.info}>
                {rateLimits.count} Rate-Limits aktiv
              </div>
              <RateLimitsTable rateLimits={rateLimits.rateLimits} />
            </>
          )}
          <button onClick={() => refetchRateLimits()} className={styles.refreshButton}>
            Aktualisieren
          </button>
        </div>
      )}
    </div>
  );
}

