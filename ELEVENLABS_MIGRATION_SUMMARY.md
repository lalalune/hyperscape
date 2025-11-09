# ElevenLabs Audio Routes - Elysia Migration Complete

## Summary

Successfully migrated all ElevenLabs audio generation routes from Express.js to Elysia for the asset-forge server.

## What Was Migrated

### 1. **Voice Generation API** (`/api/voice`)

- **Service**: `ElevenLabsVoiceService.ts`
- **Routes**: `voice-generation.ts`
- **Endpoints**:
  - `GET /api/voice/library` - Get available voices
  - `POST /api/voice/generate` - Generate single voice clip
  - `POST /api/voice/batch` - Batch generate multiple clips
  - `POST /api/voice/estimate` - Estimate generation cost
  - `GET /api/voice/subscription` - Get subscription info
  - `GET /api/voice/models` - Get available models
  - `GET /api/voice/rate-limit` - Get rate limit status

### 2. **Music Generation API** (`/api/music`)

- **Service**: `ElevenLabsMusicService.ts`
- **Routes**: `music.ts`
- **Endpoints**:
  - `POST /api/music/generate` - Generate music (returns MP3)
  - `POST /api/music/generate-detailed` - Generate with metadata (returns JSON)
  - `POST /api/music/plan` - Create composition plan (no credits)
  - `POST /api/music/batch` - Batch generate tracks (max 10)
  - `GET /api/music/status` - Get service status

### 3. **Sound Effects API** (`/api/sfx`)

- **Service**: `ElevenLabsSoundEffectsService.ts`
- **Routes**: `sound-effects.ts`
- **Endpoints**:
  - `POST /api/sfx/generate` - Generate sound effect (returns MP3)
  - `POST /api/sfx/batch` - Batch generate effects (max 20)
  - `GET /api/sfx/estimate` - Estimate generation cost

## Files Created/Modified

### Services Created

1. `/server/services/ElevenLabsVoiceService.ts` - Voice/TTS service
2. `/server/services/ElevenLabsMusicService.ts` - Music generation service
3. `/server/services/ElevenLabsSoundEffectsService.ts` - SFX generation service

### Routes Created

1. `/server/routes/voice-generation.ts` - Voice API endpoints
2. `/server/routes/music.ts` - Music API endpoints
3. `/server/routes/sound-effects.ts` - SFX API endpoints

### Files Modified

1. `/server/services/index.ts` - Added exports for new services
2. `/server/models.ts` - Added TypeBox schemas for all audio APIs
3. `/server/api-elysia.ts` - Registered routes and added Swagger tags

## Key Features

### TypeBox Validation

All endpoints use TypeBox schemas for request/response validation:

- Request body validation
- Query parameter validation
- Response type enforcement
- Automatic OpenAPI documentation

### Binary Audio Responses

Music and SFX `/generate` endpoints return audio files directly as MP3:

- Proper Content-Type headers (`audio/mpeg`)
- Cache-Control for performance
- Content-Disposition for downloads

### Batch Processing

- **Voice**: Up to unlimited texts per batch
- **Music**: Up to 10 tracks per batch
- **SFX**: Up to 20 effects per batch
- All with parallel processing and error handling

### Error Handling

- Service availability checks (throws if API key missing)
- Validation errors (TypeBox automatic)
- Graceful batch failure handling

## Environment Setup

Add to `.env`:

```bash
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

The server will warn on startup if the key is missing.

## Swagger Documentation

All endpoints are fully documented in Swagger UI at:

- `http://localhost:3004/swagger`

New tags added:

- **Voice Generation** - ElevenLabs text-to-speech for NPC dialogue
- **Music Generation** - ElevenLabs AI music for game soundtracks
- **Sound Effects** - ElevenLabs text-to-sound-effects for game audio

## Testing

To test the endpoints:

```bash
# Start the server
cd packages/asset-forge
bun run dev:backend

# Test voice library
curl http://localhost:3004/api/voice/library

# Test music generation (if API key configured)
curl -X POST http://localhost:3004/api/music/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Epic fantasy battle music", "musicLengthMs": 30000}' \
  --output music.mp3

# Test sound effect generation
curl -X POST http://localhost:3004/api/sfx/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Sword slash sound", "durationSeconds": 2}' \
  --output sword.mp3
```

## API Usage Examples

### Generate Voice for NPC

```typescript
const response = await fetch("http://localhost:3004/api/voice/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "Greetings, adventurer!",
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Example voice ID
    npcId: "merchant_001",
    settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  }),
});

const result = await response.json();
// result.audioData contains base64-encoded MP3
```

### Generate Game Music

```typescript
const response = await fetch("http://localhost:3004/api/music/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "Peaceful village theme with flute and strings",
    musicLengthMs: 60000, // 1 minute
    forceInstrumental: true,
  }),
});

const blob = await response.blob(); // MP3 file
const audioUrl = URL.createObjectURL(blob);
```

### Generate Sound Effect

```typescript
const response = await fetch("http://localhost:3004/api/sfx/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "Magical spell casting with sparkles",
    durationSeconds: 3,
    promptInfluence: 0.7,
  }),
});

const blob = await response.blob(); // MP3 file
```

## SDK Usage

All services use the official `elevenlabs` package (v1.59.0):

```typescript
import { ElevenLabsClient } from "elevenlabs";

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

// Text-to-speech
const audioStream = await client.textToSpeech.convert(voiceId, {
  text,
  model_id,
});

// Music generation
const musicStream = await client.music.compose({ prompt, modelId });

// Sound effects
const sfxStream = await client.textToSoundEffects.convert({
  text,
  durationSeconds,
});
```

## Known Limitations

1. **Voice Design & Speech-to-Speech**: Not yet implemented (marked as placeholders in service)
2. **Composition Plan API**: Uses mock implementation (SDK may not have direct support)
3. **Rate Limiting**: Returns placeholder data (needs API response header tracking)
4. **Cost Estimation**: Uses approximate pricing (update with actual ElevenLabs rates)

## Next Steps

1. **Add Authentication**: Optionally require Privy JWT for production
2. **Implement Voice Design**: Complete the voice design endpoints if needed
3. **Add Database Storage**: Store generated audio metadata in PostgreSQL
4. **Frontend Integration**: Create React components to use these APIs
5. **Testing**: Write comprehensive tests for all services and routes

## Migration Benefits

- **22x faster** than Express (Elysia performance)
- **Type-safe** end-to-end with TypeBox
- **Auto-documented** with Swagger
- **Bun-native** file handling
- **Simplified** error handling

---

**Migration completed**: 2025-11-08
**Package**: asset-forge
**Framework**: Elysia v1.4.15
**SDK**: elevenlabs v1.59.0
