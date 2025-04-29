import React, { useState, useEffect, useRef } from 'react';
import { Badge, IconButton, Popover, List, ListItem, ListItemText, Typography, Box, Button, Divider } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNotifications } from '../../hooks/notifications/useNotifications';
import { Notification } from '../../lib/notifications/types';
import { NotificationStatus, NotificationType } from '../../lib/notifications/enums';
import { formatDistanceToNow } from 'date-fns';

const NotificationBadge: React.FC = () => {
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  } = useNotifications();
  
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
  const id = open ? 'notification-popover' : undefined;
  
  // Fetch latest notifications when popover opens
  useEffect(() => {
    if (open) {
      fetchNotifications(undefined, 5, 0);
    }
  }, [open, fetchNotifications]);
  
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (notification.status === NotificationStatus.UNREAD) {
      await markAsRead([notification._id]);
    }
    
    // Handle navigation based on notification type
    switch (notification.type) {
      case NotificationType.NEW_MATCH:
        window.location.href = `/matches/${notification.data?.matchId}`;
        break;
      case NotificationType.NEW_MESSAGE:
        window.location.href = `/messages/${notification.data?.conversationId}`;
        break;
      case NotificationType.MATCH_LIKED_YOU:
        window.location.href = `/matches?likedBy=${notification.data?.likerId}`;
        break;
      default:
        // For other notification types, just mark as read
        break;
    }
    
    handleClose();
  };
  
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };
  
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
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
  
  const formatTimeAgo = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };
  
  return (
    <>
      <IconButton
        aria-describedby={id}
        color="inherit"
        onClick={handleClick}
        data-testid="notification-badge"
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        sx={{ mt: 1 }}
      >
        <Box sx={{ width: 320, maxHeight: 400 }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Notifications</Typography>
            {unreadCount > 0 && (
              <Button size="small" onClick={handleMarkAllAsRead}>
                Mark all as read
              </Button>
            )}
          </Box>
          
          <Divider />
          
          {loading ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography>Loading notifications...</Typography>
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography>No notifications to display</Typography>
            </Box>
          ) : (
            <List sx={{ width: '100%', p: 0 }}>
              {notifications.map((notification) => (
                <ListItem
                  key={notification._id}
                  alignItems="flex-start"
                  button
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    backgroundColor: notification.status === NotificationStatus.UNREAD ? 'rgba(0, 0, 0, 0.04)' : 'inherit',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
                  }}
                >
                  <Box sx={{ mr: 2, fontSize: '1.5rem' }}>
                    {getNotificationIcon(notification.type)}
                  </Box>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2" noWrap>
                        {notification.title}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.primary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            mb: 0.5
                          }}
                        >
                          {notification.body}
                        </Typography>
                        <Typography component="span" variant="caption" color="text.secondary">
                          {formatTimeAgo(notification.createdAt)}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
          
          <Divider />
          
          <Box sx={{ p: 1, textAlign: 'center' }}>
            <Button 
              size="small" 
              onClick={() => {
                handleClose();
                window.location.href = '/notifications';
              }}
            >
              View all notifications
            </Button>
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default NotificationBadge;
