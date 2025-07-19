import { System } from './System.js';
import type { World, Collections as ICollections } from '../../types/index.js';

interface Collection {
  id: string;
  name?: string;
  description?: string;
  items?: any[];
  [key: string]: any;
}

/**
 * Collections System
 * 
 * Manages collections of items/assets in the world
 */
export class Collections extends System implements ICollections {
  items: Map<string, any>;
  private collections: Collection[];

  constructor(world: World) {
    super(world);
    this.collections = [];
    this.items = new Map();
  }

  async init(options: any): Promise<void> {
    console.log('[Collections] Init called, setting up auto-spawn timer');
    await super.init(options);
    // Auto-spawn entities after a short delay to ensure blueprints are loaded
    setTimeout(() => {
      this.autoSpawnTestEntities();
    }, 2000);
  }

  start(): void {
    super.start();
    console.log('[Collections] Start called, setting up auto-spawn timer');
    // Auto-spawn entities after a short delay to ensure blueprints are loaded
    setTimeout(() => {
      this.autoSpawnTestEntities();
    }, 3000);
  }

  private autoSpawnTestEntities(): void {
    console.log('[Collections] Auto-spawning test entities...');
    
    // Auto-spawn MovementTestMob for visual testing
    const movementTestMobBlueprint = (this.world.blueprints as any).get('default/MovementTestMob.hyp');
    
    if (movementTestMobBlueprint) {
      console.log('[Collections] Auto-creating MovementTestMob entity for testing');
      const movementTestData = {
        id: 'movement-test-mob',
        type: 'app',
        blueprint: 'default/MovementTestMob.hyp',
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        properties: {
          mobName: 'TestMob',
          proxyColor: 'red'
        }
      };
      (this.world.entities as any).add(movementTestData);
    } else {
      console.log('[Collections] MovementTestMob blueprint not found');
    }
  }

  get(id: string): Collection | undefined {
    return this.collections.find(coll => coll.id === id);
  }

  add(collection: Collection): void {
    const existing = this.get(collection.id);
    if (existing) {
      // Update existing collection
      const index = this.collections.indexOf(existing);
      this.collections[index] = collection;
    } else {
      // Add new collection
      this.collections.push(collection);
    }
    this.items.set(collection.id, collection);
  }

  remove(id: string): boolean {
    const collection = this.get(id);
    if (collection) {
      const index = this.collections.indexOf(collection);
      this.collections.splice(index, 1);
      this.items.delete(id);
      return true;
    }
    return false;
  }

  getAll(): Collection[] {
    return [...this.collections];
  }

  deserialize(data: Collection[]): void {
    console.log('[Collections.deserialize] Called with data length:', data?.length || 'undefined')
    this.collections = data || [];
    this.items.clear();
    
    // Register all blueprints from collections with the blueprints system
    let totalBlueprints = 0;
    for (const collection of this.collections) {
      this.items.set(collection.id, collection);
      
      // Register blueprints from this collection
      if (collection.blueprints && Array.isArray(collection.blueprints)) {
        for (const blueprint of collection.blueprints) {
          if (blueprint && blueprint.id) {
            console.log(`[Collections] Registering blueprint: ${blueprint.id}`)
            ;(this.world.blueprints as any).add(blueprint);
            totalBlueprints++;
          }
        }
      }
    }
    
    console.log('[Collections.deserialize] After deserialize, collections length:', this.collections.length)
    console.log('[Collections.deserialize] Registered blueprints:', totalBlueprints)
    
    // For testing: automatically create test entities if we have those blueprints
    setTimeout(() => {
      const testCubeBlueprint = (this.world.blueprints as any).get('default/TestCube.hyp');
      if (testCubeBlueprint) {
        console.log('[Collections] Auto-creating TestCube entity for testing');
        const entityData = {
          id: 'test-cube-entity',
          type: 'app',
          blueprint: 'default/TestCube.hyp', 
          position: [0, 1, 0],
          quaternion: [0, 0, 0, 1],
          scale: [1, 1, 1]
        };
        (this.world.entities as any).add(entityData);
      } else {
        console.log('[Collections] TestCube blueprint not found');
      }
      
      // Auto-spawn SimpleTest entity for testing
      const simpleTestBlueprint = (this.world.blueprints as any).get('default/SimpleTest.hyp');
      if (simpleTestBlueprint) {
        console.log('[Collections] Auto-creating SimpleTest entity for testing');
        const simpleTestEntityData = {
          id: 'simple-test-entity',
          type: 'app',
          blueprint: 'default/SimpleTest.hyp',
          position: [0, 1, 0],
          quaternion: [0, 0, 0, 1],
          scale: [1, 1, 1],
          properties: {
            testColor: 'red'
          }
        };
        (this.world.entities as any).add(simpleTestEntityData);
      } else {
        console.log('[Collections] SimpleTest blueprint not found');
      }
      
      // Auto-spawn RPGPlayer for comprehensive testing
      const rpgPlayerBlueprint = (this.world.blueprints as any).get('default/RPGPlayer.hyp');
      
      if (rpgPlayerBlueprint) {
        console.log('[Collections] Auto-creating RPGPlayer entity for testing');
        const rpgPlayerData = {
          id: 'rpg-player-test',
          type: 'app',
          blueprint: 'default/RPGPlayer.hyp',
          position: [0, 0, 0],
          quaternion: [0, 0, 0, 1],
          scale: [1, 1, 1],
          properties: {
            playerName: 'TestPlayer',
            visualColor: 'blue'
          }
        };
        (this.world.entities as any).add(rpgPlayerData);
      } else {
        console.log('[Collections] RPGPlayer blueprint not found');
      }
      
      // Also spawn RPG Goblin for combat testing
      const rpgGoblinBlueprint = (this.world.blueprints as any).get('default/RPGGoblin.hyp');
      
      if (rpgGoblinBlueprint) {
        console.log('[Collections] Auto-creating RPGGoblin entity for testing');
        const rpgGoblinData = {
          id: 'rpg-goblin-test',
          type: 'app',
          blueprint: 'default/RPGGoblin.hyp',
          position: [5, 0, 0],
          quaternion: [0, 0, 0, 1],
          scale: [1, 1, 1],
          properties: {
            goblinName: 'TestGoblin',
            visualColor: 'green',
            level: 1
          }
        };
        (this.world.entities as any).add(rpgGoblinData);
      } else {
        console.log('[Collections] RPGGoblin blueprint not found');
      }
    }, 1000);
  }

  serialize(): Collection[] {
    console.log('[Collections.serialize] Called, collections length:', this.collections.length)
    if (this.collections.length > 0) {
      console.log('[Collections.serialize] First collection id:', this.collections[0]?.id)
      console.log('[Collections.serialize] Collections IDs:', this.collections.map(c => c.id))
    } else {
      console.log('[Collections.serialize] Collections array is empty!')
    }
    return this.collections;
  }

  override destroy(): void {
    this.collections = [];
    this.items.clear();
  }
} 