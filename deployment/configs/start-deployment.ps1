#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Automates the deployment process for Pairva application to production.

.DESCRIPTION
    This script orchestrates the entire deployment process including:
    - Running pre-deployment checks
    - Building and pushing Docker images
    - Deploying CDK stacks
    - Deploying application services
    - Verifying deployment success

.PARAMETER Environment
    The target environment (dev, staging, or prod).

.PARAMETER Version
    The version tag for the deployment. If not provided, a timestamp will be used.

.PARAMETER SkipTests
    If specified, skips running tests before deployment.

.PARAMETER Verbose
    If specified, provides detailed output during deployment.

.EXAMPLE
    .\start-deployment.ps1 -Environment prod -Verbose

.EXAMPLE
    .\start-deployment.ps1 -Environment staging -SkipTests -Version "20250423-1"

.NOTES
    Author: Pairva DevOps Team
    Last Update: 2025-04-23
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    [string]$Version = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    [switch]$SkipTests = $false,
    [switch]$Verbose = $false
)

# Script configuration
$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$LogFile = Join-Path $ProjectRoot "deployment-$Environment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$StartTime = Get-Date

# Import utility functions
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    
    Add-Content -Path $LogFile -Value $LogMessage
    
    if ($Verbose -or $Level -ne "INFO") {
        switch ($Level) {
            "ERROR" { Write-Host $LogMessage -ForegroundColor Red }
            "WARNING" { Write-Host $LogMessage -ForegroundColor Yellow }
            "SUCCESS" { Write-Host $LogMessage -ForegroundColor Green }
            default { Write-Host $LogMessage }
        }
    }
}

function Invoke-CommandWithLogging {
    param(
        [string]$Command,
        [string]$Description,
        [switch]$CaptureOutput = $false,
        [switch]$ContinueOnError = $false
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
        if (-not $ContinueOnError) {
            throw $_
        }
    }
}

# Step 1: Pre-deployment checks
function Test-PreDeploymentChecks {
    Write-Log "Step 1: Running pre-deployment checks..." "INFO"
    
    # Check if AWS CLI is installed
    try {
        $awsVersion = Invoke-CommandWithLogging -Command "aws --version" -Description "Checking AWS CLI installation" -CaptureOutput
        Write-Log "AWS CLI is installed: $awsVersion" "INFO"
    } catch {
        Write-Log "AWS CLI is not installed or not in PATH" "ERROR"
        return $false
    }
    
    # Check AWS credentials
    try {
        $identity = Invoke-CommandWithLogging -Command "aws sts get-caller-identity --output json" -Description "Checking AWS credentials" -CaptureOutput
        $accountId = ($identity | ConvertFrom-Json).Account
        Write-Log "AWS credentials are valid for account: $accountId" "SUCCESS"
    } catch {
        Write-Log "AWS credentials are invalid or expired" "ERROR"
        return $false
    }
    
    # Check Docker installation
    try {
        $dockerVersion = Invoke-CommandWithLogging -Command "docker --version" -Description "Checking Docker installation" -CaptureOutput
        Write-Log "Docker is installed: $dockerVersion" "INFO"
    } catch {
        Write-Log "Docker is not installed or not in PATH" "ERROR"
        return $false
    }
    
    # Run TypeScript builds to check for errors
    Write-Log "Building backend to check for TypeScript errors..." "INFO"
    if (-not (Invoke-CommandWithLogging -Command "cd backend && npm run build" -Description "Building backend" -ContinueOnError)) {
        Write-Log "Backend build failed - TypeScript errors detected" "ERROR"
        return $false
    }
    
    Write-Log "Building frontend to check for TypeScript errors..." "INFO"
    if (-not (Invoke-CommandWithLogging -Command "cd frontend && npm run build" -Description "Building frontend" -ContinueOnError)) {
        Write-Log "Frontend build failed - TypeScript errors detected" "ERROR"
        return $false
    }
    
    # Run tests if not skipped
    if (-not $SkipTests) {
        Write-Log "Running backend tests..." "INFO"
        if (-not (Invoke-CommandWithLogging -Command "cd backend && npm test" -Description "Running backend tests" -ContinueOnError)) {
            Write-Log "Backend tests failed" "ERROR"
            return $false
        }
        
        Write-Log "Running frontend tests..." "INFO"
        if (-not (Invoke-CommandWithLogging -Command "cd frontend && npm test" -Description "Running frontend tests" -ContinueOnError)) {
            Write-Log "Frontend tests failed" "ERROR"
            return $false
        }
    } else {
        Write-Log "Skipping tests as requested" "WARNING"
    }
    
    Write-Log "All pre-deployment checks passed" "SUCCESS"
    return $true
}

# Step 2: Build and push Docker images
function Invoke-DockerBuildAndPush {
    Write-Log "Step 2: Building and pushing Docker images..." "INFO"
    
    # Use the Build-DockerImages.ps1 script
    if (Test-Path -Path "infrastructure/scripts/Build-DockerImages.ps1") {
        Invoke-CommandWithLogging -Command "infrastructure/scripts/Build-DockerImages.ps1 -Version $Version -Environment $Environment" -Description "Building and pushing Docker images"
    } else {
        # Fallback if script doesn't exist
        # Build backend image
        Invoke-CommandWithLogging -Command "docker build -t pairva-backend:$Version -f backend/Dockerfile backend" -Description "Building backend Docker image"
        
        # Build frontend image
        Invoke-CommandWithLogging -Command "docker build -t pairva-frontend:$Version -f frontend/Dockerfile frontend" -Description "Building frontend Docker image"
        
        # Get AWS account ID
        $accountId = (Invoke-CommandWithLogging -Command "aws sts get-caller-identity --query Account --output text" -Description "Getting AWS account ID" -CaptureOutput).Trim()
        $region = (Invoke-CommandWithLogging -Command "aws configure get region" -Description "Getting AWS region" -CaptureOutput).Trim()
        
        # Tag and push backend image
        $backendImageUri = "$accountId.dkr.ecr.$region.amazonaws.com/pairva-backend:$Version"
        Invoke-CommandWithLogging -Command "docker tag pairva-backend:$Version $backendImageUri" -Description "Tagging backend image"
        Invoke-CommandWithLogging -Command "aws ecr get-login-password | docker login --username AWS --password-stdin $accountId.dkr.ecr.$region.amazonaws.com" -Description "Logging in to ECR"
        Invoke-CommandWithLogging -Command "docker push $backendImageUri" -Description "Pushing backend image to ECR"
        
        # Tag and push frontend image
        $frontendImageUri = "$accountId.dkr.ecr.$region.amazonaws.com/pairva-frontend:$Version"
        Invoke-CommandWithLogging -Command "docker tag pairva-frontend:$Version $frontendImageUri" -Description "Tagging frontend image"
        Invoke-CommandWithLogging -Command "docker push $frontendImageUri" -Description "Pushing frontend image to ECR"
    }
    
    Write-Log "Docker images built and pushed successfully" "SUCCESS"
    return $true
}

# Step 3: Deploy CDK stacks
function Invoke-CDKDeployment {
    Write-Log "Step 3: Deploying CDK stacks..." "INFO"
    
    # Set CDK context for environment
    $cdkContext = "--context environment=$Environment"
    
    # Deploy stacks in order
    $stacks = @(
        "PairvaNetworkStack",
        "PairvaStorageStack",
        "PairvaDataStack",
        "PairvaDomainStack",
        "PairvaMonitoringStack"
    )
    
    foreach ($stack in $stacks) {
        Write-Log "Deploying CDK stack: $stack" "INFO"
        $deployCommand = "cd infrastructure && npx cdk deploy $stack $cdkContext --require-approval never"
        if (-not (Invoke-CommandWithLogging -Command $deployCommand -Description "Deploying CDK stack: $stack" -ContinueOnError)) {
            Write-Log "Failed to deploy CDK stack: $stack" "ERROR"
            return $false
        }
    }
    
    Write-Log "All CDK stacks deployed successfully" "SUCCESS"
    return $true
}

# Step 4: Deploy application
function Invoke-ApplicationDeployment {
    Write-Log "Step 4: Deploying application services..." "INFO"
    
    # Use the Deploy-Production.ps1 script
    if (Test-Path -Path "infrastructure/scripts/Deploy-Production.ps1") {
        Invoke-CommandWithLogging -Command "infrastructure/scripts/Deploy-Production.ps1 -Version $Version -Verbose:$Verbose" -Description "Deploying application services"
    } else {
        Write-Log "Deployment script not found: infrastructure/scripts/Deploy-Production.ps1" "ERROR"
        return $false
    }
    
    Write-Log "Application services deployed successfully" "SUCCESS"
    return $true
}

# Step 5: Verify deployment
function Test-DeploymentSuccess {
    Write-Log "Step 5: Verifying deployment success..." "INFO"
    
    # Wait for a moment to allow services to initialize
    Start-Sleep -Seconds 30
    
    # Check backend health
    try {
        $healthCheck = Invoke-CommandWithLogging -Command "curl -s -o /dev/null -w '%{http_code}' https://api.pairva.ai/health" -Description "Checking backend health" -CaptureOutput
        if ($healthCheck -eq "200") {
            Write-Log "Backend health check succeeded" "SUCCESS"
        } else {
            Write-Log "Backend health check failed with status code: $healthCheck" "ERROR"
            return $false
        }
    } catch {
        Write-Log "Failed to perform backend health check: $_" "ERROR"
        return $false
    }
    
    # Check frontend availability
    try {
        $frontendCheck = Invoke-CommandWithLogging -Command "curl -s -o /dev/null -w '%{http_code}' https://www.pairva.ai" -Description "Checking frontend availability" -CaptureOutput
        if ($frontendCheck -eq "200") {
            Write-Log "Frontend availability check succeeded" "SUCCESS"
        } else {
            Write-Log "Frontend availability check failed with status code: $frontendCheck" "ERROR"
            return $false
        }
    } catch {
        Write-Log "Failed to perform frontend availability check: $_" "ERROR"
        return $false
    }
    
    # Run automated tests if available
    if (Test-Path -Path "infrastructure/scripts/Test-CoreFlows.ps1") {
        Invoke-CommandWithLogging -Command "infrastructure/scripts/Test-CoreFlows.ps1" -Description "Running core flow tests" -ContinueOnError
    }
    
    Write-Log "Deployment verification completed successfully" "SUCCESS"
    return $true
}

# Main deployment orchestration
try {
    Write-Log "Starting deployment of Pairva application to $Environment environment" "INFO"
    Write-Log "Version: $Version" "INFO"
    
    # Run all deployment steps
    $preChecksPassed = Test-PreDeploymentChecks
    if (-not $preChecksPassed) {
        throw "Pre-deployment checks failed. Aborting deployment."
    }
    
    $dockerBuildSuccess = Invoke-DockerBuildAndPush
    if (-not $dockerBuildSuccess) {
        throw "Docker build and push failed. Aborting deployment."
    }
    
    $cdkDeploySuccess = Invoke-CDKDeployment
    if (-not $cdkDeploySuccess) {
        throw "CDK stack deployment failed. Aborting deployment."
    }
    
    $appDeploySuccess = Invoke-ApplicationDeployment
    if (-not $appDeploySuccess) {
        throw "Application deployment failed. Aborting deployment."
    }
    
    $verificationSuccess = Test-DeploymentSuccess
    if (-not $verificationSuccess) {
        throw "Deployment verification failed. Deployment may be incomplete or unstable."
    }
    
    # Calculate execution time
    $endTime = Get-Date
    $executionTime = $endTime - $StartTime
    $formattedTime = "{0:hh\:mm\:ss}" -f $executionTime
    
    Write-Log "Total deployment time: $formattedTime" "INFO"
    Write-Log "Deployment to $Environment environment completed successfully" "SUCCESS"
    
    # Show URLs
    Write-Host "`nApplication URLs:" -ForegroundColor Cyan
    Write-Host "Frontend: https://www.pairva.ai" -ForegroundColor Cyan
    Write-Host "API: https://api.pairva.ai" -ForegroundColor Cyan
    Write-Host "Health Check: https://api.pairva.ai/health" -ForegroundColor Cyan
    
    exit 0
} catch {
    Write-Log "Deployment failed: $_" "ERROR"
    Write-Host "Deployment failed: $_" -ForegroundColor Red
    
    # Ask if rollback is needed
    $rollback = Read-Host "Do you want to roll back to the previous version? (y/n)"
    if ($rollback -eq "y") {
        Write-Log "Initiating rollback..." "WARNING"
        Invoke-CommandWithLogging -Command "infrastructure/scripts/Deploy-Production.ps1 -Rollback -Verbose:$Verbose" -Description "Rolling back deployment" -ContinueOnError
    }
    
    exit 1
}
