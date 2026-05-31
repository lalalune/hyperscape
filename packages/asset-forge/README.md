# 3D Asset Forge

A React/Vite application for reviewing, generating, rigging, fitting, and
organizing game-ready 3D assets for Hyperscape.

The current asset strategy is documented in
[`../../docs/asset-pipeline.md`](../../docs/asset-pipeline.md). Asset Forge is
the review and orchestration shell for generated assets, and Hyperscape imports
deployable packs through `scripts/import-hill-manifest.mjs`. VRM Viewer can
preview or catalog exported packs, but Asset Forge should not depend on VRM
Viewer for normal hosted previews, default avatars, or production routing.

## Features

### 🎨 **AI-Powered Asset Generation**
- Generate 3D models from text descriptions using pluggable provider pipelines
- Preferred local provider path: Nemotron prompt optimization, Flux Klein image generation, Trellis2 mesh generation, repair, Draco compression, LODs, and optional sprites or impostors
- Legacy cloud provider path: OpenAI/Vercel AI Gateway image and prompt services with Meshy/Tripo model generation
- Support for various asset types: weapons, armor, characters, items
- Material variant generation (bronze, steel, mithril, etc.)
- Batch generation capabilities

### 🎮 **3D Asset Management**
- Interactive 3D viewer with Three.js
- Asset library with categorization and filtering
- Metadata management and asset organization, including descriptions, keywords, tags, visibility, and licensing
- GLB/GLTF format support

### 🤖 **Advanced Rigging & Fitting**
- **Armor Fitting System**: Automatically fit armor pieces to character models
- **Hand Rigging**: AI-powered hand pose detection and weapon rigging
- Weight transfer and mesh deformation
- Bone mapping and skeleton alignment

### 🔧 **Processing Tools**
- Sprite generation from 3D models
- Vertex color extraction
- T-pose extraction from animated models
- Asset normalization and optimization

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **3D Graphics**: Three.js, React Three Fiber, Drei
- **State Management**: Zustand, Immer
- **AI Integration**: Local DGX provider adapter target, OpenAI API, Vercel AI Gateway, Meshy.ai API, Tripo API
- **ML/Computer Vision**: TensorFlow.js, MediaPipe (hand detection)
- **Backend**: Elysia, Bun
- **Styling**: Tailwind CSS
- **Build Tool**: Bun [[memory:4609218]]

## Getting Started

### Prerequisites
- Node.js 18+ or Bun runtime
- For local generation: access to the Hill/DGX provider service
- For legacy cloud generation: API keys for OpenAI, Meshy.ai, or Tripo

### Installation

1. Clone the repository
```bash
git clone [repository-url]
cd packages/asset-forge
```

2. Install dependencies using Bun [[memory:4609218]]
```bash
bun install
```

3. Create a `.env` file from the example
```bash
cp .env.example .env
```

4. Add provider configuration to `.env`
```
# Optional local provider: Asset Forge calls a Hill/DGX bridge.
ASSET_FORGE_GENERATION_PROVIDER=hill_dgx
HILL_API_BASE_URL=https://hill.example.internal
HILL_GENERATION_MODE=create
HILL_EXPORT_TARGET=library
NEMOTRON_BASE_URL=http://monumentals-mac-studio.local:12345
NEMOTRON_MODEL=mlx-community/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-mxfp4

# Legacy cloud provider keys:
OPENAI_API_KEY=your-openai-api-key
MESHY_API_KEY=your-meshy-api-key
# Optional:
TRIPO_API_KEY=your-tripo-api-key
AI_GATEWAY_API_KEY=your-vercel-ai-gateway-key

# Optional Pixel3D Gradio provider:
# GENERATION_3D_PROVIDER=pixel3d-gradio
# PIXEL3D_GRADIO_BASE_URL=http://127.0.0.1:7860
# PIXEL3D_GRADIO_API_NAME=/generate_3d
# PIXEL3D_RESOLUTION=1024
```

### Running the Application

Start both frontend and backend services:
```bash
# Start the React app and Elysia API together
bun run dev

# Or run separately:
bun run dev:frontend  # Terminal 1: Frontend only, default port 3400
bun run dev:backend   # Terminal 2: API only, default port 3401
```

The app will be available at `http://localhost:3400`, with the API on `http://localhost:3401`.

### Coolify + Generation Providers

For the deployed Asset Forge, keep the browser API same-origin and configure
only the generation provider you actually use:

```bash
VITE_GENERATION_API_URL=/api
```

When using a Hill/DGX bridge, set `ASSET_FORGE_GENERATION_PROVIDER=hill_dgx`
and point `HILL_API_BASE_URL` at that bridge, not at VRM Viewer unless VRM
Viewer is intentionally hosting those Hill endpoints. The bridge must expose
`/api/hill/conjure-jobs` and `/api/hill/file`, and the container must either
mount the same asset paths or proxy file requests back to the DGX.

### Pixel3D Gradio Provider

Pixel3D can be used as the image-to-3D stage behind the existing Asset Forge
pipeline endpoint:

```bash
GENERATION_3D_PROVIDER=pixel3d-gradio
PIXEL3D_GRADIO_BASE_URL=http://127.0.0.1:7860
PIXEL3D_GRADIO_API_NAME=/generate_3d
PIXEL3D_RESOLUTION=1024
```

The built-in adapter defaults to the Pixel3D `/generate_3d` signature. For a
custom Gradio app, `PIXEL3D_GRADIO_INPUTS` can override the ordered inputs sent
to the API. A single request can also select this provider with
`metadata.provider: "pixel3d-gradio"`.

The Hyperscape-owned deployment wrapper for the upstream Pixal3D Gradio service
lives in [`../pixal3d-service`](../pixal3d-service). It tracks Docker/Coolify
orchestration and API checks only; model weights, caches, temporary files, and
generated GLBs stay out of git.
### Hosted Preview Rendering

Browser-facing Asset Forge routes must be WebGL-safe. Shared procgen systems can
still use WebGPU/TSL in Hyperscape or offline tools, but hosted editor pages
such as vegetation, plants, rocks, grass, flowers, terrain, retargeting, and
armor preview should initialize a WebGL preview renderer and convert generated
node materials to `MeshStandardMaterial`/`MeshBasicMaterial` before rendering.
This keeps Coolify deployments usable on browsers where WebGPU is disabled,
unavailable, or blocked by GPU policy.

## Project Structure

```
asset-forge/
├── src/                    # React application source
│   ├── components/         # UI components
│   ├── services/          # Core services (AI, fitting, rigging)
│   ├── pages/             # Main application pages
│   ├── hooks/             # Custom React hooks
│   └── store/             # Zustand state management
├── server/                # Elysia/Bun backend
│   ├── api-elysia.ts     # API endpoints
│   └── services/         # Backend services
├── gdd-assets/           # Generated 3D assets [[memory:3843922]]
│   └── [asset-name]/     # Individual asset folders
│       ├── *.glb         # 3D model files
│       ├── concept-art.png
│       └── metadata.json
└── scripts/              # Utility scripts
```

## Main Features

### 1. Asset Generation (`/generation`)
- Text-to-3D model pipeline
- Prompt enhancement with local Nemotron or legacy cloud models
- Concept art generation
- 3D model creation via local Trellis2 or legacy Meshy/Tripo providers
- Material variant generation

### Unified Manifest Import

Hill-generated packs should produce a `unified_manifest.json` that preserves the
creator-facing metadata needed by VRM Viewer and the runtime metadata needed by
Hyperscape. Import a pack from the Hyperscape repo root:

```bash
bun scripts/import-hill-manifest.mjs \
  --manifest /path/to/hill/output/unified_manifest.json \
  --assets-root packages/server/world/assets \
  --biomes plains,forest
```

Use `--dry-run` first to verify copied GLBs, thumbnails, vegetation patches, and
biome updates before writing files.

### 2. Asset Library (`/assets`)
- Browse and manage generated assets
- Filter by type, tier, and category
- 3D preview with rotation controls
- Export and download assets

### 3. Equipment System (`/equipment`)
- Manage weapon and armor sets
- Preview equipment combinations
- Configure equipment properties

### 4. Armor Fitting (`/armor-fitting`)
- Upload character models
- Automatically fit armor pieces
- Adjust positioning and scaling
- Export fitted models

### 5. Hand Rigging (`/hand-rigging`)
- Upload weapon models
- AI-powered hand pose detection
- Automatic grip point calculation
- Export rigged weapons

## API Endpoints

- `GET /api/assets` - List all assets
- `GET /api/assets/:id/model` - Download asset model
- `POST /api/generation/start` - Start new generation
- `POST /api/retexture/start` - Generate material variants
- `POST /api/fitting/preview` - Preview armor fitting
- `POST /api/hand-rigging/process` - Process hand rigging

## Scripts

- `bun run dev` - Start frontend and backend development servers
- `bun run dev:frontend` - Start frontend development server
- `bun run dev:backend` - Start backend services only
- `bun run build` - Build for production
- `bun run start` - Start production backend services
- `bun run assets:audit` - Audit asset library
- `bun run assets:normalize` - Normalize 3D models
- `bun run assets:extract-tpose` - Extract T-poses from models

## Configuration

The system uses JSON-based configuration for:
- Material presets (`public/material-presets.json`)
- Asset metadata (stored with each asset) [[memory:3843922]]
- Generation prompts and styles

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built for the Hyperscape RPG project
- Designed to support local DGX generation through Hill, with legacy cloud providers available where configured
- Uses Three.js for 3D visualization
