import React, { createContext, ReactNode, useContext, useEffect } from 'react';
import { useNotifications } from './useNotifications';
import NotificationCenter from '../../components/notifications/NotificationCenter';

// Create context for notifications
const NotificationsContext = createContext<ReturnType<typeof useNotifications> | undefined>(undefined);

interface NotificationsProviderProps {
  children: ReactNode;
}

/**
 * Provider component that wraps the app and makes notifications available throughout
 */
export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({ children }) => {
  const notificationsData = useNotifications();

  return (
    <NotificationsContext.Provider value={notificationsData}>
      {children}
      <NotificationCenter />
    </NotificationsContext.Provider>
  );
};

/**
 * Hook to use notifications context throughout the app
 */
export const useNotificationsContext = (): ReturnType<typeof useNotifications> => {
  const context = useContext(NotificationsContext);
  
  if (context === undefined) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  
  return context;
};
