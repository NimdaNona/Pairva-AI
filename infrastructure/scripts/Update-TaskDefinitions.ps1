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
    .\Update-TaskDefinitions.ps1 -Version "1.0.2" -Verbose
    Process task definitions with version 1.0.2 and verify all resources, with verbose logging.

.EXAMPLE
    .\Update-TaskDefinitions.ps1 -Version "1.0.2" -CreateECSCluster -CreateECRRepositories -Verbose
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

# VPC and networking
$VPC_NAME = "pairva-vpc"
$SECURITY_GROUP_NAME = "pairva-ecs-sg"
$CONTAINER_PORTS = @(3000)  # Default ports for both frontend and backend
$CREATE_NETWORK_RESOURCES = $true

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
    
    Write-Host "Processing task definition: $InputPath"
    Write-Host "  AWS Account ID: $AccountId"
    Write-Host "  AWS Region: $Region"
    Write-Host "  Version: $Version"
    
    # Read task definition template
    $taskDefContent = Get-Content -Path $InputPath -Raw
    
    # Replace all placeholder variables
    $taskDefContent = $taskDefContent.Replace('${AWS_ACCOUNT_ID}', $AccountId)
    $taskDefContent = $taskDefContent.Replace('${AWS_REGION}', $Region)
    $taskDefContent = $taskDefContent.Replace('${VERSION}', $Version)
    
    # Convert to JSON object to update health check configuration
    $taskDefJson = $taskDefContent | ConvertFrom-Json
    
    # Validate and update container health check configuration
    foreach ($containerDef in $taskDefJson.containerDefinitions) {
        if ($containerDef.healthCheck) {
            $containerName = $containerDef.name
            Write-Host "  Updating health check configuration for container: $containerName"
            
            # Update health check parameters for improved resilience
            $containerDef.healthCheck.timeout = 15      # Increase from 10 to 15 seconds
            $containerDef.healthCheck.retries = 7       # Increase from 5 to 7 attempts
            $containerDef.healthCheck.startPeriod = 180 # Extend from 120 to 180 seconds
            $containerDef.healthCheck.interval = 30     # Keep default interval
            
            # Validate health check endpoint based on container type
            $endpointValid = $false
            $command = $containerDef.healthCheck.command | Where-Object { $_ -match "curl" }
            
            if ($containerName -match "backend") {
                # Validate backend health check endpoint
                if ($command -match "http://localhost:\d+/api/health") {
                    $endpointValid = $true
                    Write-Host "  ✅ Backend health check endpoint is correct: /api/health"
                }
                else {
                    Write-Host "  ⚠️ Correcting backend health check endpoint to: /api/health"
                    # Update the healthcheck command to use the correct endpoint
                    $port = $containerDef.portMappings[0].containerPort
                    $containerDef.healthCheck.command = @("CMD-SHELL", "curl -f http://localhost:$port/api/health || exit 1")
                }
            }
            elseif ($containerName -match "frontend") {
                # Validate frontend health check endpoint
                if ($command -match "http://localhost:\d+/health") {
                    $endpointValid = $true
                    Write-Host "  ✅ Frontend health check endpoint is correct: /health"
                }
                else {
                    Write-Host "  ⚠️ Correcting frontend health check endpoint to: /health"
                    # Update the healthcheck command to use the correct endpoint
                    $port = $containerDef.portMappings[0].containerPort
                    $containerDef.healthCheck.command = @("CMD-SHELL", "curl -f http://localhost:$port/health || exit 1")
                }
            }
            
            Write-Host "  Updated health check configuration:"
            Write-Host "    - Timeout: 15 seconds (was 10)"
            Write-Host "    - Retries: 7 attempts (was 5)"
            Write-Host "    - Start Period: 180 seconds (was 120)"
            Write-Host "    - Interval: 30 seconds (unchanged)"
        }
    }
    
    # Convert back to JSON and write to output file
    $updatedTaskDefContent = $taskDefJson | ConvertTo-Json -Depth 10
    $updatedTaskDefContent | Out-File -FilePath $OutputPath -Encoding utf8
    
    Write-Host "Processed task definition saved to: $OutputPath"
    return $true
}

# Function to verify VPC configuration and security groups
function Verify-NetworkConfiguration {
    param(
        [string]$VpcName,
        [string]$SecurityGroupName,
        [array]$ContainerPorts,
        [bool]$CreateIfMissing = $true,
        [string]$Region
    )
    
    Write-Host "Verifying network configuration..."
    $networkConfigValid = $true
    $results = @{
        VpcExists = $false
        VpcId = $null
        SecurityGroupExists = $false
        SecurityGroupId = $null
        SubnetsValid = $false
        InternetAccess = $false
        Created = $false
    }
    
    # Find the VPC
    Write-Host "Checking if VPC '$VpcName' exists..."
    try {
        $vpcFilter = "Name=tag:Name,Values=$VpcName"
        $vpc = aws ec2 describe-vpcs --filters $vpcFilter --query "Vpcs[0].VpcId" --output text 2>&1
        
        if ($vpc -and $vpc -ne "None") {
            Write-Host "  ✅ VPC found: $vpc"
            $results.VpcExists = $true
            $results.VpcId = $vpc
            
            # Check for internet gateway attachment
            $igws = aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$vpc" --query "InternetGateways[].InternetGatewayId" --output text 2>&1
            
            if ($igws -and $igws -ne "None") {
                Write-Host "  ✅ Internet Gateway is attached to VPC"
                $results.InternetAccess = $true
            } else {
                Write-Host "  ❌ No Internet Gateway attached to VPC" -ForegroundColor Red
                $networkConfigValid = $false
                
                if ($CreateIfMissing) {
                    Write-Host "  Creating and attaching Internet Gateway..."
                    $igw = aws ec2 create-internet-gateway --query "InternetGateway.InternetGatewayId" --output text
                    aws ec2 attach-internet-gateway --vpc-id $vpc --internet-gateway-id $igw
                    
                    # Add default route to all public route tables
                    $routeTables = aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$vpc" "Name=tag:Type,Values=public" --query "RouteTables[].RouteTableId" --output text
                    
                    if ($routeTables -and $routeTables -ne "None") {
                        foreach ($rt in $routeTables.Split()) {
                            aws ec2 create-route --route-table-id $rt --destination-cidr-block "0.0.0.0/0" --gateway-id $igw
                        }
                        Write-Host "  ✅ Added default routes to public subnets"
                    } else {
                        $mainRouteTable = aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$vpc" "Name=association.main,Values=true" --query "RouteTables[0].RouteTableId" --output text
                        aws ec2 create-route --route-table-id $mainRouteTable --destination-cidr-block "0.0.0.0/0" --gateway-id $igw
                        Write-Host "  ✅ Added default route to main route table"
                    }
                    
                    $results.InternetAccess = $true
                    $results.Created = $true
                }
            }
            
            # Check for NAT Gateways (important for private subnets)
            $natGateways = aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$vpc" "Name=state,Values=available" --query "NatGateways[].NatGatewayId" --output text 2>&1
            
            if ($natGateways -and $natGateways -ne "None") {
                Write-Host "  ✅ NAT Gateways found for private subnet egress"
            } else {
                Write-Host "  ⚠️ No NAT Gateways found - private subnets might not have internet access" -ForegroundColor Yellow
            }
            
            # Check subnet configuration 
            $subnets = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc" --query "Subnets[].[SubnetId,CidrBlock,Tags[?Key=='Name'].Value | [0]]" --output json | ConvertFrom-Json
            
            if ($subnets.Count -lt 2) {
                Write-Host "  ❌ Insufficient subnets. Found $($subnets.Count), but at least 2 are required for Fargate" -ForegroundColor Red
                $networkConfigValid = $false
            } else {
                Write-Host "  ✅ Found $($subnets.Count) subnets, which is sufficient for Fargate"
                
                # Check for CIDR overlap
                $cidrBlocks = $subnets | ForEach-Object { $_[1] }
                $duplicates = $cidrBlocks | Group-Object | Where-Object { $_.Count -gt 1 }
                
                if ($duplicates) {
                    Write-Host "  ❌ CIDR block overlap detected" -ForegroundColor Red
                    $networkConfigValid = $false
                } else {
                    Write-Host "  ✅ No CIDR block overlaps detected"
                    $results.SubnetsValid = $true
                }
            }
            
            # Check if Security Group exists
            $securityGroup = aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc" "Name=group-name,Values=$SecurityGroupName" --query "SecurityGroups[0].GroupId" --output text 2>&1
            
            if ($securityGroup -and $securityGroup -ne "None") {
                Write-Host "  ✅ Security Group found: $securityGroup"
                $results.SecurityGroupExists = $true
                $results.SecurityGroupId = $securityGroup
                
                # Verify inbound rules for container ports
                Write-Host "  Checking security group rules for container ports: $($ContainerPorts -join ', ')"
                
                foreach ($port in $ContainerPorts) {
                    $rules = aws ec2 describe-security-group-rules --filter "Name=group-id,Values=$securityGroup" "Name=from-port,Values=$port" "Name=to-port,Values=$port" --query "SecurityGroupRules[0].SecurityGroupRuleId" --output text 2>&1
                    
                    if (-not $rules -or $rules -eq "None") {
                        Write-Host "  ❌ Missing inbound rule for port $port" -ForegroundColor Red
                        
                        if ($CreateIfMissing) {
                            Write-Host "  Adding inbound rule for port $port..."
                            aws ec2 authorize-security-group-ingress --group-id $securityGroup --protocol tcp --port $port --cidr "0.0.0.0/0"
                            Write-Host "  ✅ Added inbound rule for port $port"
                            $results.Created = $true
                        } else {
                            $networkConfigValid = $false
                        }
                    } else {
                        Write-Host "  ✅ Inbound rule exists for port $port"
                    }
                }
            } else {
                Write-Host "  ❌ Security Group not found" -ForegroundColor Red
                
                if ($CreateIfMissing) {
                    Write-Host "  Creating security group '$SecurityGroupName'..."
                    $sgId = aws ec2 create-security-group --group-name $SecurityGroupName --description "Security group for Pairva ECS services" --vpc-id $vpc --query "GroupId" --output text
                    
                    # Tag the security group
                    aws ec2 create-tags --resources $sgId --tags "Key=Name,Value=$SecurityGroupName"
                    
                    # Add inbound rules for container ports
                    foreach ($port in $ContainerPorts) {
                        aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port $port --cidr "0.0.0.0/0"
                        Write-Host "  ✅ Added inbound rule for port $port"
                    }
                    
                    # Add self-referencing rule for container-to-container communication
                    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol -1 --source-group $sgId
                    Write-Host "  ✅ Added self-referencing rule for container-to-container communication"
                    
                    $results.SecurityGroupExists = $true
                    $results.SecurityGroupId = $sgId
                    $results.Created = $true
                } else {
                    $networkConfigValid = $false
                }
            }
        } else {
            Write-Host "  ❌ VPC not found" -ForegroundColor Red
            
            if ($CreateIfMissing) {
                Write-Host "  Creating VPC '$VpcName'..."
                # Create a new VPC with CIDR block 10.0.0.0/16
                $vpcId = aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query "Vpc.VpcId" --output text
                
                # Tag the VPC
                aws ec2 create-tags --resources $vpcId --tags "Key=Name,Value=$VpcName"
                
                # Enable DNS support and hostnames
                aws ec2 modify-vpc-attribute --vpc-id $vpcId --enable-dns-support "{\"Value\":true}"
                aws ec2 modify-vpc-attribute --vpc-id $vpcId --enable-dns-hostnames "{\"Value\":true}"
                
                # Create Internet Gateway
                $igwId = aws ec2 create-internet-gateway --query "InternetGateway.InternetGatewayId" --output text
                aws ec2 create-tags --resources $igwId --tags "Key=Name,Value=$VpcName-igw"
                
                # Attach Internet Gateway to VPC
                aws ec2 attach-internet-gateway --vpc-id $vpcId --internet-gateway-id $igwId
                
                # Create public and private subnets across two availability zones
                $azs = aws ec2 describe-availability-zones --query "AvailabilityZones[0:2].ZoneName" --output text
                $azList = $azs.Split()
                
                # Create subnets
                $publicSubnet1Id = aws ec2 create-subnet --vpc-id $vpcId --cidr-block 10.0.1.0/24 --availability-zone $azList[0] --query "Subnet.SubnetId" --output text
                $publicSubnet2Id = aws ec2 create-subnet --vpc-id $vpcId --cidr-block 10.0.2.0/24 --availability-zone $azList[1] --query "Subnet.SubnetId" --output text
                $privateSubnet1Id = aws ec2 create-subnet --vpc-id $vpcId --cidr-block 10.0.3.0/24 --availability-zone $azList[0] --query "Subnet.SubnetId" --output text
                $privateSubnet2Id = aws ec2 create-subnet --vpc-id $vpcId --cidr-block 10.0.4.0/24 --availability-zone $azList[1] --query "Subnet.SubnetId" --output text
                
                # Tag subnets
                aws ec2 create-tags --resources $publicSubnet1Id --tags "Key=Name,Value=$VpcName-public-1" "Key=Type,Value=public"
                aws ec2 create-tags --resources $publicSubnet2Id --tags "Key=Name,Value=$VpcName-public-2" "Key=Type,Value=public"
                aws ec2 create-tags --resources $privateSubnet1Id --tags "Key=Name,Value=$VpcName-private-1" "Key=Type,Value=private"
                aws ec2 create-tags --resources $privateSubnet2Id --tags "Key=Name,Value=$VpcName-private-2" "Key=Type,Value=private"
                
                # Create route table for public subnets
                $publicRouteTableId = aws ec2 create-route-table --vpc-id $vpcId --query "RouteTable.RouteTableId" --output text
                aws ec2 create-tags --resources $publicRouteTableId --tags "Key=Name,Value=$VpcName-public-rt" "Key=Type,Value=public"
                
                # Create route to Internet Gateway
                aws ec2 create-route --route-table-id $publicRouteTableId --destination-cidr-block 0.0.0.0/0 --gateway-id $igwId
                
                # Associate public subnets with public route table
                aws ec2 associate-route-table --subnet-id $publicSubnet1Id --route-table-id $publicRouteTableId
                aws ec2 associate-route-table --subnet-id $publicSubnet2Id --route-table-id $publicRouteTableId
                
                # Create a security group for ECS
                $sgId = aws ec2 create-security-group --group-name $SecurityGroupName --description "Security group for Pairva ECS services" --vpc-id $vpcId --query "GroupId" --output text
                aws ec2 create-tags --resources $sgId --tags "Key=Name,Value=$SecurityGroupName"
                
                # Add inbound rules for container ports
                foreach ($port in $ContainerPorts) {
                    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port $port --cidr 0.0.0.0/0
                }
                
                # Add self-referencing rule for container-to-container communication
                aws ec2 authorize-security-group-ingress --group-id $sgId --protocol -1 --source-group $sgId
                
                Write-Host "  ✅ VPC created successfully with ID: $vpcId"
                Write-Host "  ✅ Created 2 public and 2 private subnets across different AZs"
                Write-Host "  ✅ Internet Gateway attached and route created for public subnets"
                Write-Host "  ✅ Security Group created with necessary rules"
                
                $results.VpcExists = $true
                $results.VpcId = $vpcId
                $results.SecurityGroupExists = $true
                $results.SecurityGroupId = $sgId
                $results.SubnetsValid = $true
                $results.InternetAccess = $true
                $results.Created = $true
                $networkConfigValid = $true
            } else {
                $networkConfigValid = $false
            }
        }
    } catch {
        Write-Host "  ❌ Error checking VPC configuration: $_" -ForegroundColor Red
        $networkConfigValid = $false
    }
    
    $results.IsValid = $networkConfigValid
    return $results
}

# Function to validate ECS service definitions for Fargate
function Test-ECSServiceConfiguration {
    param(
        [string]$TaskDefinitionPath
    )
    
    Write-Host "Validating ECS service configuration in task definition: $TaskDefinitionPath"
    
    try {
        # Read task definition
        $taskDefJson = Get-Content -Path $TaskDefinitionPath -Raw | ConvertFrom-Json
        
        $isValid = $true
        
        # Check network mode
        if ($taskDefJson.networkMode -ne "awsvpc") {
            Write-Host "  ❌ Network mode must be 'awsvpc' for Fargate, found: $($taskDefJson.networkMode)" -ForegroundColor Red
            $isValid = $false
        } else {
            Write-Host "  ✅ Network mode is correctly set to 'awsvpc'"
        }
        
        # Check CPU and memory configuration
        if (-not $taskDefJson.cpu -or -not $taskDefJson.memory) {
            Write-Host "  ❌ CPU and memory must be defined at the task level for Fargate" -ForegroundColor Red
            $isValid = $false
        } else {
            # Verify valid CPU and memory combinations for Fargate
            $validCpuMemory = $false
            
            switch ($taskDefJson.cpu) {
                "256" {
                    if ($taskDefJson.memory -eq "512" -or $taskDefJson.memory -eq "1024" -or $taskDefJson.memory -eq "2048") {
                        $validCpuMemory = $true
                    }
                }
                "512" {
                    if ($taskDefJson.memory -eq "1024" -or $taskDefJson.memory -eq "2048" -or $taskDefJson.memory -eq "3072" -or $taskDefJson.memory -eq "4096") {
                        $validCpuMemory = $true
                    }
                }
                "1024" {
                    if ($taskDefJson.memory -eq "2048" -or $taskDefJson.memory -eq "3072" -or $taskDefJson.memory -eq "4096" -or
                        $taskDefJson.memory -eq "5120" -or $taskDefJson.memory -eq "6144" -or $taskDefJson.memory -eq "7168" -or $taskDefJson.memory -eq "8192") {
                        $validCpuMemory = $true
                    }
                }
                "2048" {
                    if ($taskDefJson.memory -eq "4096" -or $taskDefJson.memory -eq "5120" -or $taskDefJson.memory -eq "6144" -or
                        $taskDefJson.memory -eq "7168" -or $taskDefJson.memory -eq "8192" -or $taskDefJson.memory -eq "9216" -or
                        $taskDefJson.memory -eq "10240" -or $taskDefJson.memory -eq "11264" -or $taskDefJson.memory -eq "12288" -or
                        $taskDefJson.memory -eq "13312" -or $taskDefJson.memory -eq "14336" -or $taskDefJson.memory -eq "15360" -or $taskDefJson.memory -eq "16384") {
                        $validCpuMemory = $true
                    }
                }
                "4096" {
                    if ([int]$taskDefJson.memory -ge 8192 -and [int]$taskDefJson.memory -le 30720) {
                        $validCpuMemory = $true
                    }
                }
            }
            
            if ($validCpuMemory) {
                Write-Host "  ✅ Valid CPU ($($taskDefJson.cpu)) and memory ($($taskDefJson.memory)) configuration for Fargate"
            } else {
                Write-Host "  ❌ Invalid CPU ($($taskDefJson.cpu)) and memory ($($taskDefJson.memory)) combination for Fargate" -ForegroundColor Red
                $isValid = $false
            }
        }
        
        # Check Fargate compatibility
        if (-not $taskDefJson.requiresCompatibilities -or -not ($taskDefJson.requiresCompatibilities -contains "FARGATE")) {
            Write-Host "  ❌ Task definition must specify 'FARGATE' compatibility" -ForegroundColor Red
            $isValid = $false
        } else {
            Write-Host "  ✅ Task definition correctly specifies 'FARGATE' compatibility"
        }
        
        # Check for execution role ARN
        if (-not $taskDefJson.executionRoleArn) {
            Write-Host "  ❌ Task definition must specify 'executionRoleArn' for Fargate" -ForegroundColor Red
            $isValid = $false
        } else {
            Write-Host "  ✅ Task definition includes 'executionRoleArn'"
        }
        
        # Check for container-level requirements
        foreach ($containerDef in $taskDefJson.containerDefinitions) {
            $containerName = $containerDef.name
            
            # Check for essential flag
            if (-not $containerDef.essential) {
                Write-Host "  ⚠️ Container '$containerName' is not marked as essential, which may cause unexpected behavior" -ForegroundColor Yellow
            }
            
            # Check for port mappings
            if (-not $containerDef.portMappings -or $containerDef.portMappings.Count -eq 0) {
                Write-Host "  ⚠️ Container '$containerName' does not have any port mappings defined" -ForegroundColor Yellow
            } else {
                # Check for hostPort == containerPort (required for awsvpc mode)
                foreach ($portMapping in $containerDef.portMappings) {
                    if ($portMapping.hostPort -ne $portMapping.containerPort) {
                        Write-Host "  ❌ In awsvpc mode, hostPort ($($portMapping.hostPort)) must equal containerPort ($($portMapping.containerPort)) for container '$containerName'" -ForegroundColor Red
                        $isValid = $false
                    }
                }
            }
            
            # Check for unsupported features
            if ($containerDef.links -and $containerDef.links.Count -gt 0) {
                Write-Host "  ❌ Container '$containerName' uses 'links' which is not supported in Fargate" -ForegroundColor Red
                $isValid = $false
            }
            
            if ($containerDef.hostNetwork) {
                Write-Host "  ❌ Container '$containerName' uses 'hostNetwork' which is not supported in Fargate" -ForegroundColor Red
                $isValid = $false
            }
            
            if ($containerDef.privileged) {
                Write-Host "  ❌ Container '$containerName' uses 'privileged' mode which is not supported in Fargate" -ForegroundColor Red
                $isValid = $false
            }
        }
        
        if ($isValid) {
            Write-Host "  ✅ ECS service configuration is valid for Fargate" -ForegroundColor Green
        } else {
            Write-Host "  ❌ ECS service configuration has issues that need to be fixed" -ForegroundColor Red
        }
        
        return $isValid
    } catch {
        Write-Host "  ❌ Error validating ECS service configuration: $_" -ForegroundColor Red
        return $false
    }
}

# Function to validate task definition health check configuration
function Test-HealthCheckConfiguration {
    param(
        [string]$TaskDefinitionPath
    )
    
    Write-Host "Validating health check configuration in task definition: $TaskDefinitionPath"
    
    try {
        # Read task definition
        $taskDefJson = Get-Content -Path $TaskDefinitionPath -Raw | ConvertFrom-Json
        
        $isValid = $true
        foreach ($containerDef in $taskDefJson.containerDefinitions) {
            $containerName = $containerDef.name
            
            # Check if health check is configured
            if (-not $containerDef.healthCheck) {
                Write-Host "  ❌ Container $containerName does not have a health check configured" -ForegroundColor Red
                $isValid = $false
                continue
            }
            
            # Check health check timeout
            if ($containerDef.healthCheck.timeout -lt 15) {
                Write-Host "  ❌ Container $containerName health check timeout is too low: $($containerDef.healthCheck.timeout)s, should be at least 15s" -ForegroundColor Red
                $isValid = $false
            }
            
            # Check health check retries
            if ($containerDef.healthCheck.retries -lt 7) {
                Write-Host "  ❌ Container $containerName health check retries is too low: $($containerDef.healthCheck.retries), should be at least 7" -ForegroundColor Red
                $isValid = $false
            }
            
            # Check health check start period
            if ($containerDef.healthCheck.startPeriod -lt 180) {
                Write-Host "  ❌ Container $containerName health check startPeriod is too low: $($containerDef.healthCheck.startPeriod)s, should be at least 180s" -ForegroundColor Red
                $isValid = $false
            }
            
            # Validate endpoint based on container type
            $command = $containerDef.healthCheck.command | Where-Object { $_ -match "curl" }
            if ($containerName -match "backend" -and -not ($command -match "/api/health")) {
                Write-Host "  ❌ Container $containerName should use /api/health endpoint for health checks" -ForegroundColor Red
                $isValid = $false
            }
            elseif ($containerName -match "frontend" -and -not ($command -match "/health")) {
                Write-Host "  ❌ Container $containerName should use /health endpoint for health checks" -ForegroundColor Red
                $isValid = $false
            }
        }
        
        if ($isValid) {
            Write-Host "  ✅ All health check configurations are valid" -ForegroundColor Green
        }
        else {
            Write-Host "  ⚠️ Some health check configurations need to be fixed" -ForegroundColor Yellow
        }
        
        return $isValid
    }
    catch {
        Write-Host "  ❌ Error validating health check configuration: $_" -ForegroundColor Red
        return $false
    }
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
    
    Write-Host "Checking if log group exists: $LogGroupName"
    
    $logGroupExists = $false
    $logGroups = aws logs describe-log-groups --log-group-name-prefix $LogGroupName --query "logGroups[?logGroupName=='$LogGroupName'].logGroupName" --output text
    
    if ($logGroups) {
        Write-Host "  Log group already exists"
        
        # Check retention policy
        $retentionDays = aws logs describe-log-groups --log-group-name-prefix $LogGroupName --query "logGroups[0].retentionInDays" --output text
        
        # If retention is not set or different from 30 days, update it
        if ($retentionDays -eq "None" -or $retentionDays -ne "30") {
            Write-Host "  Updating retention policy to 30 days"
            # Use full parameter name to avoid ambiguity
            aws logs put-retention-policy --log-group-name="$LogGroupName" --retention-in-days 30 --region $Region
        } else {
            Write-Host "  Retention policy already set to 30 days"
        }
        
        $logGroupExists = $true
    } else {
        if ($CreateLogGroups) {
            Write-Host "  Creating log group: $LogGroupName"
            aws logs create-log-group --log-group-name="$LogGroupName" --region $Region
            aws logs put-retention-policy --log-group-name="$LogGroupName" --retention-in-days 30 --region $Region
            Write-Host "  Log group created with 30-day retention"
            $logGroupExists = $true
        } else {
            Write-Warning "  Log group does not exist: $LogGroupName"
        }
    }
    
    return $logGroupExists
}

# Create inline IAM policy document
function New-IAMPolicyDocument {
    param(
        [string]$RoleName,
        [string]$AccountId,
        [string]$Region
    )
    
    if ($RoleName -eq $TASK_EXECUTION_ROLE) {
        # Enhanced ecsTaskExecutionRole with explicit permissions
        return @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": [
                "arn:aws:logs:${Region}:${AccountId}:log-group:/ecs/*:*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "ssm:GetParameters",
                "kms:Decrypt"
            ],
            "Resource": [
                "arn:aws:secretsmanager:${Region}:${AccountId}:secret:*",
                "arn:aws:ssm:${Region}:${AccountId}:parameter/*",
                "arn:aws:kms:${Region}:${AccountId}:key/*"
            ]
        }
    ]
}
"@
    } elseif ($RoleName -eq $BACKEND_TASK_ROLE) {
        # Backend task role with specific resource access
        return @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams"
            ],
            "Resource": "arn:aws:logs:${Region}:${AccountId}:log-group:/ecs/pairva-backend:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::pairva-assets*",
                "arn:aws:s3:::pairva-assets*/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameters",
                "ssm:GetParameter",
                "ssm:GetParametersByPath"
            ],
            "Resource": "arn:aws:ssm:${Region}:${AccountId}:parameter/pairva/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:BatchGetItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": [
                "arn:aws:dynamodb:${Region}:${AccountId}:table/pairva-*"
            ]
        }
    ]
}
"@
    } elseif ($RoleName -eq $FRONTEND_TASK_ROLE) {
        # Frontend task role with minimal permissions
        return @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams"
            ],
            "Resource": "arn:aws:logs:${Region}:${AccountId}:log-group:/ecs/pairva-frontend:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameters",
                "ssm:GetParameter",
                "ssm:GetParametersByPath"
            ],
            "Resource": "arn:aws:ssm:${Region}:${AccountId}:parameter/pairva/frontend/*"
        }
    ]
}
"@
    } else {
        Write-Error "Unknown role name: $RoleName"
        return $null
    }
}

# Ensure IAM roles exist
function Ensure-IAMRoleExists {
    param(
        [string]$RoleName,
        [string]$AccountId,
        [string]$Region
    )
    
    Write-Host "Checking if IAM role exists: $RoleName"
    
    $roleExists = $false
    try {
        $role = aws iam get-role --role-name $RoleName --query "Role.RoleName" --output text
        if ($role -eq $RoleName) {
            Write-Host "  Role already exists"
            $roleExists = $true
            
            # Ensure role has correct trust relationship
            $trustPolicy = aws iam get-role --role-name $RoleName --query "Role.AssumeRolePolicyDocument" --output json
            $trustPolicyJson = $trustPolicy | ConvertFrom-Json
            
            $hasEcsService = $false
            foreach ($statement in $trustPolicyJson.Statement) {
                if ($statement.Principal.Service -eq "ecs-tasks.amazonaws.com") {
                    $hasEcsService = $true
                    break
                }
            }
            
            if (-not $hasEcsService) {
                Write-Host "  Updating trust relationship for ECS tasks"
                
                # Create assume role policy document with ECS trusted service
                $assumeRolePolicy = @"
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
"@
                
                $tempFile = [System.IO.Path]::GetTempFileName()
                $assumeRolePolicy | Out-File -FilePath $tempFile -Encoding utf8
                
                # Update trust relationship
                aws iam update-assume-role-policy --role-name $RoleName --policy-document file://$tempFile
                Remove-Item -Path $tempFile -Force
            }
            
            # Check if the role has the specific policies needed
            $attachedPolicies = aws iam list-attached-role-policies --role-name $RoleName --query "AttachedPolicies[].PolicyArn" --output json | ConvertFrom-Json
            
            if ($RoleName -eq $TASK_EXECUTION_ROLE) {
                # Expected policies for task execution role
                $ecsPolicy = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
                $cwPolicy = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
                $ecrPolicy = "arn:aws:iam::aws:policy/AmazonECR-FullAccess"
                
                $hasPolicies = $attachedPolicies -contains $ecsPolicy -and $attachedPolicies -contains $cwPolicy -and $attachedPolicies -contains $ecrPolicy
                
                if (-not $hasPolicies) {
                    Write-Host "  Attaching required policies to Task Execution Role"
                    
                    if ($attachedPolicies -notcontains $ecsPolicy) {
                        aws iam attach-role-policy --role-name $RoleName --policy-arn $ecsPolicy
                        Write-Host "  Attached ECS Task Execution Policy"
                    }
                    
                    if ($attachedPolicies -notcontains $cwPolicy) {
                        aws iam attach-role-policy --role-name $RoleName --policy-arn $cwPolicy
                        Write-Host "  Attached CloudWatch Logs Policy"
                    }
                    
                    if ($attachedPolicies -notcontains $ecrPolicy) {
                        try {
                            aws iam attach-role-policy --role-name $RoleName --policy-arn $ecrPolicy
                            Write-Host "  Attached ECR Full Access Policy"
                        } catch {
                            # Fallback to read-only policy if full access isn't available
                            $ecrReadOnlyPolicy = "arn:aws:iam::aws:policy/AmazonECRReadOnlyAccess"
                            aws iam attach-role-policy --role-name $RoleName --policy-arn $ecrReadOnlyPolicy
                            Write-Host "  Attached ECR Read-Only Policy (fallback)"
                        }
                    }
                }
                
                # Create or update inline policy for specific permissions
                $inlinePolicyName = "PairvaTaskExecutionPolicy"
                $inlinePolicyDocument = New-IAMPolicyDocument -RoleName $RoleName -AccountId $AccountId -Region $Region
                
                $tempFile = [System.IO.Path]::GetTempFileName()
                $inlinePolicyDocument | Out-File -FilePath $tempFile -Encoding utf8
                
                aws iam put-role-policy --role-name $RoleName --policy-name $inlinePolicyName --policy-document file://$tempFile
                Write-Host "  Updated inline policy with specific permissions"
                
                Remove-Item -Path $tempFile -Force
            }
        }
    } catch {
        if ($CreateIAMRoles) {
            Write-Host "  Role does not exist, creating it..."
            
            # Create assume role policy document
            $assumeRolePolicy = @"
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
"@
            
            $tempFile = [System.IO.Path]::GetTempFileName()
            $assumeRolePolicy | Out-File -FilePath $tempFile -Encoding utf8
            
            # Create the role
            aws iam create-role --role-name $RoleName --assume-role-policy-document file://$tempFile
            
            # Attach appropriate policies based on role
            if ($RoleName -eq $TASK_EXECUTION_ROLE) {
                aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
                aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
                aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/AmazonECR-FullAccess
                Write-Host "  Attached ECS Task Execution, CloudWatch Logs, and ECR policies"
                
                # Create specific inline policy
                $inlinePolicyName = "PairvaTaskExecutionPolicy"
                $inlinePolicyDocument = New-IAMPolicyDocument -RoleName $RoleName -AccountId $AccountId -Region $Region
                
                $inlinePolicyFile = [System.IO.Path]::GetTempFileName()
                $inlinePolicyDocument | Out-File -FilePath $inlinePolicyFile -Encoding utf8
                
                aws iam put-role-policy --role-name $RoleName --policy-name $inlinePolicyName --policy-document file://$inlinePolicyFile
                Write-Host "  Created inline policy with specific permissions"
                
                Remove-Item -Path $inlinePolicyFile -Force
            } elseif ($RoleName -eq $BACKEND_TASK_ROLE) {
                aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
                aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess
                aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
                Write-Host "  Attached S3, SSM and CloudWatch Logs policies"
                
                # Create specific inline policy
                $inlinePolicyName = "PairvaBackendTaskPolicy"
                $inlinePolicyDocument = New-IAMPolicyDocument -RoleName $RoleName -AccountId $AccountId -Region $Region
                
                $inlinePolicyFile = [System.IO.Path]::GetTempFileName()
                $inlinePolicyDocument | Out-File -FilePath $inlinePolicyFile -Encoding utf8
                
                aws iam put-role-policy --role-name $RoleName --policy-name $inlinePolicyName --policy-document file://$inlinePolicyFile
                Write-Host "  Created inline policy with specific permissions"
                
                Remove-Item -Path $inlinePolicyFile -Force
            } elseif ($RoleName -eq $FRONTEND_TASK_ROLE) {
                aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess
                aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
                Write-Host "  Attached SSM and CloudWatch Logs policies"
                
                # Create specific inline policy
                $inlinePolicyName = "PairvaFrontendTaskPolicy"
                $inlinePolicyDocument = New-IAMPolicyDocument -RoleName $RoleName -AccountId $AccountId -Region $Region
                
                $inlinePolicyFile = [System.IO.Path]::GetTempFileName()
                $inlinePolicyDocument | Out-File -FilePath $inlinePolicyFile -Encoding utf8
                
                aws iam put-role-policy --role-name $RoleName --policy-name $inlinePolicyName --policy-document file://$inlinePolicyFile
                Write-Host "  Created inline policy with specific permissions"
                
                Remove-Item -Path $inlinePolicyFile -Force
            }
            
            # Clean up
            Remove-Item -Path $tempFile -Force
            
            Write-Host "  Role created successfully"
            $roleExists = $true
        } else {
            Write-Warning "  Role does not exist: $RoleName"
        }
    }
    
    return $roleExists
}

# Ensure ECR repository exists
function Ensure-ECRRepositoryExists {
    param(
        [string]$RepositoryName,
        [string]$Region
    )
    
    Write-Host "Checking if ECR repository exists: $RepositoryName"
    
    $repoExists = $false
    $repo = aws ecr describe-repositories --repository-names $RepositoryName --query "repositories[0].repositoryName" --output text 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ECR repository already exists"
        
        # Check if repository has a lifecycle policy
        $lifecyclePolicy = $null
        try {
            $lifecyclePolicy = aws ecr get-lifecycle-policy --repository-name $RepositoryName --query "lifecyclePolicyText" --output text 2>&1
        } catch {
            # No policy exists
        }
        
        if (-not $lifecyclePolicy -or $LASTEXITCODE -ne 0) {
            Write-Host "  Setting lifecycle policy to keep only the latest 30 images"
            # Set lifecycle policy to keep only the latest 30 images
            $lifecyclePolicy = @"
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep only the latest 30 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 30
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
"@
            $tempFile = [System.IO.Path]::GetTempFileName()
            $lifecyclePolicy | Out-File -FilePath $tempFile -Encoding utf8
            
            aws ecr put-lifecycle-policy --repository-name $RepositoryName --lifecycle-policy-text file://$tempFile --region $Region
            
            # Clean up
            Remove-Item -Path $tempFile -Force
        }
        
        $repoExists = $true
    } else {
        if ($CreateECRRepositories) {
            Write-Host "  Creating ECR repository: $RepositoryName"
            aws ecr create-repository --repository-name $RepositoryName --region $Region
            
            # Set lifecycle policy to keep only the latest 30 images
            $lifecyclePolicy = @"
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep only the latest 30 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 30
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
"@
            $tempFile = [System.IO.Path]::GetTempFileName()
            $lifecyclePolicy | Out-File -FilePath $tempFile -Encoding utf8
            
            aws ecr put-lifecycle-policy --repository-name $RepositoryName --lifecycle-policy-text file://$tempFile --region $Region
            
            # Clean up
            Remove-Item -Path $tempFile -Force
            
            Write-Host "  ECR repository created with lifecycle policy"
            $repoExists = $true
        } else {
            Write-Warning "  ECR repository does not exist: $RepositoryName"
        }
    }
    
    return $repoExists
}

# Verify image exists in ECR
function Verify-ECRImageExists {
    param(
        [string]$RepositoryName,
        [string]$ImageTag,
        [string]$Region
    )
    
    Write-Host "Checking if image exists in ECR: $RepositoryName (tag: $ImageTag)"
    
    try {
        $imageDetails = aws ecr describe-images --repository-name $RepositoryName --image-ids "imageTag=$ImageTag" --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $imageJson = $imageDetails | ConvertFrom-Json
            $imageSizeInMB = [math]::Round($imageJson.imageDetails[0].imageSizeInBytes / 1MB, 2)
            $pushedAt = $imageJson.imageDetails[0].imagePushedAt
            
            Write-Host "  Image exists in ECR: $RepositoryName (tag: $ImageTag)"
            Write-Host "  Size: $imageSizeInMB MB, Pushed at: $pushedAt"
            return $true
        } else {
            Write-Warning "  Image does not exist in ECR: $RepositoryName (tag: $ImageTag)"
            Write-Warning "  You need to build and push this image before deployment"
            Write-Host "  To build and push the image, run:"
            $buildCmd = 'docker build -t ' + $RepositoryName + ':' + $ImageTag + ' .'
            $loginCmd = 'aws ecr get-login-password --region ' + $Region + ' | docker login --username AWS --password-stdin [account-id].dkr.ecr.' + $Region + '.amazonaws.com'
            $tagCmd = 'docker tag ' + $RepositoryName + ':' + $ImageTag + ' [account-id].dkr.ecr.' + $Region + '.amazonaws.com/' + $RepositoryName + ':' + $ImageTag
            $pushCmd = 'docker push [account-id].dkr.ecr.' + $Region + '.amazonaws.com/' + $RepositoryName + ':' + $ImageTag
            Write-Host "  $buildCmd"
            Write-Host "  $loginCmd"
            Write-Host "  $tagCmd" 
            Write-Host "  $pushCmd"
            return $false
        }
    } catch {
        Write-Warning "  Error checking if image exists: $_"
        return $false
    }
}

# Ensure ECS cluster exists
function Ensure-ECSClusterExists {
    param(
        [string]$ClusterName,
        [string]$Region
    )
    
    Write-Host "Checking if ECS cluster exists: $ClusterName"
    
    $clusterExists = $false
    $cluster = aws ecs describe-clusters --clusters $ClusterName --query "clusters[0].status" --output text 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $cluster -eq "ACTIVE") {
        Write-Host "  ECS cluster already exists and is active"
        
        # Check if the cluster has the required capacity providers
        $capacityProviders = aws ecs describe-clusters --clusters $ClusterName --include ATTACHMENTS --query "clusters[0].capacityProviders" --output json | ConvertFrom-Json
        
        $hasFargate = $capacityProviders -contains "FARGATE"
        $hasFargateSpot = $capacityProviders -contains "FARGATE_SPOT"
        
        if (-not $hasFargate -or -not $hasFargateSpot) {
            Write-Host "  Updating capacity providers for the cluster"
            aws ecs put-cluster-capacity-providers --cluster $ClusterName --capacity-providers FARGATE FARGATE_SPOT --default-capacity-provider-strategy "capacityProvider=FARGATE,weight=1,base=1" "capacityProvider=FARGATE_SPOT,weight=4" --region $Region
            Write-Host "  Updated cluster with FARGATE and FARGATE_SPOT capacity providers"
        } else {
            # Check default capacity provider strategy
            $defaultStrategy = aws ecs describe-clusters --clusters $ClusterName --include SETTINGS --query "clusters[0].settings" --output json | ConvertFrom-Json
            
            # If capacity providers are set properly but no default strategy, set it
            if (-not $defaultStrategy -or -not ($defaultStrategy | Where-Object { $_.name -eq "defaultCapacityProviderStrategy" })) {
                Write-Host "  Setting default capacity provider strategy"
                aws ecs put-cluster-capacity-providers --cluster $ClusterName --capacity-providers FARGATE FARGATE_SPOT --default-capacity-provider-strategy "capacityProvider=FARGATE,weight=1,base=1" "capacityProvider=FARGATE_SPOT,weight=4" --region $Region
                Write-Host "  Updated default capacity provider strategy"
            }
        }
        
        $clusterExists = $true
    } else {
        if ($CreateECSCluster) {
            Write-Host "  Creating ECS cluster: $ClusterName"
            
            # Create cluster
            aws ecs create-cluster --cluster-name $ClusterName --region $Region
            
            # Set capacity providers
            Write-Host "  Configuring capacity providers for the cluster"
            aws ecs put-cluster-capacity-providers --cluster $ClusterName --capacity-providers FARGATE FARGATE_SPOT --default-capacity-provider-strategy "capacityProvider=FARGATE,weight=1,base=1" "capacityProvider=FARGATE_SPOT,weight=4" --region $Region
            
            Write-Host "  ECS cluster created with FARGATE and FARGATE_SPOT capacity providers"
            $clusterExists = $true
        } else {
            Write-Warning "  ECS cluster does not exist or is not active: $ClusterName"
        }
    }
    
    return $clusterExists
}

# Main function
function Update-TaskDefinitions {
    param(
        [string]$Version = "1.0.2",
        [switch]$CreateLogGroups = $true,
        [switch]$CreateIAMRoles = $true,
        [switch]$CreateECSCluster = $true,
        [switch]$CreateECRRepositories = $true,
        [switch]$VerifyOnly = $false,
        [switch]$CreateNetworkResources = $true,
        [switch]$SkipNetworkVerification = $false,
        [switch]$SkipServiceVerification = $false
    )
    
    $results = @{
        IAMRoles = @{}
        LogGroups = @{}
        ECRRepositories = @{}
        ECRImages = @{}
        ECSCluster = $false
        NetworkConfig = $false
        ServiceConfig = @{}
        ProcessedFiles = @{}
    }
    
    # Get AWS account info
    $awsInfo = Get-AWSAccountInfo
    $AccountId = $awsInfo.AccountId
    $Region = $awsInfo.Region
    
    Write-Host "AWS Account ID: $AccountId"
    Write-Host "AWS Region: $Region"
    Write-Host "Version: $Version"
    
    # Create IAM roles if they don't exist
    Write-Host "Verifying IAM roles..."
    $results.IAMRoles[$TASK_EXECUTION_ROLE] = Ensure-IAMRoleExists -RoleName $TASK_EXECUTION_ROLE -AccountId $AccountId -Region $Region
    $results.IAMRoles[$BACKEND_TASK_ROLE] = Ensure-IAMRoleExists -RoleName $BACKEND_TASK_ROLE -AccountId $AccountId -Region $Region
    $results.IAMRoles[$FRONTEND_TASK_ROLE] = Ensure-IAMRoleExists -RoleName $FRONTEND_TASK_ROLE -AccountId $AccountId -Region $Region
    
    # Create log groups if they don't exist
    Write-Host "Verifying CloudWatch log groups..."
    $results.LogGroups[$BACKEND_LOG_GROUP] = Ensure-LogGroupExists -LogGroupName $BACKEND_LOG_GROUP -Region $Region
    $results.LogGroups[$FRONTEND_LOG_GROUP] = Ensure-LogGroupExists -LogGroupName $FRONTEND_LOG_GROUP -Region $Region
    
    # Create ECR repositories if they don't exist
    Write-Host "Verifying ECR repositories..."
    $results.ECRRepositories[$BACKEND_REPO_NAME] = Ensure-ECRRepositoryExists -RepositoryName $BACKEND_REPO_NAME -Region $Region
    $results.ECRRepositories[$FRONTEND_REPO_NAME] = Ensure-ECRRepositoryExists -RepositoryName $FRONTEND_REPO_NAME -Region $Region
    
    # Verify Docker images exist in ECR
    Write-Host "Verifying Docker images in ECR..."
    $results.ECRImages[$BACKEND_REPO_NAME] = Verify-ECRImageExists -RepositoryName $BACKEND_REPO_NAME -ImageTag $Version -Region $Region
    $results.ECRImages[$FRONTEND_REPO_NAME] = Verify-ECRImageExists -RepositoryName $FRONTEND_REPO_NAME -ImageTag $Version -Region $Region
    
    # Create ECS cluster if it doesn't exist
    Write-Host "Verifying ECS cluster..."
    $results.ECSCluster = Ensure-ECSClusterExists -ClusterName $CLUSTER_NAME -Region $Region
    
    # Verify network configuration if not skipped
    if (-not $SkipNetworkVerification) {
        Write-Host "`nVerifying network configuration..."
        $networkVerification = Verify-NetworkConfiguration -VpcName $VPC_NAME -SecurityGroupName $SECURITY_GROUP_NAME -ContainerPorts $CONTAINER_PORTS -CreateIfMissing $CreateNetworkResources -Region $Region
        $results.NetworkConfig = $networkVerification.IsValid
        
        if ($networkVerification.IsValid) {
            Write-Host "✅ Network configuration is valid for Fargate deployment" -ForegroundColor Green
        } else {
            Write-Host "❌ Network configuration has issues that need to be fixed" -ForegroundColor Red
            if (-not $CreateNetworkResources) {
                Write-Host "Try running with -CreateNetworkResources to automatically create missing network resources" -ForegroundColor Yellow
            }
        }
    }
    
    if ($VerifyOnly) {
        Write-Host "Verification complete. Not processing task definitions due to VerifyOnly flag."
    } else {
        # Process backend task definition
        Write-Host "`nProcessing backend task definition..."
        $backendInputPath = Join-Path (Get-Location) "infrastructure/task-definitions/backend-task-def.json"
        $backendOutputPath = Join-Path (Get-Location) "infrastructure/task-definitions/backend-task-def-prepared.json"
        $results.ProcessedFiles["backend"] = Process-TaskDefinition -InputPath $backendInputPath -OutputPath $backendOutputPath -AccountId $AccountId -Region $Region -Version $Version
        
        # Process frontend task definition
        Write-Host "`nProcessing frontend task definition..."
        $frontendInputPath = Join-Path (Get-Location) "infrastructure/task-definitions/frontend-task-def.json"
        $frontendOutputPath = Join-Path (Get-Location) "infrastructure/task-definitions/frontend-task-def-prepared.json"
        $results.ProcessedFiles["frontend"] = Process-TaskDefinition -InputPath $frontendInputPath -OutputPath $frontendOutputPath -AccountId $AccountId -Region $Region -Version $Version
        
        # Verify Fargate compatibility and ECS service configuration
        if (-not $SkipServiceVerification) {
            Write-Host "`nVerifying Fargate compatibility and service configurations..."
            $results.ServiceConfig["backend"] = Test-ECSServiceConfiguration -TaskDefinitionPath $backendOutputPath
            $results.ServiceConfig["frontend"] = Test-ECSServiceConfiguration -TaskDefinitionPath $frontendOutputPath
            
            # Verify health check configurations
            Write-Host "`nVerifying health check configurations..."
            $backendHealthCheck = Test-HealthCheckConfiguration -TaskDefinitionPath $backendOutputPath
            $frontendHealthCheck = Test-HealthCheckConfiguration -TaskDefinitionPath $frontendOutputPath
            
            if ($backendHealthCheck -and $frontendHealthCheck) {
                Write-Host "✅ All health check configurations are valid" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Health check configurations need review" -ForegroundColor Yellow
            }
        }
    }
    
    # Display summary
    Write-Host "`nResource Verification Summary:"
    Write-Host "---------------------------"
    
    Write-Host "IAM Roles:"
    foreach ($role in $results.IAMRoles.Keys) {
        Write-Host "  $role $(if($results.IAMRoles[$role]){'✅ Available'}else{'❌ Missing'})"
    }
    
    Write-Host "CloudWatch Log Groups:"
    foreach ($logGroup in $results.LogGroups.Keys) {
        Write-Host "  $logGroup $(if($results.LogGroups[$logGroup]){'✅ Available'}else{'❌ Missing'})"
    }
    
    Write-Host "ECR Repositories:"
    foreach ($repo in $results.ECRRepositories.Keys) {
        Write-Host "  $repo $(if($results.ECRRepositories[$repo]){'✅ Available'}else{'❌ Missing'})"
    }
    
    Write-Host "ECR Images (Version: $Version):"
    foreach ($repo in $results.ECRImages.Keys) {
        $status = if($results.ECRImages[$repo]){'✅ Available'}else{'❌ Missing'}
        Write-Host "  $repo [tag: $Version] $status"
    }
    
    Write-Host "ECS Cluster:"
    Write-Host "  $CLUSTER_NAME $(if($results.ECSCluster){'✅ Available'}else{'❌ Missing'})"
    
    if (-not $VerifyOnly) {
        Write-Host "Processed Task Definitions:"
        foreach ($app in $results.ProcessedFiles.Keys) {
            Write-Host "  $app $(if($results.ProcessedFiles[$app]){'✅ Processed'}else{'❌ Failed to process'})"
        }
    }
    
    # Check if all verifications passed
    $allPassed = $true
    foreach ($role in $results.IAMRoles.Keys) {
        if (-not $results.IAMRoles[$role]) { $allPassed = $false }
    }
    foreach ($logGroup in $results.LogGroups.Keys) {
        if (-not $results.LogGroups[$logGroup]) { $allPassed = $false }
    }
    foreach ($repo in $results.ECRRepositories.Keys) {
        if (-not $results.ECRRepositories[$repo]) { $allPassed = $false }
    }
    foreach ($repo in $results.ECRImages.Keys) {
        if (-not $results.ECRImages[$repo]) { $allPassed = $false }
    }
    if (-not $results.ECSCluster) { $allPassed = $false }
    
    if (-not $VerifyOnly) {
        foreach ($app in $results.ProcessedFiles.Keys) {
            if (-not $results.ProcessedFiles[$app]) { $allPassed = $false }
        }
    }
    
    if ($allPassed) {
        Write-Host "`n✅ All verifications passed successfully!" -ForegroundColor Green
        if (-not $VerifyOnly) {
            Write-Host "`nTask definitions have been processed and saved. You can now run:"
            Write-Host ".\infrastructure\scripts\Deploy-Production.ps1 -Version `"$Version`" -UseProcessedTaskDefs -Verbose" -ForegroundColor Cyan
        }
    } else {
        Write-Host "`n❌ Some verifications failed. Please review the summary above." -ForegroundColor Red
        if (-not $CreateIAMRoles -or -not $CreateLogGroups -or -not $CreateECSCluster -or -not $CreateECRRepositories) {
            Write-Host "Try running the script with the following parameters to create missing resources:" -ForegroundColor Yellow
            Write-Host ".\infrastructure\scripts\Update-TaskDefinitions.ps1 -Version `"$Version`" -CreateIAMRoles -CreateLogGroups -CreateECSCluster -CreateECRRepositories -Verbose" -ForegroundColor Yellow
        }
    }
    
    return $results
}

# Run the function if script is executed directly
if ($MyInvocation.InvocationName -ne ".") {
    Update-TaskDefinitions -Version $Version -CreateLogGroups:$CreateLogGroups -CreateIAMRoles:$CreateIAMRoles -CreateECSCluster:$CreateECSCluster -CreateECRRepositories:$CreateECRRepositories
}

# Export the function for use in other scripts
Export-ModuleMember -Function Update-TaskDefinitions
