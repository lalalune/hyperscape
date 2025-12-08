import { Grid3x3, CheckCircle, AlertCircle, Loader2, Download, Package, RefreshCw, Eye } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { Asset } from '../../types'
import { spriteGeneratorClient } from '../../utils/sprite-generator-client'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalSection, Button, Select, Badge } from '../common'

import { apiFetch } from '@/utils/api'

interface SpriteGenerationModalProps {
  asset: Asset
  onClose: () => void
  onComplete: () => void
}

type SpriteConfig = {
  angles: 4 | 8
  resolution: 128 | 256 | 512
  backgroundColor: 'transparent' | string
}

type SpriteResult = {
  angle: number
  imageUrl: string
}

type ExistingSpriteMetadata = {
  assetId: string
  config: SpriteConfig
  angles: number[]
  spriteCount: number
  status: string
  generatedAt: string
}

const SpriteGenerationModal: React.FC<SpriteGenerationModalProps> = ({
  asset,
  onClose,
  onComplete
}) => {
  const [config, setConfig] = useState<SpriteConfig>({
    angles: 8,
    resolution: 256,
    backgroundColor: 'transparent'
  })
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'viewing' | 'generating' | 'success' | 'error'>('loading')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [sprites, setSprites] = useState<SpriteResult[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingSprites, setHasExistingSprites] = useState(false)
  const [existingMetadata, setExistingMetadata] = useState<ExistingSpriteMetadata | null>(null)

  // Load existing sprites on mount
  useEffect(() => {
    const loadExistingSprites = async () => {
      try {
        setStatus('loading')
        setMessage('Checking for existing sprites...')
        
        // Check if sprite metadata exists
        const metadataResponse = await apiFetch(`/api/assets/${asset.id}/sprite-metadata.json`)
        
        if (metadataResponse.ok) {
          const metadata: ExistingSpriteMetadata = await metadataResponse.json()
          setExistingMetadata(metadata)
          setHasExistingSprites(true)
          
          // Update config to match existing sprites
          if (metadata.config) {
            setConfig(metadata.config)
          }
          
          // Load sprite images
          const loadedSprites: SpriteResult[] = []
          for (const angle of metadata.angles) {
            const spriteUrl = `/api/assets/${asset.id}/sprites/${angle}deg.png?t=${Date.now()}`
            loadedSprites.push({
              angle,
              imageUrl: spriteUrl
            })
          }
          
          setSprites(loadedSprites)
          setStatus('viewing')
          setMessage(`Viewing ${metadata.spriteCount} existing sprites`)
        } else {
          // No existing sprites
          setStatus('idle')
          setHasExistingSprites(false)
        }
      } catch (error) {
        console.error('Error loading sprites:', error)
        // No existing sprites, start fresh
        setStatus('idle')
        setHasExistingSprites(false)
      }
    }
    
    loadExistingSprites()
  }, [asset.id])

  const handleGenerate = async () => {
    setStatus('generating')
    setMessage('Initializing sprite generation...')
    setProgress(0)
    setSprites([])

    try {
      // Generate sprites using the client
      const generatedSprites = await spriteGeneratorClient.generateSpritesForAsset(
        asset.id,
        {
          angles: config.angles,
          resolution: config.resolution,
          backgroundColor: config.backgroundColor
        }
      )

      // Update progress as we generate
      setProgress(100)
      setSprites(generatedSprites)
      setStatus('success')
      setMessage(`Successfully generated ${generatedSprites.length} sprites!`)
      
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Sprite generation failed')
      setProgress(0)
    }
  }

  const handleSaveSprites = async () => {
    if (sprites.length === 0) return
    
    setIsSaving(true)
    try {
      // Save sprites to server
      const response = await apiFetch(`/api/assets/${asset.id}/sprites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sprites: sprites.map(s => ({
            angle: s.angle,
            imageData: s.imageUrl
          })),
          config: {
            angles: config.angles,
            resolution: config.resolution,
            backgroundColor: config.backgroundColor
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save sprites')
      }

      setMessage('Sprites saved successfully!')
      setTimeout(() => {
        onComplete()
      }, 1000)
      
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Failed to save sprites')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownloadAll = () => {
    sprites.forEach((sprite, index) => {
      const link = document.createElement('a')
      link.href = sprite.imageUrl
      link.download = `${asset.id}-${sprite.angle}deg.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

  return (
    <Modal open={true} onClose={onClose} size="xl">
      <ModalHeader title="Generate Sprite Sheet" onClose={onClose} />

      <ModalBody>
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-sm text-text-secondary">{message}</p>
          </div>
        )}

        {status === 'viewing' && sprites.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                  <Eye className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-text-primary">Existing Sprites</h4>
                  <p className="text-sm text-text-secondary">
                    {sprites.length} sprites • {config.resolution}x{config.resolution}px
                    {existingMetadata?.generatedAt && (
                      <> • {new Date(existingMetadata.generatedAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <ModalSection title="Sprite Grid">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-secondary">
                    {sprites.length} sprites at {config.resolution}x{config.resolution}px
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadAll}
                  >
                    <Download className="w-4 h-4" />
                    Download All
                  </Button>
                </div>

                {/* Sprite Grid */}
                <div className={`grid ${config.angles === 8 ? 'grid-cols-4' : 'grid-cols-2'} gap-4`}>
                  {sprites.map((sprite, index) => (
                    <div key={index} className="group relative">
                      <div className="aspect-square bg-bg-tertiary rounded-lg p-2 overflow-hidden border border-border-primary">
                        <img 
                          src={sprite.imageUrl} 
                          alt={`${sprite.angle}°`}
                          className="w-full h-full object-contain"
                          style={{
                            imageRendering: config.resolution <= 128 ? 'pixelated' : 'auto'
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <a
                            href={sprite.imageUrl}
                            download={`${asset.id}-${sprite.angle}deg.png`}
                            className="p-2 bg-primary rounded-lg text-white hover:bg-primary-hover transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                      <div className="mt-2 text-center">
                        <Badge variant="secondary" size="sm">{sprite.angle}°</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModalSection>
          </>
        )}

        {status === 'idle' && (
          <>
            <ModalSection title="Configuration">
              <div className="space-y-4">
                {/* Asset Info */}
                <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary">{asset.name}</h4>
                      <p className="text-sm text-text-secondary">{asset.type}</p>
                    </div>
                  </div>
                </div>

                {/* Directions */}
                <div>
                  <label className="label mb-2">Sprite Directions</label>
                  <Select
                    value={config.angles.toString()}
                    onChange={(e) => setConfig({ ...config, angles: parseInt(e.target.value) as 4 | 8 })}
                  >
                    <option value="4">4 Directions (Cardinal: N, E, S, W)</option>
                    <option value="8">8 Directions (Full: N, NE, E, SE, S, SW, W, NW)</option>
                  </Select>
                  <p className="text-sm text-text-tertiary mt-1">
                    More directions provide smoother rotation but increase file size
                  </p>
                </div>

                {/* Resolution */}
                <div>
                  <label className="label mb-2">Sprite Resolution</label>
                  <Select
                    value={config.resolution.toString()}
                    onChange={(e) => setConfig({ ...config, resolution: parseInt(e.target.value) as 128 | 256 | 512 })}
                  >
                    <option value="128">128x128 (Small - Icons)</option>
                    <option value="256">256x256 (Medium - Game Sprites)</option>
                    <option value="512">512x512 (Large - High Quality)</option>
                  </Select>
                  <p className="text-sm text-text-tertiary mt-1">
                    Higher resolution provides better quality but larger files
                  </p>
                </div>

                {/* Background */}
                <div>
                  <label className="label mb-2">Background</label>
                  <Select
                    value={config.backgroundColor}
                    onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                  >
                    <option value="transparent">Transparent</option>
                    <option value="#ffffff">White</option>
                    <option value="#000000">Black</option>
                    <option value="#1a1a1a">Dark Gray</option>
                  </Select>
                </div>

                {/* Preview Info */}
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Grid3x3 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-primary mb-1">What You'll Get</h4>
                      <ul className="text-sm text-primary/80 space-y-1">
                        <li>• {config.angles} sprite images at {config.resolution}x{config.resolution}px</li>
                        <li>• Rendered from multiple camera angles</li>
                        <li>• Optimized for 2D game engines</li>
                        <li>• Downloadable individually or as a batch</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </ModalSection>
          </>
        )}

        {status === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h4 className="text-lg font-semibold text-text-primary">
              Generating Sprites
            </h4>
            <p className="text-sm text-text-secondary text-center max-w-sm">
              {message}
            </p>
            <div className="w-full max-w-xs space-y-2">
              <div className="bg-bg-secondary rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-text-tertiary text-center">
                {Math.round(progress)}% Complete
              </p>
            </div>
          </div>
        )}

        {status === 'success' && sprites.length > 0 && (
          <>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
            </div>
            
            <ModalSection title="Generated Sprites">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary">
                      {sprites.length} sprites generated at {config.resolution}x{config.resolution}px
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadAll}
                  >
                    <Download className="w-4 h-4" />
                    Download All
                  </Button>
                </div>

                {/* Sprite Grid */}
                <div className={`grid ${config.angles === 8 ? 'grid-cols-4' : 'grid-cols-2'} gap-4`}>
                  {sprites.map((sprite, index) => (
                    <div key={index} className="group relative">
                      <div className="aspect-square bg-bg-tertiary rounded-lg p-2 overflow-hidden border border-border-primary">
                        <img 
                          src={sprite.imageUrl} 
                          alt={`${sprite.angle}°`}
                          className="w-full h-full object-contain"
                          style={{
                            imageRendering: config.resolution <= 128 ? 'pixelated' : 'auto'
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <a
                            href={sprite.imageUrl}
                            download={`${asset.id}-${sprite.angle}deg.png`}
                            className="p-2 bg-primary rounded-lg text-white hover:bg-primary-hover transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                      <div className="mt-2 text-center">
                        <Badge variant="secondary" size="sm">{sprite.angle}°</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ModalSection>
          </>
        )}

        {status === 'error' && (
          <div className="bg-error/10 border border-error/20 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
              <div>
                <p className="text-error font-medium">
                  Generation Failed
                </p>
                <p className="text-sm text-error/80 mt-1">
                  {message}
                </p>
              </div>
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {status === 'viewing' && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button 
              variant="primary"
              onClick={() => {
                setStatus('idle')
                setHasExistingSprites(false)
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate Sprites
            </Button>
          </>
        )}

        {status === 'idle' && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="primary"
              onClick={handleGenerate}
            >
              <Grid3x3 className="w-4 h-4" />
              Generate Sprites
            </Button>
          </>
        )}

        {status === 'success' && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button 
              variant="primary"
              onClick={handleSaveSprites}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Save to Asset
                </>
              )}
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button 
              variant="primary"
              onClick={handleGenerate}
            >
              Try Again
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  )
}

export default SpriteGenerationModal

