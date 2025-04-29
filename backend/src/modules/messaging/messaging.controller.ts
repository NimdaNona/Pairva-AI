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
  Req,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagingService } from './messaging.service';
import { ConversationStatus } from './schemas/conversation.schema';
import { MessageStatus } from './schemas/message.schema';
import { Request } from 'express';

// Request type with authenticated user 
interface AuthenticatedRequest extends Request {
  user: {
    sub: string;  // User ID
    [key: string]: any;
  };
}

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(private readonly messagingService: MessagingService) {}

  /**
   * Get all conversations for the current user
   */
  @Get('conversations')
  async getConversations(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
    @Query('status') status?: ConversationStatus,
  ) {
    try {
      const userId = req.user.sub;
      const conversations = await this.messagingService.getConversations({
        userId,
        limit: +limit,
        offset: +offset,
        status,
      });

      return {
        conversations,
        total: conversations.length,
        limit: +limit,
        offset: +offset,
      };
    } catch (error) {
      this.logger.error(`Error getting conversations: ${error.message}`, error.stack);
      throw new HttpException('Failed to get conversations', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Create a new conversation
   */
  @Post('conversations')
  async createConversation(
    @Req() req: AuthenticatedRequest,
    @Body() body: { participantIds: string[], metadata?: Record<string, any> },
  ) {
    try {
      const userId = req.user.sub;
      const { participantIds, metadata } = body;
      
      // Ensure the current user is included in participants
      if (!participantIds.includes(userId)) {
        participantIds.push(userId);
      }
      
      // Create the conversation
      const conversation = await this.messagingService.createConversation({
        participantIds,
        metadata,
      });
      
      return conversation;
    } catch (error) {
      this.logger.error(`Error creating conversation: ${error.message}`, error.stack);
      throw new HttpException('Failed to create conversation', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get a specific conversation by ID
   */
  @Get('conversations/:conversationId')
  async getConversation(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ) {
    try {
      const userId = req.user.sub;
      
      // Get messages in the conversation
      const messages = await this.messagingService.getMessages({
        conversationId,
      });
      
      // Mark all messages as delivered
      for (const message of messages) {
        if (message.senderId !== userId && 
            message.deliveryStatus[userId]?.status === MessageStatus.SENT) {
          await this.messagingService.updateMessageStatus(
            message.messageId,
            userId,
            MessageStatus.DELIVERED,
          );
        }
      }
      
      return {
        conversationId,
        messages,
      };
    } catch (error) {
      this.logger.error(`Error getting conversation: ${error.message}`, error.stack);
      throw new HttpException('Failed to get conversation', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Send a message in a conversation
   */
  @Post('conversations/:conversationId/messages')
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: { content: string, type?: string, metadata?: Record<string, any> },
  ) {
    try {
      const userId = req.user.sub;
      const { content, type, metadata } = body;
      
      const message = await this.messagingService.sendMessage({
        conversationId,
        senderId: userId,
        content,
        type: type as any,
        metadata,
      });
      
      return message;
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`, error.stack);
      throw new HttpException('Failed to send message', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  @Put('conversations/:conversationId/read')
  async markConversationAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ) {
    try {
      const userId = req.user.sub;
      
      await this.messagingService.markConversationAsRead(conversationId, userId);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking conversation as read: ${error.message}`, error.stack);
      throw new HttpException('Failed to mark conversation as read', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Archive a conversation
   */
  @Put('conversations/:conversationId/archive')
  async archiveConversation(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ) {
    try {
      const userId = req.user.sub;
      
      const conversation = await this.messagingService.archiveConversation(conversationId, userId);
      
      return conversation;
    } catch (error) {
      this.logger.error(`Error archiving conversation: ${error.message}`, error.stack);
      throw new HttpException('Failed to archive conversation', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Delete a message (soft delete)
   */
  @Delete('messages/:messageId')
  async deleteMessage(
    @Req() req: AuthenticatedRequest,
    @Param('messageId') messageId: string,
  ) {
    try {
      const userId = req.user.sub;
      
      const message = await this.messagingService.deleteMessage(messageId, userId);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting message: ${error.message}`, error.stack);
      throw new HttpException('Failed to delete message', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get unread message count
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.sub;
      
      const count = await this.messagingService.getUnreadCount(userId);
      
      return { count };
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error.message}`, error.stack);
      throw new HttpException('Failed to get unread count', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
