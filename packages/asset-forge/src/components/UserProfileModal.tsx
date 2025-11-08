/**
 * User Profile Modal
 * Allows users to edit their display name and avatar
 */

import React, { useState, useEffect } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from './common/Modal'
import { Button } from './common/Button'
import { Input } from './common/Input'
import { useAuth } from '../hooks/useAuth'

interface UserProfileModalProps {
  open: boolean
  onClose: () => void
}

export function UserProfileModal({ open, onClose }: UserProfileModalProps) {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Initialize form with current user data
  useEffect(() => {
    if (user) {
      setDisplayName((user as any).displayName || '')
      setAvatarUrl((user as any).avatarUrl || '')
    }
  }, [user])

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3004'}/api/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(window as any).privyAuthManager?.getToken()}`
        },
        body: JSON.stringify({
          displayName: displayName || undefined,
          avatarUrl: avatarUrl || undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      setSuccess(true)

      // Close modal after short delay
      setTimeout(() => {
        onClose()
        // Refresh the page to update the navigation display
        window.location.reload()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHeader title="Edit Profile" onClose={onClose} />

      <ModalBody>
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500 bg-opacity-10 border border-red-500 rounded-md text-red-500 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500 bg-opacity-10 border border-green-500 rounded-md text-green-500 text-sm">
              Profile updated successfully!
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Display Name
            </label>
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              maxLength={255}
            />
            <p className="text-xs text-text-tertiary mt-1">
              This name will be shown throughout the application
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Avatar URL
            </label>
            <Input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              maxLength={512}
            />
            <p className="text-xs text-text-tertiary mt-1">
              URL to your avatar image (optional)
            </p>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
