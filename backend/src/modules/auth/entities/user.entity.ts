import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  @Exclude()
  passwordHash?: string;

  @Column({ nullable: true, unique: true })
  cognitoId?: string;

  @Column({ default: 'local' })
  authProvider: string; // 'local', 'cognito', etc.

  @Column({ default: 'free' })
  subscriptionTier: string; // 'free', 'premium'

  @Column({ type: 'jsonb', nullable: true })
  attributes: Record<string, any>; // Additional custom attributes

  @Column({ default: false })
  profileCompleted: boolean;

  @Column({ default: false })
  questionnaireCompleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  get fullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || '';
  }

  get isProfileComplete(): boolean {
    return this.profileCompleted;
  }

  get isQuestionnaireComplete(): boolean {
    return this.questionnaireCompleted;
  }

  get isSubscriptionActive(): boolean {
    return this.subscriptionTier === 'premium';
  }
}
