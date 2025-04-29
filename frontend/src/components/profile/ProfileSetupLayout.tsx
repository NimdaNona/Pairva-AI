import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { 
  Container, 
  Paper, 
  Box, 
  Stepper, 
  Step, 
  StepLabel, 
  Typography, 
  CircularProgress,
  Alert,
  AlertTitle,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Tooltip,
  Badge
} from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { ProfileSetupProvider, useProfileSetup } from '@/hooks/profile/useProfileSetup';
import { ProfileSetupStep } from '@/lib/profile/types';
import Button from '@/components/common/Button';
import { announceToScreenReader, addSkipLink } from '@/utils/accessibility';

interface ProfileSetupLayoutProps {
  children: ReactNode;
}

// Steps for the stepper
const steps = [
  { label: 'Basic Info', value: ProfileSetupStep.BASIC_INFO },
  { label: 'Relationship', value: ProfileSetupStep.RELATIONSHIP_PREFERENCES },
  { label: 'Bio & Interests', value: ProfileSetupStep.BIO_INTERESTS },
  { label: 'Preferences', value: ProfileSetupStep.PREFERENCES },
  { label: 'Attributes', value: ProfileSetupStep.ATTRIBUTES },
  { label: 'Photos', value: ProfileSetupStep.PHOTOS },
  { label: 'Review', value: ProfileSetupStep.REVIEW },
];

// Custom StepLabel to show validation status
interface CustomStepLabelProps {
  stepLabel: string;
  isValid: boolean;
  isActive: boolean;
  isPreviousStep: boolean;
}

const CustomStepLabel: React.FC<CustomStepLabelProps> = ({ stepLabel, isValid, isActive, isPreviousStep }) => {
  // Only show validation indicators for steps that have been visited or are the current step
  const shouldShowValidation = isActive || isPreviousStep;
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {shouldShowValidation && !isValid ? (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" color="error">
            Needs attention
          </Typography>
          <ErrorOutlineIcon color="error" fontSize="small" sx={{ ml: 0.5 }} />
        </Box>
      ) : (
        shouldShowValidation && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" color="success.main">
              Complete
            </Typography>
            <CheckCircleOutlineIcon color="success" fontSize="small" sx={{ ml: 0.5 }} />
          </Box>
        )
      )}
      <Typography
        variant="body2"
        color={isActive ? 'primary.main' : (shouldShowValidation && !isValid ? 'error' : 'text.primary')}
        fontWeight={isActive ? 'bold' : 'normal'}
      >
        {stepLabel}
      </Typography>
    </Box>
  );
};

// Inner component that uses the profile setup context
const ProfileSetupLayoutInner: React.FC<ProfileSetupLayoutProps> = ({ children }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  
  const {
    currentStep,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    isFirstStep,
    isLastStep,
    isStepValid,
    saveProgress,
    submitProfile,
    isSubmitting,
    error,
    getAllValidationErrors,
  } = useProfileSetup();

  // State to track which steps have been visited
  const [visitedSteps, setVisitedSteps] = useState<{[key in ProfileSetupStep]?: boolean}>({
    [currentStep]: true
  });

  // Get the active step index for the stepper
  const activeStepIndex = steps.findIndex(step => step.value === currentStep);
  
  // Add skip navigation link and set up accessibility features
  useEffect(() => {
    // Add skip link to main content
    if (contentRef.current) {
      const mainContentId = 'profile-setup-main-content';
      contentRef.current.id = mainContentId;
      addSkipLink(mainContentId);
    }
  }, []);
  
  // Announce step changes to screen readers
  useEffect(() => {
    const stepInfo = steps.find(step => step.value === currentStep);
    if (stepInfo) {
      announceToScreenReader(`Step ${activeStepIndex + 1} of ${steps.length}: ${stepInfo.label}`);
    }
  }, [currentStep, activeStepIndex]);
  
  // Update visited steps when the current step changes
  useEffect(() => {
    setVisitedSteps(prev => ({
      ...prev,
      [currentStep]: true
    }));
  }, [currentStep]);

  // Handle next button click
  const handleNext = async () => {
    if (isStepValid(currentStep)) {
      // Save progress before moving to next step
      await saveProgress();
      goToNextStep();
    }
  };

  // Handle back button click
  const handleBack = () => {
    goToPreviousStep();
  };

  // Handle submit button click
  const handleSubmit = async () => {
    await submitProfile();
  };

  // Handle step click in stepper
  const handleStepClick = (step: ProfileSetupStep) => {
    // Only allow clicking on steps that are valid or we've already been to
    const stepIndex = steps.findIndex(s => s.value === step);
    const currentIndex = steps.findIndex(s => s.value === currentStep);

    if (stepIndex <= currentIndex || steps.slice(0, stepIndex).every(s => isStepValid(s.value))) {
      goToStep(step);
    }
  };

  return (
    <Container maxWidth="md" sx={{ pt: 4, pb: 8 }}>
      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Profile Setup
        </Typography>
        <Typography variant="subtitle1" gutterBottom align="center" color="text.secondary" sx={{ mb: 4 }}>
          Let's create your profile to find your perfect match
        </Typography>

        {/* Stepper */}
        <Stepper activeStep={activeStepIndex} alternativeLabel sx={{ mb: 6 }}>
          {steps.map((step, index) => {
            const isValid = isStepValid(step.value);
            const isPreviousStep = index < activeStepIndex;
            const isStepVisited = visitedSteps[step.value];
            
            return (
              <Step 
                key={step.value} 
                completed={isValid && (isStepVisited || isPreviousStep)}
              >
                <Tooltip 
                  title={!isValid && (isStepVisited || isPreviousStep) ? "This step needs attention" : ""}
                  arrow
                >
                  <StepLabel
                    onClick={() => handleStepClick(step.value)}
                    sx={{ 
                      cursor: 'pointer',
                      '& .MuiStepLabel-iconContainer': {
                        // Apply a red border for visited invalid steps
                        ...((!isValid && (isStepVisited || isPreviousStep)) && {
                          borderColor: 'error.main',
                        }),
                      }
                    }}
                    StepIconProps={{
                      error: !isValid && (isStepVisited || isPreviousStep),
                    }}
                    optional={
                      <CustomStepLabel 
                        stepLabel={step.label} 
                        isValid={isValid} 
                        isActive={currentStep === step.value}
                        isPreviousStep={isPreviousStep}
                      />
                    }
                  >
                    {/* Empty StepLabel text as we use optional for our custom label */}
                  </StepLabel>
                </Tooltip>
              </Step>
            );
          })}
        </Stepper>

        {/* Loading indicator for saving */}
        {isSubmitting && (
          <Box sx={{ width: '100%', mb: 2 }}>
            <LinearProgress />
          </Box>
        )}

        {/* Error message */}
        {error && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="error" variant="outlined">
              <AlertTitle>Error</AlertTitle>
              {error}
            </Alert>
          </Box>
        )}

        {/* Content */}
        <Box ref={contentRef} sx={{ mb: 4 }}>
          {children}
        </Box>

        {/* Navigation buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={handleBack}
            disabled={isFirstStep || isSubmitting}
          >
            Back
          </Button>
          
          {/* Progress indicator */}
          <Typography variant="body2" color="text.secondary">
            Step {activeStepIndex + 1} of {steps.length}
          </Typography>

          {isLastStep ? (
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={!isStepValid(currentStep) || isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isSubmitting ? 'Saving...' : 'Complete Profile'}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={handleNext}
              disabled={!isStepValid(currentStep) || isSubmitting}
              endIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isSubmitting ? 'Saving...' : 'Next'}
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

// Wrapper component that provides the ProfileSetupProvider
const ProfileSetupLayout: React.FC<ProfileSetupLayoutProps> = ({ children }) => {
  return (
    <ProfileSetupProvider>
      <ProfileSetupLayoutInner>
        {children}
      </ProfileSetupLayoutInner>
    </ProfileSetupProvider>
  );
};

export default ProfileSetupLayout;
