/**
 * Admin Service
 * API calls for admin-only features (whitelist, users, stats)
 */

import type { WhitelistEntry, AdminUser, AdminStats } from '@/stores/adminStore'
import { BaseAPIService } from './BaseAPIService'

class AdminServiceClass extends BaseAPIService {
  constructor() {
    super('/api/admin')
  }

  /**
   * Add wallet address to whitelist
   */
  async addToWhitelist(walletAddress: string, reason?: string): Promise<WhitelistEntry> {
    return this.post<WhitelistEntry>('whitelist', { walletAddress, reason })
  }

  /**
   * Remove wallet address from whitelist
   */
  async removeFromWhitelist(walletAddress: string): Promise<void> {
    return this.delete<void>(`whitelist/${encodeURIComponent(walletAddress)}`)
  }

  /**
   * Get all whitelist entries
   */
  async getWhitelist(): Promise<WhitelistEntry[]> {
    return this.get<WhitelistEntry[]>('whitelist')
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(page: number = 1, limit: number = 50): Promise<{
    users: AdminUser[]
    total: number
    totalPages: number
    currentPage: number
  }> {
    return this.get('users', { page, limit }, { timeout: 15000 })
  }

  /**
   * Get admin statistics
   */
  async getStats(): Promise<AdminStats> {
    return this.get<AdminStats>('stats')
  }
}

export const AdminService = new AdminServiceClass()
