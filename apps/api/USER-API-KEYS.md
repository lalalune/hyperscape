# User API Keys System

## Overview

Asset Forge now supports per-user API keys for third-party services (OpenAI, Meshy AI, ElevenLabs). Users can add their own keys to use the services instead of relying on shared environment variables.

## How It Works

### Storage
- API keys are stored in `users.settings.apiKeys` JSONB field
- Keys are **encrypted** using AES-256-GCM before storage
- Encrypted format: `iv:authTag:encryptedData` (all hex-encoded)
- Decryption happens only when needed for API calls

### Encryption
Uses `crypto.mjs` utility with:
- Algorithm: `aes-256-gcm` (authenticated encryption)
- Key derivation: PBKDF2 with 100,000 iterations
- Secret: `ENCRYPTION_SECRET` environment variable (falls back to DATABASE_URL)
- Backward compatible: Supports both encrypted and plaintext keys

### API Endpoints

#### Get User's API Keys (Masked)
```http
GET /api/users/me/api-keys
Headers: x-user-id: {privy_user_id}

Response:
[
  {
    "id": "openai",
    "provider": "openai",
    "maskedKey": "••••••••••••••••  (encrypted)",
    "isActive": true,
    "lastUsedAt": null,
    "createdAt": "2025-10-27T12:34:56.789Z"
  }
]
```

#### Add/Update API Key
```http
POST /api/users/me/api-keys
Headers: x-user-id: {privy_user_id}
Body:
{
  "provider": "openai|meshy|elevenlabs",
  "apiKey": "sk-..."
}

Response:
{
  "success": true,
  "message": "openai API key added successfully",
  "provider": "openai"
}
```

#### Delete API Key
```http
DELETE /api/users/me/api-keys/:provider
Headers: x-user-id: {privy_user_id}

Response:
{
  "success": true,
  "message": "openai API key deleted successfully"
}
```

## Service Integration

Services should support both user keys and environment variables:

### Pattern for Services

```javascript
// In service constructor
export class MyService {
  constructor(apiKeyOverride = null) {
    const apiKey = apiKeyOverride || process.env.SERVICE_API_KEY
    
    if (!apiKey) {
      this.client = null
    } else {
      this.client = new ServiceClient({ apiKey })
    }
  }
}
```

### Pattern for Routes

```javascript
import { getUserApiKey } from './users.mjs'

async function getServiceKey(req, provider) {
  const userId = req.headers['x-user-id']
  
  if (userId) {
    const userKey = await getUserApiKey(userId, provider)
    if (userKey) {
      return userKey // Returns decrypted key
    }
  }
  
  // Fallback to environment variable
  return process.env.SERVICE_API_KEY
}

router.post('/generate', async (req, res) => {
  const apiKey = await getServiceKey(req, 'openai')
  
  if (!apiKey) {
    return res.status(503).json({
      error: 'API key not configured',
      message: 'Please add your API key in Profile settings'
    })
  }
  
  // Create service with user's key
  const service = new MyService(apiKey)
  const result = await service.generate(...)
  
  res.json(result)
})
```

## Implemented Services

### ✅ VoiceGenerationService (ElevenLabs)
- Updated constructor to accept `apiKeyOverride`
- Routes updated: `/api/voice/library`, `/api/voice/generate`, `/api/voice/batch`
- Falls back to `ELEVENLABS_API_KEY` env var

### 🔜 TODO: Remaining Services

Update these services to follow the same pattern:

1. **AISDKService** (OpenAI)
   - Constructor should accept apiKey override
   - Routes in `content-generation.mjs`, `ai-gateway.mjs`

2. **RetextureService** (Meshy)
   - Constructor should accept apiKey override  
   - Routes in `assets.mjs` retexture endpoints

3. **MusicService** (OpenAI/Suno)
   - Constructor should accept apiKey override
   - Routes in `music.mjs`

4. **SoundEffectsService** (OpenAI/ElevenLabs)
   - Constructor should accept apiKey override
   - Routes in `sound-effects.mjs`

## Security Notes

### ⚠️ Production Deployment
1. Set `ENCRYPTION_SECRET` environment variable (32+ character random string)
2. Never log decrypted API keys
3. API keys are never sent to frontend (only masked versions)
4. Keys are decrypted only when making external API calls

### 🔐 Encryption Details
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: PBKDF2 (100,000 iterations, SHA-256)
- **IV**: Random 128-bit per encryption
- **Auth Tag**: 128-bit for integrity verification
- **Backward Compatible**: Handles both encrypted (`iv:tag:data`) and plaintext keys

### 🛡️ Best Practices
```javascript
// ✅ Good: Decrypt only when needed
const userKey = await getUserApiKey(userId, 'openai')
const service = new OpenAIService(userKey)

// ❌ Bad: Never store decrypted keys
global.openaiKey = await getUserApiKey(...) // DON'T DO THIS

// ✅ Good: Log masked versions only
console.log('Using key:', maskApiKey(key))

// ❌ Bad: Never log full keys
console.log('API Key:', key) // DON'T DO THIS
```

## Frontend Integration

### APIKeyManager Component
Location: `/apps/asset-forge/src/components/Profile/APIKeyManager.tsx`

Features:
- Add/update/delete API keys for each provider
- Masked display for security
- Per-provider key management
- Accessible from Profile page

### Providers Supported
1. **OpenAI** - GPT-4 Vision, content generation, embeddings
2. **Meshy AI** - 3D model generation and retexturing
3. **ElevenLabs** - Voice synthesis and TTS

## Helper Functions

### Get Single Provider Key (Decrypted)
```javascript
import { getUserApiKey } from './routes/users.mjs'

const openaiKey = await getUserApiKey(privyUserId, 'openai')
const meshyKey = await getUserApiKey(privyUserId, 'meshy')
const elevenlabsKey = await getUserApiKey(privyUserId, 'elevenlabs')
```

### Get All User Keys (Decrypted)
```javascript
import { getUserApiKeys } from './routes/users.mjs'

const keys = await getUserApiKeys(privyUserId)
// Returns: { openai: '...', meshy: '...', elevenlabs: '...' }
```

## Environment Variables

```bash
# Required for encryption (production)
ENCRYPTION_SECRET=your-32-plus-character-random-string

# Optional: Global API keys (fallback if user doesn't have keys)
OPENAI_API_KEY=sk-...
MESHY_API_KEY=...
ELEVENLABS_API_KEY=...
```

If users have their own keys configured, their keys will be used instead of the global environment variables.

## Migration Notes

- Existing keys in environment variables will continue to work
- Users can add their own keys to override global keys
- No database migration needed (uses existing `settings` JSONB column)
- Backward compatible with plaintext keys (auto-converts on next save)

