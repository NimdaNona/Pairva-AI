import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  Typography,
  FormHelperText,
  Alert,
} from '@mui/material';
import { useProfileSetup } from '@/hooks/profile/useProfileSetup';
import { ProfileSetupStep } from '@/lib/profile/types';
import { RelationshipGoal, RelationshipStatus } from '@/lib/profile/enums';

const RelationshipPreferencesStep: React.FC = () => {
  const { 
    formData, 
    updateFormData, 
    validateField,
    validateStep,
    validationErrors 
  } = useProfileSetup();
  const { relationshipGoal, relationshipStatus } = formData.relationshipPreferences;

  // Local validation state
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  
  // Initialize with any existing validation errors
  useEffect(() => {
    // Get specific errors for this step
    const stepErrors = validateStep(ProfileSetupStep.RELATIONSHIP_PREFERENCES);
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

  // Handle relationship goal change
  const handleRelationshipGoalChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    updateFormData(ProfileSetupStep.RELATIONSHIP_PREFERENCES, { relationshipGoal: value });
    validateAndUpdateField('relationshipGoal', value);
  };

  // Handle relationship status change
  const handleRelationshipStatusChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateFormData(ProfileSetupStep.RELATIONSHIP_PREFERENCES, { relationshipStatus: value });
    validateAndUpdateField('relationshipStatus', value);
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Relationship Preferences
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Tell us what you're looking for in a relationship. This helps us find better matches for you.
      </Typography>

      <Grid container spacing={4} sx={{ mt: 2 }}>
        {/* Relationship Goal */}
        <Grid item xs={12}>
          <FormControl 
            fullWidth 
            required
            error={!!fieldErrors.relationshipGoal}
          >
            <InputLabel id="relationship-goal-label">I'm looking for...</InputLabel>
            <Select
              labelId="relationship-goal-label"
              value={relationshipGoal || ''}
              label="I'm looking for..."
              onChange={handleRelationshipGoalChange}
              onBlur={() => validateAndUpdateField('relationshipGoal', relationshipGoal)}
            >
              <MenuItem value={RelationshipGoal.FRIENDSHIP}>Friendship</MenuItem>
              <MenuItem value={RelationshipGoal.CASUAL_DATING}>Casual Dating</MenuItem>
              <MenuItem value={RelationshipGoal.SERIOUS_RELATIONSHIP}>Serious Relationship</MenuItem>
              <MenuItem value={RelationshipGoal.MARRIAGE}>Marriage</MenuItem>
              <MenuItem value={RelationshipGoal.NOT_SURE}>Not Sure</MenuItem>
            </Select>
            {fieldErrors.relationshipGoal && (
              <FormHelperText error>{fieldErrors.relationshipGoal}</FormHelperText>
            )}
          </FormControl>
        </Grid>

        {/* Relationship Status */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            My current relationship status is:
          </Typography>
          <FormControl 
            component="fieldset" 
            error={!!fieldErrors.relationshipStatus}
            required
          >
            <RadioGroup
              value={relationshipStatus || ''}
              onChange={handleRelationshipStatusChange}
              name="relationship-status"
              onBlur={() => validateAndUpdateField('relationshipStatus', relationshipStatus)}
            >
              <FormControlLabel
                value={RelationshipStatus.SINGLE}
                control={<Radio />}
                label="Single"
              />
              <FormControlLabel
                value={RelationshipStatus.DIVORCED}
                control={<Radio />}
                label="Divorced"
              />
              <FormControlLabel
                value={RelationshipStatus.SEPARATED}
                control={<Radio />}
                label="Separated"
              />
              <FormControlLabel
                value={RelationshipStatus.WIDOWED}
                control={<Radio />}
                label="Widowed"
              />
              <FormControlLabel
                value={RelationshipStatus.COMPLICATED}
                control={<Radio />}
                label="It's Complicated"
              />
            </RadioGroup>
            {fieldErrors.relationshipStatus && (
              <FormHelperText error>{fieldErrors.relationshipStatus}</FormHelperText>
            )}
          </FormControl>
        </Grid>
        
        {/* Validation Error Summary (if needed) */}
        {Object.keys(fieldErrors).length > 0 && (
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2 }}>
              Please select both your relationship goals and current status to continue. This information helps us find compatible matches for you.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default RelationshipPreferencesStep;
