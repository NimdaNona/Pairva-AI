#!/bin/bash
# Perfect Match Production Readiness Verification Script
# This script validates all components required for a production deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/production-verification-$(date +"%Y%m%d-%H%M%S").log"
REPORT_FILE="${PROJECT_ROOT}/production-verification-report-$(date +"%Y%m%d-%H%M%S").html"
ENV_FILE="${PROJECT_ROOT}/infrastructure/.env.prod"
AWS_REGION=$(aws configure get region || echo "us-east-1")
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0
SKIP_INFRA=false
SKIP_SECURITY=false
SKIP_DB=false
SKIP_APP=false
SKIP_MONITORING=false
VERBOSE=false

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
  log "An error occurred during verification. Exit code: ${exit_code}" "ERROR"
  log "Check ${LOG_FILE} for detailed logs" "ERROR"
  # Generate report even on error
  generate_verification_report
  exit ${exit_code}
}

# Function to display help
display_help() {
  echo "Perfect Match Production Readiness Verification Script"
  echo ""
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --region REGION             AWS region (default: from AWS CLI config)"
  echo "  --account-id ACCOUNT_ID     AWS account ID (default: current account)"
  echo "  --env-file FILE             Environment file to use (default: infrastructure/.env.prod)"
  echo "  --skip-section SECTION      Skip a specific verification section"
  echo "  --verbose                   Show detailed output for each test"
  echo "  --help                      Display this help message and exit"
  echo ""
  echo "Available sections to skip:"
  echo "  infrastructure, security, database, application, monitoring"
  echo ""
}

# Check test result and update counters
check_result() {
  local test_name="$1"
  local result="$2"
  local details="${3:-}"
  
  TOTAL_TESTS=$((TOTAL_TESTS+1))
  
  if [ "$result" == "PASS" ]; then
    PASSED_TESTS=$((PASSED_TESTS+1))
    log "${test_name}: ${GREEN}PASS${NC}" "RESULT"
  elif [ "$result" == "WARN" ]; then
    WARNINGS=$((WARNINGS+1))
    log "${test_name}: ${YELLOW}WARN${NC} - ${details}" "RESULT"
  else
    FAILED_TESTS=$((FAILED_TESTS+1))
    log "${test_name}: ${RED}FAIL${NC} - ${details}" "RESULT"
  fi
  
  # Add to report data
  echo "${test_name}|${result}|${details}" >> "${LOG_FILE}.data"
}

# Generate HTML report from test results
generate_verification_report() {
  log "Generating verification report..." "INFO"
  
  # Create HTML header
  cat > "${REPORT_FILE}" << EOF
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
    <p class="summary-item"><strong>Generated:</strong> $(date)</p>
    <p class="summary-item"><strong>Environment:</strong> Production</p>
    <p class="summary-item"><strong>AWS Region:</strong> ${AWS_REGION}</p>
    <p class="summary-item"><strong>AWS Account:</strong> ${AWS_ACCOUNT_ID}</p>
    <p class="summary-item"><strong>Total Tests:</strong> ${TOTAL_TESTS}</p>
    <p class="summary-item"><strong>Passed:</strong> <span class="pass">${PASSED_TESTS}</span></p>
    <p class="summary-item"><strong>Warnings:</strong> <span class="warn">${WARNINGS}</span></p>
    <p class="summary-item"><strong>Failed:</strong> <span class="fail">${FAILED_TESTS}</span></p>
    <p class="summary-item"><strong>Overall Status:</strong> 
EOF

  # Determine overall status
  if [ $FAILED_TESTS -gt 0 ]; then
    echo '<span class="fail">FAILED</span></p>' >> "${REPORT_FILE}"
  elif [ $WARNINGS -gt 0 ]; then
    echo '<span class="warn">PASSED WITH WARNINGS</span></p>' >> "${REPORT_FILE}"
  else
    echo '<span class="pass">PASSED</span></p>' >> "${REPORT_FILE}"
  fi

  # Add test results table
  cat >> "${REPORT_FILE}" << EOF
  </div>
  
  <h2>Test Results</h2>
  <table>
    <tr>
      <th>Test</th>
      <th>Result</th>
      <th>Details</th>
    </tr>
EOF

  # Add each test result to the table
  while IFS="|" read -r test_name result details; do
    if [ -n "$test_name" ]; then
      if [ "$result" == "PASS" ]; then
        result_class="pass"
        result_text="PASS"
      elif [ "$result" == "WARN" ]; then
        result_class="warn"
        result_text="WARNING"
      else
        result_class="fail"
        result_text="FAIL"
      fi
      
      echo "    <tr class=\"${result_class}\">" >> "${REPORT_FILE}"
      echo "      <td>${test_name}</td>" >> "${REPORT_FILE}"
      echo "      <td class=\"${result_class}\">${result_text}</td>" >> "${REPORT_FILE}"
      echo "      <td class=\"details\">${details}</td>" >> "${REPORT_FILE}"
      echo "    </tr>" >> "${REPORT_FILE}"
    fi
  done < "${LOG_FILE}.data"

  # Close HTML
  cat >> "${REPORT_FILE}" << EOF
  </table>
  
  <h2>Recommendations</h2>
  <ul>
EOF

  # Add recommendations based on failures and warnings
  if [ $FAILED_TESTS -gt 0 ]; then
    echo "    <li class=\"fail\">Fix all failed tests before proceeding with deployment</li>" >> "${REPORT_FILE}"
  fi
  
  if [ $WARNINGS -gt 0 ]; then
    echo "    <li class=\"warn\">Address warnings to improve production reliability</li>" >> "${REPORT_FILE}"
  fi
  
  # Add specific recommendations based on test results
  if grep -q "RDS Multi-AZ|WARN" "${LOG_FILE}.data"; then
    echo "    <li>Enable Multi-AZ for the RDS instance to improve availability</li>" >> "${REPORT_FILE}"
  fi
  
  if grep -q "Backup Retention|WARN" "${LOG_FILE}.data"; then
    echo "    <li>Increase backup retention period to at least 7 days</li>" >> "${REPORT_FILE}"
  fi
  
  if grep -q "WAF|WARN" "${LOG_FILE}.data"; then
    echo "    <li>Configure WAF with comprehensive security rules</li>" >> "${REPORT_FILE}"
  fi
  
  if grep -q "CloudWatch Alarms|WARN" "${LOG_FILE}.data"; then
    echo "    <li>Set up CloudWatch alarms for CPU, memory, and error metrics</li>" >> "${REPORT_FILE}"
  fi

  # Close HTML
  cat >> "${REPORT_FILE}" << EOF
  </ul>
  
  <p><em>Report generated by Perfect Match Production Verification Script</em></p>
</body>
</html>
EOF

  log "Verification report generated: ${REPORT_FILE}" "SUCCESS"
}

# Load environment variables from .env.prod
load_env_variables() {
  log "Loading environment variables from ${ENV_FILE}" "INFO"
  
  if [ ! -f "${ENV_FILE}" ]; then
    log "Environment file ${ENV_FILE} does not exist" "ERROR"
    return 1
  fi
  
  # Export variables from .env.prod file
  set -a
  source "${ENV_FILE}"
  set +a
  
  # Verify required variables
  local required_vars=(
    "AWS_REGION"
    "STAGE"
    "APP_NAME"
    "DOMAIN_NAME"
    "VPC_CIDR"
    "DB_INSTANCE_TYPE"
    "COGNITO_EMAIL_SENDER"
  )
  
  local missing=0
  for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
      log "Required environment variable ${var} is not set in ${ENV_FILE}" "ERROR"
      missing=1
    fi
  done
  
  if [ "$missing" -eq 1 ]; then
    return 1
  fi
  
  log "Environment variables loaded successfully" "SUCCESS"
  return 0
}

#
# Infrastructure Verification Functions
#

verify_cloudformation_stacks() {
  log "Verifying CloudFormation stacks..." "INFO"
  
  local stack_status=$(aws cloudformation describe-stacks \
    --query "Stacks[?contains(StackName, 'PerfectMatch')].{Name:StackName,Status:StackStatus}" \
    --output json)
  
  # Check if we got valid JSON back
  if ! echo "$stack_status" | jq empty > /dev/null 2>&1; then
    check_result "CloudFormation Stack Status" "FAIL" "Failed to query stack status"
    return 1
  fi
  
  # Get counts of stacks in different states
  local total_stacks=$(echo "$stack_status" | jq '. | length')
  local complete_stacks=$(echo "$stack_status" | jq '[.[] | select(.Status | endswith("_COMPLETE"))] | length')
  local failed_stacks=$(echo "$stack_status" | jq '[.[] | select(.Status | contains("FAILED") or contains("ROLLBACK"))] | length')
  
  # If we have no stacks, fail
  if [ "$total_stacks" -eq 0 ]; then
    check_result "CloudFormation Stack Status" "FAIL" "No PerfectMatch stacks found"
    return 1
  fi
  
  # If any stacks are in a failed state, fail
  if [ "$failed_stacks" -gt 0 ]; then
    local failed_stack_list=$(echo "$stack_status" | jq -r '.[] | select(.Status | contains("FAILED") or contains("ROLLBACK")) | .Name')
    check_result "CloudFormation Stack Status" "FAIL" "Stacks in failed state: ${failed_stack_list}"
    return 1
  fi
  
  # If not all stacks are complete, warn
  if [ "$complete_stacks" -ne "$total_stacks" ]; then
    local incomplete_stack_list=$(echo "$stack_status" | jq -r '.[] | select(.Status | endswith("_COMPLETE") | not) | .Name')
    check_result "CloudFormation Stack Status" "WARN" "Stacks not in COMPLETE state: ${incomplete_stack_list}"
    return 0
  fi
  
  check_result "CloudFormation Stack Status" "PASS"
  return 0
}

verify_ecr_repositories() {
  log "Verifying ECR repositories..." "INFO"
  
  local repositories=$(aws ecr describe-repositories \
    --query "repositories[?contains(repositoryName, 'perfectmatch')].repositoryName" \
    --output json)
  
  # Check if we got valid JSON back
  if ! echo "$repositories" | jq empty > /dev/null 2>&1; then
    check_result "ECR Repositories" "FAIL" "Failed to query ECR repositories"
    return 1
  fi
  
  # Check for required repositories
  local required_repos=("perfectmatch-backend" "perfectmatch-frontend")
  local missing_repos=()
  
  for repo in "${required_repos[@]}"; do
    if ! echo "$repositories" | jq -r '.[]' | grep -q "$repo"; then
      missing_repos+=("$repo")
    fi
  done
  
  if [ ${#missing_repos[@]} -gt 0 ]; then
    check_result "ECR Repositories" "FAIL" "Missing repositories: ${missing_repos[*]}"
    return 1
  fi
  
  # Verify the repositories have images
  local empty_repos=()
  for repo in "${required_repos[@]}"; do
    local image_count=$(aws ecr describe-images \
      --repository-name "$repo" \
      --query "imageDetails | length(@)" \
      --output text 2>/dev/null || echo "0")
    
    if [ "$image_count" -eq 0 ]; then
      empty_repos+=("$repo")
    fi
  done
  
  if [ ${#empty_repos[@]} -gt 0 ]; then
    check_result "ECR Repository Images" "WARN" "Repositories with no images: ${empty_repos[*]}"
  else
    check_result "ECR Repository Images" "PASS"
  fi
  
  check_result "ECR Repositories" "PASS"
  return 0
}

verify_iam_roles() {
  log "Verifying IAM roles and policies..." "INFO"
  
  local roles=$(aws iam list-roles \
    --query "Roles[?contains(RoleName, 'PerfectMatch') || contains(RoleName, 'perfectmatch')].RoleName" \
    --output json)
  
  # Check if we got valid JSON back
  if ! echo "$roles" | jq empty > /dev/null 2>&1; then
    check_result "IAM Roles" "FAIL" "Failed to query IAM roles"
    return 1
  fi
  
  # Check for ECS execution role specifically
  local has_execution_role=$(echo "$roles" | jq 'map(select(contains("ECS") and contains("Execution"))) | length')
  if [ "$has_execution_role" -eq 0 ]; then
    check_result "IAM ECS Execution Role" "FAIL" "Missing ECS execution role"
  else
    check_result "IAM ECS Execution Role" "PASS"
  fi
  
  # Check for Lambda execution roles
  local has_lambda_role=$(echo "$roles" | jq 'map(select(contains("Lambda"))) | length')
  if [ "$has_lambda_role" -eq 0 ]; then
    check_result "IAM Lambda Roles" "WARN" "Missing Lambda execution roles"
  else
    check_result "IAM Lambda Roles" "PASS"
  fi
  
  # Check permission boundaries (optional)
  local roles_with_boundary=$(aws iam list-roles \
    --query "Roles[?contains(RoleName, 'PerfectMatch') || contains(RoleName, 'perfectmatch')].{Name:RoleName,Boundary:PermissionsBoundary.PermissionsBoundaryArn}" \
    --output json)
  
  local boundary_count=$(echo "$roles_with_boundary" | jq '[.[] | select(.Boundary != null)] | length')
  local total_roles=$(echo "$roles_with_boundary" | jq 'length')
  
  if [ "$boundary_count" -lt "$total_roles" ]; then
    check_result "IAM Permission Boundaries" "WARN" "Some roles missing permission boundaries"
  else
    check_result "IAM Permission Boundaries" "PASS"
  fi
  
  return 0
}

verify_s3_buckets() {
  log "Verifying S3 buckets..." "INFO"
  
  local buckets=$(aws s3api list-buckets \
    --query "Buckets[?contains(Name, 'perfectmatch')].Name" \
    --output json)
  
  # Check if we got valid JSON back
  if ! echo "$buckets" | jq empty > /dev/null 2>&1; then
    check_result "S3 Buckets" "FAIL" "Failed to query S3 buckets"
    return 1
  fi
  
  # Check for required bucket types
  local has_frontend_bucket=$(echo "$buckets" | jq 'map(select(contains("frontend") or contains("assets") or contains("static"))) | length')
  local has_backend_bucket=$(echo "$buckets" | jq 'map(select(contains("backend") or contains("api") or contains("upload"))) | length')
  local has_logs_bucket=$(echo "$buckets" | jq 'map(select(contains("log"))) | length')
  
  if [ "$has_frontend_bucket" -eq 0 ]; then
    check_result "S3 Frontend Bucket" "FAIL" "Missing frontend assets bucket"
  else
    check_result "S3 Frontend Bucket" "PASS"
  fi
  
  if [ "$has_backend_bucket" -eq 0 ]; then
    check_result "S3 Backend Bucket" "FAIL" "Missing backend uploads bucket"
  else
    check_result "S3 Backend Bucket" "PASS"
  fi
  
  if [ "$has_logs_bucket" -eq 0 ]; then
    check_result "S3 Logs Bucket" "WARN" "Missing logs bucket"
  else
    check_result "S3 Logs Bucket" "PASS"
  fi
  
  # Check bucket encryption and access policies for first frontend bucket
  local frontend_bucket=$(echo "$buckets" | jq -r 'map(select(contains("frontend") or contains("assets") or contains("static"))) | .[0]')
  
  if [ -n "$frontend_bucket" ] && [ "$frontend_bucket" != "null" ]; then
    # Check encryption
    local encryption=$(aws s3api get-bucket-encryption \
      --bucket "$frontend_bucket" 2>/dev/null || echo '{"ServerSideEncryptionConfiguration":{"Rules":[]}}')
    
    local has_encryption=$(echo "$encryption" | jq '.ServerSideEncryptionConfiguration.Rules | length')
    if [ "$has_encryption" -eq 0 ]; then
      check_result "S3 Bucket Encryption" "FAIL" "Missing encryption on $frontend_bucket"
    else
      check_result "S3 Bucket Encryption" "PASS"
    fi
    
    # Check public access settings
    local public_access=$(aws s3api get-public-access-block \
      --bucket "$frontend_bucket" 2>/dev/null || echo '{"BlockPublicAcls":false,"IgnorePublicAcls":false,"BlockPublicPolicy":false,"RestrictPublicBuckets":false}')
    
    local is_restricted=$(echo "$public_access" | jq '.BlockPublicAcls and .IgnorePublicAcls and .BlockPublicPolicy and .RestrictPublicBuckets')
    
    if [ "$is_restricted" == "true" ]; then
      # For frontend bucket, we might want public
      check_result "S3 Public Access Settings" "WARN" "Frontend bucket $frontend_bucket has all public access blocked"
    else
      check_result "S3 Public Access Settings" "PASS"
    fi
  fi
  
  # Check bucket policies for backend/upload buckets to ensure they're private
  local backend_bucket=$(echo "$buckets" | jq -r 'map(select(contains("backend") or contains("upload"))) | .[0]')
  
  if [ -n "$backend_bucket" ] && [ "$backend_bucket" != "null" ]; then
    local public_access=$(aws s3api get-public-access-block \
      --bucket "$backend_bucket" 2>/dev/null || echo '{"BlockPublicAcls":false,"IgnorePublicAcls":false,"BlockPublicPolicy":false,"RestrictPublicBuckets":false}')
    
    local is_restricted=$(echo "$public_access" | jq '.BlockPublicAcls and .IgnorePublicAcls and .BlockPublicPolicy and .RestrictPublicBuckets')
    
    if [ "$is_restricted" != "true" ]; then
      check_result "S3 Backend Bucket Security" "FAIL" "Backend bucket $backend_bucket is not properly restricted from public access"
    else
      check_result "S3 Backend Bucket Security" "PASS"
    fi
  fi
  
  return 0
}

#
# Security Verification Functions
#

verify_waf_configuration() {
  log "Verifying WAF configuration..." "INFO"
  
  # Check for WAF WebACLs
  local webacls=$(aws wafv2 list-web-acls \
    --scope REGIONAL \
    --query "WebACLs[?contains(Name, 'PerfectMatch') || contains(Name, 'perfectmatch')].Name" \
    --output json)
  
  # Check if we got valid JSON back
  if ! echo "$webacls" | jq empty > /dev/null 2>&1; then
    check_result "WAF Configuration" "FAIL" "Failed to query WAF WebACLs"
    return 1
  fi
  
  local has_webacl=$(echo "$webacls" | jq 'length')
  
  if [ "$has_webacl" -eq 0 ]; then
    check_result "WAF WebACL" "FAIL" "No WAF WebACL found for PerfectMatch"
    return 1
  fi
  
  # Get the first WebACL for detailed inspection
  local webacl_name=$(echo "$webacls" | jq -r '.[0]')
  
  # Get WebACL details
  local webacl_details=$(aws wafv2 get-web-acl \
    --name "$webacl_name" \
    --scope REGIONAL \
    --id $(aws wafv2 list-web-acls --scope REGIONAL --query "WebACLs[?Name=='$webacl_name'].Id" --output text) \
    --output json)
  
  # Check for required rule groups
  local rule_groups=$(echo "$webacl_details" | jq '.Rules | map(.Name) | join(", ")')
  
  # Check if key security rules exist
  local has_sql_rule=$(echo "$webacl_details" | jq '.Rules | map(select(.Name | contains("SQL") or contains("sql"))) | length')
  local has_xss_rule=$(echo "$webacl_details" | jq '.Rules | map(select(.Name | contains("XSS") or contains("xss"))) | length')
  local has_rate_rule=$(echo "$webacl_details" | jq '.Rules | map(select(.Name | contains("Rate") or contains("rate"))) | length')
  
  if [ "$has_sql_rule" -eq 0 ]; then
    check_result "WAF SQL Injection Protection" "WARN" "No SQL injection protection rule found"
  else
    check_result "WAF SQL Injection Protection" "PASS"
  fi
  
  if [ "$has_xss_rule" -eq 0 ]; then
    check_result "WAF XSS Protection" "WARN" "No XSS protection rule found"
  else
    check_result "WAF XSS Protection" "PASS"
  fi
  
  if [ "$has_rate_rule" -eq 0 ]; then
    check_result "WAF Rate Limiting" "WARN" "No rate limiting rule found"
  else
    check_result "WAF Rate Limiting" "PASS"
  fi
  
  # Check association with resources
  local associations=$(aws wafv2 list-resources-for-web-acl \
    --web-acl-arn $(echo "$webacl_details" | jq -r '.WebACL.ARN') \
    --resource-type APPLICATION_LOAD_BALANCER \
    --output json)
  
  local association_count=$(echo "$associations" | jq '.ResourceArns | length')
  
  if [ "$association_count" -eq 0 ]; then
    check_result "WAF Association" "FAIL" "WAF is not associated with any resources"
  else
    check_result "WAF Association" "PASS"
  fi
  
  check_result "WAF Configuration" "PASS"
  return 0
}

verify_cloudfront_distribution() {
  log "Verifying CloudFront distribution..." "INFO"
  
  # Check for CloudFront distributions
  local distributions=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, 'perfectmatch')].[Id, DomainName, Enabled]" \
    --output json)
  
  # Check if we got valid JSON back
  if ! echo "$distributions" | jq empty > /dev/null 2>&1; then
    check_result "CloudFront Distribution" "FAIL" "Failed to query CloudFront distributions"
    return 1
  fi
  
  local distribution_count=$(echo "$distributions" | jq 'length')
  
  if [ "$distribution_count" -eq 0 ]; then
    check_result "CloudFront Distribution" "FAIL" "No CloudFront distribution found for PerfectMatch"
    return 1
  fi
  
  # Get the first distribution ID for detailed inspection
  local distribution_id=$(echo "$distributions" | jq -r '.[0][0]')
  local distribution_enabled=$(echo "$distributions" | jq -r '.[0][2]')
  
  if [ "$distribution_enabled" != "true" ]; then
    check_result "CloudFront Status" "FAIL" "CloudFront distribution is not enabled"
  else
    check_result "CloudFront Status" "PASS"
  fi
  
  # Get distribution config
  local config=$(aws cloudfront get-distribution-config \
    --id "$distribution_id" \
    --query "DistributionConfig" \
    --output json)
  
  # Check for HTTPS only
  local viewer_protocol_policy=$(echo "$config" | jq -r '.DefaultCacheBehavior.ViewerProtocolPolicy')
  
  if [ "$viewer_protocol_policy" != "redirect-to-https" ] && [ "$viewer_protocol_policy" != "https-only" ]; then
    check_result "CloudFront HTTPS" "FAIL" "CloudFront distribution does not enforce HTTPS"
  else
    check_result "CloudFront HTTPS" "PASS"
  fi
  
  # Check for security headers
  local headers_config=$(echo "$config" | jq -r '.DefaultCacheBehavior.ResponseHeadersPolicyId')
  
  if [ -z "$headers_config" ] || [ "$headers_config" == "null" ]; then
    check_result "CloudFront Security Headers" "WARN" "No response headers policy configured"
  else
    # Get the headers policy
    local headers_policy=$(aws cloudfront get-response-headers-policy \
      --id "$headers_config" \
      --query "ResponseHeadersPolicy" \
      --output json 2>/dev/null)
    
    if [ -n "$headers_policy" ]; then
      local has_security_headers=$(echo "$headers_policy" | jq '.ResponseHeadersPolicyConfig.SecurityHeadersConfig != null')
      
      if [ "$has_security_headers" != "true" ]; then
        check_result "CloudFront Security Headers" "WARN" "Security headers not configured in response headers policy"
      else
        check_result "CloudFront Security Headers" "PASS"
      fi
    else
      check_result "CloudFront Security Headers" "WARN" "Could not fetch response headers policy details"
    fi
  fi
  
  check_result "CloudFront Distribution" "PASS"
  return 0
}

verify_ssl_certificates() {
  log "Verifying SSL/TLS certificates..." "INFO"
  
  # Get certificates from ACM
  local certificates=$(aws acm list-certificates \
    --query "CertificateSummaryList[?contains(DomainName, 'perfectmatch') || contains(DomainName, 'perfect-match')]" \
    --output json)
  
  # Check if we got valid JSON back
  if ! echo "$certificates" | jq empty > /dev/null 2>&1; then
    check_result "SSL/TLS Certificates" "FAIL" "Failed to query ACM certificates"
    return 1
  fi
  
  local cert_count=$(echo "$certificates" | jq 'length')
  
  if [ "$cert_count" -eq 0 ]; then
    check_result "SSL/TLS Certificates" "FAIL" "No SSL/TLS certificates found for PerfectMatch domain"
    return 1
