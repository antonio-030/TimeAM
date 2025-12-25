/**
 * Mini Calendar Widget
 *
 * Kompakter Monatskalender für die Sidebar.
 * Mit Hover-Tooltip für Termine/Schichten und Klick-Navigation.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './MiniCalendar.module.css';

/**
 * Event-Typ für den Kalender
 */
export interface CalendarDayEvent {
  id: string;
  title: string;
  type: 'shift' | 'time-entry' | 'appointment';
  time?: string;
}

interface MiniCalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onEventClick?: (eventId: string, eventType: string) => void;
  /** Events nach Datum (key = YYYY-MM-DD) */
  events?: Record<string, CalendarDayEvent[]>;
}

export function MiniCalendar({ 
  selectedDate, 
  onDateSelect, 
  onEventClick,
  events = {} 
}: MiniCalendarProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    horizontal: 'left' | 'center' | 'right';
    vertical: 'top' | 'bottom';
    x: number;
    y: number;
  }>({ horizontal: 'center', vertical: 'bottom', x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const dayWrapperRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { year, month, days, weekDays } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    
    const weekDays = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
    
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    
    let startDayIndex = firstDay.getDay() - 1;
    if (startDayIndex < 0) startDayIndex = 6;
    
    const days: Array<{ 
      date: number; 
      isCurrentMonth: boolean; 
      isToday: boolean; 
      fullDate: Date;
      dateKey: string;
    }> = [];
    
    const prevMonthLastDay = new Date(y, m, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const fullDate = new Date(y, m - 1, d);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        fullDate,
        dateKey: formatDateKey(fullDate),
      });
    }
    
    const today = new Date();
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const isToday = 
        d === today.getDate() && 
        m === today.getMonth() && 
        y === today.getFullYear();
      const fullDate = new Date(y, m, d);
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday,
        fullDate,
        dateKey: formatDateKey(fullDate),
      });
    }
    
    const remainingDays = 42 - days.length;
    for (let d = 1; d <= remainingDays; d++) {
      const fullDate = new Date(y, m + 1, d);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        fullDate,
        dateKey: formatDateKey(fullDate),
      });
    }
    
    return { year: y, month: m, days, weekDays };
  }, [currentDate]);

  const monthNames = [
    'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
  ];

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onDateSelect?.(today);
  };

  const handleDateClick = (day: typeof days[0]) => {
    const dayEvents = events[day.dateKey];
    
    // Wenn es Events gibt, zum ersten Event navigieren
    if (dayEvents && dayEvents.length > 0) {
      const firstEvent = dayEvents[0];
      onEventClick?.(firstEvent.id, firstEvent.type);
    } else {
      // Sonst nur Datum auswählen
      setCurrentDate(day.fullDate);
      onDateSelect?.(day.fullDate);
    }
  };

  const isSelected = (day: typeof days[0]) => {
    if (!selectedDate) return false;
    return (
      day.fullDate.getDate() === selectedDate.getDate() &&
      day.fullDate.getMonth() === selectedDate.getMonth() &&
      day.fullDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const hasEvents = (day: typeof days[0]) => {
    return events[day.dateKey] && events[day.dateKey].length > 0;
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'shift': return '📋';
      case 'time-entry': return '⏰';
      case 'appointment': return '📅';
      default: return '•';
    }
  };

  // Wochen-Zeilen erstellen
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className={styles.calendar}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={goToPrevMonth} className={styles.navBtn} aria-label="Vorheriger Monat">
          ‹
        </button>
        <button onClick={goToToday} className={styles.todayBtn}>
          Heute
        </button>
        <button onClick={goToNextMonth} className={styles.navBtn} aria-label="Nächster Monat">
          ›
        </button>
      </div>

      {/* Monat/Jahr */}
      <div className={styles.monthYear}>
        <span className={styles.month}>{monthNames[month]}</span>
        <span className={styles.year}>{year}</span>
      </div>

      {/* Wochentage */}
      <div className={styles.weekDays}>
        {weekDays.map((day) => (
          <span key={day} className={styles.weekDay}>{day}</span>
        ))}
      </div>

      {/* Tage */}
      <div className={styles.days}>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className={styles.week}>
            {week.map((day, dayIndex) => {
              const dayEvents = events[day.dateKey] || [];
              const showTooltip = hoveredDay === day.dateKey && dayEvents.length > 0;
              
              const dayWrapperRef = (el: HTMLDivElement | null) => {
                if (el) {
                  dayWrapperRefs.current.set(day.dateKey, el);
                } else {
                  dayWrapperRefs.current.delete(day.dateKey);
                }
              };

              return (
                <div 
                  key={dayIndex} 
                  ref={dayWrapperRef}
                  className={styles.dayWrapper}
                  onMouseEnter={() => {
                    setHoveredDay(day.dateKey);
                    // Position berechnen
                    const wrapper = dayWrapperRefs.current.get(day.dateKey);
                    if (wrapper) {
                      const rect = wrapper.getBoundingClientRect();
                      const tooltipWidth = 260; // max-width aus CSS
                      const tooltipHeight = 200; // geschätzte Höhe
                      const spaceLeft = rect.left;
                      const spaceRight = window.innerWidth - rect.right;
                      const spaceBottom = window.innerHeight - rect.bottom;
                      const spaceTop = rect.top;
                      
                      // Horizontale Position
                      let horizontal: 'left' | 'center' | 'right' = 'center';
                      let x = rect.left + rect.width / 2; // Standard: zentriert
                      
                      if (spaceRight < tooltipWidth && spaceLeft > spaceRight) {
                        horizontal = 'left';
                        x = rect.left; // Links ausrichten
                      } else if (spaceLeft < tooltipWidth && spaceRight > spaceLeft) {
                        horizontal = 'right';
                        x = rect.right; // Rechts ausrichten
                      }
                      
                      // Vertikale Position
                      let vertical: 'top' | 'bottom' = 'bottom';
                      let y = rect.bottom + 4; // Standard: unterhalb
                      
                      if (spaceBottom < tooltipHeight && spaceTop > spaceBottom) {
                        vertical = 'top';
                        y = rect.top; // Oberhalb (ohne -4, da wir bottom verwenden)
                      }
                      
                      setTooltipPosition({ horizontal, vertical, x, y });
                    }
                  }}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  <button
                    onClick={() => handleDateClick(day)}
                    className={`${styles.day} ${
                      !day.isCurrentMonth ? styles.dayOtherMonth : ''
                    } ${day.isToday ? styles.dayToday : ''} ${
                      isSelected(day) ? styles.daySelected : ''
                    } ${hasEvents(day) ? styles.dayHasEvents : ''}`}
                  >
                    {day.date}
                    {hasEvents(day) && (
                      <span className={styles.eventDot} />
                    )}
                  </button>
                  
                  {/* Tooltip mit Events - wird mit Portal außerhalb des Containers gerendert */}
                  {showTooltip && createPortal(
                    <div 
                      ref={tooltipRef}
                      className={`${styles.tooltip} ${
                        tooltipPosition.horizontal === 'left' ? styles.tooltipLeft : 
                        tooltipPosition.horizontal === 'right' ? styles.tooltipRight : 
                        styles.tooltipCenter
                      } ${
                        tooltipPosition.vertical === 'top' ? styles.tooltipTop : styles.tooltipBottom
                      }`}
                      style={{
                        left: tooltipPosition.horizontal === 'left' 
                          ? `${tooltipPosition.x}px` 
                          : tooltipPosition.horizontal === 'right'
                          ? 'auto'
                          : `${tooltipPosition.x}px`,
                        right: tooltipPosition.horizontal === 'right' 
                          ? `${window.innerWidth - tooltipPosition.x}px` 
                          : 'auto',
                        top: tooltipPosition.vertical === 'bottom' 
                          ? `${tooltipPosition.y}px` 
                          : 'auto',
                        bottom: tooltipPosition.vertical === 'top' 
                          ? `${window.innerHeight - tooltipPosition.y}px` 
                          : 'auto',
                        transform: tooltipPosition.horizontal === 'center' 
                          ? 'translateX(-50%)' 
                          : 'none',
                      }}
                      onMouseEnter={() => setHoveredDay(day.dateKey)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      <div className={styles.tooltipDate}>
                        {day.fullDate.toLocaleDateString('de-DE', { 
                          weekday: 'short', 
                          day: 'numeric', 
                          month: 'short' 
                        })}
                      </div>
                      <div className={styles.tooltipEvents}>
                        {dayEvents.map((event, idx) => (
                          <button
                            key={idx}
                            className={styles.tooltipEvent}
                            onClick={(e) => {
                              e.stopPropagation();
                              setHoveredDay(null); // Tooltip schließen
                              onEventClick?.(event.id, event.type);
                            }}
                          >
                            <span className={styles.tooltipEventIcon}>
                              {getEventTypeIcon(event.type)}
                            </span>
                            <span className={styles.tooltipEventTitle}>
                              {event.title}
                            </span>
                            {event.time && (
                              <span className={styles.tooltipEventTime}>
                                {event.time}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Formatiert ein Datum als YYYY-MM-DD Key
 */
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export { formatDateKey };
