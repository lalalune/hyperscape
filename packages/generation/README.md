# AI Creation System

A complete AI-powered asset generation pipeline for Hyperscape RPG. Generate 3D models, detect hardpoints, place armor, rig characters, and analyze buildings - all from text descriptions.

## Features

- 🎨 **Image Generation** - Generate concept images using GPT-4 vision
- 🎯 **3D Model Creation** - Convert images to 3D models using Meshy AI
- 🔧 **Model Optimization** - Automatic remeshing for game-ready assets
- ⚔️ **Weapon Hardpoints** - Detect grip positions and attachment points
- 🛡️ **Armor Placement** - Automatic armor fitting and scaling
- 🏛️ **Building Analysis** - Entry points, NPC positions, functional areas
- 🦴 **Auto-Rigging** - Generate rigs for bipeds, quadrupeds, and more
- 💾 **Smart Caching** - Cache results at every stage
- 🖥️ **Interactive Viewer** - Web-based preview and management
- 📦 **Batch Processing** - Generate multiple assets efficiently

## Supported Asset Types

### Core Assets
- **Weapons**: swords, axes, bows, staffs, shields, daggers, maces, spears, crossbows, wands
- **Armor**: helmets, chest pieces, legs, boots, gloves, rings, amulets, capes
- **Buildings**: banks, stores, houses, castles, temples, guilds, inns, towers
- **Tools**: pickaxes, hatchets, fishing rods, hammers, knives, chisels
- **Consumables**: food, potions, runes, scrolls, teleport items
- **Resources**: ores, bars, logs, planks, fish, herbs, gems
- **Characters**: NPCs, monsters, bosses (biped, quadruped, flying creatures)
- **Misc**: coins, quest items, decorations

### Special Building Types

#### Banks 🏦
- Secure vault areas
- Teller counter positions
- Multiple NPC banker placements
- Grand entrance detection
- Interior space mapping

#### Stores 🏪
- Shop counter placement
- Display area detection
- Shopkeeper NPC position
- Storefront analysis
- Different store types (general, magic, armor, etc.)

## Installation

```bash
npm install @hyperscape/ai-creation
```

Or install globally for CLI access:

```bash
npm install -g @hyperscape/ai-creation
```

## Quick Start

### CLI Usage

Generate a single asset:
```bash
hyperscape-ai generate "a legendary fire sword with dragon motifs"
```

Generate a bank:
```bash
hyperscape-ai generate "Grand bank with marble columns" --type building --subtype bank
```

Generate a store:
```bash
hyperscape-ai generate "Cozy general store" --type building --subtype store
```

Generate with specific options:
```bash
hyperscape-ai generate "heavy plate armor" --type armor --style realistic --name "Dragon Plate"
```

Batch generation:
```bash
hyperscape-ai batch items.json
```

Start the interactive viewer:
```bash
hyperscape-ai viewer --port 3000
```

### Programmatic Usage

```typescript
import { AICreationService, GenerationRequest } from '@hyperscape/ai-creation'

// Initialize service
const service = new AICreationService({
  openai: { apiKey: 'your-openai-key' },
  meshy: { apiKey: 'your-meshy-key' },
  cache: { enabled: true, ttl: 3600, maxSize: 500 },
  output: { directory: './output', format: 'glb' }
})

// Generate a weapon
const weapon: GenerationRequest = {
  id: 'sword-001',
  name: 'Flamebrand',
  description: 'A legendary fire sword with dragon motifs',
  type: 'weapon',
  subtype: 'sword',
  style: 'realistic'
}

// Generate a bank
const bank: GenerationRequest = {
  id: 'bank-001',
  name: 'Grand Bank of Varrock',
  description: 'Impressive bank with columns and vault',
  type: 'building',
  subtype: 'bank',
  style: 'realistic'
}

// Listen to progress events
service.on('stage-start', ({ stage }) => {
  console.log(`Starting ${stage}...`)
})

service.on('stage-complete', ({ stage }) => {
  console.log(`Completed ${stage}!`)
})

// Generate!
const result = await service.generate(weapon)
console.log('Generated:', result.finalAsset?.modelUrl)
```

## Configuration

Create an `ai-creation.config.json` file:

```json
{
  "openai": {
    "apiKey": "sk-...",
    "model": "dall-e-3"
  },
  "meshy": {
    "apiKey": "your-meshy-key",
    "baseUrl": "https://api.meshy.ai"
  },
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "maxSize": 500
  },
  "output": {
    "directory": "./generated-assets",
    "format": "glb"
  }
}
```

Or use environment variables:
- `OPENAI_API_KEY`
- `MESHY_API_KEY`

## Generation Pipeline

1. **Description → Image**: Generate concept art from text description
2. **Image → 3D Model**: Create 3D model using Meshy AI
3. **Model Remeshing**: Optimize polycount for game use
4. **Analysis**:
   - Weapons: Detect grip points and attachment positions
   - Armor: Determine placement and scaling
   - Buildings: Analyze structure, entry points, NPC positions
   - Characters: Generate rig skeleton
5. **Finalization**: Save model with metadata

## Building-Specific Features

### Bank Generation
Banks are generated with:
- Main entrance detection
- Vault area identification
- Teller counter placement
- Multiple banker NPC positions
- Secure architecture elements

### Store Generation
Stores are generated with:
- Storefront and display windows
- Shop counter placement
- Display area mapping
- Shopkeeper position
- Interior layout optimization

## Batch Generation

Create a JSON file with multiple items:

```json
[
  {
    "name": "Fire Sword",
    "description": "A flaming sword with intricate runes",
    "type": "weapon",
    "style": "realistic"
  },
  {
    "name": "Bank of Lumbridge",
    "description": "Small town bank with vault",
    "type": "building",
    "subtype": "bank"
  },
  {
    "name": "General Store",
    "description": "Shop selling everyday items",
    "type": "building",
    "subtype": "store"
  }
]
```

Run batch generation:
```bash
hyperscape-ai batch items.json
```

## API Reference

### `AICreationService`

Main service class for asset generation.

#### Methods

- `generate(request: GenerationRequest): Promise<GenerationResult>` - Generate a single asset
- `batchGenerate(requests: GenerationRequest[]): Promise<GenerationResult[]>` - Generate multiple assets
- `regenerateStage(id: string, stage: string): Promise<GenerationResult>` - Regenerate from specific stage
- `getGeneration(id: string): Promise<GenerationResult>` - Get existing generation
- `getActiveGenerations(): GenerationResult[]` - Get currently processing items

#### Events

- `stage-start` - Emitted when a stage begins
- `stage-complete` - Emitted when a stage completes
- `complete` - Emitted when generation finishes
- `error` - Emitted on errors

### Types

```typescript
interface GenerationRequest {
  id?: string
  name: string
  description: string
  type: AssetType
  subtype?: WeaponType | ArmorSlot | BuildingType | ToolType | ResourceType | ConsumableType
  style?: 'realistic' | 'cartoon' | 'low-poly' | 'stylized'
  metadata?: Record<string, any>
}

type AssetType = 'weapon' | 'armor' | 'consumable' | 'tool' | 'decoration' | 
                 'character' | 'building' | 'resource' | 'misc'

type BuildingType = 'bank' | 'store' | 'house' | 'castle' | 'temple' | 
                    'guild' | 'inn' | 'tower' | 'dungeon'
```

## Interactive Viewer

The viewer provides a web interface for:
- Real-time generation progress
- 3D model preview
- Stage output inspection
- Regeneration controls
- Building structure visualization

Start the viewer:
```bash
hyperscape-ai viewer
```

Then visit http://localhost:3000

## Performance Tips

1. **Batch Processing**: Process multiple items together for efficiency
2. **Caching**: Enable caching to avoid regenerating identical items
3. **Polycount**: Optimized defaults per asset type
4. **Parallel Generation**: Configure concurrent generation limits

## Troubleshooting

### API Key Issues
- Ensure API keys are set in config or environment
- Check key permissions and quotas

### Generation Failures
- Check stage-specific errors in the result
- Use `regenerateStage` to retry failed stages
- Enable verbose logging for debugging

### Memory Issues
- Reduce cache size in config
- Process smaller batches
- Lower target polycounts

## License

MIT 