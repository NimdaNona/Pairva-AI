# Pairva (formerly Perfect-Match) Windows Deployment Guide

This document provides detailed instructions for deploying the Pairva application in a Windows environment.

## Prerequisites

### Docker Desktop for Windows

1. **Install Docker Desktop for Windows**
   - Download the installer from [Docker Hub](https://hub.docker.com/editions/community/docker-ce-desktop-windows/)
   - Minimum requirements:
     - Windows 10 64-bit: Pro, Enterprise, or Education (Build 18362 or later)
     - Hyper-V and Containers Windows features must be enabled
     - 4GB system RAM
     - BIOS-level hardware virtualization support

2. **Configure Docker Desktop**
   - Open Docker Desktop Settings
   - Under Resources > Advanced, allocate at least 4 CPU cores and 8GB of memory
   - Enable Kubernetes (optional, but recommended for local testing)
   - Under Docker Engine, set the following configuration:
     ```json
     {
       "registry-mirrors": [],
       "insecure-registries": [],
       "features": {
         "buildkit": true
       },
       "experimental": false,
       "builder": {
         "gc": {
           "enabled": true,
           "defaultKeepStorage": "20GB"
         }
       }
     }
     ```

### AWS CLI for Windows

1. **Install AWS CLI v2**
   ```powershell
   Invoke-WebRequest -Uri https://awscli.amazonaws.com/AWSCLIV2.msi -OutFile AWSCLIV2.msi
   Start-Process msiexec.exe -Wait -ArgumentList '/I AWSCLIV2.msi /quiet'
   ```

2. **Configure AWS CLI**
   ```powershell
   aws configure
   ```
   - Enter your AWS Access Key ID
   - Enter your AWS Secret Access Key
   - Default region: us-east-1 (or your deployment region)
   - Default output format: json

### PowerShell Requirements

1. **Verify PowerShell Version (Requires PS 5.1 or higher)**
   ```powershell
   $PSVersionTable.PSVersion
   ```

2. **Set Execution Policy**
   ```powershell
   # Run as Administrator
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. **Install AWS Tools for PowerShell**
   ```powershell
   Install-Module -Name AWS.Tools.Common -Force
   Install-Module -Name AWS.Tools.ECR -Force
   Install-Module -Name AWS.Tools.ECS -Force
   Install-Module -Name AWS.Tools.S3 -Force
   Install-Module -Name AWS.Tools.CloudFormation -Force
   ```

## Network Requirements

1. **Firewall Configuration**
   - Allow outbound connections to AWS services:
     - ECR (TCP 443)
     - ECS (TCP 443)
     - S3 (TCP 443)
     - CloudFormation (TCP 443)
     - CloudWatch (TCP 443)
   - Allow Docker to communicate with container registries

2. **VPN Configuration (if applicable)**
   - Ensure VPN software doesn't block Docker connections
   - Configure split tunneling if necessary

## Deployment Process

### 1. Project Setup

1. **Clone the Repository**
   ```powershell
   git clone https://github.com/your-organization/pairva.git
   cd pairva
   ```

2. **Install Dependencies**
   ```powershell
   # Install infrastructure dependencies
   cd infrastructure
   npm install
   cd ..

   # Install backend dependencies
   cd backend
   npm install
   cd ..

   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

### 2. Infrastructure Deployment

1. **Rename Resources (For migration from Perfect-Match to Pairva)**
   ```powershell
   # If migrating from Perfect-Match, run the rename script first
   .\infrastructure\scripts\update-deployment-resources.ps1 -Verbose
   ```

2. **Deploy CDK Stacks**
   ```powershell
   cd infrastructure
   $env:AWS_PROFILE="your-profile-name"  # If using named profiles
   cdk synth
   cdk deploy --all --require-approval never
   ```

### 3. Build and Push Docker Images

1. **Build and Push Docker Images**
   ```powershell
   .\infrastructure\scripts\Build-DockerImages.ps1 -Version "$(Get-Date -Format 'yyyyMMdd-HHmmss')" -Verbose
   ```

   This script will:
   - Authenticate with AWS ECR
   - Build backend and frontend Docker images
   - Tag images with the provided version
   - Push images to ECR repositories

### 4. Deploy Application

1. **Run Deployment Script**
   ```powershell
   .\infrastructure\scripts\Deploy-Production.ps1 -Version "20250422-001" -Verbose
   ```

   > Note: Replace "20250422-001" with the version tag used when building images

### 5. Verify Deployment

1. **Run Verification Script**
   ```powershell
   .\infrastructure\scripts\Verify-ProductionReadiness.ps1 -PostDeployment -Verbose
   ```

2. **Test Core Flows**
   ```powershell
   .\infrastructure\scripts\Test-CoreFlows.ps1 -Environment Production -Verbose
   ```

## Troubleshooting

### Docker Issues

1. **Docker Engine Not Running**
   - Check Docker Desktop is running by looking for the icon in system tray
   - Restart Docker Desktop
   - Verify Hyper-V is enabled: `Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V`

2. **Docker Build Fails**
   - Clear Docker cache: `docker builder prune -af`
   - Check disk space: `Get-PSDrive`
   - Ensure Docker can access project files (permissions)

### AWS CLI Issues

1. **Authentication Failures**
   - Check your credentials: `aws sts get-caller-identity`
   - Verify you have sufficient permissions
   - Try refreshing credentials: `aws sso login` (if using SSO)

2. **ECR Login Failures**
   - Manually test ECR login:
     ```powershell
     (Get-ECRLoginCommand).Password | docker login --username AWS --password-stdin $env:AWS_ACCOUNT_ID.dkr.ecr.$env:AWS_REGION.amazonaws.com
     ```
   - Check network connectivity

### Deployment Issues

1. **CloudFormation Stack Update Failures**
   - Check CloudFormation console for error details
   - Look at CloudWatch Logs
   - Run with `--verbose` for more details

2. **ECS Service Deployment Failures**
   - Check ECS service events in AWS console
   - Inspect task definition for errors
   - Check container logs in CloudWatch

## Rollback Procedure

1. **Rollback to Previous Version**
   ```powershell
   .\infrastructure\scripts\Deploy-Production.ps1 -Rollback -Verbose
   ```

2. **Manual Rollback**
   ```powershell
   # Get previous task definition
   $previousTaskDef = (aws ecs describe-services --cluster pairva-cluster --services pairva-backend-service --query "services[0].taskDefinition" --output text)
   
   # Update service to previous task definition
   aws ecs update-service --cluster pairva-cluster --service pairva-backend-service --task-definition $previousTaskDef --force-new-deployment
   ```

## Maintenance Tasks

### Update SSL Certificates

```powershell
# Upload new certificate to AWS Certificate Manager
$certArn = (aws acm import-certificate --certificate file://certificate.pem --private-key file://privatekey.pem --certificate-chain file://chain.pem --query "CertificateArn" --output text)

# Update CloudFront distribution with new certificate
$distId = (aws cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items, 'pairva.ai')].Id" --output text)
$config = (aws cloudfront get-distribution-config --id $distId --query "{ DistributionConfig: DistributionConfig, ETag: ETag }")
# Update certificate in $config
aws cloudfront update-distribution --id $distId --distribution-config $config.DistributionConfig --if-match $config.ETag
```

### Database Backup

```powershell
# Create manual RDS snapshot
aws rds create-db-snapshot --db-instance-identifier pairva-db --db-snapshot-identifier pairva-manual-backup-$(Get-Date -Format 'yyyyMMdd') --tags Key=Environment,Value=Production

# Backup DynamoDB table to S3
aws dynamodb export-table-to-point-in-time --table-arn arn:aws:dynamodb:$env:AWS_REGION:$env:AWS_ACCOUNT_ID:table/pairva-table --s3-bucket pairva-backups --s3-prefix $(Get-Date -Format 'yyyyMMdd')
```

### Monitoring and Alerts

```powershell
# Set up CloudWatch dashboard
aws cloudwatch put-dashboard --dashboard-name Pairva-Production --dashboard-body (Get-Content -Path .\infrastructure\monitoring\dashboard.json -Raw)

# Create alarm for high CPU usage
aws cloudwatch put-metric-alarm --alarm-name PairvaHighCPU --alarm-description "High CPU utilization" --metric-name CPUUtilization --namespace AWS/ECS --statistic Average --period 300 --threshold 70 --comparison-operator GreaterThanThreshold --dimensions Name=ClusterName,Value=pairva-cluster --evaluation-periods 3 --alarm-actions arn:aws:sns:$env:AWS_REGION:$env:AWS_ACCOUNT_ID:pairva-alerts
```

## Environment Management

### Switching Between Environments

```powershell
# Development
$env:AWS_PROFILE = "pairva-dev"
$env:ENVIRONMENT = "development"

# Staging
$env:AWS_PROFILE = "pairva-staging"
$env:ENVIRONMENT = "staging"

# Production
$env:AWS_PROFILE = "pairva-prod"
$env:ENVIRONMENT = "production"
```

### Environment Variables

```powershell
# Load environment variables from .env file
$envFile = ".\infrastructure\.env.$env:ENVIRONMENT"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            if (-not [string]::IsNullOrEmpty($name)) {
                [Environment]::SetEnvironmentVariable($name, $value)
            }
        }
    }
}
