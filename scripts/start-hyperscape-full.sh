#!/bin/bash
# Complete Hyperscape Hybrid Stack Startup
# Starts anvil + contracts + indexer + game server + client

set -e

cd "$(dirname "$0")/.."

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🚀 HYPERSCAPE HYBRID STACK STARTUP                         ║"
echo "║   Blockchain + Indexer + Game Server + Client               ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Create logs directory
mkdir -p apps/hyperscape/logs

# Step 1: Start Localnet & Deploy Contracts
echo "1️⃣  Starting blockchain and deploying contracts..."
cd apps/hyperscape
bun scripts/start-localnet.ts

if [ $? -ne 0 ]; then
  echo "❌ Failed to start localnet"
  exit 1
fi

# Step 2: Start MUD Indexer
echo ""
echo "2️⃣  Starting MUD indexer..."
cd ../../indexer

# Check if indexer dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "   Installing indexer dependencies..."
  npm install
fi

# Start indexer in background
npm run dev > ../apps/hyperscape/logs/indexer.log 2>&1 &
INDEXER_PID=$!
echo "✅ MUD indexer started (PID: $INDEXER_PID)"
echo "   GraphQL: http://localhost:4350/graphql"
echo "   Logs: apps/hyperscape/logs/indexer.log"

# Wait for indexer to be ready
sleep 5

# Step 3: Start Hyperscape Game Server
echo ""
echo "3️⃣  Starting Hyperscape game server..."
cd ../apps/hyperscape

# Start game in hybrid mode
npm run dev > logs/game.log 2>&1 &
GAME_PID=$!

echo "✅ Hyperscape started (PID: $GAME_PID)"
echo "   Server: ws://localhost:5555/ws"
echo "   Client: http://localhost:3333"
echo "   Logs: logs/game.log"

# Wait for game to be ready
echo ""
echo "⏳ Waiting for services to initialize..."
sleep 10

# Step 4: Verify Everything
echo ""
echo "4️⃣  Verifying integration..."
bun scripts/verify-blockchain-integration.ts

# Step 5: Show Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎮 HYPERSCAPE IS READY!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Services:"
echo "   Game Client:  http://localhost:3333"
echo "   Game Server:  ws://localhost:5555/ws"
echo "   GraphQL API:  http://localhost:4350/graphql"
echo "   Blockchain:   http://localhost:8545"
echo ""
echo "📊 Status:"
echo "   Anvil:        Running"
echo "   Contracts:    Deployed"
echo "   Indexer:      Syncing (PID: $INDEXER_PID)"
echo "   Game:         Running (PID: $GAME_PID)"
echo ""
echo "📋 Next Steps:"
echo "   1. Open http://localhost:3333"
echo "   2. Register a player (triggers blockchain tx)"
echo "   3. Watch logs: tail -f logs/game.log | grep Blockchain"
echo "   4. Verify on-chain: cast call \$WORLD_ADDRESS ..."
echo ""
echo "📝 Logs:"
echo "   Game:    apps/hyperscape/logs/game.log"
echo "   Indexer: apps/hyperscape/logs/indexer.log"
echo "   Anvil:   apps/hyperscape/logs/anvil.log"
echo ""
echo "🛑 To stop:"
echo "   kill $INDEXER_PID $GAME_PID"
echo "   pkill -f anvil"
echo ""

