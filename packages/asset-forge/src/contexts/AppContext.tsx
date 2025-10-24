/**
 * Global App Context
 * Provides centralized state management for the application
 */

import { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react'

interface AppContextType {
  loading: boolean
  setLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void
  notification: { message: string; type: 'success' | 'error' | 'info' } | null
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void
  clearNotification: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<AppContextType['notification']>(null)
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
    }
  }, [])

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Clear any existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current)
    }

    setNotification({ message, type })

    // Auto-clear after 5 seconds
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null)
      notificationTimeoutRef.current = null
    }, 5000)
  }

  const clearNotification = () => {
    setNotification(null)
  }

  const contextValue = useMemo<AppContextType>(() => ({
    loading,
    setLoading,
    error,
    setError,
    notification,
    showNotification,
    clearNotification
  }), [loading, error, notification])

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}