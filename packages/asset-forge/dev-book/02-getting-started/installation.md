# Installation Guide

[← Back to Index](../README.md)

---

## Prerequisites

Before installing Asset Forge, ensure you have the following:

### Required Software

#### Node.js 18+ or Bun
Asset Forge requires Node.js 18 or higher, or Bun runtime.

**Check your Node version:**
```bash
node --version  # Should be v18.0.0 or higher
```

**Install Node.js:**
- Download from [nodejs.org](https://nodejs.org/)
- Or use nvm: `nvm install 18 && nvm use 18`

**Or Install Bun (Faster):**
```bash
curl -fsSL https://bun.sh/install | bash
bun --version  # Should be 1.0.0+
```

#### Git
Required to clone the repository.

```bash
git --version  # Should be installed
```

### Required API Keys

You need API keys from two services:

#### 1. OpenAI API Key

**Purpose**: GPT-4 prompt enhancement, image generation, grip detection

**Get your key:**
1. Visit [platform.openai.com](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API keys
4. Create new secret key
5. Copy key (starts with `sk-`)

**Required API Access:**
- GPT-4 model access
- GPT-Image-1 (DALL-E 3) access
- GPT-4o-mini access

**Cost Estimate:**
- Image generation: ~$0.04 per image
- GPT-4 enhancement: ~$0.01 per asset
- **Total**: ~$0.05 per asset generated

#### 2. Meshy.ai API Key

**Purpose**: Image-to-3D conversion, retexturing, rigging

**Get your key:**
1. Visit [meshy.ai](https://www.meshy.ai/)
2. Sign up for account
3. Navigate to API section
4. Generate API key
5. Copy key

**Required Plan:**
- Free tier available (limited credits)
- Pro plan recommended for production use

**Cost Estimate:**
- Image-to-3D (Standard): 5 credits
- Image-to-3D (High): 10 credits
- Image-to-3D (Ultra): 20 credits
- Retexture: 5 credits per variant
- Rigging: 10 credits

**Credits**: 100 credits = $10

### Optional Requirements

#### Image Hosting (for local development)

Meshy.ai requires publicly accessible image URLs. Choose one:

**Option 1: ngrok (Recommended for development)**
```bash
# Install ngrok
npm install -g ngrok

# Run when needed
ngrok http 8081
# Copy the HTTPS URL to IMAGE_SERVER_URL
```

**Option 2: Imgur**
Set `IMGUR_CLIENT_ID` in `.env` for automatic upload

**Option 3: Cloud Storage**
- AWS S3
- Cloudflare R2
- Google Cloud Storage

---

## Installation Steps

### Step 1: Clone the Repository

```bash
# Clone Hyperscape monorepo
git clone https://github.com/HyperscapeAI/hyperscape-1.git
cd hyperscape-1

# Navigate to asset-forge
cd packages/asset-forge
```

### Step 2: Install Dependencies

**Using npm:**
```bash
npm install
```

**Using bun (faster):**
```bash
bun install
```

**Expected output:**
```
added 450+ packages in 30s
```

### Step 3: Create Environment File

Copy the example environment file:

```bash
cp env.example .env
```

### Step 4: Configure API Keys

Edit `.env` with your API keys:

```bash
# Frontend API Keys (VITE_ prefix required)
VITE_OPENAI_API_KEY=sk-your-openai-key-here
VITE_MESHY_API_KEY=your-meshy-key-here
VITE_IMAGE_SERVER_URL=http://localhost:8081
VITE_GENERATION_API_URL=http://localhost:3004/api

# Backend API Keys
OPENAI_API_KEY=sk-your-openai-key-here
MESHY_API_KEY=your-meshy-key-here

# Server Configuration
API_PORT=3004
IMAGE_SERVER_PORT=8081

# Meshy Configuration (optional)
MESHY_POLL_INTERVAL_MS=5000
MESHY_TIMEOUT_MS=900000
MESHY_MODEL_DEFAULT=meshy-5
```

**Important:**
- Frontend keys need `VITE_` prefix
- Backend uses unprefixed keys
- Never commit `.env` file to git

### Step 5: Verify Installation

Run the type checker:

```bash
npm run typecheck
```

**Expected output:**
```
✓ No type errors found
```

Run the linter:

```bash
npm run lint
```

---

## Running Asset Forge

### Development Mode

Start both frontend and backend:

```bash
npm run dev
```

**This starts:**
- Frontend dev server on [http://localhost:3003](http://localhost:3003)
- Backend API server on [http://localhost:3004](http://localhost:3004)
- Image server on [http://localhost:8081](http://localhost:8081)

**You should see:**
```
[frontend] VITE v6.0.0  ready in 500 ms
[frontend] ➜  Local:   http://localhost:3003/
[backend]  API server running on http://localhost:3004
[images]   Image server running on http://localhost:8081
```

### Run Servers Separately

**Frontend only:**
```bash
npm run dev:frontend
```

**Backend only:**
```bash
npm run dev:backend
```

### Production Build

Build for production:

```bash
npm run build
```

Start production server:

```bash
npm run start
```

---

## Verifying Installation

### 1. Open the Application

Visit [http://localhost:3003](http://localhost:3003) in your browser.

**You should see:**
- Asset Forge interface
- Navigation bar with 5 tabs
- Dark theme UI

### 2. Check Backend Connection

Open browser DevTools console and check for:
```
✓ API connection established
✓ Backend health check passed
```

### 3. Test Asset Generation

1. Click **Generate** tab
2. Select **Items**
3. Fill in basic form:
   - Name: "test-sword"
   - Type: "weapon"
   - Subtype: "sword"
   - Description: "bronze sword"
4. Click **Start Generation**

**If successful:**
- Pipeline starts
- Progress shown in real-time
- Concept art appears
- 3D model generates
- Asset appears in Assets tab

**If errors:**
- See [Troubleshooting](#troubleshooting) below

---

## Directory Structure

After installation, you should have:

```
packages/asset-forge/
├── .env                      # Your API keys (not in git)
├── .gitignore                # Git ignore rules
├── package.json              # Dependencies
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript config
├── tailwind.config.cjs       # Tailwind config
│
├── src/                      # Frontend source
│   ├── components/           # React components (77 files)
│   ├── pages/                # Page components (5)
│   ├── services/             # Business logic (17)
│   ├── store/                # Zustand stores (5)
│   ├── hooks/                # Custom hooks (10)
│   ├── types/                # TypeScript types (12)
│   ├── constants/            # App constants (7)
│   ├── utils/                # Utilities (8)
│   └── styles/               # CSS and tokens
│
├── server/                   # Backend source
│   ├── api.mjs               # Express server
│   ├── services/             # Backend services (5)
│   ├── routes/               # API routes
│   └── middleware/           # Express middleware
│
├── public/                   # Static assets
│   └── prompts/              # AI prompt templates (6)
│
├── scripts/                  # Utility scripts
│   ├── audit-assets.ts
│   └── normalize-all-assets.ts
│
├── gdd-assets/               # Generated assets storage
│   └── .gitkeep
│
├── temp-images/              # Temporary images
│   └── .gitkeep
│
└── dev-book/                 # This documentation
    └── README.md
```

---

## Image Hosting Setup

### For Local Development with ngrok

**1. Install ngrok:**
```bash
npm install -g ngrok
```

**2. Start image server:**
```bash
npm run dev:images
```

**3. In another terminal, start ngrok:**
```bash
ngrok http 8081
```

**4. Copy the HTTPS URL:**
```
Forwarding  https://abc123.ngrok.io -> http://localhost:8081
```

**5. Update `.env`:**
```bash
VITE_IMAGE_SERVER_URL=https://abc123.ngrok.io
IMAGE_SERVER_URL=https://abc123.ngrok.io
```

**6. Restart servers:**
```bash
npm run dev
```

### For Production

Use a cloud storage service:

**AWS S3:**
```bash
VITE_IMAGE_SERVER_URL=https://your-bucket.s3.amazonaws.com
IMAGE_SERVER_URL=https://your-bucket.s3.amazonaws.com
```

**Cloudflare R2:**
```bash
VITE_IMAGE_SERVER_URL=https://your-bucket.r2.dev
IMAGE_SERVER_URL=https://your-bucket.r2.dev
```

---

## Troubleshooting

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3003
```

**Solution:**
```bash
# Find process using port
lsof -i :3003

# Kill process
kill -9 <PID>

# Or use different port
API_PORT=3005 npm run dev
```

### API Keys Not Working

**Error:**
```
Error: Invalid API key
```

**Checklist:**
- [ ] API key copied correctly (no extra spaces)
- [ ] Frontend keys have `VITE_` prefix
- [ ] Backend keys have no prefix
- [ ] `.env` file in correct directory
- [ ] Server restarted after changing `.env`

### Module Not Found

**Error:**
```
Cannot find module 'three'
```

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

**Error:**
```
Type 'any' is not assignable to type 'Asset'
```

**Solution:**
```bash
# Update TypeScript
npm install typescript@latest --save-dev

# Run type checker
npm run typecheck
```

### Build Fails

**Error:**
```
Build failed with errors
```

**Solution:**
```bash
# Clean build artifacts
npm run clean

# Rebuild
npm run build
```

### Image Server Not Accessible

**Error:**
```
Failed to upload image: CORS error
```

**Solution:**
1. Ensure image server is running (`npm run dev:images`)
2. Check IMAGE_SERVER_URL is correct
3. For Meshy, URL must be publicly accessible
4. Use ngrok for local development

### Meshy Timeout

**Error:**
```
Meshy task timeout after 15 minutes
```

**Solution:**
```bash
# Increase timeout in .env
MESHY_TIMEOUT_MS=1800000  # 30 minutes
MESHY_TIMEOUT_ULTRA_MS=2400000  # 40 minutes for ultra quality
```

---

## Next Steps

Now that you have Asset Forge installed:

1. [Configuration Guide](configuration.md) - Fine-tune settings
2. [Quick Start](quick-start.md) - Generate your first asset
3. [User Guides](../03-user-guides/) - Learn all features

---

## Getting Help

**Issues:**
- Check [Troubleshooting Guide](troubleshooting.md)
- Review [FAQ](../15-appendix/faq.md)
- Search GitHub issues

**Documentation:**
- [Architecture](../01-overview/architecture.md)
- [Tech Stack](../01-overview/tech-stack.md)
- [API Reference](../12-api-reference/rest-api.md)

---

[← Back to Overview](../01-overview/tech-stack.md) | [Next: Configuration →](configuration.md)
