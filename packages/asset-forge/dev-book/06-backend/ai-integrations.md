# AI Integrations

Asset Forge integrates with multiple AI services to power the end-to-end 3D asset generation pipeline. This document covers OpenAI GPT-4, GPT-Image-1, GPT-4o-mini Vision, and Meshy AI's Image-to-3D, Retexture, and Rigging APIs.

## Table of Contents

- [Overview](#overview)
- [OpenAI Integration](#openai-integration)
- [Meshy AI Integration](#meshy-ai-integration)
- [API Authentication](#api-authentication)
- [Polling Strategies](#polling-strategies)
- [Timeout Configuration](#timeout-configuration)
- [Error Handling](#error-handling)
- [Cost Optimization](#cost-optimization)
- [Best Practices](#best-practices)

## Overview

### AI Pipeline Architecture

```
User Input (Text Description)
        ↓
    [GPT-4]  ← Prompt Enhancement
        ↓
  [GPT-Image-1]  ← Concept Art Generation
        ↓
  [Meshy Image-to-3D]  ← 3D Model Creation
        ↓
  [Meshy Retexture]  ← Material Variants (optional)
        ↓
  [Meshy Rigging]  ← Character Animation (optional)
        ↓
  [GPT-4o-mini Vision]  ← Weapon Grip Detection (optional)
```

### Service Responsibilities

**OpenAI Services:**
- GPT-4: Prompt optimization and enhancement
- GPT-Image-1: High-quality concept art generation (1024x1024)
- GPT-4o-mini Vision: Image analysis (weapon grip detection, orientation)

**Meshy Services:**
- Image-to-3D: Convert 2D images to 3D models
- Retexture: Apply material textures to existing models
- Rigging: Add skeleton and animations to characters

### API Versions

- OpenAI API: v1 (https://api.openai.com/v1)
- Meshy API: OpenAPI v1 (https://api.meshy.ai/openapi/v1)

## OpenAI Integration

### GPT-4 Prompt Enhancement

**Purpose:** Enhance user prompts to generate better 3D assets

**Model:** `gpt-4`
**Endpoint:** `POST https://api.openai.com/v1/chat/completions`

#### Configuration

```javascript
{
  model: 'gpt-4',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.7,
  max_tokens: 200
}
```

**Temperature:** 0.7 provides creative but consistent enhancements
**Max Tokens:** 200 ensures concise prompts suitable for image generation

#### System Prompt Structure

**Base Template:**
```
You are an expert at optimizing prompts for 3D asset generation.
Your task is to enhance the user's description to create better results
with image generation and 3D conversion.

Focus on:
- Clear, specific visual details
- Material and texture descriptions
- Geometric shape and form
- Style consistency (especially for ${style} style)

Keep the enhanced prompt concise but detailed.
```

**Character-Specific Addition:**
```
CRITICAL for characters: The character MUST be in a T-pose (arms stretched
out horizontally, legs slightly apart) for proper rigging. The character must
have EMPTY HANDS - no weapons, tools, or held items. Always add "standing in
T-pose with empty hands" to the description.
```

**Armor-Specific Addition:**
```
CRITICAL for armor pieces: The armor must be shown ALONE without any armor
stand, mannequin, or body inside. The armor MUST be positioned and SHAPED for
a SCARECROW/T-POSE body - shoulder openings must point STRAIGHT SIDEWAYS at
90 degrees (like a cross or scarecrow), NOT angled downward.
```

#### Request Example

```javascript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at optimizing prompts for 3D asset generation...'
      },
      {
        role: 'user',
        content: 'Enhance this character asset description for 3D generation: "A goblin warrior"'
      }
    ],
    temperature: 0.7,
    max_tokens: 200
  })
})
```

#### Response Example

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1729506000,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "A menacing goblin warrior character standing in T-pose with arms stretched horizontally and empty hands, wearing rugged leather armor with bronze accents, green scaly skin texture, pointed ears, fierce expression, low-poly RuneScape style with blocky geometry and flat-shaded surfaces"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 65,
    "total_tokens": 215
  }
}
```

#### Error Handling

**Rate Limit (429):**
```javascript
{
  "error": {
    "message": "Rate limit reached for gpt-4",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}
```

**Fallback Strategy:**
```javascript
try {
  const optimized = await enhanceWithGPT4(prompt)
  return optimized
} catch (error) {
  console.warn('GPT-4 enhancement failed, using template fallback')
  return `${prompt}. ${style} style, clean geometry, game-ready 3D asset.`
}
```

### GPT-Image-1 Concept Art

**Purpose:** Generate high-quality 2D concept art for 3D conversion

**Model:** `gpt-image-1`
**Endpoint:** `POST https://api.openai.com/v1/images/generations`

#### Configuration

```javascript
{
  model: 'gpt-image-1',
  prompt: enhancedPrompt,
  size: '1024x1024',
  quality: 'high'
}
```

**Resolution:** 1024x1024 optimal for Meshy Image-to-3D
**Quality:** 'high' provides better detail for 3D conversion

#### Prompt Construction

**Base Template:**
```javascript
const promptTemplate = generationPrompts?.imageGeneration?.base ||
  '${description}. ${style || "game-ready"} style, ${assetType}, clean geometry suitable for 3D conversion.'
```

**Character Additions:**
```javascript
if (assetType === 'character' || generationType === 'avatar') {
  const tposePrompt = 'standing in T-pose with arms stretched out horizontally'
  prompt = `${enhancedPrompt} ${tposePrompt}`
}
```

**Armor Additions:**
```javascript
if (assetType === 'armor') {
  const chestPrompt = 'floating chest armor SHAPED FOR T-POSE BODY - shoulder openings must point STRAIGHT OUT SIDEWAYS at 90 degrees like a scarecrow (NOT angled down), wide "T" shape when viewed from front, ends at shoulders with no arm extensions, torso-only armor piece, hollow shoulder openings pointing horizontally, no armor stand'
  prompt = `${enhancedPrompt} ${chestPrompt}`
}
```

**High-Quality Style Handling:**
```javascript
const wantsHQPrompt = /\b(4k|ultra|high\s*quality|realistic|cinematic|photoreal|pbr)\b/i.test(style)
if (wantsHQPrompt) {
  // Remove low-poly cues
  prompt = prompt.replace(/\b(low-?poly|stylized|minimalist|blocky|simplified)\b/gi, '').trim()
  // Add HQ details
  prompt = `${prompt} highly detailed, realistic, sharp features, high-resolution textures`
}
```

#### Request Example

```javascript
const response = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-image-1',
    prompt: 'A menacing goblin warrior character in T-pose with empty hands, leather armor with bronze accents, low-poly RuneScape style',
    size: '1024x1024',
    quality: 'high'
  })
})
```

#### Response Format

**Base64 Response:**
```json
{
  "created": 1729506000,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAAB..."
    }
  ]
}
```

**URL Response (alternative):**
```json
{
  "created": 1729506000,
  "data": [
    {
      "url": "https://oaidalleapiprodscus.blob.core.windows.net/..."
    }
  ]
}
```

#### Response Handling

```javascript
const data = await response.json()
const imageData = data.data[0]

let imageUrl
if (imageData.b64_json) {
  // Convert base64 to data URI
  imageUrl = `data:image/png;base64,${imageData.b64_json}`
} else if (imageData.url) {
  // Use direct URL
  imageUrl = imageData.url
} else {
  throw new Error('No image data returned from OpenAI')
}
```

### GPT-4o-mini Vision for Weapon Detection

**Purpose:** Analyze weapon images to detect grip locations and orientation

**Model:** `gpt-4o-mini`
**Endpoint:** `POST https://api.openai.com/v1/chat/completions`

#### Grip Detection Configuration

```javascript
{
  model: "gpt-4o-mini",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: detectionPrompt },
        { type: "image_url", image_url: { url: imageDataUri, detail: "high" } }
      ]
    }
  ],
  max_tokens: 300,
  temperature: 0.3,
  response_format: { type: "json_object" }
}
```

**Temperature:** 0.3 for consistent, precise detections
**Response Format:** JSON object for structured output

#### Grip Detection Prompt

```javascript
const promptText = `You are analyzing a 3D weapon rendered from the ${angle} in a 512x512 pixel image.
The weapon is oriented vertically with the blade/head pointing UP and handle pointing DOWN.

YOUR TASK: Identify ONLY the HANDLE/GRIP area where a human hand would hold this weapon.

CRITICAL DISTINCTIONS:
- HANDLE/GRIP: The narrow cylindrical part designed for holding (usually wrapped, textured, or darker)
- BLADE: The wide, flat, sharp part used for cutting (usually metallic, reflective, lighter)
- GUARD/CROSSGUARD: The horizontal piece between blade and handle
- POMMEL: The weighted end piece at the very bottom of the handle

For a SWORD specifically:
- The HANDLE is the wrapped/textured section BELOW the guard/crossguard
- It's typically 15-25% of the total weapon length
- It's narrower than the blade
- It often has visible wrapping, leather, or grip texture

VISUAL CUES for the handle:
1. Look for texture changes (wrapped vs smooth metal)
2. Look for width changes (handle is narrower than blade)
3. Look for the crossguard/guard that separates blade from handle
4. The handle is typically in the LOWER portion of the weapon

DO NOT select:
- The blade (wide, flat, sharp part)
- The guard/crossguard
- Decorative elements
- The pommel alone

ONLY select the cylindrical grip area where fingers would wrap around.

Respond with ONLY a JSON object in this exact format:
{
  "gripBounds": {
    "minX": <pixel coordinate 0-512>,
    "minY": <pixel coordinate 0-512>,
    "maxX": <pixel coordinate 0-512>,
    "maxY": <pixel coordinate 0-512>
  },
  "confidence": <number 0-1>,
  "weaponType": "<sword|axe|mace|staff|bow|dagger|spear|etc>",
  "gripDescription": "<brief description of grip location>",
  "detectedParts": {
    "blade": "<describe what you identified as the blade>",
    "handle": "<describe what you identified as the handle>",
    "guard": "<describe if you see a guard/crossguard>"
  }
}`
```

#### Grip Detection Response

```json
{
  "id": "chatcmpl-xyz789",
  "choices": [
    {
      "message": {
        "content": "{\"gripBounds\":{\"minX\":220,\"minY\":360,\"maxX\":292,\"maxY\":480},\"confidence\":0.95,\"weaponType\":\"sword\",\"gripDescription\":\"Leather-wrapped cylindrical grip between crossguard and pommel\",\"detectedParts\":{\"blade\":\"Wide, flat metallic blade extending upward from crossguard with slight taper\",\"handle\":\"Wrapped leather grip section below crossguard, approximately 18% of total weapon length, narrower than blade\",\"guard\":\"Horizontal crossguard clearly separating blade and handle at approximately 350px from top\"}}"
      }
    }
  ]
}
```

#### Orientation Detection

**Purpose:** Determine if weapon needs 180-degree flip

**Prompt:**
```javascript
const promptText = `You are analyzing a 3D weapon that should be oriented vertically.

CRITICAL TASK: Determine if this weapon is upside down and needs to be flipped 180 degrees.

CORRECT ORIENTATION:
- The HANDLE/GRIP should be at the BOTTOM
- The BLADE/HEAD/BUSINESS END should be at the TOP

For different weapons:
- SWORD: Blade should point UP, handle/grip DOWN
- AXE: Axe head UP, wooden handle DOWN
- MACE: Heavy spiked head UP, shaft/handle DOWN
- HAMMER: Hammer head UP, handle DOWN
- STAFF: Usually symmetrical but decorative end UP
- SPEAR: Pointed tip UP, shaft DOWN
- DAGGER: Blade UP, handle DOWN

Look for these visual cues:
1. Handles are usually narrower, wrapped, or textured
2. Blades/heads are usually wider, metallic, or decorative
3. The "heavy" or "dangerous" end should be UP
4. The "holding" end should be DOWN

Respond with ONLY a JSON object:
{
  "needsFlip": <true if weapon is upside down, false if correctly oriented>,
  "currentOrientation": "<describe what you see at top and bottom>",
  "reason": "<brief explanation of your decision>"
}`
```

#### Orientation Response

```json
{
  "choices": [
    {
      "message": {
        "content": "{\"needsFlip\":false,\"currentOrientation\":\"Sharp metallic blade at top, wrapped leather grip at bottom\",\"reason\":\"The wide, reflective blade is correctly positioned at the top while the narrower, textured grip is at the bottom, matching the expected vertical orientation for swords\"}"
      }
    }
  ]
}
```

## Meshy AI Integration

### Image-to-3D Conversion

**Purpose:** Convert 2D concept art to 3D models

**Endpoint:** `POST https://api.meshy.ai/openapi/v1/image-to-3d`

#### Configuration Options

```javascript
{
  image_url: publicImageUrl,        // Must be publicly accessible
  enable_pbr: true,                 // PBR material generation
  ai_model: 'meshy-5',             // Model version
  topology: 'quad',                 // Mesh topology (quad/triangle)
  target_polycount: 12000,          // Target polygon count
  texture_resolution: 2048          // Texture size (512/1024/2048/4096)
}
```

#### Quality Presets

**Standard Quality:**
```javascript
{
  target_polycount: 6000,
  texture_resolution: 1024,
  enable_pbr: false,
  ai_model: 'meshy-4'
}
```

**High Quality:**
```javascript
{
  target_polycount: 12000,
  texture_resolution: 2048,
  enable_pbr: true,
  ai_model: 'meshy-5'
}
```

**Ultra Quality:**
```javascript
{
  target_polycount: 20000,
  texture_resolution: 4096,
  enable_pbr: true,
  ai_model: 'meshy-5'
}
```

#### Dynamic Quality Selection

```javascript
// Determine quality from style cues or explicit config
const wantsHighQuality = /\b(4k|ultra|high\s*quality|realistic|cinematic|marvel|skyrim)\b/i.test(style)
const isAvatar = generationType === 'avatar' || type === 'character'

const quality = config.quality || (wantsHighQuality || isAvatar ? 'ultra' : 'standard')
```

#### Environment-Based Model Selection

```javascript
const qualityUpper = quality.toUpperCase()
const aiModelEnv = process.env[`MESHY_MODEL_${qualityUpper}`] || process.env.MESHY_MODEL_DEFAULT
const aiModel = aiModelEnv || 'meshy-5'
```

**Environment Variables:**
```bash
MESHY_MODEL_DEFAULT=meshy-5
MESHY_MODEL_STANDARD=meshy-4
MESHY_MODEL_HIGH=meshy-5
MESHY_MODEL_ULTRA=meshy-5
```

#### Request Example

```javascript
const response = await fetch('https://api.meshy.ai/openapi/v1/image-to-3d', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.MESHY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    image_url: 'https://i.imgur.com/abc123.png',
    enable_pbr: true,
    ai_model: 'meshy-5',
    topology: 'quad',
    target_polycount: 12000,
    texture_resolution: 2048
  })
})

const data = await response.json()
const taskId = data.task_id || data.id
```

#### Response Format

```json
{
  "task_id": "img3d_abc123def456",
  "status": "PENDING"
}
```

### Retexture API

**Purpose:** Apply material textures to existing 3D models

**Endpoint:** `POST https://api.meshy.ai/openapi/v1/retexture`

#### Configuration

```javascript
{
  input_task_id: baseTaskId,           // Base model task ID
  text_style_prompt: materialPrompt,    // Material description
  art_style: 'realistic',               // realistic or stylized
  ai_model: 'meshy-5',                  // Model version
  enable_original_uv: true              // Preserve UV mapping
}
```

**Alternative Input:**
```javascript
{
  model_url: publicModelUrl,            // Direct model URL instead of task_id
  // ... rest of config
}
```

**Style Options:**
- `text_style_prompt` (string): Text description of material
- `image_style_url` (string): Reference image URL (alternative to text)

#### Material Prompt Examples

**Bronze Metal:**
```
bronze metal texture with oxidized patina, warm copper-brown tones,
slightly weathered, game-ready PBR materials
```

**Steel Metal:**
```
polished steel metal texture, reflective silver-gray surface,
industrial finish, game-ready PBR materials
```

**Leather:**
```
worn brown leather texture, natural grain patterns, matte finish,
aged appearance, game-ready PBR materials
```

**Crystal:**
```
glowing purple crystal texture, translucent material,
inner light emission, mystical appearance, game-ready PBR materials
```

#### Request Example

```javascript
const response = await fetch('https://api.meshy.ai/openapi/v1/retexture', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.MESHY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    input_task_id: 'img3d_abc123',
    text_style_prompt: 'bronze metal texture with oxidized patina',
    art_style: 'realistic',
    ai_model: 'meshy-5',
    enable_original_uv: true
  })
})

const data = await response.json()
const taskId = data.task_id || data.id
```

#### Response Format

```json
{
  "task_id": "ret_xyz789abc123",
  "status": "PENDING"
}
```

### Rigging API

**Purpose:** Add humanoid skeleton and animations to character models

**Endpoint:** `POST https://api.meshy.ai/openapi/v1/rigging`

#### Configuration

```javascript
{
  input_task_id: characterTaskId,    // Character model task ID
  height_meters: 1.83                // Character height in meters
}
```

**Alternative Input:**
```javascript
{
  model_url: publicModelUrl,         // Direct model URL
  height_meters: 1.7
}
```

#### Character Height Guidelines

**Default Heights:**
- Adult human: 1.7 - 1.85 meters
- Dwarf/goblin: 1.2 - 1.4 meters
- Giant: 2.5 - 3.0 meters
- Child: 1.0 - 1.3 meters

**Dynamic Height Selection:**
```javascript
const targetHeight = config.metadata?.characterHeight ||
                   config.riggingOptions?.heightMeters ||
                   1.83  // Default adult human height
```

#### Request Example

```javascript
const response = await fetch('https://api.meshy.ai/openapi/v1/rigging', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.MESHY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    input_task_id: 'img3d_character123',
    height_meters: 1.83
  })
})

const data = await response.json()
const taskId = data.task_id || data.id
```

#### Rigging Result Structure

```json
{
  "task_id": "rig_abc123",
  "status": "SUCCEEDED",
  "result": {
    "basic_animations": {
      "walking_glb_url": "https://api.meshy.ai/files/walking_abc123.glb",
      "running_glb_url": "https://api.meshy.ai/files/running_abc123.glb"
    }
  }
}
```

**Animation Files:**
- `walking_glb_url`: Rigged model with walking animation
- `running_glb_url`: Rigged model with running animation

**Important Notes:**
1. Walking GLB contains rigged model at frame 0 (T-pose) + walking animation
2. Running GLB contains rigged model at frame 0 (T-pose) + running animation
3. Both use the same skeleton structure
4. Base unrigged model remains separate for static viewing

## API Authentication

### OpenAI Authentication

**Header Format:**
```
Authorization: Bearer sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Environment Variable:**
```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Validation:**
```javascript
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY required for generation')
}
```

### Meshy Authentication

**Header Format:**
```
Authorization: Bearer msy_xxxxxxxxxxxxxxxxxxxxxxxx
```

**Environment Variable:**
```bash
MESHY_API_KEY=msy_xxxxxxxxxxxxxxxxxxxxxxxx
```

**Validation:**
```javascript
if (!process.env.MESHY_API_KEY) {
  throw new Error('MESHY_API_KEY required for 3D conversion')
}
```

### Security Best Practices

1. **Never commit API keys to git**
```gitignore
.env
.env.local
.env.*.local
```

2. **Use environment variables**
```javascript
import 'dotenv/config'
const apiKey = process.env.OPENAI_API_KEY
```

3. **Validate keys on startup**
```javascript
const requiredEnvVars = ['OPENAI_API_KEY', 'MESHY_API_KEY']
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  ${envVar} not found - some features will be disabled`)
  }
}
```

4. **Rotate keys regularly**
- OpenAI: Every 90 days
- Meshy: Every 90 days

## Polling Strategies

### Meshy Task Status Polling

All Meshy APIs (Image-to-3D, Retexture, Rigging) use asynchronous task polling.

#### Polling Configuration

```javascript
const pollIntervalMs = parseInt(process.env.MESHY_POLL_INTERVAL_MS || '5000', 10)
const timeoutMs = parseInt(process.env.MESHY_TIMEOUT_MS || '300000', 10)
const maxAttempts = Math.max(1, Math.ceil(timeoutMs / pollIntervalMs))
```

**Default Values:**
- Poll interval: 5000ms (5 seconds)
- Timeout: 300000ms (5 minutes)
- Max attempts: 60

#### Polling Loop

```javascript
let attempts = 0
let result = null

while (attempts < maxAttempts) {
  await new Promise(resolve => setTimeout(resolve, pollIntervalMs))

  const status = await getTaskStatus(taskId)
  pipeline.stages.image3D.progress = status.progress || (attempts / maxAttempts * 100)

  if (status.status === 'SUCCEEDED') {
    result = status
    break
  } else if (status.status === 'FAILED') {
    throw new Error(status.error || 'Task failed')
  }

  attempts++
}

if (!result) {
  throw new Error('Task timed out')
}
```

#### Status Values

- `PENDING` - Task queued
- `PROCESSING` - Task in progress
- `SUCCEEDED` - Task completed successfully
- `FAILED` - Task failed with error

#### Progress Updates

**Progressive Progress:**
```javascript
// If API doesn't provide progress, estimate based on attempts
const estimatedProgress = (attempts / maxAttempts) * 100
pipeline.stages.image3D.progress = status.progress || estimatedProgress
```

**Actual Progress:**
```javascript
// Some Meshy endpoints return actual progress
{
  "status": "PROCESSING",
  "progress": 45  // 0-100
}
```

### Exponential Backoff (Future)

For production, implement exponential backoff to reduce API load:

```javascript
async function pollWithBackoff(taskId, baseInterval = 5000, maxInterval = 60000) {
  let interval = baseInterval
  let attempts = 0

  while (true) {
    await new Promise(resolve => setTimeout(resolve, interval))

    const status = await getTaskStatus(taskId)

    if (status.status === 'SUCCEEDED') {
      return status
    } else if (status.status === 'FAILED') {
      throw new Error(status.error)
    }

    // Increase interval exponentially: 5s, 10s, 20s, 40s, 60s (max)
    interval = Math.min(interval * 2, maxInterval)
    attempts++

    if (attempts > 100) {
      throw new Error('Timeout after 100 attempts')
    }
  }
}
```

## Timeout Configuration

### Quality-Based Timeouts

Different quality levels require different timeout values:

```bash
MESHY_TIMEOUT_MS=300000               # Default: 5 minutes
MESHY_TIMEOUT_STANDARD_MS=180000      # Standard: 3 minutes
MESHY_TIMEOUT_HIGH_MS=300000          # High: 5 minutes
MESHY_TIMEOUT_ULTRA_MS=600000         # Ultra: 10 minutes
```

#### Dynamic Timeout Selection

```javascript
const quality = config.quality || 'standard'
const qualityUpper = quality.toUpperCase()

const timeoutMs = parseInt(
  process.env[`MESHY_TIMEOUT_${qualityUpper}_MS`] ||
  process.env.MESHY_TIMEOUT_MS ||
  '300000',
  10
)

const maxAttempts = Math.max(1, Math.ceil(timeoutMs / pollIntervalMs))
```

### OpenAI Timeouts

**Request Timeout:**
```bash
OPENAI_TIMEOUT_MS=30000  # 30 seconds
```

**Implementation:**
```javascript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30000)

try {
  const response = await fetch(url, {
    signal: controller.signal,
    ...options
  })
} finally {
  clearTimeout(timeoutId)
}
```

### Timeout Error Handling

```javascript
try {
  const result = await pollForCompletion(taskId)
} catch (error) {
  if (error.message.includes('timeout') || error.message.includes('timed out')) {
    throw new Error(`Meshy conversion timed out after ${timeoutMs / 1000} seconds. Try reducing quality or increasing MESHY_TIMEOUT_MS.`)
  }
  throw error
}
```

## Error Handling

### Error Classification

**Network Errors:**
```javascript
const isNetworkError = errorMessage.includes('timeout') ||
                     errorMessage.includes('fetch failed') ||
                     errorMessage.includes('ECONNREFUSED') ||
                     errorMessage.includes('network')
```

**API Errors:**
```javascript
if (!response.ok) {
  const errorText = await response.text()
  throw new Error(`API error: ${response.status} - ${errorText}`)
}
```

**Validation Errors:**
```javascript
if (!imageUrl || !imageUrl.startsWith('http')) {
  throw new Error('Image URL must be publicly accessible (http/https)')
}
```

### Error Response Formats

**OpenAI Error:**
```json
{
  "error": {
    "message": "Rate limit reached for gpt-4 in organization org-xxx",
    "type": "rate_limit_error",
    "param": null,
    "code": "rate_limit_exceeded"
  }
}
```

**Meshy Error:**
```json
{
  "error": "Invalid image URL",
  "status": 400
}
```

**Task Failure:**
```json
{
  "task_id": "img3d_abc123",
  "status": "FAILED",
  "task_error": {
    "message": "Failed to process image: Invalid image format",
    "code": "INVALID_IMAGE"
  }
}
```

### Retry Logic

**Simple Retry:**
```javascript
async function retryOperation(fn, maxRetries = 3, delay = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Usage
const result = await retryOperation(() => meshyService.getTaskStatus(taskId))
```

**Conditional Retry:**
```javascript
const isRetryable = (error) => {
  return error.message.includes('timeout') ||
         error.message.includes('503') ||
         error.message.includes('502')
}

if (isRetryable(error)) {
  return await retryOperation(fn)
}
throw error  // Don't retry validation errors
```

## Cost Optimization

### OpenAI Costs

**GPT-4:**
- Input: $0.03 per 1K tokens
- Output: $0.06 per 1K tokens
- Typical prompt enhancement: ~200 tokens = $0.012

**GPT-Image-1:**
- 1024x1024, high quality: ~$0.08 per image

**GPT-4o-mini Vision:**
- Input: $0.00015 per 1K tokens
- Output: $0.0006 per 1K tokens
- Image analysis: ~150 tokens = $0.0001

### Meshy Costs

Consult Meshy pricing page for current rates. Typical costs:
- Image-to-3D: Based on quality and model version
- Retexture: Per retexture task
- Rigging: Per rigging task

### Cost Reduction Strategies

1. **Cache GPT-4 Enhancements**
```javascript
const promptCache = new Map()
const cacheKey = `${description}-${style}-${type}`

if (promptCache.has(cacheKey)) {
  return promptCache.get(cacheKey)
}

const result = await enhanceWithGPT4(...)
promptCache.set(cacheKey, result)
return result
```

2. **Skip Optional Stages**
```javascript
// Disable GPT-4 enhancement
metadata: { useGPT4Enhancement: false }

// Use user-provided reference image (skip GPT-Image-1)
referenceImage: { url: userImageUrl }

// Skip material variants
enableRetexturing: false
```

3. **Use Standard Quality**
```javascript
// Standard uses fewer polygons and smaller textures
quality: 'standard'  // vs 'high' or 'ultra'
```

4. **Batch Processing**
```javascript
// Generate multiple variants in one session
const variants = await Promise.all(
  materialPresets.map(preset => retextureService.retexture(...))
)
```

## Best Practices

### Image URL Requirements

**Meshy Requires Public URLs:**
```javascript
// ❌ Won't work with Meshy
'data:image/png;base64,iVBORw0KGgo...'
'http://localhost:8080/image.png'
'http://127.0.0.1:8080/image.png'

// ✅ Will work with Meshy
'https://i.imgur.com/abc123.png'
'https://your-domain.com/image.png'
'https://abc123.ngrok.io/image.png'
```

**Solution: Image Hosting Service**
```javascript
if (imageUrl.startsWith('data:') || imageUrl.includes('localhost')) {
  imageUrl = await imageHostingService.uploadImage(imageUrl)
}
```

### Prompt Engineering

**Character Prompts:**
- Always include "T-pose" for rigging compatibility
- Specify "empty hands" to avoid weapons
- Include detailed material descriptions
- Add style modifiers (low-poly, realistic, etc.)

**Armor Prompts:**
- Emphasize "T-pose shape" for shoulder openings
- Specify "floating armor piece" (no mannequin)
- Describe hollow openings and fit
- Avoid armor stands or bodies

**Weapon Prompts:**
- Describe blade and grip separately
- Specify vertical orientation
- Include material details (steel, leather-wrapped grip)
- Add style cues

### Model Normalization

**Character Height:**
```javascript
// Normalize all characters to consistent height
const normalized = await normalizer.normalizeCharacter(rawModelPath, 1.83)
```

**Weapon Grip:**
```javascript
// Center weapon grip at origin for attachment
const result = await detector.exportNormalizedWeapon(rawModelPath, normalizedPath)
```

### Animation Handling

**Separate Models for Static/Animated:**
```javascript
// Static viewer: Use unrigged model
modelPath: 'goblin-warrior.glb'

// Animation player: Use rigged model
riggedModelPath: 'goblin-warrior_rigged.glb'
```

**T-Pose Extraction:**
```javascript
// Extract clean T-pose from walking animation
await extractTPoseFromAnimation('animations/walking.glb', 't-pose.glb')
```

### Error Recovery

**Graceful Degradation:**
```javascript
try {
  const riggingResult = await meshyService.startRiggingTask(...)
} catch (error) {
  console.warn('Rigging failed, continuing without animations')
  metadata.isRigged = false
  metadata.riggingError = error.message
  // Continue pipeline
}
```

**User Feedback:**
```javascript
// Provide clear error messages
throw new Error(
  'Network error during retexturing. Please check your internet connection and try again.'
)
```

---

**Total Word Count: 4,100 words**

This comprehensive AI integrations documentation covers all AI services used in Asset Forge, including detailed API specifications, authentication, polling strategies, timeout configuration, error handling, and best practices for working with OpenAI and Meshy AI.
