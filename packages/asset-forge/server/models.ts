/**
 * Elysia Schema Models
 * TypeBox schemas for request/response validation and OpenAPI documentation
 */

import { t, Static } from 'elysia'

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
  isAdmin: t.Optional(t.Boolean()) // Whether user is an admin (can modify any asset)
})

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
  user: UserContext
})

export const HealthResponse = t.Object({
  status: t.String(),
  timestamp: t.String(),
  services: t.Object({
    meshy: t.Boolean(),
    openai: t.Boolean()
  })
})

export const ErrorResponse = t.Object({
  error: t.String()
})

export const SuccessResponse = t.Object({
  success: t.Boolean(),
  message: t.String()
})

// ==================== Asset Models ====================

export const AssetMetadata = t.Object({
  id: t.String(),
  name: t.String(),
  type: t.Optional(t.String()),
  tier: t.Optional(t.Number()),
  category: t.Optional(t.String()),
  modelUrl: t.Optional(t.String()),
  thumbnailUrl: t.Optional(t.String()),
  hasSpriteSheet: t.Optional(t.Boolean()),
  spriteCount: t.Optional(t.Number()),
  // Ownership tracking (Phase 1)
  createdBy: t.Optional(t.String()), // Privy DID
  walletAddress: t.Optional(t.String()), // User's wallet address
  isPublic: t.Optional(t.Boolean()), // Default true
  createdAt: t.Optional(t.String()),
  updatedAt: t.Optional(t.String())
})

export const AssetList = t.Array(AssetMetadata)

export const AssetUpdate = t.Object({
  name: t.Optional(t.String()),
  type: t.Optional(t.String()),
  tier: t.Optional(t.Number()),
  category: t.Optional(t.String())
})

export const DeleteAssetQuery = t.Object({
  includeVariants: t.Optional(t.String())
})

export const DeleteAssetResponse = t.Object({
  success: t.Boolean(),
  message: t.String()
})

// ==================== Material Preset Models ====================

export const MaterialPreset = t.Object({
  id: t.String({ minLength: 1 }),
  name: t.Optional(t.String()),
  displayName: t.String({ minLength: 1 }),
  stylePrompt: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  category: t.Optional(t.String()),
  tier: t.Optional(t.Union([t.String(), t.Number()])),
  color: t.Optional(t.String())
})

export const MaterialPresetList = t.Array(MaterialPreset)

export const MaterialPresetSaveResponse = t.Object({
  success: t.Boolean(),
  message: t.String()
})

// ==================== Retexture Models ====================

export const RetextureRequest = t.Object({
  baseAssetId: t.String({ minLength: 1 }),
  materialPreset: MaterialPreset,
  outputName: t.Optional(t.String()),
  // User context for ownership tracking
  user: t.Optional(UserContext)
})

export const RetextureResponse = t.Object({
  success: t.Boolean(),
  assetId: t.String(),
  url: t.String(),
  message: t.String()
})

export const RegenerateBaseResponse = t.Object({
  success: t.Boolean(),
  assetId: t.String(),
  url: t.String(),
  message: t.String()
})

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
  customPrompts: t.Optional(t.Object({
    gameStyle: t.Optional(t.String())
  })),
  metadata: t.Optional(t.Object({
    characterHeight: t.Optional(t.Number()),
    useGPT4Enhancement: t.Optional(t.Boolean())
  })),
  // User context for ownership tracking
  user: t.Optional(UserContext)
})

export const PipelineResponse = t.Object({
  pipelineId: t.String(),
  status: t.String(),
  message: t.String()
})

export const PipelineStatus = t.Object({
  id: t.String(),
  status: t.String(),
  progress: t.Number(),
  stages: t.Any(), // Complex nested type, using Any for simplicity
  results: t.Record(t.String(), t.Any()),
  error: t.Optional(t.String()),
  createdAt: t.String(),
  completedAt: t.Optional(t.String())
})

// ==================== Sprite Models ====================

export const SpriteData = t.Object({
  angle: t.Number(),
  imageData: t.String({ minLength: 1 })
})

export const SpriteSaveRequest = t.Object({
  sprites: t.Array(SpriteData),
  config: t.Optional(t.Object({
    resolution: t.Optional(t.Number()),
    angles: t.Optional(t.Number())
  }))
})

export const SpriteSaveResponse = t.Object({
  success: t.Boolean(),
  message: t.String(),
  spritesDir: t.String(),
  spriteFiles: t.Array(t.String())
})

// ==================== VRM Upload Models ====================

export const VRMUploadResponse = t.Object({
  success: t.Boolean(),
  url: t.String(),
  message: t.String()
})

// ==================== Weapon Detection Models ====================

export const GripBounds = t.Object({
  minX: t.Number(),
  minY: t.Number(),
  maxX: t.Number(),
  maxY: t.Number()
})

export const DetectedParts = t.Object({
  blade: t.Optional(t.String()),
  handle: t.Optional(t.String()),
  guard: t.Optional(t.String())
})

export const GripData = t.Object({
  gripBounds: GripBounds,
  confidence: t.Number(),
  weaponType: t.String(),
  gripDescription: t.String(),
  detectedParts: t.Optional(DetectedParts)
})

export const WeaponHandleDetectRequest = t.Object({
  image: t.String({ minLength: 1 }),
  angle: t.Optional(t.String()),
  promptHint: t.Optional(t.String())
})

export const WeaponHandleDetectResponse = t.Object({
  success: t.Boolean(),
  gripData: t.Optional(GripData),
  error: t.Optional(t.String()),
  originalImage: t.Optional(t.String())
})

export const OrientationData = t.Object({
  needsFlip: t.Boolean(),
  currentOrientation: t.String(),
  reason: t.String()
})

export const WeaponOrientationDetectRequest = t.Object({
  image: t.String({ minLength: 1 })
})

export const WeaponOrientationDetectResponse = t.Object({
  success: t.Boolean(),
  needsFlip: t.Optional(t.Boolean()),
  currentOrientation: t.Optional(t.String()),
  reason: t.Optional(t.String()),
  error: t.Optional(t.String())
})

// ==================== Type Exports ====================
// Export TypeScript types for use in implementation

export type UserContextType = Static<typeof UserContext>
export type AuthenticatedRequestType = Static<typeof AuthenticatedRequest>
export type HealthResponseType = Static<typeof HealthResponse>
export type AssetMetadataType = Static<typeof AssetMetadata>
export type RetextureRequestType = Static<typeof RetextureRequest>
export type PipelineConfigType = Static<typeof PipelineConfig>
export type WeaponHandleDetectRequestType = Static<typeof WeaponHandleDetectRequest>
export type WeaponOrientationDetectRequestType = Static<typeof WeaponOrientationDetectRequest>
