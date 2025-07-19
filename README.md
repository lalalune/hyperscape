# Hyperscape - AI-Generated RPG

A RuneScape-inspired MMORPG where everything is AI-generated: items, mobs, lore, and world content. Built on [Hyperfy](https://hyperfy.io/), the 3D metaverse engine.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 10+

### Installation

```bash
# Clone and install
git clone [repository-url]
cd hyperscape
npm install
```

### Build Everything

```bash
npm run build
```

### Start the RPG

```bash
npm start
```

The RPG server will start at `http://localhost:3000`

## 🎮 How to Play

1. **Open your browser** to `http://localhost:3000`
2. **Create a character** - you'll spawn in a random starter town
3. **Explore the world** - use WASD keys to move, click to interact
4. **Fight monsters** - attack goblins and other creatures for XP and loot
5. **Level up skills** - gain experience in Attack, Strength, Defense, Constitution
6. **Gather resources** - chop trees, fish at lakes, cook food
7. **Bank your items** - visit banks in starter towns to store valuables
8. **Progress to stronger areas** - as you level up, venture into more dangerous zones

### Game Features

- **Real-time combat** with RuneScape-style mechanics
- **Multiple skills**: Combat, Woodcutting, Fishing, Cooking, Firemaking
- **Equipment tiers**: Bronze → Steel → Mithril
- **Multiplayer** - see other players in the same world
- **Persistent progression** - your character data is saved
- **AI agents** can also play alongside humans

## 🧪 Testing

### Run All Tests

```bash
npm test
```

This runs comprehensive tests across all packages:

- **Visual testing** - Screenshots and pixel analysis to verify entities appear correctly
- **RPG system testing** - Combat, skills, inventory, banking systems
- **Integration testing** - Real gameplay scenarios in browser
- **No mocks** - All tests use real Hyperfy instances and actual game code

### Test Reports

Tests generate detailed reports showing:
- Entity detection and positioning
- RPG system validation (health, skills, inventory)
- Visual confirmation via screenshots
- Performance metrics

## 🏗️ Development

### Core Commands

```bash
npm run dev     # Start development mode (hot reload)
npm run build   # Build all packages
npm start       # Start the RPG game
npm test        # Run all tests
npm run lint    # Lint all code
```

### Architecture

- **Hyperfy Engine** (`packages/hyperfy`) - 3D world engine with physics, networking, scripting
- **RPG Game** (`packages/rpg`) - RuneScape-inspired game logic and content
- **AI Generation** (`packages/generation`) - Procedural content creation with GPT-4 and MeshyAI
- **Test Framework** (`packages/test-framework`) - Visual and integration testing tools
- **ElizaOS Plugin** (`packages/plugin-hyperfy`) - AI agent integration

### Key Directories

```
hyperscape/
├── packages/
│   ├── hyperfy/           # Core 3D engine
│   │   ├── src/           # Engine source code
│   │   └── world/         # Game world and RPG entities
│   ├── rpg/               # RPG game package
│   ├── generation/        # AI content generation
│   ├── test-framework/    # Testing infrastructure
│   └── plugin-hyperfy/    # ElizaOS integration
└── README.md              # This file
```

## 🤖 AI Agent Integration

Human players and AI agents can play together in the same world:

1. **Start an ElizaOS agent** with the Hyperfy plugin
2. **Agent connects** to the same world server
3. **Agent plays the game** using the same mechanics as humans
4. **Agents can**: fight mobs, gather resources, level skills, interact with other players

## 🧑‍💻 Technical Details

### Built With

- **[Hyperfy](https://hyperfy.io/)** - 3D metaverse engine (Three.js + physics)
- **[ElizaOS](https://elizaos.ai/)** - AI agent framework
- **TypeScript** - Type-safe development
- **Playwright** - Browser automation and testing
- **Sharp** - Image processing for visual tests

### Game Design

Based on classic RuneScape mechanics:
- **Click-to-move** navigation
- **Auto-combat** when in range
- **Skill-based progression** (no character levels)
- **Equipment requirements** based on skill levels
- **Resource gathering** and processing
- **Banking system** for item storage

### Testing Philosophy

- **No mocks or simulations** - all tests use real game instances
- **Visual verification** - screenshots prove entities render correctly  
- **Multi-modal testing** - browser automation, image analysis, data validation
- **Comprehensive coverage** - every GDD feature has corresponding tests

## 📖 Game Design Document

See the full [Game Design Document](CLAUDE.md) for detailed mechanics, items, mobs, and world design.

## 🐛 Troubleshooting

### Common Issues

**Port already in use**: Kill existing processes on port 3000/3001
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

**Tests failing**: Ensure no other Hyperfy instances are running
```bash
pkill -f "hyperfy"
npm test
```

**Build errors**: Clean and rebuild
```bash
rm -rf packages/*/build packages/*/dist
npm run build
```

## 📝 License

MIT License - see LICENSE file for details.

---

**Ready to explore the AI-generated world of Hyperscape?** Run `npm start` and dive in! 🎮