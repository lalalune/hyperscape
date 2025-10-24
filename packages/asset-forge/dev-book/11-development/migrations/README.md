# Migration Guides - Wave 1-3 Patterns

> **Complete guide** to migrating to new patterns introduced in Wave 1-3 refactoring

## Overview

This directory contains comprehensive migration guides for adopting the new patterns introduced during Wave 1-3 refactoring. These patterns improve code quality, prevent bugs, and enhance maintainability.

## Migration Guides

### 1. [Console to Logger](./console-to-logger.md)
Replace console statements with structured logging system.

**Benefits:**
- Context-aware logging with component names
- Production-safe debug output
- Searchable, structured logs
- Type-safe logging

**Priority:** High
**Time:** 5-10 minutes per file

**Quick Example:**
```typescript
// Before
console.log('Asset loaded:', assetId)

// After
import { createLogger } from '@/utils/logger'
const logger = createLogger('AssetService')
logger.info('Asset loaded', { assetId })
```

### 2. [Safe Math Utilities](./safe-math-utilities.md)
Prevent division by zero and NaN propagation.

**Benefits:**
- Division by zero protection
- Prevents crashes from invalid calculations
- Sensible default values
- Automatic validation

**Priority:** High
**Time:** 10-15 minutes per file

**Quick Example:**
```typescript
// Before
const scale = targetHeight / mesh.scale.y  // Crashes if 0!

// After
import { safeScale } from '@/utils/safe-math'
const scale = safeScale(targetHeight, mesh.scale.y, 1.0)
```

### 3. [Standardized Error Codes](./standardized-error-codes.md)
Replace ad-hoc error messages with standardized error codes.

**Benefits:**
- Consistent error handling
- User-friendly error messages
- Automatic HTTP status mapping
- Searchable error codes

**Priority:** Medium
**Time:** 15-20 minutes per file

**Quick Example:**
```typescript
// Before
res.status(404).json({ error: 'Not found' })

// After
import { ErrorCodes, sendErrorResponse } from '../utils/error-messages.mjs'
sendErrorResponse(res, ErrorCodes.ASSET_NOT_FOUND, 'Asset not found', { assetId })
```

### 4. [Memory Leak Prevention](./memory-leak-prevention.md)
Prevent memory leaks with proper blob URL cleanup and resource management.

**Benefits:**
- Prevents browser memory exhaustion
- Proper cleanup of blob URLs
- Three.js resource disposal
- Event listener cleanup

**Priority:** High
**Time:** 10-20 minutes per component

**Quick Example:**
```typescript
// Before
const url = URL.createObjectURL(blob)
// Never cleaned up - memory leak!

// After
const url = URL.createObjectURL(blob)
// ... use url ...
URL.revokeObjectURL(url)  // Clean up
```

### 5. [Race Condition Prevention](./race-condition-prevention.md)
Prevent race conditions with AbortController, mounted refs, and transactions.

**Benefits:**
- Prevents setState on unmounted components
- Cancellable async operations
- Database transaction safety
- Eliminates UI flicker

**Priority:** High
**Time:** 15-25 minutes per component

**Quick Example:**
```typescript
// Before
useEffect(() => {
  fetch('/api/data')
    .then(setData)
}, [])

// After
useEffect(() => {
  const controller = new AbortController()

  fetch('/api/data', { signal: controller.signal })
    .then(data => {
      if (isMountedRef.current) setData(data)
    })

  return () => controller.abort()
}, [])
```

## Master Migration Checklist

Use this comprehensive checklist to migrate a complete file or component:

### Logging
- [ ] Import createLogger from '@/utils/logger'
- [ ] Create logger instance with descriptive context name
- [ ] Replace all console.log() with logger.info()
- [ ] Replace all console.debug() with logger.debug()
- [ ] Replace all console.warn() with logger.warn()
- [ ] Replace all console.error() with logger.error()
- [ ] Add context objects to all log calls
- [ ] Extract error details (message, stack, code)

### Safe Math
- [ ] Import safe-math utilities from '@/utils/safe-math'
- [ ] Identify all division operations (/)
- [ ] Determine which divisions could have zero denominators
- [ ] Replace risky divisions with safeDivide() or safeScale()
- [ ] Choose appropriate default values
- [ ] Replace percentage calculations with safePercentage()
- [ ] Replace normalization with safeNormalize()
- [ ] Test edge cases (zero, very small numbers)

### Error Codes
- [ ] Import ErrorCodes and sendErrorResponse/createStandardError
- [ ] Replace res.status().json() with sendErrorResponse()
- [ ] Replace throw new Error() with createStandardError()
- [ ] Add context objects to error responses
- [ ] Use most specific error codes available
- [ ] Log technical details before returning errors
- [ ] Remove manual HTTP status codes
- [ ] Verify error responses match expected format

### Memory Cleanup
- [ ] Check all URL.createObjectURL() calls
- [ ] Add URL.revokeObjectURL() cleanup
- [ ] Revoke old URLs when replacing
- [ ] Revoke on component unmount
- [ ] Return cleanup function from all useEffect
- [ ] Remove event listeners on unmount
- [ ] Clear intervals and timeouts
- [ ] Dispose Three.js resources (geometry, material, texture)

### Race Conditions
- [ ] Add isMountedRef to components with async operations
- [ ] Check mounted before all setState calls
- [ ] Add AbortController for all fetch calls
- [ ] Pass signal to fetch options
- [ ] Handle AbortError in catch blocks
- [ ] Clean up timers in useEffect return
- [ ] Wrap multi-step DB operations in transactions

### Testing
- [ ] Test component mount/unmount cycles
- [ ] Test with edge cases (zero values, empty arrays)
- [ ] Verify no React warnings in console
- [ ] Monitor memory in Chrome DevTools
- [ ] Test rapid state changes
- [ ] Verify logs appear correctly
- [ ] Test error scenarios

## Migration Priority

### High Priority (Do First)
1. **Logger Migration** - Improves debugging and monitoring
2. **Safe Math** - Prevents runtime crashes
3. **Memory Cleanup** - Prevents browser performance issues
4. **Race Conditions** - Eliminates React warnings and bugs

### Medium Priority
5. **Error Codes** - Improves user experience and debugging

## File-by-File Migration Strategy

### Strategy 1: Component-First
Migrate components before services:
1. Start with leaf components (no dependencies)
2. Move to container components
3. Migrate services and utilities last

### Strategy 2: Pattern-First
Complete one pattern across all files:
1. Migrate all files to logger first
2. Then migrate all to safe-math
3. Continue with other patterns

### Strategy 3: Feature-First
Migrate by feature area:
1. Asset generation pipeline
2. Armor fitting system
3. Hand rigging system
4. Voice generation
5. Shared utilities

## Common Migration Scenarios

### Scenario 1: React Component
Typical React component needs all patterns:

```typescript
import { useEffect, useRef, useState } from 'react'
import { createLogger } from '@/utils/logger'
import { safeScale } from '@/utils/safe-math'
import { ErrorCodes, createStandardError } from '@/utils/error-messages'

const logger = createLogger('MyComponent')

function MyComponent() {
  const [data, setData] = useState(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const loadData = async () => {
      try {
        const response = await fetch('/api/data', {
          signal: controller.signal
        })

        const result = await response.json()

        if (isMountedRef.current) {
          setData(result)
          logger.info('Data loaded', { count: result.length })
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        if (isMountedRef.current) {
          logger.error('Failed to load data', {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    loadData()

    return () => {
      controller.abort()
    }
  }, [])

  return <div>{/* ... */}</div>
}
```

### Scenario 2: Service Class
Services primarily need logger and safe-math:

```typescript
import { createLogger } from '@/utils/logger'
import { safeScale, safeDivide } from '@/utils/safe-math'

const logger = createLogger('AssetService')

class AssetService {
  async processAsset(asset) {
    logger.info('Processing asset', { assetId: asset.id })

    const scale = safeScale(targetSize, asset.dimensions.height, 1.0)

    try {
      const result = await this.transform(asset, scale)
      logger.info('Asset processed', { assetId: asset.id, scale })
      return result
    } catch (error) {
      logger.error('Processing failed', {
        assetId: asset.id,
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }
}
```

### Scenario 3: API Route
API routes need error codes and logger:

```javascript
import { ErrorCodes, sendErrorResponse } from '../utils/error-messages.mjs'
import { createLogger } from '../utils/logger.mjs'

const logger = createLogger('AssetRoutes')

router.post('/api/assets', async (req, res) => {
  if (!req.body.name) {
    return sendErrorResponse(
      res,
      ErrorCodes.VALIDATION_MISSING_FIELD,
      'Asset name is required',
      { field: 'name' }
    )
  }

  try {
    const asset = await createAsset(req.body)
    logger.info('Asset created', { assetId: asset.id })
    res.json({ asset })
  } catch (error) {
    logger.error('Asset creation failed', {
      name: req.body.name,
      error: error.message
    })

    return sendErrorResponse(
      res,
      ErrorCodes.ASSET_PROCESSING_FAILED,
      'Failed to create asset',
      { reason: error.message }
    )
  }
})
```

## Tools and Automation

### Find Console Statements
```bash
grep -r "console\." src/ --exclude-dir=node_modules
```

### Find Division Operations
```bash
grep -r "/ " src/ --include="*.ts" --include="*.tsx"
```

### Find Blob URL Creation
```bash
grep -r "createObjectURL" src/
```

### Find Missing Cleanup
```bash
grep -r "useEffect" src/ -A 10 | grep -v "return () =>"
```

## Getting Help

### Documentation
- [Logger API Reference](/Users/home/hyperscape-1/packages/asset-forge/src/utils/logger.ts)
- [Safe Math API Reference](/Users/home/hyperscape-1/packages/asset-forge/src/utils/safe-math.ts)
- [Error Codes Reference](/Users/home/hyperscape-1/packages/asset-forge/ERROR_CODES.md)

### Code Examples
All migration guides include complete before/after examples and real codebase references.

### Questions?
Check the "Troubleshooting" section in each migration guide for common issues and solutions.

## Progress Tracking

Create a migration tracking document to monitor progress:

```markdown
# Migration Progress

## Logger Migration
- [ ] src/components/Assets/
- [ ] src/components/Generation/
- [ ] src/services/
- [ ] src/store/

## Safe Math Migration
- [ ] src/services/fitting/
- [ ] src/services/processing/
- [ ] src/components/ArmorFitting/

## Error Codes Migration
- [ ] server/routes/
- [ ] src/services/api/

## Memory Cleanup
- [ ] All components using blob URLs
- [ ] All components using Three.js

## Race Conditions
- [ ] All components with async operations
- [ ] All components with fetch calls
```

## Success Metrics

Track these metrics to measure migration success:

### Code Quality
- ✅ Zero console.* statements in production code
- ✅ Zero division by zero errors
- ✅ Consistent error handling across all routes
- ✅ No memory leaks in long-running sessions
- ✅ No React warnings about setState on unmounted components

### Performance
- ✅ Memory usage stable over time
- ✅ No browser crashes in extended sessions
- ✅ Faster debugging with structured logs

### Developer Experience
- ✅ Easier to debug with context-aware logs
- ✅ Clearer error messages for users
- ✅ More predictable behavior with safe math
- ✅ Fewer mysterious bugs from race conditions

---

**Created**: 2025-10-24
**Wave**: 1-3 Refactoring
**Patterns**: 5 migration guides
**Priority**: High
