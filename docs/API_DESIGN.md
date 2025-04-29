# Perfect Match: API Design

This document outlines the API design for the Perfect Match application. It includes detailed specifications for endpoints, request/response formats, authentication requirements, and other API considerations.

```yaml
# API_CONTEXT
api_style: "RESTful"
authentication: "JWT-based"
documentation: "OpenAPI/Swagger"
versioning: "URL-based (v1)"
primary_format: "JSON"
```

## API Overview

Perfect Match follows a microservices architecture with the following API domains:

1. **Authentication API**: User registration, login, and session management
2. **Profile API**: User profile management
3. **Questionnaire API**: Dynamic questionnaire flow and response handling
4. **Match API**: Match discovery and compatibility insights
5. **Chat API**: Messaging between matched users
6. **Notification API**: User notifications management
7. **Subscription API**: Premium subscription handling

## Base URL Structure

```
https://api.perfect-match.com/v1/{service}/{resource}
```

- `v1`: API version
- `service`: Service name (auth, profile, questionnaire, match, chat, notification, subscription)
- `resource`: Resource being accessed

## Authentication

All API endpoints (except public authentication endpoints) require authentication using JWT tokens.

### Authentication Flow

1. Client authenticates using credentials or social provider
2. Server issues JWT access token and refresh token
3. Client includes access token in Authorization header for subsequent requests
4. When access token expires, client uses refresh token to obtain a new access token

### Authorization Header

```
Authorization: Bearer {access_token}
```

### Token Claims

Access tokens include the following claims:
- `sub`: User ID
- `exp`: Expiration timestamp
- `iat`: Issued at timestamp
- `role`: User role (user, admin)
- `scope`: Token scope (e.g., "read:profile write:profile")
- `plan`: Subscription plan (free, premium)

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource could not be found",
    "details": {
      "resource": "user",
      "id": "123e4567-e89b-12d3-a456-426614174000"
    },
    "requestId": "req_7h2j5g3k5j2l3h5g2j3k5h2j"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Pagination

List endpoints support pagination using the following query parameters:

- `page`: Page number (1-based)
- `limit`: Number of items per page (default: 20, max: 100)

Response format for paginated lists:

```json
{
  "data": [
    {
      "id": "abc123",
      "name": "Example Item"
    }
    // more items...
  ],
  "pagination": {
    "totalItems": 243,
    "totalPages": 13,
    "currentPage": 1,
    "itemsPerPage": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## Filtering and Sorting

List endpoints may support filtering and sorting:

- Filtering: `filter[field]=value`
- Sorting: `sort=field` (ascending) or `sort=-field` (descending)

Example:
```
/v1/match/matches?filter[status]=active&sort=-compatibilityScore
```

## Rate Limiting

API endpoints are rate-limited based on user subscription level:

- Free tier: 60 requests per minute
- Premium tier: 120 requests per minute

Rate limit headers included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1614556800
```

## API Services

### 1. Authentication API

#### Register User

```
POST /v1/auth/register
```

Request body:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "birthDate": "1990-01-01"
}
```

Response (201 Created):
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2025-04-03T18:30:00Z"
}
```

#### Social Login/Register

```
POST /v1/auth/social/{provider}
```

Request body:
```json
{
  "token": "social-provider-token",
  "profile": {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "picture": "https://provider.com/profile.jpg"
  }
}
```

Response (200 OK):
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "isNewUser": false
}
```

#### Login

```
POST /v1/auth/login
```

Request body:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

Response (200 OK):
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

#### Refresh Token

```
POST /v1/auth/refresh
```

Request body:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

#### Logout

```
POST /v1/auth/logout
```

Request body:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response (204 No Content)

#### Verify Email

```
GET /v1/auth/verify/{token}
```

Response (200 OK):
```json
{
  "verified": true,
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Request Password Reset

```
POST /v1/auth/password/reset-request
```

Request body:
```json
{
  "email": "user@example.com"
}
```

Response (204 No Content)

#### Reset Password

```
POST /v1/auth/password/reset
```

Request body:
```json
{
  "token": "reset-token",
  "password": "newSecurePassword123"
}
```

Response (200 OK):
```json
{
  "success": true
}
```

### 2. Profile API

#### Get Current User Profile

```
GET /v1/profile
```

Response (200 OK):
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "birthDate": "1990-01-01",
  "gender": "male",
  "seekingGender": "female",
  "location": "New York, NY",
  "bio": "Software engineer who loves hiking and photography",
  "profileCompleted": true,
  "profileVisibility": "matches_only",
  "media": [
    {
      "mediaId": "abc-123",
      "type": "image",
      "url": "https://storage.perfect-match.com/profiles/123e4567/1.jpg",
      "displayOrder": 1
    }
  ],
  "createdAt": "2025-04-01T12:00:00Z",
  "lastActive": "2025-04-03T18:30:00Z"
}
```

#### Update Profile

```
PUT /v1/profile
```

Request body:
```json
{
  "firstName": "Johnny",
  "lastName": "Doe",
  "birthDate": "1990-01-01",
  "gender": "male",
  "seekingGender": "female",
  "location": "New York, NY",
  "bio": "Software engineer who loves hiking and photography"
}
```

Response (200 OK):
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "firstName": "Johnny",
  "lastName": "Doe",
  "birthDate": "1990-01-01",
  "gender": "male",
  "seekingGender": "female",
  "location": "New York, NY",
  "bio": "Software engineer who loves hiking and photography",
  "updatedAt": "2025-04-03T18:35:00Z"
}
```

#### Get User's Preferences

```
GET /v1/profile/preferences
```

Response (200 OK):
```json
{
  "notificationSettings": {
    "newMatches": true,
    "messages": true,
    "profileLikes": true
  },
  "privacySettings": {
    "profileVisibility": "matches_only",
    "showOnlineStatus": true,
    "showLastActive": true
  },
  "matchPreferences": {
    "maxDistance": 50,
    "minAge": 25,
    "maxAge": 40
  }
}
```

#### Update Preferences

```
PUT /v1/profile/preferences
```

Request body:
```json
{
  "notificationSettings": {
    "newMatches": true,
    "messages": true,
    "profileLikes": false
  },
  "privacySettings": {
    "profileVisibility": "matches_only",
    "showOnlineStatus": false,
    "showLastActive": true
  },
  "matchPreferences": {
    "maxDistance": 25,
    "minAge": 28,
    "maxAge": 38
  }
}
```

Response (200 OK):
```json
{
  "notificationSettings": {
    "newMatches": true,
    "messages": true,
    "profileLikes": false
  },
  "privacySettings": {
    "profileVisibility": "matches_only",
    "showOnlineStatus": false,
    "showLastActive": true
  },
  "matchPreferences": {
    "maxDistance": 25,
    "minAge": 28,
    "maxAge": 38
  },
  "updatedAt": "2025-04-03T18:40:00Z"
}
```

#### Upload Profile Media

```
POST /v1/profile/media
```

Request (multipart/form-data):
```
file: [binary data]
displayOrder: 1
```

Response (201 Created):
```json
{
  "mediaId": "def-456",
  "type": "image",
  "url": "https://storage.perfect-match.com/profiles/123e4567/2.jpg",
  "displayOrder": 1,
  "uploadedAt": "2025-04-03T18:45:00Z"
}
```

#### Delete Profile Media

```
DELETE /v1/profile/media/{mediaId}
```

Response (204 No Content)

#### Get User Profile (Premium Feature)

```
GET /v1/profile/{userId}
```

Response (200 OK):
```json
{
  "userId": "567e4321-e89b-12d3-a456-426614174000",
  "firstName": "Jane",
  "gender": "female",
  "location": "Brooklyn, NY",
  "bio": "Artist and coffee enthusiast",
  "media": [
    {
      "mediaId": "xyz-789",
      "type": "image",
      "url": "https://storage.perfect-match.com/profiles/567e4321/1.jpg",
      "displayOrder": 1
    }
  ],
  "lastActive": "2025-04-03T17:30:00Z"
}
```

### 3. Questionnaire API

#### Start Questionnaire

```
POST /v1/questionnaire/start
```

Response (200 OK):
```json
{
  "sessionId": "questionnaire-session-123",
  "initialQuestions": [
    {
      "questionId": "q1",
      "blockId": "block1",
      "text": "What are you looking for right now?",
      "type": "multiple_choice",
      "options": [
        {"id": "option1", "text": "Friendship"},
        {"id": "option2", "text": "Casual Dating"},
        {"id": "option3", "text": "Serious Relationship"},
        {"id": "option4", "text": "Marriage"}
      ],
      "importanceOptions": true
    },
    {
      "questionId": "q2",
      "blockId": "block1",
      "text": "How would you describe your social energy?",
      "type": "slider",
      "options": {
        "min": 1,
        "max": 10,
        "minLabel": "Strongly Introverted",
        "maxLabel": "Highly Extroverted"
      },
      "importanceOptions": true
    }
  ],
  "progress": {
    "completed": 0,
    "total": 30,
    "percentage": 0
  }
}
```

#### Submit Answers

```
POST /v1/questionnaire/answers
```

Request body:
```json
{
  "sessionId": "questionnaire-session-123",
  "answers": [
    {
      "questionId": "q1",
      "value": "option3",
      "importance": 9
    },
    {
      "questionId": "q2",
      "value": 4,
      "importance": 6
    }
  ]
}
```

Response (200 OK):
```json
{
  "nextQuestions": [
    {
      "questionId": "q3",
      "blockId": "block2",
      "text": "How important is it to you that your partner shares your religious beliefs?",
      "type": "slider",
      "options": {
        "min": 1,
        "max": 10,
        "minLabel": "Not Important",
        "maxLabel": "Extremely Important"
      },
      "importanceOptions": true
    }
  ],
  "progress": {
    "completed": 2,
    "total": 30,
    "percentage": 6.67
  }
}
```

#### Get Questionnaire Progress

```
GET /v1/questionnaire/progress
```

Response (200 OK):
```json
{
  "progress": {
    "completed": 15,
    "total": 30,
    "percentage": 50
  },
  "blocks": [
    {
      "blockId": "block1",
      "title": "Basic Information",
      "completed": true
    },
    {
      "blockId": "block2",
      "title": "Lifestyle & Values",
      "completed": true
    },
    {
      "blockId": "block3",
      "title": "Communication Style",
      "completed": false
    },
    {
      "blockId": "block4",
      "title": "Relationship Expectations",
      "completed": false
    }
  ],
  "canResume": true,
  "resumeUrl": "/v1/questionnaire/resume"
}
```

#### Resume Questionnaire

```
GET /v1/questionnaire/resume
```

Response (200 OK):
```json
{
  "sessionId": "questionnaire-session-123",
  "nextQuestions": [
    {
      "questionId": "q16",
      "blockId": "block3",
      "text": "How do you prefer to resolve conflicts in relationships?",
      "type": "multiple_choice",
      "options": [
        {"id": "option1", "text": "Address issues immediately"},
        {"id": "option2", "text": "Take time to process, then discuss"},
        {"id": "option3", "text": "Seek compromise right away"},
        {"id": "option4", "text": "Let minor issues go, focus on big picture"}
      ],
      "importanceOptions": true
    }
  ],
  "progress": {
    "completed": 15,
    "total": 30,
    "percentage": 50
  }
}
```

#### Complete Questionnaire

```
POST /v1/questionnaire/complete
```

Request body:
```json
{
  "sessionId": "questionnaire-session-123"
}
```

Response (200 OK):
```json
{
  "completed": true,
  "profileCreated": true,
  "matchingEnabled": true,
  "nextSteps": {
    "viewProfile": "/v1/profile",
    "viewMatches": "/v1/match/matches"
  }
}
```

### 4. Match API

#### Get Matches

```
GET /v1/match/matches
```

Response (200 OK):
```json
{
  "data": [
    {
      "matchId": "match-123",
      "userId": "567e4321-e89b-12d3-a456-426614174000",
      "firstName": "Jane",
      "age": 28,
      "location": "Brooklyn, NY",
      "profileImage": "https://storage.perfect-match.com/profiles/567e4321/1.jpg",
      "compatibilityScore": 95,
      "highlightFactors": [
        "Communication Style",
        "Shared Interests",
        "Core Values"
      ],
      "status": "active",
      "liked": true,
      "hasLikedYou": false,
      "createdAt": "2025-04-02T15:30:00Z"
    },
    {
      "matchId": "match-124",
      "userId": "987e6543-e89b-12d3-a456-426614174000",
      "firstName": "Emily",
      "age": 26,
      "location": "Manhattan, NY",
      "profileImage": "https://storage.perfect-match.com/profiles/987e6543/1.jpg",
      "compatibilityScore": 87,
      "highlightFactors": [
        "Shared Interests",
        "Relationship Goals"
      ],
      "status": "active",
      "liked": false,
      "hasLikedYou": true,
      "createdAt": "2025-04-03T10:15:00Z"
    }
  ],
  "pagination": {
    "totalItems": 12,
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20
  },
  "stats": {
    "newMatchesToday": 2,
    "totalActiveMatches": 12
  },
  "premiumFeatures": {
    "unlocked": false,
    "additionalMatches": 8
  }
}
```

#### Get Match Details

```
GET /v1/match/matches/{matchId}
```

Response (200 OK):
```json
{
  "matchId": "match-123",
  "userId": "567e4321-e89b-12d3-a456-426614174000",
  "firstName": "Jane",
  "age": 28,
  "location": "Brooklyn, NY",
  "bio": "Artist and coffee enthusiast",
  "media": [
    {
      "mediaId": "xyz-789",
      "type": "image",
      "url": "https://storage.perfect-match.com/profiles/567e4321/1.jpg",
      "displayOrder": 1
    },
    {
      "mediaId": "xyz-790",
      "type": "image",
      "url": "https://storage.perfect-match.com/profiles/567e4321/2.jpg",
      "displayOrder": 2
    }
  ],
  "compatibilityScore": 95,
  "compatibilityInsights": {
    "summary": "You and Jane have an exceptional connection based on shared values, communication styles, and interests.",
    "factors": [
      {
        "name": "Communication Style",
        "score": 98,
        "description": "You both prefer direct, honest communication with a focus on emotional understanding."
      },
      {
        "name": "Shared Interests",
        "score": 92,
        "description": "You share multiple interests including hiking, photography, and trying new restaurants."
      },
      {
        "name": "Core Values",
        "score": 96,
        "description": "You align strongly on values like honesty, personal growth, and work-life balance."
      }
    ],
    "detailedAnalysis": "Limited preview for free users...",
    "isPremiumContentHidden": true
  },
  "status": "active",
  "liked": true,
  "hasLikedYou": false,
  "conversationId": "conversation-123",
  "createdAt": "2025-04-02T15:30:00Z",
  "lastActive": "2025-04-03T17:30:00Z"
}
```

#### Get Compatibility Insights (Premium)

```
GET /v1/match/matches/{matchId}/compatibility
```

Response (200 OK):
```json
{
  "matchId": "match-123",
  "compatibilityScore": 95,
  "compatibilityInsights": {
    "summary": "You and Jane have an exceptional connection based on shared values, communication styles, and interests.",
    "factors": [
      {
        "name": "Communication Style",
        "score": 98,
        "description": "You both prefer direct, honest communication with a focus on emotional understanding."
      },
      {
        "name": "Shared Interests",
        "score": 92,
        "description": "You share multiple interests including hiking, photography, and trying new restaurants."
      },
      {
        "name": "Core Values",
        "score": 96,
        "description": "You align strongly on values like honesty, personal growth, and work-life balance."
      },
      {
        "name": "Emotional Intelligence",
        "score": 90,
        "description": "You both demonstrate strong empathy and self-awareness in your responses."
      },
      {
        "name": "Lifestyle Compatibility",
        "score": 85,
        "description": "You have similar daily routines and activity levels."
      }
    ],
    "detailedAnalysis": "Your compatibility with Jane is particularly strong in how you approach communication. Both of you value honest, direct conversations while maintaining emotional awareness. This suggests your discussions would be productive and supportive, even during disagreements. Your shared interests in outdoor activities like hiking provide natural opportunities for connection, while your mutual appreciation for photography indicates a shared creative outlook. The alignment in core values around personal growth suggests you would support each other's individual journeys while building something meaningful together...",
    "conversationStarters": [
      "I noticed you enjoy photography. What kind of subjects do you like to capture?",
      "Your profile mentioned coffee enthusiasm. What's your favorite brewing method?",
      "We both seem to value work-life balance. How do you like to disconnect after a busy day?"
    ],
    "potentialChallenges": [
      "You may have slightly different approaches to financial planning",
      "Your social energy levels differ somewhat, which may require compromise"
    ]
  }
}
```

#### Like/Unlike Match

```
PUT /v1/match/matches/{matchId}/like
```

Request body:
```json
{
  "like": true
}
```

Response (200 OK):
```json
{
  "matchId": "match-123",
  "liked": true,
  "mutual": false,
  "conversationEnabled": false
}
```

#### Search Matches (Premium)

```
GET /v1/match/search?query=art
```

Response (200 OK):
```json
{
  "data": [
    {
      "userId": "567e4321-e89b-12d3-a456-426614174000",
      "firstName": "Jane",
      "age": 28,
      "location": "Brooklyn, NY",
      "profileImage": "https://storage.perfect-match.com/profiles/567e4321/1.jpg",
      "bio": "Artist and coffee enthusiast",
      "compatibilityScore": 95,
      "relevance": "High match on 'art' in bio and interests"
    }
  ],
  "pagination": {
    "totalItems": 1,
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20
  }
}
```

### 5. Chat API

#### Get Conversations

```
GET /v1/chat/conversations
```

Response (200 OK):
```json
{
  "data": [
    {
      "conversationId": "conversation-123",
      "matchId": "match-123",
      "userId": "567e4321-e89b-12d3-a456-426614174000",
      "firstName": "Jane",
      "profileImage": "https://storage.perfect-match.com/profiles/567e4321/1.jpg",
      "lastMessage": {
        "content": "Would you like to grab coffee sometime?",
        "senderId": "123e4567-e89b-12d3-a456-426614174000",
        "sentAt": "2025-04-03T14:30:00Z",
        "isRead": false
      },
      "unreadCount": 0,
      "createdAt": "2025-04-02T16:00:00Z",
      "updatedAt": "2025-04-03T14:30:00Z"
    }
  ],
  "pagination": {
    "totalItems": 1,
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20
  }
}
```

#### Get Conversation Messages

```
GET /v1/chat/conversations/{conversationId}/messages
```

Response (200 OK):
```json
{
  "data": [
    {
      "messageId": "message-1",
      "senderId": "567e4321-e89b-12d3-a456-426614174000",
      "senderName": "Jane",
      "messageType": "text",
      "content": "Hi there! I saw we both enjoy hiking. What's your favorite trail?",
      "sentAt": "2025-04-02T16:00:00Z",
      "readAt": "2025-04-02T16:05:00Z",
      "reactions": []
    },
    {
      "messageId": "message-2",
      "senderId": "123e4567-e89b-12d3-a456-426614174000",
      "senderName": "Johnny",
      "messageType": "text",
      "content": "Hey Jane! I love the Bear Mountain trail. Have you been there?",
      "sentAt": "2025-04-02T16:10:00Z",
      "readAt": "2025-04-02T16:15:00Z",
      "reactions": [
        {
          "userId": "567e4321-e89b-12d3-a456-426614174000",
          "reaction": "👍",
          "createdAt": "2025-04-02T16:20:00Z"
        }
      ]
    },
    {
      "messageId": "message-3",
      "senderId": "123e4567-e89b-12d3-a456-426614174000",
      "senderName": "Johnny",
      "messageType": "text",
      "content": "Would you like to grab coffee sometime?",
      "sentAt": "2025-04-03T14:30:00Z",
      "readAt": null,
      "reactions": []
    }
  ],
  "pagination": {
    "totalItems": 3,
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20
  },
  "conversationDetails": {
    "matchId": "match-123",
    "userId": "567e4321-e89b-12d3-a456-426614174000",
    "firstName": "Jane",
    "profileImage": "https://storage.perfect-match.com/profiles/567e4321/1.jpg",
    "compatibilityScore": 95
  }
}
```

#### Send Message

```
POST /v1/chat/conversations/{conversationId}/messages
```

Request body:
```json
{
  "messageType": "text",
  "content": "Yes, I'd love to! How about Saturday morning?"
}
```

Response (201 Created):
```json
{
  "messageId": "message-4",
  "senderId": "123e4567-e89b-12d3-a456-426614174000",
  "senderName": "Johnny",
  "messageType": "text",
  "content": "Yes, I'd love to! How about Saturday morning?",
  "sentAt": "2025-04-03T18:50:00Z",
  "readAt": null,
  "reactions": []
}
```

#### Send Message with Media

```
POST /v1/chat/conversations/{conversationId}/messages
```

Request (multipart/form-data):
```
messageType: image
file: [binary data]
```

Response (201 Created):
```json
{
  "messageId": "message-5",
  "senderId": "123e4567-e89b-12d3-a456-426614174000",
  "senderName": "Johnny",
  "messageType": "image",
  "content": null,
  "mediaUrl": "https://storage.perfect-match.com/messages/message-5/image.jpg",
  "sentAt": "2025-04-03T18:55:00Z",
  "readAt": null,
  "reactions": []
}
```

#### Add Reaction to Message

```
POST /v1/chat/conversations/{conversationId}/messages/{messageId}/reactions
```

Request body:
```json
{
  "reaction": "❤️"
}
```

Response (200 OK):
```json
{
  "messageId": "message-2",
  "reaction": "❤️",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "createdAt": "2025-04-03T19:00:00Z"
}
```

#### Remove Reaction from Message

```
DELETE /v1/chat/conversations/{conversationId}/messages/{messageId}/reactions/{reaction}
```

Response (204 No Content)

#### Mark Messages as Read

```
PUT /v1/chat/conversations/{conversationId}/read
```

Request body:
```json
{
  "messageIds": ["message-1", "message-2", "message-3"]
}
```

Response (200 OK):
```json
{
  "read": 3,
  "updatedAt": "2025-04-03T19:05:00Z"
}
```

#### Get Conversation Starters (Premium)

```
GET /v1/chat/conversations/{conversationId}/starters
```

Response (200 OK):
```json
{
  "starters": [
    "I noticed you enjoy photography. What kind of subjects do you like to capture?",
    "Your profile mentioned coffee enthusiasm. What's your favorite brewing method?",
    "We both seem to value work-life balance. How do you like to disconnect after a busy day?"
  ],
  "commonInterests": [
    "Photography",
    "Hiking",
    "Coffee"
  ],
  "generatedAt": "2025-04-03T19:10:00Z"
}
```

### 6. Notification API

#### Get Notifications

```
GET /v1/notification/notifications
```

Response (200 OK):
```json
{
  "data": [
    {
      "notificationId": "notif-123",
      "type": "new_match",
      "content": {
        "matchId": "match-124",
        "userId": "987e6543-e89b-12d3-a456-426614174000",
        "firstName": "Emily",
        "compatibilityScore": 87,
        "profileImage": "https://storage.perfect-match.com/profiles/987e6543/1.jpg"
      },
      "isRead": false,
      "createdAt": "2025-04-03T10:15:00Z"
    },
    {
      "notificationId": "notif-122",
      "type": "profile_like",
      "content": {
        "userId": "567e4321-e89b-12d3-a456-426614174000",
        "firstName": "Jane",
        "profileImage": "https://storage.perfect-match.com/profiles/567e4321/1.jpg"
      },
      "isRead": true,
      "createdAt": "2025-04-02T15:45:00Z"
    }
  ],
  "pagination": {
    "totalItems": 2,
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20
  },
  "unreadCount": 1
}
```

#### Mark Notification as Read

```
PUT /v1/notification/notifications/{notificationId}/read
```

Response (200 OK):
```json
{
  "notificationId": "notif-123",
  "isRead": true,
  "updatedAt": "2025-04-03T19:15:00Z"
}
```

#### Mark All Notifications as Read

```
PUT /v1/notification/notifications/read-all
```

Response (200 OK):
```json
{
  "read": 1,
  "updatedAt": "2025-04-03T19:20:00Z"
}
```

#### Update Notification Settings

```
PUT /v1/notification/settings
```

Request body:
```json
{
  "newMatches": true,
  "messages": true,
  "profileLikes": false,
  "subscriptionUpdates": true
}
```

Response (200 OK):
```json
{
  "settings": {
    "newMatches": true,
    "messages": true,
    "profileLikes": false,
    "subscriptionUpdates": true
  },
  "updatedAt": "2025-04-03T19:25:00Z"
}
```

### 7. Subscription API

#### Get Subscription Status

```
GET /v1/subscription
```

Response (200 OK):
```json
{
  "subscriptionId": "sub-123",
  "planType": "free",
  "features": {
    "maxDailyMatches": 10,
    "compatibilityInsights": "limited",
    "conversationStarters": false,
    "searchCapability": false,
    "likeVisibility": false
  },
  "premiumFeatures": {
    "maxDailyMatches": 50,
    "compatibilityInsights": "full",
    "conversationStarters": true,
    "searchCapability": true,
    "likeVisibility": true
  },
  "startDate": null,
  "endDate": null,
  "status": "active"
}
```

#### Get Subscription Plans

```
GET /v1/subscription/plans
```

Response (200 OK):
```json
{
  "plans": [
    {
      "planId": "premium-monthly",
      "name": "Premium Monthly",
      "description": "Full access to all premium features",
      "price": 19.99,
      "currency": "USD",
      "interval": "month",
      "features": [
        "Unlimited matches",
        "Full compatibility insights",
        "AI conversation starters",
        "See who liked your profile",
        "Search functionality"
      ]
    },
    {
      "planId": "premium-yearly",
      "name": "Premium Yearly",
      "description": "Full access to all premium features at a discount",
      "price": 199.99,
      "currency": "USD",
      "interval": "year",
      "features": [
        "Unlimited matches",
        "Full compatibility insights",
        "AI conversation starters",
        "See who liked your profile",
        "Search functionality"
      ],
      "savings": "17%"
    }
  ]
}
```

#### Create Subscription

```
POST /v1/subscription
```

Request body:
```json
{
  "planId": "premium-monthly",
  "paymentMethodId": "pm_123456789"
}
```

Response (201 Created):
```json
{
  "subscriptionId": "sub-456",
  "planType": "premium",
  "planId": "premium-monthly",
  "features": {
    "maxDailyMatches": 50,
    "compatibilityInsights": "full",
    "conversationStarters": true,
    "searchCapability": true,
    "likeVisibility": true
  },
  "startDate": "2025-04-03T19:30:00Z",
  "endDate": "2025-05-03T19:30:00Z",
  "status": "active",
  "paymentStatus": "succeeded",
  "nextBillingDate": "2025-05-03T19:30:00Z"
}
```

#### Cancel Subscription

```
PUT /v1/subscription/cancel
```

Response (200 OK):
```json
{
  "subscriptionId": "sub-456",
  "planType": "premium",
  "status": "active",
  "endDate": "2025-05-03T19:30:00Z",
  "cancelledAt": "2025-04-03T19:35:00Z",
  "willDowngradeTo": "free"
}
```

#### Update Payment Method

```
PUT /v1/subscription/payment-method
```

Request body:
```json
{
  "paymentMethodId": "pm_987654321"
}
```

Response (200 OK):
```json
{
  "subscriptionId": "sub-456",
  "paymentMethodUpdated": true,
  "updatedAt": "2025-04-03T19:40:00Z"
}
```

## WebSocket API

In addition to RESTful endpoints, the application uses WebSockets for real-time functionality.

### Connection

```
wss://api.perfect-match.com/v1/ws?token={access_token}
```

### Message Types

#### Server to Client

1. **newMessage**:
```json
{
  "type": "newMessage",
  "data": {
    "conversationId": "conversation-123",
    "messageId": "message-6",
    "senderId": "567e4321-e89b-12d3-a456-426614174000",
    "senderName": "Jane",
    "messageType": "text",
    "content": "Saturday morning works perfectly!",
    "sentAt": "2025-04-03T19:45:00Z"
  }
}
```

2. **messageRead**:
```json
{
  "type": "messageRead",
  "data": {
    "conversationId": "conversation-123",
    "messageIds": ["message-3", "message-4"],
    "readBy": "567e4321-e89b-12d3-a456-426614174000",
    "readAt": "2025-04-03T19:50:00Z"
  }
}
```

3. **messageReaction**:
```json
{
  "type": "messageReaction",
  "data": {
    "conversationId": "conversation-123",
    "messageId": "message-4",
    "reaction": "❤️",
    "userId": "567e4321-e89b-12d3-a456-426614174000",
    "createdAt": "2025-04-03T19:55:00Z"
  }
}
```

4. **newMatch**:
```json
{
  "type": "newMatch",
  "data": {
    "matchId": "match-125",
    "userId": "123e4567-e89b-12d3-a456-426614174001",
    "firstName": "Sarah",
    "compatibilityScore": 91,
    "createdAt": "2025-04-03T20:00:00Z"
  }
}
```

5. **matchLike**:
```json
{
  "type": "matchLike",
  "data": {
    "matchId": "match-124",
    "userId": "987e6543-e89b-12d3-a456-426614174000",
    "mutual": true,
    "conversationEnabled": true,
    "conversationId": "conversation-124"
  }
}
```

#### Client to Server

1. **subscribeToConversation**:
```json
{
  "type": "subscribeToConversation",
  "data": {
    "conversationId": "conversation-123"
  }
}
```

2. **unsubscribeFromConversation**:
```json
{
  "type": "unsubscribeFromConversation",
  "data": {
    "conversationId": "conversation-123"
  }
}
```

3. **typing**:
```json
{
  "type": "typing",
  "data": {
    "conversationId": "conversation-123",
    "isTyping": true
  }
}
```

## OpenAPI Specification

The complete API is documented using OpenAPI (Swagger) specification, available at:

```
https://api.perfect-match.com/v1/docs
```

## Security Considerations

### JWT Protection

- Access tokens expire after 1 hour
- Refresh tokens expire after 30 days
- Tokens are signed using RS256 algorithm
- Tokens include user ID, roles, and permissions

### API Security Best Practices

1. **HTTPS Only**: All API communication requires HTTPS
2. **CSRF Protection**: Implemented for browser-based clients
3. **Content Security Policy**: Strict CSP headers used
4. **API Keys**: Required for third-party integrations
5. **Audit Logging**: All authentication events and sensitive operations are logged

### Rate Limiting Tiers

| Operation | Free Tier | Premium Tier |
|-----------|-----------|--------------|
| Authentication | 10/min | 10/min |
| Profile Operations | 30/min | 60/min |
| Match Retrieval | 30/min | 60/min |
| Messaging | 60/min | 120/min |
| Search | N/A | 30/min |

### Access Control Matrix

| Resource | Anonymous | Free User | Premium User | Admin |
|----------|-----------|-----------|--------------|-------|
| Register/Login | ✅ | ✅ | ✅ | ✅ |
| View Own Profile | ❌ | ✅ | ✅ | ✅ |
| Edit Own Profile | ❌ | ✅ | ✅ | ✅ |
| View Limited Matches | ❌ | ✅ | ✅ | ✅ |
| View All Matches | ❌ | ❌ | ✅ | ✅ |
| View Basic Insights | ❌ | ✅ | ✅ | ✅ |
| View Detailed Insights | ❌ | ❌ | ✅ | ✅ |
| Search Users | ❌ | ❌ | ✅ | ✅ |
| Message Matches | ❌ | ✅ | ✅ | ✅ |
| Get Conversation Starters | ❌ | ❌ | ✅ | ✅ |
| View Who Liked Profile | ❌ | ❌ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ❌ | ✅ |

## API Versioning Strategy

The API uses URL-based versioning (`/v1/`) to ensure backward compatibility as the API evolves:

1. **Major Versions**: Incompatible API changes (/v2/, /v3/)
2. **Minor Versions**: Backward-compatible additions (described in documentation)
3. **Deprecation Process**:
   - Endpoints marked as deprecated with warning headers
   - 6-month grace period before removal
   - Migration guides provided for major version changes
