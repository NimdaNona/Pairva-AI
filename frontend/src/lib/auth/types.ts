/**
 * Types and interfaces for authentication
 */

/**
 * User information returned from API
 */
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  profileCompleted: boolean;
  questionnaireCompleted: boolean;
  authProvider: string;
  subscriptionTier: string;
}

/**
 * Authentication state for context
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

/**
 * Authentication tokens
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Login response from API
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: User;
}

/**
 * Authentication context values
 */
export interface AuthContextValue extends AuthState {
  login: () => void;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  getIdToken: () => Promise<string>;
}
