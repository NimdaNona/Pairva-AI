import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Tabs, 
  Tab, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction, 
  IconButton, 
  Button, 
  Divider, 
  Paper,
  CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../../hooks/notifications/useNotifications';
import withProtection from '../../components/auth/withProtection';
import { NotificationStatus, NotificationType } from '../../lib/notifications/enums';
import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

// TabPanel component for the notification tabs
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`notification-tabpanel-${index}`}
      aria-labelledby={`notification-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
};

const NotificationsPage: NextPage = () => {
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  
  const { 
    notifications, 
    totalCount, 
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  // Fetch notifications when page or tab changes
  useEffect(() => {
    const status = tabValue === 0 ? undefined : 
                 tabValue === 1 ? NotificationStatus.UNREAD : 
                 NotificationStatus.READ;
    
    fetchNotifications(status, pageSize, page * pageSize);
  }, [tabValue, page, pageSize, fetchNotifications]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setPage(0); // Reset to first page when changing tabs
  };

  const handleNotificationClick = async (notificationId: string, status: NotificationStatus) => {
    if (status === NotificationStatus.UNREAD) {
      await markAsRead([notificationId]);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleDeleteNotification = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    await deleteNotification(id);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
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

  const getTotalPages = () => {
    return Math.ceil(totalCount / pageSize);
  };

  const formatTimeAgo = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  return (
    <>
      <Head>
        <title>Notifications | Perfect Match</title>
      </Head>
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">Notifications</Typography>
          <Button 
            variant="outlined" 
            startIcon={<SettingsIcon />}
            onClick={() => router.push('/notifications/preferences')}
          >
            Preferences
          </Button>
        </Box>

        <Paper elevation={2}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="notification tabs">
              <Tab label="All" />
              <Tab label="Unread" />
              <Tab label="Read" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <NotificationList 
              notifications={notifications}
              loading={loading}
              error={error}
              onNotificationClick={handleNotificationClick}
              onDeleteNotification={handleDeleteNotification}
              getNotificationIcon={getNotificationIcon}
              formatTimeAgo={formatTimeAgo}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button onClick={handleMarkAllAsRead} color="primary">
                Mark all as read
              </Button>
            </Box>
            <NotificationList 
              notifications={notifications}
              loading={loading}
              error={error}
              onNotificationClick={handleNotificationClick}
              onDeleteNotification={handleDeleteNotification}
              getNotificationIcon={getNotificationIcon}
              formatTimeAgo={formatTimeAgo}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <NotificationList 
              notifications={notifications}
              loading={loading}
              error={error}
              onNotificationClick={handleNotificationClick}
              onDeleteNotification={handleDeleteNotification}
              getNotificationIcon={getNotificationIcon}
              formatTimeAgo={formatTimeAgo}
            />
          </TabPanel>

          {!loading && getTotalPages() > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pb: 2 }}>
              <Button 
                disabled={page === 0} 
                onClick={() => handlePageChange(page - 1)}
                sx={{ mx: 1 }}
              >
                Previous
              </Button>
              <Typography sx={{ mx: 2, alignSelf: 'center' }}>
                Page {page + 1} of {getTotalPages()}
              </Typography>
              <Button 
                disabled={page >= getTotalPages() - 1} 
                onClick={() => handlePageChange(page + 1)}
                sx={{ mx: 1 }}
              >
                Next
              </Button>
            </Box>
          )}
        </Paper>
      </Container>
    </>
  );
};

// Helper component for notification list
interface NotificationListProps {
  notifications: any[];
  loading: boolean;
  error: Error | null;
  onNotificationClick: (id: string, status: NotificationStatus) => void;
  onDeleteNotification: (id: string, event: React.MouseEvent) => void;
  getNotificationIcon: (type: NotificationType) => string;
  formatTimeAgo: (date: Date) => string;
}

const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  loading,
  error,
  onNotificationClick,
  onDeleteNotification,
  getNotificationIcon,
  formatTimeAgo
}) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="error">Error loading notifications: {error.message}</Typography>
      </Box>
    );
  }

  if (notifications.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography>No notifications to display</Typography>
      </Box>
    );
  }

  return (
    <List>
      {notifications.map((notification) => (
        <React.Fragment key={notification._id}>
          <ListItem 
            button
            onClick={() => onNotificationClick(notification._id, notification.status)}
            sx={{
              backgroundColor: notification.status === NotificationStatus.UNREAD 
                ? 'rgba(0, 0, 0, 0.04)' 
                : 'inherit',
              py: 2
            }}
          >
            <Box sx={{ mr: 2, fontSize: '1.5rem' }}>
              {getNotificationIcon(notification.type)}
            </Box>
            <ListItemText
              primary={
                <Typography variant="subtitle1">
                  {notification.title}
                </Typography>
              }
              secondary={
                <>
                  <Typography 
                    variant="body2" 
                    color="text.primary"
                    sx={{ mb: 1 }}
                  >
                    {notification.body}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatTimeAgo(notification.createdAt)}
                  </Typography>
                </>
              }
            />
            <ListItemSecondaryAction>
              <IconButton 
                edge="end" 
                aria-label="delete"
                onClick={(e) => onDeleteNotification(notification._id, e)}
              >
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
          <Divider variant="inset" component="li" />
        </React.Fragment>
      ))}
    </List>
  );
};

export default withProtection(NotificationsPage);
