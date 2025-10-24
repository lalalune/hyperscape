import { DoubleSide, FrontSide, Material, Mesh, MeshStandardMaterial, SkinnedMesh } from 'three'

/**
 * Type guard for material checks
 */
export function isMeshStandardMaterial(material: Material | Material[]): material is MeshStandardMaterial {
    const mat = Array.isArray(material) ? material[0] : material
    return mat instanceof MeshStandardMaterial
}

/**
 * Helper to safely update material properties
 */
export function updateMaterialProperties(
    mesh: Mesh | SkinnedMesh, 
    properties: Partial<MeshStandardMaterial>
) {
    if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach(mat => {
            if (isMeshStandardMaterial(mat)) {
                Object.assign(mat, properties)
                mat.needsUpdate = true
            }
        })
    }
}

/**
 * Reset material to default state
 */
export function resetMaterialToDefaults(mesh: Mesh | SkinnedMesh) {
    updateMaterialProperties(mesh, {
        opacity: 1,
        transparent: false,
        wireframe: false,
        depthWrite: true,
        depthTest: true,
        side: FrontSide
    })
}

/**
 * Apply extreme scale material workarounds
 */
export function applyExtremeScaleMaterialFixes(mesh: Mesh | SkinnedMesh) {
    mesh.traverse((child) => {
        if (child instanceof Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach(mat => {
                mat.side = DoubleSide
                mat.depthWrite = true
                mat.depthTest = true
                mat.needsUpdate = true

                if (mat instanceof MeshStandardMaterial) {
                    mat.metalness = 0.5
                    mat.roughness = 0.5
                }
            })
        }
    })
}