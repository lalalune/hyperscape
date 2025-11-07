# 9. Semi-Automated Asset Approval Workflow for Asset Forge

Date: 2025-11-06

## Status

Accepted

## Context

Asset Forge generates AI-powered 3D assets for the Hyperscape game. These assets need to be:
1. Reviewed for quality before production use
2. Exported to a deployable CDN (GitHub → Railway)
3. Made available to the game via manifest files
4. Tracked through their entire lifecycle

### Current Situation
- Asset Forge generates assets locally and saves to `gdd-assets/` directory
- Assets tracked in PostgreSQL database (Phase 1 implementation complete)
- Separate `assets` repository deployed to Railway serves as CDN
- Game loads assets via `asset://` protocol from CDN
- No automated workflow between Asset Forge and assets repository

### Pain Points
- Manual file copying between repositories
- No approval workflow for quality control
- Manifest files must be manually updated
- Risk of deploying low-quality assets to production
- No audit trail for asset lifecycle

### Requirements
- Admin approval before assets go to production
- Automated file copying and manifest generation
- Manual review step before git push (safety gate)
- Database tracking of asset status (draft → approved → published)
- Support for multiple asset types (characters, items, environments)
- Maintain separation between generation tool and game assets

### Drivers

**Business drivers:**
- Ensure only high-quality assets reach production
- Maintain control over game content
- Enable rapid asset iteration with safety gates

**Technical drivers:**
- Separate concerns: generation vs deployment
- Leverage existing Railway CDN infrastructure
- Maintain git-based asset versioning

**Team/organizational drivers:**
- Single admin can approve multiple assets efficiently
- Clear workflow reduces confusion
- Automated export reduces manual errors

## Decision

We will implement a **semi-automated asset approval workflow (Option B)** that:

1. Tracks asset lifecycle in PostgreSQL database with statuses
2. Provides admin API endpoints for approval/rejection
3. Automates export to assets repository via CLI script
4. Requires manual git commit/push as final safety gate
5. Generates manifest JSON files automatically

### Key Points

- **Semi-automated**: Automation for tedious tasks, manual review for safety
- **Admin-gated**: Only approved assets can be exported
- **Database-tracked**: Complete audit trail in PostgreSQL
- **Manifest generation**: Automatic JSON generation per asset type
- **Manual deployment**: Final git push requires human review

## Alternatives Considered

### Alternative 1: Manual (Option A)
**Pros:**
- Complete control over every step
- Simple to understand
- No automation complexity

**Cons:**
- Tedious manual file copying
- Error-prone manifest editing
- No workflow enforcement
- Time-consuming for batch operations

**Reason for rejection:** Too manual for efficient operation at scale

### Alternative 2: Fully Automated (Option C)
**Pros:**
- Zero manual steps
- Fastest workflow
- Maximum efficiency

**Cons:**
- No review step before deployment
- Risk of auto-deploying bad assets
- Complex error handling needed
- Harder to debug issues

**Reason for rejection:** Too risky - no human review before production

## Consequences

### Positive
- **Quality control**: Admin approval prevents bad assets reaching production
- **Audit trail**: Database tracks entire lifecycle with timestamps
- **Efficiency**: Automation handles file copying and manifest generation
- **Safety**: Manual git push provides final review opportunity
- **Flexibility**: Can approve/reject multiple assets before batch export
- **Clear workflow**: Well-defined steps reduce confusion
- **Type safety**: Manifest generation uses TypeScript types
- **Activity logging**: All approvals/rejections logged in database

### Negative
- **Manual final step**: Still requires git commit/push manually
- **Local dependency**: Requires local clone of assets repository
- **Database migration**: Need to run migration for new fields
- **Learning curve**: Team must learn new workflow

### Neutral
- **Semi-automated**: Balance between control and efficiency
- **CLI-based export**: Uses `bun run assets:export` command
- **GitHub workflow**: Still uses git for version control

### Risks
- **Out-of-sync repos**: Local assets repo could be stale
  - **Mitigation**: Script checks for uncommitted changes, warns user

- **Manifest conflicts**: Multiple admins editing same manifest
  - **Mitigation**: Git merge conflicts will surface during push

- **Database schema drift**: Export relies on database fields
  - **Mitigation**: Migration included, schema documented

- **ASSETS_REPO_PATH misconfiguration**: Wrong path breaks export
  - **Mitigation**: Script validates path exists before starting

## Implementation

### Action Items
- [x] Add `approved`, `published` statuses to assets schema
- [x] Add `exportedToRepo`, `manifestPath` tracking fields
- [x] Run database migration (0001_eager_violations.sql)
- [x] Create admin approval endpoints
  - [x] GET /api/admin/assets (list with filtering)
  - [x] GET /api/admin/assets/pending (awaiting approval)
  - [x] PUT /api/admin/assets/:id/approve
  - [x] PUT /api/admin/assets/:id/reject
- [x] Create export script (scripts/export-to-assets-repo.ts)
- [x] Add manifest JSON generation
- [x] Add CLI command (`bun run assets:export`)
- [x] Update .env with ASSETS_REPO_PATH
- [x] Create workflow documentation (ASSET_EXPORT_WORKFLOW.md)
- [ ] Test end-to-end workflow
- [ ] Train team on new process
- [ ] Add admin UI for approvals (frontend)

### Timeline
- **Phase 1** (Complete): Database schema + API endpoints (2025-11-06)
- **Phase 2** (Complete): Export script + CLI (2025-11-06)
- **Phase 3** (Pending): Frontend admin UI (Week of 2025-11-11)
- **Phase 4** (Future): Batch operations, automated quality checks

### Success Metrics
- **Approval time**: < 5 minutes per asset
- **Export success rate**: > 95%
- **Manual errors**: Zero (automation eliminates copy/paste)
- **Deployment time**: < 2 minutes from approval to CDN
- **Asset rejection rate**: < 10% (improves over time)

## References

- **Workflow Documentation**: `packages/asset-forge/ASSET_EXPORT_WORKFLOW.md`
- **Database Setup**: `packages/asset-forge/RAILWAY_SETUP.md`
- **Assets Repository**: https://github.com/HyperscapeAI/assets
- **Railway Deployment**: https://railway.app (CDN hosting)
- **Related ADRs**:
  - ADR-0004: Use PostgreSQL for Primary Database
  - ADR-0008: Adopt Privy HD Wallets for User Wallet Management

## Notes

### Asset Status Flow
```
draft → processing → completed → approved → published
                                     ↓
                                  failed (rejected)
```

### Repository Structure
- **Asset Forge** (`hyperscape-5/packages/asset-forge/`): Generation tool with database
- **Assets Repo** (`~/Downloads/assets-main/`): Deployable CDN content (GitHub → Railway)
- **Hyperscape Game** (`hyperscape-5/`): Loads assets via CDN

### Manifest Generation Strategy
- Characters → `manifests/characters.json`
- Items → `manifests/items.json`
- Environments → `manifests/zones.json`

Each asset type has specific required fields defined in the export script.

### Future Enhancements
- **Batch approval UI**: Select multiple assets, approve all at once
- **Quality checks**: Automated polygon count, texture size validation
- **Preview generation**: Thumbnail images for admin review
- **Webhook integration**: Notify team when assets deployed
- **Automated git commit**: Optional flag to skip manual commit (with confirmation)

### Assumptions
- Admin has local clone of assets repository
- Assets repository is on `main` branch
- Railway auto-deploys on push to main
- Asset names are filesystem-safe (no spaces, special chars)
- GLB format is standard for all 3D models

### Constraints
- Must maintain backward compatibility with existing manifest structure
- Cannot break existing game asset loading
- Must preserve git history in assets repository
- Database must track complete audit trail
