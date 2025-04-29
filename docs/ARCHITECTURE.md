# Perfect Match: Technical Architecture

This document outlines the complete technical architecture for the Perfect Match application, including system components, interactions, data flows, technology choices, and implementation considerations.

```yaml
# ARCHITECTURE_CONTEXT
architecture_type: "Cloud-native microservices"
primary_cloud: "AWS"
api_approach: "RESTful with some real-time capabilities"
deployment_model: "Containerized microservices"
data_storage: "Hybrid (relational + document + cache)"
```

## System Overview

Perfect Match follows a microservices architecture deployed on AWS, with a clear separation between frontend and backend services.

```mermaid
graph TB
    subgraph "Frontend"
        WebApp["Web Application (React/Next.js)"]
        MobileView["Mobile-Optimized View (PWA)"]
    end
    
    subgraph "Backend Services"
        AuthService["Authentication Service"]
        ProfileService["Profile Management Service"]
        QuestService["Questionnaire Engine"]
        MatchService["AI Matching Service"]
        ChatService["Messaging Service"]
        NotifService["Notification Service"]
        SubscriptionService["Subscription Management"]
    end
    
    subgraph "Data Layer"
        RDS[("PostgreSQL (RDS)\nUser Profiles, Auth, Subscriptions")]
        DocumentDB[("MongoDB (DocumentDB)\nQuestionnaire Responses")]
        Redis["Redis Cache\nSession, Matches"]
        S3["S3\nMedia Storage"]
    end
    
    subgraph "AI Integration"
        OpenAI["OpenAI GPT-4 API"]
        DeepSeek["DeepSeek API (Fallback)"]
        EmbeddingService["Embedding Service"]
    end
    
    subgraph "AWS Infrastructure"
        ECS["ECS/Fargate"]
        Lambda["Lambda Functions"]
        Gateway["API Gateway"]
        CloudFront["CloudFront CDN"]
        SQS["SQS Queue"]
        SNS["SNS Topics"]
        Cognito["Cognito"]
    end
    
    %% Connections
    WebApp <--> Gateway
    MobileView <--> Gateway
    Gateway <--> AuthService
    Gateway <--> ProfileService
    Gateway <--> QuestService
    Gateway <--> MatchService
    Gateway <--> ChatService
    Gateway <--> NotifService
    Gateway <--> SubscriptionService
    
    AuthService <--> Cognito
    AuthService <--> RDS
    ProfileService <--> RDS
    ProfileService <--> S3
    QuestService <--> DocumentDB
    QuestService <--> RDS
    MatchService <--> OpenAI
    MatchService <--> DeepSeek
    MatchService <--> DocumentDB
    MatchService <--> RDS
    MatchService <--> Redis
    MatchService <--> EmbeddingService
    ChatService <--> RDS
    ChatService <--> DocumentDB
    NotifService <--> SNS
    SubscriptionService <--> RDS
    
    %% AWS Infrastructure connections
    AuthService --- ECS
    ProfileService --- ECS
    QuestService --- ECS
    MatchService --- Lambda
    ChatService --- ECS
    NotifService --- Lambda
    SubscriptionService --- ECS
```

## Technology Stack

### Frontend
- **Framework**: React.js with Next.js
  - **Rationale**: Server-side rendering for SEO, improved performance, and optimized loading times
- **Mobile Strategy**: Progressive Web App (PWA)
  - **Rationale**: Single codebase that works well on both web and mobile devices
- **UI Framework**: Tailwind CSS
  - **Rationale**: Highly customizable, mobile-responsive design system
- **State Management**: Redux Toolkit with RTK Query
  - **Rationale**: Simplified Redux experience with built-in API fetching capabilities
- **Real-time Communication**: Socket.IO
  - **Rationale**: Reliable WebSocket implementation for chat features
- **Build/Bundling**: Webpack, configured via Next.js
- **Testing**: Jest, React Testing Library

### Backend
- **API Framework**: Node.js with NestJS
  - **Rationale**: TypeScript-first framework with built-in dependency injection and modularity
- **API Style**: RESTful APIs with OpenAPI/Swagger documentation
- **Authentication**: JWT-based with refresh tokens, integrated with AWS Cognito
- **Real-time**: Socket.IO for chat functionality
- **Testing**: Jest, Supertest

### Databases
- **Primary Database**: PostgreSQL (AWS RDS)
  - **Use Cases**: User profiles, authentication data, subscriptions, relationships, metadata
  - **Rationale**: ACID compliance, relational integrity for structured data
- **Document Database**: MongoDB (AWS DocumentDB)
  - **Use Cases**: Questionnaire responses, chat messages, AI-generated insights
  - **Rationale**: Flexible schema for varied question types and formats
- **Vector Storage**: MongoDB with vector search capabilities
  - **Use Cases**: Storing and searching embeddings for efficient similarity matching
- **Caching Layer**: Redis (AWS ElastiCache)
  - **Use Cases**: Session management, match results caching, rate limiting
  - **Rationale**: High-performance, in-memory storage for frequent read operations
- **Media Storage**: AWS S3
  - **Use Cases**: Profile photos and media attachments

### AI Integration
- **Primary**: OpenAI GPT-4 API
  - **Use Cases**: Match analysis, compatibility scoring, conversation starters
- **Secondary/Fallback**: DeepSeek API
  - **Use Cases**: Fallback when primary API has issues or rate limits are reached
- **Embedding Generation**: OpenAI embedding API or local embedding service
  - **Use Cases**: Converting text responses to vector representations

### AWS Services
- **Compute**:
  - ECS with Fargate for main services
  - Lambda for event-driven processing
- **Database**:
  - RDS for PostgreSQL
  - DocumentDB for MongoDB
  - ElastiCache for Redis
- **Storage**:
  - S3 for profile photos and media
- **Content Delivery**:
  - CloudFront for static assets
- **API Management**:
  - API Gateway with custom authorizers
- **Messaging & Queues**:
  - SQS for asynchronous tasks
  - SNS for notifications
- **Identity & Access**:
  - Cognito for user pool management
  - IAM for service permissions
- **Networking**:
  - VPC with private subnets
  - Security Groups
- **Monitoring & Logging**:
  - CloudWatch for logs and metrics
  - X-Ray for distributed tracing
- **Security**:
  - WAF for application protection
  - Shield for DDoS protection
  - KMS for encryption

### DevOps & CI/CD
- **Infrastructure as Code**: AWS CDK (TypeScript)
- **CI/CD Pipeline**: AWS CodePipeline with GitHub integration
- **Containerization**: Docker
- **Monitoring**: CloudWatch dashboards and alarms

## Service Architecture Details

### 1. Authentication Service

```mermaid
graph TD
    User[User] --> |1. Register/Login| AuthAPI[Auth API]
    AuthAPI --> |2. Validate| Cognito[AWS Cognito]
    Cognito --> |3. Generate Tokens| AuthAPI
    AuthAPI --> |4. Store User| UserDB[(User Database)]
    AuthAPI --> |5. Return Tokens| User
    
    User --> |6. Use Access Token| API[Protected APIs]
    API --> |7. Validate Token| AuthAPI
    User --> |8. Refresh| AuthAPI
    AuthAPI --> |9. Generate New Tokens| User
```

Key Components:
- User registration and login flows
- Social login integration (Google, Facebook, Apple)
- JWT token generation and validation
- Refresh token rotation
- Email verification
- Password reset functionality
- Integration with AWS Cognito for identity management

### 2. Profile Management Service

```mermaid
graph TD
    User[User] --> |1. Create/Update Profile| ProfileAPI[Profile API]
    ProfileAPI --> |2. Store Profile Data| ProfileDB[(Profile Database)]
    User --> |3. Upload Media| ProfileAPI
    ProfileAPI --> |4. Store Media| S3[S3 Bucket]
    User --> |5. Get Profile| ProfileAPI
    ProfileAPI --> |6. Retrieve Profile| ProfileDB
    ProfileAPI --> |7. Get Media URLs| S3
    ProfileAPI --> |8. Return Complete Profile| User
```

Key Components:
- Profile CRUD operations
- Media upload and management
- Profile completion tracking
- Privacy settings management
- Profile verification status
- Profile search capabilities (for premium users)

### 3. Questionnaire Engine

```mermaid
graph TD
    User[User] --> |1. Start Questionnaire| QuestAPI[Questionnaire API]
    QuestAPI --> |2. Get Initial Questions| QuestDB[(Question Database)]
    QuestAPI --> |3. Return Questions| User
    User --> |4. Submit Answer| QuestAPI
    QuestAPI --> |5. Store Answer| ResponseDB[(Response Database)]
    QuestAPI --> |6. Get Next Questions| BranchingLogic[Branching Logic Engine]
    BranchingLogic --> |7. Determine Next Questions| QuestDB
    QuestAPI --> |8. Return Next Questions| User
    
    QuestAPI --> |9. Complete Questionnaire| ProfileService[Profile Service]
    QuestAPI --> |10. Store Responses| VectorDB[(Vector Database)]
```

Key Components:
- Question bank management
- Dynamic branching logic implementation
- Progress tracking
- Adaptive questioning based on previous answers
- Response storage and analysis
- Question block/module organization
- Question importance weighting

### 4. AI Matching Service

```mermaid
graph TD
    BatchTrigger[Daily Batch Trigger] --> |1. Start Daily Matching| MatchingService[Matching Service]
    MatchingService --> |2. Get Profiles| ProfileDB[(Profile Database)]
    MatchingService --> |3. Get Responses| ResponseDB[(Response Database)]
    MatchingService --> |4. Pre-filter by Basic Criteria| FilteringLogic[Filtering Logic]
    
    MatchingService --> |5. Prepare Data for AI| DataPrep[Data Preparation]
    DataPrep --> |6. Send to AI| OpenAI[OpenAI GPT-4]
    OpenAI --> |7. Return Compatibility Analysis| MatchingService
    
    MatchingService --> |8a. Store Match Results| MatchDB[(Match Database)]
    MatchingService --> |8b. Cache Results| Redis[(Redis Cache)]
    MatchingService --> |9. Store Compatibility Insights| InsightDB[(Insight Database)]
    
    NotificationService[Notification Service] --> |10. Send Match Notifications| Users[Users]
```

Key Components:
- Daily batch processing of matches
- AI integration for compatibility analysis
- Vector embedding-based similarity matching
- Compatibility score calculation
- Match insight generation
- Caching of match results
- Differentiated matching for free vs. premium users

### 5. Messaging Service

```mermaid
graph TD
    User1[User 1] --> |1. Send Message| ChatAPI[Chat API]
    ChatAPI --> |2. Store Message| MessageDB[(Message Database)]
    ChatAPI --> |3. Emit Event| SocketServer[Socket.IO Server]
    SocketServer --> |4. Real-time Notification| User2[User 2]
    
    User2 --> |5. Get Messages| ChatAPI
    ChatAPI --> |6. Retrieve Messages| MessageDB
    ChatAPI --> |7. Return Messages| User2
    
    User2 --> |8. Send Reaction| ChatAPI
    ChatAPI --> |9. Store Reaction| MessageDB
    SocketServer --> |10. Real-time Update| User1
    
    PremiumUser[Premium User] --> |11. Request Starters| ChatAPI
    ChatAPI --> |12. Generate Starters| AIService[AI Service]
    AIService --> |13. Return Suggestions| ChatAPI
    ChatAPI --> |14. Present Starters| PremiumUser
```

Key Components:
- Real-time messaging using WebSockets
- Message history storage and retrieval
- Message read status tracking
- Media (photo) sharing
- Message reactions/emoji responses
- AI-generated conversation starters (premium feature)
- Message retention policy implementation

### 6. Notification Service

```mermaid
graph TD
    EventSources[Event Sources] --> |1. Generate Event| EventBus[Event Bus]
    EventBus --> |2. Trigger Notification| NotifService[Notification Service]
    NotifService --> |3a. Store Notification| NotifDB[(Notification Database)]
    NotifService --> |3b. Push Notification| SNS[AWS SNS]
    SNS --> |4. Send Push| PushService[Push Gateway]
    PushService --> |5. Deliver Notification| UserDevices[User Devices]
    
    User[User] --> |6. Get Notifications| NotifAPI[Notification API]
    NotifAPI --> |7. Retrieve Notifications| NotifDB
    NotifAPI --> |8. Return Notifications| User
    User --> |9. Mark as Read| NotifAPI
    NotifAPI --> |10. Update Status| NotifDB
```

Key Components:
- Event-driven notification generation
- Push notification delivery
- In-app notification center
- Notification preferences management
- Notification status tracking (read/unread)
- Batch notification processing

### 7. Subscription Management

```mermaid
graph TD
    User[User] --> |1. Subscribe| SubAPI[Subscription API]
    SubAPI --> |2. Process Payment| StripeAPI[Stripe API]
    StripeAPI --> |3. Confirm Payment| SubAPI
    SubAPI --> |4. Update Subscription Status| SubDB[(Subscription Database)]
    SubAPI --> |5. Update User Permissions| AuthService[Auth Service]
    AuthService --> |6. Unlock Premium Features| User
    
    ScheduledJob[Scheduled Job] --> |7. Check Expiring Subscriptions| SubAPI
    SubAPI --> |8. Process Renewals| StripeAPI
    SubAPI --> |9. Update Subscription Status| SubDB
    SubAPI --> |10. Send Renewal Notification| NotifService[Notification Service]
```

Key Components:
- Subscription plan management
- Payment processing integration (Stripe)
- Feature access control based on subscription tier
- Subscription analytics
- Renewal and cancellation handling
- Subscription-related notifications

## Data Flows

### User Registration & Profile Creation

```mermaid
sequenceDiagram
    actor User
    participant AuthService
    participant Cognito
    participant ProfileService
    participant QuestService
    participant AIService
    
    User->>AuthService: Register (email/password or social)
    AuthService->>Cognito: Create user
    Cognito-->>AuthService: User created
    AuthService->>ProfileService: Initialize basic profile
    ProfileService-->>User: Profile created
    
    User->>ProfileService: Add basic info (photos, bio)
    ProfileService-->>User: Profile updated
    
    User->>QuestService: Start questionnaire
    QuestService-->>User: Initial questions
    
    loop Questionnaire Flow
        User->>QuestService: Submit answer
        QuestService->>QuestService: Apply branching logic
        QuestService-->>User: Next questions
    end
    
    QuestService->>AIService: Generate profile analysis
    AIService-->>QuestService: Profile insights
    QuestService->>ProfileService: Update profile completion
    ProfileService-->>User: Profile completed
```

### Match Generation Process

```mermaid
sequenceDiagram
    participant ScheduledTask
    participant MatchService
    participant ProfileService
    participant QuestService
    participant AIService
    participant NotifService
    
    ScheduledTask->>MatchService: Trigger daily match processing
    MatchService->>ProfileService: Get active profiles
    ProfileService-->>MatchService: Profile data
    
    MatchService->>QuestService: Get questionnaire responses
    QuestService-->>MatchService: Response data
    
    MatchService->>MatchService: Pre-filter candidates
    
    loop For each potential match pair
        MatchService->>AIService: Calculate compatibility
        AIService-->>MatchService: Compatibility score & insights
    end
    
    MatchService->>MatchService: Store match results
    MatchService->>NotifService: Trigger match notifications
    NotifService-->>User: New match notification
```

### Messaging Flow

```mermaid
sequenceDiagram
    actor User1
    actor User2
    participant ChatService
    participant SocketService
    participant AIService
    
    User1->>ChatService: Open conversation with match
    ChatService-->>User1: Conversation history
    
    alt Premium User
        User1->>ChatService: Request conversation starters
        ChatService->>AIService: Generate starters based on compatibility
        AIService-->>ChatService: Conversation suggestions
        ChatService-->>User1: Display conversation starters
    end
    
    User1->>ChatService: Send message
    ChatService->>SocketService: Emit message event
    SocketService-->>User2: Real-time message delivery
    
    User2->>ChatService: Read message
    ChatService->>ChatService: Update read status
    ChatService->>SocketService: Emit read receipt
    SocketService-->>User1: Display read receipt
    
    User2->>ChatService: Send reaction
    ChatService->>SocketService: Emit reaction event
    SocketService-->>User1: Display reaction
```

## Infrastructure Architecture

The infrastructure is based on AWS services, implemented using infrastructure as code with AWS CDK.

```mermaid
graph TB
    subgraph "Public Internet"
        Users[Users]
    end
    
    subgraph "AWS Global"
        CloudFront[CloudFront]
        WAF[AWS WAF]
    end
    
    subgraph "AWS Region"
        subgraph "Public Subnet"
            ALB[Application Load Balancer]
            ApiGateway[API Gateway]
        end
        
        subgraph "Private Subnet"
            ECS[ECS Fargate Tasks]
            Lambda[Lambda Functions]
        end
        
        subgraph "Data Subnet"
            RDS[PostgreSQL RDS]
            DocumentDB[MongoDB DocumentDB]
            ElastiCache[Redis ElastiCache]
        end
        
        subgraph "AWS Services"
            S3[S3 Buckets]
            Cognito[Cognito]
            SQS[SQS Queues]
            SNS[SNS Topics]
            CloudWatch[CloudWatch]
        end
    end
    
    Users --> CloudFront
    CloudFront --> WAF
    WAF --> ALB
    WAF --> ApiGateway
    
    ALB --> ECS
    ApiGateway --> Lambda
    ApiGateway --> ECS
    
    ECS --> RDS
    ECS --> DocumentDB
    ECS --> ElastiCache
    
    Lambda --> RDS
    Lambda --> DocumentDB
    Lambda --> ElastiCache
    
    ECS --> S3
    ECS --> Cognito
    ECS --> SQS
    ECS --> SNS
    
    Lambda --> S3
    Lambda --> Cognito
    Lambda --> SQS
    Lambda --> SNS
    
    ECS --> CloudWatch
    Lambda --> CloudWatch
```

### Key Infrastructure Components:

1. **Networking**:
   - VPC with public and private subnets across multiple availability zones
   - NAT Gateways for outbound traffic from private subnets
   - Security Groups for service-level network access control

2. **Compute**:
   - ECS Fargate for containerized microservices
   - Lambda for event-driven processing and scheduled tasks

3. **Data Storage**:
   - Multi-AZ RDS for PostgreSQL (primary relational data)
   - DocumentDB cluster for MongoDB (flexible schema data)
   - ElastiCache Redis cluster for caching and session management
   - S3 buckets for media storage and static assets

4. **API Management**:
   - API Gateway for RESTful API endpoints
   - Application Load Balancer for service routing

5. **Security**:
   - WAF for application-layer protection
   - Security Groups for service-level access control
   - IAM Roles for service permissions
   - Cognito for user authentication
   - KMS for encryption

6. **Monitoring & Operations**:
   - CloudWatch for logs and metrics
   - X-Ray for distributed tracing
   - CloudWatch Alarms for alerting
   - CloudWatch Dashboards for operational visibility

## Deployment Strategy

The application follows a CI/CD approach with AWS CodePipeline:

```mermaid
graph LR
    Dev[Developer] --> |Commit| GitHub[GitHub Repository]
    GitHub --> |Trigger| CodePipeline[AWS CodePipeline]
    
    subgraph "CI/CD Pipeline"
        CodePipeline --> Source[Source Stage]
        Source --> Build[Build Stage]
        Build --> Test[Test Stage]
        Test --> Deploy[Deploy Stage]
    end
    
    Build --> |Create Docker Images| ECR[ECR Repository]
    Build --> |Generate CDK CloudFormation| S3[S3 Artifacts]
    
    Deploy --> |Update ECS Services| ECS[ECS Clusters]
    Deploy --> |Deploy Lambda Functions| Lambda[Lambda Functions]
    Deploy --> |Update Infrastructure| CloudFormation[CloudFormation Stacks]
```

### Deployment Stages:

1. **Development**:
   - Local development with Docker Compose
   - Development environment for feature testing

2. **Staging**:
   - Fully automated deployment
   - Integration testing
   - Performance testing
   - Security testing

3. **Production**:
   - Blue/Green deployment strategy
   - Automated rollback capability
   - Canary releases for critical components

## Scalability Considerations

- **Horizontal Scaling**:
  - ECS services can scale based on CPU/Memory utilization
  - DynamoDB on-demand capacity for unpredictable workloads
  - Auto-scaling for RDS read replicas

- **Caching Strategy**:
  - ElastiCache Redis for frequently accessed data
  - CloudFront for static content
  - API response caching

- **Database Optimization**:
  - Read replicas for read-heavy operations
  - Connection pooling
  - Index optimization
  - Query performance monitoring

- **Batch Processing**:
  - Daily match processing using Lambda
  - SQS queues for asynchronous task handling
  - Retry mechanisms for failed operations

## Security Architecture

- **Authentication & Authorization**:
  - Cognito for identity management
  - JWT for API authorization
  - Fine-grained permissions based on subscription tier

- **Data Protection**:
  - Encryption at rest for all databases
  - Encryption in transit (TLS)
  - Secure API communication

- **Network Security**:
  - VPC with private subnets for data services
  - Security Groups for granular access control
  - WAF for application-layer protection

- **Compliance**:
  - Logging of all administrative actions
  - Audit trails for sensitive operations
  - Regular security scanning

## Development Approach

- **Code Quality**:
  - TypeScript for type safety
  - ESLint for code quality
  - Prettier for consistent formatting
  - Unit and integration testing requirements

- **Development Environment**:
  - Containerized development with Docker
  - Local environment setup with docker-compose
  - Environment parity across development, staging, and production

- **Documentation**:
  - OpenAPI/Swagger for API documentation
  - README files for each microservice
  - Architecture decision records (ADRs)
  - Infrastructure documentation via AWS CDK

## Technical Debt Management

- Prioritize technical debt alongside feature development
- Regular refactoring sprints
- Code quality metrics tracking
- Architecture reviews
