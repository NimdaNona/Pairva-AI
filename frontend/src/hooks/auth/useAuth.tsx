import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as authUtils from '../../lib/auth/authUtils';
import { 
  getStoredTokens, 
  getStoredUser, 
  isTokenExpired, 
  refreshTokens, 
  login as loginUtil, 
  logout as logoutUtil,
  getUserProfile
} from '../../lib/auth/authUtils';
import { AuthContextValue, AuthState, User } from '../../lib/auth/types';

// Initial auth state
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
};

// Create the auth context
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider component that wraps the application and provides authentication state
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);
  
  // Initialize auth state on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      // Check for stored tokens and user data
      const tokens = getStoredTokens();
      const storedUser = getStoredUser();
      
      // No tokens or user found, not authenticated
      if (!tokens || !storedUser) {
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null,
        });
        return;
      }
      
      // Check if the token is expired
      if (isTokenExpired()) {
        // Try to refresh the token
        const refreshResult = await refreshSession();
        
        if (!refreshResult) {
          // Token refresh failed
          setState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            error: 'Session expired. Please log in again.',
          });
        }
      } else {
        // Valid token and user found
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: storedUser,
          error: null,
        });
        
        // Fetch fresh user data in the background
        getUserProfile().then(user => {
          if (user) {
            setState(prev => ({ ...prev, user }));
          }
        });
      }
    };
    
    initializeAuth();
  }, []);
  
  /**
   * Initiate login process
   */
  const login = () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    loginUtil();
  };
  
  /**
   * Logout user
   */
  const logout = () => {
    setState(prev => ({ ...prev, isLoading: true }));
    logoutUtil();
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
    });
  };
  
  /**
   * Refresh the authentication session
   */
  const refreshSession = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await refreshTokens();
      
      if (!result) {
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: 'Failed to refresh session. Please log in again.',
        });
        return false;
      }
      
      setState({
        isAuthenticated: true,
        isLoading: false,
        user: result.user,
        error: null,
      });
      
      return true;
    } catch (error) {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: 'An error occurred while refreshing your session.',
      });
      return false;
    }
  };
  
  /**
   * Get the ID token for API/WebSocket authentication
   */
  const getIdToken = async (): Promise<string> => {
    try {
      return await authUtils.getIdToken();
    } catch (error) {
      console.error('Failed to get ID token:', error);
      return '';
    }
  };

  // Combine state and functions for context value
  const contextValue: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshSession,
    getIdToken,
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use authentication context
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

/**
 * Export default for easier imports
 */
export default useAuth;
