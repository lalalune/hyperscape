/**
 * Visual Test Framework System
 * Provides infrastructure for visual testing of all gameplay systems
 * - Creates visible test stations around the world with floating names
 * - Manages test lifecycle (setup, execution, validation, cleanup, restart)
 * - Provides fake players, mobs, and items for testing
 * - Automatic timeout and error handling
 * - Visual status indicators and logging
 */

import THREE from '../extras/three'
import { waitForPhysX } from '../PhysXManager'
import type { InventoryItem, Item, PlayerEquipment, PlayerEquipmentItems, PlayerHealth, Skills, TestStation, TestResult } from '../types/core'
import type { PlayerEntity } from '../types/test'
import { calculateDistance } from '../utils/EntityUtils'
import { fixPositionIfAtGroundLevel } from '../utils/GroundPositioningUtils'
import { SystemBase } from './SystemBase';
import { EventType } from '../types/events';

// Using imported types from core instead of redefining them

// Shared fake player registry across all test framework instances
// Using a module-level constant instead of globals
const SHARED_FAKE_PLAYERS = new Map<string, PlayerEntity>()

import type { World } from '../types'
import { Logger } from '../utils/Logger'
import { getSystem } from '../utils/SystemUtils'
import { EntityManager } from './EntityManager'

export abstract class VisualTestFramework extends SystemBase {
  protected testStations = new Map<string, TestStation>()
  protected fakePlayers = SHARED_FAKE_PLAYERS // Use shared registry
  private updateInterval: NodeJS.Timeout | null = null
  private playerPositions = new Map<string, { x: number; y: number; z: number }>()
  private mobPositions = new Map<string, { x: number; y: number; z: number }>()
  private playerEquipment = new Map<string, Record<string, unknown>>()
  private playerStats = new Map<string, Record<string, unknown>>()
  private testColors = {
    idle: '#888888', // Gray
    running: '#ffaa00', // Orange
    passed: '#00ff00', // Green
    failed: '#ff0000', // Red
  }
  protected testStationsCreated = false
  
  // Console capture functionality for test systems
  protected consoleCaptures = new Map<string, string[]>()
  protected originalConsoleWarn: typeof console.warn
  protected originalConsoleError: typeof console.error

  constructor(world: World, config?: Partial<{ name: string; dependencies: { required: string[]; optional: string[] }; autoCleanup?: boolean }>) {
    super(world, {
      name: config?.name || 'visual-test-framework',
      dependencies: config?.dependencies || {
        required: [], // Test framework can work independently
        optional: [], // No dependencies needed for testing
      },
      autoCleanup: config?.autoCleanup ?? true
    })
    
    // Store original console methods for restoration
    this.originalConsoleWarn = console.warn
    this.originalConsoleError = console.error
  }

  /**
   * Optional method that subclasses can override to create their test stations
   * Called automatically during start() if implemented
   */
  protected createTestStations?(): void

  async init(): Promise<void> {
    // Wait for PhysX to be ready before creating fake players with physics components
    await waitForPhysX('VisualTestFramework', 30000) // 30 second timeout
            Logger.system('VisualTestFramework', 'PhysX is ready, proceeding with initialization')

    // Listen to position updates for reactive patterns
    this.subscribe(EventType.PLAYER_POSITION_UPDATED, (data: { playerId: string; position: { x: number; y: number; z: number } }) => {
      this.playerPositions.set(data.playerId, data.position)
    })
    this.subscribe(EventType.MOB_POSITION_UPDATED, (data: { mobId: string; position: { x: number; y: number; z: number } }) => {
      this.mobPositions.set(data.mobId, data.position)
    })

    // Listen to equipment changes for reactive patterns
    this.subscribe(EventType.PLAYER_EQUIPMENT_CHANGED, (data: { playerId: string; slot: string; itemId: string | null }) => {
      if (!this.playerEquipment.has(data.playerId)) {
        this.playerEquipment.set(data.playerId, {})
      }
      const equipment = this.playerEquipment.get(data.playerId)!
      equipment[data.slot] = data.itemId
    })

    // Listen to stats updates for reactive patterns
    this.subscribe(EventType.PLAYER_STATS_EQUIPMENT_UPDATED, (data: { playerId: string; stats: unknown }) => {
      this.playerStats.set(data.playerId, data.stats as Record<string, unknown>)
    })

    // Listen for equipment changes to keep fake player equipment up to date
    this.subscribe(EventType.EQUIPMENT_EQUIP, (data: { playerId: string; slot: string; itemId: string | null; item: Item | null }) => this.handleEquipmentChange(data))
    this.subscribe(EventType.EQUIPMENT_UNEQUIP, (data: { playerId: string; slot: string; itemId: string | null; item: Item | null }) => this.handleEquipmentChange(data))

    // Only run test station management on server
    if (!this.world.isServer) {
      return
    }

    // Listen for world events (server only)
    this.subscribe(EventType.TEST_STATION_CREATED, (station: TestStation) => this.onTestStationCreated(station))
    this.subscribe(EventType.TEST_RESULT, (data: { stationId: string; result: TestResult }) => this.onTestResult(data.stationId, data.result))
  }

  /**
   * Handle test station created event
   */
  private onTestStationCreated(station: TestStation): void {
    // Handle test station creation
    Logger.system(this.constructor.name, `Test station created: ${station.name}`);
  }

  /**
   * Handle test result event
   */
  private onTestResult(stationId: string, result: TestResult): void {
    // Handle test result
    const station = this.testStations.get(stationId);
    if (station) {
      // Update station status based on result
      station.status = result.passed ? 'passed' : 'failed';
      if (!result.passed && result.error) {
        station.currentError = result.error;
      }
      Logger.system(this.constructor.name, `Test result for ${stationId}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    }
  }

  start(): void {
    // Create test stations if child class has implemented createTestStations
    if (!this.testStationsCreated && this.createTestStations) {
                Logger.system(this.constructor.name, 'Creating test stations in start()')
      try {
        this.createTestStations()
        this.testStationsCreated = true
      } catch (error) {
                  Logger.systemError(this.constructor.name, 'Failed to create test stations', error instanceof Error ? error : new Error(String(error)))
      }
    }

    // Start test monitoring loop with optimized interval
    this.updateInterval = setInterval(() => {
      this.updateTestStations()
    }, 2000) // Update every 2 seconds for better performance

    // Auto-run all tests once on start to kick off visual verification
    // This runs a single pass and relies on per-station timeouts to avoid hangs
    // Intentionally delayed slightly to allow dependent systems to finish init
    setTimeout(() => {
      for (const station of this.testStations.values()) {
        try {
          // Only trigger if not already running
          if (station.status === 'idle') {
            // Subclasses implement runTest; startTest handles status and timeout
            void this.runTest(station.id)
          }
        } catch (error) {
          this.failTest(station.id, `Auto-run error: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }, 300);
  }

  /**
   * Creates a new test station at the specified position
   */
  protected createTestStation(config: {
    id: string
    name: string
    position: { x: number; y: number; z: number }
    timeoutMs?: number
  }): TestStation {
    // Fix position if it's at ground level (y=0) using proper terrain positioning
    const fixedPosition = fixPositionIfAtGroundLevel(this.world, config.position, 'player')

    const station: TestStation = {
      id: config.id,
      name: config.name,
      position: Object.freeze({
        x: fixedPosition.x,
        y: fixedPosition.y,
        z: fixedPosition.z,
      }),
      status: 'idle',
      lastRunTime: 0,
      totalRuns: 0,
      successCount: 0,
      failureCount: 0,
      currentError: '', // Always exists, empty when no error
      timeoutMs: config.timeoutMs || 30000, // 30 seconds default
      ui: null, // Visual elements are managed via events, not stored directly
      testZone: null, // Visual elements are managed via events, not stored directly  
      isStarting: false,
    }

    // Create visual indicators
    this.createStationVisuals(station)

    this.testStations.set(config.id, station)

    // Notify world
    this.emitTypedEvent(EventType.TEST_STATION_CREATED, { station: station as TestStation })

    return station
  }

  /**
   * Creates visual indicators for a test station
   */
  private createStationVisuals(station: TestStation): void {
    // Create floating name UI (emits events for visual creation)
    this.createFloatingNameUI(station)

    // Create colored zone indicator (emits events for visual creation)
    this.createTestZoneIndicator(station)

    this.updateStationVisuals(station)
  }

  /**
   * Creates floating name UI above test station
   */
  private createFloatingNameUI(
    station: TestStation
  ): { position: { x: number; y: number; z: number }; text: string; status: string } {
    // Create UI container for floating name
    const ui = {
      position: { ...station.position, y: station.position.y + 3 },
      text: station.name,
      status: station.status,
    }

    // Emit event for visual creation
    this.emitTypedEvent(EventType.UI_CREATE, {
      id: `test_ui_${station.id}`,
      type: 'floating_name',
      position: ui.position,
      text: ui.text,
      color: this.testColors[station.status],
    })

    return ui
  }

  /**
   * Creates a colored cube indicator on the ground
   */
  private createTestZoneIndicator(station: TestStation): {
    position: { x: number; y: number; z: number }
    color: string
    size: { x: number; y: number; z: number }
  } {
    const indicator = {
      position: { ...station.position, y: station.position.y + 0.5 },
      color: this.testColors[station.status],
      size: { x: 2, y: 1, z: 2 },
    }

    // Emit event for visual creation
    this.emitTypedEvent(EventType.UI_CREATE, {
      id: `test_zone_${station.id}`,
      position: indicator.position,
      color: indicator.color,
      size: indicator.size,
    })

    return indicator
  }

  /**
   * Updates visual indicators for a station
   */
  private updateStationVisuals(station: TestStation): void {
    const color = this.testColors[station.status]

    // Update floating name
    const statusText = this.getStatusText(station)
    this.emitTypedEvent(EventType.UI_UPDATE, {
      id: `test_ui_${station.id}`,
      text: `${station.name}\n${statusText}`,
      color: color,
    })

    // Update zone indicator
    this.emitTypedEvent(EventType.UI_UPDATE, {
      id: `test_zone_${station.id}`,
      color: color,
    })
  }

  /**
   * Gets status text for display
   */
  private getStatusText(station: TestStation): string {
    const successRate = station.totalRuns > 0 ? ((station.successCount / station.totalRuns) * 100).toFixed(1) : '0.0'

    let statusText = `${station.status.toUpperCase()}`
    statusText += `\nRuns: ${station.totalRuns} | Success: ${successRate}%`

    if (station.status === 'failed' && station.currentError) {
      statusText += `\nError: ${station.currentError.substring(0, 30)}...`
    }

    return statusText
  }

  /**
   * Extracts Skills from Player stats (which already includes SkillData objects)
   */
  private convertPlayerStatsToStats(playerSkills: Skills): Skills {
    return {
      attack: playerSkills.attack,
      strength: playerSkills.strength,
      defense: playerSkills.defense,
      ranged: playerSkills.ranged,
      constitution: playerSkills.constitution,
      woodcutting: playerSkills.woodcutting,
      fishing: playerSkills.fishing,
      firemaking: playerSkills.firemaking,
      cooking: playerSkills.cooking,
    }
  }

  /**
   * Creates a fake player for testing
   */
  protected createPlayer(config: {
    id: string
    name: string
    position: { x: number; y: number; z: number }
    stats?: Partial<{
      attack: number
      strength: number
      defense: number
      ranged: number
      constitution: number
      health: number
      maxHealth: number
      woodcutting: number
      fishing: number
      firemaking: number
      cooking: number
      stamina: number
      maxStamina: number
    }>
    initialInventory?: InventoryItem[]
  }): PlayerEntity {
    // Fix position if it's at ground level (y=0) using proper terrain positioning
    const fixedPosition = fixPositionIfAtGroundLevel(this.world, config.position, 'player')

    // Create base player using the proper type structure
    const rpgPlayerSkills: Skills = {
      // Combat Skills
      attack: { level: config.stats?.attack ?? 10, xp: 0 },
      strength: { level: config.stats?.strength ?? 10, xp: 0 },
      defense: { level: config.stats?.defense ?? 10, xp: 0 },
      ranged: { level: config.stats?.ranged ?? 10, xp: 0 },
      constitution: { level: config.stats?.constitution ?? 10, xp: 0 },
      // Gathering Skills
      woodcutting: { level: config.stats?.woodcutting ?? 1, xp: 0 },
      fishing: { level: config.stats?.fishing ?? 1, xp: 0 },
      firemaking: { level: config.stats?.firemaking ?? 1, xp: 0 },
      cooking: { level: config.stats?.cooking ?? 1, xp: 0 },
    };

    // Create base player entity
    const player = this.world.entities.add({
      id: config.id,
      type: 'player',
      name: config.name,
      position: [fixedPosition.x, fixedPosition.y, fixedPosition.z],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
      components: {
        physics: { enabled: false }
      }
    }) as PlayerEntity;
    
    // Add position getter for compatibility with CombatSystem
    Object.defineProperty(player, 'position', {
      get() {
        return player.node.position;
      },
      enumerable: true,
      configurable: true
    });
    
    // Add getPosition method for Entity compatibility
    (player as { getPosition?: () => { x: number; y: number; z: number } }).getPosition = () => ({
      x: player.node.position.x,
      y: player.node.position.y,
      z: player.node.position.z
    });
    
    // Set player health properties (using any to avoid intersection type conflict)
    (player as { health: PlayerHealth }).health = {
      current: config.stats?.health ?? 100,
      max: config.stats?.maxHealth ?? 100,
    };
    player.inventory = {
      items: [],
      capacity: 28,
      coins: 0,
    };
    player.equipment = {
      weapon: null,
      shield: null,
      helmet: null,
      body: null,
      legs: null,
      arrows: null,
    };

    // Store skills separately for systems to access
    (player as unknown as { rpgSkills: Skills }).rpgSkills = rpgPlayerSkills;

    // Add stats component to the actual player entity for getEntityStats compatibility
    const statsComponent = {
      // Combat skills using the playerSkills we created
      attack: rpgPlayerSkills.attack,
      strength: rpgPlayerSkills.strength,
      defense: rpgPlayerSkills.defense,
      constitution: rpgPlayerSkills.constitution,
      ranged: rpgPlayerSkills.ranged,
      // Non-combat skills
      woodcutting: rpgPlayerSkills.woodcutting,
      fishing: rpgPlayerSkills.fishing,
      firemaking: rpgPlayerSkills.firemaking,
      cooking: rpgPlayerSkills.cooking,
      // Additional stats
      combatLevel: Math.floor((rpgPlayerSkills.attack.level + rpgPlayerSkills.strength.level + rpgPlayerSkills.defense.level) / 3),
      totalLevel: 9,
      health: player.health.current,
      maxHealth: player.health.max,
      level: 1,
      // HP stats
      hitpoints: { level: 10, xp: 0, current: player.health.current, max: player.health.max },
      prayer: { level: 1, points: 1 },
      magic: { level: 1, xp: 0 }
    };
    
    player.addComponent('stats', statsComponent);

    // Initialize inventory with items from config if provided
    if (config.initialInventory && config.initialInventory.length > 0) {
      if (player.inventory) {
        player.inventory.items = [...config.initialInventory]
      }
    }

    // Create visual proxy (colored cube)
    this.createPlayerVisual(player)

    // Use the skills we already created above
    const playerSkills = rpgPlayerSkills;

    // Create a mock player entity for testing that doesn't require physics
    const mockPlayerEntity = {
      id: config.id,
      type: 'player',
      name: config.name,
      isPlayer: true,
      node: {
        position: new THREE.Vector3(player.node.position.x, player.node.position.y, player.node.position.z),
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      },
      stats: {
        health: player.health.current,
        maxHealth: player.health.max,
        score: 0,
        kills: 0,
        deaths: 0
      },
      addComponent: (name: string, data?: Record<string, unknown>) => {
        // Mock addComponent method for compatibility
        const componentData = data || {};
        (mockPlayerEntity as Record<string, unknown>)[name] = componentData;
        return componentData;
      },
      getComponent: (name: string) => {
        // Mock getComponent method for compatibility
        return (mockPlayerEntity as Record<string, unknown>)[name];
      }
    };

    // Add stats component to the mock entity
    mockPlayerEntity.addComponent('stats', {
      // Combat skills using the playerSkills we created
      attack: playerSkills.attack,
      strength: playerSkills.strength,
      defense: playerSkills.defense,
      constitution: playerSkills.constitution,
      ranged: playerSkills.ranged,
      // Non-combat skills
      woodcutting: playerSkills.woodcutting,
      fishing: playerSkills.fishing,
      firemaking: playerSkills.firemaking,
      cooking: playerSkills.cooking,
      // Additional stats
      combatLevel: Math.floor((playerSkills.attack.level + playerSkills.strength.level + playerSkills.defense.level) / 3),
      totalLevel: 9,
      health: player.health.current,
      maxHealth: player.health.max,
      level: 1,
      // HP stats
      hitpoints: { level: 10, xp: 0, current: player.health.current, max: player.health.max },
      prayer: { level: 1, points: 1 },
      magic: { level: 1, xp: 0 }
    });
    
    // The real player Entity was already added via world.entities.add above.
    // No need to insert the mock into entities maps.

          Logger.system(this.constructor.name, `Created mock test player ${config.id} with stats component`)
          Logger.system(this.constructor.name, `Player ${config.id} registered in players Map`)

    // CRITICAL: Register fake player with PlayerSystem for healing to work
    // Add a small delay to ensure the player is fully registered before emitting events
    setTimeout(() => {
      this.emitTypedEvent(EventType.PLAYER_JOINED, {
        playerId: config.id,
        isInitialConnection: true
      })
    }, 10)
    
    // Then emit PLAYER_REGISTERED for any other systems that need it
    this.emitTypedEvent(EventType.PLAYER_REGISTERED, {
      playerId: player.id,
    })

    // Register fake player with entity manager for combat system to find them
    const entityManager = this.world.getSystem<EntityManager>('entity-manager')
    if (!entityManager) {
      throw new Error(`Entity manager not found - fake player ${config.id} won't be found by combat system`)
    }
    
    // Note: entityManager needs to implement registerPlayer method
    // For now, we'll skip this registration until the method exists
            Logger.system(this.constructor.name, `Entity manager registration skipped for fake player ${config.id}`)

    // CRITICAL: Also register fake player with XP system for aggro system to work

    // Initialize fake player inventory
    this.emitTypedEvent(EventType.PLAYER_INIT, { playerId: config.id })
            Logger.system(this.constructor.name, `Triggered inventory initialization for fake player ${config.id}`)

    // Add any items that were set in the fake player's inventory using proper event system
    if (player.inventory && player.inventory.items && player.inventory.items.length > 0) {
      // Add each inventory item using the proper inventory event
      player.inventory.items.forEach(invSlot => {
        // Use inventory add event instead of direct method call
        this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
          playerId: config.id,
          item: {
            id: `${config.id}_${invSlot.itemId}_${Date.now()}`,
            itemId: invSlot.itemId,
            quantity: invSlot.quantity || 1,
            slot: invSlot.slot || 0,
            metadata: invSlot.metadata || null
          }
        })
      })
    }

    // Also initialize XP skills if stats were provided
    if (config.stats) {
      this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
        playerId: config.id,
        skills: playerSkills,
      })
    }

    // Stats are now properly set via the stats component on the entity

    this.fakePlayers.set(config.id, player)

    // Ensure systems are ready before registering fake players

    // Registration already emitted above with correct payload

    // Set skill levels if specified in fake player stats
    const skillLevels: Record<string, number> = {}
    const _stats = player.stats

    // Get the skills from the player
    const rpgSkills = (player as unknown as { rpgSkills: Skills }).rpgSkills;
    if (rpgSkills) {
      // Map fake player stats to skill levels
      if (rpgSkills.cooking.level > 1) skillLevels.cooking = rpgSkills.cooking.level
      if (rpgSkills.fishing.level > 1) skillLevels.fishing = rpgSkills.fishing.level
      if (rpgSkills.woodcutting.level > 1) skillLevels.woodcutting = rpgSkills.woodcutting.level
      if (rpgSkills.firemaking.level > 1) skillLevels.firemaking = rpgSkills.firemaking.level
      if (rpgSkills.attack.level > 1) skillLevels.attack = rpgSkills.attack.level
      if (rpgSkills.strength.level > 1) skillLevels.strength = rpgSkills.strength.level
      if (rpgSkills.defense.level > 1) skillLevels.defense = rpgSkills.defense.level
      if (rpgSkills.ranged.level > 1) skillLevels.ranged = rpgSkills.ranged.level
      if (rpgSkills.constitution.level > 10) skillLevels.constitution = rpgSkills.constitution.level
    }

    // Set skill levels if any were specified
    if (Object.keys(skillLevels).length > 0) {
      this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
        playerId: config.id,
        skills: skillLevels,
      })
    }

    // Emit initial position update for aggro system
    this.emitTypedEvent(EventType.PLAYER_POSITION_UPDATED, {
      playerId: config.id,
      position: { x: player.node.position.x, y: player.node.position.y, z: player.node.position.z },
    })

    // Emit initial equipment state for reactive pattern
    if (player.equipment) {
      for (const [slot, item] of Object.entries(player.equipment)) {
        if (item && typeof item === 'object' && 'id' in item) {
          this.emitTypedEvent(EventType.PLAYER_EQUIPMENT_CHANGED, {
            playerId: config.id,
            slot,
            itemId: (item as Item).id,
            item: item as Item
          })
        }
      }
    }

    // Emit initial stats for reactive pattern
    this.emitTypedEvent(EventType.PLAYER_STATS_EQUIPMENT_UPDATED, {
      playerId: config.id,
      stats: this.convertPlayerStatsToStats(playerSkills)
    })
    
    // Also add to world.entities.players for combat system compatibility
    this.world.entities.players.set(player.id, player);
    
    return player
  }

  /**
   * Creates visual representation of fake player
   * DISABLED: Visual cube proxies interfere with actual 3D models
   * Tests rely on real entity data, not visual cubes
   */
  private createPlayerVisual(_player: PlayerEntity): void {
    // DISABLED: Cube creation causes visual clutter
    // Tests work by checking entity data, positions, and scene hierarchy
    // Visual cubes are not necessary and interfere with real models
    
    // this.emitTypedEvent(EventType.PLAYER_CREATE, {
    //   id: `fake_player_${player.id}`,
    //   position: { x: player.node.position.x, y: player.node.position.y + 1, z: player.node.position.z },
    //   color: '#0088ff', // Blue for fake players
    //   size: { x: 0.8, y: 1.8, z: 0.8 },
    //   name: player.name,
    // })
  }

  /**
   * Moves a fake player to a new position
   */
  protected movePlayer(playerId: string, newPosition: { x: number; y: number; z: number }): void {
    const player = this.fakePlayers.get(playerId)
    if (!player) return

    // Fix position if it's at ground level (y=0) using proper terrain positioning
    const fixedPosition = fixPositionIfAtGroundLevel(this.world, newPosition, 'player')

    // Update position - since position is readonly, we need to update the reference
    Object.defineProperty(player, 'position', {
      value: Object.freeze({
        x: fixedPosition.x,
        y: fixedPosition.y,
        z: fixedPosition.z,
      }),
      writable: false,
      configurable: true
    })

    // Update the mock entity's node.position (THREE.Vector3)
    const mockEntity = this.world.entities.get(playerId);
    if (mockEntity && mockEntity.node && mockEntity.node.position) {
      mockEntity.node.position.set(fixedPosition.x, fixedPosition.y, fixedPosition.z);
    }

    // Update visual
    this.emitTypedEvent(EventType.PLAYER_POSITION_UPDATED, {
      playerId: playerId,
      position: { ...fixedPosition, y: fixedPosition.y + 1 },
    })

    // Emit position update event for aggro system
    this.emitTypedEvent(EventType.PLAYER_POSITION_UPDATED, {
      playerId: playerId,
      entityId: playerId,
      position: fixedPosition,
    })
  }

  /**
   * Starts a test for a specific station
   */
  protected startTest(stationId: string): void {
    const station = this.testStations.get(stationId)
    if (!station) return

    station.status = 'running'
    station.lastRunTime = Date.now()
    station.totalRuns++
    station.currentError = ''

    this.updateStationVisuals(station)

    // Set timeout with detailed failure reporting
    setTimeout(() => {
      if (station.status === 'running') {
        // FAIL FAST: Collect comprehensive state before failing
        const debugInfo = this.collectTimeoutDebugInfo(stationId)
        this.failTest(stationId, `Test timeout exceeded (${station.timeoutMs}ms) - ${debugInfo}`)
      }
    }, station.timeoutMs)
  }

  /**
   * Collects comprehensive debug information when a test times out
   * FAIL FAST: Provides detailed state to help identify root cause
   */
  private collectTimeoutDebugInfo(stationId: string): string {
    const station = this.testStations.get(stationId)
    if (!station) return 'station not found'

    const debugInfo: string[] = []

    try {
      // Basic station info
      debugInfo.push(`station=${station.name}`)
      debugInfo.push(`status=${station.status}`)
      debugInfo.push(`runs=${station.totalRuns}`)
      debugInfo.push(`success=${station.successCount}`)

      // Timing info
      const elapsed = Date.now() - station.lastRunTime
      debugInfo.push(`elapsed=${elapsed}ms`)
      debugInfo.push(`limit=${station.timeoutMs}ms`)

      // System availability - CRITICAL for debugging
      const systemChecks = [
        ['combat', getSystem(this.world, 'combat')],
        ['mob', getSystem(this.world, 'mob')],
        ['equipment', getSystem(this.world, 'equipment')],
        ['inventory', getSystem(this.world, 'inventory')],
        ['skills', getSystem(this.world, 'skills')],
        ['entity-manager', getSystem(this.world, 'entity-manager')],
      ]

      const missingSystems = systemChecks.filter(([_name, system]) => !system).map(([name]) => name)

      if (missingSystems.length > 0) {
        debugInfo.push(`missing_systems=[${missingSystems.join(',')}]`)
      }

      // Add system availability info from earlier checks
      debugInfo.push(`available_systems=${systemChecks.filter(([_name, system]) => system).length}/${systemChecks.length}`)
    } catch (error) {
      debugInfo.push(`debug_error=${error instanceof Error ? error.message : String(error)}`)
    }

    return debugInfo.join(' ')
  }

  /**
   * Marks a test as passed
   */
  protected passTest(stationId: string, _details?: Record<string, unknown>): void {
    const station = this.testStations.get(stationId)
    if (!station) return

    // CRITICAL FIX: Prevent multiple passTest calls for same test run
    // If already passed or failed, ignore duplicate calls
    if (station.status === 'passed' || station.status === 'failed') {
      return
    }

    station.status = 'passed'
    station.successCount++

    this.updateStationVisuals(station)

    const duration = Date.now() - station.lastRunTime

    // Emit result with proper TestResult structure
    const testResult: TestResult = {
      testName: station.name,
      systemName: this.constructor.name,
      passed: true,
      error: null,
      duration,
      timestamp: Date.now(),
      data: null // Details can be passed but TestResult expects specific test data types
    }
    
    this.emitTypedEvent(EventType.TEST_RESULT, {
      stationId,
      result: testResult,
    })

    // DISABLED: Automatic restart causes infinite loops
    // Tests should only restart when explicitly triggered
    // setTimeout(() => {
    //   this.restartTest(stationId)
    // }, 5000)
  }

  /**
   * Marks a test as failed
   */
  protected failTest(stationId: string, error: string): void {
    const station = this.testStations.get(stationId)
    if (!station) return

    // CRITICAL FIX: Prevent multiple failTest calls for same test run
    // If already passed or failed, ignore duplicate calls
    if (station.status === 'passed' || station.status === 'failed') {
      return
    }

    station.status = 'failed'
    station.failureCount++
    station.currentError = error

    this.updateStationVisuals(station)

    const duration = Date.now() - station.lastRunTime
          Logger.systemError('VisualTestFramework', `Test failed: ${station.name} - ${error} (${duration}ms)`)

    // Emit result with proper TestResult structure
    const testResult: TestResult = {
      testName: station.name,
      systemName: this.constructor.name,
      passed: false,
      error,
      duration,
      timestamp: Date.now(),
      data: null
    }
    
    this.emitTypedEvent(EventType.TEST_RESULT, {
      stationId,
      result: testResult,
    })

    // DISABLED: Automatic restart causes infinite loops
    // Tests should only restart when explicitly triggered
    // setTimeout(() => {
    //   this.restartTest(stationId)
    // }, 10000)
  }

  /**
   * Restarts a test
   */
  protected restartTest(stationId: string): void {
    const station = this.testStations.get(stationId)
    if (!station) return

    station.status = 'idle'
    station.currentError = ''

    this.updateStationVisuals(station)

    // Clean up any test state
    this.cleanupTest(stationId)

    // DISABLED: Automatic re-scheduling causes infinite loops
    // Tests should only run when explicitly triggered
    // this.scheduleTestRun(stationId, 2000)
  }

  /**
   * Updates all test stations
   */
  private updateTestStations(): void {
    for (const [stationId, station] of this.testStations) {
      // DISABLED: Auto-start causes infinite test loops and memory leaks
      // Tests should only run when explicitly triggered
      // if (station.status === 'idle') {
      //   this.scheduleTestRun(stationId, 0)
      // }

      // Check for hanging tests
      if (station.status === 'running') {
        const elapsed = Date.now() - station.lastRunTime
        if (elapsed > station.timeoutMs) {
          // FAIL FAST: Collect comprehensive state before failing
          const debugInfo = this.collectTimeoutDebugInfo(stationId)
          this.failTest(
            stationId,
            `Test timeout exceeded (${elapsed}ms elapsed, ${station.timeoutMs}ms limit) - ${debugInfo}`
          )
        }
      }
    }
  }

  private scheduleTestRun(stationId: string, delayMs: number): void {
    setTimeout(async () => {
      try {
        await this.runTest(stationId)
      } catch (error) {
        Logger.systemError('VisualTestFramework', `Error in runTest for ${stationId}`, error instanceof Error ? error : new Error(String(error)))
        this.failTest(stationId, `Test execution error: ${error}`)
      }
    }, delayMs)
  }

  /**
   * Abstract methods that must be implemented by test systems
   */
  protected abstract runTest(stationId: string): void | Promise<void>
  protected abstract cleanupTest(stationId: string): void

  /**
   * Utility methods for tests
   */
  protected async waitForCondition(
    condition: () => boolean,
    timeoutMs: number = 5000,
    checkIntervalMs: number = 100
  ): Promise<boolean> {
    return new Promise(resolve => {
      const startTime = Date.now()

      const check = () => {
        if (condition()) {
          resolve(true)
          return
        }

        if (Date.now() - startTime > timeoutMs) {
          resolve(false)
          return
        }

        setTimeout(check, checkIntervalMs)
      }

      check()
    })
  }

  /**
   * Helper method to create properly structured inventory slots
   * Converts legacy {item, quantity} format to correct {slot, itemId, quantity, item} format
   */
  protected createInventorySlot(slot: number, item: Item, quantity: number): InventoryItem {
    return {
      id: `${item.id}_${Date.now()}_${slot}`, // Unique instance ID
      itemId: item.id,
      quantity: quantity,
      slot: slot,
      metadata: {}, // Required field for InventoryItem
    }
  }

  protected getDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    return calculateDistance(pos1, pos2)
  }

  protected generateRandomPosition(
    center: { x: number; y: number; z: number },
    radius: number
  ): { x: number; y: number; z: number } {
    const angle = Math.random() * Math.PI * 2
    const distance = Math.random() * radius

    return {
      x: center.x + Math.cos(angle) * distance,
      y: center.y,
      z: center.z + Math.sin(angle) * distance,
    }
  }

  // Removed GET event handlers - now using reactive patterns with cached data

  // Handler for equipment changes to keep fake player equipment in sync
  private handleEquipmentChange(data: {
    playerId: string
    slot: string
    itemId: string | null
    item: Item | null
  }): void {
    const player = this.fakePlayers.get(data.playerId)
    if (!player) return

    // Update fake player's equipment to match the equipment system
    const equipmentSlot = data.slot as keyof PlayerEquipment
    if (data.itemId && data.item) {
      // Equipment added - store the item data
      if (!player.equipment) {
        player.equipment = {
          weapon: null,
          shield: null,
          helmet: null,
          body: null,
          legs: null,
          arrows: null
        };
      }
      (player.equipment as PlayerEquipmentItems)[equipmentSlot as keyof PlayerEquipmentItems] = data.item
    } else {
      // Equipment removed
      if (!player.equipment) {
        player.equipment = {
          weapon: null,
          shield: null,
          helmet: null,
          body: null,
          legs: null,
          arrows: null
        };
      }
      (player.equipment as PlayerEquipmentItems)[equipmentSlot as keyof PlayerEquipmentItems] = null
    }
  }



  destroy(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval)
    }

    // Clean up all test stations
    for (const stationId of this.testStations.keys()) {
      this.cleanupTest(stationId)
    }

    this.testStations.clear()
    this.fakePlayers.clear()
    
    // Restore original console methods
    console.warn = this.originalConsoleWarn
    console.error = this.originalConsoleError
    
    super.destroy()
  }

  // Required System lifecycle methods
  preTick(): void {
    // Base implementation - can be overridden by test systems
  }

  preFixedUpdate(): void {
    // Base implementation - can be overridden by test systems
  }

  fixedUpdate(_dt: number): void {
    // Base implementation - can be overridden by test systems
  }

  postFixedUpdate(): void {
    // Base implementation - can be overridden by test systems
  }

  preUpdate(): void {
    // Base implementation - can be overridden by test systems
  }

  update(_dt: number): void {
    // Base implementation - can be overridden by test systems
  }

  postUpdate(): void {
    // Base implementation - can be overridden by test systems
  }

  lateUpdate(): void {
    // Base implementation - can be overridden by test systems
  }

  postLateUpdate(): void {
    // Base implementation - can be overridden by test systems
  }

  /**
   * Start capturing console output for a specific test
   */
  protected startConsoleCapture(testId: string): void {
    this.consoleCaptures.set(testId, [])
  }

  /**
   * Get captured console output for a test
   */
  protected getConsoleCaptures(testId: string): string[] {
    return this.consoleCaptures.get(testId) || []
  }

  /**
   * Stop capturing console output for a test
   */
  protected stopConsoleCapture(testId: string): void {
    this.consoleCaptures.delete(testId)
  }



  commit(): void {
    // Base implementation - can be overridden by test systems
  }

  postTick(): void {
    // Base implementation - can be overridden by test systems
  }
}
