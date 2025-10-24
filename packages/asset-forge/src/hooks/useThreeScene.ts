import { useEffect, useRef, useState } from 'react'
import {
  ACESFilmicToneMapping, AmbientLight, Color, DirectionalLight, GridHelper, Mesh, MeshStandardMaterial, PCFSoftShadowMap,
  PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Scene, SkinnedMesh, Texture, WebGLRenderer
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getRendererPool } from '../services/WebGLRendererPool'
import { createLogger } from '../utils/logger'

const logger = createLogger('useThreeScene')

export interface ThreeSceneConfig {
  backgroundColor?: number
  enableShadows?: boolean
  enableGrid?: boolean
  cameraPosition?: [number, number, number]
  cameraTarget?: [number, number, number]
}

export interface ThreeSceneRefs {
  scene: Scene | null
  camera: PerspectiveCamera | null
  renderer: WebGLRenderer | null
  orbitControls: OrbitControls | null
}

export function useThreeScene(
  containerRef: React.RefObject<HTMLDivElement>,
  config: ThreeSceneConfig = {}
) {
  const [isInitialized, setIsInitialized] = useState(false)
  const refs = useRef<ThreeSceneRefs>({
    scene: null,
    camera: null,
    renderer: null,
    orbitControls: null
  })

  // Animation frame reference
  const frameIdRef = useRef<number | undefined>(undefined)
  const rendererIdRef = useRef<string | null>(null)

  useEffect(() => {
    const containerEl = containerRef.current
    if (!containerEl) return

    const {
      backgroundColor = 0x1a1a1a,
      enableShadows = true,
      enableGrid = true,
      cameraPosition = [1.5, 1.2, 1.5],
      cameraTarget = [0, 0.8, 0]
    } = config

    // Scene setup
    const scene = new Scene()
    scene.background = new Color(backgroundColor)
    refs.current.scene = scene

    // Camera setup
    const camera = new PerspectiveCamera(
      75,
      containerEl.clientWidth / containerEl.clientHeight,
      0.1,
      1000
    )
    camera.position.set(...cameraPosition)
    camera.lookAt(...cameraTarget)
    refs.current.camera = camera

    // Renderer setup using pool
    const pool = getRendererPool()
    const rendererId = pool.acquire({
      antialias: true,
      alpha: true,
      width: containerEl.clientWidth,
      height: containerEl.clientHeight,
      pixelRatio: Math.min(window.devicePixelRatio, 2)
    })

    rendererIdRef.current = rendererId
    const renderer = pool.getRenderer(rendererId)

    if (!renderer) {
      logger.error('Failed to acquire renderer from pool')
      return
    }

    renderer.setClearColor(0x000000, 0)
    renderer.autoClear = true
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1

    if (enableShadows) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = PCFSoftShadowMap
    }

    containerEl.appendChild(renderer.domElement)
    refs.current.renderer = renderer

    logger.debug(`Acquired renderer ${rendererId} from pool`)

    // Lighting
    const ambientLight = new AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = enableShadows
    if (enableShadows) {
      directionalLight.shadow.camera.near = 0.1
      directionalLight.shadow.camera.far = 50
      directionalLight.shadow.camera.left = -10
      directionalLight.shadow.camera.right = 10
      directionalLight.shadow.camera.top = 10
      directionalLight.shadow.camera.bottom = -10
    }
    scene.add(directionalLight)

    // Orbit controls
    const orbitControls = new OrbitControls(camera, renderer.domElement)
    orbitControls.target.set(...cameraTarget)
    orbitControls.update()
    refs.current.orbitControls = orbitControls

    // Optional grid
    if (enableGrid) {
      const gridHelper = new GridHelper(10, 10)
      scene.add(gridHelper)

      // Ground plane
      const groundGeometry = new PlaneGeometry(20, 20)
      const groundMaterial = new MeshStandardMaterial({ 
        color: 0x444444,
        roughness: 0.8,
        metalness: 0.2
      })
      const ground = new Mesh(groundGeometry, groundMaterial)
      ground.rotation.x = -Math.PI / 2
      ground.position.y = 0
      ground.receiveShadow = true
      scene.add(ground)
    }

    setIsInitialized(true)

    // Animation loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      orbitControls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      if (!containerEl || !rendererIdRef.current) return
      camera.aspect = containerEl.clientWidth / containerEl.clientHeight
      camera.updateProjectionMatrix()
      pool.setSize(
        rendererIdRef.current,
        containerEl.clientWidth,
        containerEl.clientHeight,
        Math.min(window.devicePixelRatio, 2)
      )
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (frameIdRef.current !== undefined) {
        cancelAnimationFrame(frameIdRef.current)
      }

      // Comprehensive scene cleanup - dispose all geometries, materials, and textures
      if (scene) {
        scene.traverse((object) => {
          if (object instanceof Mesh || object instanceof SkinnedMesh) {
            // Dispose geometry
            if (object.geometry) {
              object.geometry.dispose()
            }

            // Dispose materials and their textures
            if (object.material) {
              const materials = Array.isArray(object.material) ? object.material : [object.material]
              materials.forEach(material => {
                // Dispose all textures in the material
                Object.keys(material).forEach(key => {
                  const value = material[key as keyof typeof material]
                  if (value && value instanceof Texture) {
                    value.dispose()
                  }
                })
                material.dispose()
              })
            }
          }
        })
      }

      // Release renderer back to pool
      if (rendererIdRef.current) {
        const renderer = pool.getRenderer(rendererIdRef.current)
        if (renderer?.domElement.parentNode === containerEl) {
          containerEl.removeChild(renderer.domElement)
        }

        pool.release(rendererIdRef.current)
        logger.debug(`Released renderer ${rendererIdRef.current} back to pool`)
        rendererIdRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]) // Only run once on mount

  return {
    isInitialized,
    scene: refs.current.scene,
    camera: refs.current.camera,
    renderer: refs.current.renderer,
    orbitControls: refs.current.orbitControls
  }
} 