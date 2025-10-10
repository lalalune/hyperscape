import { useEffect, useRef } from 'react'
import { GenerationAPIClient } from '../services/api/GenerationAPIClient'
import { GeneratedAsset, AssetType, BaseAssetMetadata, GenerationAssetMetadata } from '../types'
import { useGenerationStore } from '../store'

interface UsePipelineStatusOptions {
  apiClient: GenerationAPIClient
  onComplete?: (asset: GeneratedAsset) => void
}

export function usePipelineStatus({ apiClient, onComplete }: UsePipelineStatusOptions) {
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const {
    currentPipelineId,
    useGPT4Enhancement,
    enableRetexturing,
    enableSprites,
    assetName,
    assetType,
    generationType,
    characterHeight,
    generatedAssets,
    setIsGenerating,
    updatePipelineStage,
    setGeneratedAssets,
    setSelectedAsset,
    setActiveView
  } = useGenerationStore()

  useEffect(() => {
    console.log('Pipeline status effect triggered. currentPipelineId:', currentPipelineId)
    if (!currentPipelineId) return
    
    const stageMapping: Record<string, string> = {
      'textInput': 'text-input',
      'promptOptimization': 'gpt4-enhancement',
      'imageGeneration': 'image-generation',
      'image3D': 'image-to-3d',
      'baseModel': 'image-to-3d',
      'textureGeneration': 'retexturing',
      'spriteGeneration': 'sprites',
      'rigging': 'rigging'
    }
    
    intervalRef.current = setInterval(async () => {
      try {
        console.log('Fetching pipeline status for:', currentPipelineId)
        const status = await apiClient.fetchPipelineStatus(currentPipelineId)
        console.log('Received status:', status)
        
        if (status) {
          // Update pipeline stages
          Object.entries(status.stages || {}).forEach(([stageName, stageData]) => {
            console.log('Processing stage:', stageName, stageData)
            const uiStageId = stageMapping[stageName]
            if (uiStageId) {
              let uiStatus = stageData.status === 'processing' ? 'active' : stageData.status
              
              // Check configuration overrides
              if (uiStageId === 'gpt4-enhancement' && !useGPT4Enhancement) uiStatus = 'skipped'
              if (uiStageId === 'retexturing' && !enableRetexturing) uiStatus = 'skipped'
              if (uiStageId === 'sprites' && !enableSprites) uiStatus = 'skipped'
              
              // Use updatePipelineStage to update individual stage
              updatePipelineStage(uiStageId, uiStatus)
            }
          })
          
          // Handle completion
          if (status.status === 'completed') {
            setIsGenerating(false)
            const results = status.results
            const config = status.config
            const baseAssetId = config.assetId || assetName.toLowerCase().replace(/\s+/g, '-')
            
            // Debug logging
            console.log('Pipeline completed with results:', results)
            console.log('Rigging results:', results.rigging)
            
            const finalAsset: GeneratedAsset = {
              id: baseAssetId,
              name: config.name || assetName,
              description: config.description || `${config.type || assetType} asset`,
              type: config.type || assetType,
              pipelineId: currentPipelineId,
              status: 'completed',
              modelUrl: (results.image3D?.localPath || results.rigging?.localPath) ? `/api/assets/${baseAssetId}/model` : undefined,
              conceptArtUrl: `/api/assets/${baseAssetId}/concept-art.png`,
              variants: results.textureGeneration?.variants || [],
              hasSpriteMetadata: results.spriteGeneration?.status === 'metadata_created' || 
                                 Boolean(config.enableSprites && results.image3D?.localPath),
              hasSprites: false,
              sprites: null,
              hasModel: !!(results.image3D?.localPath || results.rigging?.localPath),
              modelFile: results.rigging?.localPath || results.image3D?.localPath,
              createdAt: new Date().toISOString(),
              generatedAt: new Date().toISOString(),
              metadata: {
                id: baseAssetId,
                gameId: baseAssetId,
                name: config.name,
                description: config.description,
                type: config.type as AssetType,
                subtype: config.subtype || '',
                isBaseModel: true,
                meshyTaskId: '', // Not available from pipeline results
                generationMethod: 'gpt-image-meshy' as const,
                variants: [],
                variantCount: 0,
                modelPath: results.rigging?.localPath || results.image3D?.localPath || '',
                hasModel: !!(results.image3D?.localPath || results.rigging?.localPath),
                hasConceptArt: true,
                workflow: 'ai-generation',
                gddCompliant: true,
                isPlaceholder: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                generatedAt: new Date().toISOString(),
                // Extended properties
                isRigged: !!results.rigging && !!results.rigging?.localPath,
                animations: results.rigging?.localPath ? {} : undefined,
                riggedModelPath: results.rigging?.localPath,
                characterHeight: generationType === 'avatar' ? characterHeight : undefined
              } as BaseAssetMetadata & GenerationAssetMetadata
            }
            
            // Only add if not already exists
            const exists = generatedAssets.some(asset => asset.id === baseAssetId)
            if (!exists) {
              setGeneratedAssets([...generatedAssets, finalAsset])
            }
            setSelectedAsset(finalAsset)
            setActiveView('results')
            
            // Call onComplete callback if provided
            if (onComplete) {
              onComplete(finalAsset)
            }
            
            // Clear the interval
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          } else if (status.status === 'failed') {
            setIsGenerating(false)
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          }
        }
      } catch (error) {
        console.error('Failed to get pipeline status:', error)
      }
    }, 500)
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [currentPipelineId, apiClient, useGPT4Enhancement, enableRetexturing, enableSprites, assetName, updatePipelineStage])
  
  return { intervalRef }
} 