/**
 * Team Members Component
 * Display and manage team members
 */

import { Crown, Trash2, Loader2, Users } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

import { Badge, Button } from '@/components/common'
import { apiFetch } from '@/utils/api'

interface TeamMember {
  id: string
  name: string | null
  email: string
  role: 'owner' | 'member'
  joinedAt: string
}

interface TeamMembersProps {
  teamId: string
  currentUserId: string
  isOwner: boolean
}

export function TeamMembers({ teamId, currentUserId, isOwner }: TeamMembersProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [maxMembers, setMaxMembers] = useState(10)

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiFetch(`/api/teams/${teamId}/members`)

      if (!response.ok) {
        throw new Error('Failed to fetch team members')
      }

      const data = await response.json()
      setMembers(data.members)
      setMemberCount(data.members.length)
      setMaxMembers(data.maxMembers || 10)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleRemoveMember = async (userId: string) => {
    if (userId === currentUserId) {
      alert('You cannot remove yourself. Use "Leave Team" instead.')
      return
    }

    const member = members.find((m) => m.id === userId)
    if (!member) return

    if (!confirm(`Remove ${member.name || member.email} from the team?`)) {
      return
    }

    try {
      setRemovingId(userId)

      const response = await apiFetch(`/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove member')
      }

      await fetchMembers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemovingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="ml-3 text-text-secondary">Loading members...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-text-secondary" />
          <h3 className="text-lg font-semibold text-text-primary">Team Members</h3>
          <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">
            {memberCount} / {maxMembers}
          </Badge>
        </div>
      </div>

      {/* Members Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Name</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Email</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Role</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Joined</th>
              {isOwner && (
                <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-bg-secondary/50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary">
                      {member.name || 'Unknown User'}
                    </span>
                    {member.id === currentUserId && (
                      <Badge className="bg-bg-tertiary text-text-primary">You</Badge>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-text-secondary text-sm">{member.email}</td>
                <td className="py-3 px-4">
                  {member.role === 'owner' ? (
                    <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30 flex items-center gap-1 w-fit">
                      <Crown className="w-3 h-3" />
                      Owner
                    </Badge>
                  ) : (
                    <Badge className="bg-bg-tertiary text-text-primary">Member</Badge>
                  )}
                </td>
                <td className="py-3 px-4 text-text-secondary text-sm">
                  {formatDate(member.joinedAt)}
                </td>
                {isOwner && (
                  <td className="py-3 px-4 text-right">
                    {member.id !== currentUserId && member.role !== 'owner' && (
                      <Button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removingId === member.id}
                        className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30"
                      >
                        {removingId === member.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <div className="text-center py-8">
          <p className="text-text-secondary">No members found</p>
        </div>
      )}
    </div>
  )
}
