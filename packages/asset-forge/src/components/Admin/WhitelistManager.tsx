import { Shield, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/common'
import { apiFetch } from '@/utils/api'

interface WhitelistEntry {
  id: string
  walletAddress: string
  addedBy: {
    id: string
    name: string
  } | null
  reason?: string
  createdAt: string
}

export function WhitelistManager() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [walletAddress, setWalletAddress] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchWhitelist()
  }, [])

  const fetchWhitelist = async () => {
    try {
      setLoading(true)
      const response = await apiFetch('/api/admin/whitelist')

      if (!response.ok) {
        throw new Error('Failed to fetch whitelist')
      }

      const data = await response.json()
      setEntries(data.whitelist || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load whitelist')
    } finally {
      setLoading(false)
    }
  }

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate wallet address
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      setError('Invalid wallet address. Must start with 0x and be 42 characters long.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      setSuccess(null)

      const response = await apiFetch('/api/admin/whitelist/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress,
          reason: reason.trim() || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add wallet')
      }

      setSuccess('Wallet added to whitelist successfully')
      setWalletAddress('')
      setReason('')
      await fetchWhitelist()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add wallet')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveWallet = async (id: string) => {
    if (!confirm('Are you sure you want to remove this wallet from the whitelist?')) {
      return
    }

    try {
      setError(null)
      setSuccess(null)

      const response = await apiFetch('/api/admin/whitelist/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ walletAddress: entries.find(e => e.id === id)?.walletAddress })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove wallet')
      }

      setSuccess('Wallet removed from whitelist successfully')
      await fetchWhitelist()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove wallet')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Add Wallet Form */}
      <Card className="bg-bg-secondary border-border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Add Wallet to Whitelist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddWallet} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Wallet Address *
              </label>
              <Input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Reason (optional)
              </label>
              <Input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Early supporter, Partner organization"
                className="w-full"
                disabled={isSubmitting}
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !walletAddress}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Adding...' : 'Add to Whitelist'}
            </Button>
          </form>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              {success}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Whitelist Table */}
      <Card className="bg-bg-secondary border-border-primary">
        <CardHeader>
          <CardTitle>Whitelisted Wallets ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-text-secondary">Loading whitelist...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">No whitelisted wallets yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-primary">
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Wallet Address</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Added By</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Reason</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Date Added</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border-primary hover:bg-bg-tertiary transition-colors">
                      <td className="py-3 px-4">
                        <code className="text-sm text-blue-400">{entry.walletAddress}</code>
                      </td>
                      <td className="py-3 px-4 text-sm text-text-primary">
                        {entry.addedBy ? entry.addedBy.name : <span className="italic text-text-secondary">System</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary">
                        {entry.reason || <span className="italic">No reason provided</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary">{formatDate(entry.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          onClick={() => handleRemoveWallet(entry.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
