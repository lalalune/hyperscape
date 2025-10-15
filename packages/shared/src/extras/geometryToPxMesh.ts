/**
 * geometryToPxMesh.ts - Three.js to PhysX Mesh Converter
 * 
 * Converts Three.js BufferGeometry to PhysX collision meshes (convex or triangle).
 * Handles the complex process of "cooking" meshes for PhysX consumption.
 * 
 * **Why Cooking?**
 * PhysX requires geometry to be "cooked" (preprocessed) before use:
 * - Optimizes mesh data structures for collision detection
 * - Builds acceleration structures (BVH trees)
 * - Validates topology and fixes degeneracies
 * 
 * **Mesh Types:**
 * - **Convex Mesh:** For dynamic objects (balls, boxes, characters)
 *   - Fast collision detection
 *   - Simplified hull (not exact geometry)
 *   - Good for moving objects
 * 
 * - **Triangle Mesh:** For static environment (terrain, buildings)
 *   - Exact geometry collision
 *   - Slower than convex
 *   - Only for static actors
 * 
 * **Caching:**
 * - Cooked meshes are cached by geometry UUID + type
 * - Reference counting for shared meshes
 * - Automatic cleanup when last reference is released
 * 
 * **Memory Management:**
 * - Uses PhysX heap (HEAPF32, HEAPU16, HEAPU32)
 * - Allocates temp buffers with _webidl_malloc
 * - Frees buffers after cooking with _webidl_free
 * 
 * **Referenced by:** Collider nodes, terrain collision, static world geometry
 */

import type { GeometryCacheItem as CacheItem, GeometryPhysXMesh as PhysXMesh } from '../types/physics';
import { World } from '../World';
import THREE from './three';

/** Global PHYSX module declaration for WASM heap access */
declare const PHYSX: {
  _webidl_malloc: (size: number) => number;
  _webidl_free: (ptr: number) => void;
  HEAPF32: { set: (data: Float32Array, offset: number) => void };
  HEAPU16: { set: (data: Uint16Array, offset: number) => void };
  HEAPU32: { set: (data: Uint32Array, offset: number) => void };
  PxConvexMeshDesc: new () => unknown;
  PxTriangleMeshDesc: new () => unknown;
  PxConvexFlagEnum: { eCOMPUTE_CONVEX: number };
  PxTriangleMeshFlagEnum: { e16_BIT_INDICES: number };
  CreateConvexMesh: (params: unknown, desc: unknown) => PhysXMesh | null;
  CreateTriangleMesh: (params: unknown, desc: unknown) => PhysXMesh | null;
  destroy: (obj: unknown) => void;
} | undefined;

const cache = new Map<string, CacheItem>() // id -> { id, pmesh, refs }

export class PMeshHandle {
  value: PhysXMesh | null;
  item: CacheItem;
  released: boolean;
  
  constructor(item: CacheItem) {
    this.value = item.pmesh
    this.item = item
    this.item.refs++
    this.released = false
  }

  release() {
    if (this.released) return
    this.item.refs--
    if (this.item.refs === 0) {
      const releasable = this.item.pmesh as { release?: () => void }
      if (releasable.release) {
        releasable.release()
      }
      cache.delete(this.item.id)
    }
    this.released = true
    this.value = null
  }
}

export function geometryToPxMesh(world: World, geometry: THREE.BufferGeometry, convex: boolean): PMeshHandle | null {
  // Check if PHYSX is available globally
  if (!PHYSX) {
    // Don't warn on server - PhysX is optional there
    if (typeof window !== 'undefined') {
      console.warn('[geometryToPxMesh] PHYSX not available');
    }
    return null;
  }
  
  // Check if physics system is initialized
  if (!world.physics || !world.physics.isInitialized()) {
    return null;
  }

  // Assert that PHYSX is defined after null check
  const physx = PHYSX!;
  const id = `${geometry.uuid}_${convex ? 'convex' : 'triangles'}`

  // check and return cached if already cooked
  let item = cache.get(id)
  if (item) {
    return new PMeshHandle(item)
  }

  const cookingParams = world.physics.cookingParams

  // geometry = BufferGeometryUtils.mergeVertices(geometry)
  // geometry = geometry.toNonIndexed()
  // geometry.computeVertexNormals()


  let position = geometry.attributes.position
  const index = geometry.index

  if ('isInterleavedBufferAttribute' in position && position.isInterleavedBufferAttribute) {
    // deinterleave!
    interface InterleavedAttributeWithGetComponent extends THREE.InterleavedBufferAttribute {
      getComponent(index: number, component: number): number;
    }
    
    const interleavedAttribute = position as THREE.InterleavedBufferAttribute
    const itemSize = interleavedAttribute.itemSize
    const count = interleavedAttribute.count
    const array = new Float32Array(count * itemSize)
    
    // Manually extract the deinterleaved data
    // Try using getComponent method if available (newer Three.js versions)
    const attrWithGetComponent = interleavedAttribute as InterleavedAttributeWithGetComponent
    if (attrWithGetComponent.getComponent) {
      for (let i = 0; i < count; i++) {
        for (let j = 0; j < itemSize; j++) {
          array[i * itemSize + j] = attrWithGetComponent.getComponent(i, j)
        }
      }
    } else {
      const src = interleavedAttribute.data.array as Float32Array | number[]
      const stride = interleavedAttribute.data.stride
      const offset = interleavedAttribute.offset
      for (let i = 0; i < count; i++) {
        for (let j = 0; j < itemSize; j++) {
          array[i * itemSize + j] = src[i * stride + offset + j] as number
        }
      }
    }
    
    position = new THREE.BufferAttribute(array, itemSize, false)
  }


  const positions = position.array as Float32Array
  const floatBytes = positions.length * positions.BYTES_PER_ELEMENT
  const pointsPtr = physx._webidl_malloc(floatBytes)
  physx.HEAPF32.set(positions, pointsPtr >> 2)

  let desc
  let pmesh

  if (convex) {
    desc = new physx.PxConvexMeshDesc()
    desc.points.count = positions.length / 3
    desc.points.stride = 12 // size of PhysX.PxVec3 in bytes
    desc.points.data = pointsPtr
    desc.flags.raise(physx.PxConvexFlagEnum.eCOMPUTE_CONVEX) // eCHECK_ZERO_AREA_TRIANGLES
    pmesh = physx.CreateConvexMesh(cookingParams, desc)
  } else {
    desc = new physx.PxTriangleMeshDesc()

    desc.points.count = positions.length / 3
    desc.points.stride = 12
    desc.points.data = pointsPtr


    let indices = index!.array // Uint16Array or Uint32Array

    // for some reason i'm seeing Uint8Arrays in some glbs, specifically the vipe rooms.
    // so we just coerce these up to u16
    if (indices instanceof Uint8Array) {
      indices = new Uint16Array(index!.array.length)
      for (let i = 0; i < index!.array.length; i++) {
        indices[i] = index!.array[i]
      }
    }

    const indexBytes = indices.length * indices.BYTES_PER_ELEMENT
    const indexPtr = physx._webidl_malloc(indexBytes)
    if (indices instanceof Uint16Array) {
      physx.HEAPU16.set(indices, indexPtr >> 1)
      desc.triangles.stride = 6 // 3 × 2 bytes per triangle
      desc.flags.raise(physx.PxTriangleMeshFlagEnum.e16_BIT_INDICES)
    } else {
      // note: this is here for brevity but no longer used as we force everything to 16 bit
      physx.HEAPU32.set(indices as Uint32Array, indexPtr >> 2)
      desc.triangles.stride = 12 // 3 × 4 bytes per triangle
    }
    desc.triangles.count = indices.length / 3
    desc.triangles.data = indexPtr


    // if (!desc.isValid()) {
    //   throw new Error('Invalid mesh description')
    // }

    pmesh = physx.CreateTriangleMesh(cookingParams, desc);
    physx._webidl_free(indexPtr);
  }

  physx._webidl_free(pointsPtr)
  physx.destroy(desc)

  if (!pmesh) return null

  item = { id, pmesh, refs: 0 }
  cache.set(id, item)
  return new PMeshHandle(item)
}
