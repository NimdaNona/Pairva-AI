import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { NextPage } from 'next';
import { Box, CircularProgress, Container } from '@mui/material';
import { ProfileSetupStep } from '@/lib/profile/types';
import withProtection from '@/components/auth/withProtection';

/**
 * Default profile setup page that redirects to the first setup step
 */
const ProfileSetupIndexPage: NextPage = () => {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the first step in the profile setup process
    router.replace(`/profile/setup/${ProfileSetupStep.BASIC_INFO}`);
  }, [router]);

  return (
    <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <Box textAlign="center">
        <CircularProgress />
      </Box>
    </Container>
  );
};

export default withProtection(ProfileSetupIndexPage);
