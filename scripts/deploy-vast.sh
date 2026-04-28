#!/bin/bash
# Hyperscape CI/CD Deploy for Vast.ai
# Pulls latest, builds, and starts the split duel/control plane plus source worker under pm2
set -euo pipefail

export PATH="/root/.bun/bin:$PATH"
cd /root/hyperscape

# Prefer the persistent path first. /tmp is wiped on reboot by systemd-tmpfiles,
# so a pm2 resurrect or manual restart after a host reboot would otherwise lose
# the deploy-time env. The /tmp path remains as a transitional fallback.
SECRETS_CANDIDATES=(
    "/root/hyperscape-secrets.env"
    "/tmp/hyperscape-secrets.env"
)
SECRETS_FILE=""
for candidate in "${SECRETS_CANDIDATES[@]}"; do
    if [ -f "$candidate" ]; then
        SECRETS_FILE="$candidate"
        break
    fi
done

if [ -n "$SECRETS_FILE" ]; then
    echo "[deploy] Loading local runtime secrets from $SECRETS_FILE"
    set -a
    # shellcheck disable=SC1090
    . "$SECRETS_FILE"
    set +a
    # Mirror to the persistent path so subsequent reboots retain these secrets.
    if [ "$SECRETS_FILE" != "/root/hyperscape-secrets.env" ]; then
        cp "$SECRETS_FILE" /root/hyperscape-secrets.env
        chmod 600 /root/hyperscape-secrets.env
        echo "[deploy] Mirrored secrets to /root/hyperscape-secrets.env"
    fi
else
    echo "[deploy] Warning: no secrets file found at ${SECRETS_CANDIDATES[*]}; relying on the existing local shell environment only"
fi

echo "[deploy] Shared project secrets are intentionally not read in this enoomian staging path"

# Auto-detect database mode: if DATABASE_URL is set to a remote host, use remote mode
if [ -z "${DUEL_DATABASE_MODE:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
    case "$DATABASE_URL" in
        *localhost*|*127.0.0.1*|*0.0.0.0*|*::1*)
            DUEL_DATABASE_MODE="local"
            ;;
        *)
            DUEL_DATABASE_MODE="remote"
            echo "[deploy] Auto-detected remote database from DATABASE_URL"
            ;;
    esac
fi
DUEL_DATABASE_MODE="${DUEL_DATABASE_MODE:-local}"
LOCAL_POSTGRES_HOST="${LOCAL_POSTGRES_HOST:-127.0.0.1}"
LOCAL_POSTGRES_PORT="${LOCAL_POSTGRES_PORT:-5432}"
LOCAL_POSTGRES_USER="${LOCAL_POSTGRES_USER:-hyperscape}"
LOCAL_POSTGRES_PASSWORD="${LOCAL_POSTGRES_PASSWORD:-${POSTGRES_PASSWORD:-hyperscape_dev_password}}"
LOCAL_POSTGRES_DB="${LOCAL_POSTGRES_DB:-${POSTGRES_DB:-hyperscape}}"

# ── Auto-detect stream destinations from available keys ──────────────────────
if [ -z "${STREAM_ENABLED_DESTINATIONS:-}" ] && [ -z "${DUEL_STREAM_DESTINATIONS:-}" ]; then
    DESTS=""
    if [ -n "${TWITCH_STREAM_KEY:-${TWITCH_RTMP_STREAM_KEY:-}}" ]; then
        DESTS="twitch"
    fi
    if [ -n "${KICK_STREAM_KEY:-}" ]; then
        DESTS="${DESTS:+${DESTS},}kick"
    fi
    if [ -n "$DESTS" ]; then
        export STREAM_ENABLED_DESTINATIONS="$DESTS"
        echo "[deploy] Auto-detected stream destinations: $DESTS"
    fi
fi

# ── Ensure DNS resolution works (some Vast containers use internal-only DNS) ─
echo -e "nameserver 8.8.8.8\nnameserver 8.8.4.4" > /etc/resolv.conf

LOG_DIR="/root/hyperscape/logs"
mkdir -p "$LOG_DIR"

escape_sql_literal() {
    printf "%s" "$1" | sed "s/'/''/g"
}

ensure_local_postgres() {
    local user_escaped password_escaped db_escaped
    user_escaped="$(escape_sql_literal "$LOCAL_POSTGRES_USER")"
    password_escaped="$(escape_sql_literal "$LOCAL_POSTGRES_PASSWORD")"
    db_escaped="$(escape_sql_literal "$LOCAL_POSTGRES_DB")"

    echo "[deploy] Ensuring local PostgreSQL is running..."

    if command -v pg_lsclusters >/dev/null 2>&1; then
        while read -r version cluster _; do
            [ -n "${version:-}" ] || continue
            pg_ctlcluster --skip-systemctl-redirect "$version" "$cluster" start 2>/dev/null || true
        done < <(pg_lsclusters --no-header 2>/dev/null || true)
    fi
    service postgresql start 2>/dev/null || /etc/init.d/postgresql start 2>/dev/null || true

    for attempt in $(seq 1 20); do
        if pg_isready -h "$LOCAL_POSTGRES_HOST" -p "$LOCAL_POSTGRES_PORT" -U postgres >/dev/null 2>&1; then
            break
        fi
        if [ "$attempt" -eq 20 ]; then
            echo "[deploy] ERROR: local PostgreSQL did not become ready"
            exit 1
        fi
        sleep 1
    done

    runuser -u postgres -- psql postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${user_escaped}') THEN
    CREATE ROLE "${LOCAL_POSTGRES_USER}" LOGIN PASSWORD '${password_escaped}';
  ELSE
    ALTER ROLE "${LOCAL_POSTGRES_USER}" WITH LOGIN PASSWORD '${password_escaped}';
  END IF;
END
\$\$;
SQL

    if ! runuser -u postgres -- psql postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${db_escaped}'" | grep -q 1; then
        runuser -u postgres -- createdb -O "$LOCAL_POSTGRES_USER" "$LOCAL_POSTGRES_DB"
    fi

    export POSTGRES_HOST="$LOCAL_POSTGRES_HOST"
    export POSTGRES_PORT="$LOCAL_POSTGRES_PORT"
    export POSTGRES_USER="$LOCAL_POSTGRES_USER"
    export POSTGRES_PASSWORD="$LOCAL_POSTGRES_PASSWORD"
    export POSTGRES_DB="$LOCAL_POSTGRES_DB"
    export DATABASE_URL="postgresql://${LOCAL_POSTGRES_USER}:${LOCAL_POSTGRES_PASSWORD}@${LOCAL_POSTGRES_HOST}:${LOCAL_POSTGRES_PORT}/${LOCAL_POSTGRES_DB}"
    unset POSTGRES_URL

    echo "[deploy] Local PostgreSQL ready at ${LOCAL_POSTGRES_HOST}:${LOCAL_POSTGRES_PORT}/${LOCAL_POSTGRES_DB}"
}

ensure_tree_asset_aliases() {
    local trees_root="/root/hyperscape/packages/server/world/assets/models/trees"
    if [ ! -d "$trees_root" ]; then
        echo "[deploy] Skipping tree asset alias generation; missing $trees_root"
        return
    fi

    echo "[deploy] Ensuring tree asset compatibility aliases..."
    find "$trees_root" -maxdepth 1 -type f -name '*.glb' | while read -r asset_path; do
        local asset_name family_dir alias_path
        asset_name="$(basename "$asset_path")"
        family_dir="${asset_name%%_*}"
        if [ -z "$family_dir" ] || [ "$family_dir" = "$asset_name" ]; then
            continue
        fi
        mkdir -p "$trees_root/$family_dir"
        alias_path="$trees_root/$family_dir/$asset_name"
        if [ ! -e "$alias_path" ]; then
            ln -s "../$asset_name" "$alias_path"
        fi
    done
}

echo "[deploy] Starting Hyperscape CI/CD update on Vast.ai..."

# ── Pull latest code ──────────────────────────────────────────
echo "[deploy] Pulling latest code..."
git fetch origin
git reset --hard origin/main
git pull origin main

# ── Install system dependencies (needed for native modules) ───
echo "[deploy] Installing system build dependencies..."
apt-get update && apt-get install -y build-essential python3 socat xvfb git-lfs ffmpeg wget gnupg iproute2 lsof postgresql postgresql-client || true
git lfs install || true

# ── Install Chrome Beta channel (Required for WebGPU on Linux) ─
echo "[deploy] Installing Chrome Beta for WebGPU support..."
if ! command -v google-chrome-beta &> /dev/null; then
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - || true
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    apt-get update && apt-get install -y google-chrome-beta || true
    echo "[deploy] Chrome Beta installed: $(google-chrome-beta --version 2>/dev/null || echo 'install failed')"
else
    echo "[deploy] Chrome Beta already installed: $(google-chrome-beta --version)"
fi

# ── Fix any broken apt dependencies (NVIDIA driver conflicts) ─
apt-get --fix-broken install -y 2>/dev/null || true

# ── Install Playwright system deps for RTMP streaming ─────────
export PATH="/root/.bun/bin:$PATH"
bunx playwright install-deps chromium || true

if [ "$DUEL_DATABASE_MODE" != "remote" ]; then
    unset DATABASE_URL
    unset POSTGRES_URL
    export USE_LOCAL_POSTGRES=true
    ensure_local_postgres
else
    export USE_LOCAL_POSTGRES=false
    echo "[deploy] Using external DATABASE_URL from runtime environment"
fi

# ── Install dependencies ──────────────────────────────────────
echo "[deploy] Installing dependencies..."
export CI=true
# Clean up assets folder to forcefully redownload the latest biomes manifest over the VM cache.
rm -rf packages/server/world/assets
bun install

# ── Tear down existing processes FIRST (to release DB connections) ──
echo "[deploy] Tearing down existing processes..."

# Stop pm2-managed processes gracefully first
bunx pm2 stop all 2>/dev/null || true
sleep 2
bunx pm2 delete all 2>/dev/null || true
sleep 2
bunx pm2 kill 2>/dev/null || true
sleep 2

# Kill specific server processes using explicit ownership names and lock files.
pkill -f "hyperscape-duel-api" || true
pkill -f "hyperscape-stream-source" || true
pkill -f "scripts/duel-stack.mjs" || true
pkill -f "packages/server/scripts/stream-to-rtmp.ts" || true
pkill -f "bun.*packages/server.*stream:rtmp" || true
pkill -f "bun.*packages/server.*dist/index.js" || true
pkill -f "bun.*packages/server.*start" || true
pkill -f "bun.*dev-duel.mjs" || true
pkill -f "bun.*preview.*3333" || true
rm -f \
    /root/hyperscape/.runtime-locks/duel-stack.json \
    /root/hyperscape/.runtime-locks/stream-source.json \
    /root/hyperscape/.runtime-locks/rtmp-status.json || true

DB_DRAIN_WAIT_SECONDS=5
if [ "$DUEL_DATABASE_MODE" = "remote" ]; then
    DB_DRAIN_WAIT_SECONDS=30
fi
echo "[deploy] Waiting ${DB_DRAIN_WAIT_SECONDS}s for database/process cleanup..."
sleep "$DB_DRAIN_WAIT_SECONDS"

# ── Build core packages ──────────────────────────────────────
echo "[deploy] Building core dependencies..."
cd packages/physx-js-webidl && bun run build && cd ../..
cd packages/decimation && bun run build && cd ../..
cd packages/impostors && bun run build && cd ../..
cd packages/procgen && bun run build && cd ../..
cd packages/asset-forge && bun run build:services && cd ../..
cd packages/shared && bun run build && cd ../..
echo "[deploy] Building fresh client dist for stream/runtime pages..."
cd packages/client && bun run build:cf && cd ../..
ensure_tree_asset_aliases

# ── Database migration (after connections cleared) ────────────
echo "[deploy] Applying database migrations..."
cd packages/server
echo "[deploy] Applying checked-in database migrations..."
bunx drizzle-kit migrate
cd ../..

# ── Start socat port proxies ─────────────────────────────────
echo "[deploy] Starting port proxies..."
pkill -f "socat.*TCP-LISTEN:35143" || true
pkill -f "socat.*TCP-LISTEN:35079" || true
pkill -f "socat.*TCP-LISTEN:35144" || true
sleep 1
# Game server: internal 5555 -> external 35143
nohup socat TCP-LISTEN:35143,reuseaddr,fork TCP:127.0.0.1:5555 > /dev/null 2>&1 &
disown
# WebSocket: internal 5555 -> external 35079
nohup socat TCP-LISTEN:35079,reuseaddr,fork TCP:127.0.0.1:5555 > /dev/null 2>&1 &
disown
# CDN: internal 8080 -> external 35144
nohup socat TCP-LISTEN:35144,reuseaddr,fork TCP:127.0.0.1:8080 > /dev/null 2>&1 &
disown
echo "[deploy] Port proxies running"

# ── Start Xvfb virtual display for WebGPU streaming ──────────
echo "[deploy] Starting Xvfb virtual display..."
pkill -f "Xvfb :99" || true
sleep 1
nohup Xvfb :99 -screen 0 1280x720x24 > /dev/null 2>&1 &
disown
export DISPLAY=:99
echo "[deploy] Xvfb started on DISPLAY=$DISPLAY"

# ── Start duel stack via pm2 ─────────────────────────────────
echo "[deploy] Starting split Hyperscape duel stack via pm2..."
bunx pm2 start ecosystem.config.cjs --update-env

REQUIRE_LOCAL_CDN=false
PUBLIC_CDN_URL_EFFECTIVE="${PUBLIC_CDN_URL:-https://assets.hyperscape.club}"
case "$PUBLIC_CDN_URL_EFFECTIVE" in
    http://localhost:*|https://localhost:*|http://127.0.0.1:*|https://127.0.0.1:*|http://0.0.0.0:*|https://0.0.0.0:*)
        REQUIRE_LOCAL_CDN=true
        ;;
esac

echo "[deploy] Waiting for local services to become healthy..."
for attempt in $(seq 1 30); do
    SERVER_OK=false
    STREAMING_OK=false
    CAPTURE_OK=false
    CDN_OK=true

    if curl -fsS --max-time 10 http://127.0.0.1:5555/health > /dev/null 2>&1; then
        SERVER_OK=true
    fi
    if curl -fsS --max-time 10 http://127.0.0.1:5555/api/streaming/state > /dev/null 2>&1; then
        STREAMING_OK=true
    fi
    if curl -fsS --max-time 10 http://127.0.0.1:5555/api/streaming/capture/status > /dev/null 2>&1; then
        CAPTURE_OK=true
    fi
    if [ "$REQUIRE_LOCAL_CDN" = true ]; then
        CDN_OK=false
        if curl -fsS --max-time 10 http://127.0.0.1:8080/health > /dev/null 2>&1; then
            CDN_OK=true
        fi
    fi

    if [ "$SERVER_OK" = true ] && [ "$STREAMING_OK" = true ] && [ "$CAPTURE_OK" = true ] && [ "$CDN_OK" = true ]; then
        echo "[deploy] Local services are healthy"
        break
    fi

    if [ "$attempt" -eq 30 ]; then
        echo "[deploy] ERROR: local services failed health checks after ${attempt} attempts"
        echo "[deploy] pm2 status:"
        bunx pm2 status || true
        echo "[deploy] tailing duel logs directly from OS:"
        tail -n 10000 /root/.pm2/logs/hyperscape-duel-api-error.log 2>/dev/null || true
        tail -n 10000 /root/.pm2/logs/hyperscape-duel-api-out.log 2>/dev/null || true
        tail -n 10000 /root/.pm2/logs/hyperscape-stream-source-error.log 2>/dev/null || true
        tail -n 10000 /root/.pm2/logs/hyperscape-stream-source-out.log 2>/dev/null || true
        exit 1
    fi

    echo "[deploy] health check ${attempt}/30 pending (server=$SERVER_OK streaming=$STREAMING_OK capture=$CAPTURE_OK cdn=$CDN_OK)"
    sleep 10
done

# ── Configure pm2 to survive reboots ─────────────────────────
echo "[deploy] Saving pm2 process list for reboot survival..."
bunx pm2 save

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✓ Hyperscape deployed successfully!"
echo "  ✓ Duel API/control plane and stream source are split under pm2"
echo ""
echo "  Useful commands:"
echo "    bun run duel:prod:logs     # tail live logs"
echo "    bun run duel:prod:status   # process status"
echo "    bun run duel:prod:restart  # restart stack"
echo "    bun run duel:prod:stop     # stop stack"
echo "════════════════════════════════════════════════════════════"
