import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: string;
    [key: string]: any; // For any other properties
  };
}
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationStatus, NotificationType } from './schemas/notification.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for the current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notifications retrieved successfully',
  })
  async findAll(
    @Request() req: RequestWithUser,
    @Query('status') status?: NotificationStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('types') types?: NotificationType[],
  ) {
    const userId = req.user.userId;
    return this.notificationsService.findAllForUser(userId, {
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      types,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for the current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Unread count retrieved successfully',
  })
  async getUnreadCount(@Request() req: RequestWithUser) {
    const userId = req.user.userId;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for the current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification preferences retrieved successfully',
  })
  async getPreferences(@Request() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.notificationsService.getUserPreferences(userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences for the current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification preferences updated successfully',
  })
  async updatePreferences(
    @Request() req: RequestWithUser,
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ) {
    const userId = req.user.userId;
    return this.notificationsService.updateUserPreferences(userId, updateDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found',
  })
  async findOne(@Request() req: RequestWithUser, @Param('id') id: string) {
    const notification = await this.notificationsService.findOne(id);
    
    if (!notification) {
      throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
    }
    
    // Ensure user can only access their own notifications
    if (notification.userId !== req.user.userId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    
    return notification;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new notification (admin only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Notification created successfully',
  })
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    // TODO: Add admin role check
    return this.notificationsService.create(createNotificationDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a notification' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found',
  })
  async update(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    const notification = await this.notificationsService.findOne(id);
    
    if (!notification) {
      throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
    }
    
    // Ensure user can only update their own notifications
    if (notification.userId !== req.user.userId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    
    return this.notificationsService.update(id, updateNotificationDto);
  }

  @Post('mark-as-read')
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notifications marked as read successfully',
  })
  async markAsRead(@Request() req: RequestWithUser, @Body('ids') ids: string[]) {
    const userId = req.user.userId;
    await this.notificationsService.markAsRead(userId, ids);
    return { success: true };
  }

  @Post('mark-all-as-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All notifications marked as read successfully',
  })
  async markAllAsRead(@Request() req: RequestWithUser) {
    const userId = req.user.userId;
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found',
  })
  async remove(@Request() req: RequestWithUser, @Param('id') id: string) {
    const notification = await this.notificationsService.findOne(id);
    
    if (!notification) {
      throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
    }
    
    // Ensure user can only delete their own notifications
    if (notification.userId !== req.user.userId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    
    await this.notificationsService.remove(id);
    return { success: true };
  }
}
