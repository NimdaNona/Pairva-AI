import React, { useState, useEffect } from 'react';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  Grid,
  Slider,
  Typography,
  Alert,
} from '@mui/material';
import { useProfileSetup } from '@/hooks/profile/useProfileSetup';
import { ProfileSetupStep } from '@/lib/profile/types';
import { Gender, RelationshipGoal } from '@/lib/profile/enums';

const PreferencesStep: React.FC = () => {
  const { 
    formData, 
    updateFormData, 
    validateField, 
    validateStep,
    validationErrors 
  } = useProfileSetup();
  const { ageMin, ageMax, distance, genders, relationshipGoals } = formData.preferences;
  
  // Local validation state
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  
  // Initialize with any existing validation errors
  useEffect(() => {
    // Get specific errors for this step
    const stepErrors = validateStep(ProfileSetupStep.PREFERENCES);
    setFieldErrors(stepErrors);
  }, [validationErrors, validateStep]);

  // Validate a specific field
  const validateAndUpdateField = (field: string, value: any) => {
    const error = validateField(field, value);
    
    setFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));
    
    return error;
  };

  // Handle age range change
  const handleAgeRangeChange = (_event: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue)) {
      const ageMinVal = newValue[0];
      const ageMaxVal = newValue[1];
      
      updateFormData(ProfileSetupStep.PREFERENCES, { 
        ageMin: ageMinVal, 
        ageMax: ageMaxVal 
      });
      
      validateAndUpdateField('ageRange', { min: ageMinVal, max: ageMaxVal });
    }
  };

  // Handle distance change
  const handleDistanceChange = (_event: Event, newValue: number | number[]) => {
    if (!Array.isArray(newValue)) {
      updateFormData(ProfileSetupStep.PREFERENCES, { distance: newValue });
      validateAndUpdateField('distance', newValue);
    }
  };

  // Handle gender preference change
  const handleGenderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const gender = event.target.name as Gender;
    const isChecked = event.target.checked;
    
    const updatedGenders = isChecked
      ? [...(genders || []), gender]
      : (genders || []).filter(g => g !== gender);
    
    updateFormData(ProfileSetupStep.PREFERENCES, { genders: updatedGenders });
    validateAndUpdateField('genders', updatedGenders);
  };

  // Handle relationship goal preference change
  const handleRelationshipGoalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const goal = event.target.name as RelationshipGoal;
    const isChecked = event.target.checked;
    
    const updatedGoals = isChecked
      ? [...(relationshipGoals || []), goal]
      : (relationshipGoals || []).filter(g => g !== goal);
    
    updateFormData(ProfileSetupStep.PREFERENCES, { relationshipGoals: updatedGoals });
    validateAndUpdateField('relationshipGoals', updatedGoals);
  };

  // Format distance label
  const distanceValueText = (value: number) => {
    return `${value} miles`;
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Matching Preferences
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Tell us your preferences for potential matches. We'll use this information to find
        compatible partners for you.
      </Typography>

      <Grid container spacing={5} sx={{ mt: 2 }}>
        {/* Age Range Slider */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            Age Range
          </Typography>
          <Box sx={{ px: 2, pb: 2 }}>
            <Slider
              value={[ageMin || 18, ageMax || 99]}
              onChange={handleAgeRangeChange}
              valueLabelDisplay="on"
              min={18}
              max={99}
              disableSwap
            />
            <Typography variant="caption" color="text.secondary">
              Show me people between {ageMin || 18} and {ageMax || 99} years old
            </Typography>
          </Box>
        </Grid>

        {/* Distance Slider */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            Distance
          </Typography>
          <Box sx={{ px: 2, pb: 2 }}>
            <Slider
              value={distance || 50}
              onChange={handleDistanceChange}
              valueLabelDisplay="on"
              getAriaValueText={distanceValueText}
              valueLabelFormat={distanceValueText}
              min={5}
              max={100}
              step={5}
            />
            <Typography variant="caption" color="text.secondary">
              Show me people within {distance || 50} miles
            </Typography>
          </Box>
        </Grid>

        {/* Gender Preferences */}
        <Grid item xs={12} md={6}>
          <FormControl 
            component="fieldset" 
            variant="standard"
            error={!!fieldErrors.genders}
          >
            <FormLabel component="legend">Interested in (Gender)</FormLabel>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={genders?.includes(Gender.MALE) || false}
                    onChange={handleGenderChange}
                    name={Gender.MALE}
                  />
                }
                label="Men"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={genders?.includes(Gender.FEMALE) || false}
                    onChange={handleGenderChange}
                    name={Gender.FEMALE}
                  />
                }
                label="Women"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={genders?.includes(Gender.NON_BINARY) || false}
                    onChange={handleGenderChange}
                    name={Gender.NON_BINARY}
                  />
                }
                label="Non-binary"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={genders?.includes(Gender.OTHER) || false}
                    onChange={handleGenderChange}
                    name={Gender.OTHER}
                  />
                }
                label="Other"
              />
            </FormGroup>
            <FormHelperText>{fieldErrors.genders || 'Select all that apply'}</FormHelperText>
          </FormControl>
        </Grid>

        {/* Relationship Goal Preferences */}
        <Grid item xs={12} md={6}>
          <FormControl 
            component="fieldset" 
            variant="standard" 
            error={!!fieldErrors.relationshipGoals}
          >
            <FormLabel component="legend">Looking for (Relationship)</FormLabel>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={relationshipGoals?.includes(RelationshipGoal.FRIENDSHIP) || false}
                    onChange={handleRelationshipGoalChange}
                    name={RelationshipGoal.FRIENDSHIP}
                  />
                }
                label="Friendship"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={relationshipGoals?.includes(RelationshipGoal.CASUAL_DATING) || false}
                    onChange={handleRelationshipGoalChange}
                    name={RelationshipGoal.CASUAL_DATING}
                  />
                }
                label="Casual Dating"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={relationshipGoals?.includes(RelationshipGoal.SERIOUS_RELATIONSHIP) || false}
                    onChange={handleRelationshipGoalChange}
                    name={RelationshipGoal.SERIOUS_RELATIONSHIP}
                  />
                }
                label="Serious Relationship"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={relationshipGoals?.includes(RelationshipGoal.MARRIAGE) || false}
                    onChange={handleRelationshipGoalChange}
                    name={RelationshipGoal.MARRIAGE}
                  />
                }
                label="Marriage"
              />
            </FormGroup>
            <FormHelperText>{fieldErrors.relationshipGoals || 'Select all that apply'}</FormHelperText>
          </FormControl>
        </Grid>
        
        {/* Validation Guidance (optional, only show if really needed) */}
        {(genders?.length === 0 || relationshipGoals?.length === 0) && (
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2 }}>
              To find the best matches for you, we recommend selecting at least one gender preference and relationship goal.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default PreferencesStep;
