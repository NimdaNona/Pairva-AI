# Perfect Match

[![Status](https://img.shields.io/badge/Status-Planning-blue)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)]()

An AI-powered matchmaking application designed to help users find their ideal partner through comprehensive compatibility analysis.

## Project Overview

Perfect Match is a next-generation dating and matchmaking application that leverages artificial intelligence to analyze user profiles and identify compatible partners based on personality traits, values, communication styles, and relationship preferences. The platform uses a dynamic, adaptive questionnaire and OpenAI's GPT-4 to provide personalized match recommendations with detailed compatibility insights.

### Key Features

- **Dynamic Adaptive Questionnaire**: Personalized question flow that adapts based on user responses
- **AI-Powered Matching**: Advanced compatibility analysis using GPT-4
- **Detailed Compatibility Insights**: Clear explanations of why users match
- **Real-time Messaging**: Integrated chat with conversation starters
- **Premium Subscription**: Enhanced features for serious relationship-seekers

## Project Status

The project is currently in the **planning phase**. We are developing detailed technical documentation and preparing for the initial implementation. Key architectural decisions have been made, and we are finalizing the technical roadmap.

## Repository Structure

### Project Documentation

- [**PROJECT.md**](docs/PROJECT.md): Comprehensive project overview, requirements, and goals
- [**ARCHITECTURE.md**](docs/ARCHITECTURE.md): System architecture, components, and technology choices
- [**DATA_MODEL.md**](docs/DATA_MODEL.md): Database schema and entity relationships
- [**API_DESIGN.md**](docs/API_DESIGN.md): API specifications and endpoint documentation
- [**WORKFLOWS.md**](docs/WORKFLOWS.md): Key business processes and user journeys

### Development Documentation

- [**PROGRESS.md**](src/_docs/PROGRESS.md): Current implementation status and next steps
- [**ACTIVE_DEVELOPMENT.md**](src/_docs/ACTIVE_DEVELOPMENT.md): Work-in-progress notes and immediate focus
- [**DECISIONS.md**](src/_docs/DECISIONS.md): Technical decision records and rationale
- [**LEARNINGS.md**](src/_docs/LEARNINGS.md): Insights, lessons learned, and best practices

### Module Documentation

- [**AUTH_SERVICE.md**](docs/modules/AUTH_SERVICE.md): Authentication and authorization service
- [**QUESTIONNAIRE_ENGINE.md**](docs/modules/QUESTIONNAIRE_ENGINE.md): Dynamic questionnaire system
- [**AI_MATCHING_SERVICE.md**](docs/modules/AI_MATCHING_SERVICE.md): AI-powered matching engine

## Technology Stack

### Frontend
- **Framework**: React.js with Next.js
- **Mobile Strategy**: Progressive Web App (PWA)
- **UI Framework**: Tailwind CSS
- **State Management**: Redux Toolkit with RTK Query

### Backend
- **API Framework**: Node.js with NestJS
- **Authentication**: JWT with AWS Cognito
- **Databases**: 
  - PostgreSQL for structured data
  - MongoDB for flexible schema data
  - Redis for caching
- **AI Integration**: OpenAI GPT-4 API with DeepSeek fallback

### Infrastructure
- **Cloud Provider**: AWS
- **Deployment**: Containerized microservices on ECS/Fargate
- **Infrastructure as Code**: AWS CDK
- **CI/CD**: AWS CodePipeline

## Getting Started

> ⚠️ **Note**: The project is in planning phase and not yet ready for development.

Instructions for setting up the development environment will be provided once the project moves to the implementation phase.

## Roadmap

1. **Foundation Phase** (4-6 weeks)
   - Infrastructure setup
   - Authentication service
   - Core database schema
   - Basic profile management

2. **Core Features Phase** (4-6 weeks)
   - Questionnaire engine
   - AI integration
   - Basic matching algorithm
   - Frontend for auth, profile, and questionnaire

3. **Advanced Features Phase** (4-6 weeks)
   - Messaging system
   - Subscription management
   - Advanced match insights
   - Match presentation UI

4. **Polish & Launch Phase** (4-6 weeks)
   - Notification system
   - Performance optimization
   - Security audit
   - Final testing and deployment

## Contact

For questions about this project, please contact the project maintainers.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
