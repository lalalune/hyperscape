#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_DIR="$(cd "$APP_DIR/.." && pwd)"
ANCHOR_DIR="$DEMO_DIR/anchor"
EVM_DIR="$(cd "$DEMO_DIR/../evm-contracts" && pwd)"
LEDGER_DIR="${E2E_SOLANA_LEDGER_DIR:-/tmp/hyperscape-gold-e2e-ledger}"
VALIDATOR_LOG="$APP_DIR/.e2e-validator.log"
ANVIL_LOG="$APP_DIR/.e2e-anvil.log"
APP_LOG="$APP_DIR/.e2e-app.log"
PROGRAM_ORACLE_ID="A6utqr1N4KP3Tst2tMCqfJR4mhCRNw4M2uN3Nb6nPBcS"
PROGRAM_MARKET_ID="GzwZKz1fku9sPVN8G3JdnLHTzGyPzW9MkgVfMcdJGc7e"
PROGRAM_CLOB_ID="4phSkAVkbtGbQbrT3p2xjNPLAyw1DWz99wT7g4dQMyiX"
APP_PORT="${E2E_APP_PORT:-4181}"
SOLANA_RPC_PORT="${E2E_SOLANA_RPC_PORT:-18899}"
SOLANA_WS_PORT="${E2E_SOLANA_WS_PORT:-18900}"
SOLANA_FAUCET_PORT="${E2E_SOLANA_FAUCET_PORT:-18901}"
SOLANA_RPC_URL="http://127.0.0.1:${SOLANA_RPC_PORT}"
SOLANA_WS_URL="ws://127.0.0.1:${SOLANA_WS_PORT}"
SOLANA_MINT_AUTHORITY="${E2E_SOLANA_MINT_AUTHORITY:-GySVDr1omr3GTodgWFH7qD1ZKav9C5NMPFjdpwb33LvU}"
ANVIL_PORT="${E2E_EVM_PORT:-8545}"
# Always target the local anvil instance spawned by this script.
ANVIL_RPC_URL="http://127.0.0.1:${ANVIL_PORT}"
EVM_CHAIN_ID="${E2E_EVM_CHAIN_ID:-97}"

VALIDATOR_PID=""
ANVIL_PID=""
APP_PID=""

cleanup() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    wait "$APP_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$ANVIL_PID" ]] && kill -0 "$ANVIL_PID" >/dev/null 2>&1; then
    kill "$ANVIL_PID" >/dev/null 2>&1 || true
    wait "$ANVIL_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$VALIDATOR_PID" ]] && kill -0 "$VALIDATOR_PID" >/dev/null 2>&1; then
    kill "$VALIDATOR_PID" >/dev/null 2>&1 || true
    wait "$VALIDATOR_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_solana_rpc() {
  for _ in {1..90}; do
    if curl -s -X POST "$SOLANA_RPC_URL" \
      -H "content-type: application/json" \
      -d '{"jsonrpc":"2.0","id":1,"method":"getLatestBlockhash","params":[{"commitment":"confirmed"}]}' | rg -q '"blockhash"'; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_anvil_rpc() {
  for _ in {1..90}; do
    if curl -s -X POST "$ANVIL_RPC_URL" \
      -H "content-type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | rg -q '"result"'; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_app() {
  local url="$1"
  for _ in {1..90}; do
    if curl -s -o /dev/null -w "%{http_code}" "$url" | rg -q "200"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

kill_listeners() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN || true)"
  if [[ -n "$pids" ]]; then
    echo "[e2e] clearing existing listeners on :$port"
    for pid in $pids; do
      kill "$pid" >/dev/null 2>&1 || true
    done
    sleep 1
  fi
}

kill_listeners "$APP_PORT"
kill_listeners "$SOLANA_RPC_PORT"
kill_listeners "$SOLANA_WS_PORT"
kill_listeners "$SOLANA_FAUCET_PORT"
kill_listeners "$ANVIL_PORT"

echo "[e2e] building anchor programs"
bun run --cwd "$ANCHOR_DIR" build >/tmp/gold-betting-demo-e2e-build.log 2>&1

echo "[e2e] compiling evm contracts"
bun run --cwd "$EVM_DIR" compile >/tmp/gold-betting-demo-e2e-evm-build.log 2>&1

IDL_ORACLE_ID="$(jq -r '.address // .metadata.address // empty' "$ANCHOR_DIR/target/idl/fight_oracle.json" 2>/dev/null || true)"
IDL_CLOB_ID="$(jq -r '.address // .metadata.address // empty' "$ANCHOR_DIR/target/idl/gold_clob_market.json" 2>/dev/null || true)"
if [[ -n "$IDL_ORACLE_ID" && "$IDL_ORACLE_ID" != "null" ]]; then
  PROGRAM_ORACLE_ID="$IDL_ORACLE_ID"
fi
if [[ -n "$IDL_MARKET_ID" && "$IDL_MARKET_ID" != "null" ]]; then
  PROGRAM_MARKET_ID="$IDL_MARKET_ID"
fi
if [[ -n "$IDL_CLOB_ID" && "$IDL_CLOB_ID" != "null" ]]; then
  PROGRAM_CLOB_ID="$IDL_CLOB_ID"
fi

echo "[e2e] starting local validator"
rm -rf "$LEDGER_DIR"
solana-test-validator \
  --reset \
  --quiet \
  --rpc-port "$SOLANA_RPC_PORT" \
  --faucet-port "$SOLANA_FAUCET_PORT" \
  --mint "$SOLANA_MINT_AUTHORITY" \
  --ledger "$LEDGER_DIR" \
  --bpf-program "$PROGRAM_ORACLE_ID" "$ANCHOR_DIR/target/deploy/fight_oracle.so" \
  --bpf-program "$PROGRAM_CLOB_ID" "$ANCHOR_DIR/target/deploy/gold_clob_market.so" \
  >"$VALIDATOR_LOG" 2>&1 &
VALIDATOR_PID="$!"

if ! wait_for_solana_rpc; then
  echo "[e2e] validator did not become ready"
  tail -n 80 "$VALIDATOR_LOG" || true
  exit 1
fi

echo "[e2e] starting local anvil"
anvil \
  --silent \
  --host 127.0.0.1 \
  --port "$ANVIL_PORT" \
  --chain-id "$EVM_CHAIN_ID" \
  >"$ANVIL_LOG" 2>&1 &
ANVIL_PID="$!"

if ! wait_for_anvil_rpc; then
  echo "[e2e] anvil did not become ready"
  tail -n 80 "$ANVIL_LOG" || true
  exit 1
fi

echo "[e2e] seeding local solana state + writing .env.e2e"
E2E_SOLANA_RPC_URL="$SOLANA_RPC_URL" \
E2E_SOLANA_WS_URL="$SOLANA_WS_URL" \
  bun run "$APP_DIR/tests/e2e/setup-localnet.ts"

echo "[e2e] seeding local evm state + extending .env.e2e"
E2E_EVM_RPC_URL="$ANVIL_RPC_URL" \
E2E_EVM_CHAIN_ID="$EVM_CHAIN_ID" \
  bun run "$APP_DIR/tests/e2e/setup-evm-local.ts"

echo "[e2e] starting app on :$APP_PORT"
bun run --cwd "$APP_DIR" dev --mode e2e --port "$APP_PORT" >"$APP_LOG" 2>&1 &
APP_PID="$!"

if ! wait_for_app "http://127.0.0.1:$APP_PORT/"; then
  echo "[e2e] app did not become ready"
  tail -n 80 "$APP_LOG" || true
  exit 1
fi

echo "[e2e] running playwright tests"
E2E_BASE_URL="http://127.0.0.1:$APP_PORT" \
  bunx playwright test --config "$APP_DIR/tests/e2e/playwright.config.ts" "$@"
