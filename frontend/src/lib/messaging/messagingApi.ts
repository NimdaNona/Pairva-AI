import axios from 'axios';
import { getAuthHeader } from '../auth/authUtils';
import {
  Conversation,
  Message,
  GetConversationsResponse,
  GetMessagesResponse,
  CreateConversationRequest,
  SendMessageRequest,
  MessageType,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const MESSAGING_ENDPOINT = `${API_BASE_URL}/messaging`;

/**
 * API client for messaging
 */
const messagingApi = {
  /**
   * Get all conversations for the current user
   */
  async getConversations(
    options: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<GetConversationsResponse> {
    const { limit = 20, offset = 0, status } = options;

    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    if (status) {
      params.append('status', status);
    }

    const response = await axios.get(`${MESSAGING_ENDPOINT}/conversations?${params.toString()}`, {
      headers: await getAuthHeader(),
    });

    return response.data;
  },

  /**
   * Create a new conversation
   */
  async createConversation(request: CreateConversationRequest): Promise<Conversation> {
    const response = await axios.post(`${MESSAGING_ENDPOINT}/conversations`, request, {
      headers: await getAuthHeader(),
    });

    return response.data;
  },

  /**
   * Get messages in a conversation
   */
  async getMessages(conversationId: string): Promise<GetMessagesResponse> {
    const response = await axios.get(`${MESSAGING_ENDPOINT}/conversations/${conversationId}`, {
      headers: await getAuthHeader(),
    });

    return response.data;
  },

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    request: SendMessageRequest
  ): Promise<Message> {
    const response = await axios.post(
      `${MESSAGING_ENDPOINT}/conversations/${conversationId}/messages`,
      request,
      {
        headers: await getAuthHeader(),
      }
    );

    return response.data;
  },

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(conversationId: string): Promise<{ success: boolean }> {
    const response = await axios.put(
      `${MESSAGING_ENDPOINT}/conversations/${conversationId}/read`,
      {},
      {
        headers: await getAuthHeader(),
      }
    );

    return response.data;
  },

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string): Promise<Conversation> {
    const response = await axios.put(
      `${MESSAGING_ENDPOINT}/conversations/${conversationId}/archive`,
      {},
      {
        headers: await getAuthHeader(),
      }
    );

    return response.data;
  },

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string): Promise<{ success: boolean }> {
    const response = await axios.delete(`${MESSAGING_ENDPOINT}/messages/${messageId}`, {
      headers: await getAuthHeader(),
    });

    return response.data;
  },

  /**
   * Get unread message count
   */
  async getUnreadCount(): Promise<{ count: number }> {
    const response = await axios.get(`${MESSAGING_ENDPOINT}/unread-count`, {
      headers: await getAuthHeader(),
    });

    return response.data;
  },
};

export default messagingApi;
