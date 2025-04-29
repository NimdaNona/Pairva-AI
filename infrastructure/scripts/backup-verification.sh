#!/bin/bash
# Perfect Match Backup Verification Script
# This script verifies the integrity of a database backup

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/backup-verification-$(date +"%Y%m%d-%H%M%S").log"
DB_HOST=""
DB_PORT="5432"
DB_NAME="perfectmatch"
DB_USER="postgres"
TEMP_SQL_FILE="/tmp/perfectmatch-verification-$(date +"%Y%m%d-%H%M%S").sql"

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
  log "An error occurred during backup verification. Exit code: ${exit_code}" "ERROR"
  log "Check ${LOG_FILE} for detailed logs" "ERROR"
  exit ${exit_code}
}

# Function to display help
display_help() {
  echo "Perfect Match Backup Verification Script"
  echo ""
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --database DB_IDENTIFIER   Database identifier to verify (required)"
  echo "  --port PORT                Database port (default: 5432)"
  echo "  --user USER                Database user (default: postgres)"
  echo "  --password PASSWORD        Database password (if not using ~/.pgpass)"
  echo "  --name DB_NAME             Database name (default: perfectmatch)"
  echo "  --help                     Display this help message and exit"
  echo ""
}

# Function to verify connectivity
verify_connectivity() {
  log "Testing database connectivity..." "INFO"
  
  PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" > /dev/null 2>&1 || {
    log "Failed to connect to database ${DB_NAME} on ${DB_HOST}:${DB_PORT}" "ERROR"
    return 1
  }
  
  log "Successfully connected to database ${DB_NAME} on ${DB_HOST}:${DB_PORT}" "SUCCESS"
  return 0
}

# Function to verify table structure
verify_table_structure() {
  log "Verifying table structure..." "INFO"
  
  # Get list of tables
  local tables=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" | tr -d ' ')
  
  if [ -z "${tables}" ]; then
    log "No tables found in database ${DB_NAME}" "ERROR"
    return 1
  fi
  
  # Count tables
  local table_count=$(echo "${tables}" | wc -l)
  log "Found ${table_count} tables in database ${DB_NAME}" "INFO"
  
  # Check for key tables that must exist
  local key_tables=("profiles" "users" "matches" "questionnaires" "conversations" "messages" "notifications" "subscriptions")
  local missing_tables=()
  
  for table in "${key_tables[@]}"; do
    if ! echo "${tables}" | grep -q "${table}"; then
      missing_tables+=("${table}")
    fi
  done
  
  if [ ${#missing_tables[@]} -gt 0 ]; then
    log "Missing required tables: ${missing_tables[*]}" "ERROR"
    return 1
  fi
  
  # Verify key table schemas
  for table in "${key_tables[@]}"; do
    local column_count=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = '${table}';" | tr -d ' ')
    log "Table ${table} has ${column_count} columns" "INFO"
    
    if [ "${column_count}" -lt 1 ]; then
      log "Table ${table} has no columns" "ERROR"
      return 1
    fi
  done
  
  log "Table structure verification completed successfully" "SUCCESS"
  return 0
}

# Function to verify row counts
verify_row_counts() {
  log "Verifying row counts (sampling tables)..." "INFO"
  
  local key_tables=("profiles" "users" "matches" "questionnaires" "conversations")
  local healthy=true
  
  for table in "${key_tables[@]}"; do
    local row_count=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM ${table};" | tr -d ' ')
    log "Table ${table} has ${row_count} rows" "INFO"
    
    # For backup verification, we just want to make sure the tables have rows
    # A more thorough check would compare to expected counts
    if [ "${row_count}" -lt 1 ] && [ "${table}" != "conversations" ]; then
      log "Table ${table} is empty - this may indicate data loss" "WARN"
      healthy=false
    fi
  done
  
  if [ "${healthy}" = "false" ]; then
    log "Row count verification completed with warnings" "WARN"
  else
    log "Row count verification completed successfully" "SUCCESS"
  fi
  
  return 0
}

# Function to verify data integrity
verify_data_integrity() {
  log "Verifying data integrity (sampling records)..." "INFO"
  
  # Sample a few profile records and check for validity
  cat > "${TEMP_SQL_FILE}" << EOF
-- Check profile data integrity
SELECT 
  COUNT(*) as total_profiles,
  SUM(CASE WHEN email IS NULL THEN 1 ELSE 0 END) as null_emails,
  SUM(CASE WHEN first_name IS NULL THEN 1 ELSE 0 END) as null_first_names,
  SUM(CASE WHEN created_at IS NULL THEN 1 ELSE 0 END) as null_created_at
FROM profiles;

-- Check user data integrity
SELECT 
  COUNT(*) as total_users,
  SUM(CASE WHEN email IS NULL THEN 1 ELSE 0 END) as null_emails
FROM users;

-- Check match data integrity
SELECT 
  COUNT(*) as total_matches,
  SUM(CASE WHEN compatibility_score IS NULL THEN 1 ELSE 0 END) as null_scores,
  MIN(compatibility_score) as min_score,
  MAX(compatibility_score) as max_score
FROM matches;
EOF

  # Execute the SQL script
  PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${TEMP_SQL_FILE}" > "${TEMP_SQL_FILE}.out" 2>&1 || {
    log "Failed to execute data integrity checks" "ERROR"
    cat "${TEMP_SQL_FILE}.out" >> "${LOG_FILE}"
    rm -f "${TEMP_SQL_FILE}" "${TEMP_SQL_FILE}.out"
    return 1
  }
  
  # Check for integrity issues
  local issues=false
  
  # Profile null checks
  local null_emails=$(grep -A 3 "null_emails" "${TEMP_SQL_FILE}.out" | tail -n 1 | awk '{print $1}')
  local null_first_names=$(grep -A 3 "null_first_names" "${TEMP_SQL_FILE}.out" | tail -n 1 | awk '{print $2}')
  
  if [ "${null_emails}" -gt 0 ] || [ "${null_first_names}" -gt 0 ]; then
    log "Data integrity issues detected: ${null_emails} null emails, ${null_first_names} null first names in profiles" "WARN"
    issues=true
  fi
  
  # Match score range check
  local min_score=$(grep -A 3 "min_score" "${TEMP_SQL_FILE}.out" | tail -n 1 | awk '{print $3}')
  local max_score=$(grep -A 3 "max_score" "${TEMP_SQL_FILE}.out" | tail -n 1 | awk '{print $4}')
  
  if [ -n "${min_score}" ] && [ -n "${max_score}" ]; then
    if [ "${min_score}" -lt 0 ] || [ "${max_score}" -gt 100 ]; then
      log "Match score integrity issues detected: scores range from ${min_score} to ${max_score}, outside expected 0-100 range" "WARN"
      issues=true
    fi
  fi
  
  # Clean up
  rm -f "${TEMP_SQL_FILE}" "${TEMP_SQL_FILE}.out"
  
  if [ "${issues}" = "true" ]; then
    log "Data integrity verification completed with warnings" "WARN"
  else
    log "Data integrity verification completed successfully" "SUCCESS"
  fi
  
  return 0
}

# Function to verify stored procedures
verify_stored_procedures() {
  log "Verifying stored procedures..." "INFO"
  
  # Get list of functions
  local functions=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';" | tr -d ' ')
  
  if [ -z "${functions}" ]; then
    log "No stored procedures found in database ${DB_NAME} - this may be expected" "INFO"
    log "Stored procedure verification skipped" "SUCCESS"
    return 0
  fi
  
  # Count functions
  local function_count=$(echo "${functions}" | wc -l)
  log "Found ${function_count} stored procedures in database ${DB_NAME}" "INFO"
  
  log "Stored procedure verification completed successfully" "SUCCESS"
  return 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --database)
      DB_HOST="$2"
      shift 2
      ;;
    --port)
      DB_PORT="$2"
      shift 2
      ;;
    --user)
      DB_USER="$2"
      shift 2
      ;;
    --password)
      DB_PASSWORD="$2"
      shift 2
      ;;
    --name)
      DB_NAME="$2"
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

# Validate required parameters
if [ -z "${DB_HOST}" ]; then
  log "Database identifier (--database) is required" "ERROR"
  display_help
  exit 1
fi

# Set up error handling
trap handle_error ERR

# Main function
main() {
  log "Starting Perfect Match backup verification for ${DB_HOST}" "INFO"
  
  # Step 1: Verify connectivity
  verify_connectivity || {
    log "Database connectivity verification failed" "ERROR"
    exit 1
  }
  
  # Step 2: Verify table structure
  verify_table_structure || {
    log "Table structure verification failed" "ERROR"
    exit 1
  }
  
  # Step 3: Verify row counts
  verify_row_counts || {
    log "Row count verification failed" "ERROR"
    exit 1
  }
  
  # Step 4: Verify data integrity
  verify_data_integrity || {
    log "Data integrity verification failed" "ERROR"
    exit 1
  }
  
  # Step 5: Verify stored procedures
  verify_stored_procedures || {
    log "Stored procedure verification failed" "ERROR"
    exit 1
  }
  
  log "Backup verification completed successfully" "SUCCESS"
  exit 0
}

# Start the verification process
main
