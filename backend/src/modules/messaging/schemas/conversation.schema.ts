import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ConversationDocument = Conversation & Document;

export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  BLOCKED = 'blocked'
}

@Schema({
  timestamps: true,
  collection: 'conversations'
})
export class Conversation {
  @Prop({ required: true })
  conversationId: string;

  @Prop({ required: true })
  participantIds: string[];

  @Prop({ required: true, enum: ConversationStatus, default: ConversationStatus.ACTIVE })
  status: ConversationStatus;

  @Prop()
  lastMessageId: string;

  @Prop()
  lastMessagePreview: string;

  @Prop()
  lastMessageSentAt: Date;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  readStatus: Record<string, Date>;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes for efficient queries
ConversationSchema.index({ participantIds: 1 });
ConversationSchema.index({ conversationId: 1 }, { unique: true });
ConversationSchema.index({ status: 1 });
ConversationSchema.index({ lastMessageSentAt: -1 });
