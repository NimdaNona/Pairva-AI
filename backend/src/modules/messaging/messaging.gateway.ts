import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  WsResponse,
} from '@nestjs/websockets';
import { Logger, UseGuards, UnauthorizedException } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessagingService } from './messaging.service';
import { MessageStatus, MessageType } from './schemas/message.schema';
import { v4 as uuidv4 } from 'uuid';

interface SocketWithUser extends Socket {
  user?: {
    userId: string;
    email: string;
  };
}

// WebSocket gateway for real-time messaging
@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict to specific origins
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'messaging',
})
export class MessagingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  
  private logger = new Logger('MessagingGateway');
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  private userRooms: Map<string, Set<string>> = new Map(); // userId -> Set of conversation IDs

  constructor(
    private readonly messagingService: MessagingService,
    private readonly jwtService: JwtService,
  ) {}

  // Initialize the gateway
  afterInit(server: Server) {
    this.logger.log('Messaging WebSocket Gateway initialized');
  }

  // Handle connection
  async handleConnection(client: SocketWithUser, ...args: any[]) {
    try {
      // Get token from handshake
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        this.disconnect(client, 'No authentication token provided');
        return;
      }
      
      // Verify and decode the token
      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub;
      
      if (!userId) {
        this.disconnect(client, 'Invalid token payload');
        return;
      }

      // Set user data on socket
      client.user = {
        userId,
        email: decoded.email || '',
      };

      // Track connected user
      this.connectedUsers.set(userId, client.id);
      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);

      // Join user's conversations
      await this.joinUserConversations(client);
      
      // Notify user about connection success
      client.emit('connection_success', { userId });
      
      // Update user's messages to "delivered" status
      this.updateMessagesToDelivered(userId);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      this.disconnect(client, 'Authentication failed');
    }
  }

  // Handle disconnection
  handleDisconnect(client: SocketWithUser) {
    if (client.user) {
      this.connectedUsers.delete(client.user.userId);
      this.logger.log(`Client disconnected: ${client.id} (User: ${client.user.userId})`);
      
      // Remove from user rooms
      if (this.userRooms.has(client.user.userId)) {
        this.userRooms.delete(client.user.userId);
      }
    } else {
      this.logger.log(`Unknown client disconnected: ${client.id}`);
    }
  }

  // Helper method to disconnect a client
  private disconnect(client: Socket, reason: string) {
    client.emit('error', { message: reason });
    client.disconnect(true);
  }

  // Helper method to join user's conversations
  private async joinUserConversations(client: SocketWithUser) {
    if (!client.user) return;
    
    try {
      const conversations = await this.messagingService.getConversations({
        userId: client.user.userId,
      });
      
      const conversationIds = conversations.map(conv => conv.conversationId);
      
      // Join conversation rooms
      conversationIds.forEach(convId => {
        client.join(`conversation:${convId}`);
      });
      
      // Track rooms this user is in
      this.userRooms.set(client.user.userId, new Set(conversationIds.map(id => `conversation:${id}`)));
      
      this.logger.log(`User ${client.user.userId} joined ${conversationIds.length} conversation rooms`);
    } catch (error) {
      this.logger.error(`Error joining conversation rooms: ${error.message}`);
    }
  }

  // Update messages to delivered status for a user
  private async updateMessagesToDelivered(userId: string) {
    try {
      const conversations = await this.messagingService.getConversations({
        userId,
      });
      
      for (const conversation of conversations) {
        const messages = await this.messagingService.getMessages({
          conversationId: conversation.conversationId,
          limit: 100, // Limit to recent messages
        });
        
      // Update status of messages where user is not the sender and status is SENT
      const messagesToUpdate = messages.filter(msg => {
        return msg.senderId !== userId && 
          msg.deliveryStatus[userId]?.status === MessageStatus.SENT;
      });
        
        for (const message of messagesToUpdate) {
          await this.messagingService.updateMessageStatus(
            message.messageId,
            userId,
            MessageStatus.DELIVERED
          );
          
          // Notify sender about delivery status change
          const senderSocketId = this.connectedUsers.get(message.senderId);
          if (senderSocketId) {
            this.server.to(senderSocketId).emit('message_status_update', {
              messageId: message.messageId,
              recipientId: userId,
              status: MessageStatus.DELIVERED,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error updating message status: ${error.message}`);
    }
  }

  // Handle new message
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { conversationId: string; content: string; type?: MessageType; metadata?: any }
  ): Promise<WsResponse<any>> {
    if (!client.user) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    
    try {
      const { conversationId, content, type = MessageType.TEXT, metadata } = data;
      
      // Validate data
      if (!conversationId || !content) {
        return { event: 'error', data: { message: 'Missing required fields' } };
      }
      
      // Send message through service
      const message = await this.messagingService.sendMessage({
        conversationId,
        senderId: client.user.userId,
        content,
        type,
        metadata,
      });
      
      // Broadcast message to conversation room
      this.server.to(`conversation:${conversationId}`).emit('new_message', message);
      
      // Return confirmation to sender
      return {
        event: 'message_sent',
        data: {
          messageId: message.messageId,
          timestamp: message.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  // Handle message read status update
  @SubscribeMessage('read_messages')
  async handleReadMessages(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { conversationId: string }
  ): Promise<WsResponse<any>> {
    if (!client.user) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    
    try {
      const { conversationId } = data;
      
      // Mark all messages as read
      await this.messagingService.markConversationAsRead(conversationId, client.user.userId);
      
      // Get updated messages
      const messages = await this.messagingService.getMessages({ conversationId });
      
      // Notify senders about read status
      const readMessages = messages.filter(msg => {
        if (!client.user) return false;
        return msg.senderId !== client.user.userId && 
          msg.deliveryStatus[client.user.userId]?.status === MessageStatus.READ;
      });
      
      const senderIds = [...new Set(readMessages.map(msg => msg.senderId))];
      
      // Notify each sender
      for (const senderId of senderIds) {
        const senderSocketId = this.connectedUsers.get(senderId);
        if (senderSocketId) {
          const senderMessages = readMessages.filter(msg => msg.senderId === senderId);
          this.server.to(senderSocketId).emit('messages_read', {
            conversationId,
            messageIds: senderMessages.map(msg => msg.messageId),
            readBy: client.user.userId,
            timestamp: new Date(),
          });
        }
      }
      
      return {
        event: 'messages_marked_read',
        data: {
          conversationId,
          count: readMessages.length,
        },
      };
    } catch (error) {
      this.logger.error(`Error marking messages as read: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  // Handle typing indicator
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { conversationId: string; isTyping: boolean }
  ): Promise<void> {
    if (!client.user) return;
    
    const { conversationId, isTyping } = data;
    
    // Broadcast typing status to other participants in conversation
    client.to(`conversation:${conversationId}`).emit('user_typing', {
      conversationId,
      userId: client.user.userId,
      isTyping,
      timestamp: new Date(),
    });
  }

  // Handle creating a new conversation
  @SubscribeMessage('create_conversation')
  async handleCreateConversation(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { participantIds: string[]; metadata?: any }
  ): Promise<WsResponse<any>> {
    if (!client.user) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    
    try {
      const { participantIds, metadata } = data;
      
      // Ensure current user is included
      if (!participantIds.includes(client.user.userId)) {
        participantIds.push(client.user.userId);
      }
      
      // Create conversation
      const conversation = await this.messagingService.createConversation({
        participantIds,
        metadata,
      });
      
      // Join conversation room
      client.join(`conversation:${conversation.conversationId}`);
      
      // Add to user rooms tracking
      if (!this.userRooms.has(client.user.userId)) {
        this.userRooms.set(client.user.userId, new Set());
      }
      const userRooms = this.userRooms.get(client.user.userId);
      if (userRooms) {
        userRooms.add(`conversation:${conversation.conversationId}`);
      }
      
      // Notify other online participants
      for (const participantId of participantIds) {
        if (participantId !== client.user.userId) {
          const socketId = this.connectedUsers.get(participantId);
          if (socketId) {
            const socket = this.server.sockets.sockets.get(socketId);
            socket?.join(`conversation:${conversation.conversationId}`);
            
            // Update participant's room tracking
            if (!this.userRooms.has(participantId)) {
              this.userRooms.set(participantId, new Set());
            }
            const participantRooms = this.userRooms.get(participantId);
            if (participantRooms) {
              participantRooms.add(`conversation:${conversation.conversationId}`);
            }
            
            // Notify about new conversation
            this.server.to(socketId).emit('new_conversation', conversation);
          }
        }
      }
      
      return {
        event: 'conversation_created',
        data: conversation,
      };
    } catch (error) {
      this.logger.error(`Error creating conversation: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  // Handle archiving a conversation
  @SubscribeMessage('archive_conversation')
  async handleArchiveConversation(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { conversationId: string }
  ): Promise<WsResponse<any>> {
    if (!client.user) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    
    try {
      const { conversationId } = data;
      
      // Archive conversation
      const conversation = await this.messagingService.archiveConversation(conversationId, client.user.userId);
      
      // Leave conversation room
      client.leave(`conversation:${conversationId}`);
      
      // Update user rooms tracking
      if (this.userRooms.has(client.user.userId)) {
        const userRooms = this.userRooms.get(client.user.userId);
        if (userRooms) {
          userRooms.delete(`conversation:${conversationId}`);
        }
      }
      
      return {
        event: 'conversation_archived',
        data: {
          conversationId,
          status: conversation.status,
        },
      };
    } catch (error) {
      this.logger.error(`Error archiving conversation: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }
}
