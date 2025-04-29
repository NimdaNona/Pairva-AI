#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Builds and pushes Docker images for the Pairva application to AWS ECR.

.DESCRIPTION
    This script builds Docker images for the Pairva backend and frontend
    tags them with the provided version and pushes them to AWS ECR repositories.
    It includes comprehensive error handling and logging.

.PARAMETER Version
    The version tag to apply to the Docker images. If not provided a timestamp-based
    version in the format 'yyyyMMdd-HHmmss' will be used.

.PARAMETER SkipPush
    If specified the script will build the images but skip pushing them to ECR.

.PARAMETER BackendOnly
    If specified only the backend image will be built and pushed.

.PARAMETER FrontendOnly
    If specified only the frontend image will be built and pushed.

.PARAMETER Verbose
    If specified detailed logs will be displayed.

.EXAMPLE
    .\Build-DockerImages.ps1 -Version "1.2.3"
    Builds and pushes images with version tag 1.2.3

.EXAMPLE
    .\Build-DockerImages.ps1 -SkipPush -Verbose
    Builds images with a timestamp version tag displays verbose logs and skips pushing to ECR

.NOTES
    Author: Pairva DevOps Team
    Last Update: 2025-04-22
#>

param(
    [string]$Version = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    [switch]$SkipPush = $false,
    [switch]$BackendOnly = $false,
    [switch]$FrontendOnly = $false,
    [switch]$Verbose = $false
)

# Script configuration
$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot ".." "..")
$LogFile = Join-Path $ProjectRoot "docker-build-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
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

# Authenticate with ECR
function Connect-ECR {
    param(
        [string]$AccountId,
        [string]$Region
    )

    try {
        Write-Log "Authenticating with AWS ECR in region $Region" "INFO"

        # Use AWS CLI for ECR authentication
        Write-Log "Using AWS CLI for ECR authentication" "INFO"
        
        # Get ECR login password and use it with docker login
        aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "$AccountId.dkr.ecr.$Region.amazonaws.com" | Out-Null

        Write-Log "Successfully authenticated with ECR" "SUCCESS"
        return "$AccountId.dkr.ecr.$Region.amazonaws.com"
    } catch {
        Write-Log "Failed to authenticate with ECR: $_" "ERROR"
        throw "ECR authentication failed: $_"
    }
}

# Ensure ECR repositories exist
function Ensure-ECRRepositoryExists {
    param(
        [string]$RepositoryName,
        [string]$Region
    )

    try {
        Write-Log "Checking if ECR repository '$RepositoryName' exists" "INFO"

        $repoExists = aws ecr describe-repositories --repository-names $RepositoryName --region $Region 2>&1

        if ($LASTEXITCODE -ne 0) {
            Write-Log "Creating ECR repository: $RepositoryName" "INFO"
            aws ecr create-repository --repository-name $RepositoryName --region $Region | Out-Null
        }

        Write-Log "ECR repository '$RepositoryName' is ready" "SUCCESS"
    } catch {
        Write-Log "Error checking/creating ECR repository: $_" "ERROR"
        throw "Failed to ensure ECR repository exists: $_"
    }
}

# Build and push Docker image
function Build-DockerImage {
    param(
        [string]$ImageName,
        [string]$DockerfilePath,
        [string]$ContextPath,
        [string]$Tag,
        [string]$ECRRepo,
        [switch]$SkipPush = $false
    )

    try {
        $FullImageName = "$ImageName`:$Tag"
        $FullECRImageName = "$ECRRepo/$ImageName`:$Tag"

        # Clean node_modules to avoid permission issues
        if (Test-Path (Join-Path $ContextPath "node_modules")) {
            Write-Log "Removing node_modules folder to avoid permission issues" "INFO"
            Remove-Item -Path (Join-Path $ContextPath "node_modules") -Recurse -Force
        }

        # Set build-time environment variables
        $buildArgs = ""
        if ($ImageName -eq "pairva-frontend") {
            $buildArgs = "--build-arg CI=true"
            Write-Log "Setting frontend build environment variables" "INFO"
        }

        # Build the image
        $buildCmd = "docker build $buildArgs -t $FullImageName -f '$DockerfilePath' '$ContextPath'"
        Invoke-CommandWithLogging -Command $buildCmd -Description "Building $ImageName image"

        # Tag the image for ECR
        $tagCmd = "docker tag $FullImageName $FullECRImageName"
        Invoke-CommandWithLogging -Command $tagCmd -Description "Tagging $ImageName image for ECR"

        if (-not $SkipPush) {
            # Push the image to ECR
            $pushCmd = "docker push $FullECRImageName"
            Invoke-CommandWithLogging -Command $pushCmd -Description "Pushing $ImageName image to ECR"
        }

        return $FullECRImageName
    } catch {
        Write-Log "Error processing $ImageName image: $_" "ERROR"
        throw "Failed to build/push $ImageName image: $_"
    }
}

# Main function
function Start-ImageBuild {
    Write-Log "Starting Docker image build process for Pairva" "INFO"
    Write-Log "Version tag: $Version" "INFO"
    Write-Log "Skip Push: $SkipPush" "INFO"
    Write-Log "Backend Only: $BackendOnly" "INFO"
    Write-Log "Frontend Only: $FrontendOnly" "INFO"

    try {
        # Validate paths
        if (-not (Test-Path $BackendDir)) {
            throw "Backend directory not found: $BackendDir"
        }

        if (-not (Test-Path $FrontendDir)) {
            throw "Frontend directory not found: $FrontendDir"
        }

        # Get AWS account info
        $awsInfo = Get-AWSAccountInfo
        $AccountId = $awsInfo.AccountId
        $Region = $awsInfo.Region

        Write-Log "AWS Account ID: $AccountId" "INFO"
        Write-Log "AWS Region: $Region" "INFO"

        # Connect to ECR
        $ecrRepo = Connect-ECR -AccountId $AccountId -Region $Region

        # Create repositories if needed
        if (-not $FrontendOnly) {
            Ensure-ECRRepositoryExists -RepositoryName "pairva-backend" -Region $Region
        }

        if (-not $BackendOnly) {
            Ensure-ECRRepositoryExists -RepositoryName "pairva-frontend" -Region $Region
        }

        # Build and push images
        $results = @{}

        if (-not $FrontendOnly) {
            Write-Log "Processing backend image" "INFO"
            $backendDockerfile = Join-Path $BackendDir "Dockerfile"

            if (-not (Test-Path $backendDockerfile)) {
                throw "Backend Dockerfile not found: $backendDockerfile"
            }

            $results.Backend = Build-DockerImage -ImageName "pairva-backend" -DockerfilePath $backendDockerfile -ContextPath $BackendDir -Tag $Version -ECRRepo $ecrRepo -SkipPush:$SkipPush
        }

        if (-not $BackendOnly) {
            Write-Log "Processing frontend image" "INFO"
            $frontendDockerfile = Join-Path $FrontendDir "Dockerfile"

            if (-not (Test-Path $frontendDockerfile)) {
                throw "Frontend Dockerfile not found: $frontendDockerfile"
            }

            $results.Frontend = Build-DockerImage -ImageName "pairva-frontend" -DockerfilePath $frontendDockerfile -ContextPath $FrontendDir -Tag $Version -ECRRepo $ecrRepo -SkipPush:$SkipPush
        }

        # Calculate execution time
        $endTime = Get-Date
        $executionTime = $endTime - $StartTime
        $formattedTime = "{0:hh\:mm\:ss}" -f $executionTime

        # Show results
        Write-Log "Docker image build process completed successfully" "SUCCESS"
        Write-Log "Total execution time: $formattedTime" "INFO"

        if (-not $FrontendOnly) {
            Write-Log "Backend image: $($results.Backend)" "SUCCESS"
        }

        if (-not $BackendOnly) {
            Write-Log "Frontend image: $($results.Frontend)" "SUCCESS"
        }

        return $results
    } catch {
        Write-Log "Error in Docker image build process: $_" "ERROR"
        throw "Docker image build failed: $_"
    }
}

# Execute main function
try {
    $buildResults = Start-ImageBuild

    # For verbose output print instructions for the next steps
    if ($Verbose) {
        Write-Host "`nImages successfully built and pushed. You can now use the following commands to deploy:" -ForegroundColor Green
        Write-Host ".\infrastructure\scripts\Deploy-Production.ps1 -Version `"$Version`" -Verbose" -ForegroundColor Cyan
    }

    exit 0
} catch {
    Write-Host "Build process failed: $_" -ForegroundColor Red
    exit 1
}
