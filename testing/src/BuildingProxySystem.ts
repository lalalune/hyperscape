/**
 * 3D Building Proxy System
 *
 * Creates physical 3D buildings that agents can walk into, with interiors,
 * trigger zones, and UI activation areas for banking, trading, etc.
 */

import { THREE } from '../../core/extras/three.js'
import { World } from '../../types/index.js'
import { Vector3 } from '../../game/src/types/index.js'
import { RPGEntity } from '../../game/src/entities/RPGEntity.js'
import { VisualRepresentationSystem } from '../../game/src/systems/VisualRepresentationSystem.js'

export interface BuildingConfig {
  id: string
  type: 'bank' | 'shop' | 'guild' | 'tavern' | 'smithy' | 'market'
  position: Vector3
  size: { width: number; height: number; depth: number }
  color: string
  interiorSize?: { width: number; height: number; depth: number }
  doorPosition?: Vector3
  triggerZones?: Array<{
    id: string
    position: Vector3
    size: Vector3
    action: string // 'open_ui', 'start_dialogue', 'show_shop'
    uiType?: string // 'banking', 'trading', 'inventory'
  }>
  npcs?: Array<{
    type: string
    position: Vector3
    name: string
  }>
}

export interface BuildingProxy {
  id: string
  entity: RPGEntity
  exterior: THREE.Mesh
  interior?: THREE.Group
  triggerZones: Map<string, TriggerZone>
  doorway?: THREE.Mesh
}

export interface TriggerZone {
  id: string
  mesh: THREE.Mesh
  action: string
  uiType?: string
  active: boolean
}

export class BuildingProxySystem {
  private world: World
  private visualSystem: VisualRepresentationSystem | null = null
  private buildings: Map<string, BuildingProxy> = new Map()
  private scene: THREE.Scene | null = null
  private buildingGroup: THREE.Group

  // Unique colors for each building type
  private buildingColors = {
    bank: '#FFD700', // Gold
    shop: '#8FBC8F', // Dark Sea Green
    guild: '#9370DB', // Medium Purple
    tavern: '#D2691E', // Chocolate
    smithy: '#696969', // Dim Gray
    market: '#FF6347', // Tomato
  }

  constructor(world: World) {
    this.world = world
    this.buildingGroup = new THREE.Group()
    this.buildingGroup.name = 'building-proxies'
  }

  /**
   * Initialize the building proxy system
   */
  async init(): Promise<void> {
    // Get visual system reference
    this.visualSystem = this.world.getSystem('visualRepresentation') as VisualRepresentationSystem

    // Get scene reference
    if (this.world.stage?.scene) {
      this.scene = this.world.stage.scene as unknown as THREE.Scene
      this.scene.add(this.buildingGroup)
    }

    console.log('[BuildingProxySystem] Initialized')
  }

  /**
   * Create a 3D building proxy
   */
  createBuilding(config: BuildingConfig): BuildingProxy | null {
    try {
      console.log(`[BuildingProxySystem] Creating ${config.type} building: ${config.id}`)

      // Create building entity
      const entity = new RPGEntity(this.world, 'building', {
        id: config.id,
        type: 'building',
        subtype: config.type,
        name: `${config.type.charAt(0).toUpperCase() + config.type.slice(1)} Building`,
        position: config.position,
      })

      // Create exterior structure
      const exterior = this.createExterior(config)

      // Create interior (if specified)
      let interior: THREE.Group | undefined
      if (config.interiorSize) {
        interior = this.createInterior(config)
      }

      // Create doorway
      const doorway = this.createDoorway(config)

      // Create trigger zones
      const triggerZones = this.createTriggerZones(config)

      // Create building proxy
      const buildingProxy: BuildingProxy = {
        id: config.id,
        entity,
        exterior,
        interior,
        triggerZones,
        doorway,
      }

      // Add all meshes to building group
      this.buildingGroup.add(exterior)
      if (interior) {
        this.buildingGroup.add(interior)
      }
      if (doorway) {
        this.buildingGroup.add(doorway)
      }

      for (const [_, zone] of triggerZones) {
        this.buildingGroup.add(zone.mesh)
      }

      // Store building
      this.buildings.set(config.id, buildingProxy)

      // Spawn NPCs if specified
      if (config.npcs) {
        this.spawnBuildingNPCs(config)
      }

      console.log(`[BuildingProxySystem] Building created: ${config.id}`)
      return buildingProxy
    } catch (error: any) {
      console.error(`[BuildingProxySystem] Failed to create building ${config.id}:`, error)
      return null
    }
  }

  /**
   * Create building exterior
   */
  private createExterior(config: BuildingConfig): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(config.size.width, config.size.height, config.size.depth)

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.color || this.buildingColors[config.type]),
      roughness: 0.8,
      metalness: 0.1,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(config.position.x, config.position.y, config.position.z)
    mesh.name = `${config.id}-exterior`

    // Enable shadows
    mesh.castShadow = true
    mesh.receiveShadow = true

    return mesh
  }

  /**
   * Create building interior
   */
  private createInterior(config: BuildingConfig): THREE.Group {
    const interiorGroup = new THREE.Group()
    interiorGroup.name = `${config.id}-interior`

    // Interior floor
    const floorGeometry = new THREE.PlaneGeometry(config.interiorSize!.width, config.interiorSize!.depth)
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513, // Brown
      roughness: 0.9,
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(config.position.x, config.position.y - config.size.height / 2 + 0.1, config.position.z)
    floor.receiveShadow = true

    // Interior walls (if different from exterior)
    const wallHeight = config.interiorSize!.height || config.size.height * 0.8
    const wallThickness = 0.2

    // Back wall
    const backWallGeometry = new THREE.BoxGeometry(config.interiorSize!.width, wallHeight, wallThickness)
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xdddddd, // Light gray
      roughness: 0.7,
    })
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial)
    backWall.position.set(config.position.x, config.position.y, config.position.z - config.interiorSize!.depth / 2)

    // Side walls
    const sideWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, config.interiorSize!.depth)

    const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial)
    leftWall.position.set(config.position.x - config.interiorSize!.width / 2, config.position.y, config.position.z)

    const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial)
    rightWall.position.set(config.position.x + config.interiorSize!.width / 2, config.position.y, config.position.z)

    interiorGroup.add(floor, backWall, leftWall, rightWall)

    // Position interior group
    interiorGroup.position.set(config.position.x, config.position.y, config.position.z)

    return interiorGroup
  }

  /**
   * Create building doorway
   */
  private createDoorway(config: BuildingConfig): THREE.Mesh {
    const doorPosition = config.doorPosition || {
      x: config.position.x,
      y: config.position.y - config.size.height / 4,
      z: config.position.z + config.size.depth / 2,
    }

    const doorGeometry = new THREE.BoxGeometry(1.2, 2.0, 0.2)
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513, // Brown
      roughness: 0.8,
    })

    const door = new THREE.Mesh(doorGeometry, doorMaterial)
    door.position.set(doorPosition.x, doorPosition.y, doorPosition.z)
    door.name = `${config.id}-doorway`

    return door
  }

  /**
   * Create trigger zones for UI activation
   */
  private createTriggerZones(config: BuildingConfig): Map<string, TriggerZone> {
    const zones = new Map<string, TriggerZone>()

    if (!config.triggerZones) {
      // Create default entrance trigger zone
      const defaultZone = {
        id: 'entrance',
        position: {
          x: config.position.x,
          y: config.position.y,
          z: config.position.z + config.size.depth / 2 + 1,
        },
        size: { x: 2, y: 2, z: 1 },
        action: 'open_ui',
        uiType: config.type === 'bank' ? 'banking' : 'shop',
      }
      config.triggerZones = [defaultZone]
    }

    for (const zoneConfig of config.triggerZones) {
      const geometry = new THREE.BoxGeometry(zoneConfig.size.x, zoneConfig.size.y, zoneConfig.size.z)

      // Make trigger zones semi-transparent and colored by action
      const actionColors: Record<string, number> = {
        open_ui: 0x00ff00, // Green
        start_dialogue: 0x0000ff, // Blue
        show_shop: 0xffff00, // Yellow
      }

      const material = new THREE.MeshBasicMaterial({
        color: actionColors[zoneConfig.action] || 0xff0000,
        transparent: true,
        opacity: 0.3,
        visible: true, // Make visible for testing
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(zoneConfig.position.x, zoneConfig.position.y, zoneConfig.position.z)
      mesh.name = `${config.id}-trigger-${zoneConfig.id}`

      const triggerZone: TriggerZone = {
        id: zoneConfig.id,
        mesh,
        action: zoneConfig.action,
        uiType: zoneConfig.uiType,
        active: true,
      }

      zones.set(zoneConfig.id, triggerZone)
    }

    return zones
  }

  /**
   * Spawn NPCs for the building
   */
  private spawnBuildingNPCs(config: BuildingConfig): void {
    if (!config.npcs) {
      return
    }

    // This would integrate with the NPC system
    for (const npcConfig of config.npcs) {
      console.log(
        `[BuildingProxySystem] Would spawn NPC: ${npcConfig.name} (${npcConfig.type}) at building ${config.id}`
      )
      // TODO: Integrate with NPCSystem to spawn actual NPCs
    }
  }

  /**
   * Check if position is within a trigger zone
   */
  checkTriggerZones(position: Vector3): Array<{
    buildingId: string
    zoneId: string
    action: string
    uiType?: string
  }> {
    const triggered: Array<{
      buildingId: string
      zoneId: string
      action: string
      uiType?: string
    }> = []

    for (const [buildingId, building] of this.buildings) {
      for (const [zoneId, zone] of building.triggerZones) {
        if (!zone.active) {
          continue
        }

        const zoneBounds = new THREE.Box3().setFromObject(zone.mesh)
        const point = new THREE.Vector3(position.x, position.y, position.z)

        if (zoneBounds.containsPoint(point)) {
          triggered.push({
            buildingId,
            zoneId,
            action: zone.action,
            uiType: zone.uiType,
          })
        }
      }
    }

    return triggered
  }

  /**
   * Get building by ID
   */
  getBuilding(buildingId: string): BuildingProxy | undefined {
    return this.buildings.get(buildingId)
  }

  /**
   * Remove a building
   */
  removeBuilding(buildingId: string): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) {
      return false
    }

    // Remove from scene
    this.buildingGroup.remove(building.exterior)
    if (building.interior) {
      this.buildingGroup.remove(building.interior)
    }
    if (building.doorway) {
      this.buildingGroup.remove(building.doorway)
    }

    for (const [_, zone] of building.triggerZones) {
      this.buildingGroup.remove(zone.mesh)
    }

    // Dispose geometries and materials
    this.disposeMesh(building.exterior)
    if (building.interior) {
      this.disposeGroup(building.interior)
    }
    if (building.doorway) {
      this.disposeMesh(building.doorway)
    }

    for (const [_, zone] of building.triggerZones) {
      this.disposeMesh(zone.mesh)
    }

    this.buildings.delete(buildingId)
    return true
  }

  /**
   * Dispose mesh resources
   */
  private disposeMesh(mesh: THREE.Mesh): void {
    if (mesh.geometry) {
      mesh.geometry.dispose()
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m: any) => m.dispose())
      } else {
        ; (mesh.material as any).dispose()
      }
    }
  }

  /**
   * Dispose group resources
   */
  private disposeGroup(group: THREE.Group): void {
    group.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        this.disposeMesh(child as THREE.Mesh)
      } else if (child instanceof THREE.Group) {
        this.disposeGroup(child as THREE.Group)
      }
    })
  }

  /**
   * Get all buildings
   */
  getAllBuildings(): Map<string, BuildingProxy> {
    return new Map(this.buildings)
  }

  /**
   * Clean up all buildings
   */
  cleanup(): void {
    console.log('[BuildingProxySystem] Cleaning up all buildings...')

    for (const [buildingId] of this.buildings) {
      this.removeBuilding(buildingId)
    }

    if (this.scene && this.buildingGroup) {
      this.scene.remove(this.buildingGroup)
    }

    this.buildings.clear()
    console.log('[BuildingProxySystem] Cleanup complete')
  }
}

/**
 * Pre-configured building templates for common RPG buildings
 */
export const BuildingTemplates = {
  bank: (id: string, position: Vector3): BuildingConfig => ({
    id,
    type: 'bank',
    position,
    size: { width: 8, height: 6, depth: 8 },
    color: '#FFD700', // Gold
    interiorSize: { width: 6, height: 5, depth: 6 },
    triggerZones: [
      {
        id: 'banking_counter',
        position: { x: position.x, y: position.y, z: position.z - 2 },
        size: { x: 4, y: 2, z: 2 },
        action: 'open_ui',
        uiType: 'banking',
      },
      {
        id: 'entrance',
        position: { x: position.x, y: position.y, z: position.z + 5 },
        size: { x: 2, y: 2, z: 1 },
        action: 'open_ui',
        uiType: 'banking',
      },
    ],
    npcs: [
      {
        type: 'banker',
        position: { x: position.x, y: position.y, z: position.z - 2 },
        name: 'Bank Clerk',
      },
    ],
  }),

  shop: (id: string, position: Vector3): BuildingConfig => ({
    id,
    type: 'shop',
    position,
    size: { width: 6, height: 5, depth: 6 },
    color: '#8FBC8F', // Dark Sea Green
    interiorSize: { width: 4, height: 4, depth: 4 },
    triggerZones: [
      {
        id: 'shop_counter',
        position: { x: position.x, y: position.y, z: position.z },
        size: { x: 3, y: 2, z: 3 },
        action: 'show_shop',
        uiType: 'shop',
      },
    ],
    npcs: [
      {
        type: 'merchant',
        position: { x: position.x, y: position.y, z: position.z },
        name: 'Shop Keeper',
      },
    ],
  }),

  market: (id: string, position: Vector3): BuildingConfig => ({
    id,
    type: 'market',
    position,
    size: { width: 12, height: 4, depth: 12 },
    color: '#FF6347', // Tomato
    triggerZones: [
      {
        id: 'grand_exchange',
        position: { x: position.x, y: position.y, z: position.z },
        size: { x: 8, y: 2, z: 8 },
        action: 'open_ui',
        uiType: 'grand_exchange',
      },
    ],
  }),
}
