import {
  Profile,
  CreateProfileRequest,
  UpdateProfileRequest,
  PhotoUploadRequest,
} from './types';

// API URL - should come from environment variables in production
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const PROFILES_URL = `${API_URL}/profiles`;

/**
 * Create a new profile
 */
export const createProfile = async (profileData: CreateProfileRequest): Promise<Profile> => {
  const response = await fetch(PROFILES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('pm_access_token')}`,
    },
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to create profile');
  }

  return response.json();
};

/**
 * Get current user's profile
 */
export const getMyProfile = async (): Promise<Profile | null> => {
  const response = await fetch(`${PROFILES_URL}/me`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('pm_access_token')}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Profile not found, which is valid for new users
      return null;
    }
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to get profile');
  }

  return response.json();
};

/**
 * Get profile by ID
 */
export const getProfileById = async (id: string): Promise<Profile> => {
  const response = await fetch(`${PROFILES_URL}/${id}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('pm_access_token')}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to get profile');
  }

  return response.json();
};

/**
 * Update profile
 */
export const updateProfile = async (id: string, profileData: UpdateProfileRequest): Promise<Profile> => {
  const response = await fetch(`${PROFILES_URL}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('pm_access_token')}`,
    },
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to update profile');
  }

  return response.json();
};

/**
 * Upload profile photo
 */
export const uploadProfilePhoto = async (profileId: string, photoData: PhotoUploadRequest): Promise<Profile> => {
  // Handle both file uploads and URL-based photos
  let response;

  if (photoData.file) {
    // File upload using FormData
    const formData = new FormData();
    formData.append('photo', photoData.file);
    formData.append('isMain', photoData.isMain ? 'true' : 'false');

    response = await fetch(`${PROFILES_URL}/${profileId}/photos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('pm_access_token')}`,
      },
      body: formData,
    });
  } else if (photoData.url) {
    // URL-based photo
    response = await fetch(`${PROFILES_URL}/${profileId}/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('pm_access_token')}`,
      },
      body: JSON.stringify({
        url: photoData.url,
        isMain: photoData.isMain,
      }),
    });
  } else {
    throw new Error('Either file or URL must be provided');
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to upload photo');
  }

  return response.json();
};

/**
 * Delete profile photo
 */
export const deleteProfilePhoto = async (profileId: string, photoUrl: string): Promise<Profile> => {
  const encodedUrl = encodeURIComponent(photoUrl);
  const response = await fetch(`${PROFILES_URL}/${profileId}/photos/${encodedUrl}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('pm_access_token')}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to delete photo');
  }

  return response.json();
};

/**
 * Set main profile photo
 */
export const setMainProfilePhoto = async (profileId: string, photoUrl: string): Promise<Profile> => {
  const encodedUrl = encodeURIComponent(photoUrl);
  const response = await fetch(`${PROFILES_URL}/${profileId}/photos/${encodedUrl}/main`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('pm_access_token')}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to set main photo');
  }

  return response.json();
};
