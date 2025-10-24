/**
 * Profile Editor Component
 * Allows users to edit their profile information
 */

import { usePrivy } from '@privy-io/react-auth'
import { Save, Loader2, User as UserIcon, Mail, Wallet, Users, LogIn, LogOut } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

import { apiFetch } from '@/utils/api'

interface UserProfile {
  id: string
  email: string
  name: string
  avatar: string | null
  walletAddress: string | null
  farcasterFid: string | null
  role: string
  teamId: string | null
  createdAt: string
  lastLoginAt: string
  team: {
    id: string
    name: string
    description: string | null
    inviteCode: string
    memberCount: number
    maxMembers: number
    isOwner: boolean
    createdAt: string
  } | null
}

export function ProfileEditor() {
  const { ready, authenticated, login, logout } = usePrivy()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('')

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Only fetch profile if authenticated
    if (ready && authenticated) {
      fetchProfile()
    } else if (ready && !authenticated) {
      setLoading(false)
    }
  }, [ready, authenticated])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiFetch('/api/user/profile', {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch profile')
      }

      const data = await response.json()
      setProfile(data.user)
      setName(data.user.name || '')
      setAvatar(data.user.avatar || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      setError('Name must be at least 2 characters long')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const response = await apiFetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          avatar: avatar.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to update profile')
      }

      const data = await response.json()
      setProfile(data.user)
      setSuccess(true)

      // Clear any existing timeout
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }

      successTimeoutRef.current = setTimeout(() => {
        setSuccess(false)
        successTimeoutRef.current = null
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  // Show loading while Privy is initializing
  if (!ready) {
    return (
      <div className="bg-bg-secondary rounded-lg p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-text-secondary">Initializing...</span>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!authenticated) {
    return (
      <div className="bg-bg-secondary rounded-lg p-8 text-center">
        <div className="max-w-md mx-auto">
          <LogIn className="w-12 h-12 text-text-secondary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Authentication Required</h3>
          <p className="text-text-secondary mb-6">
            Please sign in to view and edit your profile.
          </p>
          <button
            onClick={login}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  // Show loading while fetching profile
  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-lg p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-text-secondary">Loading profile...</span>
        </div>
      </div>
    )
  }

  // Show error if profile failed to load
  if (!profile) {
    return (
      <div className="bg-bg-secondary rounded-lg p-8">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load profile</p>
          {error && <p className="text-sm text-text-secondary">{error}</p>}
          <button
            onClick={fetchProfile}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Information Card */}
      <div className="bg-bg-secondary rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-6">Profile Information</h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              <UserIcon className="w-4 h-4 inline mr-2" />
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name"
            />
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Avatar URL
            </label>
            <input
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="w-full px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/avatar.png"
            />
            {avatar && (
              <div className="mt-2">
                <img
                  src={avatar}
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'
                  }}
                />
              </div>
            )}
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Email
            </label>
            <input
              type="email"
              value={profile.email || ''}
              disabled
              className="w-full px-4 py-2 bg-bg-tertiary/50 border border-border-primary rounded-lg text-text-secondary cursor-not-allowed"
            />
          </div>

          {/* Wallet Address (read-only) */}
          {profile.walletAddress && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                <Wallet className="w-4 h-4 inline mr-2" />
                Wallet Address
              </label>
              <input
                type="text"
                value={profile.walletAddress || ''}
                disabled
                className="w-full px-4 py-2 bg-bg-tertiary/50 border border-border-primary rounded-lg text-text-secondary font-mono text-sm cursor-not-allowed"
              />
            </div>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-green-900/20 border border-green-700 rounded-lg">
            <p className="text-green-400 text-sm">Profile updated successfully!</p>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {/* Team Information Card */}
      {profile.team && (
        <div className="bg-bg-secondary rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Information
          </h2>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-text-secondary">Team Name</p>
              <p className="text-white font-medium">{profile.team.name}</p>
            </div>

            {profile.team.description && (
              <div>
                <p className="text-sm text-text-secondary">Description</p>
                <p className="text-text-primary">{profile.team.description}</p>
              </div>
            )}

            <div className="flex gap-6">
              <div>
                <p className="text-sm text-text-secondary">Members</p>
                <p className="text-text-primary">
                  {profile.team.memberCount} / {profile.team.maxMembers}
                </p>
              </div>

              <div>
                <p className="text-sm text-text-secondary">Your Role</p>
                <p className="text-text-primary">
                  {profile.team.isOwner ? (
                    <span className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded text-xs font-medium">
                      Owner
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs font-medium">
                      Member
                    </span>
                  )}
                </p>
              </div>
            </div>

            {profile.team.isOwner && (
              <div>
                <p className="text-sm text-text-secondary">Invite Code</p>
                <p className="text-white font-mono bg-bg-tertiary px-3 py-2 rounded inline-block">
                  {profile.team.inviteCode}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Info */}
      <div className="bg-bg-secondary rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Account Information</h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Account Created</span>
            <span className="text-text-primary">
              {new Date(profile.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-text-secondary">Last Login</span>
            <span className="text-text-primary">
              {new Date(profile.lastLoginAt).toLocaleDateString()}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-text-secondary">User ID</span>
            <span className="text-white font-mono text-xs">{profile.id}</span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
