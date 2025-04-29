import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    
    if (!stripeSecretKey) {
      this.logger.warn('Stripe secret key not found in configuration. Payment processing will be unavailable.');
    } else {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-03-31.basil', // Use the latest stable version
      });
      this.logger.log('Payment service initialized with Stripe');
    }
  }

  /**
   * Create a Stripe customer 
   */
  async createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata,
      });
      this.logger.debug(`Created Stripe customer: ${customer.id} for ${email}`);
      return customer;
    } catch (error) {
      this.logger.error(`Error creating Stripe customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a subscription in Stripe
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    trialDays = 0,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        expand: ['latest_invoice.payment_intent'],
        metadata,
      };

      // Add trial period if specified
      if (trialDays > 0) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + trialDays);
        subscriptionData.trial_end = Math.floor(trialEnd.getTime() / 1000);
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);
      
      this.logger.debug(`Created Stripe subscription: ${subscription.id} for customer ${customerId}`);
      return subscription;
    } catch (error) {
      this.logger.error(`Error creating Stripe subscription: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel a subscription in Stripe
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately = false,
  ): Promise<Stripe.Subscription> {
    try {
      let subscription: Stripe.Subscription;

      if (cancelImmediately) {
        // Cancel immediately
        subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        // Cancel at period end
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }

      this.logger.debug(`Cancelled Stripe subscription: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      this.logger.error(`Error cancelling Stripe subscription: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a Stripe price for a plan
   */
  async createPrice(
    productId: string,
    unitAmount: number,
    currency = 'usd',
    interval: 'month' | 'year',
    metadata?: Record<string, string>,
  ): Promise<Stripe.Price> {
    try {
      const price = await this.stripe.prices.create({
        product: productId,
        unit_amount: unitAmount * 100, // Convert to cents
        currency,
        recurring: {
          interval,
        },
        metadata,
      });

      this.logger.debug(`Created Stripe price: ${price.id} for product ${productId}`);
      return price;
    } catch (error) {
      this.logger.error(`Error creating Stripe price: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create a Stripe product for a subscription plan
   */
  async createProduct(
    name: string,
    description: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.create({
        name,
        description,
        metadata,
      });

      this.logger.debug(`Created Stripe product: ${product.id} - ${name}`);
      return product;
    } catch (error) {
      this.logger.error(`Error creating Stripe product: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get subscription by ID from Stripe
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      this.logger.error(`Error retrieving Stripe subscription: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   * 
   * Verifies the webhook signature using Stripe's recommended approach,
   * then processes the event based on its type.
   * 
   * @param signature The Stripe-Signature header value
   * @param payload The raw request body
   * @throws UnauthorizedException if signature verification fails
   * @throws BadRequestException if webhook processing fails
   */
  async handleWebhookEvent(signature: string, payload: Buffer): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('Stripe webhook secret is not configured');
      throw new BadRequestException('Stripe webhook configuration error');
    }

    let event: Stripe.Event;

    try {
      // Verify signature using Stripe's constructEvent method
      // This verifies the webhook was sent by Stripe and not a malicious actor
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
      
      this.logger.debug(`Received Stripe webhook event: ${event.type} (ID: ${event.id})`);
    } catch (error) {
      // Signature verification failed
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    try {
      // Process different event types
      switch (event.type) {
        case 'invoice.payment_succeeded':
          // Handle successful payment
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          // Handle failed payment
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.deleted':
          // Handle subscription cancellation
          await this.handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          // Handle subscription update
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        default:
          this.logger.debug(`Unhandled Stripe webhook event type: ${event.type}`);
      }
      
      this.logger.debug(`Successfully processed webhook event: ${event.type} (ID: ${event.id})`);
    } catch (error) {
      this.logger.error(`Error processing Stripe webhook event ${event?.type}: ${error.message}`, error.stack);
      throw new BadRequestException(`Error processing webhook: ${error.message}`);
    }
  }

  /**
   * Handle successful payment webhook event
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Implementation will be added here
    // We'll update the subscription status to active
    this.logger.debug(`Payment succeeded for invoice: ${invoice.id}`);
  }

  /**
   * Handle failed payment webhook event
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Implementation will be added here
    // We'll update the subscription status to past_due
    this.logger.debug(`Payment failed for invoice: ${invoice.id}`);
  }

  /**
   * Handle subscription cancellation webhook event
   */
  private async handleSubscriptionCancelled(subscription: Stripe.Subscription): Promise<void> {
    // Implementation will be added here
    // We'll update the subscription status to cancelled
    this.logger.debug(`Subscription cancelled: ${subscription.id}`);
  }

  /**
   * Handle subscription update webhook event
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    // Implementation will be added here
    // We'll update the subscription in our database
    this.logger.debug(`Subscription updated: ${subscription.id}`);
  }

  /**
   * Create a checkout session for subscription purchase
   */
  async createCheckoutSession(
    priceId: string,
    customerId: string,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer: customerId,
        metadata,
      });

      return session;
    } catch (error) {
      this.logger.error(`Error creating checkout session: ${error.message}`, error.stack);
      throw error;
    }
  }
}
