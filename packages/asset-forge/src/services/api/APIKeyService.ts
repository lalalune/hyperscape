/**
 * API Key Service
 * API calls for encrypted API key management
 */

import { BaseAPIService } from './BaseAPIService'

export type APIKeyProvider = 'openai' | 'meshy' | 'elevenlabs'

export interface APIKey {
  id: string
  provider: APIKeyProvider
  keyPreview: string // Last 4 characters only
  isActive: boolean
  createdAt: string
  updatedAt: string
}

class APIKeyServiceClass extends BaseAPIService {
  constructor() {
    super('/api/user/api-keys')
  }

  /**
   * Add or update an API key (encrypted on backend)
   */
  async addKey(provider: APIKeyProvider, apiKey: string): Promise<APIKey> {
    return this.post<APIKey>(this.baseUrl, { provider, apiKey })
  }

  /**
   * Get all API keys for the current user (returns previews only)
   */
  async getKeys(): Promise<APIKey[]> {
    return this.get<APIKey[]>(this.baseUrl)
  }

  /**
   * Update an API key's active status
   */
  async updateKey(id: string, updates: { isActive?: boolean }): Promise<APIKey> {
    return this.update<APIKey>(id, updates)
  }

  /**
   * Delete an API key
   */
  async deleteKey(id: string): Promise<void> {
    return this.deleteById(id)
  }

  /**
   * Test an API key to verify it works
   */
  async testKey(provider: APIKeyProvider, apiKey: string): Promise<{ valid: boolean; error?: string }> {
    return this.post<{ valid: boolean; error?: string }>('test', { provider, apiKey }, { timeout: 15000 })
  }
}

export const APIKeyService = new APIKeyServiceClass()
