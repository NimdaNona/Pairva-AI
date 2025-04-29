import { NotificationType, NotificationPriority, NotificationStatus } from './enums';

/**
 * Notification data interface
 */
export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  data?: Record<string, any>;
  sent: boolean;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Channel specific notification preferences
 */
export interface NotificationChannelPreferences {
  enabled: boolean;
  types: NotificationType[];
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  _id: string;
  userId: string;
  inApp: NotificationChannelPreferences;
  email: NotificationChannelPreferences;
  push: NotificationChannelPreferences;
  doNotDisturb: boolean;
  quietHoursStart: string; // Format: "HH:MM", e.g., "22:00"
  quietHoursEnd: string; // Format: "HH:MM", e.g., "07:00"
  timezone: string; // e.g., "America/New_York"
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification update DTO
 */
export interface UpdateNotificationDto {
  status?: NotificationStatus;
}

/**
 * Update notification preferences DTO
 */
export interface UpdateNotificationPreferencesDto {
  inApp?: {
    enabled?: boolean;
    types?: NotificationType[];
  };
  email?: {
    enabled?: boolean;
    types?: NotificationType[];
  };
  push?: {
    enabled?: boolean;
    types?: NotificationType[];
  };
  doNotDisturb?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

/**
 * Notification response with pagination
 */
export interface NotificationResponse {
  notifications: Notification[];
  total: number;
}

/**
 * Unread notification count response
 */
export interface UnreadCountResponse {
  count: number;
}
