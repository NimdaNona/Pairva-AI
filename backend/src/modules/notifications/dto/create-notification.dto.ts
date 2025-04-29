import { IsString, IsEnum, IsObject, IsOptional, IsDate, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, NotificationPriority } from '../schemas/notification.schema';

export class CreateNotificationDto {
  @ApiProperty({ description: 'ID of the user to receive the notification' })
  @IsString()
  userId: string;

  @ApiProperty({ 
    description: 'Type of notification', 
    enum: NotificationType,
    example: NotificationType.NEW_MESSAGE 
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification title', example: 'New Message' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body content', example: 'You received a new message from John' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ 
    description: 'Priority level of the notification', 
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM
  })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'URL to an image to display with the notification' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ 
    description: 'Additional data associated with the notification',
    example: { conversationId: '1234', messageId: '5678' }
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @ApiPropertyOptional({ 
    description: 'Whether the notification has been sent immediately',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  sent?: boolean;

  @ApiPropertyOptional({ 
    description: 'Date when the notification was sent' 
  })
  @IsDate()
  @IsOptional()
  sentAt?: Date;

  @ApiPropertyOptional({ 
    description: 'Date when the notification will expire and be auto-deleted' 
  })
  @IsDate()
  @IsOptional()
  expiresAt?: Date;
}
