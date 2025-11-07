# 10. Meshy.ai API Integration for 3D Asset Generation

Date: 2025-11-07

## Status

Accepted

## Context

Asset Forge requires AI-powered 3D asset generation to create game-ready models for the Hyperscape game. The generation pipeline needs to:

1. Convert 2D concept art (AI-generated images) into 3D models
2. Generate multiple material/texture variants for each base model
3. Auto-rig character models with bones and animations
4. Support multiple quality levels (standard, high, ultra)
5. Produce game-ready GLB files with proper topology and UVs
6. Complete generation in reasonable timeframes (5-10 minutes per asset)

### Current Situation

- Asset Forge uses a multi-stage AI pipeline: GPT-4 → GPT-Image-1 → Meshy.ai
- Every asset generation requires Meshy.ai API calls
- Three core workflows: Image-to-3D, Retexturing, Auto-Rigging
- Implemented in: AICreationService.ts, GenerationService.ts, RetextureService.ts
- Production-ready since Phase 1 (database integration complete)

### Pain Points

- **API Dependency**: 100% reliance on Meshy.ai for 3D generation
- **Cost Scaling**: Each asset = 1 base + N variants (multiplies API usage)
- **Long Processing**: 5-10 minutes per task with polling overhead
- **Rate Limits**: Potential throttling with high-volume generation
- **No Alternatives**: Tightly coupled to Meshy.ai API structure

### Requirements

- High-quality 3D models from 2D images
- PBR material support (Physically Based Rendering)
- Configurable polycount targets (6k, 12k, 20k)
- Texture resolution control (1024px, 2048px, 4096px)
- Quad topology for clean geometry
- Auto-rigging with humanoid skeleton (characters only)
- Material variant generation without re-generating base model

## Decision

We will use **Meshy.ai as the primary and exclusive 3D generation API** for Asset Forge with the following architecture:

### API Integration Points

1. **Image-to-3D Conversion** (`/openapi/v1/image-to-3d`)
   - Converts AI-generated concept art to 3D GLB models
   - Configurable quality: polycount, texture resolution, PBR
   - AI models: meshy-4 (legacy), meshy-5 (default)
   - Topology: quad (clean geometry for game engines)

2. **Texture/Material Retexturing** (`/openapi/v1/retexture`)
   - Generates material variants from base model
   - Input: base model task_id + style prompt
   - Preserves original UV mapping
   - Art styles: realistic (default), stylized, etc.

3. **Character Auto-Rigging** (`/openapi/v1/rigging`)
   - Adds humanoid skeleton with bones
   - Generates basic animations (walking, running)
   - Height normalization (default: 1.7m)
   - Compatible with Mixamo, Unity, Unreal

### Implementation Architecture

**Task-Based Polling Pattern:**
```
1. Submit task → Receive task_id
2. Poll status every 5-10 seconds
3. Check status: PENDING → PROCESSING → SUCCEEDED/FAILED
4. Download GLB when SUCCEEDED
5. Save to gdd-assets/ directory
```

**Quality Tier Configuration:**
- **Standard**: 6,000 polys, 1024px textures, meshy-4
- **High**: 12,000 polys, 2048px textures, meshy-5
- **Ultra**: 20,000 polys, 4096px textures, meshy-5, PBR enabled

**Environment Configuration:**
```bash
MESHY_API_KEY=<api_key>
MESHY_MODEL_DEFAULT=meshy-5
MESHY_MODEL_STANDARD=meshy-4
MESHY_MODEL_HIGH=meshy-5
MESHY_MODEL_ULTRA=meshy-5
MESHY_POLL_INTERVAL_MS=5000
MESHY_TIMEOUT_MS=300000
```

## Alternatives Considered

### Alternative 1: Kaedim API
**Pros:**
- Similar image-to-3D capabilities
- Artist refinement option
- Good quality outputs

**Cons:**
- Higher cost per model
- Slower processing (manual artist review)
- Less flexible topology control
- No built-in retexturing API
- Limited material variant support

**Reason for rejection:** Too expensive and slow for high-volume generation

### Alternative 2: Luma AI
**Pros:**
- Photorealistic quality
- Good for scanning real objects
- Fast processing

**Cons:**
- Optimized for photogrammetry, not concept art
- Very high polycount (not game-ready)
- Limited material/texture control
- No retexturing or rigging APIs
- Expensive for game asset production

**Reason for rejection:** Not designed for game-ready assets from concept art

### Alternative 3: In-House ML Model
**Pros:**
- Full control over pipeline
- No API costs after training
- Custom features possible

**Cons:**
- Requires ML expertise
- Massive training data needed
- GPU infrastructure costs
- Months of development
- Quality unlikely to match Meshy

**Reason for rejection:** Not feasible for startup timeline and resources

### Alternative 4: Blender + Manual Artists
**Pros:**
- Complete creative control
- Highest quality possible
- No API dependency

**Cons:**
- 2-8 hours per asset (vs 10 minutes)
- Expensive artist wages
- Not scalable to hundreds of assets
- Inconsistent quality across artists

**Reason for rejection:** Too slow and expensive for rapid iteration

## Consequences

### Positive

- **High Quality**: Meshy.ai produces game-ready models with clean topology
- **Fast Generation**: 5-10 minutes per asset (vs hours with manual artists)
- **Material Variants**: Retexturing API enables rapid material exploration
- **Auto-Rigging**: Character animations without manual rigging work
- **Scalability**: Can generate hundreds of assets in days, not months
- **PBR Support**: Physically-based materials for modern game engines
- **Topology Control**: Quad topology with configurable polycount targets
- **Cost Predictable**: API pricing based on usage, easier to forecast
- **Integration Ready**: Well-documented API with SDKs and examples

### Negative

- **API Dependency**: Complete reliance on Meshy.ai availability
- **Cost Scaling**: High-volume generation = high API costs
- **No Offline Mode**: Requires internet and Meshy.ai uptime
- **Rate Limits**: Potential throttling during peak usage
- **Quality Ceiling**: Limited by Meshy's AI capabilities
- **Model Lock-In**: Switching providers requires pipeline rewrite
- **Processing Time**: Still 5-10 minutes per asset (not instant)
- **Error Handling**: Must handle task failures and timeouts gracefully

### Neutral

- **Task Polling**: Requires polling architecture (not webhooks)
- **AI Model Updates**: Meshy may deprecate models (meshy-4 → meshy-5)
- **API Versioning**: Must track and migrate to new API versions
- **Credit Management**: Need to monitor API usage and budgets

### Risks and Mitigations

**Risk 1: Meshy.ai Service Outage**
- **Impact**: Asset generation blocked completely
- **Likelihood**: Low (99.9% uptime SLA typical)
- **Mitigation**:
  - Cache generated assets aggressively
  - Queue system for retries
  - Status page monitoring
  - Fallback to manual generation for critical assets

**Risk 2: API Cost Explosion**
- **Impact**: Budget overrun with high-volume generation
- **Likelihood**: Medium (scales with usage)
- **Mitigation**:
  - Usage quotas and alerts
  - Admin approval workflow (ADR-0009)
  - Batch generation limits
  - Negotiate volume pricing (see partnership proposal)

**Risk 3: Quality Degradation**
- **Impact**: Generated assets don't meet quality standards
- **Likelihood**: Low (Meshy.ai is production-grade)
- **Mitigation**:
  - Admin approval workflow before publishing
  - Quality metrics tracking (polycount, texture resolution)
  - Rejection and regeneration flow
  - GPT-4 prompt enhancement (ADR-0009)

**Risk 4: Rate Limiting**
- **Impact**: Generation blocked during high-volume periods
- **Likelihood**: Medium (depends on plan tier)
- **Mitigation**:
  - Request queue with throttling
  - Retry with exponential backoff
  - Monitor API rate limit headers
  - Upgrade to higher-tier plan

**Risk 5: API Deprecation/Breaking Changes**
- **Impact**: Pipeline breaks with API updates
- **Likelihood**: Low (versioned API endpoints)
- **Mitigation**:
  - Use versioned endpoints (/openapi/v1/)
  - Monitor Meshy.ai changelog
  - Maintain test suite for API integration
  - Abstract API calls behind service layer

## Implementation

### Phase 1: Core Integration (COMPLETED - 2025-11-06)

- [x] MeshyService class with API methods (AICreationService.ts:208-383)
- [x] Image-to-3D integration (GenerationService.ts:392-614)
- [x] Task polling with configurable timeouts
- [x] Quality tier configuration (standard/high/ultra)
- [x] Error handling and retry logic
- [x] GLB file download and storage
- [x] Environment variable configuration

### Phase 2: Retexturing (COMPLETED - 2025-11-06)

- [x] RetextureService implementation (RetextureService.ts)
- [x] Material variant generation (GenerationService.ts:616-763)
- [x] Custom MeshyClient for retexturing
- [x] Batch material processing
- [x] Variant metadata tracking
- [x] Progress callbacks and logging

### Phase 3: Auto-Rigging (COMPLETED - 2025-11-06)

- [x] Character rigging integration (GenerationService.ts:765-919)
- [x] Animation extraction (walking, running)
- [x] T-pose extraction from animations
- [x] Height normalization (1.7m default)
- [x] Rigging metadata tracking
- [x] Graceful fallback on rigging failure

### Phase 4: Database Integration (COMPLETED - 2025-11-06)

- [x] Asset status tracking (draft → processing → completed)
- [x] Meshy task ID storage
- [x] User ownership tracking (Privy integration)
- [x] Activity logging for API usage
- [x] Export workflow (ADR-0009)

### Phase 5: Optimization and Monitoring (PLANNED)

- [ ] API usage analytics dashboard
- [ ] Cost tracking per asset type
- [ ] Quality metrics (polycount, texture size)
- [ ] Rate limit monitoring
- [ ] Automatic retry queue
- [ ] Webhook integration (if Meshy adds support)
- [ ] Caching for repeated generations

### Success Metrics

- **Generation Success Rate**: > 95% (tasks succeed without errors)
- **Average Generation Time**: < 10 minutes per asset
- **Quality Acceptance Rate**: > 90% (admin approval rate)
- **API Cost per Asset**: < $X (to be determined with volume pricing)
- **Uptime Dependency**: Match Meshy.ai SLA (99.9%)

## Cost Analysis

### Per-Asset API Usage

**Base Model Generation:**
- 1x Image-to-3D call (standard: $X, high: $Y, ultra: $Z)
- Processing time: 5-10 minutes

**Material Variants (per variant):**
- 1x Retexture call per variant
- Example: 5 material variants = 5 additional API calls
- Total for 1 sword with 5 materials: 6 API calls

**Character with Rigging:**
- 1x Image-to-3D call
- 1x Rigging call
- Nx Retexture calls (if variants)
- Total for 1 character with rigging + 3 materials: 5 API calls

### Projected Costs (Example Game Launch)

Assuming 100 game-ready assets:
- 50 weapons (5 variants each): 50 base + 250 variants = 300 API calls
- 30 items (2 variants each): 30 base + 60 variants = 90 API calls
- 20 characters (3 variants + rigging): 20 base + 20 rigging + 60 variants = 100 API calls

**Total**: ~490 API calls for initial game launch

*Note: Actual costs depend on Meshy.ai pricing tier and quality settings*

## Technical Integration Details

### File: AICreationService.ts

**MeshyService Class** (lines 210-383)
- Base URL: `https://api.meshy.ai`
- Authentication: Bearer token (MESHY_API_KEY)
- Methods:
  - `startImageTo3D()` - Submit image-to-3D task
  - `getTaskStatus()` - Poll task status
  - `startRetextureTask()` - Submit retexture task
  - `getRetextureTaskStatus()` - Poll retexture status
  - `startRiggingTask()` - Submit rigging task
  - `getRiggingTaskStatus()` - Poll rigging status

### File: GenerationService.ts

**Image-to-3D Pipeline** (lines 392-614)
- Public image hosting required (Meshy can't access localhost)
- Quality-based configuration:
  - Polycount: 6k/12k/20k
  - Texture resolution: 1024/2048/4096
  - PBR: disabled/enabled
  - AI model: meshy-4/meshy-5
- Task polling with configurable intervals
- GLB download and normalization
- Metadata generation

**Retexturing Pipeline** (lines 616-763)
- Batch processing of material variants
- Input: base model task_id + style prompts
- Output: Separate GLB file per variant
- Metadata linking to base model

**Rigging Pipeline** (lines 765-919)
- Character-only (type=character)
- Height normalization option
- Animation extraction (walking, running)
- T-pose extraction for animation player
- Graceful degradation (continues without rigging on failure)

### File: RetextureService.ts

**MeshyClient Implementation** (lines 72-210)
- Custom HTTP client for Meshy API
- Retry logic with exponential backoff
- Connection pooling (keep-alive, max sockets)
- Progress callbacks for UI updates
- Timeout configuration per operation

**RetextureService** (lines 212-465)
- High-level retexturing workflow
- Asset metadata management
- Variant tracking and linking
- File system operations (download, save, copy)

## References

- **Meshy.ai Documentation**: https://docs.meshy.ai
- **Meshy.ai API Reference**: https://docs.meshy.ai/api-reference
- **Asset Forge Workflow**: `packages/asset-forge/ASSET_EXPORT_WORKFLOW.md`
- **Database Schema**: `packages/asset-forge/server/db/schema/assets.schema.ts`
- **Related ADRs**:
  - ADR-0004: Use PostgreSQL for Primary Database
  - ADR-0009: Semi-Automated Asset Approval Workflow

## Notes

### Why Meshy.ai Over Competitors

1. **Game-Ready Outputs**: Quad topology, configurable polycount, clean UVs
2. **Complete Pipeline**: Image-to-3D + Retexturing + Rigging in one API
3. **Fast Processing**: 5-10 minutes (vs hours with alternatives)
4. **Material Variants**: Retexturing without full regeneration saves time/cost
5. **Modern AI**: meshy-5 model produces high-quality results
6. **API Maturity**: Well-documented, stable, production-ready

### API Usage Optimization Strategies

1. **Caching**: Store generated models, avoid duplicate generations
2. **Admin Approval**: Only publish approved assets (ADR-0009)
3. **Quality Tiers**: Use standard for prototyping, ultra for production
4. **Batch Processing**: Generate variants in parallel
5. **Retry Logic**: Automatic retries on transient failures

### Partnership Opportunities

Given Asset Forge's heavy reliance on Meshy.ai, there are significant opportunities for partnership:

- **Volume Pricing**: Discounts for high API usage
- **API Credits**: Startup/indie developer programs
- **Early Access**: Beta features, new AI models
- **Technical Support**: Dedicated integration assistance
- **Case Study**: Showcase Asset Forge as Meshy.ai success story

See `MESHY_PARTNERSHIP_PROPOSAL.md` for detailed proposal.

### Future Enhancements

- **Webhook Support**: Replace polling with event-driven architecture
- **Batch API**: Submit multiple tasks in single request
- **Advanced Materials**: Custom shader parameters, normal maps
- **LOD Generation**: Multiple quality levels per asset
- **Asset Collections**: Generate entire sets with consistent style
- **Fine-Tuning**: Custom model training on game-specific assets

### Assumptions

- Meshy.ai maintains 99.9% uptime SLA
- API pricing remains stable or decreases with scale
- meshy-5 model quality continues to improve
- GLB format remains industry standard for game assets
- Meshy.ai provides sufficient rate limits for production use

### Constraints

- Must have internet connection for generation
- Cannot generate assets offline
- Processing time controlled by Meshy.ai (not instant)
- Quality ceiling limited by AI capabilities
- API costs scale linearly with usage (no free tier for production)

---

**Last Updated**: 2025-11-07
**Implementation Status**: Production (Phase 1-4 Complete)
**API Dependency**: Critical (100% reliance on Meshy.ai)
