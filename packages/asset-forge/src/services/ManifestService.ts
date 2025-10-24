/**
 * Manifest Service
 * Fetches game data manifests from the API server
 */

import type {
  ManifestType,
  ItemManifest,
  MobManifest,
  NPCManifest,
  ResourceManifest,
  WorldAreaManifest,
  BiomeManifest,
  ZoneManifest,
  BankManifest,
  StoreManifest,
  AnyManifest
} from '../types/manifests'
import { createLogger } from '../utils/logger.ts'
import { apiFetch } from '../utils/api.ts'

const logger = createLogger('ManifestService')

const getApiUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_GENERATION_API_URL || 'http://localhost:3004/api'
  }
  // Server-side fallback
  return process.env.VITE_GENERATION_API_URL || 'http://localhost:3004/api'
}

const API_URL = getApiUrl()
const MANIFESTS_BASE_URL = `${API_URL}/manifests`

export class ManifestService {
  private cache: Map<ManifestType, AnyManifest[]> = new Map()
  
  /**
   * Fetch a specific manifest from CDN
   * Uses automatic request deduplication for concurrent calls
   */
  async fetchManifest<T extends AnyManifest>(type: ManifestType): Promise<T[]> {
    // Check cache first
    if (this.cache.has(type)) {
      return this.cache.get(type) as T[]
    }

    try {
      const response = await apiFetch(`${MANIFESTS_BASE_URL}/${type}.json`)

      if (!response.ok) {
        throw new Error(`Failed to fetch ${type} manifest: ${response.statusText}`)
      }

      const data = await response.json()

      // Handle both array and object formats
      const manifestData = Array.isArray(data) ? data : Object.values(data)

      // Cache the result
      this.cache.set(type, manifestData as AnyManifest[])

      return manifestData as T[]
    } catch (error) {
      logger.error(`Error fetching ${type} manifest`, error)
      throw error
    }
  }

  /**
   * Fetch all manifests
   */
  async fetchAllManifests(): Promise<Record<ManifestType, AnyManifest[]>> {
    const types: ManifestType[] = [
      'items',
      'mobs',
      'npcs',
      'resources',
      'world-areas',
      'biomes',
      'zones',
      'banks',
      'stores'
    ]

    const results = await Promise.allSettled(
      types.map(async (type) => ({
        type,
        data: await this.fetchManifest(type)
      }))
    )

    const manifests: Partial<Record<ManifestType, AnyManifest[]>> = {}

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        manifests[result.value.type] = result.value.data
      } else {
        logger.warn(`Failed to fetch ${types[index]} manifest`, result.reason)
      }
    })

    return manifests as Record<ManifestType, AnyManifest[]>
  }

  /**
   * Get items manifest
   */
  async getItems(): Promise<ItemManifest[]> {
    return this.fetchManifest<ItemManifest>('items')
  }

  /**
   * Get mobs manifest
   */
  async getMobs(): Promise<MobManifest[]> {
    return this.fetchManifest<MobManifest>('mobs')
  }

  /**
   * Get NPCs manifest
   */
  async getNPCs(): Promise<NPCManifest[]> {
    return this.fetchManifest<NPCManifest>('npcs')
  }

  /**
   * Get resources manifest
   */
  async getResources(): Promise<ResourceManifest[]> {
    return this.fetchManifest<ResourceManifest>('resources')
  }

  /**
   * Get world areas manifest
   */
  async getWorldAreas(): Promise<WorldAreaManifest[]> {
    return this.fetchManifest<WorldAreaManifest>('world-areas')
  }

  /**
   * Get biomes manifest
   */
  async getBiomes(): Promise<BiomeManifest[]> {
    return this.fetchManifest<BiomeManifest>('biomes')
  }

  /**
   * Get zones manifest
   */
  async getZones(): Promise<ZoneManifest[]> {
    return this.fetchManifest<ZoneManifest>('zones')
  }

  /**
   * Get banks manifest
   */
  async getBanks(): Promise<BankManifest[]> {
    return this.fetchManifest<BankManifest>('banks')
  }

  /**
   * Get stores manifest
   */
  async getStores(): Promise<StoreManifest[]> {
    return this.fetchManifest<StoreManifest>('stores')
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Refresh a specific manifest
   */
  async refreshManifest<T extends AnyManifest>(type: ManifestType): Promise<T[]> {
    this.cache.delete(type)
    return this.fetchManifest<T>(type)
  }
}

// Singleton instance
export const manifestService = new ManifestService()

