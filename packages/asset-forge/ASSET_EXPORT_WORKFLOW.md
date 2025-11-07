# Asset Export Workflow
## From Asset Forge → Assets Repo → Production CDN

**Status:** Semi-Automated (Option B)
**Date:** 2025-11-06

---

## 🎯 Overview

Asset Forge generates 3D assets locally and tracks them in a PostgreSQL database. When assets are approved, they're exported to the `assets` repository which deploys to Railway as a CDN.

## 📊 Architecture

```
┌──────────────────────────────────────┐
│        Asset Forge (Local)           │
│                                      │
│  1. Generate 3D Asset (AI)           │
│  2. Save to gdd-assets/              │
│  3. Insert into PostgreSQL           │
│  4. Status: 'draft' → 'completed'    │
└──────────┬───────────────────────────┘
           │
           │ Admin reviews via /api/admin/assets/pending
           ▼
┌──────────────────────────────────────┐
│        Admin Approval                │
│                                      │
│  PUT /api/admin/assets/:id/approve   │
│  Status: 'completed' → 'approved'    │
└──────────┬───────────────────────────┘
           │
           │ Run: bun run assets:export
           ▼
┌──────────────────────────────────────┐
│        Export Script                 │
│                                      │
│  1. Query approved assets from DB    │
│  2. Copy GLB files to assets repo    │
│  3. Generate/update manifest JSON    │
│  4. Mark as 'published' in DB        │
└──────────┬───────────────────────────┘
           │
           │ Manual: git commit + push
           ▼
┌──────────────────────────────────────┐
│    Assets Repo (GitHub)              │
│    github.com/HyperscapeAI/assets    │
│                                      │
│    models/                           │
│    ├── character/                    │
│    ├── item/                         │
│    └── environment/                  │
│                                      │
│    manifests/                        │
│    ├── characters.json               │
│    ├── items.json                    │
│    └── zones.json                    │
└──────────┬───────────────────────────┘
           │
           │ Railway auto-deploys on push
           ▼
┌──────────────────────────────────────┐
│    Production CDN (Railway)          │
│                                      │
│    https://assets.up.railway.app/    │
│    Serves static files               │
└──────────┬───────────────────────────┘
           │
           │ Hyperscape game loads assets
           ▼
┌──────────────────────────────────────┐
│    Hyperscape Game                   │
│                                      │
│    asset://models/character/...     │
└──────────────────────────────────────┘
```

---

## 🔄 Workflow Steps

### **1. Generate Assets**

```bash
# In Asset Forge UI or via API
POST /api/generation/pipeline
{
  "prompt": "medieval knight character",
  "assetType": "character"
}

# Asset is created:
# - Files saved to: gdd-assets/medieval_knight/
# - Database record created with status: 'draft'
# - Processing completes, status becomes: 'completed'
```

### **2. Admin Reviews Pending Assets**

```bash
# Get assets awaiting approval
GET /api/admin/assets/pending

Response:
{
  "assets": [
    {
      "id": "uuid-123",
      "name": "medieval_knight",
      "type": "character",
      "status": "completed",
      "createdAt": "2025-11-06T...",
      "ownerId": "user-uuid"
    }
  ]
}
```

### **3. Admin Approves or Rejects**

**Approve:**
```bash
PUT /api/admin/assets/uuid-123/approve

Response:
{
  "success": true,
  "asset": {
    "id": "uuid-123",
    "name": "medieval_knight",
    "status": "approved"
  },
  "message": "Asset \"medieval_knight\" approved and ready for export"
}
```

**Reject (if needed):**
```bash
PUT /api/admin/assets/uuid-123/reject
{
  "reason": "Model quality too low"
}

Response:
{
  "success": true,
  "asset": {
    "id": "uuid-123",
    "name": "medieval_knight",
    "status": "failed"
  },
  "message": "Asset \"medieval_knight\" rejected"
}
```

### **4. Export Approved Assets**

```bash
# Run export script
bun run assets:export

Output:
🚀 Starting asset export...

Found 3 approved assets:

📦 Processing: medieval_knight (character)
  ✓ Copied: medieval_knight.glb → models/character/medieval_knight.glb
  ✓ Updated manifest: manifests/characters.json
  ✓ Marked as published in database

📦 Processing: iron_sword (item)
  ✓ Copied: iron_sword.glb → models/item/iron_sword.glb
  ✓ Updated manifest: manifests/items.json
  ✓ Marked as published in database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Export Summary

✅ Success: 2
   - medieval_knight
   - iron_sword

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Next Steps:
   1. Review changes in: /Users/home/Downloads/assets-main
   2. cd to assets repo and run: git diff
   3. Commit and push to deploy:
      git add .
      git commit -m "Add exported assets from Asset Forge"
      git push

✨ Railway will auto-deploy the updated assets!
```

### **5. Review and Deploy**

```bash
# Navigate to assets repo
cd /Users/home/Downloads/assets-main

# Review changes
git diff

# Check what files were added
git status

# Commit and push
git add .
git commit -m "Add medieval_knight character and iron_sword item from Asset Forge"
git push origin main
```

### **6. Railway Auto-Deploys**

Railway automatically:
- Detects the push to main
- Builds with Railpack
- Runs `npx serve -s .` to serve static files
- Updates CDN URL (usually within 1-2 minutes)

### **7. Assets Available in Game**

```typescript
// In Hyperscape game
const knight = await loadAsset('asset://models/character/medieval_knight.glb')

// Manifest is also available
const characters = await fetch('https://assets.up.railway.app/manifests/characters.json')
```

---

## 🗄️ Database Status Flow

```
draft → processing → completed → approved → published
                                     ↓
                                  failed (rejected)
```

**Status Meanings:**
- `draft` - Asset generation started
- `processing` - AI generation in progress
- `completed` - Generation done, ready for review
- `approved` - Admin approved, ready for export
- `published` - Exported to assets repo
- `failed` - Generation failed or admin rejected
- `archived` - Soft deleted

---

## 📁 File Structure

### **Asset Forge (Local)**
```
gdd-assets/
├── medieval_knight/
│   ├── medieval_knight.glb
│   ├── metadata.json
│   └── sprites/
└── iron_sword/
    ├── iron_sword.glb
    └── metadata.json
```

### **Assets Repo (GitHub)**
```
assets/
├── models/
│   ├── character/
│   │   └── medieval_knight.glb
│   └── item/
│       └── iron_sword.glb
├── manifests/
│   ├── characters.json
│   └── items.json
└── railway.json
```

### **Manifest JSON Format**

**characters.json:**
```json
{
  "characters": [
    {
      "characterId": "medieval_knight",
      "characterType": "npc",
      "name": "medieval_knight",
      "type": "character",
      "description": "A medieval knight character",
      "modelPath": "asset://models/character/medieval_knight.glb",
      "level": 1,
      "maxHealth": 100,
      "currentHealth": 100,
      "attackPower": 15,
      "defense": 20,
      "faction": "kingdom",
      "canBeAttacked": true,
      "retaliates": true,
      "movementType": "patrol",
      "moveSpeed": 1.2
    }
  ]
}
```

**items.json:**
```json
{
  "items": [
    {
      "itemId": "iron_sword",
      "name": "iron_sword",
      "type": "item",
      "description": "A sturdy iron sword",
      "modelPath": "asset://models/item/iron_sword.glb",
      "category": "weapon",
      "stackable": false,
      "maxStack": 1,
      "value": 100
    }
  ]
}
```

---

## 🛠️ Configuration

### **Environment Variables**

Add to `packages/asset-forge/.env`:

```bash
# Path to your local clone of the assets repo
ASSETS_REPO_PATH=/Users/home/Downloads/assets-main
```

### **Asset Metadata (Optional Game Properties)**

When generating assets, you can include game properties in the metadata:

```json
{
  "prompt": "medieval knight",
  "assetType": "character",
  "metadata": {
    "gameProperties": {
      "level": 10,
      "maxHealth": 150,
      "attackPower": 20,
      "defense": 25,
      "faction": "kingdom",
      "services": ["shop", "quest"],
      "dialogueTree": {...}
    }
  }
}
```

These properties will be included in the manifest export.

---

## 📊 Admin Dashboard Endpoints

### **List All Assets**
```bash
GET /api/admin/assets?status=approved&page=1&limit=50
```

### **Get Pending Assets**
```bash
GET /api/admin/assets/pending
```

### **Approve Asset**
```bash
PUT /api/admin/assets/:id/approve
```

### **Reject Asset**
```bash
PUT /api/admin/assets/:id/reject
{
  "reason": "Quality issues"
}
```

---

## 🚀 Quick Reference

```bash
# 1. Generate assets via UI
# (Asset Forge frontend)

# 2. Review pending assets
curl http://localhost:3004/api/admin/assets/pending \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"

# 3. Approve an asset
curl -X PUT http://localhost:3004/api/admin/assets/ASSET_ID/approve \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"

# 4. Export approved assets
cd packages/asset-forge
bun run assets:export

# 5. Deploy to production
cd /Users/home/Downloads/assets-main
git add .
git commit -m "Add new assets"
git push

# 6. Verify deployment
curl https://assets.up.railway.app/manifests/characters.json
```

---

## ⚠️ Important Notes

### **Manual Review Step**
- Export script does NOT automatically commit/push
- This allows you to review changes before deploying
- Use `git diff` to verify what changed

### **Asset Naming**
- Asset names should be filesystem-safe
- No spaces (use underscores)
- Lowercase recommended
- Example: `medieval_knight`, not `Medieval Knight`

### **Manifest Updates**
- Existing entries are updated (by ID)
- New entries are appended
- Script preserves existing manifest structure

### **Database Tracking**
- `publishedAt` timestamp records when exported
- `exportedToRepo` timestamp for audit trail
- `manifestPath` stores which manifest file contains the asset

---

## 🆘 Troubleshooting

### **"Assets repo not found"**

```bash
# Check ASSETS_REPO_PATH
echo $ASSETS_REPO_PATH

# Clone the repo if needed
cd ~/Downloads
git clone https://github.com/HyperscapeAI/assets.git assets-main

# Update .env
ASSETS_REPO_PATH=/Users/home/Downloads/assets-main
```

### **"No GLB file found"**

Check that the asset has a GLB file:
```bash
ls gdd-assets/ASSET_NAME/
# Should contain a .glb file
```

### **"Manifest update failed"**

Ensure manifests directory exists:
```bash
mkdir -p /path/to/assets-main/manifests
```

### **Export Skips Assets**

Check asset status in database:
```bash
bun run db:studio
# Check assets table, status should be 'approved'
```

---

## 📚 Related Documentation

- **RAILWAY_SETUP.md** - Database and server setup
- **INTEGRATION_ROADMAP.md** - Character wallet integration
- **PHASE1_IMPLEMENTATION_SUMMARY.md** - Implementation details
- **Assets Repo README** - https://github.com/HyperscapeAI/assets

---

## 🎉 Success Checklist

- [ ] Asset generated and saved to `gdd-assets/`
- [ ] Asset status: `completed`
- [ ] Admin reviewed via `/api/admin/assets/pending`
- [ ] Admin approved via `/api/admin/assets/:id/approve`
- [ ] Asset status: `approved`
- [ ] Export script ran successfully
- [ ] GLB file copied to assets repo
- [ ] Manifest JSON updated
- [ ] Asset status: `published` in database
- [ ] Git changes reviewed
- [ ] Changes committed and pushed
- [ ] Railway deployed successfully
- [ ] Asset accessible via CDN URL
- [ ] Hyperscape game loads asset correctly

---

**Last Updated:** 2025-11-06
**Workflow:** Semi-Automated (Admin approval + manual deploy)
**Status:** Production Ready ✅
