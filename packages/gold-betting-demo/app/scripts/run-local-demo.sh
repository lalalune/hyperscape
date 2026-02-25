#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_DIR="$(cd "$APP_DIR/.." && pwd)"
ANCHOR_DIR="$DEMO_DIR/anchor"
LEDGER_DIR="$ANCHOR_DIR/.local-demo-ledger"
VALIDATOR_LOG="$APP_DIR/.local-demo-validator.log"
PROGRAM_ORACLE_ID="A6utqr1N4KP3Tst2tMCqfJR4mhCRNw4M2uN3Nb6nPBcS"
PROGRAM_CLOB_ID="4phSkAVkbtGbQbrT3p2xjNPLAyw1DWz99wT7g4dQMyiX"
APP_PORT="${APP_PORT:-4179}"
RPC_URL="http://127.0.0.1:8899"

VALIDATOR_PID=""

cleanup() {
  if [[ -n "$VALIDATOR_PID" ]] && kill -0 "$VALIDATOR_PID" >/dev/null 2>&1; then
    kill "$VALIDATOR_PID" >/dev/null 2>&1 || true
    wait "$VALIDATOR_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_rpc() {
  for _ in {1..90}; do
    if curl -s -X POST "$RPC_URL" \
      -H "content-type: application/json" \
      -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' | rg -q '"result":"ok"'; then
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
    echo "[local-demo] clearing existing listeners on :$port"
    for pid in $pids; do
      kill "$pid" >/dev/null 2>&1 || true
    done
    sleep 1
  fi
}

kill_listeners "$APP_PORT"
kill_listeners 8899

echo "[local-demo] building anchor programs"
bun run --cwd "$ANCHOR_DIR" build >/tmp/gold-betting-demo-local-build.log 2>&1

echo "[local-demo] starting local validator"
rm -rf "$LEDGER_DIR"
solana-test-validator \
  --reset \
  --quiet \
  --ledger "$LEDGER_DIR" \
  --bpf-program "$PROGRAM_ORACLE_ID" "$ANCHOR_DIR/target/deploy/fight_oracle.so" \
  --bpf-program "$PROGRAM_CLOB_ID" "$ANCHOR_DIR/target/deploy/gold_clob_market.so" \
  >"$VALIDATOR_LOG" 2>&1 &
VALIDATOR_PID="$!"

if ! wait_for_rpc; then
  echo "[local-demo] validator did not become ready"
  tail -n 120 "$VALIDATOR_LOG" || true
  exit 1
fi

echo "[local-demo] seeding local state + writing app/.env.e2e"
bun run "$APP_DIR/tests/e2e/setup-localnet.ts" >/tmp/gold-betting-demo-local-seed.log

echo "[local-demo] starting app at http://127.0.0.1:$APP_PORT"
echo "[local-demo] validator log: $VALIDATOR_LOG"
VITE_HEADLESS_WALLET_AUTO_CONNECT=false \
  bun run --cwd "$APP_DIR" dev --mode e2e --port "$APP_PORT"
