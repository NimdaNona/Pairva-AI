# Pairva (formerly Perfect-Match) Deployment Guide

This document outlines the requirements and steps for the final production deployment of the Pairva application.

## Docker Requirements

### Container Images

The deployment utilizes four main container images:

1. **Frontend (pairva-frontend)**
   - Base Image: node:16-alpine
   - Multi-stage build for optimized image size
   - Production build of Next.js application
   - Exposed Port: 3000
   - Health Check: HTTP request to /api/health endpoint

2. **Backend (pairva-backend)**
   - Base Image: node:16-alpine
   - Multi-stage build for optimized image size
   - Production build of NestJS application
   - Exposed Port: 3000
   - Health Check: HTTP request to /api/health endpoint

3. **PostgreSQL**
   - Base Image: postgres:14-alpine
   - Used for structured data (users, profiles, matches)
   - Exposed Port: 5432
   - Persistent volume for data storage

4. **MongoDB**
   - Base Image: mongo:5
   - Used for flexible schema data (questionnaire responses)
   - Exposed Port: 27017
   - Persistent volume for data storage

5. **Redis**
   - Base Image: redis:7-alpine
   - Used for caching and session management
   - Exposed Port: 6379
   - Persistent volume for data storage

### Image Build and Push Process

The deployment script (`infrastructure/scripts/deploy-production.sh`) handles the build and push process:

1. **Authentication with ECR**
   ```bash
   aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
   ```

2. **Building Backend Image**
   ```bash
   docker build -t pairva-backend:${VERSION} ${PROJECT_ROOT}/backend
   docker tag pairva-backend:${VERSION} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pairva-backend:${VERSION}
   docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pairva-backend:${VERSION}
   ```

3. **Building Frontend Image**
   ```bash
   docker build -t pairva-frontend:${VERSION} ${PROJECT_ROOT}/frontend
   docker tag pairva-frontend:${VERSION} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pairva-frontend:${VERSION}
   docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pairva-frontend:${VERSION}
   ```

4. **Versioning**
   - Images are tagged with a timestamp-based version (YYYYMMDD-HHMMSS)
   - Version is used throughout the deployment process for tracking and rollback

### Container Usage in Deployment

The containers are deployed to an ECS cluster with the following configuration:

- **ECS Cluster**: pairva-cluster
- **Services**:
  - pairva-backend-service: Runs the backend container with auto-scaling
  - pairva-frontend-service: Runs the frontend container with auto-scaling
- **Load Balancing**:
  - Application Load Balancer (ALB) routes traffic to the services
  - Health checks ensure only healthy containers receive traffic
- **Deployment Configuration**:
  - Circuit breaker enabled for automatic rollback on failed deployments
  - Canary deployment for the backend with staged rollout

## Final Deployment Steps

### Pre-Deployment Verification

1. **Verify AWS Environment**
   ```bash
   ./infrastructure/scripts/verify-production-readiness.sh
   ```
   This script checks:
   - AWS credentials validity
   - CloudFormation stack status
   - ECR repositories existence
   - Required SSM parameters
   - ECS cluster status

2. **Validate Infrastructure**
   ```bash
   cd infrastructure && npx cdk diff
   ```
   This command shows what changes will be made to the infrastructure.

### Deployment Commands

1. **Deploy Infrastructure (if needed)**
   ```bash
   cd infrastructure && npx cdk deploy --all --require-approval never
   ```

2. **Deploy Application**
   ```bash
   ./infrastructure/scripts/deploy-production.sh
   ```
   This script:
   - Verifies the AWS environment
   - Builds and pushes Docker images
   - Updates CloudFormation stacks
   - Performs canary deployment
   - Conducts health checks

3. **Verify Deployment**
   ```bash
   ./infrastructure/scripts/verify-production-readiness.sh --post-deployment
   ```
   This script verifies the deployment was successful.

### Expected Deployment Duration and Milestones

1. **Infrastructure Deployment: ~15-20 minutes**
   - Network resources: 3-5 minutes
   - Database resources: 5-7 minutes
   - Storage resources: 2-3 minutes
   - Monitoring resources: 2-3 minutes
   - Service resources: 3-5 minutes

2. **Application Deployment: ~20-30 minutes**
   - Docker image building: 5-7 minutes
   - Image pushing to ECR: 3-5 minutes
   - CloudFormation updates: 2-3 minutes
   - Backend deployment: 5-7 minutes
   - Frontend deployment: 3-5 minutes
   - Health checks: 2-3 minutes

### Verification Steps

1. **Verify ECS Services**
   ```bash
   aws ecs describe-services --cluster pairva-cluster --services pairva-backend-service pairva-frontend-service
   ```
   Check that both services have the desired number of tasks running.

2. **Verify Load Balancer**
   ```bash
   aws elbv2 describe-target-health --target-group-arn $(aws elbv2 describe-target-groups --query "TargetGroups[?contains(TargetGroupName, 'PairvaBackend')].TargetGroupArn" --output text)
   ```
   Ensure all targets are healthy.

3. **Verify Application Health**
   ```bash
   curl -v https://api.pairva.ai/health
   curl -v https://www.pairva.ai/api/health
   ```
   Both should return HTTP 200 OK.

4. **Verify Database Connectivity**
   ```bash
   curl -v https://api.pairva.ai/api/v1/status
   ```
   Should indicate all database connections are successful.

5. **Verify Authentication**
   ```bash
   curl -v https://api.pairva.ai/api/v1/auth/status
   ```
   Should indicate authentication services are operating correctly.

6. **End-to-End Test**
   ```bash
   ./infrastructure/scripts/Test-CoreFlows.ps1
   ```
   This script validates core application flows like:
   - User registration and login
   - Profile creation
   - Questionnaire completion
   - Matching functionality
   - Messaging between users

## Rollback Procedure

In case of deployment issues, the system supports automatic and manual rollback:

1. **Automatic Rollback**
   - ECS deployment circuit breaker automatically rolls back if health checks fail
   - CloudFormation stacks have rollback configured on failure

2. **Manual Rollback**
   ```bash
   ./infrastructure/scripts/deploy-production.sh --rollback
   ```
   This reverts to the previous known-good version.

## Monitoring and Alerts

After deployment, monitor the system using:

1. **CloudWatch Dashboards**
   - Application metrics
   - Infrastructure health
   - Error rates

2. **CloudWatch Alarms**
   - High error rates
   - Elevated response times
   - Abnormal traffic patterns
   - Database connection issues
   - Memory and CPU utilization

3. **X-Ray Traces**
   - End-to-end request tracing
   - Performance bottlenecks
   - Error investigation

4. **Amazon Inspector**
   - Container vulnerability scanning
   - Security compliance

## Initial Post-Deployment Actions

1. Create initial admin users:
   ```bash
   ./infrastructure/scripts/Create-TestUsers.ps1 --admin
   ```

2. Verify custom domain and SSL:
   ```bash
   curl -v https://www.pairva.ai
   ```

3. Test notifications delivery:
   ```bash
   ./infrastructure/scripts/Test-Notifications.ps1
   ```

4. Generate baseline performance metrics:
   ```bash
   ./infrastructure/scripts/Run-PerformanceBaseline.ps1
   ```

## Maintenance Window

The recommended maintenance window for future updates is Tuesdays, 2:00 AM - 5:00 AM ET, when user activity is lowest based on analytics data.
