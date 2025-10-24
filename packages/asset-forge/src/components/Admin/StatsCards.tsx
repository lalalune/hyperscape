import { Users, Package, Database, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react'
import React, { useEffect } from 'react'

import { Card, CardContent } from '@/components/common'
import { apiFetch } from '@/utils/api'

interface PlatformStats {
  users: { total: number }
  projects: { total: number }
  assets: { total: number }
  teams: { total: number }
  generations: {
    total: number
    completed: number
    failed: number
    successRate: string
  }
}

export function StatsCards() {
  const [stats, setStats] = React.useState<PlatformStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await apiFetch('/api/admin/stats')

        if (!response.ok) {
          throw new Error('Failed to fetch stats')
        }

        const data = await response.json()
        setStats(data.stats)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="bg-bg-secondary border-border-primary">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-bg-tertiary rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-bg-tertiary rounded w-1/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-bg-secondary border-border-primary">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Error Loading Stats</h3>
              <p className="text-sm text-text-secondary">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return null
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.users.total.toLocaleString(),
      icon: Users,
      color: 'text-blue-400'
    },
    {
      title: 'Total Projects',
      value: stats.projects.total.toLocaleString(),
      icon: Database,
      color: 'text-purple-400'
    },
    {
      title: 'Total Assets',
      value: stats.assets.total.toLocaleString(),
      icon: Package,
      color: 'text-green-400'
    },
    {
      title: 'Total Teams',
      value: stats.teams.total.toLocaleString(),
      icon: Users,
      color: 'text-orange-400'
    },
    {
      title: 'Total Generations',
      value: stats.generations.total.toLocaleString(),
      icon: TrendingUp,
      color: 'text-cyan-400'
    },
    {
      title: 'Success Rate',
      value: `${stats.generations.successRate}%`,
      icon: CheckCircle,
      color: 'text-emerald-400'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {statCards.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title} className="bg-bg-secondary border-border-primary hover:border-primary transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-text-secondary mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
                </div>
                <div className={`p-3 bg-bg-primary rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
