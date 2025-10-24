/**
 * Admin Store
 * Zustand store for admin-only features (whitelist, users, stats)
 */

import { create } from 'zustand'

import { AdminService } from '@/services/api/AdminService'

export interface WhitelistEntry {
  id: string
  walletAddress: string
  addedBy: string
  reason?: string
  createdAt: string
}

export interface AdminUser {
  id: string
  privyUserId: string
  walletAddress?: string
  email?: string
  name?: string
  isAdmin: boolean
  isWhitelisted: boolean
  totalGenerations: number
  storageUsed: number
  lastActivity?: string
  createdAt: string
}

export interface AdminStats {
  totalUsers: number
  totalGenerations: number
  totalStorage: number
  activeUsers30Days: number
  whitelistedUsers: number
  adminUsers: number
  generationsByProvider: {
    openai: number
    meshy: number
    elevenlabs: number
  }
  averageGenerationsPerUser: number
  topUsers: Array<{
    userId: string
    name?: string
    generations: number
  }>
}

export interface AdminState {
  // State
  whitelist: WhitelistEntry[]
  users: AdminUser[]
  stats: AdminStats | null
  loading: boolean
  error: string | null
  currentPage: number
  totalPages: number

  // Actions
  fetchWhitelist: () => Promise<void>
  addToWhitelist: (walletAddress: string, reason?: string) => Promise<void>
  removeFromWhitelist: (walletAddress: string) => Promise<void>
  fetchUsers: (page?: number, limit?: number) => Promise<void>
  fetchStats: () => Promise<void>
}

export const useAdminStore = create<AdminState>((set) => ({
  // Initial state
  whitelist: [],
  users: [],
  stats: null,
  loading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,

  // Fetch whitelist
  fetchWhitelist: async () => {
    set({ loading: true, error: null })
    try {
      const whitelist = await AdminService.getWhitelist()
      set({ whitelist, loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch whitelist'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Add to whitelist
  addToWhitelist: async (walletAddress: string, reason?: string) => {
    set({ loading: true, error: null })
    try {
      const entry = await AdminService.addToWhitelist(walletAddress, reason)
      set((state) => ({
        whitelist: [entry, ...state.whitelist],
        loading: false
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add to whitelist'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Remove from whitelist
  removeFromWhitelist: async (walletAddress: string) => {
    set({ loading: true, error: null })
    try {
      await AdminService.removeFromWhitelist(walletAddress)
      set((state) => ({
        whitelist: state.whitelist.filter((entry) => entry.walletAddress !== walletAddress),
        loading: false
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove from whitelist'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Fetch all users
  fetchUsers: async (page = 1, limit = 50) => {
    set({ loading: true, error: null, currentPage: page })
    try {
      const result = await AdminService.getAllUsers(page, limit)
      set({
        users: result.users,
        totalPages: result.totalPages,
        loading: false
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch users'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Fetch admin statistics
  fetchStats: async () => {
    set({ loading: true, error: null })
    try {
      const stats = await AdminService.getStats()
      set({ stats, loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch stats'
      set({ error: errorMessage, loading: false })
      throw error
    }
  }
}))
