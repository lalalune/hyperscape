# Troubleshooting Guide

[← Back to Index](../README.md)

---

## Overview

This guide helps you diagnose and resolve common issues with Asset Forge, from installation problems to generation failures. Each issue includes symptoms, causes, and step-by-step solutions.

**What you'll learn:**
- How to diagnose common errors
- Step-by-step solutions for each issue
- Preventive measures
- When to seek additional help

---

## Quick Diagnosis Checklist

Before diving into specific issues, run through this checklist:

```bash
# 1. Check Node version (need 18+)
node --version

# 2. Check if servers are running
curl http://localhost:3004/api/health

# 3. Check API keys are set
echo $VITE_OPENAI_API_KEY | grep "^sk-"
echo $VITE_MESHY_API_KEY | grep "^msy_"

# 4. Check for port conflicts
lsof -i :3004
lsof -i :8081

# 5. Check .env file exists
ls -la .env

# 6. Verify dependencies installed
npm list --depth=0
```

**If any of these fail, start with that section below.**

---

## Installation Issues

### Node Version Too Old

**Symptoms:**
```
Error: Unsupported engine
Required: node >= 18.0.0
Current: node v16.x.x
```

**Cause:** Asset Forge requires Node.js 18 or higher.

**Solution:**

**Option 1: Upgrade Node with nvm (recommended)**
```bash
# Install nvm if not installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal, then:
nvm install 18
nvm use 18
nvm alias default 18

# Verify
node --version  # Should show v18.x.x or higher
```

**Option 2: Download from nodejs.org**
```bash
# Visit https://nodejs.org/
# Download LTS version (18.x or higher)
# Install and restart terminal
```

**Option 3: Use Bun instead**
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Use bun instead of npm
bun install
bun run dev
```

### Dependencies Won't Install

**Symptoms:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Cause:** Dependency conflicts or corrupted package-lock.json.

**Solution:**

**Step 1: Clean install**
```bash
# Remove existing installations
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall
npm install
```

**Step 2: If still failing, use legacy peer deps**
```bash
npm install --legacy-peer-deps
```

**Step 3: Try Bun (usually handles conflicts better)**
```bash
bun install
```

### Module Not Found Errors

**Symptoms:**
```
Error: Cannot find module 'three'
Error: Cannot find module '@react-three/fiber'
```

**Cause:** Incomplete installation or missing dependencies.

**Solution:**

**Step 1: Verify all dependencies installed**
```bash
npm list --depth=0
```

**Step 2: Install missing packages**
```bash
npm install three @react-three/fiber @react-three/drei
```

**Step 3: Clear build cache**
```bash
npm run clean
rm -rf node_modules/.vite
npm run dev
```

### TypeScript Errors During Install

**Symptoms:**
```
error TS2307: Cannot find module '@/types/common'
error TS2345: Argument of type 'any' is not assignable
```

**Cause:** TypeScript version mismatch or missing type definitions.

**Solution:**

**Step 1: Update TypeScript**
```bash
npm install typescript@latest --save-dev
```

**Step 2: Update type definitions**
```bash
npm install @types/node@latest @types/react@latest @types/three@latest --save-dev
```

**Step 3: Skip type checking during install**
```bash
npm install --ignore-scripts
```

---

## API Key Problems

### Invalid API Key Error

**Symptoms:**
```
Error: Invalid API key
401 Unauthorized
OpenAI API error: 401 - Incorrect API key provided
```

**Cause:** API key is incorrect, expired, or not properly set.

**Solution:**

**Step 1: Verify key format**
```bash
# OpenAI keys start with sk-
echo $VITE_OPENAI_API_KEY
# Should output: sk-proj-... or sk-...

# Meshy keys start with msy_
echo $VITE_MESHY_API_KEY
# Should output: msy_...
```

**Step 2: Check for whitespace**
```bash
# View .env file
cat .env

# Look for spaces around = sign
# ❌ WRONG: VITE_OPENAI_API_KEY = sk-...
# ❌ WRONG: VITE_OPENAI_API_KEY= sk-...
# ✅ RIGHT: VITE_OPENAI_API_KEY=sk-...
```

**Step 3: Verify both prefixes set**
```bash
# Need both VITE_ and non-VITE_ versions
grep OPENAI_API_KEY .env
# Should show:
# VITE_OPENAI_API_KEY=sk-...
# OPENAI_API_KEY=sk-...
```

**Step 4: Test keys directly**
```bash
# Test OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-your-key-here"

# Test Meshy
curl https://api.meshy.ai/openapi/v1/image-to-3d \
  -H "Authorization: Bearer msy_your-key-here"
```

**Step 5: Restart servers**
```bash
# Stop servers (Ctrl+C)
npm run dev
```

### API Key Not Found

**Symptoms:**
```
⚠️  OPENAI_API_KEY not found - generation will fail
⚠️  MESHY_API_KEY not found - retexturing will fail
```

**Cause:** .env file missing or not in correct location.

**Solution:**

**Step 1: Check .env exists**
```bash
# Should be in packages/asset-forge/
ls -la packages/asset-forge/.env
```

**Step 2: Create if missing**
```bash
cd packages/asset-forge
cp env.example .env
```

**Step 3: Edit with your keys**
```bash
nano .env
# Add your API keys
# Save (Ctrl+O) and exit (Ctrl+X)
```

**Step 4: Verify content**
```bash
cat .env | grep API_KEY
# Should show your keys
```

### Rate Limit Exceeded

**Symptoms:**
```
Error: Rate limit exceeded
429 Too Many Requests
You exceeded your current quota
```

**Cause:** Too many API requests or insufficient credits.

**Solutions:**

**For OpenAI:**
```bash
# Check usage at: https://platform.openai.com/usage
# Add billing info if needed
# Increase rate limits if needed
```

**For Meshy:**
```bash
# Check credits at: https://meshy.ai/dashboard
# Buy more credits if depleted
# Upgrade plan if needed
```

**Temporary workaround:**
```bash
# Wait a few minutes
# Reduce concurrent generations
# Increase poll intervals to reduce API calls
MESHY_POLL_INTERVAL_MS=10000
```

---

## Server Issues

### Port Already in Use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3004
Error: listen EADDRINUSE: address already in use :::8081
```

**Cause:** Another process is using the port.

**Solution:**

**Step 1: Find the process**
```bash
# Check API port
lsof -i :3004

# Check image server port
lsof -i :8081
```

**Output example:**
```
COMMAND   PID  USER
node    12345  home
```

**Step 2: Kill the process**
```bash
kill -9 12345
```

**Step 3: Or use different ports**
```bash
# Edit .env
API_PORT=3005
IMAGE_SERVER_PORT=8082

# Restart
npm run dev
```

**Prevention:**
```bash
# Always stop servers properly (Ctrl+C)
# Don't kill terminal forcefully
```

### Backend Not Running

**Symptoms:**
```
Failed to fetch
Network request failed
Cannot connect to http://localhost:3004
```

**Cause:** Backend server crashed or not started.

**Solution:**

**Step 1: Check if running**
```bash
curl http://localhost:3004/api/health
```

**Step 2: Start backend**
```bash
# Start both frontend and backend
npm run dev

# Or just backend
npm run dev:backend
```

**Step 3: Check for startup errors**
```bash
# Look for errors in terminal output
# Common issues:
# - Missing dependencies
# - Port conflicts
# - Missing .env variables
```

**Step 4: Test health endpoint**
```bash
curl http://localhost:3004/api/health

# Should return:
{
  "status": "healthy",
  "timestamp": "...",
  "services": {
    "meshy": true,
    "openai": true
  }
}
```

### Frontend Won't Start

**Symptoms:**
```
Error: Failed to start server
EADDRINUSE: address already in use :::3003
```

**Cause:** Port 3003 in use or Vite configuration issue.

**Solution:**

**Step 1: Check port**
```bash
lsof -i :3003
kill -9 <PID>
```

**Step 2: Clear Vite cache**
```bash
rm -rf node_modules/.vite
npm run dev
```

**Step 3: Use different port**
```bash
# Edit vite.config.ts
server: {
  port: 3002,  // Change port
  ...
}
```

---

## CORS Errors

### CORS Policy Blocking Requests

**Symptoms:**
```
Access to fetch at 'http://localhost:3004/api/assets'
from origin 'http://localhost:3003' has been blocked by CORS policy
```

**Cause:** CORS headers not properly configured.

**Solution:**

**Step 1: Verify backend is running**
```bash
curl http://localhost:3004/api/health
```

**Step 2: Check Vite proxy**
```bash
# In vite.config.ts, verify:
server: {
  port: 3003,
  proxy: {
    '/api': {
      target: 'http://localhost:3004',
      changeOrigin: true,
    }
  }
}
```

**Step 3: Restart both servers**
```bash
npm run dev
```

**Step 4: For production, set FRONTEND_URL**
```bash
# In .env
FRONTEND_URL=https://your-frontend-domain.com
```

### Image CORS Errors

**Symptoms:**
```
Image from origin has been blocked by CORS policy
Failed to load image: CORS error
```

**Cause:** Image server CORS not configured or image not publicly accessible.

**Solution:**

**Step 1: Verify image server running**
```bash
curl http://localhost:8081
```

**Step 2: For Meshy, use public URL**
```bash
# Images must be publicly accessible
# Use ngrok:
ngrok http 8081

# Update .env:
IMAGE_SERVER_URL=https://abc123.ngrok.io
VITE_IMAGE_SERVER_URL=https://abc123.ngrok.io
```

**Step 3: Restart servers**
```bash
npm run dev
```

---

## Generation Failures

### Image Generation Fails

**Symptoms:**
```
Failed to generate image
OpenAI API error: 400 - Invalid prompt
Error: No image data returned from OpenAI
```

**Causes & Solutions:**

**Cause 1: Invalid prompt**
```bash
# Check description length
# DALL-E has 400 character limit for prompts
# Solution: Shorten your description
```

**Cause 2: Content policy violation**
```bash
# Description contains prohibited content
# Solution: Remove violent, sexual, or copyrighted content
```

**Cause 3: API key issue**
```bash
# Verify OpenAI key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Cause 4: Insufficient credits**
```bash
# Check OpenAI usage
# Visit: https://platform.openai.com/usage
# Add payment method if needed
```

### Image-to-3D Conversion Fails

**Symptoms:**
```
Meshy task failed
Failed to convert image to 3D
Task status: FAILED
```

**Causes & Solutions:**

**Cause 1: Image not accessible**
```bash
# Meshy can't access image URL
# Solution: Use ngrok for public access

# Start ngrok
ngrok http 8081

# Update .env with ngrok URL
IMAGE_SERVER_URL=https://abc123.ngrok.io
VITE_IMAGE_SERVER_URL=https://abc123.ngrok.io
```

**Cause 2: Image quality issues**
```bash
# Image too small, blurry, or complex
# Solution:
# - Use higher quality image generation
# - Ensure clean white background
# - Simplify object in description
```

**Cause 3: Meshy API error**
```bash
# Check Meshy status
curl https://api.meshy.ai/openapi/v1/image-to-3d \
  -H "Authorization: Bearer $MESHY_API_KEY"

# Should return 400 (missing params) not 401 (auth error)
```

**Cause 4: Insufficient credits**
```bash
# Check Meshy credits
# Visit: https://meshy.ai/dashboard
# Buy more credits if needed
```

### Generation Timeout

**Symptoms:**
```
Meshy task timeout after 15 minutes
Generation exceeded timeout
Task still pending after timeout
```

**Cause:** Timeout too short for quality level.

**Solution:**

**Step 1: Increase timeout**
```bash
# In .env
MESHY_TIMEOUT_MS=1800000  # 30 minutes

# Or use quality-specific timeouts
MESHY_TIMEOUT_ULTRA_MS=2400000  # 40 minutes for ultra
```

**Step 2: Check task actually failed**
```bash
# Sometimes task completes after timeout
# Check Meshy dashboard: https://meshy.ai/dashboard
# Look for completed tasks
```

**Step 3: Use lower quality for testing**
```bash
# Standard quality: 2-4 minutes
# High quality: 5-8 minutes
# Ultra quality: 10-20 minutes (sometimes longer)
```

### Generation Stuck

**Symptoms:**
```
Generation stuck at "Processing..."
Progress not updating
No error, just hangs
```

**Causes & Solutions:**

**Cause 1: Backend crashed**
```bash
# Check backend logs
# Look for errors in terminal

# Restart backend
npm run dev:backend
```

**Cause 2: Network issue**
```bash
# Check internet connection
ping api.openai.com
ping api.meshy.ai

# Check firewall/VPN not blocking
```

**Cause 3: Polling stopped**
```bash
# Check browser console for errors
# Open DevTools → Console

# Look for network errors
# Restart frontend if needed
```

**Cause 4: Meshy task stuck**
```bash
# Check Meshy dashboard
# https://meshy.ai/dashboard

# If task shows "Processing" for 20+ minutes
# It may be stuck, contact Meshy support
```

---

## Model Loading Errors

### Failed to Load GLB Model

**Symptoms:**
```
Failed to load model
Error loading GLB
THREE.GLTFLoader: Error parsing GLB
```

**Causes & Solutions:**

**Cause 1: File not found**
```bash
# Check file exists
ls -la gdd-assets/asset-name/model.glb

# Check API endpoint
curl http://localhost:3004/api/assets/asset-name/model
```

**Cause 2: Corrupted file**
```bash
# Check file size (should be > 0)
ls -lh gdd-assets/asset-name/model.glb

# If 0 bytes, regenerate asset
```

**Cause 3: Invalid GLB format**
```bash
# Validate with gltf-validator
npm install -g gltf-validator
gltf-validator gdd-assets/asset-name/model.glb
```

**Cause 4: Network error**
```bash
# Check backend running
curl http://localhost:3004/api/health

# Check browser console for 404/500 errors
```

### Three.js Loading Error

**Symptoms:**
```
THREE.WebGLRenderer: Context Lost
Unable to initialize WebGL
WebGL is not supported
```

**Causes & Solutions:**

**Cause 1: Browser doesn't support WebGL**
```bash
# Test WebGL support
# Visit: https://get.webgl.org/

# If not supported:
# - Update graphics drivers
# - Use different browser (Chrome recommended)
# - Enable hardware acceleration
```

**Cause 2: Too many contexts**
```bash
# Close other 3D tabs
# Restart browser
# Reduce concurrent 3D viewers
```

**Cause 3: GPU issues**
```bash
# Check GPU acceleration enabled
# Chrome: chrome://gpu/
# Firefox: about:support

# Enable if disabled:
# Chrome: Settings → System → Use hardware acceleration
```

---

## Performance Issues

### Slow Generation

**Symptoms:**
- Generation takes 20+ minutes
- Ultra quality never completes
- Timeout errors frequent

**Causes & Solutions:**

**Cause 1: Quality too high**
```bash
# Use lower quality for faster generation
# Standard: 2-4 minutes
# High: 5-8 minutes
# Ultra: 10-20 minutes

# Start with Standard for testing
```

**Cause 2: Network slow**
```bash
# Check internet speed
# Need 10+ Mbps for smooth operation

# Close bandwidth-heavy applications
# Use wired connection if possible
```

**Cause 3: Meshy queue**
```bash
# Meshy may have queue during peak hours
# Nothing you can do except wait
# Check Meshy status page
```

### UI Freezing

**Symptoms:**
- Browser freezes
- UI unresponsive
- Tab crashes

**Causes & Solutions:**

**Cause 1: Too many 3D viewers**
```bash
# Close unused asset previews
# View one asset at a time
# Use lower poly models for preview
```

**Cause 2: Memory leak**
```bash
# Restart browser
# Clear browser cache
# Close other tabs

# Chrome: Settings → Privacy → Clear browsing data
```

**Cause 3: Insufficient RAM**
```bash
# Check RAM usage
# Need 4GB+ available for smooth operation

# Close other applications
# Upgrade RAM if consistently low
```

### Slow Model Loading

**Symptoms:**
- Models take 10+ seconds to load
- 3D viewer stutters
- Textures load slowly

**Causes & Solutions:**

**Cause 1: Large file size**
```bash
# Check model size
ls -lh gdd-assets/*/model.glb

# If > 50MB:
# - Use lower quality setting
# - Reduce poly count
# - Compress textures
```

**Cause 2: Network bottleneck**
```bash
# Backend on localhost should be fast
# If slow, check:
lsof -i :3004  # Should only show one process
```

**Cause 3: Browser cache**
```bash
# Clear browser cache
# Hard reload (Ctrl+Shift+R)
```

---

## Browser Compatibility

### Safari Issues

**Known Issues:**
- WebGL shader compilation slower
- Some Three.js features unsupported
- CORS handling different

**Solutions:**
```bash
# Use Chrome or Firefox for best experience
# If must use Safari:
# - Update to latest version
# - Enable "Develop" menu
# - Allow experimental features
```

### Firefox Issues

**Known Issues:**
- WebGL performance slightly slower
- Different memory management

**Solutions:**
```bash
# Update to latest Firefox
# Enable WebGL
# about:config → webgl.force-enabled = true
```

### Chrome Recommended

**Best support:**
- Full WebGL support
- Best Three.js performance
- Comprehensive DevTools

**Optimization:**
```bash
# Enable hardware acceleration
# chrome://settings/system
# Toggle "Use hardware acceleration"

# Check WebGL status
# chrome://gpu/
```

---

## File Permission Errors

### Cannot Read/Write Files

**Symptoms:**
```
EACCES: permission denied
EPERM: operation not permitted
Failed to write file
```

**Cause:** Insufficient file permissions.

**Solution:**

**Step 1: Check permissions**
```bash
ls -la gdd-assets/
ls -la temp-images/
```

**Step 2: Fix permissions**
```bash
# Make directories writable
chmod -R 755 gdd-assets/
chmod -R 755 temp-images/
chmod -R 755 public/prompts/
```

**Step 3: Check ownership**
```bash
# Should be owned by your user
ls -la gdd-assets/

# If not, fix ownership
sudo chown -R $USER:$USER gdd-assets/
```

**Step 4: Verify .gitkeep files**
```bash
# Some directories need .gitkeep
touch gdd-assets/.gitkeep
touch temp-images/.gitkeep
```

### Cannot Delete Assets

**Symptoms:**
```
Failed to delete asset
ENOTEMPTY: directory not empty
EBUSY: resource busy
```

**Cause:** Files locked or permission issue.

**Solution:**

**Step 1: Close any open files**
```bash
# Close 3D viewers
# Close file explorers
# Close any editors with files open
```

**Step 2: Force delete**
```bash
rm -rf gdd-assets/asset-name/
```

**Step 3: Check for locks**
```bash
lsof | grep gdd-assets
# Kill any processes holding locks
```

---

## Network Issues

### Cannot Connect to APIs

**Symptoms:**
```
Failed to fetch
Network request failed
getaddrinfo ENOTFOUND api.openai.com
```

**Causes & Solutions:**

**Cause 1: No internet**
```bash
# Check connectivity
ping google.com
ping api.openai.com
```

**Cause 2: Firewall blocking**
```bash
# Allow connections to:
# - api.openai.com (443)
# - api.meshy.ai (443)
# - localhost (3004, 8081)
```

**Cause 3: VPN interference**
```bash
# Try disabling VPN
# Or whitelist Asset Forge in VPN
```

**Cause 4: Proxy issues**
```bash
# Check proxy settings
env | grep -i proxy

# Disable if interfering
unset HTTP_PROXY
unset HTTPS_PROXY
```

### SSL/TLS Errors

**Symptoms:**
```
SSL certificate problem
unable to verify the first certificate
SELF_SIGNED_CERT_IN_CHAIN
```

**Cause:** Certificate validation issues.

**Solution:**

**Step 1: Update certificates**
```bash
# macOS
brew install openssl

# Linux
sudo apt-get install ca-certificates
```

**Step 2: Check system time**
```bash
# Incorrect time causes SSL errors
date

# Sync if wrong
sudo ntpdate -s time.apple.com  # macOS
sudo ntpdate -s pool.ntp.org    # Linux
```

---

## Common Error Messages

### "Asset not found"

**Meaning:** Asset ID doesn't exist in gdd-assets directory.

**Solution:**
```bash
# List all assets
ls -la gdd-assets/

# Verify asset exists
ls -la gdd-assets/asset-name/

# If missing, regenerate
```

### "Failed to upload image"

**Meaning:** Image server can't upload/serve image.

**Solution:**
```bash
# Check image server running
curl http://localhost:8081

# For Meshy, use ngrok
ngrok http 8081

# Update .env with ngrok URL
```

### "Invalid configuration"

**Meaning:** .env file missing required variables.

**Solution:**
```bash
# Check .env exists
cat .env

# Verify required vars:
# - VITE_OPENAI_API_KEY
# - VITE_MESHY_API_KEY
# - OPENAI_API_KEY
# - MESHY_API_KEY
```

### "Exceeded context length"

**Meaning:** Prompt too long for GPT-4.

**Solution:**
```bash
# Shorten description
# Max ~400 characters
# Be concise but specific
```

### "Model file corrupted"

**Meaning:** GLB file damaged or incomplete.

**Solution:**
```bash
# Delete asset
# Regenerate from scratch
# Check disk space
df -h
```

---

## Getting Additional Help

### Debug Mode

**Enable verbose logging:**
```bash
# In .env
VITE_DEBUG_PIPELINE=true

# Restart frontend
npm run dev
```

**Check browser console:**
```
1. Open DevTools (F12)
2. Go to Console tab
3. Look for errors/warnings
4. Copy error messages for support
```

### Collect Logs

**Backend logs:**
```bash
# Run with logging
npm run dev 2>&1 | tee logs/server.log

# View logs
cat logs/server.log
```

**Frontend logs:**
```
1. Open DevTools (F12)
2. Console tab → Right-click → Save as...
3. Save console logs
```

### Check GitHub Issues

**Search existing issues:**
```bash
# Visit: https://github.com/HyperscapeAI/hyperscape-1/issues
# Search for your error message
# Check if already reported/solved
```

**Create new issue:**
```markdown
**Bug Report Template:**

**Environment:**
- OS: macOS/Linux/Windows
- Node version: X.X.X
- npm version: X.X.X
- Browser: Chrome X.X

**Steps to reproduce:**
1. ...
2. ...
3. ...

**Expected behavior:**
...

**Actual behavior:**
...

**Error messages:**
```
[Paste error messages]
```

**Logs:**
[Attach server.log and console logs]
```

### Community Support

**Discord/Slack:**
- Join Hyperscape community
- Ask in #asset-forge channel
- Share screenshots/logs

**Documentation:**
- [Installation Guide](installation.md)
- [Configuration Guide](configuration.md)
- [API Reference](../12-api-reference/)

---

## Preventive Measures

### Regular Maintenance

```bash
# Weekly: Update dependencies
npm update

# Monthly: Clear cache
npm cache clean --force
rm -rf node_modules/.vite

# As needed: Clean old assets
rm -rf gdd-assets/old-asset-*
```

### Backup Important Assets

```bash
# Backup gdd-assets directory
cp -r gdd-assets gdd-assets-backup-$(date +%Y%m%d)

# Or use git
cd gdd-assets
git init
git add .
git commit -m "Backup assets"
```

### Monitor API Usage

**OpenAI:**
- Check usage: [platform.openai.com/usage](https://platform.openai.com/usage)
- Set budget alerts
- Monitor rate limits

**Meshy:**
- Check credits regularly
- Buy credits before running out
- Upgrade plan if needed frequently

### Keep Software Updated

```bash
# Update Node.js
nvm install node --latest-npm

# Update Asset Forge
cd packages/asset-forge
git pull
npm install
```

---

## Still Having Issues?

If this guide didn't solve your problem:

1. **Enable debug mode** - Get detailed logs
2. **Check GitHub issues** - Search for similar problems
3. **Join community** - Ask for help
4. **Contact support** - Provide logs and steps to reproduce

**Remember:**
- Include error messages in full
- Describe what you were doing when error occurred
- Mention your environment (OS, Node version, etc.)
- Attach logs when possible

---

## Related Documentation

**Setup:**
- [Installation Guide](installation.md) - Initial setup
- [Configuration Guide](configuration.md) - Environment configuration

**Usage:**
- [Quick Start](quick-start.md) - Generate first asset
- [User Guides](../03-user-guides/) - Feature tutorials

**Reference:**
- [API Reference](../12-api-reference/) - API documentation
- [FAQ](../15-appendix/faq.md) - Frequently asked questions

---

[← Back to Configuration](configuration.md) | [Next: User Guides →](../03-user-guides/)
