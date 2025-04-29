import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NotificationType } from './notification.schema';

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
}

@Schema()
export class NotificationChannelPreference {
  @Prop({ type: Boolean, default: true })
  enabled: boolean;

  @Prop({ type: [{ type: String, enum: NotificationType }], default: Object.values(NotificationType) })
  types: NotificationType[];
}

@Schema({ timestamps: true })
export class NotificationPreferences extends Document {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ type: Object, default: { enabled: true, types: Object.values(NotificationType) } })
  inApp: NotificationChannelPreference;

  @Prop({ type: Object, default: { enabled: true, types: Object.values(NotificationType) } })
  email: NotificationChannelPreference;
  
  @Prop({ type: Object, default: { enabled: true, types: [
    NotificationType.NEW_MESSAGE,
    NotificationType.NEW_MATCH,
    NotificationType.MATCH_LIKED_YOU
  ]} })
  push: NotificationChannelPreference;
  
  @Prop({ default: true })
  doNotDisturb: boolean;
  
  @Prop({ default: '22:00' }) // 10 PM
  quietHoursStart: string;
  
  @Prop({ default: '08:00' }) // 8 AM
  quietHoursEnd: string;
  
  @Prop({ default: 'America/New_York' })
  timezone: string;
  
  @Prop({ default: Date.now })
  createdAt: Date;
  
  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const NotificationPreferencesSchema = SchemaFactory.createForClass(NotificationPreferences);

// Create indexes for faster queries
NotificationPreferencesSchema.index({ userId: 1 }, { unique: true });
