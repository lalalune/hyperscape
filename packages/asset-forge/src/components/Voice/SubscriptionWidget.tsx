/**
 * Subscription Widget
 *
 * Displays ElevenLabs subscription information, quota, and usage.
 *
 * Features:
 * - Real-time quota display
 * - Character usage vs limit
 * - Tier information
 * - Next reset date
 * - Usage warnings
 */

import { DollarSign, AlertTriangle, CheckCircle, RefreshCcw } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { voiceGenerationService } from '../../services/VoiceGenerationService'
import type { VoiceSubscriptionInfo } from '../../types/voice-generation'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card, CardHeader, CardContent } from '../common/Card'

interface SubscriptionWidgetProps {
  compact?: boolean
  showRefresh?: boolean
}

export const SubscriptionWidget: React.FC<SubscriptionWidgetProps> = ({
  compact = false,
  showRefresh = true
}) => {
  const [subscription, setSubscription] = useState<VoiceSubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadSubscription()
  }, [])

  const loadSubscription = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await voiceGenerationService.getSubscriptionInfo()
      setSubscription(data)
    } catch (err) {
      // Check if it's a 503 Service Unavailable error (API key not configured)
      if (err instanceof Error && err.message.includes('Voice generation service not available')) {
        setError('Voice features unavailable - ElevenLabs API key not configured')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load subscription')
      }
      console.error('Error loading subscription:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadSubscription()
    setRefreshing(false)
  }

  if (loading && !subscription) {
    return (
      <Card className={compact ? 'p-4' : ''}>
        <div className="flex items-center justify-center p-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={compact ? 'p-4' : ''}>
        <div className="p-4 text-center">
          <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{error}</p>
          {showRefresh && (
            <Button size="sm" variant="ghost" onClick={handleRefresh} className="mt-2">
              Retry
            </Button>
          )}
        </div>
      </Card>
    )
  }

  if (!subscription) return null

  const characterLimit = subscription.characterLimit
  const characterCount = subscription.characterCount
  const charactersRemaining = characterLimit - characterCount
  const usagePercent = (characterCount / characterLimit) * 100

  // Determine status
  const isLow = usagePercent > 80
  const isCritical = usagePercent > 95

  const tierInfo = subscription.tier || 'Free'
  const nextResetDate = subscription.nextCharacterCountResetUnix
    ? new Date(subscription.nextCharacterCountResetUnix * 1000).toLocaleDateString()
    : 'Unknown'

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
        <DollarSign className="w-5 h-5 text-purple-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">Quota</span>
            {isCritical ? (
              <Badge variant="error" size="sm">Critical</Badge>
            ) : isLow ? (
              <Badge variant="warning" size="sm">Low</Badge>
            ) : (
              <Badge variant="success" size="sm">Good</Badge>
            )}
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isCritical ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {charactersRemaining.toLocaleString()} / {characterLimit.toLocaleString()} remaining
          </p>
        </div>
        {showRefresh && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            loading={refreshing}
            title="Refresh quota"
          >
            <RefreshCcw className="w-4 h-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Subscription
          </h3>
          <Badge variant="secondary">{tierInfo}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Status</span>
            {isCritical ? (
              <Badge variant="error" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Critical
              </Badge>
            ) : isLow ? (
              <Badge variant="warning" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Low Quota
              </Badge>
            ) : (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Good
              </Badge>
            )}
          </div>

          {/* Usage Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Character Usage</span>
              <span className="text-sm font-medium text-white">
                {usagePercent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  isCritical ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">
                Used: {characterCount.toLocaleString()}
              </span>
              <span className="text-xs text-gray-400">
                Limit: {characterLimit.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Remaining Characters */}
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <span className="text-sm text-gray-400">Characters Remaining</span>
            <span className={`text-lg font-bold ${
              isCritical ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {charactersRemaining.toLocaleString()}
            </span>
          </div>

          {/* Reset Date */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Next Reset</span>
            <span className="text-sm text-white">{nextResetDate}</span>
          </div>

          {/* Warning Messages */}
          {isCritical && (
            <div className="p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm">
              Critical: Less than 5% quota remaining. Consider upgrading your plan.
            </div>
          )}
          {isLow && !isCritical && (
            <div className="p-3 bg-yellow-900 bg-opacity-20 border border-yellow-500 rounded text-yellow-400 text-sm">
              Warning: Low quota remaining. Monitor your usage carefully.
            </div>
          )}

          {/* Refresh Button */}
          {showRefresh && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleRefresh}
              loading={refreshing}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh Quota
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
