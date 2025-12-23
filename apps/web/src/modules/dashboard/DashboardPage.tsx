/**
 * Dashboard Page
 * 
 * Voll funktionales Dashboard mit:
 * - LIVE Time-Tracking (sekundengenau)
 * - Echte Schichten-Daten
 * - Modul-Widgets synchron mit Entitlements
 */

import { useId, useCallback, useState } from 'react';
import { useAuth } from '../../core/auth';
import { useTenant } from '../../core/tenant';
import { useDashboard, formatDuration, formatTime, formatRelativeDate, formatShiftTime } from './hooks';
import { clockIn, clockOut } from '../time-tracking/api';
import type { DashboardShift } from './api';
import styles from './DashboardPage.module.css';

// ============= Types =============

export interface DashboardPageProps {
  onNavigate?: (page: string) => void;
}

// ============= Sub-Components =============

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  subtitle?: string;
  onClick?: () => void;
  live?: boolean;
}

function StatCard({ icon, label, value, color, subtitle, onClick, live }: StatCardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`${styles.statCard} ${styles[`statCard${color.charAt(0).toUpperCase()}${color.slice(1)}`]} ${onClick ? styles.statCardClickable : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span className={styles.statIcon} aria-hidden="true">{icon}</span>
      <div className={styles.statContent}>
        <span className={`${styles.statValue} ${live ? styles.liveValue : ''}`}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
        {subtitle && <span className={styles.statSubtitle}>{subtitle}</span>}
      </div>
    </Tag>
  );
}

interface TimeClockWidgetProps {
  isRunning: boolean;
  clockInTime: string | null;
  liveMinutes: number;
  todayMinutes: number;
  onClockIn: () => void;
  onClockOut: () => void;
  isLoading: boolean;
  onViewMore: () => void;
}

function TimeClockWidget({ 
  isRunning, clockInTime, liveMinutes, todayMinutes, 
  onClockIn, onClockOut, isLoading, onViewMore 
}: TimeClockWidgetProps) {
  const clockId = useId();
  
  return (
    <section className={styles.moduleWidget} aria-labelledby={clockId}>
      <div className={styles.widgetHeader}>
        <h3 id={clockId} className={styles.widgetTitle}>
          <span>⏱️</span> Zeiterfassung
        </h3>
        <button className={styles.widgetLink} onClick={onViewMore}>
          Mehr →
        </button>
      </div>
      
      <div className={styles.timeClockWidget}>
        <div className={styles.timeClockInfo}>
          {isRunning && clockInTime ? (
            <>
              <div className={styles.timeClockStatusActive}>
                <span className={styles.pulsingDot} />
                <span>Seit {formatTime(clockInTime)}</span>
              </div>
              <div className={styles.timeClockDuration}>
                {formatDuration(liveMinutes)}
              </div>
            </>
          ) : (
            <>
              <div className={styles.timeClockStatusIdle}>Nicht aktiv</div>
              <div className={styles.timeClockToday}>
                Heute: <strong>{formatDuration(todayMinutes)}</strong>
              </div>
            </>
          )}
        </div>
        
        <button
          className={`${styles.timeClockButton} ${isRunning ? styles.stop : styles.start}`}
          onClick={isRunning ? onClockOut : onClockIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className={styles.spinner} />
          ) : isRunning ? (
            '⏹️ Stoppen'
          ) : (
            '▶️ Starten'
          )}
        </button>
      </div>
    </section>
  );
}

interface CalendarWidgetProps {
  onViewMore: () => void;
}

function CalendarWidget({ onViewMore }: CalendarWidgetProps) {
  const today = new Date();
  const dayName = today.toLocaleDateString('de-DE', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  
  return (
    <section className={styles.moduleWidget}>
      <div className={styles.widgetHeader}>
        <h3 className={styles.widgetTitle}>
          <span>📅</span> Kalender
        </h3>
        <button className={styles.widgetLink} onClick={onViewMore}>
          Öffnen →
        </button>
      </div>
      
      <div className={styles.calendarWidget}>
        <div className={styles.calendarToday}>
          <span className={styles.calendarDay}>{dayName}</span>
          <span className={styles.calendarDate}>{dateStr}</span>
        </div>
        <div className={styles.calendarHint}>
          Klicke auf "Öffnen" um deine Termine zu sehen
        </div>
      </div>
    </section>
  );
}

interface ShiftWidgetProps {
  myShifts: DashboardShift[];
  openShifts: DashboardShift[];
  onViewMyShifts: () => void;
  onViewPool: () => void;
  isAdmin: boolean;
}

function ShiftWidget({ myShifts, openShifts, onViewMyShifts, onViewPool, isAdmin }: ShiftWidgetProps) {
  // Filtere kommende Schichten (ab jetzt)
  const now = new Date();
  const upcomingShifts = myShifts
    .filter(s => new Date(s.startsAt) >= now)
    .slice(0, 3);
  
  return (
    <section className={styles.moduleWidget}>
      <div className={styles.widgetHeader}>
        <h3 className={styles.widgetTitle}>
          <span>📋</span> Schichten
        </h3>
        <button className={styles.widgetLink} onClick={onViewMyShifts}>
          {isAdmin ? 'Verwalten →' : 'Alle →'}
        </button>
      </div>
      
      <div className={styles.shiftWidgetContent}>
        {upcomingShifts.length > 0 ? (
          <>
            <div className={styles.shiftListHeader}>Deine nächsten Schichten:</div>
            <div className={styles.shiftList}>
              {upcomingShifts.map(shift => (
                <div key={shift.id} className={styles.shiftItem}>
                  <div className={styles.shiftItemDate}>
                    {formatRelativeDate(shift.startsAt)}
                  </div>
                  <div className={styles.shiftItemInfo}>
                    <span className={styles.shiftItemTitle}>{shift.title}</span>
                    <span className={styles.shiftItemTime}>
                      {formatShiftTime(shift.startsAt, shift.endsAt)}
                    </span>
                  </div>
                  <span className={styles.shiftItemLocation}>{shift.location.name}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.shiftEmpty}>
            <span className={styles.shiftEmptyIcon}>📭</span>
            <span>Keine kommenden Schichten</span>
          </div>
        )}
        
        {openShifts.length > 0 && (
          <button className={styles.shiftPoolButton} onClick={onViewPool}>
            🔍 {openShifts.length} offene Schichten im Pool
          </button>
        )}
      </div>
    </section>
  );
}

interface ReportsWidgetProps {
  onViewMore: () => void;
}

function ReportsWidget({ onViewMore }: ReportsWidgetProps) {
  return (
    <section className={styles.moduleWidget}>
      <div className={styles.widgetHeader}>
        <h3 className={styles.widgetTitle}>
          <span>📈</span> Berichte
        </h3>
        <button className={styles.widgetLink} onClick={onViewMore}>
          Öffnen →
        </button>
      </div>
      
      <div className={styles.reportsWidget}>
        <div className={styles.reportsInfo}>
          <span className={styles.reportsIcon}>📊</span>
          <span>Statistiken & Auswertungen</span>
        </div>
      </div>
    </section>
  );
}

interface TeamWidgetProps {
  members: Array<{
    uid: string;
    email: string;
    displayName?: string;
    role: string;
    isOnline: boolean;
    todayMinutes: number;
  }>;
  onViewMore: () => void;
}

function TeamWidget({ members, onViewMore }: TeamWidgetProps) {
  const onlineCount = members.filter(m => m.isOnline).length;
  
  return (
    <section className={styles.moduleWidget}>
      <div className={styles.widgetHeader}>
        <h3 className={styles.widgetTitle}>
          <span>👥</span> Team ({members.length})
        </h3>
        <button className={styles.widgetLink} onClick={onViewMore}>
          Verwalten →
        </button>
      </div>
      
      <div className={styles.teamWidget}>
        <div className={styles.teamStats}>
          <div className={styles.teamStat}>
            <span className={styles.teamStatValue}>{members.length}</span>
            <span className={styles.teamStatLabel}>Mitglieder</span>
          </div>
          <div className={styles.teamStat}>
            <span className={styles.teamStatValue}>{onlineCount}</span>
            <span className={styles.teamStatLabel}>Online</span>
          </div>
        </div>
        
        {members.length > 0 && (
          <div className={styles.teamList}>
            {members.slice(0, 4).map(member => (
              <div key={member.uid} className={styles.teamMember}>
                <span className={`${styles.memberStatus} ${member.isOnline ? styles.online : ''}`} />
                <span className={styles.memberName}>
                  {member.displayName || member.email.split('@')[0]}
                </span>
                <span className={styles.memberRole}>
                  {member.role === 'admin' ? '👑' : member.role === 'manager' ? '📋' : ''}
                </span>
              </div>
            ))}
            {members.length > 4 && (
              <div className={styles.teamMore}>+{members.length - 4} weitere</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ============= Main Component =============

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user } = useAuth();
  const { tenant, role, hasEntitlement } = useTenant();
  const [clockLoading, setClockLoading] = useState(false);
  
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const hasTimeTracking = hasEntitlement('module.time_tracking');
  const hasShiftPool = hasEntitlement('module.shift_pool');
  const hasReports = hasEntitlement('module.reports');
  
  const {
    timeStatus,
    stats,
    teamMembers,
    myShifts,
    openShifts,
    liveRunningMinutes,
    liveTodayMinutes,
    loading,
    refresh,
    refreshTimeStatus,
  } = useDashboard(isAdminOrManager);

  // Navigation Handler
  const navigate = useCallback((page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  }, [onNavigate]);

  // Clock In/Out Handler
  const handleClockIn = useCallback(async () => {
    setClockLoading(true);
    try {
      await clockIn();
      await refreshTimeStatus();
    } catch (err) {
      console.error('Clock-in failed:', err);
    } finally {
      setClockLoading(false);
    }
  }, [refreshTimeStatus]);

  const handleClockOut = useCallback(async () => {
    setClockLoading(true);
    try {
      await clockOut();
      await refreshTimeStatus();
    } catch (err) {
      console.error('Clock-out failed:', err);
    } finally {
      setClockLoading(false);
    }
  }, [refreshTimeStatus]);

  if (!user || !tenant) return null;

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Dashboard wird geladen...</p>
      </div>
    );
  }

  const userName = user.displayName || user.email?.split('@')[0] || 'Nutzer';
  const greeting = getGreetingTime();

  // Zähle aktive Module
  const activeModules = [
    true, // Kalender ist immer aktiv
    hasTimeTracking,
    hasShiftPool,
    hasReports,
  ].filter(Boolean).length;

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.greeting}>
            {greeting === 'Morgen' ? '🌅' : greeting === 'Tag' ? '☀️' : '🌙'} Guten {greeting}, {userName}!
          </h1>
          <p className={styles.subtitle}>
            {isAdminOrManager 
              ? `${tenant.name} • ${activeModules} Module aktiv`
              : `${activeModules} Module verfügbar`}
          </p>
        </div>
        <button 
          onClick={refresh} 
          className={styles.refreshButton}
          title="Aktualisieren"
        >
          🔄
        </button>
      </header>

      {/* Stats */}
      <section className={styles.statsSection}>
        <div className={styles.statsGrid}>
          <StatCard
            icon="⏱️"
            label="Heute"
            value={formatDuration(liveTodayMinutes)}
            color="blue"
            subtitle={timeStatus?.isRunning ? '● Läuft' : undefined}
            onClick={hasTimeTracking ? () => navigate('time-tracking') : undefined}
            live={timeStatus?.isRunning}
          />
          
          <StatCard
            icon="📊"
            label="Diese Woche"
            value={formatDuration(stats?.weekWorkedMinutes || 0)}
            color="green"
          />
          
          <StatCard
            icon="📅"
            label="Dieser Monat"
            value={formatDuration(stats?.monthWorkedMinutes || 0)}
            color="purple"
          />
          
          {isAdminOrManager && (
            <StatCard
              icon="👥"
              label="Team"
              value={String(stats?.teamSize || teamMembers.length || 0)}
              color="orange"
              subtitle={`${teamMembers.filter(m => m.isOnline).length} online`}
              onClick={() => navigate('members')}
            />
          )}
          
          {!isAdminOrManager && hasShiftPool && (
            <StatCard
              icon="📋"
              label="Schichten"
              value={String(myShifts.length)}
              color="orange"
              subtitle={openShifts.length > 0 ? `${openShifts.length} offen` : undefined}
              onClick={() => navigate('my-shifts')}
            />
          )}
        </div>
      </section>

      {/* Module Widgets Grid */}
      <section className={styles.widgetsSection}>
        <h2 className={styles.sectionTitle}>📦 Aktive Module</h2>
        
        <div className={styles.widgetsGrid}>
          {/* Zeiterfassung Widget */}
          {hasTimeTracking && (
            <TimeClockWidget
              isRunning={timeStatus?.isRunning || false}
              clockInTime={timeStatus?.runningEntry?.clockIn || null}
              liveMinutes={liveRunningMinutes}
              todayMinutes={timeStatus?.today?.totalMinutes || 0}
              onClockIn={handleClockIn}
              onClockOut={handleClockOut}
              isLoading={clockLoading}
              onViewMore={() => navigate('time-tracking')}
            />
          )}

          {/* Kalender Widget - immer aktiv */}
          <CalendarWidget onViewMore={() => navigate('calendar')} />

          {/* Schichten Widget - mit echten Daten */}
          {hasShiftPool && (
            <ShiftWidget 
              myShifts={myShifts}
              openShifts={openShifts}
              onViewMyShifts={() => navigate(isAdminOrManager ? 'admin-shifts' : 'my-shifts')}
              onViewPool={() => navigate('shifts')}
              isAdmin={isAdminOrManager}
            />
          )}

          {/* Berichte Widget - nur Admin/Manager */}
          {hasReports && isAdminOrManager && (
            <ReportsWidget onViewMore={() => navigate('reports')} />
          )}

          {/* Team Widget - nur Admin/Manager */}
          {isAdminOrManager && (
            <TeamWidget 
              members={teamMembers}
              onViewMore={() => navigate('members')}
            />
          )}
        </div>
      </section>

      {/* Quick Info für Mitarbeiter */}
      {!isAdminOrManager && (
        <section className={styles.infoSection}>
          <div className={styles.infoCard}>
            <div className={styles.infoCardContent}>
              <span className={styles.infoCardIcon}>👤</span>
              <div>
                <p className={styles.infoCardTitle}>{userName}</p>
                <p className={styles.infoCardSubtitle}>{user.email}</p>
              </div>
            </div>
            <span className={styles.infoCardBadge}>Mitarbeiter</span>
          </div>
          
          <div className={styles.tipCard}>
            <span className={styles.tipIcon}>💡</span>
            <div>
              <strong>Tipp:</strong> {getDailyTip()}
            </div>
          </div>
        </section>
      )}

      {/* Admin Quick Actions */}
      {isAdminOrManager && (
        <section className={styles.adminSection}>
          <h2 className={styles.sectionTitle}>⚡ Schnellzugriff</h2>
          <div className={styles.quickActions}>
            <button className={styles.quickAction} onClick={() => navigate('members')}>
              <span>👥</span>
              <span>Team verwalten</span>
            </button>
            {hasShiftPool && (
              <button className={styles.quickAction} onClick={() => navigate('admin-shifts')}>
                <span>📋</span>
                <span>Schichten planen</span>
              </button>
            )}
            {hasReports && (
              <button className={styles.quickAction} onClick={() => navigate('reports')}>
                <span>📈</span>
                <span>Berichte ansehen</span>
              </button>
            )}
            <button className={styles.quickAction} onClick={() => navigate('calendar')}>
              <span>📅</span>
              <span>Kalender öffnen</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// Helper functions
function getGreetingTime(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morgen';
  if (hour < 18) return 'Tag';
  return 'Abend';
}

function getDailyTip(): string {
  const tips = [
    'Vergiss nicht, regelmäßig Pausen zu machen!',
    'Trinke genug Wasser während der Arbeit.',
    'Stehe alle 30 Minuten kurz auf.',
    'Plane deinen Tag mit den wichtigsten Aufgaben.',
    'Kurze Spaziergänge fördern die Konzentration.',
  ];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return tips[dayOfYear % tips.length];
}

export default DashboardPage;
