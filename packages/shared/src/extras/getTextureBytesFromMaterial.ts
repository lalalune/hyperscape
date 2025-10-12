import THREE from './three';
import type { MaterialWithTextures } from '../types/physics';

const slots = [
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'map',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
] as const

export function getTextureBytesFromMaterial(material: THREE.Material | null | undefined): number {
  let bytes = 0
  if (material) {
    const checked = new Set<string>()
    const materialWithTextures = material as MaterialWithTextures
    for (const slot of slots) {
      const texture = materialWithTextures[slot]
      if (texture && texture.image && !checked.has(texture.uuid)) {
        checked.add(texture.uuid)
        const image = texture.image as HTMLImageElement | globalThis.ImageData | HTMLCanvasElement | { width: number; height: number }
        bytes += (image.width ?? 0) * (image.height ?? 0) * 4
      }
    }
  }
  return bytes
}
