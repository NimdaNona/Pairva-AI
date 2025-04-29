import axios from 'axios';
import { getAuthHeader } from '../auth/authUtils';
import {
  SubscriptionPlan,
  UserSubscription,
  CheckoutResponse,
  FeatureAccessResponse,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Subscription API client for interacting with the subscription endpoints
 */
const subscriptionsApi = {
  /**
   * Get all subscription plans
   * @param activeOnly - Whether to return only active plans
   */
  getPlans: async (activeOnly = true): Promise<SubscriptionPlan[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/subscriptions/plans`, {
        params: { active: activeOnly.toString() },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      throw error;
    }
  },

  /**
   * Get a specific subscription plan by ID
   */
  getPlanById: async (planId: string): Promise<SubscriptionPlan> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/subscriptions/plans/${planId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching subscription plan ${planId}:`, error);
      throw error;
    }
  },

  /**
   * Get the user's active subscription
   */
  getActiveSubscription: async (): Promise<UserSubscription | null> => {
    try {
      const headers = await getAuthHeader();
      const response = await axios.get(`${API_BASE_URL}/subscriptions/user/active`, { headers });
      return response.data;
    } catch (error) {
      // If 404, it means user has no active subscription
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching active subscription:', error);
      throw error;
    }
  },

  /**
   * Get the user's subscription history
   */
  getSubscriptionHistory: async (): Promise<UserSubscription[]> => {
    try {
      const headers = await getAuthHeader();
      const response = await axios.get(`${API_BASE_URL}/subscriptions/user/history`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching subscription history:', error);
      throw error;
    }
  },

  /**
   * Create a checkout session for a subscription plan
   */
  createCheckoutSession: async (planId: string): Promise<string> => {
    try {
      const headers = await getAuthHeader();
      const response = await axios.post<CheckoutResponse>(
        `${API_BASE_URL}/subscriptions/checkout/${planId}`,
        {},
        { headers }
      );
      return response.data.checkoutUrl;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  },

  /**
   * Cancel a subscription
   * @param subscriptionId - The ID of the subscription to cancel
   * @param immediate - Whether to cancel immediately or at the end of the billing period
   */
  cancelSubscription: async (subscriptionId: string, immediate = false): Promise<UserSubscription> => {
    try {
      const headers = await getAuthHeader();
      const response = await axios.post(
        `${API_BASE_URL}/subscriptions/cancel/${subscriptionId}`,
        { immediate },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  },

  /**
   * Check if the user has access to a specific feature
   */
  checkFeatureAccess: async (feature: string): Promise<boolean> => {
    try {
      const headers = await getAuthHeader();
      const response = await axios.get<FeatureAccessResponse>(
        `${API_BASE_URL}/subscriptions/features/${feature}`,
        { headers }
      );
      return response.data.hasAccess;
    } catch (error) {
      // On error, assume no access
      console.error(`Error checking access to feature ${feature}:`, error);
      return false;
    }
  },
};

export default subscriptionsApi;
