/**
 * useThreeModel Hook
 * Handles 3D model loading with progress tracking
 */

import { useState, useCallback, useRef } from 'react'
import { Object3D, Scene, SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface ModelInfo {
  vertices: number
  faces: number
  materials: number
  fileSize: number
  hasRig: boolean
}

export const useThreeModel = (scene: Scene | null) => {
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [modelInfo, setModelInfo] = useState<ModelInfo>({
    vertices: 0,
    faces: 0,
    materials: 0,
    fileSize: 0,
    hasRig: false
  })

  const modelRef = useRef<Object3D | null>(null)
  const currentUrlRef = useRef<string | null>(null)

  /**
   * Load model from URL
   */
  const loadModel = useCallback(
    async (url: string, onLoad?: (model: Object3D, info: ModelInfo) => void) => {
      if (!scene || !url) return
      if (currentUrlRef.current === url) return // Already loaded

      setLoading(true)
      setLoadingProgress(0)

      // Remove previous model
      if (modelRef.current) {
        scene.remove(modelRef.current)

        // Dispose of geometries and materials
        modelRef.current.traverse((child: Object3D) => {
          if ('geometry' in child && child.geometry && typeof (child.geometry as any).dispose === 'function') {
            (child.geometry as any).dispose()
          }
          if ('material' in child && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((material: any) => {
              if (typeof material.dispose === 'function') {
                material.dispose()
              }
            })
          }
        })

        modelRef.current = null
      }

      const loader = new GLTFLoader()

      try {
        const gltf = await new Promise<any>((resolve, reject) => {
          loader.load(
            url,
            resolve,
            (progressEvent) => {
              if (progressEvent.lengthComputable) {
                const progress = (progressEvent.loaded / progressEvent.total) * 100
                setLoadingProgress(progress)
              }
            },
            reject
          )
        })

        const model = gltf.scene
        model.name = 'Model'

        // Calculate model info
        let vertices = 0
        let faces = 0
        const materials = new Set()
        let hasRig = false

        model.traverse((child: Object3D) => {
          if ('geometry' in child && child.geometry) {
            const geometry = child.geometry as any

            if (geometry.attributes?.position) {
              vertices += geometry.attributes.position.count
            }

            if (geometry.index) {
              faces += geometry.index.count / 3
            } else if (geometry.attributes?.position) {
              faces += geometry.attributes.position.count / 3
            }
          }

          if ('material' in child && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach((mat: any) => materials.add(mat.uuid))
          }

          if (child instanceof SkinnedMesh && child.skeleton) {
            hasRig = true
          }
        })

        const info: ModelInfo = {
          vertices,
          faces: Math.floor(faces),
          materials: materials.size,
          fileSize: 0, // Would need to be passed from file input
          hasRig
        }

        setModelInfo(info)
        scene.add(model)
        modelRef.current = model
        currentUrlRef.current = url

        setLoading(false)
        setLoadingProgress(100)

        onLoad?.(model, info)

        console.log('Model loaded:', info)
      } catch (error) {
        console.error('Failed to load model:', error)
        setLoading(false)
        setLoadingProgress(0)
        throw error
      }
    },
    [scene]
  )

  /**
   * Clear current model
   */
  const clearModel = useCallback(() => {
    if (modelRef.current && scene) {
      scene.remove(modelRef.current)

      // Dispose of geometries and materials
      modelRef.current.traverse((child: Object3D) => {
        if ('geometry' in child && child.geometry && typeof (child.geometry as any).dispose === 'function') {
          (child.geometry as any).dispose()
        }
        if ('material' in child && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((material: any) => {
            if (typeof material.dispose === 'function') {
              material.dispose()
            }
          })
        }
      })

      modelRef.current = null
      currentUrlRef.current = null
    }
  }, [scene])

  return {
    model: modelRef.current,
    state: {
      loading,
      loadingProgress,
      modelInfo
    },
    actions: {
      loadModel,
      clearModel
    }
  }
}
