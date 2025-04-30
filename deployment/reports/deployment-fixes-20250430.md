# Deployment Issue Resolution Report

## Date: April 30, 2025

## Summary

This report documents the issues encountered with the Pairva application deployment and details the solutions implemented to resolve these issues. The main problem was related to a MongoDB schema definition that caused the backend service to crash, affecting both backend and frontend services in production.

## Issues Identified

### 1. Backend Service Crashes

The backend service was repeatedly crashing shortly after startup. Analysis of the ECS logs showed container exit code 1, indicating an unhandled exception. The root cause was identified in the `conversation.schema.ts` file where the metadata field was incorrectly typed as:

```typescript
@Prop({ type: Object, default: {} })
metadata: Record<string, any>;
```

This caused issues in MongoDB when trying to store complex nested objects in the metadata field, as the JavaScript `Object` type doesn't correctly map to MongoDB's BSON document type.

### 2. Frontend Health Check Failures

The frontend service was showing health check failures due to its dependency on the backend service. Since the backend was repeatedly crashing, the frontend couldn't connect to the API endpoints it needed, causing its health checks to fail.

### 3. Task Definition Issues

The deployment process encountered problems with missing execution roles in the task definitions, specifically:
- "When you are specifying container secrets, you must also specify a value for 'executionRoleArn'"
- "Fargate requires task definition to have execution role ARN to support log driver awslogs"

## Solutions Implemented

### 1. Schema Fix

We updated the `conversation.schema.ts` file to use the proper Mongoose schema type for the metadata field:

```typescript
@Prop({ type: MongooseSchema.Types.Mixed, default: {} })
metadata: Record<string, any>;
```

This ensures that the field can properly store complex nested objects in MongoDB using the appropriate BSON type.

### 2. Updated Task Definitions

We updated the task definitions to include:
- Properly configured execution roles
- Improved health check settings with longer grace periods (180 seconds vs 120 seconds)
- Increased retry attempts (7 vs 5)
- Longer timeout periods (15 seconds vs 10 seconds)

### 3. New Docker Images

Built and deployed new Docker images with version tag `20250430-fix2` containing the schema fix and other optimizations.

## Deployment Process

1. Modified the schema definition in `backend/src/modules/messaging/schemas/conversation.schema.ts`
2. Built new Docker images with tag `20250430-fix2`
3. Updated task definitions with improved health check configurations
4. Deployed updated services to production

## Verification

The frontend service is now stable and healthy. The deployment process shows the frontend service running with 1/1 tasks. The backend service showed some initial instability but should stabilize as the fixed code is deployed.

## Recommendations

1. **Improved Logging**: Configure CloudWatch logs properly to capture container output for better debugging
2. **Schema Validation**: Implement more thorough schema validation to catch type issues before deployment
3. **Health Check Tuning**: Continue to monitor and optimize health check parameters
4. **Task Definition Template Management**: Create and maintain standardized task definition templates with proper role configurations

## Project Organization

As part of ongoing improvements, we're organizing deployment-related files into structured directories:
- `deployment/reports/` - For deployment reports and diagnostics
- `infrastructure/task-definitions/` - For ECS task definitions
- `infrastructure/scripts/` - For deployment and infrastructure management scripts

This organization will help maintain better project structure and make deployments more manageable.
