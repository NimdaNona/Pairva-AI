import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { PlanTier, PlanInterval } from './subscription-plan.schema';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PENDING = 'pending',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
}

@Schema({ timestamps: true })
export class UserSubscription extends Document {
  @Prop({ required: true, type: String })
  userId: string;

  @Prop({ required: true, type: SchemaTypes.ObjectId, ref: 'SubscriptionPlan' })
  planId: Types.ObjectId;

  @Prop({ required: true, enum: PlanTier })
  tier: PlanTier;

  @Prop({ required: true, enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  status: SubscriptionStatus;

  @Prop({ required: true, enum: PlanInterval })
  interval: PlanInterval;

  @Prop({ required: true, type: Number })
  price: number;

  @Prop({ required: true, type: Date })
  startDate: Date;

  @Prop({ required: true, type: Date })
  currentPeriodEnd: Date;

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop({ type: Boolean, default: false })
  cancelAtPeriodEnd: boolean;

  @Prop({ type: String })
  stripeSubscriptionId?: string;

  @Prop({ type: String })
  stripeCustomerId?: string;

  @Prop({ type: Date })
  trialEndDate?: Date;

  @Prop({ type: Boolean, default: false })
  hasUsedTrial: boolean;

  // Keep track of available features for quick access without looking up the plan
  @Prop({ required: true, type: Number, default: 5 })
  matchesPerDay: number;

  @Prop({ required: true, type: Boolean, default: false })
  showLikes: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  priorityMatching: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  readReceipts: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  profileBoost: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  advancedFilters: boolean;

  // Usage statistics
  @Prop({ type: Number, default: 0 })
  matchesUsedToday: number;

  @Prop({ type: Date })
  matchesResetAt: Date;
}

export const UserSubscriptionSchema = SchemaFactory.createForClass(UserSubscription);

// Index for querying by userId and status
UserSubscriptionSchema.index({ userId: 1, status: 1 });

// Index for finding subscriptions that are about to expire
UserSubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
