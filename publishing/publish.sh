#!/bin/bash
# Hyperia dApp Store Publishing Script
# This script guides you through publishing to the Solana dApp Store

set -e

PUBLISHING_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PUBLISHING_DIR"

echo "============================================"
echo "  Hyperia dApp Store Publishing Script"
echo "============================================"
echo ""

# Check for required tools
command -v dapp-store 2>/dev/null || { echo "❌ dApp Store CLI not installed. Run: npm install -g @solana-mobile/dapp-store-cli"; exit 1; }
command -v solana 2>/dev/null || { echo "❌ Solana CLI not installed"; exit 1; }

# Check for required files
if [ ! -f "hyperia-release.apk" ]; then
    echo "❌ Release APK not found. Build it first with: cd ../packages/app && bun run tauri android build"
    exit 1
fi

if [ ! -f "assets/icon_512.png" ]; then
    echo "❌ App icon not found at assets/icon_512.png"
    exit 1
fi

echo "✅ All required files found"
echo ""

# Check Solana wallet configuration
echo "📋 Checking Solana wallet configuration..."
WALLET_ADDRESS=$(solana address 2>/dev/null || echo "")
if [ -z "$WALLET_ADDRESS" ]; then
    echo "❌ No Solana wallet configured"
    echo "   Run: solana-keygen new"
    echo "   Or: solana config set --keypair <path-to-keypair.json>"
    exit 1
fi

echo "   Wallet: $WALLET_ADDRESS"
BALANCE=$(solana balance 2>/dev/null || echo "0 SOL")
echo "   Balance: $BALANCE"
echo ""

# Check network
NETWORK=$(solana config get | grep "RPC URL" | awk '{print $3}')
if [[ "$NETWORK" == *"devnet"* ]]; then
    echo "⚠️  WARNING: You're on devnet. For production, switch to mainnet:"
    echo "   solana config set --url https://api.mainnet-beta.solana.com"
    echo ""
fi

echo "============================================"
echo "  Step 1: Create Publisher NFT"
echo "============================================"
echo ""
echo "This mints a Publisher NFT that identifies you as a verified publisher."
echo "You only need to do this once."
echo ""
read -p "Do you want to create a Publisher NFT? (y/n) " CREATE_PUBLISHER

if [ "$CREATE_PUBLISHER" = "y" ]; then
    dapp-store create publisher \
        --name "Hyperia" \
        --website "https://hyperia.club" \
        --email "contact@hyperia.club"
    echo ""
    echo "✅ Publisher NFT created!"
    echo "   Save your Publisher NFT address for the next steps."
    echo ""
fi

echo "============================================"
echo "  Step 2: Create App NFT"
echo "============================================"
echo ""
echo "This creates an App NFT for Hyperia in the dApp Store."
echo ""
read -p "Enter your Publisher NFT address: " PUBLISHER_ADDRESS

if [ -n "$PUBLISHER_ADDRESS" ]; then
    dapp-store create app \
        --publisher-mint-address "$PUBLISHER_ADDRESS" \
        --name "Hyperia" \
        --icon "assets/icon_512.png"
    echo ""
    echo "✅ App NFT created!"
    echo "   Save your App NFT address for the next step."
    echo ""
fi

echo "============================================"
echo "  Step 3: Create Release NFT"
echo "============================================"
echo ""
echo "This uploads your APK and creates a Release NFT."
echo ""
read -p "Enter your App NFT address: " APP_ADDRESS

if [ -n "$APP_ADDRESS" ]; then
    dapp-store create release \
        --app-mint-address "$APP_ADDRESS" \
        --version "0.13.0" \
        --apk "hyperia-release.apk" \
        --icon "assets/icon_512.png" \
        --banner "assets/banner.png" \
        --screenshots "assets/screenshot_1.png,assets/screenshot_2.png,assets/screenshot_3.png,assets/screenshot_4.png" \
        --short-description "An AI-native MMORPG built on Solana" \
        --long-description "Hyperia is an AI-native MMORPG combining classic fantasy MMORPG gameplay with AI technology and Solana blockchain integration." \
        --category "games"
    echo ""
    echo "✅ Release NFT created!"
    echo ""
fi

echo "============================================"
echo "  Step 4: Submit for Review"
echo "============================================"
echo ""
echo "Your app is now ready for submission to the Solana dApp Store."
echo ""
echo "To submit:"
echo "1. Visit: https://github.com/solana-mobile/dapp-store"
echo "2. Follow the submission guidelines"
echo "3. Create a PR with your release details"
echo ""
echo "============================================"
echo "  Publishing Complete!"
echo "============================================"
