import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Questionnaire, 
  Question, 
  QuestionResponse, 
  UserResponse,
  getQuestionnaire,
  getQuestionsByQuestionnaire,
  getUserResponse,
  submitResponse
} from '@/lib/questionnaire/questionnaireApi';

interface UseQuestionnaireProps {
  questionnaireId?: string;
  autoLoad?: boolean;
}

export function useQuestionnaire({ questionnaireId, autoLoad = true }: UseQuestionnaireProps = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userResponse, setUserResponse] = useState<UserResponse | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load questionnaire data
  const loadQuestionnaire = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Load questionnaire metadata
      const questionnaireData = await getQuestionnaire(id);
      setQuestionnaire(questionnaireData);
      
      // Load questions
      const questionData = await getQuestionsByQuestionnaire(id);
      // Sort questions by order if available
      const sortedQuestions = [...questionData].sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return 0;
      });
      setQuestions(sortedQuestions);
      
      // Try to load user's previous responses
      try {
        const savedResponse = await getUserResponse(id);
        if (savedResponse) {
          setUserResponse(savedResponse);
          setIsComplete(savedResponse.isComplete);
          
          // Convert responses array to object for easier manipulation
          const responseMap: Record<string, any> = {};
          savedResponse.responses.forEach((response: QuestionResponse) => {
            responseMap[response.questionId] = response.response;
          });
          setResponses(responseMap);
        }
      } catch (err) {
        // It's ok if there's no previous response
        console.log('No previous response found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questionnaire');
      console.error('Error loading questionnaire:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on mount if ID is provided and autoLoad is true
  useEffect(() => {
    const id = questionnaireId || router.query.id as string;
    if (id && autoLoad) {
      loadQuestionnaire(id);
    }
  }, [questionnaireId, router.query.id, loadQuestionnaire, autoLoad]);

  // Update a response value for a specific question
  const updateResponse = useCallback((questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  }, []);

  // Move to the next question
  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      return true;
    }
    return false;
  }, [currentQuestionIndex, questions.length]);

  // Move to the previous question
  const prevQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      return true;
    }
    return false;
  }, [currentQuestionIndex]);

  // Get the current question
  const currentQuestion = questions[currentQuestionIndex];

  // Check if a specific question has been answered
  const isQuestionAnswered = useCallback((questionId: string) => {
    const response = responses[questionId];
    return response !== undefined && response !== null && 
      !(Array.isArray(response) && response.length === 0) && 
      response !== '';
  }, [responses]);

  // Calculate progress percentage
  const progress = useCallback(() => {
    if (questions.length === 0) return 0;
    
    // If complete, return 100
    if (isComplete) return 100;
    
    // Count answered questions
    const answeredCount = Object.keys(responses).filter(questionId => 
      isQuestionAnswered(questionId)
    ).length;
    
    return Math.round((answeredCount / questions.length) * 100);
  }, [questions.length, responses, isQuestionAnswered, isComplete]);

  // Check if all required questions are answered
  const validateResponses = useCallback(() => {
    const unansweredRequired = questions
      .filter(q => q.isRequired)
      .filter(q => !isQuestionAnswered(q.id))
      .map(q => q.text);
    
    return {
      valid: unansweredRequired.length === 0,
      unansweredRequired
    };
  }, [questions, isQuestionAnswered]);

  // Submit the questionnaire
  const submitQuestionnaire = useCallback(async (markComplete: boolean = true) => {
    if (!questionnaire?.id) {
      setError('No questionnaire loaded');
      return null;
    }
    
    const validation = validateResponses();
    if (markComplete && !validation.valid) {
      setError(`Please answer all required questions: ${validation.unansweredRequired.join(', ')}`);
      return null;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Format responses for submission
      const formattedResponses = Object.entries(responses).map(([questionId, response]) => ({
        questionId,
        response,
      }));
      
      // Submit to API
      const result = await submitResponse(
        questionnaire.id,
        {
          responses: formattedResponses,
          isComplete: markComplete,
          metadata: {
            timeSpent: Date.now() - (userResponse?.createdAt ? new Date(userResponse.createdAt).getTime() : Date.now()),
            sourceDevice: 'web'
          }
        }
      );
      
      setUserResponse(result);
      setIsComplete(markComplete);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit questionnaire');
      console.error('Error submitting questionnaire:', err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [questionnaire, validateResponses, responses, userResponse]);

  return {
    // State
    loading,
    error,
    questionnaire,
    questions,
    userResponse,
    responses,
    currentQuestion,
    currentQuestionIndex,
    isComplete,
    isSubmitting,
    
    // Computed
    progress: progress(),
    
    // Methods
    loadQuestionnaire,
    updateResponse,
    nextQuestion,
    prevQuestion,
    validateResponses,
    submitQuestionnaire,
    setCurrentQuestionIndex,
    isQuestionAnswered,
  };
}
