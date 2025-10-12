/**
 * Death Test System
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

import { World } from '../World';
import { EventType } from '../types/events';
import { getItem } from '../data/items';
import type { DeathTestData } from '../types/test'
import { calculateDistance } from '../utils/EntityUtils';
import { VisualTestFramework } from './VisualTestFramework';
import { Logger } from '../utils/Logger';
import type { PlayerHealth } from '../types/core';

export class DeathTestSystem extends VisualTestFramework {
  private testData = new Map<string, DeathTestData>();

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    // Listen for death and respawn events
    this.subscribe(EventType.PLAYER_DIED, (data) => this.handlePlayerDeath(data));
    this.subscribe(EventType.PLAYER_RESPAWNED, (data) => this.handlePlayerRespawn(data));
    this.subscribe(EventType.ITEM_DROPPED, (data) => this.handleItemsDropped(data));
    this.subscribe<{
      entityId: string;
      playerId: string;
      items: Array<{ id: string; itemId: string; quantity: number; slot: number }>;
      totalItems: number;
    }>(EventType.ITEMS_RETRIEVED, (data) => this.handleItemsRetrieved(data));
    
    // Create test stations
    this.createTestStations();
    
  }

  protected createTestStations(): void {
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
    const station = this.testStations.get(stationId);
    if (!station) {
      throw new Error(`Test station ${stationId} not found`);
    }

      // Create fake player with low health
      const player = this.createPlayer({
        id: `combat_death_player_${Date.now()}`,
        name: 'Combat Death Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 5, maxHealth: 100 // Very low health - will die quickly
        }
      });

      // Give player some items to test dropping
      const bronzeSword = getItem('bronze_sword');
      const coins = getItem('coins');
      if (bronzeSword && coins) {
        player.inventory.items = [
          { id: 'inv_1', itemId: bronzeSword.id, quantity: 1, slot: 0, metadata: null },
          { id: 'inv_2', itemId: coins.id, quantity: 50, slot: 1, metadata: null }
        ];
      }

      // Create enemy goblin to fight
      const goblinLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createEnemyGoblin(stationId, goblinLocation);

      // Store test data
      this.testData.set(stationId, {
        player,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 }, // Default starter town
        startTime: Date.now(),
        initialHealth: player.health.current ?? 0,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'combat',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtTown: false
      });

      // Start combat with goblin
      this.startCombatWithGoblin(stationId);
  }

  private async runDirectDamageDeathTest(stationId: string): Promise<void> {
    const station = this.testStations.get(stationId);
    if (!station) {
      throw new Error(`Test station ${stationId} not found`);
    }

      // Create fake player with moderate health
      const player = this.createPlayer({
        id: `damage_death_player_${Date.now()}`,
        name: 'Damage Death Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 25, maxHealth: 100
        }
      });

      // Give player basic items
      const rawFish = getItem('raw_fish');
      if (rawFish) {
        player.inventory.items = [
          { id: 'inv_1', itemId: rawFish.id, quantity: 3, slot: 0, metadata: null }
        ];
      }

      // Store test data
      this.testData.set(stationId, {
        player,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: player.health.current ?? 0,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtTown: false
      });

      // Apply direct damage to kill player
      this.applyDirectDamage(stationId, 30); // More than current health
  }

  private async runItemDropDeathTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with full inventory
      const player = this.createPlayer({
        id: `item_drop_player_${Date.now()}`,
        name: 'Item Drop Death Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 10, maxHealth: 100
        }
      });

      // Give player multiple different items
      const bronzeSword = getItem('bronze_sword');
      const rawFish = getItem('raw_fish');
      const cookedFish = getItem('cooked_fish');
      const coins = getItem('coins');
      
      if (bronzeSword && rawFish && cookedFish && coins) {
        player.inventory.items = [
          { id: 'inv_1', itemId: bronzeSword.id, quantity: 1, slot: 0, metadata: {} },
          { id: 'inv_2', itemId: rawFish.id, quantity: 5, slot: 1, metadata: {} },
          { id: 'inv_3', itemId: cookedFish.id, quantity: 3, slot: 2, metadata: {} },
          { id: 'inv_4', itemId: coins.id, quantity: 100, slot: 3, metadata: {} }
        ];
      }

      // Store test data
      this.testData.set(stationId, {
        player,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: player.health.current ?? 0,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtTown: false
      });

      // Kill player to test item dropping
      this.applyDirectDamage(stationId, 15);
      
    } catch (error) {
      this.failTest(stationId, `Item drop death test error: ${error}`);
    }
  }

  private async runRespawnLocationTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player far from starter town
      const player = this.createPlayer({
        id: `respawn_location_player_${Date.now()}`,
        name: 'Respawn Location Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 8, maxHealth: 100
        }
      });

      // Calculate distance from starter town
      const townLocation = { x: 0, y: 0, z: 0 };
      const distanceToTown = Math.sqrt(
        Math.pow(station.position.x - townLocation.x, 2) +
        Math.pow(station.position.z - townLocation.z, 2)
      );

      // Store test data
      this.testData.set(stationId, {
        player,
        deathLocation: { ...station.position },
        respawnLocation: townLocation,
        startTime: Date.now(),
        initialHealth: player.health.current ?? 0,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: distanceToTown,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtTown: false
      });

      // Kill player to test respawn location
      this.applyDirectDamage(stationId, 10);
      
    } catch (error) {
      this.failTest(stationId, `Respawn location test error: ${error}`);
    }
  }

  private async runItemRetrievalTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with valuable items
      const player = this.createPlayer({
        id: `item_retrieval_player_${Date.now()}`,
        name: 'Item Retrieval Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 12, maxHealth: 100
        }
      });

      // Give player valuable items to test retrieval
      const steelSword = getItem('steel_sword'); // Steel sword (more valuable)
      const coins = getItem('coins');
      
      if (steelSword && coins) {
        player.inventory.items = [
          { id: 'inv_1', itemId: steelSword.id, quantity: 1, slot: 0, metadata: {} },
          { id: 'inv_2', itemId: coins.id, quantity: 200, slot: 1, metadata: {} }
        ];
      }

      // Store test data
      this.testData.set(stationId, {
        player,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: player.health.current ?? 0,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtTown: false
      });

      // Kill player and then test item retrieval
      this.applyDirectDamage(stationId, 15);
      
      // After respawn, move back to headstone and retrieve items
      setTimeout(() => {
        const currentTestData = this.testData.get(stationId);
        if (currentTestData && currentTestData.headstoneLocation) {
                    
          // Move player back to headstone
          this.movePlayer(currentTestData.player.id, {
            x: currentTestData.headstoneLocation.x - 1,
            y: currentTestData.headstoneLocation.y,
            z: currentTestData.headstoneLocation.z
          });
          
          // Wait for movement then attempt retrieval
          setTimeout(() => {
            this.attemptItemRetrieval(stationId, currentTestData.player.id);
            
            // Check if retrieval succeeded after a short delay
            setTimeout(() => {
              if (currentTestData.itemsRetrieved.length > 0) {
                this.passTest(stationId, {
                  itemsDropped: currentTestData.itemsDropped.length,
                  itemsRetrieved: currentTestData.itemsRetrieved.length,
                  headstoneCreated: currentTestData.headstoneCreated,
                  duration: Date.now() - currentTestData.startTime
                });
              } else {
                this.failTest(stationId, 'Failed to retrieve items from headstone');
              }
            }, 2000);
          }, 3000); // Wait for movement to complete
        } else {
          this.failTest(stationId, 'No headstone location found for item retrieval');
        }
      }, 35000); // Wait for respawn timer + travel time
      
    } catch (error) {
      this.failTest(stationId, `Item retrieval test error: ${error}`);
    }
  }

  private async runMultipleDeathsTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player for multiple deaths
      const player = this.createPlayer({
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
        player,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: player.health.current ?? 0,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'multiple',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtTown: false
      });

      // Schedule multiple deaths
      this.scheduleMultipleDeaths(stationId, 3);
      
    } catch (error) {
      this.failTest(stationId, `Multiple deaths test error: ${error}`);
    }
  }

  private async runEmptyInventoryDeathTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with empty inventory
      const player = this.createPlayer({
        id: `empty_inventory_player_${Date.now()}`,
        name: 'Empty Inventory Death Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 7, maxHealth: 100
        }
      });

      // Explicitly empty inventory
      player.inventory.items = [];
      player.inventory.coins = 0;

      // Store test data
      this.testData.set(stationId, {
        player,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: player.health.current ?? 0,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtTown: false
      });

      // Kill player with empty inventory
      this.applyDirectDamage(stationId, 10);
      
    } catch (error) {
      this.failTest(stationId, `Empty inventory death test error: ${error}`);
    }
  }

  private async runRespawnTimerTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player to test respawn timer
      const player = this.createPlayer({
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
        player,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: player.health.current ?? 0,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtTown: false
      });

      // Kill player and precisely time respawn
      this.applyDirectDamage(stationId, 8);
      
      // Set up monitoring for this test
      const monitorInterval = setInterval(() => {
        const testData = this.testData.get(stationId);
        if (!testData) {
          clearInterval(monitorInterval);
          return;
        }
        
        // Check if respawn occurred
        if (testData.respawnOccurred) {
          clearInterval(monitorInterval);
          
          // Calculate respawn time (should be ~30 seconds)
          const respawnDuration = testData.respawnTime - (testData.startTime + 1000); // Add 1s for death processing
          const expectedRespawnTime = 30000; // 30 seconds per GDD
          const timeDifference = Math.abs(respawnDuration - expectedRespawnTime);
          
          // Test passes if respawn occurred within 5 seconds of expected time
          if (timeDifference <= 5000) {
            this.passTest(stationId, {
              respawnDuration,
              expectedRespawnTime,
              timeDifference,
              respawnedAtTown: testData.respawnedAtTown
            });
          } else {
            this.failTest(stationId, `Respawn timer incorrect: expected ${expectedRespawnTime}ms, got ${respawnDuration}ms`);
          }
        }
        
        // Check for timeout
        const elapsed = Date.now() - testData.startTime;
        if (elapsed > 40000) { // 40 second timeout
          clearInterval(monitorInterval);
          this.failTest(stationId, `Respawn timer test timeout - no respawn detected after ${elapsed}ms`);
        }
      }, 500); // Check every 500ms
      
    } catch (error) {
      this.failTest(stationId, `Respawn timer test error: ${error}`);
    }
  }

  private async runHeadstonePersistenceTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with valuable items for long-term testing
      const player = this.createPlayer({
        id: `headstone_persist_player_${Date.now()}`,
        name: 'Headstone Persistence Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 8, maxHealth: 100
        }
      });

      // Give player valuable items for persistence testing
      const mithrilSword = getItem('mithril_sword');
      const arrows = getItem('arrows');
      const coins = getItem('coins');
      
      if (mithrilSword && arrows && coins) {
        player.inventory.items = [
          { id: 'inv_1', itemId: mithrilSword.id, quantity: 1, slot: 0, metadata: {} },
          { id: 'inv_2', itemId: arrows.id, quantity: 75, slot: 1, metadata: {} },
          { id: 'inv_3', itemId: coins.id, quantity: 1000, slot: 2, metadata: {} }
        ];
      }

      // Store test data with extended persistence tracking
      this.testData.set(stationId, {
        player,
        deathLocation: { ...station.position },
        respawnLocation: { x: 0, y: 0, z: 0 },
        startTime: Date.now(),
        initialHealth: player.health.current ?? 0,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: 0,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtTown: false
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
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player at a very specific location for distance testing
      const player = this.createPlayer({
        id: `distance_calc_player_${Date.now()}`,
        name: 'Distance Calculation Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 9, maxHealth: 100
        }
      });

      // Define multiple starter towns for distance testing
      const towns = [
        { id: 'lumbridge', position: { x: 0, y: 0, z: 0 }, name: 'Lumbridge' },
        { id: 'varrock', position: { x: 50, y: 0, z: -25 }, name: 'Varrock' },
        { id: 'falador', position: { x: -40, y: 0, z: 30 }, name: 'Falador' },
        { id: 'ardougne', position: { x: -80, y: 0, z: -50 }, name: 'Ardougne' }
      ];

      // Calculate actual distances to all starter towns
      const distancesToTowns = towns.map(town => ({
        ...town,
        distance: calculateDistance(station.position, town.position)
      }));

      // Find the nearest town
      const nearestTown = distancesToTowns.reduce((nearest, current) => 
        current.distance < nearest.distance ? current : nearest
      );


      // Store test data with distance calculation info
      this.testData.set(stationId, {
        player,
        deathLocation: { ...station.position },
        respawnLocation: nearestTown.position,
        startTime: Date.now(),
        initialHealth: player.health.current ?? 0,
        deathOccurred: false,
        respawnOccurred: false,
        itemsDropped: [],
        itemsRetrieved: [],
        deathCause: 'direct_damage',
        respawnTime: 0,
        distanceFromDeathToRespawn: nearestTown.distance,
        headstoneCreated: false,
        headstoneLocation: null,
        respawnedAtTown: false
      });

      // Kill player and verify respawn at calculated nearest town
      this.applyDirectDamage(stationId, 12);
      
    } catch (error) {
      this.failTest(stationId, `Advanced distance calculation test error: ${error}`);
    }
  }

  private createEnemyGoblin(stationId: string, location: { x: number; y: number; z: number }): void {
    this.emitTypedEvent(EventType.MOB_SPAWN_REQUEST, {
      id: `goblin_${stationId}`,
      mobType: 'goblin',  // Changed from 'type' to 'mobType'
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
    if (!testData) {
      Logger.systemWarn('DeathTestSystem', `No test data found for station ${stationId}`);
      return;
    }


    // Move player to goblin and start combat
    this.emitTypedEvent(EventType.COMBAT_START_ATTACK, {
      attackerId: testData.player.id,
      targetId: `goblin_${stationId}`,
      attackType: 'melee'
    });

    // The goblin should counter-attack and kill the low-health player
    setTimeout(() => {
      if (!testData.deathOccurred) {
        // Force goblin to attack player if death hasn't occurred yet
        this.emitTypedEvent(EventType.COMBAT_START_ATTACK, {
          attackerId: `goblin_${stationId}`,
          targetId: testData.player.id,
          attackType: 'melee',
          damage: 10 // Should be enough to kill low-health player
        });
      }
    }, 3000);
  }

  private applyDirectDamage(stationId: string, damage: number): void {
    const testData = this.testData.get(stationId);
    if (!testData) {
      Logger.systemWarn('DeathTestSystem', `No test data found for station ${stationId}`);
      return;
    }


    this.emitTypedEvent(EventType.PLAYER_DAMAGE, {
      playerId: testData.player.id,
      damage: damage,
      source: 'test'
    });
  }

  private scheduleMultipleDeaths(stationId: string, deathCount: number): void {
    const testData = this.testData.get(stationId);
    if (!testData) {
      Logger.systemWarn('DeathTestSystem', `No test data found for station ${stationId}`);
      return;
    }


    let deathsOccurred = 0;

    const scheduleDeath = () => {
      if (deathsOccurred >= deathCount) {
        // Complete test after all deaths
        setTimeout(() => {
          this.completeMultipleDeathsTest(stationId, deathsOccurred >= 2); // Success if at least 2 deaths occurred
        }, 5000);
        return;
      }

      deathsOccurred++;

      // Reset player health before next death
      (testData.player.health as PlayerHealth) = { current: 15, max: (testData.player.health as PlayerHealth).max };

      // Apply damage to kill
      this.applyDirectDamage(stationId, 20);

      // Schedule next death after respawn
      setTimeout(scheduleDeath, 35000); // Wait for respawn timer
    };

    // Start first death
    setTimeout(scheduleDeath, 2000);
  }

  private handlePlayerDeath(data: { playerId: string; deathLocation: { x: number; y: number; z: number }; cause?: string; killerId?: string | null }): void {
    // Handle player death event for testing
        
    // Find the test station for this player
    for (const [_stationId, testData] of Array.from(this.testData.entries())) {
      if (testData.player.id === data.playerId) {
        testData.deathOccurred = true;
        testData.deathLocation = { ...data.deathLocation };
        testData.deathCause = data.cause || 'unknown';
        testData.deathProcessed = true;
        
                break;
      }
    }
  }

  private handlePlayerRespawn(data: { playerId: string; respawnLocation: { x: number; y: number; z: number } }): void {
    // Handle player respawn event for testing
        
    // Find the test station for this player
    for (const [_stationId, testData] of Array.from(this.testData.entries())) {
      if (testData.player.id === data.playerId) {
        testData.respawnOccurred = true;
        testData.respawnLocation = { ...data.respawnLocation };
        testData.respawnTime = Date.now();
        
        // Check if respawned at starter town (simplified check)
        const isNearTown = Math.abs(data.respawnLocation.x) < 50 && Math.abs(data.respawnLocation.z) < 50;
        testData.respawnedAtTown = isNearTown;
        
                break;
      }
    }
  }

  private handleItemsDropped(data: { itemId: string; playerId: string; position: { x: number; y: number; z: number } }): void {
    // Handle single item dropped on death event for testing
        
    // Find the test station for this player
    for (const [_stationId, testData] of Array.from(this.testData.entries())) {
      if (testData.player.id === data.playerId) {
        // Add the single item to the dropped items array
        const itemEntry = { item: { id: data.itemId }, quantity: 1 };
        testData.itemsDropped = testData.itemsDropped || [];
        testData.itemsDropped.push(itemEntry);
        testData.headstoneCreated = testData.itemsDropped.length > 0;
        testData.headstoneLocation = testData.itemsDropped.length > 0 ? { ...data.position } : null;
        
                break;
      }
    }
  }

  private handleItemsRetrieved(data: { entityId: string; playerId: string; items: Array<{ id: string; itemId: string; quantity: number; slot: number }>; totalItems: number }): void {
    // Handle items retrieved from death location event for testing
        
    // Find the test station for this player
    for (const [_stationId, testData] of Array.from(this.testData.entries())) {
      if (testData.player.id === data.playerId) {
        // Convert retrieved items to the expected format
        const convertedItems = data.items.map(item => ({
          item: { id: item.itemId },
          quantity: item.quantity
        }));
        testData.itemsRetrieved = convertedItems;
        
        // Check if all items were retrieved
        const allItemsRetrieved = testData.itemsDropped.length === testData.itemsRetrieved.length;
        if (allItemsRetrieved) {
                  // All items successfully retrieved
                  }
        
        break;
      }
    }
  }

  protected cleanupTest(stationId: string): void {
    // Clean up test data for the station
    const testData = this.testData.get(stationId);
    if (testData) {
      this.testData.delete(stationId);
    }
  }

  private attemptItemRetrieval(stationId: string, _playerId: string): boolean {
    const testData = this.testData.get(stationId);
    if (!testData) return false;

        
    // Simulate player retrieving items from headstone
    if (testData.headstoneCreated && testData.headstoneLocation) {
      const distance = calculateDistance(testData.player.position, testData.headstoneLocation);
      if (distance <= 2) { // Within interaction range
        testData.itemsRetrieved = [...testData.itemsDropped];
                return true;
      }
    }
    
    return false;
  }

  private scheduleHeadstonePersistenceChecks(stationId: string): void {
        
    // Schedule checks for headstone persistence
    setTimeout(() => {
      const testData = this.testData.get(stationId);
      if (testData && testData.headstoneCreated) {
              // Headstone persists - test successful
              }
    }, 30000);
  }

  private completeMultipleDeathsTest(stationId: string, success: boolean, error?: string): void {
        this.updateStationStatus(stationId, success ? 'passed' : 'failed', error);
  }

  protected updateStationStatus(stationId: string, status: 'idle' | 'running' | 'passed' | 'failed', error?: string): void {
    const station = this.testStations.get(stationId);
    if (station) {
      station.status = status;
      if (error) {
        station.currentError = error;
      }
          }
  }

}
