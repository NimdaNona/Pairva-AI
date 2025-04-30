# Perfect Match Deployment Guide

This guide explains the deployment organization, issues discovered, and improvements made to the Perfect Match application deployment process.

## Project Organization

After reorganizing the deployment-related files, the project structure now follows this pattern:

```
Perfect-Match/
├── infrastructure/
│   ├── task-definitions/      # Container task definition templates
│   │   ├── backend-task-def.json         # Original task definition templates
│   │   ├── frontend-task-def.json
│   │   ├── backend-task-def-prepared.json  # Processed files with variables substituted
│   │   └── frontend-task-def-prepared.json
│   │   ├── backend-task-def-fixed.json     # Fixed task definitions (if needed for reference)
│   │   └── frontend-task-def-fixed.json
│   ├── scripts/               # Deployment and infrastructure scripts
│   │   ├── Update-TaskDefinitions.ps1      # New script for task definition preprocessing
│   │   ├── Deploy-Production.ps1           # Original deployment script
│   │   └── Deploy-Production-Fixed.ps1     # Enhanced deployment script
│   ├── lib/                   # CDK infrastructure code
│   │   ├── ai-matching-stack.ts            # Infrastructure stacks
│   │   ├── config.ts                       # Infrastructure configuration
│   │   └── ...
│   └── bin/                   # Infrastructure entry points
├── deployment/
│   ├── logs/                  # Centralized location for deployment logs
│   ├── reports/               # Deployment reports and summaries
│   │   ├── deployment_fixes_summary.md     # Summary of deployment issues and fixes
│   │   ├── infrastructure_reorganization.md # File organization changes
│   │   └── ...
│   └── test-results/          # Test results and verification reports
├── backend/                   # Backend application code
├── frontend/                  # Frontend application code
└── docs/                      # Documentation
```

## Deployment Issues Identified

### 1. Task Definition Variable Substitution

The task definition templates contained placeholder variables like `${AWS_ACCOUNT_ID}` and `${AWS_REGION}` that weren't being properly replaced during the deployment process. The existing deployment script only updated the container image reference.

This caused AWS Fargate to reject the task definitions with errors like:
```
Fargate requires task definition to have execution role ARN to support log driver awslogs.
```

### 2. IAM Role Management

Key IAM roles referenced in task definitions were either missing or improperly configured:
- `ecsTaskExecutionRole`: Required by ECS to execute tasks and send logs to CloudWatch
- `pairvaBackendTaskRole`: Required for backend service-specific permissions
- `pairvaFrontendTaskRole`: Required for frontend service-specific permissions

### 3. CloudWatch Logs Configuration

Log groups referenced in the task definitions (`/ecs/pairva-backend` and `/ecs/pairva-frontend`) were not created before deployment, preventing container logs from being captured and making troubleshooting difficult.

### 4. Deployment Script Limitations

The original deployment script had several limitations:
- Lack of pre-deployment verification for required resources
- Insufficient error handling and diagnostics
- No mechanism to verify health check paths and configurations

## Implemented Solutions

### 1. Task Definition Processing

We created a dedicated script (`Update-TaskDefinitions.ps1`) that:
- Systematically replaces all placeholder variables in task definition templates
- Processes both backend and frontend task definitions before deployment
- Verifies that all required variables have been replaced before registration

### 2. IAM Role Verification and Creation

The task definition processor now includes functions to:
- Check for required IAM roles
- Create missing roles automatically with appropriate permissions
- Attach proper policies based on service requirements

### 3. CloudWatch Log Group Management

We've implemented automatic detection and creation of required log groups with:
- Appropriate retention policies (30 days) to manage costs
- Proper IAM permissions for writing logs

### 4. Enhanced Deployment Script

The improved deployment script (`Deploy-Production-Fixed.ps1`) offers:
- Comprehensive pre-deployment verification
- Better error handling and diagnostics
- Enhanced health checks and monitoring

## Deployment Process

For all future deployments, follow this process:

### 1. Pre-deployment Preparation

```powershell
# Process task definitions and verify resources
.\infrastructure\scripts\Update-TaskDefinitions.ps1 -Version "1.0.2" -Verbose
```

### 2. Deployment Execution

```powershell
# Deploy using processed task definitions
.\infrastructure\scripts\Deploy-Production-Fixed.ps1 -UseProcessedTaskDefs -Version "1.0.2" -Verbose
```

### 3. Rollback (If Needed)

```powershell
# Roll back to a previous version
.\infrastructure\scripts\Deploy-Production-Fixed.ps1 -Rollback -Verbose
```

## Troubleshooting

If deployment issues occur:

1. Check logs in the `deployment/logs/` directory
2. Examine CloudWatch logs for container-specific errors
3. Verify IAM roles and permissions
4. Ensure task definition variables are correctly substituted
5. Validate health check endpoints

## Additional Resources

- `deployment/reports/deployment_fixes_summary.md` - Detailed deployment fixes
- `deployment/reports/infrastructure_reorganization.md` - File organization changes
- `docs/DEPLOYMENT_GUIDE.md` - Standard deployment procedures

## Future Improvements

1. **Infrastructure as Code**: Consider migrating IAM role and log group management to CloudFormation or AWS CDK
2. **Continuous Deployment**: Implement a full CI/CD pipeline for automated testing and deployment
3. **Monitoring**: Add comprehensive monitoring and alerting
4. **Environment Parity**: Ensure development, staging, and production environments have consistent configurations