import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  CircularProgress,
  Divider,
  Alert,
  AlertTitle,
} from '@mui/material';
import QuizIcon from '@mui/icons-material/Quiz';
import withProtection from '@/components/auth/withProtection';
import { useAuth } from '@/hooks/auth/useAuth';
import { getQuestionnaires, Questionnaire } from '@/lib/questionnaire/questionnaireApi';
import { QuestionnaireCategory, QuestionnaireStatus } from '@/lib/questionnaire/enums';

const QuestionnairesPage: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch active questionnaires for the user
    const fetchQuestionnaires = async () => {
      try {
        setLoading(true);
        const result = await getQuestionnaires({
          status: QuestionnaireStatus.ACTIVE,
          isActive: true,
        });
        
        // Sort questionnaires by order if available, then by category
        const sortedQuestionnaires = [...result].sort((a, b) => {
          // First sort by order if available
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          // Then sort by category
          return a.category.localeCompare(b.category);
        });
        
        setQuestionnaires(sortedQuestionnaires);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load questionnaires');
        console.error('Error loading questionnaires:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionnaires();
  }, []);

  // Group questionnaires by category
  const groupedQuestionnaires = questionnaires.reduce((acc, questionnaire) => {
    const category = questionnaire.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(questionnaire);
    return acc;
  }, {} as Record<string, Questionnaire[]>);

  // Format category name for display
  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Get an icon color based on category
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      [QuestionnaireCategory.PERSONALITY]: '#4e1a3d', // Purple
      [QuestionnaireCategory.PREFERENCES]: '#1a3d4e', // Blue
      [QuestionnaireCategory.COMPATIBILITY]: '#3d4e1a', // Green
      [QuestionnaireCategory.INTERESTS]: '#4e3d1a', // Orange/Brown
      [QuestionnaireCategory.LIFESTYLE]: '#4e1a1a', // Red
      [QuestionnaireCategory.VALUES]: '#1a4e1a', // Green
    };
    return colors[category] || '#1976d2'; // Default to primary blue
  };

  // Handle click on a questionnaire
  const handleQuestionnaireClick = (id: string) => {
    router.push(`/questionnaire/${id}`);
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading questionnaires...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error" variant="filled">
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      </Container>
    );
  }

  if (questionnaires.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <QuizIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            No Questionnaires Available
          </Typography>
          <Typography variant="body1" paragraph>
            There are currently no questionnaires available for you to complete.
          </Typography>
          <Button variant="contained" onClick={() => router.push('/')}>
            Return to Home
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Questionnaires
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
          Complete these questionnaires to help us find your perfect match. Your answers provide valuable insights into your personality, preferences, and compatibility factors.
        </Typography>
      </Box>

      {Object.entries(groupedQuestionnaires).map(([category, categoryQuestionnaires]) => (
        <Box key={category} sx={{ mb: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: getCategoryColor(category),
                mr: 1,
              }}
            />
            <Typography variant="h5" component="h2">
              {formatCategoryName(category)} Questionnaires
            </Typography>
          </Box>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            {categoryQuestionnaires.map((questionnaire) => (
              <Grid item xs={12} sm={6} md={4} key={questionnaire.id}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography
                      variant="h6"
                      component="h3"
                      gutterBottom
                      sx={{
                        borderLeft: `4px solid ${getCategoryColor(category)}`,
                        pl: 1,
                      }}
                    >
                      {questionnaire.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {questionnaire.description || 'Complete this questionnaire to enhance your matching profile.'}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {questionnaire.isRequired ? 'Required' : 'Optional'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Est. time: {questionnaire.metadata?.estimatedTime || '5-10 min'}
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      onClick={() => handleQuestionnaireClick(questionnaire.id)}
                      fullWidth
                      variant="contained"
                      color="primary"
                    >
                      Start Questionnaire
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Container>
  );
};

// No specific requirements for this page
export default withProtection(QuestionnairesPage);
