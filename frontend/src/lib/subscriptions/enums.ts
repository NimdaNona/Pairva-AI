/**
 * Subscription plan tier levels
 */
export enum PlanTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  VIP = 'vip',
}

/**
 * Billing interval options
 */
export enum PlanInterval {
  MONTHLY = 'monthly',
  ANNUALLY = 'annually',
}

/**
 * Subscription status values
 */
export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PENDING = 'pending',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
}
