# Environment Variables Setup

This document lists all required and optional environment variables for Asset Forge.

## 🔐 Required for Production

### Privy Authentication
```bash
VITE_PUBLIC_PRIVY_APP_ID=your-privy-app-id-here
```
- **Required**: Yes (for authentication)
- **Where to get**: https://dashboard.privy.io/
- **Format**: Privy app ID (starts with `clp...`)
- **Impact if missing**: **Black screen / authentication failure**

### API Base URL
```bash
VITE_API_BASE_URL=https://your-api-domain.com
```
- **Required**: Yes (for production)
- **Default**: `http://localhost:3004` (development)
- **Format**: Full URL with protocol
- **Impact if missing**: API calls will fail

## 🔑 API Keys (Backend)

### Meshy AI (3D Model Generation)
```bash
MESHY_API_KEY=your-meshy-api-key
```
- **Required**: For 3D asset generation
- **Where to get**: https://www.meshy.ai/
- **Impact if missing**: 3D model generation will fail

### OpenAI (AI Enhancement)
```bash
OPENAI_API_KEY=sk-...
```
- **Required**: For AI-powered features
- **Where to get**: https://platform.openai.com/api-keys
- **Impact if missing**: AI enhancements will fail

### ElevenLabs (Voice Generation)
```bash
ELEVENLABS_API_KEY=your-elevenlabs-key
```
- **Required**: For voice synthesis
- **Where to get**: https://elevenlabs.io/
- **Impact if missing**: Voice generation will fail

### Anthropic Claude (Content Generation)
```bash
ANTHROPIC_API_KEY=sk-ant-...
```
- **Required**: For advanced AI content
- **Where to get**: https://console.anthropic.com/
- **Impact if missing**: Some AI features will be limited

## 📊 Analytics (Optional)

### Vercel Analytics
```bash
VERCEL_ANALYTICS_ID=your-analytics-id
```
- **Required**: No
- **Purpose**: Usage analytics
- **Auto-detected**: In Vercel deployments

### Vercel Speed Insights
```bash
VERCEL_SPEED_INSIGHTS_ID=your-insights-id
```
- **Required**: No
- **Purpose**: Performance monitoring
- **Auto-detected**: In Vercel deployments

## 🔧 Development Only

### Debug Mode
```bash
VITE_DEBUG_CHUNKS=true
```
- **Purpose**: Log chunk splitting during build
- **When to use**: Debugging bundle size issues

### API Port
```bash
API_PORT=3004
```
- **Default**: 3004
- **Purpose**: Backend server port

### Frontend Port
```bash
VITE_PORT=3000
```
- **Default**: 3000
- **Purpose**: Frontend dev server port

## 🚀 Deployment Checklist

### Vercel
1. Go to Project Settings → Environment Variables
2. Add all required variables listed above
3. Ensure `VITE_PUBLIC_PRIVY_APP_ID` is set (critical!)
4. Redeploy after adding variables

### Other Platforms
1. Set environment variables in your platform's dashboard
2. Prefix frontend variables with `VITE_`
3. Ensure build command is: `npm run build`
4. Ensure output directory is: `dist`

## ⚠️ Common Issues

### Black Screen on Deployment
**Cause**: Missing `VITE_PUBLIC_PRIVY_APP_ID`
**Solution**: Add the Privy App ID to your deployment environment variables

### Authentication Not Working
**Cause**: Invalid Privy App ID or CORS issues
**Solution**: 
1. Verify Privy App ID is correct
2. Add your deployment domain to Privy dashboard allowed origins

### API Calls Failing
**Cause**: Missing or incorrect `VITE_API_BASE_URL`
**Solution**: Set to your backend API URL (with protocol)

### Console Shows "Missing API Key" Warnings
**Cause**: Backend API keys not set
**Solution**: Add the specific API key mentioned in the warning

## 📝 Example `.env` File

```bash
# Frontend (Required)
VITE_PUBLIC_PRIVY_APP_ID=clp123456789abcdef

# Frontend (Optional)
VITE_API_BASE_URL=http://localhost:3004

# Backend API Keys
MESHY_API_KEY=msy_xxxxx
OPENAI_API_KEY=sk-xxxxx
ELEVENLABS_API_KEY=xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Development
API_PORT=3004
VITE_PORT=3000
```

## 🔍 Debugging

To check which environment variables are loaded:
1. Open browser console
2. Look for `[Asset Forge] Initializing...` logs
3. Check if Privy App ID shows ✅ Set or ❌ Missing
4. If missing, environment variables are not properly configured

---

**Need help?** Check the main README.md or contact support.

