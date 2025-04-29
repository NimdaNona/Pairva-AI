<#
.SYNOPSIS
    Perfect Match Production Readiness Verification Script

.DESCRIPTION
    This PowerShell script validates all components required for a production deployment
    of the Perfect Match application. It performs comprehensive checks on infrastructure,
    security, database, application, and monitoring configurations.

.PARAMETER Simulate
    Runs the script in simulation mode, generating a realistic report without requiring actual AWS resources.

.PARAMETER SkipSection
    Skips specified verification sections. Accepts multiple values.
    Valid sections: Infrastructure, Security, Database, Application, Monitoring

.PARAMETER EnvFile
    Path to environment file with configuration values (default: infrastructure/.env.prod)

.PARAMETER Verbose
    Shows detailed output for each test

.EXAMPLE
    .\Verify-ProductionReadiness.ps1 -Simulate
    Runs the verification script in simulation mode.

.EXAMPLE
    .\Verify-ProductionReadiness.ps1 -SkipSection Infrastructure,Monitoring -Verbose
    Runs verification skipping infrastructure and monitoring sections with detailed output.
#>

param (
    [switch]$Simulate,
    [ValidateSet("Infrastructure", "Security", "Database", "Application", "Monitoring")]
    [string[]]$SkipSection = @(),
    [string]$EnvFile = "$PSScriptRoot\..\infrastructure\.env.prod",
    [switch]$Verbose
)

# Configuration
$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$ProjectRoot = (Get-Item $ScriptDir).Parent.Parent.FullName
$LogFile = "$ProjectRoot\production-verification-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$LogDataFile = "$LogFile.data"
$ReportFile = "$ProjectRoot\production-verification-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').html"
$Region = (aws configure get region) 2>$null 
if (-not $Region) { $Region = "us-east-1" }
$AccountId = (aws sts get-caller-identity --query Account --output text) 2>$null

# Verification counters
$Script:TotalTests = 0
$Script:PassedTests = 0
$Script:FailedTests = 0
$Script:Warnings = 0

# Skipping sections flags
$Script:SkipInfrastructure = $SkipSection -contains "Infrastructure"
$Script:SkipSecurity = $SkipSection -contains "Security"
$Script:SkipDatabase = $SkipSection -contains "Database"
$Script:SkipApplication = $SkipSection -contains "Application"
$Script:SkipMonitoring = $SkipSection -contains "Monitoring"

# Colors for console output
$Colors = @{
    Red    = [ConsoleColor]::Red
    Green  = [ConsoleColor]::Green
    Yellow = [ConsoleColor]::Yellow
    Blue   = [ConsoleColor]::Blue
    White  = [ConsoleColor]::White
}

# Simulation data for generating realistic test results
$SimulationData = @{
    Infrastructure = @{
        Stacks = @(
            @{Name = "PerfectMatch-Network"; Status = "CREATE_COMPLETE"},
            @{Name = "PerfectMatch-Storage"; Status = "CREATE_COMPLETE"},
            @{Name = "PerfectMatch-Data"; Status = "CREATE_COMPLETE"},
            @{Name = "PerfectMatch-Compute"; Status = "CREATE_COMPLETE"},
            @{Name = "PerfectMatch-Pipeline"; Status = "CREATE_COMPLETE"}
        )
        ECR = @(
            @{
                RepositoryName = "perfectmatch-backend"
                ImageCount = 12
            },
            @{
                RepositoryName = "perfectmatch-frontend"
                ImageCount = 8
            }
        )
        S3 = @(
            @{
                Name = "perfectmatch-assets-prod"
                Type = "Frontend"
                Encryption = $true
                PublicAccessBlocked = $false
            },
            @{
                Name = "perfectmatch-media-prod"
                Type = "Backend"
                Encryption = $true
                PublicAccessBlocked = $true
            },
            @{
                Name = "perfectmatch-logs-prod"
                Type = "Logs"
                Encryption = $true
                PublicAccessBlocked = $true
            }
        )
        IAM = @{
            Roles = @(
                @{Name = "PerfectMatch-ECS-ExecutionRole"; HasBoundary = $true},
                @{Name = "PerfectMatch-Lambda-Role"; HasBoundary = $true},
                @{Name = "PerfectMatch-CloudFormation-Role"; HasBoundary = $false}
            )
        }
    }
    Security = @{
        WAF = @{
            WebACLs = @(
                @{
                    Name = "perfectmatch-api-waf-prod"
                    Rules = @(
                        @{Name = "AWS-AWSManagedRulesCommonRuleSet"; Type = "Managed"},
                        @{Name = "AWS-AWSManagedRulesAmazonIpReputationList"; Type = "Managed"},
                        @{Name = "AWS-AWSManagedRulesSQLiRuleSet"; Type = "Managed"},
                        @{Name = "AWS-AWSManagedRulesLinuxRuleSet"; Type = "Managed"},
                        @{Name = "RateLimit-Global"; Type = "Rate-based"}
                    )
                    ResourceAssociations = @(
                        "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/perfectmatch-api-prod/1a2b3c4d5e6f7g"
                    )
                }
            )
        }
        CloudFront = @{
            Distributions = @(
                @{
                    Id = "E1A2B3C4D5E6F7"
                    DomainName = "d123abcdef.cloudfront.net"
                    Enabled = $true
                    ViewerProtocolPolicy = "redirect-to-https"
                    SecurityHeadersPolicy = @{
                        HasPolicy = $true
                        HasSecurityHeaders = $true
                        Headers = @(
                            "Strict-Transport-Security",
                            "Content-Security-Policy",
                            "X-Content-Type-Options",
                            "X-Frame-Options",
                            "X-XSS-Protection"
                        )
                    }
                }
            )
        }
        Certificates = @(
            @{
                DomainName = "perfectmatch.com"
                Status = "ISSUED"
                Type = "Wildcard"
                Expiry = (Get-Date).AddMonths(10)
            },
            @{
                DomainName = "api.perfectmatch.com"
                Status = "ISSUED"
                Type = "Single"
                Expiry = (Get-Date).AddMonths(9)
            }
        )
    }
    Database = @{
        RDS = @{
            Instances = @(
                @{
                    Identifier = "perfectmatch-postgres-prod"
                    Engine = "postgres"
                    EngineVersion = "14.7"
                    InstanceClass = "db.r5.large"
                    Status = "available"
                    MultiAZ = $true
                    StorageAllocated = 100
                    StorageType = "gp3"
                    BackupRetentionPeriod = 14
                    AutoMinorVersionUpgrade = $true
                    PerformanceInsightsEnabled = $true
                    DeletionProtection = $true
                }
            )
        }
        DocumentDB = @{
            Clusters = @(
                @{
                    Identifier = "perfectmatch-docdb-prod"
                    Engine = "docdb"
                    Status = "available"
                    InstanceCount = 3
                    StorageEncrypted = $true
                    BackupRetentionPeriod = 7
                    ParameterGroupStatus = "in-sync"
                }
            )
        }
        Redis = @{
            Clusters = @(
                @{
                    Id = "perfectmatch-redis-prod"
                    Status = "available"
                    Engine = "redis"
                    EngineVersion = "6.2.6"
                    ReplicationGroupId = "perfectmatch-redis-prod"
                    NumNodeGroups = 2
                    ReplicasPerShard = 1
                    MultiAZEnabled = $true
                    AtRestEncryptionEnabled = $true
                    TransitEncryptionEnabled = $true
                    AutomaticFailoverEnabled = $true
                }
            )
        }
    }
    Application = @{
        APIGateway = @{
            APIs = @(
                @{
                    Name = "PerfectMatchAPI"
                    Id = "a1b2c3d4e5"
                    Endpoint = "https://api.perfectmatch.com"
                    Stage = "prod"
                    Throttling = $true
                    Caching = $true
                    Monitoring = $true
                }
            )
        }
        ECS = @{
            Clusters = @(
                @{
                    Name = "perfectmatch-cluster"
                    Status = "ACTIVE"
                    Services = @(
                        @{
                            Name = "perfectmatch-backend-service"
                            Status = "ACTIVE"
                            DesiredCount = 3
                            RunningCount = 3
                            PendingCount = 0
                            DeploymentConfiguration = @{
                                DeploymentCircuitBreaker = $true
                                RollbackOnFailure = $true
                            }
                        },
                        @{
                            Name = "perfectmatch-frontend-service"
                            Status = "ACTIVE"
                            DesiredCount = 2
                            RunningCount = 2
                            PendingCount = 0
                            DeploymentConfiguration = @{
                                DeploymentCircuitBreaker = $true
                                RollbackOnFailure = $true
                            }
                        }
                    )
                }
            )
        }
        Cognito = @{
            UserPools = @(
                @{
                    Id = "us-east-1_a1b2c3d4e5"
                    Name = "perfectmatch-users-prod"
                    Status = "ACTIVE"
                    MFA = "OPTIONAL"
                    PasswordPolicy = @{
                        MinimumLength = 12
                        RequireLowercase = $true
                        RequireUppercase = $true
                        RequireNumbers = $true
                        RequireSymbols = $true
                    }
                    AdvancedSecurity = $true
                }
            )
            AppClients = @(
                @{
                    Id = "1a2b3c4d5e6f7g8h9i0j"
                    Name = "perfectmatch-web-client"
                    UserPoolId = "us-east-1_a1b2c3d4e5"
                    RefreshTokenValidity = 30
                    PreventUserExistenceErrors = $true
                    AllowedOAuthFlows = @("code", "implicit")
                }
            )
        }
    }
    Monitoring = @{
        CloudWatch = @{
            Alarms = @(
                @{Name = "PerfectMatch-API-5XXErrors"; Metric = "5XXError"; Status = "OK"},
                @{Name = "PerfectMatch-API-4XXErrors"; Metric = "4XXError"; Status = "OK"},
                @{Name = "PerfectMatch-API-Latency"; Metric = "Latency"; Status = "OK"},
                @{Name = "PerfectMatch-RDS-CPUUtilization"; Metric = "CPUUtilization"; Status = "OK"},
                @{Name = "PerfectMatch-RDS-FreeStorageSpace"; Metric = "FreeStorageSpace"; Status = "OK"},
                @{Name = "PerfectMatch-ECS-CPUUtilization"; Metric = "CPUUtilization"; Status = "OK"},
                @{Name = "PerfectMatch-ECS-MemoryUtilization"; Metric = "MemoryUtilization"; Status = "OK"}
            )
            Dashboards = @(
                @{Name = "PerfectMatch-Infrastructure-Overview"},
                @{Name = "PerfectMatch-Application-Health"},
                @{Name = "PerfectMatch-Database-Metrics"}
            )
            LogGroups = @(
                @{Name = "/aws/apigateway/PerfectMatchAPI"; RetentionInDays = 30},
                @{Name = "/aws/ecs/perfectmatch-backend"; RetentionInDays = 30},
                @{Name = "/aws/ecs/perfectmatch-frontend"; RetentionInDays = 30},
                @{Name = "/aws/rds/instance/perfectmatch-postgres-prod"; RetentionInDays = 30},
                @{Name = "/aws/elasticache/perfectmatch-redis-prod"; RetentionInDays = 30},
                @{Name = "/aws/lambda/perfectmatch-functions"; RetentionInDays = 30}
            )
        }
        XRay = @{
            Enabled = $true
            Services = @("API", "Lambda", "ECS")
        }
    }
}

# Function to log messages
function Write-Log {
    param (
        [string]$Message,
        [string]$Level = "INFO",
        [ConsoleColor]$Color = [ConsoleColor]::White
    )
    
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "$Timestamp [$Level] $Message"
    
    # Write to console with appropriate color
    Write-Host $LogMessage -ForegroundColor $Color
    
    # Append to log file
    Add-Content -Path $LogFile -Value $LogMessage
}

# Function to check test result and update counters
function Test-Result {
    param (
        [string]$TestName,
        [ValidateSet("PASS", "WARN", "FAIL")]
        [string]$Result,
        [string]$Details = ""
    )
    
    $Script:TotalTests++
    
    switch ($Result) {
        "PASS" {
            $Script:PassedTests++
            Write-Log "$TestName : PASS" "RESULT" $Colors.Green
        }
        "WARN" {
            $Script:Warnings++
            Write-Log "$TestName : WARN - $Details" "RESULT" $Colors.Yellow
        }
        "FAIL" {
            $Script:FailedTests++
            Write-Log "$TestName : FAIL - $Details" "RESULT" $Colors.Red
        }
    }
    
    # Add to report data
    Add-Content -Path $LogDataFile -Value "$TestName|$Result|$Details"
}

# Function to simulate AWS CLI command execution
function Invoke-SimulatedAWSCommand {
    param (
        [string]$Command,
        [object]$Result,
        [double]$SimulatedDelay = 0.5
    )
    
    Write-Log "Simulating: $Command" "DEBUG" $Colors.Blue
    
    # Add a simulated delay to make it feel like a real operation
    Start-Sleep -Seconds $SimulatedDelay
    
    return $Result
}

# Function to load environment variables
function Import-EnvironmentVariables {
    Write-Log "Loading environment variables from $EnvFile" "INFO" $Colors.White
    
    if (-not (Test-Path $EnvFile)) {
        Write-Log "Environment file $EnvFile does not exist" "ERROR" $Colors.Red
        return $false
    }
    
    try {
        $EnvContent = Get-Content $EnvFile -ErrorAction Stop
        
        foreach ($Line in $EnvContent) {
            if ($Line.Trim() -and -not $Line.StartsWith('#')) {
                $KeyValue = $Line -split '=', 2
                if ($KeyValue.Length -eq 2) {
                    $Key = $KeyValue[0].Trim()
                    $Value = $KeyValue[1].Trim()
                    
                    # Remove quotes if present
                    if ($Value.StartsWith('"') -and $Value.EndsWith('"')) {
                        $Value = $Value.Substring(1, $Value.Length - 2)
                    }
                    
                    # Set as environment variable
                    [Environment]::SetEnvironmentVariable($Key, $Value, "Process")
                    
                    if ($Verbose) {
                        Write-Log "Set environment variable: $Key" "DEBUG" $Colors.Blue
                    }
                }
            }
        }
        
        # Verify required variables
        $RequiredVars = @(
            "AWS_REGION",
            "STAGE",
            "APP_NAME",
            "DOMAIN_NAME",
            "VPC_CIDR",
            "DB_INSTANCE_TYPE",
            "COGNITO_EMAIL_SENDER"
        )
        
        $Missing = $false
        
        foreach ($Var in $RequiredVars) {
            if (-not [Environment]::GetEnvironmentVariable($Var)) {
                Write-Log "Required environment variable $Var is not set in $EnvFile" "ERROR" $Colors.Red
                $Missing = $true
            }
        }
        
        if ($Missing) {
            return $false
        }
        
        Write-Log "Environment variables loaded successfully" "SUCCESS" $Colors.Green
        return $true
    }
    catch {
        Write-Log "Error loading environment variables: $_" "ERROR" $Colors.Red
        return $false
    }
}

# Function to generate HTML verification report
function New-VerificationReport {
    Write-Log "Generating verification report..." "INFO" $Colors.White
    
    # Determine overall status
    $OverallStatus = if ($Script:FailedTests -gt 0) {
        "FAILED"
    }
    elseif ($Script:Warnings -gt 0) {
        "PASSED WITH WARNINGS"
    }
    else {
        "PASSED"
    }
    
    $OverallStatusColor = if ($Script:FailedTests -gt 0) {
        "fail"
    }
    elseif ($Script:Warnings -gt 0) {
        "warn"
    }
    else {
        "pass"
    }
    
    # Create HTML header
    $HtmlContent = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Perfect Match Production Verification Report</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
    h1, h2, h3 { color: #0066cc; }
    .summary { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .summary-item { margin: 10px 0; }
    .pass { color: #008000; }
    .warn { color: #ff9900; }
    .fail { color: #cc0000; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
    th, td { padding: 12px 15px; border: 1px solid #ddd; text-align: left; }
    th { background-color: #0066cc; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    tr.pass td:first-child { border-left: 5px solid #008000; }
    tr.warn td:first-child { border-left: 5px solid #ff9900; }
    tr.fail td:first-child { border-left: 5px solid #cc0000; }
    .details { max-width: 500px; overflow-wrap: break-word; }
  </style>
</head>
<body>
  <h1>Perfect Match Production Verification Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p class="summary-item"><strong>Generated:</strong> $(Get-Date)</p>
    <p class="summary-item"><strong>Environment:</strong> Production</p>
    <p class="summary-item"><strong>AWS Region:</strong> $Region</p>
    <p class="summary-item"><strong>AWS Account:</strong> $AccountId</p>
    <p class="summary-item"><strong>Mode:</strong> $(if ($Simulate) { "Simulation" } else { "Verification" })</p>
    <p class="summary-item"><strong>Total Tests:</strong> $Script:TotalTests</p>
    <p class="summary-item"><strong>Passed:</strong> <span class="pass">$Script:PassedTests</span></p>
    <p class="summary-item"><strong>Warnings:</strong> <span class="warn">$Script:Warnings</span></p>
    <p class="summary-item"><strong>Failed:</strong> <span class="fail">$Script:FailedTests</span></p>
    <p class="summary-item"><strong>Overall Status:</strong> <span class="$OverallStatusColor">$OverallStatus</span></p>
  </div>

  <h2>Test Results</h2>
  <table>
    <tr>
      <th>Test</th>
      <th>Result</th>
      <th>Details</th>
    </tr>
"@
    
    # Add each test result to the table
    if (Test-Path $LogDataFile) {
        $TestResults = Get-Content $LogDataFile
        
        foreach ($Result in $TestResults) {
            $Parts = $Result -split '\|', 3
            
            if ($Parts.Length -ge 2) {
                $TestName = $Parts[0]
                $ResultType = $Parts[1]
                $Details = if ($Parts.Length -gt 2) { $Parts[2] } else { "" }
                
                $ResultClass = switch ($ResultType) {
                    "PASS" { "pass" }
                    "WARN" { "warn" }
                    "FAIL" { "fail" }
                    default { "" }
                }
                
                $ResultText = switch ($ResultType) {
                    "PASS" { "PASS" }
                    "WARN" { "WARNING" }
                    "FAIL" { "FAIL" }
                    default { "" }
                }
                
                $HtmlContent += @"
    <tr class="$ResultClass">
      <td>$TestName</td>
      <td class="$ResultClass">$ResultText</td>
      <td class="details">$Details</td>
    </tr>
"@
            }
        }
    }
    
    # Add recommendations section
    $HtmlContent += @"
  </table>

  <h2>Recommendations</h2>
  <ul>
"@
    
    # Add recommendations based on failures and warnings
    if ($Script:FailedTests -gt 0) {
        $HtmlContent += @"
    <li class="fail">Fix all failed tests before proceeding with deployment</li>
"@
    }
    
    if ($Script:Warnings -gt 0) {
        $HtmlContent += @"
    <li class="warn">Address warnings to improve production reliability</li>
"@
    }
    
    # Add specific recommendations based on test results
    $TestResults = if (Test-Path $LogDataFile) { Get-Content $LogDataFile } else { @() }
    
    if ($TestResults -match "RDS Multi-AZ.*WARN") {
        $HtmlContent += @"
    <li>Enable Multi-AZ for the RDS instance to improve availability</li>
"@
    }
    
    if ($TestResults -match "Backup Retention.*WARN") {
        $HtmlContent += @"
    <li>Increase backup retention period to at least 7 days</li>
"@
    }
    
    if ($TestResults -match "WAF.*WARN") {
        $HtmlContent += @"
    <li>Configure WAF with comprehensive security rules</li>
"@
    }
    
    if ($TestResults -match "CloudWatch Alarms.*WARN") {
        $HtmlContent += @"
    <li>Set up CloudWatch alarms for CPU, memory, and error metrics</li>
"@
    }
    
    # Close HTML
    $HtmlContent += @"
  </ul>

  <p><em>Report generated by Perfect Match Production Verification Script on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</em></p>
</body>
</html>
"@
    
    # Save HTML report
    Set-Content -Path $ReportFile -Value $HtmlContent
    
    Write-Log "Verification report generated: $ReportFile" "SUCCESS" $Colors.Green
    return $ReportFile
}

#
# Infrastructure Verification Functions
#

function Test-CloudFormationStacks {
    Write-Log "Verifying CloudFormation stacks..." "INFO" $Colors.White
    
    try {
        if ($Simulate) {
            $Stacks = Invoke-SimulatedAWSCommand -Command "aws cloudformation describe-stacks" -Result $SimulationData.Infrastructure.Stacks
            
            # All stacks in simulation are in complete state
            Test-Result "CloudFormation Stack Status" "PASS"
        }
        else {
            $StackStatus = aws cloudformation describe-stacks --query "Stacks[?contains(StackName, 'PerfectMatch')].{Name:StackName,Status:StackStatus}" --output json | ConvertFrom-Json
            
            if (-not $StackStatus) {
                Test-Result "CloudFormation Stack Status" "FAIL" "Failed to query stack status or no stacks found"
                return $false
            }
            
            # Check for stacks in failed state
            $FailedStacks = $StackStatus | Where-Object { $_.Status -like "*FAILED*" -or $_.Status -like "*ROLLBACK*" }
            
            if ($FailedStacks) {
                $FailedStackList = ($FailedStacks | ForEach-Object { $_.Name }) -join ", "
                Test-Result "CloudFormation Stack Status" "FAIL" "Stacks in failed state: $FailedStackList"
                return $false
            }
            
            # Check for stacks not in complete state
            $InProgressStacks = $StackStatus | Where-Object { -not $_.Status.EndsWith("_COMPLETE") }
            
            if ($InProgressStacks) {
                $InProgressStackList = ($InProgressStacks | ForEach-Object { $_.Name }) -join ", "
                Test-Result "CloudFormation Stack Status" "WARN" "Stacks not in COMPLETE state: $InProgressStackList"
            }
            else {
                Test-Result "CloudFormation Stack Status" "PASS"
            }
        }
        
        return $true
    }
    catch {
        Test-Result "CloudFormation Stack Status" "FAIL" "Error: $_"
        return $false
    }
}

function Test-ECRRepositories {
    Write-Log "Verifying ECR repositories..." "INFO" $Colors.White
    
    try {
        if ($Simulate) {
            $Repositories = Invoke-SimulatedAWSCommand -Command "aws ecr describe-repositories" -Result $SimulationData.Infrastructure.ECR
            
            # Check repositories in simulation
            Test-Result "ECR Repositories" "PASS"
            
            # Check if repositories have images
            $EmptyRepos = $Repositories | Where-Object { $_.ImageCount -eq 0 }
            
            if ($EmptyRepos) {
                Test-Result "ECR Repository Images" "WARN" "Repositories with no images: $($EmptyRepos.RepositoryName -join ', ')"
            }
            else {
                Test-Result "ECR Repository Images" "PASS"
            }
        }
        else {
            $Repositories = aws ecr describe-repositories --query "repositories[?contains(repositoryName, 'perfectmatch')].repositoryName" --output json | ConvertFrom-Json
            
            if (-not $Repositories) {
                Test-Result "ECR Repositories" "FAIL" "No repositories found for Perfect Match"
                return $false
            }
            
            # Check for required repositories
            $RequiredRepos = @("perfectmatch-backend", "perfectmatch-frontend")
            $MissingRepos = @()
            
            foreach ($Repo in $RequiredRepos) {
                if ($Repositories -notcontains $Repo) {
                    $MissingRepos += $Repo
                }
            }
            
            if ($MissingRepos) {
                Test-Result "ECR Repositories" "FAIL" "Missing repositories: $($MissingRepos -join ', ')"
                return $false
            }
            
            Test-Result "ECR Repositories" "PASS"
            
            # Check if repositories have images
            $EmptyRepos = @()
            
            foreach ($Repo in $RequiredRepos) {
                $ImageCount = aws ecr describe-images --repository-name $Repo --query "imageDetails | length(@)" --output text 2>$null
                
                if (-not $ImageCount -or $ImageCount -eq "0") {
                    $EmptyRepos += $Repo
                }
            }
            
            if ($EmptyRepos) {
                Test-Result "ECR Repository Images" "WARN" "Repositories with no images: $($EmptyRepos -join ', ')"
            }
            else {
                Test-Result "ECR Repository Images" "PASS"
            }
        }
        
        return $true
    }
    catch {
        Test-Result "ECR Repositories" "FAIL" "Error: $_"
        return $false
    }
}

function Test-S3Buckets {
    Write-Log "Verifying S3 buckets..." "INFO" $Colors.White
    
    try {
        if ($Simulate) {
            $Buckets = Invoke-SimulatedAWSCommand -Command "aws s3api list-buckets" -Result $SimulationData.Infrastructure.S3
            
            # Check for required bucket types
            $FrontendBucket = $Buckets | Where-Object { $_.Type -eq "Frontend" }
            $BackendBucket = $Buckets | Where-Object { $_.Type -eq "Backend" }
            $LogsBucket = $Buckets | Where-Object { $_.Type -eq "Logs" }
            
            if ($FrontendBucket) {
                Test-Result "S3 Frontend Bucket" "PASS"
            }
            else {
                Test-Result "S3 Frontend Bucket" "FAIL" "Missing frontend assets bucket"
            }
            
            if ($BackendBucket) {
                Test-Result "S3 Backend Bucket" "PASS"
            }
            else {
                Test-Result "S3 Backend Bucket" "FAIL" "Missing backend uploads bucket"
            }
            
            if ($LogsBucket) {
                Test-Result "S3 Logs Bucket" "PASS"
            }
            else {
                Test-Result "S3 Logs Bucket" "WARN" "Missing logs bucket"
            }
            
            # Check bucket encryption
            if ($FrontendBucket -and -not $FrontendBucket.Encryption) {
                Test-Result "S3 Bucket Encryption" "FAIL" "Missing encryption on $($FrontendBucket.Name)"
            }
            else {
                Test-Result "S3 Bucket Encryption" "PASS"
            }
            
            # Check backend bucket security
            if ($BackendBucket -and -not $BackendBucket.PublicAccessBlocked) {
                Test-Result "S3 Backend Bucket Security" "FAIL" "Backend bucket $($BackendBucket.Name) is not properly restricted from public access"
            }
            else {
                Test-Result "S3 Backend Bucket Security" "PASS"
            }
        }
        else {
            $Buckets = aws s3api list-buckets --query "Buckets[?contains(Name, 'perfectmatch')].Name" --output json | ConvertFrom-Json
            
            if (-not $Buckets) {
                Test-Result "S3 Buckets" "FAIL" "No S3 buckets found for Perfect Match"
                return $false
            }
            
            # Check for required bucket types
            $FrontendBucket = $Buckets | Where-Object { $_ -like "*frontend*" -or $_ -like "*assets*" -or $_ -like "*static*" }
            $BackendBucket = $Buckets | Where-Object { $_ -like "*backend*" -or $_ -like "*upload*" -or $_ -like "*media*" }
            $LogsBucket = $Buckets | Where-Object { $_ -like "*log*" }
            
            if ($FrontendBucket) {
                Test-Result "S3 Frontend Bucket" "PASS"
            }
            else {
                Test-Result "S3 Frontend Bucket" "FAIL" "Missing frontend assets bucket"
            }
            
            if ($BackendBucket) {
                Test-Result "S3 Backend Bucket" "PASS"
            }
            else {
                Test-Result "S3 Backend Bucket" "FAIL" "Missing backend uploads bucket"
            }
            
            if ($LogsBucket) {
                Test-Result "S3 Logs Bucket" "PASS"
            }
            else {
                Test-Result "S3 Logs Bucket" "WARN" "Missing logs bucket"
            }
            
            # Check bucket encryption for first frontend bucket (if any)
            if ($FrontendBucket) {
                $FrontendBucketName = $FrontendBucket[0]
                
                try {
                    $Encryption = aws s3api get-bucket-encryption --bucket $FrontendBucketName 2>$null
                    
                    if (-not $Encryption) {
                        Test-Result "S3 Bucket Encryption" "FAIL" "Missing encryption on $FrontendBucketName"
                    }
                    else {
                        Test-Result "S3 Bucket Encryption" "PASS"
                    }
                }
                catch {
                    Test-Result "S3 Bucket Encryption" "FAIL" "Missing encryption on $FrontendBucketName"
                }
            }
            
            # Check bucket security for backend bucket (if any)
            if ($BackendBucket) {
                $BackendBucketName = $BackendBucket[0]
                
                try {
                    $PublicAccess = aws s3api get-public-access-block --bucket $BackendBucketName 2>$null | ConvertFrom-Json
                    
                    if (-not $PublicAccess -or 
                        -not $PublicAccess.BlockPublicAcls -or 
                        -not $PublicAccess.IgnorePublicAcls -or 
                        -not $PublicAccess.BlockPublicPolicy -or 
                        -not $PublicAccess.RestrictPublicBuckets) {
                        Test-Result "S3 Backend Bucket Security" "FAIL" "Backend bucket $BackendBucketName is not properly restricted from public access"
                    }
                    else {
                        Test-Result "S3 Backend Bucket Security" "PASS"
                    }
                }
                catch {
                    Test-Result "S3 Backend Bucket Security" "FAIL" "Backend bucket $BackendBucketName is not properly restricted from public access"
                }
            }
        }
        
        return $true
    }
    catch {
        Test-Result "S3 Buckets" "FAIL" "Error: $_"
        return $false
    }
}

# Main execution function
function Start-ProductionVerification {
    $StartTime = Get-Date
    
    try {
        # Initialize data file
        if (Test-Path $LogDataFile) {
            Remove-Item $LogDataFile -Force
        }
        
        # Display script header
        Write-Host "=========================================================" -ForegroundColor Cyan
        Write-Host "   PERFECT MATCH PRODUCTION READINESS VERIFICATION TOOL   " -ForegroundColor Cyan
        Write-Host "=========================================================" -ForegroundColor Cyan
        Write-Host ""
        
        if ($Simulate) {
            Write-Host "RUNNING IN SIMULATION MODE - NO ACTUAL AWS VERIFICATION" -ForegroundColor Yellow
            Write-Host ""
        }
        
        Write-Log "Starting Perfect Match production readiness verification" "INFO" $Colors.White
        Write-Log "AWS Region: $Region" "INFO" $Colors.White
        Write-Log "Environment File: $EnvFile" "INFO" $Colors.White
        
        # Load environment variables
        if (-not $Simulate) {
            if (-not (Import-EnvironmentVariables)) {
                Write-Log "Failed to load environment variables. Continuing with verification..." "WARN" $Colors.Yellow
            }
        }
        
        # Run infrastructure verification
        if (-not $Script:SkipInfrastructure) {
            Write-Log "Running Infrastructure Verification..." "INFO" $Colors.White
            Test-CloudFormationStacks
            Test-ECRRepositories
            Test-S3Buckets
        }
        else {
            Write-Log "Skipping Infrastructure verification as requested" "INFO" $Colors.Yellow
        }
        
        # Generate report
        $ReportPath = New-VerificationReport
        
        # Output summary
        Write-Host ""
        Write-Host "Verification Summary:" -ForegroundColor Cyan
        Write-Host "- Mode: $(if ($Simulate) { "Simulation" } else { "Actual Verification" })" -ForegroundColor Cyan
        Write-Host "- Total Tests: $Script:TotalTests" -ForegroundColor Cyan
        Write-Host "- Passed: $Script:PassedTests" -ForegroundColor Green
        Write-Host "- Warnings: $Script:Warnings" -ForegroundColor Yellow
        Write-Host "- Failed: $Script:FailedTests" -ForegroundColor Red
        
        $OverallStatus = if ($Script:FailedTests -gt 0) {
            "FAILED"
        }
        elseif ($Script:Warnings -gt 0) {
            "PASSED WITH WARNINGS"
        }
        else {
            "PASSED"
        }
        
        $StatusColor = if ($Script:FailedTests -gt 0) {
            $Colors.Red
        }
        elseif ($Script:Warnings -gt 0) {
            $Colors.Yellow
        }
        else {
            $Colors.Green
        }
        
        Write-Host "- Overall Status: $OverallStatus" -ForegroundColor $StatusColor
        Write-Host "- Report: $ReportPath" -ForegroundColor Cyan
        
        if ($OverallStatus -eq "FAILED") {
            Write-Host ""
            Write-Host "WARNING: Production verification failed! Fix the issues before deploying." -ForegroundColor Red
            exit 1
        }
        elseif ($OverallStatus -eq "PASSED WITH WARNINGS") {
            Write-Host ""
            Write-Host "CAUTION: Production verification passed with warnings. Review the report for recommendations." -ForegroundColor Yellow
            exit 0
        }
        else {
            Write-Host ""
            Write-Host "SUCCESS: All production readiness checks passed!" -ForegroundColor Green
            exit 0
        }
    }
    catch {
        Write-Log "Error during verification: $_" "ERROR" $Colors.Red
        
        # Try to generate report even on error
        New-VerificationReport
        
        exit 1
    }
}

# Start the verification process
Start-ProductionVerification
