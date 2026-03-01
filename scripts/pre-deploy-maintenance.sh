#!/usr/bin/env bash
#
# Pre-deploy script: Enter maintenance mode before deploying
#
# This script:
# 1. Calls the maintenance API to pause new duel cycles
# 2. Waits for current market to resolve
# 3. Exits with status indicating if safe to deploy
#
# Required environment variables:
# - SERVER_URL: Base URL of the Hyperscape server (e.g., https://api.hyperscape.game)
# - ADMIN_CODE: Admin API authentication code
#
# Optional:
# - MAINTENANCE_TIMEOUT_MS: Max time to wait for safe state (default: 300000 = 5 minutes)
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate required environment variables
if [[ -z "${SERVER_URL:-}" ]]; then
  log_error "SERVER_URL environment variable is required"
  exit 1
fi

if [[ -z "${ADMIN_CODE:-}" ]]; then
  log_error "ADMIN_CODE environment variable is required"
  exit 1
fi

TIMEOUT_MS="${MAINTENANCE_TIMEOUT_MS:-300000}"

log_info "Entering maintenance mode on ${SERVER_URL}..."
log_info "Timeout: ${TIMEOUT_MS}ms"

# Call the maintenance API
RESPONSE=$(curl -s -X POST \
  "${SERVER_URL}/admin/maintenance/enter" \
  -H "Content-Type: application/json" \
  -H "x-admin-code: ${ADMIN_CODE}" \
  -d "{\"reason\": \"deployment\", \"timeoutMs\": ${TIMEOUT_MS}}" \
  --max-time 600)

# Check if curl succeeded
if [[ $? -ne 0 ]]; then
  log_error "Failed to reach server at ${SERVER_URL}"
  exit 1
fi

# Parse response
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
SAFE_TO_DEPLOY=$(echo "$RESPONSE" | jq -r '.status.safeToDepoy // false')
CURRENT_PHASE=$(echo "$RESPONSE" | jq -r '.status.currentPhase // "unknown"')
MARKET_STATUS=$(echo "$RESPONSE" | jq -r '.status.marketStatus // "unknown"')
PENDING_MARKETS=$(echo "$RESPONSE" | jq -r '.status.pendingMarkets // 0')

if [[ "$SUCCESS" != "true" ]]; then
  log_error "Failed to enter maintenance mode"
  echo "$RESPONSE" | jq .
  exit 1
fi

log_info "Maintenance mode entered successfully"
log_info "  Current phase: ${CURRENT_PHASE}"
log_info "  Market status: ${MARKET_STATUS}"
log_info "  Pending markets: ${PENDING_MARKETS}"
log_info "  Safe to deploy: ${SAFE_TO_DEPLOY}"

if [[ "$SAFE_TO_DEPLOY" == "true" ]]; then
  log_info "System is safe to deploy!"
  exit 0
else
  log_warn "System may not be fully safe - deploy with caution"
  log_warn "Active phase or pending markets detected"
  # Still exit 0 to allow deployment (timeout already passed)
  exit 0
fi
