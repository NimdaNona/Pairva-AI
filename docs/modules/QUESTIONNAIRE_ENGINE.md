# Questionnaire Engine Module

The Questionnaire Engine module provides a flexible framework for creating, managing, and analyzing questionnaires within the Perfect Match platform. This module is critical for collecting structured user data that enables our AI matching algorithms to provide high-quality match recommendations.

## Overview

The Questionnaire Engine uses MongoDB for storage to accommodate flexible schema requirements. This design choice allows for:

- Dynamic questionnaire creation without schema migrations
- Easy versioning of questionnaires
- Efficient storage of user responses
- Flexible analytics capabilities

## Core Components

### Database Schemas

1. **Questionnaire Schema**
   - Stores metadata about questionnaires (title, category, version, etc.)
   - Manages questionnaire status (draft, active, inactive, archived)
   - Tracks questions associated with each questionnaire

2. **Question Schema**
   - Defines individual questions with various response types
   - Supports multiple question formats (multiple choice, rating scales, text responses, etc.)
   - Contains validation rules and metadata for each question
   - Includes AI matching weights and compatibility factors for the recommendation engine

3. **Response Schema**
   - Records user responses to questionnaires
   - Tracks completion status and submission timestamps
   - Contains processed data for matching algorithms
   - Supports partial responses with completion tracking

### API Endpoints

The module exposes RESTful endpoints for:

- Questionnaire management (CRUD operations for admins)
- Question management within questionnaires
- User response submission and retrieval
- Analytics and statistics generation

## User Experience Flow

1. Users are presented with questionnaires during the profile setup process
2. Responses can be saved incrementally, allowing users to return and complete questionnaires over time
3. Submitted data is processed by the AI matching engine to generate compatibility scores
4. Users can revisit and update their responses, with the matching system recalculating scores accordingly

## Integration Points

- **Profile Service**: User responses are linked to their profile data
- **AI Matching Service**: Processes questionnaire responses to generate compatibility scores
- **Authentication Service**: Secures endpoints and associates responses with authenticated users

## Technology Stack

- NestJS for backend API implementation
- MongoDB for flexible schema data storage
- TypeScript for strong typing and developer experience
- Mongoose for MongoDB schema management
- Swagger/OpenAPI for API documentation

## Implementation Details

### Questionnaire Categories

Questionnaires are organized into distinct categories to separate different aspects of user matching:

- Personality
- Preferences
- Compatibility
- Interests
- Lifestyle
- Values

### Question Types

The engine supports multiple question types to collect diverse user information:

- Multiple Choice (select many)
- Single Choice (select one)
- Short Text
- Long Text
- Rating (numerical scale)
- Scale (Likert-type scale)
- Boolean (yes/no)
- Slider (range selection)

### Response Processing

When users submit responses, the module processes the data in several ways:

1. Validates input against question-specific validation rules
2. Stores raw responses in the database
3. Computes derived values for matching algorithms
4. Updates completion status for the questionnaire
5. Triggers updates to relevant matching data

## Security and Privacy

- All questionnaire endpoints are protected by authentication
- User responses are considered sensitive data and protected accordingly
- Admin-only endpoints for questionnaire and question management
- Data visibility is carefully controlled through the API layer

## Analytics Capabilities

The module includes built-in analytics functionality:

- Completion rates for questionnaires
- Response distribution analysis for individual questions
- Correlation analysis between different question responses
- Identification of most discriminating questions for matching

## Future Enhancements

- Conditional question display based on previous answers
- A/B testing framework for questionnaire optimization
- Machine learning integration for question weighting optimization
- Real-time collaboration for questionnaire design
