# Production Build Process

Asset Forge uses Vite for lightning-fast builds with automatic code splitting, asset optimization, and tree-shaking. This guide covers the complete production build process from development to deployment.

## Table of Contents

1. [Build Configuration](#build-configuration)
2. [Build Commands](#build-commands)
3. [Code Splitting](#code-splitting)
4. [Asset Optimization](#asset-optimization)
5. [Bundle Analysis](#bundle-analysis)
6. [Environment Variables](#environment-variables)
7. [Build Artifacts](#build-artifacts)
8. [Deployment Checklist](#deployment-checklist)

## Build Configuration

### Vite Configuration

**Location:** `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'three'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'react': path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
      'three': path.resolve(__dirname, '../../node_modules/three')
    }
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'three', '@react-three/fiber', '@react-three/drei'],
    esbuildOptions: {
      resolveExtensions: ['.mjs', '.js', '.jsx', '.json', '.ts', '.tsx']
    }
  },

  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000, // 1MB chunks
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-state': ['zustand', 'immer']
        }
      }
    }
  },

  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3004',
        changeOrigin: true
      },
      '/assets': {
        target: 'http://localhost:3004',
        changeOrigin: true
      }
    }
  }
})
```

### TypeScript Configuration

**Location:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## Build Commands

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "dev:frontend": "vite",
    "dev:backend": "concurrently \"npm run dev:api\" \"npm run dev:images\"",
    "dev:api": "node server/api.mjs",
    "dev:images": "node scripts/start-image-server.mjs",

    "build": "npm run clean && vite build",
    "build:services": "node scripts/build-services.mjs",
    "clean": "rm -rf dist",

    "start": "npm run start:backend",
    "start:backend": "concurrently \"npm run start:api\" \"npm run start:image-server\"",
    "start:api": "npm run build:services && node server/api.mjs",
    "start:image-server": "node scripts/start-image-server.mjs",

    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

### Build Steps

#### 1. Development Build

```bash
# Start development server
npm run dev

# Frontend: http://localhost:3000
# Backend API: http://localhost:3004
# Image server: http://localhost:8080
```

#### 2. Production Build

```bash
# Clean previous build
npm run clean

# Type check
npm run typecheck

# Build frontend
npm run build

# Build services
npm run build:services
```

#### 3. Build Output

```
dist/
├── index.html                   # Entry HTML
├── assets/
│   ├── index-a1b2c3d4.js      # Main bundle (hashed)
│   ├── vendor-react-e5f6g7h8.js   # React vendor chunk
│   ├── vendor-three-i9j0k1l2.js   # Three.js vendor chunk
│   ├── vendor-state-m3n4o5p6.js   # State management chunk
│   ├── index-q7r8s9t0.css         # Compiled styles
│   └── logo-u1v2w3x4.png          # Static assets
└── favicon.ico
```

## Code Splitting

### Automatic Route-Based Splitting

```typescript
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Lazy load route components
const AssetViewer = lazy(() => import('./pages/AssetViewer'))
const BatchGeneration = lazy(() => import('./pages/BatchGeneration'))
const MaterialEditor = lazy(() => import('./pages/MaterialEditor'))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/viewer/:id" element={<AssetViewer />} />
          <Route path="/batch" element={<BatchGeneration />} />
          <Route path="/materials" element={<MaterialEditor />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
```

### Manual Chunk Configuration

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'vendor-react'
            }
            if (id.includes('three')) {
              return 'vendor-three'
            }
            if (id.includes('zustand')) {
              return 'vendor-state'
            }
          }

          // Feature chunks
          if (id.includes('/src/services/')) {
            return 'services'
          }
          if (id.includes('/src/utils/')) {
            return 'utils'
          }
        }
      }
    }
  }
})
```

### Dynamic Imports

```typescript
// Load heavy services on demand
async function loadSpriteGenerator() {
  const { SpriteGenerationService } = await import(
    '@/services/generation/SpriteGenerationService'
  )
  return new SpriteGenerationService()
}

// Load only when needed
button.addEventListener('click', async () => {
  const generator = await loadSpriteGenerator()
  await generator.generateSprites(options)
})
```

## Asset Optimization

### Image Optimization

```bash
# Install optimization tools
npm install -D vite-plugin-image-optimizer

# Add to vite.config.ts
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      png: {
        quality: 80
      },
      jpeg: {
        quality: 80
      },
      webp: {
        quality: 80
      }
    })
  ]
})
```

### 3D Model Optimization

```bash
# GLB file optimization
npm install -D gltf-pipeline

# Optimize models
npx gltf-pipeline -i input.glb -o output.glb --draco.compressionLevel 10
```

### Font Subsetting

```bash
# Only include used characters
npm install -D glyphhanger

# Generate subset
npx glyphhanger --subset=font.woff2 --formats=woff2
```

## Bundle Analysis

### Visualize Bundle Size

```bash
# Install analyzer
npm install -D rollup-plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true
    })
  ]
})

# Build and view
npm run build
# Opens stats.html in browser
```

### Bundle Size Limits

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000, // 1MB

    rollupOptions: {
      output: {
        // Warn on large chunks
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const packageName = id.split('node_modules/')[1].split('/')[0]

            // Split large packages
            if (packageName === 'three') {
              if (id.includes('/examples/')) {
                return 'three-examples'
              }
              return 'three-core'
            }
          }
        }
      }
    }
  }
})
```

## Environment Variables

### .env Files

```bash
# .env.development
VITE_API_URL=http://localhost:3004
VITE_GENERATION_API_URL=http://localhost:3001/api
VITE_IMAGE_SERVER_URL=http://localhost:8080
VITE_ENABLE_DEBUG=true

# .env.production
VITE_API_URL=https://api.assetforge.com
VITE_GENERATION_API_URL=https://generation.assetforge.com/api
VITE_IMAGE_SERVER_URL=https://images.assetforge.com
VITE_ENABLE_DEBUG=false

# .env.local (git-ignored, for local overrides)
VITE_OPENAI_API_KEY=sk-...
VITE_MESHY_API_KEY=msy_...
```

### Using Environment Variables

```typescript
// Access in code
const apiUrl = import.meta.env.VITE_API_URL
const isDebug = import.meta.env.VITE_ENABLE_DEBUG === 'true'

// Type-safe environment variables
interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_GENERATION_API_URL: string
  readonly VITE_IMAGE_SERVER_URL: string
  readonly VITE_ENABLE_DEBUG: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

## Build Artifacts

### Directory Structure

```
dist/
├── index.html                      # Entry point
├── assets/
│   ├── index-[hash].js            # Main application bundle
│   ├── vendor-react-[hash].js     # React vendor chunk
│   ├── vendor-three-[hash].js     # Three.js vendor chunk
│   ├── services-[hash].js         # Services chunk
│   ├── utils-[hash].js            # Utilities chunk
│   ├── index-[hash].css           # Compiled styles
│   ├── *.png, *.jpg, *.svg        # Optimized images
│   └── *.woff2                    # Font files
├── favicon.ico
└── manifest.json                   # PWA manifest (if configured)
```

### File Hashing

Vite automatically adds content hashes to filenames for cache busting:

```html
<!-- Before build -->
<script src="/src/main.tsx"></script>
<link rel="stylesheet" href="/src/index.css">

<!-- After build -->
<script src="/assets/index-a1b2c3d4.js"></script>
<link rel="stylesheet" href="/assets/index-e5f6g7h8.css">
```

## Deployment Checklist

### Pre-Build Checklist

- [ ] Run `npm run typecheck` - No TypeScript errors
- [ ] Run `npm test` - All tests passing
- [ ] Update version in `package.json`
- [ ] Review `.env.production` configuration
- [ ] Check bundle size with analyzer
- [ ] Verify all environment variables set
- [ ] Remove console.log statements (or use build plugin)
- [ ] Update CHANGELOG.md

### Build Process

```bash
# 1. Clean build artifacts
npm run clean

# 2. Install dependencies (fresh)
rm -rf node_modules package-lock.json
npm install

# 3. Type check
npm run typecheck

# 4. Run tests
npm test

# 5. Build for production
NODE_ENV=production npm run build

# 6. Build backend services
npm run build:services

# 7. Preview build locally
npm run preview
```

### Post-Build Verification

```bash
# Check bundle sizes
ls -lh dist/assets/

# Verify gzip sizes
for file in dist/assets/*.js; do
  echo "$file: $(gzip -c $file | wc -c) bytes (gzipped)"
done

# Test production build locally
npm run preview
# Visit http://localhost:4173

# Check for errors in console
# Verify all features work
# Test on different browsers/devices
```

### Build Optimization Tips

1. **Remove Unused Dependencies**
   ```bash
   npm install -D depcheck
   npx depcheck
   ```

2. **Tree-Shaking Check**
   ```typescript
   // Only import what you need
   import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
   // ❌ Don't: import * as THREE from 'three'
   ```

3. **Dynamic Imports for Large Libraries**
   ```typescript
   // Load TensorFlow only when needed
   async function loadHandDetection() {
     const tf = await import('@tensorflow/tfjs')
     const handpose = await import('@tensorflow-models/hand-pose-detection')
     return { tf, handpose }
   }
   ```

4. **Compress Static Assets**
   ```bash
   # Pre-compress assets
   find dist -type f \( -name '*.js' -o -name '*.css' \) -exec gzip -k {} \;
   find dist -type f \( -name '*.js' -o -name '*.css' \) -exec brotli -k {} \;
   ```

### CI/CD Integration

```yaml
# .github/workflows/build.yml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build
        env:
          NODE_ENV: production

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/

      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: npm run deploy
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

## Conclusion

The Asset Forge build process uses Vite for fast, optimized production builds with automatic code splitting and asset optimization. Follow the deployment checklist to ensure consistent, reliable builds every time.

**Key Takeaways:**
- Use Vite for lightning-fast builds
- Implement code splitting for optimal loading
- Analyze bundle sizes regularly
- Set environment variables correctly
- Verify builds before deployment
- Automate with CI/CD pipelines
