import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Req,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlan, PlanTier, PlanInterval } from './schemas/subscription-plan.schema';
import { UserSubscription } from './schemas/user-subscription.schema';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  async getAllPlans(
    @Query('active') active: string = 'true',
  ): Promise<SubscriptionPlan[]> {
    const isActive = active === 'true';
    return this.subscriptionsService.getAllPlans(isActive);
  }

  @Get('plans/:id')
  async getPlanById(@Param('id') id: string): Promise<SubscriptionPlan> {
    return this.subscriptionsService.getPlanById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/active')
  async getUserActiveSubscription(@Req() req: AuthenticatedRequest): Promise<UserSubscription | null> {
    if (!req.user.userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.subscriptionsService.getUserActiveSubscription(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/history')
  async getUserSubscriptions(@Req() req: AuthenticatedRequest): Promise<UserSubscription[]> {
    if (!req.user.userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.subscriptionsService.getUserSubscriptions(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout/:planId')
  async createCheckoutSession(
    @Req() req: AuthenticatedRequest,
    @Param('planId') planId: string,
  ): Promise<{ checkoutUrl: string }> {
    if (!req.user.userId) {
      throw new BadRequestException('User ID is required');
    }
    const checkoutUrl = await this.subscriptionsService.createCheckoutSession(
      req.user.userId,
      planId,
    );
    return { checkoutUrl };
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel/:subscriptionId')
  async cancelSubscription(
    @Req() req: AuthenticatedRequest,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { immediate: boolean },
  ): Promise<UserSubscription> {
    if (!req.user.userId) {
      throw new BadRequestException('User ID is required');
    }
    return this.subscriptionsService.cancelSubscription(
      req.user.userId,
      subscriptionId,
      body.immediate,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('features/:feature')
  async checkFeatureAccess(
    @Req() req: AuthenticatedRequest,
    @Param('feature') feature: string,
  ): Promise<{ hasAccess: boolean }> {
    // Validate feature name
    const validFeatures = [
      'matchesPerDay',
      'showLikes',
      'priorityMatching',
      'readReceipts',
      'profileBoost',
      'advancedFilters',
    ];

    if (!validFeatures.includes(feature)) {
      throw new BadRequestException(`Invalid feature: ${feature}`);
    }

    if (!req.user.userId) {
      throw new BadRequestException('User ID is required');
    }

    const hasAccess = await this.subscriptionsService.hasFeatureAccess(
      req.user.userId,
      feature as any, // Using 'any' here as a workaround for type mismatch
    );

    return { hasAccess };
  }

  // Admin only endpoints (would normally have additional auth guards)
  @Post('admin/plans')
  async createPlan(
    @Body()
    planData: {
      tier: PlanTier;
      name: string;
      description: string;
      interval: PlanInterval;
      price: number;
      features: {
        matchesPerDay: number;
        showLikes: boolean;
        priorityMatching: boolean;
        readReceipts: boolean;
        profileBoost: boolean;
        advancedFilters: boolean;
      };
      discountPercentage?: number;
    },
  ): Promise<SubscriptionPlan> {
    return this.subscriptionsService.createPlan(
      planData.tier,
      planData.name,
      planData.description,
      planData.interval,
      planData.price,
      planData.features,
      planData.discountPercentage,
    );
  }

  @Put('admin/plans/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body() updateData: Partial<SubscriptionPlan>,
  ): Promise<SubscriptionPlan> {
    return this.subscriptionsService.updatePlan(id, updateData);
  }

  @Post('webhook/stripe')
  async handleStripeWebhook(
    @Req() req: Request,
    @Body() payload: Buffer,
    @Query('api_key') apiKey: string,
  ): Promise<{ received: boolean }> {
    // In a real implementation, we'd verify the API key and process the webhook
    // This is a placeholder implementation
    return { received: true };
  }

  @Get('success')
  async handleSuccessfulCheckout(
    @Query('session_id') sessionId: string,
  ): Promise<{ success: boolean; subscriptionId: string }> {
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }

    const subscription = await this.subscriptionsService.handleCheckoutSuccess(sessionId);
    return {
      success: true,
      subscriptionId: subscription._id.toString(),
    };
  }
}
