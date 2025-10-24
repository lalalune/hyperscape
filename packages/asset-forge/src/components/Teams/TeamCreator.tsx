/**
 * Team Creator Component
 * Form to create a new team with validation
 */

import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Input, Textarea, Button } from '@/components/common'
import { apiFetch } from '@/utils/api'

interface TeamCreatorProps {
  onTeamCreated: (team: { id: string; name: string; inviteCode: string }) => void
  onCancel?: () => void
}

interface CreateTeamData {
  name: string
  description: string
  maxMembers: number
}

export function TeamCreator({ onTeamCreated, onCancel }: TeamCreatorProps) {
  const [formData, setFormData] = useState<CreateTeamData>({
    name: '',
    description: '',
    maxMembers: 10,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (formData.name.length < 3) {
      setError('Team name must be at least 3 characters')
      return
    }

    if (formData.maxMembers < 2 || formData.maxMembers > 100) {
      setError('Max members must be between 2 and 100')
      return
    }

    try {
      setLoading(true)

      const response = await apiFetch('/api/teams/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create team')
      }

      const data = await response.json()
      onTeamCreated(data.team)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Team Name <span className="text-red-400">*</span>
        </label>
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter team name"
          required
          minLength={3}
          disabled={loading}
          className="w-full"
        />
        <p className="text-xs text-text-secondary mt-1">Minimum 3 characters</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Description
        </label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe your team (optional)"
          rows={3}
          disabled={loading}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Max Members
        </label>
        <Input
          type="number"
          value={formData.maxMembers}
          onChange={(e) =>
            setFormData({ ...formData, maxMembers: parseInt(e.target.value) || 10 })
          }
          min={2}
          max={100}
          disabled={loading}
          className="w-full"
        />
        <p className="text-xs text-text-secondary mt-1">Between 2 and 100 members</p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Team'
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
    </form>
  )
}
