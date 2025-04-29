import axios from 'axios';
import { getAuthHeader } from '../auth/authUtils';
import { 
  Notification, 
  NotificationResponse, 
  NotificationPreferences,
  UpdateNotificationDto,
  UpdateNotificationPreferencesDto,
  UnreadCountResponse
} from './types';
import { NotificationStatus, NotificationType } from './enums';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const NOTIFICATIONS_ENDPOINT = `${API_URL}/notifications`;

/**
 * Fetch notifications with optional filtering and pagination
 */
export const getNotifications = async (
  status?: NotificationStatus,
  limit = 20,
  offset = 0,
  types?: NotificationType[]
): Promise<NotificationResponse> => {
  const headers = await getAuthHeader();
  
  let url = `${NOTIFICATIONS_ENDPOINT}?limit=${limit}&offset=${offset}`;
  
  if (status) {
    url += `&status=${status}`;
  }
  
  if (types && types.length > 0) {
    url += `&types=${types.join(',')}`;
  }
  
  const response = await axios.get(url, { headers });
  return response.data;
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (): Promise<number> => {
  const headers = await getAuthHeader();
  const response = await axios.get<UnreadCountResponse>(
    `${NOTIFICATIONS_ENDPOINT}/unread-count`,
    { headers }
  );
  return response.data.count;
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (id: string): Promise<Notification> => {
  const headers = await getAuthHeader();
  const response = await axios.get(`${NOTIFICATIONS_ENDPOINT}/${id}`, { headers });
  return response.data;
};

/**
 * Mark specific notifications as read
 */
export const markAsRead = async (ids: string[]): Promise<void> => {
  const headers = await getAuthHeader();
  await axios.post(
    `${NOTIFICATIONS_ENDPOINT}/mark-as-read`,
    { ids },
    { headers }
  );
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (): Promise<void> => {
  const headers = await getAuthHeader();
  await axios.post(
    `${NOTIFICATIONS_ENDPOINT}/mark-all-as-read`,
    {},
    { headers }
  );
};

/**
 * Update a notification (e.g., change status)
 */
export const updateNotification = async (
  id: string,
  updateDto: UpdateNotificationDto
): Promise<Notification> => {
  const headers = await getAuthHeader();
  const response = await axios.put(
    `${NOTIFICATIONS_ENDPOINT}/${id}`,
    updateDto,
    { headers }
  );
  return response.data;
};

/**
 * Delete a notification
 */
export const deleteNotification = async (id: string): Promise<void> => {
  const headers = await getAuthHeader();
  await axios.delete(`${NOTIFICATIONS_ENDPOINT}/${id}`, { headers });
};

/**
 * Get user notification preferences
 */
export const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const headers = await getAuthHeader();
  const response = await axios.get(
    `${NOTIFICATIONS_ENDPOINT}/preferences`,
    { headers }
  );
  return response.data;
};

/**
 * Update user notification preferences
 */
export const updateNotificationPreferences = async (
  preferences: UpdateNotificationPreferencesDto
): Promise<NotificationPreferences> => {
  const headers = await getAuthHeader();
  const response = await axios.put(
    `${NOTIFICATIONS_ENDPOINT}/preferences`,
    preferences,
    { headers }
  );
  return response.data;
};
