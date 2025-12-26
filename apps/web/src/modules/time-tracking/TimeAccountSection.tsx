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

  return (
    <section className={styles.section} aria-label={`Zeitkonto ${monthName} ${year}`}>
      <h2 className={styles.title}>Zeitkonto</h2>

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
            <div className={styles.stat}>
              <span className={styles.statLabel}>Zielstunden</span>
              <span className={styles.statValue} aria-label={`${account.targetHours} Stunden`}>
                {formatHours(account.targetHours)}
              </span>
            </div>

            <div className={styles.stat}>
              <span className={styles.statLabel}>Ist-Stunden (Zeiterfassung)</span>
              <span
                className={styles.statValue}
                aria-label={`${account.timeTrackingHours} Stunden aus Zeiterfassung`}
              >
                {formatHours(account.timeTrackingHours)}
              </span>
            </div>

            <div className={styles.stat}>
              <span className={styles.statLabel}>Ist-Stunden (Schichten)</span>
              <span
                className={styles.statValue}
                aria-label={`${account.shiftHours} Stunden aus Schichten`}
              >
                {formatHours(account.shiftHours)}
              </span>
            </div>

            <div className={styles.stat}>
              <span className={styles.statLabel}>Gesamt Ist-Stunden</span>
              <span
                className={styles.statValue}
                aria-label={`${account.actualHours} Stunden insgesamt`}
              >
                {formatHours(account.actualHours)}
              </span>
            </div>
          </div>

          <div className={styles.balanceContainer}>
            <span className={styles.balanceLabel}>Saldo</span>
            <div
              className={`${styles.balance} ${balance.className}`}
              role="status"
              aria-live="polite"
              aria-label={`Zeitkonto ${monthName} ${year}: ${balance.ariaLabel}`}
            >
              {balance.text}
            </div>
          </div>
        </div>
      </div>

      {/* Historie */}
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
                    <th scope="row">{`${histMonthName} ${acc.year}`}</th>
                    <td>{formatHours(acc.targetHours)}</td>
                    <td>{formatHours(acc.timeTrackingHours)}</td>
                    <td>{formatHours(acc.shiftHours)}</td>
                    <td>{formatHours(acc.actualHours)}</td>
                    <td>
                      <span className={histBalance.className}>{histBalance.text}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

