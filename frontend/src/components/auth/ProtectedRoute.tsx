import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, CircularProgress, Typography, Container } from '@mui/material';
import useAuth from '@/hooks/auth/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresCompleteProfile?: boolean;
  requiresCompleteQuestionnaire?: boolean;
}

/**
 * Component that wraps routes requiring authentication
 * Redirects to login if user is not authenticated
 * Can additionally check for profile and questionnaire completion
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiresCompleteProfile = false,
  requiresCompleteQuestionnaire = false,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    // Additional requirements checks, only if user is authenticated
    if (isAuthenticated && user) {
      // Check if profile is required but not complete
      if (requiresCompleteProfile && !user.profileCompleted) {
        router.replace('/profile/setup');
        return;
      }

      // Check if questionnaire is required but not complete
      if (requiresCompleteQuestionnaire && !user.questionnaireCompleted) {
        router.replace('/questionnaire');
        return;
      }
    }
  }, [
    isLoading, 
    isAuthenticated, 
    user, 
    requiresCompleteProfile, 
    requiresCompleteQuestionnaire,
    router
  ]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <Box textAlign="center">
          <CircularProgress size={40} sx={{ mb: 3 }} />
          <Typography>Loading...</Typography>
        </Box>
      </Container>
    );
  }

  // If not authenticated or missing requirements, this will briefly flash before redirect
  if (!isAuthenticated || 
      (requiresCompleteProfile && user && !user.profileCompleted) || 
      (requiresCompleteQuestionnaire && user && !user.questionnaireCompleted)) {
    return null;
  }

  // User meets all requirements, render the children
  return <>{children}</>;
};

export default ProtectedRoute;
