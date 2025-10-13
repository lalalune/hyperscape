import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { NavigationView, NavigationContextValue } from '../types'
import { NAVIGATION_VIEWS } from '../constants'

const NavigationContext = createContext<NavigationContextValue | null>(null)

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<NavigationView>(NAVIGATION_VIEWS.GENERATION)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [navigationHistory, setNavigationHistory] = useState<NavigationView[]>([])

  const navigateTo = useCallback((view: NavigationView) => {
    if (view !== currentView) {
      setNavigationHistory(prev => [...prev, currentView])
      setCurrentView(view)
      
      // Clear selected asset when navigating away from assets
      if (view !== NAVIGATION_VIEWS.ASSETS) {
        setSelectedAssetId(null)
      }
    }
  }, [currentView])

  const navigateToAsset = useCallback((assetId: string) => {
    setSelectedAssetId(assetId)
    navigateTo(NAVIGATION_VIEWS.ASSETS)
  }, [navigateTo])

  const goBack = useCallback(() => {
    if (navigationHistory.length > 0) {
      const newHistory = [...navigationHistory]
      const previousView = newHistory.pop()!
      setNavigationHistory(newHistory)
      setCurrentView(previousView)
    }
  }, [navigationHistory])

  const value = useMemo<NavigationContextValue>(() => ({
    // State
    currentView,
    selectedAssetId,
    navigationHistory,
    
    // Actions
    navigateTo,
    navigateToAsset,
    goBack,
    
    // Helpers
    canGoBack: navigationHistory.length > 0
  }), [currentView, selectedAssetId, navigationHistory, navigateTo, navigateToAsset, goBack])

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
}

export const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
} 