# Deployment Verification and Execution Plan

## 1. Port Configuration Validation ✅

- **Backend (Port 3000):**
  - ✅ Backend Dockerfile specifies `EXPOSE 3000`
  - ✅ Backend task definition uses containerPort 3000 in portMappings
  - ✅ PORT environment variable set to "3000" in task definition
  - ✅ Health check configured for http://localhost:3000/api/health
  - ✅ Docker-compose uses port 3000:3000 mapping

- **Frontend (Port 3000 with 3001 external):**
  - ✅ Frontend Dockerfile specifies `EXPOSE 3000`
  - ✅ Frontend task definition uses containerPort 3000 in portMappings
  - ✅ PORT environment variable set to "3000" in task definition
  - ✅ Health check configured for http://localhost:3000/health
  - ✅ Docker-compose uses port 3001:3000 mapping for local development

## 2. Task Definition Registration Process Verification

The deployment script (`Deploy-Production.ps1`) correctly handles task definition registration:

1. Reads the task definition from `/infrastructure/task-definitions/`
2. Updates the image reference with the new versioned image
3. Strips unnecessary fields to avoid registration issues
4. Saves updated task definition to a temporary file
5. Registers the new task definition with AWS ECS
6. Uses the new task definition ARN when updating the service

The script includes pre-flight checks to verify task definition compatibility with Fargate:
- Verifies networkMode is set to "awsvpc"
- Verifies requiresCompatibilities includes "FARGATE"

## 3. Docker Image Build Verification

The `Build-DockerImages.ps1` script handles versioning correctly:

1. Accepts a `-Version` parameter for specifying the Docker image tag
2. If no version is specified, generates a timestamp-based version
3. Builds and tags both backend and frontend images with specified version
4. Pushes images to appropriate ECR repositories
5. Returns full ECR image names for deployment

## 4. Deployment Execution Plan

### Step 1: Build the Docker Images
```
.\infrastructure\scripts\Build-DockerImages.ps1 -Version "1.0.1" -Verbose
```
This will:
- Authenticate with ECR
- Build backend and frontend Docker images
- Tag images as 1.0.1
- Push images to ECR repositories
- Output full ECR image URLs for reference

### Step 2: Deploy the Application
```
.\infrastructure\scripts\Deploy-Production.ps1 -Version "1.0.1" -Verbose
```
This will:
- Verify AWS environment 
- Validate task definition compatibility
- Register new task definitions with the 1.0.1 images
- Update ECS services with the new task definitions
- Monitor deployment progress with enhanced stability checks
- Provide detailed logging of all operations

### Step 3: Monitor the Deployment
The deployment script automatically:
- Waits for services to stabilize (both backend and frontend)
- Uses a 15-minute timeout period with 30-second check intervals
- Provides running/desired task counts in the logs
- Executes the `Get-FailedTaskInfo` function if any service fails to stabilize
- Reports detailed CloudWatch logs from failed containers

### Step 4: Verify Application Health
After deployment stabilizes:
- Verify application endpoints:
  - Frontend: https://www.pairva.ai
  - API: https://api.pairva.ai
  - Health Check: https://api.pairva.ai/health
- Test core functionality:
  - Authentication
  - Profile creation
  - Matching functionality
- Monitor CloudWatch metrics:
  - CPU and memory utilization
  - Request counts and latency
  - Error rates

## 5. Rollback Plan (if needed)
```
.\infrastructure\scripts\Deploy-Production.ps1 -Rollback -Verbose
```
This will:
- Identify the previous stable version
- Update services to use previous task definitions
- Monitor rollback stability
- Report detailed diagnostics if rollback fails

## 6. Expected Results
- Both backend and frontend services running desired number of tasks
- All health checks passing
- Services properly registered with load balancer
- Application accessible through public URLs
- No errors in CloudWatch logs