/**
 * Time Account Section
 *
 * Komponente für Zeitkonto-Anzeige mit Übersicht, Historie und Anpassungen.
 * WCAG 2.2 AA konform.
 */

import { useState } from 'react';
import { useTimeAccount, useTimeAccountHistory, useTimeAccountExport } from './hooks';
import { useTenant } from '../../core/tenant';
import type { TimeAccount } from '@timeam/shared';
import { formatDateShort } from '../../utils/dateTime';
import { TimeAccountAdjustmentDialog } from './TimeAccountAdjustmentDialog';
import styles from './TimeAccountSection.module.css';

interface TimeAccountSectionProps {
  year: number;
  month: number;
}

/**
 * Formatiert Stunden als "Xh" oder "Xh Ym".
 */
function formatHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}min`;
}

/**
 * Formatiert Saldo mit Vorzeichen und Farbe.
 */
function formatBalance(balanceHours: number): { text: string; className: string; ariaLabel: string } {
  if (balanceHours > 0) {
    return {
      text: `+${formatHours(balanceHours)}`,
      className: styles.balancePositive,
      ariaLabel: `Plus ${formatHours(balanceHours)}`,
    };
  } else if (balanceHours < 0) {
    return {
      text: formatHours(balanceHours),
      className: styles.balanceNegative,
      ariaLabel: `Minus ${formatHours(Math.abs(balanceHours))}`,
    };
  } else {
    return {
      text: '±0h',
      className: styles.balanceZero,
      ariaLabel: 'Ausgeglichen, keine Plus- oder Minusstunden',
    };
  }
}

/**
 * Monatsname auf Deutsch.
 */
function getMonthName(month: number): string {
  const months = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ];
  return months[month - 1] || '';
}

export function TimeAccountSection({ year, month }: TimeAccountSectionProps) {
  const { role } = useTenant();
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const { account, loading, error, refresh } = useTimeAccount(year, month);
  const { accounts: history, loading: historyLoading } = useTimeAccountHistory(6);
  const { exportData, loading: exportLoading } = useTimeAccountExport();
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);

  if (loading) {
    return (
      <section className={styles.section} aria-label="Zeitkonto wird geladen">
        <div className={styles.loading}>Lädt Zeitkonto...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.section} aria-label="Zeitkonto Fehler">
        <div className={styles.error} role="alert">
          {error}
        </div>
      </section>
    );
  }

  if (!account) {
    return (
      <section className={styles.section} aria-label="Zeitkonto">
        <p>Kein Zeitkonto für diesen Monat gefunden.</p>
      </section>
    );
  }

  const balance = formatBalance(account.balanceHours);
  const monthName = getMonthName(month);

  // Berechne Durchschnittswerte für Statistiken
  const avgWeeklyHours = account.actualHours / 4.33; // Durchschnittliche Wochen pro Monat
  const avgDailyHours = account.actualHours / 30; // Durchschnittliche Tage pro Monat
  const completionPercentage = account.targetHours > 0
    ? Math.min(100, (account.actualHours / account.targetHours) * 100)
    : 0;

  return (
    <section className={styles.section} aria-label={`Zeitkonto ${monthName} ${year}`}>
      <h2 className={styles.title}>Zeitkonto</h2>
      
      {/* Info-Banner */}
      <div className={styles.infoBanner} role="region" aria-label="Zeitkonto-Informationen">
        <div className={styles.infoIcon} aria-hidden="true">ℹ️</div>
        <div className={styles.infoContent}>
          <p className={styles.infoText}>
            Das Zeitkonto zeigt Ihre Arbeitszeit im Vergleich zu den Zielstunden. 
            Plusstunden entstehen, wenn Sie mehr gearbeitet haben als geplant, 
            Minusstunden, wenn Sie weniger gearbeitet haben.
          </p>
        </div>
      </div>

      {/* Übersicht */}
      <div className={styles.overview}>
        <div className={styles.overviewCard}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Aktueller Monat</h3>
            <span className={styles.monthLabel} aria-label={`${monthName} ${year}`}>
              {monthName} {year}
            </span>
          </div>

          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon} aria-hidden="true">🎯</span>
                <span className={styles.statLabel} id="target-hours-label">
                  Zielstunden
                </span>
                <button
                  className={styles.statTooltipButton}
                  aria-label="Ihre monatlichen Zielstunden basierend auf Ihrem Arbeitsvertrag"
                  title="Ihre monatlichen Zielstunden basierend auf Ihrem Arbeitsvertrag"
                >
                  ℹ️
                </button>
              </div>
              <span className={styles.statValue} aria-label={`${account.targetHours} Stunden`} aria-describedby="target-hours-label">
                {formatHours(account.targetHours)}
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon} aria-hidden="true">⏱️</span>
                <span className={styles.statLabel} id="time-tracking-hours-label">
                  Zeiterfassung
                </span>
                <button
                  className={styles.statTooltipButton}
                  aria-label="Stunden aus der manuellen Zeiterfassung"
                  title="Stunden aus der manuellen Zeiterfassung"
                >
                  ℹ️
                </button>
              </div>
              <span
                className={styles.statValue}
                aria-label={`${account.timeTrackingHours} Stunden aus Zeiterfassung`}
                aria-describedby="time-tracking-hours-label"
              >
                {formatHours(account.timeTrackingHours)}
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon} aria-hidden="true">📅</span>
                <span className={styles.statLabel} id="shift-hours-label">
                  Schichten
                </span>
                <button
                  className={styles.statTooltipButton}
                  aria-label="Stunden aus zugewiesenen Schichten"
                  title="Stunden aus zugewiesenen Schichten"
                >
                  ℹ️
                </button>
              </div>
              <span
                className={styles.statValue}
                aria-label={`${account.shiftHours} Stunden aus Schichten`}
                aria-describedby="shift-hours-label"
              >
                {formatHours(account.shiftHours)}
              </span>
            </div>

            <div className={`${styles.statCard} ${styles.statCardHighlight}`}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon} aria-hidden="true">📊</span>
                <span className={styles.statLabel} id="actual-hours-label">
                  Gesamt
                </span>
                <button
                  className={styles.statTooltipButton}
                  aria-label="Summe aus Zeiterfassung und Schichten"
                  title="Summe aus Zeiterfassung und Schichten"
                >
                  ℹ️
                </button>
              </div>
              <span
                className={styles.statValue}
                aria-label={`${account.actualHours} Stunden insgesamt`}
                aria-describedby="actual-hours-label"
              >
                {formatHours(account.actualHours)}
              </span>
            </div>
          </div>

          <div className={styles.balanceCard}>
            <div className={styles.balanceHeader}>
              <span className={styles.balanceLabel}>Saldo</span>
              <span className={styles.balanceSubtitle}>Aktueller Stand</span>
            </div>
            <div
              className={`${styles.balance} ${balance.className}`}
              role="status"
              aria-live="polite"
              aria-label={`Zeitkonto ${monthName} ${year}: ${balance.ariaLabel}`}
            >
              {balance.text}
            </div>
          </div>

          {/* Zusätzliche Statistiken */}
          <div className={styles.additionalStats}>
            <div className={styles.additionalStatCard}>
              <div className={styles.additionalStatIcon} aria-hidden="true">⏱️</div>
              <div className={styles.additionalStatContent}>
                <span className={styles.additionalStatLabel} title="Durchschnittliche Wochenstunden">
                  Ø Wochenstunden
                </span>
                <span className={styles.additionalStatValue}>
                  {formatHours(avgWeeklyHours)}
                </span>
              </div>
            </div>
            <div className={styles.additionalStatCard}>
              <div className={styles.additionalStatIcon} aria-hidden="true">📅</div>
              <div className={styles.additionalStatContent}>
                <span className={styles.additionalStatLabel} title="Durchschnittliche Tagesstunden">
                  Ø Tagesstunden
                </span>
                <span className={styles.additionalStatValue}>
                  {formatHours(avgDailyHours)}
                </span>
              </div>
            </div>
            <div className={styles.additionalStatCard}>
              <div className={styles.additionalStatIcon} aria-hidden="true">📊</div>
              <div className={styles.additionalStatContent}>
                <span className={styles.additionalStatLabel} title="Erfüllungsgrad der Zielstunden">
                  Erfüllung
                </span>
                <span className={styles.additionalStatValue}>
                  {Math.round(completionPercentage)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historie mit Diagramm */}
      <div className={styles.history}>
        <div className={styles.historyHeader}>
          <h3 className={styles.historyTitle}>Historie</h3>
          <button
            className={styles.exportButton}
            onClick={() => exportData('csv')}
            disabled={exportLoading}
            aria-label="Zeitkonto-Daten als CSV exportieren (DSGVO)"
          >
            {exportLoading ? 'Exportiert...' : '📥 Export (CSV)'}
          </button>
        </div>

        {historyLoading ? (
          <div className={styles.loading}>Lädt Historie...</div>
        ) : history.length === 0 ? (
          <p>Keine Historie verfügbar.</p>
        ) : (
          <>
            {/* Balkendiagramm */}
            <div className={styles.chartContainer} role="img" aria-label="Zeitkonto-Verlauf der letzten 6 Monate">
              <svg
                className={styles.chart}
                viewBox={`0 0 ${Math.max(400, history.length * 80)} 200`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Y-Achse Labels */}
                <text x="30" y="20" className={styles.chartLabel} textAnchor="middle">
                  {Math.max(...history.map((h) => h.actualHours), account.actualHours, account.targetHours).toFixed(0)}h
                </text>
                <text x="30" y="100" className={styles.chartLabel} textAnchor="middle">
                  {Math.max(...history.map((h) => h.actualHours), account.actualHours, account.targetHours) / 2}h
                </text>
                <text x="30" y="180" className={styles.chartLabel} textAnchor="middle">0h</text>
                
                {/* Balken */}
                {history.map((acc, index) => {
                  const maxValue = Math.max(...history.map((h) => h.actualHours), account.actualHours, account.targetHours);
                  const barHeight = (acc.actualHours / maxValue) * 150;
                  const targetHeight = (acc.targetHours / maxValue) * 150;
                  const x = 60 + index * 80;
                  const y = 180 - barHeight;
                  const targetY = 180 - targetHeight;
                  
                  return (
                    <g key={`${acc.year}-${acc.month}`}>
                      {/* Zielstunden (gestrichelt) */}
                      <rect
                        x={x - 15}
                        y={targetY}
                        width="30"
                        height={targetHeight}
                        fill="rgba(52, 152, 219, 0.3)"
                        stroke="var(--color-blue)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        aria-label={`Zielstunden ${getMonthName(acc.month)} ${acc.year}: ${formatHours(acc.targetHours)}`}
                      />
                      {/* Ist-Stunden */}
                      <rect
                        x={x - 15}
                        y={y}
                        width="30"
                        height={barHeight}
                        fill={acc.actualHours >= acc.targetHours ? "var(--color-green)" : "var(--color-red)"}
                        aria-label={`Ist-Stunden ${getMonthName(acc.month)} ${acc.year}: ${formatHours(acc.actualHours)}`}
                      />
                      {/* Monatslabel */}
                      <text
                        x={x}
                        y="195"
                        className={styles.chartMonthLabel}
                        textAnchor="middle"
                      >
                        {getMonthName(acc.month).slice(0, 3)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.historyTable} aria-label="Zeitkonto-Historie der letzten 6 Monate">
                <thead>
                  <tr>
                    <th scope="col">Monat</th>
                    <th scope="col">Zielstunden</th>
                    <th scope="col">Zeiterfassung</th>
                    <th scope="col">Schichten</th>
                    <th scope="col">Gesamt</th>
                    <th scope="col">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((acc) => {
                    const histBalance = formatBalance(acc.balanceHours);
                    const histMonthName = getMonthName(acc.month);
                    return (
                      <tr key={`${acc.year}-${acc.month}`}>
                        <td data-label="Monat">{`${histMonthName} ${acc.year}`}</td>
                        <td data-label="Zielstunden">{formatHours(acc.targetHours)}</td>
                        <td data-label="Zeiterfassung">{formatHours(acc.timeTrackingHours)}</td>
                        <td data-label="Schichten">{formatHours(acc.shiftHours)}</td>
                        <td data-label="Gesamt">{formatHours(acc.actualHours)}</td>
                        <td data-label="Saldo">
                          <span className={histBalance.className}>{histBalance.text}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Anpassungen (nur Admin/Manager) */}
      {isAdminOrManager && (
        <div className={styles.adjustments}>
          <div className={styles.adjustmentsHeader}>
            <h3 className={styles.adjustmentsTitle}>Anpassungen</h3>
            <button
              className={styles.addButton}
              onClick={() => setShowAdjustmentDialog(true)}
              aria-label="Manuelle Zeitkonto-Anpassung hinzufügen"
            >
              + Anpassung hinzufügen
            </button>
          </div>

          <div className={styles.adjustmentsList}>
            {account.manualAdjustments.length === 0 && account.complianceAdjustments.length === 0 ? (
              <p>Keine Anpassungen vorhanden.</p>
            ) : (
              <>
                {account.manualAdjustments.map((adj) => (
                  <div key={adj.id} className={styles.adjustment}>
                    <div className={styles.adjustmentHeader}>
                      <span className={styles.adjustmentType}>Manuell</span>
                      <span className={styles.adjustmentDate}>
                        {formatDateShort(adj.adjustedAt)}
                      </span>
                    </div>
                    <div className={styles.adjustmentDetails}>
                      <span className={adj.amountHours >= 0 ? styles.positive : styles.negative}>
                        {adj.amountHours >= 0 ? '+' : ''}
                        {formatHours(adj.amountHours)}
                      </span>
                      <span className={styles.adjustmentReason}>{adj.reason}</span>
                    </div>
                  </div>
                ))}

                {account.complianceAdjustments.map((adj) => (
                  <div key={adj.id} className={styles.adjustment}>
                    <div className={styles.adjustmentHeader}>
                      <span className={styles.adjustmentType}>Compliance</span>
                      <span className={styles.adjustmentDate}>
                        {formatDateShort(adj.adjustedAt)}
                      </span>
                    </div>
                    <div className={styles.adjustmentDetails}>
                      <span className={adj.amountHours >= 0 ? styles.positive : styles.negative}>
                        {adj.amountHours >= 0 ? '+' : ''}
                        {formatHours(adj.amountHours)}
                      </span>
                      <span className={styles.adjustmentReason}>{adj.reason}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Anpassungs-Dialog */}
      {showAdjustmentDialog && (
        <TimeAccountAdjustmentDialog
          year={year}
          month={month}
          onClose={() => {
            setShowAdjustmentDialog(false);
            refresh();
          }}
        />
      )}
    </section>
  );
}

