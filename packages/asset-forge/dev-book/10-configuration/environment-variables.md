# Environment Variables

This comprehensive guide covers all environment variables used in Asset Forge, including frontend and backend configuration, API keys, server settings, and quality-specific configurations.

## Table of Contents

1. [Overview](#overview)
2. [Frontend Variables (VITE_ Prefix)](#frontend-variables-vite_-prefix)
3. [Backend Variables](#backend-variables)
4. [API Keys](#api-keys)
5. [Server Configuration](#server-configuration)
6. [Meshy API Configuration](#meshy-api-configuration)
7. [Quality-Specific Settings](#quality-specific-settings)
8. [Default Values](#default-values)
9. [Validation and Error Handling](#validation-and-error-handling)
10. [Environment Setup](#environment-setup)

---

## Overview

Asset Forge uses environment variables to configure both frontend and backend systems. The application follows Vite's environment variable conventions, requiring frontend variables to be prefixed with `VITE_`.

### Key Principles

- **Frontend variables** must use the `VITE_` prefix to be accessible in the client-side code
- **Backend variables** do not require a prefix and are used by Node.js server processes
- **Duplicate API keys** are needed for both frontend and backend operations
- **Optional variables** have sensible defaults and are clearly marked
- **Type safety** is enforced through runtime validation

### Configuration File

All environment variables are defined in a `.env` file in the package root:

```
/Users/home/hyperscape-1/packages/asset-forge/.env
```

A template is provided at `env.example` with all available options and default values.

---

## Frontend Variables (VITE_ Prefix)

Frontend variables are accessible in the browser and must be prefixed with `VITE_` to be included in the client bundle.

### VITE_OPENAI_API_KEY

**Type**: String (Required)
**Default**: None
**Purpose**: OpenAI API key for GPT-4 Vision and prompt enhancement

```bash
VITE_OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

This key is used for:
- GPT-4 Vision image analysis
- Prompt enhancement and optimization
- Weapon grip detection using vision models
- Base image regeneration suggestions

**Format**: Starts with `sk-proj-` or `sk-` followed by your API key.

**Security Note**: While this is client-side accessible, all sensitive operations should be proxied through your backend API.

### VITE_MESHY_API_KEY

**Type**: String (Required)
**Default**: None
**Purpose**: Meshy API key for 3D model generation and retexturing

```bash
VITE_MESHY_API_KEY=msy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

This key is used for:
- Image-to-3D model conversion
- Material retexturing operations
- Model refinement and topology optimization
- Avatar rigging preparation

**Format**: Starts with `msy_` followed by your API key.

**Usage Context**: Frontend code uses this for direct API calls to Meshy services when needed, though most operations are proxied through the backend.

### VITE_IMAGE_SERVER_URL

**Type**: URL (Required)
**Default**: `http://localhost:8081`
**Purpose**: Base URL for the image server that stores generated assets

```bash
VITE_IMAGE_SERVER_URL=http://localhost:8081
```

The image server serves:
- Generated concept art images
- 3D model files (GLB/GLTF)
- Sprite sheets and individual sprites
- Texture maps and material previews
- Temporary processing artifacts

**Development**: Points to local image server on port 8081
**Production**: Should point to CDN or cloud storage URL (S3, R2, etc.)

**Examples**:
```bash
# Local development
VITE_IMAGE_SERVER_URL=http://localhost:8081

# ngrok tunnel for testing
VITE_IMAGE_SERVER_URL=https://abc123.ngrok.io

# AWS S3
VITE_IMAGE_SERVER_URL=https://your-bucket.s3.amazonaws.com

# Cloudflare R2
VITE_IMAGE_SERVER_URL=https://your-bucket.r2.dev
```

### VITE_GENERATION_API_URL

**Type**: URL (Required)
**Default**: `http://localhost:3000/api`
**Purpose**: Base URL for the generation API server

```bash
VITE_GENERATION_API_URL=http://localhost:3004/api
```

The generation API handles:
- Asset creation pipelines
- Generation status polling
- Material preset retrieval
- Equipment configuration endpoints

**Port Note**: Default is 3004 to avoid conflicts with Hyperscape's API server which uses port 3001.

**Endpoint Structure**:
```
{VITE_GENERATION_API_URL}/generation          # POST: Start generation
{VITE_GENERATION_API_URL}/generation/status   # GET: Poll status
{VITE_GENERATION_API_URL}/material-presets    # GET: Fetch materials
```

### VITE_PIPELINE_POLL_INTERVAL_MS

**Type**: Integer (Optional)
**Default**: `1500` (1.5 seconds)
**Purpose**: Polling interval for checking generation pipeline status

```bash
VITE_PIPELINE_POLL_INTERVAL_MS=1500
```

Controls how frequently the frontend checks generation status:
- **Lower values** (500-1000ms): More responsive UI, higher server load
- **Default** (1500ms): Balanced responsiveness and efficiency
- **Higher values** (3000-5000ms): Reduced server load, slower updates

**Use Cases**:
```bash
# Fast updates during active development
VITE_PIPELINE_POLL_INTERVAL_MS=500

# Production with many concurrent users
VITE_PIPELINE_POLL_INTERVAL_MS=3000

# Low-bandwidth scenarios
VITE_PIPELINE_POLL_INTERVAL_MS=5000
```

**Implementation**: Used in `usePipelineStatus` hook to configure polling frequency.

### VITE_DEBUG_PIPELINE

**Type**: Boolean (Optional)
**Default**: `false`
**Purpose**: Enable detailed pipeline debugging logs in browser console

```bash
VITE_DEBUG_PIPELINE=true
```

When enabled, logs:
- Pipeline stage transitions
- API request/response details
- Status polling events
- Error stack traces
- Performance metrics

**Warning**: Generates significant console output. Only enable during development or troubleshooting.

**Usage**:
```typescript
const DEBUG = (import.meta as any).env?.VITE_DEBUG_PIPELINE === 'true'
if (DEBUG) {
  console.log('Pipeline stage changed:', stage)
}
```

---

## Backend Variables

Backend variables are used by Node.js server processes and do not require the `VITE_` prefix.

### OPENAI_API_KEY

**Type**: String (Required for server operations)
**Default**: None
**Purpose**: OpenAI API key for server-side GPT-4 operations

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Server-side usage:
- GPT-4 prompt enhancement before image generation
- Vision API for weapon grip detection
- T-pose validation for avatar generation
- Armor fitting prompt optimization

**Why Separate**: Backend operations need API keys that aren't exposed to the client. This prevents key leakage and enables rate limiting.

**Services Using This**:
- `GenerationService.mjs` - Prompt enhancement
- `RetextureService.mjs` - Material prompt optimization
- `api.mjs` - Vision API endpoints

### MESHY_API_KEY

**Type**: String (Required for server operations)
**Default**: None
**Purpose**: Meshy API key for server-side 3D generation

```bash
MESHY_API_KEY=msy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Server-side usage:
- Image-to-3D model generation
- Retexturing existing models
- Quality setting enforcement
- Model polling and status tracking

**Benefits of Server-Side**:
- Centralized rate limiting
- Usage tracking and analytics
- Error handling and retry logic
- Timeout management per quality tier

---

## API Keys

### API Key Requirements

Both OpenAI and Meshy API keys are required in **two locations**:

1. **Frontend** (`VITE_` prefixed) - For direct client operations
2. **Backend** (no prefix) - For server-proxied operations

### Obtaining API Keys

#### OpenAI API Key

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Navigate to API Keys section
3. Create new secret key
4. Copy key starting with `sk-proj-` or `sk-`
5. Add billing information (pay-as-you-go)

**Models Used**:
- GPT-4 Vision (`gpt-4-vision-preview`)
- GPT-4 Turbo (`gpt-4-turbo-preview`)

#### Meshy API Key

1. Sign up at [meshy.ai](https://www.meshy.ai)
2. Access API settings
3. Generate new API key
4. Copy key starting with `msy_`
5. Choose appropriate pricing tier

**Models Used**:
- meshy-5 (default for all quality tiers)
- Configurable per quality level

### API Key Security

**Best Practices**:
```bash
# ✅ Good - API keys in .env file
VITE_OPENAI_API_KEY=sk-proj-xxx
OPENAI_API_KEY=sk-proj-xxx

# ❌ Bad - API keys in source code
const apiKey = 'sk-proj-xxx' // NEVER DO THIS

# ✅ Good - Access via environment
const apiKey = process.env.OPENAI_API_KEY

# ✅ Good - Type-safe access
interface ImportMetaEnv {
  VITE_OPENAI_API_KEY: string
}
```

**Git Ignore**:
```gitignore
.env
.env.local
.env.*.local
```

**Validation**:
```javascript
// Server startup validation
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not found - some features will fail')
}
if (!process.env.MESHY_API_KEY) {
  console.warn('⚠️ MESHY_API_KEY not found - retexturing will fail')
}
```

---

## Server Configuration

### API_PORT

**Type**: Integer (Optional)
**Default**: `3004`
**Purpose**: Port for the main API server

```bash
API_PORT=3004
```

The API server handles:
- Generation pipeline orchestration
- Asset CRUD operations
- Material preset management
- Equipment configuration

**Port Selection**:
- Default `3004` avoids conflict with Hyperscape (3001)
- Must be different from IMAGE_SERVER_PORT
- Should be > 1024 for non-privileged access

**Override at Runtime**:
```bash
API_PORT=3005 npm run dev
```

### IMAGE_SERVER_PORT

**Type**: Integer (Optional)
**Default**: `8081`
**Purpose**: Port for the static file image server

```bash
IMAGE_SERVER_PORT=8081
```

The image server provides:
- Static file serving for generated assets
- CORS-enabled access to 3D models
- Image thumbnails and previews
- Health check endpoint

**Port Selection**:
- Default `8081` avoids conflict with Hyperscape (8080)
- Must be different from API_PORT
- Requires CORS configuration for frontend access

**Health Check**:
```bash
curl http://localhost:8081/health
# Response: {"status":"healthy","uptime":123.45}
```

---

## Meshy API Configuration

### MESHY_POLL_INTERVAL_MS

**Type**: Integer (Optional)
**Default**: `5000` (5 seconds)
**Purpose**: Polling interval for checking Meshy task status

```bash
MESHY_POLL_INTERVAL_MS=5000
```

Meshy 3D generation is asynchronous. The server polls to check completion:

**Polling Flow**:
1. Submit image-to-3D task to Meshy
2. Receive task ID
3. Poll status every `MESHY_POLL_INTERVAL_MS`
4. Continue until completed or timeout

**Optimization**:
```bash
# Fast polling for development
MESHY_POLL_INTERVAL_MS=2000

# Standard production
MESHY_POLL_INTERVAL_MS=5000

# Conservative (reduce API calls)
MESHY_POLL_INTERVAL_MS=10000
```

**Cost Considerations**: Lower intervals increase API call volume. Meshy charges per request, so balance responsiveness with cost.

### MESHY_TIMEOUT_MS

**Type**: Integer (Optional)
**Default**: `900000` (15 minutes)
**Purpose**: Global timeout for Meshy operations

```bash
MESHY_TIMEOUT_MS=900000
```

Maximum time to wait for any Meshy task before failing:

**Timeout Scenarios**:
- Task stuck in queue
- Generation taking longer than expected
- API connectivity issues
- Server-side processing delays

**Recommended Values**:
```bash
# Standard quality (faster)
MESHY_TIMEOUT_MS=600000  # 10 minutes

# High quality
MESHY_TIMEOUT_MS=1200000  # 20 minutes

# Ultra quality
MESHY_TIMEOUT_MS=1800000  # 30 minutes
```

**Override Priority**: Quality-specific timeouts (below) override this global value.

---

## Quality-Specific Settings

Asset Forge supports three quality tiers with different performance characteristics. Each tier can have custom timeout and model settings.

### Quality Tiers Overview

| Quality | Polygons | Resolution | Rigging | Timeout | Use Case |
|---------|----------|------------|---------|---------|----------|
| Standard | 6,000 | 1024px | No | 10 min | Placeholder/testing |
| High | 12,000 | 2048px | Yes | 20 min | Production assets |
| Ultra | 20,000 | 4096px | Yes | 30 min | Hero assets |

### MESHY_TIMEOUT_STANDARD_MS

**Type**: Integer (Optional)
**Default**: `600000` (10 minutes)
**Purpose**: Timeout for standard quality generation

```bash
MESHY_TIMEOUT_STANDARD_MS=600000
```

Standard quality characteristics:
- Fastest generation time
- Lower polygon count (6,000 tris)
- 1024px texture resolution
- No automatic rigging
- Best for rapid prototyping

### MESHY_TIMEOUT_HIGH_MS

**Type**: Integer (Optional)
**Default**: `1200000` (20 minutes)
**Purpose**: Timeout for high quality generation

```bash
MESHY_TIMEOUT_HIGH_MS=1200000
```

High quality characteristics:
- Balanced generation time
- Medium polygon count (12,000 tris)
- 2048px texture resolution
- Automatic rigging support
- Best for production assets

### MESHY_TIMEOUT_ULTRA_MS

**Type**: Integer (Optional)
**Default**: `1800000` (30 minutes)
**Purpose**: Timeout for ultra quality generation

```bash
MESHY_TIMEOUT_ULTRA_MS=1800000
```

Ultra quality characteristics:
- Longest generation time
- Highest polygon count (20,000 tris)
- 4096px texture resolution
- Advanced rigging support
- Best for hero assets and closeups

### Quality Model Selection

Each quality tier can use a different Meshy AI model.

#### MESHY_MODEL_DEFAULT

**Type**: String (Optional)
**Default**: `meshy-5`
**Purpose**: Fallback model when no quality-specific model is set

```bash
MESHY_MODEL_DEFAULT=meshy-5
```

#### MESHY_MODEL_STANDARD

**Type**: String (Optional)
**Default**: Inherits from `MESHY_MODEL_DEFAULT`
**Purpose**: Model for standard quality generation

```bash
MESHY_MODEL_STANDARD=meshy-5
```

#### MESHY_MODEL_HIGH

**Type**: String (Optional)
**Default**: Inherits from `MESHY_MODEL_DEFAULT`
**Purpose**: Model for high quality generation

```bash
MESHY_MODEL_HIGH=meshy-5
```

#### MESHY_MODEL_ULTRA

**Type**: String (Optional)
**Default**: Inherits from `MESHY_MODEL_DEFAULT`
**Purpose**: Model for ultra quality generation

```bash
MESHY_MODEL_ULTRA=meshy-5
```

**Model Selection Logic**:
```javascript
const qualityUpper = quality.toUpperCase() // 'STANDARD' | 'HIGH' | 'ULTRA'
const aiModelEnv = process.env[`MESHY_MODEL_${qualityUpper}`]
                   || process.env.MESHY_MODEL_DEFAULT
const aiModel = aiModelEnv || 'meshy-5'
```

**Available Models**: Check Meshy documentation for current model versions. As of writing, `meshy-5` is the latest and most capable model.

---

## Default Values

### Complete Default Configuration

```bash
# Frontend Variables
VITE_OPENAI_API_KEY=                          # Required - no default
VITE_MESHY_API_KEY=                           # Required - no default
VITE_IMAGE_SERVER_URL=http://localhost:8081   # Default: local
VITE_GENERATION_API_URL=http://localhost:3004/api  # Default: local
VITE_PIPELINE_POLL_INTERVAL_MS=1500           # Default: 1.5 seconds
VITE_DEBUG_PIPELINE=false                     # Default: disabled

# Backend Variables
OPENAI_API_KEY=                               # Required - no default
MESHY_API_KEY=                                # Required - no default

# Server Configuration
API_PORT=3004                                 # Default: 3004
IMAGE_SERVER_PORT=8081                        # Default: 8081

# Meshy Configuration
MESHY_POLL_INTERVAL_MS=5000                   # Default: 5 seconds
MESHY_TIMEOUT_MS=900000                       # Default: 15 minutes

# Quality-Specific Timeouts
MESHY_TIMEOUT_STANDARD_MS=600000              # Default: 10 minutes
MESHY_TIMEOUT_HIGH_MS=1200000                 # Default: 20 minutes
MESHY_TIMEOUT_ULTRA_MS=1800000                # Default: 30 minutes

# Model Selection
MESHY_MODEL_DEFAULT=meshy-5                   # Default: meshy-5
MESHY_MODEL_STANDARD=meshy-5                  # Default: inherits
MESHY_MODEL_HIGH=meshy-5                      # Default: inherits
MESHY_MODEL_ULTRA=meshy-5                     # Default: inherits
```

### Fallback Behavior

When environment variables are not set:

**Required Variables**: Application warns but continues with degraded functionality
```javascript
if (!process.env.MESHY_API_KEY) {
  console.warn('⚠️ MESHY_API_KEY not found - retexturing will fail')
}
```

**Optional Variables**: Use sensible defaults
```javascript
const PORT = process.env.API_PORT || 3004
```

**Type Conversion**: String environment variables are parsed appropriately
```javascript
const pollIntervalMs = parseInt(process.env.MESHY_POLL_INTERVAL_MS || '5000', 10)
const timeoutMs = parseInt(
  process.env[`MESHY_TIMEOUT_${quality}_MS`] ||
  process.env.MESHY_TIMEOUT_MS ||
  '300000',
  10
)
```

---

## Validation and Error Handling

### Startup Validation

On server startup, the application validates critical environment variables:

```javascript
// Health check endpoint response
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "meshy": true,        // MESHY_API_KEY present
    "openai": true        // OPENAI_API_KEY present
  }
}
```

**Console Warnings**:
```
🚀 API Server running on http://localhost:3004
📊 Health check: http://localhost:3004/api/health
⚠️  MESHY_API_KEY not found - retexturing will fail
⚠️  OPENAI_API_KEY not found - base regeneration will fail
```

### Runtime Validation

Before performing operations requiring API keys:

```javascript
// Retexturing check
if (!this.meshyApiKey) {
  throw new Error('MESHY_API_KEY is required for retexturing')
}

// GPT-4 enhancement check
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY required for GPT-4 enhancement')
}

// Combined check
if (!this.meshyApiKey || !process.env.OPENAI_API_KEY) {
  throw new Error('MESHY_API_KEY and OPENAI_API_KEY are required for base regeneration')
}
```

### Type Safety

TypeScript interfaces ensure type-safe environment access:

```typescript
// Frontend type definitions
interface ImportMetaEnv {
  VITE_GENERATION_API_URL?: string
  VITE_OPENAI_API_KEY?: string
  VITE_MESHY_API_KEY?: string
  VITE_IMAGE_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

**Usage**:
```typescript
const envApiUrl = (import.meta as ExtendedImportMeta).env?.VITE_GENERATION_API_URL
const DEBUG = (import.meta as any).env?.VITE_DEBUG_PIPELINE === 'true'
```

---

## Environment Setup

### Local Development Setup

1. **Copy Example File**:
```bash
cd packages/asset-forge
cp env.example .env
```

2. **Add API Keys**:
```bash
# Edit .env and add your keys
VITE_OPENAI_API_KEY=sk-proj-your-key-here
VITE_MESHY_API_KEY=msy_your-key-here
OPENAI_API_KEY=sk-proj-your-key-here
MESHY_API_KEY=msy_your-key-here
```

3. **Verify Configuration**:
```bash
# Start servers
npm run dev

# Check health endpoint
curl http://localhost:3004/api/health

# Expected output:
# {
#   "status": "healthy",
#   "services": {
#     "meshy": true,
#     "openai": true
#   }
# }
```

### Production Deployment

1. **Set Environment Variables** via your hosting platform's dashboard or CLI

2. **Update Server URLs**:
```bash
VITE_IMAGE_SERVER_URL=https://your-cdn.com
VITE_GENERATION_API_URL=https://api.your-domain.com/api
```

3. **Adjust Timeouts** for production load:
```bash
MESHY_POLL_INTERVAL_MS=5000
MESHY_TIMEOUT_STANDARD_MS=900000
MESHY_TIMEOUT_HIGH_MS=1800000
MESHY_TIMEOUT_ULTRA_MS=2400000
```

### Multiple Environments

Use separate `.env` files for different environments:

```bash
.env.development    # Local development
.env.staging        # Staging server
.env.production     # Production server
```

**Load Specific Environment**:
```bash
NODE_ENV=production npm run build
```

### Docker Configuration

When using Docker, pass environment variables via docker-compose:

```yaml
services:
  asset-forge:
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MESHY_API_KEY=${MESHY_API_KEY}
      - API_PORT=3004
      - IMAGE_SERVER_PORT=8081
    env_file:
      - .env
```

### Environment Variable Precedence

1. System environment variables (highest priority)
2. `.env.local` file
3. `.env` file
4. Code defaults (lowest priority)

---

## Troubleshooting

### Common Issues

**Issue**: Frontend can't access API keys
```
Solution: Ensure keys are prefixed with VITE_
✅ VITE_OPENAI_API_KEY=sk-proj-xxx
❌ OPENAI_API_KEY=sk-proj-xxx (backend only)
```

**Issue**: Generation fails with "API key not found"
```
Solution: Check both frontend and backend keys are set
Required:
- VITE_MESHY_API_KEY (frontend)
- MESHY_API_KEY (backend)
```

**Issue**: Timeouts occur too quickly
```
Solution: Increase quality-specific timeout
MESHY_TIMEOUT_ULTRA_MS=2400000  # 40 minutes
```

**Issue**: Port already in use
```
Solution: Change port numbers
API_PORT=3005
IMAGE_SERVER_PORT=8082
```

### Debug Mode

Enable comprehensive logging:

```bash
VITE_DEBUG_PIPELINE=true
NODE_ENV=development
```

Check server logs for:
- Environment variable loading
- API key validation
- Service initialization
- Request/response details

---

## Summary

Environment variables in Asset Forge provide flexible configuration for:

- **API Integration**: OpenAI and Meshy API keys
- **Server Configuration**: Ports and URLs
- **Performance Tuning**: Timeouts and polling intervals
- **Quality Control**: Per-tier settings and models
- **Debug Support**: Detailed logging options

**Best Practices**:
1. Never commit `.env` files to version control
2. Use `.env.example` as a template
3. Set required variables before starting servers
4. Validate configuration via health check endpoint
5. Adjust timeouts based on quality tier usage
6. Monitor API usage and costs
7. Use separate keys for development and production

**Quick Reference**:
```bash
# Minimal working configuration
VITE_OPENAI_API_KEY=sk-proj-xxx
VITE_MESHY_API_KEY=msy_xxx
OPENAI_API_KEY=sk-proj-xxx
MESHY_API_KEY=msy_xxx

# All other variables have sensible defaults
```
