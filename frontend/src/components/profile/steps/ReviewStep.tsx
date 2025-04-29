import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  Divider, 
  Button, 
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert, 
  AlertTitle,
  CircularProgress
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DescriptionIcon from '@mui/icons-material/Description';
import FilterListIcon from '@mui/icons-material/FilterList';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import QuizIcon from '@mui/icons-material/Quiz';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useRouter } from 'next/router';
import { useProfileSetup } from '@/hooks/profile/useProfileSetup';
import { ProfileSetupStep } from '@/lib/profile/types';
import { getQuestionnaires, Questionnaire } from '@/lib/questionnaire/questionnaireApi';
import { QuestionnaireStatus } from '@/lib/questionnaire/enums';

const ReviewStep: React.FC = () => {
  const router = useRouter();
  const { 
    formData, 
    validateStep,
    isStepValid,
    isSubmitting,
    submitProfile
  } = useProfileSetup();
  
  const [requiredQuestionnaires, setRequiredQuestionnaires] = useState<{id: string, title: string}[]>([]);
  const [loadingQuestionnaires, setLoadingQuestionnaires] = useState(false);
  const [questionnaireError, setQuestionnaireError] = useState<string | null>(null);

  // Fetch required questionnaires when component mounts
  useEffect(() => {
    const fetchRequiredQuestionnaires = async () => {
      try {
        setLoadingQuestionnaires(true);
        const data = await getQuestionnaires({
          status: QuestionnaireStatus.ACTIVE,
          isActive: true,
        });
        
        // Filter for required questionnaires
        const required = data.filter((q: Questionnaire) => q.isRequired).map((q: Questionnaire) => ({
          id: q.id,
          title: q.title
        }));
        
        setRequiredQuestionnaires(required);
      } catch (error) {
        console.error('Failed to fetch questionnaires:', error);
        setQuestionnaireError('Failed to load required questionnaires');
      } finally {
        setLoadingQuestionnaires(false);
      }
    };

    fetchRequiredQuestionnaires();
  }, []);

  const handleEditClick = (step: ProfileSetupStep) => {
    router.push(`/profile/setup/${step}`);
  };

  const handleContinueClick = async () => {
    const result = await submitProfile();
    
    if (result && requiredQuestionnaires.length > 0) {
      // If profile was successfully submitted and there are required questionnaires,
      // redirect to the questionnaires page
      router.push('/questionnaire');
    } else if (result) {
      // If profile was successfully submitted but no required questionnaires,
      // redirect to home page or dashboard
      router.push('/');
    }
  };

  const renderSectionStatus = (step: ProfileSetupStep) => {
    const valid = isStepValid(step);
    return (
      <Chip 
        icon={valid ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />} 
        label={valid ? "Complete" : "Incomplete"} 
        color={valid ? "success" : "error"} 
        size="small"
        variant="outlined"
      />
    );
  };

  // Renders a section of the review with a header, status, and content
  const renderSection = (
    title: string, 
    step: ProfileSetupStep, 
    icon: React.ReactNode, 
    content: React.ReactNode
  ) => (
    <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ mr: 1, color: 'primary.main' }}>{icon}</Box>
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {renderSectionStatus(step)}
          <Button 
            variant="text" 
            size="small" 
            onClick={() => handleEditClick(step)} 
            sx={{ ml: 1 }}
          >
            Edit
          </Button>
        </Box>
      </Box>
      <Divider sx={{ mb: 2 }} />
      {content}
    </Paper>
  );

  // Basic Info Section
  const basicInfoContent = (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Name
        </Typography>
        <Typography variant="body1">
          {formData.basicInfo?.displayName || 'Not provided'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Age
        </Typography>
        <Typography variant="body1">
          {formData.basicInfo?.birthDate 
            ? `${new Date().getFullYear() - new Date(formData.basicInfo.birthDate).getFullYear()} years old` 
            : 'Not provided'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Gender
        </Typography>
        <Typography variant="body1">
          {formData.basicInfo?.gender || 'Not specified'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Location
        </Typography>
        <Typography variant="body1">
          {formData.basicInfo?.location || 'Not provided'}
        </Typography>
      </Grid>
    </Grid>
  );

  // Relationship Preferences Section
  const relationshipContent = (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Relationship Goal
        </Typography>
        <Typography variant="body1">
          {formData.relationshipPreferences?.relationshipGoal || 'Not specified'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Relationship Status
        </Typography>
        <Typography variant="body1">
          {formData.relationshipPreferences?.relationshipStatus || 'Not specified'}
        </Typography>
      </Grid>
    </Grid>
  );

  // Bio & Interests Section
  const bioInterestsContent = (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="subtitle2" color="text.secondary">
          About Me
        </Typography>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {formData.bioInterests?.bio || 'Not provided'}
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Typography variant="subtitle2" color="text.secondary">
          Interests
        </Typography>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {formData.bioInterests?.interests || 'Not provided'}
        </Typography>
      </Grid>
    </Grid>
  );

  // Preferences Section
  const preferencesContent = (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Distance Preference
        </Typography>
        <Typography variant="body1">
          {formData.preferences?.distance ? `Up to ${formData.preferences.distance} miles` : 'Not specified'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Age Preference
        </Typography>
        <Typography variant="body1">
          {(formData.preferences?.ageMin !== undefined && formData.preferences?.ageMax !== undefined) ? 
            `${formData.preferences.ageMin} - ${formData.preferences.ageMax} years` 
            : 'Not specified'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Gender Preference
        </Typography>
        <Typography variant="body1">
          {formData.preferences?.genders?.join(', ') || 'Not specified'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Relationship Goal Preference
        </Typography>
        <Typography variant="body1">
          {formData.preferences?.relationshipGoals?.join(', ') || 'Not specified'}
        </Typography>
      </Grid>
    </Grid>
  );

  // Attributes Section
  const attributesContent = (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Personality Traits
        </Typography>
        <Typography variant="body1">
          {formData.attributes?.personality?.join(', ') || 'Not specified'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Values
        </Typography>
        <Typography variant="body1">
          {formData.attributes?.values?.join(', ') || 'Not specified'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Lifestyle
        </Typography>
        <Typography variant="body1">
          {formData.attributes?.lifestyle?.join(', ') || 'Not specified'}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">
          Communication Style
        </Typography>
        <Typography variant="body1">
          {formData.attributes?.communication?.join(', ') || 'Not specified'}
        </Typography>
      </Grid>
    </Grid>
  );

  // Photos Section
  const photosContent = (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Profile Photos
      </Typography>
      {formData.photos && formData.photos.length > 0 ? (
        <Grid container spacing={1}>
          {formData.photos.map((photo, index) => (
            <Grid item xs={4} sm={3} md={2} key={index}>
              <Box
                component="img"
                src={photo.url}
                alt={`Profile photo ${index + 1}`}
                sx={{
                  width: '100%',
                  height: 100,
                  objectFit: 'cover',
                  borderRadius: 1,
                  border: photo.isMain ? '2px solid #1976d2' : 'none',
                }}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Typography variant="body1" color="text.secondary">
          No photos added
        </Typography>
      )}
    </Box>
  );

  // Next Steps Section with Required Questionnaires
  const nextStepsContent = (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        After completing your profile, the following steps are required:
      </Typography>
      
      {loadingQuestionnaires ? (
        <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
          <CircularProgress size={20} sx={{ mr: 2 }} />
          <Typography>Loading required questionnaires...</Typography>
        </Box>
      ) : questionnaireError ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {questionnaireError}
        </Alert>
      ) : requiredQuestionnaires.length > 0 ? (
        <List>
          {requiredQuestionnaires.map((questionnaire) => (
            <ListItem key={questionnaire.id}>
              <ListItemIcon>
                <QuizIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary={questionnaire.title} 
                secondary="Complete this required questionnaire to improve your matches" 
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography color="text.secondary">
          No additional steps required. You're ready to start matching!
        </Typography>
      )}
    </Box>
  );

  // Check for validation errors in each step
  const hasValidationErrors = () => {
    const steps = [
      ProfileSetupStep.BASIC_INFO,
      ProfileSetupStep.RELATIONSHIP_PREFERENCES,
      ProfileSetupStep.BIO_INTERESTS,
      ProfileSetupStep.PREFERENCES,
      ProfileSetupStep.ATTRIBUTES,
      ProfileSetupStep.PHOTOS
    ];
    
    return steps.some(step => {
      const errors = validateStep(step);
      return Object.keys(errors).length > 0;
    });
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Review Your Profile
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Please review your information and make any necessary changes before submitting your profile.
      </Typography>

      {renderSection("Basic Information", ProfileSetupStep.BASIC_INFO, <PersonIcon />, basicInfoContent)}
      {renderSection("Relationship Preferences", ProfileSetupStep.RELATIONSHIP_PREFERENCES, <FavoriteIcon />, relationshipContent)}
      {renderSection("Bio & Interests", ProfileSetupStep.BIO_INTERESTS, <DescriptionIcon />, bioInterestsContent)}
      {renderSection("Preferences", ProfileSetupStep.PREFERENCES, <FilterListIcon />, preferencesContent)}
      {renderSection("Attributes", ProfileSetupStep.ATTRIBUTES, <PsychologyIcon />, attributesContent)}
      {renderSection("Photos", ProfileSetupStep.PHOTOS, <PhotoLibraryIcon />, photosContent)}

      <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <QuizIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">Next Steps</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {nextStepsContent}
      </Paper>

      {hasValidationErrors() && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Attention Required</AlertTitle>
          Some sections are incomplete or contain errors. Please review and update them before submitting.
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleContinueClick}
          disabled={!isStepValid(ProfileSetupStep.REVIEW) || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <CircularProgress size={24} sx={{ mr: 1, color: 'inherit' }} />
              Saving...
            </>
          ) : (
            'Complete Profile'
          )}
        </Button>
      </Box>
    </Box>
  );
};

export default ReviewStep;
