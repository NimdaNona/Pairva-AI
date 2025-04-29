import { PlanTier, PlanInterval } from './enums';

export interface SubscriptionPlan {
  _id: string;
  tier: PlanTier;
  name: string;
  description: string;
  interval: PlanInterval;
  price: number;
  discountPercentage?: number;
  matchesPerDay: number;
  showLikes: boolean;
  priorityMatching: boolean;
  readReceipts: boolean;
  profileBoost: boolean;
  advancedFilters: boolean;
  isActive: boolean;
  features: string[];
  stripePriceId?: string;
}

export interface UserSubscription {
  _id: string;
  userId: string;
  planId: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  interval: PlanInterval;
  price: number;
  startDate: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  trialEndDate?: string;
  hasUsedTrial: boolean;
  // Features
  matchesPerDay: number;
  showLikes: boolean;
  priorityMatching: boolean;
  readReceipts: boolean;
  profileBoost: boolean;
  advancedFilters: boolean;
  // Usage
  matchesUsedToday: number;
  matchesResetAt?: string;
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PENDING = 'pending',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
}

export interface CheckoutResponse {
  checkoutUrl: string;
}

export interface FeatureAccessResponse {
  hasAccess: boolean;
}
