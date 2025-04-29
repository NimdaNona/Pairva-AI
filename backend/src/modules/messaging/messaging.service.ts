import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Conversation, ConversationDocument, ConversationStatus } from './schemas/conversation.schema';
import { Message, MessageDocument, MessageStatus, MessageType } from './schemas/message.schema';

export interface CreateConversationDto {
  participantIds: string[];
  metadata?: Record<string, any>;
}

export interface SendMessageDto {
  conversationId: string;
  senderId: string;
  content: string;
  type?: MessageType;
  metadata?: Record<string, any>;
}

export interface GetConversationsParams {
  userId: string;
  limit?: number;
  offset?: number;
  status?: ConversationStatus;
}

export interface GetMessagesParams {
  conversationId: string;
  limit?: number;
  before?: Date;
  after?: Date;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  /**
   * Create a new conversation between users
   */
  async createConversation(createConversationDto: CreateConversationDto): Promise<Conversation> {
    try {
      const { participantIds, metadata } = createConversationDto;

      // Ensure we have at least 2 participants
      if (!participantIds || participantIds.length < 2) {
        throw new Error('A conversation requires at least 2 participants');
      }

      // Check if conversation already exists between these users
      const existingConversation = await this.conversationModel.findOne({
        participantIds: { $all: participantIds, $size: participantIds.length },
      });

      if (existingConversation) {
        // If the conversation was archived, reactivate it
        if (existingConversation.status === ConversationStatus.ARCHIVED) {
          existingConversation.status = ConversationStatus.ACTIVE;
          await existingConversation.save();
        }
        return existingConversation;
      }

      // Create new conversation
      const newConversation = new this.conversationModel({
        conversationId: uuidv4(),
        participantIds,
        status: ConversationStatus.ACTIVE,
        metadata: metadata || {},
      });

      return await newConversation.save();
    } catch (error) {
      this.logger.error(`Error creating conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(sendMessageDto: SendMessageDto): Promise<Message> {
    try {
      const { conversationId, senderId, content, type = MessageType.TEXT, metadata } = sendMessageDto;

      // Check if conversation exists
      const conversation = await this.conversationModel.findOne({ conversationId });
      if (!conversation) {
        throw new NotFoundException(`Conversation ${conversationId} not found`);
      }

      // Ensure sender is a participant
      if (!conversation.participantIds.includes(senderId)) {
        throw new Error('Sender is not a participant in this conversation');
      }

      // Create the message
      const messageId = uuidv4();
      const newMessage = new this.messageModel({
        messageId,
        conversationId,
        senderId,
        content,
        type,
        status: MessageStatus.SENT,
        metadata: metadata || {},
        deliveryStatus: {},
      });

      // Initialize delivery status for all recipients
      const recipients = conversation.participantIds.filter(id => id !== senderId);
      recipients.forEach(recipientId => {
        newMessage.deliveryStatus[recipientId] = {
          status: MessageStatus.SENT,
          timestamp: new Date(),
        };
      });

      // Save the message
      const savedMessage = await newMessage.save();

      // Update conversation with last message details
      conversation.lastMessageId = messageId;
      conversation.lastMessagePreview = content.length > 50 ? `${content.substring(0, 47)}...` : content;
      conversation.lastMessageSentAt = new Date();
      await conversation.save();

      return savedMessage;
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get conversations for a user
   */
  async getConversations(params: GetConversationsParams): Promise<Conversation[]> {
    try {
      const { userId, limit = 20, offset = 0, status = ConversationStatus.ACTIVE } = params;

      const conversations = await this.conversationModel.find({
        participantIds: userId,
        status,
      })
        .sort({ lastMessageSentAt: -1 })
        .skip(offset)
        .limit(limit);

      return conversations;
    } catch (error) {
      this.logger.error(`Error getting conversations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(params: GetMessagesParams): Promise<Message[]> {
    try {
      const { conversationId, limit = 50, before, after } = params;

      // Build query
      const query: any = { conversationId, isDeleted: false };
      
      if (before) {
        query.createdAt = { ...query.createdAt, $lt: before };
      }
      
      if (after) {
        query.createdAt = { ...query.createdAt, $gt: after };
      }

      const messages = await this.messageModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);

      return messages;
    } catch (error) {
      this.logger.error(`Error getting messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update message status (delivered, read)
   */
  async updateMessageStatus(messageId: string, userId: string, status: MessageStatus): Promise<Message> {
    try {
      const message = await this.messageModel.findOne({ messageId });
      
      if (!message) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }

      // Only update if the user is a recipient, not the sender
      if (message.senderId === userId) {
        throw new Error('Sender cannot update delivery status of their own message');
      }

      // Update status if it's a valid progression
      const currentStatus = message.deliveryStatus[userId]?.status;
      const validProgressions: Record<MessageStatus, MessageStatus[]> = {
        [MessageStatus.SENT]: [MessageStatus.DELIVERED, MessageStatus.READ],
        [MessageStatus.DELIVERED]: [MessageStatus.READ],
        [MessageStatus.READ]: [],
        [MessageStatus.FAILED]: []
      };

      if (!currentStatus || validProgressions[currentStatus as MessageStatus]?.includes(status)) {
        message.deliveryStatus[userId] = {
          status,
          timestamp: new Date(),
        };
        
        await message.save();
      }

      return message;
    } catch (error) {
      this.logger.error(`Error updating message status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark all messages as read in a conversation
   */
  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      // Find unread messages in this conversation where the user is not the sender
      const messages = await this.messageModel.find({
        conversationId,
        senderId: { $ne: userId },
        [`deliveryStatus.${userId}.status`]: { $ne: MessageStatus.READ },
      });

      // Update all to read status
      const updates = messages.map(message => {
        message.deliveryStatus[userId] = {
          status: MessageStatus.READ,
          timestamp: new Date(),
        };
        return message.save();
      });

      await Promise.all(updates);
    } catch (error) {
      this.logger.error(`Error marking conversation as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Archive a conversation (soft delete)
   */
  async archiveConversation(conversationId: string, userId: string): Promise<Conversation> {
    try {
      const conversation = await this.conversationModel.findOne({ 
        conversationId,
        participantIds: userId,
      });
      
      if (!conversation) {
        throw new NotFoundException(`Conversation ${conversationId} not found`);
      }

      conversation.status = ConversationStatus.ARCHIVED;
      return await conversation.save();
    } catch (error) {
      this.logger.error(`Error archiving conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string): Promise<Message> {
    try {
      const message = await this.messageModel.findOne({ messageId });
      
      if (!message) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }

      // Only the sender can delete the message
      if (message.senderId !== userId) {
        throw new Error('Only the sender can delete their message');
      }

      message.isDeleted = true;
      message.deletedAt = new Date();
      
      return await message.save();
    } catch (error) {
      this.logger.error(`Error deleting message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await this.messageModel.countDocuments({
        [`deliveryStatus.${userId}.status`]: { $ne: MessageStatus.READ },
        senderId: { $ne: userId },
        isDeleted: false,
      });

      return count;
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error.message}`, error.stack);
      throw error;
    }
  }
}
