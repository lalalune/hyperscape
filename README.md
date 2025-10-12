# Hyperscape - AI-Generated RuneScape-Style RPG

A complete RuneScape-inspired MMORPG where everything is AI-generated: items, mobs, lore, and world content. Based on a heavily modified version of [Hyperfy] (https://hyperfy.xyz/), a real-time 3D metaverse engine, with full multiplayer support and AI agent integration.

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

This is a **real monorepo** with 5 packages:

```
hyperscape/
├── packages/hyperscape/          # 3D World Engine
│   ├── Core Hyperscape engine with physics, networking, scripting
│   ├── Entity Component System for game objects
│   └── Real-time multiplayer with WebSocket + LiveKit
├── packages/rpg/              # RuneScape-Style RPG
│   ├── Complete RPG system built as Hyperscape apps
│   ├── Player.hyp - Player character with stats/inventory
│   ├── RPGGoblin.hyp - AI-driven mobs with combat/loot
│   └── world/ - Configured world with terrain and entities
├── packages/generation/       # AI Content Creation  
│   ├── GPT-4 for lore, descriptions, game content
│   ├── MeshyAI for 3D model generation and texturing
│   └── Automated asset pipeline for items/creatures
├── packages/test-framework/   # Visual Testing System
│   ├── Playwright browser automation for gameplay tests
│   ├── Screenshot analysis and pixel detection
│   └── No mocks - tests real game instances
└── packages/plugin-hyperscape/   # AI Agent Integration
    ├── ElizaOS plugin for AI agents to join game
    ├── All player actions available to AI
    └── Agents can fight, gather, level, interact
```

### Technology Stack

- **[Hyperscape](https://hyperscape.io/)** - Real-time 3D metaverse engine (Three.js + PhysX)
- **[ElizaOS](https://elizaos.ai/)** - AI agent framework for autonomous players
- **TypeScript** - Type-safe development across all packages
- **Three.js** - 3D graphics and rendering
- **PhysX** - Physics simulation and collision detection  
- **LiveKit** - Voice chat and WebRTC networking
- **Playwright** - Browser automation for comprehensive testing
- **SQLite** - Persistent database for player data and world state

## 🧪 **Testing**

### Run All Tests
```bash
npm test
```

This project uses **real gameplay testing** - no mocks, no simulations:

- **Visual Testing**: Screenshots verify entities render correctly
- **Browser Automation**: Playwright controls real game instances  
- **Pixel Analysis**: Color detection confirms object positions
- **System Integration**: Tests real combat, skills, inventory, banking
- **Multi-modal Verification**: Data queries + visual confirmation

### Test Coverage
- ✅ Player spawning and character initialization
- ✅ Combat system (melee and ranged with arrows)
- ✅ Skill progression and XP calculations
- ✅ Inventory management and item pickup
- ✅ Equipment system and stat bonuses
- ✅ Resource gathering (woodcutting, fishing)
- ✅ Banking and storage systems
- ✅ Mob AI, aggression, and loot drops
- ✅ Death, respawning, and item retrieval
- ✅ Multiplayer synchronization

## 🤖 **AI Agent Integration**

**Both humans and AI agents can play together** in the same world:

### For Human Players
- Use web browser at `http://localhost:5555`
- Standard WASD movement and mouse interaction
- Full UI with inventory, equipment, skills display

### For AI Agents  
- Connect via ElizaOS with the Hyperscape plugin
- Same WebSocket connection as human players
- All player actions available: combat, gathering, trading, movement
- Agents can see world state and make autonomous decisions

### Available Agent Actions
- **Combat**: Attack mobs, use weapons, manage health
- **Skills**: Woodcutting, fishing, cooking, firemaking 
- **Navigation**: Move to positions, follow entities
- **Inventory**: Pick up items, manage equipment, bank storage
- **Social**: Chat with other players, interact with NPCs

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
# - Client: http://localhost:3333 (Vite with HMR)
# - Server: ws://localhost:5555/ws (Auto-rebuilds on TS changes)
# - File watcher for automatic server restarts

# The dev server will:
# ✅ Automatically rebuild when you change TypeScript files
# ✅ Restart the server after each rebuild
# ✅ Hot-reload client changes instantly via Vite
# ✅ Show colored logs for easy debugging
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

## 📝 **License**

MIT License - Feel free to use this project as inspiration for your own AI-powered games.

---

**🎮 Ready to explore the AI-generated world of Hyperscape?** 

**Run `npm start` and open `http://localhost:5555` to begin your adventure!**

*Fight goblins, master skills, discover an AI-crafted world, and play alongside autonomous AI agents in this unique take on classic RuneScape gameplay.*