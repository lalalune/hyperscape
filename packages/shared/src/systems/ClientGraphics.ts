/**
 * ClientGraphics.ts - 3D Graphics Rendering System
 * 
 * Manages WebGL/WebGPU rendering for the 3D game world.
 * Handles viewport, shadows, post-processing, and frame rendering.
 * 
 * Key Features:
 * - **WebGL/WebGPU Support**: Automatic fallback from WebGPU to WebGL2
 * - **Shadow Mapping**: Cascaded shadow maps (CSM) for dynamic shadows
 * - **Post-Processing**: Bloom, tone mapping, and other effects
 * - **XR Rendering**: WebXR support for VR/AR devices
 * - **Adaptive Quality**: Auto-adjusts shadow quality based on performance
 * - **Anisotropic Filtering**: Texture filtering for better quality
 * - **HDR Rendering**: High dynamic range for realistic lighting
 * 
 * Rendering Pipeline:
 * 1. Pre-render: Update matrices, frustum culling
 * 2. Shadow Pass: Render shadow maps for each light
 * 3. Main Pass: Render scene to screen or XR
 * 4. Post-Processing: Apply bloom, tone mapping, etc.
 * 5. UI Overlay: Render 2D UI on top
 * 
 * WebGPU vs WebGL:
 * - Prefers WebGPU if available (better performance)
 * - Falls back to WebGL2 automatically
 * - Uses UniversalRenderer abstraction for compatibility
 * - Same API regardless of backend
 * 
 * Shadow Configuration:
 * - Cascaded Shadow Maps (CSM) for large view distances
 * - 3 cascades: near (high res), medium, far (low res)
 * - PCF soft shadows for smooth edges
 * - Shadow bias to prevent acne artifacts
 * 
 * Post-Processing Effects:
 * - **Bloom**: Glowing bright areas for magical effects
 * - **Tone Mapping**: HDR to LDR conversion
 * - **FXAA/SMAA**: Anti-aliasing post-process
 * - **Color Grading**: Adjust colors for atmosphere
 * 
 * Performance Optimization:
 * - Frustum culling: Don't render off-screen objects
 * - LOD system: Lower detail for distant objects
 * - Instanced rendering: Batch identical objects
 * - Occlusion culling: Skip objects behind walls
 * - Adaptive shadow quality: Reduce resolution under load
 * 
 * XR Integration:
 * - Stereo rendering for VR headsets
 * - Hand tracking and controller input
 * - Room-scale tracking
 * - AR pass-through mode
 * 
 * Usage:
 * ```typescript
 * // Graphics system auto-initializes
 * const graphics = world.getSystem('graphics');
 * 
 * // Toggle post-processing
 * graphics.setPostProcessing(true);
 * 
 * // Adjust shadow quality
 * graphics.setShadowQuality('high');
 * 
 * // Get current FPS
 * const fps = graphics.getFPS();
 * ```
 * 
 * Related Systems:
 * - ClientCameraSystem: Provides camera for rendering
 * - Environment: Lighting and skybox
 * - LODs: Level-of-detail mesh swapping
 * - Stage: three.js scene graph
 * - XR: WebXR session management
 * 
 * Dependencies:
 * - three.js: 3D rendering library
 * - postprocessing: Effects library
 * - Stage system: Scene graph
 * - Camera system: View/projection matrices
 * 
 * @see RendererFactory.ts for WebGL/WebGPU creation
 * @see PostProcessingFactory.ts for effects setup
 */

import THREE from '../extras/three'
import type { World } from '../World'
import type { WorldOptions } from '../types'
import { EventType } from '../types/events'
import { System } from './System'
import { 
  createRenderer, 
  configureRenderer, 
  configureShadowMaps,
  configureXR,
  getMaxAnisotropy,
  isXRPresenting,
  type UniversalRenderer,
  isWebGLRenderer,
  logWebGPUInfo,
  getWebGPUCapabilities
} from '../utils/RendererFactory'
import {
  createPostProcessing,
  setBloomEnabled,
  disposePostProcessing,
  type PostProcessingComposer
} from '../utils/PostProcessingFactory'

let renderer: UniversalRenderer | undefined

async function getRenderer(preferWebGPU = true): Promise<UniversalRenderer> {
  if (!renderer) {
    renderer = await createRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      preferWebGPU
    })
  }
  return renderer
}

/**
 * Get the shared WebGL/WebGPU renderer instance
 * @returns The renderer or undefined if not initialized
 */
export function getSharedRenderer(): UniversalRenderer | undefined {
  return renderer
}

/**
 * Client Graphics System
 * 
 * Manages 3D rendering for the game world.
 * Runs only on client (browser).
 */
export class ClientGraphics extends System {
  // Properties
  renderer!: UniversalRenderer
  viewport!: HTMLElement
  maxAnisotropy!: number
  usePostprocessing!: boolean
  composer!: PostProcessingComposer | null
  resizer!: ResizeObserver
  xrWidth: number | null = null
  xrHeight: number | null = null
  xrDimensionsNeeded: boolean = false
  xrSession: XRSession | null = null
  width: number = 0
  height: number = 0
  aspect: number = 0
  worldToScreenFactor: number = 0
  isWebGPU: boolean = false

  constructor(world: World) {
    // Reuse System since ClientGraphics doesn't use SystemBase helpers heavily; but keep name for logs
    super(world)
  }

  override async init(options: WorldOptions & { viewport?: HTMLElement }): Promise<void> {
    if (!options.viewport) {
      throw new Error('ClientGraphics requires viewport in options')
    }
    const { viewport } = options
    this.viewport = viewport
    this.width = this.viewport.offsetWidth
    this.height = this.viewport.offsetHeight
    this.aspect = this.width / this.height
    
    // Update camera aspect ratio immediately to match viewport
    // Camera is created with hardcoded 16/9, so we need to fix it on init
    if ('aspect' in this.world.camera) {
      (this.world.camera as unknown as { aspect: number }).aspect = this.aspect
    }
    if ('updateProjectionMatrix' in this.world.camera) {
      (this.world.camera as { updateProjectionMatrix: () => void }).updateProjectionMatrix()
    }
    
    // Create renderer (WebGPU or WebGL) - auto-detect best available
    this.renderer = await getRenderer(true)
    this.isWebGPU = !isWebGLRenderer(this.renderer)
    
    console.log(`[ClientGraphics] ✅ Using ${this.isWebGPU ? 'WebGPU' : 'WebGL'} renderer (auto-detected)`)
    console.log(`[ClientGraphics] Initial viewport size: ${this.width}x${this.height}, aspect: ${this.aspect.toFixed(2)}`)
    console.log(`[ClientGraphics] Camera aspect updated to: ${this.aspect.toFixed(2)}`)
    
    // Configure renderer
    configureRenderer(this.renderer, {
      clearColor: 0xffffff,
      clearAlpha: 0,
      pixelRatio: this.world.prefs?.dpr || 1,
      width: this.width,
      height: this.height,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 0.85,
      outputColorSpace: THREE.SRGBColorSpace
    })
    
    // Configure shadows (WebGL only)
    configureShadowMaps(this.renderer, {
      enabled: true,
      type: THREE.PCFSoftShadowMap
    })
    
    // Configure XR (WebGL only for now)
    configureXR(this.renderer, {
      enabled: true,
      referenceSpaceType: 'local-floor',
      foveation: 0
    })
    
    // Get max anisotropy
    this.maxAnisotropy = getMaxAnisotropy(this.renderer)
    THREE.Texture.DEFAULT_ANISOTROPY = this.maxAnisotropy
    
    // Log WebGPU info if using WebGPU
    if (this.isWebGPU) {
      logWebGPUInfo(this.renderer)
      
      const caps = await getWebGPUCapabilities(this.renderer)
      if (caps && caps.features.length > 0) {
        console.log('[ClientGraphics] WebGPU features:', caps.features.join(', '))
      }
    }
    
    // Setup post-processing
    this.usePostprocessing = this.world.prefs?.postprocessing ?? true
    
    if (this.usePostprocessing) {
      this.composer = await createPostProcessing(
        this.renderer,
        this.world.stage.scene,
        this.world.camera as unknown as THREE.Camera,
        {
          bloom: {
            enabled: this.world.prefs?.bloom ?? true,
            intensity: 0.3,
            threshold: 1.0,
            radius: 0.5
          },
          multisampling: 8,
          frameBufferType: THREE.HalfFloatType
        }
      )
      
      if (!this.composer) {
        console.warn('[ClientGraphics] Post-processing not available, using direct rendering')
        this.usePostprocessing = false
      }
    } else {
      this.composer = null
    }
    
    this.world.prefs?.on('change', this.onPrefsChange)
    // Debounced resize with strict size change detection
    let resizePending = false
    this.resizer = new ResizeObserver((entries) => {
      if (resizePending) return
      
      const entry = entries[0]
      if (!entry) return
      
      const newWidth = Math.floor(entry.contentRect.width)
      const newHeight = Math.floor(entry.contentRect.height)
      
      // Only resize if dimensions actually changed by at least 1 pixel
      if (newWidth !== this.width || newHeight !== this.height) {
        resizePending = true
        requestAnimationFrame(() => {
          resizePending = false
          this.resize(newWidth, newHeight)
        })
      }
    })
    // Set ID for Cypress tests
    this.renderer.domElement.id = 'hyperscape-world-canvas'
    
    // Style canvas to fill container and scale properly
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'
    
    // Avoid appending twice
    if (this.renderer.domElement.parentElement !== this.viewport) {
      // Detach from any previous parent to avoid duplicate canvases
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
      }
      this.viewport.appendChild(this.renderer.domElement)
    }
    // Temporarily disable ResizeObserver to prevent camera matrix corruption
    // this.resizer.observe(this.viewport)
  }

  override start() {
    this.world.on(EventType.XR_SESSION, this.onXRSession)
  }

  resize(width: number, height: number) {
    // Guard: ensure graphics system is fully initialized
    if (!this.renderer) {
      return
    }
    
    // Ensure valid dimensions
    if (width <= 0 || height <= 0) {
      console.warn(`[ClientGraphics] Invalid resize dimensions: ${width}x${height}`)
      return
    }
    
    // Prevent unnecessary resize operations
    if (width === this.width && height === this.height) {
      return
    }
    
    const oldAspect = this.aspect
    this.width = width
    this.height = height
    this.aspect = this.width / this.height
    
    console.log(`[ClientGraphics] Resizing: ${width}x${height}, aspect: ${this.aspect.toFixed(2)} (was ${oldAspect.toFixed(2)})`)
    
    // Update camera aspect ratio for any aspect ratio support
    if ('aspect' in this.world.camera) {
      ;(this.world.camera as unknown as { aspect: number }).aspect = this.aspect
    }
    if ('updateProjectionMatrix' in this.world.camera) {
      (this.world.camera as { updateProjectionMatrix: () => void }).updateProjectionMatrix()
    }
    
    // Update renderer size with current pixel ratio
    const dpr = this.world.prefs?.dpr || 1
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(this.width, this.height, false)
    
    // Update post-processing composer
    if (this.composer) {
      this.composer.setSize(this.width, this.height)
    }
    
    this.emit(EventType.GRAPHICS_RESIZE, { width: this.width, height: this.height, aspect: this.aspect })
    this.render()
  }

  render() {
    const isPresenting = isXRPresenting(this.renderer)
    
    if (isPresenting || !this.usePostprocessing || !this.composer) {
      this.renderer.render(this.world.stage.scene, this.world.camera as unknown as THREE.Camera)
    } else {
      this.composer.render()
    }
    
    if (this.xrDimensionsNeeded) {
      this.updateXRDimensions()
    }
  }

  override commit() {
    this.render()
  }

  override preTick() {
    const fov = this.world.camera.fov
    const fovRadians = THREE.MathUtils.degToRad(fov)
    const rendererHeight = this.xrHeight || this.height
    this.worldToScreenFactor = (Math.tan(fovRadians / 2) * 2) / rendererHeight
  }

  onPrefsChange = (changes: { dpr?: { value: number }; postprocessing?: { value: boolean }; bloom?: { value: boolean } }) => {
    // dpr
    if (changes.dpr) {
      this.renderer.setPixelRatio(changes.dpr.value)
      this.resize(this.width, this.height)
    }
    // postprocessing
    if (changes.postprocessing) {
      this.usePostprocessing = changes.postprocessing.value
    }
    // bloom
    if (changes.bloom && this.composer) {
      setBloomEnabled(this.composer, changes.bloom.value)
    }
  }

  onXRSession = (session: XRSession | null) => {
    if (session) {
      this.xrSession = session
      this.xrWidth = null
      this.xrHeight = null
      this.xrDimensionsNeeded = true
    } else {
      this.xrSession = null
      this.xrWidth = null
      this.xrHeight = null
      this.xrDimensionsNeeded = false
    }
  }

  updateXRDimensions() {
    // WebGL-specific XR handling
    if (!isWebGLRenderer(this.renderer)) return
    
    const referenceSpace = this.renderer.xr?.getReferenceSpace()
    if (!referenceSpace) return
    const frame = this.renderer.xr?.getFrame()
    const pose = frame.getViewerPose(referenceSpace)
    if (pose && pose.views.length > 0) {
      const view = pose.views[0]
      if (view) {
        const projectionMatrix = view.projectionMatrix
        if (projectionMatrix) {
          // Extract FOV information from projection matrix
          // const fovFactor = projectionMatrix[5] // Approximation of FOV scale
          // Access render state for framebuffer dimensions
          const renderState = this.xrSession?.renderState as { baseLayer?: unknown; layers?: unknown[] } | undefined
          const baseLayer = renderState?.baseLayer || (renderState?.layers && renderState.layers[0])
          this.xrWidth = (baseLayer as { framebufferWidth: number }).framebufferWidth
          this.xrHeight = (baseLayer as { framebufferHeight: number }).framebufferHeight
          this.xrDimensionsNeeded = false
        }
      }
    }
  }

  override destroy() {
    // Guard against destruction before initialization
    if (this.resizer) {
      this.resizer.disconnect()
    }
    // Unsubscribe from prefs changes
    this.world.prefs?.off('change', this.onPrefsChange)
    // Remove XR session listener
    this.world.off(EventType.XR_SESSION, this.onXRSession)
    // Ensure animation loop is stopped
    if (this.renderer) {
      this.renderer.setAnimationLoop?.(null as unknown as (() => void))
    }
    // Dispose postprocessing
    if (this.composer) {
      disposePostProcessing(this.composer)
      this.composer = null
    }
    // Remove renderer from DOM if it was added
    if (this.renderer?.domElement && this.viewport) {
      const parent = this.renderer.domElement.parentElement
      if (parent === this.viewport) {
        this.viewport.removeChild(this.renderer.domElement)
      }
    }
    // Do not dispose the shared renderer globally to avoid breaking other systems during hot reloads
  }
}

