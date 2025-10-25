# REST API Reference

Asset Forge provides a comprehensive REST API for asset management, generation, and manipulation. This reference covers all available endpoints with detailed request/response examples, authentication requirements, error codes, and rate limits.

## Table of Contents

1. [API Overview](#api-overview)
2. [Base URL and Configuration](#base-url-and-configuration)
3. [Authentication](#authentication)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Asset Management Endpoints](#asset-management-endpoints)
7. [Generation Pipeline Endpoints](#generation-pipeline-endpoints)
8. [Material and Retexturing Endpoints](#material-and-retexturing-endpoints)
9. [Sprite Generation Endpoints](#sprite-generation-endpoints)
10. [AI Detection Endpoints](#ai-detection-endpoints)
11. [Utility Endpoints](#utility-endpoints)
12. [Response Formats](#response-formats)

## API Overview

The Asset Forge REST API is built on Express.js and provides both synchronous and asynchronous operations. The API follows RESTful conventions with JSON request/response bodies and uses standard HTTP status codes for error handling.

### Key Features

- **Automatic timeout handling**: All endpoints include configurable timeouts (default 15s)
- **CORS support**: Cross-origin requests enabled with security headers
- **Large payload support**: Up to 25MB for base64 image uploads
- **Security headers**: OWASP-compliant headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- **No-cache directives**: Asset listings include cache-control headers for real-time updates

## Base URL and Configuration

### Development Environment

```bash
# Frontend (Vite dev server)
http://localhost:3000

# Backend API server
http://localhost:3004

# Image hosting service
http://localhost:8080
```

### Production Environment

```bash
# Configured via environment variables
FRONTEND_URL=https://your-domain.com
API_PORT=3004
IMAGE_SERVER_URL=https://images.your-domain.com
```

### Environment Variables

```bash
# Required
MESHY_API_KEY=your_meshy_api_key          # For 3D generation and retexturing
OPENAI_API_KEY=your_openai_api_key        # For AI-powered features

# Optional
API_PORT=3004                              # API server port (default: 3004)
NODE_ENV=production                        # Environment (development/production)
FRONTEND_URL=https://your-domain.com       # Frontend URL for CORS
IMAGE_SERVER_URL=http://localhost:8080     # Image hosting service URL
VITE_GENERATION_API_URL=http://localhost:3001/api  # Generation service URL
```

## Authentication

Currently, the Asset Forge API does not require authentication for development. For production deployments, implement one of the following authentication strategies:

### Recommended Authentication Methods

1. **API Keys**: Add API key validation middleware
2. **JWT Tokens**: Implement JSON Web Token authentication
3. **OAuth 2.0**: Use OAuth providers for user authentication
4. **Session-based**: Use express-session for stateful authentication

### Example: Adding API Key Authentication

```javascript
// Middleware example (not currently implemented)
app.use('/api', (req, res, next) => {
  const apiKey = req.headers['x-api-key']
  if (!apiKey || !isValidApiKey(apiKey)) {
    return res.status(401).json({ error: 'Invalid or missing API key' })
  }
  next()
})
```

## Error Handling

The API uses a centralized error handling middleware that catches all errors and returns consistent error responses.

### Error Response Format

```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

### HTTP Status Codes

| Status Code | Meaning | Common Causes |
|-------------|---------|---------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Server-side error |
| 502 | Bad Gateway | External service error (Meshy, OpenAI) |
| 503 | Service Unavailable | Service temporarily unavailable |

### Common Error Scenarios

```javascript
// 400 Bad Request
{
  "error": "name, type, and subtype are required"
}

// 404 Not Found
{
  "error": "Asset not found"
}

// 500 Internal Server Error
{
  "error": "Failed to process asset generation"
}
```

## Rate Limiting

Currently, rate limiting is not implemented in the Asset Forge API. For production deployments, implement rate limiting using middleware like `express-rate-limit`.

### Recommended Rate Limit Configuration

```javascript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
})

// Apply to all API routes
app.use('/api/', limiter)
```

### Rate Limit Headers

When rate limiting is implemented, responses include these headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Asset Management Endpoints

### GET /api/assets

List all available assets with metadata.

**Request:**
```http
GET /api/assets HTTP/1.1
Host: localhost:3004
Cache-Control: no-cache
Pragma: no-cache
```

**Response:**
```json
[
  {
    "id": "bronze-sword-base",
    "name": "Bronze Sword (Base)",
    "description": "A basic bronze sword with simple design",
    "type": "weapon",
    "metadata": {
      "isBaseModel": true,
      "gameStyle": "runescape",
      "weaponType": "sword",
      "tier": 1,
      "polycount": 5000,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    "hasModel": true,
    "modelFile": "bronze-sword-base.glb",
    "generatedAt": "2025-01-15T10:30:00.000Z"
  }
]
```

**Headers:**
- Cache-Control: `no-store, no-cache, must-revalidate, proxy-revalidate`
- Pragma: `no-cache`
- Expires: `0`

**Notes:**
- Response includes aggressive no-cache headers to ensure real-time asset updates
- Assets are read from the `gdd-assets` directory
- Metadata includes polycount, creation time, and game style information

### GET /api/assets/:id/model

Download the 3D model file for a specific asset.

**Request:**
```http
GET /api/assets/bronze-sword-base/model HTTP/1.1
Host: localhost:3004
```

**Response:**
- **Content-Type:** `model/gltf-binary`
- **Body:** Binary GLB file data

**Error Responses:**
```json
// 404 Not Found
{
  "error": "Model file not found for asset: bronze-sword-base"
}
```

**Notes:**
- Returns the GLB file directly using `res.sendFile()`
- Model files must exist in `gdd-assets/{assetId}/{assetId}.glb`
- Use HEAD request to check model existence without downloading

### HEAD /api/assets/:id/model

Check if a model exists without downloading it.

**Request:**
```http
HEAD /api/assets/bronze-sword-base/model HTTP/1.1
Host: localhost:3004
```

**Response:**
- **Status:** 200 (model exists) or 404 (model not found)
- **Body:** Empty

**Notes:**
- Useful for checking model availability before rendering
- No response body, only HTTP status code

### GET /api/assets/:id/*

Retrieve any file from an asset's directory.

**Request:**
```http
GET /api/assets/bronze-sword-base/animations/idle.glb HTTP/1.1
Host: localhost:3004
```

**Response:**
- **Content-Type:** Determined by file extension
- **Body:** File data

**Security:**
- Path traversal protection implemented
- Normalized paths are checked to ensure they remain within asset directory
- Requests attempting to access parent directories return 403 Forbidden

**Example Paths:**
```bash
/api/assets/{assetId}/animations/idle.glb    # Animation file
/api/assets/{assetId}/textures/diffuse.png   # Texture file
/api/assets/{assetId}/metadata.json          # Metadata file
/api/assets/{assetId}/concept-art.png        # Concept art image
```

### DELETE /api/assets/:id

Delete an asset and optionally its variants.

**Request:**
```http
DELETE /api/assets/bronze-sword-base?includeVariants=true HTTP/1.1
Host: localhost:3004
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| includeVariants | boolean | No | Delete all material variants (default: false) |

**Response:**
```json
{
  "success": true,
  "message": "Asset bronze-sword-base deleted successfully"
}
```

**Error Responses:**
```json
// 404 Not Found
{
  "error": "Asset not found"
}
```

**Notes:**
- Deletes the entire asset directory from `gdd-assets`
- When `includeVariants=true`, deletes base model and all retextured variants
- Operation is irreversible - use with caution

### PATCH /api/assets/:id

Update asset metadata.

**Request:**
```http
PATCH /api/assets/bronze-sword-base HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "name": "Updated Bronze Sword",
  "description": "An improved bronze sword with enhanced details",
  "metadata": {
    "tier": 2,
    "featured": true
  }
}
```

**Response:**
```json
{
  "id": "bronze-sword-base",
  "name": "Updated Bronze Sword",
  "description": "An improved bronze sword with enhanced details",
  "type": "weapon",
  "metadata": {
    "isBaseModel": true,
    "gameStyle": "runescape",
    "weaponType": "sword",
    "tier": 2,
    "featured": true,
    "updatedAt": "2025-01-15T11:00:00.000Z"
  },
  "hasModel": true,
  "modelFile": "bronze-sword-base.glb",
  "generatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Updatable Fields:**
- `name`: Asset display name
- `description`: Asset description
- `metadata`: Custom metadata fields (merged with existing)

**Notes:**
- Updates the `metadata.json` file in the asset directory
- Automatically sets `updatedAt` timestamp
- Partial updates supported - only provided fields are modified

## Generation Pipeline Endpoints

### POST /api/generation/pipeline

Start a new asset generation pipeline.

**Request:**
```http
POST /api/generation/pipeline HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "name": "Steel Longsword",
  "type": "weapon",
  "subtype": "sword",
  "description": "A polished steel longsword with leather grip",
  "style": "runescape2007",
  "assetId": "steel-longsword",
  "generationType": "item",
  "quality": "high",
  "metadata": {
    "gameStyle": "runescape",
    "useGPT4Enhancement": true
  },
  "materialPresets": [
    {
      "id": "bronze",
      "name": "bronze",
      "displayName": "Bronze",
      "category": "metal",
      "tier": 1,
      "color": "#CD7F32",
      "stylePrompt": "bronze texture, low-poly RuneScape style"
    },
    {
      "id": "steel",
      "name": "steel",
      "displayName": "Steel",
      "category": "metal",
      "tier": 2,
      "color": "#C0C0C0",
      "stylePrompt": "polished steel texture, low-poly RuneScape style"
    }
  ],
  "enableGeneration": true,
  "enableRetexturing": true,
  "enableSprites": true,
  "spriteConfig": {
    "angles": 8,
    "resolution": 512,
    "backgroundColor": "transparent"
  }
}
```

**Response:**
```json
{
  "pipelineId": "pipe_1705318200000_abc123",
  "status": "initializing",
  "message": "Pipeline started successfully"
}
```

**Configuration Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Asset display name |
| type | string | Yes | Asset type (weapon, armor, character, etc.) |
| subtype | string | Yes | Asset subtype (sword, helmet, humanoid, etc.) |
| description | string | No | Detailed asset description |
| style | string | No | Visual style (runescape2007, generic, etc.) |
| assetId | string | No | Custom asset ID (auto-generated if not provided) |
| generationType | string | No | Generation type (item or avatar, default: item) |
| quality | string | No | Quality level (standard, high, ultra) |
| enableGeneration | boolean | No | Enable 3D model generation (default: true) |
| enableRetexturing | boolean | No | Enable material variants (default: false) |
| enableSprites | boolean | No | Enable sprite generation (default: false) |
| enableRigging | boolean | No | Enable character rigging (default: false) |
| materialPresets | array | No | Material variants for retexturing |
| spriteConfig | object | No | Sprite generation configuration |
| riggingOptions | object | No | Character rigging options |
| customPrompts | object | No | Custom prompt overrides |

**Pipeline Stages:**

The generation pipeline consists of three stages:

1. **Generation** (required): Create base 3D model from description
2. **Retexturing** (optional): Generate material variants
3. **Sprites** (optional): Create 2D sprite renders

**Notes:**
- Pipeline ID is used to poll for status updates
- Pipeline executes asynchronously
- Status updates available via GET /api/generation/pipeline/:pipelineId
- Large payloads (up to 25MB) supported for reference images

### GET /api/generation/pipeline/:pipelineId

Get the current status of a generation pipeline.

**Request:**
```http
GET /api/generation/pipeline/pipe_1705318200000_abc123 HTTP/1.1
Host: localhost:3004
```

**Response:**
```json
{
  "id": "pipe_1705318200000_abc123",
  "status": "processing",
  "progress": 45,
  "stages": {
    "generation": {
      "status": "completed",
      "progress": 100
    },
    "retexturing": {
      "status": "processing",
      "progress": 50
    },
    "sprites": {
      "status": "pending",
      "progress": 0
    }
  },
  "results": {
    "image3D": {
      "localPath": "gdd-assets/steel-longsword/steel-longsword.glb",
      "modelUrl": "/api/assets/steel-longsword/model"
    },
    "textureGeneration": {
      "variants": [
        {
          "name": "Bronze Steel Longsword",
          "modelUrl": "/api/assets/steel-longsword-bronze/model"
        }
      ]
    }
  }
}
```

**Pipeline Status Values:**

| Status | Description |
|--------|-------------|
| initializing | Pipeline is being set up |
| processing | Pipeline is actively executing |
| completed | All stages completed successfully |
| failed | Pipeline encountered an error |

**Stage Status Values:**

| Status | Description |
|--------|-------------|
| pending | Stage not yet started |
| processing | Stage is actively executing |
| completed | Stage finished successfully |
| failed | Stage encountered an error |

**Polling Recommendations:**
- Poll every 2 seconds for status updates
- Stop polling when status is `completed` or `failed`
- Implement exponential backoff for network errors
- Maximum polling duration: 10 minutes

## Material and Retexturing Endpoints

### GET /api/material-presets

Retrieve all available material presets.

**Request:**
```http
GET /api/material-presets HTTP/1.1
Host: localhost:3004
```

**Response:**
```json
[
  {
    "id": "bronze",
    "name": "bronze",
    "displayName": "Bronze",
    "category": "metal",
    "tier": 1,
    "color": "#CD7F32",
    "stylePrompt": "bronze metal with copper-brown coloring, low-poly RuneScape 2007 style, simple shading",
    "description": "Basic bronze metal with copper-brown coloring"
  },
  {
    "id": "steel",
    "name": "steel",
    "displayName": "Steel",
    "category": "metal",
    "tier": 2,
    "color": "#C0C0C0",
    "stylePrompt": "polished steel metal with silver-gray finish, low-poly RuneScape style",
    "description": "Strong steel metal with silver-gray finish"
  }
]
```

**Notes:**
- Presets loaded from `public/prompts/material-presets.json`
- Used for retexturing base models with different materials
- Each preset includes style prompt for AI generation

### POST /api/material-presets

Save updated material presets.

**Request:**
```http
POST /api/material-presets HTTP/1.1
Host: localhost:3004
Content-Type: application/json

[
  {
    "id": "custom-material",
    "name": "custom-material",
    "displayName": "Custom Material",
    "category": "custom",
    "tier": 1,
    "color": "#FF5733",
    "stylePrompt": "custom material with unique properties",
    "description": "A custom material preset"
  }
]
```

**Response:**
```json
{
  "success": true,
  "message": "Material presets saved successfully"
}
```

**Validation:**
- Request body must be an array
- Each preset must have: `id`, `name`, `displayName`, `stylePrompt`
- Invalid presets return 400 Bad Request

### POST /api/retexture

Apply a material preset to an existing base model.

**Request:**
```http
POST /api/retexture HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "baseAssetId": "sword-base",
  "materialPreset": {
    "id": "steel",
    "name": "steel",
    "displayName": "Steel",
    "category": "metal",
    "tier": 2,
    "color": "#C0C0C0",
    "stylePrompt": "polished steel texture"
  },
  "outputName": "Steel Sword"
}
```

**Response:**
```json
{
  "success": true,
  "assetId": "sword-steel",
  "message": "Asset retextured successfully",
  "asset": {
    "id": "sword-steel",
    "name": "Steel Sword",
    "description": "A sword with steel texture",
    "type": "weapon",
    "metadata": {
      "baseAssetId": "sword-base",
      "materialPreset": "steel",
      "tier": 2
    },
    "hasModel": true,
    "modelFile": "sword-steel.glb"
  }
}
```

**Notes:**
- Requires MESHY_API_KEY environment variable
- Creates a new asset with retextured model
- Original base model remains unchanged
- Retexturing uses Meshy AI texture generation

### POST /api/regenerate-base/:baseAssetId

Regenerate the base model from its original configuration.

**Request:**
```http
POST /api/regenerate-base/sword-base HTTP/1.1
Host: localhost:3004
```

**Response:**
```json
{
  "success": true,
  "assetId": "sword-base",
  "message": "Base model regenerated successfully",
  "asset": {
    "id": "sword-base",
    "name": "Sword (Base)",
    "type": "weapon",
    "hasModel": true,
    "modelFile": "sword-base.glb",
    "generatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

**Notes:**
- Requires original generation configuration stored in metadata
- Uses same prompts and settings as original generation
- Replaces existing base model file

## Sprite Generation Endpoints

### POST /api/assets/:id/sprites

Save generated sprites for an asset.

**Request:**
```http
POST /api/assets/bronze-sword-base/sprites HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "sprites": [
    {
      "angle": 0,
      "imageData": "data:image/png;base64,iVBORw0KGgoAAAANS..."
    },
    {
      "angle": 45,
      "imageData": "data:image/png;base64,iVBORw0KGgoAAAANS..."
    }
  ],
  "config": {
    "angles": 8,
    "resolution": 512,
    "backgroundColor": "transparent"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "8 sprites saved successfully",
  "spritesDir": "gdd-assets/bronze-sword-base/sprites",
  "spriteFiles": [
    "0deg.png",
    "45deg.png",
    "90deg.png",
    "135deg.png",
    "180deg.png",
    "225deg.png",
    "270deg.png",
    "315deg.png"
  ]
}
```

**Process:**
1. Creates `sprites` directory in asset folder
2. Extracts base64 image data from data URLs
3. Saves each sprite as `{angle}deg.png`
4. Creates `sprite-metadata.json` with configuration
5. Updates asset metadata with sprite information

**Sprite Metadata Format:**
```json
{
  "assetId": "bronze-sword-base",
  "config": {
    "angles": 8,
    "resolution": 512,
    "backgroundColor": "transparent"
  },
  "angles": [0, 45, 90, 135, 180, 225, 270, 315],
  "spriteCount": 8,
  "status": "completed",
  "generatedAt": "2025-01-15T12:30:00.000Z"
}
```

## AI Detection Endpoints

### POST /api/weapon-handle-detect

Use GPT-4 Vision to detect weapon grip location in an image.

**Request:**
```http
POST /api/weapon-handle-detect HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "angle": "side",
  "promptHint": "This is a longsword with wrapped leather grip"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | string | Yes | Base64-encoded image data URL |
| angle | string | No | View angle (side, front, etc.) |
| promptHint | string | No | Additional context for AI |

**Response:**
```json
{
  "success": true,
  "gripData": {
    "gripBounds": {
      "minX": 200,
      "minY": 350,
      "maxX": 300,
      "maxY": 450
    },
    "confidence": 0.92,
    "weaponType": "sword",
    "gripDescription": "Wrapped leather handle below crossguard",
    "detectedParts": {
      "blade": "Wide metallic blade extending upward",
      "handle": "Narrow wrapped section in lower quarter",
      "guard": "Horizontal crossguard separating blade and handle"
    }
  },
  "originalImage": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

**AI Model:**
- Model: `gpt-4o-mini`
- Temperature: 0.3 (consistent results)
- Max tokens: 300
- Response format: JSON object

**Notes:**
- Requires OPENAI_API_KEY environment variable
- Image should be 512x512 pixels for best results
- Weapon should be oriented vertically (blade up, handle down)
- Confidence score indicates AI certainty (0-1)

### POST /api/weapon-orientation-detect

Detect if a weapon is upside down and needs rotation.

**Request:**
```http
POST /api/weapon-orientation-detect HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

**Response:**
```json
{
  "success": true,
  "needsFlip": false,
  "currentOrientation": "Blade pointing up, handle at bottom",
  "reason": "Weapon is correctly oriented with sharp end up and grip down"
}
```

**AI Model:**
- Model: `gpt-4o-mini`
- Temperature: 0.2 (highly consistent)
- Max tokens: 200
- Response format: JSON object

**Use Cases:**
- Automatic weapon orientation correction
- Quality control for generated assets
- Ensuring consistent weapon positioning

## Utility Endpoints

### GET /api/health

Check API health and service availability.

**Request:**
```http
GET /api/health HTTP/1.1
Host: localhost:3004
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "services": {
    "meshy": true,
    "openai": true
  }
}
```

**Status Values:**
- `healthy`: API is operational
- `degraded`: API operational but some services unavailable
- `unhealthy`: API experiencing issues

**Service Flags:**
- `meshy`: MESHY_API_KEY configured
- `openai`: OPENAI_API_KEY configured

**Notes:**
- Lightweight endpoint for health checks
- Use for monitoring and load balancer health probes
- Does not validate API keys, only checks existence

## Response Formats

### Success Response

Standard success response format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response

Standard error response format:

```json
{
  "error": "Error message describing the issue",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Pagination Response

For endpoints that support pagination (future enhancement):

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

## Best Practices

### Request Optimization

1. **Use HEAD requests** to check resource existence before downloading
2. **Implement client-side caching** for material presets and static data
3. **Compress request bodies** for large payloads (reference images)
4. **Use conditional requests** with ETag headers (when implemented)

### Error Handling

1. **Implement retry logic** with exponential backoff for network errors
2. **Handle timeout errors** gracefully (default 15s timeout)
3. **Validate inputs** before sending requests
4. **Log errors** for debugging and monitoring

### Performance

1. **Batch operations** when possible (multiple asset updates)
2. **Use polling efficiently** (2s intervals, exponential backoff on errors)
3. **Implement request debouncing** for user-triggered operations
4. **Cache responses** when appropriate

### Security

1. **Validate file paths** to prevent directory traversal
2. **Sanitize user inputs** before passing to AI services
3. **Implement rate limiting** in production
4. **Use HTTPS** in production environments
5. **Add authentication** before deploying to production

## Example API Client

```typescript
import { apiFetch } from './utils/api'

class AssetForgeAPI {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:3004/api') {
    this.baseUrl = baseUrl
  }

  async listAssets() {
    const response = await apiFetch(`${this.baseUrl}/assets`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeoutMs: 15000
    })

    if (!response.ok) {
      throw new Error('Failed to fetch assets')
    }

    return response.json()
  }

  async startPipeline(config: GenerationConfig) {
    const response = await apiFetch(`${this.baseUrl}/generation/pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config),
      timeoutMs: 30000
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to start pipeline')
    }

    return response.json()
  }

  async getPipelineStatus(pipelineId: string) {
    const response = await apiFetch(
      `${this.baseUrl}/generation/pipeline/${pipelineId}`,
      { timeoutMs: 15000 }
    )

    if (!response.ok) {
      throw new Error('Failed to get pipeline status')
    }

    return response.json()
  }
}

export const api = new AssetForgeAPI()
```

## Conclusion

The Asset Forge REST API provides comprehensive endpoints for managing 3D assets, generating new models, and manipulating materials. All endpoints follow RESTful conventions and return consistent JSON responses. For production deployments, implement authentication, rate limiting, and monitoring to ensure secure and reliable operation.
