#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploys the Pairva application to production environment.

.DESCRIPTION
    This script performs a complete deployment of the Pairva application to the production environment.
    It includes pre-deployment verification, application deployment, and health checks.

.PARAMETER Version
    The version tag of Docker images to deploy. If not provided, the script will use the latest tagged version.

.PARAMETER Rollback
    If specified, the script will roll back to the previous version instead of deploying a new one.

.PARAMETER Verbose
    If specified, detailed logs will be displayed.

.EXAMPLE
    .\Deploy-Production.ps1 -Version "20250422-001" -Verbose
    Deploys version 20250422-001 with verbose logging

.EXAMPLE
    .\Deploy-Production.ps1 -Rollback -Verbose
    Rolls back to the previous version with verbose logging

.NOTES
    Author: Pairva DevOps Team
    Last Update: 2025-04-22
#>

param(
    [string]$Version,
    [switch]$Rollback = $false,
    [switch]$Verbose = $false
)

# Script configuration
$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot ".." "..")
$LogFile = Join-Path $ProjectRoot "deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$StartTime = Get-Date

# Write to log file and optionally to console
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    
    Add-Content -Path $LogFile -Value $LogMessage
    
    if ($Verbose) {
        switch ($Level) {
            "ERROR" { Write-Host $LogMessage -ForegroundColor Red }
            "WARNING" { Write-Host $LogMessage -ForegroundColor Yellow }
            "SUCCESS" { Write-Host $LogMessage -ForegroundColor Green }
            default { Write-Host $LogMessage }
        }
    }
}

# Execute a command with logging and error handling
function Invoke-CommandWithLogging {
    param(
        [string]$Command,
        [string]$Description,
        [switch]$CaptureOutput = $false
    )
    
    Write-Log "Executing: $Description" "INFO"
    if ($Verbose) {
        Write-Log "Command: $Command" "DEBUG"
    }
    
    try {
        if ($CaptureOutput) {
            $output = Invoke-Expression $Command
            Write-Log "$Description completed successfully" "SUCCESS"
            return $output
        } else {
            Invoke-Expression $Command
            Write-Log "$Description completed successfully" "SUCCESS"
        }
    } catch {
        Write-Log "Error executing: $Description" "ERROR"
        Write-Log "Error details: $_" "ERROR"
        throw $_
    }
}

# Get AWS account ID and region
function Get-AWSAccountInfo {
    try {
        $identityJson = aws sts get-caller-identity --output json | ConvertFrom-Json
        $AccountId = $identityJson.Account
        
        if (-not $AccountId) {
            throw "Failed to get AWS Account ID"
        }
        
        # Get region from environment or AWS config
        $Region = $env:AWS_REGION
        if (-not $Region) {
            $Region = aws configure get region
            
            if (-not $Region) {
                $Region = "us-east-1"  # Default fallback
                Write-Log "AWS Region not found in environment or config. Using default: $Region" "WARNING"
            }
        }
        
        return @{
            AccountId = $AccountId
            Region = $Region
        }
    } catch {
        Write-Log "Error getting AWS account information: $_" "ERROR"
        throw "Failed to retrieve AWS account information: $_"
    }
}

# Verify AWS environment
function Test-AWSEnvironment {
    param(
        [string]$Region
    )
    
    Write-Log "Verifying AWS environment..." "INFO"
    
    try {
        # Verify AWS CLI credentials
        Write-Log "Checking AWS credentials..." "INFO"
        
        $identity = aws sts get-caller-identity 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "AWS credentials are invalid or expired"
        }
        
        Write-Log "AWS credentials are valid" "SUCCESS"
        
        # Verify ECR repositories
        Write-Log "Checking ECR repositories..." "INFO"
        
        $backendRepo = aws ecr describe-repositories --query "repositories[?repositoryName=='pairva-backend'].repositoryName" --output text
        $frontendRepo = aws ecr describe-repositories --query "repositories[?repositoryName=='pairva-frontend'].repositoryName" --output text
        
        if (-not $backendRepo -or -not $frontendRepo) {
            Write-Log "One or more required ECR repositories are missing" "ERROR"
            Write-Log "Backend repo: $(if($backendRepo){'FOUND'}else{'MISSING'})" "ERROR"
            Write-Log "Frontend repo: $(if($frontendRepo){'FOUND'}else{'MISSING'})" "ERROR"
            return $false
        }
        
        Write-Log "All required ECR repositories exist" "SUCCESS"
        
        # Verify ECS cluster
        Write-Log "Checking ECS cluster..." "INFO"
        
        $cluster = aws ecs describe-clusters --clusters pairva-cluster --query "clusters[0].status" --output text 2>&1
        if ($LASTEXITCODE -ne 0 -or $cluster -ne "ACTIVE") {
            Write-Log "ECS cluster is not active. Status: $($cluster ?? 'MISSING')" "ERROR"
            return $false
        }
        
        Write-Log "ECS cluster is active" "SUCCESS"
        Write-Log "AWS environment verification completed successfully" "SUCCESS"
        return $true
    } catch {
        Write-Log "Error verifying AWS environment: $_" "ERROR"
        return $false
    }
}

# Function to find previous version for rollback
function Get-PreviousVersion {
    try {
        Write-Log "Determining previous version for rollback..." "INFO"
        
        $taskDef = aws ecs describe-services --cluster pairva-cluster --services pairva-backend-service --query "services[0].taskDefinition" --output text
        $version = $taskDef -replace '.*:(\d+)$', '$1'
        
        if ($version) {
            Write-Log "Found previous version: $version" "SUCCESS"
            return $version
        } else {
            Write-Log "Could not determine previous version" "WARNING"
            return $null
        }
    } catch {
        Write-Log "Error determining previous version: $_" "ERROR"
        return $null
    }
}

# Function to perform deployment
function Start-CanaryDeployment {
    param(
        [string]$Version,
        [string]$AccountId,
        [string]$Region
    )
    
    Write-Log "Performing canary deployment..." "INFO"
    
    try {
        # Update backend service
        Write-Log "Updating backend service..." "INFO"
        
        $backendTaskDef = "pairva-backend:$Version"
        $updateCmd = "aws ecs update-service --cluster pairva-cluster --service pairva-backend-service --task-definition $backendTaskDef --deployment-configuration `"deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100`" --health-check-grace-period-seconds 120 --force-new-deployment"
        Invoke-CommandWithLogging -Command $updateCmd -Description "ECS backend service update"
        
        # Wait for backend deployment to stabilize
        Write-Log "Waiting for backend deployment to stabilize..." "INFO"
        $waitCmd = "aws ecs wait services-stable --cluster pairva-cluster --services pairva-backend-service"
        Invoke-CommandWithLogging -Command $waitCmd -Description "Wait for backend stability"
        
        # Update frontend service
        Write-Log "Updating frontend service..." "INFO"
        
        $frontendTaskDef = "pairva-frontend:$Version"
        $updateCmd = "aws ecs update-service --cluster pairva-cluster --service pairva-frontend-service --task-definition $frontendTaskDef --deployment-configuration `"deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100`" --health-check-grace-period-seconds 120 --force-new-deployment"
        Invoke-CommandWithLogging -Command $updateCmd -Description "ECS frontend service update"
        
        # Wait for frontend deployment to stabilize
        Write-Log "Waiting for frontend deployment to stabilize..." "INFO"
        $waitCmd = "aws ecs wait services-stable --cluster pairva-cluster --services pairva-frontend-service"
        Invoke-CommandWithLogging -Command $waitCmd -Description "Wait for frontend stability"
        
        Write-Log "Deployment completed successfully" "SUCCESS"
        return $true
    } catch {
        Write-Log "Error during deployment: $_" "ERROR"
        return $false
    }
}

# Function to rollback to previous version
function Start-Rollback {
    param(
        [string]$PreviousVersion
    )
    
    Write-Log "Initiating rollback to previous version: $PreviousVersion" "WARNING"
    
    try {
        # Rollback backend service
        Write-Log "Rolling back backend service to version $PreviousVersion..." "INFO"
        $rollbackCmd = "aws ecs update-service --cluster pairva-cluster --service pairva-backend-service --task-definition pairva-backend:$PreviousVersion --force-new-deployment"
        Invoke-CommandWithLogging -Command $rollbackCmd -Description "ECS backend service rollback"
        
        # Rollback frontend service
        Write-Log "Rolling back frontend service to version $PreviousVersion..." "INFO"
        $rollbackCmd = "aws ecs update-service --cluster pairva-cluster --service pairva-frontend-service --task-definition pairva-frontend:$PreviousVersion --force-new-deployment"
        Invoke-CommandWithLogging -Command $rollbackCmd -Description "ECS frontend service rollback"
        
        # Wait for services to stabilize
        Write-Log "Waiting for services to stabilize after rollback..." "INFO"
        $waitCmd = "aws ecs wait services-stable --cluster pairva-cluster --services pairva-backend-service pairva-frontend-service"
        Invoke-CommandWithLogging -Command $waitCmd -Description "Wait for services stability after rollback"
        
        Write-Log "Rollback to version $PreviousVersion completed" "SUCCESS"
        return $true
    } catch {
        Write-Log "Error during rollback: $_" "ERROR"
        return $false
    }
}

# Main execution
Write-Log "Starting Pairva production deployment" "INFO"

try {
    # Get AWS account info
    $awsInfo = Get-AWSAccountInfo
    $AccountId = $awsInfo.AccountId
    $Region = $awsInfo.Region
    
    Write-Log "AWS Account ID: $AccountId" "INFO"
    Write-Log "AWS Region: $Region" "INFO"
    
    # Verify AWS environment
    if (-not (Test-AWSEnvironment -Region $Region)) {
        throw "AWS environment verification failed"
    }
    
    # If no version specified, use timestamp version
    if (-not $Version -and -not $Rollback) {
        $Version = Get-Date -Format 'yyyyMMdd-HHmmss'
        Write-Log "No version specified. Using timestamp: $Version" "INFO"
    }
    
    # Perform deployment or rollback based on parameters
    if ($Rollback) {
        $targetVersion = Get-PreviousVersion
        if (-not $targetVersion) {
            throw "Failed to determine previous version for rollback"
        }
        
        Write-Log "Preparing to roll back to version: $targetVersion" "INFO"
        
        if (Start-Rollback -PreviousVersion $targetVersion) {
            Write-Log "Rollback to version $targetVersion completed successfully" "SUCCESS"
        } else {
            throw "Rollback to version $targetVersion failed"
        }
    } else {
        Write-Log "Preparing to deploy version: $Version" "INFO"
        
        if (Start-CanaryDeployment -Version $Version -AccountId $AccountId -Region $Region) {
            Write-Log "Deployment of version $Version completed successfully" "SUCCESS"
        } else {
            throw "Deployment of version $Version failed"
        }
    }
    
    # Calculate execution time
    $endTime = Get-Date
    $executionTime = $endTime - $StartTime
    $formattedTime = "{0:hh\:mm\:ss}" -f $executionTime
    
    Write-Log "Total execution time: $formattedTime" "INFO"
    Write-Log "Deployment script completed successfully" "SUCCESS"
    
    # Show URLs
    $loadBalancerDns = aws elbv2 describe-load-balancers --query "LoadBalancers[?contains(LoadBalancerName, 'Pairva')].DNSName" --output text
    Write-Host "`nApplication URLs:" -ForegroundColor Cyan
    Write-Host "Frontend: https://www.pairva.ai" -ForegroundColor Cyan
    Write-Host "API: https://api.pairva.ai" -ForegroundColor Cyan
    Write-Host "Health Check: https://api.pairva.ai/health" -ForegroundColor Cyan
    Write-Host "Load Balancer: https://$loadBalancerDns" -ForegroundColor Cyan
    
    exit 0
} catch {
    Write-Log "Error during deployment: $_" "ERROR"
    Write-Host "Deployment failed: $_" -ForegroundColor Red
    exit 1
}
