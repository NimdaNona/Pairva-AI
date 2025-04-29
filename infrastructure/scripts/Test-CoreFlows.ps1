<#
.SYNOPSIS
    Perfect Match Core Functionality Testing Script

.DESCRIPTION
    This PowerShell script tests core application flows of the Perfect Match application.
    It validates user registration, authentication, profile creation/updates, questionnaire 
    submission, matching functionality, messaging between users, and subscription management.

.PARAMETER Simulate
    Runs in simulation mode without making actual API calls or database changes.

.PARAMETER Environment
    Target environment (dev, staging, prod) (default: dev).

.PARAMETER TestUsersPath
    Path to a JSON file containing test users to use (default: ./test-users.json).

.PARAMETER ReportPath
    Path to save test report (default: ./test-report.html).
    
.PARAMETER IncludeFlows
    Comma-separated list of flows to include (default: all).
    Available flows: auth,profile,questionnaire,matching,messaging,subscription

.PARAMETER ExcludeFlows
    Comma-separated list of flows to exclude (default: none).

.EXAMPLE
    .\Test-CoreFlows.ps1 -Simulate
    Tests all core flows in simulation mode.

.EXAMPLE
    .\Test-CoreFlows.ps1 -Environment staging -IncludeFlows "auth,profile"
    Tests only authentication and profile flows in the staging environment.

.NOTES
    Requires test users to be created first using Create-TestUsers.ps1.
#>

param (
    [switch]$Simulate = $true,
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment = "dev",
    [string]$TestUsersPath = "./test-users.json",
    [string]$ReportPath = "./test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').html",
    [string]$IncludeFlows = "all",
    [string]$ExcludeFlows = ""
)

# Import modules and configure environment
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Configuration and constants
$ScriptDir = $PSScriptRoot
$ProjectRoot = (Get-Item $ScriptDir).Parent.Parent.FullName
$LogFile = "$ProjectRoot/test-core-flows-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$StartTime = Get-Date

# Load environment-specific configuration
$EnvFile = "$ProjectRoot/infrastructure/.env.$Environment"
$Config = @{
    CognitoUserPoolId = "us-east-1_mockUserPoolId"
    CognitoClientId = "mockClientId"
    ApiBaseUrl = "https://api.perfectmatch.local"
    WebappUrl = "https://app.perfectmatch.local"
    S3BucketName = "perfectmatch-test-photos"
}

# Define colors for console output
$Colors = @{
    Red = [ConsoleColor]::Red
    Green = [ConsoleColor]::Green
    Yellow = [ConsoleColor]::Yellow
    Blue = [ConsoleColor]::Blue
    White = [ConsoleColor]::White
    Cyan = [ConsoleColor]::Cyan
    Magenta = [ConsoleColor]::Magenta
    Gray = [ConsoleColor]::Gray
}

# Flow test result containers
$TestResults = @{
    Authentication = @{
        TotalTests = 0
        PassedTests = 0
        FailedTests = 0
        SkippedTests = 0
        Duration = $null
        Results = @()
    }
    Profile = @{
        TotalTests = 0
        PassedTests = 0
        FailedTests = 0
        SkippedTests = 0
        Duration = $null
        Results = @()
    }
    Questionnaire = @{
        TotalTests = 0
        PassedTests = 0
        FailedTests = 0
        SkippedTests = 0
        Duration = $null
        Results = @()
    }
    Matching = @{
        TotalTests = 0
        PassedTests = 0
        FailedTests = 0
        SkippedTests = 0
        Duration = $null
        Results = @()
    }
    Messaging = @{
        TotalTests = 0
        PassedTests = 0
        FailedTests = 0
        SkippedTests = 0
        Duration = $null
        Results = @()
    }
    Subscription = @{
        TotalTests = 0
        PassedTests = 0
        FailedTests = 0
        SkippedTests = 0
        Duration = $null
        Results = @()
    }
}

# Session data storage
$SessionData = @{
    TestUsers = @()
    UserTokens = @{}
    CreatedProfiles = @{}
    QuestionnaireResponses = @{}
    Matches = @{}
    Conversations = @{}
    Subscriptions = @{}
    PerformanceMetrics = @{}
}

# Determine which flows to run
$IncludeFlowsList = if ($IncludeFlows -eq "all") { 
    @("Authentication", "Profile", "Questionnaire", "Matching", "Messaging", "Subscription") 
} else { 
    $IncludeFlows.Split(',') | ForEach-Object { $_.Trim() -replace "^(.)(.*)$", {param($m) $m.Groups[1].Value.ToUpper() + $m.Groups[2].Value} }
}

$ExcludeFlowsList = if ($ExcludeFlows) { 
    $ExcludeFlows.Split(',') | ForEach-Object { $_.Trim() -replace "^(.)(.*)$", {param($m) $m.Groups[1].Value.ToUpper() + $m.Groups[2].Value} }
} else { 
    @() 
}

$ActiveFlows = $IncludeFlowsList | Where-Object { $_ -notin $ExcludeFlowsList }

# Function to log messages with timestamp
function Write-Log {
    param (
        [string]$Message,
        [string]$Level = "INFO",
        [ConsoleColor]$Color = [ConsoleColor]::White
    )
    
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "$Timestamp [$Level] $Message"
    
    Write-Host $LogMessage -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $LogMessage
}

# Function to record a test result
function Record-TestResult {
    param (
        [string]$Flow,
        [string]$TestName,
        [bool]$Success,
        [string]$ErrorMessage = "",
        [object]$Data = $null,
        [timespan]$Duration
    )
    
    $Result = @{
        TestName = $TestName
        Success = $Success
        ErrorMessage = $ErrorMessage
        Duration = $Duration
        Timestamp = Get-Date
        Data = $Data
    }
    
    if ($Success) {
        $TestResults[$Flow].PassedTests++
        Write-Log "✓ $TestName - Passed ($($Duration.TotalSeconds.ToString('0.000'))s)" "PASS" $Colors.Green
    }
    else {
        $TestResults[$Flow].FailedTests++
        Write-Log "✗ $TestName - Failed: $ErrorMessage ($($Duration.TotalSeconds.ToString('0.000'))s)" "FAIL" $Colors.Red
    }
    
    $TestResults[$Flow].TotalTests++
    $TestResults[$Flow].Results += $Result
}

# Function to load environment variables
function Load-EnvironmentVariables {
    Write-Log "Loading environment for $Environment..." "INFO" $Colors.White
    
    if (-not $Simulate) {
        if (Test-Path $EnvFile) {
            Write-Log "Reading from $EnvFile" "INFO" $Colors.White
            
            $EnvContent = Get-Content $EnvFile
            
            foreach ($Line in $EnvContent) {
                if (-not [string]::IsNullOrWhiteSpace($Line) -and $Line -notmatch '^\s*#' -and $Line -match '=') {
                    $Key, $Value = $Line -split '=', 2
                    $Key = $Key.Trim()
                    $Value = $Value.Trim()
                    
                    switch ($Key) {
                        "COGNITO_USER_POOL_ID" { $Config.CognitoUserPoolId = $Value }
                        "COGNITO_APP_CLIENT_ID" { $Config.CognitoClientId = $Value }
                        "API_URL" { $Config.ApiBaseUrl = $Value }
                        "APP_URL" { $Config.WebappUrl = $Value }
                        "S3_BUCKET_NAME" { $Config.S3BucketName = $Value }
                    }
                }
            }
        }
        else {
            Write-Log "Environment file not found: $EnvFile" "WARN" $Colors.Yellow
        }
    }
    
    Write-Log "Configuration loaded for $Environment environment" "INFO" $Colors.White
    if ($Simulate) {
        Write-Log "Running in SIMULATION mode - no actual API calls will be made" "INFO" $Colors.Yellow
    }
}

# Function to load test users
# Convert PSCustomObject to HashTable recursively
function ConvertTo-Hashtable {
    param (
        [Parameter(ValueFromPipeline)]
        $InputObject
    )

    process {
        if ($null -eq $InputObject) { return $null }
        
        if ($InputObject -is [System.Collections.IEnumerable] -and $InputObject -isnot [string]) {
            $collection = @()
            foreach ($object in $InputObject) {
                $collection += ConvertTo-Hashtable $object
            }
            return $collection
        }
        
        if ($InputObject -is [PSCustomObject]) {
            $hash = @{}
            foreach ($property in $InputObject.PSObject.Properties) {
                $hash[$property.Name] = ConvertTo-Hashtable $property.Value
            }
            return $hash
        }
        
        return $InputObject
    }
}

function Load-TestUsers {
    Write-Log "Loading test users from $TestUsersPath..." "INFO" $Colors.White
    
    if (Test-Path $TestUsersPath) {
        try {
            $UsersJson = Get-Content $TestUsersPath | ConvertFrom-Json
            # Convert PSCustomObjects to HashTables
            $SessionData.TestUsers = ConvertTo-Hashtable $UsersJson.users
            Write-Log "Loaded $($SessionData.TestUsers.Count) test users" "INFO" $Colors.White
            return $true
        }
        catch {
            Write-Log "Error loading test users: $_" "ERROR" $Colors.Red
            return $false
        }
    }
    else {
        Write-Log "Test users file not found: $TestUsersPath" "ERROR" $Colors.Red
        Write-Log "Please run Create-TestUsers.ps1 first to generate test users" "ERROR" $Colors.Red
        return $false
    }
}

# Function to simulate a delay (for simulation mode)
function Invoke-SimulatedDelay {
    param (
        [double]$MinSeconds = 0.1,
        [double]$MaxSeconds = 1.0
    )
    
    if ($Simulate) {
        $Delay = Get-Random -Minimum ($MinSeconds * 1000) -Maximum ($MaxSeconds * 1000)
        Start-Sleep -Milliseconds $Delay
    }
}

# Function to authenticate a user
function Test-UserAuthentication {
    param (
        [hashtable]$User
    )
    
    $TestStart = Get-Date
    $Result = $false
    $ErrorMessage = ""
    $Data = $null
    
    try {
        $Email = $User.User.email
        Write-Log "Testing authentication for user: $Email" "INFO" $Colors.White
        
        if ($Simulate) {
            Write-Log "Simulating authentication API request" "INFO" $Colors.Blue
            Invoke-SimulatedDelay -MinSeconds 0.2 -MaxSeconds 1.0
            
            # Simulate a successful authentication
            $TokenData = @{
                accessToken = "simulated-jwt-token-$($User.User.user_id)"
                refreshToken = "simulated-refresh-token-$($User.User.user_id)"
                expiresIn = 3600
                tokenType = "Bearer"
            }
            
            $SessionData.UserTokens[$User.User.user_id] = $TokenData
            $Result = $true
            $Data = $TokenData
        }
        else {
            # In a real implementation, this would call the auth endpoints
            $AuthRequest = @{
                username = $Email
                password = "TestPassword123!" # In a real scenario, this would be known or provided
            }
            
            $AuthResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/auth/login" -Method Post -Body ($AuthRequest | ConvertTo-Json) -ContentType "application/json"
            
            if ($AuthResponse.accessToken) {
                $SessionData.UserTokens[$User.User.user_id] = $AuthResponse
                $Result = $true
                $Data = $AuthResponse
            }
            else {
                $ErrorMessage = "No access token returned"
            }
        }
    }
    catch {
        $ErrorMessage = "Authentication failed: $_"
    }
    
    $TestDuration = (Get-Date) - $TestStart
    Record-TestResult -Flow "Authentication" -TestName "User Login ($Email)" -Success $Result -ErrorMessage $ErrorMessage -Data $Data -Duration $TestDuration
    
    return $Result
}

# Function to test profile creation
function Test-ProfileCreation {
    param (
        [hashtable]$User
    )
    
    $TestStart = Get-Date
    $Result = $false
    $ErrorMessage = ""
    $Data = $null
    
    try {
        $UserId = $User.User.user_id
        $Email = $User.User.email
        Write-Log "Testing profile creation for user: $Email" "INFO" $Colors.White
        
        # Ensure user is authenticated
        if (-not $SessionData.UserTokens.ContainsKey($UserId)) {
            $ErrorMessage = "User not authenticated"
            throw $ErrorMessage
        }
        
        if ($Simulate) {
            Write-Log "Simulating profile creation API request" "INFO" $Colors.Blue
            Invoke-SimulatedDelay -MinSeconds 0.3 -MaxSeconds 1.5
            
            # Simulate a successful profile creation
            $ProfileData = $User.User
            $SessionData.CreatedProfiles[$UserId] = $ProfileData
            $Result = $true
            $Data = $ProfileData
        }
        else {
            # In a real implementation, use the token to create the profile
            $Token = $SessionData.UserTokens[$UserId].accessToken
            $Headers = @{
                "Authorization" = "Bearer $Token"
                "Content-Type" = "application/json"
            }
            
            $ProfileRequest = @{
                first_name = $User.User.first_name
                last_name = $User.User.last_name
                birth_date = $User.User.birth_date
                gender = $User.User.gender
                seeking_gender = $User.User.seeking_gender
                location = $User.User.location
                bio = $User.User.bio
            }
            
            $ProfileResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/profiles" -Method Post -Headers $Headers -Body ($ProfileRequest | ConvertTo-Json) -ContentType "application/json"
            
            if ($ProfileResponse.user_id) {
                $SessionData.CreatedProfiles[$UserId] = $ProfileResponse
                $Result = $true
                $Data = $ProfileResponse
                
                # Upload profile photos
                foreach ($Media in $User.ProfileMedia) {
                    # In a real test, you'd upload actual files from test data
                    $MediaResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/profiles/media" -Method Post -Headers $Headers -Body ($Media | ConvertTo-Json)
                }
            }
            else {
                $ErrorMessage = "Profile creation failed - no user_id returned"
            }
        }
    }
    catch {
        $ErrorMessage = "Profile creation failed: $_"
    }
    
    $TestDuration = (Get-Date) - $TestStart
    Record-TestResult -Flow "Profile" -TestName "Create Profile ($Email)" -Success $Result -ErrorMessage $ErrorMessage -Data $Data -Duration $TestDuration
    
    return $Result
}

# Function to test profile update
function Test-ProfileUpdate {
    param (
        [hashtable]$User
    )
    
    $TestStart = Get-Date
    $Result = $false
    $ErrorMessage = ""
    $Data = $null
    
    try {
        $UserId = $User.User.user_id
        $Email = $User.User.email
        Write-Log "Testing profile update for user: $Email" "INFO" $Colors.White
        
        # Ensure profile exists
        if (-not $SessionData.CreatedProfiles.ContainsKey($UserId)) {
            $ErrorMessage = "Profile doesn't exist for update"
            throw $ErrorMessage
        }
        
        if ($Simulate) {
            Write-Log "Simulating profile update API request" "INFO" $Colors.Blue
            Invoke-SimulatedDelay -MinSeconds 0.2 -MaxSeconds 1.0
            
            # Simulate a successful profile update
            $UpdatedBio = "Updated bio: " + $User.User.bio
            $UpdatedProfile = $SessionData.CreatedProfiles[$UserId].Clone()
            $UpdatedProfile.bio = $UpdatedBio
            $SessionData.CreatedProfiles[$UserId] = $UpdatedProfile
            $Result = $true
            $Data = $UpdatedProfile
        }
        else {
            # In a real implementation, use the token to update the profile
            $Token = $SessionData.UserTokens[$UserId].accessToken
            $Headers = @{
                "Authorization" = "Bearer $Token"
                "Content-Type" = "application/json"
            }
            
            # Just update the bio for this test
            $UpdateRequest = @{
                bio = "Updated bio: " + $User.User.bio
            }
            
            $UpdateResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/profiles" -Method Patch -Headers $Headers -Body ($UpdateRequest | ConvertTo-Json)
            
            if ($UpdateResponse.user_id) {
                $SessionData.CreatedProfiles[$UserId] = $UpdateResponse
                $Result = $true
                $Data = $UpdateResponse
            }
            else {
                $ErrorMessage = "Profile update failed - no user_id returned"
            }
        }
    }
    catch {
        $ErrorMessage = "Profile update failed: $_"
    }
    
    $TestDuration = (Get-Date) - $TestStart
    Record-TestResult -Flow "Profile" -TestName "Update Profile ($Email)" -Success $Result -ErrorMessage $ErrorMessage -Data $Data -Duration $TestDuration
    
    return $Result
}

# Function to test questionnaire submission
function Test-QuestionnaireSubmission {
    param (
        [hashtable]$User
    )
    
    $TestStart = Get-Date
    $Result = $false
    $ErrorMessage = ""
    $Data = $null
    
    try {
        $UserId = $User.User.user_id
        $Email = $User.User.email
        Write-Log "Testing questionnaire submission for user: $Email" "INFO" $Colors.White
        
        # Ensure user is authenticated
        if (-not $SessionData.UserTokens.ContainsKey($UserId)) {
            $ErrorMessage = "User not authenticated"
            throw $ErrorMessage
        }
        
        if ($Simulate) {
            Write-Log "Simulating questionnaire submission API request" "INFO" $Colors.Blue
            Invoke-SimulatedDelay -MinSeconds 0.5 -MaxSeconds 2.0
            
            # Simulate a successful questionnaire submission
            $SubmissionData = $User.QuestionnaireResponses
            $SessionData.QuestionnaireResponses[$UserId] = $SubmissionData
            $Result = $true
            $Data = $SubmissionData
        }
        else {
            # In a real implementation, use the token to submit questionnaire responses
            $Token = $SessionData.UserTokens[$UserId].accessToken
            $Headers = @{
                "Authorization" = "Bearer $Token"
                "Content-Type" = "application/json"
            }
            
            # Use the pre-generated questionnaire responses
            $QuestionnaireData = $User.QuestionnaireResponses
            
            $SubmissionResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/questionnaires/responses" -Method Post -Headers $Headers -Body ($QuestionnaireData | ConvertTo-Json -Depth 10)
            
            if ($SubmissionResponse._id) {
                $SessionData.QuestionnaireResponses[$UserId] = $SubmissionResponse
                $Result = $true
                $Data = $SubmissionResponse
            }
            else {
                $ErrorMessage = "Questionnaire submission failed - no confirmation received"
            }
        }
    }
    catch {
        $ErrorMessage = "Questionnaire submission failed: $_"
    }
    
    $TestDuration = (Get-Date) - $TestStart
    Record-TestResult -Flow "Questionnaire" -TestName "Submit Questionnaire ($Email)" -Success $Result -ErrorMessage $ErrorMessage -Data $Data -Duration $TestDuration
    
    return $Result
}

# Function to test matching algorithm
function Test-MatchingAlgorithm {
    param (
        [hashtable]$User
    )
    
    $TestStart = Get-Date
    $Result = $false
    $ErrorMessage = ""
    $Data = $null
    
    try {
        $UserId = $User.User.user_id
        $Email = $User.User.email
        Write-Log "Testing matching algorithm for user: $Email" "INFO" $Colors.White
        
        # Ensure user has completed questionnaire
        if (-not $SessionData.QuestionnaireResponses.ContainsKey($UserId)) {
            $ErrorMessage = "User hasn't completed questionnaire"
            throw $ErrorMessage
        }
        
        if ($Simulate) {
            Write-Log "Simulating match generation API request" "INFO" $Colors.Blue
            Invoke-SimulatedDelay -MinSeconds 1.0 -MaxSeconds 3.0
            
            # Simulate match generation
            $MatchCount = Get-Random -Minimum 3 -Maximum 10
            $Matches = @()
            
            # Generate some random matches from other test users
            $PotentialMatches = $SessionData.TestUsers | Where-Object { $_.User.user_id -ne $UserId }
            $SelectedMatches = $PotentialMatches | Get-Random -Count ([Math]::Min($MatchCount, $PotentialMatches.Count))
            
            foreach ($Match in $SelectedMatches) {
                $MatchUserId = $Match.User.user_id
                $CompatibilityScore = Get-Random -Minimum 50 -Maximum 100
                
                $MatchData = @{
                    match_id = [Guid]::NewGuid().ToString()
                    user_id_1 = $UserId
                    user_id_2 = $MatchUserId
                    compatibility_score = $CompatibilityScore
                    status = "pending"
                    created_at = (Get-Date).ToString("o")
                    user_1_liked = $false
                    user_2_liked = $false
                }
                
                $Matches += $MatchData
            }
            
            $SessionData.Matches[$UserId] = $Matches
            $Result = $true
            $Data = @{
                user_id = $UserId
                match_count = $Matches.Count
                matches = $Matches
            }
        }
        else {
            # In a real implementation, use the token to request matches
            $Token = $SessionData.UserTokens[$UserId].accessToken
            $Headers = @{
                "Authorization" = "Bearer $Token"
                "Content-Type" = "application/json"
            }
            
            $MatchResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/matches" -Method Get -Headers $Headers
            
            if ($MatchResponse) {
                $SessionData.Matches[$UserId] = $MatchResponse
                $Result = $true
                $Data = @{
                    user_id = $UserId
                    match_count = $MatchResponse.Count
                    matches = $MatchResponse
                }
            }
            else {
                $ErrorMessage = "Match retrieval failed - no matches returned"
            }
        }
    }
    catch {
        $ErrorMessage = "Match generation failed: $_"
    }
    
    $TestDuration = (Get-Date) - $TestStart
    Record-TestResult -Flow "Matching" -TestName "Generate Matches ($Email)" -Success $Result -ErrorMessage $ErrorMessage -Data $Data -Duration $TestDuration
    
    return $Result
}

# Function to test like/unlike on matches
function Test-MatchInteraction {
    param (
        [hashtable]$User
    )
    
    $TestStart = Get-Date
    $Result = $false
    $ErrorMessage = ""
    $Data = $null
    
    try {
        $UserId = $User.User.user_id
        $Email = $User.User.email
        Write-Log "Testing match interaction for user: $Email" "INFO" $Colors.White
        
        # Ensure user has matches
        if (-not $SessionData.Matches.ContainsKey($UserId) -or $SessionData.Matches[$UserId].Count -eq 0) {
            $ErrorMessage = "User has no matches to interact with"
            throw $ErrorMessage
        }
        
        if ($Simulate) {
            Write-Log "Simulating match interaction API request" "INFO" $Colors.Blue
            Invoke-SimulatedDelay -MinSeconds 0.2 -MaxSeconds 1.0
            
            # Randomly like some matches
            $Matches = $SessionData.Matches[$UserId]
            $InteractionResults = @()
            
            foreach ($Match in $Matches) {
                $ShouldLike = (Get-Random -Minimum 0 -Maximum 2) -eq 1
                $Match.user_1_liked = $ShouldLike
                
                $InteractionResults += @{
                    match_id = $Match.match_id
                    liked = $ShouldLike
                }
            }
            
            $SessionData.Matches[$UserId] = $Matches
            $Result = $true
            $Data = @{
                user_id = $UserId
                interactions = $InteractionResults
            }
        }
        else {
            # In a real implementation, use the token to like/unlike matches
            $Token = $SessionData.UserTokens[$UserId].accessToken
            $Headers = @{
                "Authorization" = "Bearer $Token"
                "Content-Type" = "application/json"
            }
            
            $Matches = $SessionData.Matches[$UserId]
            $InteractionResults = @()
            
            foreach ($Match in $Matches) {
                $ShouldLike = (Get-Random -Minimum 0 -Maximum 2) -eq 1
                $LikeRequest = @{
                    liked = $ShouldLike
                }
                
                $LikeResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/matches/$($Match.match_id)/like" -Method Post -Headers $Headers -Body ($LikeRequest | ConvertTo-Json)
                
                $InteractionResults += @{
                    match_id = $Match.match_id
                    liked = $ShouldLike
                    response = $LikeResponse
                }
            }
            
            # Refresh matches
            $MatchResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/matches" -Method Get -Headers $Headers
            $SessionData.Matches[$UserId] = $MatchResponse
            
            $Result = $true
            $Data = @{
                user_id = $UserId
                interactions = $InteractionResults
            }
        }
    }
    catch {
        $ErrorMessage = "Match interaction failed: $_"
    }
    
    $TestDuration = (Get-Date) - $TestStart
    Record-TestResult -Flow "Matching" -TestName "Like/Unlike Matches ($Email)" -Success $Result -ErrorMessage $ErrorMessage -Data $Data -Duration $TestDuration
    
    return $Result
}

# Function to test message sending and retrieval
function Test-MessageExchange {
    param (
        [hashtable]$User1,
        [hashtable]$User2
    )
    
    $TestStart = Get-Date
    $Result = $false
    $ErrorMessage = ""
    $Data = $null
    
    try {
        $User1Id = $User1.User.user_id
        $User2Id = $User2.User.user_id
        $User1Email = $User1.User.email
        $User2Email = $User2.User.email
        Write-Log "Testing message exchange between: $User1Email and $User2Email" "INFO" $Colors.White
        
        # Ensure both users are authenticated
        if (-not $SessionData.UserTokens.ContainsKey($User1Id) -or -not $SessionData.UserTokens.ContainsKey($User2Id)) {
            $ErrorMessage = "One or both users not authenticated"
            throw $ErrorMessage
        }
        
        if ($Simulate) {
            Write-Log "Simulating messaging API requests" "INFO" $Colors.Blue
            Invoke-SimulatedDelay -MinSeconds 0.5 -MaxSeconds 2.0
            
            # Generate a conversation ID
            $ConversationId = [Guid]::NewGuid().ToString()
            
            # Create matched pair if not already matched
            if (-not $SessionData.Matches.ContainsKey($User1Id)) {
                $SessionData.Matches[$User1Id] = @()
            }
            
            $ExistingMatch = $SessionData.Matches[$User1Id] | Where-Object { $_.user_id_2 -eq $User2Id -or $_.user_id_1 -eq $User2Id }
            
            if (-not $ExistingMatch) {
                $MatchData = @{
                    match_id = [Guid]::NewGuid().ToString()
                    user_id_1 = $User1Id
                    user_id_2 = $User2Id
                    compatibility_score = Get-Random -Minimum 50 -Maximum 100
                    status = "active"
                    created_at = (Get-Date).ToString("o")
                    user_1_liked = $true
                    user_2_liked = $true
                }
                
                $SessionData.Matches[$User1Id] += $MatchData
            }
            else {
                $ExistingMatch.status = "active"
                $ExistingMatch.user_1_liked = $true
                $ExistingMatch.user_2_liked = $true
            }
            
            # Simulate conversation creation
            $Conversation = @{
                conversation_id = $ConversationId
                match_id = if ($ExistingMatch) { $ExistingMatch.match_id } else { $MatchData.match_id }
                created_at = (Get-Date).ToString("o")
                last_message_at = (Get-Date).ToString("o")
                participants = @($User1Id, $User2Id)
                messages = @()
            }
            
            # Generate some messages
            $MessageCount = Get-Random -Minimum 3 -Maximum 10
            $Messages = @()
            
            for ($i = 0; $i -lt $MessageCount; $i++) {
                $SenderId = if ($i % 2 -eq 0) { $User1Id } else { $User2Id }
                $MessageText = "Test message $($i + 1) from $($SenderId)"
                
                $Message = @{
                    message_id = [Guid]::NewGuid().ToString()
                    conversation_id = $ConversationId
                    sender_id = $SenderId
                    message_type = "text"
                    content = $MessageText
                    media_url = $null
                    sent_at = (Get-Date).AddMinutes(-$MessageCount + $i).ToString("o")
                    read_at = if ($i % 2 -eq 0) { (Get-Date).AddMinutes(-$MessageCount + $i + 0.5).ToString("o") } else { $null }
                }
                
                $Messages += $Message
            }
            
            $Conversation.messages = $Messages
            
            # Store the conversation
            if (-not $SessionData.Conversations.ContainsKey($User1Id)) {
                $SessionData.Conversations[$User1Id] = @()
            }
            
            $SessionData.Conversations[$User1Id] += $Conversation
            
            $Result = $true
            $Data = @{
                conversation_id = $ConversationId
                message_count = $Messages.Count
                messages = $Messages
            }
        }
        else {
            # In a real implementation, use the tokens to send messages
            $Token1 = $SessionData.UserTokens[$User1Id].accessToken
            $Headers1 = @{
                "Authorization" = "Bearer $Token1"
                "Content-Type" = "application/json"
            }
            
            # Ensure there's a match with the second user
            $MatchResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/matches" -Method Get -Headers $Headers1
            $MatchWithUser2 = $MatchResponse | Where-Object { $_.user_id_1 -eq $User2Id -or $_.user_id_2 -eq $User2Id }
            
            if (-not $MatchWithUser2) {
                $ErrorMessage = "No match found between users"
                throw $ErrorMessage
            }
            
            # Create or get an existing conversation
            $ConversationRequest = @{
                match_id = $MatchWithUser2.match_id
            }
            
            $ConversationResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/messaging/conversations" -Method Post -Headers $Headers1 -Body ($ConversationRequest | ConvertTo-Json)
            $ConversationId = $ConversationResponse.conversation_id
            
            # Send some messages
            $MessageCount = Get-Random -Minimum 3 -Maximum 10
            $Messages = @()
            
            for ($i = 0; $i -lt $MessageCount; $i++) {
                if ($i % 2 -eq 0) {
                    # User 1 sends a message
                    $MessageRequest = @{
                        content = "Test message $($i + 1) from user 1"
                        message_type = "text"
                    }
                    
                    $MessageResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/messaging/conversations/$ConversationId/messages" -Method Post -Headers $Headers1 -Body ($MessageRequest | ConvertTo-Json)
                    $Messages += $MessageResponse
                }
                else {
                    # User 2 sends a message
                    $Token2 = $SessionData.UserTokens[$User2Id].accessToken
                    $Headers2 = @{
                        "Authorization" = "Bearer $Token2"
                        "Content-Type" = "application/json"
                    }
                    
                    $MessageRequest = @{
                        content = "Test message $($i + 1) from user 2"
                        message_type = "text"
                    }
                    
                    $MessageResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/messaging/conversations/$ConversationId/messages" -Method Post -Headers $Headers2 -Body ($MessageRequest | ConvertTo-Json)
                    $Messages += $MessageResponse
                }
            }
            
            # Get the conversation with messages
            $FullConversation = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/messaging/conversations/$ConversationId" -Method Get -Headers $Headers1
            
            $Result = $true
            $Data = @{
                conversation_id = $ConversationId
                message_count = $Messages.Count
                messages = $Messages
                full_conversation = $FullConversation
            }
        }
    }
    catch {
        $ErrorMessage = "Message exchange failed: $_"
    }
    
    $TestDuration = (Get-Date) - $TestStart
    Record-TestResult -Flow "Messaging" -TestName "Exchange Messages ($User1Email <-> $User2Email)" -Success $Result -ErrorMessage $ErrorMessage -Data $Data -Duration $TestDuration
    
    return $Result
}

# Function to test subscription management
function Test-SubscriptionManagement {
    param (
        [hashtable]$User
    )
    
    $TestStart = Get-Date
    $Result = $false
    $ErrorMessage = ""
    $Data = $null
    
    try {
        $UserId = $User.User.user_id
        $Email = $User.User.email
        Write-Log "Testing subscription management for user: $Email" "INFO" $Colors.White
        
        # Ensure user is authenticated
        if (-not $SessionData.UserTokens.ContainsKey($UserId)) {
            $ErrorMessage = "User not authenticated"
            throw $ErrorMessage
        }
        
        if ($Simulate) {
            Write-Log "Simulating subscription management API requests" "INFO" $Colors.Blue
            Invoke-SimulatedDelay -MinSeconds 0.5 -MaxSeconds 1.5
            
            # Simulate subscription plan change
            $OriginalPlan = if ($User.Subscription) { $User.Subscription.plan_type } else { "free" }
            $NewPlan = "premium"
            
            if ($OriginalPlan -eq "premium") {
                $NewPlan = "platinum"
            }
            
            $SubscriptionData = @{
                subscription_id = [Guid]::NewGuid().ToString()
                user_id = $UserId
                plan_type = $NewPlan
                start_date = (Get-Date).ToString("o")
                end_date = (Get-Date).AddMonths(1).ToString("o")
                payment_status = "active"
                payment_method = "credit_card"
            }
            
            $SessionData.Subscriptions[$UserId] = $SubscriptionData
            $Result = $true
            $Data = @{
                original_plan = $OriginalPlan
                new_plan = $NewPlan
                subscription = $SubscriptionData
            }
        }
        else {
            # In a real implementation, use the token to manage subscriptions
            $Token = $SessionData.UserTokens[$UserId].accessToken
            $Headers = @{
                "Authorization" = "Bearer $Token"
                "Content-Type" = "application/json"
            }
            
            # Get current subscription
            $CurrentSubscription = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/subscriptions" -Method Get -Headers $Headers
            
            # Change to a different plan
            $OriginalPlan = if ($CurrentSubscription.plan_type) { $CurrentSubscription.plan_type } else { "free" }
            $NewPlan = "premium"
            
            if ($OriginalPlan -eq "premium") {
                $NewPlan = "platinum"
            }
            
            $SubscriptionRequest = @{
                plan_type = $NewPlan
                payment_method = "credit_card"
                payment_token = "simulated-payment-token"
            }
            
            $SubscriptionResponse = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/subscriptions" -Method Post -Headers $Headers -Body ($SubscriptionRequest | ConvertTo-Json)
            
            $SessionData.Subscriptions[$UserId] = $SubscriptionResponse
            $Result = $true
            $Data = @{
                original_plan = $OriginalPlan
                new_plan = $NewPlan
                subscription = $SubscriptionResponse
            }
        }
    }
    catch {
        $ErrorMessage = "Subscription management failed: $_"
    }
    
    $TestDuration = (Get-Date) - $TestStart
    Record-TestResult -Flow "Subscription" -TestName "Update Subscription Plan ($Email)" -Success $Result -ErrorMessage $ErrorMessage -Data $Data -Duration $TestDuration
    
    return $Result
}

# Function to run all tests for a flow
function Test-Flow {
    param (
        [string]$FlowName
    )
    
    $FlowStartTime = Get-Date
    Write-Log "=======================================================================" "INFO" $Colors.Cyan
    Write-Log "Starting $FlowName Flow Tests" "INFO" $Colors.Cyan
    Write-Log "=======================================================================" "INFO" $Colors.Cyan
    
    switch ($FlowName) {
        "Authentication" {
            # Test authentication for all users
            foreach ($User in $SessionData.TestUsers) {
                Test-UserAuthentication -User $User
            }
        }
        "Profile" {
            # Test profile creation for each authenticated user
            foreach ($User in $SessionData.TestUsers) {
                $UserId = $User.User.user_id
                if ($SessionData.UserTokens.ContainsKey($UserId)) {
                    Test-ProfileCreation -User $User
                }
            }
            
            # Test profile updates for a subset of users with profiles
            $ProfileUsers = $SessionData.TestUsers | Where-Object { $SessionData.CreatedProfiles.ContainsKey($_.User.user_id) } | Select-Object -First 5
            foreach ($User in $ProfileUsers) {
                Test-ProfileUpdate -User $User
            }
        }
        "Questionnaire" {
            # Test questionnaire submission for each user with a profile
            foreach ($User in $SessionData.TestUsers) {
                $UserId = $User.User.user_id
                if ($SessionData.CreatedProfiles.ContainsKey($UserId)) {
                    Test-QuestionnaireSubmission -User $User
                }
            }
        }
        "Matching" {
            # Test matching algorithm for each user with questionnaire responses
            foreach ($User in $SessionData.TestUsers) {
                $UserId = $User.User.user_id
                if ($SessionData.QuestionnaireResponses.ContainsKey($UserId)) {
                    Test-MatchingAlgorithm -User $User
                }
            }
            
            # Test match interaction for users with matches
            $UsersWithMatches = $SessionData.TestUsers | Where-Object { 
                $UserId = $_.User.user_id
                $SessionData.Matches.ContainsKey($UserId) -and $SessionData.Matches[$UserId].Count -gt 0
            } | Select-Object -First 5
            
            foreach ($User in $UsersWithMatches) {
                Test-MatchInteraction -User $User
            }
        }
        "Messaging" {
            # Test messaging between pairs of users who have mutual matches
            $TestedPairs = @()
            
            foreach ($User1 in $SessionData.TestUsers) {
                $User1Id = $User1.User.user_id
                
                if (-not $SessionData.Matches.ContainsKey($User1Id)) {
                    continue
                }
                
                $PotentialMatches = $SessionData.Matches[$User1Id] | Where-Object { $_.status -eq "active" -or ($_.user_1_liked -and $_.user_2_liked) }
                
                foreach ($Match in $PotentialMatches) {
                    $User2Id = if ($Match.user_id_1 -eq $User1Id) { $Match.user_id_2 } else { $Match.user_id_1 }
                    $User2 = $SessionData.TestUsers | Where-Object { $_.User.user_id -eq $User2Id } | Select-Object -First 1
                    
                    if (-not $User2) {
                        continue
                    }
                    
                    # Check if this pair has already been tested
                    $PairKey1 = "$User1Id-$User2Id"
                    $PairKey2 = "$User2Id-$User1Id"
                    
                    if ($PairKey1 -in $TestedPairs -or $PairKey2 -in $TestedPairs) {
                        continue
                    }
                    
                    Test-MessageExchange -User1 $User1 -User2 $User2
                    $TestedPairs += $PairKey1
                    
                    # Limit to 3 message exchanges
                    if ($TestedPairs.Count -ge 3) {
                        break
                    }
                }
                
                if ($TestedPairs.Count -ge 3) {
                    break
                }
            }
            
            # If no natural matches, create some test message exchanges between random users
            if ($TestedPairs.Count -eq 0) {
                $RandomUsers = $SessionData.TestUsers | Where-Object { $SessionData.UserTokens.ContainsKey($_.User.user_id) } | Select-Object -First 6
                
                for ($i = 0; $i -lt 3; $i += 2) {
                    if ($i + 1 -ge $RandomUsers.Count) {
                        break
                    }
                    
                    $User1 = $RandomUsers[$i]
                    $User2 = $RandomUsers[$i + 1]
                    
                    Test-MessageExchange -User1 $User1 -User2 $User2
                }
            }
        }
        "Subscription" {
            # Test subscription management for a subset of users
            $SubscriptionUsers = $SessionData.TestUsers | Where-Object { $SessionData.UserTokens.ContainsKey($_.User.user_id) } | Select-Object -First 5
            
            foreach ($User in $SubscriptionUsers) {
                Test-SubscriptionManagement -User $User
            }
        }
    }
    
    $FlowEndTime = Get-Date
    $FlowDuration = $FlowEndTime - $FlowStartTime
    $TestResults[$FlowName].Duration = $FlowDuration
    
    $TotalTests = $TestResults[$FlowName].TotalTests
    $PassedTests = $TestResults[$FlowName].PassedTests
    $FailedTests = $TestResults[$FlowName].FailedTests
    $PassPercentage = if ($TotalTests -gt 0) { [Math]::Round(($PassedTests / $TotalTests) * 100, 1) } else { 0 }
    
    Write-Log "=======================================================================" "INFO" $Colors.Cyan
    Write-Log "$FlowName Flow Summary:" "INFO" $Colors.Cyan
    Write-Log "Total Tests: $TotalTests | Passed: $PassedTests | Failed: $FailedTests | Success Rate: $PassPercentage%" "INFO" $Colors.Cyan
    Write-Log "Duration: $($FlowDuration.TotalSeconds.ToString('0.000')) seconds" "INFO" $Colors.Cyan
    Write-Log "=======================================================================" "INFO" $Colors.Cyan
    Write-Log "" "INFO" $Colors.White
}

# Function to create the test report
function Create-TestReport {
    $ReportTitle = "Perfect Match Core Flow Test Report"
    $ReportTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $TotalDuration = (Get-Date) - $StartTime
    
    # Calculate overall statistics
    $OverallTests = 0
    $OverallPassed = 0
    $OverallFailed = 0
    $OverallSkipped = 0
    
    foreach ($Flow in $ActiveFlows) {
        $OverallTests += $TestResults[$Flow].TotalTests
        $OverallPassed += $TestResults[$Flow].PassedTests
        $OverallFailed += $TestResults[$Flow].FailedTests
        $OverallSkipped += $TestResults[$Flow].SkippedTests
    }
    
    $OverallSuccessRate = if ($OverallTests -gt 0) { [Math]::Round(($OverallPassed / $OverallTests) * 100, 1) } else { 0 }
    
    # Generate HTML report
    $HtmlReport = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$ReportTitle</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1, h2, h3 {
            color: #0066cc;
        }
        .summary {
            background-color: #f5f5f5;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .flow-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 30px;
        }
        .flow-card {
            background-color: #fff;
            border-radius: 5px;
            border: 1px solid #ddd;
            padding: 15px;
            width: calc(33% - 15px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .success-rate {
            font-size: 24px;
            font-weight: bold;
            margin: 10px 0;
        }
        .success-indicator {
            height: 8px;
            border-radius: 4px;
            margin-bottom: 15px;
        }
        .test-details {
            margin-top: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #0066cc;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f5f5f5;
        }
        .status {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
        }
        .pass {
            background-color: #dff0d8;
            color: #3c763d;
        }
        .fail {
            background-color: #f2dede;
            color: #a94442;
        }
        .duration {
            color: #666;
            font-size: 0.9em;
        }
        .chart-container {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .chart {
            width: 48%;
            height: 300px;
            background-color: #f9f9f9;
            border-radius: 5px;
            padding: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .environment {
            margin-top: 30px;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 5px;
            border-left: 4px solid #0066cc;
        }
    </style>
</head>
<body>
    <h1>$ReportTitle</h1>
    <p>Generated on $ReportTimestamp | Environment: $Environment $(if ($Simulate) { "(Simulation Mode)" } else { "(Real API Calls)" })</p>
    
    <div class="summary">
        <h2>Overall Summary</h2>
        <p>Total Tests: <strong>$OverallTests</strong> | Passed: <strong>$OverallPassed</strong> | Failed: <strong>$OverallFailed</strong> | Skipped: <strong>$OverallSkipped</strong></p>
        <p>Overall Success Rate: <strong>$OverallSuccessRate%</strong></p>
        <p>Total Duration: <strong>$($TotalDuration.ToString("hh\:mm\:ss\.fff"))</strong></p>
    </div>
    
    <h2>Flow Summaries</h2>
    <div class="flow-summary">
"@

    # Add flow summary cards
    foreach ($Flow in $ActiveFlows) {
        $FlowTests = $TestResults[$Flow].TotalTests
        $FlowPassed = $TestResults[$Flow].PassedTests
        $FlowFailed = $TestResults[$Flow].FailedTests
        $FlowDuration = $TestResults[$Flow].Duration
        $SuccessRate = if ($FlowTests -gt 0) { [Math]::Round(($FlowPassed / $FlowTests) * 100, 1) } else { 0 }
        
        $SuccessColor = if ($SuccessRate -ge 90) { 
            "#4caf50"  # Green
        } elseif ($SuccessRate -ge 75) { 
            "#ff9800"  # Orange
        } else { 
            "#f44336"  # Red
        }
        
        $HtmlReport += @"
        <div class="flow-card">
            <h3>$Flow</h3>
            <div class="success-rate">$SuccessRate%</div>
            <div class="success-indicator" style="background-color: $SuccessColor;"></div>
            <p>Tests: <strong>$FlowTests</strong> | Passed: <strong>$FlowPassed</strong> | Failed: <strong>$FlowFailed</strong></p>
            <p class="duration">Duration: $($FlowDuration.TotalSeconds.ToString('0.000')) seconds</p>
        </div>
"@
    }

    $HtmlReport += @"
    </div>
    
    <h2>Test Details</h2>
    <div class="test-details">
"@

    # Add detailed test results for each flow
    foreach ($Flow in $ActiveFlows) {
        $HtmlReport += @"
        <h3>$Flow Tests</h3>
        <table>
            <tr>
                <th>Test Name</th>
                <th>Status</th>
                <th>Duration (s)</th>
                <th>Details</th>
            </tr>
"@

        foreach ($Test in $TestResults[$Flow].Results) {
            $StatusClass = if ($Test.Success) { "pass" } else { "fail" }
            $StatusText = if ($Test.Success) { "PASS" } else { "FAIL" }
            $ErrorDetails = if (-not $Test.Success) { "<p>Error: $($Test.ErrorMessage)</p>" } else { "" }
            
            $HtmlReport += @"
            <tr>
                <td>$($Test.TestName)</td>
                <td><span class="status $StatusClass">$StatusText</span></td>
                <td>$($Test.Duration.TotalSeconds.ToString('0.000'))</td>
                <td>$ErrorDetails</td>
            </tr>
"@
        }

        $HtmlReport += @"
        </table>
"@
    }

    # Add environment information
    $HtmlReport += @"
    </div>
    
    <div class="environment">
        <h3>Environment Details</h3>
        <p><strong>API Base URL:</strong> $($Config.ApiBaseUrl)</p>
        <p><strong>Environment:</strong> $Environment</p>
        <p><strong>Simulation Mode:</strong> $(if ($Simulate) { "Enabled" } else { "Disabled" })</p>
        <p><strong>Test Users:</strong> $($SessionData.TestUsers.Count) users from $TestUsersPath</p>
        <p><strong>Log File:</strong> $LogFile</p>
    </div>
</body>
</html>
"@

    # Save the report
    Set-Content -Path $ReportPath -Value $HtmlReport
    Write-Log "Test report generated: $ReportPath" "INFO" $Colors.Green
    
    return $ReportPath
}

# Main execution flow
Write-Log "Starting Perfect Match core flow testing" "INFO" $Colors.White
Write-Log "Mode: $(if ($Simulate) { 'Simulation' } else { 'Real API Calls' })" "INFO" $Colors.White
Write-Log "Target Environment: $Environment" "INFO" $Colors.White
Write-Log "Output Report: $ReportPath" "INFO" $Colors.White
Write-Log "Testing Flows: $($ActiveFlows -join ', ')" "INFO" $Colors.White
Write-Log "=======================================================================" "INFO" $Colors.White

# Load environment variables and configuration
Load-EnvironmentVariables

# Load test users
$UsersLoaded = Load-TestUsers

if (-not $UsersLoaded) {
    Write-Log "Cannot proceed without test users" "ERROR" $Colors.Red
    exit 1
}

# Run each flow in sequence
foreach ($Flow in $ActiveFlows) {
    Test-Flow -FlowName $Flow
}

# Generate the test report
$ReportFile = Create-TestReport

# Print final summary
$EndTime = Get-Date
$TotalTime = $EndTime - $StartTime
$TotalTimeString = "{0:hh\:mm\:ss\.fff}" -f $TotalTime

Write-Log "=======================================================================" "INFO" $Colors.Cyan
Write-Log "ALL TESTS COMPLETED" "INFO" $Colors.Cyan
Write-Log "=======================================================================" "INFO" $Colors.Cyan

$TotalTests = 0
$TotalPassed = 0
$TotalFailed = 0

foreach ($Flow in $ActiveFlows) {
    $TotalTests += $TestResults[$Flow].TotalTests
    $TotalPassed += $TestResults[$Flow].PassedTests
    $TotalFailed += $TestResults[$Flow].FailedTests
    
    $FlowSuccess = $TestResults[$Flow].PassedTests
    $FlowTotal = $TestResults[$Flow].TotalTests
    $FlowRate = if ($FlowTotal -gt 0) { [Math]::Round(($FlowSuccess / $FlowTotal) * 100, 1) } else { 0 }
    
    Write-Log "$Flow : $FlowSuccess / $FlowTotal tests passed ($FlowRate%)" "INFO" $Colors.White
}

$OverallRate = if ($TotalTests -gt 0) { [Math]::Round(($TotalPassed / $TotalTests) * 100, 1) } else { 0 }

Write-Log "=======================================================================" "INFO" $Colors.Cyan
Write-Log "OVERALL RESULT: $TotalPassed / $TotalTests tests passed ($OverallRate%)" "INFO" $Colors.Cyan
Write-Log "Total duration: $TotalTimeString" "INFO" $Colors.Cyan
Write-Log "Report saved to: $ReportFile" "INFO" $Colors.Cyan

if ($Simulate) {
    Write-Log "NOTE: This was a simulation. No actual API calls were made." "INFO" $Colors.Yellow
}

Write-Log "=======================================================================" "INFO" $Colors.Cyan
