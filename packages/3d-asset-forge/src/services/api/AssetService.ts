/**
 * Asset Service
 * Clean API interface for asset operations
 */

import { MaterialPreset, AssetMetadata } from '../../types'

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
    const response = await fetch(`${this.baseUrl}/assets?t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
    if (!response.ok) {
      throw new Error('Failed to fetch assets')
    }
    return response.json()
  }

  async getMaterialPresets(): Promise<MaterialPreset[]> {
    const response = await fetch(`${this.baseUrl}/material-presets`)
    if (!response.ok) {
      throw new Error('Failed to fetch material presets')
    }
    return response.json()
  }

  async retexture(request: RetextureRequest): Promise<RetextureResponse> {
    const response = await fetch(`${this.baseUrl}/retexture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
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

  getConceptArtUrl(assetId: string): string {
    return `/assets/${assetId}/concept-art.png`
  }
}

export const AssetService = new AssetServiceClass()