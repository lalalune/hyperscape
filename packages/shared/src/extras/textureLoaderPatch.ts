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
  
  // Override the load method to handle blob URLs
  THREE.TextureLoader.prototype.load = function(url, onLoad, onProgress, onError) {
    const texture = new THREE.Texture();
    
    if (typeof url === 'string' && url.startsWith('blob:')) {
      // Handle blob URLs
      const image = new Image();
      
      const cleanup = () => {
        URL.revokeObjectURL(url);
      };
      
      const handleLoad = () => {
        texture.image = image;
        texture.needsUpdate = true;
        if (onLoad) onLoad(texture);
        cleanup();
      };
      
      const handleError = (error: unknown) => {
        console.error('[TextureLoader] Failed to load texture from blob URL:', url, error);
        throw new Error(`Failed to load texture from blob URL: ${url}`);
      };
      
      // Set up event handlers
      image.addEventListener('load', handleLoad, false);
      image.addEventListener('error', handleError, false);
      image.src = url;
      
      return texture;
    } else {
      // Use original loader for non-blob URLs
      return originalLoad.call(this, url, onLoad, onProgress, onError);
    }
  };
  
}