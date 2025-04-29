#!/usr/bin/env pwsh
# Update deployment resources from Perfect-Match to Pairva
# This script updates resource names in deployment files to reflect the rebrand

param(
    [switch]$DryRun = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot ".." "..")
$ReportFile = Join-Path $ProjectRoot "rename-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

function Write-Log {
    param(
        [string]$Message,
        [string]$Type = "INFO"
    )
    
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Type] $Message"
    
    if ($Verbose) {
        switch ($Type) {
            "ERROR" { Write-Host $LogMessage -ForegroundColor Red }
            "WARNING" { Write-Host $LogMessage -ForegroundColor Yellow }
            "SUCCESS" { Write-Host $LogMessage -ForegroundColor Green }
            default { Write-Host $LogMessage }
        }
    }
    
    Add-Content -Path $ReportFile -Value $LogMessage
}

function Update-TextInFile {
    param(
        [string]$FilePath,
        [string]$OldText,
        [string]$NewText
    )
    
    if (!(Test-Path $FilePath)) {
        Write-Log "File not found: $FilePath" "ERROR"
        return
    }
    
    try {
        $Content = Get-Content -Path $FilePath -Raw
        $OriginalContent = $Content
        
        $EscapedText = [regex]::Escape($OldText)
        if ($Content -match $EscapedText) {
            $ReplacementCount = ($Content -split $EscapedText).Length - 1
            $Content = $Content -replace $EscapedText, $NewText
            
            if ($DryRun) {
                Write-Log "Would replace '$OldText' with '$NewText' in $FilePath ($ReplacementCount occurrences)" "INFO"
            } else {
                Set-Content -Path $FilePath -Value $Content
                Write-Log "Replaced '$OldText' with '$NewText' in $FilePath ($ReplacementCount occurrences)" "SUCCESS"
            }
        }
    }
    catch {
        Write-Log "Error updating $FilePath: $_" "ERROR"
    }
}

function Update-ResourceNames {
    Write-Log "Starting resource name updates" "INFO"
    
    # Define key files to update
    $DeployScriptPath = Join-Path $ProjectRoot "infrastructure" "scripts" "deploy-production.sh"
    $VerifyScriptPath = Join-Path $ProjectRoot "infrastructure" "scripts" "verify-production-readiness.sh"
    $PipelineStackPath = Join-Path $ProjectRoot "infrastructure" "lib" "pipeline-stack.ts"
    $ConfigPath = Join-Path $ProjectRoot "infrastructure" "lib" "config.ts"
    
    # Update deploy-production.sh
    Write-Log "Updating deploy script..." "INFO"
    Update-TextInFile -FilePath $DeployScriptPath -OldText "perfectmatch-cluster" -NewText "pairva-cluster"
    Update-TextInFile -FilePath $DeployScriptPath -OldText "perfectmatch-backend-service" -NewText "pairva-backend-service"
    Update-TextInFile -FilePath $DeployScriptPath -OldText "perfectmatch-frontend-service" -NewText "pairva-frontend-service"
    Update-TextInFile -FilePath $DeployScriptPath -OldText "perfectmatch-backend" -NewText "pairva-backend"
    Update-TextInFile -FilePath $DeployScriptPath -OldText "perfectmatch-frontend" -NewText "pairva-frontend"
    Update-TextInFile -FilePath $DeployScriptPath -OldText "/perfectmatch/production/" -NewText "/pairva/production/"
    Update-TextInFile -FilePath $DeployScriptPath -OldText "PerfectMatch-Pipeline" -NewText "Pairva-Pipeline"
    Update-TextInFile -FilePath $DeployScriptPath -OldText "PerfectMatchPipeline" -NewText "PairvaPipeline"
    
    # Update verify-production-readiness.sh
    Write-Log "Updating verification script..." "INFO"
    Update-TextInFile -FilePath $VerifyScriptPath -OldText "perfectmatch-cluster" -NewText "pairva-cluster"
    Update-TextInFile -FilePath $VerifyScriptPath -OldText "perfectmatch-backend-service" -NewText "pairva-backend-service"
    Update-TextInFile -FilePath $VerifyScriptPath -OldText "perfectmatch-frontend-service" -NewText "pairva-frontend-service"
    Update-TextInFile -FilePath $VerifyScriptPath -OldText "/perfectmatch/production/" -NewText "/pairva/production/"
    Update-TextInFile -FilePath $VerifyScriptPath -OldText "PerfectMatch" -NewText "Pairva"
    
    # Update pipeline-stack.ts
    Write-Log "Updating pipeline stack..." "INFO"
    Update-TextInFile -FilePath $PipelineStackPath -OldText "PerfectMatchPipeline" -NewText "PairvaPipeline"
    Update-TextInFile -FilePath $PipelineStackPath -OldText "'perfectmatch-'" -NewText "'pairva-'"
    Update-TextInFile -FilePath $PipelineStackPath -OldText "'perfectmatch'" -NewText "'pairva'"
    Update-TextInFile -FilePath $PipelineStackPath -OldText "'PerfectMatch'" -NewText "'Pairva'"
    
    # Update config.ts
    Write-Log "Updating config..." "INFO"
    Update-TextInFile -FilePath $ConfigPath -OldText "perfectmatch" -NewText "pairva"
    Update-TextInFile -FilePath $ConfigPath -OldText "PerfectMatch" -NewText "Pairva"
    
    Write-Log "Resource name updates completed" "SUCCESS"
}

function Update-SSMParameters {
    Write-Log "Starting AWS Systems Manager parameter updates" "INFO"
    
    if (!$DryRun) {
        try {
            # Get parameters that need renaming
            $Parameters = aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=/perfectmatch/" --query "Parameters[*].Name" --output text
            
            if ($Parameters) {
                foreach ($OldParam in $Parameters) {
                    $NewParam = $OldParam -replace "^/perfectmatch/", "/pairva/"
                    
                    # Get old parameter value
                    $ParamValue = aws ssm get-parameter --name $OldParam --with-decryption --query "Parameter.Value" --output text
                    $ParamType = aws ssm get-parameter --name $OldParam --query "Parameter.Type" --output text
                    
                    # Create new parameter
                    aws ssm put-parameter --name $NewParam --value $ParamValue --type $ParamType --overwrite | Out-Null
                    Write-Log "Created new parameter: $NewParam" "SUCCESS"
                    
                    # Keep old parameter for now - it will be removed after successful deployment
                    Write-Log "Kept old parameter for backwards compatibility: $OldParam" "INFO"
                }
            }
            else {
                Write-Log "No SSM parameters found with /perfectmatch/ prefix" "WARNING"
            }
        }
        catch {
            Write-Log "Error updating SSM parameters: $_" "ERROR"
        }
    }
    else {
        Write-Log "Would update SSM parameters from /perfectmatch/ to /pairva/ (dry run)" "INFO"
    }
    
    Write-Log "SSM parameter updates completed" "SUCCESS"
}

function Update-ECRRepositories {
    Write-Log "Starting ECR repository updates" "INFO"
    
    $Repositories = @(
        @{ OldName = "perfectmatch-backend"; NewName = "pairva-backend" },
        @{ OldName = "perfectmatch-frontend"; NewName = "pairva-frontend" }
    )
    
    foreach ($Repo in $Repositories) {
        if ($DryRun) {
            Write-Log "Would create new ECR repository: $($Repo.NewName) based on $($Repo.OldName)" "INFO"
        }
        else {
            try {
                # Check if old repository exists
                $RepoExists = aws ecr describe-repositories --repository-names $Repo.OldName 2>$null
                
                if ($RepoExists) {
                    # Create new repository
                    aws ecr create-repository --repository-name $Repo.NewName | Out-Null
                    Write-Log "Created new ECR repository: $($Repo.NewName)" "SUCCESS"
                    
                    # Keep old repository for now - it will be removed after successful deployment
                    Write-Log "Kept old repository for backwards compatibility: $($Repo.OldName)" "INFO"
                }
                else {
                    Write-Log "Old repository not found: $($Repo.OldName)" "WARNING"
                }
            }
            catch {
                if ($_.Exception.Message -match "RepositoryAlreadyExistsException") {
                    Write-Log "Repository already exists: $($Repo.NewName)" "WARNING"
                }
                else {
                    Write-Log "Error creating ECR repository $($Repo.NewName): $_" "ERROR"
                }
            }
        }
    }
    
    Write-Log "ECR repository updates completed" "SUCCESS"
}

function Update-ECSResources {
    Write-Log "Starting ECS resource updates" "INFO"
    
    if ($DryRun) {
        Write-Log "Would update ECS cluster from perfectmatch-cluster to pairva-cluster" "INFO"
        Write-Log "Would update ECS services from perfectmatch-backend-service to pairva-backend-service" "INFO"
        Write-Log "Would update ECS services from perfectmatch-frontend-service to pairva-frontend-service" "INFO"
    }
    else {
        try {
            # New resources will be created by CloudFormation
            # This is just checking if the old resources exist
            $ClusterExists = aws ecs describe-clusters --clusters perfectmatch-cluster --query "clusters[0].status" --output text 2>$null
            
            if ($ClusterExists -eq "ACTIVE") {
                Write-Log "Found existing ECS cluster: perfectmatch-cluster. Will be replaced by CloudFormation." "INFO"
            }
            else {
                Write-Log "Old ECS cluster 'perfectmatch-cluster' not found" "WARNING"
            }
        }
        catch {
            Write-Log "Error checking ECS resources: $_" "ERROR"
        }
    }
    
    Write-Log "ECS resource updates completed" "SUCCESS"
}

# Main execution
Write-Log "======================================================" "INFO"
Write-Log "Starting deployment resource update from Perfect-Match to Pairva" "INFO"
Write-Log "Dry run: $DryRun" "INFO"
Write-Log "======================================================" "INFO"

Update-ResourceNames
Update-SSMParameters
Update-ECRRepositories
Update-ECSResources

Write-Log "======================================================" "INFO"
if ($DryRun) {
    Write-Log "Dry run completed. Check $ReportFile for details." "SUCCESS"
    Write-Log "Run without -DryRun to apply changes" "INFO"
}
else {
    Write-Log "Resource updates completed. Check $ReportFile for details." "SUCCESS"
}
Write-Log "======================================================" "INFO"

if ($Verbose) {
    Write-Host "Report written to: $ReportFile" -ForegroundColor Cyan
}
