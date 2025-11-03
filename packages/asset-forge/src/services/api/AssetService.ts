/**
 * Asset Service
 * Clean API interface for asset operations
 */

import { MaterialPreset, AssetMetadata } from '../../types'

import { apiFetch } from '@/utils/api'

export type { MaterialPreset }

export interface Asset {
  id: string
  name: string
  description: string
  type: string
  metadata: AssetMetadata
  hasModel: boolean
  modelFile?: string
  generatedAt: string
}

export interface RetextureRequest {
  baseAssetId: string
  materialPreset: MaterialPreset
  outputName?: string
}

export interface RetextureResponse {
  success: boolean
  assetId: string
  message: string
  asset?: Asset
}

class AssetServiceClass {
  private baseUrl = '/api'

  async listAssets(): Promise<Asset[]> {
    const response = await apiFetch(`${this.baseUrl}/assets?t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeoutMs: 15000
    })
    if (!response.ok) {
      throw new Error('Failed to fetch assets')
    }
    return response.json()
  }

  async getMaterialPresets(): Promise<MaterialPreset[]> {
    const response = await apiFetch(`${this.baseUrl}/material-presets`, { timeoutMs: 10000 })
    if (!response.ok) {
      throw new Error('Failed to fetch material presets')
    }
    return response.json()
  }

  async retexture(request: RetextureRequest): Promise<RetextureResponse> {
    const response = await apiFetch(`${this.baseUrl}/retexture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request),
      timeoutMs: 30000
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Retexturing failed')
    }
    
    return response.json()
  }

  getModelUrl(assetId: string): string {
    return `/assets/${assetId}/${assetId}.glb`
  }

  /**
   * Get T-pose model URL for retargeting workflow
   * Tries to load t-pose.glb, falls back to regular model if not found
   */
  async getTPoseUrl(assetId: string): Promise<string> {
    // Check if this is a built-in asset with T-pose in gdd-assets folder
    const builtInAssets = ['human', 'goblin', 'imp', 'troll', 'thug', 'quadruped', 'bird']
    if (builtInAssets.includes(assetId)) {
      const tPoseUrl = `/gdd-assets/${assetId}/t-pose.glb`
      try {
        const response = await fetch(tPoseUrl, { method: 'HEAD' })
        if (response.ok) {
          console.log(`[AssetService] T-pose found for built-in asset: ${assetId}`)
          return tPoseUrl
        }
      } catch (error) {
        console.log(`[AssetService] No T-pose for built-in asset ${assetId}, using regular model`)
      }
    }

    // Try to load t-pose.glb from user assets
    const tPoseUrl = `/api/assets/${assetId}/t-pose`
    try {
      const response = await fetch(tPoseUrl, { method: 'HEAD' })
      if (response.ok) {
        console.log(`[AssetService] T-pose found for ${assetId}`)
        return tPoseUrl
      }
    } catch (error) {
      console.log(`[AssetService] No T-pose for ${assetId}, using regular model`)
    }

    // Fall back to regular model
    return this.getModelUrl(assetId)
  }

  getConceptArtUrl(assetId: string): string {
    return `/assets/${assetId}/concept-art.png`
  }

  /**
   * Upload VRM file to server
   * Saves the converted VRM alongside the original asset
   */
  async uploadVRM(assetId: string, vrmData: ArrayBuffer, filename: string): Promise<{ success: boolean; url: string }> {
    const formData = new FormData()
    const blob = new Blob([vrmData], { type: 'application/octet-stream' })
    formData.append('file', blob, filename)
    formData.append('assetId', assetId)

    const response = await apiFetch(`${this.baseUrl}/assets/upload-vrm`, {
      method: 'POST',
      body: formData,
      timeoutMs: 30000,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'VRM upload failed')
    }

    return response.json()
  }

  /**
   * Get VRM model URL if it exists
   */
  getVRMUrl(assetId: string): string {
    // Check gdd-assets for built-in assets
    const builtInAssets = ['human', 'goblin', 'imp', 'troll', 'thug', 'quadruped', 'bird']
    if (builtInAssets.includes(assetId)) {
      return `/gdd-assets/${assetId}/${assetId}.vrm`
    }
    // User assets
    return `/assets/${assetId}/${assetId}.vrm`
  }
}

export const AssetService = new AssetServiceClass()