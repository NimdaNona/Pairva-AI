/**
 * Enumerations for questionnaire functionality
 */

/**
 * Types of questions supported by the questionnaire engine
 */
export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  SINGLE_CHOICE = 'single_choice',
  SHORT_TEXT = 'short_text',
  LONG_TEXT = 'long_text',
  RATING = 'rating',
  SCALE = 'scale',
  BOOLEAN = 'boolean',
  SLIDER = 'slider',
}

/**
 * Questionnaire categories for organization and filtering
 */
export enum QuestionnaireCategory {
  PERSONALITY = 'personality',
  PREFERENCES = 'preferences',
  COMPATIBILITY = 'compatibility',
  INTERESTS = 'interests',
  LIFESTYLE = 'lifestyle',
  VALUES = 'values',
}

/**
 * Status of a questionnaire
 */
export enum QuestionnaireStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

/**
 * Questionnaire navigation modes
 */
export enum QuestionnaireNavigationMode {
  LINEAR = 'linear',     // Questions are displayed in sequence
  FREE = 'free',         // User can navigate to any question 
  ADAPTIVE = 'adaptive', // Questions depend on previous answers
}
