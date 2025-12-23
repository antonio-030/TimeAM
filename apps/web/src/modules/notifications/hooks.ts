/**
 * Notifications Hooks
 *
 * React Hooks für Benachrichtigungen.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Notification } from '@timeam/shared';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './api';

// =============================================================================
// Types
// =============================================================================

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook für Benachrichtigungen mit automatischem Polling.
 */
export function useNotifications(pollingInterval = 30000): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await fetchNotifications({ limit: 50 });
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setError(null);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Polling
  useEffect(() => {
    if (pollingInterval > 0) {
      intervalRef.current = window.setInterval(() => {
        loadNotifications();
      }, pollingInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pollingInterval, loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: loadNotifications,
    markAsRead,
    markAllAsRead,
  };
}

/**
 * Leichter Hook nur für Unread Count (weniger Traffic).
 */
export function useUnreadCount(pollingInterval = 30000): {
  unreadCount: number;
  refresh: () => Promise<void>;
} {
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const loadCount = useCallback(async () => {
    try {
      const result = await fetchUnreadCount();
      setUnreadCount(result.unreadCount);
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  }, []);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  useEffect(() => {
    if (pollingInterval > 0) {
      intervalRef.current = window.setInterval(loadCount, pollingInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pollingInterval, loadCount]);

  return { unreadCount, refresh: loadCount };
}
