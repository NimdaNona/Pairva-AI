import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { NotificationType } from '../schemas/notification.schema';

class ChannelPreferenceDto {
  @ApiPropertyOptional({ description: 'Whether notifications on this channel are enabled' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ 
    description: 'Types of notifications to receive on this channel',
    enum: NotificationType,
    isArray: true
  })
  @IsString({ each: true })
  @IsOptional()
  types?: NotificationType[];
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'In-app notification preferences' })
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  @IsOptional()
  inApp?: ChannelPreferenceDto;

  @ApiPropertyOptional({ description: 'Email notification preferences' })
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  @IsOptional()
  email?: ChannelPreferenceDto;

  @ApiPropertyOptional({ description: 'Push notification preferences' })
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  @IsOptional()
  push?: ChannelPreferenceDto;

  @ApiPropertyOptional({ description: 'Whether quiet hours are enabled' })
  @IsBoolean()
  @IsOptional()
  doNotDisturb?: boolean;

  @ApiPropertyOptional({ 
    description: 'Start time for quiet hours (24-hour format, HH:MM)',
    example: '22:00'
  })
  @IsString()
  @IsOptional()
  quietHoursStart?: string;

  @ApiPropertyOptional({ 
    description: 'End time for quiet hours (24-hour format, HH:MM)',
    example: '08:00'
  })
  @IsString()
  @IsOptional()
  quietHoursEnd?: string;

  @ApiPropertyOptional({ 
    description: 'Timezone for quiet hours', 
    example: 'America/New_York'
  })
  @IsString()
  @IsOptional()
  timezone?: string;
}
