import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import subscriptionsApi from '../../lib/subscriptions/subscriptionsApi';
import { SubscriptionPlan, UserSubscription } from '../../lib/subscriptions/types';

interface SubscriptionContextType {
  // Subscription data
  loading: boolean;
  plans: SubscriptionPlan[];
  activeSubscription: UserSubscription | null;
  subscriptionHistory: UserSubscription[];
  
  // Actions
  refreshSubscription: () => Promise<void>;
  createCheckout: (planId: string) => Promise<string>;
  cancelSubscription: (subscriptionId: string, immediate?: boolean) => Promise<UserSubscription>;
  checkFeatureAccess: (feature: string) => Promise<boolean>;
  
  // Helper functions
  getPlanById: (planId: string) => SubscriptionPlan | undefined;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<UserSubscription | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<UserSubscription[]>([]);

  // Load subscription plans (available to all users)
  const loadPlans = useCallback(async () => {
    try {
      const plansData = await subscriptionsApi.getPlans();
      setPlans(plansData);
    } catch (error) {
      console.error('Error loading subscription plans:', error);
    }
  }, []);

  // Load user subscription data (only for authenticated users)
  const loadUserSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setActiveSubscription(null);
      setSubscriptionHistory([]);
      return;
    }

    try {
      const [active, history] = await Promise.all([
        subscriptionsApi.getActiveSubscription(),
        subscriptionsApi.getSubscriptionHistory(),
      ]);
      
      setActiveSubscription(active);
      setSubscriptionHistory(history);
    } catch (error) {
      console.error('Error loading user subscription data:', error);
    }
  }, [isAuthenticated]);

  // Refresh all subscription data
  const refreshSubscription = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPlans(), loadUserSubscription()]);
    setLoading(false);
  }, [loadPlans, loadUserSubscription]);

  // Initialize subscription data
  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  // Create checkout session
  const createCheckout = useCallback(async (planId: string): Promise<string> => {
    return subscriptionsApi.createCheckoutSession(planId);
  }, []);

  // Cancel subscription
  const cancelSubscription = useCallback(
    async (subscriptionId: string, immediate = false): Promise<UserSubscription> => {
      const result = await subscriptionsApi.cancelSubscription(subscriptionId, immediate);
      // Refresh subscription data after cancellation
      await loadUserSubscription();
      return result;
    },
    [loadUserSubscription]
  );

  // Check feature access
  const checkFeatureAccess = useCallback(async (feature: string): Promise<boolean> => {
    return subscriptionsApi.checkFeatureAccess(feature);
  }, []);

  // Helper function to find a plan by ID
  const getPlanById = useCallback(
    (planId: string): SubscriptionPlan | undefined => {
      return plans.find(plan => plan._id === planId);
    },
    [plans]
  );

  const value = {
    loading,
    plans,
    activeSubscription,
    subscriptionHistory,
    refreshSubscription,
    createCheckout,
    cancelSubscription,
    checkFeatureAccess,
    getPlanById,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  
  return context;
};
