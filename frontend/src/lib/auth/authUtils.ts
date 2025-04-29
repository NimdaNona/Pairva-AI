import axios from 'axios';
import { User, AuthTokens, LoginResponse } from './types';

// API endpoint for authentication
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const AUTH_ENDPOINT = `${API_BASE_URL}/auth`;

// Local storage keys
const ACCESS_TOKEN_KEY = 'pm_access_token';
const REFRESH_TOKEN_KEY = 'pm_refresh_token';
const EXPIRES_AT_KEY = 'pm_expires_at';
const USER_KEY = 'pm_user';

/**
 * Get the stored tokens from local storage
 */
export const getStoredTokens = (): AuthTokens | null => {
  if (typeof window === 'undefined') return null;
  
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const expiresIn = localStorage.getItem(EXPIRES_AT_KEY);
  
  if (!accessToken || !refreshToken || !expiresIn) {
    return null;
  }
  
  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
};

/**
 * Get the stored user from local storage
 */
export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  
  const userJson = localStorage.getItem(USER_KEY);
  
  if (!userJson) {
    return null;
  }
  
  try {
    return JSON.parse(userJson);
  } catch (error) {
    console.error('Failed to parse user data:', error);
    return null;
  }
};

/**
 * Store tokens and user data in local storage
 */
export const storeAuthData = (data: LoginResponse): void => {
  if (typeof window === 'undefined') return;
  
  const expiresAt = Date.now() + parseInt(data.expiresIn) * 1000;
  
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString());
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
};

/**
 * Clear stored auth data from local storage
 */
export const clearAuthData = (): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Check if the current token is expired
 */
export const isTokenExpired = (): boolean => {
  if (typeof window === 'undefined') return true;
  
  const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
  
  if (!expiresAt) {
    return true;
  }
  
  return parseInt(expiresAt) <= Date.now();
};

/**
 * Get the authentication header with Bearer token
 */
export const getAuthHeader = async (): Promise<{ Authorization: string }> => {
  const token = await getIdToken();
  return { Authorization: `Bearer ${token}` };
};

/**
 * Get the current ID token for authentication
 */
export const getIdToken = async (): Promise<string> => {
  if (isTokenExpired()) {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      throw new Error('Failed to refresh token');
    }
  }
  
  return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
};

/**
 * Refresh the authentication tokens
 */
export const refreshTokens = async (): Promise<LoginResponse | null> => {
  try {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      return null;
    }
    
    const response = await axios.post(`${AUTH_ENDPOINT}/refresh-token`, {
      refreshToken,
    });
    
    const { accessToken, refreshToken: newRefreshToken, expiresIn, user } = response.data;
    
    storeAuthData({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
      user,
    });
    
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
      user,
    };
  } catch (error) {
    console.error('Failed to refresh tokens:', error);
    clearAuthData();
    return null;
  }
};

/**
 * Start the login process
 */
export const login = (): void => {
  // Redirect to Amazon Cognito login
  window.location.href = `${AUTH_ENDPOINT}/login`;
};

/**
 * Logout the user
 */
export const logout = (): void => {
  clearAuthData();
  
  // Redirect to logout endpoint to clear Cognito session
  window.location.href = `${AUTH_ENDPOINT}/logout`;
};

/**
 * Get the current user profile
 */
export const getUserProfile = async (): Promise<User | null> => {
  try {
    const headers = await getAuthHeader();
    const response = await axios.get(`${API_BASE_URL}/profiles/me`, { headers });
    
    // Update stored user data
    if (response.data) {
      const userData = response.data;
      const storedUser = getStoredUser();
      
      if (storedUser) {
        const updatedUser = { ...storedUser, ...userData };
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        return updatedUser;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
};
