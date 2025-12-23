/**
 * NotificationBell Component
 *
 * Glocke mit Badge und Dropdown für Benachrichtigungen.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Notification } from '@timeam/shared';
import { getNotificationIcon } from '@timeam/shared';
import { useNotifications } from './hooks';
import styles from './NotificationBell.module.css';

// =============================================================================
// Helper
// =============================================================================

/**
 * Formatiert relative Zeit.
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `vor ${diffMins} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

// =============================================================================
// Sub-Components
// =============================================================================

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const icon = getNotificationIcon(notification.type);

  return (
    <button
      className={`${styles.notificationItem} ${
        !notification.read ? styles.unread : ''
      }`}
      onClick={onClick}
      aria-label={`${notification.title}: ${notification.message}`}
    >
      <span className={styles.notificationIcon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.notificationContent}>
        <h4 className={styles.notificationTitle}>{notification.title}</h4>
        <p className={styles.notificationMessage}>{notification.message}</p>
        <span className={styles.notificationTime}>
          {formatRelativeTime(notification.createdAt)}
        </span>
      </div>
      {!notification.read && (
        <span className={styles.unreadIndicator} aria-label="Ungelesen" />
      )}
    </button>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface NotificationBellProps {
  onNavigate?: (path: string) => void;
}

export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications(30000); // 30 Sekunden Polling

  // Click Outside Handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // ESC Handler
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      // Als gelesen markieren
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      // Navigation
      if (notification.link && onNavigate) {
        onNavigate(notification.link);
        setIsOpen(false);
      }
    },
    [markAsRead, onNavigate]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  return (
    <div className={styles.bellContainer} ref={containerRef}>
      <button
        ref={buttonRef}
        className={styles.bellButton}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Benachrichtigungen${
          unreadCount > 0 ? `, ${unreadCount} ungelesen` : ''
        }`}
      >
        {/* Bell Icon SVG */}
        <svg
          className={styles.bellIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className={`${styles.badge} ${unreadCount > 99 ? styles.large : ''}`}
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={styles.dropdown}
          role="dialog"
          aria-label="Benachrichtigungen"
        >
          <div className={styles.dropdownHeader}>
            <h3 className={styles.dropdownTitle}>Benachrichtigungen</h3>
            {unreadCount > 0 && (
              <button
                className={styles.markAllButton}
                onClick={handleMarkAllAsRead}
              >
                Alle gelesen
              </button>
            )}
          </div>

          <div className={styles.notificationList} role="list">
            {loading ? (
              <div className={styles.loading}>
                <div className={styles.spinner} aria-label="Lädt..." />
              </div>
            ) : notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon} aria-hidden="true">
                  🔔
                </span>
                <p className={styles.emptyText}>Keine Benachrichtigungen</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
