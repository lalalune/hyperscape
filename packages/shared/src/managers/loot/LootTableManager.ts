 
import { LootTable } from '../../types';

export class LootTableManager {
  private lootTables: Map<string, LootTable> = new Map();
  
  /**
   * Register a loot table
   */
  register(table: LootTable): void {
    const id = table.id !== undefined ? table.id : (table.mobType || 'unknown');
    this.lootTables.set(id, table);
  }
  
  /**
   * Get a loot table by ID
   */
  get(id: string): LootTable | undefined {
    return this.lootTables.get(id);
  }
  
  /**
   * Check if a loot table exists
   */
  has(id: string): boolean {
    return this.lootTables.has(id);
  }
  
  /**
   * Get all registered loot tables
   */
  getAll(): LootTable[] {
    return Array.from(this.lootTables.values());
  }
  
  /**
   * Remove a loot table
   */
  remove(id: string): boolean {
    return this.lootTables.delete(id);
  }
  
  /**
   * Clear all loot tables
   */
  clear(): void {
    this.lootTables.clear();
  }
  
  /**
   * Get the count of registered loot tables
   */
  get size(): number {
    return this.lootTables.size;
  }
} 