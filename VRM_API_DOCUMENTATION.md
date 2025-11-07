# VRM Avatar Generation System - API Documentation

**Version:** 1.0.0
**Last Updated:** 2025-11-07
**Status:** Production-Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
   - [Generate VRM from Text](#31-generate-vrm-from-text)
   - [Upload VRM File](#32-upload-vrm-file)
   - [Get VRM Asset](#33-get-vrm-asset)
   - [Convert GLB to VRM](#34-convert-glb-to-vrm)
   - [List User VRMs](#35-list-user-vrms)
   - [Delete VRM](#36-delete-vrm)
   - [Update VRM Metadata](#37-update-vrm-metadata)
4. [SDK Examples](#4-sdk-examples)
5. [Webhooks](#5-webhooks)
6. [Response Schemas](#6-response-schemas)
7. [Rate Limits](#7-rate-limits)
8. [Best Practices](#8-best-practices)
9. [Pricing](#9-pricing)
10. [Support](#10-support)

---

## 1. Overview

The VRM Avatar Generation System provides REST APIs for creating, converting, and managing VRM 1.0 avatars. VRM (Virtual Reality Model) is an industry-standard file format for 3D humanoid avatars compatible with VRChat, VRoid Studio, VSeeFace, and the broader virtual avatar ecosystem.

### What the VRM API Does

- **AI-Powered Generation**: Create VRM avatars from text descriptions using Meshy.ai
- **GLB to VRM Conversion**: Convert standard GLB 3D models to VRM 1.0 format
- **Animation Retargeting**: Apply Mixamo animations to VRM avatars
- **Height Normalization**: Automatic scaling to VRM standard 1.6m height
- **Bone Mapping**: Convert Meshy/Mixamo bone names to VRM HumanoidBone standard
- **T-Pose Validation**: Ensure proper bind pose for animation compatibility

### Base URL and Environment

```
Development: http://localhost:3004
Production:  https://api.hyperscape.ai
```

### Supported VRM Versions

- **VRM 1.0** (primary, recommended)
- **VRM 0.0** (legacy support, read-only)

### API Documentation

Interactive API documentation is available via Swagger UI:

```
Development: http://localhost:3004/swagger
Production:  https://api.hyperscape.ai/swagger
```

---

## 2. Authentication

### API Key Setup

Authentication is **optional** for most endpoints. Authenticated users get:
- Ownership tracking for their VRMs
- Private/public visibility control
- Ability to modify/delete their own assets
- Higher rate limits

### Authentication Methods

#### Option 1: Privy JWT Token (Recommended)

```bash
Authorization: Bearer <PRIVY_ACCESS_TOKEN>
```

**Example:**
```bash
curl -X POST https://api.hyperscape.ai/api/generation/pipeline \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"description": "medieval knight", "assetId": "knight-001", ...}'
```

#### Option 2: No Authentication (Public Mode)

Public mode works for:
- Listing public assets
- Generating new assets
- Viewing/downloading assets

**Example:**
```bash
curl https://api.hyperscape.ai/api/assets
```

### Getting a Privy Token

```javascript
import { usePrivy } from '@privy-io/react-auth'

function MyComponent() {
  const { getAccessToken } = usePrivy()

  const makeAuthenticatedRequest = async () => {
    const token = await getAccessToken()

    const response = await fetch('https://api.hyperscape.ai/api/generation/pipeline', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: 'medieval knight',
        assetId: 'knight-001',
        name: 'Sir Galahad',
        type: 'character',
        subtype: 'humanoid'
      })
    })

    return response.json()
  }
}
```

### Authentication Headers

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer <PRIVY_TOKEN>` | Optional |
| `Content-Type` | `application/json` | Required for POST/PATCH |

---

## 3. Endpoints

### 3.1 Generate VRM from Text

**Generate a VRM avatar from a text description using AI.**

```http
POST /api/generation/pipeline
```

#### Request Body

```json
{
  "description": "medieval knight with silver armor and red cape",
  "assetId": "knight-001",
  "name": "Sir Galahad",
  "type": "character",
  "subtype": "humanoid",
  "generationType": "text-to-3d",
  "tier": 3,
  "quality": "high",
  "style": "realistic",
  "enableRigging": true,
  "enableRetexturing": false,
  "enableSprites": false,
  "customPrompts": {
    "gameStyle": "fantasy RPG"
  },
  "metadata": {
    "characterHeight": 1.6,
    "useGPT4Enhancement": true
  }
}
```

#### Request Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | ✅ | Text description of the avatar (min 1 char) |
| `assetId` | `string` | ✅ | Unique identifier for the asset |
| `name` | `string` | ✅ | Display name for the avatar |
| `type` | `string` | ✅ | Asset type (e.g., "character") |
| `subtype` | `string` | ✅ | Asset subtype (e.g., "humanoid") |
| `generationType` | `string` | ❌ | Generation method (default: "text-to-3d") |
| `tier` | `number` | ❌ | Quality tier 1-5 (default: 3) |
| `quality` | `string` | ❌ | Quality level: "low", "medium", "high" (default: "high") |
| `style` | `string` | ❌ | Art style: "realistic", "stylized", "anime" (default: "realistic") |
| `enableRigging` | `boolean` | ❌ | Enable VRM rigging (default: true) |
| `enableRetexturing` | `boolean` | ❌ | Generate material variants (default: false) |
| `enableSprites` | `boolean` | ❌ | Generate 2D sprites (default: false) |
| `customPrompts.gameStyle` | `string` | ❌ | Game art style hint |
| `metadata.characterHeight` | `number` | ❌ | Target height in meters (default: 1.6) |
| `metadata.useGPT4Enhancement` | `boolean` | ❌ | Enhance prompt with GPT-4 (default: true) |

#### Response (202 Accepted)

```json
{
  "pipelineId": "pipe_abc123xyz",
  "status": "processing",
  "message": "Generation pipeline started successfully"
}
```

#### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| `pipelineId` | `string` | Unique pipeline identifier for status tracking |
| `status` | `string` | Current status: "processing", "completed", "failed" |
| `message` | `string` | Human-readable status message |

#### Example: Generate Medieval Knight

```bash
curl -X POST https://api.hyperscape.ai/api/generation/pipeline \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "description": "medieval knight with ornate silver armor and flowing red cape",
    "assetId": "knight-001",
    "name": "Sir Galahad",
    "type": "character",
    "subtype": "humanoid",
    "tier": 4,
    "style": "realistic",
    "enableRigging": true,
    "metadata": {
      "characterHeight": 1.75,
      "useGPT4Enhancement": true
    }
  }'
```

#### Example: TypeScript/JavaScript

```typescript
import { api } from '@hyperscape/vrm-sdk'

const result = await api.api.generation.pipeline.post({
  description: 'cyberpunk hacker with neon implants',
  assetId: 'hacker-001',
  name: 'Neo Cipher',
  type: 'character',
  subtype: 'humanoid',
  tier: 5,
  style: 'stylized',
  enableRigging: true,
  metadata: {
    characterHeight: 1.7,
    useGPT4Enhancement: true
  }
})

console.log('Pipeline started:', result.data.pipelineId)
```

---

### 3.2 Upload VRM File

**Upload an existing VRM file (e.g., from VRoid Studio) to the system.**

```http
POST /api/assets/upload-vrm
```

#### Request (Multipart Form Data)

```http
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="my-avatar.vrm"
Content-Type: application/octet-stream

<VRM binary data>
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="assetId"

custom-avatar-001
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `File` | ✅ | VRM file (binary, max 50MB) |
| `assetId` | `string` | ✅ | Unique identifier for the asset |

#### File Constraints

- **Max File Size:** 50 MB
- **Supported Formats:** `.vrm` (VRM 1.0 or VRM 0.0)
- **File Type:** `application/octet-stream` or `model/gltf-binary`

#### Response (200 OK)

```json
{
  "success": true,
  "url": "/gdd-assets/custom-avatar-001/my-avatar.vrm",
  "message": "VRM uploaded successfully to /gdd-assets/custom-avatar-001/my-avatar.vrm"
}
```

#### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Upload success status |
| `url` | `string` | Public URL to access the uploaded VRM |
| `message` | `string` | Status message |

#### Example: curl

```bash
curl -X POST https://api.hyperscape.ai/api/assets/upload-vrm \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@/path/to/avatar.vrm" \
  -F "assetId=custom-avatar-001"
```

#### Example: JavaScript (Browser)

```javascript
const fileInput = document.getElementById('vrm-upload')
const file = fileInput.files[0]

const formData = new FormData()
formData.append('file', file)
formData.append('assetId', 'custom-avatar-001')

const response = await fetch('https://api.hyperscape.ai/api/assets/upload-vrm', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})

const result = await response.json()
console.log('VRM uploaded:', result.url)
```

#### Example: Python

```python
import requests

url = "https://api.hyperscape.ai/api/assets/upload-vrm"
headers = {
    "Authorization": f"Bearer {token}"
}

files = {
    'file': ('avatar.vrm', open('/path/to/avatar.vrm', 'rb'), 'application/octet-stream')
}
data = {
    'assetId': 'custom-avatar-001'
}

response = requests.post(url, headers=headers, files=files, data=data)
result = response.json()

print(f"VRM uploaded: {result['url']}")
```

---

### 3.3 Get VRM Asset

**Download or stream a VRM file by asset ID.**

```http
GET /api/assets/:id/model
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | Asset ID (e.g., "knight-001") |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | `string` | ❌ | File format: "vrm" or "glb" (default: "vrm") |

#### Response (200 OK)

**Binary VRM file stream**

```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="knight-001.vrm"
Content-Length: 4523698
```

#### Response Headers

| Header | Value | Description |
|--------|-------|-------------|
| `Content-Type` | `application/octet-stream` | Binary file type |
| `Content-Disposition` | `attachment; filename="*.vrm"` | Suggested filename |
| `Content-Length` | `<bytes>` | File size in bytes |

#### Example: Download VRM

```bash
# Download VRM file
curl https://api.hyperscape.ai/api/assets/knight-001/model \
  -o knight-001.vrm

# Download as GLB
curl "https://api.hyperscape.ai/api/assets/knight-001/model?format=glb" \
  -o knight-001.glb
```

#### Example: JavaScript Download

```javascript
// Download VRM file
const downloadVRM = async (assetId) => {
  const response = await fetch(`https://api.hyperscape.ai/api/assets/${assetId}/model`)
  const blob = await response.blob()

  // Create download link
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${assetId}.vrm`
  a.click()

  URL.revokeObjectURL(url)
}

await downloadVRM('knight-001')
```

#### Example: Load VRM in Three.js

```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'

const loader = new GLTFLoader()
loader.register((parser) => new VRMLoaderPlugin(parser))

const vrmUrl = 'https://api.hyperscape.ai/api/assets/knight-001/model'
const gltf = await loader.loadAsync(vrmUrl)
const vrm = gltf.userData.vrm

// Add to scene
scene.add(vrm.scene)

// Update VRM (required for animations)
function animate() {
  const delta = clock.getDelta()
  vrm.update(delta)
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
animate()
```

---

### 3.4 Convert GLB to VRM

**Convert a standard GLB 3D model to VRM 1.0 format.**

> **Note:** This endpoint is handled by the generation pipeline. Use the pipeline endpoint with `enableRigging: true` to convert Meshy GLB outputs to VRM.

#### Alternative: Manual Conversion

For manual GLB to VRM conversion, use the VRMConverter service directly:

```typescript
import { convertGLBToVRM } from '@/services/retargeting/VRMConverter'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

// Load GLB file
const loader = new GLTFLoader()
const gltf = await loader.loadAsync('/path/to/model.glb')

// Convert to VRM
const result = await convertGLBToVRM(gltf.scene, {
  avatarName: 'Converted Avatar',
  author: 'Your Name',
  version: '1.0',
  commercialUsage: 'personalNonProfit',
  licenseUrl: 'https://vrm.dev/licenses/1.0/'
})

// Save VRM file
const blob = new Blob([result.vrmData], { type: 'application/octet-stream' })
const url = URL.createObjectURL(blob)

const a = document.createElement('a')
a.href = url
a.download = 'converted-avatar.vrm'
a.click()
```

#### Conversion Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `avatarName` | `string` | ✅ | VRM avatar name |
| `author` | `string` | ✅ | Creator name |
| `version` | `string` | ❌ | VRM spec version (default: "1.0") |
| `commercialUsage` | `string` | ❌ | License type: "personalNonProfit", "personalProfit", "corporation" |
| `licenseUrl` | `string` | ❌ | License URL (default: VRM 1.0 license) |

---

### 3.5 List User VRMs

**Get a list of all VRM assets, optionally filtered by type or user.**

```http
GET /api/assets
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | `string` | ❌ | Filter by asset type (e.g., "character") |
| `page` | `number` | ❌ | Page number for pagination (default: 1) |
| `limit` | `number` | ❌ | Results per page (default: 50, max: 100) |
| `filter` | `string` | ❌ | Search filter (matches name/description) |

#### Response (200 OK)

```json
[
  {
    "id": "knight-001",
    "name": "Sir Galahad",
    "type": "character",
    "tier": 4,
    "category": "humanoid",
    "modelUrl": "/gdd-assets/knight-001/knight-001.vrm",
    "thumbnailUrl": "/gdd-assets/knight-001/concept-art.png",
    "hasSpriteSheet": false,
    "spriteCount": 0,
    "createdBy": "did:privy:abc123",
    "walletAddress": "0x1234...5678",
    "isPublic": true,
    "createdAt": "2025-11-07T10:30:00Z",
    "updatedAt": "2025-11-07T10:35:00Z"
  },
  {
    "id": "hacker-001",
    "name": "Neo Cipher",
    "type": "character",
    "tier": 5,
    "category": "humanoid",
    "modelUrl": "/gdd-assets/hacker-001/hacker-001.vrm",
    "thumbnailUrl": "/gdd-assets/hacker-001/concept-art.png",
    "hasSpriteSheet": false,
    "spriteCount": 0,
    "createdBy": "did:privy:abc123",
    "isPublic": true,
    "createdAt": "2025-11-07T11:00:00Z",
    "updatedAt": "2025-11-07T11:05:00Z"
  }
]
```

#### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique asset identifier |
| `name` | `string` | Display name |
| `type` | `string` | Asset type (e.g., "character") |
| `tier` | `number` | Quality tier (1-5) |
| `category` | `string` | Asset category |
| `modelUrl` | `string` | VRM file URL |
| `thumbnailUrl` | `string` | Preview image URL |
| `hasSpriteSheet` | `boolean` | Whether 2D sprites exist |
| `spriteCount` | `number` | Number of sprite angles |
| `createdBy` | `string` | Privy DID of creator |
| `walletAddress` | `string` | Creator's wallet address |
| `isPublic` | `boolean` | Public visibility |
| `createdAt` | `string` | ISO 8601 timestamp |
| `updatedAt` | `string` | ISO 8601 timestamp |

#### Example: List All Assets

```bash
curl https://api.hyperscape.ai/api/assets
```

#### Example: Filter by Type

```bash
curl "https://api.hyperscape.ai/api/assets?type=character&limit=10"
```

#### Example: TypeScript

```typescript
import { api } from '@hyperscape/vrm-sdk'

// List all assets
const { data: assets } = await api.api.assets.get()

// Filter by type
const { data: characters } = await api.api.assets.get({
  query: {
    type: 'character',
    limit: 20
  }
})

console.log('Found', characters.length, 'characters')
```

---

### 3.6 Delete VRM

**Delete a VRM asset and optionally its material variants.**

```http
DELETE /api/assets/:id
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | Asset ID to delete |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeVariants` | `string` | ❌ | Delete material variants too ("true" or "false") |

#### Authentication

**Required:** Users can only delete their own assets. Admins can delete any asset.

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Asset knight-001 deleted successfully"
}
```

#### Error Response (403 Forbidden)

```json
{
  "error": "Permission denied. You can only delete your own assets. Admins can delete any asset."
}
```

#### Error Response (404 Not Found)

```json
{
  "error": "Asset not found"
}
```

#### Example: Delete Asset

```bash
curl -X DELETE https://api.hyperscape.ai/api/assets/knight-001 \
  -H "Authorization: Bearer <TOKEN>"
```

#### Example: Delete with Variants

```bash
curl -X DELETE "https://api.hyperscape.ai/api/assets/knight-001?includeVariants=true" \
  -H "Authorization: Bearer <TOKEN>"
```

#### Example: TypeScript

```typescript
import { api } from '@hyperscape/vrm-sdk'

// Delete asset
const { data } = await api.api.assets({ id: 'knight-001' }).delete()

// Delete with variants
const { data: result } = await api.api.assets({ id: 'knight-001' }).delete({
  query: { includeVariants: 'true' }
})

console.log(result.message)
```

---

### 3.7 Update VRM Metadata

**Update metadata for a VRM asset (name, type, tier, category).**

```http
PATCH /api/assets/:id
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | Asset ID to update |

#### Request Body

```json
{
  "name": "Sir Galahad the Brave",
  "type": "character",
  "tier": 5,
  "category": "knight"
}
```

#### Request Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ❌ | New display name |
| `type` | `string` | ❌ | New asset type |
| `tier` | `number` | ❌ | New quality tier (1-5) |
| `category` | `string` | ❌ | New category |

#### Authentication

**Required:** Users can only update their own assets. Admins can update any asset.

#### Response (200 OK)

```json
{
  "id": "knight-001",
  "name": "Sir Galahad the Brave",
  "type": "character",
  "tier": 5,
  "category": "knight",
  "modelUrl": "/gdd-assets/knight-001/knight-001.vrm",
  "thumbnailUrl": "/gdd-assets/knight-001/concept-art.png",
  "hasSpriteSheet": false,
  "createdBy": "did:privy:abc123",
  "isPublic": true,
  "createdAt": "2025-11-07T10:30:00Z",
  "updatedAt": "2025-11-07T12:00:00Z"
}
```

#### Error Response (403 Forbidden)

```json
{
  "error": "Permission denied. You can only update your own assets. Admins can update any asset."
}
```

#### Example: Update Asset

```bash
curl -X PATCH https://api.hyperscape.ai/api/assets/knight-001 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sir Galahad the Brave",
    "tier": 5
  }'
```

#### Example: TypeScript

```typescript
import { api } from '@hyperscape/vrm-sdk'

const { data: updated } = await api.api.assets({ id: 'knight-001' }).patch({
  name: 'Sir Galahad the Brave',
  tier: 5,
  category: 'legendary-knight'
})

console.log('Updated:', updated.name)
```

---

## 4. SDK Examples

### 4.1 TypeScript/JavaScript SDK

#### Installation

```bash
npm install @hyperscape/vrm-sdk
# or
bun add @hyperscape/vrm-sdk
```

#### Initialize SDK

```typescript
import { api } from '@hyperscape/vrm-sdk'

// SDK automatically uses environment variables:
// VITE_API_URL or defaults to http://localhost:3004
```

#### Generate VRM from Text

```typescript
// Start generation pipeline
const { data: pipeline, error } = await api.api.generation.pipeline.post({
  description: 'medieval knight with ornate silver armor',
  assetId: 'knight-001',
  name: 'Sir Galahad',
  type: 'character',
  subtype: 'humanoid',
  tier: 4,
  style: 'realistic',
  enableRigging: true,
  metadata: {
    characterHeight: 1.75,
    useGPT4Enhancement: true
  }
})

if (error) {
  console.error('Generation failed:', error)
  return
}

console.log('Pipeline started:', pipeline.pipelineId)

// Poll for completion
const checkStatus = async () => {
  const { data: status } = await api.api.generation.pipeline({
    pipelineId: pipeline.pipelineId
  }).get()

  console.log('Status:', status.status, 'Progress:', status.progress)

  if (status.status === 'completed') {
    console.log('VRM ready:', status.results.vrmUrl)
    return status.results
  } else if (status.status === 'failed') {
    throw new Error(status.error)
  } else {
    // Still processing, check again in 5 seconds
    setTimeout(checkStatus, 5000)
  }
}

await checkStatus()
```

#### Upload VRM File

```typescript
// From file input
const fileInput = document.getElementById('vrm-upload') as HTMLInputElement
const file = fileInput.files![0]

const formData = new FormData()
formData.append('file', file)
formData.append('assetId', 'custom-avatar-001')

const { data, error } = await api.api.assets['upload-vrm'].post(formData)

if (data) {
  console.log('VRM uploaded:', data.url)
}
```

#### Download VRM

```typescript
// Download VRM file
const downloadVRM = async (assetId: string) => {
  const response = await fetch(`https://api.hyperscape.ai/api/assets/${assetId}/model`)
  const blob = await response.blob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${assetId}.vrm`
  a.click()

  URL.revokeObjectURL(url)
}

await downloadVRM('knight-001')
```

#### List Assets

```typescript
// List all assets
const { data: assets } = await api.api.assets.get()

console.log('Total assets:', assets.length)

// Filter by type
const characters = assets.filter(a => a.type === 'character')
console.log('Characters:', characters.length)
```

#### Delete Asset

```typescript
const { data, error } = await api.api.assets({ id: 'knight-001' }).delete({
  query: { includeVariants: 'true' }
})

if (data?.success) {
  console.log('Asset deleted:', data.message)
}
```

#### Update Asset Metadata

```typescript
const { data: updated } = await api.api.assets({ id: 'knight-001' }).patch({
  name: 'Sir Galahad the Brave',
  tier: 5,
  category: 'legendary-knight'
})

console.log('Updated:', updated.name)
```

---

### 4.2 Python SDK

#### Installation

```bash
pip install hyperscape-vrm
```

#### Initialize Client

```python
from hyperscape_vrm import VRMClient

# Initialize with API key (optional)
client = VRMClient(
    api_key='your-privy-token',  # Optional
    base_url='https://api.hyperscape.ai'
)
```

#### Generate VRM from Text

```python
# Start generation pipeline
result = client.generate_vrm(
    description='medieval knight with ornate silver armor',
    asset_id='knight-001',
    name='Sir Galahad',
    type='character',
    subtype='humanoid',
    tier=4,
    style='realistic',
    enable_rigging=True,
    metadata={
        'characterHeight': 1.75,
        'useGPT4Enhancement': True
    }
)

print(f"Pipeline started: {result.pipeline_id}")

# Wait for completion
status = client.wait_for_completion(result.pipeline_id, timeout=300)

if status.status == 'completed':
    print(f"VRM ready: {status.results['vrmUrl']}")

    # Download VRM
    vrm_data = client.download_vrm('knight-001')
    with open('knight-001.vrm', 'wb') as f:
        f.write(vrm_data)
else:
    print(f"Generation failed: {status.error}")
```

#### Upload VRM File

```python
# Upload VRM from file
with open('avatar.vrm', 'rb') as f:
    result = client.upload_vrm(
        file=f,
        asset_id='custom-avatar-001'
    )

print(f"VRM uploaded: {result.url}")
```

#### List Assets

```python
# List all assets
assets = client.list_assets()
print(f"Total assets: {len(assets)}")

# Filter by type
characters = [a for a in assets if a.type == 'character']
print(f"Characters: {len(characters)}")
```

#### Delete Asset

```python
# Delete asset
result = client.delete_asset('knight-001', include_variants=True)
print(result.message)
```

---

### 4.3 curl Examples

#### Generate VRM

```bash
curl -X POST https://api.hyperscape.ai/api/generation/pipeline \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "medieval knight",
    "assetId": "knight-001",
    "name": "Sir Galahad",
    "type": "character",
    "subtype": "humanoid",
    "tier": 4,
    "style": "realistic",
    "enableRigging": true
  }'
```

#### Upload VRM

```bash
curl -X POST https://api.hyperscape.ai/api/assets/upload-vrm \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@avatar.vrm" \
  -F "assetId=custom-avatar-001"
```

#### Download VRM

```bash
curl https://api.hyperscape.ai/api/assets/knight-001/model \
  -o knight-001.vrm
```

#### List Assets

```bash
curl https://api.hyperscape.ai/api/assets
```

#### Delete Asset

```bash
curl -X DELETE "https://api.hyperscape.ai/api/assets/knight-001?includeVariants=true" \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 5. Webhooks

Webhooks allow you to receive real-time notifications when VRM generation completes or fails.

### Webhook Events

| Event | Description |
|-------|-------------|
| `vrm.generation.completed` | VRM generation finished successfully |
| `vrm.generation.failed` | VRM generation failed |
| `vrm.conversion.completed` | GLB to VRM conversion completed |
| `vrm.upload.completed` | VRM file upload completed |

### Webhook Payload

```json
{
  "event": "vrm.generation.completed",
  "timestamp": "2025-11-07T12:00:00Z",
  "data": {
    "pipelineId": "pipe_abc123xyz",
    "assetId": "knight-001",
    "status": "completed",
    "vrmUrl": "/gdd-assets/knight-001/knight-001.vrm",
    "thumbnailUrl": "/gdd-assets/knight-001/concept-art.png",
    "metadata": {
      "height": 1.75,
      "boneCount": 24,
      "polyCount": 12500
    }
  },
  "signature": "sha256=abc123..."
}
```

### Setting Up Webhooks

```typescript
// Register webhook endpoint
const { data } = await api.api.webhooks.post({
  url: 'https://your-app.com/webhooks/vrm',
  events: ['vrm.generation.completed', 'vrm.generation.failed'],
  secret: 'your-webhook-secret'
})

console.log('Webhook registered:', data.webhookId)
```

### Verifying Webhook Signatures

```typescript
import crypto from 'crypto'

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const computedSignature = `sha256=${hmac.digest('hex')}`

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  )
}

// In your webhook handler
app.post('/webhooks/vrm', async (req, res) => {
  const signature = req.headers['x-webhook-signature']
  const payload = JSON.stringify(req.body)

  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const event = req.body

  if (event.event === 'vrm.generation.completed') {
    console.log('VRM ready:', event.data.vrmUrl)
    // Process completed VRM...
  }

  res.status(200).json({ received: true })
})
```

---

## 6. Response Schemas

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "error": "Detailed error message"
}
```

### Status Codes

| Code | Name | Description |
|------|------|-------------|
| `200` | OK | Request succeeded |
| `201` | Created | Resource created successfully |
| `202` | Accepted | Request accepted for processing |
| `204` | No Content | Successful DELETE operation |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Authentication required |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource conflict (duplicate ID) |
| `413` | Payload Too Large | File size exceeds 50MB limit |
| `422` | Unprocessable Entity | Validation error |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Service temporarily unavailable |

### Common Error Messages

#### 400 Bad Request

```json
{
  "error": "Validation error: 'description' is required"
}
```

#### 401 Unauthorized

```json
{
  "error": "Authentication required. Please provide a valid Privy token."
}
```

#### 403 Forbidden

```json
{
  "error": "Permission denied. You can only modify your own assets."
}
```

#### 404 Not Found

```json
{
  "error": "Asset not found: knight-001"
}
```

#### 413 Payload Too Large

```json
{
  "error": "File size exceeds 50MB limit. Please use a smaller file."
}
```

#### 429 Too Many Requests

```json
{
  "error": "Rate limit exceeded. Please try again in 60 seconds.",
  "retryAfter": 60
}
```

#### 500 Internal Server Error

```json
{
  "error": "Internal server error. Please contact support if this persists.",
  "requestId": "req_abc123xyz"
}
```

---

## 7. Rate Limits

### Rate Limit Tiers

| Tier | Requests/Hour | VRM Generations/Month | Max File Size |
|------|---------------|----------------------|---------------|
| **Free** | 100 | 10 | 10 MB |
| **Developer** | 1,000 | 100 | 25 MB |
| **Pro** | 10,000 | 500 | 50 MB |
| **Enterprise** | Unlimited | Unlimited | 100 MB |

### Rate Limit Headers

All API responses include rate limit information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1699368000
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Total requests allowed per hour |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

### Handling Rate Limits

```typescript
const makeRequest = async () => {
  const response = await fetch('https://api.hyperscape.ai/api/assets')

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    console.log(`Rate limited. Retry after ${retryAfter} seconds`)

    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000))
    return makeRequest()
  }

  return response.json()
}
```

### Best Practices for Rate Limits

1. **Cache responses** when possible
2. **Batch operations** to reduce API calls
3. **Implement exponential backoff** for retries
4. **Monitor rate limit headers** proactively
5. **Upgrade tier** if consistently hitting limits

---

## 8. Best Practices

### Polling vs Webhooks

**Use webhooks** for production applications:
- Lower latency (instant notifications)
- No polling overhead
- Scales better

**Use polling** for development/testing:
- Simpler to implement
- No webhook endpoint required

```typescript
// Polling example (5-second intervals)
const pollForCompletion = async (pipelineId: string) => {
  while (true) {
    const { data: status } = await api.api.generation.pipeline({ pipelineId }).get()

    if (status.status === 'completed') {
      return status.results
    } else if (status.status === 'failed') {
      throw new Error(status.error)
    }

    await new Promise(resolve => setTimeout(resolve, 5000))
  }
}
```

### Caching VRM Files

Cache VRM files to improve performance:

```typescript
// Browser cache
const vrmCache = new Map<string, Blob>()

const loadVRM = async (assetId: string) => {
  // Check cache first
  if (vrmCache.has(assetId)) {
    console.log('Loading from cache')
    return vrmCache.get(assetId)
  }

  // Download from API
  const response = await fetch(`https://api.hyperscape.ai/api/assets/${assetId}/model`)
  const blob = await response.blob()

  // Cache for future use
  vrmCache.set(assetId, blob)

  return blob
}
```

### Error Handling and Retries

Implement exponential backoff for transient errors:

```typescript
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      // Don't retry on 4xx errors (client errors)
      if (error.status >= 400 && error.status < 500) {
        throw error
      }

      // Last attempt, throw error
      if (i === maxRetries - 1) {
        throw error
      }

      // Exponential backoff: 1s, 2s, 4s, 8s...
      const delay = baseDelay * Math.pow(2, i)
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Max retries exceeded')
}

// Usage
const result = await retryWithBackoff(async () => {
  return api.api.generation.pipeline.post({ ... })
})
```

### Optimizing API Calls

**Batch operations** when possible:

```typescript
// ❌ Bad: Multiple individual requests
for (const assetId of assetIds) {
  await api.api.assets({ id: assetId }).get()
}

// ✅ Good: Single request for all assets
const { data: assets } = await api.api.assets.get()
const filteredAssets = assets.filter(a => assetIds.includes(a.id))
```

**Use pagination** for large datasets:

```typescript
const getAllAssets = async () => {
  const allAssets = []
  let page = 1

  while (true) {
    const { data: assets } = await api.api.assets.get({
      query: { page, limit: 100 }
    })

    if (assets.length === 0) break

    allAssets.push(...assets)
    page++
  }

  return allAssets
}
```

### Security Best Practices

1. **Store API keys securely** (environment variables, never in code)
2. **Use HTTPS only** (never HTTP in production)
3. **Validate file uploads** (check file type, size, content)
4. **Sanitize user inputs** (prevent injection attacks)
5. **Implement CORS** properly (restrict origins in production)
6. **Rotate API keys** regularly
7. **Monitor API usage** for anomalies

```typescript
// ✅ Good: Secure API key handling
const apiKey = process.env.HYPERSCAPE_API_KEY
if (!apiKey) {
  throw new Error('HYPERSCAPE_API_KEY not set')
}

// ❌ Bad: Hardcoded API key
const apiKey = 'sk-123456789' // NEVER do this!
```

---

## 9. Pricing

### Subscription Tiers

| Feature | Free | Developer | Pro | Enterprise |
|---------|------|-----------|-----|------------|
| **VRM Generations/Month** | 10 | 100 | 500 | Unlimited |
| **API Requests/Hour** | 100 | 1,000 | 10,000 | Unlimited |
| **Max File Size** | 10 MB | 25 MB | 50 MB | 100 MB |
| **Webhooks** | ❌ | ✅ | ✅ | ✅ |
| **Priority Processing** | ❌ | ❌ | ✅ | ✅ |
| **Dedicated Support** | ❌ | ❌ | ✅ | ✅ |
| **Custom Branding** | ❌ | ❌ | ❌ | ✅ |
| **On-Premise Deployment** | ❌ | ❌ | ❌ | ✅ |
| **SLA Guarantee** | ❌ | ❌ | 99.9% | 99.99% |
| **Price** | $0/month | $50/month | $200/month | Custom |

### Pay-As-You-Go Pricing

| Service | Price |
|---------|-------|
| VRM Generation (Text-to-3D) | $2.00 per avatar |
| VRM Conversion (GLB to VRM) | $0.50 per conversion |
| VRM Upload | Free |
| Animation Retargeting | $0.25 per animation |
| Additional Storage (per GB) | $0.10/month |

### Volume Discounts

- **100+ VRMs/month:** 10% discount
- **500+ VRMs/month:** 20% discount
- **1,000+ VRMs/month:** 30% discount
- **Enterprise:** Custom pricing

### Billing

```typescript
// Get current usage
const { data: usage } = await api.api.billing.usage.get()

console.log('VRMs generated:', usage.vrmsGenerated)
console.log('API requests:', usage.apiRequests)
console.log('Storage used:', usage.storageGB, 'GB')

// Get estimated bill
const { data: estimate } = await api.api.billing.estimate.get()

console.log('Estimated monthly cost:', estimate.totalCost)
```

---

## 10. Support

### API Status

Real-time API status and uptime:

- **Status Page:** https://status.hyperscape.ai
- **Twitter:** [@HyperscapeAPI](https://twitter.com/hyperscapeapi)

### Developer Resources

- **API Documentation:** https://docs.hyperscape.ai/vrm
- **Interactive Playground:** https://api.hyperscape.ai/swagger
- **GitHub Examples:** https://github.com/hyperscape/vrm-examples
- **Community Forum:** https://forum.hyperscape.ai

### Developer Support

- **Discord:** https://discord.gg/hyperscape
- **Email:** dev@hyperscape.ai
- **GitHub Issues:** https://github.com/hyperscape/vrm-sdk/issues

### SLA and Uptime

| Tier | SLA | Support Response Time |
|------|-----|----------------------|
| Free | Best effort | Community support only |
| Developer | 99% | 48 hours (email) |
| Pro | 99.9% | 24 hours (email + Discord) |
| Enterprise | 99.99% | 4 hours (phone + dedicated support) |

### Reporting Issues

When reporting issues, include:

1. **Request ID** (from `X-Request-ID` header)
2. **Timestamp** (when the error occurred)
3. **HTTP method and endpoint**
4. **Request payload** (sanitize sensitive data)
5. **Response status code and body**
6. **SDK version** (if using SDK)

**Example:**

```
Request ID: req_abc123xyz
Timestamp: 2025-11-07T12:00:00Z
Endpoint: POST /api/generation/pipeline
Status: 500
Error: Internal server error

Request payload:
{
  "description": "medieval knight",
  "assetId": "knight-001",
  ...
}

SDK: @hyperscape/vrm-sdk@1.0.0
```

---

## Appendix A: VRM Specification

### VRM 1.0 Compliance

The API generates VRM files compliant with the [VRM 1.0 specification](https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_vrm-1.0).

**Key Features:**
- ✅ `VRMC_vrm` extension (core VRM metadata)
- ✅ `humanoid.humanBones` (skeleton mapping)
- ✅ `meta` (avatar metadata)
- ✅ 24 core humanoid bones
- ✅ Y-up coordinate system
- ✅ T-pose bind pose
- ✅ Height normalized to 1.6m

### Supported Bones

| Bone Name | Required | Description |
|-----------|----------|-------------|
| `hips` | ✅ | Root bone (pelvis) |
| `spine` | ✅ | Lower spine |
| `chest` | ✅ | Upper spine |
| `neck` | ❌ | Neck |
| `head` | ✅ | Head |
| `leftShoulder` | ❌ | Left shoulder |
| `leftUpperArm` | ✅ | Left upper arm |
| `leftLowerArm` | ✅ | Left lower arm |
| `leftHand` | ✅ | Left hand |
| `rightShoulder` | ❌ | Right shoulder |
| `rightUpperArm` | ✅ | Right upper arm |
| `rightLowerArm` | ✅ | Right lower arm |
| `rightHand` | ✅ | Right hand |
| `leftUpperLeg` | ✅ | Left upper leg |
| `leftLowerLeg` | ✅ | Left lower leg |
| `leftFoot` | ✅ | Left foot |
| `rightUpperLeg` | ✅ | Right upper leg |
| `rightLowerLeg` | ✅ | Right lower leg |
| `rightFoot` | ✅ | Right foot |

### VRM Metadata

```json
{
  "extensions": {
    "VRMC_vrm": {
      "specVersion": "1.0",
      "meta": {
        "name": "Sir Galahad",
        "version": "1.0",
        "authors": ["Hyperscape AI"],
        "copyrightInformation": "Generated by Hyperscape Asset Forge",
        "contactInformation": "dev@hyperscape.ai",
        "references": ["https://hyperscape.ai"],
        "thirdPartyLicenses": "Meshy.ai (3D generation)",
        "licenseUrl": "https://vrm.dev/licenses/1.0/",
        "avatarPermission": "onlyAuthor",
        "allowExcessivelyViolentUsage": false,
        "allowExcessivelySexualUsage": false,
        "commercialUsage": "personalNonProfit",
        "allowPoliticalOrReligiousUsage": false,
        "allowAntisocialOrHateUsage": false,
        "creditNotation": "required",
        "allowRedistribution": false,
        "modification": "prohibited"
      },
      "humanoid": {
        "humanBones": {
          "hips": { "node": 5 },
          "spine": { "node": 6 },
          "chest": { "node": 7 },
          "neck": { "node": 8 },
          "head": { "node": 9 },
          "leftUpperArm": { "node": 10 },
          "leftLowerArm": { "node": 11 },
          "leftHand": { "node": 12 },
          "rightUpperArm": { "node": 13 },
          "rightLowerArm": { "node": 14 },
          "rightHand": { "node": 15 },
          "leftUpperLeg": { "node": 16 },
          "leftLowerLeg": { "node": 17 },
          "leftFoot": { "node": 18 },
          "rightUpperLeg": { "node": 19 },
          "rightLowerLeg": { "node": 20 },
          "rightFoot": { "node": 21 }
        }
      }
    }
  }
}
```

---

## Appendix B: Migration Guide

### Migrating from VRM 0.0 to VRM 1.0

VRM 1.0 introduces several breaking changes from VRM 0.0. The API automatically handles conversion when generating new VRMs, but existing VRM 0.0 files need manual migration.

**Key Changes:**
- Extension name: `VRM` → `VRMC_vrm`
- Coordinate system adjustments
- Metadata structure changes
- License field updates

**Migration Script:**

```typescript
import { upgradeVRM0to1 } from '@hyperscape/vrm-converter'

// Load VRM 0.0 file
const vrm0 = await loadVRM('avatar-v0.vrm')

// Upgrade to VRM 1.0
const vrm1 = await upgradeVRM0to1(vrm0, {
  updateMetadata: true,
  fixCoordinateSystem: true,
  updateLicense: true
})

// Save upgraded VRM
await saveVRM('avatar-v1.vrm', vrm1)
```

---

## Appendix C: Troubleshooting

### Common Issues

#### 1. VRM File Not Loading

**Symptoms:** VRM file downloads but fails to load in VRoid Studio/VRChat

**Solutions:**
- Ensure VRM is version 1.0 (check `VRMC_vrm` extension)
- Validate bone mapping (all required bones present)
- Check file integrity (not corrupted)
- Verify height normalization (should be ~1.6m)

```bash
# Validate VRM file
curl -X POST https://api.hyperscape.ai/api/vrm/validate \
  -F "file=@avatar.vrm"
```

#### 2. Animation Not Working

**Symptoms:** VRM loads but animations don't play correctly

**Solutions:**
- Verify T-pose bind pose (not A-pose)
- Check skeleton hierarchy (no missing bones)
- Ensure animation is retargeted for VRM (not raw Mixamo)

```typescript
// Check VRM skeleton
const vrm = await loadVRM('avatar.vrm')
const requiredBones = ['hips', 'spine', 'chest', 'head', 'leftUpperArm', ...]

for (const boneName of requiredBones) {
  const bone = vrm.humanoid.getRawBoneNode(boneName)
  if (!bone) {
    console.error(`Missing required bone: ${boneName}`)
  }
}
```

#### 3. Generation Pipeline Stuck

**Symptoms:** Pipeline status remains "processing" for >10 minutes

**Solutions:**
- Check pipeline status for error messages
- Contact support with `pipelineId`
- Try regenerating with simpler prompt

```typescript
// Check pipeline status
const { data: status } = await api.api.generation.pipeline({
  pipelineId: 'pipe_abc123'
}).get()

console.log('Status:', status.status)
console.log('Progress:', status.progress)
console.log('Error:', status.error)
```

#### 4. Rate Limit Exceeded

**Symptoms:** 429 error responses

**Solutions:**
- Implement exponential backoff (see Best Practices)
- Cache VRM files to reduce API calls
- Upgrade to higher tier plan
- Contact sales for enterprise pricing

---

**End of Documentation**

For the latest updates, visit: https://docs.hyperscape.ai/vrm
