import React from 'react'
import * as THREE from '../core/extras/three.js'
import { useEffect, useMemo, useRef, useState } from 'react'
// Removed css utility import

import { createClientWorld } from '../core/createClientWorld'
import { CoreUI } from './components/CoreUI'
import { errorReporting } from './error-reporting'

export { System } from '../core/systems/System'

interface ClientProps {
  wsUrl?: string | (() => string | Promise<string>);
  onSetup?: (world: any, config: any) => void;
}

export function Client({ wsUrl, onSetup }: ClientProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const uiRef = useRef<HTMLDivElement | null>(null)
  const world = useMemo(() => {
    const world = createClientWorld();
    
    // Expose world immediately to browser window for testing
    if (typeof window !== 'undefined') {
      console.log('[World Client] Exposing world to window immediately');
      (window as any).world = world;
      console.log('[World Client] World available at window.world');
    }
    
    return world;
  }, [])
  const [ui, setUI] = useState(world.ui.state)
  useEffect(() => {
    world.on('ui', setUI)
    return () => {
      world.off('ui', setUI)
    }
  }, [])
  
  useEffect(() => {
    const init = async () => {
      console.log('[Client] Starting initialization...')
      const viewport = viewportRef.current
      const ui = uiRef.current
      const baseEnvironment = {
        model: '/base-environment.glb',
        bg: '/day2-2k.jpg',
        hdr: '/day2.hdr',
        sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
        sunIntensity: 1,
        sunColor: 0xffffff,
        fogNear: null,
        fogFar: null,
        fogColor: null,
      }
      let finalWsUrl: string
      if (typeof wsUrl === 'function') {
        const result = wsUrl()
        finalWsUrl = result instanceof Promise ? await result : result
      } else {
        // Use PUBLIC_WS_URL if available, otherwise construct from current host
        const publicWsUrl = process.env.PUBLIC_WS_URL
        if (publicWsUrl) {
          finalWsUrl = publicWsUrl
        } else {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const defaultWsUrl = `${protocol}//${window.location.host}/ws`
          finalWsUrl = wsUrl || defaultWsUrl
        }
      }
      console.log('[Client] WebSocket URL:', finalWsUrl)
      
      // Set assetsUrl from environment variable for asset:// URL resolution
      const assetsUrl = process.env.PUBLIC_ASSETS_URL || 
                       window.env?.PUBLIC_ASSETS_URL || 
                       `${window.location.protocol}//${window.location.host}/assets/`
      
      const config = { 
        viewport, 
        ui, 
        wsUrl: finalWsUrl, 
        baseEnvironment,
        assetsUrl 
      }
      onSetup?.(world, config)
      console.log('[Client] Initializing world with config:', config)
      
      // Set up error context with world information
      try {
        // Hook into world events to get player information for error reporting
        world.on('player', (playerData: any) => {
          if (playerData && playerData.id) {
            console.log('[ErrorReporting] Setting user ID:', playerData.id)
            errorReporting.setUserId(playerData.id)
          }
        })
        
        // Report successful world initialization
        errorReporting.reportCustomError('World client initialized successfully', {
          type: 'initialization_success',
          wsUrl: finalWsUrl,
          assetsUrl: assetsUrl
        })
      } catch (error) {
        console.warn('[ErrorReporting] Failed to set up world error context:', error)
      }
      
      ;(world as any).init(config)
    }
    init()
  }, [])
  return (
    <div
      className='App'
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '100vh',
      }}
    >
      <style>{`
        .App__viewport {
          position: absolute;
          inset: 0;
        }
        .App__ui {
          position: absolute;
          inset: 0;
          pointer-events: none;
          user-select: none;
          display: ${ui.visible ? 'block' : 'none'};
        }
      `}</style>
      <div className='App__viewport' ref={viewportRef}>
        <div className='App__ui' ref={uiRef}>
          <CoreUI world={world} />
        </div>
      </div>
    </div>
  )
}
