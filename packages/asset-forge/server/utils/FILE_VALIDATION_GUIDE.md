# File Validation Quick Reference

## Import
```javascript
import {
  validateImageBuffer,
  validateModelBuffer,
  validateBase64Image,
  validateTotalSize,
  FileValidationError,
  FILE_SIZE_LIMITS,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_MODEL_TYPES
} from './fileValidation.mjs'
```

## Basic Usage

### Validate Image Upload
```javascript
try {
  // Decode base64
  const buffer = validateBase64Image(req.body.imageData)

  // Validate format and size
  const { mimeType, ext } = await validateImageBuffer(buffer)

  console.log(`Valid ${mimeType} image (${ext})`)
} catch (error) {
  if (error instanceof FileValidationError) {
    return res.status(400).json({
      error: error.message,
      code: error.code
    })
  }
  throw error
}
```

### Validate GLB Model
```javascript
try {
  const { version } = await validateModelBuffer(modelBuffer)
  console.log(`Valid GLB v${version}`)
} catch (error) {
  if (error instanceof FileValidationError) {
    return res.status(400).json({
      error: error.message,
      code: error.code
    })
  }
  throw error
}
```

### Validate Multiple Files
```javascript
const files = []

for (const upload of uploads) {
  try {
    const buffer = validateBase64Image(upload.data)
    const validation = await validateImageBuffer(buffer)
    files.push({ buffer, size: buffer.length, ...validation })
  } catch (error) {
    if (error instanceof FileValidationError) {
      return res.status(400).json({
        error: `File ${i} invalid: ${error.message}`,
        code: error.code,
        fileIndex: i
      })
    }
    throw error
  }
}

// Validate total size
try {
  validateTotalSize(files)
} catch (error) {
  return res.status(400).json({
    error: error.message,
    code: error.code
  })
}
```

## Custom Size Limits
```javascript
// Override default limits
await validateImageBuffer(buffer, { maxSize: 5 * 1024 * 1024 }) // 5MB

await validateModelBuffer(buffer, { maxSize: 100 * 1024 * 1024 }) // 100MB

validateTotalSize(files, 500 * 1024 * 1024) // 500MB total
```

## Error Handling

### Check Error Type
```javascript
try {
  await validateImageBuffer(buffer)
} catch (error) {
  if (error instanceof FileValidationError) {
    switch (error.code) {
      case 'FILE_TOO_LARGE':
        // Handle oversized file
        break
      case 'INVALID_MIME_TYPE':
        // Handle wrong format
        break
      case 'INVALID_FILE_TYPE':
        // Handle corrupt file
        break
      default:
        // Handle other validation errors
    }
  } else {
    // System error, re-throw
    throw error
  }
}
```

## Size Constants
```javascript
console.log(FILE_SIZE_LIMITS.IMAGE)  // 10485760 (10MB)
console.log(FILE_SIZE_LIMITS.MODEL)  // 52428800 (50MB)
console.log(FILE_SIZE_LIMITS.TOTAL)  // 209715200 (200MB)
```

## Allowed Types
```javascript
console.log(ALLOWED_IMAGE_TYPES)
// ['image/png', 'image/jpeg', 'image/webp']

console.log(ALLOWED_MODEL_TYPES)
// ['model/gltf-binary']
```

## Error Codes Reference

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| `FILE_TOO_LARGE` | File exceeds size limit | 400 |
| `INVALID_FILE_TYPE` | Cannot determine file type | 400 |
| `INVALID_MIME_TYPE` | File type not allowed | 400 |
| `INVALID_BASE64` | Invalid base64 encoding | 400 |
| `BASE64_DECODE_ERROR` | Failed to decode base64 | 400 |
| `INVALID_GLB_FORMAT` | Invalid GLB structure | 400 |
| `UNSUPPORTED_VERSION` | Unsupported GLB version | 400 |
| `TOTAL_SIZE_EXCEEDED` | Total upload too large | 400 |
| `INVALID_IMAGE_DATA` | Suspiciously small image | 400 |

## Best Practices

### ✅ DO
- Always validate user uploads before saving
- Validate before expensive operations (AI, cloud upload)
- Use try/catch for validation errors
- Return specific error codes to client
- Log validation failures

### ❌ DON'T
- Trust file extensions alone
- Skip validation for "internal" uploads
- Ignore validation errors
- Upload before validating
- Return stack traces to client

## Examples

### Express Route Handler
```javascript
app.post('/api/upload', async (req, res) => {
  try {
    const { imageData } = req.body

    // Validate
    const buffer = validateBase64Image(imageData)
    await validateImageBuffer(buffer)

    // Save file
    await saveFile(buffer)

    res.json({ success: true })
  } catch (error) {
    if (error instanceof FileValidationError) {
      return res.status(400).json({
        error: error.message,
        code: error.code
      })
    }
    next(error)
  }
})
```

### Blob Upload with Validation
```javascript
import { validateImageBuffer } from './utils/fileValidation.mjs'

async function uploadToBlob(file) {
  // Validate first
  await validateImageBuffer(file.buffer)

  // Then upload
  const url = await blob.upload(file)
  return url
}
```

### Batch Upload with Per-File Errors
```javascript
const results = []

for (let i = 0; i < files.length; i++) {
  try {
    const buffer = validateBase64Image(files[i].data)
    await validateImageBuffer(buffer)
    results.push({ index: i, status: 'valid', buffer })
  } catch (error) {
    if (error instanceof FileValidationError) {
      results.push({
        index: i,
        status: 'invalid',
        error: error.message,
        code: error.code
      })
    } else {
      throw error
    }
  }
}

// Filter to only valid files
const validFiles = results.filter(r => r.status === 'valid')
```

## Magic Numbers Reference

| Format | Magic Bytes | Hex |
|--------|-------------|-----|
| PNG | `89 50 4E 47 0D 0A 1A 0A` | `137 80 78 71 13 10 26 10` |
| JPEG | `FF D8 FF` | `255 216 255` |
| WebP | `RIFF ... WEBP` | `52 49 46 46 ... 57 45 42 50` |
| GLB | `glTF` (ASCII) | `67 6C 54 46` |

## Notes

- The module includes a fallback for when `file-type` package is not installed
- Magic number checking is fast (O(1) operation)
- Validation does not modify the buffer
- All validation functions are async (for consistency)
