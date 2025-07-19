import { 
  RPGWorldSystem, 
  RPGZone, 
  RPGPosition, 
  RPGPlayer, 
  RPGMob, 
  RPGLandmark,
  BiomeType,
  ZoneDifficulty,
  RPGSpawnPoint,
  RPGResourceNode,
  RPGSkill,
  RPG_CONSTANTS
} from '../types/index.js'

export class RPGWorldSystemImpl implements RPGWorldSystem {
  name = 'WorldSystem'
  
  private worldState: any // Will be injected by the world
  private zones: Map<string, RPGZone> = new Map()
  private nextZoneId = 1

  constructor(worldState: any) {
    this.worldState = worldState
  }

  async init(): Promise<void> {
    // Initialize the world zones
    this.createStarterZones()
    this.createBeginnerZones()
    this.createIntermediateZones()
    this.createAdvancedZones()
    
    console.log('[WorldSystem] Initialized with', this.zones.size, 'zones')
  }

  update(deltaTime: number): void {
    // World system handles static world state
    // Dynamic elements are handled by other systems
  }

  async cleanup(): Promise<void> {
    this.zones.clear()
    console.log('[WorldSystem] Cleaned up')
  }

  getZoneAt(position: RPGPosition): RPGZone | null {
    // Find the zone that contains this position
    for (const zone of this.zones.values()) {
      if (this.isPositionInZone(position, zone)) {
        return zone
      }
    }
    return null
  }

  getMobsInZone(zoneId: string): RPGMob[] {
    const zone = this.zones.get(zoneId)
    if (!zone) return []

    const mobs: RPGMob[] = []
    
    // Get all mobs and filter by zone
    for (const mob of this.worldState.mobs?.values() || []) {
      if (this.isPositionInZone(mob.position, zone)) {
        mobs.push(mob)
      }
    }

    return mobs
  }

  getPlayersInZone(zoneId: string): RPGPlayer[] {
    const zone = this.zones.get(zoneId)
    if (!zone) return []

    const players: RPGPlayer[] = []
    
    // Get all players and filter by zone
    for (const player of this.worldState.players?.values() || []) {
      if (this.isPositionInZone(player.position, zone)) {
        players.push(player)
      }
    }

    return players
  }

  isPositionSafe(position: RPGPosition): boolean {
    const zone = this.getZoneAt(position)
    return zone ? zone.safeZone : false
  }

  findNearestTown(position: RPGPosition): RPGLandmark | null {
    let nearestTown: RPGLandmark | null = null
    let nearestDistance = Infinity

    // Search all zones for towns
    for (const zone of this.zones.values()) {
      for (const landmark of zone.landmarks) {
        if (landmark.type === 'town') {
          const distance = this.calculateDistance(position, landmark.position)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestTown = landmark
          }
        }
      }
    }

    return nearestTown
  }

  // Zone creation methods

  private createStarterZones(): void {
    // Mistwood Valley - Starting region
    const mistwood = this.createZone(
      'mistwood_valley',
      'Mistwood Valley',
      BiomeType.MISTWOOD_VALLEY,
      ZoneDifficulty.STARTER,
      { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
      true
    )

    // Add starter towns
    mistwood.landmarks.push(
      this.createLandmark('brookhaven', 'Brookhaven', 'A peaceful town by a babbling brook', 
        { x: -30, y: 0, z: -30 }, 'town', ['bank', 'shop', 'spawn']),
      this.createLandmark('millharbor', 'Millharbor', 'Built around an ancient watermill', 
        { x: 30, y: 0, z: -30 }, 'town', ['bank', 'shop', 'spawn']),
      this.createLandmark('crosshill', 'Crosshill', 'Where old trade routes meet', 
        { x: 0, y: 0, z: 30 }, 'town', ['bank', 'shop', 'spawn'])
    )

    // Add landmarks
    mistwood.landmarks.push(
      this.createLandmark('old_oak', 'The Old Oak', 'A massive tree where adventurers gather', 
        { x: 0, y: 0, z: 0 }, 'monument'),
      this.createLandmark('stone_circle', 'Stone Circle of Beginning', 'Ancient standing stones', 
        { x: -20, y: 0, z: 20 }, 'monument'),
      this.createLandmark('abandoned_farmstead', 'The Abandoned Farmstead', 'Overrun by goblins', 
        { x: 40, y: 0, z: 40 }, 'ruins')
    )

    // Add resource nodes
    mistwood.resources.push(
      this.createResourceNode('tree_1', 'tree', { x: -10, y: 0, z: -10 }, 'logs', 'bronze_hatchet', 1, RPGSkill.WOODCUTTING),
      this.createResourceNode('tree_2', 'tree', { x: 10, y: 0, z: -10 }, 'logs', 'bronze_hatchet', 1, RPGSkill.WOODCUTTING),
      this.createResourceNode('fishing_1', 'fishing_spot', { x: -30, y: 0, z: -25 }, 'raw_shrimps', 'fishing_rod', 1, RPGSkill.FISHING),
      this.createResourceNode('fishing_2', 'fishing_spot', { x: 30, y: 0, z: -25 }, 'raw_shrimps', 'fishing_rod', 1, RPGSkill.FISHING)
    )

    this.zones.set(mistwood.id, mistwood)
  }

  private createBeginnerZones(): void {
    // Goblin Wastes
    const goblinWastes = this.createZone(
      'goblin_wastes',
      'Goblin Wastes',
      BiomeType.GOBLIN_WASTES,
      ZoneDifficulty.BEGINNER,
      { minX: 50, maxX: 150, minZ: -50, maxZ: 50 },
      false
    )

    // Add landmarks
    goblinWastes.landmarks.push(
      this.createLandmark('goblin_hill', 'Goblin Hill', 'A large mound where goblins gather', 
        { x: 100, y: 5, z: 0 }, 'camp'),
      this.createLandmark('ruined_tower', 'The Ruined Tower', 'An old watchtower, now a hobgoblin stronghold', 
        { x: 120, y: 10, z: 30 }, 'ruins'),
      this.createLandmark('bonepile_monument', 'Bonepile Monument', 'Where goblins display their trophies', 
        { x: 80, y: 0, z: -20 }, 'monument')
    )

    // Add goblin spawn points
    goblinWastes.spawns.push(
      this.createSpawnPoint('goblin_spawn_1', 'goblin', { x: 70, y: 0, z: 10 }, 30000, 3),
      this.createSpawnPoint('goblin_spawn_2', 'goblin', { x: 90, y: 0, z: -10 }, 30000, 3),
      this.createSpawnPoint('hobgoblin_spawn_1', 'hobgoblin', { x: 120, y: 0, z: 30 }, 45000, 2)
    )

    this.zones.set(goblinWastes.id, goblinWastes)

    // Darkwood Forest
    const darkwood = this.createZone(
      'darkwood_forest',
      'Darkwood Forest',
      BiomeType.DARKWOOD_FOREST,
      ZoneDifficulty.BEGINNER,
      { minX: -150, maxX: -50, minZ: -50, maxZ: 50 },
      false
    )

    // Add landmarks
    darkwood.landmarks.push(
      this.createLandmark('hanged_tree', 'The Hanged Man\'s Tree', 'Where the bandit chief displays warnings', 
        { x: -100, y: 0, z: 0 }, 'structure'),
      this.createLandmark('ranger_monument', 'Old Ranger Monument', 'A stone statue of a forgotten hero', 
        { x: -80, y: 0, z: 30 }, 'monument'),
      this.createLandmark('hollow_stump', 'The Hollow Stump', 'A massive tree stump, bandit meeting spot', 
        { x: -120, y: 0, z: -30 }, 'structure')
    )

    // Add bandit spawn points
    darkwood.spawns.push(
      this.createSpawnPoint('bandit_spawn_1', 'bandit', { x: -80, y: 0, z: 10 }, 30000, 2),
      this.createSpawnPoint('bandit_spawn_2', 'bandit', { x: -110, y: 0, z: -10 }, 30000, 2),
      this.createSpawnPoint('barbarian_spawn_1', 'barbarian', { x: -130, y: 0, z: 20 }, 40000, 2)
    )

    this.zones.set(darkwood.id, darkwood)
  }

  private createIntermediateZones(): void {
    // Northern Reaches
    const northernReaches = this.createZone(
      'northern_reaches',
      'Northern Reaches',
      BiomeType.NORTHERN_REACHES,
      ZoneDifficulty.INTERMEDIATE,
      { minX: -50, maxX: 50, minZ: 50, maxZ: 150 },
      false
    )

    // Add landmarks
    northernReaches.landmarks.push(
      this.createLandmark('frozen_throne', 'The Frozen Throne', 'A massive ice-covered stone chair', 
        { x: 0, y: 15, z: 100 }, 'monument'),
      this.createLandmark('warriors_gate', 'Warrior\'s Gate', 'Twin pillars marking the old kingdom\'s border', 
        { x: -20, y: 0, z: 80 }, 'structure'),
      this.createLandmark('valorhall_ruins', 'Valorhall Ruins', 'Broken walls where barbarians make camp', 
        { x: 30, y: 0, z: 120 }, 'ruins')
    )

    // Add spawn points
    northernReaches.spawns.push(
      this.createSpawnPoint('guard_spawn_1', 'guard', { x: -20, y: 0, z: 80 }, 45000, 2),
      this.createSpawnPoint('guard_spawn_2', 'guard', { x: 20, y: 0, z: 80 }, 45000, 2),
      this.createSpawnPoint('barbarian_spawn_2', 'barbarian', { x: 30, y: 0, z: 120 }, 40000, 3)
    )

    this.zones.set(northernReaches.id, northernReaches)

    // Iron Hills
    const ironHills = this.createZone(
      'iron_hills',
      'Iron Hills',
      BiomeType.IRON_HILLS,
      ZoneDifficulty.INTERMEDIATE,
      { minX: 50, maxX: 150, minZ: 50, maxZ: 150 },
      false
    )

    // Add landmarks
    ironHills.landmarks.push(
      this.createLandmark('mineshaft_entrance', 'The Abandoned Mineshaft Entrance', 'Boarded up but guards patrol nearby', 
        { x: 100, y: 0, z: 100 }, 'structure'),
      this.createLandmark('rust_monument', 'The Rust Monument', 'Iron statue corroded by time', 
        { x: 80, y: 0, z: 120 }, 'monument'),
      this.createLandmark('hammer_stone', 'The Hammer Stone', 'Rock shaped like a blacksmith\'s hammer', 
        { x: 120, y: 0, z: 80 }, 'monument')
    )

    // Add spawn points
    ironHills.spawns.push(
      this.createSpawnPoint('dark_warrior_spawn_1', 'dark_warrior', { x: 100, y: 0, z: 100 }, 60000, 2),
      this.createSpawnPoint('dark_warrior_spawn_2', 'dark_warrior', { x: 120, y: 0, z: 120 }, 60000, 2)
    )

    this.zones.set(ironHills.id, ironHills)
  }

  private createAdvancedZones(): void {
    // Blasted Lands
    const blastedLands = this.createZone(
      'blasted_lands',
      'Blasted Lands',
      BiomeType.BLASTED_LANDS,
      ZoneDifficulty.ADVANCED,
      { minX: -150, maxX: -50, minZ: 50, maxZ: 150 },
      false
    )

    // Add landmarks
    blastedLands.landmarks.push(
      this.createLandmark('black_citadel', 'The Black Citadel', 'A dark fortress where Black Knights gather', 
        { x: -100, y: 20, z: 100 }, 'structure'),
      this.createLandmark('ash_monument', 'The Ash Monument', 'A pillar of fused ash marking the Calamity\'s epicenter', 
        { x: -80, y: 0, z: 80 }, 'monument'),
      this.createLandmark('obsidian_spire', 'The Obsidian Spire', 'A twisted black tower reaching toward the sky', 
        { x: -120, y: 30, z: 120 }, 'structure')
    )

    // Add spawn points
    blastedLands.spawns.push(
      this.createSpawnPoint('black_knight_spawn_1', 'black_knight', { x: -100, y: 0, z: 100 }, 90000, 2),
      this.createSpawnPoint('dark_ranger_spawn_1', 'dark_ranger', { x: -120, y: 0, z: 120 }, 90000, 2)
    )

    this.zones.set(blastedLands.id, blastedLands)

    // Great Lakes (Advanced fishing area)
    const greatLakes = this.createZone(
      'great_lakes',
      'Great Lakes',
      BiomeType.GREAT_LAKES,
      ZoneDifficulty.ADVANCED,
      { minX: 50, maxX: 150, minZ: -150, maxZ: -50 },
      false
    )

    // Add landmarks
    greatLakes.landmarks.push(
      this.createLandmark('old_lighthouse', 'The Old Lighthouse', 'Still burning mysteriously', 
        { x: 100, y: 10, z: -100 }, 'structure'),
      this.createLandmark('sunken_statue', 'The Sunken Statue', 'A giant figure half-submerged', 
        { x: 80, y: -5, z: -80 }, 'monument'),
      this.createLandmark('twin_rocks', 'Twin Rocks', 'Two massive stones jutting from the water', 
        { x: 120, y: 0, z: -120 }, 'monument')
    )

    // Add high-level fishing spots
    greatLakes.resources.push(
      this.createResourceNode('fishing_advanced_1', 'fishing_spot', { x: 90, y: 0, z: -90 }, 'raw_salmon', 'fishing_rod', 30, RPGSkill.FISHING),
      this.createResourceNode('fishing_advanced_2', 'fishing_spot', { x: 110, y: 0, z: -110 }, 'raw_trout', 'fishing_rod', 20, RPGSkill.FISHING)
    )

    // Add spawn points
    greatLakes.spawns.push(
      this.createSpawnPoint('ice_warrior_spawn_1', 'ice_warrior', { x: 100, y: 0, z: -100 }, 120000, 1)
    )

    this.zones.set(greatLakes.id, greatLakes)
  }

  // Helper methods

  private createZone(
    id: string,
    name: string,
    biome: BiomeType,
    difficulty: ZoneDifficulty,
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    safeZone: boolean
  ): RPGZone {
    return {
      id,
      name,
      biome,
      difficulty,
      bounds,
      spawns: [],
      resources: [],
      landmarks: [],
      safeZone
    }
  }

  private createLandmark(
    id: string,
    name: string,
    description: string,
    position: RPGPosition,
    type: 'town' | 'monument' | 'ruins' | 'camp' | 'structure',
    services?: ('bank' | 'shop' | 'spawn')[]
  ): RPGLandmark {
    return {
      id,
      name,
      description,
      position,
      type,
      services
    }
  }

  private createSpawnPoint(
    id: string,
    mobType: string,
    position: RPGPosition,
    respawnTime: number,
    maxCount: number
  ): RPGSpawnPoint {
    return {
      id,
      mobType: mobType as any,
      position,
      respawnTime,
      maxCount,
      currentCount: 0,
      lastSpawn: new Date()
    }
  }

  private createResourceNode(
    id: string,
    type: 'tree' | 'fishing_spot',
    position: RPGPosition,
    itemId: string,
    requiredTool: string,
    requiredLevel: number,
    requiredSkill: RPGSkill
  ): RPGResourceNode {
    return {
      id,
      type,
      position,
      itemId,
      requiredTool,
      requiredLevel,
      requiredSkill,
      depleted: false,
      respawnTime: 60000 // 1 minute
    }
  }

  private isPositionInZone(position: RPGPosition, zone: RPGZone): boolean {
    return (
      position.x >= zone.bounds.minX &&
      position.x <= zone.bounds.maxX &&
      position.z >= zone.bounds.minZ &&
      position.z <= zone.bounds.maxZ
    )
  }

  private calculateDistance(pos1: RPGPosition, pos2: RPGPosition): number {
    const dx = pos1.x - pos2.x
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  // Public utility methods

  getAllZones(): RPGZone[] {
    return Array.from(this.zones.values())
  }

  getZoneById(zoneId: string): RPGZone | null {
    return this.zones.get(zoneId) || null
  }

  getZonesByDifficulty(difficulty: ZoneDifficulty): RPGZone[] {
    return Array.from(this.zones.values()).filter(zone => zone.difficulty === difficulty)
  }

  getZonesByBiome(biome: BiomeType): RPGZone[] {
    return Array.from(this.zones.values()).filter(zone => zone.biome === biome)
  }

  getStarterTowns(): RPGLandmark[] {
    const towns: RPGLandmark[] = []
    
    for (const zone of this.zones.values()) {
      if (zone.safeZone) {
        for (const landmark of zone.landmarks) {
          if (landmark.type === 'town' && landmark.services?.includes('spawn')) {
            towns.push(landmark)
          }
        }
      }
    }
    
    return towns
  }

  getRandomStarterTown(): RPGLandmark | null {
    const towns = this.getStarterTowns()
    if (towns.length === 0) return null
    
    return towns[Math.floor(Math.random() * towns.length)]
  }

  getSpawnPointsInZone(zoneId: string): RPGSpawnPoint[] {
    const zone = this.zones.get(zoneId)
    return zone ? zone.spawns : []
  }

  getResourcesInZone(zoneId: string): RPGResourceNode[] {
    const zone = this.zones.get(zoneId)
    return zone ? zone.resources : []
  }

  getLandmarksInZone(zoneId: string): RPGLandmark[] {
    const zone = this.zones.get(zoneId)
    return zone ? zone.landmarks : []
  }
}