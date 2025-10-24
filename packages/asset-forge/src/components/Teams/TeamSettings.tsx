/**
 * Team Settings Component
 * Team configuration and management for owners
 */

import { Copy, Trash2, LogOut, Crown, Loader2, Check } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'

import { Input, Textarea, Button, Select } from '@/components/common'
import { apiFetch } from '@/utils/api'

interface TeamMember {
  id: string
  name: string | null
  email: string
  role: 'owner' | 'member'
}

interface TeamSettingsProps {
  teamId: string
  currentUserId: string
  isOwner: boolean
  onTeamUpdated: () => void
  onLeaveTeam: () => void
}

interface TeamData {
  name: string
  description: string
  maxMembers: number
  inviteCode: string
}

export function TeamSettings({
  teamId,
  currentUserId,
  isOwner,
  onTeamUpdated,
  onLeaveTeam,
}: TeamSettingsProps) {
  const [teamData, setTeamData] = useState<TeamData>({
    name: '',
    description: '',
    maxMembers: 10,
    inviteCode: '',
  })
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [teamResponse, membersResponse] = await Promise.all([
        apiFetch(`/api/teams/my-team`),
        apiFetch(`/api/teams/${teamId}/members`),
      ])

      if (!teamResponse.ok || !membersResponse.ok) {
        throw new Error('Failed to fetch team data')
      }

      const teamData = await teamResponse.json()
      const membersData = await membersResponse.json()

      setTeamData({
        name: teamData.team.name,
        description: teamData.team.description || '',
        maxMembers: teamData.team.maxMembers,
        inviteCode: teamData.team.inviteCode,
      })
      setMembers(membersData.members)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team settings')
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    fetchTeamData()
  }, [fetchTeamData])

  const handleSaveChanges = async () => {
    if (teamData.name.length < 3) {
      setError('Team name must be at least 3 characters')
      return
    }

    if (teamData.maxMembers < 2 || teamData.maxMembers > 100) {
      setError('Max members must be between 2 and 100')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await apiFetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: teamData.name,
          description: teamData.description,
          maxMembers: teamData.maxMembers,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update team')
      }

      onTeamUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyInviteCode = () => {
    // Clear any existing timeout
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }

    navigator.clipboard.writeText(teamData.inviteCode)
    setCopied(true)
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false)
      copyTimeoutRef.current = null
    }, 2000)
  }

  const handleTransferOwnership = async () => {
    if (!selectedMemberId) {
      setError('Please select a member to transfer ownership to')
      return
    }

    const member = members.find((m) => m.id === selectedMemberId)
    if (!member) return

    if (
      !confirm(
        `Are you sure you want to transfer ownership to ${member.name || member.email}? You will become a regular member.`
      )
    ) {
      return
    }

    try {
      setTransferring(true)
      setError(null)

      const response = await apiFetch(`/api/teams/${teamId}/transfer-ownership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newOwnerId: selectedMemberId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to transfer ownership')
      }

      onTeamUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer ownership')
    } finally {
      setTransferring(false)
    }
  }

  const handleDeleteTeam = async () => {
    if (
      !confirm(
        'Are you sure you want to delete this team? This action cannot be undone. All team members will be removed.'
      )
    ) {
      return
    }

    const confirmText = prompt('Type "DELETE" to confirm:')
    if (confirmText !== 'DELETE') {
      return
    }

    try {
      setDeleting(true)
      setError(null)

      const response = await apiFetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete team')
      }

      onTeamUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team')
    } finally {
      setDeleting(false)
    }
  }

  const handleLeaveTeam = async () => {
    if (!confirm('Are you sure you want to leave this team?')) {
      return
    }

    try {
      setLeaving(true)
      setError(null)

      const response = await apiFetch(`/api/teams/${teamId}/leave`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to leave team')
      }

      onLeaveTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave team')
    } finally {
      setLeaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="ml-3 text-text-secondary">Loading settings...</span>
      </div>
    )
  }

  const eligibleMembers = members.filter((m) => m.role !== 'owner' && m.id !== currentUserId)

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Invite Code */}
      <div className="p-4 bg-bg-secondary rounded-lg border border-border-primary">
        <h3 className="text-lg font-semibold text-white mb-3">Invite Code</h3>
        <div className="flex gap-2">
          <Input
            type="text"
            value={teamData.inviteCode}
            readOnly
            className="flex-1 font-mono text-lg tracking-wider"
          />
          <Button
            onClick={handleCopyInviteCode}
            className="px-4 bg-blue-600 hover:bg-blue-700"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-text-secondary mt-2">
          Share this code with others to invite them to your team
        </p>
      </div>

      {/* Team Settings - Owner Only */}
      {isOwner && (
        <div className="p-4 bg-bg-secondary rounded-lg border border-border-primary space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">Team Settings</h3>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Team Name</label>
            <Input
              type="text"
              value={teamData.name}
              onChange={(e) => setTeamData({ ...teamData, name: e.target.value })}
              minLength={3}
              disabled={saving}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Description</label>
            <Textarea
              value={teamData.description}
              onChange={(e) => setTeamData({ ...teamData, description: e.target.value })}
              rows={3}
              disabled={saving}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Max Members</label>
            <Input
              type="number"
              value={teamData.maxMembers}
              onChange={(e) =>
                setTeamData({ ...teamData, maxMembers: parseInt(e.target.value) || 10 })
              }
              min={2}
              max={100}
              disabled={saving}
              className="w-full"
            />
          </div>

          <Button
            onClick={handleSaveChanges}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      )}

      {/* Transfer Ownership - Owner Only */}
      {isOwner && eligibleMembers.length > 0 && (
        <div className="p-4 bg-bg-secondary rounded-lg border border-border-primary space-y-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-text-primary">Transfer Ownership</h3>
          </div>
          <p className="text-sm text-text-secondary">
            Transfer team ownership to another member. You will become a regular member.
          </p>

          <Select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            disabled={transferring}
            className="w-full"
          >
            <option value="">Select a member</option>
            {eligibleMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name || member.email}
              </option>
            ))}
          </Select>

          <Button
            onClick={handleTransferOwnership}
            disabled={!selectedMemberId || transferring}
            className="w-full bg-yellow-600 hover:bg-yellow-700"
          >
            {transferring ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <Crown className="w-4 h-4 mr-2" />
                Transfer Ownership
              </>
            )}
          </Button>
        </div>
      )}

      {/* Leave Team - Non-owners Only */}
      {!isOwner && (
        <div className="p-4 bg-bg-secondary rounded-lg border border-border-primary">
          <h3 className="text-lg font-semibold text-white mb-3">Leave Team</h3>
          <p className="text-sm text-text-secondary mb-4">
            You can leave this team at any time. You'll need a new invite code to rejoin.
          </p>
          <Button
            onClick={handleLeaveTeam}
            disabled={leaving}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            {leaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Leaving...
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4 mr-2" />
                Leave Team
              </>
            )}
          </Button>
        </div>
      )}

      {/* Delete Team - Owner Only */}
      {isOwner && (
        <div className="p-4 bg-red-900/20 rounded-lg border border-red-700">
          <h3 className="text-lg font-semibold text-red-400 mb-3">Danger Zone</h3>
          <p className="text-sm text-text-secondary mb-4">
            Permanently delete this team. This action cannot be undone. All members will be removed.
          </p>
          <Button
            onClick={handleDeleteTeam}
            disabled={deleting}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Team
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
