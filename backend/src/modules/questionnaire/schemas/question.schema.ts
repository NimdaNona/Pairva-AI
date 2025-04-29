import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  SINGLE_CHOICE = 'single_choice',
  SHORT_TEXT = 'short_text',
  LONG_TEXT = 'long_text',
  RATING = 'rating',
  SCALE = 'scale',
  BOOLEAN = 'boolean',
  SLIDER = 'slider',
}

export interface QuestionOption {
  id: string;
  text: string;
  value: string | number;
  metadata?: Record<string, any>;
}

@Schema({ timestamps: true })
export class Question extends Document {
  @Prop({ required: true })
  text: string;

  @Prop()
  description: string;

  @Prop({
    type: String,
    enum: Object.values(QuestionType),
    required: true,
  })
  type: QuestionType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Questionnaire', required: true })
  questionnaire: string;

  @Prop({ type: Boolean, default: false })
  isRequired: boolean;

  @Prop()
  order: number;

  @Prop({ type: Array })
  options: QuestionOption[];

  @Prop({ type: Object })
  validations: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };

  @Prop({ type: Object })
  metadata: {
    aiMatchingWeight?: number;
    compatibilityFactor?: string;
    category?: string;
    displayCondition?: Record<string, any>;
    [key: string]: any;
  };

  @Prop({ default: true })
  isActive: boolean;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
