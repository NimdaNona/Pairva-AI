import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface CompatibilityFactor {
  name: string;
  score: number;
  description: string;
  category?: string; // Added category field to match implementation
}

export interface PremiumInsights {
  conversationStarters: string[];
  potentialChallenges: string[];
  valueAlignmentDetails: string;
  communicationPatternAnalysis: string;
}

@Schema({ timestamps: true })
export class CompatibilityInsight extends Document {
  @Prop({ required: true, index: true })
  matchId: string;

  @Prop({ required: true, index: true })
  userId1: string;

  @Prop({ required: true, index: true })
  userId2: string;

  @Prop({ required: true, min: 0, max: 100 })
  compatibilityScore: number;

  @Prop({ type: Date, default: Date.now })
  generatedAt: Date;

  @Prop({
    type: Object,
    required: true
  })
  insights: {
    summary: string;
    keyFactors: CompatibilityFactor[];
    detailedAnalysis: string;
    premiumInsights: PremiumInsights;
  };

  @Prop({ type: String })
  aiModel: string;

  @Prop({ type: Number, min: 0, max: 1 })
  vectorSimilarityScore: number;

  @Prop({ type: String })
  matchingVersion: string;

  @Prop({ type: Object })
  metadata: {
    processingTimeMs: number;
    questionCountUser1: number;
    questionCountUser2: number;
    dataSources: string[];
    [key: string]: any;
  };
}

export const CompatibilityInsightSchema = SchemaFactory.createForClass(CompatibilityInsight);

// Ensure the matchId is unique
CompatibilityInsightSchema.index({ matchId: 1 }, { unique: true });

// Add indexes for efficient querying
CompatibilityInsightSchema.index({ userId1: 1 });
CompatibilityInsightSchema.index({ userId2: 1 });
CompatibilityInsightSchema.index({ compatibilityScore: -1 });
CompatibilityInsightSchema.index({ generatedAt: -1 });
