/**
 * useThreeCamera Hook
 * Manages camera controls, framing, and positioning
 */

import { useRef, useCallback, useEffect } from 'react'
import { Box3, Object3D, PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface CameraConfig {
  characterHeight?: number
  isAnimationFile?: boolean
}

export const useThreeCamera = (
  camera: PerspectiveCamera | null,
  renderer: { domElement: HTMLElement } | null,
  config: CameraConfig = {}
) => {
  const controlsRef = useRef<OrbitControls | null>(null)

  /**
   * Initialize orbit controls
   */
  const initializeControls = useCallback(() => {
    if (!camera || !renderer || controlsRef.current) return

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = false
    controls.minDistance = 0.1
    controls.maxDistance = 500
    controls.maxPolarAngle = Math.PI
    controlsRef.current = controls

    return controls
  }, [camera, renderer])

  /**
   * Calculate optimal distance to fit object in view
   */
  const computeDistanceToFit = useCallback(
    (size: Vector3, camera: PerspectiveCamera) => {
      const aspect = camera.aspect || 1
      const fov = camera.fov * (Math.PI / 180)
      const halfFov = fov / 2
      const heightBased = size.y
      const widthBased = size.x / aspect
      const target = Math.max(heightBased, widthBased) * 1.2 // 20% margin
      return target / (2 * Math.tan(halfFov))
    },
    []
  )

  /**
   * Frame camera to fit object in view
   */
  const frameCameraToObject = useCallback(
    (object: Object3D) => {
      if (!camera || !controlsRef.current) return

      const box = new Box3().setFromObject(object)
      const center = box.getCenter(new Vector3())
      const size = box.getSize(new Vector3())
      const distance = computeDistanceToFit(size, camera)

      // Special handling for character models
      if (config.isAnimationFile && config.characterHeight) {
        camera.position.set(
          center.x + distance * 0.5,
          center.y + config.characterHeight * 0.3,
          center.z + distance * 0.5
        )
      } else {
        camera.position.set(
          center.x + distance * 0.7,
          center.y + distance * 0.5,
          center.z + distance * 0.7
        )
      }

      camera.lookAt(center)
      controlsRef.current.target.copy(center)
      controlsRef.current.update()
    },
    [camera, computeDistanceToFit, config.characterHeight, config.isAnimationFile]
  )

  /**
   * Reset camera to default view
   */
  const resetCamera = useCallback(
    (object?: Object3D) => {
      if (!camera || !controlsRef.current) return

      if (object) {
        frameCameraToObject(object)
      } else {
        // Default position
        camera.position.set(5, 5, 5)
        camera.lookAt(0, 0, 0)
        controlsRef.current.target.set(0, 0, 0)
        controlsRef.current.update()
      }
    },
    [camera, frameCameraToObject]
  )

  /**
   * Set auto-rotate
   */
  const setAutoRotate = useCallback((enabled: boolean) => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = enabled
      controlsRef.current.autoRotateSpeed = 2.0
    }
  }, [])

  /**
   * Update controls in animation loop
   */
  const updateControls = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.update()
    }
  }, [])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    initializeControls()

    return () => {
      if (controlsRef.current) {
        controlsRef.current.dispose()
        controlsRef.current = null
      }
    }
  }, [initializeControls])

  return {
    controls: controlsRef.current,
    actions: {
      frameCameraToObject,
      resetCamera,
      setAutoRotate,
      updateControls
    }
  }
}
