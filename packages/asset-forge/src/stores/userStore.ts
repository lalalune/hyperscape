/**
 * User Store
 * Zustand store for user profile, usage, and history state
 */

import type { User } from '@privy-io/react-auth'
import { create } from 'zustand'

import { UserService } from '@/services/api/UserService'

export interface UserProfile {
  id: string
  privyUserId: string
  walletAddress?: string
  email?: string
  name?: string
  avatar?: string
  isAdmin: boolean
  isWhitelisted: boolean
  createdAt: string
  updatedAt: string
}

export interface UserUsage {
  totalGenerations: number
  monthlyGenerations: number
  totalApiCalls: number
  monthlyApiCalls: number
  storageUsed: number
  lastActivity?: string
}

export interface GenerationHistoryItem {
  id: string
  provider: 'openai' | 'meshy' | 'elevenlabs'
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  cost?: number
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface UserState {
  // State
  user: User | null
  profile: UserProfile | null
  usage: UserUsage | null
  history: GenerationHistoryItem[]
  loading: boolean
  error: string | null

  // Actions
  fetchProfile: () => Promise<void>
  updateProfile: (updates: { name?: string; avatar?: string }) => Promise<void>
  fetchUsage: () => Promise<void>
  fetchHistory: (filters?: {
    page?: number
    limit?: number
    provider?: string
    status?: string
    startDate?: string
    endDate?: string
  }) => Promise<void>
  deleteAccount: (confirmationCode: string) => Promise<void>
  exportData: () => Promise<Blob>
  setUser: (user: User | null) => void
  clearUser: () => void
}

export const useUserStore = create<UserState>((set, get) => ({
  // Initial state
  user: null,
  profile: null,
  usage: null,
  history: [],
  loading: false,
  error: null,

  // Set user from auth
  setUser: (user: User | null) => {
    set({ user })
    if (user) {
      get().fetchProfile()
    }
  },

  // Fetch user profile
  fetchProfile: async () => {
    set({ loading: true, error: null })
    try {
      const profile = await UserService.getProfile()
      set({ profile, loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch profile'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Update user profile
  updateProfile: async (updates: { name?: string; avatar?: string }) => {
    set({ loading: true, error: null })
    try {
      const profile = await UserService.updateProfile(updates)
      set({ profile, loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Fetch usage statistics
  fetchUsage: async () => {
    set({ loading: true, error: null })
    try {
      const usage = await UserService.getUsage()
      set({ usage, loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch usage'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Fetch generation history
  fetchHistory: async (filters) => {
    set({ loading: true, error: null })
    try {
      const history = await UserService.getHistory(filters)
      set({ history, loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch history'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Delete account
  deleteAccount: async (confirmationCode: string) => {
    set({ loading: true, error: null })
    try {
      await UserService.deleteAccount(confirmationCode)
      set({ user: null, profile: null, usage: null, history: [], loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete account'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Export user data
  exportData: async () => {
    set({ loading: true, error: null })
    try {
      const blob = await UserService.exportData()
      set({ loading: false })
      return blob
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export data'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Clear user state
  clearUser: () => {
    set({
      user: null,
      profile: null,
      usage: null,
      history: [],
      error: null
    })
  }
}))
