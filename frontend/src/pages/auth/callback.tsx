import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, CircularProgress, Typography, Container, Paper } from '@mui/material';
import { storeAuthData } from '@/lib/auth/authUtils';
import { LoginResponse } from '@/lib/auth/types';

/**
 * Callback page for OAuth2 authentication with Cognito
 * Handles the redirect from AWS Cognito with access_token and refresh_token
 */
const AuthCallback = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Function to handle the callback
    const handleCallback = async () => {
      // Extract tokens from URL
      const { access_token, refresh_token } = router.query;

      if (!access_token || !refresh_token) {
        // No tokens in URL, wait for query params to be populated
        if (Object.keys(router.query).length > 0) {
          setError('Authentication failed. Missing access token or refresh token.');
        }
        return;
      }

      try {
        // Access token and refresh token are provided directly in URL
        // We need to exchange them for user data
        const response = await fetch('/api/v1/auth/profile', {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user profile');
        }

        const user = await response.json();

        // Store tokens and user data
        const authData: LoginResponse = {
          accessToken: access_token as string,
          refreshToken: refresh_token as string,
          expiresIn: '1h', // Default, will be overridden if provided in the response
          user,
        };

        storeAuthData(authData);

        // Redirect based on profile completion
        if (!user.profileCompleted) {
          router.replace('/profile/setup');
        } else if (!user.questionnaireCompleted) {
          router.replace('/questionnaire');
        } else {
          router.replace('/dashboard');
        }
      } catch (err) {
        console.error('Error in auth callback:', err);
        setError('Authentication failed. Please try again.');
      }
    };

    // Only process after router is ready
    if (router.isReady) {
      handleCallback();
    }
  }, [router.isReady, router.query]);

  // Loading state while processing
  if (!error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5" component="h1" gutterBottom>
              Completing Sign In
            </Typography>
            <Typography color="textSecondary">
              Please wait while we complete your authentication...
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  // Error state
  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Box py={4}>
          <Typography variant="h5" component="h1" gutterBottom color="error">
            Authentication Error
          </Typography>
          <Typography color="textSecondary" paragraph>
            {error}
          </Typography>
          <Typography variant="body2" sx={{ mt: 4 }}>
            Please try signing in again or contact support if the issue persists.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default AuthCallback;
