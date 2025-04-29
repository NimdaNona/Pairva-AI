import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import messagingApi from '../../lib/messaging/messagingApi';
import websocketService from '../../lib/messaging/websocketService';
import {
  Conversation,
  Message,
  MessageType,
  MessageStatus,
  CreateConversationRequest,
  SendMessageRequest,
  TypingIndicator,
} from '../../lib/messaging/types';

interface MessagingState {
  conversations: Conversation[];
  currentConversation: string | null;
  messages: Record<string, Message[]>;
  loading: boolean;
  error: string | null;
  unreadCount: number;
  typing: TypingIndicator[];
  connected: boolean;
}

interface MessagingActions {
  getConversations: (options?: { limit?: number; offset?: number; status?: string }) => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  sendMessage: (content: string, type?: MessageType, metadata?: any) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  createConversation: (request: CreateConversationRequest) => Promise<Conversation | null>;
  archiveConversation: (conversationId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  sendTypingIndicator: (isTyping: boolean) => void;
  getUnreadCount: () => Promise<void>;
}

/**
 * Hook for managing messaging functionality
 */
export const useMessaging = (): [MessagingState, MessagingActions] => {
  const { user, getIdToken, isAuthenticated } = useAuth();
  const [state, setState] = useState<MessagingState>({
    conversations: [],
    currentConversation: null,
    messages: {},
    loading: false,
    error: null,
    unreadCount: 0,
    typing: [],
    connected: false,
  });

  // Track if the websocket is initialized
  const websocketInitialized = useRef(false);
  
  // Debounce typing indicator
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize WebSocket connection
   */
  const initializeWebsocket = useCallback(async () => {
    if (!user || websocketInitialized.current) return;

    try {
      const token = await getIdToken();
      if (!token) return;

      // Connect to WebSocket
      websocketService.connect(token);
      websocketInitialized.current = true;

      // Listen for connection changes
      websocketService.onConnectionChange((connected) => {
        setState(prev => ({ ...prev, connected }));
      });

      // Listen for new messages
      websocketService.onNewMessage((message) => {
        setState(prev => {
          const conversationMessages = prev.messages[message.conversationId] || [];
          return {
            ...prev,
            messages: {
              ...prev.messages,
              [message.conversationId]: [...conversationMessages, message],
            },
            // Increment unread count if the message is from someone else
            unreadCount: message.senderId !== user.id ? prev.unreadCount + 1 : prev.unreadCount,
          };
        });

        // If this is a message in the current conversation, mark it as read
        if (message.conversationId === state.currentConversation && message.senderId !== user.id) {
          websocketService.markAsRead(message.conversationId);
        }
      });

      // Listen for message status updates
      websocketService.onStatusUpdate((update) => {
        setState(prev => {
          // Find the conversation and message to update
          const conversationId = Object.keys(prev.messages).find(convId => 
            prev.messages[convId].some(msg => msg.messageId === update.messageId)
          );

          if (!conversationId) return prev;

          // Update the message status
          const updatedMessages = prev.messages[conversationId].map(msg => {
            if (msg.messageId === update.messageId) {
              return {
                ...msg,
                deliveryStatus: {
                  ...msg.deliveryStatus,
                  [update.recipientId]: {
                    status: update.status,
                    timestamp: update.timestamp,
                  },
                },
              };
            }
            return msg;
          });

          return {
            ...prev,
            messages: {
              ...prev.messages,
              [conversationId]: updatedMessages,
            },
          };
        });
      });

      // Listen for messages read
      websocketService.onMessagesRead((event) => {
        setState(prev => {
          if (!prev.messages[event.conversationId]) return prev;

          // Update the read status for all messages
          const updatedMessages = prev.messages[event.conversationId].map(msg => {
            if (event.messageIds.includes(msg.messageId)) {
              return {
                ...msg,
                deliveryStatus: {
                  ...msg.deliveryStatus,
                  [event.readBy]: {
                    status: MessageStatus.READ,
                    timestamp: event.timestamp,
                  },
                },
              };
            }
            return msg;
          });

          return {
            ...prev,
            messages: {
              ...prev.messages,
              [event.conversationId]: updatedMessages,
            },
          };
        });
      });

      // Listen for typing indicators
      websocketService.onTyping((event) => {
        setState(prev => {
          // Remove existing typing indicator for this user/conversation
          const updatedTyping = prev.typing.filter(
            t => !(t.userId === event.userId && t.conversationId === event.conversationId)
          );

          // Add new typing indicator if user is typing
          if (event.isTyping) {
            updatedTyping.push(event);
          }

          return {
            ...prev,
            typing: updatedTyping,
          };
        });
      });

      // Listen for new conversations
      websocketService.onNewConversation((conversation) => {
        setState(prev => ({
          ...prev,
          conversations: [conversation, ...prev.conversations],
        }));
      });

      // Listen for errors
      websocketService.onError((error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'Connection error. Please try again.',
        }));
      });

    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to connect to messaging service',
      }));
    }
  }, [user, getIdToken, state.currentConversation]);

  // Initialize WebSocket when user is authenticated
  useEffect(() => {
    if (user) {
      initializeWebsocket();
    }

    // Cleanup WebSocket connection on unmount
    return () => {
      if (websocketInitialized.current) {
        websocketService.disconnect();
        websocketInitialized.current = false;
      }
    };
  }, [user, initializeWebsocket]);

  /**
   * Fetch conversations
   */
  const getConversations = useCallback(async (
    options?: { limit?: number; offset?: number; status?: string }
  ) => {
    if (!user) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await messagingApi.getConversations(options);
      
      setState(prev => ({
        ...prev,
        conversations: response.conversations,
        loading: false,
      }));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to fetch conversations',
        loading: false,
      }));
    }
  }, [user]);

  /**
   * Select and load a conversation
   */
  const selectConversation = useCallback(async (conversationId: string) => {
    if (!user) return;

    setState(prev => ({ 
      ...prev, 
      currentConversation: conversationId, 
      loading: true, 
      error: null 
    }));

    try {
      const response = await messagingApi.getMessages(conversationId);
      
      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [conversationId]: response.messages,
        },
        loading: false,
      }));

      // Mark conversation as read
      await markAsRead(conversationId);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to fetch messages',
        loading: false,
      }));
    }
  }, [user]);

  /**
   * Send a message
   */
  const sendMessage = useCallback(async (
    content: string,
    type: MessageType = MessageType.TEXT,
    metadata?: any
  ) => {
    if (!user || !state.currentConversation) return;

    setState(prev => ({ ...prev, error: null }));

    try {
      // Clear typing indicator if there is one
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        sendTypingIndicator(false);
      }

      // Try to use WebSocket for better performance
      if (websocketService.isConnected()) {
        websocketService.sendMessage(state.currentConversation, content, type, metadata);
      } else {
        // Fallback to REST API
        const request: SendMessageRequest = { content, type, metadata };
        const message = await messagingApi.sendMessage(state.currentConversation, request);
        
        // Add message to state
        setState(prev => {
          const conversationMessages = prev.messages[state.currentConversation!] || [];
          return {
            ...prev,
            messages: {
              ...prev.messages,
              [state.currentConversation!]: [...conversationMessages, message],
            },
          };
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to send message',
      }));
    }
  }, [user, state.currentConversation]);

  /**
   * Mark conversation as read
   */
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      // Try to use WebSocket
      if (websocketService.isConnected()) {
        websocketService.markAsRead(conversationId);
      } else {
        // Fallback to REST API
        await messagingApi.markConversationAsRead(conversationId);
      }

      // Update unread count
      getUnreadCount();
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }, [user]);

  /**
   * Create a new conversation
   */
  const createConversation = useCallback(async (request: CreateConversationRequest) => {
    if (!user) return null;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Ensure current user is included in participants
      if (!request.participantIds.includes(user.id)) {
        request.participantIds.push(user.id);
      }

      // Try WebSocket
      if (websocketService.isConnected()) {
        websocketService.createConversation(request.participantIds, request.metadata);
        setState(prev => ({ ...prev, loading: false }));
        return null; // We don't have the conversation object yet, it will come through WS
      } else {
        // Fallback to REST API
        const conversation = await messagingApi.createConversation(request);
        
        setState(prev => ({
          ...prev,
          conversations: [conversation, ...prev.conversations],
          currentConversation: conversation.conversationId,
          loading: false,
        }));

        return conversation;
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to create conversation',
        loading: false,
      }));
      return null;
    }
  }, [user]);

  /**
   * Archive a conversation
   */
  const archiveConversation = useCallback(async (conversationId: string) => {
    if (!user) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Try WebSocket
      if (websocketService.isConnected()) {
        websocketService.archiveConversation(conversationId);
      } else {
        // Fallback to REST API
        await messagingApi.archiveConversation(conversationId);
      }

      // Update conversations list
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.filter(c => c.conversationId !== conversationId),
        currentConversation: prev.currentConversation === conversationId ? null : prev.currentConversation,
        loading: false,
      }));
    } catch (error) {
      console.error('Error archiving conversation:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to archive conversation',
        loading: false,
      }));
    }
  }, [user]);

  /**
   * Delete a message
   */
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return;

    setState(prev => ({ ...prev, error: null }));

    try {
      await messagingApi.deleteMessage(messageId);

      // Update message in state
      setState(prev => {
        // Find conversation containing this message
        const conversationId = Object.keys(prev.messages).find(convId => 
          prev.messages[convId].some(msg => msg.messageId === messageId)
        );

        if (!conversationId) return prev;

        // Mark message as deleted
        const updatedMessages = prev.messages[conversationId].map(msg => {
          if (msg.messageId === messageId) {
            return {
              ...msg,
              isDeleted: true,
              deletedAt: new Date().toISOString(),
              content: 'This message has been deleted',
            };
          }
          return msg;
        });

        return {
          ...prev,
          messages: {
            ...prev.messages,
            [conversationId]: updatedMessages,
          },
        };
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to delete message',
      }));
    }
  }, [user]);

  /**
   * Send typing indicator with debounce
   */
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!user || !state.currentConversation || !websocketService.isConnected()) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Send typing indicator
    websocketService.sendTypingIndicator(state.currentConversation, isTyping);

    // Set timeout to clear typing indicator after 3 seconds
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        websocketService.sendTypingIndicator(state.currentConversation!, false);
        typingTimeoutRef.current = null;
      }, 3000);
    }
  }, [user, state.currentConversation]);

  /**
   * Get unread message count
   */
  const getUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const response = await messagingApi.getUnreadCount();
      setState(prev => ({
        ...prev,
        unreadCount: response.count,
      }));
    } catch (error) {
      console.error('Error getting unread count:', error);
    }
  }, [user]);

  // Load unread count on mount
  useEffect(() => {
    if (user) {
      getUnreadCount();
    }
  }, [user, getUnreadCount]);

  return [
    state,
    {
      getConversations,
      selectConversation,
      sendMessage,
      markAsRead,
      createConversation,
      archiveConversation,
      deleteMessage,
      sendTypingIndicator,
      getUnreadCount,
    },
  ];
};
