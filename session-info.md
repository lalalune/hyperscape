
## Development Commands

### Essential Commands
```bash
# Install dependencies
bun install

# Build all packages (runs docs generation + turbo build)
bun run build

# Start game server (production mode)
bun start
# Opens server at http://localhost:5555

# Run all tests
bun test

# Lint codebase
bun run lint

# Development mode with hot reload
bun run dev
# Client: http://localhost:3333 (Vite with HMR)
# Server: ws://localhost:5555/ws (auto-restart)
```

### Package-Specific Development
```bash
# Build individual packages
bun run build:shared    # Core Hyperscape engine (must build first)
bun run build:client    # Web client
bun run build:server    # Game server

# Dev mode for specific packages
bun run dev:shared      # Watch mode for shared package
bun run dev:client      # Vite dev server with HMR
bun run dev:server      # Server with auto-restart

# Reset development environment
bun run dev:reset       # Clean + rebuild + start dev
```

### Testing Commands
```bash
# Run all tests across packages
bun test

# Package-specific tests
bun run test --filter=@hyperscape/plugin-hyperscape
bun run test --filter=@hyperscape/server

# Tests use Playwright for real browser automation
# Visual testing with screenshot analysis (no mocks)
```

### Documentation
```bash
# Generate API documentation from TypeScript
bun run docs:generate

# Start documentation dev server (localhost:3000)
bun run docs:dev

# Build static documentation site
bun run docs:build

# Serve production docs build
bun run docs:serve
```

### Mobile Development
```bash
# iOS (requires Xcode and macOS)
bun run ios             # Build + sync + open Xcode
bun run ios:dev         # Sync + open (no build)
bun run ios:build       # Production build

# Android (requires Android Studio)
bun run android         # Build + sync + open Android Studio
bun run android:dev     # Sync + open (no build)
bun run android:build   # Production build

# Capacitor sync
bun run cap:sync        # Sync both platforms
bun run cap:sync:ios    # iOS only
bun run cap:sync:android # Android only
```

### Asset Management
```bash
# CDN operations (server package)
bun run cdn:up          # Start local CDN with Docker
bun run cdn:down        # Stop CDN

# From packages/server:
cd packages/server
bun run assets:sync     # Sync assets from git
bun run assets:deploy   # Deploy to R2
bun run assets:verify   # Verify asset integrity
bun run assets:full     # Both sync and deploy
```

### Cleanup
```bash
bun run clean           # Remove all build artifacts, logs, test results
```

## Architecture Overview

### Monorepo Structure
```
hyperscape/
├── packages/
│   ├── shared/              # Core Hyperscape engine (build first)
│   │   ├── Entity Component System (ECS)
│   │   ├── Three.js + PhysX integration
│   │   ├── Real-time networking layer
│   │   └── React UI framework
│   ├── client/              # Web client (Vite + React)
│   │   ├── Connects to server via WebSocket
│   │   └── Mobile support via Capacitor
│   ├── server/              # Game server (Fastify + WebSocket)
│   │   ├── SQLite/PostgreSQL for persistence
│   │   └── Handles multiplayer state sync
│   ├── physx-js-webidl/     # PhysX WebAssembly bindings
│   ├── plugin-hyperscape/   # ElizaOS AI agent plugin
│   └── docs-site/           # Docusaurus documentation
├── apps/
│   ├── api/                 # API server
│   └── asset-forge/         # Asset generation tools
└── dev-books/               # Development guides
```

### Technology Stack
- **Runtime**: Bun (primary), Node.js 18+ (fallback)
- **Build System**: Turbo (monorepo orchestration), Vite (client), esbuild (server)
- **3D Engine**: Three.js 0.180.0 + PhysX WASM for physics
- **Networking**: WebSocket (real-time), Fastify (HTTP), LiveKit (voice chat)
- **Database**: SQLite (development), PostgreSQL/Neon (production)
- **Authentication**: Privy (Web3 + social login), JWT tokens
- **Testing**: Vitest (unit), Playwright (E2E/visual), real browser automation
- **Mobile**: Capacitor 7.x for iOS and Android
- **AI Integration**: ElizaOS framework for autonomous agents

### Key Design Principles

#### Build Dependencies
**CRITICAL**: The `shared` package MUST be built before other packages:
```bash
bun run build:shared    # Always build first
bun run build           # Or use this (includes shared)
```

The build order is enforced by Turbo:
1. `physx-js-webidl` (PhysX WebAssembly)
2. `shared` (core engine - depends on physx)
3. All other packages (depend on shared)

#### TypeScript Configuration
- **Strict typing enabled** with some pragmatic exceptions:
  - `noImplicitAny: false` (for flexibility in complex 3D engine code)
  - Use explicit types on public APIs
  - Prefer classes over interfaces
- **Decorator support**: `experimentalDecorators: true`
- **Module resolution**: `bundler` mode (modern ESM)
- **No `any` types in production code** (lint rule warns)

#### Entity Component System (ECS)
Hyperscape uses an ECS architecture (from `packages/shared`):
- **Entities**: Game objects (players, mobs, items)
- **Components**: Data containers (Transform, Mesh, Collider, etc.)
- **Systems**: Logic processors (Physics, Rendering, Networking)

When adding gameplay features, extend the ECS rather than creating parallel systems.

#### Real-Time Networking
- Client connects via WebSocket to server
- State synchronization using msgpackr (binary protocol)
- Authority model: Server is authoritative, clients predict
- LiveKit integration for voice chat (optional)

#### Testing Philosophy
**No mocks, no simulations - real gameplay testing**:
- Use Playwright to automate real browser instances
- Visual testing with screenshots and pixel analysis
- Colored cube proxies for entities (red=players, green=goblins, blue=items)
- Tests verify actual Three.js scene hierarchy
- Save error screenshots to `/logs` for debugging

Example test pattern:
```typescript
// Start real server + client
const { page, world } = await startTestWorld()

// Perform actions in real game
await page.click('.goblin-entity')

// Verify via multiple methods
const playerStats = await world.queryPlayerStats()
const screenshot = await page.screenshot()
expect(playerStats.combat.level).toBe(2)
expect(screenshot).toContainGreenPixels() // Goblin visible
```

#### Mobile Development Workflow
- **Development**: `bun run dev:client` → test in Capacitor simulators
- **Testing**: `bun run ios:dev` / `bun run android:dev` (no rebuild)
- **Production**: Full build → sync → deploy via Xcode/Android Studio
- **Configuration**: Check `capacitor.config.ts` in client package
- **Deep linking**: Supported for Farcaster miniapp integration

### World State and Assets
- **World data**: `packages/server/world/` (or custom path with `--world`)
- **Database**: SQLite file in world directory (`db.sqlite`)
- **Asset CDN**: R2 bucket for 3D models, textures
- **Public URLs**: Configure via environment variables

### Environment Variables
```bash
# Required for development
DATABASE_URL=          # Database connection string
PRIVY_APP_ID=          # Authentication (public)
PRIVY_APP_SECRET=      # Authentication (private)

# Optional but recommended
PUBLIC_CDN_URL=        # Asset CDN endpoint
LIVEKIT_URL=           # Voice chat server
LIVEKIT_API_KEY=       # Voice chat credentials
LIVEKIT_API_SECRET=    # Voice chat credentials
PUBLIC_WS_URL=         # WebSocket URL for client

# AI Integration (optional)
OPENAI_API_KEY=        # For GPT-4 content generation
MESHY_API_KEY=         # For 3D model generation
```

Store in `.env` files at:
- Root: Global settings
- `packages/server/.env`: Server-specific
- `packages/client/.env`: Client-specific (use `PUBLIC_` prefix for exposed vars)

## Important Project Conventions

### File Management
- **Avoid creating new files unless necessary** - extend existing files
- **No _v2 or _old files** - replace in place and update imports
- Clean up orphaned files immediately
- Use `bun run clean` to remove build artifacts

### Code Quality Standards
- Run `bun run lint` before committing
- TypeScript errors must be resolved (`bun run build` catches them)
- No `any` types in production code (use specific types or classes)
- Use descriptive names for entities and systems

### Real RPG Implementation
This is a working RuneScape-style MMORPG with:
- **Skills**: Attack, Strength, Defense, Constitution, Ranged, Woodcutting, Fishing, Firemaking, Cooking
- **Equipment tiers**: Bronze (level 1), Steel (level 10), Mithril (level 20)
- **Combat**: Auto-attack system with real damage calculations
- **Resources**: Trees, fish spots, banks, stores
- **Multiplayer**: Real-time synchronization of all players and entities

Game design follows `CLAUDE.md` (comprehensive game design document) and `LORE.md` (world lore and regions).

### AI Agent Support
ElizaOS agents can join as players via `plugin-hyperscape`:
- Same actions as human players (combat, gathering, movement)
- WebSocket connection to server
- Autonomous decision-making using game state perception
- Can coexist with human players in same world

### Git Workflow
- Main branch: `main`
- Feature branches: Use descriptive names
- Commit messages: Clear and descriptive
- No secrets in commits (use environment variables)

## Troubleshooting

### Build Issues
```bash
# If build fails, try:
rm -rf node_modules packages/*/node_modules packages/*/build packages/*/dist
bun install
bun run build
```

### Port Conflicts
```bash
# Kill processes on development ports
lsof -ti:3333 | xargs kill -9  # Client
lsof -ti:5555 | xargs kill -9  # Server
```

### Test Failures
```bash
# Kill existing Hyperscape processes
pkill -f "hyperscape"
bun test
```

### Development Mode Issues
```bash
# If hot reload stops working:
bun run dev:reset
```

### Database Reset
```bash
# Reset player data (use with caution)
rm packages/server/world/db.sqlite
bun start
```

## Additional Resources

- **README.md**: Complete project overview with gameplay guide
- **CLAUDE.md**: Cursor rules and comprehensive game design document
- **LORE.md**: World lore, regions, and narrative background
- **packages/shared/README.md**: Core engine documentation
- **packages/plugin-hyperscape/README.md**: AI agent integration guide
- **dev-books/**: In-depth development guides for each package
- **Generated API docs**: Run `bun run docs:dev` to view

## Quick Start Workflow

1. **First time setup**:
   ```bash
   git clone <repository>
   cd hyperscape
   bun install
   bun run build
   ```

2. **Start development**:
   ```bash
   bun run dev
   # Client: http://localhost:3333
   # Server: ws://localhost:5555/ws
   ```

3. **Make changes**:
   - Edit files in `packages/shared/src`, `packages/client/src`, or `packages/server/src`
   - Dev mode auto-reloads

4. **Test changes**:
   ```bash
   bun test
   bun run lint
   ```

5. **Build for production**:
   ```bash
   bun run build
   bun start
   # Open http://localhost:5555
   ```




















# Asset Forge - Work Scope & Guidelines

**Date**: October 27, 2025 
**Focus**: Polishing and completing the Asset Forge application 
**Deployment URLs**:
- **Frontend**: https://forgery-smoky.vercel.app/
- **Backend (API)**: dairy-queen-production.up.railway.app
- **Database (PostgreSQL)**: postgres-production-f753.up.railway.app

---

## 🎯 **IN SCOPE** - What We're Working On

### 1. Core Application Logic
- **Asset Management** (`/src/services/api/AssetService.ts`, `/src/stores/useAssetsStore.ts`)
- Asset listing, creation, updates
- Material presets and retexturing
- Caching strategies (memory, IndexedDB, Service Worker)

- **Content Generation** (`/src/stores/useContentGenerationStore.ts`, `/src/components/GameContent/`)
- Quest generation and management
- NPC generation and management
- Lore creation
- Script writing
- Dialogue generation

- **Voice Generation** (`/src/services/VoiceGenerationService.ts`, `/src/stores/useVoiceGenerationStore.ts`)
- Voice library management
- Voice profile creation
- Batch generation
- Manifest assignment
- Voice presets

- **Sound & Music** (`/src/services/SoundEffectsService.ts`, `/src/services/MusicService.ts`)
- Sound effects generation
- Music generation
- Audio management

- **Manifest System** (`/src/services/ManifestService.ts`, `/src/services/PreviewManifestService.ts`)
- Preview manifests
- Manifest submissions
- Manifest editing and versioning
- Team collaboration on manifests

- **Admin Features** (`/src/components/Admin/`, `/src/services/api/AdminService.ts`)
- Submission approvals
- User management
- Error log viewing
- Statistics dashboard

- **Projects & Teams** (`/src/stores/useProjectsStore.ts`, `/src/stores/useTeamsStore.ts`)
- Project creation and management
- Team collaboration
- Project organization

### 2. UI/UX Components (Non-3D)
- **Navigation** (`/src/components/navigation/`)
- Side navigation
- Route management
- Breadcrumbs

- **Dashboard** (`/src/components/Dashboard/`, `/src/pages/DashboardPage.tsx`)
- Main dashboard view
- Statistics widgets
- Quick actions

- **Forms & Inputs** (`/src/components/common/`)
- Form validation
- Input components
- Error handling
- Loading states

- **Content Pages** (`/src/pages/`)
- ContentGenerationPage
- VoiceGenerationPage
- VoiceStandalonePage
- QuestsPage
- NPCsPage
- LorePage
- ScriptsPage
- ManifestsPage
- AdminDashboardPage
- ProjectsPage
- TeamsPage

### 3. State Management
- **Zustand Stores** (`/src/stores/`)
- useAssetsStore
- useContentGenerationStore
- useGenerationStore
- useManifestsStore
- useNavigationStore
- useNPCScriptsStore
- usePreviewManifestsStore
- useProjectsStore
- useQuestTrackingStore
- useRelationshipsStore
- useSubmissionsStore
- useTeamsStore
- useVoiceGenerationStore
- useVoicePresetsStore
- adminStore
- userStore

### 4. Services & APIs (Non-3D)
- **API Services** (`/src/services/api/`)
- BaseAPIService
- AssetService (non-3D operations)
- AdminService
- APIKeyService
- GenerationAPIClient
- PromptService
- ProjectService
- UserService

- **Business Logic Services** (`/src/services/`)
- AIContextService
- AssetCacheService
- CacheInvalidationService
- ContextBuilder
- IndexedDBCache
- ManifestService
- MusicService
- PipelinePollingService
- PrefetchService
- PreviewManifestService
- SeedDataService
- SoundEffectsService
- SubmissionService
- SubmissionsService
- VoiceGenerationService

### 5. Configuration & Constants
- `/src/config/` - All configuration files
- `/src/constants/` - All constant definitions
- Environment variable handling
- API endpoint configuration

### 6. Authentication
- `/src/auth/` - Privy authentication integration
- Login/logout flows
- Session management
- Protected routes

### 7. Utilities & Helpers (Non-3D)
- `/src/utils/` (excluding three-helpers.ts, three-lazy-loaders.ts)
- API utilities
- Error handling
- Logging
- Fuzzy search
- Route utilities
- Form helpers

### 8. Types & Interfaces
- `/src/types/` - All TypeScript type definitions
- Asset types
- Generation types
- Manifest types
- Content generation types
- Quest tracking types
- NPC scripts types
- Relationships types

---

## 🚫 **OUT OF SCOPE** - What We're NOT Working On

### 1. 3D Rendering & Visualization
- **Armor Fitting** (`/src/components/ArmorFitting/`)
- MeshFittingDebugger
- Armor placement visualization
- 3D preview functionality

- **Hand Rigging** (`/src/components/HandRigging/`)
- Hand pose detection
- Rigging visualization
- Hand animation tools

- **Equipment Viewer** (`/src/components/Equipment/`)
- 3D equipment preview
- Equipment visualization

- **Three.js Components** (`/src/components/shared/ThreeViewer/`)
- 3D model viewers
- Scene rendering
- Camera controls

- **3D Services** (`/src/services/`)
- ArmorFittingService
- HandRiggingService
- Processing services (mesh processing, geometry operations)
- WebGLRendererPool
- BufferPool

- **3D Utilities** (`/src/utils/`)
- three-helpers.ts
- three-lazy-loaders.ts

- **3D Stores**
- useArmorFittingStore
- useHandRiggingStore
- useDebuggerStore

- **3D Hooks** (`/src/hooks/three/`)
- All Three.js-specific hooks

### 2. Web Workers (Unless Related to Non-3D Processing)
- `/src/workers/` - Worker implementations

---

## 📋 **Development Guidelines**

### Tech Stack
- **Frontend Framework**: React 19.2.0 with TypeScript 5.3.3
- **Build Tool**: Vite 7.1.12
- **State Management**: Zustand 5.0.6
- **Styling**: TailwindCSS 3.4.1
- **Authentication**: Privy 3.4.1
- **Routing**: Custom navigation with useNavigationStore
- **Deployment**: 
- Frontend: Vercel
- Backend: Railway
- Database: PostgreSQL on Railway

### Code Standards
- **TypeScript**: Use strict typing, no `any` types in production code
- **React**: Use functional components with hooks
- **State**: Use Zustand stores for global state
- **Forms**: Implement proper validation and error handling
- **API Calls**: Use BaseAPIService patterns, implement proper error handling
- **Caching**: Utilize multi-layer caching (memory → IndexedDB → network)
- **Logging**: Use createLogger utility for consistent logging

### File Organization
- **Components**: One component per file, colocate related components
- **Stores**: One store per feature/domain
- **Services**: One service per API domain or business logic area
- **Types**: Define types in dedicated files, import from `/types/index.ts`
- **Pages**: Lazy-loaded route components in `/pages/`

### Best Practices
1. **No 3D Code**: If a file imports from Three.js, skip it
2. **Error Boundaries**: Wrap page components with ErrorBoundary
3. **Loading States**: Always show loading indicators for async operations
4. **Caching**: Implement cache invalidation when data changes
5. **Authentication**: Use privyAuthManager for token management
6. **API Calls**: Always include timeout and error handling
7. **Responsive Design**: Mobile-first, test on mobile viewports
8. **Accessibility**: Use semantic HTML, proper ARIA labels

### Testing Approach
- Focus on business logic testing
- Test state management stores
- Test API service methods
- Test utility functions
- Skip 3D rendering tests (out of scope)

---

## 🗂️ **Key Files to Review**

### Entry Points
- `/src/main.tsx` - Application entry with auth wrapper
- `/src/App.tsx` - Main application component with routing

### Core Configuration
- `/src/config/api.ts` - API endpoint configuration
- `/src/constants/network.ts` - Network defaults
- `/railway.json` - Railway deployment config
- `/vercel.json` - Vercel deployment config

### Key Services
- `/src/services/api/BaseAPIService.ts` - Base API service class
- `/src/services/api/AssetService.ts` - Asset management
- `/src/services/VoiceGenerationService.ts` - Voice generation
- `/src/services/ManifestService.ts` - Manifest operations

### State Management
- `/src/stores/index.ts` - Store exports
- `/src/contexts/AppContext.tsx` - App-level context
- `/src/contexts/NavigationContext.tsx` - Navigation context

### Types
- `/src/types/index.ts` - Type exports
- `/src/types/generation.ts` - Generation types
- `/src/types/content-generation.ts` - Content types
- `/src/types/manifests.ts` - Manifest types

---

## ✅ **Today's Goals**

1. **Polish UI/UX**: Improve user experience for all non-3D pages
2. **Complete Features**: Finish any incomplete non-3D functionality
3. **Bug Fixes**: Address any bugs in content generation, voice, music, manifests
4. **API Integration**: Ensure all API endpoints work correctly with Railway backend
5. **State Management**: Verify all stores work correctly and efficiently
6. **Error Handling**: Improve error messages and recovery
7. **Caching**: Optimize caching strategies
8. **Documentation**: Add comments to complex logic

---

## 🔧 **Commands**

```bash
# Development
bun run dev # Start dev server (port 5173)

# Build
bun run build # Production build

# Preview
bun run preview # Preview production build

# Lint
bun run lint # Run ESLint

# Type Check
bun run typecheck # Run TypeScript compiler check
```

---

## 📝 **Notes**

- Backend API is already deployed on Railway
- Frontend is deployed on Vercel
- Database is PostgreSQL on Railway
- Focus on completing and polishing existing features
- Avoid introducing new 3D features or refactoring 3D code
- Maintain consistency with existing patterns and conventions
- Test thoroughly before committing changes










# Asset Forge - Work Scope & Guidelines

**Date**: October 27, 2025 
**Focus**: Polishing and completing the Asset Forge application 
**Deployment URLs**:
- **Frontend**: https://forgery-smoky.vercel.app/
- **Backend (API)**: dairy-queen-production.up.railway.app
- **Database (PostgreSQL)**: postgres-production-f753.up.railway.app

---

## 🎯 **IN SCOPE** - What We're Working On

### 1. Core Application Logic
- **Asset Management** (`/src/services/api/AssetService.ts`, `/src/stores/useAssetsStore.ts`)
- Asset listing, creation, updates
- Material presets and retexturing
- Caching strategies (memory, IndexedDB, Service Worker)

- **Content Generation** (`/src/stores/useContentGenerationStore.ts`, `/src/components/GameContent/`)
- Quest generation and management
- NPC generation and management
- Lore creation
- Script writing
- Dialogue generation

- **Voice Generation** (`/src/services/VoiceGenerationService.ts`, `/src/stores/useVoiceGenerationStore.ts`)
- Voice library management
- Voice profile creation
- Batch generation
- Manifest assignment
- Voice presets

- **Sound & Music** (`/src/services/SoundEffectsService.ts`, `/src/services/MusicService.ts`)
- Sound effects generation
- Music generation
- Audio management

- **Manifest System** (`/src/services/ManifestService.ts`, `/src/services/PreviewManifestService.ts`)
- Preview manifests
- Manifest submissions
- Manifest editing and versioning
- Team collaboration on manifests

- **Admin Features** (`/src/components/Admin/`, `/src/services/api/AdminService.ts`)
- Submission approvals
- User management
- Error log viewing
- Statistics dashboard

- **Projects & Teams** (`/src/stores/useProjectsStore.ts`, `/src/stores/useTeamsStore.ts`)
- Project creation and management
- Team collaboration
- Project organization

### 2. UI/UX Components (Non-3D)
- **Navigation** (`/src/components/navigation/`)
- Side navigation
- Route management
- Breadcrumbs

- **Dashboard** (`/src/components/Dashboard/`, `/src/pages/DashboardPage.tsx`)
- Main dashboard view
- Statistics widgets
- Quick actions

- **Forms & Inputs** (`/src/components/common/`)
- Form validation
- Input components
- Error handling
- Loading states

- **Content Pages** (`/src/pages/`)
- ContentGenerationPage
- VoiceGenerationPage
- VoiceStandalonePage
- QuestsPage
- NPCsPage
- LorePage
- ScriptsPage
- ManifestsPage
- AdminDashboardPage
- ProjectsPage
- TeamsPage

### 3. State Management
- **Zustand Stores** (`/src/stores/`)
- useAssetsStore
- useContentGenerationStore
- useGenerationStore
- useManifestsStore
- useNavigationStore
- useNPCScriptsStore
- usePreviewManifestsStore
- useProjectsStore
- useQuestTrackingStore
- useRelationshipsStore
- useSubmissionsStore
- useTeamsStore
- useVoiceGenerationStore
- useVoicePresetsStore
- adminStore
- userStore

### 4. Services & APIs (Non-3D)
- **API Services** (`/src/services/api/`)
- BaseAPIService
- AssetService (non-3D operations)
- AdminService
- APIKeyService
- GenerationAPIClient
- PromptService
- ProjectService
- UserService

- **Business Logic Services** (`/src/services/`)
- AIContextService
- AssetCacheService
- CacheInvalidationService
- ContextBuilder
- IndexedDBCache
- ManifestService
- MusicService
- PipelinePollingService
- PrefetchService
- PreviewManifestService
- SeedDataService
- SoundEffectsService
- SubmissionService
- SubmissionsService
- VoiceGenerationService

### 5. Configuration & Constants
- `/src/config/` - All configuration files
- `/src/constants/` - All constant definitions
- Environment variable handling
- API endpoint configuration

### 6. Authentication
- `/src/auth/` - Privy authentication integration
- Login/logout flows
- Session management
- Protected routes

### 7. Utilities & Helpers (Non-3D)
- `/src/utils/` (excluding three-helpers.ts, three-lazy-loaders.ts)
- API utilities
- Error handling
- Logging
- Fuzzy search
- Route utilities
- Form helpers

### 8. Types & Interfaces
- `/src/types/` - All TypeScript type definitions
- Asset types
- Generation types
- Manifest types
- Content generation types
- Quest tracking types
- NPC scripts types
- Relationships types

---

## 🚫 **OUT OF SCOPE** - What We're NOT Working On

### 1. 3D Rendering & Visualization
- **Armor Fitting** (`/src/components/ArmorFitting/`)
- MeshFittingDebugger
- Armor placement visualization
- 3D preview functionality

- **Hand Rigging** (`/src/components/HandRigging/`)
- Hand pose detection
- Rigging visualization
- Hand animation tools

- **Equipment Viewer** (`/src/components/Equipment/`)
- 3D equipment preview
- Equipment visualization

- **Three.js Components** (`/src/components/shared/ThreeViewer/`)
- 3D model viewers
- Scene rendering
- Camera controls

- **3D Services** (`/src/services/`)
- ArmorFittingService
- HandRiggingService
- Processing services (mesh processing, geometry operations)
- WebGLRendererPool
- BufferPool

- **3D Utilities** (`/src/utils/`)
- three-helpers.ts
- three-lazy-loaders.ts

- **3D Stores**
- useArmorFittingStore
- useHandRiggingStore
- useDebuggerStore

- **3D Hooks** (`/src/hooks/three/`)
- All Three.js-specific hooks

### 2. Web Workers (Unless Related to Non-3D Processing)
- `/src/workers/` - Worker implementations

---

## 📋 **Development Guidelines**

### Tech Stack
- **Frontend Framework**: React 19.2.0 with TypeScript 5.3.3
- **Build Tool**: Vite 7.1.12
- **State Management**: Zustand 5.0.6
- **Styling**: TailwindCSS 3.4.1
- **Authentication**: Privy 3.4.1
- **Routing**: Custom navigation with useNavigationStore
- **Deployment**: 
- Frontend: Vercel
- Backend: Railway
- Database: PostgreSQL on Railway

### Code Standards
- **TypeScript**: Use strict typing, no `any` types in production code
- **React**: Use functional components with hooks
- **State**: Use Zustand stores for global state
- **Forms**: Implement proper validation and error handling
- **API Calls**: Use BaseAPIService patterns, implement proper error handling
- **Caching**: Utilize multi-layer caching (memory → IndexedDB → network)
- **Logging**: Use createLogger utility for consistent logging

### File Organization
- **Components**: One component per file, colocate related components
- **Stores**: One store per feature/domain
- **Services**: One service per API domain or business logic area
- **Types**: Define types in dedicated files, import from `/types/index.ts`
- **Pages**: Lazy-loaded route components in `/pages/`

### Best Practices
1. **No 3D Code**: If a file imports from Three.js, skip it
2. **Error Boundaries**: Wrap page components with ErrorBoundary
3. **Loading States**: Always show loading indicators for async operations
4. **Caching**: Implement cache invalidation when data changes
5. **Authentication**: Use privyAuthManager for token management
6. **API Calls**: Always include timeout and error handling
7. **Responsive Design**: Mobile-first, test on mobile viewports
8. **Accessibility**: Use semantic HTML, proper ARIA labels

### Testing Approach
- Focus on business logic testing
- Test state management stores
- Test API service methods
- Test utility functions
- Skip 3D rendering tests (out of scope)

---

## 🗂️ **Key Files to Review**

### Entry Points
- `/src/main.tsx` - Application entry with auth wrapper
- `/src/App.tsx` - Main application component with routing

### Core Configuration
- `/src/config/api.ts` - API endpoint configuration
- `/src/constants/network.ts` - Network defaults
- `/railway.json` - Railway deployment config
- `/vercel.json` - Vercel deployment config

### Key Services
- `/src/services/api/BaseAPIService.ts` - Base API service class
- `/src/services/api/AssetService.ts` - Asset management
- `/src/services/VoiceGenerationService.ts` - Voice generation
- `/src/services/ManifestService.ts` - Manifest operations

### State Management
- `/src/stores/index.ts` - Store exports
- `/src/contexts/AppContext.tsx` - App-level context
- `/src/contexts/NavigationContext.tsx` - Navigation context

### Types
- `/src/types/index.ts` - Type exports
- `/src/types/generation.ts` - Generation types
- `/src/types/content-generation.ts` - Content types
- `/src/types/manifests.ts` - Manifest types

---

## ✅ **Today's Goals**

1. **Polish UI/UX**: Improve user experience for all non-3D pages
2. **Complete Features**: Finish any incomplete non-3D functionality
3. **Bug Fixes**: Address any bugs in content generation, voice, music, manifests
4. **API Integration**: Ensure all API endpoints work correctly with Railway backend
5. **State Management**: Verify all stores work correctly and efficiently
6. **Error Handling**: Improve error messages and recovery
7. **Caching**: Optimize caching strategies
8. **Documentation**: Add comments to complex logic

---

## 🔧 **Commands**

```bash
# Development
bun run dev # Start dev server (port 5173)

# Build
bun run build # Production build

# Preview
bun run preview # Preview production build

# Lint
bun run lint # Run ESLint

# Type Check
bun run typecheck # Run TypeScript compiler check
```

---

## 📝 **Notes**

- Backend API is already deployed on Railway
- Frontend is deployed on Vercel
- Database is PostgreSQL on Railway
- Focus on completing and polishing existing features
- Avoid introducing new 3D features or refactoring 3D code
- Maintain consistency with existing patterns and conventions
- Test thoroughly before committing changes
