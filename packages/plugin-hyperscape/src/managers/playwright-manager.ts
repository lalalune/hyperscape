import { IAgentRuntime } from '@elizaos/core'
import { THREE, Player } from '@hyperscape/shared'
import fs, { promises as fsPromises } from 'fs'
import path from 'path'
import { chromium, Browser, Page, PageScreenshotOptions } from 'playwright'
import { HyperscapeService } from '../service'
import { getModuleDirectory, resolveUrl } from '../utils'

interface AvatarLike {
  url?: string
}

export class PlaywrightManager {
  private static instance: PlaywrightManager | null = null

  private runtime: IAgentRuntime
  private browser: Browser
  private page: Page
  private initPromise: Promise<void> | null = null
  private readonly STRIP_SLOTS = [
    'map',
    'aoMap',
    'alphaMap',
    'bumpMap',
    'normalMap',
    'metalnessMap',
    'roughnessMap',
    'emissiveMap',
    'lightMap',
  ] as const

  /**
   * Get the current page instance for testing purposes
   */
  getPage(): Page | null {
    return this.page || null
  }

  /**
   * Take a screenshot for testing purposes
   */
  async takeScreenshot(
    options?: PageScreenshotOptions
  ): Promise<string | Buffer> {
    return await this.page!.screenshot({
      type: 'png',
      fullPage: false,
      ...options,
    })
  }

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime
    this.init()

    if (!PlaywrightManager.instance) {
      PlaywrightManager.instance = this
    } else {
      throw new Error('PlaywrightManager has already been instantiated.')
    }
  }

  public static getInstance(): PlaywrightManager {
    if (!this.instance) {
      throw new Error(
        'PlaywrightManager not yet initialized. Call new PlaywrightManager(runtime) first.'
      )
    }
    return this.instance
  }

  // Removed duplicate getPage method - keeping the one at line 34

  private async init() {
    // Only initialize once
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.browser = await chromium.launch({
          headless: true,
          args: ['--disable-web-security'],
          slowMo: 50,
        })

        this.page = await this.browser.newPage()
        const moduleDirPath = getModuleDirectory()
        const filePath = `${moduleDirPath}/playwright/index.html`

        await this.page.goto(`file://${filePath}`, { waitUntil: 'load' })

        await this.injectScripts([
          `${moduleDirPath}/scripts/createVRMFactory.js`,
          `${moduleDirPath}/scripts/snapshotEquirectangular.js`,
          `${moduleDirPath}/scripts/snapshotFacingDirection.js`,
          `${moduleDirPath}/scripts/snapshotViewToTarget.js`,
        ])

        await this.page.waitForFunction(
          () =>
            window.scene !== undefined &&
            window.camera !== undefined &&
            window.renderer !== undefined
        )
      })()
    }
    return this.initPromise
  }

  private async injectScripts(scriptPaths: string[]) {
    for (const relativePath of scriptPaths) {
      const absPath = path.resolve(relativePath)
      const content = await fsPromises.readFile(absPath, 'utf8')
      await this.page.addScriptTag({ content })
    }
  }

  public async snapshotFacingDirection(
    direction: 'front' | 'back' | 'left' | 'right'
  ): Promise<string> {
    await this.init()

    if (!this.browser || !this.page) {
      console.warn(
        '[PlaywrightManager] Playwright not available, skipping screenshot'
      )
      return ''
    }

    const service = this.getService()
    const world = service.getWorld()
    const player = world.entities.player

    if (!player) {
      throw new Error('Player entity not yet available')
    }

    // TODO: Implement rotation control
    // await world.controls.rotateTo(direction, 500)
    // world.controls.stopRotation()

    await this.rehydrateSceneAssets()

    const playerData = {
      position: player.node.position.toArray() as [number, number, number],
      rotation: player.rotation.toArray() as [number, number, number, number],
    }

    const base64 = await this.page.evaluate(async playerData => {
      return await window.snapshotFacingDirection(playerData)
    }, playerData)

    const filePath = path.resolve(`scene_facing_${direction}.jpeg`)
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))

    return `data:image/jpeg;base64,${base64}`
  }

  public async snapshotViewToTarget(
    targetPosition: [number, number, number]
  ): Promise<string> {
    await this.init()

    const service = this.getService()
    const world = service.getWorld()
    const player = world.entities.player

    if (!player) {
      throw new Error('Player entity not yet available')
    }

    await this.rehydrateSceneAssets()

    const playerData = {
      position: player.node.position.toArray() as [number, number, number],
    }

    const base64 = (await this.page.evaluate(
      async ({ playerData, targetPosition }) => {
        return await window.snapshotViewToTarget(playerData, targetPosition)
      },
      { playerData, targetPosition }
    )) as string

    const filePath = path.resolve('scene_view_to_target.jpeg')
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))

    return `data:image/jpeg;base64,${base64}`
  }

  public async snapshotEquirectangular(): Promise<string> {
    await this.init()

    const service = this.getService()
    const world = service.getWorld()
    const player = world.entities.player

    if (!player) {
      throw new Error('Player entity not yet available')
    }

    await this.rehydrateSceneAssets()

    const playerData = {
      position: player.node.position.toArray(),
      quaternion: player.node.quaternion.toArray(),
    }

    const base64 = await this.page.evaluate(async playerData => {
      return await window.snapshotEquirectangular(playerData)
    }, playerData)

    const buffer = Buffer.from(base64, 'base64')
    const filePath = path.resolve('scene_equirectangular.jpeg')
    fs.writeFileSync(filePath, buffer)

    return `data:image/jpeg;base64,${base64}`
  }

  async loadGlbBytes(url: string): Promise<number[]> {
    await this.init()
    const STRIP_SLOTS = this.STRIP_SLOTS

    return this.page.evaluate(
      async ({
        url,
        STRIP_SLOTS,
      }: {
        url: string
        STRIP_SLOTS: readonly string[]
      }) => {
        const loader = new window.GLTFLoader()
        const gltf = await loader.loadAsync(url)

        if (!window.texturesMap) {
          window.texturesMap = new Map()
        }

        gltf.scene.traverse(obj => {
          // Type narrowing - check if object is a Mesh
          if (
            !('isMesh' in obj) ||
            !(obj as THREE.Mesh).isMesh ||
            !('material' in obj) ||
            !(obj as THREE.Mesh).material
          ) {
            return
          }

          const mesh = obj as THREE.Mesh
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]

          mats.forEach(mat => {
            if (!mat.userData.materialId) {
              mat.userData.materialId = window.crypto.randomUUID()
            }
            const id = mat.userData.materialId

            STRIP_SLOTS.forEach(slot => {
              const tex = mat[slot] as THREE.Texture
              if (tex && tex.isTexture) {
                window.texturesMap.set(`${id}:${slot}`, tex)
                mat[slot] = null
              }
            })

            mat.needsUpdate = true
          })
        })

        const exporter = new window.GLTFExporter()
        const buffer = await new Promise<ArrayBuffer>(done =>
          exporter.parse(gltf.scene, done, { binary: true, embedImages: true })
        )

        return [...new Uint8Array(buffer)]
      },
      { url, STRIP_SLOTS }
    )
  }

  async loadVRMBytes(url: string): Promise<number[]> {
    await this.init()

    return this.page.evaluate(async url => {
      const loader = window.VRMLoader
      const gltf = await loader.loadAsync(url)
      const factory = window.createVRMFactory(gltf, m => m)

      window.renderer.render(window.scene, window.camera)

      if (!window.avatarMap) {
        window.avatarMap = new Map()
      }
      window.avatarMap.set(url, factory) // Store a deep clone of the avatar

      const exporter = new window.GLTFExporter()
      const buffer = await new Promise<ArrayBuffer>(done =>
        exporter.parse(gltf.scene, done, { binary: true, embedImages: true })
      )

      return [...new Uint8Array(buffer)]
    }, url)
  }

  async registerTexture(url: string, slot: string): Promise<string> {
    await this.init()

    return this.page.evaluate(
      async ({ url, slot }: { url: string; slot: string }) => {
        if (!window.texturesMap) {
          window.texturesMap = new Map()
        }

        const loader = window.TextureLoader
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          loader.load(
            url,
            tex => resolve(tex),
            undefined,
            err => reject(err)
          )
        })

        const uuid = window.crypto.randomUUID()
        window.texturesMap.set(`${uuid}:${slot}`, texture)

        return uuid
      },
      { url, slot }
    )
  }

  public async loadEnvironmentHDR(url: string): Promise<void> {
    await this.init()
    const service = this.getService()
    const world = service.getWorld()

    url = await resolveUrl(url, world)

    await this.page.evaluate(async url => {
      const loader = new window.RGBELoader()
      const hdrTexture = await new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(url, resolve, undefined, reject)
      })

      window.environment = hdrTexture
      window.scene.environment = hdrTexture
      window.scene.background = hdrTexture

      window.renderer.render(window.scene, window.camera)
    }, url)
  }

  private async rehydrateSceneAssets() {
    const service = this.getService()
    const world = service.getWorld()
    const sceneJson = world.stage.scene.toJSON()

    const players = world.entities.players

    const STRIP_SLOTS = this.STRIP_SLOTS
    await this.page.evaluate(
      async ({
        sceneJson,
        STRIP_SLOTS,
        players,
      }: {
        sceneJson: ReturnType<THREE.Scene['toJSON']>
        STRIP_SLOTS: readonly string[]
        players: Map<string, Player>
      }) => {
        // THREE is available via import maps in index.html
        const loader = new THREE.ObjectLoader()
        const loadedScene = loader.parse(sceneJson)

        // Rehydrate materials
        loadedScene.traverse(obj => {
          // Type narrowing - check if object is a Mesh
          if (
            !('isMesh' in obj) ||
            !(obj as THREE.Mesh).isMesh ||
            !('material' in obj) ||
            !(obj as THREE.Mesh).material
          ) {
            return
          }

          const mesh = obj as THREE.Mesh
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]

          mats.forEach(mat => {
            const id = mat.userData.materialId
            if (!id) {
              return
            }

            STRIP_SLOTS.forEach(slot => {
              const key = `${id}:${slot}`
              const tex = window.texturesMap?.get(key)
              if (tex && tex.isTexture) {
                mat[slot] = tex
              }
            })

            mat.needsUpdate = true
          })
        })

        // Rehydrate player avatars
        if (window.activeVRMInstances) {
          for (const inst of window.activeVRMInstances) {
            try {
              inst.destroy()
            } catch (e) {
              console.warn('[AgentLoader] Failed to destroy instance:', e)
            }
          }
        }
        window.activeVRMInstances = []

        players.forEach(player => {
          if (!player.avatar) {
            return
          }
          const avatarKey =
            typeof player.avatar === 'string'
              ? player.avatar
              : (player.avatar as AvatarLike)?.url || ''
          const factory = window.avatarMap?.get(avatarKey)
          if (!factory) {
            return
          }

          const vrmHooks = {
            camera: window.camera,
            scene: loadedScene,
            octree: null,
            setupMaterial: () => {},
            loader: window.VRMLoader,
          }
          const instance = factory.create(new THREE.Matrix4(), vrmHooks, m => m)

          const position = player.node.position as THREE.Vector3
          const rotation = player.node.quaternion
          const scale = player.node.scale as THREE.Vector3

          const matrix = new THREE.Matrix4()
          matrix.compose(position, rotation, scale)
          instance.move(matrix)

          window.activeVRMInstances.push(instance)
        })

        // Rehydrate environment
        if (window.environment) {
          ;(loadedScene as THREE.Scene).environment = window.environment
          ;(loadedScene as THREE.Scene).background = window.environment
        }

        window.scene = loadedScene as THREE.Scene
        window.renderer.render(window.scene, window.camera)
      },
      { sceneJson, STRIP_SLOTS, players }
    )
  }

  private getService() {
    return this.runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
    )
  }
}
