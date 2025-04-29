# Perfect Match: Technical Decisions

This document tracks key technical decisions made during the development of the Perfect Match application, including the reasoning behind these choices, alternatives considered, and potential implications.

## Authentication System

**Decision**: Use AWS Cognito for user authentication with a local database record for application-specific user data.

**Date**: 2025-04-09

**Context**:
- We needed a secure, scalable authentication system that handles user sign-up, sign-in, and profile management
- Integration with social login providers was a requirement for the future
- Multi-factor authentication (MFA) support is important for security
- Maintaining local user records is necessary for application-specific attributes and relationships

**Alternatives Considered**:
1. **Custom Authentication System**: Building our own authentication system from scratch
   - Pros: Complete control over user experience and data
   - Cons: Security risks, maintenance burden, time-consuming development
   
2. **Firebase Authentication**:
   - Pros: Easy integration, social provider support, good developer experience
   - Cons: Less flexibility with AWS ecosystem, potential vendor lock-in
   
3. **Auth0**:
   - Pros: Feature-rich, excellent developer experience, enterprise-grade
   - Cons: Cost concerns at scale, separate from our AWS infrastructure

**Decision Rationale**:
- AWS Cognito integrates seamlessly with our AWS-based infrastructure
- Provides enterprise-grade security with NIST-compliant password policies
- Supports social logins, MFA, and custom authentication flows
- Reduces development time and security risks
- Allows us to maintain local user records for application-specific functionality
- Cost-effective for our projected user base

**Implementation Details**:
- Created a dual-system approach where Cognito handles authentication and our database stores user profiles
- Implemented OAuth2 flow with the Cognito hosted UI for a seamless experience
- Generate local JWTs for API access after Cognito authentication
- Structured to support future social login integration

**Implications**:
- Development time reduction for authentication features
- Enhanced security compliance out-of-the-box
- Requires synchronization between Cognito and local database
- May need custom flows for unique authentication requirements

## Profile Management System

**Decision**: Implement a comprehensive profile entity with rich attributes, preferences, and personal details.

**Date**: 2025-04-09

**Context**:
- User profiles are central to the matchmaking functionality
- Need to capture diverse personal attributes for effective matching
- Profile creation needs to be engaging yet thorough
- Photo management is essential for dating applications
- Profile completion tracking is important for user onboarding

**Alternatives Considered**:
1. **Minimal Profile Approach**:
   - Pros: Faster onboarding, less user friction
   - Cons: Limited matching data, less personalization, lower quality matches
   
2. **Progressive Profile Enhancement**:
   - Pros: Start with minimal information and gradually collect more over time
   - Cons: Potential for incomplete profiles, inconsistent matching quality, complex state management
   
3. **Third-party Profile Management Service**:
   - Pros: Reduced development time, specialized features
   - Cons: Less control, potential integration issues, additional costs

**Decision Rationale**:
- Comprehensive profiles provide better data for matching algorithms
- Rich profile data enables more nuanced compatibility assessments
- Structured approach with required and optional fields balances completeness with flexibility
- Self-contained profile management allows for better control over user experience
- Tracking completion status motivates users to provide complete information

**Implementation Details**:
- Created a robust ProfileEntity with basic information, preferences, and attributes
- Implemented photo management with main photo designation
- Built profile completion tracking to guide users and inform the system
- Designed RESTful API endpoints for all profile operations
- Implemented validation to ensure data quality
- Created utilities for age calculation, photo management, and other common operations

**Implications**:
- Comprehensive profiles may increase initial user friction but lead to better matches
- Photo management requires additional infrastructure for storage and delivery
- Profile completion tracking enables guided onboarding journeys
- Rich profile data provides foundation for sophisticated matching algorithms
- May require optimization for performance as user base grows

## Database Strategy

**Decision**: Use a hybrid database approach with PostgreSQL for structured data and MongoDB for flexible schema data.

**Date**: 2025-04-03

**Context**:
- We needed to store different types of data with varying structure requirements
- User profiles and relationships need strict schema enforcement and foreign key constraints
- Questionnaire responses can vary widely in structure based on question types and adaptive flows
- Performance for complex matching queries is important

**Alternatives Considered**:
1. **PostgreSQL Only**:
   - Pros: Mature, reliable, strong consistency, ACID compliance
   - Cons: Less flexibility for schema variations, more complex for document-like data
   
2. **MongoDB Only**:
   - Pros: Schema flexibility, document-oriented for questionnaire data
   - Cons: Less suitable for relational data and complex joins, eventual consistency
   
3. **DynamoDB**:
   - Pros: Highly scalable, managed AWS service, predictable performance
   - Cons: Rigid query patterns, eventual consistency, complex for relational data

**Decision Rationale**:
- PostgreSQL provides strong relational capabilities for user profiles, matches, and core entities
- MongoDB offers flexibility for questionnaire responses that follow an adaptive path
- Combined approach leverages strengths of both systems
- Allows optimization of query patterns for different data access needs

**Implementation Details**:
- PostgreSQL stores user profiles, basic account information, and relationships
- MongoDB stores questionnaire responses and other schema-flexible content
- Services maintain data consistency between systems where necessary

**Implications**:
- Added complexity in maintaining two database systems
- Need for careful transaction handling across database boundaries
- Enables optimal data storage and retrieval for different data types
- Potentially higher hosting costs, but improved performance and flexibility

## Frontend Framework

**Decision**: Use Next.js with Material UI for the frontend.

**Date**: 2025-04-03

**Context**:
- We needed a modern, performant frontend framework with good SEO capabilities
- Component reusability and developer experience were priorities
- Server-side rendering capabilities would be beneficial for initial page loads
- UI consistency and modern design were important requirements

**Alternatives Considered**:
1. **React with Create React App**:
   - Pros: Familiar, large ecosystem, simpler setup
   - Cons: No built-in SSR, requires additional routing setup
   
2. **Vue.js**:
   - Pros: Gentle learning curve, good performance, nice developer experience
   - Cons: Smaller ecosystem than React, less enterprise adoption
   
3. **Angular**:
   - Pros: Full-featured framework, enterprise support
   - Cons: Steeper learning curve, potentially excessive for our needs

**Decision Rationale**:
- Next.js provides React-based development with built-in routing
- Server-side rendering improves SEO and initial load performance
- Material UI offers a comprehensive component library with modern design
- Strong community support and documentation for both technologies
- Ability to deploy as static site or server-rendered application

**Implications**:
- Enables rapid development with pre-built components
- May require performance optimization for complex UI interactions
- Provides a solid foundation for future growth and features

## AI-Powered Matching Algorithm

**Decision**: Implement AI-based compatibility analysis using OpenAI GPT-4.1 with vector similarity pre-filtering.

**Date**: 2025-04-15

**Context**:
- We needed a sophisticated matching algorithm that goes beyond simple attribute matching
- The system should provide detailed compatibility insights, not just scores
- Performance and cost must be balanced with match quality
- Fallback mechanisms are essential for API unavailability
- Match quality is a key differentiator for our platform

**Alternatives Considered**:
1. **Traditional Rule-Based Matching**:
   - Pros: Predictable, explainable, lower operational costs
   - Cons: Less nuanced, requires manual rule creation, limited insight generation
   
2. **Machine Learning Model (Custom Trained)**:
   - Pros: Optimized for our specific use case, one-time training cost
   - Cons: Requires large training dataset, complex to maintain, less flexible for new patterns
   
3. **Vector Similarity Only**:
   - Pros: Computationally efficient, predictable, lower operational costs
   - Cons: Less nuanced than LLM analysis, limited insight generation, more basic compatibility assessment

**Decision Rationale**:
- OpenAI's GPT-4.1 provides sophisticated natural language understanding to analyze compatibility
- The model can understand complex relationship dynamics not easily captured by traditional algorithms
- API-based approach allows us to leverage cutting-edge AI without managing ML infrastructure
- Vector similarity pre-filtering balances performance and cost by reducing API calls
- Combined approach provides both efficiency and high-quality matches

**Implementation Details**:
- Implemented a tiered matching system:
  1. Initial filtering based on basic criteria (location, age preferences)
  2. Vector similarity pre-filtering to identify promising candidates
  3. OpenAI GPT-4.1 analysis for detailed compatibility assessment
  4. DeepSeek as a fallback AI provider for service reliability
- Created a structured prompt system for consistent and specific compatibility analysis
- Implemented compatibility scoring that weights factors based on user preferences
- Designed detailed compatibility insights with premium content for paid users
- Added caching and batch processing for cost optimization

**Implications**:
- Enhanced match quality and user satisfaction with sophisticated compatibility assessment
- API-based approach introduces external dependencies and operational costs
- Multi-tiered approach with fallbacks improves system resilience
- Premium insights provide monetization opportunities
- Requires careful monitoring of API usage and costs
