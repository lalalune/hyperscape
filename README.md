# Hyperscape - 3D RPG (Blockchain Integration In Progress)

> ⚠️ **IMPORTANT**: Despite prior claims, the game currently uses PostgreSQL, NOT blockchain storage.  
> Smart contracts exist and are tested (98.8% pass rate) but are **not yet integrated** with the game engine.  
> See [CRITICAL_FINDINGS.md](CRITICAL_FINDINGS.md) for full assessment.

A complete RuneScape-inspired MMORPG with MUD smart contracts deployed on **Jeju**. Everything is AI-generated: items, mobs, lore, and world content. Built with Hyperscape 3D engine (Three.js). **Blockchain integration is planned but not yet implemented.**

## 🔗 Architecture Status

### ✅ What's Implemented
- **Smart Contracts**: 8 systems, 14 tables, 85 tests (98.8% passing)
- **Game Engine**: Full RPG with combat, skills, inventory
- **Multiplayer**: Real-time WebSocket networking
- **Database**: PostgreSQL with Drizzle ORM

### 🚧 What's In Progress  
- **MUD Client Integration**: Not yet connected
- **Blockchain Transactions**: Game actions don't write to chain
- **State Sync**: Reading from PostgreSQL, not blockchain
- **Integration Tests**: 10 critical tests currently skipped

### 🎯 Target Architecture (Not Yet Achieved)
```
Client ←→ WebSocket ←→ Server ←→ MUD Client ←→ Jeju Blockchain
   ↑                                                    ↓
   └──────────────── MUD Indexer (reads) ──────────────┘
```

### 📊 Current Architecture (Reality)
```
Client ←→ WebSocket ←→ Server ←→ PostgreSQL Database
```

**Verification**: Run `bun scripts/verify-blockchain-integration.ts` to see current state.

**Powered by:**
- **MUD Framework** - Smart contracts implemented (integration pending)
- **Jeju** - Target blockchain (not yet used)
- **Hyperscape Engine** - Three.js 3D rendering (working)
- **PostgreSQL** - Current data storage (will migrate to blockchain)

## 🎮 **Play the Game NOW**

```bash
# Quick start - get playing in 3 steps:
npm install
npm run build  
npm start
```

**Then open your browser to: `http://localhost:5555`**

## 🌟 **What Is This?**

This is a **real, playable RPG** with:

- **Complete RuneScape-style mechanics**: Combat, skills, equipment, progression
- **Real-time multiplayer**: Multiple players in the same persistent world
- **AI-powered content**: Everything generated with GPT-4 and MeshyAI
- **Human + AI agents**: Both humans and AI can play together
- **Full 3D world**: Physics, collision detection, real-time networking
- **No mocks or simulations**: Real game code, real Hyperscape engine, real multiplayer

### Game Features

🗡️ **Combat System**
- Real-time auto-combat with RuneScape formulas
- Attack, Strength, Defense, Constitution skills
- Equipment requirements and damage calculations
- Ranged combat with arrows and bows

⛏️ **Skills & Progression** 
- 9 skills total: Combat skills + Woodcutting + Fishing + Firemaking + Cooking
- RuneScape XP table and level progression
- Tool requirements and success rates
- Resource gathering and processing

🎒 **Equipment & Items**
- 3 tiers: Bronze → Steel → Mithril
- Weapons: Swords, Bows, Shields
- Armor: Leather to Mithril sets
- Tools: Hatchet, Fishing rod, Tinderbox
- Ammunition: Arrows required for ranged combat

🏰 **World & Economy**
- Persistent 3D world with starter towns
- Banking system with unlimited storage
- General stores selling tools and arrows
- Loot drops from defeated mobs
- Coins as universal currency

👥 **Multiplayer & AI**
- See other players moving and fighting in real-time
- ElizaOS AI agents can join and play alongside humans
- Shared world state with physics and collision
- Voice chat support via LiveKit

## 🚀 **How to Play**

### 1. Start the Game
```bash
npm install        # Install dependencies
npm run build      # Build all packages  
npm start          # Start the RPG server
```

### 2. Join the World
- Open browser to **`http://localhost:5555`**
- Your character spawns in a random starter town
- You start with a bronze sword and basic stats

### 3. Core Gameplay Loop

**🔰 Early Game (Levels 1-10)**
1. **Find goblins** (green cubes) near starter towns
2. **Click to attack** - auto-combat begins
3. **Gain XP** in Attack, Strength, Defense, Constitution  
4. **Collect loot** - coins and occasional equipment drops
5. **Visit general store** - buy tools (hatchet, fishing rod, tinderbox)

**⚔️ Mid Game (Levels 10-20)**
1. **Chop trees** with hatchet for Woodcutting XP and logs
2. **Fish at lakes** with fishing rod for Fishing XP and raw fish
3. **Make fires** with tinderbox and logs for Firemaking XP
4. **Cook fish** on fires for Cooking XP and food (heals health)
5. **Fight stronger mobs** - guards, barbarians, hobgoblins

**🏆 Late Game (Level 20+)**
1. **Steel equipment** becomes available (level 10+ requirement)
2. **Venture to dangerous zones** - fight dark warriors, black knights
3. **Mithril equipment** from high-level areas (level 20+ requirement) 
4. **Ranged combat** - buy bows and arrows, requires arrows to attack
5. **Banking** - store valuable items in town banks

### 4. Controls & Interface

- **Movement**: WASD keys or click-to-move
- **Combat**: Click on enemies to start auto-attack
- **Interaction**: Click on objects (trees, fish spots, banks, stores)
- **Inventory**: Drag and drop items, 28 slots total
- **Equipment**: Wear armor and weapons for stat bonuses
- **Banking**: Unlimited storage, separate bank per town

### 5. Death & Respawning

- **Death**: Drop all items at death location (headstone)
- **Respawn**: Appear at nearest starter town  
- **Item retrieval**: Return to death location to collect items
- **Strategy**: Bank valuable items regularly!

## 🏗️ **Architecture**

### On-Chain Game Stack

```
┌─────────────────────────────────────────┐
│      Hyperscape Client (Three.js)       │
│     - 3D rendering & physics            │
│     - Read-only UI                      │
└────────────┬────────────────────────────┘
             │
             │ Read: GraphQL (MUD Indexer)
             │ Write: Blockchain Transactions
             ↓
┌─────────────────────────────────────────┐
│         Jeju Blockchain              │
│  ┌───────────────────────────────────┐  │
│  │   MUD World (Hyperscape)          │  │
│  │                                   │  │
│  │  Systems:                         │  │
│  │   - PlayerSystem                  │  │
│  │   - CombatSystem                  │  │
│  │   - InventorySystem               │  │
│  │   - EquipmentSystem               │  │
│  │   - SkillSystem                   │  │
│  │   - ResourceSystem                │  │
│  │   - MobSystem                     │  │
│  │                                   │  │
│  │  Tables (On-Chain State):        │  │
│  │   - Player, Position, Health      │  │
│  │   - CombatSkills, GatheringSkills │  │
│  │   - Inventory (28 slots)          │  │
│  │   - Equipment (6 slots)           │  │
│  │   - Mobs, Resources, Coins        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│       MUD Indexer (PostgreSQL)          │
│     - Fast GraphQL queries              │
│     - Real-time event sync              │
└─────────────────────────────────────────┘
```

### Package Structure

```
hyperscape/
├── packages/client/           # 3D Client (Three.js)
│   ├── MUD hooks for blockchain state
│   ├── Transaction UI and wallet integration
│   └── Optimistic updates for smooth UX
├── packages/server/           # Thin Event Layer
│   ├── WebSocket for real-time events
│   └── Read-only helper APIs
├── packages/shared/           # Shared Types & Utils
└── ../../contracts/src/hyperscape/  # Smart Contracts
    ├── mud.config.ts          # On-chain schema
    ├── systems/               # Game logic (7 systems)
    ├── libraries/             # Combat, XP, Item formulas
    └── test/                  # Comprehensive contract tests
```

### Technology Stack

- **[MUD Framework](https://mud.dev/)** - On-chain state management and ECS
- **[Jeju](/)** - OP Stack L2 blockchain with Flashblocks & EigenDA
- **[Hyperscape](https://hyperscape.io/)** - Real-time 3D metaverse engine (Three.js + PhysX)
- **[ElizaOS](https://elizaos.ai/)** - AI agent framework for autonomous players
- **TypeScript** - Type-safe development across all packages
- **Three.js** - 3D graphics and rendering
- **Solidity** - Smart contract language for game logic
- **Foundry** - Smart contract development and testing
- **Playwright** - Browser automation for comprehensive testing
- **PostgreSQL** - MUD indexer database for fast queries

## 🧪 **Testing**

### Run Contract Tests
```bash
# All smart contract tests (406 tests)
bun run test:contracts
```

This runs:
- **Main Contracts:** 321 tests (Registry, Liquidity, Oracle, Cloud, Token, Rewards)
- **MUD Game Contracts:** 85 tests (Player, Combat, Equipment, Inventory, Skills, Mobs, Resources)

### Smart Contract Test Coverage (406 Tests Passing)

All smart contracts have comprehensive test coverage:

- ✅ **ERC-8004 Registry System** (66 tests) - Agent identity, reputation, validation
- ✅ **Liquidity System** (58 tests) - Vault, paymaster, fee distribution
- ✅ **Oracle System** (20 tests) - Price feeds, staleness checks  
- ✅ **Cloud Integration** (54 tests) - Service registry, credit purchase
- ✅ **MUD Game Contracts** (85 tests) - All 8 game systems on-chain
- ✅ **Token & Rewards** (123 tests) - elizaOSToken, node operator rewards

### Test Details

**Game Systems (MUD - 85 tests):**
- PlayerSystem (11 tests) - Registration, movement, health, respawn
- CombatSystem (8 tests) - Melee, ranged, damage, loot, XP
- EquipmentSystem (13 tests) - Equip/unequip, slots, stat bonuses
- InventorySystem (13 tests) - Add/remove items, stacking, limits
- SkillSystem (12 tests) - XP gain, level-ups, requirements
- MobSystem (9 tests) - Spawning all mob types, stats
- ResourceSystem (5 tests) - Gathering, tool requirements
- AdminSystem (11 tests) - World initialization, item creation
- E2E (3 tests) - Complete game flow, death/respawn, mob respawn

**Infrastructure Contracts (321 tests):**
- All security edge cases covered
- Gas optimization verified
- Reentrancy protection tested
- Access control validated
- Fuzz testing for inputs

## 🤖 **AI Agent Integration**

**Both humans and AI agents can play together** in the same world:

### For Human Players
- Use web browser at `http://localhost:5555`
- Standard WASD movement and mouse interaction
- Full UI with inventory, equipment, skills display

### For AI Agents  
- **A2A Protocol**: Discover game via ERC-8004 registry at `/.well-known/agent-card.json`
- **ElizaOS Plugin**: Connect via Hyperscape plugin
- **WebSocket**: Same real-time connection as human players
- **Auto-Discovery**: Agents discover all 20+ skills dynamically
- All player actions available: combat, gathering, trading, movement
- Agents can see world state and make autonomous decisions

### Available Agent Actions (A2A Skills)
- **Combat**: Attack mobs, stop combat, change attack style
- **Skills**: Gather resources (woodcutting, fishing), gain XP
- **Navigation**: Move to 3D positions, pathfinding
- **Inventory**: Pick up/drop items, use items, manage 28-slot inventory
- **Equipment**: Equip/unequip weapons and armor
- **Banking**: Open bank, deposit/withdraw items
- **Economy**: Buy/sell items at general stores
- **Query**: Get status, check skills, view inventory, scan nearby entities
- **Social**: Chat with other players, interact with NPCs

### ERC-8004 Integration
Hyperscape automatically registers to the ERC-8004 agent registry on startup if blockchain is configured:
- Set `ENABLE_BLOCKCHAIN=true` or provide `RPC_URL`
- Game registers as discoverable agent with metadata
- External agents can find Hyperscape via registry
- Agent card lists all available skills for dynamic action registration

## 📊 **Development Status**

### ✅ Completed Features
- **Core RPG Systems**: Combat, skills, inventory, equipment
- **Real Hyperscape Integration**: Actual .hyp apps, no mocks
- **Multiplayer Support**: Multiple players in shared world
- **Visual Testing Framework**: Comprehensive browser automation
- **AI Agent Compatibility**: ElizaOS integration working
- **Performance Optimization**: Build system, linting, TypeScript

### 🎯 Game Design Document Compliance
This implementation **strictly follows** the [Game Design Document](CLAUDE.md):

- **Exact 9 skills**: Attack, Strength, Defense, Constitution, Ranged, Woodcutting, Fishing, Firemaking, Cooking
- **3 equipment tiers**: Bronze (level 1+), Steel (level 10+), Mithril (level 20+)
- **Arrow system**: Arrows required and consumed for ranged combat
- **Banking system**: Unlimited storage per bank location
- **MVP scope**: Core mechanics without advanced features
- **No player trading**: Maintains MVP scope boundaries

### 🚧 Future Expansions (Outside Current Scope)
- Complete skill set (20+ skills like RuneScape)
- Player trading and Grand Exchange economy
- Quest system with NPCs and storylines  
- Player vs Player combat
- Clans, guilds, and social systems
- Dungeons and instanced content
- Advanced crafting and enchanting

## 🔧 **Development Commands**

### Essential Commands
```bash
npm install      # Install all dependencies
npm run build    # Build all packages  
npm start        # Start the RPG game server
npm test         # Run comprehensive test suite
npm run lint     # Code quality and style checks
npm run dev      # Development mode with hot reload
```

### Documentation Commands
```bash
bun run docs:generate  # Generate API docs from TypeScript source
bun run docs:dev       # Start documentation dev server (localhost:3000)
bun run docs:build     # Build static documentation site
bun run docs:serve     # Serve production docs build locally
```

### Package-Specific Commands
```bash
# Work with individual packages
npm run build --workspace=packages/hyperscape
npm run test --workspace=packages/rpg  
npm run dev --workspace=packages/generation
```

### Testing Commands
```bash
npm test                    # All tests across packages
npm run test:rpg           # RPG-specific tests  
npm run test:visual        # Visual/screenshot tests
npm run test:integration   # End-to-end gameplay tests
```

### Development Mode
```bash
# Start development server with hot-reload
npm run dev           
# OR
bun run dev

# This starts:
# - Shared package: Rebuilds automatically on changes (watch mode)
# - Server: ws://localhost:5555/ws (Auto-rebuilds on TS changes)
# - Client: http://localhost:3333 (Vite with HMR)

# The dev server will:
# ✅ Watch and rebuild shared package when files change
# ✅ Automatically rebuild when you change TypeScript files
# ✅ Restart the server after each rebuild
# ✅ Hot-reload client changes instantly via Vite
# ✅ Show colored logs for easy debugging

# Run specific packages in dev mode:
npm run dev:shared   # Watch and rebuild shared package only
npm run dev:client   # Client with Vite HMR
npm run dev:server   # Server with auto-restart
npm run dev:all      # All packages in watch mode
```

## 🐛 **Troubleshooting**

### Common Issues

**Port conflicts (3000/3000 in use)**:
```bash
lsof -ti:5555 | xargs kill -9
lsof -ti:5555 | xargs kill -9
npm start
```

**Tests failing with connection errors**:
```bash
pkill -f "hyperscape"  # Kill any existing Hyperscape processes
npm test
```

**Build errors after updates**:
```bash
rm -rf packages/*/build packages/*/dist node_modules
npm install
npm run build
```

**Character data reset**:
```bash
# Remove world database to reset all player progress
rm packages/rpg/world/db.sqlite
npm start
```

### Performance Tips

- **Lower graphics**: Use "Performance" mode in browser settings
- **Close other tabs**: Reduces memory usage for better framerate  
- **Restart server**: If world becomes laggy, restart with `npm start`
- **Clear browser cache**: May help with asset loading issues

## 📖 **Learn More**

### Documentation
- **[API Documentation](https://your-username.github.io/hyperscape-2/)** - Auto-generated TypeScript API docs (hosted on GitHub Pages)
- **[Documentation Setup Guide](DOCS-SETUP.md)** - How to generate and deploy documentation
- **[Game Design Document](CLAUDE.md)** - Complete game mechanics and lore
- **[Hyperscape Documentation](packages/hyperscape/docs/)** - Engine API reference
- **[RPG Package README](packages/rpg/README.md)** - Implementation details
- **[Testing Guide](packages/test-framework/README.md)** - How testing works

### Key Concepts
- **Entity Component System**: How game objects are structured  
- **Real-time Networking**: Multiplayer synchronization approach
- **Visual Testing**: Why we test with real gameplay, not mocks
- **AI Agent Integration**: How ElizaOS agents play alongside humans

## 🎯 **Quick Start Summary**

```bash
git clone [repository-url]
cd hyperscape
npm install
npm run build
npm start
# Open browser to http://localhost:5555
# Click on green cubes (goblins) to fight and gain XP!
```

## 🚀 **Deployment & Configuration Guide**

This comprehensive guide covers production deployment to Cloudflare, database setup with Neon, authentication with Privy, Farcaster miniapp configuration, and mobile app deployment for iOS and Android.

### Table of Contents
- [1. Cloudflare CI/CD Setup](#1-cloudflare-cicd-setup)
- [2. Neon PostgreSQL Database Setup](#2-neon-postgresql-database-setup)
- [3. Privy Authentication Setup](#3-privy-authentication-setup)
- [4. Farcaster Miniapp Configuration](#4-farcaster-miniapp-configuration)
- [5. iOS App Deployment](#5-ios-app-deployment)
- [6. Android App Deployment](#6-android-app-deployment)
- [7. Additional Secrets & Configuration](#7-additional-secrets--configuration)

---

### 1. Cloudflare CI/CD Setup

#### Overview
The project deploys two services to Cloudflare:
- **Client**: Cloudflare Pages (static frontend)
- **Server**: Cloudflare Workers/Containers (game server)

#### Prerequisites
- Cloudflare account with Pages and Workers enabled
- GitHub repository connected to Cloudflare
- Wrangler CLI installed: `npm install -g wrangler`

#### Step 1.1: Cloudflare Account Setup

1. **Create Cloudflare Account** (if needed)
   - Visit https://dash.cloudflare.com/sign-up
   - Verify your email address

2. **Get API Credentials**
   ```bash
   # Login to Cloudflare
   wrangler login
   
   # Get your Account ID
   wrangler whoami
   ```
   - Copy your **Account ID** (displayed after login)

3. **Generate API Token**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click **Create Token**
   - Use template: **Edit Cloudflare Workers**
   - Permissions needed:
     - Account → Workers Scripts → Edit
     - Account → Pages → Edit
     - Account → R2 → Edit (for assets)
   - Create token and **save it securely** (shown only once)

#### Step 1.2: Configure GitHub Secrets

Add the following secrets to your GitHub repository:

1. **Navigate to Repository Settings**
   - Go to `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`

2. **Add Required Secrets**

   ```bash
   # Cloudflare Credentials
   CLOUDFLARE_API_TOKEN=your_api_token_here
   CLOUDFLARE_ACCOUNT_ID=your_account_id_here
   
   # Cloudflare Projects
   CLOUDFLARE_PROJECT_NAME=hyperscape-client
   CLOUDFLARE_SERVER_NAME=hyperscape-server
   
   # Production URLs (set after first deploy)
   PRODUCTION_URL=https://hyperscape-client.pages.dev
   ```

#### Step 1.3: Configure Wrangler for Client

The client already has `packages/client/wrangler.toml`. Update if needed:

```toml
name = "hyperscape-client"
compatibility_date = "2024-10-01"
pages_build_output_dir = "dist"

[env.production]
vars = { }
```

#### Step 1.4: Manual Deployment (Testing)

Test deployment locally before using CI/CD:

```bash
# From packages/client
bun run build
wrangler pages deploy dist --project-name=hyperscape-client

# From packages/server  
bun run build
wrangler deploy
```

#### Step 1.5: Automated CI/CD

The project includes GitHub Actions workflows:

**`.github/workflows/ci.yml`** - Runs on every push/PR:
- Linting
- Testing
- Building all packages
- Docker image build

**`.github/workflows/deploy.yml`** - Manual deployment:
- Trigger via GitHub Actions UI
- Choose environment (staging/production)
- Deploys client and server to Cloudflare

**To deploy:**
1. Go to Actions tab in GitHub
2. Select "Deploy to Cloudflare"
3. Click "Run workflow"
4. Choose `staging` or `production`
5. Monitor deployment progress

#### Step 1.6: Environment Variables in Cloudflare

After first deployment, configure environment variables:

**For Client (Cloudflare Pages):**
1. Go to Cloudflare Dashboard → Pages → hyperscape-client
2. Settings → Environment Variables
3. Add for **Production**:
   ```bash
   PUBLIC_WS_URL=wss://hyperscape-server.your-domain.workers.dev/ws
   PUBLIC_CDN_URL=https://pub-your-id.r2.dev
   PUBLIC_PRIVY_APP_ID=your-privy-app-id
   PUBLIC_ENABLE_FARCASTER=true
   PUBLIC_APP_URL=https://hyperscape-client.pages.dev
   ```

**For Server (Cloudflare Workers):**
1. Use Wrangler CLI to set secrets:
   ```bash
   cd packages/server
   
   # Database
   wrangler secret put DATABASE_URL
   # Enter: postgresql://username:password@host/database
   
   # Privy Auth
   wrangler secret put PRIVY_APP_SECRET
   wrangler secret put PRIVY_APP_ID
   
   # LiveKit (if using voice)
   wrangler secret put LIVEKIT_API_KEY
   wrangler secret put LIVEKIT_API_SECRET
   wrangler secret put LIVEKIT_URL
   
   # JWT Secret
   wrangler secret put JWT_SECRET
   ```

---

### 2. Neon PostgreSQL Database Setup

#### Overview
Neon provides serverless PostgreSQL perfect for Cloudflare Workers with its global edge network and auto-scaling.

#### Step 2.1: Create Neon Account

1. **Sign Up**
   - Visit https://console.neon.tech/signup
   - Sign up with GitHub (recommended) or email

2. **Create Project**
   - Click **New Project**
   - Name: `hyperscape-production`
   - Region: Choose closest to your users (US East, EU West, Asia)
   - PostgreSQL version: 16 (latest)
   - Click **Create Project**

#### Step 2.2: Get Database Connection String

1. **Copy Connection String**
   - In Neon Console, go to your project
   - Dashboard → Connection Details
   - Copy the **Connection String** (pooled)
   - Format: `postgresql://username:password@host.pooler.neon.tech/dbname?sslmode=require`

2. **Create Database Branches** (Optional but recommended)
   - **Production Branch**: `main` (default)
   - **Staging Branch**: Create new branch for testing
   - Each branch has its own connection string

#### Step 2.3: Configure Environment Variables

**Local Development (.env):**
```bash
# packages/server/.env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
USE_LOCAL_POSTGRES=false
```

**GitHub Secrets:**
```bash
# Production database
NEON_DATABASE_URL=postgresql://user:pass@host.neon.tech/neondb?sslmode=require

# Staging database (optional)
NEON_STAGING_URL=postgresql://user:pass@host-staging.neon.tech/neondb?sslmode=require
```

**Cloudflare Workers:**
```bash
cd packages/server

# Production
wrangler secret put DATABASE_URL
# Paste Neon connection string

# Or via dashboard:
# Workers & Pages → hyperscape-server → Settings → Variables
```

#### Step 2.4: Run Database Migrations

The server automatically runs migrations on startup, but you can run them manually:

```bash
cd packages/server

# Install Drizzle CLI globally (if needed)
npm install -g drizzle-kit

# Generate migrations from schema
bun run drizzle-kit generate

# Push schema directly to database
bun run drizzle-kit push

# Or use the built-in migration on server start
bun run start
```

#### Step 2.5: Verify Database Connection

```bash
# Test connection
cd packages/server
bun run build
bun run start

# You should see:
# [DB] Initializing PostgreSQL with Drizzle...
# [DB] Connected to PostgreSQL
# [DB] Running migrations...
# [DB] Migrations complete
```

#### Step 2.6: Neon Features to Enable

**Recommended Settings:**
1. **Connection Pooling**: Already included in pooled connection string
2. **Autoscaling**: Enable in Project Settings → Compute
3. **Backups**: Automatic, check Settings → Backups
4. **Monitoring**: Enable in Settings → Integrations
5. **IP Allowlist**: Not needed for Cloudflare Workers (they use connection pooler)

---

### 3. Privy Authentication Setup

#### Overview
Privy provides embedded wallets and social login, including Farcaster authentication for the miniapp.

#### Step 3.1: Create Privy Account

1. **Sign Up**
   - Visit https://dashboard.privy.io/
   - Sign up with email or GitHub

2. **Create New App**
   - Click **Create App**
   - App Name: `Hyperscape`
   - Environment: Start with `Development`

#### Step 3.2: Configure Login Methods

1. **Enable Login Methods**
   - Dashboard → Configuration → Login Methods
   - Enable:
     - ✅ **Email** (basic auth)
     - ✅ **Wallet** (Web3 auth)
     - ✅ **Farcaster** (for miniapp) ⭐
   - Save changes

2. **Configure Farcaster**
   - Click **Farcaster** settings
   - Enable **Farcaster Miniapp SDK** support
   - Note: You'll need a Farcaster app registration (see Section 4)

#### Step 3.3: Get API Credentials

1. **Copy App ID**
   - Dashboard → Settings → App ID
   - Format: `clxxxxxxxxxxxxxxxxxxxxxx`
   - This is **PUBLIC** - safe to expose in client

2. **Copy App Secret**
   - Dashboard → Settings → API Secrets
   - Click **Create Secret**
   - Copy and **save securely** (shown only once)
   - This is **PRIVATE** - never expose in client

#### Step 3.4: Configure Redirect URLs

1. **Add Allowed Origins**
   - Settings → Allowed Origins
   - Add:
     ```
     http://localhost:3333
     http://localhost:5555
     https://hyperscape-client.pages.dev
     https://your-custom-domain.com
     ```

2. **Add Redirect URIs**
   - Settings → Redirect URIs
   - Add:
     ```
     http://localhost:3333/
     http://localhost:5555/
     https://hyperscape-client.pages.dev/
     
     # For mobile apps
     hyperscape://oauth-callback
     ```

#### Step 3.5: Configure Environment Variables

**Client (packages/client/.env):**
```bash
PUBLIC_PRIVY_APP_ID=clxxxxxxxxxxxxxxxxxxxxxx
```

**Server (packages/server/.env):**
```bash
PRIVY_APP_ID=clxxxxxxxxxxxxxxxxxxxxxx
PRIVY_APP_SECRET=your_secret_here
```

**GitHub Secrets:**
```bash
PRIVY_APP_ID=clxxxxxxxxxxxxxxxxxxxxxx
PRIVY_APP_SECRET=your_secret_here
```

**Cloudflare:**
```bash
# Client (Pages Environment Variables)
PUBLIC_PRIVY_APP_ID=clxxxxxxxxxxxxxxxxxxxxxx

# Server (Workers Secrets)
wrangler secret put PRIVY_APP_ID
wrangler secret put PRIVY_APP_SECRET
```

#### Step 3.6: Test Authentication

1. **Local Testing**
   ```bash
   bun run dev
   # Visit http://localhost:3333
   # Try logging in with email or wallet
   ```

2. **Verify Token**
   - Check browser DevTools → Application → Local Storage
   - Look for `privy:token` and `privy:session`

---

### 4. Farcaster Miniapp Configuration

#### Overview
Deploy Hyperscape as a Farcaster Frame v2 miniapp that runs inside the Warpcast client.

#### Step 4.1: Create Farcaster Account

1. **Get Farcaster Account**
   - Download Warpcast app (iOS/Android)
   - Create account or sign in
   - You need at least 1 storage unit (~$7 worth of ETH on OP Mainnet)

#### Step 4.2: Register Farcaster App

1. **Visit Farcaster Developer Console**
   - Go to https://warpcast.com/~/developers
   - Or https://farcaster.xyz/developers

2. **Create New App**
   - Click **Create App**
   - Fill in details:
     ```
     Name: Hyperscape
     Description: AI-Generated RuneScape-Style MMORPG
     Icon: Upload your app icon (512x512 PNG)
     Website: https://hyperscape-client.pages.dev
     ```

3. **Configure App Permissions**
   - Request permissions:
     - ✅ Read user profile
     - ✅ Post casts on behalf of user (optional)
     - ✅ Read user's social graph (optional)

#### Step 4.3: Get Miniapp Keys

After registration, you'll receive:

```bash
# Farcaster App Keys
FC_APP_ID=your-farcaster-app-id
FC_APP_SECRET=your-farcaster-app-secret
FC_SIGNER_UUID=your-signer-uuid
```

#### Step 4.4: Configure Frame Manifest

Create or update frame manifest:

**packages/client/public/frame-manifest.json:**
```json
{
  "name": "Hyperscape",
  "version": "1.0.0",
  "iconUrl": "https://hyperscape-client.pages.dev/icon.png",
  "splashImageUrl": "https://hyperscape-client.pages.dev/splash.png",
  "splashBackgroundColor": "#000000",
  "homeUrl": "https://hyperscape-client.pages.dev",
  "frameUrl": "https://hyperscape-client.pages.dev",
  "webhookUrl": "https://hyperscape-server.workers.dev/webhooks/farcaster"
}
```

#### Step 4.5: Configure Environment Variables

**Client (.env):**
```bash
PUBLIC_ENABLE_FARCASTER=true
PUBLIC_APP_URL=https://hyperscape-client.pages.dev
PUBLIC_FC_APP_ID=your-farcaster-app-id
```

**Server (.env):**
```bash
FC_APP_SECRET=your-farcaster-app-secret
FC_SIGNER_UUID=your-signer-uuid
```

**GitHub Secrets:**
```bash
FC_APP_ID=your-farcaster-app-id
FC_APP_SECRET=your-farcaster-app-secret
FC_SIGNER_UUID=your-signer-uuid
```

**Cloudflare:**
```bash
# Client environment variables
PUBLIC_ENABLE_FARCASTER=true
PUBLIC_FC_APP_ID=your-farcaster-app-id

# Server secrets
wrangler secret put FC_APP_SECRET
wrangler secret put FC_SIGNER_UUID
```

#### Step 4.6: Deploy Frame

1. **Build and Deploy**
   ```bash
   # Ensure manifest is in public/
   bun run build
   bun run deploy:prod
   ```

2. **Submit Frame to Farcaster**
   - Go back to Farcaster Developer Console
   - Update app settings with deployed URL
   - Submit for review

3. **Test in Warpcast**
   - Open Warpcast app
   - Search for your frame or use direct link
   - Test all functionality

#### Step 4.7: Frame Deep Linking

Configure deep links for sharing:

```bash
# Format
https://warpcast.com/~/add-frame-action?url=https://hyperscape-client.pages.dev/frame-manifest.json

# Share link
https://warpcast.com/~/hyperscape
```

---

### 5. iOS App Deployment

#### Overview
Build and deploy the iOS app using Capacitor for native iOS deployment via TestFlight and App Store.

#### Prerequisites
- macOS computer (required for iOS development)
- Xcode 15+ installed
- Apple Developer Account ($99/year)
- Physical iOS device (for testing) or simulator

#### Step 5.1: Apple Developer Setup

1. **Enroll in Apple Developer Program**
   - Visit https://developer.apple.com/programs/
   - Enroll ($99/year)
   - Wait for approval (usually 24-48 hours)

2. **Create App ID**
   - Go to https://developer.apple.com/account/
   - Certificates, Identifiers & Profiles → Identifiers
   - Click **+** → App IDs → Continue
   - Fill in:
     ```
     Description: Hyperscape
     Bundle ID: com.hyperscape.app (must match capacitor.config.ts)
     Capabilities: Enable Push Notifications, Associated Domains
     ```
   - Register

3. **Create Provisioning Profiles**
   
   **Development Profile:**
   - Profiles → **+** → Development
   - Select App ID: `com.hyperscape.app`
   - Select Certificates: Your development certificate
   - Select Devices: Add your test devices
   - Name: `Hyperscape Development`
   - Download and install

   **Distribution Profile:**
   - Profiles → **+** → Distribution → App Store
   - Select App ID: `com.hyperscape.app`
   - Select Certificate: Your distribution certificate
   - Name: `Hyperscape Distribution`
   - Download and install

#### Step 5.2: Configure Xcode Project

1. **Open Project**
   ```bash
   cd packages/client
   bun run ios
   # This opens Xcode automatically
   ```

2. **Configure Signing**
   - Select `App` target in Xcode
   - Signing & Capabilities tab
   - Team: Select your Apple Developer team
   - Bundle Identifier: `com.hyperscape.app` (should match)
   - Automatically manage signing: ✅ Enabled

3. **Update App Info**
   - Edit `ios/App/App/Info.plist`:
   ```xml
   <key>CFBundleDisplayName</key>
   <string>Hyperscape</string>
   <key>CFBundleShortVersionString</key>
   <string>1.0.0</string>
   <key>CFBundleVersion</key>
   <string>1</string>
   ```

4. **Configure Assets**
   - App Icon: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
   - Add 1024x1024 PNG icon
   - Xcode will generate all sizes

#### Step 5.3: Local Testing

```bash
# Build and test on simulator
cd packages/client
bun run build
bun run cap:sync:ios
bun run ios

# In Xcode: Product → Run (Cmd+R)
# Choose device or simulator
```

#### Step 5.4: Build for TestFlight (Beta)

1. **Archive Build**
   - In Xcode: Product → Archive
   - Wait for build to complete
   - Organizer window appears

2. **Upload to App Store Connect**
   - Click **Distribute App**
   - Select: App Store Connect
   - Upload → Automatic signing
   - Wait for upload (5-10 minutes)

3. **Configure in App Store Connect**
   - Go to https://appstoreconnect.apple.com/
   - My Apps → **+** → New App
   - Fill in:
     ```
     Platform: iOS
     Name: Hyperscape
     Primary Language: English
     Bundle ID: com.hyperscape.app
     SKU: hyperscape-ios-1
     User Access: Full Access
     ```

4. **Add to TestFlight**
   - App Store Connect → TestFlight
   - Select your build (wait for processing, ~15 minutes)
   - Add test information and review notes
   - Submit for Beta Review
   - Add Internal/External Testers

#### Step 5.5: CI/CD for iOS

**Create GitHub Action** (`.github/workflows/ios.yml`):

```yaml
name: iOS Build

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Build environment'
        required: true
        type: choice
        options:
          - development
          - production

jobs:
  build:
    name: Build iOS App
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
      
      - name: Install dependencies
        run: bun install --frozen-lockfile
      
      - name: Build client
        working-directory: packages/client
        run: bun run build
        env:
          PUBLIC_WS_URL: ${{ secrets.PRODUCTION_WS_URL }}
          PUBLIC_CDN_URL: ${{ secrets.PRODUCTION_CDN_URL }}
          PUBLIC_PRIVY_APP_ID: ${{ secrets.PRIVY_APP_ID }}
      
      - name: Sync Capacitor
        working-directory: packages/client
        run: bunx cap sync ios
      
      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: latest-stable
      
      - name: Install certificates
        env:
          CERTIFICATE_BASE64: ${{ secrets.IOS_CERTIFICATE_BASE64 }}
          P12_PASSWORD: ${{ secrets.IOS_CERTIFICATE_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          # Create keychain
          security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          
          # Import certificate
          echo "$CERTIFICATE_BASE64" | base64 --decode > certificate.p12
          security import certificate.p12 -k build.keychain -P "$P12_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain
      
      - name: Build iOS App
        working-directory: packages/client/ios/App
        run: |
          xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -configuration Release \
            -archivePath App.xcarchive \
            archive
      
      - name: Export IPA
        working-directory: packages/client/ios/App
        run: |
          xcodebuild -exportArchive \
            -archivePath App.xcarchive \
            -exportPath . \
            -exportOptionsPlist ExportOptions.plist
      
      - name: Upload to TestFlight
        env:
          APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
          APPLE_API_ISSUER_ID: ${{ secrets.APPLE_API_ISSUER_ID }}
          APPLE_API_KEY_BASE64: ${{ secrets.APPLE_API_KEY_BASE64 }}
        run: |
          echo "$APPLE_API_KEY_BASE64" | base64 --decode > AuthKey.p8
          xcrun altool --upload-app \
            --type ios \
            --file packages/client/ios/App/App.ipa \
            --apiKey $APPLE_API_KEY_ID \
            --apiIssuer $APPLE_API_ISSUER_ID
```

**Required GitHub Secrets for iOS:**
```bash
IOS_CERTIFICATE_BASE64           # Export .p12 cert as base64
IOS_CERTIFICATE_PASSWORD         # Password for .p12
KEYCHAIN_PASSWORD                # Temp keychain password
APPLE_API_KEY_ID                 # From App Store Connect
APPLE_API_ISSUER_ID              # From App Store Connect
APPLE_API_KEY_BASE64             # API key .p8 as base64
```

#### Step 5.6: Production Release

1. **Prepare App Store Listing**
   - App Store Connect → My Apps → Hyperscape
   - Version Information
   - Screenshots (6.5", 6.7", 12.9" required)
   - App Preview videos (optional)
   - Description, keywords, support URL

2. **Submit for Review**
   - Select build from TestFlight
   - Fill in review information
   - Submit for Review
   - Wait for approval (1-3 days)

---

### 6. Android App Deployment

#### Overview
Build and deploy the Android app using Capacitor for Google Play Store distribution.

#### Prerequisites
- Android Studio installed
- Google Play Developer Account ($25 one-time)
- Java JDK 17+ installed

#### Step 6.1: Google Play Console Setup

1. **Create Google Play Developer Account**
   - Visit https://play.google.com/console/signup
   - Pay $25 one-time registration fee
   - Fill in account details
   - Wait for verification (24-48 hours)

2. **Create New App**
   - Play Console → All apps → Create app
   - Fill in:
     ```
     App name: Hyperscape
     Default language: English (United States)
     App or game: Game
     Free or paid: Free
     ```
   - Accept declarations
   - Create app

#### Step 6.2: Configure Android Project

1. **Update Build Configuration**
   
   **packages/client/android/app/build.gradle:**
   ```gradle
   android {
       namespace "com.hyperscape.app"
       compileSdkVersion 34
       
       defaultConfig {
           applicationId "com.hyperscape.app"
           minSdkVersion 24
           targetSdkVersion 34
           versionCode 1
           versionName "1.0.0"
       }
       
       signingConfigs {
           release {
               if (project.hasProperty('HYPERSCAPE_KEYSTORE_FILE')) {
                   storeFile file(HYPERSCAPE_KEYSTORE_FILE)
                   storePassword HYPERSCAPE_KEYSTORE_PASSWORD
                   keyAlias HYPERSCAPE_KEY_ALIAS
                   keyPassword HYPERSCAPE_KEY_PASSWORD
               }
           }
       }
       
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled true
               proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

2. **Create Signing Key**
   ```bash
   cd packages/client/android/app
   
   # Generate keystore
   keytool -genkey -v \
     -keystore hyperscape-release-key.jks \
     -alias hyperscape \
     -keyalg RSA \
     -keysize 2048 \
     -validity 10000
   
   # Enter details when prompted
   # SAVE THE PASSWORDS SECURELY!
   ```

3. **Configure Gradle Properties**
   
   **packages/client/android/gradle.properties:**
   ```properties
   HYPERSCAPE_KEYSTORE_FILE=./app/hyperscape-release-key.jks
   HYPERSCAPE_KEYSTORE_PASSWORD=your_keystore_password
   HYPERSCAPE_KEY_ALIAS=hyperscape
   HYPERSCAPE_KEY_PASSWORD=your_key_password
   ```
   
   **⚠️ Add to .gitignore:**
   ```
   android/gradle.properties
   android/app/*.jks
   ```

#### Step 6.3: Local Testing

```bash
cd packages/client

# Build
bun run build

# Sync to Android
bun run cap:sync:android

# Open Android Studio
bun run android

# In Android Studio:
# Build → Build Bundle(s) / APK(s) → Build APK
# Run on emulator or device
```

#### Step 6.4: Build Release AAB

```bash
cd packages/client

# Build client
bun run build

# Sync Capacitor
bun run cap:sync:android

# Build release AAB
cd android
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

#### Step 6.5: Upload to Google Play Console

1. **Create Release**
   - Play Console → Hyperscape → Testing → Internal testing
   - Create new release
   - Upload `app-release.aab`
   - Release name: `1.0.0 (1)`
   - Release notes:
     ```
     Initial release:
     - Complete RuneScape-style gameplay
     - Real-time multiplayer
     - AI-generated content
     ```

2. **Add Testers**
   - Create email list for internal testers
   - Save and review release
   - Start rollout to internal testing

3. **Test Internal Build**
   - Testers receive email with opt-in link
   - Download via Play Store
   - Test thoroughly

#### Step 6.6: CI/CD for Android

**Create GitHub Action** (`.github/workflows/android.yml`):

```yaml
name: Android Build

on:
  workflow_dispatch:
    inputs:
      track:
        description: 'Play Store track'
        required: true
        type: choice
        options:
          - internal
          - alpha
          - beta
          - production

jobs:
  build:
    name: Build Android App
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
      
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      
      - name: Install dependencies
        run: bun install --frozen-lockfile
      
      - name: Build client
        working-directory: packages/client
        run: bun run build
        env:
          PUBLIC_WS_URL: ${{ secrets.PRODUCTION_WS_URL }}
          PUBLIC_CDN_URL: ${{ secrets.PRODUCTION_CDN_URL }}
          PUBLIC_PRIVY_APP_ID: ${{ secrets.PRIVY_APP_ID }}
      
      - name: Sync Capacitor
        working-directory: packages/client
        run: bunx cap sync android
      
      - name: Decode keystore
        env:
          ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
        run: |
          echo "$ANDROID_KEYSTORE_BASE64" | base64 --decode > packages/client/android/app/release-key.jks
      
      - name: Build AAB
        working-directory: packages/client/android
        env:
          HYPERSCAPE_KEYSTORE_FILE: ./app/release-key.jks
          HYPERSCAPE_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          HYPERSCAPE_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          HYPERSCAPE_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: ./gradlew bundleRelease
      
      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}
          packageName: com.hyperscape.app
          releaseFiles: packages/client/android/app/build/outputs/bundle/release/app-release.aab
          track: ${{ inputs.track }}
          status: completed
```

**Required GitHub Secrets for Android:**
```bash
ANDROID_KEYSTORE_BASE64              # Base64 encoded .jks file
ANDROID_KEYSTORE_PASSWORD            # Keystore password
ANDROID_KEY_ALIAS                    # Key alias (hyperscape)
ANDROID_KEY_PASSWORD                 # Key password
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON     # Service account JSON for Play Store API
```

#### Step 6.7: Configure Play Store Listing

1. **Store Listing**
   - App details
   - Short description (80 chars)
   - Full description (4000 chars)
   - Screenshots (minimum 2, up to 8)
   - Feature graphic (1024x500)
   - App icon (512x512)

2. **Content Rating**
   - Complete questionnaire
   - Select: Game → Fantasy Violence
   - Get ESRB/PEGI ratings

3. **App Category**
   - Category: Games → Role Playing
   - Tags: RPG, Multiplayer, Adventure

4. **Pricing & Distribution**
   - Free app
   - Select countries
   - Content guidelines: Accept

#### Step 6.8: Production Release

1. **Create Production Release**
   - Testing → Promote release to Production
   - Or create new production release
   - Upload AAB
   - Roll out to 100%

2. **Submit for Review**
   - Review summary
   - Submit for review
   - Wait for approval (1-7 days)

---

### 7. Additional Secrets & Configuration

#### 7.1: Complete GitHub Secrets Checklist

Add all these to `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`:

**Cloudflare:**
```bash
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_PROJECT_NAME
CLOUDFLARE_SERVER_NAME
PRODUCTION_URL
```

**Database (Neon):**
```bash
NEON_DATABASE_URL
NEON_STAGING_URL
DATABASE_URL  # For CI tests
```

**Authentication (Privy):**
```bash
PRIVY_APP_ID
PRIVY_APP_SECRET
```

**Farcaster:**
```bash
FC_APP_ID
FC_APP_SECRET
FC_SIGNER_UUID
```

**iOS Deployment:**
```bash
IOS_CERTIFICATE_BASE64
IOS_CERTIFICATE_PASSWORD
KEYCHAIN_PASSWORD
APPLE_API_KEY_ID
APPLE_API_ISSUER_ID
APPLE_API_KEY_BASE64
```

**Android Deployment:**
```bash
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
```

**Optional Services:**
```bash
LIVEKIT_API_KEY          # Voice chat
LIVEKIT_API_SECRET
LIVEKIT_URL
OPENAI_API_KEY           # AI generation (if using)
MESHY_API_KEY            # 3D model generation
```

#### 7.2: Cloudflare R2 Setup (CDN for Assets)

1. **Create R2 Bucket**
   ```bash
   wrangler r2 bucket create hyperscape-assets
   ```

2. **Enable Public Access**
   - Cloudflare Dashboard → R2 → hyperscape-assets
   - Settings → Public Access → Allow
   - Copy Public Bucket URL: `https://pub-xxxxx.r2.dev`

3. **Upload Assets**
   ```bash
   cd packages/server
   bun run assets:deploy
   
   # Or manually with Wrangler
   wrangler r2 object put hyperscape-assets/models/sword.glb --file=./assets/models/sword.glb
   ```

4. **Update CDN URLs**
   ```bash
   # Client environment
   PUBLIC_CDN_URL=https://pub-xxxxx.r2.dev
   
   # Server environment  
   PUBLIC_CDN_URL=https://pub-xxxxx.r2.dev
   ```

#### 7.3: Custom Domain Setup

**For Cloudflare Pages (Client):**
1. Dashboard → Pages → hyperscape-client → Custom domains
2. Add domain: `play.yourgame.com`
3. Add DNS records (automatic)
4. Wait for SSL certificate (5-10 minutes)

**For Cloudflare Workers (Server):**
1. Dashboard → Workers & Pages → hyperscape-server → Settings → Domains & Routes
2. Add custom domain: `api.yourgame.com`
3. Update DNS
4. Update WebSocket URL in client: `wss://api.yourgame.com/ws`

#### 7.4: Monitoring & Analytics

**Add to Cloudflare:**
1. Enable Web Analytics for Pages
2. Enable Workers Analytics  
3. Set up Logpush for debugging
4. Configure alerts for errors

**Add to GitHub:**
1. Enable Dependabot for security updates
2. Enable CodeQL for code scanning
3. Configure branch protection rules

#### 7.5: Environment-Specific Configurations

**Development:**
```bash
NODE_ENV=development
PUBLIC_WS_URL=ws://localhost:5555/ws
PUBLIC_CDN_URL=http://localhost:8088
DATABASE_URL=postgresql://localhost/hyperscape_dev
```

**Staging:**
```bash
NODE_ENV=staging  
PUBLIC_WS_URL=wss://staging-api.yourgame.com/ws
PUBLIC_CDN_URL=https://staging-cdn.yourgame.com
DATABASE_URL=postgresql://staging.neon.tech/hyperscape_staging
```

**Production:**
```bash
NODE_ENV=production
PUBLIC_WS_URL=wss://api.yourgame.com/ws
PUBLIC_CDN_URL=https://cdn.yourgame.com
DATABASE_URL=postgresql://prod.neon.tech/hyperscape
```

---

## 🔒 Security Best Practices

1. **Never commit secrets** to git
2. **Rotate secrets** regularly (quarterly)
3. **Use different secrets** for dev/staging/prod
4. **Enable 2FA** on all service accounts
5. **Review access logs** monthly
6. **Keep dependencies updated** with Dependabot
7. **Use environment-specific** API keys
8. **Limit secret access** to necessary team members only

---

## 📝 **License**

MIT License - Feel free to use this project as inspiration for your own AI-powered games.

---

**🎮 Ready to explore the AI-generated world of Hyperscape?** 

**Run `npm start` and open `http://localhost:5555` to begin your adventure!**

*Fight goblins, master skills, discover an AI-crafted world, and play alongside autonomous AI agents in this unique take on classic RuneScape gameplay.*