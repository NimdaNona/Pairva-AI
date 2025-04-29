import React, { useState, useEffect } from 'react';
import { Snackbar, Alert, Box, Typography } from '@mui/material';
import { Notification } from '../../lib/notifications/types';
import { NotificationType } from '../../lib/notifications/enums';
import { useRouter } from 'next/router';

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
  duration?: number;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  duration = 6000, // Default 6 seconds
}) => {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  // Close the toast after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(false);
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [duration]);

  // Handle when toast is closed
  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  // Handle when user clicks on the notification
  const handleClick = () => {
    // Navigate based on notification type
    switch (notification.type) {
      case NotificationType.NEW_MATCH:
        if (notification.data?.matchId) {
          router.push(`/matches/${notification.data.matchId}`);
        }
        break;
      case NotificationType.NEW_MESSAGE:
        if (notification.data?.conversationId) {
          router.push(`/messages/${notification.data.conversationId}`);
        }
        break;
      case NotificationType.MATCH_LIKED_YOU:
        router.push('/matches');
        break;
      case NotificationType.QUESTIONNAIRE:
        router.push('/questionnaire');
        break;
      default:
        router.push('/notifications');
    }
    handleClose();
  };

  // Get severity based on notification type
  const getSeverity = (): 'success' | 'info' | 'warning' | 'error' => {
    switch (notification.type) {
      case NotificationType.NEW_MATCH:
        return 'success';
      case NotificationType.NEW_MESSAGE:
        return 'info';
      case NotificationType.MATCH_LIKED_YOU:
        return 'success';
      case NotificationType.ACCOUNT:
        return 'warning';
      case NotificationType.SYSTEM:
        return 'warning';
      default:
        return 'info';
    }
  };

  // Get icon based on notification type
  const getIcon = (): string => {
    switch (notification.type) {
      case NotificationType.NEW_MATCH:
        return '💞';
      case NotificationType.NEW_MESSAGE:
        return '💌';
      case NotificationType.MATCH_LIKED_YOU:
        return '❤️';
      case NotificationType.QUESTIONNAIRE:
        return '📋';
      default:
        return '🔔';
    }
  };

  return (
    <Snackbar 
      open={open} 
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ minWidth: '300px' }}
    >
      <Alert 
        icon={<Box component="span" sx={{ fontSize: '1.5rem', mr: 1 }}>{getIcon()}</Box>}
        severity={getSeverity()} 
        onClick={handleClick}
        sx={{ 
          width: '100%', 
          alignItems: 'flex-start',
          cursor: 'pointer',
          '& .MuiAlert-message': { width: '100%' }
        }}
      >
        <Typography variant="subtitle2" gutterBottom>{notification.title}</Typography>
        <Typography variant="body2">{notification.body}</Typography>
      </Alert>
    </Snackbar>
  );
};

export default NotificationToast;
