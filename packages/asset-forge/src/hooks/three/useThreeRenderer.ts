/**
 * useThreeRenderer Hook
 * Manages WebGL renderer, scene, camera, and lighting setup
 */

import { useEffect, useRef, useCallback } from 'react'
import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  Fog,
  Color,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  PCFSoftShadowMap,
  Vector2
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export interface ThreeRendererConfig {
  lightMode?: boolean
  isLightBackground?: boolean
  showGroundPlane?: boolean
  environment?: 'neutral' | 'warm' | 'cool' | 'dramatic'
}

export interface ThreeRendererRefs {
  scene: Scene | null
  renderer: WebGLRenderer | null
  camera: PerspectiveCamera | null
  composer: EffectComposer | null
}

export const useThreeRenderer = (
  containerRef: React.RefObject<HTMLDivElement>,
  config: ThreeRendererConfig = {}
) => {
  const sceneRef = useRef<Scene | null>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const cameraRef = useRef<PerspectiveCamera | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const frameIdRef = useRef<number | null>(null)
  const ambientLightRef = useRef<AmbientLight | null>(null)
  const directionalLightRef = useRef<DirectionalLight | null>(null)

  /**
   * Initialize the Three.js scene, renderer, and camera
   */
  const initializeRenderer = useCallback(() => {
    if (!containerRef.current || rendererRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Create scene
    const scene = new Scene()
    scene.background = new Color(config.isLightBackground ? 0xf5f5f5 : 0x1a1a1a)

    // Add fog for depth perception
    scene.fog = new Fog(
      config.isLightBackground ? 0xf5f5f5 : 0x1a1a1a,
      10,
      100
    )
    sceneRef.current = scene

    // Create camera
    const camera = new PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(5, 5, 5)
    cameraRef.current = camera

    // Create renderer
    const renderer = new WebGLRenderer({
      antialias: !config.lightMode,
      alpha: true,
      powerPreference: config.lightMode ? 'low-power' : 'high-performance'
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = !config.lightMode
    renderer.shadowMap.type = PCFSoftShadowMap
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.outputColorSpace = SRGBColorSpace
    rendererRef.current = renderer

    // Add lighting
    const ambientLight = new AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)
    ambientLightRef.current = ambientLight

    const directionalLight = new DirectionalLight(0xffffff, 1.0)
    directionalLight.position.set(10, 10, 5)
    directionalLight.castShadow = !config.lightMode
    if (!config.lightMode) {
      directionalLight.shadow.mapSize.width = 2048
      directionalLight.shadow.mapSize.height = 2048
      directionalLight.shadow.camera.near = 0.5
      directionalLight.shadow.camera.far = 500
    }
    scene.add(directionalLight)
    directionalLightRef.current = directionalLight

    // Setup post-processing (if not in light mode)
    if (!config.lightMode) {
      const composer = new EffectComposer(renderer)
      const renderPass = new RenderPass(scene, camera)
      composer.addPass(renderPass)

      // Add SSAO for better depth perception
      const ssaoPass = new SSAOPass(scene, camera, width, height)
      ssaoPass.kernelRadius = 16
      ssaoPass.minDistance = 0.005
      ssaoPass.maxDistance = 0.1
      composer.addPass(ssaoPass)

      // Add subtle bloom
      const bloomPass = new UnrealBloomPass(
        new Vector2(width, height),
        0.3,
        0.4,
        0.85
      )
      composer.addPass(bloomPass)

      composerRef.current = composer
    }

    // Append canvas to container
    container.appendChild(renderer.domElement)
  }, [containerRef, config.lightMode, config.isLightBackground])

  /**
   * Update environment lighting
   */
  const updateEnvironment = useCallback((environment: string) => {
    if (!sceneRef.current || !ambientLightRef.current || !directionalLightRef.current) return

    const scene = sceneRef.current
    const ambientLight = ambientLightRef.current
    const directionalLight = directionalLightRef.current

    switch (environment) {
      case 'warm':
        scene.background = new Color(0xfff8f0)
        scene.fog = new Fog(0xfff8f0, 10, 100)
        ambientLight.color.setHex(0xffe4b5)
        directionalLight.color.setHex(0xffdbac)
        break
      case 'cool':
        scene.background = new Color(0xf0f8ff)
        scene.fog = new Fog(0xf0f8ff, 10, 100)
        ambientLight.color.setHex(0xb5d5ff)
        directionalLight.color.setHex(0xacd5ff)
        break
      case 'dramatic':
        scene.background = new Color(0x0a0a0a)
        scene.fog = new Fog(0x0a0a0a, 5, 50)
        ambientLight.intensity = 0.2
        directionalLight.intensity = 2.0
        break
      default: // neutral
        scene.background = new Color(config.isLightBackground ? 0xf5f5f5 : 0x1a1a1a)
        scene.fog = new Fog(
          config.isLightBackground ? 0xf5f5f5 : 0x1a1a1a,
          10,
          100
        )
        ambientLight.color.setHex(0xffffff)
        ambientLight.intensity = 0.5
        directionalLight.color.setHex(0xffffff)
        directionalLight.intensity = 1.0
    }
  }, [config.isLightBackground])

  /**
   * Handle window resize
   */
  const handleResize = useCallback(() => {
    if (!containerRef.current || !rendererRef.current || !cameraRef.current) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    cameraRef.current.aspect = width / height
    cameraRef.current.updateProjectionMatrix()

    rendererRef.current.setSize(width, height)

    if (composerRef.current) {
      composerRef.current.setSize(width, height)
    }
  }, [containerRef])

  /**
   * Start render loop
   */
  const startRenderLoop = useCallback((renderCallback?: () => void) => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)

      // Call custom render callback if provided
      renderCallback?.()

      // Render
      if (composerRef.current && !config.lightMode) {
        composerRef.current.render()
      } else if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
    }

    animate()
  }, [config.lightMode])

  /**
   * Stop render loop
   */
  const stopRenderLoop = useCallback(() => {
    if (frameIdRef.current !== null) {
      cancelAnimationFrame(frameIdRef.current)
      frameIdRef.current = null
    }
  }, [])

  /**
   * Cleanup on unmount
   */
  const cleanup = useCallback(() => {
    stopRenderLoop()

    if (rendererRef.current) {
      rendererRef.current.dispose()
      if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement)
      }
    }

    if (composerRef.current) {
      composerRef.current.dispose()
    }

    sceneRef.current = null
    rendererRef.current = null
    cameraRef.current = null
    composerRef.current = null
  }, [containerRef, stopRenderLoop])

  // Initialize on mount
  useEffect(() => {
    initializeRenderer()

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cleanup()
    }
  }, [initializeRenderer, handleResize, cleanup])

  return {
    refs: {
      scene: sceneRef.current,
      renderer: rendererRef.current,
      camera: cameraRef.current,
      composer: composerRef.current
    },
    actions: {
      updateEnvironment,
      startRenderLoop,
      stopRenderLoop,
      handleResize
    }
  }
}
