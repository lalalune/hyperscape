import { THREE } from './three';

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
];

export function getTextureBytesFromMaterial(material: any | null | undefined): number {
  let bytes = 0;
  if (material) {
    const checked = new Set<string>();
    for (const slot of slots) {
      const texture = (material as any)[slot] as any;
      if (texture && texture.image && !checked.has(texture.uuid)) {
        checked.add(texture.uuid);
        const image = texture.image as any;
        bytes += image.width * image.height * 4;
      }
    }
  }
  return bytes;
}
