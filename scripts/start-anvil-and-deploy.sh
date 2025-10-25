#!/bin/bash
# Hyperscape - Start Anvil and Deploy MUD Contracts
# Run this before starting the Hyperscape dev server

set -e

echo "🔗 Starting Anvil blockchain..."
pkill -f "anvil --port 8545" 2>/dev/null || true
sleep 1

anvil --port 8545 --chain-id 31337 --block-time 1 > ../../logs/anvil.log 2>&1 &
ANVIL_PID=$!
echo "✅ Anvil started (PID: $ANVIL_PID)"
echo "   Logs: logs/anvil.log"

sleep 3

echo ""
echo "📋 Deploying MUD contracts..."
cd contracts-mud/mmo
npx mud deploy --rpc http://localhost:8545 > ../../logs/mud-deploy.log 2>&1

WORLD_ADDRESS=$(cat worlds.json | grep '"31337"' -A 2 | grep 'address' | cut -d'"' -f4)
echo "✅ Contracts deployed"
echo "   World: $WORLD_ADDRESS"

echo ""
echo "⚙️  Updating environment variables..."
cd ../..
sed -i '' "s/WORLD_ADDRESS=.*/WORLD_ADDRESS=$WORLD_ADDRESS/" .env
sed -i '' "s/WORLD_ADDRESS=.*/WORLD_ADDRESS=$WORLD_ADDRESS/" packages/server/.env
# Update .env.local files if they exist (they take precedence)
if [ -f "packages/server/.env.local" ]; then
  sed -i '' "s/WORLD_ADDRESS=.*/WORLD_ADDRESS=$WORLD_ADDRESS/" packages/server/.env.local
fi
if [ -f "packages/shared/.env.local" ]; then
  sed -i '' "s/WORLD_ADDRESS=.*/WORLD_ADDRESS=$WORLD_ADDRESS/" packages/shared/.env.local
fi
echo "✅ Environment updated"

echo ""
echo "🏗️  Rebuilding packages..."
cd packages/shared && bun run build > /dev/null 2>&1
cd ../server && bun run build > /dev/null 2>&1
echo "✅ Packages rebuilt"

echo ""
echo "════════════════════════════════════════"
echo "✅ Setup complete!"
echo "════════════════════════════════════════"
echo ""
echo "Now start Hyperscape:"
echo "  cd vendor/hyperscape"
echo "  bun run dev"
echo ""
echo "To verify blockchain connection, check logs for:"
echo "  [BlockchainGateway] ✅ Connected to blockchain"
echo ""

