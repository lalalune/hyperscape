/**
 * Core types for the AI Creation System
 */

import type { AssetMetadata } from './AssetMetadata'

// Base types
export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface BoundingBox {
  min: Vector3
  max: Vector3
  center: Vector3
  size: Vector3
}

// Generation types
export type AssetType = 'weapon' | 'armor' | 'consumable' | 'tool' | 'decoration' | 'character' | 'building' | 'resource' | 'misc'
export type WeaponType = 'sword' | 'axe' | 'bow' | 'staff' | 'shield' | 'dagger' | 'mace' | 'spear' | 'crossbow' | 'wand' | 'scimitar' | 'battleaxe' | 'longsword'
export type ArmorSlot = 'helmet' | 'chest' | 'legs' | 'boots' | 'gloves' | 'ring' | 'amulet' | 'cape' | 'shield'
export type CreatureType = 'biped' | 'quadruped' | 'flying' | 'aquatic' | 'other'
export type BuildingType = 'bank' | 'store' | 'house' | 'castle' | 'temple' | 'guild' | 'inn' | 'tower' | 'dungeon'
export type ToolType = 'pickaxe' | 'axe' | 'fishing_rod' | 'hammer' | 'knife' | 'tinderbox' | 'chisel'
export type ResourceType = 'ore' | 'bar' | 'log' | 'plank' | 'fish' | 'herb' | 'gem'
export type ConsumableType = 'food' | 'potion' | 'rune' | 'scroll' | 'teleport'

// Generation request
export interface GenerationRequest {
  id: string
  name: string
  description: string
  type: AssetType
  subtype?: WeaponType | ArmorSlot | BuildingType | ToolType | ResourceType | ConsumableType
  style?: 'realistic' | 'cartoon' | 'low-poly' | 'stylized'
  metadata?: {
    creatureType?: string
    armorSlot?: string  
    weaponType?: string
    buildingType?: string
    materialType?: string
    [key: string]: string | number | boolean | undefined
  }
}

// GDD Asset specification
export interface GDDAsset {
  name: string
  description: string
  type: string
  subtype?: string
  style?: string
  metadata?: {
    tier?: string
    level?: number
    gameId?: string
    rarity?: string
    attackLevel?: number
    strengthLevel?: number
    defenseLevel?: number
    [key: string]: string | number | boolean | undefined
  }
}

// Simple generation result for CLI
export interface SimpleGenerationResult {
  success: boolean
  assetId: string
  fileSize?: string
  modelUrl?: string
  error?: string
}

// Generation stages
export interface GenerationStage {
  stage: 'description' | 'image' | 'model' | 'remesh' | 'analysis' | 'final'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  output?: ImageGenerationResult | ModelGenerationResult | RemeshResult | 
    HardpointResult | ArmorPlacementResult | RiggingResult | BuildingAnalysisResult |
    { modelUrl: string; metadata: AssetMetadata } | string
  error?: string
  timestamp: Date
}

// Image generation result
export interface ImageGenerationResult {
  imageUrl: string
  prompt: string
  metadata: {
    model: string
    resolution: string
    quality?: string
    timestamp: string
  }
}

// 3D model generation result
export interface ModelGenerationResult {
  modelUrl: string
  format: 'glb' | 'fbx' | 'obj'
  polycount: number
  textureUrls?: {
    diffuse?: string
    normal?: string
    metallic?: string
    roughness?: string
  }
  metadata: {
    meshyTaskId: string
    processingTime: number
  }
}

// Remesh result
export interface RemeshResult {
  modelUrl: string
  originalPolycount: number
  remeshedPolycount: number
  targetPolycount: number
}

// Hardpoint analysis result
export interface HardpointResult {
  weaponType: WeaponType
  primaryGrip: {
    position: Vector3
    rotation: Quaternion
    confidence: number
  }
  secondaryGrip?: {
    position: Vector3
    rotation: Quaternion
    confidence: number
  }
  attachmentPoints: Array<{
    name: string
    position: Vector3
    rotation: Quaternion
  }>
}

// Armor placement result
export interface ArmorPlacementResult {
  slot: ArmorSlot
  attachmentPoint: Vector3
  rotation: Quaternion
  scale: Vector3
  deformationWeights?: number[]
}

// Rigging result
export interface RiggingResult {
  rigType: CreatureType
  bones: Array<{
    name: string
    position: Vector3
    rotation: Quaternion
    parent?: string
  }>
  animations?: string[]
}

// Building analysis result
export interface BuildingAnalysisResult {
  buildingType: BuildingType
  entryPoints: Array<{
    name: string
    position: Vector3
    rotation: Quaternion
    isMain: boolean
  }>
  interiorSpace?: {
    center: Vector3
    size: Vector3
  }
  functionalAreas: Array<{
    name: string
    type: 'counter' | 'vault' | 'display' | 'seating' | 'storage'
    position: Vector3
    size: Vector3
  }>
  npcPositions?: Array<{
    role: string
    position: Vector3
    rotation: Quaternion
  }>
  metadata?: {
    floors: number
    hasBasement: boolean
    hasRoof: boolean
  }
}

// Complete generation result
export interface GenerationResult {
  id: string
  request: GenerationRequest
  stages: GenerationStage[]
  imageResult?: ImageGenerationResult
  modelResult?: ModelGenerationResult
  remeshResult?: RemeshResult
  analysisResult?: HardpointResult | ArmorPlacementResult | RiggingResult | BuildingAnalysisResult
  finalAsset?: {
    modelUrl: string
    metadata: GenerationRequest & {
      analysisResult?: HardpointResult | ArmorPlacementResult | RiggingResult | BuildingAnalysisResult
      generatedAt: Date
      modelPath: string
    }
  }
  createdAt: Date
  updatedAt: Date
}

// Cache entry
export interface CacheEntry<T> {
  key: string
  value: T
  timestamp: Date
  ttl: number
}

// API configuration
export interface AICreationConfig {
  openai: {
    apiKey: string
    model?: string
    imageServerBaseUrl?: string
  }
  meshy: {
    apiKey: string
    baseUrl?: string
  }
  cache: {
    enabled: boolean
    ttl: number
    maxSize: number
  }
  output: {
    directory: string
    format: 'glb' | 'fbx' | 'obj'
  }
}

// Material preset for retexturing
export interface MaterialPreset {
  id: string
  name: string
  displayName: string
  category: string
  tier: number
  color: string
  stylePrompt?: string
  description?: string
}

// Note: Asset interface is now imported from AssetService.ts
// to avoid circular dependencies

// Navigation types
export * from './navigation'

// Export other type modules
export * from './AssetMetadata'
export * from './RiggingMetadata'
export * from './three'
export * from './common'
export * from './generation'
export * from './hand-rigging'

// Explicitly re-export GLTFAnimation, GLTFNode, and GLTFSkin as types for isolatedModules compatibility
export type {
  GLTFAnimation,
  GLTFNode,
  GLTFSkin,
} from './gltf'

// Re-export Asset from AssetService to maintain backward compatibility
export type { Asset } from '../services/api/AssetService' 