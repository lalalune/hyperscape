#!/bin/bash
# Quick streaming status check for Vast.ai deployment
# Usage: ./scripts/check-streaming-status.sh [server_url]

set -e

SERVER_URL="${1:-http://localhost:5555}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "════════════════════════════════════════════════════════════"
echo "  Hyperia Streaming Status Check"
echo "════════════════════════════════════════════════════════════"
echo ""

# 1. Server Health
echo -n "1. Server Health: "
if curl -sf "${SERVER_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "   Server is not responding at ${SERVER_URL}"
    exit 1
fi

# 2. Streaming API
echo -n "2. Streaming API: "
STREAMING_STATE=$(curl -sf "${SERVER_URL}/api/streaming/state" 2>/dev/null || echo '{"error":"unavailable"}')
if echo "$STREAMING_STATE" | grep -q '"error"'; then
    echo -e "${RED}✗ FAILED${NC}"
else
    echo -e "${GREEN}✓ OK${NC}"
fi

# 3. Duel Context (are agents fighting?)
echo -n "3. Duel Context:  "
DUEL_CONTEXT=$(curl -sf "${SERVER_URL}/api/streaming/duel-context" 2>/dev/null || echo '{}')
PHASE=$(echo "$DUEL_CONTEXT" | grep -o '"phase":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
AGENT1=$(echo "$DUEL_CONTEXT" | grep -o '"agent1":{[^}]*"name":"[^"]*"' | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "none")
AGENT2=$(echo "$DUEL_CONTEXT" | grep -o '"agent2":{[^}]*"name":"[^"]*"' | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "none")
if [ "$PHASE" = "FIGHTING" ]; then
    echo -e "${GREEN}✓ FIGHTING${NC} - ${AGENT1} vs ${AGENT2}"
elif [ "$PHASE" = "ANNOUNCEMENT" ]; then
    echo -e "${YELLOW}⏳ ANNOUNCEMENT${NC} - ${AGENT1} vs ${AGENT2}"
elif [ "$PHASE" = "RESOLUTION" ]; then
    echo -e "${YELLOW}⏳ RESOLUTION${NC} - Fight ending"
else
    echo -e "${YELLOW}⏳ ${PHASE:-idle}${NC}"
fi

# 4. RTMP Bridge Status
echo -n "4. RTMP Bridge:   "
RTMP_STATUS=$(curl -sf "${SERVER_URL}/api/streaming/rtmp/status" 2>/dev/null || echo '{}')
FFMPEG_RUNNING=$(echo "$RTMP_STATUS" | grep -o '"ffmpegRunning":[^,}]*' | cut -d':' -f2 || echo "false")
BYTES=$(echo "$RTMP_STATUS" | grep -o '"bytesReceived":[0-9]*' | cut -d':' -f2 || echo "0")
BYTES_MB=$(echo "scale=2; $BYTES / 1048576" | bc 2>/dev/null || echo "0")

if [ "$FFMPEG_RUNNING" = "true" ]; then
    echo -e "${GREEN}✓ ACTIVE${NC} - FFmpeg running, ${BYTES_MB}MB streamed"
elif [ "$BYTES" != "0" ] && [ "$BYTES" != "" ]; then
    echo -e "${YELLOW}⏳ IDLE${NC} - ${BYTES_MB}MB total streamed"
else
    echo -e "${RED}✗ NOT ACTIVE${NC}"
fi

# 5. Stream Destinations
echo -n "5. Destinations:  "
DESTINATIONS=$(echo "$RTMP_STATUS" | grep -o '"destinations":\[[^]]*\]' || echo "[]")
if echo "$DESTINATIONS" | grep -qi "twitch"; then
    echo -e "${GREEN}✓ Twitch configured${NC}"
elif echo "$DESTINATIONS" | grep -qi "youtube"; then
    echo -e "${GREEN}✓ YouTube configured${NC}"
else
    echo -e "${YELLOW}⚠ No external RTMP destinations${NC}"
fi

# 6. PM2 Status
echo ""
echo "6. PM2 Process Status:"
bunx pm2 list 2>/dev/null || echo "   PM2 not available"

# 7. Recent Logs (last 20 lines)
echo ""
echo "7. Recent Logs (last 20 lines):"
echo "────────────────────────────────────────────────────────────"
bunx pm2 logs --lines 20 --nostream 2>/dev/null | tail -40 || tail -20 /root/hyperia/logs/duel-out.log 2>/dev/null || echo "   No logs available"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Summary:"
if [ "$FFMPEG_RUNNING" = "true" ] && [ "$PHASE" = "FIGHTING" ]; then
    echo -e "  ${GREEN}✓ Stream appears to be LIVE and ACTIVE${NC}"
elif [ "$PHASE" = "FIGHTING" ]; then
    echo -e "  ${YELLOW}⚠ Duel running but RTMP bridge may not be streaming${NC}"
else
    echo -e "  ${YELLOW}⚠ Stream not fully active - check logs above${NC}"
fi
echo "════════════════════════════════════════════════════════════"
