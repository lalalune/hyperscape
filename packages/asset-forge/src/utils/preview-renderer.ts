import * as THREE from "three";

export interface PreviewRendererOptions {
  canvas?: HTMLCanvasElement;
  antialias?: boolean;
  alpha?: boolean;
  preserveDrawingBuffer?: boolean;
}

export type PreviewRenderer = THREE.WebGLRenderer;

export function createPreviewRenderer(
  options: PreviewRendererOptions = {},
): PreviewRenderer {
  return new THREE.WebGLRenderer({
    canvas: options.canvas,
    antialias: options.antialias ?? true,
    alpha: options.alpha ?? true,
    preserveDrawingBuffer: options.preserveDrawingBuffer,
  });
}

function copyMaterialColor(
  source: THREE.Material,
  fallback: THREE.ColorRepresentation,
): THREE.Color {
  const materialWithColor = source as THREE.Material & {
    color?: THREE.Color;
  };
  return materialWithColor.color?.clone() ?? new THREE.Color(fallback);
}

export function toWebGLStandardMaterial(
  source: THREE.Material,
  fallbackColor: THREE.ColorRepresentation = 0xffffff,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: copyMaterialColor(source, fallbackColor),
    roughness: (source as THREE.MeshStandardMaterial).roughness ?? 0.8,
    metalness: (source as THREE.MeshStandardMaterial).metalness ?? 0,
    vertexColors: (source as THREE.MeshStandardMaterial).vertexColors,
    wireframe: (source as THREE.MeshStandardMaterial).wireframe,
    transparent: source.transparent,
    opacity: source.opacity,
    side: source.side,
  });

  return material;
}

export function makeObjectWebGLSafe(
  object: THREE.Object3D,
  fallbackColor: THREE.ColorRepresentation = 0xffffff,
): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    const replacements = materials.map((material) => {
      if (
        material instanceof THREE.MeshBasicMaterial ||
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshPhysicalMaterial ||
        material instanceof THREE.SpriteMaterial
      ) {
        return material;
      }

      const replacement = toWebGLStandardMaterial(material, fallbackColor);
      material.dispose();
      return replacement;
    });

    child.material = Array.isArray(child.material)
      ? replacements
      : replacements[0];
  });
}

export { THREE };
