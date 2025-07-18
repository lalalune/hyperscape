import { THREE } from './three';

export function getTrianglesFromGeometry(geometry: any | null | undefined): number {
  if (!geometry) {
    return 0;
  }
  return geometry.index !== null ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
}
