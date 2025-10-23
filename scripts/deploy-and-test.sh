#!/bin/bash
set -e

echo "════════════════════════════════════════════════"
echo "🚀 Hyperscape Economy - Deploy & Test"
echo "════════════════════════════════════════════════"
echo ""

# Navigate to hyperscape contracts
cd "$(dirname "$0")/../contracts-mud/mmo"

echo "📦 Step 1: Build MUD contracts..."
bun run build
echo "✅ Build complete"
echo ""

echo "🔗 Step 2: Check localnet connectivity..."
if ! curl -s -X POST http://localhost:9545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null; then
  echo "❌ Localnet not responding on port 9545"
  echo "   Run: cd /Users/shawwalters/jeju && bun run dev"
  exit 1
fi
echo "✅ Localnet responding"
echo ""

echo "💰 Step 3: Check deployer balance..."
BALANCE=$(cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:9545)
echo "   Balance: $BALANCE wei"
if [ "$BALANCE" = "0" ]; then
  echo "   ⚠️  Account has 0 balance - localnet may still be initializing"
  echo "   Waiting 5 seconds..."
  sleep 5
fi
echo ""

echo "🚀 Step 4: Deploy MUD World..."
npm run deploy:local 2>&1 | tee ../../../logs/hyperscape-deploy.log
echo "✅ Deployment complete"
echo ""

echo "🧪 Step 5: Run contract tests..."
cd /Users/shawwalters/jeju/contracts
forge test --match-contract "Hyperscape" --summary
echo ""

echo "════════════════════════════════════════════════"
echo "✅ DEPLOYMENT & TESTING COMPLETE"
echo "════════════════════════════════════════════════"
echo ""
echo "📖 Next: Start Hyperscape dev server"
echo "   cd vendor/hyperscape && bun run dev"

