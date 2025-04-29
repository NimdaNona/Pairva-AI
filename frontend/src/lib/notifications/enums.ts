/**
 * Notification types that categorize different notification triggers
 */
export enum NotificationType {
  NEW_MATCH = 'NEW_MATCH',
  NEW_MESSAGE = 'NEW_MESSAGE',
  MATCH_LIKED_YOU = 'MATCH_LIKED_YOU',
  SYSTEM = 'SYSTEM',
  QUESTIONNAIRE = 'QUESTIONNAIRE',
  ACCOUNT = 'ACCOUNT',
  PROFILE_REVIEW = 'PROFILE_REVIEW',
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * Notification status states
 */
export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}
