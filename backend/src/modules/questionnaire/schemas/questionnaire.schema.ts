import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Question } from './question.schema';

export enum QuestionnaireCategory {
  PERSONALITY = 'personality',
  PREFERENCES = 'preferences',
  COMPATIBILITY = 'compatibility',
  INTERESTS = 'interests',
  LIFESTYLE = 'lifestyle',
  VALUES = 'values',
}

export enum QuestionnaireStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

@Schema({ timestamps: true })
export class Questionnaire extends Document {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({
    type: String,
    enum: Object.values(QuestionnaireCategory),
    required: true,
  })
  category: QuestionnaireCategory;

  @Prop({
    type: String,
    enum: Object.values(QuestionnaireStatus),
    default: QuestionnaireStatus.DRAFT,
  })
  status: QuestionnaireStatus;

  @Prop({ default: 0 })
  version: number;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Question' }] })
  questions: Question[];

  @Prop({ default: false })
  isRequired: boolean;

  @Prop()
  order: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Questionnaire' })
  previousVersion: Questionnaire;

  @Prop({ type: Object })
  metadata: Record<string, any>;
}

export const QuestionnaireSchema = SchemaFactory.createForClass(Questionnaire);
