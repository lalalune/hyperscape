# AI Generation Examples

This directory contains example files and batch configurations for the AI asset generation system.

## Quick Start

Make sure you have your API keys configured:
```bash
cp ../env.example ../.env
# Edit .env and add your OPENAI_API_KEY and MESHY_API_KEY
```

## Example Commands

### Generate a Single Asset

```bash
# From the generation package directory
npm run generate "A magical fire sword with glowing runes" -- --type weapon --name "Flameblade"

# Using the CLI directly
npx hyperscape-generate generate "A stone golem warrior" --type character --style realistic
```

### Batch Generation

```bash
# Generate all weapons
npm run batch examples/batches/weapons.json

# Generate all armor
npm run batch examples/batches/armor.json

# Generate all characters  
npm run batch examples/batches/characters.json

# Generate complete RPG asset set (46 items)
npm run batch examples/batches/rpg-complete.json
```

### View Generated Assets

```bash
# Start the interactive viewer
npm run viewer

# With custom port
npm run viewer -- --port 8080
```

## Batch File Structure

Each batch file is a JSON array of asset definitions:

```json
[
  {
    "name": "Asset Name",
    "description": "Detailed description for AI generation",
    "type": "weapon|armor|character|building|tool|resource|consumable|misc",
    "subtype": "sword|helmet|biped|etc",
    "style": "realistic|cartoon|low-poly",
    "metadata": {
      // Game-specific metadata
      "level": 1,
      "rarity": "common",
      // ... additional fields
    }
  }
]
```

## Available Batch Files

- `weapons.json` - Basic weapons (sword, bow, shield)
- `armor.json` - Basic armor set (helmet, body, legs)
- `characters.json` - NPCs and enemies (goblin, bandit, knight)
- `rpg-complete.json` - Complete RPG asset set (46 items)

## Asset Types

| Type | Subtypes | Description |
|------|----------|-------------|
| weapon | sword, bow, shield, dagger, staff | Combat equipment |
| armor | helmet, body, legs, gloves, boots | Protective gear |
| character | biped, quadruped | NPCs and enemies |
| building | bank, store, tower, inn | Structures |
| tool | pickaxe, fishing_rod, axe | Gathering tools |
| resource | ore, wood, gem | Raw materials |
| consumable | potion, food, ammunition | Usable items |
| misc | currency, quest_item | Other items |

## Output Structure

Generated assets are saved to the `output/` directory:

```
output/
├── bronze-sword/
│   ├── image.png          # AI-generated concept art
│   ├── model.glb          # 3D model
│   ├── metadata.json      # Complete asset metadata
│   └── textures/          # PBR texture maps
└── ...
```

## Tips

1. **API Costs**: Each asset generation uses both DALL-E 3 and Meshy AI APIs. Monitor your usage.

2. **Parallel Generation**: Use `--parallel N` to control concurrent generations:
   ```bash
   npm run batch examples/batches/weapons.json -- --parallel 2
   ```

3. **Regenerate Stages**: If a stage fails, regenerate just that stage:
   ```bash
   npx hyperscape-generate regenerate <asset-id> <stage>
   ```

4. **Custom Styles**: Available styles are:
   - `realistic` - Photorealistic rendering
   - `cartoon` - Stylized cartoon look
   - `low-poly` - Simplified geometric style

5. **Metadata**: Include game-specific metadata for integration:
   - Combat stats (attack, defense, etc.)
   - Requirements (level, skills)
   - Item properties (stackable, tradeable)

## Integration with Hyperfy

Generated assets are ready for use in Hyperfy worlds:

1. GLB models are optimized for web delivery
2. Metadata includes attachment points and game stats
3. Textures are compressed and web-ready
4. Polycount limits are enforced per asset type

## Troubleshooting

- **API Key Errors**: Ensure your `.env` file has valid keys
- **Generation Failures**: Check `batch-summary-*.json` for details
- **Memory Issues**: Reduce parallel generation count
- **Network Timeouts**: Meshy AI processing can take 3-5 minutes per model 