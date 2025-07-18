/**
 * Resource Spawning System - Manages placement and spawning of harvestable resources
 * Creates colored cubes representing trees, rocks, and fishing spots throughout the world
 */

import { System } from '../../core/systems/System'
import type { World, Entity } from '../../types'
import { RESOURCE_DEFINITIONS, ResourceType, ResourceDefinition } from './resources/ResourceDefinitions'
import { ZONE_DEFINITIONS, ZoneType, getZoneAt } from './zones/ZoneDefinitions'
import { THREE } from '../../core/extras/three'

interface ResourceEntity extends Entity {
  type: 'resource'
  resourceType: ResourceType
  depleted: boolean
  respawnTime: number
  lastHarvestTime: number
  harvestInProgress: boolean
  position: { x: number; y: number; z: number }
  zoneType: ZoneType
}

interface ResourceSpawner {
  id: string
  resourceType: ResourceType
  position: { x: number; y: number; z: number }
  zone: ZoneType
  respawnTime: number
  active: boolean
  entity?: ResourceEntity
}

export class ResourceSpawningSystem extends System {
  private resourceSpawners: Map<string, ResourceSpawner> = new Map()
  private resourceEntities: Map<string, ResourceEntity> = new Map()
  private zoneDensityMaps: Map<ZoneType, Float32Array> = new Map()
  private lastSpawnCheck: number = 0
  private spawnCheckInterval: number = 5000 // Check every 5 seconds

  constructor(world: World) {
    super(world)
    this.initializeZoneDensityMaps()
  }

  async initialize(): Promise<void> {
    console.log('[ResourceSpawningSystem] Initializing...')

    // Generate initial resource spawners for all zones
    this.generateResourceSpawners()

    // Spawn initial resources
    this.spawnInitialResources()

    console.log(`[ResourceSpawningSystem] Initialized with ${this.resourceSpawners.size} spawners`)
  }

  private initializeZoneDensityMaps(): void {
    // Create density maps for each zone to optimize spawning
    for (const [zoneType, zoneDef] of Object.entries(ZONE_DEFINITIONS)) {
      const width = zoneDef.bounds.maxX - zoneDef.bounds.minX
      const height = zoneDef.bounds.maxZ - zoneDef.bounds.minZ
      const densityMap = new Float32Array(width * height)

      // Initialize with base density
      densityMap.fill(0.1)

      this.zoneDensityMaps.set(zoneType as ZoneType, densityMap)
    }
  }

  private generateResourceSpawners(): void {
    for (const [zoneType, zoneDef] of Object.entries(ZONE_DEFINITIONS)) {
      console.log(`[ResourceSpawningSystem] Generating spawners for ${zoneDef.name}`)

      for (const resourceDist of zoneDef.resources) {
        this.generateSpawnersForResource(zoneType as ZoneType, zoneDef, resourceDist)
      }
    }
  }

  private generateSpawnersForResource(zoneType: ZoneType, zoneDef: any, resourceDist: any): void {
    const resourceDef = RESOURCE_DEFINITIONS[resourceDist.resourceType]
    if (!resourceDef) {
      return
    }

    const zoneWidth = zoneDef.bounds.maxX - zoneDef.bounds.minX
    const zoneHeight = zoneDef.bounds.maxZ - zoneDef.bounds.minZ
    const totalArea = zoneWidth * zoneHeight

    // Calculate number of spawners based on density
    const baseSpawners = Math.floor(totalArea * resourceDist.density * 0.001) // Scale factor

    for (let i = 0; i < baseSpawners; i++) {
      const position = this.findValidSpawnPosition(zoneDef, resourceDist)
      if (position) {
        const spawnerId = `${resourceDist.resourceType}_${zoneType}_${i}`

        const spawner: ResourceSpawner = {
          id: spawnerId,
          resourceType: resourceDist.resourceType,
          position,
          zone: zoneType,
          respawnTime: resourceDef.respawnTime,
          active: true,
        }

        this.resourceSpawners.set(spawnerId, spawner)
      }
    }
  }

  private findValidSpawnPosition(zoneDef: any, resourceDist: any): { x: number; y: number; z: number } | null {
    const maxAttempts = 50

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let x: number, z: number

      // Check if there are preferred areas for this resource
      if (resourceDist.preferredAreas && resourceDist.preferredAreas.length > 0 && Math.random() < 0.7) {
        // 70% chance to spawn in preferred areas
        const preferredArea =
          resourceDist.preferredAreas[Math.floor(Math.random() * resourceDist.preferredAreas.length)]

        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * preferredArea.radius
        x = preferredArea.centerX + Math.cos(angle) * distance
        z = preferredArea.centerZ + Math.sin(angle) * distance
      } else {
        // Random position within zone bounds
        x = zoneDef.bounds.minX + Math.random() * (zoneDef.bounds.maxX - zoneDef.bounds.minX)
        z = zoneDef.bounds.minZ + Math.random() * (zoneDef.bounds.maxZ - zoneDef.bounds.minZ)
      }

      // Ensure position is within zone bounds
      if (x < zoneDef.bounds.minX || x > zoneDef.bounds.maxX || z < zoneDef.bounds.minZ || z > zoneDef.bounds.maxZ) {
        continue
      }

      // Check for minimum distance from other resources
      if (this.isPositionValid(x, z, 3.0)) {
        return { x, y: 0, z }
      }
    }

    return null
  }

  private isPositionValid(x: number, z: number, minDistance: number): boolean {
    for (const spawner of this.resourceSpawners.values()) {
      const dx = spawner.position.x - x
      const dz = spawner.position.z - z
      const distance = Math.sqrt(dx * dx + dz * dz)

      if (distance < minDistance) {
        return false
      }
    }
    return true
  }

  private spawnInitialResources(): void {
    let spawnedCount = 0

    for (const spawner of this.resourceSpawners.values()) {
      if (Math.random() < 0.8) {
        // 80% chance to spawn initially
        this.spawnResource(spawner)
        spawnedCount++
      }
    }

    console.log(`[ResourceSpawningSystem] Spawned ${spawnedCount} initial resources`)
  }

  private spawnResource(spawner: ResourceSpawner): ResourceEntity | null {
    const resourceDef = RESOURCE_DEFINITIONS[spawner.resourceType]
    if (!resourceDef) {
      return null
    }

    const entityId = `resource_${spawner.id}_${Date.now()}`

    const resourceEntity: Partial<ResourceEntity> = {
      id: entityId,
      type: 'resource',
      resourceType: spawner.resourceType,
      depleted: false,
      respawnTime: resourceDef.respawnTime,
      lastHarvestTime: 0,
      harvestInProgress: false,
      position: { ...spawner.position },
      zoneType: spawner.zone,
      components: new Map(),
    };

    // Create visual representation
    // Visual creation handled separately

    // Add to world
    (this.world as any).spawn(resourceEntity)
    this.resourceEntities.set(entityId, resourceEntity as any)
    spawner.entity = resourceEntity as any

    console.log(`[ResourceSpawningSystem] Spawned ${resourceDef.name} at ${JSON.stringify(spawner.position)}`)

    return resourceEntity as any
  }

  private createResourceVisual(entity: ResourceEntity, resourceDef: ResourceDefinition): void {
    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (!visualSystem) {
      return
    }

    // Create a colored cube geometry
    const geometry = new THREE.BoxGeometry(resourceDef.visual.scale, resourceDef.visual.scale, resourceDef.visual.scale)

    const material = new THREE.MeshStandardMaterial({
      color: resourceDef.visual.color,
      metalness: resourceDef.visual.metalness || 0,
      roughness: resourceDef.visual.roughness || 0.5,
      emissive: resourceDef.visual.emissive || '#000000',
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(entity.position.x, entity.position.y + resourceDef.visual.scale / 2, entity.position.z)
    mesh.userData = {
      entityId: entity.id,
      resourceType: entity.resourceType,
      harvestable: true,
    }

    // Add to visual system (assuming it has an addMesh method)
    if ((visualSystem as any).addMesh) {
      ;(visualSystem as any).addMesh(mesh)
    }
  }

  public harvestResource(entityId: string, playerId: string): boolean {
    const resource = this.resourceEntities.get(entityId)
    if (!resource || resource.depleted || resource.harvestInProgress) {
      return false
    }

    const resourceDef = RESOURCE_DEFINITIONS[resource.resourceType]
    if (!resourceDef) {
      return false
    }

    // Check if player meets requirements
    const player = this.world.getEntityById(playerId)
    if (!player) {
      return false
    }

    // Use the skills system to check player's skill level
    const skillsSystem = this.world.systems.find(s => s.constructor.name === 'EnhancedSkillsSystem')
    if (!skillsSystem) {
      return false
    }

    const playerLevel = (skillsSystem as any).getSkillLevel(playerId, resourceDef.skill)
    if (playerLevel < resourceDef.levelRequired) {
      this.world.events.emit('resource:insufficient_level', {
        playerId,
        resourceType: resource.resourceType,
        required: resourceDef.levelRequired,
        current: playerLevel,
      })
      return false
    }

    // Start harvesting
    resource.harvestInProgress = true
    resource.lastHarvestTime = Date.now()

    this.world.events.emit('resource:harvest_started', {
      playerId,
      resourceId: entityId,
      resourceType: resource.resourceType,
      duration: resourceDef.baseHarvestTime,
    })

    // Schedule harvest completion
    setTimeout(() => {
      this.completeHarvest(entityId, playerId)
    }, resourceDef.baseHarvestTime)

    return true
  }

  private completeHarvest(entityId: string, playerId: string): void {
    const resource = this.resourceEntities.get(entityId)
    if (!resource || !resource.harvestInProgress) {
      return
    }

    const resourceDef = RESOURCE_DEFINITIONS[resource.resourceType]
    if (!resourceDef) {
      return
    }

    resource.harvestInProgress = false

    // Give rewards
    for (const drop of resourceDef.drops) {
      if (Math.random() < drop.chance) {
        const quantity = Math.floor(Math.random() * (drop.quantity.max - drop.quantity.min + 1)) + drop.quantity.min

        // Add items to player inventory
        const inventorySystem = this.world.systems.find(s => s.constructor.name === 'InventorySystem')
        if (inventorySystem && (inventorySystem as any).addItem) {
          ;(inventorySystem as any).addItem(playerId, drop.itemId, quantity)
        }

        // Give experience
        const skillsSystem = this.world.systems.find(s => s.constructor.name === 'EnhancedSkillsSystem')
        if (skillsSystem && (skillsSystem as any).addExperience) {
          ;(skillsSystem as any).addExperience(playerId, resourceDef.skill, drop.xp)
        }

        this.world.events.emit('resource:harvest_complete', {
          playerId,
          resourceId: entityId,
          resourceType: resource.resourceType,
          itemId: drop.itemId,
          quantity,
          xp: drop.xp,
          skill: resourceDef.skill,
        })
      }
    }

    // Handle depletion
    if (resourceDef.depletes) {
      this.depleteResource(resource)
    }
  }

  private depleteResource(resource: ResourceEntity): void {
    resource.depleted = true

    // Remove visual representation
    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (visualSystem && (visualSystem as any).removeMesh) {
      ;(visualSystem as any).removeMesh(resource.id)
    }

    // Schedule respawn
    const resourceDef = RESOURCE_DEFINITIONS[resource.resourceType]
    if (resourceDef && resourceDef.respawnTime > 0) {
      setTimeout(() => {
        this.respawnResource(resource)
      }, resourceDef.respawnTime)
    }
  }

  private respawnResource(resource: ResourceEntity): void {
    if (!resource.depleted) {
      return
    }

    resource.depleted = false
    resource.harvestInProgress = false
    resource.lastHarvestTime = 0

    // Recreate visual
    const resourceDef = RESOURCE_DEFINITIONS[resource.resourceType]
    if (resourceDef) {
      this.createResourceVisual(resource, resourceDef)
    }

    this.world.events.emit('resource:respawned', {
      resourceId: resource.id,
      resourceType: resource.resourceType,
      position: resource.position,
    })

    console.log(`[ResourceSpawningSystem] Respawned ${resourceDef?.name} at ${JSON.stringify(resource.position)}`)
  }

  public getResourcesInRange(centerX: number, centerZ: number, range: number): ResourceEntity[] {
    const resources: ResourceEntity[] = []

    for (const resource of this.resourceEntities.values()) {
      const dx = resource.position.x - centerX
      const dz = resource.position.z - centerZ
      const distance = Math.sqrt(dx * dx + dz * dz)

      if (distance <= range && !resource.depleted) {
        resources.push(resource)
      }
    }

    return resources
  }

  public getResourcesByType(resourceType: ResourceType): ResourceEntity[] {
    return Array.from(this.resourceEntities.values()).filter(
      resource => resource.resourceType === resourceType && !resource.depleted
    )
  }

  public getResourceInfo(entityId: string): { resource: ResourceEntity; definition: ResourceDefinition } | null {
    const resource = this.resourceEntities.get(entityId)
    if (!resource) {
      return null
    }

    const definition = RESOURCE_DEFINITIONS[resource.resourceType]
    if (!definition) {
      return null
    }

    return { resource, definition }
  }

  update(deltaTime: number): void {
    const now = Date.now()

    // Check for respawns periodically
    if (now - this.lastSpawnCheck > this.spawnCheckInterval) {
      this.checkForRespawns()
      this.lastSpawnCheck = now
    }
  }

  private checkForRespawns(): void {
    for (const spawner of this.resourceSpawners.values()) {
      if (!spawner.entity || spawner.entity.depleted) {
        // Check if enough time has passed for respawn
        if (!spawner.entity) {
          // No entity exists, spawn one
          this.spawnResource(spawner)
        }
      }
    }
  }

  // Debug methods
  public getSpawnerStats(): any {
    const stats: any = {}

    for (const resourceType of Object.values(ResourceType)) {
      stats[resourceType] = {
        spawners: 0,
        active: 0,
        depleted: 0,
      }
    }

    for (const spawner of this.resourceSpawners.values()) {
      stats[spawner.resourceType].spawners++

      if (spawner.entity) {
        if (spawner.entity.depleted) {
          stats[spawner.resourceType].depleted++
        } else {
          stats[spawner.resourceType].active++
        }
      }
    }

    return stats
  }

  public forceSpawnAllResources(): void {
    for (const spawner of this.resourceSpawners.values()) {
      if (!spawner.entity || spawner.entity.depleted) {
        this.spawnResource(spawner)
      }
    }
  }

  serialize(): any {
    const data: any = {
      resourceEntities: {},
      spawners: {},
    }

    for (const [id, resource] of this.resourceEntities) {
      data.resourceEntities[id] = {
        ...resource,
        components: undefined, // Don't serialize components
      }
    }

    for (const [id, spawner] of this.resourceSpawners) {
      data.spawners[id] = {
        ...spawner,
        entity: spawner.entity?.id, // Only store entity ID reference
      }
    }

    return data
  }

  deserialize(data: any): void {
    if (data.resourceEntities) {
      for (const [id, resourceData] of Object.entries(data.resourceEntities)) {
        const resource = resourceData as ResourceEntity
        this.resourceEntities.set(id, resource)
      }
    }

    if (data.spawners) {
      for (const [id, spawnerData] of Object.entries(data.spawners)) {
        const spawner = spawnerData as ResourceSpawner
        // Restore entity reference
        if ((spawner as any).entity && typeof (spawner as any).entity === 'string') {
          spawner.entity = this.resourceEntities.get((spawner as any).entity)
        }
        this.resourceSpawners.set(id, spawner)
      }
    }
  }
}
