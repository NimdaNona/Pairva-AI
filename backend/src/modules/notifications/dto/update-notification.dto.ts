import { IsString, IsEnum, IsObject, IsOptional, IsDate, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationStatus, NotificationPriority } from '../schemas/notification.schema';

export class UpdateNotificationDto {
  @ApiPropertyOptional({ 
    description: 'Status of the notification', 
    enum: NotificationStatus 
  })
  @IsEnum(NotificationStatus)
  @IsOptional()
  status?: NotificationStatus;

  @ApiPropertyOptional({ 
    description: 'Priority level of the notification', 
    enum: NotificationPriority 
  })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Notification title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Notification body content' })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional({ description: 'URL to an image to display with the notification' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ description: 'Additional data associated with the notification' })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether the notification has been sent' })
  @IsBoolean()
  @IsOptional()
  sent?: boolean;

  @ApiPropertyOptional({ description: 'Date when the notification was sent' })
  @IsDate()
  @IsOptional()
  sentAt?: Date;

  @ApiPropertyOptional({ description: 'Date when the notification will expire and be auto-deleted' })
  @IsDate()
  @IsOptional()
  expiresAt?: Date;
}
