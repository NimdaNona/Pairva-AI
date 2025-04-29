# Perfect Match Operations Framework

This operational framework outlines the procedures, commands, and verification steps for the deployment, monitoring, scaling, troubleshooting, and maintenance of the Perfect Match application in production. All commands are designed to be executed directly through the AWS CLI or via provided scripts.

## Table of Contents

1. [Deployment Operations](#1-deployment-operations)
2. [Monitoring Operations](#2-monitoring-operations)
3. [Scaling Operations](#3-scaling-operations)
4. [Troubleshooting Operations](#4-troubleshooting-operations)
5. [Routine Maintenance Operations](#5-routine-maintenance-operations)

---

## 1. Deployment Operations

### 1.1 Pre-Deployment Verification

Before initiating deployment, verify these prerequisites:

```bash
# 1. Verify AWS CLI configuration and credentials
aws sts get-caller-identity
```

Expected Output:
```
{
    "Account": "123456789012",
    "UserId": "AROAXXXXXXXXXXXXXXXXX:user",
    "Arn": "arn:aws:sts::123456789012:assumed-role/PowerUserRole/user"
}
```

Error case: If credentials are invalid or expired, you'll see:
```
An error occurred (ExpiredToken) when calling the GetCallerIdentity operation: The security token included in the request is expired
```

Resolution: Run `aws configure` to update credentials.

```bash
# 2. Verify CloudFormation stacks status
aws cloudformation describe-stacks \
  --query "Stacks[?contains(StackName, 'PerfectMatch')].{Name:StackName,Status:StackStatus}" \
  --output table
```

Expected Output:
```
----------------------------------------------------
|                 DescribeStacks                   |
+--------------------------+-----------------------+
|            Name          |        Status         |
+--------------------------+-----------------------+
|  PerfectMatch-Network    |  CREATE_COMPLETE     |
|  PerfectMatch-Storage    |  CREATE_COMPLETE     |
|  PerfectMatch-Data       |  CREATE_COMPLETE     |
|  PerfectMatch-AIMatching |  CREATE_COMPLETE     |
+--------------------------+-----------------------+
```

Error case: If any stack shows `*_FAILED` status:
```
# Get detailed error information
aws cloudformation describe-stack-events \
  --stack-name FAILED_STACK_NAME \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED'].{Logical:LogicalResourceId,Status:ResourceStatus,Reason:ResourceStatusReason}" \
  --output table
```

```bash
# 3. Verify ECR repositories exist
aws ecr describe-repositories \
  --query "repositories[?contains(repositoryName, 'perfectmatch')].repositoryName" \
  --output table
```

Expected Output:
```
------------------------------
|    DescribeRepositories    |
+----------------------------+
|  perfectmatch-frontend     |
|  perfectmatch-backend      |
+----------------------------+
```

```bash
# 4. Verify all required environment variables are set in SSM Parameter Store
aws ssm get-parameters-by-path \
  --path "/perfectmatch/production/" \
  --recursive \
  --query "Parameters[*].Name" \
  --with-decryption
```

Expected Output:
```
[
    "/perfectmatch/production/DATABASE_URL",
    "/perfectmatch/production/AUTH_SECRET",
    "/perfectmatch/production/COGNITO_USER_POOL_ID",
    "/perfectmatch/production/COGNITO_CLIENT_ID",
    "/perfectmatch/production/S3_BUCKET_NAME",
    "/perfectmatch/production/API_URL",
    "/perfectmatch/production/REDIS_URL"
]
```

### 1.2 Deployment Process

Execute the deployment script:

```bash
# Run deployment with validation
./infrastructure/scripts/deploy-production.sh --validate
```

The script performs the following operations:
1. Builds and tags Docker images
2. Pushes images to ECR
3. Updates CloudFormation stacks
4. Performs canary deployment
5. Performs health checks

Key deployment script segments:

```bash
# Build and push Docker images
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
docker build -t perfectmatch-backend:$VERSION ./backend
docker build -t perfectmatch-frontend:$VERSION ./frontend
docker tag perfectmatch-backend:$VERSION $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/perfectmatch-backend:$VERSION
docker tag perfectmatch-frontend:$VERSION $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/perfectmatch-frontend:$VERSION
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/perfectmatch-backend:$VERSION
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/perfectmatch-frontend:$VERSION

# Deploy CloudFormation stacks
aws cloudformation deploy \
  --template-file infrastructure/cdk.out/PerfectMatchPipeline.template.json \
  --stack-name PerfectMatch-Pipeline \
  --parameter-overrides Version=$VERSION \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset
```

### 1.3 Post-Deployment Health Checks

```bash
# 1. Verify ECS services are healthy
aws ecs describe-services \
  --cluster perfectmatch-cluster \
  --services perfectmatch-backend-service perfectmatch-frontend-service \
  --query "services[*].{Name:serviceName,Status:status,DesiredCount:desiredCount,RunningCount:runningCount}" \
  --output table
```

Expected Output:
```
------------------------------------------------------------------
|                       DescribeServices                          |
+---------------------+--------+---------------+------------------+
|        Name         | Status | DesiredCount  |  RunningCount    |
+---------------------+--------+---------------+------------------+
|  perfectmatch-back..| ACTIVE |      2        |       2         |
|  perfectmatch-fron..| ACTIVE |      2        |       2         |
+---------------------+--------+---------------+------------------+
```

```bash
# 2. Verify Cognito User Pool status
aws cognito-idp describe-user-pool \
  --user-pool-id $(aws ssm get-parameter --name "/perfectmatch/production/COGNITO_USER_POOL_ID" --query "Parameter.Value" --output text) \
  --query "UserPool.{Name:Name,Status:Status}"
```

Expected Output:
```
{
    "Name": "perfectmatch-users",
    "Status": "ACTIVE"
}
```

```bash
# 3. Verify API Gateway endpoints
aws apigateway get-resources \
  --rest-api-id $(aws apigateway get-rest-apis --query "items[?name=='PerfectMatchAPI'].id" --output text) \
  --query "items[*].{Path:path,Methods:resourceMethods}"
```

```bash
# 4. Verify application health endpoint
LOAD_BALANCER_DNS=$(aws elbv2 describe-load-balancers --query "LoadBalancers[?contains(LoadBalancerName, 'PerfectMatch')].DNSName" --output text)
curl -s -o /dev/null -w "%{http_code}" https://$LOAD_BALANCER_DNS/api/health
```

Expected Output:
```
200
```

### 1.4 Rollback Procedure

If post-deployment health checks fail:

```bash
# 1. Rollback to previous version
aws ecs update-service \
  --cluster perfectmatch-cluster \
  --service perfectmatch-backend-service \
  --task-definition perfectmatch-backend:$PREVIOUS_VERSION \
  --force-new-deployment

aws ecs update-service \
  --cluster perfectmatch-cluster \
  --service perfectmatch-frontend-service \
  --task-definition perfectmatch-frontend:$PREVIOUS_VERSION \
  --force-new-deployment

# 2. Verify rollback success (re-run health checks after rollback)
aws ecs describe-services \
  --cluster perfectmatch-cluster \
  --services perfectmatch-backend-service perfectmatch-frontend-service \
  --query "services[*].{Name:serviceName,TaskDefinition:taskDefinition}"
```

Expected Output (should show previous version):
```
[
    {
        "Name": "perfectmatch-backend-service",
        "TaskDefinition": "arn:aws:ecs:us-east-1:123456789012:task-definition/perfectmatch-backend:PREVIOUS_VERSION"
    },
    {
        "Name": "perfectmatch-frontend-service",
        "TaskDefinition": "arn:aws:ecs:us-east-1:123456789012:task-definition/perfectmatch-frontend:PREVIOUS_VERSION"
    }
]
```

---

## 2. Monitoring Operations

### 2.1 CloudWatch Dashboard URLs

Access the monitoring dashboards through the AWS CLI:

```bash
# Get the dashboard URLs
aws cloudwatch get-dashboard \
  --dashboard-name PerfectMatch-Production-Overview \
  | jq -r '.DashboardArn' \
  | xargs -I {} echo "https://console.aws.amazon.com/cloudwatch/home?region=$(aws configure get region)#dashboards:name=PerfectMatch-Production-Overview"
```

Expected Output:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=PerfectMatch-Production-Overview
```

Key Dashboard Components:
1. API Gateway Metrics
2. ECS Service Metrics
3. RDS Database Metrics
4. ElastiCache Redis Metrics
5. Application-specific Custom Metrics

### 2.2 CloudWatch Log Filtering

```bash
# Filter logs for ERROR level entries in the last hour
aws logs filter-log-events \
  --log-group-name /aws/ecs/perfectmatch-backend \
  --filter-pattern "ERROR" \
  --start-time $(date -u -v-1H +%s)000 \
  --query "events[*].{timestamp:timestamp,message:message}" \
  --output json

# Filter logs for slow database queries (>100ms)
aws logs filter-log-events \
  --log-group-name /aws/ecs/perfectmatch-backend \
  --filter-pattern "{ $.responseTime > 100 && $.type = \"database\" }" \
  --start-time $(date -u -v-1H +%s)000 \
  --query "events[*].{timestamp:timestamp,message:message}" \
  --output json

# Filter for failed authentication attempts
aws logs filter-log-events \
  --log-group-name /aws/ecs/perfectmatch-backend \
  --filter-pattern "authentication failed" \
  --start-time $(date -u -v-1H +%s)000 \
  --query "events[*].{timestamp:timestamp,message:message}" \
  --output json
```

### 2.3 Metrics Analysis

```bash
# Get API Gateway metrics for the last hour
aws cloudwatch get-metric-statistics \
  --namespace "AWS/ApiGateway" \
  --metric-name "Count" \
  --dimensions Name=ApiName,Value=PerfectMatchAPI \
  --start-time $(date -u -v-1H +%s) \
  --end-time $(date -u +%s) \
  --period 300 \
  --statistics Sum

# Get ECS service CPU utilization
aws cloudwatch get-metric-statistics \
  --namespace "AWS/ECS" \
  --metric-name "CPUUtilization" \
  --dimensions Name=ClusterName,Value=perfectmatch-cluster Name=ServiceName,Value=perfectmatch-backend-service \
  --start-time $(date -u -v-1H +%s) \
  --end-time $(date -u +%s) \
  --period 300 \
  --statistics Average

# Get RDS database connections
aws cloudwatch get-metric-statistics \
  --namespace "AWS/RDS" \
  --metric-name "DatabaseConnections" \
  --dimensions Name=DBInstanceIdentifier,Value=perfectmatch-db \
  --start-time $(date -u -v-1H +%s) \
  --end-time $(date -u +%s) \
  --period 300 \
  --statistics Average
```

### 2.4 Alert Management

```bash
# List active CloudWatch alarms
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --alarm-name-prefix PerfectMatch \
  --query "MetricAlarms[*].{Name:AlarmName,State:StateValue,Metric:MetricName,Since:StateUpdatedTimestamp}" \
  --output table
```

Expected Output (when alarms exist):
```
-------------------------------------------------------------------
|                       DescribeAlarms                            |
+-------------------------+---------+---------------+-------------+
|           Name          |  State  |    Metric     |    Since    |
+-------------------------+---------+---------------+-------------+
|  PerfectMatch-API-5XX   |  ALARM  |  5XXError     | 1618498732  |
+-------------------------+---------+---------------+-------------+
```

Alarm Investigation Procedure:

1. For high error rate alarms:
```bash
# Get the error logs related to the alarm
aws logs filter-log-events \
  --log-group-name /aws/ecs/perfectmatch-backend \
  --filter-pattern "ERROR" \
  --start-time $(date -u -v-30M +%s)000 \
  --query "events[*].{timestamp:timestamp,message:message}" \
  --output json
```

2. For CPU/memory alarms:
```bash
# Check scaling metrics
aws cloudwatch get-metric-statistics \
  --namespace "AWS/ECS" \
  --metric-name "CPUUtilization" \
  --dimensions Name=ClusterName,Value=perfectmatch-cluster Name=ServiceName,Value=perfectmatch-backend-service \
  --start-time $(date -u -v-1H +%s) \
  --end-time $(date -u +%s) \
  --period 60 \
  --statistics Average
```

### 2.5 Custom Monitoring

```bash
# Report active users in the last 15 minutes
aws cloudwatch get-metric-statistics \
  --namespace "PerfectMatch" \
  --metric-name "ActiveUsers" \
  --dimensions Name=Environment,Value=Production \
  --start-time $(date -u -v-15M +%s) \
  --end-time $(date -u +%s) \
  --period 60 \
  --statistics Maximum

# Check match generation rate
aws cloudwatch get-metric-statistics \
  --namespace "PerfectMatch" \
  --metric-name "MatchesGenerated" \
  --dimensions Name=Environment,Value=Production \
  --start-time $(date -u -v-1H +%s) \
  --end-time $(date -u +%s) \
  --period 300 \
  --statistics Sum
```

---

## 3. Scaling Operations

### 3.1 Auto-Scaling Verification

```bash
# Verify backend auto-scaling configuration
aws application-autoscaling describe-scaling-policies \
  --service-namespace ecs \
  --resource-ids service/perfectmatch-cluster/perfectmatch-backend-service \
  --query "ScalingPolicies[*].{Name:PolicyName,Type:PolicyType,TargetValue:TargetTrackingScalingPolicyConfiguration.TargetValue}" \
  --output table
```

Expected Output:
```
---------------------------------------------------------------
|                 DescribeScalingPolicies                     |
+-----------------------------+------------------+------------+
|             Name            |       Type       | TargetValue|
+-----------------------------+------------------+------------+
|  cpu-tracking-scaling-policy| TargetTracking   |    70.0    |
+-----------------------------+------------------+------------+
```

```bash
# Verify current service scaling status
aws ecs describe-services \
  --cluster perfectmatch-cluster \
  --services perfectmatch-backend-service \
  --query "services[*].{Name:serviceName,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount}" \
  --output table
```

Expected Output:
```
------------------------------------------------------------------
|                       DescribeServices                          |
+---------------------+---------------+-------------+-------------+
|        Name         | DesiredCount  | RunningCount| PendingCount|
+---------------------+---------------+-------------+-------------+
|  perfectmatch-back..|      2        |      2      |      0      |
+---------------------+---------------+-------------+-------------+
```

### 3.2 Manual Scaling Commands

```bash
# Increase backend service capacity by 2 tasks
aws ecs update-service \
  --cluster perfectmatch-cluster \
  --service perfectmatch-backend-service \
  --desired-count $(aws ecs describe-services --cluster perfectmatch-cluster --services perfectmatch-backend-service --query "services[0].desiredCount" --output text | xargs -I {} echo "{} + 2" | bc)

# Increase frontend service capacity by 2 tasks
aws ecs update-service \
  --cluster perfectmatch-cluster \
  --service perfectmatch-frontend-service \
  --desired-count $(aws ecs describe-services --cluster perfectmatch-cluster --services perfectmatch-frontend-service --query "services[0].desiredCount" --output text | xargs -I {} echo "{} + 2" | bc)

# Verify the new desired count
aws ecs describe-services \
  --cluster perfectmatch-cluster \
  --services perfectmatch-backend-service perfectmatch-frontend-service \
  --query "services[*].{Name:serviceName,DesiredCount:desiredCount,RunningCount:runningCount}" \
  --output table
```

### 3.3 Database Scaling

```bash
# Get current RDS instance details
aws rds describe-db-instances \
  --db-instance-identifier perfectmatch-db \
  --query "DBInstances[*].{DBInstanceClass:DBInstanceClass,AllocatedStorage:AllocatedStorage,AvailabilityZone:AvailabilityZone}" \
  --output table
```

Expected Output:
```
------------------------------------------------------------------------------
|                          DescribeDBInstances                               |
+------------------------+-------------------+-----------------------------+
|    DBInstanceClass     | AllocatedStorage  |      AvailabilityZone       |
+------------------------+-------------------+-----------------------------+
|  db.r5.large           |        100        |      us-east-1a             |
+------------------------+-------------------+-----------------------------+
```

```bash
# Modify database instance class (vertical scaling)
aws rds modify-db-instance \
  --db-instance-identifier perfectmatch-db \
  --db-instance-class db.r5.xlarge \
  --apply-immediately

# Increase storage (can be done without downtime)
aws rds modify-db-instance \
  --db-instance-identifier perfectmatch-db \
  --allocated-storage 200 \
  --apply-immediately
```

### 3.4 Scaling Verification

```bash
# Verify service scaling completed
aws ecs describe-services \
  --cluster perfectmatch-cluster \
  --services perfectmatch-backend-service perfectmatch-frontend-service \
  --query "services[*].{Name:serviceName,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount,Events:events[0:2].message}" \
  --output table
```

```bash
# Verify RDS scaling status
aws rds describe-db-instances \
  --db-instance-identifier perfectmatch-db \
  --query "DBInstances[*].{DBInstanceClass:DBInstanceClass,AllocatedStorage:AllocatedStorage,Status:DBInstanceStatus,PendingModifiedValues:PendingModifiedValues}" \
  --output json
```

Expected Output (while scaling is in progress):
```json
[
    {
        "DBInstanceClass": "db.r5.large",
        "AllocatedStorage": 100,
        "Status": "modifying",
        "PendingModifiedValues": {
            "DBInstanceClass": "db.r5.xlarge",
            "AllocatedStorage": 200
        }
    }
]
```

Expected Output (after scaling completes):
```json
[
    {
        "DBInstanceClass": "db.r5.xlarge",
        "AllocatedStorage": 200,
        "Status": "available",
        "PendingModifiedValues": {}
    }
]
```

### 3.5 Auto Scaling Group Adjustment

```bash
# Update ECS cluster auto scaling group
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name perfectmatch-ecs-asg \
  --min-size 3 \
  --max-size 10 \
  --desired-capacity 5

# Verify auto scaling group changes
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names perfectmatch-ecs-asg \
  --query "AutoScalingGroups[*].{MinSize:MinSize,MaxSize:MaxSize,DesiredCapacity:DesiredCapacity,Instances:Instances[*].{Id:InstanceId,State:LifecycleState}}" \
  --output json
```

---

## 4. Troubleshooting Operations

### 4.1 Service Health Checks

```bash
# Check ECS service events for errors
aws ecs describe-services \
  --cluster perfectmatch-cluster \
  --services perfectmatch-backend-service perfectmatch-frontend-service \
  --query "services[*].{Name:serviceName,Status:status,Events:events[0:5].{Timestamp:createdAt,Message:message}}" \
  --output json

# Check task health status
aws ecs list-tasks \
  --cluster perfectmatch-cluster \
  --service-name perfectmatch-backend-service \
  | jq -r '.taskArns[]' \
  | xargs -I {} aws ecs describe-tasks --cluster perfectmatch-cluster --tasks {} \
  --query "tasks[*].{TaskId:taskArn,LastStatus:lastStatus,HealthStatus:healthStatus,Containers:containers[*].{Name:name,Status:lastStatus,Reason:reason}}"

# Verify load balancer target health
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups --query "TargetGroups[?contains(TargetGroupName, 'PerfectMatch')].TargetGroupArn" --output text) \
  --query "TargetHealthDescriptions[*].{Target:Target.Id,Port:Target.Port,Status:TargetHealth.State,Reason:TargetHealth.Reason}" \
  --output table
```

Expected Output:
```
----------------------------------------------------------------------
|                       DescribeTargetHealth                          |
+------------------+--------+-------------+-------------------------+
|      Target      |  Port  |   Status    |         Reason          |
+------------------+--------+-------------+-------------------------+
|  i-0abc123def456 |  8080  |  healthy    |                         |
|  i-0def456abc789 |  8080  |  healthy    |                         |
+------------------+--------+-------------+-------------------------+
```

Error Pattern:
```
+------------------+--------+-------------+-------------------------+
|      Target      |  Port  |   Status    |         Reason          |
+------------------+--------+-------------+-------------------------+
|  i-0abc123def456 |  8080  |  unhealthy  | Health checks failed    |
+------------------+--------+-------------+-------------------------+
```

### 4.2 Log Analysis

```bash
# Check application error logs in the last 15 minutes
aws logs filter-log-events \
  --log-group-name /aws/ecs/perfectmatch-backend \
  --filter-pattern "ERROR" \
  --start-time $(date -u -v-15M +%s)000 \
  --query "events[*].{timestamp:timestamp,message:message}" \
  --output json

# Check for database timeout errors
aws logs filter-log-events \
  --log-group-name /aws/ecs/perfectmatch-backend \
  --filter-pattern "timed out" \
  --start-time $(date -u -v-15M +%s)000 \
  --query "events[*].{timestamp:timestamp,message:message}" \
  --output json

# Check for memory-related issues
aws logs filter-log-events \
  --log-group-name /aws/ecs/perfectmatch-backend \
  --filter-pattern "memory" \
  --start-time $(date -u -v-15M +%s)000 \
  --query "events[*].{timestamp:timestamp,message:message}" \
  --output json
```

### 4.3 Database Query Performance

```bash
# Get recent slow query log entries
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/perfectmatch-db/slowquery \
  --start-time $(date -u -v-60M +%s)000 \
  --query "events[*].{timestamp:timestamp,message:message}" \
  --output json

# Get RDS performance metrics
aws cloudwatch get-metric-statistics \
  --namespace "AWS/RDS" \
  --metric-name "CPUUtilization" \
  --dimensions Name=DBInstanceIdentifier,Value=perfectmatch-db \
  --start-time $(date -u -v-30M +%s) \
  --end-time $(date -u +%s) \
  --period 60 \
  --statistics Average \
  --output json
  
# Get database connections
aws cloudwatch get-metric-statistics \
  --namespace "AWS/RDS" \
  --metric-name "DatabaseConnections" \
  --dimensions Name=DBInstanceIdentifier,Value=perfectmatch-db \
  --start-time $(date -u -v-30M +%s) \
  --end-time $(date -u +%s) \
  --period 60 \
  --statistics Average \
  --output json
```

### 4.4 User Impact Assessment

```bash
# Check active user sessions
aws cloudwatch get-metric-statistics \
  --namespace "PerfectMatch" \
  --metric-name "ActiveSessions" \
  --dimensions Name=Environment,Value=Production \
  --start-time $(date -u -v-30M +%s) \
  --end-time $(date -u +%s) \
  --period 60 \
  --statistics Maximum \
  --output json

# Check API response time
aws cloudwatch get-metric-statistics \
  --namespace "AWS/ApiGateway" \
  --metric-name "Latency" \
  --dimensions Name=ApiName,Value=PerfectMatchAPI \
  --start-time $(date -u -v-30M +%s) \
  --end-time $(date -u +%s) \
  --period 60 \
  --statistics Average p90 p99 \
  --output json

# Check authentication failure rate
aws cloudwatch get-metric-statistics \
  --namespace "PerfectMatch" \
  --metric-name "AuthFailures" \
  --dimensions Name=Environment,Value=Production \
  --start-time $(date -u -v-30M +%s) \
  --end-time $(date -u +%s) \
  --period 60 \
  --statistics Sum \
  --output json
```

### 4.5 Troubleshooting Decision Tree

For HTTP 5XX errors:
```bash
# Step 1: Check application logs for errors
aws logs filter-log-events \
  --log-group-name /aws/ecs/perfectmatch-backend \
  --filter-pattern "ERROR" \
  --start-time $(date -u -v-15M +%s)000 \
  --query "events[*].{timestamp:timestamp,message:message}" \
  --output json

# Step 2: If database-related errors, check RDS metrics
aws cloudwatch get-metric-statistics \
  --namespace "AWS/RDS" \
  --metric-name "CPUUtilization" \
  --dimensions Name=DBInstanceIdentifier,Value=perfectmatch-db \
  --start-time $(date -u -v-30M +%s) \
  --end-time $(date -u +%s) \
  --period 60 \
  --statistics Average \
  --output json

# Step 3: If memory pressure indicated, check container metrics
aws cloudwatch get-metric-statistics \
  --namespace "AWS/ECS" \
  --metric-name "MemoryUtilization" \
  --dimensions Name=ClusterName,Value=perfectmatch-cluster Name=ServiceName,Value=perfectmatch-backend-service \
  --start-time $(date -u -v-30M +%s) \
  --end-time $(date -u +%s) \
  --period 60 \
  --statistics Average \
  --output json

# Step 4: If resource issues confirmed, scale the service
aws ecs update-service \
  --cluster perfectmatch-cluster \
  --service perfectmatch-backend-service \
  --desired-count $(aws ecs describe-services --cluster perfectmatch-cluster --services perfectmatch-backend-service --query "services[0].desiredCount" --output text | xargs -I {} echo "{} + 2" | bc)
```

For Authentication Issues:
```bash
# Step 1: Check Cognito service status
aws cognito-idp describe-user-pool \
  --user-pool-id $(aws ssm get-parameter --name "/perfectmatch/production/COGNITO_USER_POOL_ID" --query "Parameter.Value" --output text) \
  --query "UserPool.{Name:Name,Status:Status}"

# Step 2: Check authentication logs
aws logs filter-log-events \
  --log-group-name /aws/ecs/perfectmatch-backend \
  --filter-pattern "authentication" \
  --start-time $(date -u -v-15M +%s)000 \
  --query "events[*].{timestamp:timestamp,message:message}" \
  --output json

# Step 3: Verify Cognito configuration
aws cognito-idp describe-user-pool-client \
  --user-pool-id $(aws ssm get-parameter --name "/perfectmatch/production/COGNITO_USER_POOL_ID" --query "Parameter.Value" --output text) \
  --client-id $(aws ssm get-parameter --name "/perfectmatch/production/COGNITO_CLIENT_ID" --query "Parameter.Value" --output text) \
  --query "UserPoolClient.{ClientId:ClientId,CallbackURLs:CallbackURLs,LogoutURLs:LogoutURLs,EnabledAuthFlows:ExplicitAuthFlows}" \
  --output json
```

---

## 5. Routine Maintenance Operations

### 5.1 Database Maintenance

```bash
# Schedule RDS maintenance window
aws rds modify-db-instance \
  --db-instance-identifier perfectmatch-db \
  --preferred-maintenance-window "sun:05:00-sun:06:00"

# View pending maintenance actions
aws rds describe-pending-maintenance-actions \
  --query "PendingMaintenanceActions[*].{ResourceIdentifier:ResourceIdentifier,Action:PendingMaintenanceActionDetails[0].Action,Description:PendingMaintenanceActionDetails[0].Description,AutoAppliedAfterDate:PendingMaintenanceActionDetails[0].AutoAppliedAfterDate}"

# Perform database VACUUM operation on PostgreSQL
aws rds-data execute-statement \
  --resource-arn arn:aws:rds:us-east-1:123456789012:cluster:perfectmatch-db-cluster \
  --secret-arn arn:aws:secretsmanager:us-east-1:123456789012:secret:perfectmatch/db-credentials \
  --database perfectmatch \
  --sql "VACUUM ANALYZE profiles;"

# Check for database bloat in key tables
aws rds-data execute-statement \
  --resource-arn arn:aws:rds:us-east-1:123456789012:cluster:perfectmatch-db-cluster \
  --secret-arn arn:aws:secretsmanager:us-east-1:123456789012:secret:perfectmatch/db-credentials \
  --database perfectmatch \
  --sql "SELECT schemaname, relname, n_dead_tup, n_live_tup, last_vacuum FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;"
```

### 5.2 Backup Verification

```bash
# List available automated backups
aws rds describe-db-instance-automated-backups \
  --db-instance-identifier perfectmatch-db \
  --query "DBInstanceAutomatedBackups[*].{BackupTime:BackupCreationDate,SnapshotType:SnapshotType,Status:Status}" \
  --output table

# Create a backup verification instance from a specific snapshot
LATEST_SNAPSHOT_ID=$(aws rds describe-db-snapshots \
  --db-instance-identifier perfectmatch-db \
  --snapshot-type automated \
  --query "DBSnapshots[0].DBSnapshotIdentifier" \
  --output text)

aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier perfectmatch-db-verification \
  --db-snapshot-identifier $LATEST_SNAPSHOT_ID \
  --db-instance-class db.t3.medium \
  --no-multi-az \
  --tags Key=Purpose,Value=BackupVerification

# Run backup integrity check script
./infrastructure/scripts/backup-verification.sh --database perfectmatch-db-verification

# Delete verification instance after test
aws rds delete-db-instance \
  --db-instance-identifier perfectmatch-db-verification \
  --skip-final-snapshot
```

Expected verification script output:
```
Backup verification for perfectmatch-db-verification...
Testing database connectivity: SUCCESS
Verifying table structure: SUCCESS
Verifying row counts (sampling 5 tables): SUCCESS
Verifying data integrity (random samples from 3 tables): SUCCESS
Verifying stored procedures: SUCCESS
```

### 5.3 Certificate Rotation

```bash
# Check when SSL certificates will expire
aws apigateway get-client-certificate \
  --client-certificate-id $(aws apigateway get-client-certificates --query "items[0].clientCertificateId" --output text) \
  --query "{Id:clientCertificateId,ExpirationDate:expirationDate}"

# Update ACM certificate for API Gateway
aws acm import-certificate \
  --certificate file://infrastructure/certs/perfectmatch-2025.pem \
  --private-key file://infrastructure/certs/perfectmatch-2025-key.pem \
  --certificate-chain file://infrastructure/certs/ca-chain.pem \
  --certificate-arn $(aws acm list-certificates --query "CertificateSummaryList[?DomainName=='api.perfectmatch.example.com'].CertificateArn" --output text)

# Update ACM certificate for CloudFront distribution
aws acm import-certificate \
  --certificate file://infrastructure/certs/perfectmatch-2025.pem \
  --private-key file://infrastructure/certs/perfectmatch-2025-key.pem \
  --certificate-chain file://infrastructure/certs/ca-chain.pem \
  --certificate-arn $(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='perfectmatch.example.com'].CertificateArn" --output text)

# Verify new certificate is active
aws acm describe-certificate \
  --certificate-arn $(aws acm list-certificates --query "CertificateSummaryList[?DomainName=='api.perfectmatch.example.com'].CertificateArn" --output text) \
  --query "{Domain:DomainName,Status:Status,NotAfter:NotAfter}"
```

Expected Output:
```json
{
    "Domain": "api.perfectmatch.example.com",
    "Status": "ISSUED",
    "NotAfter": "2025-05-01T00:00:00.000Z"
}
```

### 5.4 Security Patch Application

```bash
# List available ECS container updates
aws ecs describe-container-instances \
  --cluster perfectmatch-cluster \
  --container-instances $(aws ecs list-container-instances --cluster perfectmatch-cluster --query "containerInstanceArns" --output text) \
  --query "containerInstances[*].{InstanceId:ec2InstanceId,AgentVersion:versionInfo.agentVersion,DockerVersion:versionInfo.dockerVersion,AgentUpdateStatus:agentUpdateStatus}"

# Update system packages on EC2 instances
aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --targets "Key=tag:Name,Values=PerfectMatch-ECS-Instance" \
  --parameters commands="yum -y update" \
  --output text

# Verify instance patch status
aws ssm list-command-invocations \
  --command-id $(aws ssm list-commands --query "Commands[0].CommandId" --output text) \
  --details \
  --query "CommandInvocations[*].{InstanceId:InstanceId,Status:Status,Output:CommandPlugins[0].Output}"

# Rotate database credentials
aws secretsmanager rotate-secret \
  --secret-id perfectmatch/db-credentials \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:perfectmatch-secrets-rotation

# Verify security groups are properly configured
aws ec2 describe-security-groups \
  --group-ids $(aws ec2 describe-security-groups --query "SecurityGroups[?contains(GroupName, 'PerfectMatch')].GroupId" --output text) \
  --query "SecurityGroups[*].{Name:GroupName,Id:GroupId,IngressRules:IpPermissions[*].{Protocol:IpProtocol,FromPort:FromPort,ToPort:ToPort,Source:IpRanges[0].CidrIp}}" \
  --output json
```

---

This operations framework provides a comprehensive set of procedures and commands for managing the Perfect Match application in production. Each section includes detailed commands, expected outputs, error patterns, and resolution steps to ensure smooth operation and quick recovery from any issues.
