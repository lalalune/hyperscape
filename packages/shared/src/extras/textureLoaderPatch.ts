/**
 * Patch for THREE.js TextureLoader to handle blob URL texture loading issues
 * This fixes the "image.addEventListener is not a function" error in GLTFLoader
 */

import THREE from './three'

let isPatched = false

export function patchTextureLoader() {
  if (isPatched) return
  isPatched = true
  
  // Store original load method
  const originalLoad = THREE.TextureLoader.prototype.load
  
  // Override the load method to handle blob URL errors gracefully
  THREE.TextureLoader.prototype.load = function(url, onLoad, onProgress, onError) {
    const texture = new THREE.Texture()
    
    if (typeof url === 'string' && url.startsWith('blob:')) {
      // Handle blob URLs more carefully
      const image = new Image()
      
      const cleanup = () => {
        try {
          URL.revokeObjectURL(url)
        } catch (_e) {
          // Ignore cleanup errors
        }
      }
      
      const handleLoad = () => {
        texture.image = image
        texture.needsUpdate = true
        if (onLoad) onLoad(texture)
        cleanup()
      }
      
      const handleError = (error: unknown) => {
        console.warn('[TextureLoader] Failed to load texture from blob URL, using fallback:', url, error)
        
        // Create a simple 1x1 gray fallback texture
        let fallbackImage: HTMLCanvasElement | globalThis.ImageData
        
        if (typeof document !== 'undefined' && document.createElement) {
          // Browser environment
          const canvas = document.createElement('canvas')
          canvas.width = 1
          canvas.height = 1
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#808080'
            ctx.fillRect(0, 0, 1, 1)
          }
          fallbackImage = canvas
        } else {
          // Node.js environment - create a minimal image-like object
          fallbackImage = {
            width: 1,
            height: 1,
            data: new Uint8ClampedArray([128, 128, 128, 255]), // Gray pixel
            colorSpace: 'srgb' as globalThis.PredefinedColorSpace
          } as globalThis.ImageData
        }
        
        texture.image = fallbackImage
        texture.needsUpdate = true
        if (onLoad) onLoad(texture)
        cleanup()
      }
      
      // Set up event handlers more robustly
      try {
        if (image.addEventListener) {
          image.addEventListener('load', handleLoad, false)
          image.addEventListener('error', handleError, false)
        } else {
          // Fallback for when addEventListener is not available
          const imageElement = image as HTMLImageElement;
          imageElement.onload = handleLoad;
          imageElement.onerror = handleError;
        }
        
        image.src = url
      } catch (error) {
        console.warn('[TextureLoader] Error setting up image loading:', error)
        handleError(error)
      }
      
      return texture
    } else {
      // Use original loader for non-blob URLs
      return originalLoad.call(this, url, onLoad, onProgress, onError)
    }
  }
  
}