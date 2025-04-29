import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { NextPage } from 'next';
import ProfileSetupLayout from '@/components/profile/ProfileSetupLayout';
import BasicInfoStep from '@/components/profile/steps/BasicInfoStep';
import RelationshipPreferencesStep from '@/components/profile/steps/RelationshipPreferencesStep';
import BioInterestsStep from '@/components/profile/steps/BioInterestsStep';
import PreferencesStep from '@/components/profile/steps/PreferencesStep';
import AttributesStep from '@/components/profile/steps/AttributesStep';
import PhotosStep from '@/components/profile/steps/PhotosStep';
import ReviewStep from '@/components/profile/steps/ReviewStep';
import { ProfileSetupStep } from '@/lib/profile/types';
import { useProfileSetup } from '@/hooks/profile/useProfileSetup';
import withProtection from '@/components/auth/withProtection';

// Dynamic step component based on current step
const StepComponent = ({ step }: { step: string }) => {
  // Map step to component
  switch (step) {
    case ProfileSetupStep.BASIC_INFO:
      return <BasicInfoStep />;
    case ProfileSetupStep.RELATIONSHIP_PREFERENCES:
      return <RelationshipPreferencesStep />;
    case ProfileSetupStep.BIO_INTERESTS:
      return <BioInterestsStep />;
    case ProfileSetupStep.PREFERENCES:
      return <PreferencesStep />;
    case ProfileSetupStep.ATTRIBUTES:
      return <AttributesStep />;
    case ProfileSetupStep.PHOTOS:
      return <PhotosStep />;
    case ProfileSetupStep.REVIEW:
      return <ReviewStep />;
    default:
      return <BasicInfoStep />;
  }
};

const ProfileSetupPage: NextPage = () => {
  const router = useRouter();
  const { step } = router.query;
  const { goToStep } = useProfileSetup();

  // Set the current step based on URL
  useEffect(() => {
    if (step && typeof step === 'string') {
      // Validate that the step is a valid ProfileSetupStep
      const isValidStep = Object.values(ProfileSetupStep).includes(step as ProfileSetupStep);
      
      if (isValidStep) {
        goToStep(step as ProfileSetupStep);
      } else {
        // If invalid step, redirect to first step
        router.replace(`/profile/setup/${ProfileSetupStep.BASIC_INFO}`);
      }
    }
  }, [step, goToStep, router]);

  return (
    <ProfileSetupLayout>
      {/* Render appropriate step component */}
      {step && typeof step === 'string' && <StepComponent step={step} />}
    </ProfileSetupLayout>
  );
};

// Wrap with withProtection to ensure user is authenticated
export default withProtection(ProfileSetupPage);
