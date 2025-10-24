/**
 * Team Invite Component
 * Form to join a team via invite code with preview
 */

import { Loader2, Users } from 'lucide-react'
import { useState } from 'react'

import { Input, Button, Card, CardContent } from '@/components/common'
import { apiFetch } from '@/utils/api'

interface TeamInviteProps {
  onTeamJoined: () => void
  onCancel?: () => void
}

interface TeamPreview {
  name: string
  description: string | null
  memberCount: number
  maxMembers: number
  ownerName: string
}

export function TeamInvite({ onTeamJoined, onCancel }: TeamInviteProps) {
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teamPreview, setTeamPreview] = useState<TeamPreview | null>(null)

  const handlePreview = async () => {
    if (inviteCode.length !== 8) {
      setError('Invite code must be 8 characters')
      return
    }

    try {
      setPreviewLoading(true)
      setError(null)

      const response = await apiFetch(`/api/teams/preview/${inviteCode}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Invalid invite code')
      }

      const data = await response.json()
      setTeamPreview(data.team)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview team')
      setTeamPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!teamPreview) return

    try {
      setLoading(true)
      setError(null)

      const response = await apiFetch('/api/teams/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to join team')
      }

      onTeamJoined()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value.toUpperCase().slice(0, 8)
    setInviteCode(code)
    setTeamPreview(null)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Invite Code <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={inviteCode}
            onChange={handleCodeChange}
            placeholder="XXXXXXXX"
            maxLength={8}
            disabled={loading || previewLoading}
            className="flex-1 font-mono text-lg tracking-wider"
          />
          <Button
            type="button"
            onClick={handlePreview}
            disabled={inviteCode.length !== 8 || previewLoading}
            className="px-6 bg-bg-tertiary hover:bg-gray-600"
          >
            {previewLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Preview'
            )}
          </Button>
        </div>
        <p className="text-xs text-text-secondary mt-1">Enter an 8-character invite code</p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {teamPreview && (
        <Card className="bg-bg-secondary border-border-primary">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary">{teamPreview.name}</h3>
                {teamPreview.description && (
                  <p className="text-sm text-text-secondary mt-1">{teamPreview.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-text-secondary">
                  <span>
                    Owner: <span className="text-text-primary">{teamPreview.ownerName}</span>
                  </span>
                  <span>
                    Members: <span className="text-text-primary">{teamPreview.memberCount} / {teamPreview.maxMembers}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <Button
                type="button"
                onClick={handleJoin}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Team'
                )}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="px-6 bg-bg-tertiary hover:bg-gray-600"
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!teamPreview && onCancel && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={onCancel}
            disabled={loading || previewLoading}
            className="px-6 bg-bg-tertiary hover:bg-gray-600"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
