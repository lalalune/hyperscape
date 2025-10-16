# Vercel AI Gateway Plugin for ElizaOS

This plugin routes all AI requests through [Vercel's AI Gateway](https://vercel.com/docs/ai-gateway), providing a unified interface for multiple AI providers with built-in caching, rate limiting, and analytics.

## Quick Start

1. **Install the plugin** (already done in this workspace)

2. **Get your Vercel AI Gateway API key**:
   - Sign up at [vercel.com](https://vercel.com)
   - Go to your [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to AI Gateway settings
   - Create an API key

3. **Configure environment variables**:

```env
AI_GATEWAY_API_KEY=your_vercel_ai_gateway_key
AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1
AI_GATEWAY_SMALL_MODEL=gpt-4o-mini
AI_GATEWAY_LARGE_MODEL=gpt-4o
```

4. **Add to your character**:

```json
{
  "name": "YourAgent",
  "plugins": ["@elizaos/plugin-vercel-ai-gateway"],
  "settings": {
    "AI_GATEWAY_API_KEY": "your_key_here"
  }
}
```

## Why Use This?

- ✅ **Multi-Provider**: Switch between OpenAI, Anthropic, etc. with one config
- ✅ **Cost Savings**: Built-in caching reduces duplicate API calls
- ✅ **Analytics**: Track all AI usage in Vercel dashboard
- ✅ **Rate Limiting**: Protect against abuse
- ✅ **OIDC Auth**: Auto-auth when deployed on Vercel

## Configuration Options

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_GATEWAY_API_KEY` | Yes* | - | Your Vercel AI Gateway API key |
| `VERCEL_OIDC_TOKEN` | Yes* | - | Auto-provided by Vercel (when deployed) |
| `AI_GATEWAY_BASE_URL` | No | `https://ai-gateway.vercel.sh/v1` | Gateway endpoint |
| `AI_GATEWAY_SMALL_MODEL` | No | `gpt-4o-mini` | Fast model for simple tasks |
| `AI_GATEWAY_LARGE_MODEL` | No | `gpt-4o` | Complex reasoning model |
| `AI_GATEWAY_EMBEDDING_MODEL` | No | `text-embedding-3-small` | Text embeddings |
| `AI_GATEWAY_IMAGE_MODEL` | No | `dall-e-3` | Image generation |
| `AI_GATEWAY_TRANSCRIPTION_MODEL` | No | `whisper-1` | Audio transcription |

*Either `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` is required

## Features

### All OpenAI-compatible features:
- ✅ Text generation (small & large models)
- ✅ Text embeddings
- ✅ Image generation (DALL-E)
- ✅ Image description/analysis
- ✅ Audio transcription (Whisper)
- ✅ Text-to-speech
- ✅ Token encoding/decoding

### Plus Vercel benefits:
- 📊 Usage analytics in Vercel dashboard
- 💰 Cost tracking across providers
- ⚡ Response caching
- 🛡️ Built-in rate limiting
- 🔐 Secure OIDC authentication

## Migration from OpenAI Plugin

Replace in your character:
```diff
- "plugins": ["@elizaos/plugin-openai"]
+ "plugins": ["@elizaos/plugin-vercel-ai-gateway"]
```

Update environment variables:
```diff
- OPENAI_API_KEY=sk-...
+ AI_GATEWAY_API_KEY=your_vercel_key

- OPENAI_SMALL_MODEL=gpt-4o-mini
+ AI_GATEWAY_SMALL_MODEL=gpt-4o-mini
```

All `ModelType` usage remains the same!

## Example Usage

```typescript
import { vercelAIGatewayPlugin } from "@elizaos/plugin-vercel-ai-gateway";
import { ModelType } from "@elizaos/core";

// Use in your runtime
await runtime.useModel(ModelType.TEXT_SMALL, {
  prompt: "Explain quantum computing",
  temperature: 0.7
});

// Generate embeddings
const embedding = await runtime.useModel(
  ModelType.TEXT_EMBEDDING,
  "text to embed"
);

// Generate images
const images = await runtime.useModel(ModelType.IMAGE, {
  prompt: "A futuristic city",
  size: "1024x1024"
});
```

## Deploying on Vercel

When you deploy your ElizaOS app on Vercel:

1. Remove `AI_GATEWAY_API_KEY` from your env vars
2. Vercel automatically provides `VERCEL_OIDC_TOKEN`
3. The plugin detects and uses it automatically

## Troubleshooting

**401 Unauthorized**: Check your API key is correct and not expired

**Model not found**: Verify model name is supported through Vercel AI Gateway

**Rate limit errors**: Configure rate limits in Vercel dashboard

## Learn More

- [Vercel AI Gateway Docs](https://vercel.com/docs/ai-gateway)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [ElizaOS Documentation](https://elizaos.ai)

## License

MIT
