import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  Notification, 
  NotificationPriority,
  NotificationType 
} from './schemas/notification.schema';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly firebaseApiKey: string;

  constructor(private configService: ConfigService) {
    this.firebaseApiKey = this.configService.get<string>('FIREBASE_API_KEY', '');
    
    if (!this.firebaseApiKey && this.configService.get<string>('NODE_ENV') === 'production') {
      this.logger.warn('Firebase API key not configured. Push notifications will not work in production.');
    } else {
      this.logger.log('Push notification service initialized');
    }
  }

  /**
   * Send a push notification
   */
  async sendPushNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
  ): Promise<boolean> {
    try {
      this.logger.debug(`Preparing to send push notification: ${title}`);
      
      // Skip actual sending in development mode without API key
      if (!this.firebaseApiKey) {
        this.logger.debug('Firebase API key not configured, skipping push notification');
        return true;
      }
      
      // Prepare FCM message
      const message = {
        to: deviceToken,
        notification: {
          title,
          body,
          sound: priority === NotificationPriority.HIGH ? 'default' : 'silent',
          badge: 1,
        },
        data: data || {},
        priority: priority === NotificationPriority.HIGH ? 'high' : 'normal',
      };
      
      // In a real implementation, we would send to Firebase Cloud Messaging
      // For now, let's simulate sending by logging
      this.logger.log(`[PUSH] To: ${deviceToken}, Title: ${title}, Body: ${body}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Generate push notification content from notification object
   */
  prepareNotificationForDevice(
    notification: Notification,
    deviceType: 'ios' | 'android' = 'ios'
  ): { title: string; body: string; data: Record<string, any> } {
    // Start with basic notification data
    const result = {
      title: notification.title,
      body: notification.body,
      data: { 
        ...notification.data, 
        notificationId: notification._id.toString(),
      } as Record<string, any>
    };
    
    // Add device-specific customizations
    if (deviceType === 'ios') {
      // iOS specific adjustments
      // For example, truncate long messages, add emojis, etc.
      if (result.body.length > 100) {
        result.body = result.body.substring(0, 97) + '...';
      }
      
      // Add notification type-specific emojis for iOS
      switch (notification.type) {
        case NotificationType.NEW_MATCH:
          result.title = `💞 ${result.title}`;
          break;
        case NotificationType.NEW_MESSAGE:
          result.title = `💌 ${result.title}`;
          break;
        case NotificationType.MATCH_LIKED_YOU:
          result.title = `❤️ ${result.title}`;
          break;
      }
    } else if (deviceType === 'android') {
      // Android specific adjustments
      // Android shows longer messages, so no need to truncate
      
      // Add a category for Android notification channels
      result.data.android_channel_id = this.getAndroidChannelForType(notification.type);
    }
    
    return result;
  }
  
  /**
   * Get appropriate Android notification channel ID for notification type
   */
  private getAndroidChannelForType(type: NotificationType): string {
    switch (type) {
      case NotificationType.NEW_MATCH:
      case NotificationType.MATCH_LIKED_YOU:
        return 'matches_channel';
      case NotificationType.NEW_MESSAGE:
        return 'messages_channel';
      default:
        return 'general_channel';
    }
  }
}
