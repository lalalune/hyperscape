import { useEffect, useMemo, useRef, useState } from 'react'
import { THREE, createClientWorld, EventType, System } from '@hyperscape/shared'
import { World } from '@hyperscape/shared'
import { CoreUI } from './components/CoreUI'

export { System }

interface ClientProps {
  wsUrl?: string
  onSetup?: (world: InstanceType<typeof World>, config: unknown) => void
}

export function Client({ wsUrl, onSetup }: ClientProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const uiRef = useRef<HTMLDivElement>(null)
  
  // Detect HMR and force full page reload instead of hot reload
  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        console.log('[Client] HMR detected - reloading page to prevent duplicate worlds')
        window.location.reload()
      })
    }
  }, [])
  
  // Create world immediately so network can connect and deliver characterList
  const world = useMemo(() => {
    console.log('[Client] Creating new world instance')
    const w = createClientWorld()
    console.log('[Client] World instance created');
    
    // Expose world for browser debugging
    ;(window as { world: InstanceType<typeof World> }).world = w;
    
    // Install simple debug commands
    const debugWindow = window as typeof window & {
      debug?: {
        seeHighEntities: () => void
        seeGround: () => void
        mobs: () => Array<{ name: string; position: number[]; hasMesh: boolean; meshVisible: boolean }>
      }
    }
    debugWindow.debug = {
      // Teleport camera to see mobs at Y=40+
      seeHighEntities: () => {
        if (w.camera) {
          w.camera.position.set(10, 50, 10);
          w.camera.lookAt(0, 40, 0);
          console.log('📷 Camera moved to Y=50, looking at Y=40');
        }
      },
      // Teleport to ground level
      seeGround: () => {
        if (w.camera) {
          w.camera.position.set(10, 5, 10);
          w.camera.lookAt(0, 0, 0);
          console.log('📷 Camera moved to ground level');
        }
      },
      // List all mobs with positions
      mobs: () => {
        type EntityWithNode = { 
          type: string; 
          name: string; 
          node: { position: { toArray: () => number[] } }; 
          mesh?: { visible: boolean } 
        }
        type EntityManagerType = { 
          getAllEntities?: () => Map<string, EntityWithNode> 
        }
        
        const entityManager = w.getSystem('entity-manager') as EntityManagerType | null
        const mobs: Array<{ name: string; position: number[]; hasMesh: boolean; meshVisible: boolean }> = []
        
        if (entityManager?.getAllEntities) {
          for (const [_id, entity] of entityManager.getAllEntities()) {
            if (entity.type === 'mob') {
              mobs.push({
                name: entity.name,
                position: entity.node.position.toArray(),
                hasMesh: !!entity.mesh,
                meshVisible: entity.mesh?.visible ?? false
              })
            }
          }
        }
        console.table(mobs)
        return mobs
      }
    };
    console.log('🛠️  Debug commands ready: debug.seeHighEntities(), debug.seeGround(), debug.mobs()');
    
    return w;
  }, [])
  const defaultUI = { visible: true, active: false, app: null, pane: null }
  const [ui, setUI] = useState(defaultUI)
  useEffect(() => {
    const handleUI = (data: { visible: boolean; active: boolean; app: null; pane: null }) => {
      setUI(data)
    }
    world.on(EventType.UI_UPDATE, handleUI, undefined)
    return () => {
      world.off(EventType.UI_UPDATE, handleUI, undefined, undefined)
    }
  }, [world])

  // Handle window resize to update Three.js canvas
  useEffect(() => {
    const handleResize = () => {
      const viewport = viewportRef.current
      const graphics = world.getSystem('graphics') as { resize?: (width: number, height: number) => void } | null
      if (viewport && graphics?.resize) {
        const width = viewport.offsetWidth
        const height = viewport.offsetHeight
        graphics.resize(width, height)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [world])

  useEffect(() => {
    let cleanedUp = false
    
    const init = async () => {
      console.log('[Client] Init useEffect triggered')
      const viewport = viewportRef.current
      const ui = uiRef.current
      
      if (!viewport || !ui) {
        console.log('[Client] Waiting for viewport/ui refs...')
        return
      }
      console.log('[Client] Starting world initialization...')
            
      const baseEnvironment = {
        model: 'asset://world/base-environment.glb',
        bg: 'asset://world/day2-2k.jpg',
        hdr: 'asset://world/day2.hdr',
        sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
        sunIntensity: 1,
        sunColor: 0xffffff,
        fogNear: null,
        fogFar: null,
        fogColor: null,
      }
      
      // Direct connection - no Vite proxy
      // Default to game server on 5555, CDN on 8080
      const finalWsUrl = wsUrl || 
        import.meta.env.PUBLIC_WS_URL || 
        'ws://localhost:5555/ws'
      
      console.log('[Client] Direct WebSocket URL:', finalWsUrl)
      
      // Always use absolute CDN URL for all assets
      const cdnUrl = import.meta.env.PUBLIC_CDN_URL || 'http://localhost:8080';
      const assetsUrl = `${cdnUrl}/`
      
      console.log('[Client] Direct CDN Configuration:')
      console.log('[Client]   cdnUrl:', cdnUrl)
      console.log('[Client]   assetsUrl:', assetsUrl)
      
      // Make CDN URL available globally for PhysX loading
      console.log('[Client] Setting window.__CDN_URL for PhysX:', cdnUrl)
      ;(window as Window & { __CDN_URL?: string }).__CDN_URL = cdnUrl

      const config = {
        viewport,
        ui,
        wsUrl: finalWsUrl,
        baseEnvironment,
        assetsUrl, // This will be overridden by server snapshot
      }
      
      console.log('[Client] World config (direct connections):', {
        wsUrl: finalWsUrl,
        assetsUrl
      })
      
      // Call onSetup if provided
      if (onSetup) {
        onSetup(world, config)
      }
      
      
      // Ensure RPG systems are registered before initializing the world
      const systemsPromise = (world as InstanceType<typeof World> & { systemsLoadedPromise?: Promise<void> }).systemsLoadedPromise
      if (systemsPromise) {
        console.log('[Client] Waiting for RPG systems to load...')
        await systemsPromise
        console.log('[Client] RPG systems loaded')
      }
      
      console.log('[Client] Calling world.init()...')
      await world.init(config)
      console.log('[Client] World.init() complete')
    }
    
    init()
    
    // Cleanup function
    return () => {
      if (!cleanedUp) {
        cleanedUp = true
        console.log('[Client] Cleaning up world on unmount...')
        // Destroy the world to cleanup WebSocket and resources
        world.destroy()
        console.log('[Client] World destroyed')
      }
    }
  }, [world, wsUrl, onSetup])
  
    
  return (
    <div
      className='App absolute top-0 left-0 right-0 h-screen'
    >
      <style>{`
        .App__viewport {
          position: fixed;
          overflow: hidden;
          width: 100%;
          height: 100%;
          inset: 0;
        }
        .App__ui {
          position: absolute;
          inset: 0;
          pointer-events: none;
          user-select: none;
          display: ${ui.visible ? 'block' : 'block'};
          overflow: hidden;
          z-index: 10;
        }
      `}</style>
      <div className='App__viewport' ref={viewportRef} data-component="viewport">
        <div className='App__ui' ref={uiRef} data-component="ui">
          <CoreUI world={world} />
        </div>
      </div>
    </div>
  )
}
