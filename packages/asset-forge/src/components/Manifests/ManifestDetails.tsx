/**
 * Manifest Details
 * Shows detailed information about a selected manifest item
 */

import { Copy, CheckCircle, Box, Sparkles } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'

import { CDN_URL } from '../../config/api'
import { NAVIGATION_VIEWS } from '../../constants/navigation'
import { useNavigation } from '../../contexts/NavigationContext'
import { useGenerationStore } from '../../store/useGenerationStore'
import type { AnyManifest } from '../../types/manifests'
import { manifestToGenerationConfig, hasValidModel, getGenerationButtonText } from '../../utils/manifest-to-generation-config'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import ThreeViewer, { ThreeViewerRef } from '../shared/ThreeViewer'

interface ManifestDetailsProps {
  item: AnyManifest | null
  onClose: () => void
}

export const ManifestDetails: React.FC<ManifestDetailsProps> = ({
  item,
  onClose
}) => {
  const [copied, setCopied] = useState(false)
  const [showModel, setShowModel] = useState(false)
  const viewerRef = useRef<ThreeViewerRef>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const { navigateTo } = useNavigation()
  // Selective subscriptions for performance
  const setGenerationType = useGenerationStore(state => state.setGenerationType)
  const setAssetName = useGenerationStore(state => state.setAssetName)
  const setAssetType = useGenerationStore(state => state.setAssetType)
  const setDescription = useGenerationStore(state => state.setDescription)
  const setGameStyle = useGenerationStore(state => state.setGameStyle)
  const setEnableRigging = useGenerationStore(state => state.setEnableRigging)
  const setCharacterHeight = useGenerationStore(state => state.setCharacterHeight)
  const setEnableRetexturing = useGenerationStore(state => state.setEnableRetexturing)
  const setEnableSprites = useGenerationStore(state => state.setEnableSprites)
  const setQuality = useGenerationStore(state => state.setQuality)
  const resetForm = useGenerationStore(state => state.resetForm)

  if (!item) {
    return (
      <div className="h-full flex items-center justify-center text-text-tertiary">
        <p>Select an item to view details</p>
      </div>
    )
  }

  const handleCopy = () => {
    // Clear any existing timeout
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }

    navigator.clipboard.writeText(JSON.stringify(item, null, 2))
    setCopied(true)
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false)
      copyTimeoutRef.current = null
    }, 2000)
  }
  
  const handleGenerateModel = () => {
    // Convert manifest to generation config
    // This creates a structured prompt from the manifest data:
    // - Items: type, value, tier, combat stats
    // - Mobs: level, health, XP, behavior, creature type
    // - NPCs: services, archetype, dialogue context
    // - Resources: harvest skill, required level, yields
    const config = manifestToGenerationConfig(item)
    
    // Reset form to avoid conflicts
    resetForm()
    
    // Populate generation form with manifest data
    setGenerationType(config.generationType as 'item' | 'avatar')
    setAssetName(config.name)
    setAssetType(config.type)
    setDescription(config.description)
    setGameStyle('runescape')
    setQuality(config.quality as 'standard' | 'high' | 'ultra')
    
    if (config.enableRigging) {
      setEnableRigging(true)
      if (config.riggingOptions?.heightMeters) {
        setCharacterHeight(config.riggingOptions.heightMeters)
      }
    }
    
    if (config.enableRetexturing !== undefined) {
      setEnableRetexturing(config.enableRetexturing)
    }
    
    if (config.enableSprites !== undefined) {
      setEnableSprites(config.enableSprites)
    }
    
    // Navigate to Generation page
    // User will see pre-filled form and can start generation immediately
    // Generated asset will include metadata.gameId and metadata.sourceManifest
    // Asset will automatically appear in Assets page viewer after generation
    navigateTo(NAVIGATION_VIEWS.GENERATION)
  }

  // Extract model path from item
  const getModelPath = (): string | null => {
    if ('modelPath' in item && typeof item.modelPath === 'string' && item.modelPath) {
      // Convert asset:// protocol to CDN URL
      if (item.modelPath.startsWith('asset://')) {
        return `${CDN_URL}/${item.modelPath.replace('asset://', '')}`
      }
      // Already a full path
      if (item.modelPath.startsWith('http')) {
        return item.modelPath
      }
      // Relative path - assume CDN
      return `${CDN_URL}${item.modelPath.startsWith('/') ? '' : '/'}${item.modelPath}`
    }
    return null
  }

  const modelPath = getModelPath()
  const hasModel = modelPath !== null
  const needsModel = !hasValidModel(item)

  const renderValue = (_key: string, value: unknown): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-text-tertiary italic">null</span>
    }

    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? 'success' : 'secondary'}>
          {value ? 'true' : 'false'}
        </Badge>
      )
    }

    if (typeof value === 'number') {
      return <span className="text-accent font-mono">{value}</span>
    }

    if (typeof value === 'string') {
      // Check if it's a path
      if (value.includes('/') || value.includes('.glb') || value.includes('.png')) {
        return <span className="text-primary font-mono text-xs">{value}</span>
      }
      return <span className="text-text-primary">{value}</span>
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-text-tertiary italic">[]</span>
      }
      return (
        <div className="ml-4 space-y-1">
          {value.map((item, idx) => (
            <div key={idx} className="text-sm">
              {typeof item === 'object' ? (
                <pre className="bg-bg-primary rounded p-2 text-xs overflow-x-auto">
                  {JSON.stringify(item, null, 2)}
                </pre>
              ) : (
                <span className="text-text-secondary">• {String(item)}</span>
              )}
            </div>
          ))}
        </div>
      )
    }

    if (typeof value === 'object') {
      return (
        <pre className="bg-bg-primary rounded-lg p-3 text-xs overflow-x-auto mt-1">
          {JSON.stringify(value, null, 2)}
        </pre>
      )
    }

    return <span className="text-text-primary">{String(value)}</span>
  }

  return (
    <div className="h-full flex flex-col bg-bg-secondary border border-border-primary rounded-xl shadow-theme-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border-primary bg-bg-tertiary">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text-primary">
              {(() => {
                if ('name' in item && item.name) return String(item.name)
                if ('id' in item && item.id) return String(item.id)
                return 'Details'
              })()}
            </h3>
            {(() => {
              if ('id' in item && item.id) {
                return <p className="text-sm text-text-tertiary font-mono mt-1">{String(item.id)}</p>
              }
              return null
            })()}
            {needsModel && (
              <div className="mt-2">
                <Button
                  onClick={handleGenerateModel}
                  variant="primary"
                  size="sm"
                  className="text-xs"
                >
                  <Sparkles size={14} className="mr-1" />
                  {getGenerationButtonText(item)}
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasModel && (
              <button
                onClick={() => setShowModel(!showModel)}
                className={`p-2 rounded-lg transition-all ${
                  showModel
                    ? 'bg-primary bg-opacity-20 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                }`}
                title={showModel ? 'Hide 3D Model' : 'Show 3D Model'}
              >
                <Box size={18} />
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-all"
              title="Copy JSON"
            >
              {copied ? <CheckCircle size={18} className="text-success" /> : <Copy size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-all"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {showModel && hasModel ? (
          /* 3D Model Viewer */
          <div className="h-full">
            <ThreeViewer
              ref={viewerRef}
              modelUrl={modelPath!}
              showGroundPlane={true}
              lightMode={true}
              assetInfo={{
                name: 'name' in item ? String(item.name) : undefined,
                type: 'type' in item ? String(item.type) : undefined
              }}
            />
          </div>
        ) : (
          /* Data Fields */
          <div className="p-4">
            <div className="space-y-4">
              {Object.entries(item).map(([key, value]) => (
                <div key={key} className="pb-3 border-b border-border-primary last:border-0">
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-semibold text-text-secondary uppercase tracking-wide min-w-[120px]">
                      {key}
                    </span>
                    <div className="flex-1">
                      {renderValue(key, value)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer with JSON */}
      <div className="p-4 border-t border-border-primary bg-bg-tertiary">
        <details className="cursor-pointer">
          <summary className="text-sm font-semibold text-text-secondary uppercase tracking-wide select-none">
            Raw JSON
          </summary>
          <pre className="mt-2 bg-bg-primary rounded-lg p-3 text-xs overflow-auto max-h-60">
            {JSON.stringify(item, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  )
}

