import * as THREE from "three";

/**
 * Type guard for material checks
 */
export function isMeshStandardMaterial(
  material: THREE.Material | THREE.Material[],
): material is THREE.MeshStandardMaterial {
  const mat = Array.isArray(material) ? material[0] : material;
  return mat instanceof THREE.MeshStandardMaterial;
}

/**
 * Helper to safely update material properties
 */
export function updateMaterialProperties(
  mesh: THREE.Mesh | THREE.SkinnedMesh,
  properties: Partial<THREE.MeshStandardMaterial>,
) {
  if (mesh.material) {
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach((mat) => {
      if (isMeshStandardMaterial(mat)) {
        Object.assign(mat, properties);
        mat.needsUpdate = true;
      }
    });
  }
}

/**
 * Reset material to default state
 */
export function resetMaterialToDefaults(mesh: THREE.Mesh | THREE.SkinnedMesh) {
  updateMaterialProperties(mesh, {
    opacity: 1,
    transparent: false,
    wireframe: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
  });
}

/**
 * Apply extreme scale material workarounds
 */
export function applyExtremeScaleMaterialFixes(
  mesh: THREE.Mesh | THREE.SkinnedMesh,
) {
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((mat) => {
        mat.side = THREE.DoubleSide;
        mat.depthWrite = true;
        mat.depthTest = true;
        mat.needsUpdate = true;

        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.metalness = 0.5;
          mat.roughness = 0.5;
        }
      });
    }
  });
}
