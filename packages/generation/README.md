# AI Creation System for Hyperscape RPG

AI-powered 3D asset generation system that transforms text descriptions into game-ready 3D models using OpenAI DALL-E 3 and Meshy AI.

## Features

- 🎨 **Text-to-3D Pipeline**: Generate complete 3D assets from text descriptions
- 🤖 **AI-Powered**: Uses GPT-4, DALL-E 3, and Meshy AI
- 🎮 **Game-Ready**: Outputs optimized GLB models with metadata
- 🔄 **Batch Processing**: Generate multiple assets in parallel
- 📊 **Interactive Viewer**: Web-based 3D model viewer
- 🔧 **Extensible**: Plugin architecture for custom workflows

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure API Keys

```bash
cp env.example .env
# Edit .env and add your API keys:
# OPENAI_API_KEY=sk-...
# MESHY_API_KEY=...
```

### 3. Generate Assets

```bash
# Single asset
npm run generate "A bronze sword with leather grip" -- --type weapon

# Batch generation
npm run batch examples/batches/weapons.json

# View generated assets
npm run viewer
```

## CLI Commands

The package provides a unified CLI with the following commands:

### `generate <description>`
Generate a single asset from a text description.

```bash
npx hyperscape-generate generate "A magical fire sword" --type weapon --name "Flameblade"
```

Options:
- `-t, --type <type>` - Asset type (weapon, armor, character, etc.)
- `-s, --style <style>` - Visual style (realistic, cartoon, low-poly)
- `-n, --name <name>` - Asset name

### `batch <file>`
Generate multiple assets from a JSON batch file.

```bash
npx hyperscape-generate batch examples/batches/armor.json --parallel 3
```

Options:
- `--parallel <count>` - Number of parallel generations (default: 5)

### `viewer`
Start the interactive 3D viewer.

```bash
npx hyperscape-generate viewer --port 3000
```

### `config`
Display current configuration.

```bash
npx hyperscape-generate config
```

## NPM Scripts

```bash
npm run build        # Build TypeScript
npm run dev          # Watch mode
npm run test         # Run tests
npm run generate     # Generate single asset
npm run batch        # Batch generation
npm run viewer       # Start viewer
npm run lint         # Type checking
```

## Asset Types

| Type | Description | Polycount |
|------|-------------|-----------|
| weapon | Swords, bows, shields | 2,000-5,000 |
| armor | Helmets, chest, legs | 3,000-8,000 |
| character | NPCs, enemies | 8,000-15,000 |
| building | Structures | 10,000-30,000 |
| tool | Pickaxes, fishing rods | 1,500-3,000 |
| resource | Ores, logs, gems | 500-1,500 |
| consumable | Potions, food | 800-2,000 |
| misc | Currency, quest items | 1,000-3,000 |

## Generation Pipeline

1. **Text Analysis** - Parse description and extract features
2. **Image Generation** - Create concept art with DALL-E 3
3. **3D Generation** - Convert to 3D model with Meshy AI
4. **Optimization** - Remesh and optimize polycount
5. **Analysis** - Extract metadata and attachment points
6. **Export** - Save as GLB with textures

## Examples

See the `examples/` directory for:
- Batch file templates
- Sample asset descriptions
- Integration examples

## Output Structure

```
output/
├── <asset-name>/
│   ├── image.png         # Concept art
│   ├── model.glb         # 3D model
│   ├── metadata.json     # Asset metadata
│   └── textures/         # PBR textures
└── batch-summary.json    # Generation report
```

## Configuration

Create `ai-creation.config.json` for custom settings:

```json
{
  "openai": {
    "model": "dall-e-3",
    "size": "1024x1024",
    "quality": "standard"
  },
  "meshy": {
    "mode": "preview",
    "aiModel": "meshy-4"
  },
  "output": {
    "directory": "./output",
    "format": "glb"
  }
}
```

## API Requirements

- **OpenAI API**: For GPT-4 and DALL-E 3
- **Meshy AI API**: For 3D model generation

Both APIs are paid services. Monitor your usage to control costs.

## Troubleshooting

### API Key Issues
- Ensure `.env` file exists with valid keys
- Check key format (OpenAI keys start with `sk-`)

### Generation Failures
- Check `batch-summary-*.json` for error details
- Reduce parallel count for stability
- Verify API quotas haven't been exceeded

### Memory Issues
- Reduce `--parallel` count
- Process smaller batches
- Close other applications

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck
```

## License

MIT © Hyperscape Team