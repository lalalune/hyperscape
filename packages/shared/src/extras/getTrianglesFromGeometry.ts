import THREE from './three'

export function getTrianglesFromGeometry(geometry: THREE.BufferGeometry): number {
  if (!geometry) return 0
  
  const index = geometry.index
  const position = geometry.attributes.position
  
  if (!position) return 0
  
  if (index) {
    // Indexed geometry
    return Math.floor(index.count / 3)
  } else {
    // Non-indexed geometry
    return Math.floor(position.count / 3)
  }
}

export function getTriangleVerticesFromGeometry(geometry: THREE.BufferGeometry): Float32Array | null {
  if (!geometry) return null
  
  const position = geometry.attributes.position
  if (!position) return null
  
  const index = geometry.index
  
  if (index) {
    // Indexed geometry - need to expand vertices
    const indexArray = index.array
    const positionArray = position.array
    const triangleVertices = new Float32Array(indexArray.length * 3)
    
    for (let i = 0; i < indexArray.length; i++) {
      const vertexIndex = indexArray[i]
      triangleVertices[i * 3] = positionArray[vertexIndex * 3]
      triangleVertices[i * 3 + 1] = positionArray[vertexIndex * 3 + 1]
      triangleVertices[i * 3 + 2] = positionArray[vertexIndex * 3 + 2]
    }
    
    return triangleVertices
  } else {
    // Non-indexed geometry - vertices are already in triangle order
    return position.array as Float32Array
  }
}

export function getGeometryBounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox()
  }
  
  return geometry.boundingBox || new THREE.Box3()
}

export function getGeometryComplexity(geometry: THREE.BufferGeometry): {
  triangles: number
  vertices: number
  hasUVs: boolean
  hasNormals: boolean
  hasColors: boolean
} {
  const triangles = getTrianglesFromGeometry(geometry)
  const vertices = geometry.attributes.position ? geometry.attributes.position.count : 0
  
  return {
    triangles,
    vertices,
    hasUVs: !!geometry.attributes.uv,
    hasNormals: !!geometry.attributes.normal,
    hasColors: !!geometry.attributes.color
  }
}