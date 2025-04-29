import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Grid,
  Typography,
  InputAdornment,
  Alert,
} from '@mui/material';
import { useProfileSetup } from '@/hooks/profile/useProfileSetup';
import { ProfileSetupStep } from '@/lib/profile/types';

const BioInterestsStep: React.FC = () => {
  const { 
    formData, 
    updateFormData, 
    validateField, 
    validateStep,
    validationErrors 
  } = useProfileSetup();
  
  const { bio, interests } = formData.bioInterests;
  
  // Local validation state
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  
  // Initialize with any existing validation errors
  useEffect(() => {
    // Get specific errors for this step
    const stepErrors = validateStep(ProfileSetupStep.BIO_INTERESTS);
    setFieldErrors(stepErrors);
  }, [validationErrors, validateStep]);

  // Character limits
  const BIO_MAX_LENGTH = 500;
  const INTERESTS_MAX_LENGTH = 300;

  // Validate a specific field
  const validateAndUpdateField = (field: string, value: any) => {
    const error = validateField(field, value);
    
    setFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));
    
    return error;
  };

  // Handle bio change
  const handleBioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateFormData(ProfileSetupStep.BIO_INTERESTS, { bio: value });
    
    // Validate after update if length meets min requirements
    if (value.length >= 10) {
      validateAndUpdateField('bio', value);
    }
  };

  // Handle interests change
  const handleInterestsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateFormData(ProfileSetupStep.BIO_INTERESTS, { interests: value });
    
    // Validate after update if length meets min requirements
    if (value.length >= 10) {
      validateAndUpdateField('interests', value);
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        About You
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Tell potential matches about yourself and what you enjoy. The more you share,
        the better your matches will be.
      </Typography>

      <Grid container spacing={4} sx={{ mt: 2 }}>
        {/* Bio */}
        <Grid item xs={12}>
          <TextField
            label="Bio"
            value={bio}
            onChange={handleBioChange}
            onBlur={() => validateAndUpdateField('bio', bio)}
            fullWidth
            required
            multiline
            rows={6}
            placeholder="Share a bit about yourself, your story, what makes you unique, and what you're looking for in a relationship."
            helperText={fieldErrors.bio || `${bio?.length || 0}/${BIO_MAX_LENGTH} characters`}
            error={!!fieldErrors.bio}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Typography 
                    variant="caption" 
                    color={bio?.length > BIO_MAX_LENGTH ? "error" : "textSecondary"}
                  >
                    {bio?.length || 0}/{BIO_MAX_LENGTH}
                  </Typography>
                </InputAdornment>
              ),
            }}
            inputProps={{ maxLength: BIO_MAX_LENGTH }}
          />
        </Grid>

        {/* Interests */}
        <Grid item xs={12}>
          <TextField
            label="Interests & Hobbies"
            value={interests}
            onChange={handleInterestsChange}
            onBlur={() => validateAndUpdateField('interests', interests)}
            fullWidth
            required
            multiline
            rows={4}
            placeholder="What do you enjoy in your free time? List your hobbies, favorite activities, passions, and interests."
            helperText={fieldErrors.interests || `${interests?.length || 0}/${INTERESTS_MAX_LENGTH} characters`}
            error={!!fieldErrors.interests}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Typography 
                    variant="caption" 
                    color={interests?.length > INTERESTS_MAX_LENGTH ? "error" : "textSecondary"}
                  >
                    {interests?.length || 0}/{INTERESTS_MAX_LENGTH}
                  </Typography>
                </InputAdornment>
              ),
            }}
            inputProps={{ maxLength: INTERESTS_MAX_LENGTH }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Tip: Include interests that could be conversation starters or potential date activities.
          </Typography>
        </Grid>
        
        {/* Validation Error Summary (if needed) */}
        {Object.keys(fieldErrors).length > 0 && (
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2 }}>
              Please provide all required information to continue. Both your bio and interests help us find better matches for you.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default BioInterestsStep;
