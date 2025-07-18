# RuneScape Item Generation Guide

## Overview

The `generate-all-runescape-items.ts` script is a complete pipeline for generating all RuneScape RPG items with:
- 3D models using Meshy AI with OSRS-specific prompts
- Realistic textures applied to models
- Optimized geometry remeshed to 2,000 triangles
- Intelligent caching to avoid regenerating existing items

## Current Items Ready for Generation

The system has found **14 items** across 3 configuration files:

### ⚔️ Weapons (2 items)
- **Bronze Sword** (ID: 1) - sword type
- **Iron Dagger** (ID: 1203) - dagger type

### 🛡️ Armor (2 items)
- **Leather Body** (ID: 3) - body slot
- **Goblin Mail** (ID: 288) - body slot

### 🍞 Food (1 item)
- **Bread** (ID: 2)

### 📦 Other Items (9 items)
- **Coins** (ID: 995)
- **Raw Beef** (ID: 2132)
- **Cooked Meat** (ID: 2142)
- **Lobster** (ID: 379)
- **Shark** (ID: 385)
- **Prayer Potion(4)** (ID: 2434)
- **Bones** (ID: 526)
- **Big Bones** (ID: 532)
- **Cowhide** (ID: 1739)

## Setup Instructions

### 1. Get a Meshy AI API Key

1. Sign up for a Meshy AI account at https://www.meshy.ai
2. Navigate to your dashboard/API settings
3. Copy your API key

### 2. Set the API Key

Option A - Environment Variable:
```bash
export MESHY_API_KEY="your-api-key-here"
```

Option B - Create .env file in project root:
```bash
cd ~/eliza
echo "MESHY_API_KEY=your-api-key-here" > .env
```

### 3. Run the Generation Script

```bash
cd packages/hyperfy/src/rpg/ai-creation
bun run generate-all-runescape-items.ts
```

## What the Script Does

### 1. Model Generation
- Uses `RuneScapePromptService` to create OSRS-specific prompts
- Generates authentic low-poly models matching RuneScape's visual style
- Applies proper tier-based materials (bronze, iron, leather, etc.)

### 2. Texture Application
- Applies PBR textures using Meshy's text-to-texture API
- Materials are tier-appropriate:
  - Bronze: Orange-brown patina, metallic surface
  - Iron: Gray steel, matte finish
  - Leather: Brown leather texture
  - etc.

### 3. Geometry Optimization
- Remeshes all models to exactly 2,000 triangles
- Maintains visual quality while ensuring optimal performance
- Preserves UV mapping for textures

### 4. Output Structure
```
./generation-output/runescape-items/
├── 1_Bronze_Sword.glb
├── 1203_Iron_Dagger.glb
├── 3_Leather_Body.glb
├── ... (all 14 items)
├── generation-cache.json
├── generation-report.json
└── generation-report.html
```

## Features

### Intelligent Caching
- Tracks generation progress in `generation-cache.json`
- Skips already generated items on subsequent runs
- Can resume after interruptions

### Comprehensive Reporting
- **JSON Report**: Detailed generation results and statistics
- **HTML Report**: Visual dashboard with:
  - Success/failure rates
  - Processing times
  - Error details
  - Item breakdown

### Error Handling
- Automatic retries for failed generations
- Detailed error logging
- Continues processing even if individual items fail

## Resource Requirements

- **Meshy AI Credits**: ~42 credits (3 per item × 14 items)
- **Processing Time**: ~2-3 minutes per item
- **Total Time**: ~30-45 minutes for all items
- **Disk Space**: ~5-10MB for all generated models

## Integration with Hyperfy

Once generated, the models are ready to be used in the Hyperfy RPG system:
- Compatible with the spawning system
- Include proper hardpoint data for weapons
- Optimized for real-time rendering
- Support all RPG mechanics (combat, inventory, etc.)

## Extending the System

To add more items:
1. Add item data to the JSON files in `../config/items/`
2. Run the generation script - it will only generate new items
3. The system automatically handles categorization and prompt generation

## Troubleshooting

### "MESHY_API_KEY not set"
- Ensure you've set the API key as shown in setup
- Check that .env file is in the project root (~/eliza)

### Generation Failures
- Check `generation-report.json` for specific errors
- Verify your Meshy API key has sufficient credits
- Some complex items may need manual prompt adjustments

### Type Errors
- The TypeScript errors in node_modules can be ignored
- The script will run correctly with `bun run` 