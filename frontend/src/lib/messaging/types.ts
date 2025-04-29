/**
 * Types for the messaging system
 */

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  SYSTEM = 'system',
  LOCATION = 'location'
}

export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  BLOCKED = 'blocked'
}

// Interface for a message
export interface Message {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  isDeleted: boolean;
  deletedAt?: string;
  deliveryStatus: Record<string, {
    status: MessageStatus;
    timestamp: string;
  }>;
}

// Interface for a conversation
export interface Conversation {
  conversationId: string;
  participantIds: string[];
  status: ConversationStatus;
  lastMessageId?: string;
  lastMessagePreview?: string;
  lastMessageSentAt?: string;
  metadata?: Record<string, any>;
  readStatus?: Record<string, string>; // userId -> timestamp
  createdAt: string;
  updatedAt: string;
}

// Interface for a participant in a conversation
export interface Participant {
  userId: string;
  name: string;
  photo?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

// Typing indicator state
export interface TypingIndicator {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  timestamp: string;
}

// API response for conversations
export interface GetConversationsResponse {
  conversations: Conversation[];
  total: number;
  limit: number;
  offset: number;
}

// API response for messages
export interface GetMessagesResponse {
  conversationId: string;
  messages: Message[];
}

// Interface for creating a conversation
export interface CreateConversationRequest {
  participantIds: string[];
  metadata?: Record<string, any>;
}

// Interface for sending a message
export interface SendMessageRequest {
  content: string;
  type?: MessageType;
  metadata?: Record<string, any>;
}

// Events from WebSocket
export interface WebSocketEvent<T> {
  event: string;
  data: T;
}

// New message event
export interface NewMessageEvent {
  messageId: string;
  conversationId: string;
  message: Message;
}

// Message status update event
export interface MessageStatusUpdateEvent {
  messageId: string;
  recipientId: string;
  status: MessageStatus;
  timestamp: string;
}

// Messages read event
export interface MessagesReadEvent {
  conversationId: string;
  messageIds: string[];
  readBy: string;
  timestamp: string;
}

// User typing event
export interface UserTypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  timestamp: string;
}

// New conversation event
export interface NewConversationEvent {
  conversation: Conversation;
}
