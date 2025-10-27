# Testing, Validation, and Logging

## Overview

Complete test coverage, Zod schema validation, enhanced logging, and TypeScript type definitions for the Asset Forge API user management system.

## ✅ Test Coverage

### Unit Tests

**File**: `server/routes/__tests__/users-api-keys.test.mjs`

Tests encryption/decryption and API key storage:
- ✅ AES-256-GCM encryption correctness
- ✅ Encrypted value format validation
- ✅ Decryption returns original value
- ✅ Empty/null value handling
- ✅ Database storage of encrypted keys
- ✅ getUserApiKey() helper function
- ✅ getUserApiKeys() helper function
- ✅ Backward compatibility with plaintext keys

**Run**: `bun run test:crypto`

### Integration Tests

**File**: `server/routes/__tests__/auth-flow-integration.test.mjs`

Tests complete user journey:
- ✅ User creation on first sign-in
- ✅ Settings persistence to database
- ✅ API key encryption and storage
- ✅ Multiple API keys (OpenAI, Meshy, ElevenLabs)
- ✅ Settings persist across logout/login
- ✅ API key deletion
- ✅ Last login timestamp updates
- ✅ Admin whitelist promotion

**Run**: `bun run test:auth-flow`

### Run All Tests

```bash
cd apps/api
bun run test
```

Expected output:
```
✓ Encryption/Decryption (4 tests)
✓ API Key Storage (2 tests)
✓ getUserApiKey Helper (3 tests)
✓ getUserApiKeys Helper (2 tests)
✓ Backward Compatibility (1 test)
✓ Complete Authentication Flow (8 tests)

Total: 20 tests passed
```

## 🔒 Validation (Zod Schemas)

### Schema File

**File**: `server/validation/user-schemas.mjs`

### Schemas Defined

#### 1. API Key Validation
```javascript
AddAPIKeyBodySchema = {
  provider: 'openai' | 'meshy' | 'elevenlabs',
  apiKey: string (min: 10, max: 500, not already encrypted)
}

DeleteAPIKeyParamsSchema = {
  provider: 'openai' | 'meshy' | 'elevenlabs'
}
```

#### 2. Profile Validation
```javascript
UpdateProfileBodySchema = {
  display_name?: string (min: 1, max: 100),
  email?: string (valid email),
  avatar_url?: string (valid URL)
} // At least one field required
```

#### 3. Settings Validation
```javascript
UserSettingsSchema = {
  theme?: 'dark' | 'light' | 'auto',
  compactMode?: boolean,
  animationsEnabled?: boolean,
  emailNotifications?: boolean,
  browserNotifications?: boolean,
  generationNotifications?: boolean,
  autoSaveEnabled?: boolean,
  lowPowerMode?: boolean,
  preloadModels?: boolean,
  analyticsEnabled?: boolean,
  crashReportsEnabled?: boolean,
  language?: 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh',
  aiGatewayUrl?: string (valid URL or empty)
}

UpdateSettingsBodySchema = {
  settings: UserSettingsSchema
}
```

### Validation Middleware

All user routes use validation:

```javascript
// ✅ Profile update
router.put('/me', validateBody(UpdateProfileBodySchema), ...)

// ✅ Settings update
router.put('/me/settings', validateBody(UpdateSettingsBodySchema), ...)

// ✅ Add API key
router.post('/me/api-keys', validateBody(AddAPIKeyBodySchema), ...)

// ✅ Delete API key
router.delete('/me/api-keys/:provider', validateParams(DeleteAPIKeyParamsSchema), ...)
```

### Validation Benefits

- ✅ **Type Safety**: Ensures request data matches expected types
- ✅ **Input Sanitization**: Prevents injection attacks
- ✅ **Clear Error Messages**: Zod provides detailed validation errors
- ✅ **Runtime Validation**: Validates data at API boundary
- ✅ **Auto-documentation**: Schemas serve as API documentation

## 📊 Logging

### Comprehensive Logging Added

#### 1. Crypto Operations
```javascript
[Crypto] Encrypted data (2ms) - Length: 42 → 128
[Crypto] Decrypted data (1ms) - Length: 128 → 42
[Crypto] ⚠️ Data appears to be plaintext (consider re-encrypting)
[Crypto] Encryption error (3ms): Invalid input
```

#### 2. User API Routes
```javascript
[Users API] PUT /me - User: did:privy:abc123
[Users API] POST /me/api-keys - User: did:privy:abc123, Provider: openai
[Users API] POST /me/api-keys - Success (45ms) - Provider: openai
[Users API] DELETE /me/api-keys/meshy - Success (23ms)
[Users API] DELETE /me/api-keys/:provider - No user ID in headers
```

#### 3. Service Initialization
```javascript
[VoiceGenerationService] ElevenLabs client initialized (user key)
[AISDKService] Using direct provider access (user key)
[RetextureService] Initialized (user key)
[MusicService] ElevenLabs Music client initialized (env var)
```

#### 4. Service Errors
```javascript
[Voice] No API key available - neither user key nor env var set
[SFX] ElevenLabs API key not configured. Please add in Profile settings.
```

### Logging Features

- ✅ **Request Timing**: All operations log duration
- ✅ **User Identification**: Logs privy_user_id for audit trail
- ✅ **Success/Failure**: Clear status indicators
- ✅ **Error Context**: Full error messages and stack traces
- ✅ **Security**: Never logs decrypted API keys

### Log Levels

- `console.log()` - Info: Successful operations
- `console.warn()` - Warning: Missing data, fallback scenarios
- `console.error()` - Error: Failures, exceptions

## 🎯 Type Safety

### TypeScript Definitions

#### 1. User Types
**File**: `server/types/users.d.ts`

```typescript
type APIKeyProvider = 'openai' | 'meshy' | 'elevenlabs'

interface UserProfile {
  id: string
  privy_user_id: string
  email: string | null
  wallet_address: string | null
  role: 'admin' | 'team_leader' | 'member'
  settings: UserSettings
  created_at: string
  last_login_at: string | null
}

interface UserSettings {
  theme?: 'dark' | 'light' | 'auto'
  apiKeys?: EncryptedAPIKeys
  aiGatewayUrl?: string
  // ... all other settings
}
```

#### 2. Crypto Types
**File**: `server/utils/crypto.d.ts`

```typescript
function encrypt(text: string): string
function decrypt(encryptedData: string): string
function isEncrypted(value: string): boolean
```

### Type Checking

```bash
cd apps/api
bun run typecheck
```

## 🛡️ Security Features

### 1. Input Validation
- ✅ Zod schemas validate all inputs
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (no unsanitized output)
- ✅ API key format validation

### 2. Encryption
- ✅ AES-256-GCM authenticated encryption
- ✅ Random IV per encryption (prevents pattern analysis)
- ✅ Auth tag prevents tampering
- ✅ PBKDF2 key derivation (100k iterations)

### 3. Access Control
- ✅ User ID validation (x-user-id header)
- ✅ Users can only access their own data
- ✅ Admin whitelist for role promotion
- ✅ JWT token validation (handled by frontend)

### 4. Sensitive Data Handling
- ✅ API keys never logged in plaintext
- ✅ Keys encrypted before database storage
- ✅ Decryption only when needed
- ✅ Masked display in API responses

## 📋 Test Checklist

### Before Deployment

- [ ] Run all tests: `bun run test`
- [ ] Check type safety: `bun run typecheck`
- [ ] Verify DATABASE_URL is set
- [ ] Verify ENCRYPTION_SECRET is set (production)
- [ ] Test user sign-up flow
- [ ] Test API key addition (all 3 providers)
- [ ] Test settings persistence
- [ ] Test logout clears local state
- [ ] Test login restores settings
- [ ] Verify encrypted keys in database
- [ ] Test service usage with user keys
- [ ] Test fallback to env vars

### Manual Testing

```bash
# 1. Start API server
cd apps/api
bun run dev

# 2. Test endpoints (replace with real Privy token)
TOKEN="your-privy-jwt-token"
USER_ID="did:privy:abc123"

# Get user profile
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-user-id: $USER_ID" \
     http://localhost:3001/api/users/me

# Add OpenAI API key
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-user-id: $USER_ID" \
     -H "Content-Type: application/json" \
     -d '{"provider":"openai","apiKey":"sk-test-123"}' \
     http://localhost:3001/api/users/me/api-keys

# Get API keys (masked)
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-user-id: $USER_ID" \
     http://localhost:3001/api/users/me/api-keys

# Update settings
curl -X PUT \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-user-id: $USER_ID" \
     -H "Content-Type: application/json" \
     -d '{"settings":{"theme":"dark","aiGatewayUrl":"https://api.example.com"}}' \
     http://localhost:3001/api/users/me/settings

# Delete API key
curl -X DELETE \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-user-id: $USER_ID" \
     http://localhost:3001/api/users/me/api-keys/openai
```

## 📈 Performance Monitoring

### Logged Metrics

- ✅ **Request Duration**: All operations log execution time
- ✅ **Encryption Time**: Crypto operations timed
- ✅ **Database Query Time**: Via db.mjs query wrapper
- ✅ **API Call Success Rate**: Service-level logging

### Performance Targets

- Encryption/Decryption: < 5ms
- Database queries: < 50ms
- API key retrieval: < 100ms
- Settings update: < 200ms

## 🔍 Debugging

### Enable Verbose Logging

```bash
# Development
NODE_ENV=development bun run dev

# Production debugging
NODE_ENV=production LOG_LEVEL=debug bun run start
```

### Common Issues

#### "Failed to encrypt" Error
**Cause**: ENCRYPTION_SECRET not set or crypto module issue
**Solution**: Set ENCRYPTION_SECRET env var (32+ character random string)

#### "Failed to decrypt" Error
**Cause**: ENCRYPTION_SECRET changed or data corrupted
**Solution**: API keys need to be re-added with new secret

#### "Data appears to be plaintext"
**Cause**: Backward compatibility with old unencrypted keys
**Solution**: Keys will be re-encrypted on next update

## 📚 Related Documentation

- [USER-API-KEYS.md](./USER-API-KEYS.md) - API key system overview
- [README.md](./README.md) - API documentation
- [database/schema.sql](./database/schema.sql) - Database schema

## 🚀 CI/CD Integration

Add to Railway/Vercel deployment:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: cd apps/api && bun install
      - run: cd apps/api && bun run test
      - run: cd apps/api && bun run typecheck
```

## 📝 Notes

- All tests use Node's built-in test runner (no external dependencies)
- Tests clean up after themselves (delete test users)
- Encryption uses secure defaults (100k PBKDF2 iterations)
- Logging includes request timing for performance monitoring
- TypeScript definitions ensure type safety at compile time

