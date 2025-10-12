/**
 * system-specific type definitions
 * 
 * This file contains interfaces used by specific systems.
 * Common types have been moved to core.ts to avoid duplication.
 */

import THREE from '../extras/three';
import type { System } from '../systems/System';
import type { Item, MobStats, Position3D } from './core';

// Combat system interfaces
export interface CombatEntity {
  id: string;
  position: Position3D;
  stats: { attack: number; defense: number; ranged: number };
  config: { attackPower: number; defensePower: number; defense: number };
  getPosition(): Position3D;
  takeDamage(damage: number, attackerId: string): void;
}

export interface XPDrop {
  entityId: string;
  skill: 'attack' | 'strength' | 'defense' | 'constitution' | 'ranged' | 'woodcutting' | 'fishing' | 'firemaking' | 'cooking';
  amount: number;
  timestamp: number;
  playerId: string;
  position: Position3D;
}

export interface SkillMilestone {
  level: number;
  name: string;
  message: string;
  reward: string | null;
}

// Loot system interfaces
export interface DroppedItem {
  id: string;
  itemId: string;
  quantity: number;
  position: Position3D;
  despawnTime: number;
  droppedBy: string;
  entityId: string;
  droppedAt: number;
  mesh: THREE.Object3D | null;
}

// LootTable moved to core.ts to avoid duplication

// Item spawner interfaces
export interface LootItem extends Item {
  quantity: number;
}

export interface ItemSpawnerStats {
  totalItemsSpawned: number;
  itemsPickedUp: number;
  activeItems: number;
  itemsByType: Map<string, number>;
  lastSpawnTime: number;
}

// MobStats moved to core.ts to avoid duplication

export interface EntitySpawnedEvent {
  entityId: string;
  entityType: 'player' | 'mob' | 'item' | 'npc' | 'resource';
  position: Position3D;
  entityData: Record<string, unknown>;
}

export interface MobSpawnRequest {
  mobType: string;
  position: Position3D;
  level: number;
  config: Partial<MobStats> | null;
  respawnTime: number;
  customId: string | null;
}

// Entity manager interfaces
export interface MoveRequestEvent {
  entityId: string;
  targetPosition: Position3D;
  speed: number;
}

export interface MobAttackEvent {
  attackerId: string;
  targetId: string;
  damage: number;
}

// WorldInitConfig moved to core.ts to avoid duplication

// Player moved to core.ts to avoid duplication

export interface SkillsData {
  attack: { level: number; xp: number };
  strength: { level: number; xp: number };
  defense: { level: number; xp: number };
  constitution: { level: number; xp: number };
  ranged: { level: number; xp: number };
  woodcutting: { level: number; xp: number };
  fishing: { level: number; xp: number };
  firemaking: { level: number; xp: number };
  cooking: { level: number; xp: number };
}

export interface InventoryData {
  items: Array<{
    slot: number;
    itemId: string;
    quantity: number;
    item: {
      id: string;
      name: string;
      type: string;
      stackable: boolean;
      weight: number;
    };
  }>;
  coins: number;
  maxSlots: number;
}

export interface EquipmentData {
  weapon: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
  shield: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
  helmet: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
  body: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
  legs: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
  arrows: {
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
  } | null;
}

export interface UIRequestData {
  playerId: string;
  requestType: 'open' | 'close' | 'update' | 'refresh';
  data: Record<string, string | number | boolean>;
  uiType: 'inventory' | 'skills' | 'equipment' | 'stats' | 'bank' | 'store';
}

// Action registry interfaces
export interface ActionParams {
  playerId: string;
  targetId: string | null;
  position: Position3D | null;
  itemId: string | null;
  quantity: number | null;
  slot: number | null;
  skillName: string | null;
}

// Store system interfaces
export interface StoreSystemInterface {
  openStore(playerId: string, storeType: 'general' | 'equipment' | 'food' | 'runes'): void;
  closeStore(playerId: string): void;
  buyItem(playerId: string, itemId: string, quantity: number): Promise<boolean>;
  sellItem(playerId: string, itemId: string, quantity: number): Promise<boolean>;
  getStoreInventory(storeType: 'general' | 'equipment' | 'food' | 'runes'): Array<{ item: Item; price: number }>;
}

// System loader interfaces - specific system registry
export interface Systems {
  combat: System;
  inventory: System;
  skills: System;
  mobAI: System;
  itemPickup: System;
  persistence: System;
  spawning: System;
  banking: System;
  store: System;
  ui: System;
}