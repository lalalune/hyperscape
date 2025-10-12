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
    // shadowBias: 0.000002,
    // shadowNormalBias: 0.001,
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

// fix fog distance calc
// see: https://github.com/mrdoob/three.js/issues/14601
// future: https://www.youtube.com/watch?v=k1zGz55EqfU
// THREE.ShaderChunk.fog_vertex = `
// #ifdef USE_FOG
// 	// vFogDepth = - mvPosition.z;
//   vFogDepth = length(mvPosition);
// #endif
// `

// Environment interfaces moved to shared types

/**
 * Environment System
 *
 * - Runs on the client
 * - Sets up the sky, hdr, sun, shadows, fog etc
 *
 */
export class ClientEnvironment extends System {
  base!: BaseEnvironment;
  model: EnvironmentModel | null = null;
  skys: SkyHandle[] = [];
  sky: THREE.Mesh | null = null;
  skyN: number = 0;
  bgUrl?: string;
  hdrUrl?: string;
  csm!: CSM;
  skyInfo!: SkyInfo;

  constructor(world: World) {
    // Keep extending base System to avoid wide changes; preserve name for logs
    super(world)
  }

  override init(options: WorldOptions & { baseEnvironment?: BaseEnvironment }): Promise<void> {
    this.base = options.baseEnvironment || {}
    return Promise.resolve()
  }

  override async start() {
    // Defer CSM creation to ensure stage is ready
    setTimeout(() => {
      this.buildCSM();
    }, 100);
    
    this.updateSky();
    
    // Load initial model
    await this.updateModel();

    this.world.settings?.on('change', this.onSettingsChange)
    this.world.prefs?.on('change', this.onPrefsChange)
    // graphics system has event emitter methods
    if (this.world.graphics) {
      this.world.graphics.on('resize', this.onViewportResize)
    }
  }

  async updateModel() {
    const modelSetting = this.world.settings?.model;
    // Strong type assumption - modelSetting is either string or has url property
    const url = (asString(modelSetting) || (modelSetting as { url?: string })?.url) || this.base.model
    if (!url) return
    let glb = this.world.loader?.get('model', url)
    if (!glb) glb = (await this.world.loader?.load('model', url)) as LoaderResult | undefined
    if (!glb) return
    if (this.model) this.model.deactivate()
    
    // Get the model nodes - handle both Map<string, Node> and EnvironmentModel return types
    if (glb && 'toNodes' in glb) {
      const nodesResult = (glb as LoadedModel).toNodes()
      const nodes = nodesResult as Map<string, NodeClass> | EnvironmentModel
      // Check if it's an EnvironmentModel object (has activate/deactivate)
      const environmentModel = nodes as EnvironmentModel
      if (nodes && 'activate' in environmentModel && 'deactivate' in environmentModel) {
        this.model = environmentModel
        this.model.activate({ world: this.world, label: 'base' })
      } else if (nodes && nodes instanceof Map) {
        // If it's a Map of nodes, create a wrapper
        // Cast nodes to Map<string, NodeClass> since we know these are actual Node instances
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
    // Check if stage is available
    if (!this.world.stage || !this.world.stage.scene) {
       console.warn('[ClientEnvironment] Stage not available for updateSky, deferring...');
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
      // bgTexture = bgTexture.clone()
      bgTexture.minFilter = bgTexture.magFilter = THREE.LinearFilter
      bgTexture.mapping = THREE.EquirectangularReflectionMapping
      // bgTexture.encoding = Encoding[this.encoding]
      bgTexture.colorSpace = THREE.SRGBColorSpace
      const skyMaterial = this.sky.material as THREE.MeshBasicMaterial
      skyMaterial.map = bgTexture
      this.sky.visible = true
    } else {
      this.sky.visible = false
    }

    if (hdrTexture) {
      // hdrTexture.colorSpace = THREE.NoColorSpace
      // hdrTexture.colorSpace = THREE.SRGBColorSpace
      // hdrTexture.colorSpace = THREE.LinearSRGBColorSpace
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

    // Strong type assumption - fog values are numbers when present
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
    // Remove listeners
    this.world.settings?.off('change', this.onSettingsChange)
    this.world.prefs?.off('change', this.onPrefsChange)
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

    // Dispose environment map
    if (this.world.stage?.scene?.environment && this.world.stage.scene.environment instanceof THREE.Texture) {
      this.world.stage.scene.environment.dispose()
      this.world.stage.scene.environment = null
    }

    // Dispose CSM lights and shadow maps
    if (this.csm) {
      // CSM has dispose method from three-csm library
      interface CSMWithDispose {
        dispose(): void;
      }
      (this.csm as unknown as CSMWithDispose).dispose()
    }
    this.skys = []
    this.model = null
  }

  override update(_delta: number) {
    if (this.csm) {
      try {
        this.csm.update()
      } catch (error) {
        console.error('[ClientEnvironment] Error updating CSM:', error)
      }
    }
  }

  override lateUpdate(_delta: number) {
    if (!this.sky) return
    this.sky.position.x = this.world.rig.position.x
    this.sky.position.z = this.world.rig.position.z
    this.sky.matrixWorld.setPosition(this.sky.position)
    // this.sky.matrixWorld.copyPosition(this.world.rig.matrixWorld)
  }

  buildCSM() {
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
      // Add error checking for stage and scene
      if (!this.world.stage) {
        console.warn('[ClientEnvironment] Stage system not available yet, deferring CSM creation');
        return;
      }
      
      const scene = this.world.stage.scene
      const camera = this.world.camera
      
      // Strong type assumption - scene has add method
    if (!scene) {
        console.error('[ClientEnvironment] Scene is not a valid THREE.Scene:', scene);
        return;
      }
      
      this.csm = new CSM({
        mode: 'practical', // uniform, logarithmic, practical, custom
        // mode: 'custom',
        // customSplitsCallback: function (cascadeCount, nearDistance, farDistance) {
        //   return [0.05, 0.2, 0.5]
        // },
        maxCascades: 3,
        maxFar: 100,
        lightDirection: _sunDirection.normalize(),
        fade: true,
        parent: scene,
        camera: camera,
        // note: you can play with bias in console like this:
        // var csm = world.graphics.csm
        // csm.shadowBias = 0.00001
        // csm.shadowNormalBias = 0.002
        // csm.updateFrustums()
        // shadowBias: 0.00001,
        // shadowNormalBias: 0.002,
        // lightNear: 0.0000001,
        // lightFar: 5000,
        // lightMargin: 200,
        // noLastCascadeCutOff: true,
        ...options,
        // note: you can test changes in console and then call csm.updateFrustrums() to debug
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
    this.csm.updateFrustums()
  }
}
