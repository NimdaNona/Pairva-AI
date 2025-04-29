import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan, PlanTier, PlanInterval } from './schemas/subscription-plan.schema';
import { UserSubscription, SubscriptionStatus } from './schemas/user-subscription.schema';
import { PaymentService } from './payment.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly frontendUrl: string;

  constructor(
    @InjectModel(SubscriptionPlan.name) private planModel: Model<SubscriptionPlan>,
    @InjectModel(UserSubscription.name) private userSubscriptionModel: Model<UserSubscription>,
    private paymentService: PaymentService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  /**
   * Create a new subscription plan
   */
  async createPlan(
    tier: PlanTier,
    name: string,
    description: string,
    interval: PlanInterval,
    price: number,
    features: {
      matchesPerDay: number;
      showLikes: boolean;
      priorityMatching: boolean;
      readReceipts: boolean;
      profileBoost: boolean;
      advancedFilters: boolean;
    },
    discountPercentage?: number,
  ): Promise<SubscriptionPlan> {
    try {
      // Create plan in our database
      const plan = new this.planModel({
        tier,
        name,
        description,
        interval,
        price,
        discountPercentage,
        ...features,
        features: this.generateFeaturesList(features),
      });

      // Create product and price in Stripe
      const stripeProduct = await this.paymentService.createProduct(
        name,
        description,
        { tier, interval, planId: plan._id.toString() }
      );

      const stripeInterval = interval === PlanInterval.MONTHLY ? 'month' : 'year';
      const stripePrice = await this.paymentService.createPrice(
        stripeProduct.id,
        price,
        'usd',
        stripeInterval,
        { planId: plan._id.toString() }
      );

      // Save Stripe price ID to plan
      plan.stripePriceId = stripePrice.id;
      
      await plan.save();
      return plan;
    } catch (error) {
      this.logger.error(`Error creating subscription plan: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all subscription plans
   */
  async getAllPlans(isActive = true): Promise<SubscriptionPlan[]> {
    const query = isActive ? { isActive: true } : {};
    return this.planModel.find(query).sort({ price: 1 }).exec();
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string): Promise<SubscriptionPlan> {
    const plan = await this.planModel.findById(planId);
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }
    return plan;
  }

  /**
   * Update a subscription plan
   */
  async updatePlan(
    planId: string,
    updateData: Partial<SubscriptionPlan>
  ): Promise<SubscriptionPlan> {
    const plan = await this.planModel.findByIdAndUpdate(
      planId,
      updateData,
      { new: true }
    );

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }

    return plan;
  }

  /**
   * Get user's active subscription
   */
  async getUserActiveSubscription(userId: string): Promise<UserSubscription | null> {
    return this.userSubscriptionModel.findOne({
      userId,
      status: SubscriptionStatus.ACTIVE,
    }).exec();
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<UserSubscription[]> {
    return this.userSubscriptionModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Check if user has an active subscription with a specific feature
   */
  async hasFeatureAccess(userId: string, feature: keyof Omit<UserSubscription, keyof Document>): Promise<boolean> {
    const subscription = await this.getUserActiveSubscription(userId);
    if (!subscription) {
      return false;
    }

    // For feature that has a limit, like matchesPerDay, we need to check the remaining count
    if (feature === 'matchesPerDay') {
      return subscription.matchesUsedToday < subscription.matchesPerDay;
    }

    // For boolean features, just check if they're enabled
    return !!subscription[feature];
  }

  /**
   * Increment the match usage count for a user
   */
  async incrementMatchUsage(userId: string): Promise<boolean> {
    const subscription = await this.getUserActiveSubscription(userId);
    if (!subscription) {
      return false; // User doesn't have an active subscription
    }

    // Check if we need to reset the counter (new day)
    const now = new Date();
    const resetDate = subscription.matchesResetAt || new Date(0);
    
    if (now.getDate() !== resetDate.getDate() || 
        now.getMonth() !== resetDate.getMonth() || 
        now.getFullYear() !== resetDate.getFullYear()) {
      // Reset the counter for a new day
      subscription.matchesUsedToday = 1;
      subscription.matchesResetAt = now;
    } else if (subscription.matchesUsedToday >= subscription.matchesPerDay) {
      return false; // Matches limit reached for today
    } else {
      // Increment the counter
      subscription.matchesUsedToday += 1;
    }

    await subscription.save();
    return true;
  }

  /**
   * Generate a checkout session for a user to purchase a subscription
   */
  async createCheckoutSession(userId: string, planId: string): Promise<string> {
    try {
      // Get the plan
      const plan = await this.getPlanById(planId);
      if (!plan.stripePriceId) {
        throw new BadRequestException('This plan is not available for purchase');
      }

      // Check if user already has an active subscription
      const existingSubscription = await this.getUserActiveSubscription(userId);
      if (existingSubscription) {
        throw new BadRequestException('User already has an active subscription');
      }

      // Get or create Stripe customer
      let stripeCustomerId: string;
      // In a real implementation, we would get user's info from the database
      const userEmail = `${userId}@example.com`; // placeholder
      const userName = 'User'; // placeholder

      // Check if the user already has a Stripe customer ID from previous subscriptions
      const pastSubscription = await this.userSubscriptionModel.findOne({ userId });
      
      if (pastSubscription && pastSubscription.stripeCustomerId) {
        stripeCustomerId = pastSubscription.stripeCustomerId;
      } else {
        // Create a new Stripe customer
        const customer = await this.paymentService.createCustomer(
          userEmail,
          userName,
          { userId }
        );
        stripeCustomerId = customer.id;
      }

      // Create a checkout session
      const session = await this.paymentService.createCheckoutSession(
        plan.stripePriceId,
        stripeCustomerId,
        `${this.frontendUrl}/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`,
        `${this.frontendUrl}/subscriptions/cancel`,
        { planId, userId }
      );

      if (!session.url) {
        throw new BadRequestException('Failed to create checkout session');
      }

      return session.url;
    } catch (error) {
      this.logger.error(`Error creating checkout session: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle successful checkout and create a new user subscription
   */
  async handleCheckoutSuccess(sessionId: string): Promise<UserSubscription> {
    try {
      // TODO: Implement this after connecting with Stripe
      // We would retrieve the session data from Stripe
      // Then create a new subscription record in our database
      // For now, we'll create a placeholder implementation
      
      // In a real implementation, we would get the data from the session
      const userId = 'user123'; // placeholder
      const planId = 'plan123'; // placeholder
      
      return this.createSubscription(userId, planId);
    } catch (error) {
      this.logger.error(`Error handling checkout success: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a new subscription for a user (internal method)
   */
  private async createSubscription(
    userId: string,
    planId: string,
    stripeSubscriptionId?: string,
    stripeCustomerId?: string,
  ): Promise<UserSubscription> {
    // Get the plan
    const plan = await this.getPlanById(planId);

    // Calculate the subscription period
    const startDate = new Date();
    const endDate = new Date(startDate);
    
    if (plan.interval === PlanInterval.MONTHLY) {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create the subscription
    const subscription = new this.userSubscriptionModel({
      userId,
      planId: new Types.ObjectId(planId),
      tier: plan.tier,
      status: SubscriptionStatus.ACTIVE,
      interval: plan.interval,
      price: plan.price,
      startDate,
      currentPeriodEnd: endDate,
      stripeSubscriptionId,
      stripeCustomerId,
      
      // Copy plan features to subscription for quick access
      matchesPerDay: plan.matchesPerDay,
      showLikes: plan.showLikes,
      priorityMatching: plan.priorityMatching,
      readReceipts: plan.readReceipts,
      profileBoost: plan.profileBoost,
      advancedFilters: plan.advancedFilters,
      
      // Usage statistics
      matchesUsedToday: 0,
      matchesResetAt: new Date(),
    });

    await subscription.save();
    return subscription;
  }

  /**
   * Cancel a user's subscription
   */
  async cancelSubscription(
    userId: string,
    subscriptionId: string,
    cancelImmediately = false,
  ): Promise<UserSubscription> {
    // Find the subscription
    const subscription = await this.userSubscriptionModel.findOne({
      _id: subscriptionId,
      userId,
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription not found`);
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Subscription is not active');
    }

    // Update in Stripe if connected
    if (subscription.stripeSubscriptionId) {
      await this.paymentService.cancelSubscription(
        subscription.stripeSubscriptionId,
        cancelImmediately,
      );
    }

    // Update in our database
    if (cancelImmediately) {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
    } else {
      subscription.cancelAtPeriodEnd = true;
    }

    await subscription.save();
    return subscription;
  }

  /**
   * Generate a list of feature descriptions for a plan
   */
  private generateFeaturesList(features: Record<string, any>): string[] {
    const featuresList: string[] = [];

    if (features.matchesPerDay) {
      featuresList.push(`${features.matchesPerDay} matches per day`);
    }
    
    if (features.showLikes) {
      featuresList.push('See who likes you');
    }
    
    if (features.priorityMatching) {
      featuresList.push('Priority in matching algorithm');
    }
    
    if (features.readReceipts) {
      featuresList.push('Read receipts for messages');
    }
    
    if (features.profileBoost) {
      featuresList.push('Profile boost');
    }
    
    if (features.advancedFilters) {
      featuresList.push('Advanced search filters');
    }

    return featuresList;
  }

  /**
   * Process subscription renewals and expirations
   * This would typically be run as a scheduled job
   */
  async processSubscriptionRenewals(): Promise<void> {
    try {
      const currentDate = new Date();
      
      // Find subscriptions that are about to expire
      const expiringSubscriptions = await this.userSubscriptionModel.find({
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { $lte: currentDate },
      });

      for (const subscription of expiringSubscriptions) {
        if (subscription.cancelAtPeriodEnd) {
          // Subscription should be cancelled
          subscription.status = SubscriptionStatus.CANCELLED;
          subscription.cancelledAt = currentDate;
        } else {
          // Subscription should be renewed
          // In a real implementation, we'd rely on Stripe to handle the actual renewal
          // Here we're just updating our records
          const plan = await this.getPlanById(subscription.planId.toString());
          
          // Calculate new period end date
          const newPeriodEnd = new Date(subscription.currentPeriodEnd);
          if (subscription.interval === PlanInterval.MONTHLY) {
            newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
          } else {
            newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
          }
          
          subscription.currentPeriodEnd = newPeriodEnd;
          subscription.price = plan.price; // Update price in case it changed
        }
        
        await subscription.save();
      }
    } catch (error) {
      this.logger.error(`Error processing subscription renewals: ${error.message}`, error.stack);
      throw error;
    }
  }
}
