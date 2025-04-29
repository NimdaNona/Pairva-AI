import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum PlanInterval {
  MONTHLY = 'monthly',
  ANNUALLY = 'annually',
}

export enum PlanTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  VIP = 'vip',
}

@Schema({ timestamps: true })
export class SubscriptionPlan extends Document {
  @Prop({ required: true, enum: PlanTier })
  tier: PlanTier;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: PlanInterval })
  interval: PlanInterval;

  @Prop({ required: true, type: Number })
  price: number;

  @Prop({ type: Number })
  discountPercentage?: number;

  @Prop({ required: true, type: Number })
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

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ type: String })
  stripePriceId?: string;
}

export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);
