# Code Standards and Conventions

This document defines the coding standards, naming conventions, and best practices for the Asset Forge project. Following these standards ensures consistency, maintainability, and code quality across the codebase.

## Table of Contents

- [TypeScript Standards](#typescript-standards)
- [Naming Conventions](#naming-conventions)
- [File Organization](#file-organization)
- [Import Ordering](#import-ordering)
- [Component Structure](#component-structure)
- [State Management Patterns](#state-management-patterns)
- [Error Handling Patterns](#error-handling-patterns)
- [Async/Await Usage](#asyncawait-usage)
- [Three.js Resource Cleanup](#threejs-resource-cleanup)
- [ESLint Configuration](#eslint-configuration)
- [Prettier Setup](#prettier-setup)
- [Code Review Checklist](#code-review-checklist)

## TypeScript Standards

Asset Forge enforces strict TypeScript standards to ensure type safety and prevent runtime errors.

### Strict Mode Enabled

The project uses TypeScript strict mode (`tsconfig.json`):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  }
}
```

### No `any` Types

**Rule:** Never use `any` or `unknown` types. Always provide explicit types.

**Bad:**
```typescript
// DON'T DO THIS
function processAsset(data: any) {
  return data.name
}

const result: any = await fetchData()
```

**Good:**
```typescript
// DO THIS
import type { Asset } from '@/services/api/AssetService'

function processAsset(data: Asset): string {
  return data.name
}

const result: Asset[] = await fetchAssets()
```

### Type Definitions

**Prefer interfaces for object shapes:**
```typescript
// Good
interface AssetMetadata {
  id: string
  name: string
  type: AssetType
  createdAt: string
}
```

**Use type aliases for unions and complex types:**
```typescript
// Good
type AssetType = 'weapon' | 'armor' | 'tool' | 'resource' | 'character'
type AssetOrNull = Asset | null
type AsyncAssetResult = Promise<Asset | null>
```

### Explicit Return Types

**Always specify return types for public functions:**

```typescript
// Bad - implicit return type
export function getAssetById(id: string) {
  return assets.find(a => a.id === id)
}

// Good - explicit return type
export function getAssetById(id: string): Asset | undefined {
  return assets.find(a => a.id === id)
}
```

**Exception:** Simple one-liner arrow functions in local scope:
```typescript
// Acceptable
const filtered = assets.filter(a => a.type === 'weapon')
```

### Type Imports

**Use `import type` for type-only imports:**

```typescript
// Good
import type { Asset, AssetMetadata } from '@/types'
import type { Vector3 } from 'three'

// Bad
import { Asset, AssetMetadata } from '@/types'
```

**Combined imports:**
```typescript
// When importing both types and values
import { AssetService } from '@/services/api/AssetService'
import type { Asset } from '@/services/api/AssetService'

// Or separate type and value imports
import type { Asset } from '@/services/api/AssetService'
import { AssetService } from '@/services/api/AssetService'
```

### Non-null Assertions

**Use with caution, only when you're certain:**

```typescript
// Acceptable when you know the value exists
const asset = assets.find(a => a.id === selectedId)!

// Better - handle the null case explicitly
const asset = assets.find(a => a.id === selectedId)
if (!asset) {
  throw new Error(`Asset ${selectedId} not found`)
}
```

### Type Guards

**Create type guards for complex type narrowing:**

```typescript
// Good
export function isBaseAsset(metadata: AssetMetadata): metadata is BaseAssetMetadata {
  return metadata.isBaseModel === true
}

export function isVariantAsset(metadata: AssetMetadata): metadata is VariantAssetMetadata {
  return metadata.isVariant === true
}

// Usage
if (isBaseAsset(asset.metadata)) {
  // TypeScript knows this is BaseAssetMetadata
  console.log(asset.metadata.variants)
}
```

### Discriminated Unions

**Use discriminated unions for variant types:**

```typescript
// Good
type GenerationStage =
  | { stage: 'image'; result: ImageGenerationResult }
  | { stage: 'model'; result: ModelGenerationResult }
  | { stage: 'remesh'; result: RemeshResult }

function handleStage(stage: GenerationStage): void {
  switch (stage.stage) {
    case 'image':
      // TypeScript knows stage.result is ImageGenerationResult
      console.log(stage.result.imageUrl)
      break
    case 'model':
      // TypeScript knows stage.result is ModelGenerationResult
      console.log(stage.result.modelUrl)
      break
  }
}
```

## Naming Conventions

Consistent naming makes code more readable and maintainable.

### Components

**PascalCase for component names:**

```typescript
// Component files
AssetDetailsPanel.tsx
ThreeViewer.tsx
MaterialVariantsCard.tsx

// Component definition
export function AssetDetailsPanel() {
  return <div>...</div>
}

// Default export (when needed)
export default function HandRiggingPage() {
  return <div>...</div>
}
```

### Functions and Variables

**camelCase for functions, variables, and parameters:**

```typescript
// Functions
function calculateBoundingBox(mesh: THREE.Mesh): BoundingBox {
  // ...
}

async function fetchAssetMetadata(id: string): Promise<AssetMetadata> {
  // ...
}

// Variables
const assetList = await fetchAssets()
const selectedMaterial = 'bronze'
const isGenerating = false
```

### Constants

**UPPER_SNAKE_CASE for true constants:**

```typescript
// Good
const API_BASE_URL = 'http://localhost:3004/api'
const MAX_RETRIES = 3
const DEFAULT_TIMEOUT_MS = 5000

// Configuration objects use PascalCase
const MaterialPresets = {
  Bronze: { color: '#CD7F32', tier: 1 },
  Steel: { color: '#C0C0C0', tier: 2 }
} as const
```

### Private Members

**Prefix with underscore (optional but recommended):**

```typescript
class AssetService {
  private _cache: Map<string, Asset> = new Map()
  private _assetsDir: string

  constructor(assetsDir: string) {
    this._assetsDir = assetsDir
  }

  private _loadFromCache(id: string): Asset | undefined {
    return this._cache.get(id)
  }
}
```

### Type Names

**PascalCase for types and interfaces:**

```typescript
// Interfaces
interface AssetMetadata { }
interface GenerationConfig { }

// Type aliases
type AssetType = 'weapon' | 'armor'
type Vector3 = { x: number; y: number; z: number }

// Enums (avoid when possible, prefer union types)
enum ProcessingStatus {
  Idle = 'idle',
  Processing = 'processing',
  Complete = 'complete'
}
```

### Zustand Stores

**use[Name]Store pattern:**

```typescript
// Store files
useGenerationStore.ts
useAssetsStore.ts
useArmorFittingStore.ts

// Store definition
export const useGenerationStore = create<GenerationState>()(
  // ...
)
```

### Event Handlers

**handle[Action] or on[Event] pattern:**

```typescript
// Component with event handlers
function AssetCard() {
  const handleDeleteClick = () => {
    // Handle delete
  }

  const handleAssetSelect = (asset: Asset) => {
    // Handle selection
  }

  return (
    <Card onClick={handleAssetSelect}>
      <Button onClick={handleDeleteClick}>Delete</Button>
    </Card>
  )
}
```

### Boolean Variables

**Prefix with `is`, `has`, `should`, `can`:**

```typescript
// Good
const isLoading = true
const hasError = false
const shouldRetry = true
const canEdit = false

// Props
interface AssetCardProps {
  isSelected: boolean
  hasVariants: boolean
  canDelete: boolean
}
```

### File and Folder Names

**PascalCase for components, camelCase for utilities:**

```typescript
// Components
AssetDetailsPanel.tsx
MaterialVariantsCard.tsx

// Utilities and services
assetService.ts
formatAssetName.ts
generationConfigBuilder.ts

// Stores
useGenerationStore.ts

// Types
AssetMetadata.ts
RiggingMetadata.ts

// Folders
components/
services/
hooks/
utils/
types/
```

## File Organization

Proper file organization keeps the codebase maintainable as it grows.

### Directory Structure

```
src/
├── components/          # React components
│   ├── Assets/         # Asset library components
│   ├── Generation/     # Generation page components
│   ├── HandRigging/    # Hand rigging components
│   ├── Equipment/      # Equipment system components
│   ├── common/         # Reusable UI components
│   └── shared/         # Shared feature components
├── services/           # Business logic services
│   ├── api/           # API client services
│   ├── fitting/       # Armor fitting services
│   ├── generation/    # Generation services
│   ├── hand-rigging/  # Hand rigging services
│   └── processing/    # Asset processing services
├── store/             # Zustand state stores
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
├── constants/         # Constants and configuration
├── styles/            # Global styles and tokens
└── pages/             # Top-level page components
```

### Component File Structure

**Single component per file:**

```typescript
// AssetCard.tsx

// 1. Imports
import { useState } from 'react'
import type { Asset } from '@/services/api/AssetService'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'

// 2. Types/Interfaces (component-specific)
interface AssetCardProps {
  asset: Asset
  onSelect?: (asset: Asset) => void
  onDelete?: (id: string) => void
}

// 3. Constants (component-specific)
const CARD_HEIGHT = 320
const THUMBNAIL_SIZE = 256

// 4. Helper functions (component-specific)
function formatFileSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// 5. Main component
export function AssetCard({ asset, onSelect, onDelete }: AssetCardProps) {
  // 5a. Hooks
  const [isHovered, setIsHovered] = useState(false)

  // 5b. Derived state
  const fileSize = asset.metadata ? formatFileSize(asset.metadata.fileSize) : 'Unknown'

  // 5c. Event handlers
  const handleClick = () => {
    onSelect?.(asset)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(asset.id)
  }

  // 5d. Render
  return (
    <Card
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Component JSX */}
    </Card>
  )
}
```

### Service File Structure

**Class-based services:**

```typescript
// AssetService.ts

// 1. Imports
import fs from 'fs/promises'
import path from 'path'
import type { Asset, AssetMetadata } from '@/types'

// 2. Types
export interface AssetServiceConfig {
  assetsDir: string
  cacheEnabled?: boolean
}

// 3. Service class
export class AssetService {
  // 3a. Private properties
  private assetsDir: string
  private cache: Map<string, Asset>

  // 3b. Constructor
  constructor(config: AssetServiceConfig) {
    this.assetsDir = config.assetsDir
    this.cache = new Map()
  }

  // 3c. Public methods
  async listAssets(): Promise<Asset[]> {
    // Implementation
  }

  async getAsset(id: string): Promise<Asset | null> {
    // Implementation
  }

  // 3d. Private methods
  private async loadMetadata(id: string): Promise<AssetMetadata> {
    // Implementation
  }
}
```

### Index Files

**Use index files for clean imports:**

```typescript
// components/common/index.ts
export { Button } from './Button'
export { Card } from './Card'
export { Input } from './Input'
export { Modal } from './Modal'

// Usage elsewhere
import { Button, Card, Input } from '@/components/common'
```

**Type re-exports:**
```typescript
// types/index.ts
export type { Asset } from '@/services/api/AssetService'
export * from './AssetMetadata'
export * from './RiggingMetadata'
export * from './generation'
```

## Import Ordering

Consistent import ordering improves readability.

### Import Order

ESLint is configured to enforce this order:

```typescript
// 1. React and core libraries
import { useState, useEffect } from 'react'
import { create } from 'zustand'

// 2. Third-party libraries
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'

// 3. Internal absolute imports (via @/ alias)
import type { Asset, AssetMetadata } from '@/types'
import { AssetService } from '@/services/api/AssetService'
import { useGenerationStore } from '@/store'
import { formatAssetName } from '@/utils/formatAssetName'
import { Button } from '@/components/common/Button'

// 4. Relative imports
import { AssetCard } from './AssetCard'
import type { AssetListProps } from './types'

// 5. Styles (if any)
import './AssetList.css'
```

### Grouping with Blank Lines

```typescript
// Group related imports with blank lines
import { useState, useEffect, useCallback } from 'react'

import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import type { Asset } from '@/types'
import { useAssetsStore } from '@/store'

import { AssetCard } from './AssetCard'
```

### Type vs Value Imports

```typescript
// Separate type and value imports
import type { Asset, AssetMetadata } from '@/types'
import { AssetService } from '@/services/api/AssetService'

// Or use type modifier
import { type Asset, AssetService } from '@/services/api/AssetService'
```

## Component Structure

Consistent component structure makes code predictable and maintainable.

### Component Anatomy

**Recommended structure:**

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { Asset } from '@/types'
import { Button } from '@/components/common'

// 1. Props interface
interface AssetViewerProps {
  asset: Asset
  onClose: () => void
  enableEditing?: boolean
}

// 2. Component constants (if needed)
const DEFAULT_CAMERA_POSITION = { x: 0, y: 2, z: 5 }
const ROTATION_SPEED = 0.01

// 3. Helper functions (consider moving to utils if reused)
function calculateDistance(a: Vector3, b: Vector3): number {
  return Math.sqrt(
    Math.pow(b.x - a.x, 2) +
    Math.pow(b.y - a.y, 2) +
    Math.pow(b.z - a.z, 2)
  )
}

// 4. Main component
export function AssetViewer({
  asset,
  onClose,
  enableEditing = false
}: AssetViewerProps) {
  // 4a. State hooks (group related state)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 4b. Store hooks
  const updateAsset = useAssetsStore(state => state.updateAsset)

  // 4c. Custom hooks
  const { scene, loadModel } = useThreeScene()

  // 4d. Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 4e. Effects (order: initialization, side effects, cleanup)
  useEffect(() => {
    loadModel(asset.modelUrl)
      .then(() => setIsLoading(false))
      .catch(err => setError(err.message))
  }, [asset.modelUrl, loadModel])

  // 4f. Event handlers (use useCallback for complex ones)
  const handleEdit = useCallback(() => {
    if (!enableEditing) return
    // Edit logic
  }, [enableEditing])

  const handleRotate = (delta: number) => {
    // Simple handlers can be inline
    scene.rotation.y += delta
  }

  // 4g. Derived values
  const canEdit = enableEditing && !isLoading && !error

  // 4h. Early returns for loading/error states
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />

  // 4i. Render
  return (
    <div className="asset-viewer">
      <canvas ref={canvasRef} />
      {canEdit && (
        <Button onClick={handleEdit}>Edit</Button>
      )}
    </div>
  )
}
```

### Props Patterns

**Destructure props in function signature:**

```typescript
// Good
function AssetCard({ asset, onSelect }: AssetCardProps) {
  return <div onClick={() => onSelect(asset)}>...</div>
}

// Avoid (except when spreading)
function AssetCard(props: AssetCardProps) {
  return <div onClick={() => props.onSelect(props.asset)}>...</div>
}
```

**Default values:**

```typescript
// Good
interface CardProps {
  title: string
  variant?: 'primary' | 'secondary'
}

function Card({ title, variant = 'primary' }: CardProps) {
  // variant is guaranteed to be defined
}
```

**Optional callbacks:**

```typescript
interface AssetCardProps {
  asset: Asset
  onSelect?: (asset: Asset) => void
}

function AssetCard({ asset, onSelect }: AssetCardProps) {
  const handleClick = () => {
    onSelect?.(asset)  // Safe optional call
  }

  return <div onClick={handleClick}>...</div>
}
```

### Hooks Usage

**Order of hooks:**

```typescript
function MyComponent() {
  // 1. State hooks
  const [state1, setState1] = useState('')
  const [state2, setState2] = useState(0)

  // 2. Context/Store hooks
  const user = useAuth()
  const assets = useAssetsStore(state => state.assets)

  // 3. Refs
  const inputRef = useRef<HTMLInputElement>(null)

  // 4. Custom hooks
  const { data, loading } = useApi('/endpoint')

  // 5. Effects
  useEffect(() => {
    // ...
  }, [])

  // 6. Callbacks/memoization
  const handleClick = useCallback(() => {
    // ...
  }, [])

  // Component logic...
}
```

**Custom hooks naming:**

```typescript
// Custom hooks MUST start with 'use'
export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([])

  useEffect(() => {
    fetchAssets().then(setAssets)
  }, [])

  return { assets, refetch: () => fetchAssets().then(setAssets) }
}
```

## State Management Patterns

Asset Forge uses Zustand for global state management.

### Store Structure

**Use Immer middleware for immutable updates:**

```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface MyState {
  items: Item[]
  selectedId: string | null
  addItem: (item: Item) => void
  selectItem: (id: string) => void
}

export const useMyStore = create<MyState>()(
  devtools(
    persist(
      immer((set, get) => ({
        items: [],
        selectedId: null,

        addItem: (item) => set((state) => {
          state.items.push(item)  // Immer allows mutation
        }),

        selectItem: (id) => set((state) => {
          state.selectedId = id
        })
      })),
      { name: 'my-store' }
    ),
    { name: 'MyStore' }
  )
)
```

### Selector Patterns

**Use selectors to avoid unnecessary re-renders:**

```typescript
// Bad - re-renders on any state change
function Component() {
  const store = useMyStore()
  return <div>{store.selectedId}</div>
}

// Good - only re-renders when selectedId changes
function Component() {
  const selectedId = useMyStore(state => state.selectedId)
  return <div>{selectedId}</div>
}

// Multiple selectors
function Component() {
  const items = useMyStore(state => state.items)
  const selectedId = useMyStore(state => state.selectedId)
  const addItem = useMyStore(state => state.addItem)

  // Component logic...
}
```

**Derived state in selectors:**

```typescript
// Compute derived state in selector
const selectedItem = useMyStore(state =>
  state.items.find(item => item.id === state.selectedId)
)

// Or create a selector function
const selectItemById = (id: string) => (state: MyState) =>
  state.items.find(item => item.id === id)

// Usage
const item = useMyStore(selectItemById('abc'))
```

### Local vs Global State

**Use local state for UI-only state:**

```typescript
// Good - component-specific UI state
function Modal() {
  const [isOpen, setIsOpen] = useState(false)
  // ...
}

// Bad - putting UI state in global store unnecessarily
```

**Use global state for shared application state:**

```typescript
// Good - shared across components
const assets = useAssetsStore(state => state.assets)
const currentPipelineId = useGenerationStore(state => state.currentPipelineId)
```

## Error Handling Patterns

Consistent error handling improves reliability and debugging.

### Try-Catch with Specific Errors

```typescript
// Good
async function loadAsset(id: string): Promise<Asset> {
  try {
    const response = await fetch(`/api/assets/${id}`)

    if (!response.ok) {
      throw new Error(`Failed to load asset: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Network error: Unable to reach server')
    }

    if (error instanceof Error) {
      throw new Error(`Asset loading failed: ${error.message}`)
    }

    throw new Error('Unknown error occurred')
  }
}
```

### Error Boundaries

**Use for component error handling:**

```typescript
// Already provided in components/common/ErrorBoundary.tsx
<ErrorBoundary>
  <AssetViewer asset={asset} />
</ErrorBoundary>
```

### Validation Errors

```typescript
// Good - explicit validation
function validateAssetConfig(config: GenerationConfig): void {
  if (!config.name || config.name.trim().length === 0) {
    throw new Error('Asset name is required')
  }

  if (!config.type) {
    throw new Error('Asset type is required')
  }

  if (config.quality && !['standard', 'high', 'ultra'].includes(config.quality)) {
    throw new Error(`Invalid quality: ${config.quality}`)
  }
}
```

### User-Facing Errors

```typescript
// Good - user-friendly error messages
try {
  await generateAsset(config)
} catch (error) {
  const message = error instanceof Error
    ? `Generation failed: ${error.message}`
    : 'An unexpected error occurred'

  showNotification({
    type: 'error',
    message,
    duration: 5000
  })
}
```

## Async/Await Usage

Prefer async/await over Promise chains for readability.

### Basic Usage

```typescript
// Good
async function loadAssets(): Promise<Asset[]> {
  try {
    const response = await fetch('/api/assets')
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Failed to load assets:', error)
    return []
  }
}

// Avoid (unless chaining is more readable)
function loadAssets(): Promise<Asset[]> {
  return fetch('/api/assets')
    .then(res => res.json())
    .catch(error => {
      console.error('Failed to load assets:', error)
      return []
    })
}
```

### Parallel Execution

```typescript
// Good - parallel execution
async function loadAssetData(id: string) {
  const [metadata, model, textures] = await Promise.all([
    fetchMetadata(id),
    fetchModel(id),
    fetchTextures(id)
  ])

  return { metadata, model, textures }
}

// Bad - sequential execution
async function loadAssetData(id: string) {
  const metadata = await fetchMetadata(id)
  const model = await fetchModel(id)
  const textures = await fetchTextures(id)
  return { metadata, model, textures }
}
```

### useEffect with Async

```typescript
// Good - proper cleanup
useEffect(() => {
  let cancelled = false

  async function loadData() {
    const data = await fetchAssets()
    if (!cancelled) {
      setAssets(data)
    }
  }

  loadData()

  return () => {
    cancelled = true
  }
}, [])

// Bad - async directly in useEffect
useEffect(async () => {
  // This is wrong!
  const data = await fetchAssets()
  setAssets(data)
}, [])
```

## Three.js Resource Cleanup

Proper cleanup prevents memory leaks in Three.js applications.

### Component Cleanup Pattern

```typescript
useEffect(() => {
  // Create resources
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 })
  const mesh = new THREE.Mesh(geometry, material)

  scene.add(mesh)

  // Cleanup function
  return () => {
    scene.remove(mesh)
    geometry.dispose()
    material.dispose()

    // Dispose textures if any
    if (material.map) material.map.dispose()
    if (material.normalMap) material.normalMap.dispose()
  }
}, [scene])
```

### Scene Cleanup

```typescript
// Comprehensive scene cleanup
function disposeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()

      if (Array.isArray(object.material)) {
        object.material.forEach(material => disposeMaterial(material))
      } else {
        disposeMaterial(object.material)
      }
    }
  })

  scene.clear()
}

function disposeMaterial(material: THREE.Material): void {
  material.dispose()

  // Dispose all textures
  Object.keys(material).forEach(key => {
    const value = (material as any)[key]
    if (value instanceof THREE.Texture) {
      value.dispose()
    }
  })
}
```

## ESLint Configuration

Asset Forge uses ESLint for code quality enforcement.

### Current Configuration

Located in `.eslintrc.cjs`:

```javascript
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  settings: {
    react: { version: 'detect' },
    'import/resolver': {
      typescript: {},
      alias: { map: [['@', './src']], extensions: ['.ts', '.tsx', '.js', '.jsx'] }
    }
  },
  rules: {
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'import/order': ['warn', {
      'newlines-between': 'always',
      alphabetize: { order: 'asc' }
    }]
  }
}
```

### Running ESLint

```bash
# Lint all files
bun run lint

# Lint specific files
npx eslint src/components/AssetCard.tsx

# Auto-fix issues
npx eslint src/ --fix
```

### VS Code Integration

Install the ESLint extension and add to `.vscode/settings.json`:

```json
{
  "eslint.validate": ["javascript", "typescript", "javascriptreact", "typescriptreact"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Prettier Setup

While not currently configured, Prettier can be added for consistent formatting.

### Installation

```bash
bun add -D prettier eslint-config-prettier
```

### Configuration

Create `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "avoid"
}
```

### Integration with ESLint

Update `.eslintrc.cjs`:

```javascript
module.exports = {
  extends: [
    // ... other configs
    'prettier'  // Must be last to override other configs
  ]
}
```

## Code Review Checklist

Use this checklist when reviewing code or before submitting PRs.

### Type Safety
- [ ] No `any` or `unknown` types
- [ ] All function return types explicitly defined
- [ ] Type imports use `import type`
- [ ] Proper type guards for type narrowing
- [ ] No type assertions unless absolutely necessary

### Code Quality
- [ ] Functions are small and focused (< 50 lines ideal)
- [ ] No duplicated code
- [ ] Descriptive variable and function names
- [ ] Complex logic has explanatory comments
- [ ] No commented-out code (remove or explain)

### React Patterns
- [ ] Components are properly decomposed
- [ ] Props are typed with interfaces
- [ ] Hooks are used in correct order
- [ ] useEffect has proper cleanup
- [ ] Event handlers use useCallback when needed

### Performance
- [ ] Three.js resources are properly disposed
- [ ] No unnecessary re-renders
- [ ] Large computations are memoized
- [ ] Images/assets are optimized

### Error Handling
- [ ] API calls have try-catch blocks
- [ ] User-facing errors have friendly messages
- [ ] Errors are logged appropriately
- [ ] Edge cases are handled

### Testing
- [ ] New features have tests
- [ ] Existing tests still pass
- [ ] Manual testing completed
- [ ] Different scenarios tested

### Documentation
- [ ] Complex functions have JSDoc comments
- [ ] README updated if needed
- [ ] Type definitions are documented
- [ ] Breaking changes noted

### Git Hygiene
- [ ] Commits follow semantic commit format
- [ ] Branch name follows conventions
- [ ] No merge conflicts
- [ ] Commit history is clean (squash if needed)

### Security
- [ ] No API keys or secrets in code
- [ ] Input validation for user data
- [ ] No XSS vulnerabilities
- [ ] Dependencies are up to date

By following these standards consistently, we maintain a high-quality, maintainable codebase that's easy for all team members to work with.
