# Adding New Features

This guide walks you through the complete process of adding new features to Asset Forge, from initial planning to testing and documentation.

## Table of Contents

- [Feature Planning](#feature-planning)
- [Creating Components](#creating-components)
- [Adding Services](#adding-services)
- [State Management](#state-management)
- [API Endpoint Creation](#api-endpoint-creation)
- [Route Configuration](#route-configuration)
- [UI Integration](#ui-integration)
- [Testing Strategy](#testing-strategy)
- [Documentation Requirements](#documentation-requirements)
- [Pull Request Process](#pull-request-process)

## Feature Planning

Before writing any code, thoroughly plan your feature.

### Requirements Analysis

**1. Define the Feature Scope**

Answer these questions:
- What problem does this feature solve?
- Who is the primary user?
- What are the core requirements?
- What are the nice-to-have requirements?
- Are there any technical constraints?

**Example: Adding a "Batch Export" Feature**

```
Problem: Users want to export multiple assets at once
User: 3D artists managing large asset libraries
Core Requirements:
  - Select multiple assets from library
  - Export in GLB format
  - Download as ZIP archive
Nice-to-Have:
  - Support multiple export formats (FBX, OBJ)
  - Preview selection before export
  - Export with metadata
Constraints:
  - Browser memory limits for large files
  - Maximum 50 assets per batch
```

### Technical Design

**2. Create Technical Specification**

Document:
- Architecture changes needed
- New components/services required
- State management approach
- API endpoints needed
- Data flow diagram

**Example Technical Spec:**

```typescript
// New Components
BatchExportModal.tsx      // Modal UI for batch export
AssetSelectionList.tsx    // Multi-select asset list
ExportProgressBar.tsx     // Export progress display

// New Services
BatchExportService.ts     // Handles batch export logic
ZipGenerationService.ts   // Creates ZIP archives

// State Management
useAssetsStore.ts         // Add batch selection state
  - selectedAssetIds: string[]
  - isBatchExporting: boolean
  - exportProgress: number

// API Endpoints
POST /api/assets/batch-export
  Request: { assetIds: string[], format: 'glb' | 'fbx' }
  Response: { downloadUrl: string }

// Data Flow
1. User selects assets in UI
2. Click "Export Selected"
3. BatchExportModal opens
4. User confirms settings
5. API call to /batch-export
6. Service processes each asset
7. Creates ZIP archive
8. Returns download URL
9. Browser downloads file
```

### Create GitHub Issue

**3. Document in GitHub**

Create an issue with:
- Feature description
- User story
- Acceptance criteria
- Technical notes
- Related issues/dependencies

```markdown
## Feature: Batch Asset Export

**User Story:**
As a 3D artist, I want to export multiple assets at once so that I can efficiently download my entire asset library.

**Acceptance Criteria:**
- [ ] Users can select multiple assets
- [ ] Export supports GLB format
- [ ] Assets are downloaded as ZIP
- [ ] Progress indicator shows export status
- [ ] Error handling for failed exports
- [ ] Maximum 50 assets per batch

**Technical Notes:**
- Use JSZip for client-side ZIP creation
- Consider server-side ZIP for large batches
- Implement cancellation support
```

## Creating Components

Follow these steps to create new React components.

### Component Structure

**1. Create Component File**

```bash
# Navigate to appropriate directory
cd src/components/Assets/

# Create new component file
touch BatchExportModal.tsx
```

**2. Implement Component**

```typescript
// src/components/Assets/BatchExportModal.tsx

import { useState } from 'react'
import type { Asset } from '@/services/api/AssetService'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Progress } from '@/components/common/Progress'
import { useAssetsStore } from '@/store'

interface BatchExportModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BatchExportModal({ isOpen, onClose }: BatchExportModalProps) {
  // 1. Local state
  const [exportFormat, setExportFormat] = useState<'glb' | 'fbx'>('glb')
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  // 2. Store state
  const selectedAssets = useAssetsStore(state => state.selectedAssets)
  const clearSelection = useAssetsStore(state => state.clearSelection)

  // 3. Handlers
  const handleExport = async () => {
    setIsExporting(true)
    setProgress(0)

    try {
      // Call export service
      await exportAssets(selectedAssets, exportFormat, (p) => setProgress(p))

      // Success
      clearSelection()
      onClose()
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  // 4. Render
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Batch Export">
      <div className="space-y-4">
        <p>Export {selectedAssets.length} selected assets</p>

        <div>
          <label>Format:</label>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'glb' | 'fbx')}
          >
            <option value="glb">GLB</option>
            <option value="fbx">FBX</option>
          </select>
        </div>

        {isExporting && (
          <Progress value={progress} max={100} />
        )}

        <div className="flex gap-2">
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

**3. Add to Index Export**

```typescript
// src/components/Assets/index.ts
export { AssetList } from './AssetList'
export { AssetCard } from './AssetCard'
export { BatchExportModal } from './BatchExportModal'  // Add new component
```

### Component Best Practices

**Composition Over Monoliths:**

```typescript
// Bad - One large component
function AssetManager() {
  // 500 lines of code
  return (
    <div>
      {/* Everything in one component */}
    </div>
  )
}

// Good - Composed components
function AssetManager() {
  return (
    <div>
      <AssetFilters />
      <AssetList />
      <BatchExportModal />
    </div>
  )
}
```

**Props Validation:**

```typescript
// Use TypeScript interfaces for prop validation
interface AssetCardProps {
  asset: Asset
  onSelect: (asset: Asset) => void
  variant?: 'compact' | 'detailed'
  showActions?: boolean
}

// Provide defaults
function AssetCard({
  asset,
  onSelect,
  variant = 'compact',
  showActions = true
}: AssetCardProps) {
  // Component implementation
}
```

## Adding Services

Services contain business logic separate from UI components.

### Service Structure

**1. Create Service File**

```bash
# Navigate to services directory
cd src/services/

# Create subdirectory if needed
mkdir -p export

# Create service file
touch export/BatchExportService.ts
```

**2. Implement Service Class**

```typescript
// src/services/export/BatchExportService.ts

import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { Asset } from '@/services/api/AssetService'

export interface BatchExportConfig {
  format: 'glb' | 'fbx' | 'obj'
  includeMetadata?: boolean
  includeTextures?: boolean
}

export interface BatchExportProgress {
  current: number
  total: number
  percentage: number
  currentAsset?: string
}

export type ProgressCallback = (progress: BatchExportProgress) => void

export class BatchExportService {
  private apiUrl: string

  constructor(apiUrl: string = 'http://localhost:3004/api') {
    this.apiUrl = apiUrl
  }

  /**
   * Export multiple assets as a ZIP archive
   */
  async exportAssets(
    assets: Asset[],
    config: BatchExportConfig,
    onProgress?: ProgressCallback
  ): Promise<void> {
    if (assets.length === 0) {
      throw new Error('No assets to export')
    }

    if (assets.length > 50) {
      throw new Error('Maximum 50 assets per batch')
    }

    const zip = new JSZip()
    const total = assets.length

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]

      // Update progress
      onProgress?.({
        current: i + 1,
        total,
        percentage: Math.round(((i + 1) / total) * 100),
        currentAsset: asset.name
      })

      // Fetch asset model
      const modelBlob = await this.fetchAssetModel(asset.id)

      // Add to ZIP with proper naming
      const fileName = `${asset.name}.${config.format}`
      zip.file(fileName, modelBlob)

      // Add metadata if requested
      if (config.includeMetadata) {
        const metadataJson = JSON.stringify(asset.metadata, null, 2)
        zip.file(`${asset.name}_metadata.json`, metadataJson)
      }
    }

    // Generate ZIP and trigger download
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, `assets_export_${Date.now()}.zip`)
  }

  /**
   * Fetch individual asset model as blob
   */
  private async fetchAssetModel(assetId: string): Promise<Blob> {
    const response = await fetch(`${this.apiUrl}/assets/${assetId}/model`)

    if (!response.ok) {
      throw new Error(`Failed to fetch asset ${assetId}`)
    }

    return await response.blob()
  }

  /**
   * Cancel ongoing export (if implemented)
   */
  cancelExport(): void {
    // Implementation for cancellation
    throw new Error('Not implemented')
  }
}
```

**3. Export Service**

```typescript
// src/services/export/index.ts
export { BatchExportService } from './BatchExportService'
export type { BatchExportConfig, BatchExportProgress } from './BatchExportService'
```

### Service Best Practices

**Dependency Injection:**

```typescript
// Good - inject dependencies
class MyService {
  constructor(
    private apiClient: ApiClient,
    private config: ServiceConfig
  ) {}
}

// Usage
const service = new MyService(apiClient, config)
```

**Error Handling:**

```typescript
class AssetService {
  async getAsset(id: string): Promise<Asset> {
    try {
      const response = await fetch(`/api/assets/${id}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Network error: Unable to reach server')
      }
      throw error
    }
  }
}
```

**Type Safety:**

```typescript
// Define clear interfaces
interface ServiceResponse<T> {
  data: T
  status: 'success' | 'error'
  error?: string
}

class ApiService {
  async fetch<T>(endpoint: string): Promise<ServiceResponse<T>> {
    // Implementation with full type safety
  }
}
```

## State Management

Asset Forge uses Zustand for global state management.

### Creating a New Store

**1. Define Store Interface**

```typescript
// src/store/useExportStore.ts

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Asset } from '@/services/api/AssetService'

interface ExportState {
  // State
  selectedAssetIds: string[]
  isExporting: boolean
  exportProgress: number
  exportFormat: 'glb' | 'fbx' | 'obj'

  // Actions
  selectAsset: (id: string) => void
  deselectAsset: (id: string) => void
  selectAll: (assetIds: string[]) => void
  clearSelection: () => void
  setExporting: (isExporting: boolean) => void
  setProgress: (progress: number) => void
  setFormat: (format: 'glb' | 'fbx' | 'obj') => void
}
```

**2. Implement Store**

```typescript
export const useExportStore = create<ExportState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        selectedAssetIds: [],
        isExporting: false,
        exportProgress: 0,
        exportFormat: 'glb',

        // Actions
        selectAsset: (id) => set((state) => {
          if (!state.selectedAssetIds.includes(id)) {
            state.selectedAssetIds.push(id)
          }
        }),

        deselectAsset: (id) => set((state) => {
          state.selectedAssetIds = state.selectedAssetIds.filter(
            assetId => assetId !== id
          )
        }),

        selectAll: (assetIds) => set((state) => {
          state.selectedAssetIds = assetIds
        }),

        clearSelection: () => set((state) => {
          state.selectedAssetIds = []
        }),

        setExporting: (isExporting) => set((state) => {
          state.isExporting = isExporting
        }),

        setProgress: (progress) => set((state) => {
          state.exportProgress = progress
        }),

        setFormat: (format) => set((state) => {
          state.exportFormat = format
        })
      })),
      {
        name: 'export-store',
        // Only persist user preferences
        partialize: (state) => ({
          exportFormat: state.exportFormat
        })
      }
    ),
    { name: 'ExportStore' }
  )
)
```

**3. Use Store in Components**

```typescript
function BatchExportModal() {
  // Select only what you need
  const selectedIds = useExportStore(state => state.selectedAssetIds)
  const isExporting = useExportStore(state => state.isExporting)
  const progress = useExportStore(state => state.exportProgress)
  const clearSelection = useExportStore(state => state.clearSelection)
  const setExporting = useExportStore(state => state.setExporting)

  // Component logic...
}
```

### Extending Existing Stores

**Add to Existing Store:**

```typescript
// src/store/useAssetsStore.ts

interface AssetsState {
  // ... existing state

  // Add new state
  selectedForExport: string[]

  // Add new actions
  toggleExportSelection: (id: string) => void
  clearExportSelection: () => void
}

export const useAssetsStore = create<AssetsState>()(
  // ... middleware
  immer((set, get) => ({
    // ... existing implementation

    // New state
    selectedForExport: [],

    // New actions
    toggleExportSelection: (id) => set((state) => {
      const index = state.selectedForExport.indexOf(id)
      if (index > -1) {
        state.selectedForExport.splice(index, 1)
      } else {
        state.selectedForExport.push(id)
      }
    }),

    clearExportSelection: () => set((state) => {
      state.selectedForExport = []
    })
  }))
)
```

## API Endpoint Creation

Add new backend endpoints for your feature.

### Backend Endpoint Structure

**1. Add Route Handler**

```javascript
// server/api.mjs

// Add new endpoint
app.post('/api/assets/batch-export', async (req, res, next) => {
  try {
    const { assetIds, format, includeMetadata } = req.body

    // Validate input
    if (!assetIds || !Array.isArray(assetIds)) {
      return res.status(400).json({
        error: 'assetIds must be an array'
      })
    }

    if (assetIds.length > 50) {
      return res.status(400).json({
        error: 'Maximum 50 assets per batch'
      })
    }

    // Process export
    const result = await batchExportService.exportAssets({
      assetIds,
      format: format || 'glb',
      includeMetadata: includeMetadata || false
    })

    res.json({
      success: true,
      downloadUrl: result.downloadUrl,
      assetCount: assetIds.length
    })
  } catch (error) {
    next(error)
  }
})
```

**2. Create Backend Service**

```javascript
// server/services/BatchExportService.mjs

import fs from 'fs/promises'
import path from 'path'
import archiver from 'archiver'

export class BatchExportService {
  constructor(assetsDir) {
    this.assetsDir = assetsDir
  }

  async exportAssets({ assetIds, format, includeMetadata }) {
    const exportDir = path.join(this.assetsDir, 'exports')
    await fs.mkdir(exportDir, { recursive: true })

    const zipPath = path.join(exportDir, `export_${Date.now()}.zip`)
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    archive.pipe(output)

    // Add each asset to archive
    for (const assetId of assetIds) {
      const assetDir = path.join(this.assetsDir, assetId)
      const modelPath = path.join(assetDir, `${assetId}.${format}`)

      // Add model file
      if (await this.fileExists(modelPath)) {
        archive.file(modelPath, { name: `${assetId}.${format}` })
      }

      // Add metadata if requested
      if (includeMetadata) {
        const metadataPath = path.join(assetDir, 'metadata.json')
        if (await this.fileExists(metadataPath)) {
          archive.file(metadataPath, { name: `${assetId}_metadata.json` })
        }
      }
    }

    await archive.finalize()

    return {
      downloadUrl: `/exports/${path.basename(zipPath)}`
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}
```

### API Client Integration

**3. Create Client Method**

```typescript
// src/services/api/AssetService.ts

class AssetService {
  // ... existing methods

  async batchExport(
    assetIds: string[],
    format: 'glb' | 'fbx' | 'obj',
    includeMetadata: boolean = false
  ): Promise<{ downloadUrl: string }> {
    const response = await fetch(`${this.apiUrl}/assets/batch-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds, format, includeMetadata })
    })

    if (!response.ok) {
      throw new Error(`Batch export failed: ${response.statusText}`)
    }

    return await response.json()
  }
}
```

## Route Configuration

Add new pages and routes to the application.

### Adding a New Page

**1. Create Page Component**

```typescript
// src/pages/BatchExportPage.tsx

import { useState, useEffect } from 'react'
import { BatchExportModal } from '@/components/Assets/BatchExportModal'
import { AssetSelectionList } from '@/components/Assets/AssetSelectionList'
import { useExportStore } from '@/store/useExportStore'
import { useAssetsStore } from '@/store/useAssetsStore'

export default function BatchExportPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const assets = useAssetsStore(state => state.assets)
  const selectedIds = useExportStore(state => state.selectedAssetIds)

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Batch Export</h1>

      <div className="mb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={selectedIds.length === 0}
          className="btn btn-primary"
        >
          Export {selectedIds.length} Selected Assets
        </button>
      </div>

      <AssetSelectionList assets={assets} />

      <BatchExportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}
```

**2. Add Route**

```typescript
// src/App.tsx

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AssetsPage from './pages/AssetsPage'
import GenerationPage from './pages/GenerationPage'
import BatchExportPage from './pages/BatchExportPage'  // New import

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GenerationPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/batch-export" element={<BatchExportPage />} />  {/* New route */}
        {/* Other routes */}
      </Routes>
    </BrowserRouter>
  )
}
```

**3. Add Navigation Link**

```typescript
// src/components/shared/Navigation.tsx

export function Navigation() {
  return (
    <nav>
      <NavLink to="/">Generation</NavLink>
      <NavLink to="/assets">Assets</NavLink>
      <NavLink to="/batch-export">Batch Export</NavLink>  {/* New link */}
    </nav>
  )
}
```

## UI Integration

Integrate your feature into existing UI.

### Adding to Existing Pages

**Option 1: Add as Modal/Overlay**

```typescript
// src/pages/AssetsPage.tsx

import { BatchExportModal } from '@/components/Assets/BatchExportModal'

export default function AssetsPage() {
  const [showBatchExport, setShowBatchExport] = useState(false)

  return (
    <div>
      {/* Existing UI */}
      <Button onClick={() => setShowBatchExport(true)}>
        Batch Export
      </Button>

      <BatchExportModal
        isOpen={showBatchExport}
        onClose={() => setShowBatchExport(false)}
      />
    </div>
  )
}
```

**Option 2: Add as Section**

```typescript
export default function AssetsPage() {
  return (
    <div>
      <AssetFilters />
      <AssetList />
      <BatchExportSection />  {/* New section */}
    </div>
  )
}
```

### Keyboard Shortcuts

```typescript
function AssetList() {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + E for batch export
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        openBatchExportModal()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  // Component render...
}
```

## Testing Strategy

Test your feature thoroughly before merging.

### Manual Testing Checklist

```markdown
## Batch Export Feature Testing

### Basic Functionality
- [ ] Can select single asset
- [ ] Can select multiple assets
- [ ] Can deselect assets
- [ ] Export modal opens
- [ ] Format selection works
- [ ] Export completes successfully
- [ ] ZIP file downloads
- [ ] ZIP contains correct files

### Edge Cases
- [ ] Export with 0 assets (should show error)
- [ ] Export with 1 asset
- [ ] Export with 50 assets (maximum)
- [ ] Export with 51 assets (should fail)
- [ ] Cancel during export
- [ ] Network error handling

### UI/UX
- [ ] Progress indicator shows
- [ ] Success message displays
- [ ] Error messages are clear
- [ ] Modal can be closed
- [ ] Selection persists correctly
- [ ] Keyboard shortcuts work

### Performance
- [ ] Exports complete in reasonable time
- [ ] No memory leaks
- [ ] UI remains responsive
```

### Unit Testing (If Implemented)

```typescript
// src/services/export/BatchExportService.test.ts

import { describe, it, expect, vi } from 'vitest'
import { BatchExportService } from './BatchExportService'

describe('BatchExportService', () => {
  it('should export assets successfully', async () => {
    const service = new BatchExportService()
    const assets = [
      { id: '1', name: 'Sword' },
      { id: '2', name: 'Shield' }
    ]

    const result = await service.exportAssets(assets, { format: 'glb' })

    expect(result).toBeDefined()
  })

  it('should reject more than 50 assets', async () => {
    const service = new BatchExportService()
    const assets = Array(51).fill({ id: '1', name: 'Asset' })

    await expect(
      service.exportAssets(assets, { format: 'glb' })
    ).rejects.toThrow('Maximum 50 assets')
  })
})
```

## Documentation Requirements

Document your feature properly.

### Code Documentation

**1. JSDoc Comments**

```typescript
/**
 * Export multiple assets as a ZIP archive
 *
 * @param assets - Array of assets to export
 * @param config - Export configuration options
 * @param onProgress - Optional progress callback
 * @returns Promise that resolves when export completes
 *
 * @throws {Error} If no assets provided
 * @throws {Error} If more than 50 assets
 *
 * @example
 * ```typescript
 * await service.exportAssets(
 *   [asset1, asset2],
 *   { format: 'glb', includeMetadata: true },
 *   (progress) => console.log(progress.percentage)
 * )
 * ```
 */
async exportAssets(
  assets: Asset[],
  config: BatchExportConfig,
  onProgress?: ProgressCallback
): Promise<void>
```

### README Updates

**2. Update Main README**

```markdown
## Features

### Batch Export
Export multiple assets at once as a ZIP archive.

**Usage:**
1. Navigate to Assets page
2. Select assets using checkboxes
3. Click "Batch Export"
4. Choose export format
5. Download ZIP file

**Supported Formats:**
- GLB (default)
- FBX
- OBJ

**Limitations:**
- Maximum 50 assets per batch
- Total file size limited to browser memory
```

### API Documentation

**3. Document API Endpoints**

```markdown
## API Endpoints

### POST /api/assets/batch-export

Export multiple assets as ZIP archive.

**Request:**
```json
{
  "assetIds": ["asset-1", "asset-2"],
  "format": "glb",
  "includeMetadata": true
}
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "/exports/export_1234567890.zip",
  "assetCount": 2
}
```

**Errors:**
- 400: Invalid request (missing assetIds, too many assets)
- 500: Server error during export
```

## Pull Request Process

Follow this process for merging your feature.

### Before Creating PR

**1. Self-Review Checklist**
- [ ] Code follows style guide
- [ ] No console.log statements (except intentional logging)
- [ ] No commented-out code
- [ ] TypeScript has no errors
- [ ] ESLint passes
- [ ] All files properly formatted
- [ ] No merge conflicts with main

**2. Test Thoroughly**
- [ ] Manual testing completed
- [ ] All test cases pass
- [ ] Feature works in different browsers
- [ ] Responsive design verified
- [ ] No regression in existing features

### Creating the PR

**3. Write Good PR Description**

```markdown
## Feature: Batch Asset Export

### Summary
Adds ability to export multiple assets at once as a ZIP archive.

### Changes
- Added BatchExportModal component
- Created BatchExportService
- Added batch-export API endpoint
- Updated AssetsPage with export button
- Added export state to useExportStore

### Testing
- [x] Tested with 1, 10, and 50 assets
- [x] Verified error handling for >50 assets
- [x] Confirmed ZIP file structure
- [x] Tested in Chrome, Firefox, Safari

### Screenshots
[Attach screenshots of new UI]

### Related Issues
Closes #123

### Breaking Changes
None

### Deployment Notes
No special deployment steps required.
```

### Review Process

**4. Address Feedback**

- Respond to all review comments
- Make requested changes
- Update PR description if scope changes
- Re-request review after changes

**5. Merge**

Once approved:
- Squash commits if needed
- Ensure CI/CD passes
- Merge to main
- Delete feature branch
- Close related issues

Following this comprehensive process ensures features are well-planned, properly implemented, thoroughly tested, and clearly documented.
