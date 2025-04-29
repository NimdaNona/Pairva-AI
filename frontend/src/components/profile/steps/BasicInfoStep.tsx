import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  FormHelperText,
  Grid,
  Typography,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { useProfileSetup } from '@/hooks/profile/useProfileSetup';
import { ProfileSetupStep } from '@/lib/profile/types';
import { Gender } from '@/lib/profile/enums';

const BasicInfoStep: React.FC = () => {
  const { 
    formData, 
    updateFormData, 
    validateField, 
    validateStep,
    validationErrors 
  } = useProfileSetup();
  
  const { displayName, birthDate, gender, location, occupation } = formData.basicInfo;
  
  // Local validation state
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});

  // Initialize with any existing validation errors
  useEffect(() => {
    // Get specific errors for this step
    const stepErrors = validateStep(ProfileSetupStep.BASIC_INFO);
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

  // Handle form field changes
  const handleChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    updateFormData(ProfileSetupStep.BASIC_INFO, { [field]: value });
    
    // Validate after update
    validateAndUpdateField(field, value);
  };

  // Handle date change
  const handleDateChange = (date: Date | null) => {
    if (date) {
      updateFormData(ProfileSetupStep.BASIC_INFO, { birthDate: date });
      
      // Validate after update
      validateAndUpdateField('birthDate', date);
    }
  };

  // Handle select change
  const handleSelectChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    updateFormData(ProfileSetupStep.BASIC_INFO, { gender: value });
    
    // Validate after update
    validateAndUpdateField('gender', value);
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Basic Information
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Let's start with some basic information about you. This will help us create your profile
        and find compatible matches.
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Display Name */}
        <Grid item xs={12}>
          <TextField
            label="Display Name"
            value={displayName}
            onChange={handleChange('displayName')}
            fullWidth
            required
            error={!!fieldErrors.displayName}
            helperText={fieldErrors.displayName || "This is how your name will appear to other users"}
            onBlur={() => validateAndUpdateField('displayName', displayName)}
          />
        </Grid>

        {/* Birth Date */}
        <Grid item xs={12} sm={6}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Birth Date"
              value={birthDate ? new Date(birthDate) : null}
              onChange={handleDateChange}
              disableFuture
              sx={{ width: '100%' }}
              slotProps={{
                textField: {
                  error: !!fieldErrors.birthDate,
                  helperText: fieldErrors.birthDate
                }
              }}
            />
          </LocalizationProvider>
        </Grid>

        {/* Gender */}
        <Grid item xs={12} sm={6}>
          <FormControl 
            fullWidth 
            required 
            error={!!fieldErrors.gender}
          >
            <InputLabel id="gender-label">Gender</InputLabel>
            <Select
              labelId="gender-label"
              value={gender || ''}
              label="Gender"
              onChange={handleSelectChange}
              onBlur={() => validateAndUpdateField('gender', gender)}
            >
              <MenuItem value={Gender.MALE}>Male</MenuItem>
              <MenuItem value={Gender.FEMALE}>Female</MenuItem>
              <MenuItem value={Gender.NON_BINARY}>Non-binary</MenuItem>
              <MenuItem value={Gender.OTHER}>Other</MenuItem>
              <MenuItem value={Gender.PREFER_NOT_TO_SAY}>Prefer not to say</MenuItem>
            </Select>
            {fieldErrors.gender && (
              <FormHelperText error>{fieldErrors.gender}</FormHelperText>
            )}
          </FormControl>
        </Grid>

        {/* Location */}
        <Grid item xs={12} sm={6}>
          <TextField
            label="Location"
            value={location}
            onChange={handleChange('location')}
            fullWidth
            required
            error={!!fieldErrors.location}
            helperText={fieldErrors.location || "City, State, Country"}
            onBlur={() => validateAndUpdateField('location', location)}
          />
        </Grid>

        {/* Occupation */}
        <Grid item xs={12} sm={6}>
          <TextField
            label="Occupation"
            value={occupation}
            onChange={handleChange('occupation')}
            fullWidth
            helperText="What do you do for work?"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default BasicInfoStep;
