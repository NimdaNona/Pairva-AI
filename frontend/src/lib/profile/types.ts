import { Gender, RelationshipGoal, RelationshipStatus } from './enums';

/**
 * Profile information - matches the backend ProfileEntity structure
 */
export interface Profile {
  id?: string;
  userId?: string;
  
  // Basic Information
  displayName?: string;
  birthDate?: Date | string;
  gender?: Gender;
  location?: string;
  occupation?: string;
  
  // Relationship preferences
  relationshipGoal?: RelationshipGoal;
  relationshipStatus?: RelationshipStatus;
  
  // Biography and details
  bio?: string;
  interests?: string;
  
  // Preferences
  preferences?: {
    ageMin?: number;
    ageMax?: number;
    distance?: number;
    genders?: Gender[];
    relationshipGoals?: RelationshipGoal[];
  };
  
  // Personal attributes
  attributes?: {
    personality?: string[];
    values?: string[];
    lifestyle?: string[];
    communication?: string[];
  };
  
  // Profile pictures
  photos?: {
    url: string;
    order: number;
    isMain: boolean;
  }[];
  
  // Status fields
  isActive?: boolean;
  isProfileComplete?: boolean;
  lastActive?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * Create profile request body
 */
export interface CreateProfileRequest extends Omit<Profile, 'id' | 'userId' | 'isActive' | 'isProfileComplete' | 'lastActive' | 'createdAt' | 'updatedAt'> {
  // Required fields
  displayName: string;
  birthDate: Date | string;
  gender: Gender;
  location: string;
  relationshipGoal: RelationshipGoal;
  bio: string;
  interests: string;
}

/**
 * Update profile request body 
 */
export type UpdateProfileRequest = Partial<CreateProfileRequest>;

/**
 * Profile photo upload request
 */
export interface PhotoUploadRequest {
  file?: File;
  url?: string;
  isMain?: boolean;
}

/**
 * Profile setup steps
 */
export enum ProfileSetupStep {
  BASIC_INFO = 'basicInfo',
  RELATIONSHIP_PREFERENCES = 'relationshipPreferences',
  BIO_INTERESTS = 'bioInterests',
  PREFERENCES = 'preferences',
  ATTRIBUTES = 'attributes',
  PHOTOS = 'photos',
  REVIEW = 'review',
}

/**
 * Profile setup form data
 * Structures the data for each step of the profile setup wizard
 */
export interface ProfileSetupFormData {
  // Step 1: Basic Information
  basicInfo: {
    displayName: string;
    birthDate: Date | string;
    gender: Gender | string;
    location: string;
    occupation: string;
  };
  
  // Step 2: Relationship Preferences
  relationshipPreferences: {
    relationshipGoal: RelationshipGoal | string;
    relationshipStatus: RelationshipStatus | string;
  };
  
  // Step 3: Bio & Interests
  bioInterests: {
    bio: string;
    interests: string;
  };
  
  // Step 4: Preferences
  preferences: {
    ageMin: number;
    ageMax: number;
    distance: number;
    genders: Gender[];
    relationshipGoals: RelationshipGoal[];
  };
  
  // Step 5: Attributes
  attributes: {
    personality: string[];
    values: string[];
    lifestyle: string[];
    communication: string[];
  };
  
  // Step 6: Photos
  photos: {
    url: string;
    order: number;
    isMain: boolean;
  }[];
}

/**
 * Default or initial profile setup form data
 */
export const initialProfileSetupFormData: ProfileSetupFormData = {
  basicInfo: {
    displayName: '',
    birthDate: '',
    gender: '',
    location: '',
    occupation: '',
  },
  relationshipPreferences: {
    relationshipGoal: '',
    relationshipStatus: RelationshipStatus.SINGLE,
  },
  bioInterests: {
    bio: '',
    interests: '',
  },
  preferences: {
    ageMin: 18,
    ageMax: 99,
    distance: 50,
    genders: [],
    relationshipGoals: [],
  },
  attributes: {
    personality: [],
    values: [],
    lifestyle: [],
    communication: [],
  },
  photos: [],
};

/**
 * Convert profile setup form data to create profile request
 */
export const formDataToCreateProfileRequest = (formData: ProfileSetupFormData): CreateProfileRequest => {
  return {
    displayName: formData.basicInfo.displayName,
    birthDate: formData.basicInfo.birthDate,
    gender: formData.basicInfo.gender as Gender,
    location: formData.basicInfo.location,
    occupation: formData.basicInfo.occupation,
    relationshipGoal: formData.relationshipPreferences.relationshipGoal as RelationshipGoal,
    relationshipStatus: formData.relationshipPreferences.relationshipStatus as RelationshipStatus,
    bio: formData.bioInterests.bio,
    interests: formData.bioInterests.interests,
    preferences: formData.preferences,
    attributes: formData.attributes,
    photos: formData.photos,
  };
};
