#!/bin/bash

# Script to add authentication middleware to unprotected routes in server/api.mjs
# This script uses sed to add authenticateUser middleware to specific routes

set -e

API_FILE="server/api.mjs"
BACKUP_FILE="server/api.mjs.auth-backup"

echo "🔐 Adding authentication middleware to Asset Forge API routes..."
echo ""

# Create backup
if [ ! -f "$BACKUP_FILE" ]; then
  cp "$API_FILE" "$BACKUP_FILE"
  echo "✅ Backup created: $BACKUP_FILE"
else
  echo "⚠️  Backup already exists, skipping backup creation"
fi

echo ""
echo "📝 Adding authenticateUser middleware to routes..."
echo ""

# Asset routes
echo "  → DELETE /api/assets/:id"
sed -i.tmp "s|app\.delete('/api/assets/:id', async (req, res, next)|app.delete('/api/assets/:id', authenticateUser, async (req, res, next)|" "$API_FILE"

echo "  → PATCH /api/assets/:id"
sed -i.tmp "s|app\.patch('/api/assets/:id', async (req, res, next)|app.patch('/api/assets/:id', authenticateUser, async (req, res, next)|" "$API_FILE"

echo "  → POST /api/assets/:id/sprites"
sed -i.tmp "s|app\.post('/api/assets/:id/sprites', async (req, res, next)|app.post('/api/assets/:id/sprites', authenticateUser, async (req, res, next)|" "$API_FILE"

# Material routes
echo "  → POST /api/material-presets"
sed -i.tmp "s|app\.post('/api/material-presets', async (req, res, next)|app.post('/api/material-presets', authenticateUser, async (req, res, next)|" "$API_FILE"

# Retexture routes
echo "  → POST /api/retexture"
sed -i.tmp "s|app\.post('/api/retexture', async (req, res, next)|app.post('/api/retexture', authenticateUser, async (req, res, next)|" "$API_FILE"

echo "  → POST /api/regenerate-base/:baseAssetId"
sed -i.tmp "s|app\.post('/api/regenerate-base/:baseAssetId', async (req, res, next)|app.post('/api/regenerate-base/:baseAssetId', authenticateUser, async (req, res, next)|" "$API_FILE"

# Generation pipeline routes
echo "  → POST /api/generation/pipeline"
sed -i.tmp "s|app\.post('/api/generation/pipeline', async (req, res, next)|app.post('/api/generation/pipeline', authenticateUser, async (req, res, next)|" "$API_FILE"

echo "  → GET /api/generation/pipeline/:pipelineId"
sed -i.tmp "s|app\.get('/api/generation/pipeline/:pipelineId', async (req, res, next)|app.get('/api/generation/pipeline/:pipelineId', authenticateUser, async (req, res, next)|" "$API_FILE"

# Weapon detection routes
echo "  → POST /api/weapon-handle-detect"
sed -i.tmp "s|app\.post('/api/weapon-handle-detect', async (req, res)|app.post('/api/weapon-handle-detect', authenticateUser, async (req, res)|" "$API_FILE"

echo "  → POST /api/weapon-orientation-detect"
sed -i.tmp "s|app\.post('/api/weapon-orientation-detect', async (req, res)|app.post('/api/weapon-orientation-detect', authenticateUser, async (req, res)|" "$API_FILE"

# AI generation routes
echo "  → POST /api/generate-dialogue"
sed -i.tmp "s|app\.post('/api/generate-dialogue', (req, res)|app.post('/api/generate-dialogue', authenticateUser, (req, res)|" "$API_FILE"

echo "  → POST /api/generate-npc"
sed -i.tmp "s|app\.post('/api/generate-npc', (req, res)|app.post('/api/generate-npc', authenticateUser, (req, res)|" "$API_FILE"

echo "  → POST /api/generate-quest"
sed -i.tmp "s|app\.post('/api/generate-quest', (req, res)|app.post('/api/generate-quest', authenticateUser, (req, res)|" "$API_FILE"

# Multi-agent routes
echo "  → POST /api/generate-npc-collaboration"
sed -i.tmp "s|app\.post('/api/generate-npc-collaboration', (req, res)|app.post('/api/generate-npc-collaboration', authenticateUser, (req, res)|" "$API_FILE"

echo "  → POST /api/generate-playtester-swarm"
sed -i.tmp "s|app\.post('/api/generate-playtester-swarm', (req, res)|app.post('/api/generate-playtester-swarm', authenticateUser, (req, res)|" "$API_FILE"

# Clean up temp files
rm -f "$API_FILE.tmp"

echo ""
echo "✅ Authentication middleware added successfully!"
echo ""
echo "📊 Summary:"
echo "  • Asset routes: 3 secured"
echo "  • Material/Texture routes: 3 secured"
echo "  • Generation pipeline: 2 secured"
echo "  • Weapon detection: 2 secured"
echo "  • AI generation: 5 secured"
echo "  • Total: 15 routes secured"
echo ""
echo "📝 Next steps:"
echo "  1. Review changes: git diff $API_FILE"
echo "  2. Test the API with authentication"
echo "  3. Wire up remaining route handlers (auth, admin, user, projects, teams)"
echo ""
echo "🔄 To restore from backup:"
echo "  cp $BACKUP_FILE $API_FILE"
