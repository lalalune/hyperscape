# Migrating from Console to Logger

> **Migration Guide**: Replace console statements with structured logging system

## Why Migrate?

The centralized logger provides significant advantages over console statements:

- **Structured Logging**: Context-aware logging with component names
- **Log Levels**: Differentiate between debug, info, warn, and error messages
- **Production-Safe**: Debug logs automatically suppressed in production
- **Searchable**: Consistent format makes logs easier to search and filter
- **Type-Safe**: TypeScript support for better IDE integration

## When to Use

Migrate to logger for:
- All component and service logging
- Error reporting and debugging
- Performance monitoring
- State change tracking
- API call logging

Continue using console for:
- Quick debugging (temporary, to be removed)
- Build scripts and tools (outside React context)

## Migration Steps

### Step 1: Import Logger

Add the logger import at the top of your file:

```typescript
import { createLogger } from '@/utils/logger'
```

### Step 2: Create Logger Instance

Create a logger instance with a descriptive context name:

```typescript
const logger = createLogger('ComponentName')
```

**Naming Conventions:**
- Components: Use component name (e.g., 'AssetViewer')
- Services: Use service name (e.g., 'AssetService')
- Stores: Use store name (e.g., 'useAssets')
- Utils: Use utility name (e.g., 'FileValidator')

### Step 3: Replace Console Statements

Replace console methods with appropriate log levels:

```typescript
// BEFORE - Unstructured console logging
console.log('User logged in:', userId)
console.log('Processing asset', assetId)
console.warn('Deprecated feature used')
console.error('Database error:', error)
console.debug('State changed', newState)

// AFTER - Structured logging with context
logger.info('User logged in', { userId })
logger.info('Processing asset', { assetId })
logger.warn('Deprecated feature used')
logger.error('Database error', { error: error.message, stack: error.stack })
logger.debug('State changed', { state: newState })
```

### Step 4: Extract Error Details

When logging errors, extract useful information:

```typescript
// BEFORE - Log entire error object
console.error('Failed to save:', error)

// AFTER - Extract structured error data
logger.error('Failed to save', {
  message: error.message,
  stack: error.stack,
  code: error.code,
  context: 'saveAsset'
})
```

## Complete Examples

### Before Migration

```typescript
// AssetService.ts - Before
class AssetService {
  async loadAssets() {
    console.log('Loading assets...')

    try {
      const response = await fetch('/api/assets')
      const assets = await response.json()
      console.log('Loaded assets:', assets.length)
      return assets
    } catch (error) {
      console.error('Failed to load assets:', error)
      throw error
    }
  }

  async deleteAsset(assetId) {
    console.log('Deleting asset:', assetId)

    if (!assetId) {
      console.warn('No asset ID provided')
      return
    }

    console.debug('Asset metadata:', { id: assetId, timestamp: Date.now() })
    await fetch(`/api/assets/${assetId}`, { method: 'DELETE' })
  }
}
```

### After Migration

```typescript
// AssetService.ts - After
import { createLogger } from '@/utils/logger'

const logger = createLogger('AssetService')

class AssetService {
  async loadAssets() {
    logger.info('Loading assets')

    try {
      const response = await fetch('/api/assets')
      const assets = await response.json()
      logger.info('Loaded assets', { count: assets.length })
      return assets
    } catch (error) {
      logger.error('Failed to load assets', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  async deleteAsset(assetId: string) {
    logger.info('Deleting asset', { assetId })

    if (!assetId) {
      logger.warn('No asset ID provided')
      return
    }

    logger.debug('Asset metadata', { id: assetId, timestamp: Date.now() })
    await fetch(`/api/assets/${assetId}`, { method: 'DELETE' })
  }
}
```

## Log Level Guidelines

### debug()
Use for detailed debugging information (only shows in development):

```typescript
logger.debug('Component rendered', { props, state })
logger.debug('Cache hit', { key, value })
logger.debug('Validation passed', { input, rules })
```

### info()
Use for general informational messages:

```typescript
logger.info('User action completed', { action: 'save', assetId })
logger.info('Service initialized', { config })
logger.info('Pipeline started', { pipelineId })
```

### warn()
Use for potentially problematic situations:

```typescript
logger.warn('Deprecated API used', { api: 'oldMethod', replacement: 'newMethod' })
logger.warn('Rate limit approaching', { remaining: 10, limit: 100 })
logger.warn('Invalid input corrected', { input, corrected })
```

### error()
Use for error conditions:

```typescript
logger.error('Operation failed', {
  operation: 'saveAsset',
  error: error.message,
  stack: error.stack
})
logger.error('Validation failed', { field: 'email', reason: 'invalid format' })
logger.error('API call failed', { endpoint, status, response })
```

## Best Practices

### 1. Always Include Context

Pass relevant data as the second parameter:

```typescript
// BAD - No context
logger.info('Asset processed')

// GOOD - Includes context
logger.info('Asset processed', { assetId, duration: 1234, size: 'large' })
```

### 2. Use Appropriate Log Levels

Don't use info for everything:

```typescript
// BAD - Wrong log level
logger.info('This is a serious error!')

// GOOD - Correct log level
logger.error('Failed to save asset', { assetId, error })
```

### 3. Structure Data Properly

Use objects for structured data:

```typescript
// BAD - String concatenation
logger.info(`User ${userId} performed ${action}`)

// GOOD - Structured data
logger.info('User action', { userId, action })
```

### 4. Extract Error Information

Don't log raw error objects:

```typescript
// BAD - Entire error object
logger.error('Error occurred', error)

// GOOD - Extracted error details
logger.error('Error occurred', {
  message: error.message,
  stack: error.stack,
  code: error.code
})
```

### 5. Use Descriptive Messages

Make messages searchable and meaningful:

```typescript
// BAD - Vague message
logger.info('Done')

// GOOD - Descriptive message
logger.info('Asset generation completed', { assetId, duration })
```

## Common Pitfalls

### Pitfall 1: Template Strings
Avoid template strings for structured logging:

```typescript
// AVOID - Loses structure
logger.info(`Processing ${count} assets in ${category}`)

// PREFER - Maintains structure
logger.info('Processing assets', { count, category })
```

### Pitfall 2: Logging Sensitive Data
Never log passwords, tokens, or personal information:

```typescript
// NEVER DO THIS
logger.info('User logged in', { password, apiKey })

// DO THIS INSTEAD
logger.info('User logged in', { userId, timestamp })
```

### Pitfall 3: Over-Logging
Don't log in tight loops:

```typescript
// BAD - Logs thousands of times
assets.forEach(asset => {
  logger.debug('Processing asset', { asset })
  processAsset(asset)
})

// GOOD - Log once with summary
logger.debug('Processing assets', { count: assets.length })
assets.forEach(processAsset)
logger.info('Assets processed', { count: assets.length })
```

## Troubleshooting

### Issue: Debug logs not appearing in development

**Cause**: Logger checks `import.meta.env.DEV` for debug logs

**Solution**: Ensure your development server is running in DEV mode:

```bash
npm run dev  # Should set DEV=true automatically
```

### Issue: Logs appearing as [Object object]

**Cause**: Passing objects as the message parameter

**Solution**: Use message as first param, data as second:

```typescript
// WRONG
logger.info({ userId, action })

// CORRECT
logger.info('User action', { userId, action })
```

### Issue: Console still being used in error handlers

**Cause**: Forgot to replace console in catch blocks

**Solution**: Search codebase for console usage:

```bash
grep -r "console\." src/
```

## Migration Checklist

Use this checklist when migrating a file:

- [ ] Import createLogger from '@/utils/logger'
- [ ] Create logger instance with appropriate context name
- [ ] Replace all console.log() with logger.info()
- [ ] Replace all console.debug() with logger.debug()
- [ ] Replace all console.warn() with logger.warn()
- [ ] Replace all console.error() with logger.error()
- [ ] Add context objects to all log calls
- [ ] Extract error details (message, stack, code)
- [ ] Remove template strings in favor of structured data
- [ ] Verify log levels are appropriate
- [ ] Test in development (debug logs visible)
- [ ] Test in production build (debug logs hidden)

## Related Documentation

- [Logger API Reference](/Users/home/hyperscape-1/packages/asset-forge/src/utils/logger.ts)
- [Code Standards](/Users/home/hyperscape-1/packages/asset-forge/dev-book/11-development/code-standards.md)
- [Debugging Guide](/Users/home/hyperscape-1/packages/asset-forge/dev-book/11-development/debugging.md)

## Examples in Codebase

See these files for real-world examples:

- `/Users/home/hyperscape-1/packages/asset-forge/src/services/AssetService.mjs`
- `/Users/home/hyperscape-1/packages/asset-forge/src/services/GenerationService.mjs`
- `/Users/home/hyperscape-1/packages/asset-forge/src/store/useContentGenerationStore.ts`
- `/Users/home/hyperscape-1/packages/asset-forge/src/utils/safe-math.ts`

---

**Last Updated**: 2025-10-24
**Migration Priority**: High
**Estimated Time**: 5-10 minutes per file
