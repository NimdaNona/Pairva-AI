import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  CardMedia,
  Grid,
  IconButton,
  Typography,
  styled,
  Alert,
  CircularProgress,
} from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useProfileSetup } from '@/hooks/profile/useProfileSetup';
import { ProfileSetupStep } from '@/lib/profile/types';
import { PhotoUploadService } from '@/lib/profile/photoUploadService';

// Styled Components
const UploadBox = styled(Box)(({ theme }) => ({
  border: `2px dashed ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: 200,
  cursor: 'pointer',
  transition: 'border-color 0.2s',
  '&:hover': {
    borderColor: theme.palette.primary.main,
  },
}));

// Maximum number of photos allowed
const MAX_PHOTOS = 6;

const PhotosStep: React.FC = () => {
  const { 
    formData, 
    updateFormData, 
    validateField, 
    validateStep,
    validationErrors,
    profileId,
  } = useProfileSetup();
  
  const photos = formData.photos || [];
  
  // Local state for upload status
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Local validation state
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  
  // Initialize with any existing validation errors
  useEffect(() => {
    // Get specific errors for this step
    const stepErrors = validateStep(ProfileSetupStep.PHOTOS);
    setFieldErrors(stepErrors);
  }, [validationErrors, validateStep]);

  // Validate the photos
  const validatePhotos = () => {
    const error = validateField('photos', photos);
    
    setFieldErrors(prev => ({
      ...prev,
      photos: error
    }));
    
    return error;
  };

  // Handle file input change
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !profileId) return;

    // Check if we have room for more photos
    if (photos.length >= MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos allowed. Delete some photos first.`);
      return;
    }

    setUploading(true);
    setError(null);

    const file = files[0]; // For now, process one file at a time
    
    try {
      // Optimize image before upload (resize, compress, etc.)
      const optimizedFile = await PhotoUploadService.optimizeImage(file);
      
      // Upload the photo
      const isFirstPhoto = photos.length === 0;
      const result = await PhotoUploadService.uploadPhoto(profileId, optimizedFile, isFirstPhoto);
      
      if (result.success && result.url) {
        // Add the new photo to the array
        const updatedPhotos = [
          ...photos,
          { 
            url: result.url, 
            isMain: isFirstPhoto, // Make first photo primary by default
            order: photos.length, // Set order based on position
          }
        ];
        
        updateFormData(ProfileSetupStep.PHOTOS, updatedPhotos);
        validatePhotos();
      } else {
        setError(result.error || 'Failed to upload photo');
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
      
      // Clear the input for next upload
      event.target.value = '';
    }
  };

  // Set a photo as main
  const handleSetPrimary = async (index: number) => {
    if (!profileId) return;
    
    const photoToUpdate = photos[index];
    setUploading(true);
    
    try {
      const result = await PhotoUploadService.setAsMainPhoto(profileId, photoToUpdate.url);
      
      if (result.success) {
        const updatedPhotos = photos.map((photo, i) => ({
          ...photo,
          isMain: i === index,
        }));

        updateFormData(ProfileSetupStep.PHOTOS, updatedPhotos);
        validatePhotos();
      } else {
        setError(result.error || 'Failed to set as primary photo');
      }
    } catch (err) {
      console.error('Error setting primary photo:', err);
      setError('Failed to set as primary photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Delete a photo
  const handleDeletePhoto = async (index: number) => {
    if (!profileId) return;
    
    const photoToDelete = photos[index];
    setUploading(true);
    
    try {
      const result = await PhotoUploadService.deletePhoto(profileId, photoToDelete.url);
      
      if (result.success) {
        const updatedPhotos = photos.filter((_, i) => i !== index);
        
        // If we deleted the main photo, make the first remaining photo main
        if (photoToDelete.isMain && updatedPhotos.length > 0) {
          updatedPhotos[0].isMain = true;
          
          // Call the API to update the main photo if there are photos left
          if (updatedPhotos.length > 0) {
            await PhotoUploadService.setAsMainPhoto(profileId, updatedPhotos[0].url);
          }
        }

        updateFormData(ProfileSetupStep.PHOTOS, updatedPhotos);
        validatePhotos();
      } else {
        setError(result.error || 'Failed to delete photo');
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
      setError('Failed to delete photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Profile Photos
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Upload photos that showcase you. Your first photo will be your primary profile picture.
        You can upload up to {MAX_PHOTOS} photos.
      </Typography>

      {/* Upload error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Validation error message */}
      {fieldErrors.photos && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {fieldErrors.photos}
        </Alert>
      )}

      {/* Loading overlay */}
      {uploading && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          mb: 2
        }}>
          <CircularProgress size={24} sx={{ mr: 1 }} />
          <Typography>Processing photo...</Typography>
        </Box>
      )}

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Existing Photos */}
        {photos.map((photo, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card sx={{ position: 'relative' }}>
              <CardMedia
                component="img"
                height="200"
                image={photo.url}
                alt={`Photo ${index + 1}`}
                sx={{ objectFit: 'cover' }}
              />
              {photo.isMain && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bgcolor: 'primary.main',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderBottomRightRadius: 4,
                  }}
                >
                  <Typography variant="caption" fontWeight="bold">
                    Primary
                  </Typography>
                </Box>
              )}
              <CardActions disableSpacing>
                {!photo.isMain && (
                  <IconButton
                    aria-label="set as primary"
                    onClick={() => handleSetPrimary(index)}
                    color="primary"
                    disabled={uploading}
                  >
                    <StarBorderIcon />
                  </IconButton>
                )}
                {photo.isMain && (
                  <IconButton
                    aria-label="primary photo"
                    disabled
                    color="primary"
                  >
                    <StarIcon />
                  </IconButton>
                )}
                <IconButton
                  aria-label="delete"
                  onClick={() => handleDeletePhoto(index)}
                  color="error"
                  sx={{ ml: 'auto' }}
                  disabled={uploading}
                >
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}

        {/* Upload New Photo */}
        {photos.length < MAX_PHOTOS && (
          <Grid item xs={12} sm={6} md={4}>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="photo-upload"
              type="file"
              onChange={handleFileChange}
              disabled={uploading || !profileId}
            />
            <label htmlFor="photo-upload">
              <UploadBox>
                {uploading ? (
                  <CircularProgress sx={{ mb: 1 }} />
                ) : (
                  <AddAPhotoIcon color="action" sx={{ fontSize: 40, mb: 1 }} />
                )}
                <Typography variant="body1" align="center" gutterBottom>
                  {uploading ? 'Uploading...' : 'Add Photo'}
                </Typography>
                <Typography variant="caption" align="center" color="text.secondary">
                  JPEG or PNG, 5MB max
                </Typography>
              </UploadBox>
            </label>
          </Grid>
        )}
      </Grid>

      {/* Empty state message when no photos are uploaded */}
      {photos.length === 0 && !fieldErrors.photos && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Please upload at least one photo. Having a profile photo greatly increases your chances of getting matches.
        </Alert>
      )}
      
      {/* Explain that a profile ID is needed first if we don't have one */}
      {!profileId && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          You need to save your profile information first before uploading photos. 
          Complete the previous steps and click "Next" to save your profile.
        </Alert>
      )}
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="caption" color="text.secondary">
          <strong>Tips:</strong> Choose clear, recent photos that show your face. 
          Include a mix of photos: portrait, full-body, and photos of you doing activities 
          you enjoy. Photos with good lighting and quality tend to get better results.
        </Typography>
      </Box>
    </Box>
  );
};

export default PhotosStep;
