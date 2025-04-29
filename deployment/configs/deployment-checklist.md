# Pairva Deployment Checklist

## Changes Made

### 1. TypeScript Fixes
- Fixed null handling in `questionnaire.service.ts` by properly typing methods to return `Promise<Response | null>`
- Added explicit type definitions in `questionnaire.service.ts` using `Record<string, number>` and `Record<number, number>` for mapped objects
- Added null checks in `subscriptions.controller.ts` for `req.user.userId` to prevent TypeScript errors

### 2. Infrastructure Configuration
- Created `backend-task-def.json` for ECS backend service with proper container definitions
- Created `frontend-task-def.json` for ECS frontend service with proper container definitions
- Updated `Deploy-Production.ps1` to include health check grace period of 120 seconds
- Verified domain configurations for "pairva.ai", "www.pairva.ai", and "api.pairva.ai"
- Updated deployment script to show correct application URLs

## Deployment Steps

### Pre-Deployment Verification
1. Ensure all TypeScript errors are fixed by running:
   ```
   cd backend && npm run build
   cd frontend && npm run build
   ```

2. Verify AWS credentials and environment variables:
   ```
   aws sts get-caller-identity
   aws configure list
   ```

3. Check for correct domain configuration:
   ```
   aws route53 list-hosted-zones
   aws acm list-certificates --region us-east-1
   ```

### Docker Image Build and Push
1. Build backend and frontend Docker images:
   ```
   cd infrastructure/scripts
   ./Build-DockerImages.ps1
   ```

2. Verify that the images are correctly tagged and pushed to ECR:
   ```
   aws ecr describe-images --repository-name pairva-backend
   aws ecr describe-images --repository-name pairva-frontend
   ```

### CDK Stack Deployment
1. Deploy infrastructure stacks in the following order:
   - Network Stack
   - Storage Stack
   - Data Stack (for databases)
   - Domain Stack
   - Monitoring Stack

   ```
   cd infrastructure
   npx cdk deploy PairvaNetworkStack
   npx cdk deploy PairvaStorageStack
   npx cdk deploy PairvaDataStack
   npx cdk deploy PairvaDomainStack
   npx cdk deploy PairvaMonitoringStack
   ```

### Application Deployment
1. Execute the deployment script to deploy the application to production:
   ```
   cd infrastructure/scripts
   ./Deploy-Production.ps1 -Version "YYYYMMDD-HHMMSS" -Verbose
   ```

2. Monitor the deployment process in AWS console:
   - ECS Services
   - CloudWatch Logs
   - CloudWatch Alarms

### Post-Deployment Verification
1. Check the health of the deployed services:
   ```
   curl https://api.pairva.ai/health
   ```

2. Verify CDN and DNS configuration:
   ```
   curl -I https://www.pairva.ai
   curl -I https://api.pairva.ai
   ```

3. Run automated verification tests:
   ```
   cd infrastructure/scripts
   ./Test-CoreFlows.ps1
   ```

## Rollback Procedure
If issues are identified during or after deployment:

1. Execute rollback command:
   ```
   cd infrastructure/scripts
   ./Deploy-Production.ps1 -Rollback -Verbose
   ```

2. Monitor rollback process for completion:
   ```
   aws ecs describe-services --cluster pairva-cluster --services pairva-backend-service pairva-frontend-service
   ```

## Summary of Task Definition Changes
- Added proper health check configuration with grace period of 120 seconds
- Configured appropriate CPU and memory allocations for production
- Set up logging configuration to send logs to CloudWatch
- Added environment variables with API and frontend URLs
- Used SSM parameters for secrets and configuration values

## Summary of Domain Configuration
- Frontend URL: https://www.pairva.ai
- API URL: https://api.pairva.ai
- Health Check: https://api.pairva.ai/health
