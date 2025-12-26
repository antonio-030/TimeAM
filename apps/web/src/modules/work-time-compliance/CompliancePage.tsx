/**
 * Work Time Compliance Page
 *
 * Hauptseite für Compliance-Verwaltung, Verstoß-Erkennung und Prüfungs-Exports.
 * Modernes, benutzerfreundliches Design mit ausführlichen Erklärungen.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  useComplianceStats,
  useViolations,
  useComplianceRules,
  useComplianceCheck,
  useReportGeneration,
  useAuditLogs,
} from './hooks';
import styles from './CompliancePage.module.css';

/**
 * Formatiert ein Datum.
 */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatiert Violation Type für Anzeige.
 */
function formatViolationType(type: string): string {
  const labels: Record<string, string> = {
    REST_PERIOD_VIOLATION: 'Ruhezeit unterschritten',
    SHIFT_DURATION_VIOLATION: 'Schicht zu lang',
    BREAK_MISSING: 'Pause fehlt',
    WEEKLY_REST_VIOLATION: 'Wöchentliche Ruhezeit unterschritten',
    MAX_WORKING_TIME_EXCEEDED: 'Max. Arbeitszeit überschritten',
  };
  return labels[type] || type;
}

/**
 * Beschreibung für Violation Types.
 */
function getViolationDescription(type: string): string {
  const descriptions: Record<string, string> = {
    REST_PERIOD_VIOLATION: 'Zwischen zwei Arbeitstagen müssen mindestens 11 Stunden ununterbrochene Ruhezeit liegen.',
    SHIFT_DURATION_VIOLATION: 'Die tägliche Arbeitszeit darf 8 Stunden nicht überschreiten (10 Stunden mit Ausgleich).',
    BREAK_MISSING: 'Bei einer Arbeitszeit von mehr als 6 Stunden ist eine Pause von mindestens 30 Minuten erforderlich. Bei mehr als 9 Stunden sind 45 Minuten Pause erforderlich.',
    WEEKLY_REST_VIOLATION: 'Innerhalb einer Woche muss eine ununterbrochene Ruhezeit von mindestens 24 Stunden eingehalten werden.',
    MAX_WORKING_TIME_EXCEEDED: 'Die wöchentliche Arbeitszeit darf im Durchschnitt 48 Stunden nicht überschreiten.',
  };
  return descriptions[type] || '';
}

/**
 * Haupt-Komponente.
 */
export function CompliancePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'violations' | 'reports' | 'rules' | 'audit' | 'info'>('overview');
  const [violationFilters, setViolationFilters] = useState<{
    severity?: 'warning' | 'error';
    acknowledged?: boolean;
    violationType?: string;
  }>({});
  
  const { stats, loading: statsLoading } = useComplianceStats();
  const { violations, loading: violationsLoading, acknowledge } = useViolations(violationFilters);
  const { rule, loading: ruleLoading, update: updateRule } = useComplianceRules();
  const { loading: checkLoading, check } = useComplianceCheck();
  const { loading: reportLoading, generate: generateReport } = useReportGeneration();
  const { logs, loading: logsLoading } = useAuditLogs();

  const filteredViolations = useMemo(() => {
    return violations;
  }, [violations]);

  // Keyboard Navigation für Tabs
  const handleTabKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    const tabs: Array<'overview' | 'violations' | 'reports' | 'rules' | 'info' | 'audit'> = [
      'overview',
      'violations',
      'reports',
      'rules',
      'info',
      'audit',
    ];
    const currentIndex = tabs.indexOf(activeTab);
    let newIndex = currentIndex;

    if (e.key === 'ArrowLeft') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      e.preventDefault();
    } else if (e.key === 'Home') {
      newIndex = 0;
      e.preventDefault();
    } else if (e.key === 'End') {
      newIndex = tabs.length - 1;
      e.preventDefault();
    }

    if (newIndex !== currentIndex) {
      setActiveTab(tabs[newIndex]);
      // Fokus auf neuen Tab setzen
      const newTab = document.getElementById(`${tabs[newIndex]}-tab`);
      if (newTab) {
        (newTab as HTMLElement).focus();
      }
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageIcon} aria-hidden="true">⚖️</span>
          Arbeitszeit-Compliance
        </h1>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Compliance-Navigation">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          aria-controls="overview-panel"
          aria-label="Übersicht"
          id="overview-tab"
          className={activeTab === 'overview' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('overview')}
          onKeyDown={(e) => handleTabKeyDown(e, 'overview')}
        >
          <span className={styles.tabIcon} aria-hidden="true">📊</span>
          <span>Übersicht</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'violations'}
          aria-controls="violations-panel"
          aria-label="Verstöße"
          id="violations-tab"
          className={activeTab === 'violations' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('violations')}
          onKeyDown={(e) => handleTabKeyDown(e, 'violations')}
        >
          <span className={styles.tabIcon} aria-hidden="true">⚠️</span>
          <span>Verstöße</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reports'}
          aria-controls="reports-panel"
          aria-label="Prüfmodus"
          id="reports-tab"
          className={activeTab === 'reports' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('reports')}
          onKeyDown={(e) => handleTabKeyDown(e, 'reports')}
        >
          <span className={styles.tabIcon} aria-hidden="true">📄</span>
          <span>Prüfmodus</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'rules'}
          aria-controls="rules-panel"
          aria-label="Regel-Set"
          id="rules-tab"
          className={activeTab === 'rules' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('rules')}
          onKeyDown={(e) => handleTabKeyDown(e, 'rules')}
        >
          <span className={styles.tabIcon} aria-hidden="true">⚙️</span>
          <span>Regel-Set</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'info'}
          aria-controls="info-panel"
          aria-label="Info"
          id="info-tab"
          className={activeTab === 'info' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('info')}
          onKeyDown={(e) => handleTabKeyDown(e, 'info')}
        >
          <span className={styles.tabIcon} aria-hidden="true">ℹ️</span>
          <span>Info</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'audit'}
          aria-controls="audit-panel"
          aria-label="Audit"
          id="audit-tab"
          className={activeTab === 'audit' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('audit')}
          onKeyDown={(e) => handleTabKeyDown(e, 'audit')}
        >
          <span className={styles.tabIcon} aria-hidden="true">🔍</span>
          <span>Audit</span>
        </button>
      </nav>

      <main className={styles.content}>
        <div
          role="tabpanel"
          id="overview-panel"
          aria-labelledby="overview-tab"
          hidden={activeTab !== 'overview'}
        >
          {activeTab === 'overview' && (
            <OverviewSection stats={stats} loading={statsLoading} rule={rule} />
          )}
        </div>

        <div
          role="tabpanel"
          id="violations-panel"
          aria-labelledby="violations-tab"
          hidden={activeTab !== 'violations'}
        >
          {activeTab === 'violations' && (
            <ViolationsSection
              violations={filteredViolations}
              loading={violationsLoading}
              onAcknowledge={acknowledge}
              filters={violationFilters}
              onFiltersChange={setViolationFilters}
            />
          )}
        </div>

        <div
          role="tabpanel"
          id="reports-panel"
          aria-labelledby="reports-tab"
          hidden={activeTab !== 'reports'}
        >
          {activeTab === 'reports' && (
            <ReportsSection
              loading={reportLoading}
              onGenerate={generateReport}
            />
          )}
        </div>

        <div
          role="tabpanel"
          id="rules-panel"
          aria-labelledby="rules-tab"
          hidden={activeTab !== 'rules'}
        >
          {activeTab === 'rules' && (
            <RulesSection
              rule={rule}
              loading={ruleLoading}
              onUpdate={updateRule}
            />
          )}
        </div>

        <div
          role="tabpanel"
          id="info-panel"
          aria-labelledby="info-tab"
          hidden={activeTab !== 'info'}
        >
          {activeTab === 'info' && (
            <InfoSection rule={rule} />
          )}
        </div>

        <div
          role="tabpanel"
          id="audit-panel"
          aria-labelledby="audit-tab"
          hidden={activeTab !== 'audit'}
        >
          {activeTab === 'audit' && (
            <AuditSection logs={logs} loading={logsLoading} />
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Übersichts-Section mit erweiterten Statistiken.
 */
function OverviewSection({ stats, loading, rule }: { stats: any; loading: boolean; rule: any }) {
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Lädt Statistiken...</p>
      </div>
    );
  }

  if (!stats) {
    return <div className={styles.error}>Keine Daten verfügbar</div>;
  }

  const hasViolations = stats.today.violations > 0 || stats.thisWeek.violations > 0;

  return (
    <div className={styles.section}>
      {/* Status-Banner */}
      <div className={`${styles.statusBanner} ${hasViolations ? styles.statusBannerWarning : styles.statusBannerSuccess}`}>
        <div className={styles.statusBannerIcon}>
          {hasViolations ? '⚠️' : '✅'}
        </div>
        <div className={styles.statusBannerContent}>
          <h3>{hasViolations ? 'Verstöße erkannt' : 'Alle Regeln eingehalten'}</h3>
          <p>
            {hasViolations
              ? `Es wurden ${stats.today.violations + stats.thisWeek.violations} Verstöße in den letzten 7 Tagen erkannt.`
              : 'Alle Arbeitszeitregeln werden aktuell eingehalten.'}
          </p>
        </div>
      </div>

      {/* Statistiken Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <span className={styles.statCardIcon}>📅</span>
            <h3>Heute</h3>
          </div>
          <div className={styles.statCardValue}>{stats.today.violations}</div>
          <div className={styles.statCardLabel}>Verstöße</div>
          <div className={styles.statCardDetails}>
            <span className={styles.badgeWarning}>{stats.today.warnings} Warnungen</span>
            <span className={styles.badgeError}>{stats.today.errors} Fehler</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <span className={styles.statCardIcon}>📆</span>
            <h3>Diese Woche</h3>
          </div>
          <div className={styles.statCardValue}>{stats.thisWeek.violations}</div>
          <div className={styles.statCardLabel}>Verstöße</div>
          <div className={styles.statCardDetails}>
            <span className={styles.badgeWarning}>{stats.thisWeek.warnings} Warnungen</span>
            <span className={styles.badgeError}>{stats.thisWeek.errors} Fehler</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardHeader}>
            <span className={styles.statCardIcon}>🗓️</span>
            <h3>Dieser Monat</h3>
          </div>
          <div className={styles.statCardValue}>{stats.thisMonth.violations}</div>
          <div className={styles.statCardLabel}>Verstöße</div>
          <div className={styles.statCardDetails}>
            <span className={styles.badgeWarning}>{stats.thisMonth.warnings} Warnungen</span>
            <span className={styles.badgeError}>{stats.thisMonth.errors} Fehler</span>
          </div>
        </div>
      </div>

      {/* Verstöße nach Typ */}
      {stats.violationsByType.length > 0 && (
        <div className={styles.violationsByTypeCard}>
          <h3 className={styles.cardTitle}>
            <span className={styles.cardTitleIcon}>📊</span>
            Verstöße nach Typ
          </h3>
          <div className={styles.violationsByTypeGrid}>
            {stats.violationsByType.map((item: any) => (
              <div key={item.type} className={styles.violationTypeItem}>
                <div className={styles.violationTypeName}>
                  {formatViolationType(item.type)}
                </div>
                <div className={styles.violationTypeCount}>{item.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Info */}
      <div className={styles.infoCard}>
        <h3 className={styles.cardTitle}>
          <span className={styles.cardTitleIcon}>ℹ️</span>
          Aktives Regel-Set
        </h3>
        <p className={styles.infoText}>
          Es wird aktuell das <strong>{rule?.ruleSet?.toUpperCase() || 'EU'}</strong>-Regel-Set verwendet.
          Dieses basiert auf der{' '}
          {rule?.ruleSet === 'de' 
            ? 'deutschen Arbeitszeitgesetz (ArbZG)'
            : 'EU Working Time Directive (2003/88/EG)'}.
        </p>
      </div>
    </div>
  );
}

/**
 * Verstöße-Section mit Filtern.
 */
function ViolationsSection({
  violations,
  loading,
  onAcknowledge,
  filters,
  onFiltersChange,
}: {
  violations: any[];
  loading: boolean;
  onAcknowledge: (id: string, acknowledged: boolean) => Promise<void>;
  filters: any;
  onFiltersChange: (filters: any) => void;
}) {
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const handleAcknowledge = async (id: string) => {
    setAcknowledging(id);
    try {
      await onAcknowledge(id, true);
    } finally {
      setAcknowledging(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Lädt Verstöße...</p>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Erkannte Verstöße</h2>
        <p className={styles.sectionDescription}>
          Automatisch erkannte Verstöße gegen Arbeitszeitregeln. Verstöße können als erkannt markiert werden.
        </p>
      </div>

      {/* Filter */}
      <div className={styles.filtersCard}>
        <h3>Filter</h3>
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label>Severity:</label>
            <select
              value={filters.severity || ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  severity: e.target.value || undefined,
                })
              }
            >
              <option value="">Alle</option>
              <option value="warning">Nur Warnungen</option>
              <option value="error">Nur Fehler</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label>Status:</label>
            <select
              value={filters.acknowledged === undefined ? '' : filters.acknowledged ? 'acknowledged' : 'open'}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  acknowledged: e.target.value === '' ? undefined : e.target.value === 'acknowledged',
                })
              }
            >
              <option value="">Alle</option>
              <option value="open">Offen</option>
              <option value="acknowledged">Erkannt</option>
            </select>
          </div>
        </div>
      </div>

      {/* Verstöße Liste */}
      <div className={styles.violationsList}>
        {violations.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>✅</div>
            <h3>Keine Verstöße gefunden</h3>
            <p>Alle Arbeitszeitregeln werden eingehalten.</p>
          </div>
        ) : (
          violations.map((violation) => (
            <div
              key={violation.id}
              className={`${styles.violationCard} ${
                violation.severity === 'error' ? styles.violationCardError : styles.violationCardWarning
              } ${violation.acknowledgedAt ? styles.violationCardAcknowledged : ''}`}
            >
              <div className={styles.violationCardHeader}>
                <div className={styles.violationCardTitle}>
                  <span className={styles.violationIcon}>
                    {violation.severity === 'error' ? '🔴' : '🟡'}
                  </span>
                  <h3>{formatViolationType(violation.violationType)}</h3>
                </div>
                <div className={styles.violationCardBadges}>
                  <span
                    className={
                      violation.severity === 'error'
                        ? styles.badgeError
                        : styles.badgeWarning
                    }
                  >
                    {violation.severity === 'error' ? 'Fehler' : 'Warnung'}
                  </span>
                  {violation.acknowledgedAt && (
                    <span className={styles.badgeSuccess}>Erkannt</span>
                  )}
                </div>
              </div>

              <div className={styles.violationCardBody}>
                <p className={styles.violationDescription}>
                  {getViolationDescription(violation.violationType)}
                </p>

                <div className={styles.violationDetails}>
                  <div className={styles.violationDetailItem}>
                    <span className={styles.violationDetailLabel}>Erwartet:</span>
                    <span className={styles.violationDetailValue}>
                      {violation.details.expected}
                    </span>
                  </div>
                  <div className={styles.violationDetailItem}>
                    <span className={styles.violationDetailLabel}>Tatsächlich:</span>
                    <span className={styles.violationDetailValue}>
                      {violation.details.actual}
                    </span>
                  </div>
                  <div className={styles.violationDetailItem}>
                    <span className={styles.violationDetailLabel}>Erkannt am:</span>
                    <span className={styles.violationDetailValue}>
                      {formatDate(violation.detectedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {!violation.acknowledgedAt && (
                <div className={styles.violationCardActions}>
                  <button
                    type="button"
                    onClick={() => handleAcknowledge(violation.id)}
                    disabled={acknowledging === violation.id}
                    className={styles.acknowledgeBtn}
                  >
                    {acknowledging === violation.id ? 'Wird markiert...' : 'Als erkannt markieren'}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Reports-Section mit erweitertem Formular.
 */
function ReportsSection({
  loading,
  onGenerate,
}: {
  loading: boolean;
  onGenerate: (data: any) => Promise<any>;
}) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [format, setFormat] = useState<'csv' | 'pdf'>('pdf');
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Setze Standard-Zeitraum (letzter Monat)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    setPeriodStart(start.toISOString().split('T')[0]);
    setPeriodEnd(end.toISOString().split('T')[0]);
  }, []);

  const handleGenerate = async () => {
    if (!periodStart || !periodEnd) {
      setError('Bitte wählen Sie einen Zeitraum aus');
      return;
    }

    if (new Date(periodStart) > new Date(periodEnd)) {
      setError('Das Startdatum muss vor dem Enddatum liegen');
      return;
    }

    setError(null);
    try {
      const report = await onGenerate({
        periodStart,
        periodEnd,
        format,
      });
      setGeneratedReport(report);
    } catch (err) {
      setError('Fehler bei der Report-Generierung. Bitte versuchen Sie es erneut.');
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Prüfmodus: Audit-Report generieren</h2>
        <p className={styles.sectionDescription}>
          Generieren Sie einen unveränderbaren Compliance-Report für Prüfungen und Audits.
          Der Report enthält alle erkannten Verstöße im gewählten Zeitraum.
        </p>
      </div>

      <div className={styles.reportCard}>
        <h3 className={styles.cardTitle}>Report-Einstellungen</h3>
        <div className={styles.reportForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>
                <span className={styles.labelIcon}>📅</span>
                Startdatum
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className={styles.formInput}
              />
            </div>
            <div className={styles.formGroup}>
              <label>
                <span className={styles.labelIcon}>📅</span>
                Enddatum
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className={styles.formInput}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>
              <span className={styles.labelIcon}>📄</span>
              Export-Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'csv' | 'pdf')}
              className={styles.formInput}
            >
              <option value="pdf">PDF (für Prüfungen empfohlen)</option>
              <option value="csv">CSV (für Excel-Import)</option>
            </select>
            <p className={styles.formHint}>
              PDF-Reports sind unveränderbar und enthalten einen Hash für die Integritätsprüfung.
            </p>
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !periodStart || !periodEnd}
            className={styles.generateBtn}
          >
            {loading ? (
              <>
                <span className={styles.btnSpinner}></span>
                Generiert...
              </>
            ) : (
              <>
                <span>📊</span>
                Report generieren
              </>
            )}
          </button>

          {generatedReport && (
            <div className={styles.reportResult}>
              <div className={styles.reportResultIcon}>✅</div>
              <div className={styles.reportResultContent}>
                <h4>Report erfolgreich generiert!</h4>
                <p>
                  Der Report wurde erstellt und ist für 1 Stunde verfügbar.
                  Hash: <code className={styles.hashCode}>{generatedReport.hash.substring(0, 16)}...</code>
                </p>
                <a
                  href={generatedReport.downloadUrl}
                  download
                  className={styles.downloadBtn}
                >
                  <span>⬇️</span>
                  Download ({generatedReport.format.toUpperCase()})
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Rules-Section mit detaillierter Anzeige.
 */
function RulesSection({
  rule,
  loading,
  onUpdate,
}: {
  rule: any;
  loading: boolean;
  onUpdate: (data: any) => Promise<any>;
}) {
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Lädt Regel-Set...</p>
      </div>
    );
  }

  if (!rule) {
    return <div className={styles.error}>Keine Regel gefunden</div>;
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Compliance-Regel-Set</h2>
        <p className={styles.sectionDescription}>
          Konfiguration der Arbeitszeitregeln basierend auf EU/DE-Gesetzgebung.
        </p>
      </div>

      <div className={styles.ruleCard}>
        <div className={styles.ruleCardHeader}>
          <div className={styles.ruleSetBadge}>
            {rule.ruleSet.toUpperCase()}
          </div>
          <h3>
            {rule.ruleSet === 'de'
              ? 'Deutsches Arbeitszeitgesetz (ArbZG)'
              : 'EU Working Time Directive'}
          </h3>
        </div>

        <div className={styles.rulesGrid}>
          <div className={styles.ruleItem}>
            <div className={styles.ruleItemIcon}>🌙</div>
            <div className={styles.ruleItemContent}>
              <h4>Tägliche Ruhezeit</h4>
              <p className={styles.ruleItemValue}>
                {rule.config.dailyRestPeriodMinutes / 60} Stunden
              </p>
              <p className={styles.ruleItemDescription}>
                Zwischen zwei Arbeitstagen muss eine ununterbrochene Ruhezeit von mindestens{' '}
                {rule.config.dailyRestPeriodMinutes / 60} Stunden eingehalten werden.
              </p>
            </div>
          </div>

          <div className={styles.ruleItem}>
            <div className={styles.ruleItemIcon}>📅</div>
            <div className={styles.ruleItemContent}>
              <h4>Wöchentliche Ruhezeit</h4>
              <p className={styles.ruleItemValue}>
                {rule.config.weeklyRestPeriodMinutes / 60} Stunden
              </p>
              <p className={styles.ruleItemDescription}>
                Innerhalb einer Woche muss eine ununterbrochene Ruhezeit von mindestens{' '}
                {rule.config.weeklyRestPeriodMinutes / 60} Stunden eingehalten werden.
              </p>
            </div>
          </div>

          <div className={styles.ruleItem}>
            <div className={styles.ruleItemIcon}>⏰</div>
            <div className={styles.ruleItemContent}>
              <h4>Max. tägliche Arbeitszeit</h4>
              <p className={styles.ruleItemValue}>
                {rule.config.maxDailyWorkingTimeMinutes / 60} Stunden
              </p>
              <p className={styles.ruleItemDescription}>
                Die tägliche Arbeitszeit darf {rule.config.maxDailyWorkingTimeMinutes / 60} Stunden
                nicht überschreiten. Mit Ausgleich sind bis zu{' '}
                {rule.config.maxDailyWorkingTimeWithCompensationMinutes / 60} Stunden möglich.
              </p>
            </div>
          </div>

          <div className={styles.ruleItem}>
            <div className={styles.ruleItemIcon}>☕</div>
            <div className={styles.ruleItemContent}>
              <h4>Pausenregelung</h4>
              <p className={styles.ruleItemValue}>
                {rule.config.breakDurationMinutes} Min. ab {rule.config.breakRequiredAfterMinutes / 60}h
              </p>
              <p className={styles.ruleItemDescription}>
                Bei einer Arbeitszeit von mehr als {rule.config.breakRequiredAfterMinutes / 60} Stunden
                ist eine Pause von mindestens {rule.config.breakDurationMinutes} Minuten erforderlich.
                {rule.config.breakRequiredAfterMinutes2 && (
                  <>
                    {' '}Bei mehr als {rule.config.breakRequiredAfterMinutes2 / 60} Stunden sind{' '}
                    {rule.config.breakDurationMinutes2} Minuten Pause erforderlich.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className={styles.ruleItem}>
            <div className={styles.ruleItemIcon}>📊</div>
            <div className={styles.ruleItemContent}>
              <h4>Max. wöchentliche Arbeitszeit</h4>
              <p className={styles.ruleItemValue}>
                {rule.config.maxWeeklyWorkingTimeMinutes / 60} Stunden
              </p>
              <p className={styles.ruleItemDescription}>
                Die wöchentliche Arbeitszeit darf im Durchschnitt {rule.config.maxWeeklyWorkingTimeMinutes / 60} Stunden
                nicht überschreiten.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.ruleCardFooter}>
          <p className={styles.ruleCardFooterText}>
            Zuletzt aktualisiert: {rule.updatedAt ? formatDate(rule.updatedAt) : 'Nie'}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Info-Section mit Erklärungen.
 */
function InfoSection({ rule }: { rule: any }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Über Arbeitszeit-Compliance</h2>
        <p className={styles.sectionDescription}>
          Erfahren Sie mehr über das Compliance-Modul und die Arbeitszeitregeln.
        </p>
      </div>

      <div className={styles.infoSection}>
        <div className={styles.infoCard}>
          <h3 className={styles.cardTitle}>
            <span className={styles.cardTitleIcon}>🎯</span>
            Zweck des Moduls
          </h3>
          <div className={styles.infoContent}>
            <p>
              Das Arbeitszeit-Compliance-Modul überwacht automatisch die Einhaltung der
              EU- und deutschen Arbeitszeitregeln. Es erkennt Verstöße in Echtzeit und
              ermöglicht die Generierung von audit-fertigen Reports für Prüfungen.
            </p>
            <p>
              <strong>Hauptfunktionen:</strong>
            </p>
            <ul className={styles.featureList}>
              <li>✅ Automatische Verstoß-Erkennung bei Clock-In/Out und Schicht-Beendigung</li>
              <li>✅ Echtzeit-Warnungen bei Regelverstößen</li>
              <li>✅ Unveränderbare Audit-Timeline für Prüfungen</li>
              <li>✅ Export-Funktionen (CSV/PDF) für Compliance-Reports</li>
              <li>✅ Konfigurierbare Regel-Sets (EU, DE, erweiterbar)</li>
            </ul>
          </div>
        </div>

        <div className={styles.infoCard}>
          <h3 className={styles.cardTitle}>
            <span className={styles.cardTitleIcon}>📋</span>
            Arbeitszeitregeln
          </h3>
          <div className={styles.infoContent}>
            <p>
              Das Modul prüft automatisch die Einhaltung folgender Regeln:
            </p>

            <div className={styles.ruleExplanation}>
              <h4>🌙 Tägliche Ruhezeit (11 Stunden)</h4>
              <p>
                Zwischen zwei Arbeitstagen muss eine ununterbrochene Ruhezeit von mindestens 11 Stunden liegen.
                Diese Regel schützt die Gesundheit der Arbeitnehmer und gewährleistet ausreichend Erholung.
              </p>
            </div>

            <div className={styles.ruleExplanation}>
              <h4>📅 Wöchentliche Ruhezeit (24 Stunden)</h4>
              <p>
                Innerhalb einer Woche muss eine ununterbrochene Ruhezeit von mindestens 24 Stunden eingehalten werden.
                In Deutschland ist dies typischerweise der Sonntag.
              </p>
            </div>

            <div className={styles.ruleExplanation}>
              <h4>⏰ Maximale tägliche Arbeitszeit (8/10 Stunden)</h4>
              <p>
                Die tägliche Arbeitszeit darf 8 Stunden nicht überschreiten. Mit Ausgleich sind bis zu 10 Stunden möglich,
                wenn innerhalb von 6 Monaten ein Ausgleich erfolgt.
              </p>
            </div>

            <div className={styles.ruleExplanation}>
              <h4>☕ Pausenregelung</h4>
              <p>
                Bei einer Arbeitszeit von mehr als 6 Stunden ist eine Pause von mindestens 30 Minuten erforderlich.
                Bei mehr als 9 Stunden sind 45 Minuten Pause erforderlich.
              </p>
            </div>

            <div className={styles.ruleExplanation}>
              <h4>📊 Maximale wöchentliche Arbeitszeit (48 Stunden)</h4>
              <p>
                Die wöchentliche Arbeitszeit darf im Durchschnitt 48 Stunden nicht überschreiten.
                Dies wird über einen Referenzzeitraum von mehreren Wochen berechnet.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.infoCard}>
          <h3 className={styles.cardTitle}>
            <span className={styles.cardTitleIcon}>⚖️</span>
            Rechtliche Grundlage
          </h3>
          <div className={styles.infoContent}>
            <p>
              <strong>EU Working Time Directive (2003/88/EG):</strong>
            </p>
            <p>
              Die EU-Arbeitszeitrichtlinie legt Mindeststandards für die Arbeitszeit in der Europäischen Union fest.
              Sie gilt für alle Mitgliedstaaten und kann durch nationale Gesetze verschärft werden.
            </p>
            <p>
              <strong>Deutsches Arbeitszeitgesetz (ArbZG):</strong>
            </p>
            <p>
              Das deutsche Arbeitszeitgesetz setzt die EU-Richtlinie um und enthält zusätzliche Regelungen.
              Es schützt die Gesundheit der Arbeitnehmer und regelt die Arbeitszeit, Ruhezeiten und Pausen.
            </p>
            <p className={styles.legalNote}>
              <strong>Hinweis:</strong> Dieses Modul dient der Unterstützung bei der Einhaltung der Arbeitszeitregeln.
              Es ersetzt keine rechtliche Beratung. Bei Fragen zur Anwendung der Regeln in Ihrem spezifischen Fall
              konsultieren Sie bitte einen Rechtsanwalt oder die zuständige Behörde.
            </p>
          </div>
        </div>

        <div className={styles.infoCard}>
          <h3 className={styles.cardTitle}>
            <span className={styles.cardTitleIcon}>🔍</span>
            Wie funktioniert die Verstoß-Erkennung?
          </h3>
          <div className={styles.infoContent}>
            <p>
              Die Verstoß-Erkennung erfolgt automatisch in folgenden Situationen:
            </p>
            <ul className={styles.featureList}>
              <li>
                <strong>Bei Clock-In:</strong> Prüfung der Ruhezeit seit dem letzten Clock-Out
              </li>
              <li>
                <strong>Bei Clock-Out:</strong> Prüfung der Schichtdauer und Pausenregelungen
              </li>
              <li>
                <strong>Bei Schicht-Beendigung:</strong> Vollständige Compliance-Prüfung für alle zugewiesenen Mitarbeiter
              </li>
              <li>
                <strong>Bei manueller Zeiteintrag-Erstellung:</strong> Vollständige Compliance-Prüfung
              </li>
              <li>
                <strong>Bei manueller Prüfung:</strong> Prüfung eines beliebigen Zeitraums
              </li>
            </ul>
            <p>
              Erkannte Verstöße werden automatisch gespeichert und können in der Verstöße-Ansicht eingesehen werden.
              Die Verstoß-Erkennung läuft asynchron und blockiert nicht die normale Nutzung der Zeiterfassung.
            </p>
          </div>
        </div>

        <div className={styles.infoCard}>
          <h3 className={styles.cardTitle}>
            <span className={styles.cardTitleIcon}>📄</span>
            Prüfmodus und Audit-Reports
          </h3>
          <div className={styles.infoContent}>
            <p>
              Der Prüfmodus ermöglicht die Generierung von audit-fertigen Reports für Prüfungen und Audits.
            </p>
            <p>
              <strong>Features:</strong>
            </p>
            <ul className={styles.featureList}>
              <li>✅ Wählbarer Zeitraum (Woche, Monat, Custom)</li>
              <li>✅ Filter nach User, Verstoß-Typ, Status</li>
              <li>✅ Export-Formate: CSV (für Excel) und PDF (für Prüfungen)</li>
              <li>✅ Unveränderbare Audit-Timeline</li>
              <li>✅ SHA-256 Hash für Integritätsprüfung</li>
            </ul>
            <p>
              Jeder generierte Report wird in der Audit-Timeline gespeichert und kann nicht verändert werden.
              Dies gewährleistet die Nachvollziehbarkeit und Unveränderbarkeit der Compliance-Daten.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Audit-Section mit verbesserter Anzeige.
 */
function AuditSection({ logs, loading }: { logs: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Lädt Audit-Logs...</p>
      </div>
    );
  }

  const formatAction = (action: string): string => {
    const labels: Record<string, string> = {
      report_generated: 'Report generiert',
      violation_acknowledged: 'Verstoß erkannt',
      rule_set_changed: 'Regel-Set geändert',
      manual_check: 'Manuelle Prüfung',
    };
    return labels[action] || action;
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Audit-Timeline</h2>
        <p className={styles.sectionDescription}>
          Unveränderbare Timeline aller Compliance-Aktivitäten. Jede Aktion wird permanent protokolliert.
        </p>
      </div>

      <div className={styles.auditTimeline}>
        {logs.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>📋</div>
            <h3>Keine Audit-Logs gefunden</h3>
            <p>Noch keine Compliance-Aktivitäten protokolliert.</p>
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={log.id} className={styles.auditLogItem}>
              <div className={styles.auditLogTimeline}>
                <div className={styles.auditLogDot}></div>
                {index < logs.length - 1 && <div className={styles.auditLogLine}></div>}
              </div>
              <div className={styles.auditLogContent}>
                <div className={styles.auditLogHeader}>
                  <span className={styles.auditLogAction}>
                    {formatAction(log.action)}
                  </span>
                  <span className={styles.auditLogDate}>
                    {formatDate(log.timestamp)}
                  </span>
                </div>
                {log.details.reportId && (
                  <div className={styles.auditLogDetails}>
                    Report-ID: <code>{log.details.reportId}</code>
                  </div>
                )}
                {log.details.violationId && (
                  <div className={styles.auditLogDetails}>
                    Verstoß-ID: <code>{log.details.violationId}</code>
                  </div>
                )}
                {log.details.exportFormat && (
                  <div className={styles.auditLogDetails}>
                    Format: {log.details.exportFormat.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
