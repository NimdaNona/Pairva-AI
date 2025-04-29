#!/bin/bash
# Perfect Match Production Deployment Script
# This script performs the deployment of the Perfect Match application to production
# It includes verification, deployment, and health check steps

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AWS_REGION=$(aws configure get region || echo "us-east-1")
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
VERSION=$(date +"%Y%m%d-%H%M%S")
PREVIOUS_VERSION=$(aws ecs describe-services --cluster pairva-cluster --services pairva-backend-service --query "services[0].taskDefinition" --output text | grep -oE '[0-9]+$' || echo "")
VALIDATE_ONLY=false
LOG_FILE="${PROJECT_ROOT}/deployment-$(date +"%Y%m%d-%H%M%S").log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log messages
log() {
  local message="$1"
  local level="${2:-INFO}"
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

# Function to handle errors
handle_error() {
  local exit_code=$?
  log "An error occurred during deployment. Exit code: ${exit_code}" "ERROR"
  log "Check ${LOG_FILE} for detailed logs" "ERROR"
  if [ -n "${PREVIOUS_VERSION}" ] && [ "${VALIDATE_ONLY}" = "false" ]; then
    log "Initiating rollback to previous version: ${PREVIOUS_VERSION}" "WARN"
    rollback
  fi
  exit ${exit_code}
}

# Function to display help
display_help() {
  echo "Perfect Match Production Deployment Script"
  echo ""
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --validate                  Perform validation checks without actual deployment"
  echo "  --region REGION             AWS region (default: from AWS CLI config)"
  echo "  --account-id ACCOUNT_ID     AWS account ID (default: current account)"
  echo "  --version VERSION           Version tag (default: timestamp)"
  echo "  --help                      Display this help message and exit"
  echo ""
}

# Function to verify AWS environment
verify_aws_environment() {
  log "Verifying AWS environment..." "INFO"
  
  # Verify AWS CLI credentials
  log "Checking AWS credentials..." "INFO"
  aws sts get-caller-identity > /dev/null || {
    log "AWS credentials are invalid or expired" "ERROR"
    return 1
  }
  log "AWS credentials are valid" "SUCCESS"
  
  # Verify CloudFormation stacks
  log "Checking CloudFormation stacks..." "INFO"
  local failed_stacks=$(aws cloudformation describe-stacks \
    --query "Stacks[?contains(StackName, 'PerfectMatch') && contains(StackStatus, 'FAILED')].StackName" \
    --output text)
  
  if [ -n "${failed_stacks}" ]; then
    log "The following stacks are in FAILED state: ${failed_stacks}" "ERROR"
    return 1
  fi
  log "All CloudFormation stacks are in valid states" "SUCCESS"
  
  # Verify ECR repositories
  log "Checking ECR repositories..." "INFO"
  local backend_repo=$(aws ecr describe-repositories \
    --query "repositories[?repositoryName=='pairva-backend'].repositoryName" \
    --output text)
  local frontend_repo=$(aws ecr describe-repositories \
    --query "repositories[?repositoryName=='pairva-frontend'].repositoryName" \
    --output text)
  
  if [ -z "${backend_repo}" ] || [ -z "${frontend_repo}" ]; then
    log "One or more required ECR repositories are missing" "ERROR"
    log "Backend repo: ${backend_repo:-MISSING}" "ERROR"
    log "Frontend repo: ${frontend_repo:-MISSING}" "ERROR"
    return 1
  fi
  log "All required ECR repositories exist" "SUCCESS"
  
  # Verify SSM parameters
  log "Checking required SSM parameters..." "INFO"
  local missing_params=false
  local required_params=(
    "/perfectmatch/production/DATABASE_URL"
    "/perfectmatch/production/AUTH_SECRET"
    "/perfectmatch/production/COGNITO_USER_POOL_ID"
    "/perfectmatch/production/COGNITO_CLIENT_ID"
    "/perfectmatch/production/S3_BUCKET_NAME"
    "/perfectmatch/production/API_URL"
    "/perfectmatch/production/REDIS_URL"
  )
  
  for param in "${required_params[@]}"; do
    aws ssm get-parameter --name "${param}" --with-decryption > /dev/null 2>&1 || {
      log "Missing required SSM parameter: ${param}" "ERROR"
      missing_params=true
    }
  done
  
  if [ "${missing_params}" = "true" ]; then
    log "One or more required SSM parameters are missing" "ERROR"
    return 1
  fi
  log "All required SSM parameters exist" "SUCCESS"
  
  # Verify ECS cluster
  log "Checking ECS cluster..." "INFO"
  local cluster=$(aws ecs describe-clusters \
    --clusters pairva-cluster \
    --query "clusters[0].status" \
    --output text)
  
  if [ "${cluster}" != "ACTIVE" ]; then
    log "ECS cluster is not active. Status: ${cluster:-MISSING}" "ERROR"
    return 1
  fi
  log "ECS cluster is active" "SUCCESS"
  
  log "AWS environment verification completed successfully" "SUCCESS"
  return 0
}

# Function to build and push Docker images
build_and_push_images() {
  if [ "${VALIDATE_ONLY}" = "true" ]; then
    log "Skipping image build and push in validation mode" "INFO"
    return 0
  fi
  
  log "Building and pushing Docker images..." "INFO"
  
  # Log in to ECR
  log "Logging in to ECR..." "INFO"
  aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
  
  # Build and push backend image
  log "Building backend image..." "INFO"
  docker build -t pairva-backend:${VERSION} ${PROJECT_ROOT}/backend || {
    log "Failed to build backend image" "ERROR"
    return 1
  }
  
  log "Tagging backend image..." "INFO"
  docker tag pairva-backend:${VERSION} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pairva-backend:${VERSION} || {
    log "Failed to tag backend image" "ERROR"
    return 1
  }
  
  log "Pushing backend image..." "INFO"
  docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pairva-backend:${VERSION} || {
    log "Failed to push backend image" "ERROR"
    return 1
  }
  
  # Build and push frontend image
  log "Building frontend image..." "INFO"
  docker build -t pairva-frontend:${VERSION} ${PROJECT_ROOT}/frontend --build-arg CI=true || {
    log "Failed to build frontend image" "ERROR"
    return 1
  }
  
  log "Tagging frontend image..." "INFO"
  docker tag pairva-frontend:${VERSION} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pairva-frontend:${VERSION} || {
    log "Failed to tag frontend image" "ERROR"
    return 1
  }
  
  log "Pushing frontend image..." "INFO"
  docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pairva-frontend:${VERSION} || {
    log "Failed to push frontend image" "ERROR"
    return 1
  }
  
  log "Docker images built and pushed successfully" "SUCCESS"
  return 0
}

# Function to update CloudFormation stacks
update_stacks() {
  if [ "${VALIDATE_ONLY}" = "true" ]; then
    log "Skipping stack updates in validation mode" "INFO"
    return 0
  }
  
  log "Updating CloudFormation stacks..." "INFO"
  
  # First make sure we have the latest CDK output
  log "Synthesizing CloudFormation templates with CDK..." "INFO"
  cd ${PROJECT_ROOT}/infrastructure && npx cdk synth || {
    log "Failed to synthesize CloudFormation templates" "ERROR"
    return 1
  }
  
  # Update pipeline stack with new version
  log "Updating Pipeline stack..." "INFO"
  aws cloudformation deploy \
    --template-file ${PROJECT_ROOT}/infrastructure/cdk.out/PerfectMatchPipeline.template.json \
    --stack-name PerfectMatch-Pipeline \
    --parameter-overrides Version=${VERSION} \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset || {
    log "Failed to update Pipeline stack" "ERROR"
    return 1
  }
  
  log "CloudFormation stacks updated successfully" "SUCCESS"
  return 0
}

# Function to perform canary deployment
canary_deployment() {
  if [ "${VALIDATE_ONLY}" = "true" ]; then
    log "Skipping canary deployment in validation mode" "INFO"
    return 0
  }
  
  log "Performing canary deployment..." "INFO"
  
  # Update ECS services with new task definitions
  log "Updating backend service (canary - 20%)..." "INFO"
  aws ecs update-service \
    --cluster pairva-cluster \
    --service pairva-backend-service \
    --task-definition pairva-backend:${VERSION} \
    --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100" \
    --force-new-deployment || {
    log "Failed to update backend service" "ERROR"
    return 1
  }
  
  # Wait for backend deployment to stabilize (20%)
  log "Waiting for backend deployment to stabilize (20%)..." "INFO"
  aws ecs wait services-stable \
    --cluster pairva-cluster \
    --services pairva-backend-service || {
    log "Backend deployment failed to stabilize" "ERROR"
    return 1
  }
  
  # Verify backend health
  log "Verifying backend health..." "INFO"
  verify_service_health "pairva-backend-service" || {
    log "Backend health check failed" "ERROR"
    return 1
  }
  
  # Update frontend service now that backend is healthy
  log "Updating frontend service..." "INFO"
  aws ecs update-service \
    --cluster pairva-cluster \
    --service pairva-frontend-service \
    --task-definition pairva-frontend:${VERSION} \
    --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=150,minimumHealthyPercent=100" \
    --force-new-deployment || {
    log "Failed to update frontend service" "ERROR"
    return 1
  }
  
  # Wait for frontend deployment to stabilize
  log "Waiting for frontend deployment to stabilize..." "INFO"
  aws ecs wait services-stable \
    --cluster pairva-cluster \
    --services pairva-frontend-service || {
    log "Frontend deployment failed to stabilize" "ERROR"
    return 1
  }
  
  # Verify frontend health
  log "Verifying frontend health..." "INFO"
  verify_service_health "pairva-frontend-service" || {
    log "Frontend health check failed" "ERROR"
    return 1
  }
  
  log "Canary deployment completed successfully" "SUCCESS"
  return 0
}

# Function to verify service health
verify_service_health() {
  local service_name=$1
  local retries=12
  local wait_time=10
  
  log "Verifying health of ${service_name}..." "INFO"
  
  # Check ECS service status
  for i in $(seq 1 ${retries}); do
    local desired_count=$(aws ecs describe-services \
      --cluster pairva-cluster \
      --services ${service_name} \
      --query "services[0].desiredCount" \
      --output text)
    
    local running_count=$(aws ecs describe-services \
      --cluster pairva-cluster \
      --services ${service_name} \
      --query "services[0].runningCount" \
      --output text)
    
    if [ "${desired_count}" = "${running_count}" ] && [ ${desired_count} -gt 0 ]; then
      log "Service ${service_name} is healthy (${running_count}/${desired_count} tasks running)" "SUCCESS"
      
      # If backend service, also check application health endpoint
      if [ "${service_name}" = "pairva-backend-service" ]; then
        log "Checking application health endpoint..." "INFO"
        
        local load_balancer_dns=$(aws elbv2 describe-load-balancers \
          --query "LoadBalancers[?contains(LoadBalancerName, 'PerfectMatch')].DNSName" \
          --output text)
        
        if [ -z "${load_balancer_dns}" ]; then
          log "Could not determine load balancer DNS" "ERROR"
          return 1
        fi
        
        # Wait for DNS propagation and service to be fully available
        sleep 20
        
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" https://${load_balancer_dns}/api/health || echo "000")
        
        if [ "${status_code}" = "200" ]; then
          log "Application health endpoint returned 200 OK" "SUCCESS"
        else
          log "Application health endpoint returned ${status_code}, expected 200" "ERROR"
          return 1
        fi
      fi
      
      return 0
    fi
    
    log "Service ${service_name} not yet healthy (${running_count}/${desired_count} tasks running). Retrying in ${wait_time}s (${i}/${retries})..." "INFO"
    sleep ${wait_time}
  done
  
  log "Service ${service_name} failed to become healthy after ${retries} retries" "ERROR"
  return 1
}

# Function to perform full health checks
perform_health_checks() {
  log "Performing comprehensive health checks..." "INFO"
  
  # Verify ECS services are healthy
  log "Checking ECS service status..." "INFO"
  local services_status=$(aws ecs describe-services \
    --cluster pairva-cluster \
    --services pairva-backend-service pairva-frontend-service \
    --query "services[*].{Name:serviceName,Status:status,DesiredCount:desiredCount,RunningCount:runningCount}" \
    --output json)
  
  echo "${services_status}" | jq -r '.[] | "\(.Name): \(.Status) (\(.RunningCount)/\(.DesiredCount))"' | while read line; do
    log "${line}" "INFO"
  done
  
  # Any services with status != ACTIVE or runningCount < desiredCount indicate issues
  local unhealthy_services=$(echo "${services_status}" | jq '[.[] | select(.Status != "ACTIVE" or .RunningCount < .DesiredCount)]')
  if [ "${unhealthy_services}" != "[]" ]; then
    log "One or more services are unhealthy" "ERROR"
    return 1
  fi
  
  # Verify Cognito User Pool status
  log "Checking Cognito User Pool status..." "INFO"
  local cognito_pool_id=$(aws ssm get-parameter --name "/perfectmatch/production/COGNITO_USER_POOL_ID" --query "Parameter.Value" --output text)
  local cognito_status=$(aws cognito-idp describe-user-pool \
    --user-pool-id ${cognito_pool_id} \
    --query "UserPool.Status" \
    --output text)
  
  if [ "${cognito_status}" != "ACTIVE" ]; then
    log "Cognito User Pool is not active. Status: ${cognito_status}" "ERROR"
    return 1
  fi
  log "Cognito User Pool is active" "SUCCESS"
  
  # Verify API Gateway
  log "Checking API Gateway endpoints..." "INFO"
  local api_id=$(aws apigateway get-rest-apis --query "items[?name=='PerfectMatchAPI'].id" --output text)
  if [ -z "${api_id}" ]; then
    log "Could not find PerfectMatchAPI" "ERROR"
    return 1
  fi
  log "API Gateway is available" "SUCCESS"
  
  # Check application health
  log "Checking application health endpoint..." "INFO"
  local load_balancer_dns=$(aws elbv2 describe-load-balancers \
    --query "LoadBalancers[?contains(LoadBalancerName, 'PerfectMatch')].DNSName" \
    --output text)
  
  local status_code=$(curl -s -o /dev/null -w "%{http_code}" https://${load_balancer_dns}/api/health || echo "000")
  
  if [ "${status_code}" = "200" ]; then
    log "Application health endpoint returned 200 OK" "SUCCESS"
  else
    log "Application health endpoint returned ${status_code}, expected 200" "ERROR"
    return 1
  fi
  
  log "All health checks passed successfully" "SUCCESS"
  return 0
}

# Function to rollback to previous version
rollback() {
  log "Initiating rollback to previous version: ${PREVIOUS_VERSION}" "WARN"
  
  # Rollback backend service
  log "Rolling back backend service to version ${PREVIOUS_VERSION}..." "INFO"
  aws ecs update-service \
    --cluster pairva-cluster \
    --service pairva-backend-service \
    --task-definition pairva-backend:${PREVIOUS_VERSION} \
    --force-new-deployment || {
    log "Failed to rollback backend service" "ERROR"
    return 1
  }
  
  # Rollback frontend service
  log "Rolling back frontend service to version ${PREVIOUS_VERSION}..." "INFO"
  aws ecs update-service \
    --cluster pairva-cluster \
    --service pairva-frontend-service \
    --task-definition pairva-frontend:${PREVIOUS_VERSION} \
    --force-new-deployment || {
    log "Failed to rollback frontend service" "ERROR"
    return 1
  }
  
  # Wait for services to stabilize
  log "Waiting for services to stabilize after rollback..." "INFO"
  aws ecs wait services-stable \
    --cluster pairva-cluster \
    --services pairva-backend-service pairva-frontend-service || {
    log "Services failed to stabilize after rollback" "ERROR"
    return 1
  }
  
  log "Rollback to version ${PREVIOUS_VERSION} completed" "SUCCESS"
  return 0
}

# Main function
main() {
  log "Starting Perfect Match production deployment script" "INFO"
  log "Version: ${VERSION}" "INFO"
  log "AWS Account: ${AWS_ACCOUNT_ID}" "INFO"
  log "AWS Region: ${AWS_REGION}" "INFO"
  log "Validate only: ${VALIDATE_ONLY}" "INFO"
  
  # Step 1: Verify AWS environment
  verify_aws_environment || {
    log "AWS environment verification failed" "ERROR"
    exit 1
  }
  
  # Step 2: Build and push Docker images
  build_and_push_images || {
    log "Building and pushing Docker images failed" "ERROR"
    exit 1
  }
  
  # Step 3: Update CloudFormation stacks
  update_stacks || {
    log "Updating CloudFormation stacks failed" "ERROR"
    exit 1
  }
  
  # Step 4: Perform canary deployment
  canary_deployment || {
    log "Canary deployment failed" "ERROR"
    exit 1
  }
  
  # Step 5: Perform full health checks
  perform_health_checks || {
    log "Health checks failed" "ERROR"
    exit 1
  }
  
  log "Deployment completed successfully" "SUCCESS"
  log "New version ${VERSION} is now active" "SUCCESS"
  exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --validate)
      VALIDATE_ONLY=true
      shift
      ;;
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --account-id)
      AWS_ACCOUNT_ID="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --help)
      display_help
      exit 0
      ;;
    *)
      log "Unknown option: $1" "ERROR"
      display_help
      exit 1
      ;;
  esac
done

# Set up error handling
trap handle_error ERR

# Start the deployment process
main
