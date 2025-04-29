import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum MatchStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true })
export class Match extends Document {
  @Prop({ required: true, unique: true })
  matchId: string;

  @Prop({ required: true, index: true })
  userId1: string;

  @Prop({ required: true, index: true })
  userId2: string;

  @Prop({ required: true, min: 0, max: 100 })
  compatibilityScore: number;

  @Prop({ 
    type: String, 
    enum: Object.values(MatchStatus), 
    default: MatchStatus.PENDING,
    index: true
  })
  status: MatchStatus;

  @Prop({ default: false })
  user1Liked: boolean;

  @Prop({ default: false })
  user2Liked: boolean;

  @Prop()
  lastActivityAt: Date;

  @Prop({ default: false })
  hasBeenSeen: boolean;

  @Prop({ type: Boolean, default: false })
  isHidden: boolean;

  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop()
  vectorSimilarityScore: number;

  @Prop({ type: String })
  aiModel: string;

  @Prop({ type: String })
  matchingVersion: string;

  @Prop({ type: Object })
  metadata: {
    processingTimeMs: number;
    dataSources: string[];
    [key: string]: any;
  };
}

export const MatchSchema = SchemaFactory.createForClass(Match);

// Ensure the combination of userId1 and userId2 is unique
MatchSchema.index({ userId1: 1, userId2: 1 }, { unique: true });

// Add index for searching/sorting
MatchSchema.index({ userId1: 1, status: 1, compatibilityScore: -1 });
MatchSchema.index({ userId2: 1, status: 1, compatibilityScore: -1 });
MatchSchema.index({ createdAt: -1 });
