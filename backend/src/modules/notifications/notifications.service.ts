import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { PushService } from './push.service';
import { 
  Notification, 
  NotificationStatus,
  NotificationPriority,
  NotificationType 
} from './schemas/notification.schema';
import { 
  NotificationPreferences,
  NotificationChannel 
} from './schemas/notification-preferences.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
    
    @InjectModel(NotificationPreferences.name)
    private preferencesModel: Model<NotificationPreferences>,
    
    private configService: ConfigService,
    private emailService: EmailService,
    private pushService: PushService,
  ) {}

  /**
   * Create a new notification
   */
  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    this.logger.debug(`Creating notification: ${JSON.stringify(createNotificationDto)}`);
    
    const notification = await this.notificationModel.create(createNotificationDto);
    
    // Process delivery based on user preferences asynchronously
    this.processNotificationDelivery(notification).catch(error => {
      this.logger.error(`Error processing notification delivery: ${error.message}`, error.stack);
    });
    
    return notification;
  }

  /**
   * Process notification delivery based on user preferences
   */
  private async processNotificationDelivery(notification: Notification): Promise<void> {
    try {
      // Get user notification preferences
      const preferences = await this.getOrCreateUserPreferences(notification.userId);
      
      // If no preferences found, just log notification in database
      if (!preferences) {
        this.logger.warn(`No preferences found for user ${notification.userId}, storing notification only.`);
        return;
      }
      
      // Check if the user is in quiet hours
      const isQuietHours = this.isInQuietHours(preferences);
      
      // Deliver notification via appropriate channels based on preferences
      if (preferences.inApp.enabled && preferences.inApp.types.includes(notification.type)) {
        // In-app notifications are always stored, regardless of quiet hours
        // The notification is already created in the database
      }
      
      // Only deliver external notifications if not in quiet hours or if high priority
      if (!isQuietHours || notification.priority === NotificationPriority.HIGH) {
        
        // Email notifications
        if (preferences.email.enabled && preferences.email.types.includes(notification.type)) {
          await this.sendEmailNotification(notification);
        }
        
        // Push notifications
        if (preferences.push.enabled && preferences.push.types.includes(notification.type)) {
          await this.sendPushNotification(notification);
        }
      }
      
      // Mark notification as sent
      await this.notificationModel.findByIdAndUpdate(notification._id, {
        sent: true,
        sentAt: new Date(),
      });
      
    } catch (error) {
      this.logger.error(`Error processing notification delivery for notification ${notification._id}:`, error);
      throw error;
    }
  }

  /**
   * Send notification via email
   */
  private async sendEmailNotification(notification: Notification): Promise<void> {
    try {
      this.logger.debug(`Sending email notification: ${notification._id} to user ${notification.userId}`);
      
      // Get user email from userId
      // In a real implementation you would look up the user's email address
      // For now we'll use a placeholder email format
      const userEmail = `${notification.userId}@pairva.ai`;
      
      // Generate email content using EmailService
      const emailContent = this.emailService.generateEmailContent(
        notification.type,
        notification.title,
        notification.body,
        notification.data
      );
      
      // Send email
      const sent = await this.emailService.sendEmail(
        userEmail,
        emailContent.subject,
        emailContent.html,
        emailContent.text,
        notification.priority
      );
      
      if (sent) {
        this.logger.log(`Email notification sent to ${userEmail} for notification ${notification._id}`);
      } else {
        this.logger.warn(`Failed to send email notification to ${userEmail} for notification ${notification._id}`);
      }
      
    } catch (error) {
      this.logger.error(`Error sending email notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send notification via push notification
   */
  private async sendPushNotification(notification: Notification): Promise<void> {
    try {
      this.logger.debug(`Sending push notification: ${notification._id} to user ${notification.userId}`);
      
      // In a real implementation, we would get the user's device tokens from a database
      // For now, we'll simulate with a placeholder device token
      const deviceToken = `device-token-${notification.userId}`;
      
      // Prepare notification content for the device (in this case we'll use iOS formatting)
      const pushContent = this.pushService.prepareNotificationForDevice(notification, 'ios');
      
      // Send push notification
      const sent = await this.pushService.sendPushNotification(
        deviceToken,
        pushContent.title,
        pushContent.body,
        pushContent.data,
        notification.priority
      );
      
      if (sent) {
        this.logger.log(`Push notification sent to device ${deviceToken} for user ${notification.userId}`);
      } else {
        this.logger.warn(`Failed to send push notification to device ${deviceToken} for user ${notification.userId}`);
      }
      
    } catch (error) {
      this.logger.error(`Error sending push notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if current time is within user's quiet hours
   */
  private isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.doNotDisturb) {
      return false; // Quiet hours not enabled
    }
    
    try {
      const now = new Date();
      const timezone = preferences.timezone || 'UTC';
      
      // Get current hour and minute in user's timezone
      const options = { timeZone: timezone, hour12: false };
      const timeString = now.toLocaleTimeString('en-US', options);
      const [hours, minutes] = timeString.split(':').map(Number);
      const currentTime = hours * 60 + minutes; // Convert to minutes since midnight
      
      // Parse quiet hours
      const [startHours, startMinutes] = preferences.quietHoursStart.split(':').map(Number);
      const [endHours, endMinutes] = preferences.quietHoursEnd.split(':').map(Number);
      
      const quietStart = startHours * 60 + startMinutes;
      const quietEnd = endHours * 60 + endMinutes;
      
      // Check if current time is within quiet hours
      if (quietStart < quietEnd) {
        // Normal time range (e.g., 22:00 to 08:00 on the same day)
        return currentTime >= quietStart && currentTime <= quietEnd;
      } else {
        // Time range spans midnight (e.g., 22:00 to 08:00 the next day)
        return currentTime >= quietStart || currentTime <= quietEnd;
      }
    } catch (error) {
      this.logger.error(`Error checking quiet hours: ${error.message}`, error.stack);
      return false; // Default to not quiet hours on error
    }
  }

  /**
   * Get all notifications for a user
   */
  async findAllForUser(userId: string, options: {
    status?: NotificationStatus,
    limit?: number,
    offset?: number,
    types?: NotificationType[]
  } = {}): Promise<{ notifications: Notification[], total: number }> {
    const { status, limit = 20, offset = 0, types } = options;
    
    // Build query
    const query: Record<string, any> = { userId };
    
    if (status) {
      query.status = status;
    }
    
    if (types && types.length > 0) {
      query.type = { $in: types };
    }
    
    // Get total count
    const total = await this.notificationModel.countDocuments(query);
    
    // Get notifications with pagination
    const notifications = await this.notificationModel.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
    
    return { notifications, total };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId,
      status: NotificationStatus.UNREAD,
    });
  }

  /**
   * Find a notification by ID
   */
  async findOne(id: string): Promise<Notification | null> {
    return this.notificationModel.findById(id);
  }

  /**
   * Update a notification
   */
  async update(id: string, updateNotificationDto: UpdateNotificationDto): Promise<Notification | null> {
    return this.notificationModel.findByIdAndUpdate(id, updateNotificationDto, { new: true });
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    await this.notificationModel.updateMany(
      { 
        _id: { $in: notificationIds },
        userId, // Ensure user can only mark their own notifications as read
      },
      { 
        status: NotificationStatus.READ,
      }
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { 
        userId,
        status: NotificationStatus.UNREAD,
      },
      { 
        status: NotificationStatus.READ,
      }
    );
  }

  /**
   * Delete a notification
   */
  async remove(id: string): Promise<Notification | null> {
    return this.notificationModel.findByIdAndDelete(id);
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const preferences = await this.getOrCreateUserPreferences(userId);
    if (!preferences) {
      throw new Error(`Failed to create or retrieve preferences for user ${userId}`);
    }
    return preferences;
  }

  /**
   * Get or create user notification preferences
   */
  private async getOrCreateUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      let preferences = await this.preferencesModel.findOne({ userId });
      
      if (!preferences) {
        // Create default preferences
        preferences = await this.preferencesModel.create({ userId });
      }
      
      return preferences;
    } catch (error) {
      this.logger.error(`Error getting or creating preferences for user ${userId}: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string, 
    updateDto: UpdateNotificationPreferencesDto
  ): Promise<NotificationPreferences> {
    // Ensure preferences exist
    const existingPrefs = await this.getOrCreateUserPreferences(userId);
    if (!existingPrefs) {
      throw new Error(`Failed to create or retrieve preferences for user ${userId}`);
    }
    
    // Update preferences
    const updatedPrefs = await this.preferencesModel.findOneAndUpdate(
      { userId },
      updateDto,
      { new: true }
    );
    
    if (!updatedPrefs) {
      throw new Error(`Failed to update preferences for user ${userId}`);
    }
    
    return updatedPrefs;
  }

  /**
   * Create a new message notification
   */
  async createMessageNotification(
    userId: string, 
    senderName: string, 
    messageContent: string,
    conversationId: string,
    messageId: string
  ): Promise<Notification> {
    // Truncate message content if too long
    const truncatedContent = messageContent.length > 50 
      ? `${messageContent.substring(0, 47)}...` 
      : messageContent;
    
    return this.create({
      userId,
      type: NotificationType.NEW_MESSAGE,
      title: `New message from ${senderName}`,
      body: truncatedContent,
      priority: NotificationPriority.HIGH,
      data: {
        conversationId,
        messageId,
        senderName
      }
    });
  }

  /**
   * Create a new match notification
   */
  async createMatchNotification(
    userId: string,
    matchName: string,
    matchId: string,
    compatibilityScore: number
  ): Promise<Notification> {
    return this.create({
      userId,
      type: NotificationType.NEW_MATCH,
      title: 'New Match!',
      body: `You've matched with ${matchName} with ${compatibilityScore}% compatibility!`,
      priority: NotificationPriority.HIGH,
      data: {
        matchId,
        matchName,
        compatibilityScore
      }
    });
  }

  /**
   * Create a liked you notification
   */
  async createLikedYouNotification(
    userId: string,
    likerName: string,
    likerId: string
  ): Promise<Notification> {
    return this.create({
      userId,
      type: NotificationType.MATCH_LIKED_YOU,
      title: 'Someone Likes You!',
      body: `${likerName} liked your profile. Check them out!`,
      priority: NotificationPriority.MEDIUM,
      data: {
        likerId,
        likerName
      }
    });
  }
}
