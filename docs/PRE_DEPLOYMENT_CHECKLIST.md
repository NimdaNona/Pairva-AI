# Pre-Deployment Checklist for Windows Environment

This document provides a comprehensive checklist to ensure your Windows environment is properly configured for deploying the Pairva (formerly Perfect-Match) application.

## System Requirements

- [ ] Windows 10 (version 1903 or later) or Windows 11
- [ ] At least 16GB RAM
- [ ] At least 50GB free disk space
- [ ] PowerShell 5.1 or later (PowerShell 7.x recommended)
- [ ] Administrator access

## Docker Configuration

- [ ] Docker Desktop for Windows is installed
      - Download from: https://www.docker.com/products/docker-desktop
- [ ] Docker Desktop is configured with at least:
      - 8GB RAM
      - 4 CPU cores
      - 40GB disk image size 
- [ ] WSL 2 backend is enabled
- [ ] Linux containers mode is active (not Windows containers)
- [ ] Docker engine experimental features are enabled
- [ ] Docker BuildKit is enabled
- [ ] Shared drives/volumes are properly configured
- [ ] Docker network is not blocked by corporate firewall

## AWS Configuration

- [ ] AWS CLI v2 is installed
      ```powershell
      # Verify installation
      aws --version
      ```
- [ ] AWS credentials are configured
      ```powershell
      # Verify configuration
      aws configure list
      aws sts get-caller-identity
      ```
- [ ] AWS region is correctly set to deployment region
- [ ] AWS IAM user/role has the following permissions:
      - AmazonECR-FullAccess
      - AmazonECS-FullAccess
      - AmazonS3FullAccess
      - AmazonDynamoDBFullAccess
      - AmazonRDSFullAccess
      - AmazonCognitoFullAccess
      - CloudWatchFullAccess
      - IAMFullAccess
      - CloudFormationFullAccess

## PowerShell Configuration

- [ ] PowerShell execution policy is set to allow scripts
      ```powershell
      # Check current policy
      Get-ExecutionPolicy
      
      # Set policy if needed (run as Administrator)
      Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
      ```
- [ ] AWS.Tools PowerShell modules are installed (optional but recommended)
      ```powershell
      # Install required modules
      Install-Module -Name AWS.Tools.Common -Force
      Install-Module -Name AWS.Tools.ECR -Force
      Install-Module -Name AWS.Tools.ECS -Force
      Install-Module -Name AWS.Tools.S3 -Force
      Install-Module -Name AWS.Tools.CloudFormation -Force
      ```
- [ ] TLS 1.2 or later is enabled
      ```powershell
      # Enable TLS 1.2
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      ```

## Network Requirements

- [ ] Outbound connections to the following services are allowed:
      - AWS services (*.amazonaws.com)
      - Docker Hub (*.docker.io)
      - npm registry (registry.npmjs.org)
      - GitHub (*.github.com)
- [ ] No VPN restrictions that block Docker or AWS connectivity
- [ ] HTTP proxy configuration (if applicable) is set for:
      - Docker Desktop
      - AWS CLI
      - npm
      - git

## Project-Specific Requirements

- [ ] Node.js 16.x is installed
      ```powershell
      # Verify installation
      node --version
      npm --version
      ```
- [ ] AWS CDK is installed globally
      ```powershell
      # Install AWS CDK globally
      npm install -g aws-cdk
      
      # Verify installation
      cdk --version
      ```
- [ ] Git is installed and configured
      ```powershell
      # Verify installation
      git --version
      ```
- [ ] Project repository is cloned
      ```powershell
      # Clone repository if not already done
      git clone https://github.com/your-organization/pairva.git
      cd pairva
      ```

## AWS Resource Verification

- [ ] ECR repositories exist (or can be created)
      ```powershell
      # List existing repositories
      aws ecr describe-repositories --query "repositories[*].repositoryName" --output table
      ```
- [ ] ECS clusters are configured
      ```powershell
      # List existing clusters
      aws ecs list-clusters
      ```
- [ ] Required SSM parameters are configured
      ```powershell
      # List SSM parameters with specific path prefix
      aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=/pairva/" --query "Parameters[*].Name" --output table
      ```
- [ ] S3 buckets are created and accessible
      ```powershell
      # List S3 buckets
      aws s3 ls
      ```

## Security Verification

- [ ] AWS credentials are not expired
- [ ] MFA is set up for AWS account (if applicable)
- [ ] AWS credentials are not hardcoded in any project files
- [ ] Local .env files are properly configured with required values
- [ ] Access keys have proper permissions but follow principle of least privilege

## Final Checks

- [ ] All deployment scripts have been reviewed and updated for Windows compatibility
- [ ] All Docker configurations have been tested locally
- [ ] Development environment deployment has been tested successfully
- [ ] Required environment variables are set
- [ ] Backup of current state is created before deployment

## Troubleshooting Preparation

- [ ] AWS CloudWatch Logs access is configured
- [ ] AWS Support contact information is available
- [ ] Rollback procedures are documented and understood
- [ ] Team communication channels are established for deployment coordination
