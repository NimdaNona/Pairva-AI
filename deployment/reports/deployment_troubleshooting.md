## Overview

This report documents the diagnostic findings for the Pairva application deployment failures. The analysis focuses on both backend and frontend components, detailing the configuration issues, error patterns, and recommended solutions.

## Environment Information

### AWS Configuration
- Account: 039612856036
- Region: us-east-1
- Cluster: pairva-cluster
- Service: pairva-backend-service, pairva-frontend-service
- Task Definitions: pairva-backend:4, pairva-frontend:3
- Container Images: 
  - 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-backend:20250423-1
  - 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-frontend:20250423-1

## Backend Issues

### Error Details

Backend container is failing to start with the following error:

/app/node_modules/@nestjs/mongoose/dist/decorators/prop.decorator.js:22 throw new errors_1.CannotDetermineTypeError((_a = target.constructor) === null || _a === void 0 ? void 0 : _a.name, propertyKey); ^ CannotDetermineTypeError: Cannot determine a type for the "Conversation.metadata" field (union/intersection/ambiguous type was used). Make sure your property is decorated with a "@Prop({ type: TYPE_HERE })" decorator. at /app/node_modules/@nestjs/mongoose/dist/decorators/prop.decorator.js:22:23 at DecorateProperty (/app/node_modules/reflect-metadata/Reflect.js:553:33) at Reflect.decorate (/app/node_modules/reflect-metadata/Reflect.js:123:24) at __decorate (/app/dist/modules/messaging/schemas/conversation.schema.js:4:92) at Object. (/app/dist/modules/messaging/schemas/conversation.schema.js:46:1) at Module._compile (node:internal/modules/cjs/loader:1529:14) at Module._extensions..js (node:internal/modules/cjs/loader:1613:10) at Module.load (node:internal/modules/cjs/loader:1275:32) at Module._load (node:internal/modules/cjs/loader:1096:12) at Module.require (node:internal/modules/cjs/loader:1298:19) Node.js v20.19.1


### Root Cause Analysis

The issue is in the MongoDB schema definition for the Conversation model, specifically with the `metadata` field type definition. Looking at the schema code:

```typescript
// File: backend/src/modules/messaging/schemas/conversation.schema.ts
@Prop({ type: MongooseSchema.Types.Mixed, default: {} })
metadata: Record<string, any>;
The NestJS Mongoose module can't properly determine the type for the metadata field during runtime. Despite using MongooseSchema.Types.Mixed, the TypeScript Record<string, any> type is causing ambiguity for the schema decorator.

Deployment Status
The latest failed backend task has the following identifiers:

Task ID: dd9ce2de47564951a0d74bb2f0d5b679
Status: STOPPED
Stop Code: EssentialContainerExited
Exit Code: 1
Stop Reason: "Essential container in task exited"
Frontend Issues
Error Details
Frontend container is failing with the following error:

'charmap' codec can't encode character '\\u25b2' in position 3: character maps to <undefined>
Root Cause Analysis
This error is related to character encoding problems. The frontend application is trying to display a Unicode triangle symbol (▲) which is not supported in the container's character encoding. This usually happens when:

The container's locale is not set to support Unicode characters
There's a mismatch between the source code encoding and the runtime environment encoding
The container's default encoding is not UTF-8
Deployment Status
The latest failed frontend task has the following identifiers:

Task ID: 5d514fc9bd3b4a6c9607877c051984ca
Status: STOPPED
Task Definition Analysis
Backend Task Definition (pairva-backend:4)
{
    \"name\": \"pairva-backend\",
    \"image\": \"039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-backend:20250423-1\",
    \"cpu\": 0,
    \"portMappings\": [
        {
            \"containerPort\": 3000,
            \"hostPort\": 3000,
            \"protocol\": \"tcp\"
        }
    ],
    \"essential\": true,
    \"environment\": [
        {
            \"name\": \"NODE_ENV\",
            \"value\": \"production\"
        },
        {
            \"name\": \"API_URL\",
            \"value\": \"https://api.pairva.ai\"
        },
        {
            \"name\": \"PORT\",
            \"value\": \"3000\"
        },
        {
            \"name\": \"FRONTEND_URL\",
            \"value\": \"https://www.pairva.ai\"
        }
    ],
    \"healthCheck\": {
        \"command\": [
            \"CMD-SHELL\",
            \"curl -f http://localhost:3000/api/health || exit 1\"
        ],
        \"interval\": 30,
        \"timeout\": 5,
        \"retries\": 3,
        \"startPeriod\": 60
    }
}
Frontend Task Definition (pairva-frontend:3)
{
    \"name\": \"pairva-frontend\",
    \"image\": \"039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-frontend:20250423-1\",
    \"cpu\": 0,
    \"portMappings\": [
        {
            \"containerPort\": 3000,
            \"hostPort\": 3000,
            \"protocol\": \"tcp\"
        }
    ],
    \"essential\": true,
    \"environment\": [
        {
            \"name\": \"NODE_ENV\",
            \"value\": \"production\"
        },
        {
            \"name\": \"PORT\",
            \"value\": \"3000\"
        },
        {
            \"name\": \"NEXT_PUBLIC_FRONTEND_URL\",
            \"value\": \"https://www.pairva.ai\"
        },
        {
            \"name\": \"NEXT_PUBLIC_API_URL\",
            \"value\": \"https://api.pairva.ai\"
        }
    ],
    \"healthCheck\": {
        \"command\": [
            \"CMD-SHELL\",
            \"curl -f http://localhost:3000/health || exit 1\"
        ],
        \"interval\": 30,
        \"timeout\": 5,
        \"retries\": 3,
        \"startPeriod\": 60
    }
}
Recommended Solutions
Backend Fix
Modify the metadata property in backend/src/modules/messaging/schemas/conversation.schema.ts by explicitly specifying the type in the schema decorator:

@Prop({ type: Object, default: {} })
metadata: Record<string, any>;
Alternatively, if that doesn't work:

@Prop({
  type: {},
  default: {}
})
metadata: Record<string, any>;
Frontend Fix
Add locale environment variables to the task definition:

{
    \"name\": \"LC_ALL\",
    \"value\": \"en_US.UTF-8\"
},
{
    \"name\": \"LANG\",
    \"value\": \"en_US.UTF-8\"
}
Update the Dockerfile to ensure proper locale configuration:

# Install required locale packages
RUN apt-get update && apt-get install -y locales && \\
    localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LC_ALL en_US.UTF-8
Alternatively, locate and replace the Unicode character (▲) with HTML entities or SVG icons in the frontend code.

Deployment History
There are multiple stopped tasks for both services, indicating repeated deployment attempts that have failed:

65+ stopped tasks for the pairva-cluster, with task IDs like:
dd9ce2de47564951a0d74bb2f0d5b679 (latest backend failure)
5d514fc9bd3b4a6c9607877c051984ca (latest frontend failure)
Each container exits shortly after starting due to the errors described above.

Additional Recommendations
Enhanced Error Handling: Implement more robust error handling in the application startup code to provide clearer error messages and prevent container failures.

Comprehensive Health Checks: Add more comprehensive health checks that validate database connections, configuration, and critical services before reporting as healthy.

Environment Validation: Add startup validation for critical environment variables to fail fast with clear error messages if required variables are missing.

Centralized Logging: Ensure all application logs are sent to CloudWatch with appropriate log levels to aid in troubleshooting.

Configuration Management: Consider using AWS Systems Manager Parameter Store for managing configuration values securely.

Next Steps
Fix the backend schema issue with the Conversation.metadata field
Address the character encoding issue in the frontend code
Rebuild and redeploy both containers with these fixes
Monitor the logs after deployment to ensure successful startup"