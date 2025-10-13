import THREE from '../extras/three'

import { Node as NodeClass } from '../nodes/Node'
import { System } from './System'

import { CSM } from '../libs/csm/CSM'
import type { BaseEnvironment, EnvironmentModel, LoadedModel, LoaderResult, SkyHandle, SkyInfo, SkyNode, World, WorldOptions } from '../types/index'

const _sunDirection = new THREE.Vector3(0, -1, 0)

// Strong type casting helpers - assume types are correct
function asString(value: unknown): string {
  return value as string
}

const csmLevels = {
  none: {
    cascades: 1,
    shadowMapSize: 1024,
    castShadow: false,
    lightIntensity: 3,
  },
  low: {
    cascades: 1,
    shadowMapSize: 2048,
    castShadow: true,
    lightIntensity: 3,
    shadowBias: 0.0000009,
    shadowNormalBias: 0.001,
  },
  med: {
    cascades: 3,
    shadowMapSize: 1024,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.000002,
    shadowNormalBias: 0.002,
  },
  high: {
    cascades: 3,
    shadowMapSize: 2048,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.000003,
    shadowNormalBias: 0.002,
  },
}

/**
 * Unified Environment System
 * 
 * Handles environment setup for all runtime contexts with conditional branching
 * based on runtime capabilities. This single class replaces the previous separate
 * ClientEnvironment, ServerEnvironment, and NodeEnvironment systems.
 * 
 * ## Runtime Modes:
 * 
 * ### Client (Browser) - Full 3D Rendering
 * - Loads and renders 3D environment models (.glb)
 * - Manages sky sphere with equirectangular texture mapping
 * - Controls HDR environment lighting
 * - Handles Cascaded Shadow Maps (CSM) with configurable quality levels
 * - Manages dynamic fog (near/far distances, color)
 * - Responds to graphics settings changes (shadows, model swaps)
 * - Updates sky position to follow camera rig (infinite distance illusion)
 * 
 * ### Server - Configuration Only
 * - Skips all 3D asset loading (no rendering)
 * - Tracks environment settings for client synchronization
 * - Minimal memory footprint (no textures, meshes, or CSM)
 * - Still listens to settings changes to propagate to clients
 * 
 * ### Node Client (Bots) - Headless
 * - No rendering capabilities (headless automation)
 * - Compatible interface so World doesn't require environment checks
 * - ServerBot instances use this mode for automated testing
 * 
 * ## Branching Strategy:
 * 
 * All methods check `this.isClientWithGraphics` (computed during init):
 * - `true`: Browser with `window` object → full rendering pipeline
 * - `false`: Server or Node → early return, skip 3D operations
 * 
 * This pattern avoids:
 * - Code duplication across 3 separate classes
 * - Runtime errors from calling THREE.js in non-browser contexts
 * - Complexity of maintaining parallel implementations
 * 
 * @example
 * ```typescript
 * // Browser client - full environment
 * world.register('environment', Environment)
 * // → Loads models, creates sky, enables CSM
 * 
 * // Server - minimal stub
 * world.register('environment', Environment)
 * // → Skips 3D setup, tracks settings only
 * ```
 */
export class Environment extends System {
  base!: BaseEnvironment;
  model: EnvironmentModel | null = null;
  skys: SkyHandle[] = [];
  sky: THREE.Mesh | null = null;
  skyN: number = 0;
  bgUrl?: string;
  hdrUrl?: string;
  csm!: CSM;
  skyInfo!: SkyInfo;
  
  private isClientWithGraphics: boolean = false;

  constructor(world: World) {
    super(world)
  }

  override init(options: WorldOptions & { baseEnvironment?: BaseEnvironment }): Promise<void> {
    this.base = options.baseEnvironment || {}
    
    // Determine if this is a client with graphics capabilities
    this.isClientWithGraphics = !!this.world.isClient && typeof window !== 'undefined'
    
    return Promise.resolve()
  }

  override async start() {
    if (!this.isClientWithGraphics) {
      // Server or Node client - skip 3D rendering setup
      console.log('[Environment] Non-rendering context - skipping 3D environment setup')
      
      // Still watch for settings changes (for server to track what clients should use)
      this.world.settings?.on('change', this.onSettingsChange)
      return
    }
    
    // Client with graphics - full environment setup
    // Defer CSM creation to ensure stage is ready
    setTimeout(() => {
      this.buildCSM();
    }, 100);
    
    this.updateSky();
    
    // Load initial model
    await this.updateModel();

    this.world.settings?.on('change', this.onSettingsChange)
    this.world.prefs?.on('change', this.onPrefsChange)
    
    if (this.world.graphics) {
      this.world.graphics.on('resize', this.onViewportResize)
    }
  }

  async updateModel() {
    if (!this.isClientWithGraphics) {
      // Server/Node - skip model loading (no rendering)
      return
    }
    
    const modelSetting = this.world.settings?.model;
    const url = (asString(modelSetting) || (modelSetting as { url?: string })?.url) || this.base.model
    if (!url) return
    
    let glb = this.world.loader?.get('model', url)
    if (!glb) glb = (await this.world.loader?.load('model', url)) as LoaderResult | undefined
    if (!glb) return
    
    if (this.model) this.model.deactivate()
    
    if (glb && 'toNodes' in glb) {
      const nodesResult = (glb as LoadedModel).toNodes()
      const nodes = nodesResult as Map<string, NodeClass> | EnvironmentModel
      const environmentModel = nodes as EnvironmentModel
      
      if (nodes && 'activate' in environmentModel && 'deactivate' in environmentModel) {
        this.model = environmentModel
        this.model.activate({ world: this.world, label: 'base' })
      } else if (nodes && nodes instanceof Map) {
        const nodeMap = nodes as Map<string, NodeClass>
        this.model = {
          deactivate: () => {
            for (const node of nodeMap.values()) {
              if (node && node.deactivate) {
                node.deactivate()
              }
            }
          },
          activate: (options: { world: World; label: string }) => {
            for (const node of nodeMap.values()) {
              if (node && node.activate) {
                node.activate(options.world)
              } else if (node && options.world.stage) {
                options.world.stage.add(node)
              }
            }
          }
        }
        this.model.activate({ world: this.world, label: 'base' })
      } else {
        this.model = null
      }
    } else {
      this.model = null
    }
  }

  addSky(node: SkyNode) {
    if (!this.isClientWithGraphics) return { destroy: () => {} }
    
    const handle: SkyHandle = {
      node,
      destroy: () => {
        const idx = this.skys.indexOf(handle)
        if (idx === -1) return
        this.skys.splice(idx, 1)
        this.updateSky()
      },
    }
    this.skys.push(handle)
    this.updateSky()
    return handle
  }

  getSky() {}

  async updateSky() {
    if (!this.isClientWithGraphics) return
    
    // Check if stage is available
    if (!this.world.stage || !this.world.stage.scene) {
       console.warn('[Environment] Stage not available for updateSky, deferring...');
      setTimeout(() => this.updateSky(), 100);
      return;
    }
    
    if (!this.sky) {
      const geometry = new THREE.SphereGeometry(1000, 60, 40)
      const material = new THREE.MeshBasicMaterial({ side: THREE.BackSide })
      this.sky = new THREE.Mesh(geometry, material)
      this.sky.geometry.computeBoundsTree()
      const skyMaterial = this.sky.material as THREE.MeshBasicMaterial
      skyMaterial.fog = false
      skyMaterial.toneMapped = false
      skyMaterial.needsUpdate = true
      this.sky.matrixAutoUpdate = false
      this.sky.matrixWorldAutoUpdate = false
      this.sky.visible = false
      this.world.stage.scene.add(this.sky)
    }

    const base = this.base
    const node = this.skys[this.skys.length - 1]?.node
    const bgUrl = node?._bg || base.bg
    const hdrUrl = node?._hdr || base.hdr
    const sunDirection = node?._sunDirection || base.sunDirection

    const sunIntensity = node?._sunIntensity ?? base.sunIntensity
    const sunColor = node?._sunColor ?? base.sunColor
    const fogNear = node?._fogNear ?? base.fogNear
    const fogFar = node?._fogFar ?? base.fogFar
    const fogColor = node?._fogColor ?? base.fogColor

    const n = ++this.skyN
    let bgTexture
    if (bgUrl) bgTexture = await this.world.loader?.load('texture', bgUrl)
    let hdrTexture
    if (hdrUrl) hdrTexture = await this.world.loader?.load('hdr', hdrUrl)
    if (n !== this.skyN) return

    if (bgTexture) {
      bgTexture.minFilter = bgTexture.magFilter = THREE.LinearFilter
      bgTexture.mapping = THREE.EquirectangularReflectionMapping
      bgTexture.colorSpace = THREE.SRGBColorSpace
      const skyMaterial = this.sky.material as THREE.MeshBasicMaterial
      skyMaterial.map = bgTexture
      this.sky.visible = true
    } else {
      this.sky.visible = false
    }

    if (hdrTexture) {
      hdrTexture.mapping = THREE.EquirectangularReflectionMapping
      this.world.stage.scene.environment = hdrTexture
    }

    if (this.csm) {
      this.csm.lightDirection = sunDirection || _sunDirection

      if (this.csm.lights) {
        for (const light of this.csm.lights) {
          light.intensity = sunIntensity || 1
          light.color.set(sunColor || '#ffffff')
        }
      }
    }

    if (fogNear != null && fogFar != null && fogColor) {
      const color = new THREE.Color(fogColor)
      this.world.stage.scene.fog = new THREE.Fog(color, fogNear as number, fogFar as number)
    } else {
      this.world.stage.scene.fog = null
    }

    this.skyInfo = {
      bgUrl,
      hdrUrl,
      sunDirection: sunDirection || _sunDirection,
      sunIntensity: sunIntensity || 1,
      sunColor: sunColor || '#ffffff',
      fogNear,
      fogFar,
      fogColor,
    }
  }

  override destroy(): void {
    this.world.settings?.off('change', this.onSettingsChange)
    this.world.prefs?.off('change', this.onPrefsChange)
    
    if (!this.isClientWithGraphics) return
    
    if (this.world.graphics) {
      this.world.graphics.off('resize', this.onViewportResize)
    }

    // Dispose sky mesh and textures
    if (this.sky) {
      const material = this.sky.material as THREE.Material & { map?: THREE.Texture | null }
      if (material && 'map' in material && material.map) {
        material.map.dispose()
        material.map = null
      }
      if (Array.isArray(this.sky.material)) {
        this.sky.material.forEach(m => m.dispose())
      } else {
        ;(this.sky.material as THREE.Material).dispose()
      }
      this.sky.geometry.dispose()
      if (this.sky.parent) this.sky.parent.remove(this.sky)
      this.sky = null
    }

    if (this.world.stage?.scene?.environment && this.world.stage.scene.environment instanceof THREE.Texture) {
      this.world.stage.scene.environment.dispose()
      this.world.stage.scene.environment = null
    }

    if (this.csm) {
      interface CSMWithDispose {
        dispose(): void;
      }
      (this.csm as unknown as CSMWithDispose).dispose()
    }
    
    this.skys = []
    this.model = null
  }

  override update(_delta: number) {
    if (!this.isClientWithGraphics) return;
    
    if (this.csm) {
      this.csm.update();
    }
  }

  override lateUpdate(_delta: number) {
    if (!this.isClientWithGraphics || !this.sky) return
    
    this.sky.position.x = this.world.rig.position.x
    this.sky.position.z = this.world.rig.position.z
    this.sky.matrixWorld.setPosition(this.sky.position)
  }

  buildCSM() {
    if (!this.isClientWithGraphics) return
    
    const shadowsLevel = this.world.prefs?.shadows || 'med'
    const options = csmLevels[shadowsLevel as keyof typeof csmLevels] || csmLevels.med
    
    if (this.csm) {
      this.csm.updateCascades(options.cascades)
      this.csm.updateShadowMapSize(options.shadowMapSize)
      if (this.skyInfo) {
        this.csm.lightDirection = this.skyInfo.sunDirection
        if (this.csm.lights) {
          for (const light of this.csm.lights) {
            light.intensity = this.skyInfo.sunIntensity
            light.color.set(this.skyInfo.sunColor)
            light.castShadow = options.castShadow
          }
        }
      }
    } else {
      if (!this.world.stage) {
        console.warn('[Environment] Stage system not available yet, deferring CSM creation');
        return;
      }
      
      const scene = this.world.stage.scene
      const camera = this.world.camera
      
      if (!scene) {
        console.error('[Environment] Scene is not a valid THREE.Scene:', scene);
        return;
      }
      
      this.csm = new CSM({
        mode: 'practical',
        maxCascades: 3,
        maxFar: 100,
        lightDirection: _sunDirection.normalize(),
        fade: true,
        parent: scene,
        camera: camera,
        ...options,
      })
      
      if (!options.castShadow) {
        for (const light of this.csm.lights) {
          light.castShadow = false
        }
      }
    }
  }

  onSettingsChange = (changes: { model?: string | { url?: string } }) => {
    if (changes.model) {
      this.updateModel()
    }
  }

  onPrefsChange = (changes: { shadows?: string }) => {
    if (changes.shadows) {
      this.buildCSM()
      this.updateSky()
    }
  }

  onViewportResize = () => {
    if (this.csm) {
      this.csm.updateFrustums()
    }
  }
}

