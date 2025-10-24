# Bundle Optimization Guide

**Location:** `packages/asset-forge/dev-book/14-deployment/bundle-optimization.md`

## Overview

This guide provides comprehensive strategies for optimizing bundle size in the Asset Forge application. It covers analysis, optimization techniques, and monitoring practices.

---

## Table of Contents

1. [Understanding Bundle Size](#understanding-bundle-size)
2. [Analysis Tools](#analysis-tools)
3. [Optimization Strategies](#optimization-strategies)
4. [Compression](#compression)
5. [Code Splitting](#code-splitting)
6. [Tree Shaking](#tree-shaking)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Quick Wins Checklist](#quick-wins-checklist)

---

## Understanding Bundle Size

### What is Bundle Size?

Bundle size refers to the total size of JavaScript, CSS, and other assets that need to be downloaded by the browser. Smaller bundles = faster load times = better user experience.

### Why Bundle Size Matters

**Impact on Performance:**
- Every 100 KB = ~10-50ms additional parse time
- Mobile users on slow connections are heavily impacted
- Larger bundles = higher bandwidth costs
- Poor Core Web Vitals = lower search rankings

**Asset Forge Bundle Breakdown:**

| Asset Type | Size (Uncompressed) | Size (Gzipped) | Size (Brotli) |
|-----------|---------------------|----------------|---------------|
| JavaScript | 6.68 MB | ~2.0 MB | ~1.5 MB |
| CSS | 74.62 KB | ~12 KB | ~10 KB |
| **Total** | **6.75 MB** | **~2.0 MB** | **~1.5 MB** |

**Note:** Users only download what they need:
- Initial load: ~1.5 MB (with lazy loading)
- Hand rigging: +660 KB (when used)
- Advanced 3D: +200 KB (when used)

---

## Analysis Tools

### 1. Built-in Bundle Analyzer

**Location:** `scripts/analyze-bundle.mjs`

**Usage:**
```bash
npm run build
node scripts/analyze-bundle.mjs
```

**Output:**
- Terminal visualization of bundle sizes
- Identifies chunks >500 KB
- Checks compression status
- Exports `bundle-analysis.json`

**Example Output:**
```
📦 JavaScript Bundles:
  vendor-other-jj0bN9_2.js                2.47 MB ████████████████████
  vendor-auth-CYYsUexV.js               766.46 KB ████████
  vendor-three-BRIq3so8.js              762.67 KB ████████

💡 Optimization Opportunities:
  ⚠️ Found 3 chunk(s) larger than 500KB
```

### 2. Vite Bundle Visualizer

**Installation:**
```bash
npm install -D rollup-plugin-visualizer
```

**Usage:**
```bash
npm run build
npx vite-bundle-visualizer
```

**Opens interactive treemap:**
- Visual representation of bundle composition
- Click to drill down into modules
- Identify largest dependencies
- See what's included in each chunk

### 3. Webpack Bundle Analyzer (Alternative)

```bash
npm install -D webpack-bundle-analyzer
```

### 4. Browser DevTools Network Tab

**Steps:**
1. Open DevTools → Network
2. Clear cache and hard reload
3. Filter by "JS" or "CSS"
4. Check "Disable cache"
5. Measure:
   - Total transfer size
   - Number of requests
   - Load waterfall

---

## Optimization Strategies

### 1. Lazy Loading (Highest Impact)

**Impact:** -2.5 MB initial bundle

**Strategy:** Load code only when needed

**Implementation:**

```typescript
// React components
const HeavyModal = lazy(() => import('@/components/HeavyModal'))

// Services
async function loadService() {
  const { Service } = await import('@/services/HeavyService')
  return new Service()
}

// Libraries
const tf = await import('@tensorflow/tfjs')
```

**See:** [Lazy Loading Guide](./lazy-loading-guide.md)

### 2. Code Splitting

**Impact:** Better caching, parallel downloads

**Strategy:** Split code into smaller chunks

**Vite Configuration:**

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: (id) => {
        // React core
        if (id.includes('react')) return 'vendor-react'

        // Three.js core
        if (id.includes('three') && !id.includes('examples')) {
          return 'vendor-three'
        }

        // Three.js addons (lazy loaded)
        if (id.includes('three/examples/jsm/loaders')) {
          return 'vendor-three-loaders'
        }

        // TensorFlow (lazy loaded)
        if (id.includes('@tensorflow')) {
          return 'vendor-tensorflow'
        }
      }
    }
  }
}
```

**Benefits:**
- Parallel downloads
- Better browser caching
- Smaller individual chunks
- Easier lazy loading

### 3. Tree Shaking

**Impact:** -10-30% for libraries with unused exports

**Strategy:** Remove unused code

**Enable in package.json:**
```json
{
  "sideEffects": false
}
```

**Use ES modules:**
```typescript
// ✅ Good: ES modules (tree-shakeable)
import { specific } from 'library'

// ❌ Bad: CommonJS (not tree-shakeable)
const library = require('library')
```

**Import only what you need:**
```typescript
// ✅ Good: Import specific functions
import { loadGLTFLoader } from '@/utils/three-lazy-loaders'

// ❌ Bad: Import entire library
import * as ThreeLoaders from 'three/examples/jsm/loaders'
```

### 4. Minification

**Impact:** -40-60% JavaScript size

**Vite Configuration (Terser):**

```typescript
build: {
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: true,      // Remove console.log
      drop_debugger: true,     // Remove debugger
      pure_funcs: ['console.log', 'console.debug'],
      passes: 2                // Multiple passes for better compression
    },
    mangle: {
      safari10: true           // Safari 10 compatibility
    },
    format: {
      comments: false          // Remove all comments
    }
  }
}
```

**Alternative: esbuild (faster, less compression):**
```typescript
build: {
  minify: 'esbuild' // Faster build, ~5% larger than terser
}
```

### 5. Compression

**Impact:** -70-80% transfer size

**Gzip vs Brotli:**

| Compression | Reduction | Browser Support | Speed |
|------------|-----------|----------------|-------|
| Gzip | ~70% | All browsers | Fast |
| Brotli | ~75-80% | Modern browsers | Slower build |

**Vite Configuration:**

```typescript
import compression from 'vite-plugin-compression'

plugins: [
  // Gzip
  compression({
    algorithm: 'gzip',
    ext: '.gz',
    threshold: 10240  // Only compress files >10KB
  }),
  // Brotli
  compression({
    algorithm: 'brotliCompress',
    ext: '.br',
    threshold: 10240
  })
]
```

**Server Configuration (Express):**

```javascript
import compression from 'compression'

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false
    }
    return compression.filter(req, res)
  }
}))
```

### 6. Dead Code Elimination

**Impact:** Varies by codebase

**Tools:**

```bash
# Find unused exports
npx ts-prune

# Find unused dependencies
npx depcheck

# Find unused files
npx knip
```

**Manual Review:**
1. Search for TODOs and remove completed ones
2. Remove commented code
3. Remove unused imports
4. Remove unused utility functions

### 7. Dependency Optimization

**Impact:** -100 KB to -1 MB depending on alternatives

**Strategies:**

**Replace large libraries:**
```typescript
// ❌ Bad: Lodash (70 KB)
import _ from 'lodash'

// ✅ Good: Individual imports (5-10 KB)
import debounce from 'lodash/debounce'
import throttle from 'lodash/throttle'

// ✅ Better: Native alternatives (0 KB)
const debounce = (fn, delay) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}
```

**Use lighter alternatives:**
- `date-fns` instead of `moment.js` (saves ~50 KB)
- `clsx` instead of `classnames` (saves ~5 KB)
- Native `fetch` instead of `axios` (saves ~15 KB)

### 8. Asset Optimization

**Images:**
```bash
# Convert to WebP
npx @squoosh/cli --webp auto image.png

# Optimize PNGs
npx imagemin image.png --plugin=pngquant

# Lazy load images
<img loading="lazy" src="image.png" />
```

**Fonts:**
```css
/* Subset fonts to include only used characters */
@font-face {
  font-family: 'CustomFont';
  src: url('font.woff2') format('woff2');
  font-display: swap; /* Prevent blocking */
  unicode-range: U+0020-007F; /* Latin characters only */
}
```

---

## Compression

### Enabling Compression

**Production (Vercel/Netlify):**
- Automatic compression enabled
- Serves `.br` or `.gz` files automatically
- Falls back to uncompressed if not supported

**Development (Testing Compression Locally):**

```bash
# Install serve
npm install -g serve

# Serve with compression
serve -l 3000 dist -s --compress
```

### Verifying Compression

**Browser DevTools:**
1. Network tab → Select a JS file
2. Headers → Response Headers
3. Look for: `content-encoding: br` or `content-encoding: gzip`

**curl:**
```bash
curl -I -H "Accept-Encoding: br, gzip" https://your-app.com/assets/vendor-three.js
# Look for: content-encoding: br
```

### Compression Comparison

**Example: vendor-three.js**

| Type | Size | Savings |
|------|------|---------|
| Uncompressed | 763 KB | - |
| Gzip | 192 KB | 75% |
| Brotli | 155 KB | 80% |

---

## Code Splitting

### Automatic Code Splitting

Vite automatically splits:
- Each dynamic `import()` → New chunk
- Vendor dependencies → Separate chunks
- CSS → Separate files

### Manual Code Splitting

**Route-based:**
```typescript
const routes = {
  '/': lazy(() => import('./pages/HomePage')),
  '/assets': lazy(() => import('./pages/AssetsPage')),
  '/admin': lazy(() => import('./pages/AdminPage'))
}
```

**Feature-based:**
```typescript
// Only load when feature is used
async function useHandRigging() {
  const { HandRiggingService } = await import('@/services/hand-rigging')
  return new HandRiggingService()
}
```

**Component-based:**
```typescript
// Heavy chart library
const HeavyChart = lazy(() => import('@/components/HeavyChart'))

// Use only when needed
{showChart && (
  <Suspense fallback={<ChartSkeleton />}>
    <HeavyChart data={data} />
  </Suspense>
)}
```

### Chunk Naming Strategy

```typescript
output: {
  chunkFileNames: 'assets/[name]-[hash].js',
  entryFileNames: 'assets/[name]-[hash].js',
  assetFileNames: 'assets/[name]-[hash].[ext]'
}
```

**Benefits:**
- Descriptive names for debugging
- Cache busting with hash
- Organized in `assets/` folder

---

## Tree Shaking

### Enabling Tree Shaking

**1. Use ES Modules:**
```json
// package.json
{
  "type": "module"
}
```

**2. Mark side-effect-free:**
```json
// package.json
{
  "sideEffects": false
}
```

**3. Use named imports:**
```typescript
// ✅ Tree-shakeable
import { function1 } from 'library'

// ❌ Not tree-shakeable
import * as library from 'library'
```

### Verifying Tree Shaking

**Build and analyze:**
```bash
npm run build
npx vite-bundle-visualizer
```

**Look for:**
- Unused exports should not appear in bundle
- Only imported functions should be included

### Common Tree Shaking Issues

**1. Side effects:**
```typescript
// ❌ Has side effects (runs on import)
export const config = setupConfig()

// ✅ No side effects (lazy initialization)
let config = null
export function getConfig() {
  if (!config) config = setupConfig()
  return config
}
```

**2. Default exports:**
```typescript
// ❌ Less tree-shakeable
export default { func1, func2, func3 }

// ✅ More tree-shakeable
export { func1, func2, func3 }
```

---

## Monitoring & Maintenance

### Automated Monitoring

**1. Bundle Size Budget:**

```json
// package.json
{
  "scripts": {
    "build": "vite build",
    "analyze": "node scripts/analyze-bundle.mjs",
    "check-size": "npm run build && npm run analyze && node scripts/check-budget.mjs"
  }
}
```

**2. CI/CD Integration:**

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size Check

on: [pull_request]

jobs:
  check-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build
        run: npm run build
      - name: Analyze
        run: node scripts/analyze-bundle.mjs
      - name: Check Budget
        run: |
          TOTAL_SIZE=$(jq '.totalSize' bundle-analysis.json)
          if [ $TOTAL_SIZE -gt 7000000 ]; then
            echo "Bundle size exceeds 7 MB!"
            exit 1
          fi
```

**3. Performance Budgets:**

```javascript
// vite.config.ts
build: {
  chunkSizeWarningLimit: 1000, // Warn if chunk > 1 MB
  reportCompressedSize: true
}
```

### Regular Audits

**Monthly Checklist:**
- [ ] Run bundle analyzer
- [ ] Check for large dependencies
- [ ] Review lazy loading opportunities
- [ ] Update dependencies
- [ ] Remove unused code
- [ ] Compare with previous month

**Tools:**
```bash
# Analyze bundle
npm run build && node scripts/analyze-bundle.mjs

# Check for unused dependencies
npx depcheck

# Find unused exports
npx ts-prune

# Check for outdated packages
npm outdated
```

---

## Quick Wins Checklist

### Easy Wins (< 1 hour)

- [ ] Enable Gzip/Brotli compression
- [ ] Enable Terser minification
- [ ] Add `"sideEffects": false` to package.json
- [ ] Use production build (`NODE_ENV=production`)
- [ ] Remove `console.log` in production

### Medium Wins (1-4 hours)

- [ ] Lazy load modals and dialogs
- [ ] Lazy load heavy libraries (TensorFlow, Three.js loaders)
- [ ] Code split by route
- [ ] Replace large dependencies with lighter alternatives
- [ ] Remove unused dependencies

### Advanced Wins (4+ hours)

- [ ] Implement route-based code splitting
- [ ] Split vendor chunks by library
- [ ] Lazy load images and fonts
- [ ] Implement service worker caching
- [ ] Set up bundle size monitoring in CI/CD

---

## Bundle Size Goals

### Initial Load Targets

| Bundle Type | Target | Current | Status |
|------------|--------|---------|--------|
| JavaScript (gzipped) | < 500 KB | ~600 KB | ⚠️ Near target |
| CSS (gzipped) | < 50 KB | 12 KB | ✅ Good |
| Fonts | < 100 KB | N/A | ✅ Good |
| Images | < 200 KB | Varies | ⚠️ Optimize |

### Total Bundle Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Total JS (uncompressed) | < 7 MB | 6.68 MB | ✅ Good |
| Total JS (brotli) | < 1.5 MB | ~1.5 MB | ✅ Good |
| Number of chunks | < 100 | 59 | ✅ Good |
| Largest chunk | < 1 MB | 2.5 MB | ⚠️ vendor-other |

---

## Summary

**Key Optimizations:**
1. ✅ Lazy loading (TensorFlow, MediaPipe, modals)
2. ✅ Code splitting (granular vendor chunks)
3. ✅ Compression (gzip + brotli)
4. ✅ Minification (Terser with aggressive options)
5. ✅ Tree shaking (ES modules, named imports)

**Results:**
- Initial load: ~1.5 MB (brotli)
- Lazy-loaded features: +660 KB when used
- Total bundle: 6.75 MB → ~1.5 MB compressed

**Next Steps:**
- Monitor bundle size in CI/CD
- Continue optimizing vendor-other chunk
- Implement service worker caching
- Optimize images and fonts

---

## References

- [Vite Performance Documentation](https://vitejs.dev/guide/performance.html)
- [Web.dev: Optimize Bundle Size](https://web.dev/optimize-javascript/)
- [Webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [Bundle Size Guide](https://bundlephobia.com/)

**Last Updated:** 2025-10-24
