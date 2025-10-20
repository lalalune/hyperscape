import { GenerationConfig, MaterialPreset } from '../types'

interface BuildConfigOptions {
  assetName: string
  assetType: string
  description: string
  generationType?: 'item' | 'avatar'
  gameStyle: string
  customStyle?: string
  customGamePrompt?: string
  customAssetTypePrompt?: string
  enableRetexturing: boolean
  enableSprites: boolean
  enableRigging: boolean
  useGPT4Enhancement?: boolean
  characterHeight?: number
  quality?: 'standard' | 'high' | 'ultra'
  selectedMaterials: string[]
  materialPresets: MaterialPreset[]
  materialPromptOverrides: Record<string, string>
  materialPromptTemplates?: {
    runescape: string
    generic: string
  }
  gameStyleConfig?: {
    name: string
    base: string
    generation?: string
    enhanced?: string
  }
  // Optional reference image inputs from UI
  referenceImageMode?: 'auto' | 'custom'
  referenceImageSource?: 'upload' | 'url' | null
  referenceImageUrl?: string | null
  referenceImageDataUrl?: string | null
}

export function buildGenerationConfig(options: BuildConfigOptions): GenerationConfig {
  const {
    assetName,
    assetType,
    description,
    generationType = 'item',
    gameStyle,
    customStyle,
    customGamePrompt,
    customAssetTypePrompt,
    enableRetexturing,
    enableSprites,
    enableRigging,
    useGPT4Enhancement,
    characterHeight,
    quality,
    selectedMaterials,
    materialPresets,
    materialPromptOverrides,
    materialPromptTemplates,
    gameStyleConfig
    ,referenceImageMode
    ,referenceImageSource
    ,referenceImageUrl
    ,referenceImageDataUrl
  } = options

  // Prepare material variants
  let materialVariants = []
  
  if (gameStyle === 'runescape') {
    // RuneScape material presets
    materialVariants = selectedMaterials.map((materialId, index) => {
      const preset = materialPresets.find(p => p.id === materialId)
      return {
        id: materialId,
        name: materialId,
        displayName: preset?.displayName || materialId.charAt(0).toUpperCase() + materialId.slice(1).replace(/-/g, ' '),
        category: preset?.category || (materialId.includes('leather') ? 'leather' : 
                ['wood', 'oak', 'willow'].includes(materialId) ? 'wood' : 
                'metal'),
        tier: index + 1,
        color: preset?.color || '#888888',
        stylePrompt: materialPromptOverrides[materialId] || preset?.stylePrompt || 
          (materialPromptTemplates?.runescape || '${materialId} texture, low-poly RuneScape style').replace('${materialId}', materialId)
      }
    })
  } else {
    // Custom game materials - only use selected materials
    materialVariants = selectedMaterials.map((materialId, index) => {
      const preset = materialPresets.find(p => p.id === materialId)
      return {
        id: materialId,
        name: materialId,
        displayName: preset?.displayName || materialId.charAt(0).toUpperCase() + materialId.slice(1).replace(/-/g, ' '),
        category: preset?.category || 'custom',
        tier: index + 1,
        color: preset?.color || '#888888',
        stylePrompt: materialPromptOverrides[materialId] || preset?.stylePrompt || 
          (materialPromptTemplates?.generic || '${materialId} texture').replace('${materialId}', materialId)
      }
    })
  }
  
  const config: GenerationConfig = {
    name: assetName,
    type: generationType === 'avatar' ? 'character' : assetType,
    subtype: generationType === 'avatar' ? 'humanoid' : assetType,
    description,
    style: gameStyleConfig?.generation || (gameStyle === 'runescape' ? 'runescape2007' : customStyle),
    assetId: assetName.toLowerCase().replace(/\s+/g, '-'),
    generationType: generationType,
    quality,
    metadata: {
      gameStyle,
      customGamePrompt: gameStyle === 'custom' ? customGamePrompt : undefined,
      customAssetTypePrompt,
      // Respect GPT-4 enhancement toggle for backend pipeline
      useGPT4Enhancement: useGPT4Enhancement === false ? false : true
    },
    materialPresets: generationType === 'item' ? materialVariants.map(mat => ({
      id: mat.id,
      name: mat.name,
      displayName: mat.displayName,
      category: mat.category,
      tier: mat.tier,
      color: mat.color,
      stylePrompt: mat.stylePrompt
    })) : [],
    enableGeneration: true,
    enableRetexturing: generationType === 'item' ? enableRetexturing : false,
    enableSprites,
    enableRigging: generationType === 'avatar' ? enableRigging : false,
    riggingOptions: generationType === 'avatar' && enableRigging ? {
      heightMeters: characterHeight
    } : undefined,
    spriteConfig: enableSprites ? {
      angles: 8,
      resolution: 512,
      backgroundColor: 'transparent'
    } : undefined,
    customPrompts: {
      gameStyle: customGamePrompt || gameStyleConfig?.base,
      assetType: customAssetTypePrompt
    }
  }

  // Attach optional reference image if selected by user
  if (referenceImageMode === 'custom') {
    const useUrl = referenceImageSource === 'url' && !!referenceImageUrl
    const useData = referenceImageSource === 'upload' && !!referenceImageDataUrl
    if (useUrl || useData) {
      ;(config as any).referenceImage = {
        source: useData ? 'data' : 'url',
        url: useUrl ? referenceImageUrl! : undefined,
        dataUrl: useData ? referenceImageDataUrl! : undefined
      }
    }
  }
  
  return config
} 