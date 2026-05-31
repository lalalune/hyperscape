/**
 * Elysia Schema Models
 * TypeBox schemas for request/response validation and OpenAPI documentation
 */

import { t, Static } from "elysia";

// ==================== Common Models ====================

/**
 * User authentication context from Privy JWT
 * Contains the authenticated user's identity information
 *
 * The UserContext is extracted from verified Privy authentication tokens
 * and provides user identity for ownership tracking and access control.
 */
export const UserContext = t.Object({
  privyId: t.Optional(t.String()), // Privy DID (Decentralized Identifier) from verified JWT
  walletAddress: t.Optional(t.String()), // User's Web3 wallet address (if linked to account)
  isAdmin: t.Optional(t.Boolean()), // Whether user is an admin (can modify any asset)
});

/**
 * Base authenticated request model
 * Extend this for endpoints requiring authentication
 *
 * This model provides a standard way to attach user context to requests.
 * Use with Elysia's t.Composite() to merge with your request schema:
 *
 * Example:
 * const MyAuthenticatedRequest = t.Composite([
 *   AuthenticatedRequest,
 *   t.Object({ myField: t.String() })
 * ])
 */
export const AuthenticatedRequest = t.Object({
  user: UserContext,
});

export const HealthResponse = t.Object({
  status: t.String(),
  timestamp: t.String(),
  services: t.Object({
    meshy: t.Boolean(),
    openai: t.Boolean(),
    database: t.Optional(t.Boolean()),
    comfy: t.Optional(t.Boolean()),
    comfyUrl: t.Optional(t.String()),
    hillDGX: t.Optional(t.Boolean()),
    hillDGXUrl: t.Optional(t.String()),
    generationProvider: t.Optional(t.String()),
    promptProvider: t.Optional(t.String()),
  }),
});

export const ErrorResponse = t.Object({
  error: t.String(),
});

export const SuccessResponse = t.Object({
  success: t.Boolean(),
  message: t.String(),
});

// ==================== Asset Models ====================

export const AssetMetadata = t.Object({
  id: t.String(),
  name: t.String(),
  gameId: t.Optional(t.String()),
  type: t.Optional(t.String()),
  subtype: t.Optional(t.String()),
  tier: t.Optional(t.Union([t.String(), t.Number()])),
  category: t.Optional(t.String()),
  description: t.Optional(t.String()),
  detailedPrompt: t.Optional(t.String()),
  modelUrl: t.Optional(t.String()),
  thumbnailUrl: t.Optional(t.String()),
  hasSpriteSheet: t.Optional(t.Boolean()),
  spriteCount: t.Optional(t.Number()),
  // Generation metadata
  generatedAt: t.Optional(t.String()),
  completedAt: t.Optional(t.String()),
  isBaseModel: t.Optional(t.Boolean()),
  materialVariants: t.Optional(t.Array(t.String())),
  isPlaceholder: t.Optional(t.Boolean()),
  hasModel: t.Optional(t.Boolean()),
  hasConceptArt: t.Optional(t.Boolean()),
  modelPath: t.Optional(t.String()),
  conceptArtUrl: t.Optional(t.String()),
  conceptArtPath: t.Optional(t.String()),
  gddCompliant: t.Optional(t.Boolean()),
  workflow: t.Optional(t.String()),
  meshyTaskId: t.Optional(t.String()),
  meshyStatus: t.Optional(t.String()),
  variants: t.Optional(t.Array(t.String())),
  variantCount: t.Optional(t.Number()),
  lastVariantGenerated: t.Optional(t.Union([t.String(), t.Null()])),
  // Variant metadata
  isVariant: t.Optional(t.Boolean()),
  parentBaseModel: t.Optional(t.String()),
  materialPreset: t.Optional(t.Any()),
  baseModelTaskId: t.Optional(t.String()),
  retextureTaskId: t.Optional(t.String()),
  retextureStatus: t.Optional(t.String()),
  // Character rigging
  isRigged: t.Optional(t.Boolean()),
  riggingTaskId: t.Optional(t.String()),
  riggingStatus: t.Optional(t.String()),
  rigType: t.Optional(t.String()),
  characterHeight: t.Optional(t.Number()),
  animations: t.Optional(t.Any()),
  riggedModelPath: t.Optional(t.String()),
  tposeModelPath: t.Optional(t.String()),
  supportsAnimation: t.Optional(t.Boolean()),
  animationCompatibility: t.Optional(t.Array(t.String())),
  // Ownership tracking (Phase 1)
  createdBy: t.Optional(t.String()), // Privy DID
  walletAddress: t.Optional(t.String()), // User's wallet address
  isPublic: t.Optional(t.Boolean()), // Default true
  createdAt: t.Optional(t.String()),
  updatedAt: t.Optional(t.String()),
  lastModified: t.Optional(t.String()),
});

export const AssetList = t.Array(AssetMetadata);

/**
 * Asset API Response
 * Full asset structure returned by the /api/assets endpoint
 * Includes the complete metadata object from metadata.json files
 */
export const AssetResponse = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  type: t.String(),
  metadata: t.Any(), // Full metadata.json content (dynamic structure with many optional fields)
  hasModel: t.Boolean(),
  modelFile: t.Optional(t.String()),
  modelFormat: t.Optional(t.Union([t.Literal("glb"), t.Literal("vrm")])), // Model file format
  generatedAt: t.Optional(t.String()),
});

export const AssetListResponse = t.Array(AssetResponse);

export const AssetUpdate = t.Object({
  name: t.Optional(t.String()),
  type: t.Optional(t.String()),
  tier: t.Optional(t.Number()),
  category: t.Optional(t.String()),
  metadata: t.Optional(t.Record(t.String(), t.Any())),
});

export const BatchApplyFittingRequest = t.Object({
  config: t.Record(t.String(), t.Any()),
  assetIds: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
});

export const BatchApplyFittingResponse = t.Object({
  success: t.Boolean(),
  updated: t.Number(),
});

export const SaveAlignedResponse = t.Object({
  success: t.Boolean(),
  path: t.String(),
});

export const DeleteAssetQuery = t.Object({
  includeVariants: t.Optional(t.String()),
});

export const DeleteAssetResponse = t.Object({
  success: t.Boolean(),
  message: t.String(),
});

// ==================== Material Preset Models ====================

export const MaterialPreset = t.Object({
  id: t.String({ minLength: 1 }),
  name: t.Optional(t.String()),
  displayName: t.String({ minLength: 1 }),
  stylePrompt: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  category: t.Optional(t.String()),
  tier: t.Optional(t.Union([t.String(), t.Number()])),
  color: t.Optional(t.String()),
});

export const MaterialPresetList = t.Array(MaterialPreset);

export const MaterialPresetSaveResponse = t.Object({
  success: t.Boolean(),
  message: t.String(),
});

// ==================== Retexture Models ====================

export const RetextureRequest = t.Object({
  baseAssetId: t.String({ minLength: 1 }),
  materialPreset: MaterialPreset,
  outputName: t.Optional(t.String()),
  // User context for ownership tracking
  user: t.Optional(UserContext),
});

export const RetextureResponse = t.Object({
  success: t.Boolean(),
  assetId: t.String(),
  url: t.String(),
  message: t.String(),
});

export const RegenerateBaseResponse = t.Object({
  success: t.Boolean(),
  assetId: t.String(),
  url: t.String(),
  message: t.String(),
});

// ==================== Generation Pipeline Models ====================

export const PipelineConfig = t.Object({
  description: t.String({ minLength: 1 }),
  assetId: t.String({ minLength: 1 }),
  name: t.String({ minLength: 1 }),
  type: t.String({ minLength: 1 }),
  subtype: t.String({ minLength: 1 }),
  generationType: t.Optional(t.String()),
  tier: t.Optional(t.Number()),
  quality: t.Optional(t.String()),
  style: t.Optional(t.String()),
  enableRigging: t.Optional(t.Boolean()),
  enableRetexturing: t.Optional(t.Boolean()),
  enableSprites: t.Optional(t.Boolean()),
  materialPresets: t.Optional(t.Array(MaterialPreset)),
  customPrompts: t.Optional(
    t.Object({
      gameStyle: t.Optional(t.String()),
    }),
  ),
  metadata: t.Optional(
    t.Object({
      characterHeight: t.Optional(t.Number()),
      useGPT5Enhancement: t.Optional(t.Boolean()),
      provider: t.Optional(t.String()),
      pixel3DApiName: t.Optional(t.String()),
    }),
  ),
  // User-provided reference image (skips AI image generation when provided)
  referenceImage: t.Optional(
    t.Object({
      source: t.String(), // 'url' or 'data'
      url: t.Optional(t.String()),
      dataUrl: t.Optional(t.String()),
    }),
  ),
  // User context for ownership tracking
  user: t.Optional(UserContext),
});

export const PipelineResponse = t.Object({
  pipelineId: t.String(),
  status: t.String(),
  message: t.String(),
});

export const PipelineStatus = t.Object({
  id: t.String(),
  status: t.String(),
  progress: t.Number(),
  stages: t.Any(), // Complex nested type, using Any for simplicity
  results: t.Record(t.String(), t.Any()),
  error: t.Optional(t.String()),
  createdAt: t.String(),
  completedAt: t.Optional(t.String()),
});

// ==================== Sprite Models ====================

export const SpriteData = t.Object({
  angle: t.Number(),
  imageData: t.String({ minLength: 1 }),
});

export const SpriteSaveRequest = t.Object({
  sprites: t.Array(SpriteData),
  config: t.Optional(
    t.Object({
      resolution: t.Optional(t.Number()),
      angles: t.Optional(t.Number()),
    }),
  ),
});

export const SpriteSaveResponse = t.Object({
  success: t.Boolean(),
  message: t.String(),
  spritesDir: t.String(),
  spriteFiles: t.Array(t.String()),
});

// ==================== VRM Upload Models ====================

export const VRMUploadResponse = t.Object({
  success: t.Boolean(),
  url: t.String(),
  message: t.String(),
});

// ==================== Weapon Detection Models ====================

export const GripBounds = t.Object({
  minX: t.Number(),
  minY: t.Number(),
  maxX: t.Number(),
  maxY: t.Number(),
});

export const DetectedParts = t.Object({
  blade: t.Optional(t.String()),
  handle: t.Optional(t.String()),
  guard: t.Optional(t.String()),
});

export const GripData = t.Object({
  gripBounds: GripBounds,
  confidence: t.Number(),
  weaponType: t.String(),
  gripDescription: t.String(),
  detectedParts: t.Optional(DetectedParts),
});

export const WeaponHandleDetectRequest = t.Object({
  image: t.String({ minLength: 1 }),
  angle: t.Optional(t.String()),
  promptHint: t.Optional(t.String()),
});

export const WeaponHandleDetectResponse = t.Object({
  success: t.Boolean(),
  gripData: t.Optional(GripData),
  error: t.Optional(t.String()),
  originalImage: t.Optional(t.String()),
});

export const OrientationData = t.Object({
  needsFlip: t.Boolean(),
  currentOrientation: t.String(),
  reason: t.String(),
});

export const WeaponOrientationDetectRequest = t.Object({
  image: t.String({ minLength: 1 }),
});

export const WeaponOrientationDetectResponse = t.Object({
  success: t.Boolean(),
  needsFlip: t.Optional(t.Boolean()),
  currentOrientation: t.Optional(t.String()),
  reason: t.Optional(t.String()),
  error: t.Optional(t.String()),
});

// ==================== ElevenLabs Voice Generation Models ====================

export const VoiceSettings = t.Object({
  stability: t.Optional(t.Number()),
  similarity_boost: t.Optional(t.Number()),
  style: t.Optional(t.Number()),
  use_speaker_boost: t.Optional(t.Boolean()),
});

export const Voice = t.Object({
  voice_id: t.String(),
  name: t.String(),
  category: t.Optional(t.String()),
  description: t.Optional(t.String()),
  labels: t.Optional(t.Record(t.String(), t.String())),
  preview_url: t.Optional(t.String()),
});

export const GenerateVoiceRequest = t.Object({
  text: t.String({ minLength: 1 }),
  voiceId: t.String({ minLength: 1 }),
  npcId: t.Optional(t.String()),
  settings: t.Optional(VoiceSettings),
});

export const BatchVoiceRequest = t.Object({
  texts: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
  voiceId: t.String({ minLength: 1 }),
  npcId: t.Optional(t.String()),
  settings: t.Optional(VoiceSettings),
});

export const VoiceLibraryResponse = t.Object({
  voices: t.Array(Voice),
  count: t.Number(),
});

export const GenerateVoiceResponse = t.Object({
  success: t.Boolean(),
  audioData: t.Optional(t.String()),
  npcId: t.Optional(t.String()),
  error: t.Optional(t.String()),
});

export const BatchVoiceResponse = t.Object({
  successful: t.Number(),
  total: t.Number(),
  results: t.Array(
    t.Object({
      success: t.Boolean(),
      audioData: t.Optional(t.String()),
      text: t.String(),
      error: t.Optional(t.String()),
    }),
  ),
});

// ==================== ElevenLabs Music Generation Models ====================

export const GenerateMusicRequest = t.Object({
  prompt: t.Optional(t.String()),
  musicLengthMs: t.Optional(t.Number({ minimum: 1000, maximum: 300000 })),
  compositionPlan: t.Optional(t.Any()),
  forceInstrumental: t.Optional(t.Boolean()),
  respectSectionsDurations: t.Optional(t.Boolean()),
  storeForInpainting: t.Optional(t.Boolean()),
  modelId: t.Optional(t.String()),
  outputFormat: t.Optional(t.String()),
});

export const CreateCompositionPlanRequest = t.Object({
  prompt: t.String({ minLength: 1 }),
  musicLengthMs: t.Optional(t.Number()),
  sourceCompositionPlan: t.Optional(t.Any()),
  modelId: t.Optional(t.String()),
});

export const BatchMusicRequest = t.Object({
  tracks: t.Array(GenerateMusicRequest, { minItems: 1, maxItems: 10 }),
});

// ==================== ElevenLabs Sound Effects Models ====================

export const GenerateSfxRequest = t.Object({
  text: t.String({ minLength: 1 }),
  durationSeconds: t.Optional(t.Number({ minimum: 0.5, maximum: 22 })),
  promptInfluence: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  loop: t.Optional(t.Boolean()),
});

export const BatchSfxRequest = t.Object({
  effects: t.Array(GenerateSfxRequest, { minItems: 1, maxItems: 20 }),
});

export const BatchSfxResponse = t.Object({
  effects: t.Array(
    t.Object({
      index: t.Number(),
      success: t.Boolean(),
      audioBuffer: t.Optional(t.String()),
      text: t.String(),
      size: t.Optional(t.Number()),
      error: t.Optional(t.String()),
    }),
  ),
  successful: t.Number(),
  total: t.Number(),
});

export const SfxEstimateResponse = t.Object({
  duration: t.Union([t.String(), t.Number()]),
  credits: t.Number(),
  estimatedCostUSD: t.String(),
});

// ==================== Content Generation Models ====================

const ModelQuality = t.Union([
  t.Literal("quality"),
  t.Literal("speed"),
  t.Literal("balanced"),
]);

// Dialogue Generation
export const DialogueNodeResponse = t.Object({
  id: t.String(),
  text: t.String(),
  responses: t.Optional(
    t.Array(
      t.Object({
        text: t.String(),
        nextNodeId: t.Optional(t.String()),
      }),
    ),
  ),
});

export const GenerateDialogueRequest = t.Object({
  npcName: t.String({ minLength: 1 }),
  npcPersonality: t.String({ minLength: 1 }),
  context: t.Optional(t.String()),
  existingNodes: t.Optional(t.Array(DialogueNodeResponse)),
  quality: t.Optional(ModelQuality),
});

export const GenerateDialogueResponse = t.Object({
  nodes: t.Array(DialogueNodeResponse),
  rawResponse: t.String(),
});

// NPC Generation
export const NPCDataResponse = t.Object({
  id: t.String(),
  name: t.String(),
  archetype: t.String(),
  personality: t.Object({
    traits: t.Array(t.String()),
    background: t.String(),
    motivations: t.Array(t.String()),
  }),
  appearance: t.Object({
    description: t.String(),
    equipment: t.Array(t.String()),
  }),
  dialogue: t.Object({
    greeting: t.String(),
    farewell: t.String(),
    idle: t.Array(t.String()),
  }),
  behavior: t.Object({
    role: t.String(),
    schedule: t.String(),
    relationships: t.Array(t.String()),
  }),
  metadata: t.Any(),
});

export const GenerateNPCRequest = t.Object({
  archetype: t.String({ minLength: 1 }),
  prompt: t.String({ minLength: 1 }),
  context: t.Optional(t.String()),
  quality: t.Optional(ModelQuality),
});

export const GenerateNPCResponse = t.Object({
  npc: NPCDataResponse,
  rawResponse: t.String(),
});

// Quest Generation
export const QuestObjective = t.Object({
  description: t.String(),
  type: t.Union([
    t.Literal("kill"),
    t.Literal("collect"),
    t.Literal("talk"),
    t.Literal("explore"),
  ]),
  target: t.String(),
  count: t.Number(),
});

export const QuestDataResponse = t.Object({
  id: t.String(),
  title: t.String(),
  description: t.String(),
  objectives: t.Array(QuestObjective),
  rewards: t.Object({
    experience: t.Number(),
    gold: t.Number(),
    items: t.Array(t.String()),
  }),
  requirements: t.Object({
    level: t.Number(),
    previousQuests: t.Array(t.String()),
  }),
  npcs: t.Array(t.String()),
  location: t.String(),
  story: t.String(),
  difficulty: t.String(),
  questType: t.String(),
  metadata: t.Any(),
});

export const GenerateQuestRequest = t.Object({
  questType: t.String({ minLength: 1 }),
  difficulty: t.String({ minLength: 1 }),
  theme: t.Optional(t.String()),
  context: t.Optional(t.String()),
  quality: t.Optional(ModelQuality),
});

export const GenerateQuestResponse = t.Object({
  quest: QuestDataResponse,
  rawResponse: t.String(),
});

// Lore Generation
export const LoreDataResponse = t.Object({
  id: t.String(),
  title: t.String(),
  category: t.String(),
  content: t.String(),
  summary: t.String(),
  relatedTopics: t.Array(t.String()),
  timeline: t.Optional(t.String()),
  characters: t.Optional(t.Array(t.String())),
  metadata: t.Any(),
});

export const GenerateLoreRequest = t.Object({
  category: t.String({ minLength: 1 }),
  topic: t.String({ minLength: 1 }),
  context: t.Optional(t.String()),
  quality: t.Optional(ModelQuality),
});

export const GenerateLoreResponse = t.Object({
  lore: LoreDataResponse,
  rawResponse: t.String(),
});

// ==================== Manifest Models ====================

export const ManifestListItem = t.Object({
  name: t.String(),
  filename: t.String(),
  description: t.String(),
  category: t.Union([
    t.Literal("world"),
    t.Literal("entities"),
    t.Literal("items"),
    t.Literal("progression"),
    t.Literal("audio"),
    t.Literal("generated"),
  ]),
  editable: t.Boolean(),
  lastModified: t.String(),
  size: t.Number(),
});

export const ManifestListResponse = t.Array(ManifestListItem);

export const ManifestContent = t.Object({
  name: t.String(),
  filename: t.String(),
  content: t.Any(), // Dynamic JSON content
  lastModified: t.String(),
  size: t.Number(),
});

export const ManifestWriteRequest = t.Object({
  content: t.Any(), // Dynamic JSON content to write
});

export const ManifestWriteResponse = t.Object({
  success: t.Boolean(),
  name: t.String(),
  filename: t.String(),
  backupPath: t.Union([t.String(), t.Null()]),
  timestamp: t.String(),
});

export const ValidationError = t.Object({
  path: t.String(),
  message: t.String(),
  value: t.Any(),
});

export const ManifestValidationResult = t.Object({
  valid: t.Boolean(),
  errors: t.Array(ValidationError),
});

export const ManifestBackupList = t.Array(t.String());

export const ManifestRestoreRequest = t.Object({
  backupFilename: t.String({ minLength: 1 }),
});

// ==================== LOD Pipeline Models ====================

export const LODLevel = t.Union([
  t.Literal("lod0"),
  t.Literal("lod1"),
  t.Literal("lod2"),
  t.Literal("imposter"),
]);

export const LODDistanceThresholds = t.Object({
  lod1: t.Optional(t.Number()),
  lod2: t.Optional(t.Number()),
  imposter: t.Number(),
  fadeOut: t.Number(),
});

export const LODSettings = t.Object({
  distanceThresholds: t.Record(t.String(), LODDistanceThresholds),
  dissolve: t.Object({
    closeRangeStart: t.Number(),
    closeRangeEnd: t.Number(),
    transitionDuration: t.Number(),
  }),
  vertexBudgets: t.Record(
    t.String(),
    t.Object({
      lod0: t.Number(),
      lod1: t.Number(),
      lod2: t.Number(),
    }),
  ),
});

export const LODBakeRequest = t.Object({
  assetPaths: t.Optional(t.Array(t.String())),
  categories: t.Optional(
    t.Array(
      t.Union([
        t.Literal("tree"),
        t.Literal("bush"),
        t.Literal("rock"),
        t.Literal("fern"),
        t.Literal("flower"),
        t.Literal("ivy"),
        t.Literal("fallen"),
        t.Literal("building"),
        t.Literal("prop"),
      ]),
    ),
  ),
  levels: t.Optional(t.Array(LODLevel)),
  dryRun: t.Optional(t.Boolean()),
  force: t.Optional(t.Boolean()),
});

export const LODBakeAssetResult = t.Object({
  assetId: t.String(),
  level: LODLevel,
  success: t.Boolean(),
  input: t.String(),
  output: t.Optional(t.String()),
  originalVerts: t.Number(),
  finalVerts: t.Optional(t.Number()),
  reduction: t.Optional(t.Number()),
  error: t.Optional(t.String()),
  duration: t.Optional(t.Number()),
});

export const LODBakeJobStatus = t.Object({
  jobId: t.String(),
  status: t.Union([
    t.Literal("queued"),
    t.Literal("running"),
    t.Literal("completed"),
    t.Literal("failed"),
    t.Literal("cancelled"),
  ]),
  progress: t.Number(),
  totalAssets: t.Number(),
  processedAssets: t.Number(),
  currentAsset: t.Optional(t.String()),
  currentLevel: t.Optional(LODLevel),
  results: t.Optional(t.Array(LODBakeAssetResult)),
  error: t.Optional(t.String()),
  startedAt: t.String(),
  completedAt: t.Optional(t.String()),
  estimatedRemaining: t.Optional(t.Number()),
});

export const LODBakeResponse = t.Object({
  jobId: t.String(),
  status: t.String(),
  message: t.String(),
});

// ==================== VAT Pipeline Models ====================

export const VATBakeRequest = t.Object({
  modelPaths: t.Optional(t.Array(t.String())),
  mobIds: t.Optional(t.Array(t.String())),
  fps: t.Optional(t.Number({ minimum: 1, maximum: 60 })),
  maxFrames: t.Optional(t.Number({ minimum: 1, maximum: 120 })),
  outputFormat: t.Optional(t.Union([t.Literal("bin"), t.Literal("ktx2")])),
  dryRun: t.Optional(t.Boolean()),
});

export const VATAnimationInfo = t.Object({
  name: t.String(),
  frames: t.Number(),
  startFrame: t.Number(),
  duration: t.Number(),
  loop: t.Boolean(),
});

export const VATBakeJobStatus = t.Object({
  jobId: t.String(),
  status: t.Union([
    t.Literal("queued"),
    t.Literal("running"),
    t.Literal("completed"),
    t.Literal("failed"),
  ]),
  progress: t.Number(),
  totalModels: t.Number(),
  processedModels: t.Number(),
  currentModel: t.Optional(t.String()),
  results: t.Optional(
    t.Array(
      t.Object({
        modelName: t.String(),
        vertexCount: t.Number(),
        totalFrames: t.Number(),
        textureWidth: t.Number(),
        textureHeight: t.Number(),
        animations: t.Array(VATAnimationInfo),
        outputPath: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
    ),
  ),
  error: t.Optional(t.String()),
  startedAt: t.String(),
  completedAt: t.Optional(t.String()),
});

export const VATBakeResponse = t.Object({
  jobId: t.String(),
  status: t.String(),
  message: t.String(),
});

// ==================== Imposter Pipeline Models ====================

export const OctahedralImpostorConfig = t.Object({
  atlasWidth: t.Optional(t.Number({ minimum: 64, maximum: 4096 })),
  atlasHeight: t.Optional(t.Number({ minimum: 64, maximum: 4096 })),
  gridSizeX: t.Optional(t.Number({ minimum: 4, maximum: 32 })),
  gridSizeY: t.Optional(t.Number({ minimum: 4, maximum: 32 })),
  octType: t.Optional(t.Union([t.Literal("HEMI"), t.Literal("FULL")])),
  backgroundColor: t.Optional(t.Number()),
  backgroundAlpha: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
});

export const ImpostorMetadata = t.Object({
  assetId: t.String(),
  category: t.String(),
  modelPath: t.String(),
  gridSizeX: t.Number(),
  gridSizeY: t.Number(),
  octType: t.Union([t.Literal("HEMI"), t.Literal("FULL")]),
  atlasWidth: t.Number(),
  atlasHeight: t.Number(),
  boundingSphereRadius: t.Number(),
  boundingSphereCenterY: t.Number(),
  animationFrame: t.Number(),
  animationName: t.String(),
  atlasPath: t.String(),
  generatedAt: t.String(),
  version: t.Number(),
});

export const ImpostorBakeRequest = t.Object({
  assetIds: t.Optional(t.Array(t.String())),
  categories: t.Optional(
    t.Array(
      t.Union([t.Literal("mob"), t.Literal("character"), t.Literal("npc")]),
    ),
  ),
  config: t.Optional(OctahedralImpostorConfig),
  force: t.Optional(t.Boolean()),
});

export const ImpostorBakeResult = t.Object({
  assetId: t.String(),
  success: t.Boolean(),
  metadata: t.Optional(ImpostorMetadata),
  atlasPath: t.Optional(t.String()),
  error: t.Optional(t.String()),
  duration: t.Number(),
});

export const ImpostorBakeJobStatus = t.Object({
  jobId: t.String(),
  status: t.Union([
    t.Literal("queued"),
    t.Literal("running"),
    t.Literal("completed"),
    t.Literal("failed"),
    t.Literal("cancelled"),
  ]),
  progress: t.Number(),
  totalAssets: t.Number(),
  processedAssets: t.Number(),
  currentAsset: t.Optional(t.String()),
  results: t.Array(ImpostorBakeResult),
  error: t.Optional(t.String()),
  startedAt: t.String(),
  completedAt: t.Optional(t.String()),
});

export const ImpostorBakeResponse = t.Object({
  jobId: t.String(),
  status: t.String(),
  message: t.String(),
});

export const ImpostorBakeTask = t.Object({
  assetId: t.String(),
  modelPath: t.String(),
  category: t.String(),
  config: OctahedralImpostorConfig,
  outputPath: t.String(),
});

export const ImpostorAssetStatus = t.Object({
  assetId: t.String(),
  name: t.String(),
  category: t.String(),
  modelPath: t.String(),
  hasImposter: t.Boolean(),
  imposterPath: t.Optional(t.String()),
  generatedAt: t.Optional(t.String()),
  config: t.Optional(OctahedralImpostorConfig),
});

export const ImpostorStats = t.Object({
  totalImposters: t.Number(),
  byCategory: t.Record(t.String(), t.Number()),
  totalSize: t.Number(),
  oldestImposter: t.Optional(t.String()),
  newestImposter: t.Optional(t.String()),
});

// ==================== Type Exports ====================
// Export TypeScript types for use in implementation

export type ManifestListItemType = Static<typeof ManifestListItem>;
export type ManifestContentType = Static<typeof ManifestContent>;
export type ManifestWriteResponseType = Static<typeof ManifestWriteResponse>;
export type LODSettingsType = Static<typeof LODSettings>;
export type LODBakeRequestType = Static<typeof LODBakeRequest>;
export type VATBakeRequestType = Static<typeof VATBakeRequest>;
export type UserContextType = Static<typeof UserContext>;
export type AuthenticatedRequestType = Static<typeof AuthenticatedRequest>;
export type HealthResponseType = Static<typeof HealthResponse>;
export type AssetMetadataType = Static<typeof AssetMetadata>;
export type RetextureRequestType = Static<typeof RetextureRequest>;
export type PipelineConfigType = Static<typeof PipelineConfig>;
export type WeaponHandleDetectRequestType = Static<
  typeof WeaponHandleDetectRequest
>;
export type WeaponOrientationDetectRequestType = Static<
  typeof WeaponOrientationDetectRequest
>;
export type GenerateVoiceRequestType = Static<typeof GenerateVoiceRequest>;
export type GenerateMusicRequestType = Static<typeof GenerateMusicRequest>;
export type GenerateSfxRequestType = Static<typeof GenerateSfxRequest>;
