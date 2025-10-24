/**
 * useThreeExport Hook
 * Handles model export functionality (screenshots, GLTF/GLB export)
 */

import { useCallback } from 'react'
import { Object3D, Scene, PerspectiveCamera, WebGLRenderer, Vector2, SkinnedMesh } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'

export interface AssetInfo {
  name?: string
  type?: string
  characterHeight?: number
}

export const useThreeExport = (
  scene: Scene | null,
  camera: PerspectiveCamera | null,
  renderer: WebGLRenderer | null,
  composer: EffectComposer | null,
  assetInfo?: AssetInfo
) => {
  /**
   * Take screenshot of current view
   */
  const takeScreenshot = useCallback(() => {
    if (!renderer || !scene || !camera || !composer) return

    // Render at higher resolution for screenshot
    const originalSize = new Vector2()
    renderer.getSize(originalSize)
    renderer.setSize(originalSize.x * 2, originalSize.y * 2)
    composer.setSize(originalSize.x * 2, originalSize.y * 2)

    composer.render()

    const canvas = renderer.domElement
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.download = `model-screenshot-${Date.now()}.png`
          link.href = url
          link.click()
          URL.revokeObjectURL(url)
        }

        // Restore original size
        renderer.setSize(originalSize.x, originalSize.y)
        composer.setSize(originalSize.x, originalSize.y)
      },
      'image/png',
      1.0
    )
  }, [renderer, scene, camera, composer])

  /**
   * Export model as GLB file
   */
  const exportModel = useCallback(
    (
      model: Object3D,
      options: {
        filename?: string
        binary?: boolean
        animations?: boolean
      } = {}
    ) => {
      if (!model) {
        console.error('No model to export')
        return
      }

      const exporter = new GLTFExporter()
      const {
        filename = `${assetInfo?.name || 'model'}-export-${Date.now()}.glb`,
        binary = true,
        animations = true
      } = options

      const exportOptions = {
        binary,
        animations: animations ? undefined : [],
        includeCustomExtensions: false,
        trs: true,
        forcePowerOfTwoTextures: false,
        maxTextureSize: 4096,
        embedImages: true,
        onlyVisible: true,
        forceIndices: true,
        truncateDrawRange: false
      }

      exporter.parse(
        model,
        (result) => {
          const blob = new Blob(
            [binary ? (result as ArrayBuffer) : JSON.stringify(result)],
            { type: binary ? 'application/octet-stream' : 'application/json' }
          )

          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.download = filename
          link.href = url
          link.click()
          URL.revokeObjectURL(url)

          console.log('Model exported successfully:', filename)
        },
        (error) => {
          console.error('Export error:', error)
        },
        exportOptions
      )
    },
    [assetInfo]
  )

  /**
   * Export model in T-pose (bind pose)
   */
  const exportTPose = useCallback(
    (model: Object3D) => {
      if (!model) {
        console.error('No model to export')
        return
      }

      // Reset model to T-pose before export
      model.traverse((child) => {
        if (child instanceof SkinnedMesh && child.skeleton) {
          child.skeleton.pose()
          child.updateMatrixWorld(true)
        }
      })

      exportModel(model, {
        filename: `${assetInfo?.name || 'model'}-tpose-${Date.now()}.glb`,
        animations: false
      })
    },
    [assetInfo, exportModel]
  )

  return {
    takeScreenshot,
    exportModel,
    exportTPose
  }
}
