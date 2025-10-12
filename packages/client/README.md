# Hyperscape RPG Engine

A comprehensive RPG system built on the Hyperscape 3D multiplayer game engine, featuring RuneScape-inspired mechanics with AI-generated content.

## Overview

The Hyperscape RPG is a persistent multiplayer RPG featuring:
- Real-time combat with melee and ranged weapons
- Skill-based progression system (9 skills)
- Resource gathering and crafting
- Banking and trading systems
- Mob spawning and AI entities
- Comprehensive UI with inventory, equipment, and banking interfaces
- AI agent compatibility through ElizaOS integration

## Quick Start

### TL;DR - Get Playing Fast

```bash
cd packages/hyperscape
bun install
bun run dev
# Open http://localhost:3333 and start playing!
# (No auth setup needed for local development)
```

### Prerequisites

- Node.js 18+ or Bun 1.0+
- Bun recommended for fastest installation
- 4GB+ RAM (for SQLite database and 3D rendering)
- Modern browser with WebGL support

### Installation

```bash
# Clone the repository
git clone https://github.com/hyperscapeai/hyperscape
cd hyperscape/packages/hyperscape

# Install dependencies
bun install

# Start the development server (Privy auth is OPTIONAL)
bun run dev
```

The frontend will start on `http://localhost:3333` and backend on `http://localhost:5555`

> **Note**: Authentication with Privy is **optional**. The app works perfectly fine without it for development/testing. Users will be anonymous but can still play. See "Authentication Setup" below to enable persistent accounts.

### Authentication Setup (Optional)

> **⚠️ OPTIONAL**: You can skip this entire section for local development. The game works without authentication!

Hyperscape uses **Privy** for user authentication, supporting wallet login, email, social accounts, and Farcaster. This enables:
- 💾 **Persistent accounts** across devices
- 🔐 **Secure authentication** via wallet, email, or social
- 🎭 **Farcaster integration** for Frame deployment
- 📊 **Progress tracking** tied to user identity

If you want these features, follow the steps below. Otherwise, skip to "First Time Setup".

#### 1. Get Privy Credentials

1. Go to [Privy Dashboard](https://dashboard.privy.io/)
2. Create a new app or select existing app
3. **Enable Farcaster login** in Settings → Login Methods (if using Farcaster)
4. Copy your credentials:
   - App ID from Settings → Basics
   - App Secret from Settings → API Keys

#### 2. Configure Environment Variables

Edit your `.env` file:

```bash
# Required: Privy App ID (get from dashboard.privy.io)
PUBLIC_PRIVY_APP_ID=your-privy-app-id-here
PRIVY_APP_ID=your-privy-app-id-here
PRIVY_APP_SECRET=your-privy-app-secret-here

# Optional: Farcaster Frame v2 deployment
PUBLIC_ENABLE_FARCASTER=false
PUBLIC_APP_URL=http://localhost:5555
```

#### 3. Start the Server

```bash
bun run dev
```

#### 4. Login Flow

1. Open your browser to `http://localhost:3333`
2. You'll see a login screen
3. Click "Login to Play" 
4. Choose your authentication method (wallet, email, Farcaster, etc.)
5. After authentication, the game world will load
6. Create your character and start playing!

#### Development Without Authentication

For local development/testing, you can skip authentication by not setting `PUBLIC_PRIVY_APP_ID`. The app will fall back to anonymous users with local tokens.

```bash
# In .env, leave these commented out or remove them:
# PUBLIC_PRIVY_APP_ID=
# PRIVY_APP_ID=
# PRIVY_APP_SECRET=
```

Note: User progress will not persist across devices without authentication.

#### Migrating Existing Installations

If you're upgrading from a version without Privy:

1. **Install new dependencies**:
```bash
bun install
```

2. **Add Privy credentials** to `.env` (optional):
```bash
PUBLIC_PRIVY_APP_ID=your-app-id
PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-secret
```

3. **Database migration** runs automatically on next server start
   - New columns: `privyUserId`, `farcasterFid`
   - Existing users continue to work with legacy tokens

4. **Backward Compatibility**:
   - ✅ Existing users keep their accounts
   - ✅ Legacy auth tokens still work
   - ✅ No breaking changes to existing deployments
   - ✅ Privy is optional - app works without it

### First Time Setup

1. **Authenticate** using Privy (wallet, email, or social login)
2. **Create character** - choose your name in-game
3. **Explore** - Use WASD to move, click to interact with objects
4. **Right-click** for context menus and advanced actions
5. **Open menus** - Use left sidebar buttons for Inventory, Skills, Equipment, etc.

### Configuration

Hyperscape uses environment variables for flexible deployment. The system works great with defaults for local development, but you can customize it for mobile, LAN testing, or production deployment.

**Check your configuration**:
```bash
npm run config:check  # Desktop development
npm run config:check:mobile  # Mobile development
```

See [CONFIG.md](./CONFIG.md) for complete configuration documentation.

### Mobile Development

Hyperscape supports iOS and Android through CapacitorJS.

**Quick Start:**
```bash
# 1. Get your local IP for mobile connection
npm run cap:ip

# 2. Export the server URL (use command from step 1)
export CAP_SERVER_URL="http://192.168.1.XXX:3333"

# 3. Start dev server (separate terminal)
npm run dev

# 4. Open mobile app
npm run ios:dev      # or android:dev
```

See [MOBILE-QUICKSTART.md](./MOBILE-QUICKSTART.md) for quick reference or [MOBILE.md](./MOBILE.md) for complete documentation.

### Farcaster Frame v2 Deployment

Deploy Hyperscape as a Farcaster mini-app (Frame v2):

#### Prerequisites

1. **Privy configured** with Farcaster login enabled
2. **Public HTTPS URL** (required for Farcaster)
3. **Frame metadata** configured

#### Setup

1. **Enable Farcaster in environment**:
```bash
PUBLIC_ENABLE_FARCASTER=true
PUBLIC_APP_URL=https://your-game-domain.com
```

2. **Deploy to public URL**:
```bash
# Build for production
bun run build

# Deploy to your hosting platform (Vercel, Railway, etc.)
# Make sure both frontend and backend are accessible
```

3. **Configure Privy for Farcaster**:
- In [Privy Dashboard](https://dashboard.privy.io/)
- Go to Settings → Login Methods
- Enable "Farcaster" login
- Add your app's redirect URLs

4. **Test your Frame**:
- Use [Farcaster Developer Tools](https://farcaster.xyz/~/developers/mini-apps/embed)
- Enter your app URL
- Preview in the embedded viewer
- Note: localhost won't work - use ngrok/Cloudflare tunnel for testing

5. **Share your Frame**:
- Share your app URL in any Farcaster client
- Users can launch the mini-app directly from the Frame
- Automatic Farcaster authentication for seamless onboarding

#### Frame Features

- **Auto-login**: Users are automatically authenticated with their Farcaster account
- **Wallet integration**: Farcaster wallet (Warplet) is automatically connected
- **Identity**: Player progress is tied to Farcaster FID
- **Cross-platform**: Works in Farcaster mobile app and Warpcast

#### Local Testing with Tunnel

For local development testing as a Frame:

```bash
# Install ngrok or use Cloudflare tunnel
npx ngrok http 5555

# Update .env with ngrok URL
PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io

# Restart server
bun run dev
```

## Account Management

### User Authentication

- **Account Creation**: Automatic on first login with Privy
- **Identity Persistence**: Game progress tied to Privy user ID
- **Multiple Devices**: Access your account from any device
- **Account Linking**: Link multiple auth methods (wallet, email, social) to one account

### Character Management

- **Name Changes**: Update your character name in-game (Settings panel)
- **Avatar**: Upload custom VRM avatars (future feature)
- **Progress Tracking**: All skills, items, and progress saved to your account

### Supported Login Methods

- 🔐 **Wallet**: MetaMask, Coinbase Wallet, Rainbow, WalletConnect
- 📧 **Email**: Magic link or OTP authentication
- 🌐 **Social**: Google, Twitter, Discord (configured in Privy)
- 🎭 **Farcaster**: Seamless login for Farcaster users

### Account Security

- All authentication handled by Privy (industry-standard security)
- No passwords stored on Hyperscape servers
- JWT tokens for secure session management
- Automatic session refresh and token rotation

## Game Systems

### Combat System

- **Melee Combat**: Equip weapons and click on enemies to attack
- **Ranged Combat**: Requires bow + arrows equipped
- **Auto-Attack**: Combat continues automatically when in range
- **Damage System**: Based on Attack/Strength levels and equipment
- **Death Mechanics**: Items drop at death location, respawn at nearest town

### Skills System

9 core skills with XP-based progression:

1. **Attack** - Determines weapon accuracy and requirements
2. **Strength** - Increases melee damage
3. **Defense** - Reduces incoming damage, armor requirements
4. **Constitution** - Determines health points
5. **Ranged** - Bow accuracy and damage
6. **Woodcutting** - Tree harvesting with hatchet
7. **Fishing** - Fish gathering at water edges
8. **Firemaking** - Create fires from logs
9. **Cooking** - Process raw fish into food

### Equipment System

Three equipment tiers:
- **Bronze** (Level 1+)
- **Steel** (Level 10+) 
- **Mithril** (Level 20+)

Equipment slots:
- Weapon, Shield, Helmet, Body, Legs, Arrows

### Economy

- **Banking**: Unlimited storage in starter towns
- **General Store**: Purchase tools and arrows
- **Loot Drops**: Coins and equipment from defeated enemies
- **No Player Trading**: MVP limitation

## World Design

### Map Structure

- **Grid-based** terrain with height-mapped collision
- **Multiple biomes**: Mistwood Valley, Goblin Wastes, Darkwood Forest, etc.
- **Starter towns** with banks and stores (safe zones)
- **Difficulty zones** with level-appropriate enemies

### Mobs by Difficulty

**Level 1**: Goblins, Bandits, Barbarians
**Level 2**: Hobgoblins, Guards, Dark Warriors  
**Level 3**: Black Knights, Ice Warriors, Dark Rangers

## User Interface

### Core UI Elements

- **Account panel** (👤) - Login status, user info, logout, character name
- **Combat panel** (⚔️) - Attack styles and combat stats
- **Skills panel** (🧠) - Level progression and XP tracking
- **Inventory** (🎒) - 28 slots, drag-and-drop items
- **Equipment panel** (🛡️) - Worn items and stats
- **Settings panel** (⚙️) - Graphics, audio, and display options
- **Health/Stamina bars** - Displayed on minimap
- **Banking interface** - Store/retrieve items (at banks)
- **Store interface** - Purchase tools and supplies (at stores)

### Controls

- **Movement**: WASD keys or click-to-move
- **Camera**: Mouse look (hold right-click to rotate, scroll to zoom)
- **Interact**: Left-click on objects/NPCs
- **Context menu**: Right-click for advanced actions
- **UI Panels**: Click icons on left side of screen
  - 👤 Account - Login, logout, character name
  - ⚔️ Combat - Attack styles and combat level
  - 🧠 Skills - View skill levels and XP
  - 🎒 Inventory - Manage items (28 slots)
  - 🛡️ Equipment - View/manage equipped gear
  - ⚙️ Settings - Graphics, audio, preferences

## Authentication Architecture

### Privy Integration

The authentication system uses Privy for secure, Web3-native user management:

**Client-Side Components:**
- `PrivyAuthManager.ts` - Authentication state management
- `PrivyAuthProvider.tsx` - React context provider for Privy
- `LoginScreen.tsx` - Pre-game login UI
- `farcaster-frame-config.ts` - Farcaster Frame v2 metadata

**Server-Side Components:**
- `privy-auth.ts` - Token verification and user info extraction
- Database migrations in `db.ts` - Adds `privyUserId` and `farcasterFid` columns

**Authentication Flow:**

```
User Opens App
     ↓
Check Farcaster Context
     ↓
[Farcaster] → Auto-login    [Web/Mobile] → Show Login Screen
     ↓                              ↓
Privy Authentication (wallet, email, social, or Farcaster)
     ↓
Receive Access Token
     ↓
Connect to Server via WebSocket
     ↓
Server Verifies Token with Privy
     ↓
Load/Create User Account
     ↓
Spawn Player in World
```

**Key Features:**
- Zero-knowledge authentication (no passwords stored)
- Multi-device account access
- Wallet, email, and social login support
- Farcaster integration for seamless Frame experience
- Backward compatible with legacy anonymous users

## Development

### Architecture

The RPG is built using Hyperscape's Entity Component System:

- **Systems**: Handle game logic (combat, inventory, etc.)
- **Entities**: Players, mobs, items, world objects
- **Components**: Data containers attached to entities
- **Actions**: Player-initiated activities (attack, gather, etc.)

### Key Systems

- **PlayerSystem**: Player state management
- **CombatSystem**: Battle mechanics and damage
- **InventorySystem**: Item management
- **XPSystem**: Skill progression
- **MobSystem**: Monster AI and spawning
- **BankingSystem**: Storage and transactions
- **StoreSystem**: Shop functionality
- **ResourceSystem**: Gathering mechanics

### File Structure

```
packages/hyperscape/src/
├── rpg/
│   ├── systems/           # Core RPG systems
│   ├── components/        # Entity components
│   ├── actions/          # Player actions
│   ├── data/             # Game data (items, mobs, etc.)
│   └── types/            # TypeScript definitions
├── client/
│   └── components/       # React UI components
└── server/               # Server configuration
```

## Testing

The Hyperscape RPG includes a comprehensive unified test suite that validates all game systems through real browser automation and visual verification.

### Unified Test Suite

Run all tests with a single command:

```bash
# Run all tests (headless mode)
bun run test

# Run with visible browser (for debugging)
bun run test:headed

# Run with detailed logging
bun run test:verbose
```

### Test Categories

Filter tests by category:

```bash
# Run only RPG-specific tests
bun run test:rpg

# Run only framework/engine tests
bun run test:framework

# Run only integration tests
bun run test:integration

# Run only gameplay scenario tests
bun run test:gameplay
```

### Legacy Test Commands

Individual test suites are still available:

```bash
# Legacy test commands (for specific debugging)
bun run test:legacy:rpg           # RPG comprehensive tests
bun run test:legacy:integration   # System integration tests
bun run test:legacy:hyperscape       # Framework validation tests
bun run test:legacy:gameplay      # Gameplay scenario tests
```

### Test Coverage

The unified test suite includes:

1. **🎮 RPG Comprehensive Tests** - Core gameplay mechanics
   - Combat system (melee and ranged attacks)
   - Inventory and equipment management
   - Banking and store transactions
   - Resource gathering and skill progression
   - Death/respawn mechanics

2. **🔗 RPG Integration Tests** - System integration validation
   - Server startup and system initialization
   - Player spawning and character creation
   - Cross-system communication
   - Database persistence
   - UI integration

3. **⚡ Hyperscape Framework Tests** - Engine and framework validation
   - 3D rendering and WebGL functionality
   - Physics simulation and collision detection
   - Network synchronization
   - Asset loading and management

4. **🎯 RPG Gameplay Tests** - Specific gameplay scenarios
   - Complete quest workflows
   - Multi-player interactions
   - Edge case handling
   - Performance validation

### Test Results

Test results are saved to `test-results.json` with detailed metrics:
- Success/failure rates per test suite
- Performance timing information
- Error logs and screenshots
- Coverage analysis

### Visual Testing

Tests use colored cube proxies for visual verification:
- 🔴 Players
- 🟢 Goblins
- 🔵 Items
- 🟡 Trees
- 🟣 Banks
- 🟨 Stores

## AI Agent Integration

### ElizaOS Plugin

The RPG supports AI agents through the `plugin-hyperscape` ElizaOS plugin:

```bash
# Start ElizaOS with Hyperscape plugin
cd packages/plugin-hyperscape
elizaos start
```

### Agent Capabilities

AI agents can:
- Join the world as players
- Navigate using semantic directions
- Engage in combat with mobs
- Gather resources and manage inventory
- Use banking and store systems
- Interact with other players

### Agent Actions

Available actions for AI agents:
- `attack` - Combat with enemies
- `gather` - Resource collection
- `go_to` - Movement and navigation
- `interact` - Object/NPC interaction
- `equip/unequip` - Equipment management
- `drop/pickup` - Item handling
- `bank/store` - Economic transactions

## Production Deployment

### Environment Variables

```bash
# Required
DATABASE_URL=sqlite:./world/db.sqlite
WORLD_PATH=./world

# Optional
PUBLIC_ASSETS_URL=https://your-cdn.com/assets/
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
```

### Database Setup

The RPG uses SQLite for persistence:

```bash
# Initialize database
bun run db:init

# Reset world state (WARNING: Deletes all player data)
bun run db:reset
```

### Performance Optimization

- **Instance Limits**: Recommended 50-100 concurrent players
- **Memory Usage**: ~4GB RAM for full world with all systems
- **CPU Usage**: Scales with player count and active combat
- **Database**: SQLite handles thousands of players efficiently

## API Reference

### State Queries

Query game state via REST API:

```bash
# Get all available state queries
GET /api/state

# Get player stats
GET /api/state/player-stats?playerId=123

# Get world info
GET /api/state/world-info
```

### Action Execution

Execute actions via REST API:

```bash
# Get available actions for player
GET /api/actions/available?playerId=123

# Execute action
POST /api/actions/attack
{
  "targetId": "goblin-456",
  "playerId": "123"
}
```

## Troubleshooting

### Common Issues

**Server won't start**
- Check Node.js version (18+ required)
- Verify SQLite database permissions
- Ensure port 5555 is available

**Client connection fails**
- Verify WebSocket connection (check browser dev tools)
- Confirm server is running on correct port
- Check firewall settings

**Authentication issues**
- Verify `PUBLIC_PRIVY_APP_ID` is set correctly in `.env`
- Check that `PRIVY_APP_SECRET` matches your Privy dashboard
- Ensure Privy app is configured to allow your domain in redirect URLs
- For Farcaster: Enable Farcaster login in Privy dashboard settings
- For mobile: Add `hyperscape://` scheme to Privy allowed redirect URIs

**Farcaster Frame not working**
- Ensure `PUBLIC_ENABLE_FARCASTER=true` in `.env`
- Verify your app is deployed to a public HTTPS URL
- Check that meta tags are properly injected (view page source)
- Test with [Farcaster Dev Tools](https://farcaster.xyz/~/developers/mini-apps/embed)
- Make sure Farcaster login is enabled in Privy dashboard

**OAuth redirects fail on mobile**
- Add `hyperscape://` to Capacitor config schemes
- Update Privy dashboard with mobile redirect URIs: `hyperscape://oauth-callback`
- Rebuild and resync mobile apps after config changes

**Visual rendering issues**
- Ensure WebGL is supported in browser
- Check for GPU driver updates
- Try different browser if issues persist

**Performance problems**
- Reduce concurrent player count
- Monitor memory usage (4GB+ recommended)
- Check database size and optimize if needed

### Debug Mode

Enable debug logging:

```bash
# Start with debug output
DEBUG=hyperscape:* bun run dev

# Enable RPG system debugging
DEBUG=rpg:* bun run dev
```

### Test Validation

Verify installation with integration tests:

```bash
# Quick health check
bun run test:health

# Full system validation
bun run test:rpg:integration
```

## Contributing

### Development Setup

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-system`
3. Run tests: `bun run test:rpg:integration`
4. Commit changes: `git commit -am 'Add new system'`
5. Push branch: `git push origin feature/new-system`
6. Create Pull Request

### Code Standards

- TypeScript for all new code
- ESLint/Prettier for formatting
- Comprehensive tests required for new features
- Follow existing system patterns
- Document public APIs

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: GitHub Issues for bug reports
- **Documentation**: In-code comments and this README
- **Community**: Discord server for discussions

---

Built with ❤️ using Hyperscape, Three.js, and modern web technologies.