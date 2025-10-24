import { Activity } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { getRendererPool, type RendererMetrics } from '../../services/WebGLRendererPool'
import { Card, CardContent, CardHeader, CardTitle } from '../common'

/**
 * Debug component for monitoring WebGL Renderer Pool metrics
 * Only shown in development mode
 */
export const RendererPoolMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<RendererMetrics | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only show in development
    if (import.meta.env.MODE !== 'development') {
      return
    }

    const pool = getRendererPool()

    const updateMetrics = () => {
      setMetrics(pool.getMetrics())
    }

    // Update every 2 seconds
    updateMetrics()
    const interval = setInterval(updateMetrics, 2000)

    return () => clearInterval(interval)
  }, [])

  // Don't render in production
  if (import.meta.env.MODE !== 'development' || !metrics) {
    return null
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-all"
        title="Toggle Renderer Pool Monitor"
      >
        <Activity className="w-5 h-5" />
      </button>

      {/* Monitor panel */}
      {isVisible && (
        <div className="fixed bottom-16 right-4 z-50 w-80">
          <Card className="bg-bg-primary/95 backdrop-blur-sm shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                WebGL Renderer Pool
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Active renderers */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-tertiary">Active Renderers</span>
                <span className="text-sm font-semibold text-text-primary">
                  {metrics.activeCount}
                </span>
              </div>

              {/* Pool utilization */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-text-tertiary">Pool Utilization</span>
                  <span className="text-sm font-semibold text-text-primary">
                    {metrics.poolUtilization.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-bg-tertiary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${metrics.poolUtilization}%` }}
                  />
                </div>
              </div>

              {/* Memory estimate */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-tertiary">Memory Estimate</span>
                <span className="text-sm font-semibold text-text-primary">
                  ~{metrics.memoryEstimateMB}MB
                </span>
              </div>

              {/* Statistics */}
              <div className="pt-2 border-t border-border-primary space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-tertiary">Total Created</span>
                  <span className="text-xs text-text-secondary">{metrics.totalCreated}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-tertiary">Total Released</span>
                  <span className="text-xs text-text-secondary">{metrics.totalReleased}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-tertiary">Total Disposed</span>
                  <span className="text-xs text-text-secondary">{metrics.totalDisposed}</span>
                </div>
              </div>

              {/* Health indicator */}
              <div className="pt-2 border-t border-border-primary">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      metrics.poolUtilization < 75
                        ? 'bg-green-500'
                        : metrics.poolUtilization < 90
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span className="text-xs text-text-tertiary">
                    {metrics.poolUtilization < 75
                      ? 'Healthy'
                      : metrics.poolUtilization < 90
                      ? 'Moderate Load'
                      : 'High Load'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
