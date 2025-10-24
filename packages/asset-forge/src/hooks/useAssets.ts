/**
 * Asset Hooks
 *
 * Clean, reusable React hooks for asset operations including
 * fetching, retexturing, and material preset management.
 */

import { useDataFetch } from './useDataFetch'
import { useAsyncOperation } from './useAsyncOperation'

import { AssetService, RetextureRequest, RetextureResponse } from '@/services/api/AssetService'

// Re-export types for convenience
export type { Asset, MaterialPreset } from '@/services/api/AssetService'

/**
 * React hook for managing asset data fetching and reloading.
 *
 * Provides automatic asset loading on mount with proper cleanup
 * and memory leak protection using mounted refs.
 *
 * @returns Object containing assets array, loading state, and reload functions
 *
 * @example
 * ```typescript
 * function AssetList() {
 *   const { assets, loading, reloadAssets } = useAssets()
 *
 *   if (loading) return <div>Loading...</div>
 *
 *   return (
 *     <div>
 *       {assets.map(asset => <AssetCard key={asset.id} asset={asset} />)}
 *       <button onClick={reloadAssets}>Refresh</button>
 *     </div>
 *   )
 * }
 * ```
 */
export const useAssets = () => {
  const { data, loading, refetch, forceReload } = useDataFetch(
    async (bypassCache) => AssetService.listAssets(bypassCache),
    {
      fetchOnMount: true,
      errorMessage: 'Failed to load assets'
    }
  )

  return {
    assets: data || [],
    loading,
    reloadAssets: refetch,
    forceReload
  }
}

/**
 * React hook for managing material preset data.
 *
 * Fetches and caches material presets for use in texture generation
 * and customization workflows. Includes error handling and mounted
 * state protection.
 *
 * @returns Object containing presets array, loading state, and refetch function
 *
 * @example
 * ```typescript
 * function MaterialSelector() {
 *   const { presets, loading, refetch } = useMaterialPresets()
 *
 *   if (loading) return <div>Loading presets...</div>
 *
 *   return (
 *     <select>
 *       {presets.map(preset => (
 *         <option key={preset.id} value={preset.id}>
 *           {preset.name}
 *         </option>
 *       ))}
 *     </select>
 *   )
 * }
 * ```
 */
export const useMaterialPresets = () => {
  const { data, loading, refetch } = useDataFetch(
    async () => AssetService.getMaterialPresets(),
    {
      fetchOnMount: true,
      errorMessage: 'Failed to load material presets'
    }
  )

  return {
    presets: data || [],
    loading,
    refetch
  }
}

/**
 * React hook for asset retexturing operations.
 *
 * Provides retexturing functionality with loading state management,
 * error handling, and user notifications. Safely handles async operations
 * with mounted state checking.
 *
 * @returns Object containing retextureAsset function and loading state
 *
 * @example
 * ```typescript
 * function RetexturePanel({ assetId }: { assetId: string }) {
 *   const { retextureAsset, isRetexturing } = useRetexturing()
 *
 *   const handleRetexture = async () => {
 *     const result = await retextureAsset({
 *       assetId,
 *       materialPreset: 'gold',
 *       prompt: 'Add weathering and scratches'
 *     })
 *     if (result) {
 *       console.log('Retexturing complete:', result.newAssetUrl)
 *     }
 *   }
 *
 *   return (
 *     <button onClick={handleRetexture} disabled={isRetexturing}>
 *       {isRetexturing ? 'Retexturing...' : 'Apply Texture'}
 *     </button>
 *   )
 * }
 * ```
 */
export const useRetexturing = () => {
  const { execute, loading } = useAsyncOperation<RetextureResponse>(
    async (request: RetextureRequest) => AssetService.retexture(request),
    {
      showSuccessNotification: true,
      showErrorNotification: true,
      errorMessage: 'Retexturing failed'
    }
  )

  return {
    retextureAsset: execute,
    isRetexturing: loading
  }
}