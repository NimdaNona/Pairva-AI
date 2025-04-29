import { io, Socket } from 'socket.io-client';
import { 
  Message, 
  Conversation, 
  MessageStatus, 
  MessageType,
  NewMessageEvent,
  MessageStatusUpdateEvent,
  MessagesReadEvent,
  UserTypingEvent,
  NewConversationEvent
} from './types';

// Types for callbacks
type MessageCallback = (message: Message) => void;
type ConversationCallback = (conversation: Conversation) => void;
type StatusUpdateCallback = (update: MessageStatusUpdateEvent) => void;
type MessagesReadCallback = (event: MessagesReadEvent) => void;
type TypingCallback = (event: UserTypingEvent) => void;
type ErrorCallback = (error: any) => void;
type ConnectionCallback = (connected: boolean) => void;

// WebSocket client for real-time messaging
export class WebSocketService {
  private socket: Socket | null = null;
  private token: string = '';
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 2000;
  
  // Callbacks for events
  private onNewMessageCallbacks: MessageCallback[] = [];
  private onStatusUpdateCallbacks: StatusUpdateCallback[] = [];
  private onMessagesReadCallbacks: MessagesReadCallback[] = [];
  private onTypingCallbacks: TypingCallback[] = [];
  private onNewConversationCallbacks: ConversationCallback[] = [];
  private onErrorCallbacks: ErrorCallback[] = [];
  private onConnectionCallbacks: ConnectionCallback[] = [];

  // Get the singleton instance
  private static instance: WebSocketService;
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Connect to the WebSocket server
   */
  public connect(token: string): void {
    if (this.connected) {
      return;
    }

    this.token = token;
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    this.socket = io(`${API_BASE_URL}/messaging`, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectInterval,
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.notifyConnectionChange(false);
    }
  }

  /**
   * Set up event listeners for the socket
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.notifyConnectionChange(false);
    });

    this.socket.on('connect_error', (error: Error) => {
      this.notifyError(error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.disconnect();
      }
    });

    this.socket.on('error', (error: Error) => {
      this.notifyError(error);
    });

    // Message events
    this.socket.on('connection_success', (data: { userId: string }) => {
      console.log('WebSocket connected successfully', data);
    });

    this.socket.on('new_message', (data: Message) => {
      this.notifyNewMessage(data);
    });

    this.socket.on('message_status_update', (data: MessageStatusUpdateEvent) => {
      this.notifyStatusUpdate(data);
    });

    this.socket.on('messages_read', (data: MessagesReadEvent) => {
      this.notifyMessagesRead(data);
    });

    this.socket.on('user_typing', (data: UserTypingEvent) => {
      this.notifyTyping(data);
    });

    this.socket.on('new_conversation', (data: Conversation) => {
      this.notifyNewConversation(data);
    });
  }

  /**
   * Send a message via WebSocket
   */
  public sendMessage(conversationId: string, content: string, type: MessageType = MessageType.TEXT, metadata?: any): void {
    if (!this.socket || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('send_message', {
      conversationId,
      content,
      type,
      metadata,
    });
  }

  /**
   * Mark messages as read in a conversation
   */
  public markAsRead(conversationId: string): void {
    if (!this.socket || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('read_messages', {
      conversationId,
    });
  }

  /**
   * Send a typing indicator
   */
  public sendTypingIndicator(conversationId: string, isTyping: boolean): void {
    if (!this.socket || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('typing', {
      conversationId,
      isTyping,
    });
  }

  /**
   * Create a new conversation
   */
  public createConversation(participantIds: string[], metadata?: any): void {
    if (!this.socket || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('create_conversation', {
      participantIds,
      metadata,
    });
  }

  /**
   * Archive a conversation
   */
  public archiveConversation(conversationId: string): void {
    if (!this.socket || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('archive_conversation', {
      conversationId,
    });
  }

  // Event notification methods
  private notifyNewMessage(message: Message): void {
    this.onNewMessageCallbacks.forEach(callback => callback(message));
  }

  private notifyStatusUpdate(update: MessageStatusUpdateEvent): void {
    this.onStatusUpdateCallbacks.forEach(callback => callback(update));
  }

  private notifyMessagesRead(event: MessagesReadEvent): void {
    this.onMessagesReadCallbacks.forEach(callback => callback(event));
  }

  private notifyTyping(event: UserTypingEvent): void {
    this.onTypingCallbacks.forEach(callback => callback(event));
  }

  private notifyNewConversation(conversation: Conversation): void {
    this.onNewConversationCallbacks.forEach(callback => callback(conversation));
  }

  private notifyError(error: any): void {
    this.onErrorCallbacks.forEach(callback => callback(error));
  }

  private notifyConnectionChange(connected: boolean): void {
    this.onConnectionCallbacks.forEach(callback => callback(connected));
  }

  // Register event listeners
  public onNewMessage(callback: MessageCallback): () => void {
    this.onNewMessageCallbacks.push(callback);
    return () => {
      this.onNewMessageCallbacks = this.onNewMessageCallbacks.filter(cb => cb !== callback);
    };
  }

  public onStatusUpdate(callback: StatusUpdateCallback): () => void {
    this.onStatusUpdateCallbacks.push(callback);
    return () => {
      this.onStatusUpdateCallbacks = this.onStatusUpdateCallbacks.filter(cb => cb !== callback);
    };
  }

  public onMessagesRead(callback: MessagesReadCallback): () => void {
    this.onMessagesReadCallbacks.push(callback);
    return () => {
      this.onMessagesReadCallbacks = this.onMessagesReadCallbacks.filter(cb => cb !== callback);
    };
  }

  public onTyping(callback: TypingCallback): () => void {
    this.onTypingCallbacks.push(callback);
    return () => {
      this.onTypingCallbacks = this.onTypingCallbacks.filter(cb => cb !== callback);
    };
  }

  public onNewConversation(callback: ConversationCallback): () => void {
    this.onNewConversationCallbacks.push(callback);
    return () => {
      this.onNewConversationCallbacks = this.onNewConversationCallbacks.filter(cb => cb !== callback);
    };
  }

  public onError(callback: ErrorCallback): () => void {
    this.onErrorCallbacks.push(callback);
    return () => {
      this.onErrorCallbacks = this.onErrorCallbacks.filter(cb => cb !== callback);
    };
  }

  public onConnectionChange(callback: ConnectionCallback): () => void {
    this.onConnectionCallbacks.push(callback);
    return () => {
      this.onConnectionCallbacks = this.onConnectionCallbacks.filter(cb => cb !== callback);
    };
  }

  // Getters
  public isConnected(): boolean {
    return this.connected;
  }
}

// Export singleton instance
export default WebSocketService.getInstance();
