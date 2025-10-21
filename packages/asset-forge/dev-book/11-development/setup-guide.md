# Development Environment Setup Guide

This comprehensive guide walks you through setting up your local development environment for the Asset Forge project, from initial installation to running the application in development mode with full debugging capabilities.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Repository Setup](#repository-setup)
- [Dependency Installation](#dependency-installation)
- [Environment Configuration](#environment-configuration)
- [Running in Development Mode](#running-in-development-mode)
- [Hot Reload Configuration](#hot-reload-configuration)
- [DevTools Setup](#devtools-setup)
- [Browser Extensions](#browser-extensions)
- [Debugging Setup](#debugging-setup)
- [Git Workflow](#git-workflow)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure your development machine meets these requirements:

### Required Software

**Node.js 18.0.0 or higher**
```bash
# Check your Node.js version
node --version

# If you need to install or upgrade Node.js:
# Using nvm (recommended)
nvm install 18
nvm use 18

# Or download from https://nodejs.org/
```

**Bun Runtime (Recommended)**

Asset Forge is optimized to use Bun for faster dependency installation and execution:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

**Git**
```bash
# Check Git version
git --version

# Install if needed (macOS)
xcode-select --install

# Or download from https://git-scm.com/
```

### Recommended Software

**IDE/Editor**

We recommend Visual Studio Code with the following extensions:
- ESLint
- Prettier - Code formatter
- TypeScript and JavaScript Language Features
- Error Lens (for inline error display)
- ES7+ React/Redux/React-Native snippets
- Auto Rename Tag
- Tailwind CSS IntelliSense

**Package Manager Alternative**

If you prefer not to use Bun, npm (comes with Node.js) works perfectly:
```bash
# Verify npm installation
npm --version
```

### API Access

You'll need API keys for the following services:

**OpenAI API** (Required)
- Sign up at https://platform.openai.com/
- Generate an API key from your dashboard
- Used for GPT-4 prompt enhancement and DALL-E image generation

**Meshy.ai API** (Required)
- Sign up at https://www.meshy.ai/
- Get your API key from the dashboard
- Used for 3D model generation and retexturing

### System Requirements

- **RAM**: Minimum 8GB, 16GB recommended for smooth Three.js rendering
- **Storage**: At least 2GB free space for dependencies and generated assets
- **GPU**: Dedicated GPU recommended for optimal 3D performance
- **Display**: 1920x1080 or higher resolution recommended

## Repository Setup

### Clone the Repository

First, clone the Hyperscape monorepo which contains the Asset Forge package:

```bash
# Clone via HTTPS
git clone https://github.com/your-org/hyperscape-1.git

# Or via SSH (recommended for contributors)
git clone git@github.com:your-org/hyperscape-1.git

# Navigate to the project
cd hyperscape-1/packages/asset-forge
```

### Verify Project Structure

Ensure you're in the correct directory:

```bash
# You should see these key directories and files:
ls -la

# Expected output should include:
# - src/              (React application source)
# - server/           (Express.js backend)
# - public/           (Static assets)
# - gdd-assets/       (Generated 3D assets)
# - package.json
# - tsconfig.json
# - vite.config.ts
```

### Repository Permissions

If you're a contributor, ensure you have the correct permissions:

```bash
# Configure Git user
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Set up SSH key if using SSH clone (recommended)
# See: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
```

## Dependency Installation

### Using Bun (Recommended)

Bun offers significantly faster installation times:

```bash
# Navigate to asset-forge directory
cd packages/asset-forge

# Install all dependencies
bun install

# This typically takes 30-60 seconds with Bun
# vs 2-5 minutes with npm
```

### Using NPM

If you prefer npm or encounter issues with Bun:

```bash
# Navigate to asset-forge directory
cd packages/asset-forge

# Install all dependencies
npm install

# For a clean install (removes existing node_modules):
rm -rf node_modules package-lock.json
npm install
```

### Dependency Overview

Asset Forge uses these major dependencies:

**Frontend:**
- React 19.2 - UI framework
- Vite 6.0 - Build tool and dev server
- Three.js 0.178 - 3D graphics library
- @react-three/fiber - React renderer for Three.js
- @react-three/drei - Three.js helpers
- Zustand 5.0 - State management
- Tailwind CSS 3.3 - Utility-first CSS

**Backend:**
- Express 4.18 - Web server
- Node-fetch 3.3 - HTTP client for API calls

**Development:**
- TypeScript 5.3 - Type safety
- ESLint 9.33 - Code linting
- Vite plugins - React support and optimizations

### Verify Installation

Check that dependencies installed correctly:

```bash
# List installed packages
bun pm ls

# Or with npm
npm list --depth=0

# Check for vulnerabilities (optional but recommended)
npm audit
```

## Environment Configuration

### Create Environment File

Copy the example environment file and configure it:

```bash
# From the asset-forge directory
cp env.example .env
```

### Configure API Keys

Edit the `.env` file with your actual API keys:

```bash
# Open in your preferred editor
code .env

# Or use nano
nano .env
```

**Required Environment Variables:**

```text
# OpenAI Configuration (REQUIRED)
VITE_OPENAI_API_KEY=sk-proj-your-actual-openai-key-here
OPENAI_API_KEY=sk-proj-your-actual-openai-key-here

# Meshy.ai Configuration (REQUIRED)
VITE_MESHY_API_KEY=your-meshy-api-key-here
MESHY_API_KEY=your-meshy-api-key-here

# Server Configuration
API_PORT=3004
IMAGE_SERVER_PORT=8081

# Image Server URLs
VITE_IMAGE_SERVER_URL=http://localhost:8081
IMAGE_SERVER_URL=http://localhost:8081

# API URLs
VITE_GENERATION_API_URL=http://localhost:3004/api

# Pipeline Configuration
VITE_PIPELINE_POLL_INTERVAL_MS=1500
VITE_DEBUG_PIPELINE=false

# Meshy Polling (server-side)
MESHY_POLL_INTERVAL_MS=5000
MESHY_TIMEOUT_MS=900000

# Meshy Quality-Specific Timeouts (optional)
MESHY_TIMEOUT_STANDARD_MS=600000
MESHY_TIMEOUT_HIGH_MS=1200000
MESHY_TIMEOUT_ULTRA_MS=1800000

# Meshy Model Selection (optional)
MESHY_MODEL_DEFAULT=meshy-5
MESHY_MODEL_STANDARD=meshy-5
MESHY_MODEL_HIGH=meshy-5
MESHY_MODEL_ULTRA=meshy-5
```

### Important Notes About Environment Variables

**VITE_ Prefix:**
Variables prefixed with `VITE_` are exposed to the frontend client. Never put sensitive backend-only secrets in `VITE_` variables unless they're meant to be public.

**Dual Configuration:**
Some variables appear twice (with and without `VITE_`):
- `VITE_OPENAI_API_KEY` - Used by frontend
- `OPENAI_API_KEY` - Used by backend server

This dual configuration allows both frontend and backend to access the same API keys.

**Security Best Practices:**
- Never commit `.env` to version control (it's in `.gitignore`)
- Rotate API keys regularly
- Use different keys for development and production
- Keep API keys secure and don't share them

### Verify Configuration

Test that your environment is configured correctly:

```bash
# Check that .env file exists
ls -la .env

# Verify environment variables are loaded (don't print sensitive values!)
node -e "require('dotenv').config(); console.log('MESHY_API_KEY:', process.env.MESHY_API_KEY ? 'Set ✓' : 'Not Set ✗')"
```

## Running in Development Mode

Asset Forge runs two services simultaneously: the frontend (Vite dev server) and the backend (Express API server).

### Start All Services

**Using the convenient all-in-one command:**

```bash
# Start both frontend and backend together
bun run dev

# Or with npm
npm run dev
```

This single command starts:
1. Vite development server on `http://localhost:3000`
2. Express API server on `http://localhost:3004`
3. Image server on `http://localhost:8081`

### Start Services Separately

For more control, you can run services in separate terminal windows:

**Terminal 1 - Frontend:**
```bash
bun run dev:frontend

# Or with npm
npm run dev:frontend
```

The frontend will be available at `http://localhost:3000`

**Terminal 2 - Backend:**
```bash
bun run dev:backend

# Or with npm
npm run dev:backend
```

The backend API will run on `http://localhost:3004`

**Terminal 3 - Image Server (if needed separately):**
```bash
bun run dev:images

# Or with npm
npm run dev:images
```

### Verify Services Are Running

**Check Frontend:**
```bash
# Open in browser
open http://localhost:3000

# Or using curl
curl http://localhost:3000
```

**Check Backend:**
```bash
# Health check endpoint
curl http://localhost:3004/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2024-10-21T...",
#   "services": {
#     "meshy": true,
#     "openai": true
#   }
# }
```

**Check Asset Serving:**
```bash
# List all assets
curl http://localhost:3004/api/assets

# Expected: JSON array of assets
```

### Development Server Features

**Vite Dev Server (Frontend):**
- Hot Module Replacement (HMR) for instant updates
- Fast refresh for React components
- Source maps for debugging
- Proxy configuration to backend API
- Optimized dependency pre-bundling

**Express Server (Backend):**
- Automatic restart on file changes (via concurrently)
- CORS enabled for local development
- Request logging
- Error handling middleware
- Static file serving for assets

### Port Configuration

If you need to change ports (due to conflicts):

**Edit `.env`:**
```text
# Frontend port is configured in vite.config.ts
# Backend API port
API_PORT=3005  # Change from 3004

# Image server port
IMAGE_SERVER_PORT=8082  # Change from 8081
```

**Edit `vite.config.ts` for frontend port:**
```typescript
export default defineConfig({
  // ...
  server: {
    port: 3001,  // Change from 3000
    // ...
  }
})
```

## Hot Reload Configuration

Asset Forge uses Vite's Fast Refresh for near-instant hot reloading.

### How It Works

**React Fast Refresh:**
- Component state is preserved during updates
- Only changed modules are replaced
- Edits typically reflect in < 100ms

**What Triggers Reload:**
- TypeScript/TSX file changes in `src/`
- CSS/Tailwind changes
- Configuration file changes (triggers full reload)
- Environment variable changes (requires restart)

### Optimizing HMR Performance

**1. Reduce Component Complexity:**
```typescript
// Bad - Large component slows HMR
export function MassiveComponent() {
  // 500+ lines of code
}

// Good - Split into smaller components
export function FeatureContainer() {
  return (
    <>
      <Header />
      <MainContent />
      <Sidebar />
      <Footer />
    </>
  )
}
```

**2. Use Lazy Loading for Large Dependencies:**
```typescript
// Lazy load Three.js components
const ThreeViewer = lazy(() => import('@/components/shared/ThreeViewer'))

function AssetView() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ThreeViewer />
    </Suspense>
  )
}
```

**3. Configure Vite Optimization:**

Already configured in `vite.config.ts`:
```typescript
export default defineConfig({
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
    esbuildOptions: {
      resolveExtensions: ['.mjs', '.js', '.jsx', '.json', '.ts', '.tsx']
    }
  }
})
```

### Troubleshooting HMR

**HMR Not Working:**
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Restart dev server
bun run dev:frontend
```

**Full Page Reload on Every Change:**
- Check for syntax errors in React components
- Ensure components are exported correctly
- Verify no circular dependencies exist

## DevTools Setup

Proper DevTools configuration is essential for productive development.

### React DevTools

**Installation:**

Install the React DevTools browser extension:
- [Chrome Extension](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- [Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

**Usage:**

1. Open your browser DevTools (F12 or Cmd+Option+I on Mac)
2. Navigate to the "Components" tab
3. Inspect React component tree
4. View component props and state
5. Profile component render performance

**Key Features:**
- Component tree navigation
- Props and state inspection
- Hooks inspection
- Performance profiler
- Component source code navigation

### Redux DevTools for Zustand

Asset Forge uses Zustand with Redux DevTools middleware for state debugging.

**Installation:**

Install the Redux DevTools extension:
- [Chrome Extension](https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd)
- [Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/reduxdevtools/)

**Configuration:**

Already enabled in stores (e.g., `useGenerationStore.ts`):
```typescript
export const useGenerationStore = create<GenerationState>()(
  devtools(  // Redux DevTools integration
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Store implementation
        }))
      )
    ),
    { name: 'GenerationStore' }  // Store name in DevTools
  )
)
```

**Usage:**

1. Open Redux DevTools in browser
2. Select the store (e.g., "GenerationStore")
3. View state tree
4. Inspect actions and state changes
5. Time-travel debugging

**Available Stores:**
- `GenerationStore` - Asset generation state
- `AssetsStore` - Asset library state
- `ArmorFittingStore` - Armor fitting state
- `HandRiggingStore` - Hand rigging state
- `DebuggerStore` - Debug configuration

### Browser Console Configuration

**Enable Verbose Logging:**

```text
# In .env file
VITE_DEBUG_PIPELINE=true
```

Then in browser console:
```javascript
// Enable all logs
localStorage.debug = '*'

// Enable specific logs
localStorage.debug = 'asset-forge:*'

// Disable logs
localStorage.debug = ''
```

## Browser Extensions

### Essential Extensions

**ESLint (VS Code)**
- Real-time linting in editor
- Auto-fix on save
- Configured via `.eslintrc.cjs`

**Tailwind CSS IntelliSense (VS Code)**
- Autocomplete for Tailwind classes
- Class name validation
- Color preview

**TypeScript Vue Plugin (VS Code)**
- Enhanced TypeScript support
- Better JSX/TSX intellisense

### Recommended Chrome Extensions

**Three.js Inspector**
- Inspect Three.js scene hierarchy
- View material properties
- Debug lighting and cameras

Installation: Search Chrome Web Store for "Three.js Inspector"

**Lighthouse**
- Performance auditing
- Accessibility checking
- Best practices analysis

Built into Chrome DevTools (Lighthouse tab)

**JSON Viewer**
- Format API responses
- Syntax highlighting for JSON
- Collapsible tree view

## Debugging Setup

### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome against localhost",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/src",
      "sourceMapPathOverrides": {
        "webpack:///src/*": "${webRoot}/*"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend API",
      "program": "${workspaceFolder}/server/api.mjs",
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### Frontend Debugging

**Browser DevTools Breakpoints:**
1. Open DevTools (F12)
2. Navigate to Sources tab
3. Find your file in the tree
4. Click line number to set breakpoint
5. Trigger the code path

**Console Debugging:**
```typescript
// Strategic console.log placement
console.log('Asset loaded:', asset)
console.table(assets)  // Nice table format
console.group('Generation Pipeline')
console.log('Stage 1: Complete')
console.groupEnd()
```

**React Error Boundaries:**

Already implemented in `ErrorBoundary.tsx`:
```typescript
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

### Backend Debugging

**Node.js Debugging:**
```bash
# Start backend with inspector
node --inspect server/api.mjs

# Or with break on first line
node --inspect-brk server/api.mjs
```

Then attach Chrome DevTools:
1. Open `chrome://inspect`
2. Click "inspect" under Remote Target
3. Set breakpoints in DevTools

**Log Debugging:**
```javascript
// server/api.mjs
console.log('[API] Request received:', req.method, req.url)
console.log('[Generation] Starting pipeline:', config)
```

### Source Maps

Source maps are enabled by default in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "sourceMap": true,
    "declarationMap": true
  }
}
```

This allows debugging TypeScript directly in browser DevTools.

## Git Workflow

### Branch Naming Conventions

Follow these conventions for branch names:

```bash
# Feature branches
git checkout -b feature/asset-type-selector
git checkout -b feature/sprite-generation

# Bug fixes
git checkout -b fix/texture-loading-error
git checkout -b fix/memory-leak-three-scene

# Refactoring
git checkout -b refactor/state-management
git checkout -b refactor/component-structure

# Documentation
git checkout -b docs/api-endpoints
git checkout -b docs/setup-guide

# Chores (maintenance, dependency updates)
git checkout -b chore/update-dependencies
git checkout -b chore/cleanup-unused-code
```

### Commit Message Conventions

Use semantic commit messages:

```bash
# Format: type(scope): description

# Examples:
git commit -m "feat(generation): add custom material prompt editor"
git commit -m "fix(viewer): resolve Three.js memory leak on unmount"
git commit -m "refactor(store): consolidate asset state management"
git commit -m "docs(setup): add environment configuration guide"
git commit -m "style(ui): improve button spacing and colors"
git commit -m "test(api): add asset service integration tests"
git commit -m "chore(deps): update three.js to v0.178"
```

**Commit Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `style` - Formatting, styling
- `test` - Adding tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements

### Workflow Steps

**1. Create Feature Branch:**
```bash
# Update main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name
```

**2. Make Changes:**
```bash
# Stage changes
git add .

# Or stage specific files
git add src/components/NewFeature.tsx

# Commit with semantic message
git commit -m "feat(ui): add new feature component"
```

**3. Push to Remote:**
```bash
# First push (set upstream)
git push -u origin feature/your-feature-name

# Subsequent pushes
git push
```

**4. Create Pull Request:**
- Go to GitHub repository
- Click "New Pull Request"
- Select your branch
- Fill in PR template
- Request reviews

**5. Address Review Feedback:**
```bash
# Make changes
git add .
git commit -m "fix(review): address PR feedback"
git push
```

**6. Merge:**
- Once approved, merge PR via GitHub UI
- Delete feature branch after merge

### Pre-commit Checks

**Run Before Committing:**
```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Format check (if using Prettier)
npx prettier --check src/
```

### Gitignore

Key ignored files (already in `.gitignore`):
```text
node_modules/
dist/
.env
.DS_Store
*.log
gdd-assets/*/  # Generated assets (large files)
```

## Troubleshooting

### Common Issues and Solutions

**Issue: Port Already in Use**
```bash
# Error: EADDRINUSE :::3000

# Solution 1: Change port in .env
API_PORT=3005

# Solution 2: Kill process using port
lsof -ti:3000 | xargs kill -9
```

**Issue: API Keys Not Loading**
```bash
# Error: OpenAI API error: 401

# Solution: Verify .env file
cat .env | grep OPENAI_API_KEY

# Ensure variables are set correctly
# Restart dev server after changing .env
```

**Issue: Vite Cache Issues**
```bash
# Error: Module not found or stale imports

# Solution: Clear Vite cache
rm -rf node_modules/.vite
bun run dev:frontend
```

**Issue: Three.js Performance Problems**
```text
# Solution 1: Enable GPU acceleration in browser
# Chrome: chrome://flags/#ignore-gpu-blocklist

# Solution 2: Reduce model complexity
# Use lower poly models for development

# Solution 3: Monitor performance
# Open Performance tab in DevTools
```

**Issue: TypeScript Errors**
```text
# Error: Cannot find module '@/components/...'

# Solution: Check tsconfig.json paths
```

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}

# Restart TS server in VS Code
# Cmd+Shift+P > "TypeScript: Restart TS Server"
```

**Issue: CORS Errors**
```text
# Error: CORS policy blocked

# Solution: Verify Vite proxy configuration
# vite.config.ts should have:
```

```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3004'
  }
}
```

**Issue: Memory Leaks with Three.js**
```typescript
// Solution: Proper cleanup in useEffect
useEffect(() => {
  const scene = new THREE.Scene()
  // ... setup

  return () => {
    // Cleanup
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        object.material.dispose()
      }
    })
  }
}, [])
```

### Getting Help

**Internal Resources:**
- Check project README: `/packages/asset-forge/README.md`
- Review other documentation in `/packages/asset-forge/dev-book/`
- Search existing GitHub issues

**External Resources:**
- Vite documentation: https://vitejs.dev/
- React documentation: https://react.dev/
- Three.js documentation: https://threejs.org/docs/
- Zustand documentation: https://zustand.docs.pmnd.rs/

**Community:**
- Open an issue on GitHub
- Ask in team Slack/Discord
- Consult with senior developers

### Development Checklist

Before you start development, ensure:

- [ ] Node.js 18+ installed
- [ ] Bun or npm available
- [ ] Git configured with user name/email
- [ ] Repository cloned
- [ ] Dependencies installed (`bun install`)
- [ ] `.env` file created and configured
- [ ] API keys added to `.env`
- [ ] Dev servers start without errors (`bun run dev`)
- [ ] Frontend accessible at `http://localhost:3000`
- [ ] Backend health check passes
- [ ] React DevTools extension installed
- [ ] Redux DevTools extension installed
- [ ] VS Code with recommended extensions
- [ ] Git branch workflow understood
- [ ] Commit message conventions reviewed

You're now ready to start developing with Asset Forge!
