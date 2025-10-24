/**
 * useOfflineStatus Hook
 *
 * React hook for detecting online/offline status.
 * Provides real-time connection status and quality information.
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { isOnline, isOffline, connectionType, saveData } = useOfflineStatus()
 *
 *   if (isOffline) {
 *     return <OfflineIndicator />
 *   }
 *
 *   return <OnlineContent />
 * }
 * ```
 */

import { useState, useEffect } from 'react'

interface OfflineStatus {
  isOnline: boolean
  isOffline: boolean
  connectionType: string
  effectiveType: string
  downlink: number | null
  rtt: number | null
  saveData: boolean
  wasOffline: boolean
}

export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<{
    type: string
    effectiveType: string
    downlink: number | null
    rtt: number | null
    saveData: boolean
  }>({
    type: 'unknown',
    effectiveType: 'unknown',
    downlink: null,
    rtt: null,
    saveData: false
  })

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine
      setIsOnline(online)

      if (!online) {
        setWasOffline(true)
      }
    }

    const updateConnectionInfo = () => {
      const connection = (navigator as Navigator & {
        connection?: {
          type?: string
          effectiveType?: string
          downlink?: number
          rtt?: number
          saveData?: boolean
        }
      }).connection

      if (connection) {
        setConnectionInfo({
          type: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || null,
          rtt: connection.rtt || null,
          saveData: connection.saveData || false
        })
      }
    }

    // Initial update
    updateOnlineStatus()
    updateConnectionInfo()

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    // Listen for connection changes
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection
    if (connection) {
      connection.addEventListener('change', updateConnectionInfo)
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)

      if (connection) {
        connection.removeEventListener('change', updateConnectionInfo)
      }
    }
  }, [])

  return {
    isOnline,
    isOffline: !isOnline,
    connectionType: connectionInfo.type,
    effectiveType: connectionInfo.effectiveType,
    downlink: connectionInfo.downlink,
    rtt: connectionInfo.rtt,
    saveData: connectionInfo.saveData,
    wasOffline
  }
}

export default useOfflineStatus
