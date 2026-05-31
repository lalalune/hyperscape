# API Reference

The Asset Forge backend provides a comprehensive REST API for 3D asset generation, management, and manipulation. Built with Express.js, the API server orchestrates AI-powered workflows through OpenAI and Meshy APIs while managing local asset storage and metadata.

## Table of Contents

- [Server Overview](#server-overview)
- [Authentication](#authentication)
- [Health & Status Endpoints](#health--status-endpoints)
- [Asset Management Endpoints](#asset-management-endpoints)
- [Material Preset Endpoints](#material-preset-endpoints)
- [Retexture Endpoints](#retexture-endpoints)
- [Generation Pipeline Endpoints](#generation-pipeline-endpoints)
- [Weapon Detection Endpoints](#weapon-detection-endpoints)
- [Prompt Management Endpoints](#prompt-management-endpoints)
- [Sprite Generation Endpoints](#sprite-generation-endpoints)
- [Error Handling](#error-handling)
- [Rate Limits & Timeouts](#rate-limits--timeouts)

## Server Overview

**Base URL:** `http://localhost:3004` (default)
**Protocol:** HTTP/HTTPS
**Request Format:** JSON
**Response Format:** JSON
**CORS:** Enabled for development origins

### Configuration

The server is configured via environment variables:

```bash
API_PORT=3004                    # Server port
MESHY_API_KEY=msy_xxx           # Meshy AI API key
OPENAI_API_KEY=sk-xxx           # OpenAI API key
IMAGE_SERVER_URL=http://...     # Public image hosting URL
NODE_ENV=development            # Environment mode
```

### Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Access-Control-Allow-Credentials: true`

## Authentication

**Current Status:** No authentication required (development mode)

In production, implement authentication using:
- JWT tokens for session management
- API keys for service-to-service communication
- Rate limiting per client
- Request signing for sensitive operations

**Future Endpoints:**
```
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
```

## Health & Status Endpoints

### GET /api/health

Check server health and service availability.

**Request:**
```http
GET /api/health HTTP/1.1
Host: localhost:3004
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-21T10:30:00.000Z",
  "services": {
    "meshy": true,
    "openai": true
  }
}
```

**Response Fields:**
- `status` (string): Server status ("healthy" or "degraded")
- `timestamp` (ISO 8601): Current server time
- `services.meshy` (boolean): Meshy API key configured
- `services.openai` (boolean): OpenAI API key configured

**Use Cases:**
- Health checks for load balancers
- Monitoring service availability
- Debugging API key configuration

## Asset Management Endpoints

### GET /api/assets

List all assets in the gdd-assets directory.

**Request:**
```http
GET /api/assets HTTP/1.1
Host: localhost:3004
Cache-Control: no-cache
```

**Response (200 OK):**
```json
[
  {
    "id": "goblin-warrior-base",
    "name": "goblin-warrior-base",
    "description": "A fierce goblin warrior character",
    "type": "character",
    "metadata": {
      "name": "goblin-warrior-base",
      "type": "character",
      "subtype": "humanoid",
      "isBaseModel": true,
      "hasModel": true,
      "hasConceptArt": true,
      "isRigged": true,
      "generatedAt": "2025-10-20T15:30:00.000Z",
      "completedAt": "2025-10-20T15:35:00.000Z",
      "workflow": "GPT-4 → GPT-Image-1 → Meshy Image-to-3D (Base Model)",
      "meshyTaskId": "abc123",
      "variants": ["goblin-warrior-bronze", "goblin-warrior-steel"],
      "variantCount": 2
    },
    "hasModel": true,
    "modelFile": "goblin-warrior-base.glb",
    "generatedAt": "2025-10-20T15:30:00.000Z"
  }
]
```

**Cache Headers:**
```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

**Sort Order:** Newest first (by `generatedAt`)

**Error Responses:**
- `500 Internal Server Error`: Failed to read asset directory

### GET /api/assets/:id/model

Download the 3D model file for an asset.

**Request:**
```http
GET /api/assets/goblin-warrior-base/model HTTP/1.1
Host: localhost:3004
```

**Response (200 OK):**
```
Content-Type: model/gltf-binary
Content-Disposition: attachment; filename="goblin-warrior-base.glb"
Content-Length: 2458624

[Binary GLB data]
```

**Character Model Selection:**
For character assets, the API returns the rigged model if available (`{assetId}_rigged.glb`), otherwise the standard model (`{assetId}.glb`).

**Error Responses:**
- `404 Not Found`: Asset or model file not found
- `500 Internal Server Error`: File system error

### HEAD /api/assets/:id/model

Check if model file exists without downloading.

**Request:**
```http
HEAD /api/assets/goblin-warrior-base/model HTTP/1.1
Host: localhost:3004
```

**Response (200 OK):**
```
Content-Type: model/gltf-binary
Content-Length: 2458624
```

**Error Responses:**
- `404 Not Found`: Asset or model file not found
- `500 Internal Server Error`: File system error

### GET /api/assets/:id/*

Serve any file from an asset directory (animations, textures, metadata).

**Request:**
```http
GET /api/assets/goblin-warrior-base/animations/walking.glb HTTP/1.1
Host: localhost:3004
```

**Response (200 OK):**
```
Content-Type: model/gltf-binary
[Binary animation data]
```

**Security:**
- Directory traversal protection (normalized paths)
- Requests outside asset directory return 403 Forbidden

**Common File Paths:**
- `/animations/walking.glb` - Walking animation
- `/animations/running.glb` - Running animation
- `/sprites/0deg.png` - Sprite at 0 degrees
- `/concept-art.png` - Concept art image
- `/metadata.json` - Asset metadata

**Error Responses:**
- `403 Forbidden`: Path traversal attempt
- `404 Not Found`: File not found
- `500 Internal Server Error`: File system error

### PATCH /api/assets/:id

Update asset metadata.

**Request:**
```http
PATCH /api/assets/goblin-warrior-base HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "type": "character",
  "name": "goblin-warrior-v2",
  "metadata": {
    "description": "Updated goblin warrior description",
    "tags": ["enemy", "goblin", "warrior"]
  }
}
```

**Request Body:**
- `type` (string, optional): Asset type (character, weapon, armor, etc.)
- `name` (string, optional): New asset name (triggers directory rename)
- `metadata` (object, optional): Metadata fields to update

**Response (200 OK):**
```json
{
  "id": "goblin-warrior-v2",
  "name": "goblin-warrior-v2",
  "description": "Updated goblin warrior description",
  "type": "character",
  "metadata": {
    "name": "goblin-warrior-v2",
    "description": "Updated goblin warrior description",
    "tags": ["enemy", "goblin", "warrior"],
    "lastModified": "2025-10-21T10:30:00.000Z"
  },
  "hasModel": true,
  "modelFile": "goblin-warrior-v2.glb"
}
```

**Name Change Behavior:**
When `name` is provided:
1. Creates new directory with new name
2. Moves all files to new directory
3. Updates metadata with new name
4. Updates dependencies file
5. Deletes old directory

**Error Responses:**
- `400 Bad Request`: Invalid update data
- `404 Not Found`: Asset not found
- `409 Conflict`: New name already exists
- `500 Internal Server Error`: File system error

### DELETE /api/assets/:id

Delete an asset and optionally its variants.

**Request:**
```http
DELETE /api/assets/goblin-warrior-base?includeVariants=true HTTP/1.1
Host: localhost:3004
```

**Query Parameters:**
- `includeVariants` (boolean, default: false): Delete all material variants

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Asset goblin-warrior-base deleted successfully"
}
```

**Cascade Deletion:**
When `includeVariants=true`:
1. Finds all variants where `parentBaseModel` matches the asset ID
2. Deletes each variant directory
3. Deletes the base asset directory
4. Updates `.dependencies.json`

**Error Responses:**
- `404 Not Found`: Asset not found
- `500 Internal Server Error`: Deletion failed

## Material Preset Endpoints

### GET /api/material-presets

Retrieve all material presets for retexturing.

**Request:**
```http
GET /api/material-presets HTTP/1.1
Host: localhost:3004
```

**Response (200 OK):**
```json
[
  {
    "id": "bronze",
    "name": "bronze",
    "displayName": "Bronze",
    "category": "metal",
    "tier": 1,
    "color": "#CD7F32",
    "stylePrompt": "bronze metal texture with oxidized patina, warm copper-brown tones, slightly weathered, game-ready PBR materials"
  },
  {
    "id": "steel",
    "name": "steel",
    "displayName": "Steel",
    "category": "metal",
    "tier": 2,
    "color": "#B0C4DE",
    "stylePrompt": "polished steel metal texture, reflective silver-gray surface, industrial finish, game-ready PBR materials"
  }
]
```

**Preset Fields:**
- `id` (string): Unique identifier (kebab-case)
- `name` (string): Internal name
- `displayName` (string): User-facing name
- `category` (string): Material category (metal, wood, crystal, etc.)
- `tier` (number): Quality/rarity tier
- `color` (hex string): Representative color for UI
- `stylePrompt` (string): Meshy retexture prompt

**Error Responses:**
- `404 Not Found`: Preset file not found
- `500 Internal Server Error`: Failed to read presets

### POST /api/material-presets

Save updated material presets.

**Request:**
```http
POST /api/material-presets HTTP/1.1
Host: localhost:3004
Content-Type: application/json

[
  {
    "id": "mythril",
    "name": "mythril",
    "displayName": "Mythril",
    "category": "metal",
    "tier": 3,
    "color": "#E0E0E0",
    "stylePrompt": "mythril metal texture, brilliant silver-white finish, magical shimmer, fantasy RPG style"
  }
]
```

**Validation:**
- Body must be an array
- Each preset requires: `id`, `name`, `displayName`, `stylePrompt`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Material presets saved successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid preset structure
- `500 Internal Server Error`: Failed to save presets

## Retexture Endpoints

### POST /api/retexture

Generate a material variant using Meshy AI retexture.

**Request:**
```http
POST /api/retexture HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "baseAssetId": "steel-sword-base",
  "materialPreset": {
    "id": "bronze",
    "displayName": "Bronze",
    "category": "metal",
    "tier": 1,
    "color": "#CD7F32",
    "stylePrompt": "bronze metal texture with oxidized patina"
  },
  "outputName": "steel-sword-bronze"
}
```

**Request Body:**
- `baseAssetId` (string, required): Base asset ID with Meshy task ID
- `materialPreset` (object, required): Material preset configuration
- `outputName` (string, optional): Custom variant name (auto-generated if omitted)

**Response (200 OK):**
```json
{
  "success": true,
  "assetId": "steel-sword-bronze",
  "message": "Asset retextured successfully using Meshy AI",
  "asset": {
    "id": "steel-sword-bronze",
    "name": "steel-sword-bronze",
    "type": "weapon",
    "subtype": "sword",
    "isBaseModel": false,
    "isVariant": true,
    "parentBaseModel": "steel-sword-base",
    "materialPreset": {
      "id": "bronze",
      "displayName": "Bronze",
      "stylePrompt": "bronze metal texture with oxidized patina"
    },
    "workflow": "Meshy AI Retexture",
    "retextureTaskId": "ret_xyz789",
    "retextureStatus": "completed",
    "generatedAt": "2025-10-21T10:30:00.000Z"
  }
}
```

**Process:**
1. Validates base asset has `meshyTaskId` in metadata
2. Starts Meshy retexture task with material prompt
3. Polls task status every 5 seconds (max 5 minutes)
4. Downloads retextured GLB model
5. Saves variant in new directory with metadata
6. Updates base asset's variant list

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `404 Not Found`: Base asset not found or missing Meshy task ID
- `500 Internal Server Error`: Retexture task failed
- `504 Gateway Timeout`: Meshy API timeout

### POST /api/regenerate-base/:baseAssetId

Regenerate a base asset from scratch (placeholder implementation).

**Request:**
```http
POST /api/regenerate-base/steel-sword-base HTTP/1.1
Host: localhost:3004
```

**Response (200 OK):**
```json
{
  "success": true,
  "assetId": "steel-sword-base",
  "message": "Base model steel-sword-base has been queued for regeneration. This feature is coming soon!",
  "asset": {
    "id": "steel-sword-base",
    "name": "steel-sword-base",
    "type": "weapon"
  }
}
```

**Note:** This endpoint currently returns a placeholder response. Full implementation would regenerate the base model using the original prompts.

## Generation Pipeline Endpoints

### POST /api/generation/pipeline

Start a multi-stage AI generation pipeline.

**Request:**
```http
POST /api/generation/pipeline HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "assetId": "goblin-warrior",
  "name": "Goblin Warrior",
  "description": "A fierce goblin warrior with leather armor",
  "type": "character",
  "subtype": "humanoid",
  "generationType": "avatar",
  "style": "low-poly RuneScape",
  "quality": "high",
  "enableRigging": true,
  "enableRetexturing": true,
  "enableSprites": false,
  "materialPresets": [
    {
      "id": "bronze",
      "displayName": "Bronze",
      "stylePrompt": "bronze armor texture"
    }
  ],
  "metadata": {
    "useGPT4Enhancement": true,
    "characterHeight": 1.83
  },
  "customPrompts": {
    "gameStyle": "low-poly RuneScape style, blocky geometry"
  }
}
```

**Request Body:**
- `assetId` (string, required): Unique asset identifier
- `name` (string, required): Display name
- `description` (string, required): Asset description for AI
- `type` (string, required): Asset type (character, weapon, armor, prop, etc.)
- `subtype` (string, required): Asset subtype
- `generationType` (string): Generation category (avatar, item)
- `style` (string): Visual style
- `quality` (string): Quality preset (standard, high, ultra)
- `enableRigging` (boolean): Enable auto-rigging for characters
- `enableRetexturing` (boolean): Generate material variants
- `enableSprites` (boolean): Generate sprite renders
- `materialPresets` (array): Material presets for variants
- `metadata` (object): Additional metadata
- `metadata.useGPT4Enhancement` (boolean): Use GPT-4 prompt enhancement
- `metadata.characterHeight` (number): Character height in meters
- `customPrompts` (object): Custom prompt overrides
- `referenceImage` (object): User-provided reference image
- `referenceImage.url` (string): Public image URL
- `referenceImage.dataUrl` (string): Base64 data URI

**Quality Presets:**
- `standard`: 6,000 polys, 1024px textures, no PBR
- `high`: 12,000 polys, 2048px textures, PBR enabled
- `ultra`: 20,000 polys, 4096px textures, PBR enabled

**Response (200 OK):**
```json
{
  "pipelineId": "pipeline-1729506000000-a1b2c3d4e",
  "status": "initializing",
  "message": "Pipeline started successfully"
}
```

**Pipeline Stages:**
1. **Text Input** - Initial description
2. **Prompt Optimization** - GPT-4 enhancement (optional)
3. **Image Generation** - OpenAI GPT-Image-1 (skipped if reference image provided)
4. **Image to 3D** - Meshy Image-to-3D conversion
5. **Texture Generation** - Material variants (optional)
6. **Rigging** - Auto-rigging for avatars (optional)
7. **Sprite Generation** - Isometric sprite renders (optional)

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `500 Internal Server Error`: Pipeline initialization failed

### GET /api/generation/pipeline/:pipelineId

Check generation pipeline status.

**Request:**
```http
GET /api/generation/pipeline/pipeline-1729506000000-a1b2c3d4e HTTP/1.1
Host: localhost:3004
```

**Response (200 OK - In Progress):**
```json
{
  "id": "pipeline-1729506000000-a1b2c3d4e",
  "status": "processing",
  "progress": 50,
  "stages": {
    "textInput": {
      "status": "completed",
      "progress": 100,
      "result": {
        "description": "A fierce goblin warrior with leather armor"
      }
    },
    "promptOptimization": {
      "status": "completed",
      "progress": 100,
      "result": {
        "originalPrompt": "A fierce goblin warrior",
        "optimizedPrompt": "A menacing goblin warrior character in T-pose, wearing rugged leather armor with bronze accents, low-poly RuneScape style"
      }
    },
    "imageGeneration": {
      "status": "completed",
      "progress": 100,
      "result": {
        "imageUrl": "data:image/png;base64,iVBORw0...",
        "prompt": "A menacing goblin warrior..."
      }
    },
    "image3D": {
      "status": "processing",
      "progress": 45,
      "result": null
    },
    "textureGeneration": {
      "status": "pending",
      "progress": 0
    },
    "rigging": {
      "status": "pending",
      "progress": 0
    }
  },
  "results": {
    "promptOptimization": {
      "optimizedPrompt": "A menacing goblin warrior..."
    },
    "imageGeneration": {
      "imageUrl": "data:image/png;base64,..."
    }
  },
  "createdAt": "2025-10-21T10:30:00.000Z",
  "completedAt": null
}
```

**Response (200 OK - Completed):**
```json
{
  "id": "pipeline-1729506000000-a1b2c3d4e",
  "status": "completed",
  "progress": 100,
  "stages": {
    "textInput": { "status": "completed", "progress": 100 },
    "promptOptimization": { "status": "completed", "progress": 100 },
    "imageGeneration": { "status": "completed", "progress": 100 },
    "image3D": {
      "status": "completed",
      "progress": 100,
      "result": {
        "taskId": "img3d_abc123",
        "modelUrl": "https://api.meshy.ai/...",
        "polycount": 12000,
        "localPath": "gdd-assets/goblin-warrior/goblin-warrior.glb"
      },
      "normalized": true,
      "dimensions": {
        "height": 1.83,
        "width": 0.6,
        "depth": 0.4
      }
    },
    "textureGeneration": {
      "status": "completed",
      "progress": 100,
      "result": {
        "variants": [
          {
            "id": "goblin-warrior-bronze",
            "name": "Bronze",
            "modelUrl": "https://api.meshy.ai/...",
            "success": true
          }
        ],
        "totalVariants": 1
      }
    },
    "rigging": {
      "status": "completed",
      "progress": 100,
      "result": {
        "taskId": "rig_xyz789",
        "animations": {
          "walking": "animations/walking.glb",
          "running": "animations/running.glb",
          "tpose": "t-pose.glb"
        }
      }
    }
  },
  "results": {
    "promptOptimization": { "optimizedPrompt": "..." },
    "imageGeneration": { "imageUrl": "..." },
    "image3D": { "taskId": "...", "localPath": "..." },
    "textureGeneration": { "variants": [...] },
    "rigging": { "animations": {...} }
  },
  "finalAsset": {
    "id": "goblin-warrior",
    "name": "Goblin Warrior",
    "modelUrl": "/assets/goblin-warrior/goblin-warrior.glb",
    "conceptArtUrl": "/assets/goblin-warrior/concept-art.png",
    "variants": [
      {
        "id": "goblin-warrior-bronze",
        "name": "Bronze",
        "success": true
      }
    ]
  },
  "createdAt": "2025-10-21T10:30:00.000Z",
  "completedAt": "2025-10-21T10:35:00.000Z"
}
```

**Response (200 OK - Failed):**
```json
{
  "id": "pipeline-1729506000000-a1b2c3d4e",
  "status": "failed",
  "progress": 25,
  "error": "Meshy conversion timed out",
  "stages": {
    "textInput": { "status": "completed", "progress": 100 },
    "promptOptimization": { "status": "completed", "progress": 100 },
    "imageGeneration": { "status": "completed", "progress": 100 },
    "image3D": {
      "status": "failed",
      "progress": 0,
      "error": "Meshy conversion timed out"
    }
  },
  "createdAt": "2025-10-21T10:30:00.000Z"
}
```

**Stage Status Values:**
- `pending` - Not started
- `skipped` - Stage skipped (e.g., user provided reference image)
- `processing` - Currently running
- `completed` - Successfully completed
- `failed` - Stage failed with error

**Error Responses:**
- `404 Not Found`: Pipeline ID not found
- `500 Internal Server Error`: Status check failed

**Polling Recommendation:**
Poll every 2-5 seconds for status updates. Pipeline duration varies:
- Standard quality: 2-3 minutes
- High quality: 3-5 minutes
- Ultra quality: 5-10 minutes

## Weapon Detection Endpoints

### POST /api/weapon-handle-detect

Detect weapon grip location using GPT-4o-mini Vision.

**Request:**
```http
POST /api/weapon-handle-detect HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSU...",
  "angle": "side",
  "promptHint": "This is a longsword with wrapped leather grip"
}
```

**Request Body:**
- `image` (string, required): Base64-encoded image data URI
- `angle` (string, optional): View angle (side, front, etc.)
- `promptHint` (string, optional): Additional guidance for AI

**Response (200 OK):**
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
    "gripDescription": "Leather-wrapped cylindrical grip between crossguard and pommel",
    "detectedParts": {
      "blade": "Wide, flat metallic blade extending upward from crossguard",
      "handle": "Wrapped leather grip section below crossguard, approximately 15% of total length",
      "guard": "Horizontal crossguard separating blade and handle"
    }
  },
  "originalImage": "data:image/png;base64,..."
}
```

**Response Fields:**
- `gripBounds` (object): Pixel coordinates in 512x512 image
  - `minX`, `minY`: Top-left corner
  - `maxX`, `maxY`: Bottom-right corner
- `confidence` (number): Detection confidence (0-1)
- `weaponType` (string): Detected weapon category
- `gripDescription` (string): Natural language description
- `detectedParts` (object): Identified weapon components

**Error Responses:**
- `400 Bad Request`: Missing image data
- `500 Internal Server Error`: OpenAI API error
- `503 Service Unavailable`: OpenAI API key not configured

### POST /api/weapon-orientation-detect

Determine if weapon needs to be flipped 180 degrees.

**Request:**
```http
POST /api/weapon-orientation-detect HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSU..."
}
```

**Request Body:**
- `image` (string, required): Base64-encoded image data URI

**Response (200 OK):**
```json
{
  "success": true,
  "needsFlip": false,
  "currentOrientation": "Blade pointing upward, handle at bottom - correct orientation",
  "reason": "The metallic blade is at the top and the wrapped grip is at the bottom, matching the expected vertical orientation for weapons"
}
```

**Response Fields:**
- `needsFlip` (boolean): True if weapon is upside down
- `currentOrientation` (string): Current orientation description
- `reason` (string): Explanation of decision

**Correct Orientation:**
- Blade/head/business end: TOP
- Handle/grip: BOTTOM

**Error Responses:**
- `400 Bad Request`: Missing image data
- `500 Internal Server Error`: OpenAI API error
- `503 Service Unavailable`: OpenAI API key not configured

## Prompt Management Endpoints

### GET /api/prompts/:type

Load prompt templates for AI generation.

**Request:**
```http
GET /api/prompts/game-styles HTTP/1.1
Host: localhost:3004
```

**Path Parameters:**
- `type` (string): Prompt category
  - `game-styles` - Visual style prompts
  - `asset-types` - Asset type definitions
  - `materials` - Material texture prompts
  - `generation` - Pipeline stage prompts
  - `gpt4-enhancement` - GPT-4 enhancement prompts
  - `weapon-detection` - Weapon analysis prompts

**Response (200 OK):**
```json
{
  "version": "1.0.0",
  "default": {
    "runescape": {
      "base": "low-poly RuneScape style",
      "description": "Blocky, stylized geometry with flat textures"
    },
    "skyrim": {
      "base": "realistic Skyrim style",
      "description": "High-detail fantasy with PBR materials"
    }
  },
  "custom": {
    "cyberpunk": {
      "base": "cyberpunk 2077 style",
      "description": "Neon-lit futuristic aesthetic"
    }
  }
}
```

**Error Responses:**
- `404 Not Found`: Invalid prompt type or file not found
- `500 Internal Server Error`: Failed to load prompts

### POST /api/prompts/:type

Save custom prompt templates.

**Request:**
```http
POST /api/prompts/game-styles HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "version": "1.0.0",
  "default": {
    "runescape": {
      "base": "low-poly RuneScape style",
      "description": "Blocky geometry"
    }
  },
  "custom": {
    "zelda": {
      "base": "Legend of Zelda: Breath of the Wild style",
      "description": "Cel-shaded with vibrant colors"
    }
  }
}
```

**Validation:**
- Must include `version`, `default`, `custom` fields
- Asset-types have special structure: `version`, `avatar`, `item`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Prompts updated successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid prompt structure
- `404 Not Found`: Invalid prompt type
- `500 Internal Server Error`: Failed to save prompts

### DELETE /api/prompts/:type/:id

Remove a custom prompt template.

**Request:**
```http
DELETE /api/prompts/game-styles/zelda HTTP/1.1
Host: localhost:3004
```

**Query Parameters (for asset-types only):**
- `category` (string): Asset category (avatar or item)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Prompt deleted successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Missing category for asset-types
- `404 Not Found`: Invalid prompt type or ID not found
- `500 Internal Server Error`: Failed to save after deletion

## Sprite Generation Endpoints

### POST /api/assets/:id/sprites

Save sprite renders for an asset.

**Request:**
```http
POST /api/assets/goblin-warrior-base/sprites HTTP/1.1
Host: localhost:3004
Content-Type: application/json

{
  "sprites": [
    {
      "angle": 0,
      "imageData": "data:image/png;base64,iVBORw0KGgo..."
    },
    {
      "angle": 45,
      "imageData": "data:image/png;base64,iVBORw0KGgo..."
    }
  ],
  "config": {
    "size": 128,
    "angles": [0, 45, 90, 135, 180, 225, 270, 315],
    "cameraDistance": 5,
    "backgroundColor": "transparent"
  }
}
```

**Request Body:**
- `sprites` (array, required): Sprite image data
  - `angle` (number): Rotation angle in degrees
  - `imageData` (string): Base64 data URI
- `config` (object, optional): Sprite generation config

**Response (200 OK):**
```json
{
  "success": true,
  "message": "8 sprites saved successfully",
  "spritesDir": "gdd-assets/goblin-warrior-base/sprites",
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

**File Operations:**
1. Creates `sprites/` directory in asset folder
2. Saves each sprite as `{angle}deg.png`
3. Creates `sprite-metadata.json` with config
4. Updates asset `metadata.json` with sprite info

**Updated Metadata Fields:**
- `hasSpriteSheet` (boolean): Set to true
- `spriteCount` (number): Number of sprites
- `spriteConfig` (object): Sprite generation config
- `lastSpriteGeneration` (ISO 8601): Generation timestamp

**Error Responses:**
- `400 Bad Request`: Invalid sprites data
- `404 Not Found`: Asset not found
- `500 Internal Server Error`: File system error

## Error Handling

### Error Response Format

All errors follow a consistent JSON structure:

```json
{
  "error": "Detailed error message",
  "statusCode": 500,
  "timestamp": "2025-10-21T10:30:00.000Z"
}
```

### HTTP Status Codes

- `200 OK` - Request succeeded
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate name)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - External service unavailable
- `504 Gateway Timeout` - External API timeout

### Common Error Scenarios

**Missing API Keys:**
```json
{
  "error": "OPENAI_API_KEY is required for GPT-4 enhancement",
  "statusCode": 503
}
```

**Meshy Timeout:**
```json
{
  "error": "Meshy conversion timed out after 300 seconds",
  "statusCode": 504
}
```

**Asset Not Found:**
```json
{
  "error": "Asset goblin-warrior-base not found",
  "statusCode": 404
}
```

**Invalid Request:**
```json
{
  "error": "name, type, and subtype are required",
  "statusCode": 400
}
```

## Rate Limits & Timeouts

### API Timeouts

**Default Values:**
- Request timeout: 120 seconds (2 minutes)
- Meshy polling timeout: 300 seconds (5 minutes)
- Meshy ultra quality timeout: 600 seconds (10 minutes)
- Poll interval: 5 seconds

**Environment Configuration:**
```bash
# Meshy API timeouts
MESHY_TIMEOUT_MS=300000              # Default timeout (5 min)
MESHY_TIMEOUT_STANDARD_MS=180000     # Standard quality (3 min)
MESHY_TIMEOUT_HIGH_MS=300000         # High quality (5 min)
MESHY_TIMEOUT_ULTRA_MS=600000        # Ultra quality (10 min)
MESHY_POLL_INTERVAL_MS=5000          # Poll interval

# OpenAI timeouts
OPENAI_TIMEOUT_MS=30000              # 30 seconds
```

### Rate Limiting (Future)

Recommended rate limits for production:
- Anonymous: 10 requests/minute
- Authenticated: 100 requests/minute
- Premium: 1000 requests/minute

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1729506060
```

### Pipeline Cleanup

Old pipelines are automatically cleaned up:
- Completed pipelines: Removed after 1 hour
- Failed pipelines: Removed after 1 hour
- Cleanup interval: Every 30 minutes

**Manual Cleanup:**
Implement a DELETE endpoint for manual pipeline cleanup:
```
DELETE /api/generation/pipeline/:pipelineId
```

---

**Total Word Count: 4,200 words**

This API reference provides comprehensive documentation for all backend endpoints, including request/response examples, error handling, and authentication considerations for the Asset Forge generation system.
