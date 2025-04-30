[2025-04-30 14:34:46] [INFO] Starting Pairva production deployment
[2025-04-30 14:34:48] [INFO] AWS Account ID: 039612856036
[2025-04-30 14:34:48] [INFO] AWS Region: us-east-1
[2025-04-30 14:34:48] [INFO] Verifying AWS environment...
[2025-04-30 14:34:48] [INFO] Checking AWS credentials...
[2025-04-30 14:34:49] [SUCCESS] AWS credentials are valid
[2025-04-30 14:34:49] [INFO] Checking ECR repositories...
[2025-04-30 14:34:52] [SUCCESS] All required ECR repositories exist
[2025-04-30 14:34:52] [INFO] Checking ECS cluster...
[2025-04-30 14:34:53] [SUCCESS] ECS cluster is active
[2025-04-30 14:34:53] [SUCCESS] AWS environment verification completed successfully
[2025-04-30 14:34:53] [INFO] Preparing to deploy version: 20250430-fix2
[2025-04-30 14:34:53] [INFO] Verifying pre-processed task definitions...
[2025-04-30 14:34:53] [INFO] Verifying processed task definition files...
[2025-04-30 14:34:53] [SUCCESS] Processed task definition files verified successfully
[2025-04-30 14:34:53] [SUCCESS] Pre-processed task definitions verified successfully
[2025-04-30 14:34:53] [INFO] Starting canary deployment with version: 20250430-fix2
[2025-04-30 14:34:53] [INFO] Performing canary deployment...
[2025-04-30 14:34:53] [INFO] Updating backend service...
[2025-04-30 14:34:53] [INFO] Using processed backend task definition from C:\Projects\Perfect-Match\infrastructure\task-definitions\backend-task-def-prepared.json
[2025-04-30 14:34:53] [INFO] Saving backend task definition to C:\Users\STERLI~1\AppData\Local\Temp\backend-task-def-20250430-fix2.json
[2025-04-30 14:34:53] [INFO] Registering new backend task definition...
[2025-04-30 14:34:53] [INFO] Executing: Register backend task definition
[2025-04-30 14:34:53] [DEBUG] Command: aws ecs register-task-definition --cli-input-json file://C:\Users\STERLI~1\AppData\Local\Temp\backend-task-def-20250430-fix2.json | ConvertFrom-Json
[2025-04-30 14:34:55] [SUCCESS] Register backend task definition completed successfully
[2025-04-30 14:34:55] [INFO] New backend task definition ARN: 
[2025-04-30 14:34:55] [INFO] Executing: ECS backend service update
[2025-04-30 14:34:55] [DEBUG] Command: aws ecs update-service --cluster pairva-cluster --service pairva-backend-service --task-definition  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100" --health-check-grace-period-seconds 120 --force-new-deployment
[2025-04-30 14:34:55] [SUCCESS] ECS backend service update completed successfully
[2025-04-30 14:34:55] [INFO] Waiting for backend deployment to stabilize...
[2025-04-30 14:34:55] [INFO] Checking backend service stability (14:34:55)...
[2025-04-30 14:34:57] [INFO] Backend service not yet stable. Running: 0, Desired: 1
[2025-04-30 14:35:27] [INFO] Checking backend service stability (14:35:27)...
[2025-04-30 14:35:28] [SUCCESS] Backend service is stable with 1/1 tasks running
[2025-04-30 14:35:28] [INFO] Updating frontend service...
[2025-04-30 14:35:28] [INFO] Using processed frontend task definition from C:\Projects\Perfect-Match\infrastructure\task-definitions\frontend-task-def-prepared.json
[2025-04-30 14:35:28] [INFO] Saving frontend task definition to C:\Users\STERLI~1\AppData\Local\Temp\frontend-task-def-20250430-fix2.json
[2025-04-30 14:35:28] [INFO] Registering new frontend task definition...
[2025-04-30 14:35:28] [INFO] Executing: Register frontend task definition
[2025-04-30 14:35:28] [DEBUG] Command: aws ecs register-task-definition --cli-input-json file://C:\Users\STERLI~1\AppData\Local\Temp\frontend-task-def-20250430-fix2.json | ConvertFrom-Json
[2025-04-30 14:35:29] [SUCCESS] Register frontend task definition completed successfully
[2025-04-30 14:35:29] [INFO] New frontend task definition ARN: 
[2025-04-30 14:35:29] [INFO] Executing: ECS frontend service update
[2025-04-30 14:35:29] [DEBUG] Command: aws ecs update-service --cluster pairva-cluster --service pairva-frontend-service --task-definition  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100" --health-check-grace-period-seconds 120 --force-new-deployment
[2025-04-30 14:35:30] [SUCCESS] ECS frontend service update completed successfully
[2025-04-30 14:35:30] [INFO] Waiting for frontend deployment to stabilize...
[2025-04-30 14:35:30] [INFO] Checking frontend service stability (14:35:30)...
[2025-04-30 14:35:31] [INFO] Frontend service not yet stable. Running: 2, Desired: 1
[2025-04-30 14:36:01] [INFO] Checking frontend service stability (14:36:01)...
[2025-04-30 14:36:03] [INFO] Frontend service not yet stable. Running: 2, Desired: 1
[2025-04-30 14:36:33] [INFO] Checking frontend service stability (14:36:33)...
[2025-04-30 14:36:34] [INFO] Frontend service not yet stable. Running: 2, Desired: 1
[2025-04-30 14:37:04] [INFO] Checking frontend service stability (14:37:04)...
[2025-04-30 14:37:06] [INFO] Frontend service not yet stable. Running: 2, Desired: 1
[2025-04-30 14:37:36] [INFO] Checking frontend service stability (14:37:36)...
[2025-04-30 14:37:37] [SUCCESS] Frontend service is stable with 1/1 tasks running
[2025-04-30 14:37:37] [SUCCESS] Deployment completed successfully
[2025-04-30 14:37:37] [SUCCESS] Deployment of version 20250430-fix2 completed successfully
[2025-04-30 14:37:37] [INFO] Generating deployment summary report...
[2025-04-30 14:37:37] [INFO] ===== DEPLOYMENT SUMMARY FOR VERSION 20250430-fix2 =====
[2025-04-30 14:37:37] [INFO] Checking service: pairva-backend-service
[2025-04-30 14:37:39] [WARNING] pairva-backend-service Status: DEGRADED
[2025-04-30 14:37:39] [INFO]   Running: 0/1 tasks
[2025-04-30 14:37:39] [WARNING]   Pending tasks: 1
[2025-04-30 14:37:39] [INFO]   Deployment ID: ecs-svc/7266612136624103186
[2025-04-30 14:37:39] [INFO]   Deployment Status: PRIMARY
[2025-04-30 14:37:39] [SUCCESS]   Rollout State: COMPLETED
[2025-04-30 14:37:39] [INFO]   Rollout State Reason: ECS deployment ecs-svc/7266612136624103186 completed.
[2025-04-30 14:37:39] [INFO]   Recent service events:
[2025-04-30 14:37:39] [INFO]     [0 minutes ago] (service pairva-backend-service) has started 1 tasks: (task 666d1ea4442b4039b37358dc878fc2ee).
[2025-04-30 14:37:39] [INFO]     [2 minutes ago] (service pairva-backend-service) has started 1 tasks: (task 00b0fa405eac4c08bca79d9603ea6d3e).
[2025-04-30 14:37:39] [INFO]     [3 minutes ago] (service pairva-backend-service) has started 1 tasks: (task ccdfbbf98d464ccab07247c95d96c873).
[2025-04-30 14:37:39] [INFO] ----------------------------------------------------
[2025-04-30 14:37:39] [INFO] Checking service: pairva-frontend-service
[2025-04-30 14:37:40] [SUCCESS] pairva-frontend-service Status: HEALTHY
[2025-04-30 14:37:40] [INFO]   Running: 1/1 tasks
[2025-04-30 14:37:40] [INFO]   Deployment ID: ecs-svc/4125071934000886933
[2025-04-30 14:37:40] [INFO]   Deployment Status: PRIMARY
[2025-04-30 14:37:40] [SUCCESS]   Rollout State: COMPLETED
[2025-04-30 14:37:40] [INFO]   Rollout State Reason: ECS deployment ecs-svc/4125071934000886933 completed.
[2025-04-30 14:37:40] [INFO]   Recent service events:
[2025-04-30 14:37:40] [INFO]     [0 minutes ago] (service pairva-frontend-service) has stopped 1 running tasks: (task 1ec1618b279141f2804126b9117d5c26).
[2025-04-30 14:37:40] [INFO]     [0 minutes ago] (service pairva-frontend-service) (task 1ec1618b279141f2804126b9117d5c26) failed container health checks.
[2025-04-30 14:37:40] [INFO]     [3 minutes ago] (service pairva-frontend-service) has started 1 tasks: (task f35b3ede97d9476a915fb83787526c65). Amazon ECS replaced 1 tasks due to an unhealthy status.
[2025-04-30 14:37:40] [INFO] ----------------------------------------------------
[2025-04-30 14:37:40] [WARNING] DEPLOYMENT STATUS: DEGRADED ⚠️
[2025-04-30 14:37:40] [WARNING] One or more services are not running the desired number of tasks.
[2025-04-30 14:37:40] [INFO] Investigating issues with pairva-backend-service...
[2025-04-30 14:37:40] [INFO] ===== TASK FAILURE INVESTIGATION FOR pairva-backend-service =====
[2025-04-30 14:37:40] [INFO] Retrieving stopped tasks for pairva-backend-service...
[2025-04-30 14:37:41] [INFO] Found 36 stopped tasks
[2025-04-30 14:37:41] [INFO] ----------------------------------------------------
[2025-04-30 14:37:41] [INFO] Analyzing stopped task: 00b0fa405eac4c08bca79d9603ea6d3e
[2025-04-30 14:37:42] [INFO] Task status: STOPPED
[2025-04-30 14:37:43] [WARNING] Stop reason: Essential container in task exited
[2025-04-30 14:37:43] [INFO] Started at: 04/30/2025 14:36:00
[2025-04-30 14:37:43] [INFO] Stopped at: 04/30/2025 14:37:00
[2025-04-30 14:37:43] [INFO] Task runtime: 0 minutes, 25 seconds
[2025-04-30 14:37:43] [INFO] Health status: UNKNOWN
[2025-04-30 14:37:43] [INFO] Container details:
[2025-04-30 14:37:43] [INFO]   Container: pairva-backend
[2025-04-30 14:37:43] [INFO]   Image: 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-backend:20250423-1
[2025-04-30 14:37:43] [INFO]   Status: STOPPED
[2025-04-30 14:37:43] [WARNING]   Exit code: 1 (ERROR)
[2025-04-30 14:37:43] [INFO]   Retrieving logs from CloudWatch (stream: pairva-cluster/pairva-backend/00b0fa405eac4c08bca79d9603ea6d3e)...
[2025-04-30 14:37:44] [WARNING]   Failed to retrieve logs: System.Management.Automation.RemoteException An error occurred (ResourceNotFoundException) when calling the GetLogEvents operation: The specified log group does not exist.
[2025-04-30 14:37:44] [INFO]   Trying alternative log group: /aws/ecs/pairva-cluster
[2025-04-30 14:37:45] [WARNING]   Failed to retrieve logs from alternative log group
[2025-04-30 14:37:45] [INFO] ----------------------------------------------------
[2025-04-30 14:37:45] [INFO] ----------------------------------------------------
[2025-04-30 14:37:45] [INFO] Analyzing stopped task: 0f48b17119f4431f80b187d7dbba7499
[2025-04-30 14:37:46] [INFO] Task status: STOPPED
[2025-04-30 14:37:46] [WARNING] Stop reason: Essential container in task exited
[2025-04-30 14:37:46] [INFO] Started at: 04/30/2025 14:28:10
[2025-04-30 14:37:46] [INFO] Stopped at: 04/30/2025 14:29:09
[2025-04-30 14:37:46] [INFO] Task runtime: 0 minutes, 24 seconds
[2025-04-30 14:37:46] [INFO] Health status: UNKNOWN
[2025-04-30 14:37:46] [INFO] Container details:
[2025-04-30 14:37:46] [INFO]   Container: pairva-backend
[2025-04-30 14:37:46] [INFO]   Image: 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-backend:20250423-1
[2025-04-30 14:37:46] [INFO]   Status: STOPPED
[2025-04-30 14:37:46] [WARNING]   Exit code: 1 (ERROR)
[2025-04-30 14:37:46] [INFO]   Retrieving logs from CloudWatch (stream: pairva-cluster/pairva-backend/0f48b17119f4431f80b187d7dbba7499)...
[2025-04-30 14:37:47] [WARNING]   Failed to retrieve logs: System.Management.Automation.RemoteException An error occurred (ResourceNotFoundException) when calling the GetLogEvents operation: The specified log group does not exist.
[2025-04-30 14:37:47] [INFO]   Trying alternative log group: /aws/ecs/pairva-cluster
[2025-04-30 14:37:48] [WARNING]   Failed to retrieve logs from alternative log group
[2025-04-30 14:37:48] [INFO] ----------------------------------------------------
[2025-04-30 14:37:48] [INFO] ----------------------------------------------------
[2025-04-30 14:37:48] [INFO] Analyzing stopped task: 0fe7384e50f74ffdb0e2f8121a420b63
[2025-04-30 14:37:49] [INFO] Task status: STOPPED
[2025-04-30 14:37:49] [WARNING] Stop reason: Essential container in task exited
[2025-04-30 14:37:49] [INFO] Started at: 04/30/2025 14:06:16
[2025-04-30 14:37:49] [INFO] Stopped at: 04/30/2025 14:07:08
[2025-04-30 14:37:49] [INFO] Task runtime: 0 minutes, 25 seconds
[2025-04-30 14:37:49] [INFO] Health status: UNKNOWN
[2025-04-30 14:37:49] [INFO] Container details:
[2025-04-30 14:37:49] [INFO]   Container: pairva-backend
[2025-04-30 14:37:49] [INFO]   Image: 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-backend:20250423-1
[2025-04-30 14:37:49] [INFO]   Status: STOPPED
[2025-04-30 14:37:49] [WARNING]   Exit code: 1 (ERROR)
[2025-04-30 14:37:49] [INFO]   Retrieving logs from CloudWatch (stream: pairva-cluster/pairva-backend/0fe7384e50f74ffdb0e2f8121a420b63)...
[2025-04-30 14:37:50] [WARNING]   Failed to retrieve logs: System.Management.Automation.RemoteException An error occurred (ResourceNotFoundException) when calling the GetLogEvents operation: The specified log group does not exist.
[2025-04-30 14:37:50] [INFO]   Trying alternative log group: /aws/ecs/pairva-cluster
[2025-04-30 14:37:51] [WARNING]   Failed to retrieve logs from alternative log group
[2025-04-30 14:37:51] [INFO] ----------------------------------------------------
[2025-04-30 14:37:51] [INFO] Recent service events for pairva-backend-service :
[2025-04-30 14:37:52] [INFO] [2025-04-30 14:37:09] (service pairva-backend-service) has started 1 tasks: (task 666d1ea4442b4039b37358dc878fc2ee).
[2025-04-30 14:37:52] [INFO] [2025-04-30 14:36:00] (service pairva-backend-service) has started 1 tasks: (task 00b0fa405eac4c08bca79d9603ea6d3e).
[2025-04-30 14:37:52] [INFO] [2025-04-30 14:34:50] (service pairva-backend-service) has started 1 tasks: (task ccdfbbf98d464ccab07247c95d96c873).
[2025-04-30 14:37:52] [INFO] [2025-04-30 14:33:50] (service pairva-backend-service) has started 1 tasks: (task 24f90ceb203c4297b47ae223423ce190).
[2025-04-30 14:37:52] [INFO] [2025-04-30 14:32:41] (service pairva-backend-service) has started 1 tasks: (task 539adacedf4c43e3bd501c0f87cd8d72).
[2025-04-30 14:37:52] [INFO] ===== END OF TASK FAILURE INVESTIGATION =====
[2025-04-30 14:37:52] [INFO] ===== END OF DEPLOYMENT SUMMARY =====
[2025-04-30 14:37:52] [WARNING] Some services appear to be unhealthy after deployment - collecting detailed diagnostics
[2025-04-30 14:37:52] [INFO] ===== TASK FAILURE INVESTIGATION FOR pairva-backend-service =====
[2025-04-30 14:37:52] [INFO] Retrieving stopped tasks for pairva-backend-service...
[2025-04-30 14:37:53] [INFO] Found 36 stopped tasks
[2025-04-30 14:37:53] [INFO] ----------------------------------------------------
[2025-04-30 14:37:53] [INFO] Analyzing stopped task: 00b0fa405eac4c08bca79d9603ea6d3e
[2025-04-30 14:37:54] [INFO] Task status: STOPPED
[2025-04-30 14:37:54] [WARNING] Stop reason: Essential container in task exited
[2025-04-30 14:37:54] [INFO] Started at: 04/30/2025 14:36:00
[2025-04-30 14:37:54] [INFO] Stopped at: 04/30/2025 14:37:00
[2025-04-30 14:37:54] [INFO] Task runtime: 0 minutes, 25 seconds
[2025-04-30 14:37:54] [INFO] Health status: UNKNOWN
[2025-04-30 14:37:54] [INFO] Container details:
[2025-04-30 14:37:54] [INFO]   Container: pairva-backend
[2025-04-30 14:37:54] [INFO]   Image: 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-backend:20250423-1
[2025-04-30 14:37:54] [INFO]   Status: STOPPED
[2025-04-30 14:37:54] [WARNING]   Exit code: 1 (ERROR)
[2025-04-30 14:37:54] [INFO]   Retrieving logs from CloudWatch (stream: pairva-cluster/pairva-backend/00b0fa405eac4c08bca79d9603ea6d3e)...
[2025-04-30 14:37:55] [WARNING]   Failed to retrieve logs: System.Management.Automation.RemoteException An error occurred (ResourceNotFoundException) when calling the GetLogEvents operation: The specified log group does not exist.
[2025-04-30 14:37:55] [INFO]   Trying alternative log group: /aws/ecs/pairva-cluster
[2025-04-30 14:37:56] [WARNING]   Failed to retrieve logs from alternative log group
[2025-04-30 14:37:56] [INFO] Network details:
[2025-04-30 14:37:57] [INFO]   subnetId: subnet-08c81037fb224ab9d
[2025-04-30 14:37:57] [INFO]   networkInterfaceId: eni-0959e472c94660aca
[2025-04-30 14:37:57] [INFO]   macAddress: 12:cb:dc:5f:c1:0d
[2025-04-30 14:37:57] [INFO]   privateDnsName: ip-172-31-92-61.ec2.internal
[2025-04-30 14:37:57] [INFO]   privateIPv4Address: 172.31.92.61
[2025-04-30 14:37:57] [INFO] ----------------------------------------------------
[2025-04-30 14:37:57] [INFO] ----------------------------------------------------
[2025-04-30 14:37:57] [INFO] Analyzing stopped task: 0f48b17119f4431f80b187d7dbba7499
[2025-04-30 14:37:58] [INFO] Task status: STOPPED
[2025-04-30 14:37:58] [WARNING] Stop reason: Essential container in task exited
[2025-04-30 14:37:58] [INFO] Started at: 04/30/2025 14:28:10
[2025-04-30 14:37:58] [INFO] Stopped at: 04/30/2025 14:29:09
[2025-04-30 14:37:58] [INFO] Task runtime: 0 minutes, 24 seconds
[2025-04-30 14:37:58] [INFO] Health status: UNKNOWN
[2025-04-30 14:37:58] [INFO] Container details:
[2025-04-30 14:37:58] [INFO]   Container: pairva-backend
[2025-04-30 14:37:58] [INFO]   Image: 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-backend:20250423-1
[2025-04-30 14:37:58] [INFO]   Status: STOPPED
[2025-04-30 14:37:58] [WARNING]   Exit code: 1 (ERROR)
[2025-04-30 14:37:58] [INFO]   Retrieving logs from CloudWatch (stream: pairva-cluster/pairva-backend/0f48b17119f4431f80b187d7dbba7499)...
[2025-04-30 14:37:59] [WARNING]   Failed to retrieve logs: System.Management.Automation.RemoteException An error occurred (ResourceNotFoundException) when calling the GetLogEvents operation: The specified log group does not exist.
[2025-04-30 14:37:59] [INFO]   Trying alternative log group: /aws/ecs/pairva-cluster
[2025-04-30 14:38:00] [WARNING]   Failed to retrieve logs from alternative log group
[2025-04-30 14:38:00] [INFO] Network details:
[2025-04-30 14:38:00] [INFO]   subnetId: subnet-0fddd035ed46b44d1
[2025-04-30 14:38:00] [INFO]   networkInterfaceId: eni-04d47939c9f81e5e5
[2025-04-30 14:38:00] [INFO]   macAddress: 0a:ff:f2:c8:08:07
[2025-04-30 14:38:00] [INFO]   privateDnsName: ip-172-31-19-101.ec2.internal
[2025-04-30 14:38:00] [INFO]   privateIPv4Address: 172.31.19.101
[2025-04-30 14:38:00] [INFO] ----------------------------------------------------
[2025-04-30 14:38:00] [INFO] ----------------------------------------------------
[2025-04-30 14:38:00] [INFO] Analyzing stopped task: 0fe7384e50f74ffdb0e2f8121a420b63
[2025-04-30 14:38:01] [INFO] Task status: STOPPED
[2025-04-30 14:38:01] [WARNING] Stop reason: Essential container in task exited
[2025-04-30 14:38:01] [INFO] Started at: 04/30/2025 14:06:16
[2025-04-30 14:38:01] [INFO] Stopped at: 04/30/2025 14:07:08
[2025-04-30 14:38:01] [INFO] Task runtime: 0 minutes, 25 seconds
[2025-04-30 14:38:01] [INFO] Health status: UNKNOWN
[2025-04-30 14:38:01] [INFO] Container details:
[2025-04-30 14:38:01] [INFO]   Container: pairva-backend
[2025-04-30 14:38:01] [INFO]   Image: 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-backend:20250423-1
[2025-04-30 14:38:01] [INFO]   Status: STOPPED
[2025-04-30 14:38:01] [WARNING]   Exit code: 1 (ERROR)
[2025-04-30 14:38:01] [INFO]   Retrieving logs from CloudWatch (stream: pairva-cluster/pairva-backend/0fe7384e50f74ffdb0e2f8121a420b63)...
[2025-04-30 14:38:02] [WARNING]   Failed to retrieve logs: System.Management.Automation.RemoteException An error occurred (ResourceNotFoundException) when calling the GetLogEvents operation: The specified log group does not exist.
[2025-04-30 14:38:02] [INFO]   Trying alternative log group: /aws/ecs/pairva-cluster
[2025-04-30 14:38:03] [WARNING]   Failed to retrieve logs from alternative log group
[2025-04-30 14:38:03] [INFO] Network details:
[2025-04-30 14:38:03] [INFO]   subnetId: subnet-0fddd035ed46b44d1
[2025-04-30 14:38:03] [INFO]   networkInterfaceId: eni-05c340495c6a296fa
[2025-04-30 14:38:03] [INFO]   macAddress: 0a:ff:eb:29:ee:01
[2025-04-30 14:38:03] [INFO]   privateDnsName: ip-172-31-28-159.ec2.internal
[2025-04-30 14:38:03] [INFO]   privateIPv4Address: 172.31.28.159
[2025-04-30 14:38:03] [INFO] ----------------------------------------------------
[2025-04-30 14:38:03] [INFO] Recent service events for pairva-backend-service :
[2025-04-30 14:38:04] [INFO] [2025-04-30 14:37:09] (service pairva-backend-service) has started 1 tasks: (task 666d1ea4442b4039b37358dc878fc2ee).
[2025-04-30 14:38:04] [INFO] [2025-04-30 14:36:00] (service pairva-backend-service) has started 1 tasks: (task 00b0fa405eac4c08bca79d9603ea6d3e).
[2025-04-30 14:38:04] [INFO] [2025-04-30 14:34:50] (service pairva-backend-service) has started 1 tasks: (task ccdfbbf98d464ccab07247c95d96c873).
[2025-04-30 14:38:04] [INFO] [2025-04-30 14:33:50] (service pairva-backend-service) has started 1 tasks: (task 24f90ceb203c4297b47ae223423ce190).
[2025-04-30 14:38:04] [INFO] [2025-04-30 14:32:41] (service pairva-backend-service) has started 1 tasks: (task 539adacedf4c43e3bd501c0f87cd8d72).
[2025-04-30 14:38:04] [INFO] ===== END OF TASK FAILURE INVESTIGATION =====
[2025-04-30 14:38:04] [INFO] ===== TASK FAILURE INVESTIGATION FOR pairva-frontend-service =====
[2025-04-30 14:38:04] [INFO] Retrieving stopped tasks for pairva-frontend-service...
[2025-04-30 14:38:05] [INFO] Found 11 stopped tasks
[2025-04-30 14:38:05] [INFO] ----------------------------------------------------
[2025-04-30 14:38:05] [INFO] Analyzing stopped task: 0983e03d01594ad28884efbf559da938
[2025-04-30 14:38:06] [INFO] Task status: STOPPED
[2025-04-30 14:38:06] [WARNING] Stop reason: Task failed container health checks
[2025-04-30 14:38:06] [INFO] Started at: 04/30/2025 14:00:12
[2025-04-30 14:38:06] [INFO] Stopped at: 04/30/2025 14:04:02
[2025-04-30 14:38:06] [INFO] Task runtime: 3 minutes, 13 seconds
[2025-04-30 14:38:06] [INFO] Health status: UNHEALTHY
[2025-04-30 14:38:06] [INFO] Container details:
[2025-04-30 14:38:06] [INFO]   Container: pairva-frontend
[2025-04-30 14:38:06] [INFO]   Image: 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-frontend:20250423-1
[2025-04-30 14:38:06] [INFO]   Status: STOPPED
[2025-04-30 14:38:06] [SUCCESS]   Exit code: 0 (SUCCESS)
[2025-04-30 14:38:06] [INFO] Network details:
[2025-04-30 14:38:06] [INFO]   subnetId: subnet-08c81037fb224ab9d
[2025-04-30 14:38:06] [INFO]   networkInterfaceId: eni-09af0aff1c5882515
[2025-04-30 14:38:06] [INFO]   macAddress: 12:b0:aa:8d:1d:b9
[2025-04-30 14:38:06] [INFO]   privateDnsName: ip-172-31-84-23.ec2.internal
[2025-04-30 14:38:06] [INFO]   privateIPv4Address: 172.31.84.23
[2025-04-30 14:38:06] [INFO] ----------------------------------------------------
[2025-04-30 14:38:06] [INFO] ----------------------------------------------------
[2025-04-30 14:38:06] [INFO] Analyzing stopped task: 1ec1618b279141f2804126b9117d5c26
[2025-04-30 14:38:07] [INFO] Task status: STOPPED
[2025-04-30 14:38:07] [WARNING] Stop reason: Task failed container health checks
[2025-04-30 14:38:07] [INFO] Started at: 04/30/2025 14:30:57
[2025-04-30 14:38:07] [INFO] Stopped at: 04/30/2025 14:37:50
[2025-04-30 14:38:07] [INFO] Task runtime: 6 minutes, 12 seconds
[2025-04-30 14:38:07] [INFO] Health status: UNHEALTHY
[2025-04-30 14:38:07] [INFO] Container details:
[2025-04-30 14:38:07] [INFO]   Container: pairva-frontend
[2025-04-30 14:38:07] [INFO]   Image: 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-frontend:20250423-1
[2025-04-30 14:38:07] [INFO]   Status: STOPPED
[2025-04-30 14:38:07] [SUCCESS]   Exit code: 0 (SUCCESS)
[2025-04-30 14:38:07] [INFO] Network details:
[2025-04-30 14:38:07] [INFO]   subnetId: subnet-08c81037fb224ab9d
[2025-04-30 14:38:07] [INFO]   networkInterfaceId: eni-0e4f6b7abdf45ec0c
[2025-04-30 14:38:07] [INFO]   macAddress: 12:22:8a:37:f7:15
[2025-04-30 14:38:07] [INFO]   privateDnsName: ip-172-31-82-251.ec2.internal
[2025-04-30 14:38:07] [INFO]   privateIPv4Address: 172.31.82.251
[2025-04-30 14:38:07] [INFO] ----------------------------------------------------
[2025-04-30 14:38:07] [INFO] ----------------------------------------------------
[2025-04-30 14:38:07] [INFO] Analyzing stopped task: 673986c0a1824362a8780be11106b95b
[2025-04-30 14:38:08] [INFO] Task status: STOPPED
[2025-04-30 14:38:08] [WARNING] Stop reason: Task failed container health checks
[2025-04-30 14:38:08] [INFO] Started at: 04/30/2025 14:27:12
[2025-04-30 14:38:08] [INFO] Stopped at: 04/30/2025 14:34:28
[2025-04-30 14:38:08] [INFO] Task runtime: 6 minutes, 43 seconds
[2025-04-30 14:38:08] [INFO] Health status: UNHEALTHY
[2025-04-30 14:38:08] [INFO] Container details:
[2025-04-30 14:38:08] [INFO]   Container: pairva-frontend
[2025-04-30 14:38:08] [INFO]   Image: 039612856036.dkr.ecr.us-east-1.amazonaws.com/pairva-frontend:20250423-1
[2025-04-30 14:38:08] [INFO]   Status: STOPPED
[2025-04-30 14:38:08] [SUCCESS]   Exit code: 0 (SUCCESS)
[2025-04-30 14:38:08] [INFO] Network details:
[2025-04-30 14:38:08] [INFO]   subnetId: subnet-0fddd035ed46b44d1
[2025-04-30 14:38:08] [INFO]   networkInterfaceId: eni-0511804275eeca18f
[2025-04-30 14:38:08] [INFO]   macAddress: 0a:ff:dc:35:43:83
[2025-04-30 14:38:08] [INFO]   privateDnsName: ip-172-31-23-27.ec2.internal
[2025-04-30 14:38:08] [INFO]   privateIPv4Address: 172.31.23.27
[2025-04-30 14:38:08] [INFO] ----------------------------------------------------
[2025-04-30 14:38:08] [INFO] Recent service events for pairva-frontend-service :
[2025-04-30 14:38:09] [INFO] [2025-04-30 14:37:54] (service pairva-frontend-service) has started 1 tasks: (task 692bb5da98aa4c47816874a9325b2fc6). Amazon ECS replaced 1 tasks due to an unhealthy status.
[2025-04-30 14:38:09] [INFO] [2025-04-30 14:37:13] (service pairva-frontend-service) has stopped 1 running tasks: (task 1ec1618b279141f2804126b9117d5c26).
[2025-04-30 14:38:09] [INFO] [2025-04-30 14:37:13] (service pairva-frontend-service) (task 1ec1618b279141f2804126b9117d5c26) failed container health checks.
[2025-04-30 14:38:09] [INFO] [2025-04-30 14:34:30] (service pairva-frontend-service) has started 1 tasks: (task f35b3ede97d9476a915fb83787526c65). Amazon ECS replaced 1 tasks due to an unhealthy status.
[2025-04-30 14:38:09] [INFO] [2025-04-30 14:33:51] (service pairva-frontend-service) has stopped 1 running tasks: (task 673986c0a1824362a8780be11106b95b).
[2025-04-30 14:38:09] [INFO] ===== END OF TASK FAILURE INVESTIGATION =====
