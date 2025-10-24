import { Activity, User, Package, AlertTriangle, LogIn, CheckCircle, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/common'
import { apiFetch } from '@/utils/api'

interface ActivityEvent {
  id: string
  type: 'generation' | 'login' | 'error' | 'signup' | 'asset_created'
  userId: string
  userName: string
  message: string
  metadata?: Record<string, string>
  timestamp: string
  success?: boolean
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchActivity()

    // Poll for new activity every 30 seconds
    const interval = setInterval(fetchActivity, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchActivity = async () => {
    try {
      const response = await apiFetch('/api/admin/activity')

      if (!response.ok) {
        throw new Error('Failed to fetch activity')
      }

      const data = await response.json()
      setEvents(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  const getEventIcon = (type: ActivityEvent['type'], success?: boolean) => {
    switch (type) {
      case 'generation':
        return success ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />
      case 'login':
        return <LogIn className="w-4 h-4 text-blue-400" />
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />
      case 'signup':
        return <User className="w-4 h-4 text-purple-400" />
      case 'asset_created':
        return <Package className="w-4 h-4 text-green-400" />
      default:
        return <Activity className="w-4 h-4 text-gray-400" />
    }
  }

  const getEventBadgeVariant = (type: ActivityEvent['type'], success?: boolean): 'success' | 'error' | 'primary' | 'secondary' | 'warning' => {
    switch (type) {
      case 'generation':
        return success ? 'success' : 'error'
      case 'error':
        return 'error'
      case 'signup':
        return 'primary'
      case 'asset_created':
        return 'success'
      default:
        return 'secondary'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatEventType = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'generation':
        return 'Generation'
      case 'login':
        return 'Login'
      case 'error':
        return 'Error'
      case 'signup':
        return 'Sign Up'
      case 'asset_created':
        return 'Asset Created'
      default:
        return type
    }
  }

  if (loading) {
    return (
      <Card className="bg-bg-secondary border-border-primary">
        <CardContent className="p-6">
          <div className="text-center py-8 text-text-secondary">Loading activity...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-bg-secondary border-border-primary">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Error Loading Activity</h3>
              <p className="text-sm text-text-secondary">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-bg-secondary border-border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">No recent activity</div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-bg-primary hover:bg-bg-tertiary transition-colors"
              >
                <div className="mt-1">{getEventIcon(event.type, event.success)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getEventBadgeVariant(event.type, event.success)} size="sm">
                      {formatEventType(event.type)}
                    </Badge>
                    <span className="text-sm font-medium text-text-primary truncate">{event.userName}</span>
                  </div>

                  <p className="text-sm text-text-primary">{event.message}</p>

                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(event.metadata).map(([key, value]) => (
                        <code key={key} className="text-xs bg-bg-tertiary px-2 py-1 rounded text-text-secondary">
                          {key}: {value}
                        </code>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-xs text-text-tertiary whitespace-nowrap">
                  {formatTimestamp(event.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
