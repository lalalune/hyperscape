/**
 * API Hook
 * Provides a clean interface for making API calls with error handling
 */

import { useState, useCallback } from 'react'
import { useApp } from '../contexts/AppContext'

interface ApiOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
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
  ): Promise<T> => {
    const { 
      showError = true, 
      showSuccess = false, 
      successMessage,
      ...fetchOptions 
    } = options

    setLoading(true)
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      
      if (showError) {
        showNotification(errorMessage, 'error')
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    
    if (showSuccess) {
      showNotification(successMessage || 'Success', 'success')
    }
    
    setLoading(false)
    return data
  }, [showNotification])

  return { apiCall, loading }
}