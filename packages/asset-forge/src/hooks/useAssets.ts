/**
 * Asset Hooks
 * Clean, reusable hooks for asset operations
 */

import { useState, useEffect, useCallback } from 'react'
import { AssetService, Asset, MaterialPreset, RetextureRequest, RetextureResponse } from '../services/api/AssetService'
import { useApp } from '../contexts/AppContext'

export const useAssets = () => {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const { showNotification } = useApp()

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    const data = await AssetService.listAssets()
    setAssets(data)
    setLoading(false)
  }, [showNotification])

  const forceReload = useCallback(async () => {
    // Clear assets first to ensure UI updates
    setAssets([])
    await fetchAssets()
  }, [fetchAssets])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  return { 
    assets, 
    loading, 
    reloadAssets: fetchAssets,
    forceReload
  }
}

export const useMaterialPresets = () => {
  const [presets, setPresets] = useState<MaterialPreset[]>([])
  const [loading, setLoading] = useState(true)
  const { showNotification } = useApp()

  const fetchPresets = useCallback(async () => {
    setLoading(true)
    const data = await AssetService.getMaterialPresets()
    setPresets(data)
    setLoading(false)
  }, [showNotification])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  return { 
    presets, 
    loading, 
    refetch: fetchPresets 
  }
}

export const useRetexturing = () => {
  const [isRetexturing, setIsRetexturing] = useState(false)
  const { showNotification } = useApp()

  const retextureAsset = useCallback(async (
    request: RetextureRequest
  ): Promise<RetextureResponse> => {
    setIsRetexturing(true)
    const result = await AssetService.retexture(request)
    showNotification(
      result.message || 'Asset retextured successfully',
      'success'
    )
    setIsRetexturing(false)
    return result
  }, [showNotification])

  return { 
    retextureAsset, 
    isRetexturing 
  }
}