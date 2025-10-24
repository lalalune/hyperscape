# Migrating to Standardized Error Codes

> **Migration Guide**: Replace ad-hoc error messages with standardized error codes

## Why Migrate?

Standardized error codes provide significant benefits:

- **Consistency**: Same errors produce same codes across the application
- **User-Friendly**: Automatic mapping to readable error messages
- **Debugging**: Searchable error codes make troubleshooting easier
- **HTTP Status Mapping**: Automatic conversion to appropriate HTTP status codes
- **Client Handling**: Error codes enable smart client-side error handling
- **Analytics**: Track specific error types across the application

## When to Use

Use standardized error codes for:
- API endpoint error responses
- Service layer error handling
- Validation errors
- External API integration errors
- Database operation errors
- File system operations

Continue using plain errors for:
- Temporary debugging (to be removed)
- Internal assertions that should never happen
- Development-only warnings

## Migration Steps

### Step 1: Import Error Code System

For **server-side** code:

```javascript
import { ErrorCodes, sendErrorResponse } from '../utils/error-messages.mjs'
```

For **client-side** code:

```typescript
import { ErrorCodes, createStandardError } from '@/utils/error-messages'
import { handleAPIError, displayError } from '@/utils/client-error-handler'
```

### Step 2: Identify Error Points

Find locations where errors are thrown or returned:

```javascript
// Ad-hoc errors to migrate
throw new Error('Asset not found')
res.status(404).json({ error: 'Not found' })
return { error: 'Invalid input' }
```

### Step 3: Replace with Standard Error Codes

Replace ad-hoc errors with standardized codes:

```javascript
// Server-side
return sendErrorResponse(
  res,
  ErrorCodes.ASSET_NOT_FOUND,
  'Asset with specified ID not found',
  { assetId }
)

// Client-side
throw createStandardError(
  ErrorCodes.VALIDATION_INVALID_INPUT,
  'Name field is required',
  { field: 'name' }
)
```

## Complete Examples

### Before Migration - Server Side

```javascript
// routes/assets.mjs - Before
router.get('/api/assets/:id', async (req, res) => {
  try {
    const asset = await getAsset(req.params.id)

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' })
    }

    res.json({ asset })
  } catch (error) {
    console.error('Error fetching asset:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/api/assets', async (req, res) => {
  if (!req.body.name) {
    return res.status(400).json({ error: 'Name is required' })
  }

  if (req.body.name.length > 100) {
    return res.status(400).json({ error: 'Name too long' })
  }

  try {
    const asset = await createAsset(req.body)
    res.json({ asset })
  } catch (error) {
    if (error.code === 'DUPLICATE_KEY') {
      return res.status(400).json({ error: 'Asset already exists' })
    }

    res.status(500).json({ error: 'Failed to create asset' })
  }
})
```

### After Migration - Server Side

```javascript
// routes/assets.mjs - After
import { ErrorCodes, sendErrorResponse } from '../utils/error-messages.mjs'
import { createLogger } from '../utils/logger.mjs'

const logger = createLogger('AssetRoutes')

router.get('/api/assets/:id', async (req, res) => {
  try {
    const asset = await getAsset(req.params.id)

    if (!asset) {
      return sendErrorResponse(
        res,
        ErrorCodes.ASSET_NOT_FOUND,
        'Asset with specified ID not found',
        { assetId: req.params.id }
      )
    }

    res.json({ asset })
  } catch (error) {
    logger.error('Error fetching asset', {
      assetId: req.params.id,
      error: error.message
    })

    return sendErrorResponse(
      res,
      ErrorCodes.ASSET_PROCESSING_FAILED,
      'Failed to retrieve asset',
      { reason: error.message }
    )
  }
})

router.post('/api/assets', async (req, res) => {
  // Validation
  if (!req.body.name) {
    return sendErrorResponse(
      res,
      ErrorCodes.VALIDATION_MISSING_FIELD,
      'Asset name is required',
      { field: 'name' }
    )
  }

  if (req.body.name.length > 100) {
    return sendErrorResponse(
      res,
      ErrorCodes.VALIDATION_CONSTRAINT_VIOLATION,
      'Asset name exceeds maximum length',
      { field: 'name', maxLength: 100, actual: req.body.name.length }
    )
  }

  try {
    const asset = await createAsset(req.body)
    res.json({ asset })
  } catch (error) {
    if (error.code === 'DUPLICATE_KEY') {
      return sendErrorResponse(
        res,
        ErrorCodes.ASSET_ALREADY_EXISTS,
        'An asset with this name already exists',
        { name: req.body.name }
      )
    }

    logger.error('Failed to create asset', {
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

### Before Migration - Client Side

```typescript
// AssetService.ts - Before
class AssetService {
  async deleteAsset(assetId: string) {
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete asset')
      }

      return await response.json()
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Failed to delete asset')
      throw error
    }
  }

  async createAsset(data: AssetData) {
    if (!data.name) {
      throw new Error('Name is required')
    }

    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error('Failed to create asset')
      }

      return await response.json()
    } catch (error) {
      console.error('Create failed:', error)
      throw error
    }
  }
}
```

### After Migration - Client Side

```typescript
// AssetService.ts - After
import { ErrorCodes, createStandardError } from '@/utils/error-messages'
import { displayError } from '@/utils/client-error-handler'
import { createLogger } from '@/utils/logger'

const logger = createLogger('AssetService')

class AssetService {
  async deleteAsset(assetId: string) {
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()

        // Server returns standardized error with code
        throw errorData.error
      }

      return await response.json()
    } catch (error) {
      logger.error('Delete failed', {
        assetId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Display user-friendly error message
      displayError(error)
      throw error
    }
  }

  async createAsset(data: AssetData) {
    // Client-side validation with standard error codes
    if (!data.name) {
      throw createStandardError(
        ErrorCodes.VALIDATION_MISSING_FIELD,
        'Asset name is required',
        { field: 'name' }
      )
    }

    if (data.name.length > 100) {
      throw createStandardError(
        ErrorCodes.VALIDATION_CONSTRAINT_VIOLATION,
        'Asset name is too long',
        { field: 'name', maxLength: 100 }
      )
    }

    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw errorData.error
      }

      return await response.json()
    } catch (error) {
      logger.error('Create failed', {
        assetName: data.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      displayError(error)
      throw error
    }
  }
}
```

## Error Code Categories

### Authentication (1000-1099)

```javascript
ErrorCodes.AUTH_MISSING_TOKEN          // No auth token provided
ErrorCodes.AUTH_INVALID_TOKEN          // Invalid token format
ErrorCodes.AUTH_EXPIRED_TOKEN          // Token has expired
ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS  // Lacks required permissions
ErrorCodes.AUTH_NOT_AUTHENTICATED      // Not authenticated
ErrorCodes.AUTH_FORBIDDEN              // Access forbidden
```

**Use Cases:**
- JWT validation
- Permission checks
- API authentication
- Protected routes

### Validation (1100-1199)

```javascript
ErrorCodes.VALIDATION_INVALID_INPUT    // Generic invalid input
ErrorCodes.VALIDATION_MISSING_FIELD    // Required field missing
ErrorCodes.VALIDATION_INVALID_FORMAT   // Wrong format (email, etc)
ErrorCodes.VALIDATION_CONSTRAINT_VIOLATION  // Violates constraints
ErrorCodes.VALIDATION_FILE_TYPE        // Invalid file type
ErrorCodes.VALIDATION_FILE_SIZE        // File too large
```

**Use Cases:**
- Form validation
- Request body validation
- File upload validation
- Data constraints

### Generation (1200-1299)

```javascript
ErrorCodes.GENERATION_API_FAILED       // External API failed
ErrorCodes.GENERATION_TIMEOUT          // Generation timed out
ErrorCodes.GENERATION_INVALID_CONFIG   // Invalid config
ErrorCodes.GENERATION_PIPELINE_FAILED  // Pipeline error
ErrorCodes.GENERATION_IMAGE_FAILED     // Image gen failed
ErrorCodes.GENERATION_3D_FAILED        // 3D gen failed
```

**Use Cases:**
- OpenAI API errors
- Meshy.ai errors
- Pipeline failures
- Timeout handling

### Assets (1300-1399)

```javascript
ErrorCodes.ASSET_NOT_FOUND            // Asset doesn't exist
ErrorCodes.ASSET_INVALID_FORMAT       // Invalid asset format
ErrorCodes.ASSET_UPLOAD_FAILED        // Upload failed
ErrorCodes.ASSET_PROCESSING_FAILED    // Processing error
ErrorCodes.ASSET_DOWNLOAD_FAILED      // Download failed
ErrorCodes.ASSET_ALREADY_EXISTS       // Duplicate asset
```

**Use Cases:**
- Asset CRUD operations
- Asset validation
- Asset processing
- Asset storage

### Database (1400-1499)

```javascript
ErrorCodes.DB_CONNECTION_FAILED       // Can't connect to DB
ErrorCodes.DB_QUERY_FAILED            // Query failed
ErrorCodes.DB_CONSTRAINT_VIOLATION    // Constraint error
ErrorCodes.DB_RECORD_NOT_FOUND        // Record not found
ErrorCodes.DB_TRANSACTION_FAILED      // Transaction failed
```

**Use Cases:**
- Database operations
- Query errors
- Transaction errors
- Data integrity

### External APIs (1500-1599)

```javascript
ErrorCodes.EXTERNAL_API_UNAVAILABLE   // API down
ErrorCodes.EXTERNAL_API_RATE_LIMIT    // Rate limited
ErrorCodes.EXTERNAL_API_INVALID_RESPONSE  // Invalid response
ErrorCodes.EXTERNAL_API_TIMEOUT       // API timeout
ErrorCodes.EXTERNAL_API_AUTH_FAILED   // API auth failed
```

**Use Cases:**
- OpenAI integration
- Meshy.ai integration
- ElevenLabs integration
- GitHub API

### Network (2100-2199)

```javascript
ErrorCodes.NETWORK_ERROR              // Network error
ErrorCodes.TIMEOUT_ERROR              // Request timeout
ErrorCodes.CONNECTION_FAILED          // Connection failed
```

**Use Cases:**
- Network failures
- Timeout handling
- Connection errors

## Server-Side Patterns

### Pattern 1: Validation Errors

```javascript
// Check required fields
if (!req.body.email) {
  return sendErrorResponse(
    res,
    ErrorCodes.VALIDATION_MISSING_FIELD,
    'Email is required',
    { field: 'email' }
  )
}

// Check format
if (!isValidEmail(req.body.email)) {
  return sendErrorResponse(
    res,
    ErrorCodes.VALIDATION_INVALID_FORMAT,
    'Invalid email format',
    { field: 'email', value: req.body.email }
  )
}
```

### Pattern 2: Not Found Errors

```javascript
const asset = await getAsset(assetId)

if (!asset) {
  return sendErrorResponse(
    res,
    ErrorCodes.ASSET_NOT_FOUND,
    `Asset with ID ${assetId} not found`,
    { assetId }
  )
}
```

### Pattern 3: External API Errors

```javascript
try {
  const result = await meshyAPI.generate(config)
} catch (error) {
  if (error.status === 429) {
    return sendErrorResponse(
      res,
      ErrorCodes.EXTERNAL_API_RATE_LIMIT,
      'Rate limit exceeded for Meshy.ai',
      { service: 'MeshyAI', retryAfter: error.retryAfter }
    )
  }

  return sendErrorResponse(
    res,
    ErrorCodes.GENERATION_API_FAILED,
    'Failed to generate 3D model',
    { service: 'MeshyAI', reason: error.message }
  )
}
```

### Pattern 4: Database Errors

```javascript
try {
  await db.run(query, params)
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT') {
    return sendErrorResponse(
      res,
      ErrorCodes.DB_CONSTRAINT_VIOLATION,
      'Database constraint violation',
      { constraint: error.constraint }
    )
  }

  return sendErrorResponse(
    res,
    ErrorCodes.DB_QUERY_FAILED,
    'Database operation failed',
    { operation: 'insert', table: 'assets' }
  )
}
```

## Client-Side Patterns

### Pattern 1: Validation Before API Call

```typescript
// Validate on client before making API call
if (!formData.name) {
  throw createStandardError(
    ErrorCodes.VALIDATION_MISSING_FIELD,
    'Name is required',
    { field: 'name' }
  )
}
```

### Pattern 2: Handle API Errors

```typescript
try {
  const response = await fetch('/api/assets', { ... })

  if (!response.ok) {
    const errorData = await response.json()
    // Server returns standardized error
    throw errorData.error
  }

  return await response.json()
} catch (error) {
  // Display user-friendly message based on error code
  displayError(error)
  throw error
}
```

### Pattern 3: Smart Error Handling

```typescript
import { isClientError, isServerError } from '@/utils/error-messages'

try {
  await performOperation()
} catch (error) {
  if (isClientError(error.code)) {
    // Client error - user can fix
    displayError(error, toast)
  } else if (isServerError(error.code)) {
    // Server error - notify support
    logger.error('Server error', { error })
    displayError({
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'Server error. Our team has been notified.'
    })
  }
}
```

## Best Practices

### 1. Always Include Context

Provide relevant details for debugging:

```javascript
// BAD - No context
sendErrorResponse(res, ErrorCodes.ASSET_NOT_FOUND, 'Not found')

// GOOD - Includes context
sendErrorResponse(
  res,
  ErrorCodes.ASSET_NOT_FOUND,
  'Asset with specified ID not found',
  { assetId, requestedBy: req.user.id }
)
```

### 2. Use Most Specific Error Code

Choose the most specific code available:

```javascript
// BAD - Too generic
sendErrorResponse(res, ErrorCodes.VALIDATION_INVALID_INPUT, 'Bad input')

// GOOD - Specific
sendErrorResponse(
  res,
  ErrorCodes.VALIDATION_MISSING_FIELD,
  'Email field is required',
  { field: 'email' }
)
```

### 3. Log Developer Details, Return User Messages

```javascript
try {
  await complexOperation()
} catch (error) {
  // Log technical details for developers
  logger.error('Complex operation failed', {
    stack: error.stack,
    config: operationConfig,
    state: currentState
  })

  // Return user-friendly message
  return sendErrorResponse(
    res,
    ErrorCodes.ASSET_PROCESSING_FAILED,
    'Failed to process asset. Please try again.',
    { assetId }
  )
}
```

### 4. Don't Leak Sensitive Information

```javascript
// BAD - Leaks SQL query
sendErrorResponse(
  res,
  ErrorCodes.DB_QUERY_FAILED,
  `Query failed: ${sqlQuery}`,
  { query: sqlQuery }
)

// GOOD - Generic message
sendErrorResponse(
  res,
  ErrorCodes.DB_QUERY_FAILED,
  'Database operation failed',
  { operation: 'select', table: 'assets' }
)
```

## Common Pitfalls

### Pitfall 1: Wrong HTTP Status

Error codes automatically map to HTTP status:

```javascript
// WRONG - Don't manually set status
res.status(404).json({ error: { code: ErrorCodes.VALIDATION_INVALID_INPUT } })
// ValidationError is 400, not 404!

// CORRECT - sendErrorResponse handles status automatically
sendErrorResponse(res, ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid input')
// Automatically uses 400 status
```

### Pitfall 2: Using Generic Errors for Specific Cases

```javascript
// BAD - Too generic
if (!asset) {
  return sendErrorResponse(res, ErrorCodes.INTERNAL_ERROR, 'Error')
}

// GOOD - Specific error code
if (!asset) {
  return sendErrorResponse(res, ErrorCodes.ASSET_NOT_FOUND, 'Asset not found')
}
```

### Pitfall 3: Forgetting to Return

```javascript
// BAD - Doesn't return, continues execution!
if (!isValid) {
  sendErrorResponse(res, ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid')
}
processData() // Still executes!

// GOOD - Returns to stop execution
if (!isValid) {
  return sendErrorResponse(res, ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid')
}
```

## Troubleshooting

### Issue: Wrong HTTP status code returned

**Cause**: Using wrong error code category

**Solution**: Check error code prefix matches the error type:
- AUTH_ → 401/403
- VAL_ → 400
- ASSET_NOT_FOUND → 404
- GEN_, DB_ → 500

### Issue: Client not showing user-friendly message

**Cause**: Error response format doesn't match expected structure

**Solution**: Ensure server uses `sendErrorResponse()` which includes `userMessage` field

### Issue: Can't find appropriate error code

**Cause**: Missing error code for specific case

**Solution**: Use closest generic code or add new code to `error-messages.ts`

## Migration Checklist

Use this checklist when migrating error handling:

- [ ] Import ErrorCodes and sendErrorResponse/createStandardError
- [ ] Import logger for error logging
- [ ] Replace all res.status().json() with sendErrorResponse()
- [ ] Replace all throw new Error() with createStandardError()
- [ ] Add context objects to all error responses
- [ ] Use most specific error codes available
- [ ] Log technical details before returning errors
- [ ] Remove manual HTTP status codes (handled automatically)
- [ ] Test error responses match expected format
- [ ] Verify client displays user-friendly messages
- [ ] Check error codes map to correct HTTP status
- [ ] Ensure no sensitive data in error responses

## Related Documentation

- [Error Code Reference](/Users/home/hyperscape-1/packages/asset-forge/ERROR_CODES.md)
- [Error Messages API](/Users/home/hyperscape-1/packages/asset-forge/src/utils/error-messages.ts)
- [Logger Migration Guide](/Users/home/hyperscape-1/packages/asset-forge/dev-book/11-development/migrations/console-to-logger.md)

## Examples in Codebase

See these files for real-world examples:

- `/Users/home/hyperscape-1/packages/asset-forge/server/routes/generate-quest.mjs`
- `/Users/home/hyperscape-1/packages/asset-forge/server/routes/generate-voice.mjs`
- `/Users/home/hyperscape-1/packages/asset-forge/src/utils/client-error-handler.ts`

---

**Last Updated**: 2025-10-24
**Migration Priority**: Medium
**Estimated Time**: 15-20 minutes per file
