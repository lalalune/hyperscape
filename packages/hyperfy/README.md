# Hyperfy RPG Engine

A comprehensive RPG system built on the Hyperfy 3D multiplayer game engine, featuring RuneScape-inspired mechanics with AI-generated content.

## Overview

The Hyperfy RPG is a persistent multiplayer RPG featuring:
- Real-time combat with melee and ranged weapons
- Skill-based progression system (9 skills)
- Resource gathering and crafting
- Banking and trading systems
- Mob spawning and AI entities
- Comprehensive UI with inventory, equipment, and banking interfaces
- AI agent compatibility through ElizaOS integration

## Quick Start

### Prerequisites

- Node.js 18+ or Bun 1.0+
- 4GB+ RAM (for SQLite database and 3D rendering)
- Modern browser with WebGL support

### Installation

```bash
# Clone the repository
git clone https://github.com/hyperscape/hyperscape
cd hyperscape/packages/hyperfy

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Start the development server
bun run dev
```

The server will start on `http://localhost:3333`

### First Time Setup

1. Open your browser to `http://localhost:3333`
2. Create a character - you'll spawn in a random starter town
3. Use WASD to move, click to interact with objects
4. Right-click to open context menus for advanced actions

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

- **Health/Stamina bars** - Top left of screen
- **Inventory** - 28 slots, drag-and-drop items
- **Equipment panel** - Worn items and stats
- **Skills interface** - Level progression and XP
- **Banking interface** - Store/retrieve items
- **Store interface** - Purchase tools and supplies

### Controls

- **Movement**: WASD keys or click-to-move
- **Camera**: Mouse look
- **Interact**: Left-click on objects/NPCs
- **Context menu**: Right-click for advanced actions
- **Inventory**: I key to toggle
- **Equipment**: E key to toggle
- **Skills**: S key to toggle

## Development

### Architecture

The RPG is built using Hyperfy's Entity Component System:

- **Systems**: Handle game logic (combat, inventory, etc.)
- **Entities**: Players, mobs, items, world objects
- **Components**: Data containers attached to entities
- **Actions**: Player-initiated activities (attack, gather, etc.)

### Key Systems

- **RPGPlayerSystem**: Player state management
- **RPGCombatSystem**: Battle mechanics and damage
- **RPGInventorySystem**: Item management
- **RPGXPSystem**: Skill progression
- **RPGMobSystem**: Monster AI and spawning
- **RPGBankingSystem**: Storage and transactions
- **RPGStoreSystem**: Shop functionality
- **RPGResourceSystem**: Gathering mechanics

### File Structure

```
packages/hyperfy/src/
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

The Hyperfy RPG includes a comprehensive unified test suite that validates all game systems through real browser automation and visual verification.

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
bun run test:legacy:hyperfy       # Framework validation tests
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

3. **⚡ Hyperfy Framework Tests** - Engine and framework validation
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

The RPG supports AI agents through the `plugin-hyperfy` ElizaOS plugin:

```bash
# Start ElizaOS with Hyperfy plugin
cd packages/plugin-hyperfy
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
- Ensure port 3333 is available

**Client connection fails**
- Verify WebSocket connection (check browser dev tools)
- Confirm server is running on correct port
- Check firewall settings

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
DEBUG=hyperfy:* bun run dev

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

Built with ❤️ using Hyperfy, Three.js, and modern web technologies.