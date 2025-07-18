/**
 * Comprehensive Type Definitions for 3D Geometry and Model Processing
 * 
 * Replaces all 'any' types with proper interfaces for type safety
 * and runtime validation.
 */

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Vector2 {
  x: number
  y: number
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface BoundingBox {
  min: Vector3
  max: Vector3
  center: Vector3
  size: Vector3
}

/**
 * Validated 3D geometry structure with proper type checking
 */
export interface GeometryData {
  vertices: Vector3[]
  faces: number[][]
  triangles: number[][]
  uvs?: Vector2[]
  normals?: Vector3[]
  indices?: number[]
  materials?: MaterialData[]
  bounds?: BoundingBox
  metadata?: GeometryMetadata
}

export interface GeometryMetadata {
  vertexCount: number
  triangleCount: number
  surfaceArea: number
  volume: number
  format: 'GLB' | 'OBJ' | 'FBX' | 'GENERATED'
  source: string
  parseTime: number
  validated: boolean
}

export interface MaterialData {
  id: string
  name: string
  baseColor: string
  metallic: number
  roughness: number
  normalMap?: string
  textureUrls?: string[]
}

/**
 * Item data structure with proper typing
 */
export interface ItemData {
  id: number | string
  name: string
  examine: string
  category: ItemCategory
  equipment?: EquipmentData
  stackable?: boolean
  value?: number
  weight?: number
  requirements?: ItemRequirements
  metadata?: Record<string, unknown>
}

export interface EquipmentData {
  slot: EquipmentSlot
  weaponType?: WeaponType
  armorType?: ArmorType
  level?: number
  stats?: EquipmentStats
  specials?: string[]
}

export interface EquipmentStats {
  damage?: number
  accuracy?: number
  defense?: number
  strength?: number
  range?: number
  speed?: number
}

export interface ItemRequirements {
  level?: number
  skills?: Record<string, number>
  items?: number[]
  quests?: string[]
}

export type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'tool' | 'decoration' | 'resource' | 'misc'
export type EquipmentSlot = 'weapon' | 'shield' | 'helmet' | 'chest' | 'legs' | 'boots' | 'gloves' | 'ring' | 'amulet'
export type WeaponType = 'sword' | 'axe' | 'bow' | 'crossbow' | 'dagger' | 'staff' | 'shield' | 'mace' | 'spear' | 'wand'
export type ArmorType = 'melee' | 'ranged' | 'magic' | 'hybrid'

/**
 * Texture and atlas types
 */
export interface TextureData {
  url: string
  width: number
  height: number
  format: TextureFormat
  channels: number
  data?: Uint8Array
  metadata?: TextureMetadata
}

export interface TextureMetadata {
  compression: string
  mipMaps: boolean
  transparent: boolean
  fileSize: number
  source: string
}

export type TextureFormat = 'PNG' | 'JPEG' | 'WEBP' | 'DDS' | 'KTX'

export interface TextureAtlas {
  id: string
  texture: TextureData
  regions: AtlasRegion[]
  packingEfficiency: number
  totalRegions: number
  metadata: AtlasMetadata
}

export interface AtlasRegion {
  id: string
  x: number
  y: number
  width: number
  height: number
  originalWidth: number
  originalHeight: number
  rotated: boolean
  trimmed: boolean
  uvs: {
    u0: number
    v0: number
    u1: number
    v1: number
  }
}

export interface AtlasMetadata {
  packingMethod: string
  totalWasted: number
  efficiency: number
  createdAt: number
  source: string[]
}

/**
 * Validation functions for runtime type checking
 */
export function validateVector3(obj: unknown): obj is Vector3 {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Vector3).x === 'number' &&
    typeof (obj as Vector3).y === 'number' &&
    typeof (obj as Vector3).z === 'number' &&
    isFinite((obj as Vector3).x) &&
    isFinite((obj as Vector3).y) &&
    isFinite((obj as Vector3).z)
  )
}

export function validateQuaternion(obj: unknown): obj is Quaternion {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Quaternion).x === 'number' &&
    typeof (obj as Quaternion).y === 'number' &&
    typeof (obj as Quaternion).z === 'number' &&
    typeof (obj as Quaternion).w === 'number' &&
    isFinite((obj as Quaternion).x) &&
    isFinite((obj as Quaternion).y) &&
    isFinite((obj as Quaternion).z) &&
    isFinite((obj as Quaternion).w)
  )
}

export function validateGeometryData(obj: unknown): obj is GeometryData {
  if (typeof obj !== 'object' || obj === null) return false
  
  const geo = obj as GeometryData
  
  // Check vertices array
  if (!Array.isArray(geo.vertices)) return false
  if (!geo.vertices.every(validateVector3)) return false
  
  // Check faces array
  if (!Array.isArray(geo.faces)) return false
  if (!geo.faces.every(face => Array.isArray(face) && face.every(idx => typeof idx === 'number' && idx >= 0))) return false
  
  // Check triangles array
  if (!Array.isArray(geo.triangles)) return false
  if (!geo.triangles.every(tri => Array.isArray(tri) && tri.length >= 3)) return false
  
  return true
}

export function validateItemData(obj: unknown): obj is ItemData {
  if (typeof obj !== 'object' || obj === null) return false
  
  const item = obj as ItemData
  
  return (
    (typeof item.id === 'number' || typeof item.id === 'string') &&
    typeof item.name === 'string' &&
    item.name.length > 0 &&
    typeof item.examine === 'string' &&
    typeof item.category === 'string' &&
    ['weapon', 'armor', 'consumable', 'tool', 'decoration', 'resource', 'misc'].includes(item.category)
  )
}

/**
 * Type guards for safe casting
 */
export function assertVector3(obj: unknown): asserts obj is Vector3 {
  if (!validateVector3(obj)) {
    throw new Error(`Invalid Vector3: ${JSON.stringify(obj)}`)
  }
}

export function assertGeometryData(obj: unknown): asserts obj is GeometryData {
  if (!validateGeometryData(obj)) {
    throw new Error(`Invalid GeometryData: ${JSON.stringify(obj, null, 2)}`)
  }
}

export function assertItemData(obj: unknown): asserts obj is ItemData {
  if (!validateItemData(obj)) {
    throw new Error(`Invalid ItemData: ${JSON.stringify(obj, null, 2)}`)
  }
}

/**
 * Utility functions for geometry operations
 */
export function createVector3(x: number, y: number, z: number): Vector3 {
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
    throw new Error(`Invalid Vector3 components: (${x}, ${y}, ${z})`)
  }
  return { x, y, z }
}

export function createQuaternion(x: number, y: number, z: number, w: number): Quaternion {
  if (!isFinite(x) || !isFinite(y) || !isFinite(z) || !isFinite(w)) {
    throw new Error(`Invalid Quaternion components: (${x}, ${y}, ${z}, ${w})`)
  }
  return { x, y, z, w }
}

export function createBoundingBox(vertices: Vector3[]): BoundingBox {
  if (vertices.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 },
      size: { x: 0, y: 0, z: 0 }
    }
  }

  let minX = vertices[0].x, maxX = vertices[0].x
  let minY = vertices[0].y, maxY = vertices[0].y  
  let minZ = vertices[0].z, maxZ = vertices[0].z

  for (const vertex of vertices) {
    if (vertex.x < minX) minX = vertex.x
    if (vertex.x > maxX) maxX = vertex.x
    if (vertex.y < minY) minY = vertex.y
    if (vertex.y > maxY) maxY = vertex.y
    if (vertex.z < minZ) minZ = vertex.z
    if (vertex.z > maxZ) maxZ = vertex.z
  }

  const min = { x: minX, y: minY, z: minZ }
  const max = { x: maxX, y: maxY, z: maxZ }
  const center = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2
  }
  const size = {
    x: maxX - minX,
    y: maxY - minY,
    z: maxZ - minZ
  }

  return { min, max, center, size }
}