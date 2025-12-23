/**
 * Calendar Page - Modern Design
 *
 * Haupt-Kalenderansicht mit FullCalendar.
 * Zeigt NUR angenommene Schichten und erfasste Arbeitszeiten.
 * Barrierefrei (WCAG 2.2 AA) und Mobile-optimiert.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import deLocale from '@fullcalendar/core/locales/de';
import type { EventClickArg, DatesSetArg, EventContentArg } from '@fullcalendar/core';
import { useCalendarEvents, useIsMobile, usePrefersReducedMotion } from './hooks';
import { EventDetailDialog } from './EventDetailDialog';
import type { CalendarEvent, CalendarSourceModule } from '@timeam/shared';
import styles from './CalendarPage.module.css';

type ViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek' | 'listDay';

/**
 * Konvertiert CalendarEvent zu FullCalendar Event-Format.
 */
function toFullCalendarEvent(event: CalendarEvent) {
  const isShift = event.sourceModule === 'shift-pool';
  const isRunning = event.meta?.isRunning ?? false;

  return {
    id: event.id,
    title: event.title,
    start: event.startsAt,
    end: event.endsAt,
    extendedProps: {
      sourceModule: event.sourceModule,
      ref: event.ref,
      location: event.location,
      status: event.status,
      meta: event.meta,
    },
    className: [
      styles.event,
      isShift ? styles.eventShift : styles.eventTimeTracking,
      isRunning ? styles.eventRunning : '',
    ].filter(Boolean).join(' '),
  };
}

/**
 * Custom Event Content für bessere Darstellung.
 */
function renderEventContent(eventInfo: EventContentArg) {
  const { sourceModule, location, meta } = eventInfo.event.extendedProps;
  const isShift = sourceModule === 'shift-pool';
  const isRunning = meta?.isRunning ?? false;

  const badge = isShift ? '📋' : '⏱️';
  const label = isShift ? 'Schicht' : 'Arbeitszeit';

  return (
    <div className={styles.eventContent}>
      <span className={styles.eventBadge} aria-hidden="true">
        {badge}
      </span>
      <span className={styles.srOnly}>{label}: </span>
      <div className={styles.eventInfo}>
        <span className={styles.eventTitle}>{eventInfo.event.title}</span>
        {location && (
          <span className={styles.eventLocation}>
            <span className={styles.srOnly}>Ort: </span>
            📍 {location}
          </span>
        )}
      </div>
      {isRunning && (
        <span className={styles.eventRunningIndicator} aria-label="läuft">
          <span className={styles.runningDot} />
          Live
        </span>
      )}
    </div>
  );
}

export function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { from, to };
  });

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('dayGridMonth');
  const [filterModules, setFilterModules] = useState<CalendarSourceModule[]>([
    'shift-pool',
    'time-tracking',
  ]);

  const isMobile = useIsMobile();
  const prefersReducedMotion = usePrefersReducedMotion();
  const triggerRef = useRef<HTMLElement | null>(null);

  // Auf Mobile standardmäßig Listen-View
  useEffect(() => {
    if (isMobile && currentView.includes('Grid')) {
      setCurrentView('listWeek');
      calendarRef.current?.getApi().changeView('listWeek');
    }
  }, [isMobile, currentView]);

  // Events laden
  const { events, loading, error, refetch } = useCalendarEvents({
    from: dateRange.from,
    to: dateRange.to,
    includeModules: filterModules.length > 0 ? filterModules : undefined,
    enabled: true,
  });

  // Zu FullCalendar-Format konvertieren
  const fullCalendarEvents = useMemo(
    () => events.map(toFullCalendarEvent),
    [events]
  );

  // Statistiken berechnen
  const stats = useMemo(() => {
    const shifts = events.filter(e => e.sourceModule === 'shift-pool').length;
    const timeEntries = events.filter(e => e.sourceModule === 'time-tracking').length;
    return { shifts, timeEntries, total: events.length };
  }, [events]);

  // Date Range Update Handler
  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    const from = new Date(arg.start);
    from.setDate(from.getDate() - 7);
    const to = new Date(arg.end);
    to.setDate(to.getDate() + 7);

    setDateRange({ from, to });
  }, []);

  // Event Click Handler
  const handleEventClick = useCallback((info: EventClickArg) => {
    const eventData = events.find((e) => e.id === info.event.id);
    if (eventData) {
      triggerRef.current = info.el;
      setSelectedEvent(eventData);
      setDialogOpen(true);
    }
  }, [events]);

  // Dialog schließen
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 0);
  }, []);

  // View wechseln
  const handleViewChange = useCallback((view: ViewType) => {
    setCurrentView(view);
    calendarRef.current?.getApi().changeView(view);
  }, []);

  // Navigation
  const handleToday = useCallback(() => {
    calendarRef.current?.getApi().today();
  }, []);

  const handlePrev = useCallback(() => {
    calendarRef.current?.getApi().prev();
  }, []);

  const handleNext = useCallback(() => {
    calendarRef.current?.getApi().next();
  }, []);

  // Filter Toggle
  const handleFilterToggle = useCallback((module: CalendarSourceModule) => {
    setFilterModules((prev) => {
      if (prev.includes(module)) {
        return prev.filter((m) => m !== module);
      }
      return [...prev, module];
    });
  }, []);

  // View Options
  const viewOptions: { value: ViewType; label: string; icon: string }[] = [
    { value: 'dayGridMonth', label: 'Monat', icon: '📆' },
    { value: 'timeGridWeek', label: 'Woche', icon: '📅' },
    { value: 'timeGridDay', label: 'Tag', icon: '📋' },
    { value: 'listWeek', label: 'Liste', icon: '📝' },
  ];

  // Aktueller Titel
  const calendarApi = calendarRef.current?.getApi();
  const currentTitle = calendarApi?.view.title ?? 'Kalender';

  return (
    <div className={styles.container}>
      {/* Statistik-Karten */}
      <div className={styles.statsRow}>
        <div className={`${styles.statCard} ${styles.statCardShifts}`}>
          <span className={styles.statIcon}>📋</span>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.shifts}</span>
            <span className={styles.statLabel}>Schichten</span>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardTime}`}>
          <span className={styles.statIcon}>⏱️</span>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.timeEntries}</span>
            <span className={styles.statLabel}>Zeiteinträge</span>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardTotal}`}>
          <span className={styles.statIcon}>📊</span>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Gesamt</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar} role="toolbar" aria-label="Kalender-Navigation">
        <div className={styles.toolbarLeft}>
          <div className={styles.toolbarNav}>
            <button
              type="button"
              onClick={handlePrev}
              className={styles.navButton}
              aria-label="Zurück"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleToday}
              className={styles.todayButton}
              aria-label="Zu heute springen"
            >
              Heute
            </button>
            <button
              type="button"
              onClick={handleNext}
              className={styles.navButton}
              aria-label="Vor"
            >
              ›
            </button>
          </div>

          <h2 className={styles.toolbarTitle} aria-live="polite">
            {currentTitle}
          </h2>
        </div>

        <div className={styles.toolbarRight}>
          {/* View Switch */}
          <div className={styles.viewSwitch} role="group" aria-label="Ansicht wählen">
            {viewOptions
              .filter((opt) => !isMobile || !opt.value.includes('Grid') || opt.value === 'dayGridMonth')
              .map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleViewChange(opt.value)}
                  className={`${styles.viewButton} ${
                    currentView === opt.value ? styles.viewButtonActive : ''
                  }`}
                  aria-pressed={currentView === opt.value}
                  title={opt.label}
                >
                  <span className={styles.viewIcon}>{opt.icon}</span>
                  <span className={styles.viewLabel}>{opt.label}</span>
                </button>
              ))}
          </div>

          {/* Filter */}
          <div className={styles.filters} role="group" aria-label="Event-Filter">
            <button
              type="button"
              onClick={() => handleFilterToggle('shift-pool')}
              className={`${styles.filterButton} ${styles.filterShift} ${
                filterModules.includes('shift-pool') ? styles.filterActive : ''
              }`}
            >
              <span className={styles.filterIcon}>📋</span>
              <span className={styles.filterText}>Schichten</span>
              {filterModules.includes('shift-pool') && <span className={styles.filterCheck}>✓</span>}
            </button>
            <button
              type="button"
              onClick={() => handleFilterToggle('time-tracking')}
              className={`${styles.filterButton} ${styles.filterTime} ${
                filterModules.includes('time-tracking') ? styles.filterActive : ''
              }`}
            >
              <span className={styles.filterIcon}>⏱️</span>
              <span className={styles.filterText}>Arbeitszeiten</span>
              {filterModules.includes('time-tracking') && <span className={styles.filterCheck}>✓</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className={styles.loadingOverlay} aria-busy="true" aria-label="Kalender wird geladen">
          <div className={styles.loadingContent}>
            <div className={styles.spinner} />
            <span className={styles.loadingText}>Kalender wird geladen...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.errorState} role="alert">
          <span className={styles.errorIcon}>⚠️</span>
          <p className={styles.errorText}>{error}</p>
          <button type="button" onClick={refetch} className={styles.retryButton}>
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Calendar */}
      <div
        className={`${styles.calendarWrapper} ${prefersReducedMotion ? styles.reducedMotion : ''}`}
        aria-label="Kalender"
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
          locale={deLocale}
          headerToolbar={false}
          events={fullCalendarEvents}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          eventContent={renderEventContent}
          height="auto"
          dayMaxEvents={isMobile ? false : 3}
          moreLinkText={(n) => `+${n} weitere`}
          noEventsText="Keine Termine im Zeitraum"
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          weekNumbers={!isMobile}
          weekNumberFormat={{ week: 'numeric' }}
          navLinks={true}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
        />
      </div>

      {/* Empty State */}
      {!loading && !error && events.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📅</div>
          <h3 className={styles.emptyTitle}>Keine Termine</h3>
          <p className={styles.emptyText}>
            Im ausgewählten Zeitraum sind keine Schichten oder Arbeitszeiten vorhanden.
          </p>
        </div>
      )}

      {/* Event Detail Dialog */}
      <EventDetailDialog
        event={selectedEvent}
        open={dialogOpen}
        onClose={handleCloseDialog}
        isMobile={isMobile}
      />
    </div>
  );
}
