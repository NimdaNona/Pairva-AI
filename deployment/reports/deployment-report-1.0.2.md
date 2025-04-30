[2025-04-30 13:46:15] [INFO] Starting Pairva production deployment
[2025-04-30 13:46:17] [INFO] AWS Account ID: 039612856036
[2025-04-30 13:46:17] [INFO] AWS Region: us-east-1
[2025-04-30 13:46:17] [INFO] Verifying AWS environment...
[2025-04-30 13:46:17] [INFO] Checking AWS credentials...
[2025-04-30 13:46:18] [SUCCESS] AWS credentials are valid
[2025-04-30 13:46:18] [INFO] Checking ECR repositories...
[2025-04-30 13:46:21] [SUCCESS] All required ECR repositories exist
[2025-04-30 13:46:21] [INFO] Checking ECS cluster...
[2025-04-30 13:46:23] [SUCCESS] ECS cluster is active
[2025-04-30 13:46:23] [SUCCESS] AWS environment verification completed successfully
[2025-04-30 13:46:23] [INFO] Preparing to deploy version: 1.0.2
[2025-04-30 13:46:23] [INFO] Verifying pre-processed task definitions...
[2025-04-30 13:46:23] [INFO] Verifying processed task definition files...
[2025-04-30 13:46:23] [SUCCESS] Processed task definition files verified successfully
[2025-04-30 13:46:23] [SUCCESS] Pre-processed task definitions verified successfully
[2025-04-30 13:46:23] [INFO] Starting canary deployment with version: 1.0.2
[2025-04-30 13:46:23] [INFO] Performing canary deployment...
[2025-04-30 13:46:23] [INFO] Updating backend service...
[2025-04-30 13:46:23] [INFO] Using processed backend task definition from C:\Projects\Perfect-Match\infrastructure\task-definitions\backend-task-def-prepared.json
[2025-04-30 13:46:23] [INFO] Saving backend task definition to C:\Users\STERLI~1\AppData\Local\Temp\backend-task-def-1.0.2.json
[2025-04-30 13:46:23] [INFO] Registering new backend task definition...
[2025-04-30 13:46:23] [INFO] Executing: Register backend task definition
[2025-04-30 13:46:23] [DEBUG] Command: aws ecs register-task-definition --cli-input-json file://C:\Users\STERLI~1\AppData\Local\Temp\backend-task-def-1.0.2.json | ConvertFrom-Json
[2025-04-30 13:46:24] [SUCCESS] Register backend task definition completed successfully
[2025-04-30 13:46:24] [INFO] New backend task definition ARN: 
[2025-04-30 13:46:24] [INFO] Executing: ECS backend service update
[2025-04-30 13:46:24] [DEBUG] Command: aws ecs update-service --cluster pairva-cluster --service pairva-backend-service --task-definition  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100" --health-check-grace-period-seconds 120 --force-new-deployment
[2025-04-30 13:46:25] [SUCCESS] ECS backend service update completed successfully
[2025-04-30 13:46:25] [INFO] Waiting for backend deployment to stabilize...
[2025-04-30 13:46:25] [INFO] Checking backend service stability (13:46:25)...
[2025-04-30 13:46:27] [SUCCESS] Backend service is stable with 0/0 tasks running
[2025-04-30 13:46:27] [INFO] Updating frontend service...
[2025-04-30 13:46:27] [INFO] Using processed frontend task definition from C:\Projects\Perfect-Match\infrastructure\task-definitions\frontend-task-def-prepared.json
[2025-04-30 13:46:27] [INFO] Saving frontend task definition to C:\Users\STERLI~1\AppData\Local\Temp\frontend-task-def-1.0.2.json
[2025-04-30 13:46:27] [INFO] Registering new frontend task definition...
[2025-04-30 13:46:27] [INFO] Executing: Register frontend task definition
[2025-04-30 13:46:27] [DEBUG] Command: aws ecs register-task-definition --cli-input-json file://C:\Users\STERLI~1\AppData\Local\Temp\frontend-task-def-1.0.2.json | ConvertFrom-Json
[2025-04-30 13:46:28] [SUCCESS] Register frontend task definition completed successfully
[2025-04-30 13:46:28] [INFO] New frontend task definition ARN: 
[2025-04-30 13:46:28] [INFO] Executing: ECS frontend service update
[2025-04-30 13:46:28] [DEBUG] Command: aws ecs update-service --cluster pairva-cluster --service pairva-frontend-service --task-definition  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100" --health-check-grace-period-seconds 120 --force-new-deployment
[2025-04-30 13:46:29] [SUCCESS] ECS frontend service update completed successfully
[2025-04-30 13:46:29] [INFO] Waiting for frontend deployment to stabilize...
[2025-04-30 13:46:29] [INFO] Checking frontend service stability (13:46:29)...
[2025-04-30 13:46:30] [SUCCESS] Frontend service is stable with 0/0 tasks running
[2025-04-30 13:46:30] [SUCCESS] Deployment completed successfully
[2025-04-30 13:46:30] [SUCCESS] Deployment of version 1.0.2 completed successfully
[2025-04-30 13:46:30] [INFO] Generating deployment summary report...
[2025-04-30 13:46:30] [INFO] ===== DEPLOYMENT SUMMARY FOR VERSION 1.0.2 =====
[2025-04-30 13:46:30] [INFO] Checking service: pairva-backend-service
[2025-04-30 13:46:32] [SUCCESS] pairva-backend-service Status: HEALTHY
[2025-04-30 13:46:32] [INFO]   Running: 0/0 tasks
[2025-04-30 13:46:32] [INFO]   Deployment ID: ecs-svc/7266612136624103186
[2025-04-30 13:46:32] [INFO]   Deployment Status: PRIMARY
[2025-04-30 13:46:32] [SUCCESS]   Rollout State: COMPLETED
[2025-04-30 13:46:32] [INFO]   Rollout State Reason: ECS deployment ecs-svc/7266612136624103186 completed.
[2025-04-30 13:46:32] [INFO]   Recent service events:
[2025-04-30 13:46:32] [INFO]     [68 minutes ago] (service pairva-backend-service) has reached a steady state.
[2025-04-30 13:46:32] [INFO]     [68 minutes ago] (service pairva-backend-service) (deployment ecs-svc/7266612136624103186) deployment completed.
[2025-04-30 13:46:32] [INFO]     [69 minutes ago] (service pairva-backend-service) has started 1 tasks: (task c6614e1261aa48ecbb2da65219da006f).
[2025-04-30 13:46:32] [INFO] ----------------------------------------------------
[2025-04-30 13:46:32] [INFO] Checking service: pairva-frontend-service
[2025-04-30 13:46:33] [SUCCESS] pairva-frontend-service Status: HEALTHY
[2025-04-30 13:46:33] [INFO]   Running: 0/0 tasks
[2025-04-30 13:46:33] [INFO]   Deployment ID: ecs-svc/4125071934000886933
[2025-04-30 13:46:33] [INFO]   Deployment Status: PRIMARY
[2025-04-30 13:46:33] [SUCCESS]   Rollout State: COMPLETED
[2025-04-30 13:46:33] [INFO]   Rollout State Reason: ECS deployment ecs-svc/4125071934000886933 completed.
[2025-04-30 13:46:33] [INFO]   Recent service events:
[2025-04-30 13:46:33] [INFO]     [65 minutes ago] (service pairva-frontend-service) has reached a steady state.
[2025-04-30 13:46:33] [INFO]     [65 minutes ago] (service pairva-frontend-service) (deployment ecs-svc/4125071934000886933) deployment completed.
[2025-04-30 13:46:33] [INFO]     [66 minutes ago] (service pairva-frontend-service) has stopped 1 running tasks: (task 001c8ef9cd0f407dbbb977de94802d63).
[2025-04-30 13:46:33] [INFO] ----------------------------------------------------
[2025-04-30 13:46:33] [SUCCESS] DEPLOYMENT STATUS: SUCCESSFUL ✅
[2025-04-30 13:46:33] [SUCCESS] All services are running the desired number of tasks.
[2025-04-30 13:46:33] [INFO] ===== END OF DEPLOYMENT SUMMARY =====
[2025-04-30 13:46:33] [SUCCESS] All services are healthy and running as expected
