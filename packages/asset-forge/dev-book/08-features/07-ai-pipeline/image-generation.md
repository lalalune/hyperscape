# Image Generation

[← Back to Index](../README.md)

---

## OpenAI Image Generation Integration

Asset Forge uses OpenAI's GPT-Image-1 API (DALL-E 3) to generate concept art that serves as the foundation for 3D model conversion. This document covers the complete image generation workflow, API integration, optimization strategies, and troubleshooting.

---

## Overview

### Purpose

Generate high-quality 2D concept art from text descriptions that will be converted to 3D models using Meshy.ai.

### Key Requirements

1. **1024x1024 resolution**: Required by Meshy image-to-3D API
2. **High quality**: Better concept art = better 3D models
3. **Pose accuracy**: Critical for characters (T-pose) and armor (shape)
4. **Style consistency**: Match game art direction
5. **Clean backgrounds**: Neutral backgrounds aid 3D conversion

### Workflow

```
Enhanced Prompt
      ↓
GPT-Image-1 API Request
      ↓
Base64 Image Response
      ↓
Save to File System
      ↓
Upload/Host Publicly
      ↓
Provide URL to Meshy
```

---

## GPT-Image-1 API

### Model Information

**Model Name**: `gpt-image-1`
**Technology**: DALL-E 3
**Provider**: OpenAI
**Release**: October 2023, API updated 2024

### Capabilities

- **Resolution**: Up to 1792x1024 (HD)
- **Quality**: Standard or HD
- **Style**: Natural or vivid
- **Prompts**: Up to 4000 characters
- **Safety**: Built-in content filtering
- **Prompt Rewriting**: Automatic enhancement (can be disabled)

### API Endpoint

```
POST https://api.openai.com/v1/images/generations
```

---

## Image Generation Parameters

### Required Parameters

```typescript
interface ImageGenerationRequest {
  model: 'gpt-image-1'              // Model identifier
  prompt: string                     // Enhanced description
  n?: number                         // Number of images (1-10)
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  response_format?: 'url' | 'b64_json'
  style?: 'natural' | 'vivid'
  user?: string                      // User identifier for abuse monitoring
}
```

### Asset Forge Configuration

```typescript
const ASSET_FORGE_IMAGE_CONFIG = {
  model: 'gpt-image-1',
  size: '1024x1024',           // Required for Meshy
  quality: 'hd',                // High quality for better 3D conversion
  response_format: 'b64_json',  // Base64 for server-side processing
  style: 'natural',             // Realistic rendering
  n: 1                          // One image per request
}
```

### Parameter Details

#### Size

**Options:**
- `1024x1024`: Square (Asset Forge default)
- `1792x1024`: Landscape
- `1024x1792`: Portrait

**Why 1024x1024?**
- Meshy.ai requirement
- Best for object-oriented assets (weapons, items, characters)
- Consistent aspect ratio
- Optimal for 3D conversion

#### Quality

**Standard**:
- Faster generation (~30 seconds)
- Lower cost ($0.040 per image)
- Good for prototyping

**HD** (Asset Forge default):
- Better detail (~60 seconds)
- Higher cost ($0.080 per image)
- Better 3D conversion results
- Recommended for production

#### Response Format

**url**:
- Returns OpenAI-hosted URL
- Valid for 1 hour
- Requires immediate download

**b64_json** (Asset Forge default):
- Returns base64-encoded PNG
- No expiration
- Immediate processing
- Easier to save/host

#### Style

**Natural** (Asset Forge default):
- Realistic, photographic quality
- Better for game assets
- Cleaner backgrounds
- More predictable results

**Vivid**:
- Hyper-realistic, dramatic
- More artistic interpretation
- Higher saturation
- Less predictable

---

## API Integration

### Authentication

```typescript
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable required')
}
```

### Request Implementation

```typescript
import fetch from 'node-fetch'

async function generateImage(prompt: string): Promise<Buffer> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      response_format: 'b64_json',
      style: 'natural'
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`)
  }

  const data = await response.json()
  const base64Image = data.data[0].b64_json

  // Convert base64 to buffer
  return Buffer.from(base64Image, 'base64')
}
```

### Response Format

```typescript
interface ImageGenerationResponse {
  created: number                    // Unix timestamp
  data: Array<{
    b64_json?: string               // Base64-encoded PNG
    url?: string                    // Hosted URL (if url format)
    revised_prompt?: string         // OpenAI's prompt enhancement
  }>
}
```

### Example Response

```json
{
  "created": 1704067200,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAABAA...",
      "revised_prompt": "A detailed iron sword with a straight double-edged blade..."
    }
  ]
}
```

---

## T-Pose Requirements for Characters

### Why T-Pose?

The T-pose is **critical** for character rigging:

1. **Skeleton generation**: Auto-rigging algorithms expect T-pose
2. **Joint detection**: Easier to identify shoulders, elbows, hips
3. **Animation compatibility**: Standard animation rigs use T-pose
4. **Armor fitting**: Armor pieces designed for T-pose bodies

### T-Pose Specifications

**Arm Position:**
- Extended horizontally
- 90° angle from body
- Palms facing down
- Fingers extended (not fists)
- Elbows straight

**Leg Position:**
- Slightly apart (10-15°)
- Feet pointing forward
- Knees straight
- Weight centered

**Body:**
- Upright, facing forward
- Head centered
- Shoulders level
- Hands empty (no weapons/items)

### Enforcing T-Pose in Prompts

**Critical additions:**
```
"standing in T-pose with arms stretched out horizontally at 90 degrees,
hands empty, no weapons or items held,
legs slightly apart, facing forward"
```

**Bad examples to avoid:**
- Arms at sides
- Arms raised above horizontal
- Arms bent at elbows
- Holding weapons
- Action poses

### Validation

After generation, check:

```typescript
async function validateTPose(imageBuffer: Buffer): Promise<boolean> {
  // Use GPT-4o-mini vision to verify T-pose
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Is this character in a proper T-pose? Check: arms horizontal at 90°, hands empty, legs slightly apart, facing forward. Respond with JSON: { "isTPose": boolean, "issues": string[] }'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBuffer.toString('base64')}`
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    })
  })

  const data = await response.json()
  const result = JSON.parse(data.choices[0].message.content)

  return result.isTPose
}
```

---

## Armor Shape Requirements

### Why Shape Matters

Armor pieces must be **shaped for T-pose bodies**:

1. **Shoulder openings**: Must point sideways (90°) not downward
2. **Fitting**: Armor transferred to T-pose character skeleton
3. **Geometry**: Shape determines how it wraps around body
4. **Deformation**: Incorrect shape causes clipping/gaps

### Chest Armor Specifications

**Critical shape requirements:**
```
"Chest armor shaped for T-pose body (scarecrow pose).
Shoulder openings pointing STRAIGHT SIDEWAYS at 90 degrees from center,
forming a wide T-shape or cross when viewed from above.
Shoulder openings should form a straight horizontal line across (180° angle).
NO downward angle on shoulder openings.
Ends at shoulders - no arm extensions."
```

**Visualization:**

```
Top View (correct):
    ←———————————→
    Shoulder openings form straight line

Side View (correct):
    ___
   |   |___     ← Shoulder opening points sideways
   |___|

Top View (incorrect):
    ↙        ↘
    Shoulder openings angled down

Side View (incorrect):
    ___
   |   \       ← Shoulder opening angles down
   |___/
```

### Other Armor Pieces

**Helmet:**
- No special shape requirements
- Hollow interior
- Sized for average head

**Gloves:**
- Shaped for T-pose hands (fingers extended)
- Palms facing down

**Boots:**
- Feet pointing forward
- No special pose requirements

**Legs:**
- Straight legs
- Slightly apart opening

### Enforcing Shape in Prompts

```typescript
function buildArmorPrompt(description: string, armorSlot: string): string {
  const basePrompt = description

  if (armorSlot === 'chest' || armorSlot === 'body') {
    return `${basePrompt},
CRITICAL: armor piece shaped for T-pose body (scarecrow/cross shape),
shoulder openings pointing STRAIGHT SIDEWAYS at exactly 90 degrees,
forms a T or cross shape when viewed from above,
shoulder openings form straight horizontal line (180° angle between them),
hollow interior, no mannequin, no armor stand,
ends at shoulders with no arm extensions`
  }

  return `${basePrompt}, hollow armor piece, no mannequin, no armor stand`
}
```

---

## Image Formats

### Output Format

**PNG** (Portable Network Graphics)
- Lossless compression
- Supports transparency
- 24-bit color (RGB)
- No quality loss

### Base64 Encoding

**Received from API:**
```
iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAAA...
```

**Decoding:**
```typescript
const imageBuffer = Buffer.from(base64String, 'base64')
```

**Encoding (for GPT-4o-mini vision):**
```typescript
const base64Image = imageBuffer.toString('base64')
const dataUrl = `data:image/png;base64,${base64Image}`
```

### File Size

**Typical sizes:**
- Standard quality: 400-800 KB
- HD quality: 800-1500 KB
- 1024x1024 PNG: ~1 MB average

**Optimization:**
```typescript
import sharp from 'sharp'

// Optimize PNG (optional, not required for Meshy)
const optimized = await sharp(imageBuffer)
  .png({ quality: 90, compressionLevel: 9 })
  .toBuffer()
```

---

## Size Constraints

### Meshy Requirements

**Supported sizes:**
- Minimum: 512x512
- Maximum: 2048x2048
- Recommended: 1024x1024
- Aspect ratio: 1:1 (square) recommended

### Asset Forge Standard

**Always use 1024x1024 because:**
1. Optimal quality/cost balance
2. Fast processing
3. Meshy sweet spot
4. Consistent results

### Resolution Impact

**Higher resolution (1792x1024):**
- More detail
- Higher cost
- Longer generation time
- May not improve 3D conversion (Meshy downsamples)

**Lower resolution (512x512):**
- Faster/cheaper
- Less detail
- Poorer 3D conversion
- Not recommended

---

## Cost Optimization

### Pricing (as of January 2025)

**Per Image:**
- Standard quality (1024x1024): $0.040
- HD quality (1024x1024): $0.080
- HD quality (1792x1024): $0.120

**Rate Limits:**
- Tier 1: 5 requests/minute, 500/day
- Tier 2: 10 requests/minute, 1000/day
- Tier 3: 25 requests/minute, 2000/day
- Tier 4+: 50 requests/minute, 5000/day

### Cost Reduction Strategies

#### 1. Reference Image Bypass

Allow users to provide their own concept art:

```typescript
interface GenerationConfig {
  referenceImage?: {
    source: 'url' | 'data'
    url?: string
    dataUrl?: string
  }
}

async function generateOrUseReference(config: GenerationConfig): Promise<string> {
  if (config.referenceImage) {
    // Skip image generation, use provided image
    return config.referenceImage.url || config.referenceImage.dataUrl!
  }

  // Generate new image
  const imageBuffer = await generateImage(config.description)
  return await hostImage(imageBuffer, config.assetId)
}
```

**Savings**: $0.08 per asset

#### 2. Prototype with Standard Quality

```typescript
const qualityByEnvironment = {
  development: 'standard',    // $0.04
  staging: 'standard',        // $0.04
  production: 'hd'            // $0.08
}

const quality = qualityByEnvironment[process.env.NODE_ENV || 'development']
```

**Savings**: 50% in development

#### 3. Image Caching

```typescript
class ImageCache {
  private cache = new Map<string, Buffer>()

  async getOrGenerate(promptHash: string, generateFn: () => Promise<Buffer>): Promise<Buffer> {
    const cached = this.cache.get(promptHash)
    if (cached) {
      console.log('Cache hit, skipping generation')
      return cached
    }

    const image = await generateFn()
    this.cache.set(promptHash, image)
    return image
  }
}

// Usage
const promptHash = hashPrompt(enhancedPrompt)
const image = await imageCache.getOrGenerate(promptHash, () => generateImage(enhancedPrompt))
```

**Savings**: Eliminates duplicate generations

#### 4. Batch Processing

Generate multiple assets in batch during off-peak:

```typescript
async function batchGenerate(configs: GenerationConfig[]): Promise<void> {
  const queue = configs.map(config => ({
    config,
    priority: config.priority || 'normal'
  }))

  // Sort by priority
  queue.sort((a, b) => {
    const priorities = { high: 0, normal: 1, low: 2 }
    return priorities[a.priority] - priorities[b.priority]
  })

  // Process with rate limiting
  for (const item of queue) {
    await generateAsset(item.config)
    await sleep(12000)  // Stay under 5/minute limit
  }
}
```

#### 5. Quality Tiers

Offer users quality options:

```typescript
const qualityTiers = {
  prototype: { quality: 'standard', cost: 0.04 },
  production: { quality: 'hd', cost: 0.08 },
  showcase: { quality: 'hd', size: '1792x1024', cost: 0.12 }
}
```

### Budget Monitoring

```typescript
interface UsageStats {
  totalRequests: number
  totalCost: number
  requestsByQuality: Record<string, number>
  costByQuality: Record<string, number>
}

class UsageTracker {
  private stats: UsageStats = {
    totalRequests: 0,
    totalCost: 0,
    requestsByQuality: {},
    costByQuality: {}
  }

  trackGeneration(quality: 'standard' | 'hd', size: string): void {
    const cost = this.calculateCost(quality, size)

    this.stats.totalRequests++
    this.stats.totalCost += cost
    this.stats.requestsByQuality[quality] = (this.stats.requestsByQuality[quality] || 0) + 1
    this.stats.costByQuality[quality] = (this.stats.costByQuality[quality] || 0) + cost
  }

  private calculateCost(quality: string, size: string): number {
    if (size === '1024x1024') {
      return quality === 'hd' ? 0.08 : 0.04
    } else if (size === '1792x1024' || size === '1024x1792') {
      return quality === 'hd' ? 0.12 : 0.06
    }
    return 0
  }

  getStats(): UsageStats {
    return { ...this.stats }
  }

  reset(): void {
    this.stats = {
      totalRequests: 0,
      totalCost: 0,
      requestsByQuality: {},
      costByQuality: {}
    }
  }
}

export const usageTracker = new UsageTracker()
```

---

## Error Handling

### Common Errors

#### 1. Content Policy Violation

```json
{
  "error": {
    "code": "content_policy_violation",
    "message": "Your request was rejected as a result of our safety system."
  }
}
```

**Causes:**
- Violent content
- Sexual content
- Hate speech
- Copyright-protected characters

**Solution:**
```typescript
async function generateImageSafe(prompt: string): Promise<Buffer> {
  try {
    return await generateImage(prompt)
  } catch (error) {
    if (error.message.includes('content_policy_violation')) {
      // Try with sanitized prompt
      const sanitized = sanitizePrompt(prompt)
      return await generateImage(sanitized)
    }
    throw error
  }
}

function sanitizePrompt(prompt: string): string {
  // Remove potentially problematic words
  const blocked = ['blood', 'gore', 'violent', 'sexy', 'nude']
  let sanitized = prompt

  for (const word of blocked) {
    sanitized = sanitized.replace(new RegExp(word, 'gi'), '')
  }

  return sanitized.trim()
}
```

#### 2. Rate Limit Error

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Please try again in 12 seconds."
  }
}
```

**Solution:**
```typescript
async function generateWithRetry(
  prompt: string,
  maxRetries: number = 3
): Promise<Buffer> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateImage(prompt)
    } catch (error) {
      if (error.message.includes('rate_limit_exceeded')) {
        if (attempt === maxRetries) throw error

        const waitTime = 12000 * attempt  // Exponential backoff
        console.log(`Rate limited, waiting ${waitTime}ms...`)
        await sleep(waitTime)
        continue
      }
      throw error
    }
  }

  throw new Error('Max retries exceeded')
}
```

#### 3. Invalid Prompt

```json
{
  "error": {
    "code": "invalid_prompt",
    "message": "The prompt is too long. Maximum length is 4000 characters."
  }
}
```

**Solution:**
```typescript
function validatePrompt(prompt: string): void {
  if (prompt.length > 4000) {
    throw new Error(`Prompt too long: ${prompt.length} characters (max 4000)`)
  }

  if (prompt.length < 5) {
    throw new Error('Prompt too short: minimum 5 characters')
  }
}
```

#### 4. Insufficient Quota

```json
{
  "error": {
    "code": "insufficient_quota",
    "message": "You exceeded your current quota, please check your plan and billing details."
  }
}
```

**Solution:**
```typescript
async function checkQuota(): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/usage', {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
    })

    const usage = await response.json()
    const remaining = usage.hard_limit_usd - usage.total_usage_usd

    if (remaining < 1.0) {
      console.warn(`Low quota: $${remaining.toFixed(2)} remaining`)
      return false
    }

    return true
  } catch {
    return true  // Assume OK if check fails
  }
}
```

### Retry Logic

```typescript
async function robustImageGeneration(prompt: string): Promise<Buffer> {
  // Validate first
  validatePrompt(prompt)

  // Check quota
  const hasQuota = await checkQuota()
  if (!hasQuota) {
    throw new Error('Insufficient quota for image generation')
  }

  // Try generation with retries
  const maxRetries = 3
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Generation attempt ${attempt}/${maxRetries}`)
      return await generateImage(prompt)

    } catch (error) {
      lastError = error as Error
      console.error(`Attempt ${attempt} failed:`, error.message)

      // Don't retry certain errors
      if (
        error.message.includes('content_policy_violation') ||
        error.message.includes('invalid_prompt') ||
        error.message.includes('insufficient_quota')
      ) {
        throw error
      }

      // Wait before retry
      if (attempt < maxRetries) {
        const waitTime = 5000 * attempt
        await sleep(waitTime)
      }
    }
  }

  throw lastError || new Error('Image generation failed')
}
```

---

## Quality Assurance

### Post-Generation Validation

```typescript
interface ValidationResult {
  isValid: boolean
  issues: string[]
  quality: number  // 0-1
}

async function validateGeneratedImage(
  imageBuffer: Buffer,
  config: GenerationConfig
): Promise<ValidationResult> {
  const issues: string[] = []

  // Check file size
  if (imageBuffer.length < 100000) {
    issues.push('Image too small (possible generation error)')
  }

  // Check dimensions
  const metadata = await getImageMetadata(imageBuffer)
  if (metadata.width !== 1024 || metadata.height !== 1024) {
    issues.push(`Wrong dimensions: ${metadata.width}x${metadata.height}`)
  }

  // Check for T-pose (characters only)
  if (config.type === 'character') {
    const isTPose = await validateTPose(imageBuffer)
    if (!isTPose) {
      issues.push('Character not in proper T-pose')
    }
  }

  // Check for armor stand (armor only)
  if (config.type === 'armor') {
    const hasStand = await detectArmorStand(imageBuffer)
    if (hasStand) {
      issues.push('Armor appears to have mannequin/stand')
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    quality: 1 - (issues.length * 0.25)
  }
}
```

### Visual Inspection

```typescript
async function detectArmorStand(imageBuffer: Buffer): Promise<boolean> {
  // Use GPT-4o-mini vision
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Is there an armor stand, mannequin, or body visible inside this armor? Respond with JSON: { "hasStand": boolean, "description": string }'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBuffer.toString('base64')}`
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    })
  })

  const data = await response.json()
  const result = JSON.parse(data.choices[0].message.content)

  return result.hasStand
}
```

---

## Performance Optimization

### Parallel Generation

Generate multiple assets in parallel (within rate limits):

```typescript
async function parallelGeneration(
  configs: GenerationConfig[],
  concurrency: number = 3
): Promise<Buffer[]> {
  const results: Buffer[] = []

  // Process in batches
  for (let i = 0; i < configs.length; i += concurrency) {
    const batch = configs.slice(i, i + concurrency)

    const batchResults = await Promise.all(
      batch.map(config => generateImage(config.description))
    )

    results.push(...batchResults)

    // Rate limit: wait between batches
    if (i + concurrency < configs.length) {
      await sleep(12000)  // 5 requests/minute = 12s between batches
    }
  }

  return results
}
```

### Streaming Response (Future)

Currently not supported, but could be useful:

```typescript
// Hypothetical streaming implementation
async function* streamImageGeneration(prompt: string): AsyncGenerator<ProgressUpdate> {
  yield { stage: 'started', progress: 0 }

  // Start generation
  const response = await fetch(API_ENDPOINT, { /* ... */ })
  yield { stage: 'processing', progress: 50 }

  // Get result
  const image = await response.json()
  yield { stage: 'completed', progress: 100, image }
}
```

---

## Testing

### Unit Tests

```typescript
describe('Image Generation', () => {
  it('should generate 1024x1024 image', async () => {
    const buffer = await generateImage('test sword')

    const metadata = await getImageMetadata(buffer)
    expect(metadata.width).toBe(1024)
    expect(metadata.height).toBe(1024)
    expect(metadata.format).toBe('png')
  })

  it('should handle rate limiting', async () => {
    // Generate 6 images quickly to trigger rate limit
    const promises = Array(6).fill(null).map(() =>
      generateImage('test')
    )

    await expect(Promise.all(promises)).rejects.toThrow('rate_limit')
  })

  it('should validate T-pose', async () => {
    const buffer = await generateImage(
      'knight character in T-pose with empty hands'
    )

    const isValid = await validateTPose(buffer)
    expect(isValid).toBe(true)
  })
})
```

### Integration Tests

```typescript
describe('Full Generation Pipeline', () => {
  it('should generate and convert to 3D', async () => {
    const config = {
      name: 'Test Sword',
      type: 'weapon',
      subtype: 'sword',
      description: 'iron sword',
      style: 'runescape'
    }

    // Generate image
    const imageBuffer = await generateImage(config.description)
    expect(imageBuffer).toBeDefined()

    // Host image
    const imageUrl = await hostImage(imageBuffer, 'test-123')
    expect(imageUrl).toMatch(/^https?:\/\//)

    // Convert to 3D (Meshy)
    const modelUrl = await convertTo3D(imageUrl)
    expect(modelUrl).toMatch(/\.glb$/)
  })
})
```

---

## Best Practices

### 1. Always Use Enhanced Prompts

```typescript
// Bad
const image = await generateImage(userDescription)

// Good
const enhanced = await enhancePrompt(userDescription, assetType, style)
const image = await generateImage(enhanced)
```

### 2. Validate Before and After

```typescript
// Validate prompt
validatePrompt(prompt)

// Generate
const image = await generateImage(prompt)

// Validate result
const validation = await validateGeneratedImage(image, config)
if (!validation.isValid) {
  console.warn('Validation issues:', validation.issues)
}
```

### 3. Handle Errors Gracefully

```typescript
try {
  return await generateImage(prompt)
} catch (error) {
  console.error('Generation failed:', error)

  // Try fallback
  if (config.referenceImage) {
    return await useReferenceImage(config.referenceImage)
  }

  // Or simplified prompt
  const simplified = simplifyPrompt(prompt)
  return await generateImage(simplified)
}
```

### 4. Monitor Usage

```typescript
usageTracker.trackGeneration('hd', '1024x1024')

const stats = usageTracker.getStats()
if (stats.totalCost > DAILY_BUDGET) {
  console.warn('Budget exceeded, switching to standard quality')
  USE_HD_QUALITY = false
}
```

### 5. Cache Aggressively

```typescript
const cacheKey = `image:${hashPrompt(prompt)}`
const cached = await cache.get(cacheKey)

if (cached) {
  return cached
}

const image = await generateImage(prompt)
await cache.set(cacheKey, image, { ttl: 86400 })  // 24 hours
```

---

## Troubleshooting

### Issue: Images have wrong pose

**Solution**: Strengthen pose instructions in prompt
```typescript
const STRONG_TPOSE_INSTRUCTION =
  "CRITICAL: Character standing in PERFECT T-POSE. " +
  "Arms MUST be stretched out HORIZONTALLY at exactly 90 degrees. " +
  "Hands EMPTY (no weapons). Legs slightly apart. Facing camera directly."
```

### Issue: Armor has mannequin inside

**Solution**: Add explicit exclusions
```typescript
const NO_MANNEQUIN_INSTRUCTION =
  "IMPORTANT: Show ONLY the armor piece floating in space. " +
  "NO body, NO mannequin, NO armor stand. " +
  "Completely hollow interior visible through openings."
```

### Issue: Inconsistent style

**Solution**: Be very explicit about style
```typescript
const STYLE_INSTRUCTION =
  "Art style: Low-poly RuneScape 2007 with under 500 polygons, " +
  "flat shading, vibrant saturated colors, chunky proportions, " +
  "early 2000s game aesthetic. NOT realistic, NOT high-poly."
```

### Issue: Generation too slow

**Solution**: Use standard quality in development
```typescript
const quality = isDevelopment ? 'standard' : 'hd'
```

---

## API Reference

### Functions

```typescript
async function generateImage(prompt: string): Promise<Buffer>
async function validateTPose(imageBuffer: Buffer): Promise<boolean>
async function detectArmorStand(imageBuffer: Buffer): Promise<boolean>
async function validateGeneratedImage(imageBuffer: Buffer, config: GenerationConfig): Promise<ValidationResult>
async function generateWithRetry(prompt: string, maxRetries?: number): Promise<Buffer>
```

### Types

```typescript
interface ImageGenerationRequest {
  model: 'gpt-image-1'
  prompt: string
  n?: number
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  response_format?: 'url' | 'b64_json'
  style?: 'natural' | 'vivid'
}

interface ValidationResult {
  isValid: boolean
  issues: string[]
  quality: number
}
```

---

## Next Steps

- [3D Conversion](./3d-conversion.md) - Convert images to 3D models with Meshy
- [Prompt Engineering](./prompt-engineering.md) - Optimize prompts for better results
- [Generation Pipeline](./generation-pipeline.md) - Complete pipeline overview

---

[← Back to Prompt Engineering](./prompt-engineering.md) | [Next: 3D Conversion →](./3d-conversion.md)
