import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Typography,
  Alert,
} from '@mui/material';
import { useProfileSetup } from '@/hooks/profile/useProfileSetup';
import { ProfileSetupStep } from '@/lib/profile/types';

// Available attribute options
const PERSONALITY_TRAITS = [
  'Adventurous', 'Creative', 'Analytical', 'Relaxed', 'Energetic',
  'Outgoing', 'Reserved', 'Organized', 'Spontaneous', 'Patient',
  'Detail-oriented', 'Big-picture thinker', 'Practical', 'Intellectual', 'Empathetic',
  'Independent', 'Collaborative', 'Ambitious', 'Easygoing', 'Curious'
];

const VALUES = [
  'Family', 'Career', 'Learning', 'Health', 'Creativity',
  'Social justice', 'Nature', 'Spirituality', 'Ambition', 'Honesty',
  'Loyalty', 'Kindness', 'Security', 'Freedom', 'Adventure',
  'Tradition', 'Innovation', 'Community', 'Self-improvement', 'Balance'
];

const LIFESTYLE_CHOICES = [
  'Early riser', 'Night owl', 'Fitness enthusiast', 'Foodie', 'Traveler',
  'Homebody', 'Outdoor lover', 'City dweller', 'Pet owner', 'Arts & culture',
  'Social butterfly', 'Minimalist', 'Work-focused', 'Family-oriented', 'Environmentally conscious',
  'Tech-savvy', 'Spiritual', 'Sports fan', 'Non-smoker', 'Occasional drinker'
];

const COMMUNICATION_STYLES = [
  'Direct communicator', 'Thoughtful responder', 'Frequent texter', 'Prefer calls',
  'Expressive', 'Good listener', 'Emotional communicator', 'Logical communicator',
  'Conflict avoider', 'Problem solver', 'Detailed planner', 'Spontaneous planner',
  'Digital communicator', 'Face-to-face communicator', 'Active listener'
];

// Maximum number of items selectable for each category
const MAX_SELECTIONS = 5;

const AttributesStep: React.FC = () => {
  const { 
    formData, 
    updateFormData, 
    validateField, 
    validateStep,
    validationErrors 
  } = useProfileSetup();
  const { personality, values, lifestyle, communication } = formData.attributes;
  
  // Local validation state
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  
  // Initialize with any existing validation errors
  useEffect(() => {
    // Get specific errors for this step
    const stepErrors = validateStep(ProfileSetupStep.ATTRIBUTES);
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

  // Handle multi-select change
  const handleMultiSelectChange = (
    field: 'personality' | 'values' | 'lifestyle' | 'communication'
  ) => (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;
    
    // On autofill we get a stringified value.
    const selectedValues = typeof value === 'string' ? value.split(',') : value;
    
    // Limit selection to MAX_SELECTIONS
    const limitedValues = selectedValues.slice(0, MAX_SELECTIONS);
    
    updateFormData(ProfileSetupStep.ATTRIBUTES, { [field]: limitedValues });
    
    // Validate the selection
    validateAndUpdateField(field, limitedValues);
  };
  
  // Check if any attributes are selected
  const hasAnySelections = (
    (personality?.length || 0) > 0 || 
    (values?.length || 0) > 0 || 
    (lifestyle?.length || 0) > 0 || 
    (communication?.length || 0) > 0
  );

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Your Attributes
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Select attributes that best describe you. These help us find compatible matches
        and showcase your personality in your profile. Select up to {MAX_SELECTIONS} options in each category.
      </Typography>

      <Grid container spacing={4} sx={{ mt: 2 }}>
        {/* Personality Traits */}
        <Grid item xs={12} md={6}>
          <FormControl 
            fullWidth
            error={!!fieldErrors.personality}
          >
            <InputLabel id="personality-traits-label">Personality Traits</InputLabel>
            <Select
              labelId="personality-traits-label"
              id="personality-traits"
              multiple
              value={personality || []}
              onChange={handleMultiSelectChange('personality')}
              input={<OutlinedInput id="select-personality-traits" label="Personality Traits" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} />
                  ))}
                </Box>
              )}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 48 * 4.5 + 8,
                    width: 250,
                  },
                },
              }}
            >
              {PERSONALITY_TRAITS.map((trait) => (
                <MenuItem
                  key={trait}
                  value={trait}
                  disabled={(personality || []).length >= MAX_SELECTIONS && !(personality || []).includes(trait)}
                >
                  {trait}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {fieldErrors.personality || `Selected ${(personality || []).length}/${MAX_SELECTIONS} traits`}
            </FormHelperText>
          </FormControl>
        </Grid>

        {/* Values */}
        <Grid item xs={12} md={6}>
          <FormControl 
            fullWidth
            error={!!fieldErrors.values}
          >
            <InputLabel id="values-label">Values</InputLabel>
            <Select
              labelId="values-label"
              id="values"
              multiple
              value={values || []}
              onChange={handleMultiSelectChange('values')}
              input={<OutlinedInput id="select-values" label="Values" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} />
                  ))}
                </Box>
              )}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 48 * 4.5 + 8,
                    width: 250,
                  },
                },
              }}
            >
              {VALUES.map((value) => (
                <MenuItem
                  key={value}
                  value={value}
                  disabled={(values || []).length >= MAX_SELECTIONS && !(values || []).includes(value)}
                >
                  {value}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {fieldErrors.values || `Selected ${(values || []).length}/${MAX_SELECTIONS} values`}
            </FormHelperText>
          </FormControl>
        </Grid>

        {/* Lifestyle */}
        <Grid item xs={12} md={6}>
          <FormControl 
            fullWidth
            error={!!fieldErrors.lifestyle}
          >
            <InputLabel id="lifestyle-label">Lifestyle</InputLabel>
            <Select
              labelId="lifestyle-label"
              id="lifestyle"
              multiple
              value={lifestyle || []}
              onChange={handleMultiSelectChange('lifestyle')}
              input={<OutlinedInput id="select-lifestyle" label="Lifestyle" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} />
                  ))}
                </Box>
              )}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 48 * 4.5 + 8,
                    width: 250,
                  },
                },
              }}
            >
              {LIFESTYLE_CHOICES.map((choice) => (
                <MenuItem
                  key={choice}
                  value={choice}
                  disabled={(lifestyle || []).length >= MAX_SELECTIONS && !(lifestyle || []).includes(choice)}
                >
                  {choice}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {fieldErrors.lifestyle || `Selected ${(lifestyle || []).length}/${MAX_SELECTIONS} lifestyle choices`}
            </FormHelperText>
          </FormControl>
        </Grid>

        {/* Communication */}
        <Grid item xs={12} md={6}>
          <FormControl 
            fullWidth
            error={!!fieldErrors.communication}
          >
            <InputLabel id="communication-label">Communication Style</InputLabel>
            <Select
              labelId="communication-label"
              id="communication"
              multiple
              value={communication || []}
              onChange={handleMultiSelectChange('communication')}
              input={<OutlinedInput id="select-communication" label="Communication Style" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} />
                  ))}
                </Box>
              )}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 48 * 4.5 + 8,
                    width: 250,
                  },
                },
              }}
            >
              {COMMUNICATION_STYLES.map((style) => (
                <MenuItem
                  key={style}
                  value={style}
                  disabled={(communication || []).length >= MAX_SELECTIONS && !(communication || []).includes(style)}
                >
                  {style}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {fieldErrors.communication || `Selected ${(communication || []).length}/${MAX_SELECTIONS} communication styles`}
            </FormHelperText>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">
            Tip: Choose attributes that best represent you and would matter most in a relationship.
            These selections help us find truly compatible matches and allow potential partners to
            understand key aspects of your personality.
          </Typography>
        </Grid>
        
        {/* Guidance for empty selections */}
        {!hasAnySelections && (
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2 }}>
              Selecting attributes helps us find better matches for you. We recommend choosing at least a few traits in each category that best represent you.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default AttributesStep;
