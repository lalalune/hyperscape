import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Progress } from '../common'
import { CheckCircle, AlertTriangle, Package, Download, Play, RefreshCw } from 'lucide-react'
import { cn } from '../../styles'

interface CoverageSummary {
  total: number
  exists: number
  missing: number
  coveragePercent: string
  byPriority: Record<string, {
    total: number
    exists: number
    missing: number
    coveragePercent: string
  }>
  byCategory: Record<string, {
    total: number
    exists: number
    missing: number
    coveragePercent: string
  }>
}

interface QueuedAsset {
  id: string
  name: string
  type: string
  subtype: string
  category: string
  priority: string
  description: string
  requiredFor?: string[]
}

export const AssetCoverageCard: React.FC = () => {
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null)
  const [queue, setQueue] = useState<QueuedAsset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [selectedPriority, setSelectedPriority] = useState<string>('all')

  useEffect(() => {
    loadCoverage()
  }, [])

  const loadCoverage = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/requirements/coverage')
      const data = await response.json()
      
      if (data.success) {
        setCoverage(data.coverage)
      }
    } catch (error) {
      console.error('Failed to load coverage:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadQueue = async (priority: string = 'all') => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (priority !== 'all') params.append('priority', priority)
      params.append('limit', '50')
      
      const response = await fetch(`/api/requirements/queue?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setQueue(data.queue)
        setShowQueue(true)
      }
    } catch (error) {
      console.error('Failed to load queue:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const downloadBatchConfig = async () => {
    try {
      const response = await fetch(`/api/requirements/batch-config?priority=${selectedPriority}&limit=20`)
      const data = await response.json()
      
      if (data.success) {
        // Download as JSON file
        const blob = new Blob([JSON.stringify(data.config, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `batch-generation-${selectedPriority}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to download batch config:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-error'
      case 'high': return 'text-warning'
      case 'medium': return 'text-primary'
      case 'low': return 'text-text-secondary'
      default: return 'text-text-primary'
    }
  }

  const getPriorityBadgeVariant = (priority: string): 'error' | 'warning' | 'primary' | 'secondary' => {
    switch (priority) {
      case 'critical': return 'error'
      case 'high': return 'warning'
      case 'medium': return 'primary'
      default: return 'secondary'
    }
  }

  if (isLoading && !coverage) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-text-secondary">Loading asset coverage...</p>
        </CardContent>
      </Card>
    )
  }

  if (!coverage) {
    return null
  }

  const coveragePercent = parseFloat(coverage.coveragePercent)

  return (
    <Card className="bg-gradient-to-br from-bg-primary to-bg-secondary border-border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl",
              coveragePercent >= 80 ? "bg-success/20" : coveragePercent >= 50 ? "bg-warning/20" : "bg-error/20"
            )}>
              <Package className={cn(
                "w-5 h-5",
                coveragePercent >= 80 ? "text-success" : coveragePercent >= 50 ? "text-warning" : "text-error"
              )} />
            </div>
            <div>
              <CardTitle>Asset Coverage</CardTitle>
              <CardDescription>Hyperscape game assets status</CardDescription>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadCoverage}
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Coverage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-primary">Overall Coverage</span>
            <span className="text-lg font-bold text-primary">{coverage.coveragePercent}%</span>
          </div>
          <Progress 
            value={coveragePercent} 
            variant={coveragePercent >= 80 ? 'success' : coveragePercent >= 50 ? 'warning' : 'error'}
            className="h-3"
          />
          <div className="flex items-center justify-between mt-2 text-xs text-text-secondary">
            <span>{coverage.exists} of {coverage.total} assets</span>
            <span>{coverage.missing} missing</span>
          </div>
        </div>

        {/* By Priority */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Coverage by Priority</h3>
          <div className="space-y-2">
            {Object.entries(coverage.byPriority).map(([priority, stats]) => {
              if (stats.total === 0) return null
              const percent = parseFloat(stats.coveragePercent)
              
              return (
                <div key={priority} className="flex items-center gap-3">
                  <Badge 
                    variant={getPriorityBadgeVariant(priority)}
                    size="sm"
                    className="w-20 justify-center capitalize"
                  >
                    {priority}
                  </Badge>
                  <div className="flex-1">
                    <Progress value={percent} size="sm" />
                  </div>
                  <span className="text-xs text-text-secondary w-16 text-right">
                    {stats.exists}/{stats.total}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* By Category */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Coverage by Category</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(coverage.byCategory).map(([category, stats]) => {
              const percent = parseFloat(stats.coveragePercent)
              
              return (
                <div key={category} className="p-3 bg-bg-secondary/50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-text-primary capitalize">
                      {category}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {stats.exists}/{stats.total}
                    </span>
                  </div>
                  <Progress value={percent} size="sm" variant="primary" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t border-border-primary">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => loadQueue(selectedPriority)}
          >
            <Play className="w-4 h-4 mr-2" />
            Show Generation Queue
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={downloadBatchConfig}
            >
              <Download className="w-3 h-3 mr-1" />
              Batch Config
            </Button>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded-lg text-text-primary"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Generation Queue */}
        {showQueue && queue.length > 0 && (
          <div className="pt-4 border-t border-border-primary">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">
                Generation Queue ({queue.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQueue(false)}
              >
                Hide
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {queue.slice(0, 20).map((asset, idx) => (
                <div
                  key={asset.id}
                  className="p-3 bg-bg-tertiary/30 rounded-lg border border-border-primary hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text-primary">
                          {idx + 1}. {asset.name}
                        </span>
                        <Badge 
                          variant={getPriorityBadgeVariant(asset.priority)}
                          size="sm"
                        >
                          {asset.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-secondary mb-1">
                        {asset.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary" size="sm" className="capitalize">
                          {asset.category}
                        </Badge>
                        <span className="text-text-tertiary">
                          {asset.type}/{asset.subtype}
                        </span>
                      </div>
                      {asset.requiredFor && asset.requiredFor.length > 0 && (
                        <div className="mt-1 text-xs text-text-tertiary">
                          Required for: {asset.requiredFor.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {queue.length > 20 && (
                <div className="text-center py-2 text-xs text-text-tertiary">
                  ... and {queue.length - 20} more assets
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

