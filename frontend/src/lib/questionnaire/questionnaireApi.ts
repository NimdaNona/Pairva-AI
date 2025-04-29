import axios from 'axios';
import { getAuthHeader } from '../auth/authUtils';

// API base URL from environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Questionnaire API endpoints
const QUESTIONNAIRE_ENDPOINT = `${API_URL}/questionnaire`;

/**
 * Get all questionnaires with optional filters
 * @param filters Optional filters (category, status, isActive)
 * @returns Promise with questionnaires array
 */
export const getQuestionnaires = async (filters?: {
  category?: string;
  status?: string;
  isActive?: boolean;
}) => {
  const authHeader = await getAuthHeader();
  
  let queryParams = '';
  if (filters) {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    queryParams = `?${params.toString()}`;
  }
  
  const response = await axios.get(
    `${QUESTIONNAIRE_ENDPOINT}${queryParams}`,
    { headers: authHeader }
  );
  
  return response.data;
};

/**
 * Get a single questionnaire by ID
 * @param id Questionnaire ID
 * @returns Promise with questionnaire object
 */
export const getQuestionnaire = async (id: string) => {
  const authHeader = await getAuthHeader();
  const response = await axios.get(
    `${QUESTIONNAIRE_ENDPOINT}/${id}`,
    { headers: authHeader }
  );
  return response.data;
};

/**
 * Get a questionnaire with its questions
 * @param id Questionnaire ID
 * @returns Promise with questionnaire object including questions
 */
export const getQuestionnaireWithQuestions = async (id: string) => {
  const authHeader = await getAuthHeader();
  const response = await axios.get(
    `${QUESTIONNAIRE_ENDPOINT}/${id}/questions`,
    { headers: authHeader }
  );
  return response.data;
};

/**
 * Get all questions for a questionnaire
 * @param questionnaireId Questionnaire ID
 * @returns Promise with questions array
 */
export const getQuestionsByQuestionnaire = async (questionnaireId: string) => {
  const authHeader = await getAuthHeader();
  const response = await axios.get(
    `${QUESTIONNAIRE_ENDPOINT}/${questionnaireId}/questions`,
    { headers: authHeader }
  );
  return response.data;
};

/**
 * Get user's response to a questionnaire
 * @param questionnaireId Questionnaire ID
 * @returns Promise with response object (or null if no response exists)
 */
export const getUserResponse = async (questionnaireId: string) => {
  const authHeader = await getAuthHeader();
  try {
    const response = await axios.get(
      `${QUESTIONNAIRE_ENDPOINT}/${questionnaireId}/myresponse`,
      { headers: authHeader }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null; // No response exists
    }
    throw error;
  }
};

/**
 * Submit a response to a questionnaire
 * @param questionnaireId Questionnaire ID
 * @param data Response data
 * @param profileId Optional profile ID (if different from current user)
 * @returns Promise with saved response object
 */
export const submitResponse = async (
  questionnaireId: string,
  data: {
    responses: Array<{
      questionId: string;
      response: string | number | boolean | string[] | number[];
      metadata?: Record<string, any>;
    }>;
    isComplete?: boolean;
    metadata?: Record<string, any>;
  },
  profileId?: string
) => {
  const authHeader = await getAuthHeader();
  
  let endpoint = `${QUESTIONNAIRE_ENDPOINT}/${questionnaireId}/responses`;
  if (profileId) {
    endpoint += `?profileId=${profileId}`;
  }
  
  const response = await axios.post(endpoint, data, { headers: authHeader });
  return response.data;
};

/**
 * Types for questionnaire data used in the frontend
 */

export interface QuestionOption {
  id: string;
  text: string;
  value: string | number;
  metadata?: Record<string, any>;
}

export interface Question {
  id: string;
  text: string;
  description?: string;
  type: string;
  questionnaire: string;
  isRequired: boolean;
  order?: number;
  options?: QuestionOption[];
  validations?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  metadata?: {
    aiMatchingWeight?: number;
    compatibilityFactor?: string;
    category?: string;
    displayCondition?: Record<string, any>;
    [key: string]: any;
  };
  isActive: boolean;
}

export interface Questionnaire {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  version: number;
  questions: string[] | Question[];
  isRequired: boolean;
  order?: number;
  isActive: boolean;
  previousVersion?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionResponse {
  questionId: string;
  response: string | number | boolean | string[] | number[];
  metadata?: Record<string, any>;
}

export interface UserResponse {
  id: string;
  questionnaireId: string;
  userId: string;
  profileId?: string;
  responses: QuestionResponse[];
  completedAt?: string;
  isComplete: boolean;
  metadata?: Record<string, any>;
  matchingData?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
