import { System } from './System';
import type { World, Collections as ICollections } from '../../types/index';

/**
 * Collections System - DEPRECATED
 * 
 * This system previously managed .hyp file collections and app blueprints.
 * It has been replaced by the pure ECS Entity system.
 * This stub is kept for backwards compatibility only.
 */
export class Collections extends System implements ICollections {
  items: Map<string, any>;

  constructor(world: World) {
    super(world);
    this.items = new Map();
    console.log('[Collections] DEPRECATED: Collections system no longer loads .hyp files');
    console.log('[Collections] Use the Entity system and Components instead');
  }

  async init(options: any): Promise<void> {
    console.log('[Collections] Init called - system is deprecated and does nothing');
    await super.init(options);
  }

  start(): void {
    super.start();
    console.log('[Collections] Start called - system is deprecated and does nothing');
  }

  get(id: string): any {
    console.log(`[Collections] get(${id}) called - system is deprecated, returning null`);
    return null;
  }

  add(collection: any): void {
    console.log('[Collections] add() called - system is deprecated, ignoring');
  }

  remove(id: string): boolean {
    console.log(`[Collections] remove(${id}) called - system is deprecated, returning false`);
    return false;
  }

  getAll(): any[] {
    console.log('[Collections] getAll() called - system is deprecated, returning empty array');
    return [];
  }

  deserialize(data: any[]): void {
    console.log('[Collections] deserialize() called - system is deprecated, ignoring data');
    console.log('[Collections] .hyp file loading is no longer supported');
    console.log('[Collections] Use Entity system with Components instead');
  }

  serialize(): any[] {
    console.log('[Collections] serialize() called - system is deprecated, returning empty array');
    return [];
  }

  override destroy(): void {
    this.items.clear();
    console.log('[Collections] Destroyed - system was deprecated');
  }
} 