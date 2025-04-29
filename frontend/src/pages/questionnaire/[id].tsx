import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CircularProgress, Box, Typography, Container, Button } from '@mui/material';
import QuestionnaireLayout from '@/components/questionnaire/QuestionnaireLayout';
import withProtection from '@/components/auth/withProtection';
import { QuestionnaireNavigationMode } from '@/lib/questionnaire/enums';
import { useAuth } from '@/hooks/auth/useAuth';

const QuestionnairePage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading } = useAuth();
  const [questionnaireId, setQuestionnaireId] = useState<string | null>(null);

  useEffect(() => {
    // Set the questionnaire ID from the URL parameter once it's available
    if (id && typeof id === 'string') {
      setQuestionnaireId(id);
    }
  }, [id]);

  // Handle questionnaire completion
  const handleQuestionnaireCompleted = () => {
    // Check if there's a next URL in the query params
    const nextUrl = router.query.next as string;
    if (nextUrl) {
      router.push(nextUrl);
    } else {
      // Default redirect to the dashboard or home page
      router.push('/');
    }
  };

  // If authentication is loading, show a loading indicator
  if (isLoading) {
    return (
      <Container>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
          }}
        >
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading...
          </Typography>
        </Box>
      </Container>
    );
  }

  // If not authenticated, this shouldn't happen due to withProtection, but just in case
  if (!isAuthenticated) {
    return (
      <Container>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
          }}
        >
          <Typography variant="h5" gutterBottom>
            You need to be logged in to access this questionnaire
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => router.push('/login')}
            sx={{ mt: 2 }}
          >
            Log In
          </Button>
        </Box>
      </Container>
    );
  }

  // If we have the questionnaire ID, render the questionnaire
  if (questionnaireId) {
    return (
      <QuestionnaireLayout
        questionnaireId={questionnaireId}
        navigationMode={QuestionnaireNavigationMode.LINEAR}
        onCompleted={handleQuestionnaireCompleted}
        showStepper={true}
      />
    );
  }

  // Otherwise, show loading
  return (
    <Container>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
        }}
      >
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading questionnaire...
        </Typography>
      </Box>
    </Container>
  );
};

export default withProtection(QuestionnairePage);
