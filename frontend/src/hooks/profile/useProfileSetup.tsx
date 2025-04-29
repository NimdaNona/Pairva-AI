import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import useAuth from '@/hooks/auth/useAuth';
import {
  ProfileSetupFormData,
  ProfileSetupStep,
  initialProfileSetupFormData,
  formDataToCreateProfileRequest,
} from '@/lib/profile/types';
import { createProfile, getMyProfile, updateProfile } from '@/lib/profile/profileApi';

// Define the context interface
interface ProfileSetupContextValue {
  // Form data
  formData: ProfileSetupFormData;
  updateFormData: (step: ProfileSetupStep, data: any) => void;
  
  // Step management
  currentStep: ProfileSetupStep;
  goToStep: (step: ProfileSetupStep) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  
  // Profile status
  profileId: string | null;
  isExistingProfile: boolean;
  isSubmitting: boolean;
  error: string | null;
  
  // Validation
  validationErrors: { [key: string]: string };
  validateField: (field: string, value: any) => string;
  validateStep: (step: ProfileSetupStep) => { [key: string]: string };
  getAllValidationErrors: () => { [key: string]: string };
  
  // Form actions
  saveProgress: () => Promise<boolean>;
  submitProfile: () => Promise<boolean>;
  isStepValid: (step: ProfileSetupStep) => boolean;
  isFormValid: () => boolean;
}

// Create the context with a default undefined value
const ProfileSetupContext = createContext<ProfileSetupContextValue | undefined>(undefined);

// Steps order for navigation
const STEPS_ORDER = [
  ProfileSetupStep.BASIC_INFO,
  ProfileSetupStep.RELATIONSHIP_PREFERENCES,
  ProfileSetupStep.BIO_INTERESTS,
  ProfileSetupStep.PREFERENCES,
  ProfileSetupStep.ATTRIBUTES,
  ProfileSetupStep.PHOTOS,
  ProfileSetupStep.REVIEW,
];

// Provider component
export const ProfileSetupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  
  // State
  const [formData, setFormData] = useState<ProfileSetupFormData>(initialProfileSetupFormData);
  const [currentStep, setCurrentStep] = useState<ProfileSetupStep>(ProfileSetupStep.BASIC_INFO);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isExistingProfile, setIsExistingProfile] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  
  // Field-specific validators
  const validators = {
    // Basic Info validators
    displayName: (value: string) => {
      if (!value) return 'Name is required';
      if (value.length < 2) return 'Name must be at least 2 characters';
      if (value.length > 50) return 'Name must be less than 50 characters';
      return '';
    },
    birthDate: (value: string | Date) => {
      if (!value) return 'Birth date is required';
      
      const date = new Date(value);
      const now = new Date();
      const minDate = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
      const maxDate = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
      
      if (isNaN(date.getTime())) return 'Invalid date';
      if (date < minDate) return 'Age must be less than 100 years';
      if (date > maxDate) return 'You must be at least 18 years old';
      
      return '';
    },
    gender: (value: string) => {
      if (!value) return 'Gender is required';
      return '';
    },
    location: (value: string) => {
      if (!value) return 'Location is required';
      if (value.length < 2) return 'Location must be at least 2 characters';
      return '';
    },
    
    // Relationship Preferences validators
    relationshipGoal: (value: string) => {
      if (!value) return 'Relationship goal is required';
      return '';
    },
    
    // Bio & Interests validators
    bio: (value: string) => {
      if (!value) return 'Bio is required';
      if (value.length < 10) return 'Bio must be at least 10 characters';
      if (value.length > 500) return 'Bio must be less than 500 characters';
      return '';
    },
    interests: (value: string) => {
      if (!value) return 'Interests are required';
      if (value.length < 10) return 'Interests must be at least 10 characters';
      if (value.length > 300) return 'Interests must be less than 300 characters';
      return '';
    },
    
    // Preferences validators
    genders: (value: string[]) => {
      if (!value || value.length === 0) return 'Please select at least one gender preference';
      return '';
    },
    relationshipGoals: (value: string[]) => {
      if (!value || value.length === 0) return 'Please select at least one relationship goal';
      return '';
    },
    
    // Attributes validators
    personality: (value: string[]) => {
      if (!value || value.length === 0) return 'Please select at least one personality trait';
      return '';
    },
    values: (value: string[]) => {
      if (!value || value.length === 0) return 'Please select at least one value';
      return '';
    },
    lifestyle: (value: string[]) => {
      if (!value || value.length === 0) return 'Please select at least one lifestyle choice';
      return '';
    },
    communication: (value: string[]) => {
      if (!value || value.length === 0) return 'Please select at least one communication style';
      return '';
    },
    
    // Photos validators
    photos: (value: any[]) => {
      if (!value || value.length === 0) return 'At least one photo is required';
      if (!value.some(photo => photo.isMain)) return 'A main photo must be selected';
      return '';
    },
  };
  
  // Load existing profile data if available
  useEffect(() => {
    const loadProfile = async () => {
      if (!isAuthenticated || !user) return;
      
      try {
        const profile = await getMyProfile();
        
        if (profile) {
          setProfileId(profile.id || null);
          setIsExistingProfile(true);
          
          // Map profile data to form data
          const updatedFormData = { ...initialProfileSetupFormData };
          
          // Basic Info
          updatedFormData.basicInfo = {
            displayName: profile.displayName || '',
            birthDate: profile.birthDate || '',
            gender: profile.gender || '',
            location: profile.location || '',
            occupation: profile.occupation || '',
          };
          
          // Relationship Preferences
          updatedFormData.relationshipPreferences = {
            relationshipGoal: profile.relationshipGoal || '',
            relationshipStatus: profile.relationshipStatus || '',
          };
          
          // Bio & Interests
          updatedFormData.bioInterests = {
            bio: profile.bio || '',
            interests: profile.interests || '',
          };
          
          // Preferences
          updatedFormData.preferences = {
            ageMin: profile.preferences?.ageMin || 18,
            ageMax: profile.preferences?.ageMax || 99,
            distance: profile.preferences?.distance || 50,
            genders: profile.preferences?.genders || [],
            relationshipGoals: profile.preferences?.relationshipGoals || [],
          };
          
          // Attributes
          updatedFormData.attributes = {
            personality: profile.attributes?.personality || [],
            values: profile.attributes?.values || [],
            lifestyle: profile.attributes?.lifestyle || [],
            communication: profile.attributes?.communication || [],
          };
          
          // Photos
          updatedFormData.photos = profile.photos || [];
          
          setFormData(updatedFormData);
          
          // If profile is already complete, start at review step
          if (profile.isProfileComplete) {
            setCurrentStep(ProfileSetupStep.REVIEW);
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile data');
      }
    };
    
    loadProfile();
  }, [isAuthenticated, user]);
  
  // Helper to update form data for a specific step
  const updateFormData = (step: ProfileSetupStep, data: any) => {
    setFormData(prev => ({
      ...prev,
      [step]: {
        ...prev[step as keyof ProfileSetupFormData],
        ...data,
      },
    }));
  };
  
  // Step navigation helpers
  const goToStep = (step: ProfileSetupStep) => {
    setCurrentStep(step);
    
    // Update the URL to match the current step
    router.push(`/profile/setup/${step}`, undefined, { shallow: true });
  };
  
  const goToNextStep = () => {
    const currentIndex = STEPS_ORDER.indexOf(currentStep);
    if (currentIndex < STEPS_ORDER.length - 1) {
      goToStep(STEPS_ORDER[currentIndex + 1]);
    }
  };
  
  const goToPreviousStep = () => {
    const currentIndex = STEPS_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      goToStep(STEPS_ORDER[currentIndex - 1]);
    }
  };
  
  // Step position helpers
  const isFirstStep = STEPS_ORDER.indexOf(currentStep) === 0;
  const isLastStep = STEPS_ORDER.indexOf(currentStep) === STEPS_ORDER.length - 1;
  
  // Save current progress
  const saveProgress = async (): Promise<boolean> => {
    if (!isAuthenticated) {
      router.push('/');
      return false;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Convert form data to API request format
      const profileData = formDataToCreateProfileRequest(formData);
      
      let savedProfile;
      
      if (isExistingProfile && profileId) {
        // Update existing profile
        savedProfile = await updateProfile(profileId, profileData);
      } else {
        // Create new profile
        savedProfile = await createProfile(profileData);
        setProfileId(savedProfile.id || null);
        setIsExistingProfile(true);
      }
      
      // Success
      return true;
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile data');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Submit the complete profile
  const submitProfile = async (): Promise<boolean> => {
    // First validate the entire form
    const errors = getAllValidationErrors();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      
      // Find the first step with errors and navigate to it
      for (const step of STEPS_ORDER) {
        const stepErrors = validateStep(step);
        if (Object.keys(stepErrors).length > 0) {
          goToStep(step);
          setError('Please fix the validation errors before submitting.');
          return false;
        }
      }
      return false;
    }
    
    // If valid, save the profile
    const success = await saveProgress();
    if (!success) {
      return false;
    }
    
    // Redirect to dashboard or the appropriate page
    router.push('/dashboard');
    return true;
  };
  
  // Validate a specific field
  const validateField = (field: string, value: any): string => {
    // @ts-ignore - We're using dynamic field names
    const validator = validators[field];
    if (!validator) return '';
    
    return validator(value);
  };

  // Validate all fields in a step
  const validateStep = (step: ProfileSetupStep): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};
    
    if (step === ProfileSetupStep.BASIC_INFO) {
      const { displayName, birthDate, gender, location } = formData.basicInfo;
      
      const nameError = validateField('displayName', displayName);
      if (nameError) errors['displayName'] = nameError;
      
      const birthDateError = validateField('birthDate', birthDate);
      if (birthDateError) errors['birthDate'] = birthDateError;
      
      const genderError = validateField('gender', gender);
      if (genderError) errors['gender'] = genderError;
      
      const locationError = validateField('location', location);
      if (locationError) errors['location'] = locationError;
    }
    
    else if (step === ProfileSetupStep.RELATIONSHIP_PREFERENCES) {
      const { relationshipGoal } = formData.relationshipPreferences;
      
      const goalError = validateField('relationshipGoal', relationshipGoal);
      if (goalError) errors['relationshipGoal'] = goalError;
    }
    
    else if (step === ProfileSetupStep.BIO_INTERESTS) {
      const { bio, interests } = formData.bioInterests;
      
      const bioError = validateField('bio', bio);
      if (bioError) errors['bio'] = bioError;
      
      const interestsError = validateField('interests', interests);
      if (interestsError) errors['interests'] = interestsError;
    }
    
    else if (step === ProfileSetupStep.PREFERENCES) {
      const { genders, relationshipGoals } = formData.preferences;
      
      const gendersError = validateField('genders', genders);
      if (gendersError) errors['genders'] = gendersError;
      
      const goalsError = validateField('relationshipGoals', relationshipGoals);
      if (goalsError) errors['relationshipGoals'] = goalsError;
    }
    
    else if (step === ProfileSetupStep.ATTRIBUTES) {
      const { personality, values, lifestyle, communication } = formData.attributes;
      
      // Make attributes optional but encourage selections
      // Only flag if there are no selections at all across categories
      if ((!personality || personality.length === 0) &&
          (!values || values.length === 0) &&
          (!lifestyle || lifestyle.length === 0) &&
          (!communication || communication.length === 0)) {
        errors['attributes'] = 'Please select at least a few attributes to help find better matches';
      }
    }
    
    else if (step === ProfileSetupStep.PHOTOS) {
      const photosError = validateField('photos', formData.photos);
      if (photosError) errors['photos'] = photosError;
    }
    
    return errors;
  };

  // Validation helpers
  const isStepValid = (step: ProfileSetupStep): boolean => {
    // Handle review step separately
    if (step === ProfileSetupStep.REVIEW) {
      return isFormValid();
    }
    
    // Use new validation system
    const errors = validateStep(step);
    return Object.keys(errors).length === 0;
  };

  // Get all validation errors for the form
  const getAllValidationErrors = (): { [key: string]: string } => {
    const allErrors: { [key: string]: string } = {};
    
    const stepsToValidate = [
      ProfileSetupStep.BASIC_INFO,
      ProfileSetupStep.RELATIONSHIP_PREFERENCES,
      ProfileSetupStep.BIO_INTERESTS,
      ProfileSetupStep.PREFERENCES,
      ProfileSetupStep.ATTRIBUTES,
      ProfileSetupStep.PHOTOS
    ];
    
    for (const step of stepsToValidate) {
      const stepErrors = validateStep(step);
      Object.assign(allErrors, stepErrors);
    }
    
    return allErrors;
  };
  
  const isFormValid = (): boolean => {
    // Use new validation system to check all required steps
    const allErrors = getAllValidationErrors();
    return Object.keys(allErrors).length === 0;
  };
  
  // Construct context value
  const contextValue: ProfileSetupContextValue = {
    formData,
    updateFormData,
    currentStep,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    isFirstStep,
    isLastStep,
    profileId,
    isExistingProfile,
    isSubmitting,
    error,
    // Validation
    validationErrors,
    validateField,
    validateStep,
    getAllValidationErrors,
    // Form actions
    saveProgress,
    submitProfile,
    isStepValid,
    isFormValid,
  };
  
  return (
    <ProfileSetupContext.Provider value={contextValue}>
      {children}
    </ProfileSetupContext.Provider>
  );
};

// Custom hook to use the profile setup context
export const useProfileSetup = () => {
  const context = useContext(ProfileSetupContext);
  if (context === undefined) {
    throw new Error('useProfileSetup must be used within a ProfileSetupProvider');
  }
  return context;
};

export default useProfileSetup;
