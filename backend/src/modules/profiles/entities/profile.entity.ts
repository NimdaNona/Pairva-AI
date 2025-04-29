import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { UserEntity } from '../../auth/entities/user.entity';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  NON_BINARY = 'non_binary',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export enum RelationshipGoal {
  FRIENDSHIP = 'friendship',
  CASUAL_DATING = 'casual_dating',
  SERIOUS_RELATIONSHIP = 'serious_relationship',
  MARRIAGE = 'marriage',
  NOT_SURE = 'not_sure',
}

export enum RelationshipStatus {
  SINGLE = 'single',
  DIVORCED = 'divorced',
  SEPARATED = 'separated',
  WIDOWED = 'widowed',
  COMPLICATED = 'complicated',
}

@Entity('profiles')
export class ProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: UserEntity;

  @Column({ nullable: true })
  userId: string;

  // Basic Information
  @Column({ nullable: true })
  displayName: string;

  @Column({ nullable: true })
  birthDate: Date;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender: Gender;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  occupation: string;

  // Relationship preferences
  @Column({
    type: 'enum',
    enum: RelationshipGoal,
    nullable: true,
  })
  relationshipGoal: RelationshipGoal;

  @Column({
    type: 'enum',
    enum: RelationshipStatus,
    default: RelationshipStatus.SINGLE,
  })
  relationshipStatus: RelationshipStatus;

  // Biography and details
  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'text', nullable: true })
  interests: string;

  // Preferences
  @Column({ type: 'jsonb', nullable: true })
  preferences: {
    ageMin?: number;
    ageMax?: number;
    distance?: number;
    genders?: Gender[];
    relationshipGoals?: RelationshipGoal[];
  };

  // Personal attributes
  @Column({ type: 'jsonb', nullable: true })
  attributes: {
    personality?: string[];
    values?: string[];
    lifestyle?: string[];
    communication?: string[];
  };

  // Profile pictures
  @Column({ type: 'jsonb', default: [] })
  photos: {
    url: string;
    order: number;
    isMain: boolean;
  }[];

  // Match settings
  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isProfileComplete: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastActive: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  getAge(): number | null {
    if (!this.birthDate) return null;
    const now = new Date();
    const birthDate = new Date(this.birthDate);
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  getMainPhoto(): string | null {
    if (!this.photos || this.photos.length === 0) return null;
    const mainPhoto = this.photos.find(photo => photo.isMain);
    return mainPhoto ? mainPhoto.url : this.photos[0].url;
  }

  updateCompletionStatus(): boolean {
    // Define required fields for a complete profile
    const requiredFields = [
      this.displayName,
      this.birthDate,
      this.gender,
      this.location,
      this.relationshipGoal,
      this.bio,
      this.interests,
    ];
    
    // Check if all required fields have values and at least one photo exists
    const allRequiredFieldsCompleted = requiredFields.every(field => field !== null && field !== undefined);
    const hasPhotos = this.photos && this.photos.length > 0;
    
    this.isProfileComplete = allRequiredFieldsCompleted && hasPhotos;
    return this.isProfileComplete;
  }
}
