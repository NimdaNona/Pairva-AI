import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../hooks/notifications/useNotifications';
import NotificationToast from './NotificationToast';
import { Notification } from '../../lib/notifications/types';
import { NotificationStatus } from '../../lib/notifications/enums';

/**
 * NotificationCenter component handles real-time notification display
 * and manages the queue of notifications to be shown to the user
 */
const NotificationCenter: React.FC = () => {
  const { 
    notifications, 
    markAsRead,
    fetchNotifications,
    fetchUnreadCount,
    unreadCount
  } = useNotifications();
  
  // Queue of notifications to be displayed
  const [notificationQueue, setNotificationQueue] = useState<Notification[]>([]);
  // Currently displayed notification
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
  // Polling interval reference
  const [pollingInterval, setPollingIntervalRef] = useState<NodeJS.Timeout | null>(null);
  
  // Load unread notifications on mount
  useEffect(() => {
    fetchNotifications(NotificationStatus.UNREAD, 5, 0);
    
    // Set up polling for new notifications
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchNotifications(NotificationStatus.UNREAD, 5, 0);
    }, 30000); // Poll every 30 seconds
    
    setPollingIntervalRef(interval);
    
    // Clean up interval on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [fetchNotifications, fetchUnreadCount]);
  
  // Update queue when notifications change
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      // Only queue up notifications that are not already in the queue
      const notificationsToAdd = notifications.filter(notification => 
        !notificationQueue.some(queuedNotification => 
          queuedNotification._id === notification._id
        ) && 
        notification.status === NotificationStatus.UNREAD
      );
      
      if (notificationsToAdd.length > 0) {
        setNotificationQueue(prev => [...prev, ...notificationsToAdd]);
      }
    }
  }, [notifications]);
  
  // Process the notification queue
  useEffect(() => {
    // If no active notification and queue is not empty, show next notification
    if (!activeNotification && notificationQueue.length > 0) {
      const nextNotification = notificationQueue[0];
      setActiveNotification(nextNotification);
      setNotificationQueue(prev => prev.slice(1));
    }
  }, [activeNotification, notificationQueue]);
  
  // Handle notification close
  const handleNotificationClose = async (notification: Notification) => {
    // Mark notification as read
    if (notification.status === NotificationStatus.UNREAD) {
      await markAsRead([notification._id]);
    }
    
    // Clear active notification
    setActiveNotification(null);
    
    // Update unread count
    fetchUnreadCount();
  };
  
  return (
    <>
      {activeNotification && (
        <NotificationToast
          notification={activeNotification}
          onClose={() => handleNotificationClose(activeNotification)}
          duration={6000} // 6 seconds
        />
      )}
    </>
  );
};

export default NotificationCenter;
