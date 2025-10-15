/**
 * CLAUDE.md Compliance: Strong typing enforced for resource system
 * No `any` types - all resource types explicitly defined
 */

import type { Vector3 } from 'three'

/**
 * Represents a resource item in the world (tree, fishing spot, rock, etc.)
 */
export interface ResourceItem {
  id: string
  type: string
  position: Vector3
  quantity?: number
  level?: number
  respawnTime?: number
  data?: ResourceData
}

/**
 * Additional data that can be attached to resources
 */
export interface ResourceData {
  health?: number
  maxHealth?: number
  gatherTime?: number
  requiredTool?: string
  requiredLevel?: number
  rewards?: ResourceReward[]
  [key: string]: unknown
}

/**
 * Reward given when gathering a resource
 */
export interface ResourceReward {
  itemId: string
  minQuantity: number
  maxQuantity: number
  chance: number
}

/**
 * Resource system interface - provides access to world resources
 */
export interface ResourceSystem {
  getResourcesByType: (type: string) => ResourceItem[]
  getAllResources: () => ResourceItem[]
  getResourceById?: (id: string) => ResourceItem | undefined
  getNearbyResources?: (position: Vector3, radius: number) => ResourceItem[]
  removeResource?: (id: string) => void
  addResource?: (resource: ResourceItem) => void
}

/**
 * Type guard to check if an object is a ResourceItem
 */
export function isResourceItem(obj: unknown): obj is ResourceItem {
  if (!obj || typeof obj !== 'object') return false
  const resource = obj as Record<string, unknown>
  return (
    typeof resource.id === 'string' &&
    typeof resource.type === 'string' &&
    resource.position !== null &&
    typeof resource.position === 'object'
  )
}

/**
 * Type guard to check if an object is a ResourceSystem
 */
export function isResourceSystem(obj: unknown): obj is ResourceSystem {
  if (!obj || typeof obj !== 'object') return false
  const system = obj as Record<string, unknown>
  return (
    typeof system.getResourcesByType === 'function' &&
    typeof system.getAllResources === 'function'
  )
}
