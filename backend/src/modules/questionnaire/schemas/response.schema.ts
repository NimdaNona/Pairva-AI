import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export interface QuestionResponse {
  questionId: string;
  response: string | number | boolean | string[] | number[];
  metadata?: Record<string, any>;
}

@Schema({ timestamps: true })
export class Response extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Questionnaire', required: true })
  questionnaireId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  userId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Profile' })
  profileId: string;

  @Prop({ required: true, type: [Object] })
  responses: QuestionResponse[];

  @Prop()
  completedAt: Date;

  @Prop({ default: false })
  isComplete: boolean;

  @Prop({ type: Object })
  metadata: {
    timeSpent?: number;
    sourceDevice?: string;
    ipAddress?: string;
    questionnaireVersion?: number;
    [key: string]: any;
  };

  @Prop({ type: Object })
  matchingData: {
    processedForMatching: boolean;
    matchingScore?: number;
    personalityFactors?: Record<string, number>;
    preferencesWeight?: Record<string, number>;
    [key: string]: any;
  };
}

export const ResponseSchema = SchemaFactory.createForClass(Response);
