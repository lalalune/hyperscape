# Configuration Guide

[← Back to Index](../README.md)

---

## Overview

Asset Forge uses environment variables for configuration, allowing you to customize API integrations, server ports, timeouts, and generation behavior. This guide covers all configuration options, from basic API key setup to advanced customization.

**What you'll learn:**
- How to configure all environment variables
- Setting up development vs production environments
- Customizing material presets and prompt templates
- Optimizing timeouts and polling intervals
- Troubleshooting configuration issues

---

## Environment Variables

Asset Forge uses environment variables stored in a `.env` file. The application uses two different prefixes:
- **`VITE_`** prefix for frontend (client-side) variables
- **No prefix** for backend (server-side) variables

### Creating Your .env File

If you haven't already during installation, create your `.env` file:

```bash
cd packages/asset-forge
cp env.example .env
```

Then edit `.env` with your preferred text editor:

```bash
# Using nano
nano .env

# Using vim
vim .env

# Using VS Code
code .env
```

---

## Required Configuration

### OpenAI API Key

**Purpose**: Powers GPT-4 prompt enhancement, DALL-E image generation, and grip detection for hand rigging.

**Getting your key:**
1. Visit [platform.openai.com](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API keys section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

**Configuration:**
```bash
# Frontend - for client-side API calls
VITE_OPENAI_API_KEY=sk-your-openai-key-here

# Backend - for server-side API calls
OPENAI_API_KEY=sk-your-openai-key-here
```

**Important:**
- Both frontend and backend keys are needed
- Use the same key value for both
- Never commit your `.env` file to git
- Key format: `sk-proj-...` or `sk-...`

**Models Used:**
- `gpt-image-1` - Image generation (DALL-E 3)
- `gpt-4` - Prompt enhancement
- `gpt-4o-mini` - Grip detection (faster, cheaper)

**Cost Estimates:**
- Image generation: ~$0.04 per image
- GPT-4 enhancement: ~$0.01 per prompt
- Grip detection: ~$0.001 per analysis

### Meshy API Key

**Purpose**: Converts 2D images to 3D models, handles retexturing, and provides rigging capabilities.

**Getting your key:**
1. Visit [meshy.ai](https://www.meshy.ai/)
2. Sign up for an account
3. Go to API section in dashboard
4. Click "Generate API Key"
5. Copy the key

**Configuration:**
```bash
# Frontend
VITE_MESHY_API_KEY=msy_your-meshy-key-here

# Backend
MESHY_API_KEY=msy_your-meshy-key-here
```

**Plans:**
- **Free Tier**: 100 credits (limited, good for testing)
- **Pro Plan**: $10/month minimum (recommended for development)
- **Enterprise**: Custom pricing

**Credit Costs:**
- Image-to-3D Standard: 5 credits
- Image-to-3D High: 10 credits
- Image-to-3D Ultra: 20 credits
- Retexture: 5 credits per variant
- Rigging: 10 credits

**100 credits = $10 USD**

---

## Server Configuration

### API Server Port

**Purpose**: Sets the port for the backend API server.

```bash
API_PORT=3004
```

**Default**: 3004

**Why 3004?**
- Port 3001 is used by Hyperscape core
- Port 3000 is used by Vite frontend
- Port 3004 avoids conflicts

**Custom Port:**
```bash
# Use a different port
API_PORT=3005

# Then update frontend proxy in vite.config.ts
# OR set the API URL:
VITE_GENERATION_API_URL=http://localhost:3005/api
```

### Image Server Port

**Purpose**: Sets the port for the local image hosting server.

```bash
IMAGE_SERVER_PORT=8081
```

**Default**: 8081

**Why 8081?**
- Port 8080 is used by Hyperscape core
- Port 8081 avoids conflicts

**Custom Port:**
```bash
# Use a different port
IMAGE_SERVER_PORT=8082

# Then update the image server URL
IMAGE_SERVER_URL=http://localhost:8082
VITE_IMAGE_SERVER_URL=http://localhost:8082
```

### Image Server URL

**Purpose**: Publicly accessible URL where Meshy can download generated images.

```bash
# Local development (not accessible to Meshy)
IMAGE_SERVER_URL=http://localhost:8081
VITE_IMAGE_SERVER_URL=http://localhost:8081

# With ngrok (recommended for development)
IMAGE_SERVER_URL=https://abc123.ngrok.io
VITE_IMAGE_SERVER_URL=https://abc123.ngrok.io

# Production (cloud storage)
IMAGE_SERVER_URL=https://your-bucket.s3.amazonaws.com
VITE_IMAGE_SERVER_URL=https://your-bucket.s3.amazonaws.com
```

**Important:**
- Meshy.ai requires **publicly accessible HTTPS URLs**
- Local `localhost` URLs will **not work** for Meshy
- Use ngrok for development
- Use cloud storage for production

**Setting up ngrok:**
```bash
# Install ngrok
npm install -g ngrok

# Start image server
npm run dev:images

# In another terminal, start ngrok
ngrok http 8081

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update .env with this URL
```

### Generation API URL

**Purpose**: Frontend API endpoint for generation requests.

```bash
VITE_GENERATION_API_URL=http://localhost:3004/api
```

**Default**: `http://localhost:3004/api`

**Custom Configuration:**
```bash
# Development
VITE_GENERATION_API_URL=http://localhost:3004/api

# Production
VITE_GENERATION_API_URL=https://api.yourdomain.com/api

# Custom port
VITE_GENERATION_API_URL=http://localhost:3005/api
```

---

## Meshy Configuration

### Polling Interval

**Purpose**: How often to check Meshy task status (in milliseconds).

```bash
MESHY_POLL_INTERVAL_MS=5000
```

**Default**: 5000 (5 seconds)

**Recommendations:**
- **Fast**: 3000ms (3 seconds) - More API calls, faster updates
- **Balanced**: 5000ms (5 seconds) - Default
- **Slow**: 10000ms (10 seconds) - Fewer API calls, slower updates

**Trade-offs:**
- Lower values = More responsive, more API calls
- Higher values = Fewer API calls, less responsive

**Example:**
```bash
# Check every 3 seconds (more responsive)
MESHY_POLL_INTERVAL_MS=3000

# Check every 10 seconds (fewer API calls)
MESHY_POLL_INTERVAL_MS=10000
```

### Default Timeout

**Purpose**: Overall timeout for Meshy tasks (in milliseconds).

```bash
MESHY_TIMEOUT_MS=900000
```

**Default**: 900000 (15 minutes)

**Use Cases:**
- Standard quality: Usually completes in 2-4 minutes
- High quality: Usually completes in 5-8 minutes
- Ultra quality: Can take 10-20 minutes

**Recommendations:**
```bash
# Conservative (recommended)
MESHY_TIMEOUT_MS=900000  # 15 minutes

# Extended for ultra quality
MESHY_TIMEOUT_MS=1800000  # 30 minutes

# Short for testing
MESHY_TIMEOUT_MS=300000  # 5 minutes
```

### Quality-Specific Timeouts

**Purpose**: Different timeouts for different quality levels.

```bash
# Standard quality (fast)
MESHY_TIMEOUT_STANDARD_MS=600000  # 10 minutes

# High quality (balanced)
MESHY_TIMEOUT_HIGH_MS=1200000  # 20 minutes

# Ultra quality (slow)
MESHY_TIMEOUT_ULTRA_MS=1800000  # 30 minutes
```

**How it works:**
- If quality-specific timeout is set, it overrides `MESHY_TIMEOUT_MS`
- If not set, falls back to `MESHY_TIMEOUT_MS`
- Prevents standard quality tasks from waiting too long
- Allows ultra quality tasks more time

**Example Configuration:**
```bash
# Different timeouts for each quality
MESHY_TIMEOUT_STANDARD_MS=300000   # 5 minutes - standard is fast
MESHY_TIMEOUT_HIGH_MS=900000       # 15 minutes - high needs more time
MESHY_TIMEOUT_ULTRA_MS=1800000     # 30 minutes - ultra needs even more
```

### Meshy Model Selection

**Purpose**: Choose which Meshy AI model to use for 3D generation.

```bash
# Default model for all qualities
MESHY_MODEL_DEFAULT=meshy-5

# Per-quality model overrides (optional)
MESHY_MODEL_STANDARD=meshy-5
MESHY_MODEL_HIGH=meshy-5
MESHY_MODEL_ULTRA=meshy-5
```

**Available Models:**
- `meshy-4` - Previous generation (faster, lower quality)
- `meshy-5` - Latest model (slower, higher quality)

**Recommendations:**
```bash
# Use meshy-5 for all (recommended)
MESHY_MODEL_DEFAULT=meshy-5

# Mix models for speed vs quality trade-off
MESHY_MODEL_STANDARD=meshy-4  # Fast for prototypes
MESHY_MODEL_HIGH=meshy-5      # Quality for production
MESHY_MODEL_ULTRA=meshy-5     # Best quality
```

---

## Optional Configuration

### Frontend Environment

**Purpose**: Specify deployment environment.

```bash
NODE_ENV=development  # or 'production'
```

**Values:**
- `development` - Development mode (verbose logging, debug tools)
- `production` - Production mode (optimized, minimal logging)

**Auto-set by:**
- `npm run dev` → `development`
- `npm run build` → `production`

### Pipeline Poll Interval

**Purpose**: How often the frontend checks pipeline status (in milliseconds).

```bash
VITE_PIPELINE_POLL_INTERVAL_MS=1500
```

**Default**: 1500 (1.5 seconds)

**Recommendations:**
- **Fast**: 1000ms (1 second) - Very responsive
- **Balanced**: 1500ms (1.5 seconds) - Default
- **Slow**: 3000ms (3 seconds) - Less network traffic

### Pipeline Debug Mode

**Purpose**: Enable verbose logging for pipeline debugging.

```bash
VITE_DEBUG_PIPELINE=false
```

**Values:**
- `true` - Enable debug logging
- `false` - Normal logging (default)

**When enabled:**
- Logs all state changes
- Logs all API calls
- Logs all pipeline events
- Logs timing information

**Example:**
```bash
# Enable for debugging
VITE_DEBUG_PIPELINE=true

# Check browser console for logs
```

### Imgur Integration

**Purpose**: Optional image hosting via Imgur (alternative to ngrok).

```bash
IMGUR_CLIENT_ID=your-imgur-client-id
```

**Getting Imgur Client ID:**
1. Visit [https://api.imgur.com/oauth2/addclient](https://api.imgur.com/oauth2/addclient)
2. Register application (select "OAuth 2 authorization without a callback URL")
3. Copy Client ID
4. Add to `.env`

**When to use:**
- Don't want to use ngrok
- Need simple image hosting
- Free tier is sufficient

**Limitations:**
- 12,500 uploads per day
- 500 uploads per hour
- Images are public
- May be slower than cloud storage

### Frontend URL (Production)

**Purpose**: Set allowed origin for CORS in production.

```bash
FRONTEND_URL=https://asset-forge.yourdomain.com
```

**Development:**
- Auto-detected from request origin
- Usually `http://localhost:3000`

**Production:**
- Set this to your frontend domain
- Required for CORS to work properly

---

## Material Presets Customization

Material presets define the available materials for retexturing. They're stored in `/public/prompts/material-presets.json`.

### Viewing Current Presets

```bash
cat packages/asset-forge/public/prompts/material-presets.json
```

### Preset Structure

Each preset has the following fields:

```json
{
  "id": "bronze",
  "name": "bronze",
  "displayName": "Bronze",
  "category": "metal",
  "tier": 1,
  "color": "#CD7F32",
  "stylePrompt": "bronze metal texture, copper brown color, slightly dull metallic finish, RuneScape 2007 style",
  "description": "Basic copper-brown metal, entry-level equipment"
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (kebab-case) |
| `name` | string | Internal name (lowercase) |
| `displayName` | string | UI display name |
| `category` | string | Material category (metal, leather, wood, custom) |
| `tier` | number | Quality tier (1-10) |
| `color` | string | Hex color for UI display |
| `stylePrompt` | string | AI prompt for retexturing |
| `description` | string | Human-readable description |

### Adding Custom Materials

**1. Edit the JSON file:**

```bash
nano packages/asset-forge/public/prompts/material-presets.json
```

**2. Add your material:**

```json
{
  "id": "obsidian",
  "name": "obsidian",
  "displayName": "Obsidian",
  "category": "custom",
  "tier": 8,
  "color": "#0A0A0A",
  "stylePrompt": "black obsidian texture, volcanic glass, glossy reflective surface with subtle purple highlights, fantasy style",
  "description": "Rare volcanic glass, extremely sharp and dark"
}
```

**3. Restart the server:**

```bash
npm run dev
```

**4. Test your material:**
- Generate or upload an asset
- Go to Material Variants
- Select your new material
- Start retexture

### Material Categories

Available categories:

| Category | Description | Examples |
|----------|-------------|----------|
| `metal` | Metallic materials | Bronze, steel, mithril |
| `leather` | Leather and hide | Leather, hard leather |
| `wood` | Wood types | Oak, willow, pine |
| `custom` | Special materials | Dragon, obsidian, crystal |

### Writing Good Style Prompts

**Good:**
```
"bronze metal texture, copper brown color, slightly dull metallic finish,
 worn edges, low-poly game-ready style, visible texture detail"
```

**Bad:**
```
"bronze" ❌ Too vague
"the most amazing bronze texture ever made" ❌ Too flowery
"bronze metal texture with intricate Celtic patterns and runes" ❌ Too specific
```

**Best Practices:**
- Specify texture type (metal, leather, wood)
- Mention color explicitly
- Describe finish (matte, glossy, worn)
- Include style reference (game-ready, fantasy, realistic)
- Keep it 1-2 sentences
- Avoid overly complex details

---

## Prompt Template Customization

Prompt templates control how AI generates images and enhances descriptions. They're stored in `/public/prompts/`.

### Available Prompt Templates

```bash
/public/prompts/
├── generation-prompts.json       # Image generation prompts
├── gpt4-enhancement-prompts.json # Description enhancement
├── material-prompts.json         # Material retexturing
├── weapon-detection-prompts.json # Grip detection
├── asset-type-prompts.json       # Asset-specific prompts
└── game-style-prompts.json       # Game style prompts
```

### Image Generation Prompts

**File:** `/public/prompts/generation-prompts.json`

**Structure:**
```json
{
  "imageGeneration": {
    "base": "${description}. ${style || 'game-ready'} style, ${assetType}, clean geometry suitable for 3D conversion."
  }
}
```

**Template Variables:**
- `${description}` - User-provided description
- `${style}` - Selected game style
- `${assetType}` - Asset type (weapon, armor, etc.)

**Customization Example:**
```json
{
  "imageGeneration": {
    "base": "${description}. Rendered in ${style || 'game-ready'} art style, ${assetType} design, optimized for 3D scanning, clean white background, studio lighting, centered composition, high detail."
  }
}
```

### GPT-4 Enhancement Prompts

**File:** `/public/prompts/gpt4-enhancement-prompts.json`

**Purpose:** Enhances user descriptions before image generation.

**Example Customization:**
```json
{
  "enhancement": {
    "system": "You are an expert at writing prompts for 3D asset generation.",
    "userTemplate": "Enhance this description for ${assetType}: ${description}. Style: ${style}. Output only the enhanced description, no explanation."
  }
}
```

### Weapon Detection Prompts

**File:** `/public/prompts/weapon-detection-prompts.json`

**Purpose:** Controls how GPT-4 Vision detects weapon grip areas.

**Structure:**
```json
{
  "basePrompt": "You are analyzing a 3D weapon...",
  "additionalGuidance": "Additional guidance: ${promptHint}",
  "restrictions": "DO NOT select: ...",
  "responseFormat": "Respond with JSON: ..."
}
```

**When to customize:**
- Grip detection is inaccurate
- Need to support new weapon types
- Want different bounding box behavior

---

## Configuration Validation

### Checking Your Configuration

**1. Start the servers:**
```bash
npm run dev
```

**2. Check backend health:**
```bash
curl http://localhost:3004/api/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-21T12:34:56.789Z",
  "services": {
    "meshy": true,
    "openai": true
  }
}
```

**3. Check for warnings:**
```
🚀 API Server running on http://localhost:3004
📊 Health check: http://localhost:3004/api/health
```

**If API keys are missing:**
```
⚠️  MESHY_API_KEY not found - retexturing will fail
⚠️  OPENAI_API_KEY not found - base regeneration will fail
```

### Validating API Keys

**Test OpenAI:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Should return:** List of available models

**Test Meshy:**
```bash
curl https://api.meshy.ai/openapi/v1/image-to-3d \
  -H "Authorization: Bearer $MESHY_API_KEY"
```

**Should return:** 400 error (missing parameters, but auth works)

### Environment-Specific Configuration

**Development (.env.development):**
```bash
# Development-specific settings
NODE_ENV=development
VITE_DEBUG_PIPELINE=true
API_PORT=3004
IMAGE_SERVER_PORT=8081
MESHY_TIMEOUT_MS=600000
```

**Production (.env.production):**
```bash
# Production settings
NODE_ENV=production
VITE_DEBUG_PIPELINE=false
API_PORT=3004
IMAGE_SERVER_PORT=8081
MESHY_TIMEOUT_MS=1800000
FRONTEND_URL=https://asset-forge.yourdomain.com
```

**Load specific config:**
```bash
# Development
cp .env.development .env
npm run dev

# Production
cp .env.production .env
npm run build
npm run start
```

---

## Common Configuration Issues

### Issue: API Keys Not Working

**Symptoms:**
- "Invalid API key" errors
- Generation fails immediately
- 401 Unauthorized responses

**Solutions:**

**1. Check key format:**
```bash
# OpenAI should start with sk-
echo $VITE_OPENAI_API_KEY | grep "^sk-"

# Meshy should start with msy_
echo $VITE_MESHY_API_KEY | grep "^msy_"
```

**2. Check for whitespace:**
```bash
# Keys should have no leading/trailing spaces
VITE_OPENAI_API_KEY=sk-abc123  # ✅ Correct
VITE_OPENAI_API_KEY= sk-abc123 # ❌ Leading space
VITE_OPENAI_API_KEY=sk-abc123  # ❌ Trailing space
```

**3. Restart servers after changing .env:**
```bash
# Stop servers (Ctrl+C)
npm run dev
```

**4. Check both prefixes:**
```bash
# Both needed
VITE_OPENAI_API_KEY=sk-...  # Frontend
OPENAI_API_KEY=sk-...       # Backend
```

### Issue: Port Already in Use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3004
```

**Solutions:**

**1. Find what's using the port:**
```bash
lsof -i :3004
```

**2. Kill the process:**
```bash
kill -9 <PID>
```

**3. Or use a different port:**
```bash
API_PORT=3005 npm run dev
```

### Issue: Image Server Not Accessible

**Symptoms:**
- "Failed to fetch image" errors
- Meshy can't access images
- Generation fails at image-to-3D stage

**Solutions:**

**1. For development, use ngrok:**
```bash
# Terminal 1: Start image server
npm run dev:images

# Terminal 2: Start ngrok
ngrok http 8081

# Terminal 3: Update .env and restart
IMAGE_SERVER_URL=https://abc123.ngrok.io
VITE_IMAGE_SERVER_URL=https://abc123.ngrok.io
npm run dev
```

**2. Verify image server is running:**
```bash
curl http://localhost:8081
```

**3. Test public accessibility:**
```bash
curl https://abc123.ngrok.io
```

### Issue: Timeout Too Short

**Symptoms:**
- "Meshy task timeout" errors
- Generation fails after X minutes
- Ultra quality never completes

**Solutions:**

```bash
# Increase timeout
MESHY_TIMEOUT_MS=1800000  # 30 minutes

# Or use quality-specific timeouts
MESHY_TIMEOUT_ULTRA_MS=2400000  # 40 minutes for ultra
```

### Issue: CORS Errors

**Symptoms:**
```
Access to fetch at 'http://localhost:3004/api/...'
from origin 'http://localhost:3000' has been blocked by CORS
```

**Solutions:**

**1. Check server is running:**
```bash
curl http://localhost:3004/api/health
```

**2. Verify proxy configuration:**
```typescript
// vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:3004',
      changeOrigin: true,
    }
  }
}
```

**3. For production, set FRONTEND_URL:**
```bash
FRONTEND_URL=https://your-frontend-domain.com
```

### Issue: Material Presets Not Loading

**Symptoms:**
- Empty material dropdown
- "Failed to load presets" error

**Solutions:**

**1. Verify file exists:**
```bash
ls -la packages/asset-forge/public/prompts/material-presets.json
```

**2. Validate JSON:**
```bash
cat packages/asset-forge/public/prompts/material-presets.json | jq .
```

**3. Check file permissions:**
```bash
chmod 644 packages/asset-forge/public/prompts/material-presets.json
```

**4. Restart server:**
```bash
npm run dev
```

---

## Best Practices

### Security

**DO:**
- ✅ Keep `.env` out of git (check `.gitignore`)
- ✅ Use environment variables for all secrets
- ✅ Rotate API keys periodically
- ✅ Use separate keys for dev/prod
- ✅ Set up billing alerts on OpenAI/Meshy

**DON'T:**
- ❌ Commit `.env` to version control
- ❌ Hardcode API keys in source code
- ❌ Share API keys in public channels
- ❌ Use production keys in development
- ❌ Store keys in frontend-only variables

### Performance

**Optimize for cost:**
```bash
# Use longer poll intervals (fewer API calls)
MESHY_POLL_INTERVAL_MS=10000

# Use shorter timeouts (don't wait forever)
MESHY_TIMEOUT_STANDARD_MS=300000
```

**Optimize for speed:**
```bash
# Use shorter poll intervals (faster updates)
MESHY_POLL_INTERVAL_MS=3000

# Use longer timeouts (don't timeout prematurely)
MESHY_TIMEOUT_ULTRA_MS=1800000
```

### Monitoring

**1. Enable debug mode during development:**
```bash
VITE_DEBUG_PIPELINE=true
```

**2. Monitor API usage:**
- OpenAI: [platform.openai.com/usage](https://platform.openai.com/usage)
- Meshy: Check credits in dashboard

**3. Set up alerts:**
- OpenAI: Set monthly budget limit
- Meshy: Monitor credit usage

**4. Log errors:**
```bash
# Check server logs
npm run dev 2>&1 | tee logs/server.log

# Check browser console
# Open DevTools → Console
```

---

## Configuration Examples

### Minimal Configuration

**For basic testing:**
```bash
# Required only
VITE_OPENAI_API_KEY=sk-...
VITE_MESHY_API_KEY=msy_...
OPENAI_API_KEY=sk-...
MESHY_API_KEY=msy_...
```

### Development Configuration

**For active development:**
```bash
# API Keys
VITE_OPENAI_API_KEY=sk-...
VITE_MESHY_API_KEY=msy_...
OPENAI_API_KEY=sk-...
MESHY_API_KEY=msy_...

# Servers
API_PORT=3004
IMAGE_SERVER_PORT=8081
IMAGE_SERVER_URL=https://abc123.ngrok.io
VITE_IMAGE_SERVER_URL=https://abc123.ngrok.io
VITE_GENERATION_API_URL=http://localhost:3004/api

# Debugging
VITE_DEBUG_PIPELINE=true
VITE_PIPELINE_POLL_INTERVAL_MS=1500

# Meshy
MESHY_POLL_INTERVAL_MS=5000
MESHY_TIMEOUT_MS=900000
MESHY_MODEL_DEFAULT=meshy-5
```

### Production Configuration

**For deployment:**
```bash
# API Keys (use separate production keys)
VITE_OPENAI_API_KEY=sk-prod-...
VITE_MESHY_API_KEY=msy_prod_...
OPENAI_API_KEY=sk-prod-...
MESHY_API_KEY=msy_prod_...

# Environment
NODE_ENV=production
FRONTEND_URL=https://asset-forge.yourdomain.com

# Servers
API_PORT=3004
IMAGE_SERVER_URL=https://assets.yourdomain.com
VITE_IMAGE_SERVER_URL=https://assets.yourdomain.com
VITE_GENERATION_API_URL=https://api.yourdomain.com/api

# Optimization
VITE_DEBUG_PIPELINE=false
VITE_PIPELINE_POLL_INTERVAL_MS=3000

# Meshy (longer timeouts for production)
MESHY_POLL_INTERVAL_MS=5000
MESHY_TIMEOUT_MS=1800000
MESHY_TIMEOUT_STANDARD_MS=600000
MESHY_TIMEOUT_HIGH_MS=1200000
MESHY_TIMEOUT_ULTRA_MS=2400000
MESHY_MODEL_DEFAULT=meshy-5
```

---

## Next Steps

Now that you've configured Asset Forge:

1. **Test your setup** - Generate a test asset to verify configuration
2. **Read [Quick Start](quick-start.md)** - Generate your first asset
3. **Review [Troubleshooting](troubleshooting.md)** - Fix common issues
4. **Explore [User Guides](../03-user-guides/)** - Learn all features

---

## Related Documentation

**Configuration:**
- [Installation Guide](installation.md) - Initial setup
- [Deployment Guide](../14-deployment/) - Production deployment

**Customization:**
- [Prompt Templates](../10-configuration/) - Customize AI behavior
- [Material System](../08-features/) - Material variant system

**Troubleshooting:**
- [Troubleshooting Guide](troubleshooting.md) - Fix issues
- [FAQ](../15-appendix/faq.md) - Common questions

---

[← Back to Installation](installation.md) | [Next: Troubleshooting →](troubleshooting.md)
