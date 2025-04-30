#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Processes task definition templates and verifies required AWS resources.

.DESCRIPTION
    This script processes AWS ECS task definition templates by replacing placeholders with actual values
    and verifies or creates required AWS resources like IAM roles, CloudWatch log groups, ECR repositories, and ECS clusters.

.PARAMETER Version
    The version tag of Docker images to use. Default is "1.0.2".

.PARAMETER CreateLogGroups
    If specified, CloudWatch log groups will be created if they don't exist.

.PARAMETER CreateIAMRoles
    If specified, required IAM roles will be created if they don't exist.

.PARAMETER CreateECSCluster
    If specified, the ECS cluster will be created if it doesn't exist.

.PARAMETER CreateECRRepositories
    If specified, ECR repositories will be created if they don't exist.

.PARAMETER Verbose
    If specified, detailed logs will be displayed.

.EXAMPLE
    .\Update-TaskDefinitions-Enhanced.ps1 -Version "1.0.2" -Verbose
    Process task definitions with version 1.0.2 and verify all resources, with verbose logging.

.EXAMPLE
    .\Update-TaskDefinitions-Enhanced.ps1 -Version "1.0.2" -CreateECSCluster -CreateECRRepositories -Verbose
    Process task definitions with version 1.0.2, create ECS cluster and ECR repositories if they don't exist, with verbose logging.

.NOTES
    Author: Pairva DevOps Team
    Last Update: 2025-04-30
#>

param(
    [string]$Version = "1.0.2",
    [switch]$CreateLogGroups = $true,
    [switch]$CreateIAMRoles = $true,
    [switch]$CreateECSCluster = $true,
    [switch]$CreateECRRepositories = $true,
    [switch]$Verbose = $false
)

# Script configuration
$ErrorActionPreference = "Stop"
$VerbosePreference = if ($Verbose) { "Continue" } else { "SilentlyContinue" }

# Constants
$CLUSTER_NAME = "pairva-cluster"
$BACKEND_REPO_NAME = "pairva-backend"
$FRONTEND_REPO_NAME = "pairva-frontend"
$BACKEND_LOG_GROUP = "/ecs/pairva-backend"
$FRONTEND_LOG_GROUP = "/ecs/pairva-frontend"
$TASK_EXECUTION_ROLE = "ecsTaskExecutionRole"
$BACKEND_TASK_ROLE = "pairvaBackendTaskRole"
$FRONTEND_TASK_ROLE = "pairvaFrontendTaskRole"

# Function to process task definition templates
function Process-TaskDefinition {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [string]$AccountId,
        [string]$Region,
        [string]$Version
    )

    # Create output directory if it doesn't exist
    $outputDir = Split-Path -Parent $OutputPath
    if (-not (Test-Path $outputDir)) {
        New-Item -Path $outputDir -ItemType Directory -Force | Out-Null
    }

    Write-Verbose "Processing task definition: $InputPath"
    Write-Verbose "  AWS Account ID: $AccountId"
    Write-Verbose "  AWS Region: $Region"
    Write-Verbose "  Version: $Version"

    # Read task definition template
    $taskDefContent = Get-Content -Path $InputPath -Raw

    # Replace all placeholder variables
    $taskDefContent = $taskDefContent.Replace('${AWS_ACCOUNT_ID}', $AccountId)
    $taskDefContent = $taskDefContent.Replace('${AWS_REGION}', $Region)
    $taskDefContent = $taskDefContent.Replace('${VERSION}', $Version)

    # Write processed task definition to output file
    $taskDefContent | Out-File -FilePath $OutputPath -Encoding utf8

    Write-Verbose "Processed task definition saved to: $OutputPath"
    return $true
}

# Get AWS account ID and region
function Get-AWSAccountInfo {
    Write-Verbose "Getting AWS account information..."
    
    # Get AWS account ID
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    $accountId = $identity.Account
    Write-Verbose "AWS Account ID: $accountId"

    # Get AWS region
    $region = aws configure get region
    if (-not $region) {
        $region = "us-east-1"  # Default
        Write-Verbose "No region found in AWS configuration, using default: $region"
    } else {
        Write-Verbose "AWS Region: $region"
    }

    return @{
        AccountId = $accountId
        Region = $region
    }
}

# Ensure CloudWatch log groups exist
function Ensure-LogGroupExists {
    param(
        [string]$LogGroupName,
        [string]$Region
    )

    Write-Verbose "Checking if log group exists: $LogGroupName"

    $logGroupExists = $false
    $logGroups = aws logs describe-log-groups --log-group-name-prefix $LogGroupName --query "logGroups[?logGroupName=='$LogGroupName'].logGroupName" --output text

    if ($logGroups) {
        Write-Verbose "  Log group already exists"
        $logGroupExists = $true
    } else {
        if ($CreateLogGroups) {
            Write-Verbose "  Creating log group: $LogGroupName"
            aws logs create-log-group --log-group-name $LogGroupName --region $Region
            aws logs put-retention-policy --log-group-name $LogGroupName --retention-in-days 30 --region $Region
            Write-Verbose "  Log group created with 30-day retention"
            $logGroupExists = $true
        } else {
            Write-Warning "  Log group does not exist: $LogGroupName"
        }
    }

    return $logGroupExists
}

# Ensure IAM roles exist
function Ensure-IAMRoleExists {
    param(
        [string]$RoleName
    )

    Write-Verbose "Checking if IAM role exists: $RoleName"

    $roleExists = $false
    try {
        $role = aws iam get-role --role-name $RoleName --query "Role.RoleName" --output text
        if ($role -eq $RoleName) {
            Write-Verbose "  Role already exists"
            $roleExists = $true
        }
    } catch {
        if ($CreateIAMRoles) {
            Write-Verbose "  Role does not exist, creating it..."

            # Create assume role policy document
            $assumeRolePolicy = @'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
