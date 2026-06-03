#!/bin/bash
# Hyperia Production Watchdog
# Auto-restarts the game server and client on crash
set -e

export PATH="/root/.bun/bin:$PATH"
cd /root/hyperia

LOG_DIR="/root/hyperia/logs"
mkdir -p "$LOG_DIR"

echo "[watchdog] Starting Hyperia production watchdog..."

# Function to start the game server (bypass chain setup - no Anvil needed)
start_server() {
  echo "[watchdog] Starting game server..."
  cd /root/hyperia/packages/server
  nohup bun scripts/dev.mjs > "$LOG_DIR/server.log" 2>&1 &
  echo $! > "$LOG_DIR/server.pid"
  cd /root/hyperia
  echo "[watchdog] Server started (PID: $(cat $LOG_DIR/server.pid))"
}

# Function to start the client dev server
start_client() {
  echo "[watchdog] Starting client..."
  cd /root/hyperia/packages/client
  nohup bun run dev > "$LOG_DIR/client.log" 2>&1 &
  echo $! > "$LOG_DIR/client.pid"
  cd /root/hyperia
  echo "[watchdog] Client started (PID: $(cat $LOG_DIR/client.pid))"
}

# Start socat port proxies for remote access
start_proxies() {
  echo "[watchdog] Starting port proxies..."
  pkill -f "socat.*TCP-LISTEN:35143" || true
  pkill -f "socat.*TCP-LISTEN:35079" || true
  pkill -f "socat.*TCP-LISTEN:35144" || true
  sleep 1
  # Game server: internal 5555 -> external 35143
  nohup socat TCP-LISTEN:35143,reuseaddr,fork TCP:127.0.0.1:5555 > /dev/null 2>&1 &
  # WebSocket: internal 5555 -> external 35079
  nohup socat TCP-LISTEN:35079,reuseaddr,fork TCP:127.0.0.1:5555 > /dev/null 2>&1 &
  # CDN: internal 8080 -> external 35144
  nohup socat TCP-LISTEN:35144,reuseaddr,fork TCP:127.0.0.1:8080 > /dev/null 2>&1 &
  echo "[watchdog] Port proxies running"
}

# Cleanup on exit
cleanup() {
  echo "[watchdog] Shutting down..."
  [ -f "$LOG_DIR/server.pid" ] && kill $(cat "$LOG_DIR/server.pid") 2>/dev/null
  [ -f "$LOG_DIR/client.pid" ] && kill $(cat "$LOG_DIR/client.pid") 2>/dev/null
  exit 0
}
trap cleanup SIGTERM SIGINT

# Initial start
start_proxies
start_server
start_client

echo "[watchdog] All services started. Monitoring..."

# Watchdog loop - check every 30 seconds, restart crashed processes
while true; do
  sleep 30

  # Check server
  if [ -f "$LOG_DIR/server.pid" ]; then
    SERVER_PID=$(cat "$LOG_DIR/server.pid")
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "[watchdog] Server crashed! Restarting..."
      start_server
    fi
  fi

  # Check client
  if [ -f "$LOG_DIR/client.pid" ]; then
    CLIENT_PID=$(cat "$LOG_DIR/client.pid")
    if ! kill -0 "$CLIENT_PID" 2>/dev/null; then
      echo "[watchdog] Client crashed! Restarting..."
      start_client
    fi
  fi
done
