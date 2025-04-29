import React, { ReactNode, useState, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  Box, 
  Button, 
  Typography, 
  CircularProgress,
  Alert,
  AlertTitle,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepButton,
  Card,
  CardContent,
  Divider,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import { useQuestionnaire } from '@/hooks/questionnaire/useQuestionnaire';
import QuestionRenderer from './QuestionRenderer';
import { QuestionnaireNavigationMode } from '@/lib/questionnaire/enums';

interface QuestionnaireLayoutProps {
  questionnaireId: string;
  navigationMode?: QuestionnaireNavigationMode;
  onCompleted?: () => void;
  showStepper?: boolean;
  maxStepsToShow?: number;
}

const QuestionnaireLayout: React.FC<QuestionnaireLayoutProps> = ({
  questionnaireId,
  navigationMode = QuestionnaireNavigationMode.LINEAR,
  onCompleted,
  showStepper = true,
  maxStepsToShow = 7,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const {
    loading,
    error,
    questionnaire,
    questions,
    currentQuestion,
    currentQuestionIndex,
    responses,
    updateResponse,
    nextQuestion,
    prevQuestion,
    setCurrentQuestionIndex,
    isQuestionAnswered,
    validateResponses,
    submitQuestionnaire,
    progress,
    isComplete,
    isSubmitting,
  } = useQuestionnaire({ questionnaireId, autoLoad: true });

  // For free navigation, we need to track validation errors
  const [validationErrors, setValidationErrors] = useState<{[questionId: string]: string}>({});
  
  // Check for form validation
  const validateCurrentQuestion = () => {
    if (!currentQuestion) return true;
    
    // Skip validation for optional questions that aren't answered
    if (!currentQuestion.isRequired && !isQuestionAnswered(currentQuestion.id)) {
      return true;
    }
    
    // Check if question is required but not answered
    if (currentQuestion.isRequired && !isQuestionAnswered(currentQuestion.id)) {
      setValidationErrors(prev => ({
        ...prev,
        [currentQuestion.id]: 'This question requires an answer'
      }));
      return false;
    }
    
    // Additional validations based on question type and validation rules
    // Could be extended with more specific validations

    // Clear validation error if passes
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[currentQuestion.id];
      return newErrors;
    });
    
    return true;
  };

  // Handle next button click
  const handleNext = () => {
    if (validateCurrentQuestion()) {
      if (!nextQuestion() && progress === 100) {
        // All questions answered, prompt to submit
        handleSubmit();
      }
    }
  };

  // Handle back button click
  const handleBack = () => {
    prevQuestion();
  };

  // Handle direct navigation to a specific question (for FREE navigation mode)
  const handleStepClick = (index: number) => {
    if (navigationMode === QuestionnaireNavigationMode.FREE) {
      setCurrentQuestionIndex(index);
    } else if (navigationMode === QuestionnaireNavigationMode.LINEAR) {
      // In linear mode, only allow going to previous questions or consecutive questions if current is valid
      if (index < currentQuestionIndex || (index === currentQuestionIndex + 1 && validateCurrentQuestion())) {
        setCurrentQuestionIndex(index);
      }
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    // Validate all required questions
    const validation = validateResponses();
    
    if (!validation.valid) {
      // Show an error and highlight the first unanswered required question
      const unansweredIndex = questions.findIndex(q => 
        q.isRequired && !isQuestionAnswered(q.id)
      );
      
      if (unansweredIndex >= 0) {
        setCurrentQuestionIndex(unansweredIndex);
        setValidationErrors(prev => ({
          ...prev,
          [questions[unansweredIndex].id]: 'This question requires an answer'
        }));
      }
      
      return;
    }
    
    // All validation passed, submit the questionnaire
    const result = await submitQuestionnaire(true);
    
    if (result && onCompleted) {
      onCompleted();
    }
  };

  // Questionnaire title section
  const renderHeader = () => (
    <Box sx={{ mb: 4, textAlign: 'center' }}>
      {questionnaire && (
        <>
          <Typography variant="h4" component="h1" gutterBottom>
            {questionnaire.title}
          </Typography>
          {questionnaire.description && (
            <Typography variant="subtitle1" color="text.secondary">
              {questionnaire.description}
            </Typography>
          )}
        </>
      )}
    </Box>
  );

  // Stepper for question navigation
  const renderStepper = () => {
    if (!showStepper || questions.length <= 1) return null;
    
    // For many questions, show a subset with start/end and current area
    const totalSteps = questions.length;
    let steps: number[] = [];
    
    if (totalSteps <= maxStepsToShow) {
      // If few enough steps, show all
      steps = Array.from({ length: totalSteps }, (_, i) => i);
    } else {
      // Otherwise show a window around current step plus start/end
      const window = Math.floor(maxStepsToShow / 2);
      const windowStart = Math.max(0, currentQuestionIndex - window);
      const windowEnd = Math.min(totalSteps - 1, currentQuestionIndex + window);
      
      // Always include first and last step
      steps = [0];
      
      // Add ellipsis indicator after first step if needed
      if (windowStart > 1) {
        steps.push(-1); // Use -1 to indicate ellipsis
      }
      
      // Add steps in the window
      for (let i = Math.max(1, windowStart); i <= Math.min(windowEnd, totalSteps - 2); i++) {
        steps.push(i);
      }
      
      // Add ellipsis indicator before last step if needed
      if (windowEnd < totalSteps - 2) {
        steps.push(-2); // Use -2 to indicate ellipsis
      }
      
      // Add last step
      if (totalSteps > 1) {
        steps.push(totalSteps - 1);
      }
    }
    
    return (
      <Box sx={{ mb: 4, overflowX: 'auto', py: 1 }}>
        <Stepper 
          activeStep={currentQuestionIndex} 
          nonLinear={navigationMode === QuestionnaireNavigationMode.FREE}
          alternativeLabel={!isMobile}
          orientation={isMobile ? 'vertical' : 'horizontal'}
        >
          {steps.map((stepIndex, i) => {
            // Handle ellipsis cases
            if (stepIndex < 0) {
              return (
                <Step key={`ellipsis-${i}`}>
                  <StepLabel>...</StepLabel>
                </Step>
              );
            }
            
            const q = questions[stepIndex];
            const isAnswered = q && isQuestionAnswered(q.id);
            const hasError = q && validationErrors[q.id];
            
            return (
              <Step 
                key={stepIndex} 
                completed={isAnswered}
                active={currentQuestionIndex === stepIndex}
              >
                <StepButton 
                  onClick={() => handleStepClick(stepIndex)}
                  optional={
                    <Typography 
                      variant="caption" 
                      color={hasError ? 'error' : (isAnswered ? 'success.main' : 'text.secondary')}
                    >
                      {hasError ? 'Error' : (isAnswered ? 'Completed' : `Question ${stepIndex + 1}`)}
                    </Typography>
                  }
                  sx={{ cursor: 'pointer' }}
                >
                  <Typography 
                    variant="body2" 
                    color={hasError ? 'error' : (currentQuestionIndex === stepIndex ? 'primary' : 'inherit')}
                    sx={{ 
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '120px'
                    }}
                  >
                    {q?.text?.length > 20 ? `${q.text.substring(0, 20)}...` : q?.text}
                  </Typography>
                </StepButton>
              </Step>
            );
          })}
        </Stepper>
      </Box>
    );
  };

  // Loading indicator
  if (loading && !questionnaire) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading questionnaire...
          </Typography>
        </Box>
      </Container>
    );
  }

  // Error state
  if (error && !questionnaire) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error" variant="filled">
          <AlertTitle>Error</AlertTitle>
          Failed to load questionnaire: {error}
        </Alert>
      </Container>
    );
  }

  // Success/completion message
  if (isComplete) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              Thank you for completing the questionnaire!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Your responses have been saved successfully. They will be used to help find your perfect match.
            </Typography>
            {onCompleted && (
              <Button 
                variant="contained" 
                color="primary" 
                onClick={onCompleted}
                sx={{ mt: 2 }}
              >
                Continue
              </Button>
            )}
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 } }}>
        {renderHeader()}
        
        {/* Progress indicator */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Progress: {progress}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Question {currentQuestionIndex + 1} of {questions.length}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        
        {renderStepper()}
        
        {/* Loading indicator for submitting */}
        {isSubmitting && (
          <Box sx={{ width: '100%', mb: 2 }}>
            <LinearProgress />
          </Box>
        )}
        
        {/* Error message */}
        {error && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="error" variant="outlined">
              <AlertTitle>Error</AlertTitle>
              {error}
            </Alert>
          </Box>
        )}
        
        {/* Current question */}
        {currentQuestion && (
          <Card 
            variant="outlined" 
            sx={{ 
              mb: 4, 
              backgroundColor: theme.palette.background.default,
              p: { xs: 1, sm: 2 }
            }}
          >
            <CardContent>
              <QuestionRenderer
                question={currentQuestion}
                value={responses[currentQuestion.id]}
                onChange={(value) => updateResponse(currentQuestion.id, value)}
                disabled={isSubmitting}
                error={validationErrors[currentQuestion.id]}
              />
            </CardContent>
          </Card>
        )}
        
        {/* Navigation buttons */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mt: 4,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 2 : 0,
        }}>
          <Button
            variant="outlined"
            onClick={handleBack}
            disabled={currentQuestionIndex === 0 || isSubmitting}
            startIcon={<ArrowBackIcon />}
            fullWidth={isMobile}
          >
            Previous
          </Button>
          
          {isMobile && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </Typography>
          )}
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={isSubmitting}
            endIcon={currentQuestionIndex === questions.length - 1 ? <CheckIcon /> : <ArrowForwardIcon />}
            fullWidth={isMobile}
          >
            {isSubmitting 
              ? 'Saving...' 
              : (currentQuestionIndex === questions.length - 1 && progress === 100
                  ? 'Submit'
                  : 'Next'
                )
            }
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default QuestionnaireLayout;
