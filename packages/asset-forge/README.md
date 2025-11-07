# 3D Asset Forge

A comprehensive React/Vite application for AI-powered 3D asset generation, rigging, and fitting. Built for the Hyperscape RPG, this system combines OpenAI's GPT-4 and DALL-E with Meshy.ai to create game-ready 3D models from text descriptions.

## Features

### 🎨 **AI-Powered Asset Generation**
- Generate 3D models from text descriptions using GPT-4 and Meshy.ai
- Automatic concept art creation with DALL-E
- Support for various asset types: weapons, armor, characters, items
- Material variant generation (bronze, steel, mithril, etc.)
- Batch generation capabilities

### 🎮 **3D Asset Management**
- Interactive 3D viewer with Three.js
- Asset library with categorization and filtering
- Metadata management and asset organization
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

- **Frontend**: React 18, TypeScript, Vite
- **3D Graphics**: Three.js, React Three Fiber, Drei
- **State Management**: Zustand, Immer
- **AI Integration**: OpenAI API, Meshy.ai API
- **ML/Computer Vision**: TensorFlow.js, MediaPipe (hand detection)
- **Backend**: Elysia (Bun-native framework)
- **API Client**: Eden Treaty (type-safe API client with end-to-end type safety)
- **Styling**: Tailwind CSS
- **Build Tool**: Bun [[memory:4609218]]

## Getting Started

### Prerequisites
- Node.js 18+ or Bun runtime
- API keys for OpenAI and Meshy.ai

### Installation

1. Clone the repository
```bash
git clone [repository-url]
cd packages/generation
```

2. Install dependencies using Bun [[memory:4609218]]
```bash
bun install
```

3. Create a `.env` file from the example
```bash
cp env.example .env
```

4. Add your API keys to `.env`
```
VITE_OPENAI_API_KEY=your-openai-api-key
VITE_MESHY_API_KEY=your-meshy-api-key
```

### Running the Application

Start both frontend and backend services:
```bash
# Terminal 1: Start the React app
bun run dev:all

# Or run separately:
bun run dev           # Terminal 1: Frontend only
bun run dev:backend   # Terminal 2: Backend services
```

The app will be available at `http://localhost:3003`

## Authentication

Asset Forge uses **Privy** for authentication, providing secure user management with Web3 wallet integration. Authentication is shared with the Hyperscape game client for seamless access across the ecosystem.

### Setup

1. **Get Privy Credentials**: Sign up at [dashboard.privy.io](https://dashboard.privy.io/) and create an app
2. **Configure Environment**: Add your Privy credentials to `.env`:
   ```env
   # Backend (Server-Side)
   PRIVY_APP_ID=your_privy_app_id
   PRIVY_APP_SECRET=your_privy_app_secret

   # Database (Required for user management)
   DATABASE_URL=postgresql://user:password@localhost:5432/asset_forge
   ```

3. **Configure Client**: If using the frontend separately, add to your client `.env`:
   ```env
   PUBLIC_PRIVY_APP_ID=your_privy_app_id  # Same as backend
   ```

### How It Works

1. **Automatic Authentication**: The API client (`src/lib/api-client.ts`) automatically includes JWT tokens from Privy in all requests
2. **User Creation**: First-time users are automatically created in PostgreSQL via Drizzle ORM
3. **Ownership Tracking**: Assets are linked to users for permission management
4. **Optional Auth**: Public endpoints work without authentication; authenticated users get ownership tracking

### Database Schema

Asset Forge uses Drizzle ORM with PostgreSQL for:
- User profiles and authentication
- Asset ownership and permissions
- Project organization
- Activity logging and audit trails

Run migrations:
```bash
bun run db:migrate
```

### API Client Usage

The Eden Treaty client automatically includes authentication:

```typescript
import { api } from '@/lib/api-client'

// Public endpoint (no auth required)
const { data: health } = await api.api.health.get()

// Authenticated endpoint (automatic JWT inclusion)
const { data } = await api.api.assets({ id: 'sword-001' }).delete({
  query: { includeVariants: 'true' }
})
// ✅ Only succeeds if user owns the asset or is an admin
```

### Admin Access

Admins can be managed via the database `admin_whitelist` table or through admin routes. Admin users can:
- Delete any asset
- Update any asset metadata
- View system statistics
- Manage users

## Project Structure

```
asset-forge/
├── src/                    # React application source
│   ├── components/         # UI components
│   ├── services/          # Core services (AI, fitting, rigging)
│   ├── pages/             # Main application pages
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities and API client
│   │   └── api-client.ts  # Type-safe Eden Treaty client
│   └── store/             # Zustand state management
├── server/                # Elysia backend
│   ├── api-elysia.ts     # Elysia API server (type-safe)
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
- Prompt enhancement with GPT-4
- Concept art generation
- 3D model creation via Meshy.ai
- Material variant generation

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

## Type-Safe API Client

This project includes a fully type-safe API client using Elysia's Eden Treaty. The client provides end-to-end type safety with automatic TypeScript autocomplete, compile-time type checking, and zero manual type definitions.

### Benefits over fetch()

1. **Automatic Type Inference**: Request and response types are automatically inferred from the Elysia server
2. **Compile-Time Safety**: Catch typos, missing parameters, and type mismatches before runtime
3. **Full Autocomplete**: Your IDE suggests all available routes, methods, and parameters
4. **No Manual Types**: Types are generated from your server code automatically
5. **Better Performance**: Ultra-fast Bun runtime with Elysia (2.4M req/s)

### Usage

Import the client from `src/lib/api-client.ts`:

```typescript
import { api } from '@/lib/api-client'

// Health check - fully typed response
const { data, error } = await api.api.health.get()
if (data) {
  console.log('Status:', data.status)
  console.log('Services:', data.services.meshy, data.services.openai)
}

// List all assets
const { data: assets } = await api.api.assets.get()

// Get single asset model
const { data: model } = await api.api.assets({ id: 'sword-001' }).model.get()

// Delete an asset with query parameters
const { data } = await api.api.assets({ id: 'sword-001' }).delete({
  query: { includeVariants: 'true' }
})

// Update asset metadata
const { data: updated } = await api.api.assets({ id: 'sword-001' }).patch({
  name: 'Updated Sword',
  tier: 3
})

// Start retexture job
const { data: result } = await api.api.retexture.post({
  baseAssetId: 'sword-001',
  materialPreset: 'steel',
  outputName: 'steel-sword'
})

// Start generation pipeline
const { data: pipeline } = await api.api.generation.pipeline.post({
  name: 'Iron Sword',
  type: 'weapon',
  subtype: 'sword',
  tier: 1
})

// Check pipeline status
const { data: status } = await api.api.generation
  .pipeline({ pipelineId: '123' })
  .get()

// Weapon handle detection with GPT-4 Vision
const { data: gripData } = await api.api['weapon-handle-detect'].post({
  image: 'data:image/png;base64,...',
  angle: 'side',
  promptHint: 'medieval sword'
})

// Save sprites for an asset
const { data: result } = await api.api.assets({ id: 'sword-001' })
  .sprites.post({
    sprites: [
      { angle: 0, imageData: 'data:image/png;base64,...' },
      { angle: 45, imageData: 'data:image/png;base64,...' }
    ],
    config: { resolution: 512, angles: 8 }
  })
```

### Configuration

The API client automatically detects the API server URL from environment variables:

```env
VITE_API_PORT=3004
VITE_API_URL=http://localhost:3004  # Optional, defaults to localhost
```

## API Endpoints

### Assets
- `GET /api/assets` - List all assets
- `GET /api/assets/:id/model` - Download asset model
- `GET /api/assets/:id/*` - Get any file from asset directory
- `HEAD /api/assets/:id/model` - Check if model exists
- `DELETE /api/assets/:id` - Delete asset (with optional variants)
- `PATCH /api/assets/:id` - Update asset metadata
- `POST /api/assets/:id/sprites` - Save sprite images for asset
- `POST /api/assets/upload-vrm` - Upload VRM character file

### Generation
- `POST /api/generation/pipeline` - Start new generation pipeline
- `GET /api/generation/pipeline/:pipelineId` - Get pipeline status

### Retexturing
- `POST /api/retexture` - Generate material variants
- `POST /api/regenerate-base/:baseAssetId` - Regenerate base model

### Material Presets
- `GET /api/material-presets` - Get all material presets
- `POST /api/material-presets` - Save material presets

### AI Vision
- `POST /api/weapon-handle-detect` - Detect weapon grip location with GPT-4 Vision
- `POST /api/weapon-orientation-detect` - Detect if weapon is upside down

### Health
- `GET /api/health` - Health check and service status

## Scripts

- `bun run dev` - Start frontend development server
- `bun run dev:all` - Start both frontend and backend development servers
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
- Powered by OpenAI and Meshy.ai APIs
- Uses Three.js for 3D visualization