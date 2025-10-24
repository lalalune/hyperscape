/**
 * User Service
 * API calls for user profile, usage, and history management
 */

import type { UserProfile, UserUsage, GenerationHistoryItem } from '@/stores/userStore'
import { apiFetch } from '@/utils/api'
import { BaseAPIService } from './BaseAPIService'

interface HistoryFilters {
  page?: number
  limit?: number
  provider?: string
  status?: string
  startDate?: string
  endDate?: string
}

class UserServiceClass extends BaseAPIService {
  constructor() {
    super('/api/user')
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<UserProfile> {
    return this.get<UserProfile>('profile')
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: { name?: string; avatar?: string }): Promise<UserProfile> {
    return this.put<UserProfile>('profile', updates)
  }

  /**
   * Get user usage statistics
   */
  async getUsage(): Promise<UserUsage> {
    return this.get<UserUsage>('usage')
  }

  /**
   * Get generation history with optional filters
   */
  async getHistory(filters?: HistoryFilters): Promise<GenerationHistoryItem[]> {
    return this.get<GenerationHistoryItem[]>('history', filters, { timeout: 15000 })
  }

  /**
   * Delete user account (requires confirmation code)
   */
  async deleteAccount(confirmationCode: string): Promise<void> {
    return this.delete<void>('account', { confirmationCode })
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportData(): Promise<Blob> {
    const response = await apiFetch(`${this.baseUrl}/export`, {
      headers: this.buildHeaders(),
      timeoutMs: 30000
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to export data')
    }

    return response.blob()
  }
}

export const UserService = new UserServiceClass()
