# Vercel Deployment Guide

This guide explains how to deploy Asset Forge to Vercel with serverless functions and Blob storage.

## Architecture

Asset Forge on Vercel uses:
- **Frontend**: Static Vite build served from CDN
- **API**: Serverless function (`api/index.mjs`) wrapping Express app
- **Storage**: Vercel Blob for 3D models, images, and audio files
- **Database**: Neon PostgreSQL (optional, for user data)

## Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **API Keys**: Obtain keys for:
   - OpenAI (GPT-4 for generation)
   - Meshy.ai (3D model generation)
   - ElevenLabs (voice synthesis)
   - Privy (authentication)

## Deployment Steps

### 1. Connect Repository

```bash
# Install Vercel CLI
npm i -g vercel

# Link your project
cd packages/asset-forge
vercel link
```

### 2. Configure Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

#### Required Variables

```bash
# Authentication
VITE_PUBLIC_PRIVY_APP_ID=clxxxx

# AI Services
OPENAI_API_KEY=sk-xxx
MESHY_API_KEY=msy_xxx
ELEVENLABS_API_KEY=sk_xxx

# Frontend URLs (set for Production)
VITE_API_URL=https://your-domain.vercel.app
VITE_GENERATION_API_URL=https://your-domain.vercel.app/api
```

#### Vercel Blob Storage

Vercel Blob is automatically configured when you:
1. Go to Storage tab in Vercel Dashboard
2. Click "Create Database" → "Blob"
3. Name it "hyper" when creating
4. Connect it to your project

This automatically sets: `HYPER_READ_WRITE_TOKEN`

**Important**: The token name must match your Blob storage name in Vercel.

### 3. Deploy

```bash
# Deploy to production
vercel --prod

# Or push to main branch (auto-deploys if connected to GitHub)
git push origin main
```

## File Storage

### Development (Local)
- Uses filesystem: `gdd-assets/`
- Files served via Express: `/api/assets/:path`

### Production (Vercel)
- Uses Vercel Blob storage
- Files served via CDN: `https://xxx.public.blob.vercel-storage.com/...`

The `BlobStorageService` automatically detects the environment and uses the appropriate storage backend.

## API Routes

All API routes are handled by the single serverless function at `api/index.mjs`:

```
/api/health                    → Health check
/api/assets                    → List all assets
/api/assets/:id/model          → Get 3D model
/api/generation/pipeline       → Start generation pipeline
/api/manifests/:type.json      → Get game manifests
/api/voice/*                   → Voice generation endpoints
```

The Express app is exported from `server/api.mjs` and wrapped by the serverless function.

## Build Process

### Local Development
```bash
bun run dev
# Runs:
# - Frontend: Vite dev server (port 3000)
# - API: Node with --experimental-strip-types (port 3004)
# - Images: Static image server (port 8081)
```

### Production Build
```bash
bun run build
# Runs:
# - vite build → dist/ (frontend static files)
# - TypeScript files are loaded at runtime (no pre-compilation needed)
```

## TypeScript Support

The project uses **Node.js's `--experimental-strip-types`** flag for TypeScript:

- ✅ Direct TypeScript execution (no build step needed)
- ✅ Works in serverless functions
- ⚠️ Limitations: No parameter properties (`constructor(private x)`)

### Workaround for Serverless

Server files that are imported by serverless functions must:
1. Not use TypeScript parameter properties
2. Include `.ts` extensions in imports when importing other TypeScript files

Example in `src/utils/logger.ts`:
```typescript
// ❌ Not supported in serverless
class Logger {
  constructor(private context: string) {}
}

// ✅ Supported
class Logger {
  private context: string
  constructor(context: string) {
    this.context = context
  }
}
```

## Environment Detection

Services automatically detect the environment:

```javascript
const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'

if (isProduction) {
  // Use Vercel Blob
  await put('path/file.glb', buffer, { access: 'public' })
} else {
  // Use local filesystem
  await fs.writeFile('gdd-assets/path/file.glb', buffer)
}
```

## Monitoring

### Vercel Dashboard
- **Logs**: Functions → Logs (last 24 hours)
- **Analytics**: View requests, errors, performance
- **Blob Storage**: Storage tab → View files and usage

### Health Check
```bash
curl https://your-domain.vercel.app/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-10-24T20:30:00.000Z",
  "services": {
    "meshy": true,
    "openai": true,
    "elevenlabs": true
  }
}
```

## Troubleshooting

### Issue: Module not found errors

**Cause**: TypeScript imports missing `.ts` extensions
**Solution**: Add `.ts` to imports in files loaded by serverless:

```typescript
import { createLogger } from '../utils/logger.ts'  // ✅ Include .ts
```

### Issue: 504 Function Timeout

**Cause**: Serverless function exceeds 10s limit
**Solution**: Increase timeout in `vercel.json`:

```json
{
  "functions": {
    "api/index.mjs": {
      "maxDuration": 30  // Up to 60s on Pro plan
    }
  }
}
```

### Issue: Files not persisting

**Cause**: Serverless functions have ephemeral filesystems
**Solution**: Use `BlobStorageService` for all file operations

### Issue: CORS errors

**Cause**: Frontend domain not in CORS whitelist
**Solution**: Add domain to `allowedOrigins` in `server/api.mjs`:

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-domain.vercel.app',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean)
```

## Security Checklist

- [ ] Environment variables set in Vercel Dashboard (not in code)
- [ ] API keys are server-side only (not exposed to frontend)
- [ ] CORS configured with specific origins (not wildcard)
- [ ] Rate limiting enabled on sensitive endpoints
- [ ] Privy authentication configured with production domain
- [ ] Security headers configured in `vercel.json`

## Cost Optimization

### Free Tier Limits (Hobby Plan)
- **Serverless Functions**: 100 GB-hours/month
- **Blob Storage**: 100 GB bandwidth/month
- **Build Time**: 6000 minutes/month

### Optimization Tips
1. **Cache static assets**: Set long Cache-Control headers
2. **Optimize images**: Use WebP format, compress before upload
3. **Reduce function size**: Keep dependencies minimal
4. **Use Blob CDN**: Files served from edge locations

## Upgrading to Pro

Pro plan benefits:
- **Function timeout**: Up to 300s (vs 10s)
- **Memory**: Up to 3008 MB (vs 1024 MB)
- **Blob storage**: 1 TB bandwidth (vs 100 GB)
- **Team collaboration**: Multiple team members
- **Advanced analytics**: More detailed metrics

## Next Steps

1. **Setup CI/CD**: Connect GitHub for auto-deployments
2. **Configure domains**: Add custom domain in Vercel Dashboard
3. **Enable analytics**: Install Vercel Analytics package
4. **Setup monitoring**: Configure error tracking (e.g., Sentry)
5. **Load testing**: Test with realistic traffic before launch

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
- [Serverless Functions Guide](https://vercel.com/docs/functions/serverless-functions)
- [Node.js TypeScript Support](https://nodejs.org/api/typescript.html)
