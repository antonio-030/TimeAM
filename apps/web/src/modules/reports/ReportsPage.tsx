/**
 * Reports & Analytics Page
 *
 * Dashboard mit Statistiken, Trends und Auswertungen.
 * Barrierefrei gestaltet mit ARIA-Labels und Keyboard-Navigation.
 */

import { useState, useId } from 'react';
import { useDashboardWidgets, useTimeSummaryReport, useMemberActivityReport } from './hooks';
import type { ReportPeriod } from './api';
import styles from './ReportsPage.module.css';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Formatiert Minuten als "Xh Ym".
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

/**
 * Formatiert ein Datum.
 */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formatiert Wochentag kurz.
 */
function formatWeekday(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    weekday: 'short',
  });
}

/**
 * Gibt die Initialen eines Namens zurück.
 */
function getInitials(name: string): string {
  return name
    .split(/[\s@]+/)
    .map(part => part[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');
}

/**
 * Periode-Labels.
 */
const PERIOD_LABELS: Record<ReportPeriod, string> = {
  today: 'Heute',
  yesterday: 'Gestern',
  this_week: 'Diese Woche',
  last_week: 'Letzte Woche',
  this_month: 'Dieser Monat',
  last_month: 'Letzter Monat',
  custom: 'Benutzerdefiniert',
};

// =============================================================================
// Components
// =============================================================================

interface PeriodSelectorProps {
  value: ReportPeriod;
  onChange: (period: ReportPeriod) => void;
}

function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const periods: ReportPeriod[] = ['today', 'this_week', 'this_month', 'last_month'];
  
  return (
    <div 
      className={styles.periodSelector}
      role="group"
      aria-label="Zeitraum auswählen"
    >
      {periods.map((period) => (
        <button
          key={period}
          type="button"
          className={`${styles.periodBtn} ${value === period ? styles.periodBtnActive : ''}`}
          onClick={() => onChange(period)}
          aria-pressed={value === period}
          aria-label={`Zeitraum: ${PERIOD_LABELS[period]}`}
        >
          {PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

type TabType = 'overview' | 'time' | 'members';

const TAB_LABELS: Record<TabType, { icon: string; label: string }> = {
  overview: { icon: '📊', label: 'Übersicht' },
  time: { icon: '⏱️', label: 'Zeiterfassung' },
  members: { icon: '👥', label: 'Mitarbeiter' },
};

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [period, setPeriod] = useState<ReportPeriod>('this_week');
  const tabId = useId();
  
  const { data: dashboard, loading: dashboardLoading, error: dashboardError, refresh: refreshDashboard } = useDashboardWidgets();
  const { report: timeReport, loading: timeLoading, error: timeError, loadReport: loadTimeReport } = useTimeSummaryReport(period);
  const { report: memberReport, loading: memberLoading, error: memberError, loadReport: loadMemberReport } = useMemberActivityReport(period);

  const handlePeriodChange = (newPeriod: ReportPeriod) => {
    setPeriod(newPeriod);
    loadTimeReport(newPeriod);
    loadMemberReport(newPeriod);
  };

  const handleRefresh = () => {
    refreshDashboard();
    loadTimeReport(period);
    loadMemberReport(period);
  };

  // Keyboard Navigation für Tabs
  const handleTabKeyDown = (e: React.KeyboardEvent, tabs: TabType[]) => {
    const currentIndex = tabs.indexOf(activeTab);
    let newIndex = currentIndex;

    if (e.key === 'ArrowLeft') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
    } else if (e.key === 'ArrowRight') {
      newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
    } else if (e.key === 'Home') {
      newIndex = 0;
    } else if (e.key === 'End') {
      newIndex = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    setActiveTab(tabs[newIndex]);
  };

  // Max minutes for chart scaling
  const maxMinutes = dashboard?.weeklyTrend.reduce((max, day) => Math.max(max, day.totalMinutes), 0) || 1;
  const maxMemberMinutes = dashboard?.topMembers[0]?.totalMinutes || 1;

  const tabs: TabType[] = ['overview', 'time', 'members'];

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            <span className={styles.pageIcon} aria-hidden="true">📈</span>
            Berichte & Analytics
          </h1>
          {timeReport && (
            <p className={styles.dateRange} aria-live="polite">
              Zeitraum: {formatDate(timeReport.startDate)} – {formatDate(timeReport.endDate)}
            </p>
          )}
        </div>
        <div className={styles.headerActions}>
          <PeriodSelector value={period} onChange={handlePeriodChange} />
          <button 
            type="button"
            className={styles.refreshBtn} 
            onClick={handleRefresh}
            aria-label="Daten aktualisieren"
          >
            <span aria-hidden="true">🔄</span>
            Aktualisieren
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div 
        className={styles.tabs}
        role="tablist"
        aria-label="Report-Ansichten"
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`${tabId}-tab-${tab}`}
            aria-controls={`${tabId}-panel-${tab}`}
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(e) => handleTabKeyDown(e, tabs)}
          >
            <span aria-hidden="true">{TAB_LABELS[tab].icon}</span>
            {TAB_LABELS[tab].label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className={styles.contentGrid}>
        {/* Overview Tab Panel */}
        <div
          role="tabpanel"
          id={`${tabId}-panel-overview`}
          aria-labelledby={`${tabId}-tab-overview`}
          hidden={activeTab !== 'overview'}
          tabIndex={0}
        >
          {activeTab === 'overview' && (
            <>
              {/* Dashboard Widgets */}
              <section aria-label="Kennzahlen-Übersicht">
                <div className={styles.dashboardGrid}>
                  {/* Widget: Arbeitszeit heute */}
                  <article 
                    className={styles.widgetCard}
                    aria-label={`Arbeitszeit heute: ${dashboardLoading ? 'Wird geladen' : formatDuration(dashboard?.todayStats.totalTimeMinutes || 0)}`}
                  >
                    <div className={styles.widgetIcon} aria-hidden="true">⏱️</div>
                    <h2 className={styles.widgetTitle}>Arbeitszeit heute</h2>
                    {dashboardLoading ? (
                      <div className={styles.widgetValue} aria-busy="true">--</div>
                    ) : (
                      <>
                        <div className={styles.widgetValue}>
                          {formatDuration(dashboard?.todayStats.totalTimeMinutes || 0)}
                        </div>
                        <p className={styles.widgetSubtext}>
                          {dashboard?.todayStats.runningEntries || 0} laufend
                        </p>
                      </>
                    )}
                  </article>

                  {/* Widget: Aktive Nutzer */}
                  <article 
                    className={styles.widgetCard}
                    aria-label={`Aktive Nutzer: ${dashboardLoading ? 'Wird geladen' : dashboard?.todayStats.activeUsers || 0}`}
                  >
                    <div className={styles.widgetIcon} aria-hidden="true">👥</div>
                    <h2 className={styles.widgetTitle}>Aktive Nutzer</h2>
                    {dashboardLoading ? (
                      <div className={styles.widgetValue} aria-busy="true">--</div>
                    ) : (
                      <>
                        <div className={styles.widgetValue}>
                          {dashboard?.todayStats.activeUsers || 0}
                        </div>
                        <p className={styles.widgetSubtext}>heute eingestempelt</p>
                      </>
                    )}
                  </article>

                  {/* Widget: Zeiteinträge */}
                  <article 
                    className={styles.widgetCard}
                    aria-label={`Zeiteinträge ${PERIOD_LABELS[period]}: ${timeLoading ? 'Wird geladen' : timeReport?.stats.totalEntries || 0}`}
                  >
                    <div className={styles.widgetIcon} aria-hidden="true">📋</div>
                    <h2 className={styles.widgetTitle}>Zeiteinträge ({PERIOD_LABELS[period]})</h2>
                    {timeLoading ? (
                      <div className={styles.widgetValue} aria-busy="true">--</div>
                    ) : (
                      <>
                        <div className={styles.widgetValue}>
                          {timeReport?.stats.totalEntries || 0}
                        </div>
                        <p className={styles.widgetSubtext}>
                          {formatDuration(timeReport?.stats.totalMinutes || 0)} gesamt
                        </p>
                      </>
                    )}
                  </article>

                  {/* Widget: Durchschnitt */}
                  <article 
                    className={styles.widgetCard}
                    aria-label={`Durchschnitt pro Tag: ${timeLoading ? 'Wird geladen' : formatDuration(timeReport?.stats.averageMinutesPerDay || 0)}`}
                  >
                    <div className={styles.widgetIcon} aria-hidden="true">📊</div>
                    <h2 className={styles.widgetTitle}>Durchschnitt/Tag</h2>
                    {timeLoading ? (
                      <div className={styles.widgetValue} aria-busy="true">--</div>
                    ) : (
                      <>
                        <div className={styles.widgetValue}>
                          {formatDuration(timeReport?.stats.averageMinutesPerDay || 0)}
                        </div>
                        <p className={styles.widgetSubtext}>
                          {timeReport?.stats.daysWithEntries || 0} Tage mit Einträgen
                        </p>
                      </>
                    )}
                  </article>
                </div>
              </section>

              {/* Chart & Top Members */}
              <div className={styles.twoColumns}>
                {/* Weekly Trend Chart */}
                <section className={styles.chartCard} aria-label="Wöchentlicher Trend Diagramm">
                  <h3 className={styles.chartTitle}>
                    <span aria-hidden="true">📈</span>
                    Wöchentlicher Trend
                  </h3>
                  {dashboardLoading ? (
                    <div className={styles.loading} role="status" aria-live="polite">
                      <div className={styles.loadingSpinner} aria-hidden="true" />
                      <span>Daten werden geladen...</span>
                    </div>
                  ) : dashboardError ? (
                    <div className={styles.error} role="alert">
                      {dashboardError}
                    </div>
                  ) : dashboard?.weeklyTrend.length === 0 ? (
                    <div className={styles.empty}>
                      <span className={styles.emptyIcon} aria-hidden="true">📭</span>
                      <p className={styles.emptyText}>Keine Daten vorhanden</p>
                    </div>
                  ) : (
                    <div 
                      className={styles.chartContainer}
                      role="img"
                      aria-label={`Balkendiagramm: Arbeitszeit der letzten Woche. ${dashboard?.weeklyTrend.map(d => `${formatWeekday(d.date)}: ${formatDuration(d.totalMinutes)}`).join(', ')}`}
                    >
                      {dashboard?.weeklyTrend.map((day) => (
                        <div 
                          key={day.date} 
                          className={styles.chartBar}
                          title={`${formatWeekday(day.date)}: ${formatDuration(day.totalMinutes)}`}
                        >
                          <div 
                            className={styles.chartBarFill}
                            style={{ height: `${(day.totalMinutes / maxMinutes) * 100}%` }}
                          />
                          <span className={styles.chartBarLabel} aria-hidden="true">
                            {formatWeekday(day.date)}
                          </span>
                          {day.totalMinutes > 0 && (
                            <span className={styles.chartBarValue} aria-hidden="true">
                              {formatDuration(day.totalMinutes)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Top Members */}
                <section className={styles.widgetCard} aria-label="Top Mitarbeiter Rangliste">
                  <h3 className={styles.chartTitle}>
                    <span aria-hidden="true">🏆</span>
                    Top Mitarbeiter (7 Tage)
                  </h3>
                  {dashboardLoading ? (
                    <div className={styles.loading} role="status" aria-live="polite">
                      <div className={styles.loadingSpinner} aria-hidden="true" />
                    </div>
                  ) : dashboard?.topMembers.length === 0 ? (
                    <div className={styles.empty}>
                      <span className={styles.emptyIcon} aria-hidden="true">📭</span>
                      <p className={styles.emptyText}>Keine Daten vorhanden</p>
                    </div>
                  ) : (
                    <ol className={styles.topMembersList} aria-label="Rangliste der Mitarbeiter nach Arbeitszeit">
                      {dashboard?.topMembers.map((member, index) => (
                        <li key={member.memberId} className={styles.topMemberItem}>
                          <span 
                            className={styles.topMemberRank}
                            aria-label={`Platz ${index + 1}`}
                          >
                            {index + 1}
                          </span>
                          <div className={styles.topMemberInfo}>
                            <span className={styles.topMemberName}>{member.memberName}</span>
                            <span className={styles.topMemberTime}>{formatDuration(member.totalMinutes)}</span>
                          </div>
                          <div 
                            className={styles.topMemberBar}
                            role="progressbar"
                            aria-valuenow={member.totalMinutes}
                            aria-valuemin={0}
                            aria-valuemax={maxMemberMinutes}
                            aria-label={`${Math.round((member.totalMinutes / maxMemberMinutes) * 100)}% der maximalen Zeit`}
                          >
                            <div 
                              className={styles.topMemberBarFill}
                              style={{ width: `${(member.totalMinutes / maxMemberMinutes) * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            </>
          )}
        </div>

        {/* Time Tab Panel */}
        <div
          role="tabpanel"
          id={`${tabId}-panel-time`}
          aria-labelledby={`${tabId}-tab-time`}
          hidden={activeTab !== 'time'}
          tabIndex={0}
        >
          {activeTab === 'time' && (
            <>
              {/* Time Stats */}
              <section className={styles.statsCard} aria-label="Zeiterfassungs-Statistiken">
                <div className={styles.statsHeader}>
                  <h2 className={styles.statsTitle}>
                    <span aria-hidden="true">⏱️</span>
                    Zeiterfassung – {PERIOD_LABELS[period]}
                  </h2>
                </div>
                
                {timeLoading ? (
                  <div className={styles.loading} role="status" aria-live="polite">
                    <div className={styles.loadingSpinner} aria-hidden="true" />
                    <span>Statistiken werden geladen...</span>
                  </div>
                ) : timeError ? (
                  <div className={styles.error} role="alert">{timeError}</div>
                ) : (
                  <div className={styles.statsGrid} role="list" aria-label="Statistik-Werte">
                    <div className={styles.statItem} role="listitem">
                      <span className={styles.statValue}>{formatDuration(timeReport?.stats.totalMinutes || 0)}</span>
                      <span className={styles.statLabel}>Gesamtzeit</span>
                    </div>
                    <div className={styles.statItem} role="listitem">
                      <span className={styles.statValue}>{timeReport?.stats.totalEntries || 0}</span>
                      <span className={styles.statLabel}>Einträge</span>
                    </div>
                    <div className={styles.statItem} role="listitem">
                      <span className={styles.statValue}>{formatDuration(timeReport?.stats.averageMinutesPerDay || 0)}</span>
                      <span className={styles.statLabel}>Ø pro Tag</span>
                    </div>
                    <div className={styles.statItem} role="listitem">
                      <span className={styles.statValue}>{formatDuration(timeReport?.stats.averageMinutesPerEntry || 0)}</span>
                      <span className={styles.statLabel}>Ø pro Eintrag</span>
                    </div>
                    <div className={styles.statItem} role="listitem">
                      <span className={styles.statValue}>{timeReport?.stats.daysWithEntries || 0}</span>
                      <span className={styles.statLabel}>Tage mit Einträgen</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Time by Member Table */}
              <section className={styles.tableCard} aria-label="Zeit pro Mitarbeiter Tabelle">
                <div className={styles.tableHeader}>
                  <h2 className={styles.tableTitle}>
                    <span aria-hidden="true">👥</span>
                    Zeit pro Mitarbeiter
                  </h2>
                </div>
                
                {timeLoading ? (
                  <div className={styles.loading} role="status" aria-live="polite">
                    <div className={styles.loadingSpinner} aria-hidden="true" />
                  </div>
                ) : timeReport?.byMember.length === 0 ? (
                  <div className={styles.empty}>
                    <span className={styles.emptyIcon} aria-hidden="true">📭</span>
                    <p className={styles.emptyText}>Keine Daten vorhanden</p>
                  </div>
                ) : (
                  <div className={styles.tableContainer} tabIndex={0} role="region" aria-label="Tabelle scrollbar">
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">Mitarbeiter</th>
                          <th scope="col">Einträge</th>
                          <th scope="col">Gesamtzeit</th>
                          <th scope="col">Anteil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeReport?.byMember.map((member) => (
                          <tr key={member.memberId}>
                            <td>
                              <div className={styles.memberName}>
                                <div className={styles.memberAvatar} aria-hidden="true">
                                  {getInitials(member.memberName)}
                                </div>
                                <span>{member.memberName}</span>
                              </div>
                            </td>
                            <td>{member.entriesCount}</td>
                            <td>{formatDuration(member.totalMinutes)}</td>
                            <td>
                              {timeReport?.stats.totalMinutes 
                                ? `${Math.round((member.totalMinutes / timeReport.stats.totalMinutes) * 100)}%`
                                : '0%'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Members Tab Panel */}
        <div
          role="tabpanel"
          id={`${tabId}-panel-members`}
          aria-labelledby={`${tabId}-tab-members`}
          hidden={activeTab !== 'members'}
          tabIndex={0}
        >
          {activeTab === 'members' && (
            <section className={styles.tableCard} aria-label="Mitarbeiter-Aktivität Tabelle">
              <div className={styles.tableHeader}>
                <h2 className={styles.tableTitle}>
                  <span aria-hidden="true">👥</span>
                  Mitarbeiter-Aktivität – {PERIOD_LABELS[period]}
                </h2>
              </div>
              
              {memberLoading ? (
                <div className={styles.loading} role="status" aria-live="polite">
                  <div className={styles.loadingSpinner} aria-hidden="true" />
                  <span>Mitarbeiter werden geladen...</span>
                </div>
              ) : memberError ? (
                <div className={styles.error} role="alert">{memberError}</div>
              ) : memberReport?.members.length === 0 ? (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon} aria-hidden="true">📭</span>
                  <p className={styles.emptyText}>Keine Mitarbeiter gefunden</p>
                </div>
              ) : (
                <div className={styles.tableContainer} tabIndex={0} role="region" aria-label="Tabelle scrollbar">
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Mitarbeiter</th>
                        <th scope="col">Rolle</th>
                        <th scope="col">Zeiteinträge</th>
                        <th scope="col">Arbeitszeit</th>
                        <th scope="col">Schichten</th>
                        <th scope="col">Letzte Aktivität</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberReport?.members.map((member) => (
                        <tr key={member.memberId}>
                          <td>
                            <div className={styles.memberName}>
                              <div className={styles.memberAvatar} aria-hidden="true">
                                {getInitials(member.memberName)}
                              </div>
                              <div>
                                <div>{member.memberName}</div>
                                <div className={styles.memberEmail}>
                                  {member.memberEmail}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.roleBadge} ${
                              member.role === 'admin' ? styles.roleBadgeAdmin : 
                              member.role === 'manager' ? styles.roleBadgeManager : ''
                            }`}>
                              {member.role === 'admin' ? 'Admin' : 
                               member.role === 'manager' ? 'Manager' : 'Mitarbeiter'}
                            </span>
                          </td>
                          <td>{member.timeEntries}</td>
                          <td>{formatDuration(member.totalTimeMinutes)}</td>
                          <td>
                            <span aria-label={`${member.shiftsCompleted} von ${member.shiftsAssigned} Schichten abgeschlossen`}>
                              {member.shiftsCompleted}/{member.shiftsAssigned}
                            </span>
                          </td>
                          <td>
                            {member.lastActivity 
                              ? formatDate(member.lastActivity)
                              : <span className={styles.noActivity}>Keine Aktivität</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
