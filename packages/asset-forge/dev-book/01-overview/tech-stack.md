# Technology Stack

[← Back to Index](../README.md)

---

## Complete Technology Overview

Asset Forge is built with modern web technologies, AI services, and 3D rendering capabilities.

---

## Frontend Stack

### Core Framework

#### React 19.2.0
**Purpose**: UI framework
**Why**: Component-based architecture, large ecosystem, excellent TypeScript support

**Key Features Used:**
- Function components with hooks
- Suspense for code splitting
- Error boundaries
- Context API for navigation
- Forward refs for viewer components

#### TypeScript 5.3.3
**Purpose**: Type safety
**Why**: Catch errors at compile-time, excellent IDE support, self-documenting code

**Configuration:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true
  }
}
```

**Type Coverage**: 100% (no `any` types)

### 3D Graphics

#### Three.js 0.178.0
**Purpose**: 3D rendering engine
**Why**: Industry standard, extensive features, great performance

**Features Used:**
- GLTFLoader for model loading
- WebGLRenderer with SRGB color space
- PerspectiveCamera and OrthographicCamera
- OrbitControls for camera manipulation
- SkinnedMesh for rigged characters
- Raycaster for grip detection
- Scene graph for hierarchy
- BufferGeometry manipulation

#### @react-three/fiber 9.0.0
**Purpose**: React renderer for Three.js
**Why**: Declarative Three.js, React component integration

**Note**: Currently not heavily used, direct Three.js preferred for fine control

#### @react-three/drei 10.7.6
**Purpose**: Three.js utilities
**Why**: Helper components for common Three.js tasks

**Components Used:**
- OrbitControls wrapper
- Useful hooks

### State Management

#### Zustand 5.0.6
**Purpose**: State management
**Why**: Simple API, TypeScript support, middleware ecosystem, no boilerplate

**Middleware Stack:**
```typescript
create<State>()(
  devtools(              // Redux DevTools integration
    persist(             // LocalStorage persistence
      subscribeWithSelector(  // Granular subscriptions
        immer(...)       // Immutable updates
      )
    )
  )
)
```

**Stores**: 5 stores managing 150+ state properties

#### Immer 10.1.1
**Purpose**: Immutable state updates
**Why**: Write mutable code that produces immutable results

```typescript
set((state) => {
  state.assetName = 'sword'  // Looks mutable, actually immutable
})
```

### AI/ML Libraries

#### TensorFlow.js 4.22.0
**Purpose**: Machine learning in browser
**Why**: Run MediaPipe models client-side

**Backend**: WebGL for GPU acceleration

#### @tensorflow-models/hand-pose-detection 2.0.1
**Purpose**: Hand pose detection
**Why**: Detect 21 hand landmarks for weapon rigging

**Model**: MediaPipe Hands

#### @mediapipe/hands 0.4.1675469240
**Purpose**: Hand landmark model
**Why**: High-accuracy hand tracking

**Output**: 21 3D keypoints per hand

### UI Components

#### Lucide React 0.525.0
**Purpose**: Icon library
**Why**: Modern, tree-shakeable, consistent design

**Icons Used**: 50+ icons (Wand2, Database, Hand, Wrench, Shield, etc.)

#### Custom Component Library
77 custom components:
- 12 reusable primitives (Button, Card, Modal, Input)
- 65 feature-specific components

### Styling

#### Tailwind CSS 3.3.6
**Purpose**: Utility-first CSS framework
**Why**: Rapid development, small bundle size, customizable

**Custom Config:**
```javascript
module.exports = {
  theme: {
    extend: {
      colors: tokens.colors,
      spacing: tokens.spacing,
      animation: customAnimations
    }
  }
}
```

#### clsx 2.0.0 + tailwind-merge 3.3.1
**Purpose**: Class name utilities
**Why**: Conditional classes, conflict resolution

```typescript
const cn = (...inputs) => twMerge(clsx(inputs))
cn('btn', isActive && 'btn-active', className)
```

### Build Tools

#### Vite 6.0.0
**Purpose**: Build tool and dev server
**Why**: Fast HMR, modern ES modules, excellent TypeScript support

**Features Used:**
- Lightning-fast dev server
- Code splitting
- Asset optimization
- Proxy for backend API

#### @vitejs/plugin-react 4.3.4
**Purpose**: React support in Vite
**Why**: React Fast Refresh, JSX transformation

### Utilities

#### dotenv 16.3.1
**Purpose**: Environment variable management
**Why**: Secure API key storage

**Usage:**
```bash
VITE_OPENAI_API_KEY=sk-...
VITE_MESHY_API_KEY=...
```

---

## Backend Stack

### Runtime & Framework

#### Node.js 18+
**Purpose**: JavaScript runtime
**Why**: Asynchronous I/O, large ecosystem, familiar language

**Requirements**: Node >= 18.0.0

#### Bun (Optional)
**Purpose**: Fast JavaScript runtime
**Why**: 3x faster than Node, built-in TypeScript support

**Usage**: Development and production runtime option

#### Express.js 4.18.2
**Purpose**: Web framework
**Why**: Minimal, flexible, battle-tested

**Server Setup:**
```javascript
const app = express()
app.use(express.json({ limit: '25mb' }))
app.use(cors())
app.use(errorHandler)
```

### HTTP Utilities

#### node-fetch 3.3.2
**Purpose**: HTTP client
**Why**: Fetch API in Node.js, same API as browser

**Usage:**
```javascript
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` }
})
```

#### cors 2.8.5
**Purpose**: CORS middleware
**Why**: Enable cross-origin requests from frontend

**Config:**
```javascript
res.header('Access-Control-Allow-Origin', 'http://localhost:3003')
res.header('Access-Control-Allow-Credentials', 'true')
```

### File System

#### fs/promises
**Purpose**: Asynchronous file operations
**Why**: Built-in, non-blocking I/O

**Operations:**
- Create directories (recursive)
- Read/write JSON
- Save binary GLB files
- Delete assets

---

## AI Services

### OpenAI API

#### GPT-4
**Purpose**: Prompt enhancement
**Why**: Improves generation quality, adds details

**Model**: `gpt-4`
**Temperature**: 0.7
**Max Tokens**: 200

**Use Cases:**
- Enhance user descriptions
- Add visual details
- Ensure pose requirements

#### GPT-4o-mini (Vision)
**Purpose**: Image analysis
**Why**: Detect weapon grip points, orientation

**Model**: `gpt-4o-mini`
**Temperature**: 0.2-0.3
**Response Format**: JSON

**Use Cases:**
- Weapon handle detection
- Weapon orientation analysis

#### GPT-Image-1 (DALL-E)
**Purpose**: Image generation
**Why**: Create concept art for 3D conversion

**Model**: `gpt-image-1`
**Size**: 1024x1024
**Quality**: high
**Format**: b64_json (base64)

**Output**: PNG concept art

### Meshy.ai API

#### Image-to-3D
**Purpose**: Convert images to 3D models
**Why**: State-of-the-art image-to-3D, game-ready topology

**Model**: `meshy-5`
**Topology**: quad
**Output**: GLB file

**Quality Settings:**
| Setting | Polycount | Texture | PBR |
|---------|-----------|---------|-----|
| Standard | 6,000 | 1024px | No |
| High | 12,000 | 2048px | Yes |
| Ultra | 20,000 | 4096px | Yes |

#### Retexture
**Purpose**: Generate material variants
**Why**: Automatic material replacement, style consistency

**Model**: `meshy-5`
**Input**: model_url or input_task_id
**Style**: text_style_prompt

**Features:**
- PBR texture generation
- Original UV preservation
- Realistic art style

#### Rigging
**Purpose**: Character auto-rigging
**Why**: Automatic skeleton generation, basic animations

**Input**: model_url or input_task_id
**Height**: Configurable (default 1.7m)

**Output:**
- Rigged model with skeleton
- Walking animation GLB
- Running animation GLB

---

## Development Tools

### Code Quality

#### ESLint 9.33.0
**Purpose**: Code linting
**Why**: Catch bugs, enforce style, best practices

**Plugins:**
- @typescript-eslint/parser
- @typescript-eslint/eslint-plugin

**Rules**: TypeScript recommended + custom rules

#### TypeScript Compiler
**Purpose**: Type checking
**Why**: Compile-time safety, IDE support

**Scripts:**
```bash
npm run typecheck  # tsc --noEmit
```

### Dependency Management

#### Knip 5.62.0
**Purpose**: Find unused files and dependencies
**Why**: Keep codebase clean, reduce bundle size

```bash
npm run check:all
```

#### Depcheck 1.4.7
**Purpose**: Check dependency usage
**Why**: Ensure all deps are used, find missing deps

```bash
npm run check:deps
```

### Build & Run

#### Concurrently 9.1.2
**Purpose**: Run multiple processes
**Why**: Start frontend + backend simultaneously

```bash
npm run dev  # Runs dev:frontend & dev:backend
```

---

## Package Ecosystem

### Full Dependency List

```json
{
  "dependencies": {
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "three": "0.178.0",
    "@react-three/fiber": "9.0.0",
    "@react-three/drei": "10.7.6",
    "three-mesh-bvh": "0.9.1",
    "@tensorflow/tfjs": "4.22.0",
    "@tensorflow-models/hand-pose-detection": "2.0.1",
    "@mediapipe/hands": "0.4.1675469240",
    "zustand": "5.0.6",
    "immer": "10.1.1",
    "lucide-react": "0.525.0",
    "clsx": "2.0.0",
    "tailwind-merge": "3.3.1",
    "dotenv": "16.3.1",
    "express": "4.18.2",
    "cors": "2.8.5",
    "node-fetch": "3.3.2"
  },
  "devDependencies": {
    "typescript": "5.3.3",
    "vite": "6.0.0",
    "@vitejs/plugin-react": "4.3.4",
    "tailwindcss": "3.3.6",
    "postcss": "8.4.32",
    "autoprefixer": "10.4.16",
    "eslint": "9.33.0",
    "@typescript-eslint/parser": "8.18.2",
    "@typescript-eslint/eslint-plugin": "8.18.2",
    "knip": "5.62.0",
    "depcheck": "1.4.7",
    "concurrently": "9.1.2"
  }
}
```

---

## Architecture Decisions

### Why These Technologies?

#### React over Vue/Angular
- Largest ecosystem
- Excellent TypeScript support
- Three.js integration well-documented
- Team familiarity

#### Zustand over Redux
- Less boilerplate (90% less code)
- Better TypeScript inference
- Simpler API
- Middleware support
- Persist and DevTools built-in

#### Vite over Webpack
- 10x faster dev server
- Instant HMR
- Modern ES modules
- Simpler configuration
- Better DX

#### Three.js over Babylon.js
- Industry standard
- Larger community
- More examples
- Better documentation
- React ecosystem

#### Express over Fastify/Koa
- Mature, stable
- Huge ecosystem
- Easy to learn
- Sufficient for needs

#### File System over Database
- Simpler development
- Portable assets
- Version control friendly
- No DB setup required
- Future migration path exists

#### Bun over Node
- 3x faster startup
- Built-in TypeScript
- Drop-in replacement
- Modern runtime
- Optional (Node still supported)

---

## Performance Characteristics

### Bundle Sizes (Production)

```
Frontend:
├─ Main bundle: ~500KB (gzipped)
├─ Three.js: ~600KB (gzipped)
├─ TensorFlow.js: ~1.2MB (gzipped)
└─ Total: ~2.3MB initial load

Backend:
├─ Server code: ~50KB
├─ Dependencies: ~10MB (node_modules)
└─ Runtime: Node.js or Bun
```

### Runtime Performance

**Frontend:**
- Initial load: < 3s
- Route change: < 100ms
- 3D model load: 500ms - 2s (model dependent)
- State updates: < 16ms (60fps)

**Backend:**
- API response: < 50ms (without AI calls)
- AI generation: 2-20 minutes (quality dependent)
- File I/O: < 10ms

---

## Browser Support

### Minimum Requirements

**Browser:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

**Features Required:**
- ES2020 JavaScript
- WebGL 2.0
- Web Workers
- LocalStorage
- Fetch API

**Not Supported:**
- Internet Explorer
- Opera Mini
- Old mobile browsers

---

## Future Technology Plans

### Planned Additions

1. **Database Layer**: PostgreSQL for metadata
2. **Object Storage**: S3 for GLB files
3. **Message Queue**: Redis/RabbitMQ for pipelines
4. **Caching**: Redis for API responses
5. **CDN**: CloudFlare for static assets
6. **Monitoring**: Sentry for error tracking
7. **Analytics**: PostHog for usage analytics

### Under Consideration

- WebAssembly for heavy computations
- Service Workers for offline support
- Progressive Web App features
- GraphQL API
- Real-time WebSocket updates

---

## Version Matrix

### Current Versions (2025-01-21)

| Package | Version | Released | Notes |
|---------|---------|----------|-------|
| React | 19.2.0 | 2024-12 | Latest stable |
| TypeScript | 5.3.3 | 2024-01 | Stable |
| Three.js | 0.178.0 | 2025-01 | Latest |
| Vite | 6.0.0 | 2024-11 | Major release |
| Node.js | 18+ | 2022-04 | LTS |
| Zustand | 5.0.6 | 2024-11 | Latest |

### Update Strategy

**Major versions**: Planned upgrades, testing required
**Minor versions**: Auto-update if no breaking changes
**Patch versions**: Auto-update

**Update frequency**: Monthly dependency review

---

## Next Steps

- [Installation Guide](../02-getting-started/installation.md) - Set up development environment
- [Configuration](../02-getting-started/configuration.md) - Configure API keys and settings
- [Architecture](architecture.md) - Understand system design

---

[← Back to Architecture](architecture.md) | [Next: Installation →](../02-getting-started/installation.md)
