#!/usr/bin/env bash
# dev:web3 - bootstrap a local on-chain world and run server+client
#
# Behavior:
# - Reuses existing Anvil if already running on ANVIL_RPC_URL
# - Otherwise starts managed Anvil with persistent state
# - Deploys contracts only when world is missing/not present on-chain (or FORCE_REDEPLOY=true)
# - Seeds items/shops on fresh deploy (or when SKIP_SEED!=true)
# - Runs on-chain smoke tests (unless SKIP_ONCHAIN_TESTS=true)
# - Starts Hyperia server/client in Web3 mode

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ANVIL_RPC_URL="${ANVIL_RPC_URL:-http://127.0.0.1:8545}"
ANVIL_STATE_PATH="${ANVIL_STATE_PATH:-$PROJECT_DIR/.anvil/state.json}"
FORCE_REDEPLOY="${FORCE_REDEPLOY:-false}"
SKIP_SEED="${SKIP_SEED:-false}"
SKIP_ONCHAIN_TESTS="${SKIP_ONCHAIN_TESTS:-false}"
RUN_E2E_TESTS="${RUN_E2E_TESTS:-false}"
DEFAULT_ANVIL_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

ANVIL_PID=""
SERVER_PID=""
CLIENT_PID=""
MANAGED_ANVIL="false"

info() {
  echo -e "${CYAN}[dev:web3] $1${NC}"
}

warn() {
  echo -e "${YELLOW}[dev:web3] $1${NC}"
}

fail() {
  echo -e "${RED}[dev:web3] $1${NC}"
  exit 1
}

cleanup() {
  echo -e "\n${YELLOW}[dev:web3] Shutting down...${NC}"
  if [ -n "${SERVER_PID:-}" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  if [ -n "${CLIENT_PID:-}" ]; then kill "$CLIENT_PID" 2>/dev/null || true; fi
  if [ "$MANAGED_ANVIL" = "true" ] && [ -n "${ANVIL_PID:-}" ]; then
    kill "$ANVIL_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  echo -e "${GREEN}[dev:web3] Done.${NC}"
}
trap cleanup EXIT INT TERM

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

read_world_address() {
  local latest_file="$PROJECT_DIR/packages/contracts/deploys/31337/latest.json"
  if [ ! -f "$latest_file" ]; then
    echo ""
    return
  fi

  node -e "const fs=require('fs'); const p=process.argv[1]; const j=JSON.parse(fs.readFileSync(p,'utf8')); process.stdout.write(j.worldAddress||'')" "$latest_file" 2>/dev/null || true
}

world_code() {
  local address="$1"
  if [ -z "$address" ]; then
    echo "0x"
    return
  fi
  curl -s -X POST "$ANVIL_RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$address\",\"latest\"],\"id\":1}" \
    | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{try{const j=JSON.parse(s); process.stdout.write(j.result||'0x')}catch{process.stdout.write('0x')}})"
}

ensure_contract_deps() {
  if [ ! -d "$PROJECT_DIR/node_modules/@latticexyz" ]; then
    warn "MUD dependencies missing, installing contracts workspace deps..."
    bun install --cwd "$PROJECT_DIR/packages/contracts"
  fi
}

require_cmd bun
require_cmd node
require_cmd anvil
require_cmd curl

mkdir -p "$(dirname "$ANVIL_STATE_PATH")"

export ANVIL_RPC_URL
export CHAIN="anvil"
export PRIVATE_KEY="${PRIVATE_KEY:-$DEFAULT_ANVIL_PRIVATE_KEY}"
export OPERATOR_PRIVATE_KEY="${OPERATOR_PRIVATE_KEY:-$PRIVATE_KEY}"

info "Checking for existing Anvil at $ANVIL_RPC_URL..."
if "$SCRIPT_DIR/wait-for-anvil.sh" 2 >/dev/null 2>&1; then
  warn "Detected running Anvil; reusing external node."
else
  info "Starting managed Anvil (state: $ANVIL_STATE_PATH)..."
  anvil --silent --chain-id 31337 --state "$ANVIL_STATE_PATH" &
  ANVIL_PID=$!
  MANAGED_ANVIL="true"
  "$SCRIPT_DIR/wait-for-anvil.sh" 25 || fail "Anvil failed to start"
fi

ensure_contract_deps

WORLD_ADDRESS="$(read_world_address)"
CURRENT_CODE="$(world_code "$WORLD_ADDRESS")"
DEPLOY_NEEDED="false"

if [ "$FORCE_REDEPLOY" = "true" ]; then
  DEPLOY_NEEDED="true"
elif [ -z "$WORLD_ADDRESS" ] || [ "$WORLD_ADDRESS" = "0x0" ] || [ "$CURRENT_CODE" = "0x" ]; then
  DEPLOY_NEEDED="true"
fi

if [ "$DEPLOY_NEEDED" = "true" ]; then
  info "Deploying contracts to Anvil..."
  (cd "$PROJECT_DIR" && bun run contracts:deploy:local)
  WORLD_ADDRESS="$(read_world_address)"
  [ -n "$WORLD_ADDRESS" ] || fail "Failed to read world address from deploy output"

  if [ "$SKIP_SEED" != "true" ]; then
    info "Seeding on-chain item registry..."
    (cd "$PROJECT_DIR" && WORLD_ADDRESS="$WORLD_ADDRESS" bun run web3:seed:items)
    info "Seeding on-chain shops..."
    (cd "$PROJECT_DIR" && WORLD_ADDRESS="$WORLD_ADDRESS" bun run web3:seed:shops)
  else
    warn "Skipping seed step (SKIP_SEED=true)"
  fi
else
  info "Reusing deployed world: $WORLD_ADDRESS"
fi

export WORLD_ADDRESS
export MODE="web3"

if [ "$SKIP_ONCHAIN_TESTS" != "true" ]; then
  info "Running on-chain smoke tests..."
  (cd "$PROJECT_DIR" && WORLD_ADDRESS="$WORLD_ADDRESS" bun run web3:test:onchain)
  if [ "$RUN_E2E_TESTS" = "true" ]; then
    info "Running on-chain E2E + anti-cheat tests..."
    (cd "$PROJECT_DIR" && WORLD_ADDRESS="$WORLD_ADDRESS" bun run web3:test:e2e)
  fi
else
  warn "Skipping on-chain smoke tests (SKIP_ONCHAIN_TESTS=true)"
fi

info "Building shared + web3 packages..."
(cd "$PROJECT_DIR" && bun run build:shared)
(cd "$PROJECT_DIR/packages/web3" && bun run build)

info "Starting server/client in Web3 mode..."
(cd "$PROJECT_DIR" && bun run dev:server) &
SERVER_PID=$!
(cd "$PROJECT_DIR" && bun run dev:client) &
CLIENT_PID=$!

echo -e "${GREEN}[dev:web3] ✅ Running${NC}"
echo -e "${GREEN}   RPC:     $ANVIL_RPC_URL${NC}"
echo -e "${GREEN}   World:   $WORLD_ADDRESS${NC}"
echo -e "${GREEN}   Debug:   bun run web3:debug:chain${NC}"
echo -e "${GREEN}   Player:  bun run web3:debug:player -- --address <0x...> --item-string bronze_arrow${NC}"
echo -e "${GREEN}   Stop:    Ctrl+C${NC}"

while true; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$CLIENT_PID" 2>/dev/null; then
    break
  fi
  sleep 1
done
