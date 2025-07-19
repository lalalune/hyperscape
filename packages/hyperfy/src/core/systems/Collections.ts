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
    console.log('[Collections] Init called');
    await super.init(options);
  }

  start(): void {
    super.start();
    console.log('[Collections] Start called');
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