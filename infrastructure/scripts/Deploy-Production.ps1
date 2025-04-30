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

.PARAMETER UseProcessedTaskDefs
    If specified, the script will use pre-processed task definition files instead of generating them on-the-fly.
    These files should be located at infrastructure/task-definitions/backend-task-def-prepared.json
    and infrastructure/task-definitions/frontend-task-def-prepared.json.

.PARAMETER Verbose
    If specified, detailed logs will be displayed.

.EXAMPLE
    .\Deploy-Production.ps1 -Version "20250422-001" -Verbose
    Deploys version 20250422-001 with verbose logging

.EXAMPLE
    .\Deploy-Production.ps1 -UseProcessedTaskDefs -Version "20250422-001" -Verbose
    Deploys using pre-processed task definition files with verbose logging

.EXAMPLE
    .\Deploy-Production.ps1 -Rollback -Verbose
    Rolls back to the previous version with verbose logging

.NOTES
    Author: Pairva DevOps Team
    Last Update: 2025-04-30
#>

param(
    [string]$Version,
    [switch]$Rollback = $false,
    [switch]$UseProcessedTaskDefs = $false,
    [switch]$Verbose = $false
)

# Script configuration
$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot ".." "..")
$LogFile = Join-Path $ProjectRoot "deployment/logs/deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$StartTime = Get-Date

# Create logs directory if it doesn't exist
$logsDir = Split-Path -Parent $LogFile
if (-not (Test-Path $logsDir)) {
    New-Item -Path $logsDir -ItemType Directory -Force | Out-Null
}

# Task definition paths
$BackendTaskDefPath = Join-Path $ProjectRoot "infrastructure/task-definitions/backend-task-def.json"
$FrontendTaskDefPath = Join-Path $ProjectRoot "infrastructure/task-definitions/frontend-task-def.json"
$BackendTaskDefPreparedPath = Join-Path $ProjectRoot "infrastructure/task-definitions/backend-task-def-prepared.json"
$FrontendTaskDefPreparedPath = Join-Path $ProjectRoot "infrastructure/task-definitions/frontend-task-def-prepared.json"

# Update-TaskDefinitions script path
$UpdateTaskDefinitionsScript = Join-Path $ProjectRoot "infrastructure/scripts/Update-TaskDefinitions.ps1"

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

# Verify processed task definitions exist
function Test-ProcessedTaskDefinitions {
    Write-Log "Verifying processed task definition files..." "INFO"
    
    $backendExists = Test-Path $BackendTaskDefPreparedPath
    $frontendExists = Test-Path $FrontendTaskDefPreparedPath
    
    if (-not $backendExists) {
        Write-Log "Backend task definition not found at: $BackendTaskDefPreparedPath" "ERROR"
        return $false
    }
    
    if (-not $frontendExists) {
        Write-Log "Frontend task definition not found at: $FrontendTaskDefPreparedPath" "ERROR"
        return $false
    }
    
    # Verify content of task definitions
    try {
        $backendTaskDef = Get-Content -Path $BackendTaskDefPreparedPath -Raw | ConvertFrom-Json
        $frontendTaskDef = Get-Content -Path $FrontendTaskDefPreparedPath -Raw | ConvertFrom-Json
        
        # Check if variables were properly substituted
        if ($backendTaskDef.containerDefinitions[0].image -match '\${AWS_ACCOUNT_ID}' -or
            $backendTaskDef.containerDefinitions[0].image -match '\${AWS_REGION}' -or
            $backendTaskDef.containerDefinitions[0].image -match '\${VERSION}') {
            Write-Log "Backend task definition has unsubstituted variables" "ERROR"
            return $false
        }
        
        if ($frontendTaskDef.containerDefinitions[0].image -match '\${AWS_ACCOUNT_ID}' -or
            $frontendTaskDef.containerDefinitions[0].image -match '\${AWS_REGION}' -or
            $frontendTaskDef.containerDefinitions[0].image -match '\${VERSION}') {
            Write-Log "Frontend task definition has unsubstituted variables" "ERROR"
            return $false
        }
        
        Write-Log "Processed task definition files verified successfully" "SUCCESS"
        return $true
    } catch {
        Write-Log "Error verifying processed task definitions: $_" "ERROR"
        return $false
    }
}

# Function to investigate failed tasks with comprehensive details
function Get-FailedTaskInfo {
    param(
        [string]$Cluster,
        [string]$Service,
        [switch]$AllStopped = $false,
        [int]$LogLines = 50,
        [switch]$DetailedReport = $false
    )
    
    Write-Log "===== TASK FAILURE INVESTIGATION FOR $Service =====" "INFO"
    
    # Get stopped tasks
    Write-Log "Retrieving stopped tasks for $Service..." "INFO"
    $stoppedTasks = aws ecs list-tasks --cluster $Cluster --service-name $Service --desired-status STOPPED | ConvertFrom-Json
    
    if (-not $stoppedTasks -or $stoppedTasks.taskArns.Count -eq 0) {
        Write-Log "No stopped tasks found for $Service" "INFO"
        return
    }
    
    Write-Log "Found $($stoppedTasks.taskArns.Count) stopped tasks" "INFO"
    
    # Define how many stopped tasks to analyze
    $tasksToCheck = if ($AllStopped) { $stoppedTasks.taskArns } else { $stoppedTasks.taskArns | Select-Object -First 3 }
    
    foreach ($taskArn in $tasksToCheck) {
        $taskId = $taskArn.Split('/')[-1]
        Write-Log "----------------------------------------------------" "INFO"
        Write-Log "Analyzing stopped task: $taskId" "INFO"
        
        # Get detailed task information
        $taskDetails = aws ecs describe-tasks --cluster $Cluster --tasks $taskArn | ConvertFrom-Json
        $task = $taskDetails.tasks[0]
        
        Write-Log "Task status: $($task.lastStatus)" "INFO"
        Write-Log "Stop reason: $($task.stoppedReason)" "WARNING"
        Write-Log "Started at: $($task.createdAt)" "INFO"
        Write-Log "Stopped at: $($task.stoppedAt)" "INFO"
        
        $taskRunTime = if ($task.stoppedAt -and $task.startedAt) {
            $stopTime = [DateTime]$task.stoppedAt
            $startTime = [DateTime]$task.startedAt
            $runTime = $stopTime - $startTime
            "$([Math]::Floor($runTime.TotalMinutes)) minutes, $($runTime.Seconds) seconds"
        } else {
            "Unknown"
        }
        Write-Log "Task runtime: $taskRunTime" "INFO"
        
        # Check for task health status
        if ($task.healthStatus) {
            Write-Log "Health status: $($task.healthStatus)" "INFO"
        }
        
        # Get container details
        Write-Log "Container details:" "INFO"
        foreach ($container in $task.containers) {
            Write-Log "  Container: $($container.name)" "INFO"
            Write-Log "  Image: $($container.image)" "INFO"
            Write-Log "  Status: $($container.lastStatus)" "INFO"
            
            # Exit code and reason
            if ($null -ne $container.exitCode) {
                $exitStatus = if ($container.exitCode -eq 0) { "SUCCESS" } else { "ERROR" }
                $logLevel = if($container.exitCode -eq 0){"SUCCESS"}else{"WARNING"}
                Write-Log "  Exit code: $($container.exitCode) ($exitStatus)" $logLevel
            }
            
            if ($container.reason) {
                Write-Log "  Failure reason: $($container.reason)" "WARNING"
            }
            
            # Container health check details
            if ($container.health) {
                Write-Log "  Health status: $($container.health.status)" "INFO"
                if ($container.health.statusSince) {
                    Write-Log "  Health status since: $($container.health.statusSince)" "INFO"
                }
            }
            
            # Retrieve container logs if exit code is non-zero
            if ($container.exitCode -ne 0 -and $container.exitCode -ne $null) {
                $logGroup = "/ecs/$Cluster"
                # Fix log stream name format
                $logStream = "$Cluster/$($container.name)/$taskId"
                
                Write-Log "  Retrieving logs from CloudWatch (stream: $logStream)..." "INFO"
                try {
                    $logsCmd = "aws logs get-log-events --log-group-name `"$logGroup`" --log-stream-name `"$logStream`" --limit $LogLines --output json 2>&1"
                    $logs = Invoke-Expression $logsCmd
                    
                    if ($LASTEXITCODE -eq 0) {
                        $logsJson = $logs | ConvertFrom-Json
                        
                        if ($logsJson.events.Count -gt 0) {
                            Write-Log "  Last $LogLines log entries:" "INFO"
                            $count = 1
                            foreach ($event in $logsJson.events) {
                                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).DateTime.ToString("yyyy-MM-dd HH:mm:ss")
                                # Format logs with timestamp and line number
                                Write-Log "    [$timestamp] $($event.message)" "INFO"
                                $count++
                            }
                        } else {
                            Write-Log "  No log entries found for this container" "WARNING"
                        }
                    } else {
                        Write-Log "  Failed to retrieve logs: $logs" "WARNING"
                        
                        # Try alternative log group format
                        $altLogGroup = "/aws/ecs/$Cluster"
                        Write-Log "  Trying alternative log group: $altLogGroup" "INFO"
                        $logsCmd = "aws logs get-log-events --log-group-name `"$altLogGroup`" --log-stream-name `"$logStream`" --limit $LogLines --output json 2>&1"
                        $logs = Invoke-Expression $logsCmd
                        
                        if ($LASTEXITCODE -eq 0) {
                            $logsJson = $logs | ConvertFrom-Json
                            if ($logsJson.events.Count -gt 0) {
                                Write-Log "  Last $LogLines log entries:" "INFO"
                                foreach ($event in $logsJson.events) {
                                    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).DateTime.ToString("yyyy-MM-dd HH:mm:ss")
                                    Write-Log "    [$timestamp] $($event.message)" "INFO"
                                }
                            } else {
                                Write-Log "  No log entries found in alternative log group" "WARNING"
                            }
                        } else {
                            Write-Log "  Failed to retrieve logs from alternative log group" "WARNING"
                        }
                    }
                } catch {
                    Write-Log "  Error retrieving logs: $_" "ERROR"
                }
            }
        }
        
        # Task networking information
        if ($DetailedReport -and $task.attachments) {
            Write-Log "Network details:" "INFO"
            $networkAttachment = $task.attachments | Where-Object { $_.type -eq "ElasticNetworkInterface" }
            if ($networkAttachment) {
                foreach ($detail in $networkAttachment.details) {
                    Write-Log "  $($detail.name): $($detail.value)" "INFO"
                }
            }
        }
        
        Write-Log "----------------------------------------------------" "INFO"
    }
    
    # Check for service events that might indicate deployment issues
    Write-Log "Recent service events for $Service :" "INFO"
    $serviceEvents = aws ecs describe-services --cluster $Cluster --services $Service --query "services[0].events[0:5]" | ConvertFrom-Json
    foreach ($event in $serviceEvents) {
        $eventTime = [DateTime]$event.createdAt
        $formattedTime = $eventTime.ToString("yyyy-MM-dd HH:mm:ss")
        Write-Log "[$formattedTime] $($event.message)" "INFO"
    }
    
    Write-Log "===== END OF TASK FAILURE INVESTIGATION =====" "INFO"
}

# Function to generate a deployment summary report
function Get-DeploymentSummary {
    param(
        [string]$Cluster,
        [string]$Version,
        [switch]$IncludeEvents = $true
    )
    
    Write-Log "===== DEPLOYMENT SUMMARY FOR VERSION $Version =====" "INFO"
    
    # Get services in the cluster
    $services = @("pairva-backend-service", "pairva-frontend-service")
    
    $allServicesHealthy = $true
    $serviceDetails = @()
    
    foreach ($service in $services) {
        Write-Log "Checking service: $service" "INFO"
        $serviceInfo = aws ecs describe-services --cluster $Cluster --services $service | ConvertFrom-Json
        $serviceData = $serviceInfo.services[0]
        
        # Basic service status
        $desiredCount = $serviceData.desiredCount
        $runningCount = $serviceData.runningCount
        $pendingCount = $serviceData.pendingCount
        $serviceArn = $serviceData.serviceArn
        
        $healthStatus = if ($runningCount -eq $desiredCount) { "HEALTHY" } else { "DEGRADED" }
        if ($healthStatus -ne "HEALTHY") {
            $allServicesHealthy = $false
        }
        
        Write-Log "$service Status: $healthStatus" $(if($healthStatus -eq "HEALTHY"){"SUCCESS"}else{"WARNING"})
        Write-Log "  Running: $runningCount/$desiredCount tasks" "INFO"
        
        if ($pendingCount -gt 0) {
            Write-Log "  Pending tasks: $pendingCount" "WARNING"
        }
        
        # Deployment info
        $primaryDeployment = $serviceData.deployments | Where-Object { $_.status -eq "PRIMARY" }
        if ($primaryDeployment) {
            $deploymentId = $primaryDeployment.id
            $deploymentStatus = $primaryDeployment.status
            $rolloutState = $primaryDeployment.rolloutState
            $rolloutStateReason = $primaryDeployment.rolloutStateReason
            
            Write-Log "  Deployment ID: $deploymentId" "INFO"
            Write-Log "  Deployment Status: $deploymentStatus" "INFO"
            Write-Log "  Rollout State: $rolloutState" $(if($rolloutState -eq "COMPLETED"){"SUCCESS"}else{"INFO"})
            
            if ($rolloutStateReason) {
                Write-Log "  Rollout State Reason: $rolloutStateReason" "INFO"
            }
            
            # Check for circuit breaker status
            if ($rolloutState -eq "FAILED") {
                Write-Log "  Deployment circuit breaker was activated!" "ERROR"
                if ($primaryDeployment.rolloutStateReason) {
                    Write-Log "  Reason: $($primaryDeployment.rolloutStateReason)" "ERROR"
                }
            }
        }
        
        # Check for recent service events if requested
        if ($IncludeEvents) {
            $recentEvents = $serviceData.events | Select-Object -First 3
            if ($recentEvents) {
                Write-Log "  Recent service events:" "INFO"
                foreach ($event in $recentEvents) {
                    $eventTime = [DateTime]$event.createdAt
                    $timeAgo = [math]::Round(((Get-Date) - $eventTime).TotalMinutes)
                    Write-Log "    [$timeAgo minutes ago] $($event.message)" "INFO"
                }
            }
        }
        
        $serviceDetails += @{
            "Service" = $service
            "Status" = $healthStatus
            "Running" = $runningCount
            "Desired" = $desiredCount
            "DeploymentState" = $rolloutState
        }
        
        # Add a separator between services
        Write-Log "----------------------------------------------------" "INFO"
    }
    
    # Overall deployment status
    if ($allServicesHealthy) {
        Write-Log "DEPLOYMENT STATUS: SUCCESSFUL ✅" "SUCCESS"
        Write-Log "All services are running the desired number of tasks." "SUCCESS"
    } else {
        Write-Log "DEPLOYMENT STATUS: DEGRADED ⚠️" "WARNING"
        Write-Log "One or more services are not running the desired number of tasks." "WARNING"
        
        # If services are degraded, get task failure info
        foreach ($service in $services) {
            $serviceInfo = $serviceDetails | Where-Object { $_["Service"] -eq $service }
            if ($serviceInfo["Status"] -ne "HEALTHY") {
                Write-Log "Investigating issues with $service..." "INFO"
                Get-FailedTaskInfo -Cluster $Cluster -Service $service
            }
        }
    }
    
    Write-Log "===== END OF DEPLOYMENT SUMMARY =====" "INFO"
    
    return $allServicesHealthy
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
        [string]$Region,
        [bool]$UseProcessedTaskDefs
    )
    
    Write-Log "Performing canary deployment..." "INFO"
    
    try {
        # Update backend service
        Write-Log "Updating backend service..." "INFO"
        
        if ($UseProcessedTaskDefs) {
            # Use the prepared task definition file
            Write-Log "Using processed backend task definition from $BackendTaskDefPreparedPath" "INFO"
            $backendTaskDefContent = Get-Content -Path $BackendTaskDefPreparedPath -Raw
            $backendTaskDefObj = $backendTaskDefContent | ConvertFrom-Json
        } else {
            # Get current backend task definition
            Write-Log "Getting current backend task definition..." "INFO"
            $currentBackendTaskDef = Invoke-CommandWithLogging -Command "aws ecs describe-task-definition --task-definition pairva-backend --query 'taskDefinition' --output json | ConvertFrom-Json" -Description "Get backend task definition" -CaptureOutput
            
            # Update image in container definition
            $backendImage = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/pairva-backend:${Version}"
            Write-Log "Setting backend image to: $backendImage" "INFO"
            $currentBackendTaskDef.containerDefinitions[0].image = $backendImage
            $backendTaskDefObj = $currentBackendTaskDef
        }
        
        # Save task definition to temp file
        $backendTaskDefPath = Join-Path $env:TEMP "backend-task-def-$Version.json"
        Write-Log "Saving backend task definition to $backendTaskDefPath" "INFO"
        $backendTaskDefObj | Select-Object -Property family, containerDefinitions, volumes, placementConstraints, requiresCompatibilities, networkMode, cpu, memory | ConvertTo-Json -Depth 10 | Out-File $backendTaskDefPath -Encoding utf8
        
        # Register new task definition
        Write-Log "Registering new backend task definition..." "INFO"
        $newBackendTaskDef = Invoke-CommandWithLogging -Command "aws ecs register-task-definition --cli-input-json file://$backendTaskDefPath | ConvertFrom-Json" -Description "Register backend task definition" -CaptureOutput
        $newBackendTaskDefArn = $newBackendTaskDef.taskDefinition.taskDefinitionArn
        Write-Log "New backend task definition ARN: $newBackendTaskDefArn" "INFO"
        
        # Update service with new task definition
        $updateCmd = "aws ecs update-service --cluster pairva-cluster --service pairva-backend-service --task-definition $newBackendTaskDefArn --deployment-configuration `"deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100`" --health-check-grace-period-seconds 120 --force-new-deployment"
        Invoke-CommandWithLogging -Command $updateCmd -Description "ECS backend service update"
        
        # Wait for backend deployment to stabilize with timeout
        Write-Log "Waiting for backend deployment to stabilize..." "INFO"
        $maxWaitTime = 900 # 15 minutes
        $startWaitTime = Get-Date
        $serviceStable = $false
        
        while (-not $serviceStable -and ((Get-Date) - $startWaitTime).TotalSeconds -lt $maxWaitTime) {
            Write-Log "Checking backend service stability ($(Get-Date -Format 'HH:mm:ss'))..." "INFO"
            $serviceStatus = aws ecs describe-services --cluster pairva-cluster --services pairva-backend-service | ConvertFrom-Json
            
            if ($serviceStatus.services[0].deployments.Count -eq 1) {
                $desiredCount = $serviceStatus.services[0].desiredCount
                $runningCount = $serviceStatus.services[0].runningCount
                
                if ($runningCount -eq $desiredCount) {
                    $serviceStable = $true
                    Write-Log "Backend service is stable with $runningCount/$desiredCount tasks running" "SUCCESS"
                } else {
                    Write-Log "Backend service not yet stable. Running: $runningCount, Desired: $desiredCount" "INFO"
                }
            } else {
                Write-Log "Backend service has multiple deployments - still deploying" "INFO"
            }
            
            if (-not $serviceStable) {
                Start-Sleep -Seconds 30
            }
        }
        
        if (-not $serviceStable) {
            Write-Log "Backend service deployment did not stabilize within timeout period ($maxWaitTime seconds)" "WARNING"
            # Get events for service to see what's happening
            $events = $serviceStatus.services[0].events | Select-Object -First 5
            foreach ($event in $events) {
                Write-Log "Backend service event: $($event.message)" "INFO"
            }
        }
        
        # Update frontend service
        Write-Log "Updating frontend service..." "INFO"
        
        if ($UseProcessedTaskDefs) {
            # Use the prepared task definition file
            Write-Log "Using processed frontend task definition from $FrontendTaskDefPreparedPath" "INFO"
            $frontendTaskDefContent = Get-Content -Path $FrontendTaskDefPreparedPath -Raw
            $frontendTaskDefObj = $frontendTaskDefContent | ConvertFrom-Json
        } else {
            # Get current frontend task definition
            Write-Log "Getting current frontend task definition..." "INFO"
            $currentFrontendTaskDef = Invoke-CommandWithLogging -Command "aws ecs describe-task-definition --task-definition pairva-frontend --query 'taskDefinition' --output json | ConvertFrom-Json" -Description "Get frontend task definition" -CaptureOutput
            
            # Update image in container definition
            $frontendImage = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/pairva-frontend:${Version}"
            Write-Log "Setting frontend image to: $frontendImage" "INFO"
            $currentFrontendTaskDef.containerDefinitions[0].image = $frontendImage
            $frontendTaskDefObj = $currentFrontendTaskDef
        }
        
        # Save task definition to temp file
        $frontendTaskDefPath = Join-Path $env:TEMP "frontend-task-def-$Version.json"
        Write-Log "Saving frontend task definition to $frontendTaskDefPath" "INFO"
        $frontendTaskDefObj | Select-Object -Property family, containerDefinitions, volumes, placementConstraints, requiresCompatibilities, networkMode, cpu, memory | ConvertTo-Json -Depth 10 | Out-File $frontendTaskDefPath -Encoding utf8
        
        # Register new task definition
        Write-Log "Registering new frontend task definition..." "INFO"
        $newFrontendTaskDef = Invoke-CommandWithLogging -Command "aws ecs register-task-definition --cli-input-json file://$frontendTaskDefPath | ConvertFrom-Json" -Description "Register frontend task definition" -CaptureOutput
        $newFrontendTaskDefArn = $newFrontendTaskDef.taskDefinition.taskDefinitionArn
        Write-Log "New frontend task definition ARN: $newFrontendTaskDefArn" "INFO"
        
        # Update service with new task definition
        $updateCmd = "aws ecs update-service --cluster pairva-cluster --service pairva-frontend-service --task-definition $newFrontendTaskDefArn --deployment-configuration `"deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100`" --health-check-grace-period-seconds 120 --force-new-deployment"
        Invoke-CommandWithLogging -Command $updateCmd -Description "ECS frontend service update"
        
        # Wait for frontend deployment to stabilize with timeout
        Write-Log "Waiting for frontend deployment to stabilize..." "INFO"
        $maxWaitTime = 900 # 15 minutes
        $startWaitTime = Get-Date
        $serviceStable = $false
        
        while (-not $serviceStable -and ((Get-Date) - $startWaitTime).TotalSeconds -lt $maxWaitTime) {
            Write-Log "Checking frontend service stability ($(Get-Date -Format 'HH:mm:ss'))..." "INFO"
            $serviceStatus = aws ecs describe-services --cluster pairva-cluster --services pairva-frontend-service | ConvertFrom-Json
            
            if ($serviceStatus.services[0].deployments.Count -eq 1) {
                $desiredCount = $serviceStatus.services[0].desiredCount
                $runningCount = $serviceStatus.services[0].runningCount
                
                if ($runningCount -eq $desiredCount) {
                    $serviceStable = $true
                    Write-Log "Frontend service is stable with $runningCount/$desiredCount tasks running" "SUCCESS"
                } else {
                    Write-Log "Frontend service not yet stable. Running: $runningCount, Desired: $desiredCount" "INFO"
                }
            } else {
                Write-Log "Frontend service has multiple deployments - still deploying" "INFO"
            }
            
            if (-not $serviceStable) {
                Start-Sleep -Seconds 30
            }
        }
        
        if (-not $serviceStable) {
            Write-Log "Frontend service deployment did not stabilize within timeout period ($maxWaitTime seconds)" "WARNING"
            # Get events for service to see what's happening
            $events = $serviceStatus.services[0].events | Select-Object -First 5
            foreach ($event in $events) {
                Write-Log "Frontend service event: $($event.message)" "INFO"
            }
        }
        
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
        # Get previous task definitions
        Write-Log "Retrieving previous task definitions..." "INFO"
        
        # For backend
        $previousBackendTaskDef = Invoke-CommandWithLogging -Command "aws ecs describe-task-definition --task-definition pairva-backend:$PreviousVersion --query 'taskDefinition.taskDefinitionArn' --output text" -Description "Get previous backend task definition ARN" -CaptureOutput
        
        if (-not $previousBackendTaskDef) {
            throw "Failed to retrieve previous backend task definition for version $PreviousVersion"
        }
        
        # For frontend
        $previousFrontendTaskDef = Invoke-CommandWithLogging -Command "aws ecs describe-task-definition --task-definition pairva-frontend:$PreviousVersion --query 'taskDefinition.taskDefinitionArn' --output text" -Description "Get previous frontend task definition ARN" -CaptureOutput
        
        if (-not $previousFrontendTaskDef) {
            throw "Failed to retrieve previous frontend task definition for version $PreviousVersion"
        }
        
        # Rollback backend service
        Write-Log "Rolling back backend service to version $PreviousVersion..." "INFO"
        $rollbackCmd = "aws ecs update-service --cluster pairva-cluster --service pairva-backend-service --task-definition $previousBackendTaskDef --force-new-deployment"
        Invoke-CommandWithLogging -Command $rollbackCmd -Description "ECS backend service rollback"
        
        # Rollback frontend service
        Write-Log "Rolling back frontend service to version $PreviousVersion..." "INFO"
        $rollbackCmd = "aws ecs update-service --cluster pairva-cluster --service pairva-frontend-service --task-definition $previousFrontendTaskDef --force-new-deployment"
        Invoke-CommandWithLogging -Command $rollbackCmd -Description "ECS frontend service rollback"
        
        # Wait for services to stabilize with timeout
        Write-Log "Waiting for services to stabilize after rollback..." "INFO"
        $maxWaitTime = 900 # 15 minutes
        $startWaitTime = Get-Date
        $servicesStable = $false
        
        while (-not $servicesStable -and ((Get-Date) - $startWaitTime).TotalSeconds -lt $maxWaitTime) {
            Write-Log "Checking services stability during rollback ($(Get-Date -Format 'HH:mm:ss'))..." "INFO"
            
            # Check backend service
            $backendStatus = aws ecs describe-services --cluster pairva-cluster --services pairva-backend-service | ConvertFrom-Json
            $backendStable = ($backendStatus.services[0].deployments.Count -eq 1) -and 
                             ($backendStatus.services[0].runningCount -eq $backendStatus.services[0].desiredCount)
            
            # Check frontend service
            $frontendStatus = aws ecs describe-services --cluster pairva-cluster --services pairva-frontend-service | ConvertFrom-Json
            $frontendStable = ($frontendStatus.services[0].deployments.Count -eq 1) -and 
                              ($frontendStatus.services[0].runningCount -eq $frontendStatus.services[0].desiredCount)
            
            if ($backendStable -and $frontendStable) {
                $servicesStable = $true
                Write-Log "All services are stable after rollback" "SUCCESS"
            } else {
                Write-Log "Services not yet stable during rollback:" "INFO"
                Write-Log "  Backend: $(if($backendStable){'Stable'}else{'Not stable'}) (Running: $($backendStatus.services[0].runningCount), Desired: $($backendStatus.services[0].desiredCount))" "INFO"
                Write-Log "  Frontend: $(if($frontendStable){'Stable'}else{'Not stable'}) (Running: $($frontendStatus.services[0].runningCount), Desired: $($frontendStatus.services[0].desiredCount))" "INFO"
                Start-Sleep -Seconds 30
            }
        }
        
        if (-not $servicesStable) {
            Write-Log "Services did not stabilize after rollback within timeout period ($maxWaitTime seconds)" "WARNING"
            Write-Log "Collecting service events..." "INFO"
            
            # Get backend events
            $backendEvents = $backendStatus.services[0].events | Select-Object -First 3
            foreach ($event in $backendEvents) {
                Write-Log "Backend rollback event: $($event.message)" "INFO"
            }
            
            # Get frontend events
            $frontendEvents = $frontendStatus.services[0].events | Select-Object -First 3
            foreach ($event in $frontendEvents) {
                Write-Log "Frontend rollback event: $($event.message)" "INFO"
            }
        }
        
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
            
            # Generate comprehensive deployment summary after rollback
            Write-Log "Generating rollback summary report..." "INFO"
            $deploymentSummary = Get-DeploymentSummary -Cluster "pairva-cluster" -Version $targetVersion -IncludeEvents
            
            # If the summary shows any problems, collect detailed failure info
            if (-not $deploymentSummary) {
                Write-Log "Some services appear to be unhealthy after rollback - collecting detailed diagnostics" "WARNING"
                Get-FailedTaskInfo -Cluster "pairva-cluster" -Service "pairva-backend-service" -DetailedReport -LogLines 100
                Get-FailedTaskInfo -Cluster "pairva-cluster" -Service "pairva-frontend-service" -DetailedReport -LogLines 100
            }
        } else {
            Write-Log "Rollback to version $targetVersion failed - Investigating failures" "ERROR"
            Get-FailedTaskInfo -Cluster "pairva-cluster" -Service "pairva-backend-service"
            Get-FailedTaskInfo -Cluster "pairva-cluster" -Service "pairva-frontend-service"
            throw "Rollback to version $targetVersion failed"
        }
    } else {
        Write-Log "Preparing to deploy version: $Version" "INFO"
        
        # Process task definitions if not using pre-processed ones
        if (-not $UseProcessedTaskDefs) {
            Write-Log "Running Update-TaskDefinitions script to process task definitions..." "INFO"
            
            # Check if the script exists
            if (-not (Test-Path $UpdateTaskDefinitionsScript)) {
                throw "Update-TaskDefinitions script not found at: $UpdateTaskDefinitionsScript"
            }
            
            # Create task definitions directory if it doesn't exist
            $taskDefinitionsDir = Join-Path $ProjectRoot "infrastructure/task-definitions"
            if (-not (Test-Path $taskDefinitionsDir)) {
                New-Item -Path $taskDefinitionsDir -ItemType Directory -Force | Out-Null
                Write-Log "Created task definitions directory: $taskDefinitionsDir" "INFO"
            }
            
            # Run Update-TaskDefinitions script
            Write-Log "Running task definition update script with version: $Version" "INFO"
            $updateCmd = "& $UpdateTaskDefinitionsScript -Version `"$Version`" -Verbose:$($Verbose.IsPresent)"
            Invoke-CommandWithLogging -Command $updateCmd -Description "Process task definitions"
            
            # Verify processed task definitions
            if (-not (Test-ProcessedTaskDefinitions)) {
                throw "Failed to process task definitions. Please check logs for more information."
            }
            
            Write-Log "Task definitions processed successfully" "SUCCESS"
        } else {
            # Verify that processed task definitions exist and are valid
            Write-Log "Verifying pre-processed task definitions..." "INFO"
            if (-not (Test-ProcessedTaskDefinitions)) {
                throw "Pre-processed task definitions are not valid. Please check logs for more information."
            }
            
            Write-Log "Pre-processed task definitions verified successfully" "SUCCESS"
        }
        
        # Deploy
        Write-Log "Starting canary deployment with version: $Version" "INFO"
        if (Start-CanaryDeployment -Version $Version -AccountId $AccountId -Region $Region -UseProcessedTaskDefs $UseProcessedTaskDefs) {
            Write-Log "Deployment of version $Version completed successfully" "SUCCESS"
            
            # Generate comprehensive deployment summary
            Write-Log "Generating deployment summary report..." "INFO"
            $deploymentSummary = Get-DeploymentSummary -Cluster "pairva-cluster" -Version $Version -IncludeEvents
            
            # If the summary shows any problems, collect detailed failure info
            if (-not $deploymentSummary) {
                Write-Log "Some services appear to be unhealthy after deployment - collecting detailed diagnostics" "WARNING"
                Get-FailedTaskInfo -Cluster "pairva-cluster" -Service "pairva-backend-service" -DetailedReport -LogLines 100
                Get-FailedTaskInfo -Cluster "pairva-cluster" -Service "pairva-frontend-service" -DetailedReport -LogLines 100
            } else {
                Write-Log "All services are healthy and running as expected" "SUCCESS"
            }
            
            # Copy the deployment report to the reports directory with timestamp
            $deploymentReportDir = Join-Path $ProjectRoot "deployment/reports"
            if (-not (Test-Path $deploymentReportDir)) {
                New-Item -Path $deploymentReportDir -ItemType Directory -Force | Out-Null
                Write-Log "Created deployment reports directory: $deploymentReportDir" "INFO"
            }
            
            $deploymentReportPath = Join-Path $deploymentReportDir "deployment-report-$Version.md"
            Get-Content -Path $LogFile | Out-File -FilePath $deploymentReportPath -Encoding utf8
            Write-Log "Deployment report saved to: $deploymentReportPath" "INFO"
        } else {
            Write-Log "Deployment of version $Version failed - Investigating failures" "ERROR"
            Get-FailedTaskInfo -Cluster "pairva-cluster" -Service "pairva-backend-service"
            Get-FailedTaskInfo -Cluster "pairva-cluster" -Service "pairva-frontend-service"
            throw "Deployment of version $Version failed"
        }
    }
    
    # Calculate and log execution time
    $endTime = Get-Date
    $executionTime = $endTime - $StartTime
    Write-Log "Deployment script completed in $($executionTime.TotalSeconds) seconds" "INFO"
    
} catch {
    Write-Log "Deployment failed with error: $_" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    
    # Log failure information
    Write-Log "Deployment failed after $((Get-Date - $StartTime).TotalSeconds) seconds" "ERROR"
    
    # Check for common issues
    if ($_.Exception.Message -match "AccessDenied") {
        Write-Log "This appears to be an AWS permissions issue. Please verify your IAM permissions." "INFO"
    } elseif ($_.Exception.Message -match "ResourceNotFoundException") {
        Write-Log "AWS resource not found. Please verify the resource exists and you have correct access." "INFO"
    }
    
    # Rethrow so caller gets error code
    throw
} finally {
    # Clean up any temporary files
    $tempFiles = @(
        (Join-Path $env:TEMP "backend-task-def-$Version.json"),
        (Join-Path $env:TEMP "frontend-task-def-$Version.json")
    )
    
    foreach ($file in $tempFiles) {
        if (Test-Path $file) {
            try {
                Remove-Item -Path $file -Force
                Write-Log "Cleaned up temporary file: $file" "INFO"
            } catch {
                Write-Log "Failed to clean up temporary file: $file" "WARNING"
            }
        }
    }
    
    Write-Log "Deployment script exiting" "INFO"
}
