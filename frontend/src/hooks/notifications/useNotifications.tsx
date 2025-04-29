import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  updateNotification,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../../lib/notifications/notificationsApi';
import {
  Notification,
  NotificationPreferences,
  UpdateNotificationDto,
  UpdateNotificationPreferencesDto,
} from '../../lib/notifications/types';
import { NotificationStatus, NotificationType } from '../../lib/notifications/enums';

/**
 * Hook for managing notifications and notification preferences
 */
export const useNotifications = () => {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  /**
   * Fetch notifications with optional filtering and pagination
   */
  const fetchNotifications = useCallback(
    async (
      status?: NotificationStatus,
      limit = 10,
      offset = 0,
      types?: NotificationType[]
    ) => {
      if (!isAuthenticated) return;

      setLoading(true);
      setError(null);

      try {
        const response = await getNotifications(status, limit, offset, types);
        setNotifications(response.notifications);
        setTotalCount(response.total);
        return response;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated]
  );

  /**
   * Fetch unread notification count
   */
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return 0;

    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
      return count;
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
      return 0;
    }
  }, [isAuthenticated]);

  /**
   * Mark specific notifications as read
   */
  const handleMarkAsRead = useCallback(
    async (ids: string[]) => {
      if (!isAuthenticated || ids.length === 0) return;

      try {
        await markAsRead(ids);
        
        // Update local state
        setNotifications((prev) =>
          prev.map((notification) =>
            ids.includes(notification._id)
              ? { ...notification, status: NotificationStatus.READ }
              : notification
          )
        );
        
        await fetchUnreadCount();
        return true;
      } catch (err) {
        console.error('Failed to mark notifications as read:', err);
        return false;
      }
    },
    [isAuthenticated, fetchUnreadCount]
  );

  /**
   * Mark all notifications as read
   */
  const handleMarkAllAsRead = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      await markAllAsRead();
      
      // Update local state
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          status: NotificationStatus.READ,
        }))
      );
      
      setUnreadCount(0);
      return true;
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      return false;
    }
  }, [isAuthenticated]);

  /**
   * Delete a notification
   */
  const handleDeleteNotification = useCallback(
    async (id: string) => {
      if (!isAuthenticated) return;

      try {
        await deleteNotification(id);
        
        // Update local state
        setNotifications((prev) => prev.filter((notification) => notification._id !== id));
        setTotalCount((prev) => prev - 1);
        
        // If the deleted notification was unread, update the unread count
        const deletedNotification = notifications.find((n) => n._id === id);
        if (deletedNotification?.status === NotificationStatus.UNREAD) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        
        return true;
      } catch (err) {
        console.error('Failed to delete notification:', err);
        return false;
      }
    },
    [isAuthenticated, notifications]
  );

  /**
   * Update a notification (e.g., change status)
   */
  const handleUpdateNotification = useCallback(
    async (id: string, updateDto: UpdateNotificationDto) => {
      if (!isAuthenticated) return;

      try {
        const updatedNotification = await updateNotification(id, updateDto);
        
        // Update local state
        setNotifications((prev) =>
          prev.map((notification) =>
            notification._id === id ? updatedNotification : notification
          )
        );
        
        // If status changed from unread to read, update the unread count
        if (
          updateDto.status === NotificationStatus.READ &&
          notifications.find((n) => n._id === id)?.status === NotificationStatus.UNREAD
        ) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        
        return updatedNotification;
      } catch (err) {
        console.error('Failed to update notification:', err);
        return null;
      }
    },
    [isAuthenticated, notifications]
  );

  /**
   * Fetch user notification preferences
   */
  const fetchPreferences = useCallback(async () => {
    if (!isAuthenticated) return null;

    setLoadingPreferences(true);
    
    try {
      const prefs = await getNotificationPreferences();
      setPreferences(prefs);
      return prefs;
    } catch (err) {
      console.error('Failed to fetch notification preferences:', err);
      return null;
    } finally {
      setLoadingPreferences(false);
    }
  }, [isAuthenticated]);

  /**
   * Update user notification preferences
   */
  const handleUpdatePreferences = useCallback(
    async (updateDto: UpdateNotificationPreferencesDto) => {
      if (!isAuthenticated) return null;

      setLoadingPreferences(true);
      
      try {
        const updatedPrefs = await updateNotificationPreferences(updateDto);
        setPreferences(updatedPrefs);
        return updatedPrefs;
      } catch (err) {
        console.error('Failed to update notification preferences:', err);
        return null;
      } finally {
        setLoadingPreferences(false);
      }
    },
    [isAuthenticated]
  );

  // Load notifications and unread count when the user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications(NotificationStatus.UNREAD, 10, 0);
      fetchUnreadCount();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, fetchNotifications, fetchUnreadCount]);

  return {
    notifications,
    totalCount,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    deleteNotification: handleDeleteNotification,
    updateNotification: handleUpdateNotification,
    preferences,
    loadingPreferences,
    fetchPreferences,
    updatePreferences: handleUpdatePreferences,
  };
};
