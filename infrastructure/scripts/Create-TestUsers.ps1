<#
.SYNOPSIS
    Perfect Match Test User Generation Script

.DESCRIPTION
    This PowerShell script generates synthetic test users for the Perfect Match application.
    It creates diverse user profiles, registers them in the authentication system, populates their
    profiles with realistic data, and generates questionnaire responses with different patterns.

.PARAMETER Simulate
    Runs in simulation mode without making actual API calls or database changes.

.PARAMETER Count
    Number of test users to generate (default: 10).

.PARAMETER OutputPath
    Path to save generated user data (default: ./test-users.json).

.PARAMETER Environment
    Target environment (dev, staging, prod) (default: dev).

.PARAMETER Verbose
    Enables detailed logging.

.EXAMPLE
    .\Create-TestUsers.ps1 -Simulate
    Simulates creating 10 test users without making actual changes.

.EXAMPLE
    .\Create-TestUsers.ps1 -Count 20 -Environment staging
    Creates 20 test users in the staging environment.

.NOTES
    Requires AWS CLI and appropriate credentials when not in simulation mode.
#>

param (
    [switch]$Simulate = $true,
    [int]$Count = 10,
    [string]$OutputPath = "./test-users.json",
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment = "dev",
    [switch]$Verbose
)

# Import modules and configure environment
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Configuration and constants
$ScriptDir = $PSScriptRoot
$ProjectRoot = (Get-Item $ScriptDir).Parent.Parent.FullName
$LogFile = "$ProjectRoot/test-user-generation-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$StartTime = Get-Date

# Load environment-specific configuration
$EnvFile = "$ProjectRoot/infrastructure/.env.$Environment"
$Config = @{
    CognitoUserPoolId = "us-east-1_mockUserPoolId"
    CognitoClientId = "mockClientId"
    ApiBaseUrl = "https://api.perfectmatch.local"
    S3BucketName = "perfectmatch-test-photos"
}

# First names for generating diverse user data
$FemaleFirstNames = @(
    "Sophia", "Olivia", "Emma", "Ava", "Charlotte", "Amelia", "Isabella", "Mia", "Luna",
    "Harper", "Camila", "Gianna", "Elizabeth", "Eleanor", "Ella", "Abigail", "Sofia", "Avery",
    "Scarlett", "Emily", "Aria", "Penelope", "Chloe", "Layla", "Mila", "Nora", "Hazel", "Madison",
    "Ellie", "Lily", "Zoe", "Aspen", "Leah", "Aubrey", "Hannah", "Stella", "Evelyn", "Maya",
    "Claire", "Willow", "Victoria", "Riley", "Violet", "Nova", "Aurora", "Emilia", "Grace", "Samantha",
    "Aisha", "Mei", "Zara", "Fatima", "Priya", "Valentina", "Carmen", "Yara", "Nia", "Imani"
)

$MaleFirstNames = @(
    "Liam", "Noah", "Oliver", "Elijah", "William", "James", "Benjamin", "Lucas", "Henry",
    "Alexander", "Mason", "Michael", "Ethan", "Daniel", "Jacob", "Logan", "Jackson", "Sebastian",
    "Jack", "Aiden", "Owen", "Samuel", "Matthew", "Joseph", "Wyatt", "John", "David", "Leo",
    "Luke", "Julian", "Hudson", "Grayson", "Levi", "Isaac", "Gabriel", "Anthony", "Dylan",
    "Jaxon", "Lincoln", "Asher", "Christopher", "Mateo", "Ryan", "Nathan", "Carlos", "Ian",
    "Ahmed", "Wei", "Omar", "Raj", "Miguel", "Dante", "Luis", "Jamal", "Tomas", "Andre"
)

$NonBinaryFirstNames = @(
    "Alex", "Jordan", "Taylor", "Morgan", "Avery", "Riley", "Quinn", "Casey", "Rowan", "Skyler",
    "Parker", "Hayden", "Dakota", "River", "Phoenix", "Sage", "Ellis", "Remy", "Blake", "Reese",
    "Emerson", "Finley", "Jamie", "Ari", "Charlie", "Jules", "Kai", "Kendall", "Robin", "Shawn"
)

$LastNames = @(
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez",
    "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor",
    "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres",
    "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts", "Patel", "Chen", "Kim", "Ali", "Singh", "Shah", "Murphy", "Rossi", "Muller",
    "Schneider", "Fischer", "Weber", "Cohen", "Ivanov", "Suzuki", "Wang", "Li", "Zhang", "Gupta", "Das"
)

# Genders for diverse user profiles
$Genders = @("male", "female", "non-binary")

# Interests for generating profile data
$Interests = @(
    "Photography", "Hiking", "Reading", "Cooking", "Travel", "Fitness", "Painting",
    "Music", "Dancing", "Gaming", "Yoga", "Movies", "Theatre", "Podcasts", "Writing",
    "Baking", "Gardening", "Meditation", "Running", "Swimming", "Cycling", "Volunteering",
    "Languages", "History", "Science", "Technology", "Art", "Fashion", "Design", "Sports",
    "Nutrition", "Spirituality", "Philosophy", "Astronomy", "Animals", "DIY", "Crafting",
    "Coffee", "Wine", "Beer", "Food", "Nature", "Environment", "Politics", "Social Justice",
    "Education", "Psychology", "Entrepreneurship", "Finance", "Comedy", "Poetry"
)

# Locations for user profiles
$Locations = @(
    "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
    "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "San Jose, CA",
    "Austin, TX", "Jacksonville, FL", "San Francisco, CA", "Indianapolis, IN", "Columbus, OH",
    "Fort Worth, TX", "Charlotte, NC", "Seattle, WA", "Denver, CO", "Boston, MA",
    "Portland, OR", "Atlanta, GA", "Miami, FL", "Minneapolis, MN", "Nashville, TN",
    "New Orleans, LA", "Salt Lake City, UT", "Las Vegas, NV", "Washington, DC", "Baltimore, MD"
)

# Relationship preferences
$RelationshipTypes = @(
    "Long-term", "Casual", "Friendship", "Marriage-minded", "Not sure yet"
)

# Age preferences and distribution
$AgeRanges = @(
    @{Min = 21; Max = 25},
    @{Min = 24; Max = 30},
    @{Min = 28; Max = 35},
    @{Min = 33; Max = 40},
    @{Min = 38; Max = 45},
    @{Min = 43; Max = 50},
    @{Min = 48; Max = 60}
)

# Subscription tiers
$SubscriptionPlans = @(
    "free", "premium", "platinum"
)

# Question categories and response patterns
$QuestionnaireCategories = @(
    "Personality", "Preferences", "Compatibility", "Interests", "Lifestyle", "Values"
)

# Response patterns for creating different user "types"
$ResponsePatterns = @(
    @{
        Name = "Adventurous Extrovert"
        Traits = @{
            "Personality" = @{
                "Extraversion" = 0.9
                "Openness" = 0.8
                "Conscientiousness" = 0.5
                "Agreeableness" = 0.7
                "Neuroticism" = 0.3
            }
            "Interests" = @{
                "Outdoor Activities" = 0.9
                "Travel" = 0.9
                "Social Events" = 0.8
                "Sports" = 0.7
                "Arts" = 0.5
            }
            "Values" = @{
                "Freedom" = 0.9
                "Excitement" = 0.8
                "Variety" = 0.8
                "Independence" = 0.7
                "Achievement" = 0.6
            }
        }
    },
    @{
        Name = "Intellectual Introvert"
        Traits = @{
            "Personality" = @{
                "Extraversion" = 0.3
                "Openness" = 0.9
                "Conscientiousness" = 0.7
                "Agreeableness" = 0.6
                "Neuroticism" = 0.5
            }
            "Interests" = @{
                "Reading" = 0.9
                "Philosophy" = 0.8
                "Science" = 0.8
                "Arts" = 0.7
                "Technology" = 0.8
            }
            "Values" = @{
                "Knowledge" = 0.9
                "Wisdom" = 0.8
                "Authenticity" = 0.7
                "Privacy" = 0.8
                "Growth" = 0.7
            }
        }
    },
    @{
        Name = "Creative Ambivert"
        Traits = @{
            "Personality" = @{
                "Extraversion" = 0.5
                "Openness" = 0.9
                "Conscientiousness" = 0.6
                "Agreeableness" = 0.7
                "Neuroticism" = 0.4
            }
            "Interests" = @{
                "Art" = 0.9
                "Music" = 0.8
                "Writing" = 0.7
                "Design" = 0.8
                "Photography" = 0.7
            }
            "Values" = @{
                "Creativity" = 0.9
                "Beauty" = 0.8
                "Expression" = 0.8
                "Innovation" = 0.7
                "Authenticity" = 0.8
            }
        }
    },
    @{
        Name = "Traditional Family-Oriented"
        Traits = @{
            "Personality" = @{
                "Extraversion" = 0.6
                "Openness" = 0.4
                "Conscientiousness" = 0.8
                "Agreeableness" = 0.7
                "Neuroticism" = 0.4
            }
            "Interests" = @{
                "Cooking" = 0.7
                "Home" = 0.8
                "Family Activities" = 0.9
                "Community" = 0.7
                "Traditions" = 0.8
            }
            "Values" = @{
                "Family" = 0.9
                "Stability" = 0.8
                "Tradition" = 0.7
                "Security" = 0.8
                "Community" = 0.7
            }
        }
    },
    @{
        Name = "Career-Focused Achiever"
        Traits = @{
            "Personality" = @{
                "Extraversion" = 0.7
                "Openness" = 0.6
                "Conscientiousness" = 0.9
                "Agreeableness" = 0.5
                "Neuroticism" = 0.3
            }
            "Interests" = @{
                "Business" = 0.9
                "Technology" = 0.8
                "Self-Improvement" = 0.8
                "Networking" = 0.7
                "Finance" = 0.7
            }
            "Values" = @{
                "Success" = 0.9
                "Achievement" = 0.9
                "Recognition" = 0.7
                "Wealth" = 0.7
                "Influence" = 0.8
            }
        }
    }
)

# Define colors for console output
$Colors = @{
    Red = [ConsoleColor]::Red
    Green = [ConsoleColor]::Green
    Yellow = [ConsoleColor]::Yellow
    Blue = [ConsoleColor]::Blue
    White = [ConsoleColor]::White
    Cyan = [ConsoleColor]::Cyan
    Magenta = [ConsoleColor]::Magenta
}

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

# Function to generate a random date within a range
function Get-RandomDate {
    param (
        [int]$MinYearsAgo,
        [int]$MaxYearsAgo
    )
    
    $Today = Get-Date
    $MinDate = $Today.AddYears(-$MaxYearsAgo)
    $MaxDate = $Today.AddYears(-$MinYearsAgo)
    $Range = New-TimeSpan -Start $MinDate -End $MaxDate
    $RandomDays = Get-Random -Minimum 0 -Maximum $Range.TotalDays
    
    return $MinDate.AddDays($RandomDays)
}

# Function to generate a realistic email
function Get-RandomEmail {
    param (
        [string]$FirstName,
        [string]$LastName
    )
    
    $EmailProviders = @("gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com")
    $Provider = $EmailProviders | Get-Random
    $RandomNumber = Get-Random -Minimum 1 -Maximum 9999
    
    # Clean names to make email-friendly
    $FirstName = $FirstName.ToLower() -replace "[^a-z0-9]", ""
    $LastName = $LastName.ToLower() -replace "[^a-z0-9]", ""
    
    $EmailFormats = @(
        "$FirstName.$LastName@$Provider",
        "$FirstName$LastName@$Provider",
        "$FirstName$LastName$RandomNumber@$Provider",
        "$($FirstName.Substring(0,1))$LastName@$Provider",
        "$FirstName$($LastName.Substring(0,1))@$Provider"
    )
    
    return $EmailFormats | Get-Random
}

# Function to generate random profile media
function Get-RandomProfileMedia {
    param (
        [string]$UserId,
        [string]$Gender
    )

    # Define placeholder photo URLs - in a real environment, these would be uploaded to S3
    $MediaCount = Get-Random -Minimum 1 -Maximum 6
    $Photos = @()
    
    # Main profile photo always position 0
    $MainPhoto = @{
        media_id = [Guid]::NewGuid().ToString()
        user_id = $UserId
        media_type = "image/jpeg"
        url = "https://$($Config.S3BucketName).s3.amazonaws.com/$UserId/profile_0.jpg"
        display_order = 0
        uploaded_at = (Get-Date).ToString("o")
    }
    $Photos += $MainPhoto
    
    # Additional photos
    for ($i = 1; $i -lt $MediaCount; $i++) {
        $Photo = @{
            media_id = [Guid]::NewGuid().ToString()
            user_id = $UserId
            media_type = "image/jpeg"
            url = "https://$($Config.S3BucketName).s3.amazonaws.com/$UserId/profile_$i.jpg"
            display_order = $i
            uploaded_at = (Get-Date).ToString("o")
        }
        $Photos += $Photo
    }
    
    return $Photos
}

# Function to generate random user preferences
function Get-RandomUserPreferences {
    param (
        [string]$UserId,
        [int]$MinAge,
        [int]$MaxAge
    )
    
    # Random distance preference
    $MaxDistance = @(10, 25, 50, 100, "any") | Get-Random
    if ($MaxDistance -eq "any") {
        $MaxDistance = $null
    }
    
    # Notification settings
    $NotificationSettings = @{
        email = @{
            matches = (Get-Random -Minimum 0 -Maximum 2) -eq 1
            messages = (Get-Random -Minimum 0 -Maximum 2) -eq 1
            app_updates = (Get-Random -Minimum 0 -Maximum 2) -eq 1
        }
        push = @{
            matches = $true
            messages = $true
            app_updates = (Get-Random -Minimum 0 -Maximum 2) -eq 1
        }
    }
    
    # Privacy settings
    $PrivacySettings = @{
        profile_visibility = @("everyone", "matches_only") | Get-Random
        location_precision = @("exact", "approximate", "city_only") | Get-Random
        activity_status = (Get-Random -Minimum 0 -Maximum 2) -eq 1
    }
    
    return @{
        pref_id = [Guid]::NewGuid().ToString()
        user_id = $UserId
        notification_settings = $NotificationSettings
        privacy_settings = $PrivacySettings
        max_distance = $MaxDistance
        min_age = $MinAge
        max_age = $MaxAge
    }
}

# Function to generate a subscription with a random plan
function Get-RandomSubscription {
    param (
        [string]$UserId
    )
    
    $Plan = $SubscriptionPlans | Get-Random
    $StartDate = (Get-Date).AddDays(-(Get-Random -Minimum 1 -Maximum 90))
    
    # For free plans, no payment details
    if ($Plan -eq "free") {
        return @{
            subscription_id = [Guid]::NewGuid().ToString()
            user_id = $UserId
            plan_type = $Plan
            start_date = $StartDate.ToString("o")
            end_date = $null
            payment_status = "none"
            payment_method = $null
        }
    }
    
    # For paid plans, generate payment details
    $PaymentMethods = @("credit_card", "paypal")
    $EndDate = $StartDate.AddMonths(1)
    
    return @{
        subscription_id = [Guid]::NewGuid().ToString()
        user_id = $UserId
        plan_type = $Plan
        start_date = $StartDate.ToString("o")
        end_date = $EndDate.ToString("o")
        payment_status = "active"
        payment_method = $PaymentMethods | Get-Random
    }
}

# Function to generate questionnaire responses based on a pattern
function Get-QuestionnaireResponses {
    param (
        [string]$UserId,
        [hashtable]$Pattern
    )
    
    $CompletedAt = (Get-Date).AddDays(-(Get-Random -Minimum 1 -Maximum 14))
    $ResponseCount = Get-Random -Minimum 30 -Maximum 50
    
    # Simulate the concept of questions being answered
    $Responses = @()
    
    # Generate block-based responses from each category
    foreach ($Category in $QuestionnaireCategories) {
        $BlockId = [Guid]::NewGuid().ToString()
        $QuestionsInBlock = [Math]::Floor($ResponseCount / $QuestionnaireCategories.Count)
        
        for ($i = 0; $i -lt $QuestionsInBlock; $i++) {
            $QuestionId = [Guid]::NewGuid().ToString()
            
            # Choose appropriate response values based on the pattern
            $PatternTraits = $Pattern.Traits[$Category]
            if (-not $PatternTraits) {
                $PatternTraits = @{} # Default empty if category not in pattern
            }
            
            # Random trait from the category if available
            $TraitKeys = $PatternTraits.Keys
            $Trait = if ($TraitKeys.Count -gt 0) { $TraitKeys | Get-Random } else { "Generic" }
            $TraitValue = if ($PatternTraits[$Trait]) { $PatternTraits[$Trait] } else { Get-Random -Minimum 0.3 -Maximum 0.8 }
            
            # Create response
            $Response = @{
                questionId = $QuestionId
                blockId = $BlockId
                response = @{
                    value = $TraitValue
                    importanceScore = Get-Random -Minimum 1 -Maximum 11
                }
                answeredAt = $CompletedAt.AddMinutes(-($ResponseCount - $i)).ToString("o")
            }
            
            $Responses += $Response
        }
    }
    
    $Result = @{
        _id = [Guid]::NewGuid().ToString()
        userId = $UserId
        completedAt = $CompletedAt.ToString("o")
        progress = 100
        responses = $Responses
        metadata = @{
            startedAt = $CompletedAt.AddHours(-1).ToString("o")
            completionTime = Get-Random -Minimum 600 -Maximum 1800
            deviceType = @("mobile", "desktop", "tablet") | Get-Random
            version = "1.0"
        }
    }
    
    return $Result
}

# Function to generate a random user
function New-TestUser {
    # Determine gender
    $GenderChoice = $Genders | Get-Random
    
    # Choose first name based on gender
    $FirstName = switch ($GenderChoice) {
        "male" { $MaleFirstNames | Get-Random }
        "female" { $FemaleFirstNames | Get-Random }
        "non-binary" { $NonBinaryFirstNames | Get-Random }
    }
    
    $LastName = $LastNames | Get-Random
    $UserId = [Guid]::NewGuid().ToString()
    
    # Generate birth date for an adult (21-60 years old)
    $BirthDate = Get-RandomDate -MinYearsAgo 21 -MaxYearsAgo 60
    $Age = [int]((Get-Date) - $BirthDate).TotalDays / 365.25
    
    # Seeking gender preferences (diverse combinations)
    $SeekingGender = switch (Get-Random -Minimum 1 -Maximum 7) {
        1 { "male" }
        2 { "female" }
        3 { "non-binary" }
        4 { "male,female" }
        5 { "male,non-binary" }
        6 { "female,non-binary" }
        7 { "male,female,non-binary" }
    }
    
    # Location from list
    $Location = $Locations | Get-Random
    
    # Generate a realistic email
    $Email = Get-RandomEmail -FirstName $FirstName -LastName $LastName
    
    # Generate bio text with interests
    $UserInterests = $Interests | Get-Random -Count (Get-Random -Minimum 3 -Maximum 8)
    $Bio = "Hi, I'm $FirstName! " + (Get-Random -InputObject @(
        "I enjoy $($UserInterests -join ', ') and meeting new people.",
        "Looking for someone who shares my interests in $($UserInterests -join ', ').",
        "Passionate about $($UserInterests -join ', '). Let's connect!",
        "$($UserInterests -join ', ') are a few of my favorite things.",
        "When I'm not working, you'll find me $($UserInterests[0])."
    ))
    
    # Age preferences (realistic for the user's age)
    $MinAgePref = [Math]::Max(21, $Age - 10)
    $MaxAgePref = $Age + 10
    
    # Select a personality pattern
    $PersonalityPattern = $ResponsePatterns | Get-Random
    
    # Create the user object
    $User = @{
        User = @{
            user_id = $UserId
            email = $Email
            password_hash = "SIMULATED_HASH" # In simulation mode, we don't create actual passwords
            auth_provider = "cognito"
            first_name = $FirstName
            last_name = $LastName
            birth_date = $BirthDate.ToString("yyyy-MM-dd")
            gender = $GenderChoice
            seeking_gender = $SeekingGender
            location = $Location
            bio = $Bio
            profile_completed = $true
            created_at = (Get-Date).AddDays(-(Get-Random -Minimum 7 -Maximum 60)).ToString("o")
            last_active = (Get-Date).AddHours(-(Get-Random -Minimum 1 -Maximum 72)).ToString("o")
            profile_visibility = "matches_only"
        }
        ProfileMedia = Get-RandomProfileMedia -UserId $UserId -Gender $GenderChoice
        UserPreferences = Get-RandomUserPreferences -UserId $UserId -MinAge $MinAgePref -MaxAge $MaxAgePref
        Subscription = Get-RandomSubscription -UserId $UserId
        QuestionnaireResponses = Get-QuestionnaireResponses -UserId $UserId -Pattern $PersonalityPattern
        PersonalityType = $PersonalityPattern.Name
    }
    
    return $User
}

# Function to create users in Cognito (simulated in simulation mode)
function New-CognitoUser {
    param (
        [hashtable]$User
    )
    
    if ($Simulate) {
        Write-Log "Simulating Cognito user creation for: $($User.User.email)" "INFO" -Color $Colors.Blue
        Start-Sleep -Milliseconds 200
        return @{
            Username = $User.User.email
            UserCreateDate = Get-Date
            Attributes = @(
                @{ Name = "email"; Value = $User.User.email },
                @{ Name = "given_name"; Value = $User.User.first_name },
                @{ Name = "family_name"; Value = $User.User.last_name }
            )
        }
    }
    else {
        # In a real implementation, this would use the AWS CLI to create Cognito users
        Write-Log "Creating Cognito user: $($User.User.email)" "INFO"
        try {
            $RandomPassword = [System.Guid]::NewGuid().ToString()
            $TempPassword = ConvertTo-SecureString $RandomPassword -AsPlainText -Force
            
            $CognitoUser = aws cognito-idp admin-create-user `
                --user-pool-id $Config.CognitoUserPoolId `
                --username $User.User.email `
                --temporary-password $RandomPassword `
                --user-attributes `
                    Name=given_name,Value=$($User.User.first_name) `
                    Name=family_name,Value=$($User.User.last_name) `
                    Name=email,Value=$($User.User.email) `
                    Name=email_verified,Value=true
                    
            if ($LASTEXITCODE -ne 0) {
                Write-Log "Failed to create Cognito user: $($User.User.email)" "ERROR" -Color $Colors.Red
                return $null
            }
            
            return $CognitoUser
        }
        catch {
            Write-Log "Error creating Cognito user: $_" "ERROR" -Color $Colors.Red
            return $null
        }
    }
}

# Function to generate user database entries (simulated in simulation mode)
function New-DatabaseUser {
    param (
        [hashtable]$User
    )
    
    if ($Simulate) {
        Write-Log "Simulating database user creation for: $($User.User.email)" "INFO" -Color $Colors.Blue
        Start-Sleep -Milliseconds 300
        return $true
    }
    else {
        # In a real implementation, this would make API calls to create database records
        Write-Log "Creating database records for user: $($User.User.email)" "INFO"
        
        try {
            # Create user record
            $UserResult = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/users" -Method Post -Body ($User.User | ConvertTo-Json) -ContentType "application/json"
            
            # Create profile media
            foreach ($Media in $User.ProfileMedia) {
                $MediaResult = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/profile/media" -Method Post -Body ($Media | ConvertTo-Json) -ContentType "application/json"
            }
            
            # Create user preferences
            $PreferencesResult = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/users/preferences" -Method Post -Body ($User.UserPreferences | ConvertTo-Json) -ContentType "application/json"
            
            # Create subscription
            $SubscriptionResult = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/subscriptions" -Method Post -Body ($User.Subscription | ConvertTo-Json) -ContentType "application/json"
            
            # Create questionnaire responses
            $QuestionnaireResult = Invoke-RestMethod -Uri "$($Config.ApiBaseUrl)/api/v1/questionnaires/responses" -Method Post -Body ($User.QuestionnaireResponses | ConvertTo-Json) -ContentType "application/json"
            
            return $true
        }
        catch {
            Write-Log "Error creating database user: $_" "ERROR" -Color $Colors.Red
            return $false
        }
    }
}

# Main execution
Write-Log "Starting test user generation script" "INFO" -Color $Colors.White
Write-Log "Mode: $(if ($Simulate) { 'Simulation' } else { 'Real' })" "INFO" -Color $Colors.White
Write-Log "Target Environment: $Environment" "INFO" -Color $Colors.White
Write-Log "Users to generate: $Count" "INFO" -Color $Colors.White

# Load environment variables
if (-not $Simulate) {
    if (Test-Path $EnvFile) {
        Write-Log "Loading environment configuration from $EnvFile" "INFO"
        
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
                    "S3_BUCKET_NAME" { $Config.S3BucketName = $Value }
                }
            }
        }
    }
    else {
        Write-Log "Environment file not found: $EnvFile" "WARN" $Colors.Yellow
    }
}

# Define colors for console output
$Colors = @{
    Red = [ConsoleColor]::Red
    Green = [ConsoleColor]::Green
    Yellow = [ConsoleColor]::Yellow
    Blue = [ConsoleColor]::Blue
    White = [ConsoleColor]::White
}

# Create output directory if it doesn't exist
$OutputDir = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrEmpty($OutputDir) -and -not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Generate the test users
$TestUsers = @()
$SuccessCount = 0
$FailureCount = 0

Write-Log "Beginning user generation process..." "INFO" $Colors.White

for ($i = 0; $i -lt $Count; $i++) {
    $UserNumber = $i + 1
    Write-Log "Generating user $UserNumber of $Count..." "INFO" $Colors.White
    
    try {
        # Generate user data
        $User = New-TestUser
        
        # Create Cognito user (or simulate)
        $CognitoResult = New-CognitoUser -User $User
        
        if ($null -eq $CognitoResult) {
            Write-Log "Failed to create Cognito user for $($User.User.email)" "ERROR" $Colors.Red
            $FailureCount++
            continue
        }
        
        # Create database entries (or simulate)
        $DbResult = New-DatabaseUser -User $User
        
        if (-not $DbResult) {
            Write-Log "Failed to create database entries for $($User.User.email)" "ERROR" $Colors.Red
            $FailureCount++
            continue
        }
        
        # Store user data
        $TestUsers += $User
        $SuccessCount++
        
        Write-Log "Successfully created test user: $($User.User.first_name) $($User.User.last_name) ($($User.User.email))" "SUCCESS" $Colors.Green
    }
    catch {
        Write-Log "Error generating user $UserNumber : $_" "ERROR" $Colors.Red
        $FailureCount++
    }
}

# Save the test users to file
$JsonOutput = @{
    generated_at = (Get-Date).ToString("o")
    mode = if ($Simulate) { "simulation" } else { "real" }
    environment = $Environment
    users_requested = $Count
    users_created = $SuccessCount
    users_failed = $FailureCount
    users = $TestUsers
} | ConvertTo-Json -Depth 10

Set-Content -Path $OutputPath -Value $JsonOutput

# Generate summary
$EndTime = Get-Date
$Duration = $EndTime - $StartTime
$DurationString = "{0:hh\:mm\:ss\.fff}" -f $Duration

Write-Log "Test user generation completed" "INFO" $Colors.White
Write-Log "=================================================================" "INFO" $Colors.White
Write-Log "Summary:" "INFO" $Colors.White
Write-Log "- Mode: $(if ($Simulate) { 'Simulation' } else { 'Real' })" "INFO" $Colors.White
Write-Log "- Environment: $Environment" "INFO" $Colors.White
Write-Log "- Total users requested: $Count" "INFO" $Colors.White
Write-Log "- Successfully created: $SuccessCount" "INFO" $Colors.Green
Write-Log "- Failed: $FailureCount" "INFO" $Colors.Red
Write-Log "- Duration: $DurationString" "INFO" $Colors.White
Write-Log "- Output file: $OutputPath" "INFO" $Colors.White
Write-Log "=================================================================" "INFO" $Colors.White

if ($Simulate) {
    Write-Log "NOTE: This was a simulation. No actual users were created." "INFO" $Colors.Yellow
}
