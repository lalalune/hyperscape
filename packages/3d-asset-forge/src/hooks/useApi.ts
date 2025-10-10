/**
 * API Hook
 * Provides a clean interface for making API calls with error handling
 */

import { useState, useCallback } from 'react'
import { useApp } from '../contexts/AppContext'

interface ApiOptions extends RequestInit {
  showError?: boolean
  showSuccess?: boolean
  successMessage?: string
}

export function useApi() {
  const [loading, setLoading] = useState(false)
  const { showNotification } = useApp()

  const apiCall = useCallback(async <T>(
    url: string,
    options: ApiOptions = {}
  ): Promise<T | null> => {
    const { 
      showError = true, 
      showSuccess = false, 
      successMessage,
      ...fetchOptions 
    } = options

    setLoading(true)
    
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: { message: `HTTP ${response.status}: ${response.statusText}` } 
        }))
        
        throw new Error(errorData.error?.message || 'Request failed')
      }

      const data = await response.json()
      
      if (showSuccess) {
        showNotification(successMessage || 'Success', 'success')
      }
      
      return data
    } catch (error) {
      if (showError) {
        showNotification(
          error instanceof Error ? error.message : 'An error occurred',
          'error'
        )
      }
      console.error('API Error:', error)
      return null
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  return { apiCall, loading }
}