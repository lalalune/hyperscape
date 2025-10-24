/**
 * Usage Statistics Component
 * Displays user's API usage statistics and generation history
 */

import { Loader2, TrendingUp, Zap, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'

import { apiFetch } from '@/utils/api'

interface UsageStatsData {
  totalGenerations: number
  totalCreditsUsed: number
  byProvider: {
    openai: { count: number; credits: number }
    meshy: { count: number; credits: number }
    elevenlabs: { count: number; credits: number }
  }
  byStatus: {
    completed: number
    failed: number
    pending: number
  }
  recentGenerations: Array<{
    id: string
    generationType: string
    provider: string
    status: string
    creditsUsed: number
    startedAt: string
    completedAt: string | null
    duration: number | null
    errorMessage: string | null
  }>
}

const PROVIDER_COLORS = {
  openai: 'text-green-400',
  meshy: 'text-purple-400',
  elevenlabs: 'text-blue-400',
}

const PROVIDER_NAMES = {
  openai: 'OpenAI',
  meshy: 'Meshy AI',
  elevenlabs: 'ElevenLabs',
}

export function UsageStats() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<UsageStatsData | null>(null)

  useEffect(() => {
    fetchUsage()
  }, [])

  const fetchUsage = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiFetch('/api/user/usage')

      if (!response.ok) {
        throw new Error('Failed to fetch usage statistics')
      }

      const data = await response.json()
      setStats(data.usage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-lg p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-text-secondary">Loading usage statistics...</span>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="bg-bg-secondary rounded-lg p-8">
        <p className="text-red-400">{error || 'Failed to load usage statistics'}</p>
      </div>
    )
  }

  const totalProviderCredits =
    stats.byProvider.openai.credits +
    stats.byProvider.meshy.credits +
    stats.byProvider.elevenlabs.credits

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bg-secondary rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-900/30 rounded-lg">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-text-secondary">Total Generations</h3>
          </div>
          <p className="text-3xl font-bold text-text-primary">{stats.totalGenerations}</p>
        </div>

        <div className="bg-bg-secondary rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-sm font-medium text-text-secondary">Credits Used</h3>
          </div>
          <p className="text-3xl font-bold text-text-primary">{stats.totalCreditsUsed.toLocaleString()}</p>
        </div>

        <div className="bg-bg-secondary rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-sm font-medium text-text-secondary">Success Rate</h3>
          </div>
          <p className="text-3xl font-bold text-text-primary">
            {stats.totalGenerations > 0
              ? Math.round((stats.byStatus.completed / stats.totalGenerations) * 100)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Usage by Provider */}
      <div className="bg-bg-secondary rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Usage by Provider</h2>

        <div className="space-y-4">
          {Object.entries(stats.byProvider).map(([provider, data]: [string, { count: number; credits: number }]) => {
            const percentage = totalProviderCredits > 0
              ? (data.credits / totalProviderCredits) * 100
              : 0

            return (
              <div key={provider}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${PROVIDER_COLORS[provider as keyof typeof PROVIDER_COLORS]}`}>
                    {PROVIDER_NAMES[provider as keyof typeof PROVIDER_NAMES]}
                  </span>
                  <div className="text-sm text-text-secondary">
                    <span className="text-white font-medium">{data.count}</span> generations
                    <span className="mx-2">•</span>
                    <span className="text-white font-medium">{data.credits.toLocaleString()}</span> credits
                  </div>
                </div>
                <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      provider === 'openai' ? 'bg-green-500' :
                      provider === 'meshy' ? 'bg-purple-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-bg-secondary rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Generation Status</h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm text-text-secondary">Completed</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.byStatus.completed}</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-text-secondary">Failed</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.byStatus.failed}</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-text-secondary">Pending</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.byStatus.pending}</p>
          </div>
        </div>
      </div>

      {/* Recent Generations */}
      <div className="bg-bg-secondary rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Generations</h2>

        {stats.recentGenerations.length === 0 ? (
          <p className="text-text-secondary text-center py-8">No generations yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-text-secondary border-b border-border-primary">
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Provider</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Credits</th>
                  <th className="pb-3 font-medium">Duration</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {stats.recentGenerations.map((gen: UsageStatsData['recentGenerations'][0]) => (
                  <tr key={gen.id} className="border-b border-border-primary/50 last:border-0">
                    <td className="py-3 text-white capitalize">{gen.generationType}</td>
                    <td className="py-3">
                      <span className={PROVIDER_COLORS[gen.provider as keyof typeof PROVIDER_COLORS]}>
                        {PROVIDER_NAMES[gen.provider as keyof typeof PROVIDER_NAMES]}
                      </span>
                    </td>
                    <td className="py-3">
                      {gen.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Completed
                        </span>
                      )}
                      {gen.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                      {(gen.status === 'pending' || gen.status === 'processing') && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded text-xs">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-text-primary">{gen.creditsUsed}</td>
                    <td className="py-3 text-text-primary">
                      {gen.duration ? `${Math.round(gen.duration / 1000)}s` : '-'}
                    </td>
                    <td className="py-3 text-text-secondary">
                      {new Date(gen.startedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
