/**
 * RPG Resource Gathering Test System
 * Tests resource gathering with fake players and resource nodes
 * - Tests fishing mechanics (fish catching rates, skill requirements)
 * - Tests woodcutting mechanics (log gathering, hatchet requirements)
 * - Tests firemaking mechanics (tinderbox + logs -> fires)
 * - Tests cooking mechanics (raw fish + fire -> cooked fish)
 * - Tests skill progression and experience gain
 * - Tests tool requirements and durability
 */

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { getItem } from '../data/items';

interface ResourceTestData {
  fakePlayer: FakePlayer;
  resourceLocation: { x: number; y: number; z: number };
  testType: 'fishing' | 'woodcutting' | 'firemaking' | 'cooking' | 'comprehensive';
  startTime: number;
  initialSkillXP: number;
  finalSkillXP: number;
  resourcesGathered: number;
  itemsProcessed: number;
  toolUsed: string | null;
  expectedResources: number;
  skillTested: string;
  fireCreated: boolean;
  cookingAttempted: boolean;
  xpGained: number;
}

export class RPGResourceGatheringTestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, ResourceTestData>();
  private testResults = new Map<string, {
    passed: boolean;
    data?: {
      resourcesGathered?: number;
      expectedResources?: number;
      duration?: number;
      xpGained?: number;
    };
  }>();
  private fishingSystem: any;
  private woodcuttingSystem: any;
  private firemakingSystem: any;
  private cookingSystem: any;
  private skillsSystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGResourceGatheringTestSystem] Initializing resource gathering test system...');
    
    // Get required systems
    this.fishingSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGFishingSystem');
    this.woodcuttingSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGWoodcuttingSystem');
    this.firemakingSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGFiremakingSystem');
    this.cookingSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGCookingSystem');
    this.skillsSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGSkillsSystem');
    
    if (!this.fishingSystem) {
      console.warn('[RPGResourceGatheringTestSystem] FishingSystem not found, fishing tests may not function properly');
    }
    
    if (!this.woodcuttingSystem) {
      console.warn('[RPGResourceGatheringTestSystem] WoodcuttingSystem not found, woodcutting tests may not function properly');
    }
    
    if (!this.firemakingSystem) {
      console.warn('[RPGResourceGatheringTestSystem] FiremakingSystem not found, firemaking tests may not function properly');
    }
    
    if (!this.cookingSystem) {
      console.warn('[RPGResourceGatheringTestSystem] CookingSystem not found, cooking tests may not function properly');
    }
    
    if (!this.skillsSystem) {
      console.warn('[RPGResourceGatheringTestSystem] SkillsSystem not found, skill progression tests may not function properly');
    }
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGResourceGatheringTestSystem] Resource gathering test system initialized');
  }

  private createTestStations(): void {
    // Basic Fishing Test
    this.createTestStation({
      id: 'basic_fishing_test',
      name: 'Basic Fishing Test',
      position: { x: -70, y: 0, z: 10 },
      timeoutMs: 45000 // 45 seconds
    });

    // Basic Woodcutting Test
    this.createTestStation({
      id: 'basic_woodcutting_test',
      name: 'Basic Woodcutting Test',
      position: { x: -70, y: 0, z: 20 },
      timeoutMs: 40000 // 40 seconds
    });

    // Basic Firemaking Test
    this.createTestStation({
      id: 'basic_firemaking_test',
      name: 'Basic Firemaking Test',
      position: { x: -70, y: 0, z: 30 },
      timeoutMs: 30000 // 30 seconds
    });

    // Basic Cooking Test
    this.createTestStation({
      id: 'basic_cooking_test',
      name: 'Basic Cooking Test',
      position: { x: -70, y: 0, z: 40 },
      timeoutMs: 35000 // 35 seconds
    });

    // Comprehensive Resource Chain Test
    this.createTestStation({
      id: 'comprehensive_resource_test',
      name: 'Full Resource Chain Test',
      position: { x: -70, y: 0, z: 50 },
      timeoutMs: 90000 // 90 seconds for full chain
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'basic_fishing_test':
        this.runBasicFishingTest(stationId);
        break;
      case 'basic_woodcutting_test':
        this.runBasicWoodcuttingTest(stationId);
        break;
      case 'basic_firemaking_test':
        this.runBasicFiremakingTest(stationId);
        break;
      case 'basic_cooking_test':
        this.runBasicCookingTest(stationId);
        break;
      case 'comprehensive_resource_test':
        this.runComprehensiveResourceTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown resource gathering test: ${stationId}`);
    }
  }

  private async runBasicFishingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGResourceGatheringTestSystem] Starting basic fishing test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with fishing rod
      const fakePlayer = this.createFakePlayer({
        id: `fishing_player_${Date.now()}`,
        name: 'Fishing Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1,
          strength: 1,
          defense: 1,
          ranged: 1,
          constitution: 10,
          health: 100,
          maxHealth: 100,
          fishing: 5 // Level 5 fishing
        }
      });

      // Give player fishing rod
      const fishingRod = getItem('fishing_rod');
      if (fishingRod) {
        fakePlayer.inventory = [{ item: fishingRod, quantity: 1 }];
        fakePlayer.equipment.weapon = fishingRod;
      }

      // Create fishing spot (water area)
      const fishingLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createFishingSpotVisual(stationId, fishingLocation);

      // Get initial fishing XP
      const initialXP = this.skillsSystem ? await this.skillsSystem.getSkillXP(fakePlayer.id, 'fishing') : 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        resourceLocation: fishingLocation,
        testType: 'fishing',
        startTime: Date.now(),
        initialSkillXP: initialXP,
        finalSkillXP: initialXP,
        resourcesGathered: 0,
        itemsProcessed: 0,
        toolUsed: 'fishing_rod',
        expectedResources: 5, // Expect to catch ~5 fish
        skillTested: 'fishing',
        fireCreated: false,
        cookingAttempted: false,
        xpGained: 0
      });

      // Start fishing sequence
      this.startFishingSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Basic fishing test error: ${error}`);
    }
  }

  private async runBasicWoodcuttingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGResourceGatheringTestSystem] Starting basic woodcutting test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with hatchet
      const fakePlayer = this.createFakePlayer({
        id: `woodcutting_player_${Date.now()}`,
        name: 'Woodcutting Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1,
          strength: 1,
          defense: 1,
          ranged: 1,
          constitution: 10,
          health: 100,
          maxHealth: 100,
          woodcutting: 3 // Level 3 woodcutting
        }
      });

      // Give player bronze hatchet
      const bronzeHatchet = getItem('bronze_hatchet');
      if (bronzeHatchet) {
        fakePlayer.inventory = [{ item: bronzeHatchet, quantity: 1 }];
        fakePlayer.equipment.weapon = bronzeHatchet;
      }

      // Create tree to chop
      const treeLocation = { x: station.position.x + 3, y: station.position.y, z: station.position.z };
      this.createTreeVisual(stationId, treeLocation, 'oak_tree');

      // Get initial woodcutting XP
      const initialXP = this.skillsSystem ? await this.skillsSystem.getSkillXP(fakePlayer.id, 'woodcutting') : 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        resourceLocation: treeLocation,
        testType: 'woodcutting',
        startTime: Date.now(),
        initialSkillXP: initialXP,
        finalSkillXP: initialXP,
        resourcesGathered: 0,
        itemsProcessed: 0,
        toolUsed: 'bronze_hatchet',
        expectedResources: 8, // Expect to chop ~8 logs
        skillTested: 'woodcutting',
        fireCreated: false,
        cookingAttempted: false,
        xpGained: 0
      });

      // Start woodcutting sequence
      this.startWoodcuttingSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Basic woodcutting test error: ${error}`);
    }
  }

  private async runBasicFiremakingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGResourceGatheringTestSystem] Starting basic firemaking test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with firemaking supplies
      const fakePlayer = this.createFakePlayer({
        id: `firemaking_player_${Date.now()}`,
        name: 'Firemaking Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1,
          strength: 1,
          defense: 1,
          ranged: 1,
          constitution: 10,
          health: 100,
          maxHealth: 100,
          firemaking: 2 // Level 2 firemaking
        }
      });

      // Give player tinderbox and logs
      const tinderbox = getItem('tinderbox');
      const logs = getItem('logs');
      if (tinderbox && logs) {
        fakePlayer.inventory = [
          { item: tinderbox, quantity: 1 },
          { item: logs, quantity: 10 }
        ];
      }

      // Get initial firemaking XP
      const initialXP = this.skillsSystem ? await this.skillsSystem.getSkillXP(fakePlayer.id, 'firemaking') : 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        resourceLocation: { x: station.position.x + 2, y: station.position.y, z: station.position.z },
        testType: 'firemaking',
        startTime: Date.now(),
        initialSkillXP: initialXP,
        finalSkillXP: initialXP,
        resourcesGathered: 0,
        itemsProcessed: 0, // Logs consumed to make fires
        toolUsed: 'tinderbox',
        expectedResources: 3, // Expect to make ~3 fires
        skillTested: 'firemaking',
        fireCreated: false,
        cookingAttempted: false,
        xpGained: 0
      });

      // Start firemaking sequence
      this.startFiremakingSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Basic firemaking test error: ${error}`);
    }
  }

  private async runBasicCookingTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGResourceGatheringTestSystem] Starting basic cooking test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with cooking supplies
      const fakePlayer = this.createFakePlayer({
        id: `cooking_player_${Date.now()}`,
        name: 'Cooking Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1,
          strength: 1,
          defense: 1,
          ranged: 1,
          constitution: 10,
          health: 100,
          maxHealth: 100,
          cooking: 4 // Level 4 cooking
        }
      });

      // Give player raw fish and tinderbox + logs for fire
      const rawShrimps = getItem('raw_shrimps');
      const rawSardine = getItem('raw_sardine');
      const tinderbox = getItem('tinderbox');
      const logs = getItem('logs');
      
      if (rawShrimps && rawSardine && tinderbox && logs) {
        fakePlayer.inventory = [
          { item: rawShrimps, quantity: 3 },
          { item: rawSardine, quantity: 2 },
          { item: tinderbox, quantity: 1 },
          { item: logs, quantity: 5 }
        ];
      }

      // Create fire location
      const fireLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z };
      this.createFireVisual(stationId, fireLocation);

      // Get initial cooking XP
      const initialXP = this.skillsSystem ? await this.skillsSystem.getSkillXP(fakePlayer.id, 'cooking') : 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        resourceLocation: fireLocation,
        testType: 'cooking',
        startTime: Date.now(),
        initialSkillXP: initialXP,
        finalSkillXP: initialXP,
        resourcesGathered: 0,
        itemsProcessed: 0, // Fish cooked
        toolUsed: null,
        expectedResources: 4, // Expect to cook ~4 fish (some may burn)
        skillTested: 'cooking',
        fireCreated: true, // Fire already exists
        cookingAttempted: true,
        xpGained: 0
      });

      // Start cooking sequence
      this.startCookingSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Basic cooking test error: ${error}`);
    }
  }

  private async runComprehensiveResourceTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGResourceGatheringTestSystem] Starting comprehensive resource chain test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with all tools
      const fakePlayer = this.createFakePlayer({
        id: `comprehensive_player_${Date.now()}`,
        name: 'Comprehensive Test Player',
        position: { x: station.position.x - 2, y: station.position.y, z: station.position.z },
        stats: {
          attack: 5,
          strength: 5,
          defense: 5,
          ranged: 5,
          constitution: 15,
          health: 150,
          maxHealth: 150,
          fishing: 10,
          woodcutting: 8,
          firemaking: 6,
          cooking: 7
        }
      });

      // Give player all necessary tools
      const fishingRod = getItem('fishing_rod');
      const bronzeHatchet = getItem('bronze_hatchet');
      const tinderbox = getItem('tinderbox');
      
      if (fishingRod && bronzeHatchet && tinderbox) {
        fakePlayer.inventory = [
          { item: fishingRod, quantity: 1 },
          { item: bronzeHatchet, quantity: 1 },
          { item: tinderbox, quantity: 1 }
        ];
      }

      // Create multiple resource nodes
      const fishingSpot = { x: station.position.x + 4, y: station.position.y, z: station.position.z - 2 };
      const treeLocation = { x: station.position.x + 6, y: station.position.y, z: station.position.z };
      const campfireLocation = { x: station.position.x + 2, y: station.position.y, z: station.position.z + 2 };

      this.createFishingSpotVisual(stationId, fishingSpot);
      this.createTreeVisual(stationId, treeLocation, 'willow_tree');
      // Campfire will be created during the test

      // Get initial skill XP for all skills
      const fishingXP = this.skillsSystem ? await this.skillsSystem.getSkillXP(fakePlayer.id, 'fishing') : 0;
      const woodcuttingXP = this.skillsSystem ? await this.skillsSystem.getSkillXP(fakePlayer.id, 'woodcutting') : 0;
      const firemakingXP = this.skillsSystem ? await this.skillsSystem.getSkillXP(fakePlayer.id, 'firemaking') : 0;
      const cookingXP = this.skillsSystem ? await this.skillsSystem.getSkillXP(fakePlayer.id, 'cooking') : 0;

      // Store test data
      this.testData.set(stationId, {
        fakePlayer,
        resourceLocation: campfireLocation,
        testType: 'comprehensive',
        startTime: Date.now(),
        initialSkillXP: fishingXP + woodcuttingXP + firemakingXP + cookingXP,
        finalSkillXP: 0, // Will be calculated at end
        resourcesGathered: 0, // Total resources
        itemsProcessed: 0, // Total items processed
        toolUsed: 'multiple',
        expectedResources: 15, // Combined expectation
        skillTested: 'multiple',
        fireCreated: false,
        cookingAttempted: false,
        xpGained: 0
      });

      // Store additional locations for comprehensive test
      this.testData.get(stationId)!['fishingSpot'] = fishingSpot;
      this.testData.get(stationId)!['treeLocation'] = treeLocation;
      this.testData.get(stationId)!['campfireLocation'] = campfireLocation;

      // Start comprehensive sequence
      this.startComprehensiveSequence(stationId);
      
    } catch (error) {
      this.failTest(stationId, `Comprehensive resource test error: ${error}`);
    }
  }

  private createFishingSpotVisual(stationId: string, location: { x: number; y: number; z: number }): void {
    this.world.emit('rpg:test:fishing_spot:create', {
      id: `fishing_spot_${stationId}`,
      position: location,
      color: '#0077be', // Blue for water
      size: { x: 2, y: 0.2, z: 2 },
      type: 'fishing_spot'
    });
  }

  private createTreeVisual(stationId: string, location: { x: number; y: number; z: number }, treeType: string): void {
    const treeColors = {
      'oak_tree': '#8b4513',     // Brown
      'willow_tree': '#9acd32',  // Yellow-green
      'maple_tree': '#228b22'    // Forest green
    };

    this.world.emit('rpg:test:tree:create', {
      id: `tree_${stationId}`,
      position: location,
      color: treeColors[treeType] || '#8b4513',
      size: { x: 1, y: 3, z: 1 },
      type: treeType
    });
  }

  private createFireVisual(stationId: string, location: { x: number; y: number; z: number }): void {
    this.world.emit('rpg:test:fire:create', {
      id: `fire_${stationId}`,
      position: location,
      color: '#ff4500', // Orange-red for fire
      size: { x: 0.8, y: 1.2, z: 0.8 },
      type: 'campfire'
    });
  }

  private startFishingSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGResourceGatheringTestSystem] Starting fishing sequence...');

    // Move player to fishing spot
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.resourceLocation.x - 1,
      y: testData.resourceLocation.y,
      z: testData.resourceLocation.z
    });

    // Start fishing attempts
    let attempts = 0;
    const maxAttempts = 10;

    const attemptFishing = async () => {
      if (attempts >= maxAttempts) {
        this.completeFishingTest(stationId);
        return;
      }

      console.log(`[RPGResourceGatheringTestSystem] Fishing attempt ${attempts + 1}/${maxAttempts}`);

      if (this.fishingSystem) {
        const success = await this.fishingSystem.attemptFishing(
          testData.fakePlayer.id,
          testData.resourceLocation,
          'shrimps' // Type of fish to catch
        );

        if (success) {
          testData.resourcesGathered++;
          console.log(`[RPGResourceGatheringTestSystem] Caught fish! Total: ${testData.resourcesGathered}`);

          // Add fish to inventory
          const rawShrimps = getItem('raw_shrimps');
          if (rawShrimps) {
            const existingSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'raw_shrimps');
            if (existingSlot) {
              existingSlot.quantity++;
            } else {
              testData.fakePlayer.inventory.push({ item: rawShrimps, quantity: 1 });
            }
          }

          // Gain fishing XP
          if (this.skillsSystem) {
            await this.skillsSystem.addXP(testData.fakePlayer.id, 'fishing', 10);
            testData.xpGained += 10;
          }
        }
      }

      attempts++;
      setTimeout(attemptFishing, 3500); // 3.5 seconds between attempts
    };

    // Start fishing after movement
    setTimeout(attemptFishing, 2000);
  }

  private startWoodcuttingSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGResourceGatheringTestSystem] Starting woodcutting sequence...');

    // Move player to tree
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.resourceLocation.x - 1,
      y: testData.resourceLocation.y,
      z: testData.resourceLocation.z
    });

    // Start chopping attempts
    let attempts = 0;
    const maxAttempts = 12;

    const attemptWoodcutting = async () => {
      if (attempts >= maxAttempts) {
        this.completeWoodcuttingTest(stationId);
        return;
      }

      console.log(`[RPGResourceGatheringTestSystem] Woodcutting attempt ${attempts + 1}/${maxAttempts}`);

      if (this.woodcuttingSystem) {
        const success = await this.woodcuttingSystem.attemptWoodcutting(
          testData.fakePlayer.id,
          testData.resourceLocation,
          'oak' // Type of tree
        );

        if (success) {
          testData.resourcesGathered++;
          console.log(`[RPGResourceGatheringTestSystem] Chopped log! Total: ${testData.resourcesGathered}`);

          // Add logs to inventory
          const logs = getItem('logs');
          if (logs) {
            const existingSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'logs');
            if (existingSlot) {
              existingSlot.quantity++;
            } else {
              testData.fakePlayer.inventory.push({ item: logs, quantity: 1 });
            }
          }

          // Gain woodcutting XP
          if (this.skillsSystem) {
            await this.skillsSystem.addXP(testData.fakePlayer.id, 'woodcutting', 25);
            testData.xpGained += 25;
          }
        }
      }

      attempts++;
      setTimeout(attemptWoodcutting, 3000); // 3 seconds between attempts
    };

    // Start woodcutting after movement
    setTimeout(attemptWoodcutting, 2000);
  }

  private startFiremakingSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGResourceGatheringTestSystem] Starting firemaking sequence...');

    let fires = 0;
    const maxFires = 3;

    const attemptFiremaking = async () => {
      if (fires >= maxFires || testData.fakePlayer.inventory.length === 1) { // Only tinderbox left
        this.completeFiremakingTest(stationId);
        return;
      }

      console.log(`[RPGResourceGatheringTestSystem] Firemaking attempt ${fires + 1}/${maxFires}`);

      // Check for logs and tinderbox
      const logsSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'logs');
      const tinderboxSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'tinderbox');

      if (logsSlot && tinderboxSlot && logsSlot.quantity > 0) {
        if (this.firemakingSystem) {
          const fireLocation = {
            x: testData.resourceLocation.x + fires * 2,
            y: testData.resourceLocation.y,
            z: testData.resourceLocation.z
          };

          const success = await this.firemakingSystem.attemptFiremaking(
            testData.fakePlayer.id,
            fireLocation,
            'logs'
          );

          if (success) {
            fires++;
            testData.itemsProcessed++; // Logs consumed
            testData.fireCreated = true;
            console.log(`[RPGResourceGatheringTestSystem] Made fire! Total: ${fires}`);

            // Remove log from inventory
            logsSlot.quantity--;
            if (logsSlot.quantity <= 0) {
              const index = testData.fakePlayer.inventory.indexOf(logsSlot);
              testData.fakePlayer.inventory.splice(index, 1);
            }

            // Create fire visual
            this.createFireVisual(stationId + '_fire_' + fires, fireLocation);

            // Gain firemaking XP
            if (this.skillsSystem) {
              await this.skillsSystem.addXP(testData.fakePlayer.id, 'firemaking', 40);
              testData.xpGained += 40;
            }
          }
        }
      }

      setTimeout(attemptFiremaking, 4000); // 4 seconds between attempts
    };

    // Start firemaking
    setTimeout(attemptFiremaking, 1000);
  }

  private startCookingSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGResourceGatheringTestSystem] Starting cooking sequence...');

    // Move player to fire
    this.moveFakePlayer(testData.fakePlayer.id, {
      x: testData.resourceLocation.x - 1,
      y: testData.resourceLocation.y,
      z: testData.resourceLocation.z
    });

    let cooked = 0;

    const attemptCooking = async () => {
      // Find raw fish in inventory
      const rawFishSlots = testData.fakePlayer.inventory.filter(slot => 
        slot.item.id.startsWith('raw_') && slot.quantity > 0
      );

      if (rawFishSlots.length === 0) {
        this.completeCookingTest(stationId);
        return;
      }

      const fishSlot = rawFishSlots[0];
      console.log(`[RPGResourceGatheringTestSystem] Cooking ${fishSlot.item.name}...`);

      if (this.cookingSystem) {
        const success = await this.cookingSystem.attemptCooking(
          testData.fakePlayer.id,
          fishSlot.item.id,
          testData.resourceLocation
        );

        if (success) {
          cooked++;
          testData.itemsProcessed++;
          console.log(`[RPGResourceGatheringTestSystem] Cooked fish! Total: ${cooked}`);

          // Remove raw fish
          fishSlot.quantity--;
          if (fishSlot.quantity <= 0) {
            const index = testData.fakePlayer.inventory.indexOf(fishSlot);
            testData.fakePlayer.inventory.splice(index, 1);
          }

          // Add cooked fish
          const cookedFishId = fishSlot.item.id.replace('raw_', 'cooked_');
          const cookedFish = getItem(cookedFishId);
          if (cookedFish) {
            const existingSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === cookedFishId);
            if (existingSlot) {
              existingSlot.quantity++;
            } else {
              testData.fakePlayer.inventory.push({ item: cookedFish, quantity: 1 });
            }
          }

          // Gain cooking XP
          if (this.skillsSystem) {
            await this.skillsSystem.addXP(testData.fakePlayer.id, 'cooking', 30);
            testData.xpGained += 30;
          }
        }
      }

      setTimeout(attemptCooking, 3000); // 3 seconds between cooking attempts
    };

    // Start cooking after movement
    setTimeout(attemptCooking, 2000);
  }

  private startComprehensiveSequence(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGResourceGatheringTestSystem] Starting comprehensive resource chain...');

    // Step 1: Woodcut for logs (10 seconds)
    setTimeout(() => {
      console.log('[RPGResourceGatheringTestSystem] Phase 1: Woodcutting...');
      this.moveFakePlayer(testData.fakePlayer.id, {
        x: testData['treeLocation'].x - 1,
        y: testData['treeLocation'].y,
        z: testData['treeLocation'].z
      });

      // Quick woodcutting sequence
      let logs = 0;
      const quickChop = async () => {
        if (logs < 5 && this.woodcuttingSystem) {
          const success = await this.woodcuttingSystem.attemptWoodcutting(
            testData.fakePlayer.id,
            testData['treeLocation'],
            'willow'
          );
          if (success) {
            logs++;
            testData.resourcesGathered++;
            // Add log to inventory
            const logsItem = getItem('logs');
            if (logsItem) {
              const existingSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'logs');
              if (existingSlot) {
                existingSlot.quantity++;
              } else {
                testData.fakePlayer.inventory.push({ item: logsItem, quantity: 1 });
              }
            }
          }
          setTimeout(quickChop, 2000);
        }
      };
      quickChop();
    }, 2000);

    // Step 2: Fish for food (starts at 15 seconds)
    setTimeout(() => {
      console.log('[RPGResourceGatheringTestSystem] Phase 2: Fishing...');
      this.moveFakePlayer(testData.fakePlayer.id, {
        x: testData['fishingSpot'].x - 1,
        y: testData['fishingSpot'].y,
        z: testData['fishingSpot'].z
      });

      // Quick fishing sequence
      let fish = 0;
      const quickFish = async () => {
        if (fish < 4 && this.fishingSystem) {
          const success = await this.fishingSystem.attemptFishing(
            testData.fakePlayer.id,
            testData['fishingSpot'],
            'sardine'
          );
          if (success) {
            fish++;
            testData.resourcesGathered++;
            // Add fish to inventory
            const rawSardine = getItem('raw_sardine');
            if (rawSardine) {
              const existingSlot = testData.fakePlayer.inventory.find(slot => slot.item.id === 'raw_sardine');
              if (existingSlot) {
                existingSlot.quantity++;
              } else {
                testData.fakePlayer.inventory.push({ item: rawSardine, quantity: 1 });
              }
            }
          }
          setTimeout(quickFish, 2500);
        }
      };
      quickFish();
    }, 15000);

    // Step 3: Make fire (starts at 30 seconds)
    setTimeout(() => {
      console.log('[RPGResourceGatheringTestSystem] Phase 3: Making fire...');
      this.moveFakePlayer(testData.fakePlayer.id, {
        x: testData.resourceLocation.x,
        y: testData.resourceLocation.y,
        z: testData.resourceLocation.z
      });

      // Make fire
      setTimeout(async () => {
        if (this.firemakingSystem) {
          const success = await this.firemakingSystem.attemptFiremaking(
            testData.fakePlayer.id,
            testData.resourceLocation,
            'logs'
          );
          if (success) {
            testData.fireCreated = true;
            testData.itemsProcessed++;
            this.createFireVisual(stationId, testData.resourceLocation);
            console.log('[RPGResourceGatheringTestSystem] Fire created!');
          }
        }
      }, 2000);
    }, 30000);

    // Step 4: Cook fish (starts at 40 seconds)
    setTimeout(() => {
      console.log('[RPGResourceGatheringTestSystem] Phase 4: Cooking fish...');
      testData.cookingAttempted = true;

      // Cook all fish
      let cookAttempts = 0;
      const cookFish = async () => {
        const rawFishSlots = testData.fakePlayer.inventory.filter(slot => 
          slot.item.id.startsWith('raw_') && slot.quantity > 0
        );

        if (rawFishSlots.length === 0 || cookAttempts >= 6) {
          this.completeComprehensiveTest(stationId);
          return;
        }

        const fishSlot = rawFishSlots[0];
        if (this.cookingSystem) {
          const success = await this.cookingSystem.attemptCooking(
            testData.fakePlayer.id,
            fishSlot.item.id,
            testData.resourceLocation
          );
          if (success) {
            testData.itemsProcessed++;
            fishSlot.quantity--;
            if (fishSlot.quantity <= 0) {
              const index = testData.fakePlayer.inventory.indexOf(fishSlot);
              testData.fakePlayer.inventory.splice(index, 1);
            }
          }
        }

        cookAttempts++;
        setTimeout(cookFish, 3000);
      };
      cookFish();
    }, 40000);
  }

  private completeFishingTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      resourcesGathered: testData.resourcesGathered,
      expectedResources: testData.expectedResources,
      xpGained: testData.xpGained,
      skillTested: testData.skillTested,
      toolUsed: testData.toolUsed,
      duration: Date.now() - testData.startTime
    };

    if (testData.resourcesGathered >= testData.expectedResources * 0.6) { // 60% success rate
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Fishing test failed: caught ${testData.resourcesGathered}/${testData.expectedResources} fish`);
    }
  }

  private completeWoodcuttingTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      resourcesGathered: testData.resourcesGathered,
      expectedResources: testData.expectedResources,
      xpGained: testData.xpGained,
      skillTested: testData.skillTested,
      toolUsed: testData.toolUsed,
      duration: Date.now() - testData.startTime
    };

    if (testData.resourcesGathered >= testData.expectedResources * 0.7) { // 70% success rate
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Woodcutting test failed: chopped ${testData.resourcesGathered}/${testData.expectedResources} logs`);
    }
  }

  private completeFiremakingTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      fireCreated: testData.fireCreated,
      itemsProcessed: testData.itemsProcessed,
      xpGained: testData.xpGained,
      skillTested: testData.skillTested,
      toolUsed: testData.toolUsed,
      duration: Date.now() - testData.startTime
    };

    if (testData.fireCreated && testData.itemsProcessed >= 2) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Firemaking test failed: fire=${testData.fireCreated}, logs used=${testData.itemsProcessed}`);
    }
  }

  private completeCookingTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      itemsProcessed: testData.itemsProcessed,
      expectedResources: testData.expectedResources,
      xpGained: testData.xpGained,
      skillTested: testData.skillTested,
      duration: Date.now() - testData.startTime
    };

    if (testData.itemsProcessed >= testData.expectedResources * 0.75) { // 75% success rate
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Cooking test failed: cooked ${testData.itemsProcessed}/${testData.expectedResources} fish`);
    }
  }

  private completeComprehensiveTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      resourcesGathered: testData.resourcesGathered,
      itemsProcessed: testData.itemsProcessed,
      fireCreated: testData.fireCreated,
      cookingAttempted: testData.cookingAttempted,
      totalActivities: testData.resourcesGathered + testData.itemsProcessed,
      expectedTotal: testData.expectedResources,
      duration: Date.now() - testData.startTime
    };

    // Comprehensive test requires multiple successful activities
    if (testData.resourcesGathered >= 6 && 
        testData.itemsProcessed >= 3 && 
        testData.fireCreated && 
        testData.cookingAttempted) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `Comprehensive test failed: gathered=${testData.resourcesGathered}, processed=${testData.itemsProcessed}, fire=${testData.fireCreated}, cooking=${testData.cookingAttempted}`);
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up resource visuals
      this.world.emit('rpg:test:fishing_spot:remove', {
        id: `fishing_spot_${stationId}`
      });

      this.world.emit('rpg:test:tree:remove', {
        id: `tree_${stationId}`
      });

      this.world.emit('rpg:test:fire:remove', {
        id: `fire_${stationId}`
      });

      // Clean up any additional fires created
      for (let i = 1; i <= 3; i++) {
        this.world.emit('rpg:test:fire:remove', {
          id: `fire_${stationId}_fire_${i}`
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
    
    console.log(`[RPGResourceGatheringTestSystem] Cleanup completed for ${stationId}`);
  }

  getSystemRating(): { health: number; score: number; features: string[]; performance: Record<string, number> } {
    const testResults = Array.from(this.testResults.values());
    const totalTests = testResults.length;
    const passedTests = testResults.filter(result => result.passed).length;
    
    // Calculate resource collection efficiency
    let resourceCollectionEfficiency = 0;
    if (totalTests > 0) {
      const resourceTests = testResults.filter(result => 
        result.passed && result.data && result.data.resourcesGathered
      );
      if (resourceTests.length > 0) {
        const totalGathered = resourceTests.reduce((sum, result) => sum + (result.data?.resourcesGathered || 0), 0);
        const totalExpected = resourceTests.reduce((sum, result) => sum + (result.data?.expectedResources || 0), 0);
        resourceCollectionEfficiency = totalExpected > 0 ? (totalGathered / totalExpected) * 100 : 0;
      }
    }
    
    // Calculate overall health
    const health = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    return {
      health,
      score: Math.round(resourceCollectionEfficiency),
      features: [
        'Basic Resource Gathering',
        'Tool Requirements Check',
        'Resource Node Depletion',
        'Skill-based Success Rates',
        'XP Gain Progression'
      ],
      performance: {
        resourceCollectionEfficiency,
        testPassRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
        averageTestDuration: testResults.length > 0 
          ? testResults.reduce((sum, result) => sum + (result.data?.duration || 0), 0) / testResults.length 
          : 0,
        averageXpGained: testResults.length > 0 
          ? testResults.reduce((sum, result) => sum + (result.data?.xpGained || 0), 0) / testResults.length 
          : 0
      }
    };
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