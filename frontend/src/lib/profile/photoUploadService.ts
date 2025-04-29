import { PhotoUploadRequest } from './types';
import { uploadProfilePhoto, setMainProfilePhoto, deleteProfilePhoto } from './profileApi';

/**
 * Service for handling photo uploads and management
 * Interacts with AWS S3 through the backend API
 */
export class PhotoUploadService {
  /**
   * Upload a photo to S3 via the backend API
   * @param profileId The profile ID
   * @param file The file to upload
   * @param isMain Whether this is the main photo
   * @returns Promise with the result
   */
  static async uploadPhoto(
    profileId: string,
    file: File,
    isMain: boolean = false
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return {
          success: false,
          error: 'File must be an image (JPEG, PNG, etc.)'
        };
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        return {
          success: false,
          error: 'File size must be under 5MB'
        };
      }

      // Create the request data
      const photoData: PhotoUploadRequest = {
        file,
        isMain
      };

      // Upload the photo via the API
      const response = await uploadProfilePhoto(profileId, photoData);

      // Return the result
      return {
        success: true,
        url: response.photos?.find(p => p.url.includes(file.name))?.url
      };
    } catch (error) {
      console.error('Error uploading photo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload photo'
      };
    }
  }

  /**
   * Set a photo as the main profile photo
   * @param profileId The profile ID
   * @param photoUrl The URL of the photo to set as main
   * @returns Promise with the success state
   */
  static async setAsMainPhoto(
    profileId: string,
    photoUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await setMainProfilePhoto(profileId, photoUrl);
      return { success: true };
    } catch (error) {
      console.error('Error setting main photo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set main photo'
      };
    }
  }

  /**
   * Delete a photo
   * @param profileId The profile ID
   * @param photoUrl The URL of the photo to delete
   * @returns Promise with the success state
   */
  static async deletePhoto(
    profileId: string,
    photoUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await deleteProfilePhoto(profileId, photoUrl);
      return { success: true };
    } catch (error) {
      console.error('Error deleting photo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete photo'
      };
    }
  }

  /**
   * Helper function to optimize image before upload
   * @param file The image file to optimize
   * @returns Promise with the optimized file
   */
  static async optimizeImage(file: File): Promise<File> {
    // In a real implementation, we would resize and compress the image
    // For now, just return the original file
    return file;
  }
}
