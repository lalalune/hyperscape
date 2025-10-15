import { useState, useEffect, useCallback } from 'react'
import { PromptService, GameStylePrompt, AssetTypePrompt, AssetTypePromptsByCategory, PromptsResponse } from '../services/api/PromptService'
import { useGenerationStore } from '../store'

export function useGameStylePrompts() {
  const [prompts, setPrompts] = useState<PromptsResponse<Record<string, GameStylePrompt>>>({
    version: '1.0.0',
    default: {},
    custom: {}
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPrompts = async () => {
      setLoading(true)
      const data = await PromptService.getGameStylePrompts()
      setPrompts(data)
      setError(null)
      setLoading(false)
    }
    loadPrompts()
  }, [])

  const saveCustomGameStyle = useCallback(async (styleId: string, style: GameStylePrompt) => {
    const updatedPrompts = {
      ...prompts,
      custom: {
        ...prompts.custom,
        [styleId]: style
      }
    }
    await PromptService.saveGameStylePrompts(updatedPrompts)
    setPrompts(updatedPrompts)
    return true
  }, [prompts])

  const deleteCustomGameStyle = useCallback(async (styleId: string) => {
    const success = await PromptService.deleteGameStyle(styleId)
    const { [styleId]: _, ...remainingCustom } = prompts.custom
    const updatedPrompts = {
      ...prompts,
      custom: remainingCustom
    }
    setPrompts(updatedPrompts)
    return success
  }, [prompts])

  // Get all available styles (default + custom)
  const getAllStyles = useCallback(() => {
    return PromptService.mergePrompts(prompts.default, prompts.custom)
  }, [prompts])

  return {
    prompts,
    loading,
    error,
    saveCustomGameStyle,
    deleteCustomGameStyle,
    getAllStyles
  }
}

export function useAssetTypePrompts() {
  const [prompts, setPrompts] = useState<AssetTypePromptsByCategory>({
    avatar: { default: {}, custom: {} },
    item: { default: {}, custom: {} }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { assetTypePrompts, setAssetTypePrompts } = useGenerationStore()

  useEffect(() => {
    const loadPrompts = async () => {
      setLoading(true)
      const data = await PromptService.getAssetTypePrompts()
      setPrompts(data)
      
      // Update store with loaded prompts - combine both avatar and item types
      const avatarMerged = PromptService.mergePrompts(data.avatar.default, data.avatar.custom)
      const itemMerged = PromptService.mergePrompts(data.item.default, data.item.custom)
      const allMerged = { ...avatarMerged, ...itemMerged }
      
      const promptsMap = Object.entries(allMerged).reduce((acc, [key, value]) => ({
        ...acc,
        [key]: value.prompt
      }), {})
      setAssetTypePrompts(promptsMap)
      
      setError(null)
      setLoading(false)
    }
    loadPrompts()
  }, [setAssetTypePrompts])

  const saveCustomAssetType = useCallback(async (typeId: string, prompt: AssetTypePrompt, generationType: 'avatar' | 'item' = 'item') => {
    const updatedPrompts = {
      ...prompts,
      [generationType]: {
        ...prompts[generationType],
        custom: {
          ...prompts[generationType].custom,
          [typeId]: prompt
        }
      }
    }
    await PromptService.saveAssetTypePrompts(updatedPrompts)
    setPrompts(updatedPrompts)
    
    // Update store
    setAssetTypePrompts({
      ...assetTypePrompts,
      [typeId]: prompt.prompt
    })
    
    return true
  }, [prompts, assetTypePrompts, setAssetTypePrompts])

  const deleteCustomAssetType = useCallback(async (typeId: string, generationType: 'avatar' | 'item' = 'item') => {
    const success = await PromptService.deleteAssetType(typeId, generationType)
    const { [typeId]: _, ...remainingCustom } = prompts[generationType].custom
    const updatedPrompts = {
      ...prompts,
      [generationType]: {
        ...prompts[generationType],
        custom: remainingCustom
      }
    }
    setPrompts(updatedPrompts)
    
    // Update store
    const { [typeId]: __, ...remainingPrompts } = assetTypePrompts
    setAssetTypePrompts(remainingPrompts)
    
    return success
  }, [prompts, assetTypePrompts, setAssetTypePrompts])

  // Get all available types (default + custom) for both categories
  const getAllTypes = useCallback(() => {
    const avatarMerged = PromptService.mergePrompts(prompts.avatar.default, prompts.avatar.custom)
    const itemMerged = PromptService.mergePrompts(prompts.item.default, prompts.item.custom)
    return { ...avatarMerged, ...itemMerged }
  }, [prompts])
  
  // Get types by generation type
  const getTypesByGeneration = useCallback((generationType: 'avatar' | 'item') => {
    return PromptService.mergePrompts(prompts[generationType].default, prompts[generationType].custom)
  }, [prompts])

  return {
    prompts,
    loading,
    error,
    saveCustomAssetType,
    deleteCustomAssetType,
    getAllTypes,
    getTypesByGeneration
  }
}

// Hook for material prompt templates
export function useMaterialPromptTemplates() {
  const [templates, setTemplates] = useState({
    templates: {
      runescape: '${materialId} texture, low-poly RuneScape style',
      generic: '${materialId} texture'
    },
    customOverrides: {}
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true)
      const data = await PromptService.getMaterialPrompts()
      setTemplates(data)
      setLoading(false)
    }
    loadTemplates()
  }, [])

  const saveCustomOverride = useCallback(async (materialId: string, override: string) => {
    const updated = {
      ...templates,
      customOverrides: {
        ...templates.customOverrides,
        [materialId]: override
      }
    }
    await PromptService.saveMaterialPrompts(updated)
    setTemplates(updated)
    return true
  }, [templates])

  return {
    templates,
    loading,
    saveCustomOverride
  }
}