import { Box, Container, Typography, Button, Paper, Grid, Avatar } from '@mui/material';
import { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import LoginButton from '@/components/auth/LoginButton';
import useAuth from '@/hooks/auth/useAuth';

const Home: NextPage = () => {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();

  const navigateToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <>
      <Head>
        <title>Perfect Match | Find Your Perfect Partner</title>
        <meta name="description" content="AI-powered matchmaking application to help you find your ideal partner through comprehensive compatibility analysis." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Box
        sx={{
          bgcolor: 'background.default',
          minHeight: '100vh',
          py: 8,
        }}
      >
        <Container maxWidth="md">
          <Paper 
            elevation={3} 
            sx={{ 
              p: 5, 
              mt: 4, 
              borderRadius: 2,
              textAlign: 'center',
              background: 'linear-gradient(to right bottom, #ffffff, #f8f9fa)'
            }}
          >
            <Typography 
              variant="h2" 
              component="h1" 
              gutterBottom
              sx={{ 
                fontWeight: 700,
                background: 'linear-gradient(45deg, #FF6B6B 30%, #FF8E53 90%)',
                backgroundClip: 'text',
                textFillColor: 'transparent',
                mb: 4
              }}
            >
              Perfect Match
            </Typography>
            
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              Find your ideal partner with AI-powered matchmaking
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 4 }}>
              Our advanced AI algorithm analyzes your personality traits, values, and preferences
              to connect you with truly compatible partners. Experience the future of dating.
            </Typography>
            
            {isLoading ? (
              <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
                <Typography>Loading...</Typography>
              </Box>
            ) : isAuthenticated ? (
              <Box sx={{ mt: 4 }}>
                <Paper 
                  elevation={2}
                  sx={{ 
                    p: 3, 
                    mb: 4, 
                    borderRadius: 2,
                    borderLeft: '4px solid #FF6B6B',
                  }}
                >
                  <Grid container spacing={2} alignItems="center">
                    <Grid item>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                        {user?.firstName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase()}
                      </Avatar>
                    </Grid>
                    <Grid item xs>
                      <Typography variant="h6">
                        Welcome back, {user?.firstName || 'there'}!
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user?.profileCompleted 
                          ? 'Your profile is ready. Continue to find your perfect match!' 
                          : 'Complete your profile to start finding matches.'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
                
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 4 }}>
                  <Button 
                    variant="contained"
                    size="large"
                    startIcon={<FavoriteBorderIcon />}
                    onClick={navigateToDashboard}
                    sx={{ 
                      px: 4,
                      py: 1.5
                    }}
                  >
                    Continue to Dashboard
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="large"
                    onClick={logout}
                    sx={{ 
                      px: 4,
                      py: 1.5
                    }}
                  >
                    Sign Out
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 6 }}>
                <LoginButton 
                  size="large"
                  sx={{ 
                    background: 'linear-gradient(45deg, #FF6B6B 30%, #FF8E53 90%)',
                    px: 4,
                    py: 1.5
                  }}
                >
                  Create Profile
                </LoginButton>
                <Button 
                  variant="outlined" 
                  size="large"
                  sx={{ 
                    borderColor: '#FF6B6B',
                    color: '#FF6B6B',
                    px: 4,
                    py: 1.5,
                    '&:hover': {
                      borderColor: '#FF8E53',
                      backgroundColor: 'rgba(255, 107, 107, 0.04)'
                    }
                  }}
                >
                  Learn More
                </Button>
              </Box>
            )}
            
            <Box sx={{ mt: 8 }}>
              <Typography variant="subtitle1" color="text.secondary">
                Ready to find your perfect match? Create your Love Profile today.
              </Typography>
            </Box>
          </Paper>
        </Container>
      </Box>
    </>
  );
};

export default Home;
