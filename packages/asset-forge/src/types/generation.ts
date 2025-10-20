import { AssetMetadata, BaseAssetMetadata, AssetType } from './AssetMetadata'
// import { ExtendedAssetMetadata } from './RiggingMetadata'

import { Asset } from '@/services/api/AssetService'

// Extended GeneratedAsset type that includes all UI-specific properties
export interface GeneratedAsset extends Asset {
  status: string
  pipelineId?: string
  modelUrl?: string
  conceptArtUrl?: string
  variants?: Asset[] | Array<{ name: string; modelUrl: string; id?: string }>
  hasSpriteMetadata?: boolean
  hasSprites?: boolean
  sprites?: Array<{ angle: number; imageUrl: string }> | null
  createdAt?: string
  modelFile?: string
}

// Pipeline stage for UI display
export interface PipelineStageDisplay {
  id: string
  name: string
  icon?: React.ReactNode
  description: string
  status: 'idle' | 'active' | 'completed' | 'failed' | 'skipped'
}

// Custom material type for generation
export interface CustomMaterial {
  name: string
  prompt: string
  color?: string
  displayName?: string
}

// Custom asset type
export interface CustomAssetType {
  name: string
  prompt: string
}

// Extended metadata that includes rigging and animation info
// This is a partial representation of asset metadata used during generation
export interface GenerationAssetMetadata {
  // Identity
  id: string
  gameId: string
  name: string
  description: string
  type: AssetType
  subtype: string
  
  // Generation specific
  meshyTaskId?: string
  generationMethod?: 'gpt-image-meshy' | 'direct-meshy' | 'manual' | 'placeholder'
  
  // Rigging specific
  isRigged?: boolean
  animations?: Record<string, {
    name?: string
    duration?: number
    loop?: boolean
    fps?: number
  }>
  riggedModelPath?: string
  characterHeight?: number
  
  // Files
  hasModel?: boolean
  modelPath?: string
  
  // Variants
  variants?: string[] // For base assets
  
  // Timestamps
  generatedAt?: string
  createdAt?: string
  updatedAt?: string
  
  // UI properties
  tier?: string
  format?: string
  gripDetected?: boolean
  requiresAnimationStrip?: boolean
}

// Generation Pipeline Types (extracted from GenerationPipelineService)

export interface GenerationConfig {
  name: string
  type: string  // Now flexible to support any game type
  subtype: string
  description: string
  style?: string  // Now flexible to support any art style
  quality?: 'standard' | 'high' | 'ultra'
  assetId?: string
  tier?: string
  metadata?: {
    creatureType?: string
    armorSlot?: string
    weaponType?: string
    buildingType?: string
    materialType?: string
    [key: string]: string | number | boolean | undefined
  }
  
  // Generation type
  generationType?: 'item' | 'avatar'
  
  // Optional user-provided reference image to bypass auto image generation
  referenceImage?: {
    source: 'url' | 'data'
    url?: string
    dataUrl?: string
  }
  
  // Pipeline stages control
  enableGeneration?: boolean
  enableRetexturing?: boolean
  enableSprites?: boolean
  enableRigging?: boolean
  
  // Rigging options
  riggingOptions?: {
    heightMeters?: number
  }
  
  // Legacy fields for backward compatibility
  generateVariants?: boolean
  variantMaterials?: string[]
  generateSprites?: boolean
  
  // New configuration options
  materialPresets?: Array<{
    id: string
    name: string
    displayName: string
    category: string
    tier: number
    color: string
    stylePrompt: string
  }>
  spriteConfig?: {
    angles: number
    resolution: number
    backgroundColor: string
  }
  
  // Custom prompts
  customPrompts?: {
    gameStyle?: string
    assetType?: string
  }
}

export interface PipelineStage {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  message?: string
  error?: string
  startTime?: Date
  endTime?: Date
}

export interface PipelineResult {
  id: string
  config: GenerationConfig
  stages: PipelineStage[]
  baseAsset?: BaseAssetMetadata
  variants?: AssetMetadata[]
  sprites?: SpriteResult[]
  status: 'running' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
}

export interface SpriteResult {
  angle: string
  imageUrl: string
  width: number
  height: number
}

export interface PipelineServiceConfig {
  openaiApiKey?: string
  meshyApiKey?: string
  imageServerBaseUrl?: string
} 