[2025-04-30 14:23:55] [INFO] Starting Pairva production deployment
[2025-04-30 14:23:57] [INFO] AWS Account ID: 039612856036
[2025-04-30 14:23:57] [INFO] AWS Region: us-east-1
[2025-04-30 14:23:57] [INFO] Verifying AWS environment...
[2025-04-30 14:23:57] [INFO] Checking AWS credentials...
[2025-04-30 14:23:58] [SUCCESS] AWS credentials are valid
[2025-04-30 14:23:58] [INFO] Checking ECR repositories...
[2025-04-30 14:24:01] [SUCCESS] All required ECR repositories exist
[2025-04-30 14:24:01] [INFO] Checking ECS cluster...
[2025-04-30 14:24:02] [SUCCESS] ECS cluster is active
[2025-04-30 14:24:02] [SUCCESS] AWS environment verification completed successfully
[2025-04-30 14:24:02] [INFO] Preparing to deploy version: 20250430-fix
[2025-04-30 14:24:02] [INFO] Verifying pre-processed task definitions...
[2025-04-30 14:24:02] [INFO] Verifying processed task definition files...
[2025-04-30 14:24:02] [SUCCESS] Processed task definition files verified successfully
[2025-04-30 14:24:02] [SUCCESS] Pre-processed task definitions verified successfully
[2025-04-30 14:24:02] [INFO] Starting canary deployment with version: 20250430-fix
[2025-04-30 14:24:02] [INFO] Performing canary deployment...
[2025-04-30 14:24:02] [INFO] Updating backend service...
[2025-04-30 14:24:02] [INFO] Using processed backend task definition from C:\Projects\Perfect-Match\infrastructure\task-definitions\backend-task-def-prepared.json
[2025-04-30 14:24:02] [INFO] Saving backend task definition to C:\Users\STERLI~1\AppData\Local\Temp\backend-task-def-20250430-fix.json
[2025-04-30 14:24:02] [INFO] Registering new backend task definition...
[2025-04-30 14:24:02] [INFO] Executing: Register backend task definition
[2025-04-30 14:24:02] [DEBUG] Command: aws ecs register-task-definition --cli-input-json file://C:\Users\STERLI~1\AppData\Local\Temp\backend-task-def-20250430-fix.json | ConvertFrom-Json
[2025-04-30 14:24:04] [SUCCESS] Register backend task definition completed successfully
[2025-04-30 14:24:04] [INFO] New backend task definition ARN: 
[2025-04-30 14:24:04] [INFO] Executing: ECS backend service update
[2025-04-30 14:24:04] [DEBUG] Command: aws ecs update-service --cluster pairva-cluster --service pairva-backend-service --task-definition  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100" --health-check-grace-period-seconds 120 --force-new-deployment
[2025-04-30 14:24:04] [SUCCESS] ECS backend service update completed successfully
[2025-04-30 14:24:04] [INFO] Waiting for backend deployment to stabilize...
[2025-04-30 14:24:05] [INFO] Checking backend service stability (14:24:05)...
[2025-04-30 14:24:06] [INFO] Backend service not yet stable. Running: 0, Desired: 1
[2025-04-30 14:24:36] [INFO] Checking backend service stability (14:24:36)...
[2025-04-30 14:24:37] [INFO] Backend service not yet stable. Running: 0, Desired: 1
[2025-04-30 14:25:07] [INFO] Checking backend service stability (14:25:07)...
[2025-04-30 14:25:09] [INFO] Backend service not yet stable. Running: 0, Desired: 1
[2025-04-30 14:25:39] [INFO] Checking backend service stability (14:25:39)...
[2025-04-30 14:25:40] [INFO] Backend service not yet stable. Running: 0, Desired: 1
[2025-04-30 14:26:10] [INFO] Checking backend service stability (14:26:10)...
[2025-04-30 14:26:11] [INFO] Backend service not yet stable. Running: 0, Desired: 1
[2025-04-30 14:26:41] [INFO] Checking backend service stability (14:26:41)...
[2025-04-30 14:26:42] [SUCCESS] Backend service is stable with 1/1 tasks running
[2025-04-30 14:26:42] [INFO] Updating frontend service...
[2025-04-30 14:26:42] [INFO] Using processed frontend task definition from C:\Projects\Perfect-Match\infrastructure\task-definitions\frontend-task-def-prepared.json
[2025-04-30 14:26:42] [INFO] Saving frontend task definition to C:\Users\STERLI~1\AppData\Local\Temp\frontend-task-def-20250430-fix.json
[2025-04-30 14:26:42] [INFO] Registering new frontend task definition...
[2025-04-30 14:26:42] [INFO] Executing: Register frontend task definition
[2025-04-30 14:26:42] [DEBUG] Command: aws ecs register-task-definition --cli-input-json file://C:\Users\STERLI~1\AppData\Local\Temp\frontend-task-def-20250430-fix.json | ConvertFrom-Json
[2025-04-30 14:26:43] [SUCCESS] Register frontend task definition completed successfully
[2025-04-30 14:26:43] [INFO] New frontend task definition ARN: 
[2025-04-30 14:26:43] [INFO] Executing: ECS frontend service update
[2025-04-30 14:26:43] [DEBUG] Command: aws ecs update-service --cluster pairva-cluster --service pairva-frontend-service --task-definition  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100" --health-check-grace-period-seconds 120 --force-new-deployment
[2025-04-30 14:26:43] [SUCCESS] ECS frontend service update completed successfully
[2025-04-30 14:26:43] [INFO] Waiting for frontend deployment to stabilize...
[2025-04-30 14:26:43] [INFO] Checking frontend service stability (14:26:43)...
[2025-04-30 14:26:44] [SUCCESS] Frontend service is stable with 1/1 tasks running
[2025-04-30 14:26:44] [SUCCESS] Deployment completed successfully
[2025-04-30 14:26:44] [SUCCESS] Deployment of version 20250430-fix completed successfully
[2025-04-30 14:26:44] [INFO] Generating deployment summary report...
[2025-04-30 14:26:44] [INFO] ===== DEPLOYMENT SUMMARY FOR VERSION 20250430-fix =====
[2025-04-30 14:26:44] [INFO] Checking service: pairva-backend-service
[2025-04-30 14:26:46] [SUCCESS] pairva-backend-service Status: HEALTHY
[2025-04-30 14:26:46] [INFO]   Running: 1/1 tasks
[2025-04-30 14:26:46] [INFO]   Deployment ID: ecs-svc/7266612136624103186
[2025-04-30 14:26:46] [INFO]   Deployment Status: PRIMARY
[2025-04-30 14:26:46] [SUCCESS]   Rollout State: COMPLETED
[2025-04-30 14:26:46] [INFO]   Rollout State Reason: ECS deployment ecs-svc/7266612136624103186 completed.
[2025-04-30 14:26:46] [INFO]   Recent service events:
[2025-04-30 14:26:46] [INFO]     [1 minutes ago] (service pairva-backend-service) has started 1 tasks: (task 69a899d927d646b5b061747da46bae48).
[2025-04-30 14:26:46] [INFO]     [2 minutes ago] (service pairva-backend-service) has started 1 tasks: (task 392cf34b36024af59a0f1e5f17e0bcb0).
[2025-04-30 14:26:46] [INFO]     [3 minutes ago] (service pairva-backend-service) has started 1 tasks: (task d8f4bd08ca484983a57d980b4cd6ca78).
[2025-04-30 14:26:46] [INFO] ----------------------------------------------------
[2025-04-30 14:26:46] [INFO] Checking service: pairva-frontend-service
[2025-04-30 14:26:47] [SUCCESS] pairva-frontend-service Status: HEALTHY
[2025-04-30 14:26:47] [INFO]   Running: 1/1 tasks
[2025-04-30 14:26:47] [INFO]   Deployment ID: ecs-svc/4125071934000886933
[2025-04-30 14:26:47] [INFO]   Deployment Status: PRIMARY
[2025-04-30 14:26:47] [SUCCESS]   Rollout State: COMPLETED
[2025-04-30 14:26:47] [INFO]   Rollout State Reason: ECS deployment ecs-svc/4125071934000886933 completed.
[2025-04-30 14:26:47] [INFO]   Recent service events:
[2025-04-30 14:26:47] [INFO]     [0 minutes ago] (service pairva-frontend-service) has stopped 1 running tasks: (task 938cc539ff4a43d3a000ec1a94ba191d).
[2025-04-30 14:26:47] [INFO]     [0 minutes ago] (service pairva-frontend-service) (task 938cc539ff4a43d3a000ec1a94ba191d) failed container health checks.
[2025-04-30 14:26:47] [INFO]     [3 minutes ago] (service pairva-frontend-service) has started 1 tasks: (task 729a2f8f3e3f4b21a962a0efae717610). Amazon ECS replaced 1 tasks due to an unhealthy status.
[2025-04-30 14:26:47] [INFO] ----------------------------------------------------
[2025-04-30 14:26:47] [SUCCESS] DEPLOYMENT STATUS: SUCCESSFUL ✅
[2025-04-30 14:26:47] [SUCCESS] All services are running the desired number of tasks.
[2025-04-30 14:26:47] [INFO] ===== END OF DEPLOYMENT SUMMARY =====
[2025-04-30 14:26:47] [SUCCESS] All services are healthy and running as expected
