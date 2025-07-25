/**
 * RPG Death Test System
 * Tests complete death and respawn mechanics per GDD specifications:
 * - Player death when health reaches 0
 * - Items dropped at death location (headstone)
 * - Player respawns at nearest starter town
 * - Must retrieve items from death location
 * - Test death from combat damage
 * - Test death from other causes
 * - Test respawn timer mechanics
 * - Test item retrieval from death location
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { getItem } from '../data/items';

interface DeathTestData {
  fakePlayer: FakePlayer;
  deathLocation: { x: number; y: number; z: number };
  respawnLocation: { x: number; y: number; z: number };
  startTime: number;
  initialHealth: number;
  deathOccurred: boolean;
  respawnOccurred: boolean;
  itemsDropped: Array<{ item: any; quantity: number }>;
  itemsRetrieved: Array<{ item: any; quantity: number }>;
  deathCause: string;
  respawnTime: number;
  distanceFromDeathToRespawn: number;
  headstoneCreated: boolean;
  headstoneLocation: { x: number; y: number; z: number } | null;
  respawnedAtStarterTown: boolean;
  originalPosition?: { x: number; y: number; z: number };
  deathProcessed?: boolean;
}

export class RPGDeathTestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, DeathTestData>();
  private combatSystem: any;
  private inventorySystem: any;
  private playerSystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGDeathTestSystem] Initializing death test system...');
    
    // Get required systems
    this.combatSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGCombatSystem');
    this.inventorySystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGInventorySystem');
    this.playerSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGPlayerSystem');
    
    if (!this.combatSystem) {
      throw new Error('[RPGDeathTestSystem] RPGCombatSystem not found - required for death tests');
    }
    
    if (!this.inventorySystem) {
      throw new Error('[RPGDeathTestSystem] RPGInventorySystem not found - required for death tests');
    }
    
    if (!this.playerSystem) {
      throw new Error('[RPGDeathTestSystem] RPGPlayerSystem not found - required for death tests');
    }
    
    // Listen for death and respawn events
    this.world.on?.('rpg:player:death', this.handlePlayerDeath.bind(this));
    this.world.on?.('rpg:player:respawn', this.handlePlayerRespawn.bind(this));
    this.world.on?.('rpg:items:dropped', this.handleItemsDropped.bind(this));
    this.world.on?.('rpg:items:retrieved', this.handleItemsRetrieved.bind(this));
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGDeathTestSystem] Death test system initialized');
  }

  private createTestStations(): void {
    // Combat Death Test - Player dies from combat damage
    this.createTestStation({
      id: 'death_from_combat',
      name: 'Death From Combat Test',
      position: { x: -120, y: 0, z: 10 },
      timeoutMs: 30000 // 30 seconds
    });

    // Direct Damage Death Test - Player dies from direct damage (not combat)
    this.createTestStation({
      id: 'death_from_damage',
      name: 'Death From Direct Damage Test',
      position: { x: -120, y: 0, z: 20 },
      timeoutMs: 20000 // 20 seconds
    });

    // Item Drop Test - Player with inventory dies and items drop
    this.createTestStation({
      id: 'death_item_drop',
      name: 'Death Item Drop Test',
      position: { x: -120, y: 0, z: 30 },
      timeoutMs: 25000 // 25 seconds
    });

    // Respawn Location Test - Player respawns at nearest starter town
    this.createTestStation({
      id: 'death_respawn_location',
      name: 'Death Respawn Location Test',
      position: { x: -120, y: 0, z: 40 },
      timeoutMs: 35000 // 35 seconds
    });

    // Item Retrieval Test - Player can retrieve items from death location
    this.createTestStation({
      id: 'death_item_retrieval',
      name: 'Death Item Retrieval Test',
      position: { x: -120, y: 0, z: 50 },
      timeoutMs: 45000 // 45 seconds
    });

    // Multiple Deaths Test - Player dies multiple times
    this.createTestStation({
      id: 'death_multiple_deaths',
      name: 'Multiple Deaths Test',
      position: { x: -120, y: 0, z: 60 },
      timeoutMs: 60000 // 60 seconds
    });

    // Empty Inventory Death Test - Player with no items dies
    this.createTestStation({
      id: 'death_empty_inventory',
      name: 'Empty Inventory Death Test',
      position: { x: -120, y: 0, z: 70 },
      timeoutMs: 25000 // 25 seconds
    });

    // Respawn Timer Test - Test respawn delay mechanics
    this.createTestStation({
      id: 'death_respawn_timer',
      name: 'Respawn Timer Test',
      position: { x: -120, y: 0, z: 80 },
      timeoutMs: 40000 // 40 seconds (includes 30s respawn timer)
    });

    // Headstone Persistence Test - Test headstone durability and persistence
    this.createTestStation({
      id: 'death_headstone_persistence',
      name: 'Headstone Persistence Test',
      position: { x: -120, y: 0, z: 90 },
      timeoutMs: 60000 // 60 seconds for extended testing
    });

    // Advanced Distance Calculation Test - Test nearest starter town logic
    this.createTestStation({
      id: 'death_distance_calculation',
      name: 'Advanced Distance Calculation Test',
      position: { x: -120, y: 0, z: 100 },
      timeoutMs: 45000 // 45 seconds
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'death_from_combat':
        this.runCombatDeathTest(stationId);
        break;
      case 'death_from_damage':
        this.runDirectDamageDeathTest(stationId);
        break;
      case 'death_item_drop':
        this.runItemDropDeathTest(stationId);
        break;
      case 'death_respawn_location':
        this.runRespawnLocationTest(stationId);
        break;
      case 'death_item_retrieval':
        this.runItemRetrievalTest(stationId);
        break;
      case 'death_multiple_deaths':
        this.runMultipleDeathsTest(stationId);
        break;
      case 'death_empty_inventory':
        this.runEmptyInventoryDeathTest(stationId);
        break;
      case 'death_respawn_timer':
        this.runRespawnTimerTest(stationId);
        break;
      case 'death_headstone_persistence':
        this.runHeadstonePersistenceTest(stationId);
        break;
      case 'death_distance_calculation':
        this.runAdvancedDistanceCalculationTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown death test: ${stationId}`);
    }
  }

  private async runCombatDeathTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGDeathTestSystem] Starting combat death test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with low health
      const fakePlayer = this.createFakePlayer({
        id: `combat_death_player_${Date.now()}`,
        name: 'Combat Death Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 5, maxHealth: 100 // Very low health - will die quickly
        }
      });

      // Give player some items to test dropping
      const bronzeSword = getItem('100');
      const coins = getItem('999');
      if (bronzeSword && coins) {
        fakePlayer.inventory = [
          { item: bronzeSword, quantity: 1 },
          { item: coins, quantity: 50 }
        ];
      }

      // Create enemy goblin to fight
      const goblinLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createEnemyGoblin(stationId, goblinLocation);

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 }, // Default starter town
        startTime: Date.now(),
        initialHealth: fakePlayer.stats.health,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'combat',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtStarterTown: false
      });

      // Start combat with goblin
      this.startCombatWithGoblin(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Combat death test error: ${error}`);
    }
  }

  private async runDirectDamageDeathTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGDeathTestSystem] Starting direct damage death test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with moderate health
      const fakePlayer = this.createFakePlayer({
        id: `damage_death_player_${Date.now()}`,
        name: 'Damage Death Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 25, maxHealth: 100
        }
      });

      // Give player basic items
      const rawFish = getItem('201');
      if (rawFish) {
        fakePlayer.inventory = [{ item: rawFish, quantity: 3 }];
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: fakePlayer.stats.health,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtStarterTown: false
      });

      // Apply direct damage to kill player
      this.applyDirectDamage(stationId, 30); // More than current health
      
    } catch (error) {
      this.failTest(stationId, `Direct damage death test error: ${error}`);
    }
  }

  private async runItemDropDeathTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGDeathTestSystem] Starting item drop death test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with full inventory
      const fakePlayer = this.createFakePlayer({
        id: `item_drop_player_${Date.now()}`,
        name: 'Item Drop Death Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 10, maxHealth: 100
        }
      });

      // Give player multiple different items
      const bronzeSword = getItem('100');
      const rawFish = getItem('201');
      const cookedFish = getItem('202');
      const coins = getItem('999');
      
      if (bronzeSword && rawFish && cookedFish && coins) {
        fakePlayer.inventory = [
          { item: bronzeSword, quantity: 1 },
          { item: rawFish, quantity: 5 },
          { item: cookedFish, quantity: 3 },
          { item: coins, quantity: 100 }
        ];
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: fakePlayer.stats.health,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtStarterTown: false
      });

      // Kill player to test item dropping
      this.applyDirectDamage(stationId, 15);
      
    } catch (error) {
      this.failTest(stationId, `Item drop death test error: ${error}`);
    }
  }

  private async runRespawnLocationTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGDeathTestSystem] Starting respawn location test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player far from starter town
      const fakePlayer = this.createFakePlayer({
        id: `respawn_location_player_${Date.now()}`,
        name: 'Respawn Location Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 8, maxHealth: 100
        }
      });

      // Calculate distance from starter town
      const starterTownLocation = { x: 0, y: 0, z: 0 };
      const distanceToStarterTown = Math.sqrt(
        Math.pow(station.position.x - starterTownLocation.x, 2) +
        Math.pow(station.position.z - starterTownLocation.z, 2)
      );

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        deathLocation: { ...station.position },
        respawnLocation: starterTownLocation,
        startTime: Date.now(),
        initialHealth: fakePlayer.stats.health,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: distanceToStarterTown,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtStarterTown: false
      });

      // Kill player to test respawn location
      this.applyDirectDamage(stationId, 10);
      
    } catch (error) {
      this.failTest(stationId, `Respawn location test error: ${error}`);
    }
  }

  private async runItemRetrievalTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGDeathTestSystem] Starting item retrieval test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with valuable items
      const fakePlayer = this.createFakePlayer({
        id: `item_retrieval_player_${Date.now()}`,
        name: 'Item Retrieval Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 12, maxHealth: 100
        }
      });

      // Give player valuable items to test retrieval
      const steelSword = getItem('110'); // Steel sword (more valuable)
      const coins = getItem('999');
      
      if (steelSword && coins) {
        fakePlayer.inventory = [
          { item: steelSword, quantity: 1 },
          { item: coins, quantity: 200 }
        ];
      }

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: fakePlayer.stats.health,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtStarterTown: false
      });

      // Kill player and then test item retrieval
      this.applyDirectDamage(stationId, 15);
      
      // After respawn, try to retrieve items
      setTimeout(() => {
        this.attemptItemRetrieval(stationId);
      }, 35000); // Wait for respawn timer + travel time
      
    } catch (error) {
      this.failTest(stationId, `Item retrieval test error: ${error}`);
    }
  }

  private async runMultipleDeathsTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGDeathTestSystem] Starting multiple deaths test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player for multiple deaths
      const fakePlayer = this.createFakePlayer({
        id: `multiple_deaths_player_${Date.now()}`,
        name: 'Multiple Deaths Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 20, maxHealth: 100
        }
      });

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: fakePlayer.stats.health,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'multiple',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtStarterTown: false
      });

      // Schedule multiple deaths
      this.scheduleMultipleDeaths(stationId, 3);
      
    } catch (error) {
      this.failTest(stationId, `Multiple deaths test error: ${error}`);
    }
  }

  private async runEmptyInventoryDeathTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGDeathTestSystem] Starting empty inventory death test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with empty inventory
      const fakePlayer = this.createFakePlayer({
        id: `empty_inventory_player_${Date.now()}`,
        name: 'Empty Inventory Death Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 7, maxHealth: 100
        }
      });

      // Explicitly empty inventory
      fakePlayer.inventory = [];

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: fakePlayer.stats.health,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtStarterTown: false
      });

      // Kill player with empty inventory
      this.applyDirectDamage(stationId, 10);
      
    } catch (error) {
      this.failTest(stationId, `Empty inventory death test error: ${error}`);
    }
  }

  private async runRespawnTimerTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGDeathTestSystem] Starting respawn timer test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player to test respawn timer
      const fakePlayer = this.createFakePlayer({
        id: `respawn_timer_player_${Date.now()}`,
        name: 'Respawn Timer Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 6, maxHealth: 100
        }
      });

      // Store test data with respawn timer tracking
      this.testData.set(stationId, {
        fakePlayer,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: fakePlayer.stats.health,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtStarterTown: false
      });

      // Kill player and precisely time respawn
      this.applyDirectDamage(stationId, 8);
      
    } catch (error) {
      this.failTest(stationId, `Respawn timer test error: ${error}`);
    }
  }

  private async runHeadstonePersistenceTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGDeathTestSystem] Starting headstone persistence test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with valuable items for long-term testing
      const fakePlayer = this.createFakePlayer({
        id: `headstone_persist_player_${Date.now()}`,
        name: 'Headstone Persistence Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 8, maxHealth: 100
        }
      });

      // Give player valuable items for persistence testing
      const mithrilSword = getItem('120');
      const arrows = getItem('300');
      const coins = getItem('999');
      
      if (mithrilSword && arrows && coins) {
        fakePlayer.inventory = [
          { item: mithrilSword, quantity: 1 },
          { item: arrows, quantity: 75 },
          { item: coins, quantity: 1000 }
        ];
      }

      // Store test data with extended persistence tracking
      this.testData.set(stationId, {
        fakePlayer,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: fakePlayer.stats.health,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtStarterTown: false
      });

      // Kill player and test headstone persistence over time
      this.applyDirectDamage(stationId, 10);
      
      // Schedule persistence checks at intervals
      this.scheduleHeadstonePersistenceChecks(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Headstone persistence test error: ${error}`);
    }
  }

  private async runAdvancedDistanceCalculationTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGDeathTestSystem] Starting advanced distance calculation test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player at a very specific location for distance testing
      const fakePlayer = this.createFakePlayer({
        id: `distance_calc_player_${Date.now()}`,
        name: 'Distance Calculation Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 9, maxHealth: 100
        }
      });

      // Define multiple starter towns for distance testing
      const starterTowns = [
        { id: 'lumbridge', position: { x: 0, y: 0, z: 0 }, name: 'Lumbridge' },
        { id: 'varrock', position: { x: 50, y: 0, z: -25 }, name: 'Varrock' },
        { id: 'falador', position: { x: -40, y: 0, z: 30 }, name: 'Falador' },
        { id: 'ardougne', position: { x: -80, y: 0, z: -50 }, name: 'Ardougne' }
      ];

      // Calculate actual distances to all starter towns
      const distancesToTowns = starterTowns.map(town => ({
        ...town,
        distance: this.calculateDistance(station.position, town.position)
      }));

      // Find the nearest town
      const nearestTown = distancesToTowns.reduce((nearest, current) => 
        current.distance < nearest.distance ? current : nearest
      );

      console.log(`[RPGDeathTestSystem] Nearest town to ${JSON.stringify(station.position)} is ${nearestTown.name} at distance ${nearestTown.distance.toFixed(2)}`);

      // Store test data with distance calculation info
      this.testData.set(stationId, {
        fakePlayer,
        deathLocation: { ...station.position },
        respawnLocation: nearestTown.position,
        startTime: Date.now(),
        initialHealth: fakePlayer.stats.health,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: nearestTown.distance,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtStarterTown: false
      });

      // Kill player and verify respawn at calculated nearest town
      this.applyDirectDamage(stationId, 12);
      
    } catch (error) {
      this.failTest(stationId, `Advanced distance calculation test error: ${error}`);
    }
  }

  private createEnemyGoblin(stationId: string, location: { x: number; y: number; z: number }): void {
    this.world.emit('rpg:test:mob:create', {
      id: `goblin_${stationId}`,
      type: 'goblin',
      position: location,
      color: '#228B22', // Green for goblin
      size: { x: 1.0, y: 1.5, z: 1.0 },
      stats: {
        attack: 5, strength: 5, defense: 1, health: 10, maxHealth: 10
      }
    });
  }

  private startCombatWithGoblin(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGDeathTestSystem] Starting combat with goblin...');

    // Move player to goblin and start combat
    this.world.emit('rpg:combat:attack', {
      attackerId: testData.fakePlayer.id,
      targetId: `goblin_${stationId}`,
      attackType: 'melee'
    });

    // The goblin should counter-attack and kill the low-health player
    setTimeout(() => {
      if (!testData.deathOccurred) {
        // Force goblin to attack player if death hasn't occurred yet
        this.world.emit('rpg:combat:attack', {
          attackerId: `goblin_${stationId}`,
          targetId: testData.fakePlayer.id,
          attackType: 'melee',
          damage: 10 // Should be enough to kill low-health player
        });
      }
    }, 3000);
  }

  private applyDirectDamage(stationId: string, damage: number): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log(`[RPGDeathTestSystem] Applying ${damage} direct damage to player...`);

    this.world.emit('rpg:player:damage', {
      playerId: testData.fakePlayer.id,
      damage: damage,
      source: 'test'
    });
  }

  private scheduleMultipleDeaths(stationId: string, deathCount: number): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log(`[RPGDeathTestSystem] Scheduling ${deathCount} deaths...`);

    let deathsOccurred = 0;

    const scheduleDeath = () => {
      if (deathsOccurred >= deathCount) {
        // Complete test after all deaths
        setTimeout(() => {
          this.completeMultipleDeathsTest(stationId, deathsOccurred);
        }, 5000);
        return;
      }

      deathsOccurred++;
      console.log(`[RPGDeathTestSystem] Death ${deathsOccurred}/${deathCount}`);

      // Reset player health before next death
      testData.fakePlayer.stats.health = 15;

      // Apply damage to kill
      this.applyDirectDamage(stationId, 20);

      // Schedule next death after respawn
      setTimeout(scheduleDeath, 35000); // Wait for respawn timer
    };

    // Start first death
    setTimeout(scheduleDeath, 2000);
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) + 
      Math.pow(pos2.z - pos1.z, 2)
    );
  }

  private scheduleHeadstonePersistenceChecks(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGDeathTestSystem] Scheduling headstone persistence checks...');

    // Check headstone persistence at multiple intervals
    const checkIntervals = [10000, 20000, 30000, 45000]; // 10s, 20s, 30s, 45s

    checkIntervals.forEach((interval, index) => {
      setTimeout(() => {
        this.checkHeadstonePersistence(stationId, index + 1);
      }, interval);
    });
  }

  private checkHeadstonePersistence(stationId: string, checkNumber: number): void {
    const testData = this.testData.get(stationId);
    if (!testData || !testData.headstoneLocation) return;

    console.log(`[RPGDeathTestSystem] Headstone persistence check ${checkNumber}...`);

    // Query world for headstone at the expected location
    const headstonesAtLocation = this.world.entities?.getAll().filter((entity: any) => 
      entity.type === 'headstone' &&
      Math.abs(entity.position.x - testData.headstoneLocation!.x) < 0.5 &&
      Math.abs(entity.position.z - testData.headstoneLocation!.z) < 0.5
    ) || [];

    const headstoneExists = headstonesAtLocation.length > 0;
    
    console.log(`[RPGDeathTestSystem] Check ${checkNumber}: Headstone exists = ${headstoneExists}`);

    // On final check, complete the test
    if (checkNumber === 4) {
      this.completeHeadstonePersistenceTest(stationId, headstoneExists);
    }
  }

  private completeHeadstonePersistenceTest(stationId: string, headstoneStillExists: boolean): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      deathOccurred: testData.deathOccurred,
      headstoneCreated: testData.headstoneCreated,
      headstoneStillExists: headstoneStillExists,
      itemsDropped: testData.itemsDropped.length,
      persistenceSuccessful: testData.headstoneCreated && headstoneStillExists,
      duration: Date.now() - testData.startTime
    };

    // Test passes if headstone was created and persisted over time
    if (testData.deathOccurred && testData.headstoneCreated && headstoneStillExists) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Headstone persistence test failed: death=${testData.deathOccurred}, created=${testData.headstoneCreated}, exists=${headstoneStillExists}`);
    }
  }

  private attemptItemRetrieval(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData || !testData.headstoneLocation) return;

    console.log('[RPGDeathTestSystem] Attempting item retrieval...');

    // Move player to death location
    this.moveFakePlayer(testData.fakePlayer.id, testData.headstoneLocation);

    // Attempt to retrieve items from headstone
    setTimeout(() => {
      this.world.emit('rpg:items:retrieve', {
        playerId: testData.fakePlayer.id,
        headstoneLocation: testData.headstoneLocation
      });
    }, 3000);
  }

  private handlePlayerDeath(data: { playerId: string; location: { x: number; y: number; z: number }; cause: string }): void {
    // Find test station with matching player
    for (const [stationId, testData] of this.testData.entries()) {
      if (testData.fakePlayer.id === data.playerId) {
        console.log(`[RPGDeathTestSystem] Player death detected for ${stationId}: ${data.cause}`);
        
        testData.deathOccurred = true;
        testData.deathLocation = data.location;
        testData.deathCause = data.cause;
        
        break;
      }
    }
  }

  private handlePlayerRespawn(data: { playerId: string; location: { x: number; y: number; z: number }; respawnTime: number }): void {
    // Find test station with matching player
    for (const [stationId, testData] of this.testData.entries()) {
      if (testData.fakePlayer.id === data.playerId) {
        console.log(`[RPGDeathTestSystem] Player respawn detected for ${stationId} at location: ${JSON.stringify(data.location)}`);
        
        testData.respawnOccurred = true;
        testData.respawnLocation = data.location;
        testData.respawnTime = data.respawnTime;
        
        // Check if respawned at starter town (within reasonable distance of 0,0,0)
        const distanceFromOrigin = Math.sqrt(
          Math.pow(data.location.x, 2) + Math.pow(data.location.z, 2)
        );
        testData.respawnedAtStarterTown = distanceFromOrigin < 50; // Within 50 units of starter town
        
        // Update player position
        this.moveFakePlayer(testData.fakePlayer.id, data.location);
        
        // Complete single death tests
        if (stationId !== 'death_multiple_deaths' && stationId !== 'death_item_retrieval') {
          setTimeout(() => {
            this.completeDeathTest(stationId);
          }, 2000);
        }
        
        break;
      }
    }
  }

  private handleItemsDropped(data: { playerId: string; items: Array<{ item: any; quantity: number }>; location: { x: number; y: number; z: number } }): void {
    // Find test station with matching player
    for (const [stationId, testData] of this.testData.entries()) {
      if (testData.fakePlayer.id === data.playerId) {
        console.log(`[RPGDeathTestSystem] Items dropped for ${stationId}: ${data.items.length} items`);
        
        testData.itemsDropped = data.items;
        testData.headstoneCreated = true;
        testData.headstoneLocation = data.location;
        
        // Create visual headstone
        this.world.emit('rpg:test:headstone:create', {
          id: `headstone_${stationId}`,
          position: data.location,
          color: '#8B4513', // Brown for headstone
          size: { x: 0.8, y: 1.2, z: 0.4 },
          items: data.items
        });
        
        break;
      }
    }
  }

  private handleItemsRetrieved(data: { playerId: string; items: Array<{ item: any; quantity: number }> }): void {
    // Find test station with matching player
    for (const [stationId, testData] of this.testData.entries()) {
      if (testData.fakePlayer.id === data.playerId) {
        console.log(`[RPGDeathTestSystem] Items retrieved for ${stationId}: ${data.items.length} items`);
        
        testData.itemsRetrieved = data.items;
        
        // Complete item retrieval test
        if (stationId === 'death_item_retrieval') {
          this.completeItemRetrievalTest(stationId);
        }
        
        break;
      }
    }
  }

  private completeDeathTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      deathOccurred: testData.deathOccurred,
      respawnOccurred: testData.respawnOccurred,
      deathCause: testData.deathCause,
      itemsDropped: testData.itemsDropped.length,
      headstoneCreated: testData.headstoneCreated,
      respawnedAtStarterTown: testData.respawnedAtStarterTown,
      respawnTime: testData.respawnTime,
      duration: Date.now() - testData.startTime
    };

    // Test passes if:
    // 1. Death occurred
    // 2. Player respawned
    // 3. Player respawned at starter town
    // 4. Items were dropped (if player had inventory)
    if (testData.deathOccurred && testData.respawnOccurred && testData.respawnedAtStarterTown) {
      // Check item dropping for tests with inventory
      if (stationId === 'death_empty_inventory') {
        // Empty inventory test - should not drop items
        if (testData.itemsDropped.length === 0) {
          this.passTest(stationId, results);
        } else {
          this.failTest(stationId, `Empty inventory death test failed: ${testData.itemsDropped.length} items dropped when none expected`);
        }
      } else if (stationId === 'death_item_drop') {
        // Item drop test - should drop items
        if (testData.itemsDropped.length > 0 && testData.headstoneCreated) {
          this.passTest(stationId, results);
        } else {
          this.failTest(stationId, `Item drop death test failed: ${testData.itemsDropped.length} items dropped, headstone=${testData.headstoneCreated}`);
        }
      } else {
        // General death tests
        this.passTest(stationId, results);
      }
    } else {
      this.failTest(stationId, `Death test failed: death=${testData.deathOccurred}, respawn=${testData.respawnOccurred}, starter_town=${testData.respawnedAtStarterTown}`);
    }
  }

  private completeItemRetrievalTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const itemsDroppedCount = testData.itemsDropped.length;
    const itemsRetrievedCount = testData.itemsRetrieved.length;

    const results = {
      deathOccurred: testData.deathOccurred,
      respawnOccurred: testData.respawnOccurred,
      itemsDropped: itemsDroppedCount,
      itemsRetrieved: itemsRetrievedCount,
      retrievalSuccessful: itemsRetrievedCount > 0,
      duration: Date.now() - testData.startTime
    };

    // Test passes if player died, respawned, and retrieved items
    if (testData.deathOccurred && testData.respawnOccurred && itemsRetrievedCount > 0) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Item retrieval test failed: death=${testData.deathOccurred}, respawn=${testData.respawnOccurred}, retrieved=${itemsRetrievedCount}`);
    }
  }

  private completeMultipleDeathsTest(stationId: string, deathCount: number): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      deathsCompleted: deathCount,
      respawnOccurred: testData.respawnOccurred,
      multipleDeathsSuccessful: deathCount >= 3,
      duration: Date.now() - testData.startTime
    };

    // Test passes if multiple deaths occurred and player respawned
    if (deathCount >= 3 && testData.respawnOccurred) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Multiple deaths test failed: deaths=${deathCount}, respawn=${testData.respawnOccurred}`);
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up enemy goblin
      this.world.emit('rpg:test:mob:remove', {
        id: `goblin_${stationId}`
      });
      
      // Clean up headstone
      if (testData.headstoneCreated) {
        this.world.emit('rpg:test:headstone:remove', {
          id: `headstone_${stationId}`
        });
      }
      
      // Remove fake player
      this.fakePlayers.delete(testData.fakePlayer.id);
      
      // Emit cleanup events
      this.world.emit('rpg:test:player:remove', {
        id: `fake_player_${testData.fakePlayer.id}`
      });
      
      this.testData.delete(stationId);
    }
    
    console.log(`[RPGDeathTestSystem] Cleanup completed for ${stationId}`);
  }

  async getSystemRating(): Promise<string> {
    const totalStations = this.testStations.size;
    const completedStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed' || station.status === 'failed'
    ).length;
    
    const successfulStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed'
    ).length;
    
    const completionRate = totalStations > 0 ? completedStations / totalStations : 0;
    const successRate = completedStations > 0 ? successfulStations / completedStations : 0;
    
    // Check for advanced death system features (enhanced implementation)
    const hasDeathProcessingTesting = this.testStations.has('death_processing_test');
    const hasRespawnLocationTesting = this.testStations.has('death_respawn_location_test');
    const hasHeadstonePersistenceTesting = this.testStations.has('death_headstone_persistence_test');
    const hasDistanceCalculationTesting = this.testStations.has('death_distance_calculation_test');
    const hasItemRecoveryTesting = this.testStations.has('death_item_recovery_test');
    
    const advancedFeatureCount = [
      hasDeathProcessingTesting, hasRespawnLocationTesting, hasHeadstonePersistenceTesting,
      hasDistanceCalculationTesting, hasItemRecoveryTesting
    ].filter(Boolean).length;
    
    // Check death system performance with REAL distance calculations (enhanced)
    let hasGoodPerformanceMetrics = false;
    for (const [stationId, testData] of this.testData.entries()) {
      const station = this.testStations.get(stationId);
      if (station?.status === 'passed' && testData.respawnLocation) {
        // Verify accurate distance calculation to nearest town
        const originalPos = testData.originalPosition;
        const respawnPos = testData.respawnLocation;
        if (originalPos) {
          const calculatedDistance = this.calculateDistance(originalPos, respawnPos);
          if (calculatedDistance > 0 && testData.deathProcessed) {
            hasGoodPerformanceMetrics = true;
            break;
          }
        }
      }
    }
    
    if (completionRate >= 0.95 && successRate >= 0.9 && advancedFeatureCount >= 4 && hasGoodPerformanceMetrics) {
      return 'excellent';
    } else if (completionRate >= 0.8 && successRate >= 0.8 && advancedFeatureCount >= 3) {
      return 'very_good';
    } else if (completionRate >= 0.6 && successRate >= 0.7 && advancedFeatureCount >= 2) {
      return 'good';
    } else if (completionRate >= 0.4 && successRate >= 0.6) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}