import { useCallback, RefObject } from 'react'
import { Asset } from '../types'
import { useAssetsStore } from '../store'
import { ThreeViewerRef } from '../components/shared/ThreeViewer'
import { API_ENDPOINTS } from '../constants'

interface UseAssetActionsOptions {
  viewerRef: React.RefObject<ThreeViewerRef>
  reloadAssets: () => Promise<void>
  forceReload: () => Promise<void>
  assets: Asset[]
}

export function useAssetActions({ viewerRef, reloadAssets, forceReload, assets }: UseAssetActionsOptions) {
  const {
    selectedAsset,
    setSelectedAsset,
    setShowEditModal,
    setIsTransitioning,
    clearSelection
  } = useAssetsStore()

  const handleViewerReset = useCallback(() => {
    viewerRef.current?.resetCamera()
  }, [viewerRef])

  const handleDownload = useCallback(() => {
    if (selectedAsset && selectedAsset.hasModel) {
      // Take a screenshot instead of downloading the model
      viewerRef.current?.takeScreenshot()
    }
  }, [selectedAsset, viewerRef])

  const handleDeleteAsset = useCallback(async (asset: Asset, includeVariants?: boolean) => {
    // Clear selected asset BEFORE deletion to prevent viewer from trying to load it
    if (selectedAsset?.id === asset.id) {
      clearSelection()
    }

    // Close the edit modal immediately
    setShowEditModal(false)

    const response = await fetch(`${API_ENDPOINTS.ASSETS}/${asset.id}?includeVariants=${includeVariants}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error(`Failed to delete asset: ${response.status}`)
    }

    // If deleting a variant and we had cleared the selection, select the base model
    if (!includeVariants && !selectedAsset && asset.metadata.isVariant) {
      const variantMetadata = asset.metadata as import('../types').VariantAssetMetadata
      const baseAsset = assets.find(a => a.id === variantMetadata.parentBaseModel)!
      setSelectedAsset(baseAsset)
    }

    // Add a small delay to ensure the deletion is complete on the filesystem
    await new Promise(resolve => setTimeout(resolve, 500))

    // Force reload assets to refresh the list (clears list first)
    await forceReload()
  }, [selectedAsset, clearSelection, setShowEditModal, assets, setSelectedAsset, forceReload])

  const handleSaveAsset = useCallback(async (updatedAsset: Partial<Asset>) => {
    const response = await fetch(`${API_ENDPOINTS.ASSETS}/${updatedAsset.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedAsset),
    })

    if (!response.ok) {
      throw new Error('Failed to update asset')
    }

    // Get the updated asset from the response
    const savedAsset = await response.json()

    // If the asset was renamed, update the selected asset
    if (savedAsset.id !== updatedAsset.id) {
      setIsTransitioning(true)
      setSelectedAsset(savedAsset)
    }

    // Close the edit modal after successful save
    setShowEditModal(false)

    // Reload assets to refresh the list
    await reloadAssets()

    // Clear transitioning state after a brief delay
    if (savedAsset.id !== updatedAsset.id) {
      setTimeout(() => setIsTransitioning(false), 500)
    }

    return savedAsset
  }, [setIsTransitioning, setSelectedAsset, setShowEditModal, reloadAssets])

  return {
    handleViewerReset,
    handleDownload,
    handleDeleteAsset,
    handleSaveAsset
  }
} 