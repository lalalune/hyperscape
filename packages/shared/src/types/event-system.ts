/**
 * Strongly typed event system for Hyperscape
 * 
 * This file provides a comprehensive type-safe event system that ensures
 * all events are properly typed throughout the codebase.
 */

import { EventType, type AnyEvent } from './events';
import * as Payloads from './event-payloads';
import { Player, EquipmentSlotName } from './core';
import { Position3D } from './index';

// Shared event system types
export interface SystemEvent<T = AnyEvent> {
  readonly type: EventType;
  readonly data: T;
  readonly source: string;
  readonly timestamp: number;
  readonly id: string;
}

export interface EventHandler<T = AnyEvent> {
  (event: SystemEvent<T>): void | Promise<void>;
}

export interface EventSubscription {
  unsubscribe(): void;
  readonly active: boolean;
}
import type { SkillsData } from './systems';
import type {
  InventoryCanAddEvent,
  InventoryRemoveCoinsEvent,
  InventoryCheckEvent,
  InventoryHasEquippedEvent,
  BankDepositEvent,
  BankWithdrawEvent,
  BankDepositSuccessEvent,
  UIMessageEvent,
  StoreOpenEvent,
  StoreCloseEvent,
  StoreBuyEvent,
  StoreSellEvent
} from './events';

/**
 * Complete mapping of all events to their payload types
 * This ensures type safety when emitting and listening to events
 */
export interface EventMap {
  // Core Events
  [EventType.READY]: void;
  [EventType.ERROR]: { error: Error; message: string };
  [EventType.TICK]: { deltaTime: number };
  [EventType.PLAYER_JOINED]: Payloads.PlayerJoinedPayload;
  [EventType.PLAYER_LEFT]: Payloads.PlayerLeavePayload;

  [EventType.ENTITY_CREATED]: Payloads.EntityCreatedPayload;
  [EventType.ENTITY_DEATH]: { entityId: string };
  [EventType.ENTITY_UPDATED]: { entityId: string; changes: Record<string, string | number | boolean> };
  [EventType.ASSET_LOADED]: { assetId: string; assetType: string };
  [EventType.ASSETS_LOADING_PROGRESS]: { progress: number; total: number; stage?: string; current?: number };
  [EventType.UI_TOGGLE]: { visible: boolean };
  [EventType.UI_OPEN_PANE]: { pane: string };
  [EventType.UI_CLOSE_PANE]: { pane: string };
  [EventType.UI_MENU]: { action: 'open' | 'close' | 'toggle' | 'navigate' };
  [EventType.UI_AVATAR]: { avatarData: { vrm: string; scale: number; position: { x: number; y: number; z: number } } };
  [EventType.UI_KICK]: { playerId: string; reason: string };
  [EventType.UI_TOAST]: { message: string; type: 'info' | 'success' | 'warning' | 'error' };
  [EventType.UI_SIDEBAR_CHAT_TOGGLE]: void;
  [EventType.UI_ACTIONS_UPDATE]: Array<{ id: string; name: string; enabled: boolean; hotkey: string | null }>;
  // Camera Events
  [EventType.CAMERA_SET_MODE]: { mode: 'first_person' | 'third_person' | 'top_down' };
  // Camera target accepts any object that exposes a THREE.Vector3 position
  [EventType.CAMERA_SET_TARGET]: { target: { position: { x: number; y: number; z: number } } };
  [EventType.CAMERA_CLICK_WORLD]: { screenPosition: { x: number; y: number }; normalizedPosition: { x: number; y: number }; target: { position?: Position3D } };
  // Biome Visualization Events
  [EventType.BIOME_TOGGLE_VISUALIZATION]: void;
  [EventType.BIOME_SHOW_AREA]: { areaId: string };
  [EventType.BIOME_HIDE_AREA]: { areaId: string };
  [EventType.PLAYER_REGISTERED]: { playerId: string };
  [EventType.PLAYER_AVATAR_READY]: { playerId: string; avatar: { base?: {} } | {}; camHeight: number };
  [EventType.GRAPHICS_RESIZE]: { width: number; height: number };
  [EventType.NETWORK_CONNECTED]: void;
  [EventType.NETWORK_DISCONNECTED]: { code: number; reason: string };
  [EventType.NETWORK_MESSAGE_RECEIVED]: { type: string; data: Record<string, string | number | boolean> };
  [EventType.INPUT_KEY_DOWN]: { key: string; code: string };
  [EventType.INPUT_KEY_UP]: { key: string; code: string };
  [EventType.INPUT_POINTER_DOWN]: { x: number; y: number; button: number };
  [EventType.INPUT_POINTER_UP]: { x: number; y: number; button: number };
  [EventType.INPUT_POINTER_MOVE]: { x: number; y: number };
  [EventType.SETTINGS_CHANGED]: { changes: Record<string, string | number | boolean> };

  [EventType.PLAYER_LOGOUT]: { playerId: string };
  [EventType.PLAYER_RECONNECTED]: { playerId: string };

  [EventType.ENTITY_INTERACT]: { entityId: string; playerId: string; action: 'attack' | 'pickup' | 'talk' | 'gather' | 'use' | 'loot' };
  [EventType.ENTITY_MOVE_REQUEST]: { entityId: string; position: { x: number; y: number; z: number } };
  [EventType.ENTITY_PROPERTY_REQUEST]: { entityId: string; property: string; value: string | number | boolean };
  [EventType.CLIENT_CONNECT]: { clientId: string };
  [EventType.CLIENT_DISCONNECT]: { clientId: string };
  [EventType.ENTITY_SPAWNED]: { entityId: string; entityType: 'player' | 'mob' | 'item' | 'npc' | 'resource' };
  [EventType.ENTITY_POSITION_CHANGED]: { entityId: string; position: { x: number; y: number; z: number } };
  [EventType.ENTITY_UNDERGROUND_DETECTED]: { entityId: string; position: { x: number; y: number; z: number } };
  [EventType.ENTITY_POSITION_CORRECTED]: { entityId: string; oldPosition: { x: number; y: number; z: number }; newPosition: { x: number; y: number; z: number } };
  [EventType.ENTITY_COMPONENT_ADDED]: { entityId: string; componentType: string };
  [EventType.ENTITY_COMPONENT_REMOVED]: { entityId: string; componentType: string };
  [EventType.CLIENT_ENTITY_SYNC]: { entities: Array<{ id: string; data: Record<string, string | number | boolean> }> };
  [EventType.NETWORK_ENTITY_UPDATES]: { updates: Array<{ id: string; changes: Record<string, string | number | boolean> }> };

  // Events
  [EventType.PLAYER_LEVEL_UP]: { playerId: string; skill: string; newLevel: number; previousLevel: number };
  [EventType.PLAYER_XP_GAINED]: Payloads.PlayerXPGainedPayload;
  [EventType.PLAYER_DIED]: { playerId: string; killerId?: string | null; deathLocation: { x: number; y: number; z: number }; cause: string };
  [EventType.PLAYER_RESPAWNED]: { playerId: string; respawnLocation: { x: number; y: number; z: number } };
  [EventType.PLAYER_EQUIPMENT_CHANGED]: { playerId: string; slot: EquipmentSlotName; itemId: string | null };
  [EventType.AGGRO_PLAYER_LEFT]: { playerId: string; mobId: string };
  [EventType.AGGRO_PLAYER_ENTERED]: { playerId: string; mobId: string };
  [EventType.PLAYER_POSITION_UPDATED]: { playerId: string; position: Position3D };
  [EventType.PLAYER_LEVEL_CHANGED]: { playerId: string; skill: 'attack' | 'strength' | 'defense' | 'constitution' | 'ranged' | 'woodcutting' | 'fishing' | 'firemaking' | 'cooking'; newLevel: number; oldLevel: number };
  [EventType.PLAYER_AUTHENTICATED]: { playerId: string; accountId: string };
  [EventType.PLAYER_INIT]: { playerId: string };
  [EventType.PLAYER_READY]: { playerId: string };
  [EventType.PLAYER_REGISTERED]: { playerId: string };
  [EventType.PLAYER_SPAWNED]: { playerId: string; position: Position3D };
  [EventType.PLAYER_DATA_LOADED]: { playerId: string };
  [EventType.PLAYER_DATA_SAVED]: { playerId: string };
  [EventType.PLAYER_SESSION_STARTED]: { playerId: string; sessionId: string };
  [EventType.PLAYER_SESSION_ENDED]: { playerId: string; sessionId: string };
  [EventType.PLAYER_CREATE]: { playerId: string; playerData: Player };
  [EventType.PLAYER_SPAWN_COMPLETE]: { playerId: string; position: Position3D };
  [EventType.PLAYER_ANIMATION]: { playerId: string; animation: string; duration?: number };
  [EventType.PLAYER_HEALTH_UPDATED]: { playerId: string; health: number; maxHealth: number };
  [EventType.PLAYER_SKILLS_UPDATED]: { playerId: string; skills: SkillsData };
  [EventType.PLAYER_TELEPORT_REQUEST]: { playerId: string; position: Position3D; rotationY: number };
  [EventType.PLAYER_DAMAGE]: { playerId: string; damage: number; source: 'combat' | 'fall' | 'drowning' | 'poison' | 'fire' | 'other' };
  [EventType.PLAYER_UPDATED]: { 
    playerId: string; 
    component?: string; 
    playerData?: {
      id: string;
      name: string; 
      level: number;
      health: number;
      maxHealth: number;
      alive: boolean;
      position?: Position3D;
    };
    data?: {
      id: string;
      name: string; 
      level: number;
      health: number;
      maxHealth: number;
      alive: boolean;
      position?: Position3D;
    };
  };
  [EventType.MOVEMENT_COMPLETED]: { playerId: string; finalPosition: Position3D };
  [EventType.PLAYER_RESPAWN_REQUEST]: { playerId: string };
  [EventType.PLAYER_EQUIPMENT_UPDATED]: { 
    playerId: string; 
    equipment: Record<string, string | null>;
  };
  [EventType.ATTACK_STYLE_CHANGED]: { playerId: string; newStyle: 'attack' | 'strength' | 'defense' | 'ranged' };
  [EventType.PLAYER_UNREGISTERED]: { playerId: string };

  [EventType.PLAYER_CLEANUP]: { playerId: string };
  [EventType.PLAYER_STATS_EQUIPMENT_UPDATED]: { playerId: string; stats: Record<string, number>; equipment: Record<string, { itemId: string; name: string } | null> };

  // Combat Events
  [EventType.COMBAT_STARTED]: Payloads.CombatStartedPayload;
  [EventType.COMBAT_ENDED]: { sessionId: string; winnerId: string | null };
  [EventType.COMBAT_DAMAGE_DEALT]: { attackerId: string; targetId: string; damage: number; damageType: 'melee' | 'ranged' | 'magic' };
  [EventType.COMBAT_ATTACK]: { attackerId: string; targetId: string; attackType: 'melee' | 'ranged' | 'magic' };
  [EventType.COMBAT_ATTACK_REQUEST]: { playerId: string; targetId: string };
  [EventType.COMBAT_MELEE_ATTACK]: { attackerId: string; targetId: string; weapon: string | null };
  [EventType.COMBAT_RANGED_ATTACK]: { attackerId: string; targetId: string; projectileId: string };
  [EventType.COMBAT_MOB_ATTACK]: { mobId: string; targetId: string };
  [EventType.COMBAT_ATTACK_FAILED]: { attackerId: string; targetId: string; reason: 'out_of_range' | 'no_ammo' | 'target_dead' | 'cooldown' | 'invalid_target' };
  [EventType.COMBAT_XP_CALCULATE]: { playerId: string; baseXP: number; skill: string; callback: (xpAmount: number) => void };
  [EventType.COMBAT_DAMAGE_CALCULATE]: { playerId: string; baseDamage: number; callback: (damage: number) => void };
  [EventType.COMBAT_ACCURACY_CALCULATE]: { playerId: string; baseAccuracy: number; callback: (accuracy: number) => void };
  [EventType.COMBAT_START_ATTACK]: { attackerId: string; targetId: string };
  [EventType.COMBAT_HEAL]: { playerId: string; amount: number; source: 'food' | 'potion' | 'spell' | 'natural' };
  [EventType.COMBAT_MISS]: { attackerId: string; targetId: string };
  [EventType.MOB_CHASE_STARTED]: { mobId: string; targetPlayerId: string; mobPosition: { x: number; y: number; z: number } };
  [EventType.MOB_CHASE_ENDED]: { mobId: string; targetPlayerId: string };
  [EventType.MOB_MOVE_REQUEST]: { mobId: string; targetPosition: { x: number; y: number; z: number }; speed: number; reason: 'chase' | 'patrol' | 'flee' | 'return' };

  // Inventory Events
  [EventType.INVENTORY_ITEM_ADDED]: Payloads.InventoryItemAddedPayload;
  [EventType.INVENTORY_ITEM_REMOVED]: { playerId: string; itemId: string; quantity: number };
  [EventType.INVENTORY_UPDATED]: { playerId: string; items: Array<{ id: string; itemId: string; quantity: number; slot: number }> };
  [EventType.INVENTORY_ITEM_RIGHT_CLICK]: { playerId: string; itemId: string; slot: number };
  [EventType.INVENTORY_USE]: { playerId: string; itemId: string; slot: number };
  [EventType.INVENTORY_UPDATE_COINS]: { playerId: string; coins: number };
  [EventType.INVENTORY_MOVE]: { playerId: string; fromSlot: number; toSlot: number };

  [EventType.INVENTORY_CAN_ADD]: InventoryCanAddEvent;
  [EventType.INVENTORY_REMOVE_COINS]: InventoryRemoveCoinsEvent;
  [EventType.INVENTORY_CHECK]: InventoryCheckEvent;
  [EventType.INVENTORY_HAS_EQUIPPED]: InventoryHasEquippedEvent;
  [EventType.INVENTORY_INITIALIZED]: { playerId: string };
  [EventType.INVENTORY_COINS_UPDATED]: { playerId: string; oldAmount: number; newAmount: number };
  [EventType.INVENTORY_FULL]: { playerId: string };
  [EventType.INVENTORY_REQUEST]: { playerId: string };
  [EventType.INVENTORY_HAS_ITEM]: { playerId: string; itemId: string; callbackId: string };

  // Item Events
  [EventType.ITEM_DROPPED]: { itemId: string; playerId: string; position: { x: number; y: number; z: number } };
  [EventType.ITEM_DROP]: { playerId: string; itemId: string; slot: number; quantity: number };
  [EventType.ITEM_EXAMINE]: { playerId: string; itemId: string };
  [EventType.ITEM_SPAWNED]: { itemId: string; position: { x: number; y: number; z: number } };
  [EventType.ITEM_SPAWN_REQUEST]: { itemType: string; position: { x: number; y: number; z: number } };
  [EventType.ITEM_DESPAWN]: { itemId: string };
  [EventType.ITEM_RESPAWN_SHOPS]: void;
  [EventType.ITEM_SPAWN_LOOT]: { lootTable: string; position: { x: number; y: number; z: number } };
  [EventType.ITEM_SPAWN]: { itemId: string; itemType?: string; position: { x: number; y: number; z: number }; quantity?: number };
  [EventType.ITEM_PICKUP]: { playerId: string; itemId: string; groundItemId?: string };
  [EventType.INVENTORY_DROP_ALL]: { playerId: string; position: Position3D };
  [EventType.ITEM_USED]: { 
    playerId: string; 
    itemId: string; 
    slot: number;
    targetId: string | null;
    itemData: {
      id: string;
      name: string;
      type: 'weapon' | 'armor' | 'consumable' | 'tool' | 'resource';
      stackable: boolean;
      weight: number;
    };
  };

  // Equipment Events
  [EventType.EQUIPMENT_EQUIP]: { playerId: string; itemId: string; slot: EquipmentSlotName };
  [EventType.EQUIPMENT_UNEQUIP]: { playerId: string; slot: EquipmentSlotName };
  [EventType.EQUIPMENT_TRY_EQUIP]: { playerId: string; itemId: string };
  [EventType.EQUIPMENT_FORCE_EQUIP]: { playerId: string; itemId: string; slot: EquipmentSlotName };
  [EventType.EQUIPMENT_CONSUME_ARROW]: { playerId: string };
  [EventType.INVENTORY_CONSUME_ITEM]: { playerId: string; itemId: string; quantity: number };

  // XP & Skills Events (moved to main Skills & XP System section)

  // Interaction Events
  [EventType.INTERACTION_REGISTER]: { entityId: string; interactionType: 'attack' | 'pickup' | 'talk' | 'gather' | 'use' | 'loot' | 'bank' | 'trade' };
  [EventType.INTERACTION_UNREGISTER]: { entityId: string };
  [EventType.MOVEMENT_CLICK_TO_MOVE]: { playerId: string; targetPosition: { x: number; y: number; z: number } };

  // NPC & Quest Events
  [EventType.NPC_INTERACTION]: { playerId: string; npcId: string; action: 'talk' | 'trade' | 'quest' | 'bank' };
  [EventType.QUEST_STARTED]: { playerId: string; questId: string };
  [EventType.QUEST_PROGRESSED]: { playerId: string; questId: string; progress: number };
  [EventType.QUEST_COMPLETED]: { playerId: string; questId: string; rewards: Array<{ type: 'item' | 'xp' | 'coins'; itemId: string | null; amount: number }> };
  [EventType.NPC_DIALOGUE]: { playerId: string; npcId: string; dialogueId: string };

  // Mob Events
  [EventType.MOB_SPAWNED]: { mobId: string; mobType: string; position: { x: number; y: number; z: number } };
  [EventType.MOB_SPAWN_REQUEST]: { mobType: string; position: { x: number; y: number; z: number } };
  [EventType.MOB_DESPAWN]: { mobId: string };
  [EventType.MOB_RESPAWN_ALL]: void;
  [EventType.AGGRO_MOB_AGGROED]: { mobId: string; targetId: string };
  [EventType.MOB_POSITION_UPDATED]: { mobId: string; position: { x: number; y: number; z: number } };
  [EventType.MOB_ATTACKED]: { mobId: string; attackerId: string; damage: number };
  [EventType.MOB_DAMAGED]: { mobId: string; damage: number; attackerId: string };
  [EventType.MOB_DIED]: Payloads.MobDiedPayload;

  // Bank Events
  [EventType.BANK_OPEN]: { playerId: string; bankId: string; playerPosition?: Position3D };
  [EventType.BANK_CLOSE]: { playerId: string; bankId: string };
  [EventType.BANK_DEPOSIT]: BankDepositEvent;
  [EventType.BANK_WITHDRAW]: BankWithdrawEvent;
  [EventType.BANK_DEPOSIT_ALL]: { playerId: string; bankId: string };
  [EventType.BANK_DEPOSIT_SUCCESS]: BankDepositSuccessEvent;

  // UI Events
  [EventType.UI_ATTACK_STYLE_GET]: { playerId: string; callback?: (info: Record<string, unknown> | null) => void };
  [EventType.UI_MESSAGE]: UIMessageEvent;

  // Camera Events
  [EventType.CAMERA_FOLLOW_PLAYER]: { playerId: string; entity: { id: string; mesh: object }; camHeight: number };

  // Resource Events
  [EventType.RESOURCE_SPAWNED]: { id: string; type: 'tree' | 'fishing_spot' | 'ore' | 'herb_patch' | 'mine'; position: { x: number; y: number; z: number } };
  [EventType.RESOURCE_GATHERED]: { playerId: string; resourceType: 'tree' | 'rock' | 'ore' | 'herb' | 'fish'; skill: 'woodcutting' | 'mining' | 'fishing' | 'herbalism' };
  [EventType.RESOURCE_DEPLETED]: { resourceId: string };
  [EventType.RESOURCE_RESPAWNED]: { resourceId: string };
  [EventType.RESOURCE_GATHER]: { playerId: string; resourceId: string };
  [EventType.RESOURCE_HARVEST]: { playerId: string; resourceId: string; success: boolean };
  [EventType.RESOURCE_GATHERING_STARTED]: { playerId: string; resourceId: string; playerPosition: { x: number; y: number; z: number } };
  [EventType.RESOURCE_GATHERING_PROGRESS]: { playerId: string; resourceId: string; skill: string; actionName: string; duration: number; progress: number };
  [EventType.RESOURCE_GATHERING_STOPPED]: { playerId: string; resourceId: string };
  [EventType.RESOURCE_GATHERING_COMPLETED]: { playerId: string; resourceId: string; resourceType: 'tree' | 'rock' | 'ore' | 'herb' | 'fish'; skill: 'woodcutting' | 'mining' | 'fishing' | 'herbalism' };
  [EventType.RESOURCE_SPAWN_POINTS_REGISTERED]: { spawnPoints: Array<{ id: string; type: 'tree' | 'rock' | 'ore' | 'herb' | 'fish'; position: { x: number; y: number; z: number } }> };

  // Skills & XP System  
  [EventType.SKILLS_XP_GAINED]: { playerId: string; skill: 'attack' | 'strength' | 'defense' | 'constitution' | 'ranged' | 'woodcutting' | 'fishing' | 'firemaking' | 'cooking'; amount: number };
  [EventType.SKILLS_LEVEL_UP]: { playerId: string; skill: 'attack' | 'strength' | 'defense' | 'constitution' | 'ranged' | 'woodcutting' | 'fishing' | 'firemaking' | 'cooking'; newLevel: number; oldLevel: number };
  [EventType.SKILLS_UPDATED]: { playerId: string; skills: Record<'attack' | 'strength' | 'defense' | 'constitution' | 'ranged' | 'woodcutting' | 'fishing' | 'firemaking' | 'cooking', { level: number; xp: number }> };

  // Chat System  
  [EventType.CHAT_SEND]: { playerId: string; message: string };
  [EventType.CHAT_MESSAGE]: { playerId: string; text: string };

  // Item Actions
  [EventType.ITEM_USE_ON_FIRE]: { playerId: string; itemId: number; itemSlot?: number; fireId: string };
  [EventType.ITEM_USE_ON_ITEM]: {
    playerId: string;
    // Two producer variants exist; we support both field names
    primaryItemId?: number;
    primarySlot?: number;
    itemId?: number;
    targetItemId: number;
    targetSlot?: number;
  };
  [EventType.ITEM_ON_ITEM]: { playerId: string; sourceItemId: string; targetItemId: string };
  [EventType.ITEM_RIGHT_CLICK]: { playerId: string; itemId: string; slot: number };
  [EventType.ITEM_ACTION_EXECUTE]: { playerId: string; action: 'eat' | 'drink' | 'light' | 'use' | 'wield' | 'wear'; itemId: string };
  [EventType.ITEM_EXAMINE]: { playerId: string; itemId: string };

  // Additional Inventory Events
  [EventType.INVENTORY_REMOVE_ITEM]: { playerId: string; itemId: string; quantity: number };
  [EventType.INVENTORY_ADD_COINS]: { playerId: string; amount: number };


  // Corpse System
  [EventType.CORPSE_SPAWNED]: { corpseId: string; position: { x: number; y: number; z: number }; loot: Array<{ itemId: string; quantity: number; rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' }> };
  [EventType.CORPSE_CLICK]: { corpseId: string; playerId: string };
  [EventType.CORPSE_LOOT_REQUEST]: { corpseId: string; playerId: string };
  [EventType.CORPSE_CLEANUP]: { corpseId: string };

  // Fire System
  [EventType.FIRE_EXTINGUISHED]: { fireId: string };
  [EventType.FIRE_CREATED]: { fireId: string; playerId: string };

  // Additional Store Events
  [EventType.STORE_OPEN]: StoreOpenEvent;
  [EventType.STORE_CLOSE]: StoreCloseEvent;
  [EventType.STORE_BUY]: StoreBuyEvent;
  [EventType.STORE_SELL]: StoreSellEvent;
  [EventType.STORE_REGISTER_NPC]: { npcId: string; storeId: string; position: { x: number; y: number; z: number }; name: string; area: string };
  [EventType.STORE_PLAYER_COINS]: { playerId: string; coins: number };

  // Additional UI Events
  [EventType.UI_UPDATE]: { playerId: string; component: 'inventory' | 'equipment' | 'skills' | 'chat' | 'bank' | 'store'; data: Record<string, string | number | boolean> };
  [EventType.UI_REQUEST]: { playerId: string };
  [EventType.UI_CONTEXT_MENU]: { playerId: string; x: number; y: number; itemId: string; actions: Array<'use' | 'drop' | 'examine' | 'equip' | 'unequip'> };
  [EventType.UI_COMPLEX_INTERACTION]: { playerId: string; action: 'drag' | 'doubleclick' | 'rightclick' | 'hover'; target: string };

  [EventType.UI_CREATE]: { uiId: string; uiType: 'inventory' | 'equipment' | 'skills' | 'chat' | 'bank' | 'store' | 'dialog'; data: Record<string, string | number | boolean> };
  [EventType.UI_OPEN_MENU]: (
    { playerId: string; inventoryElement: HTMLElement; equipmentElement?: HTMLElement } |
    { playerId: string; actions: Array<'use' | 'drop' | 'examine' | 'equip' | 'unequip'>; menuType: 'context' | 'main' | 'options' } |
    { playerId: string; type: 'context'; position: { x: number; y: number }; actions: Array<{ id: string; label: string; icon?: string; enabled: boolean; onClick: () => void }>; targetId: string; targetType: 'resource' }
  );
  [EventType.UI_CLOSE_MENU]: { playerId?: string; menuType?: 'context' | 'main' | 'options' } | Record<string, never>;
  [EventType.UI_CLOSE_ALL]: { playerId: string };
  [EventType.UI_SET_VIEWPORT]: { width: number; height: number };
  [EventType.UI_DRAG_DROP]: { playerId: string; sourceId: string; targetId: string };
  [EventType.UI_BANK_DEPOSIT]: { playerId: string; itemId: string; quantity: number };
  [EventType.UI_BANK_WITHDRAW]: { playerId: string; itemId: string; quantity: number };
  [EventType.UI_HEALTH_UPDATE]: { playerId: string; health: number; maxHealth: number };
  [EventType.UI_PLAYER_UPDATE]: { playerId: string; playerData: { health: number; maxHealth: number; level: number; xp: number } };
  [EventType.UI_EQUIPMENT_UPDATE]: { playerId: string; equipment: Record<EquipmentSlotName, { itemId: string; name: string } | null> };

  // XR Events
  [EventType.XR_SESSION]: XRSession | null;

  // Stats System
  [EventType.STATS_UPDATE]: { playerId: string; stats: Record<'attack' | 'strength' | 'defense' | 'constitution' | 'ranged' | 'woodcutting' | 'fishing' | 'firemaking' | 'cooking', { level: number; xp: number }> };

  // Persistence System
  [EventType.PERSISTENCE_SAVE]: { playerId: string; data: { skills: Record<string, { level: number; xp: number }>; inventory: Array<{ itemId: string; quantity: number; slot: number }>; equipment: Record<string, { itemId: string; name: string } | null> } };

  // Physics Test Events
  [EventType.PHYSICS_TEST_RUN_ALL]: void;
  [EventType.PHYSICS_TEST_BALL_RAMP]: void;
  [EventType.PHYSICS_TEST_CUBE_DROP]: void;
  [EventType.PHYSICS_TEST_CHARACTER_COLLISION]: void;
  [EventType.PHYSICS_PRECISION_RUN_ALL]: void;
  [EventType.PHYSICS_PRECISION_PROJECTILE]: void;
  [EventType.PHYSICS_PRECISION_COMPLETED]: { report: { testsPassed: number; testsFailed: number; errors: string[]; duration: number } };

  // General Test Events
  [EventType.TEST_RUN_ALL]: void;
  [EventType.TEST_PLAYER_REMOVE]: { id: string };

  // Physics Validation Events
  [EventType.PHYSICS_VALIDATION_REQUEST]: void;
  [EventType.PHYSICS_VALIDATION_COMPLETE]: {
    isValid: boolean;
    errors: Array<{
      type: 'missing_collision' | 'height_mismatch' | 'invalid_geometry' | 'underground_entity' | 'floating_entity';
      position: { x: number; y: number; z: number };
      severity: 'critical' | 'warning' | 'info';
      message: string;
      timestamp: number;
      expectedHeight?: number;
      actualHeight?: number;
      heightDifference?: number;
      entityId?: string;
    }>;
    totalChecks: number;
    successfulChecks: number;
    averageHeight: number;
    maxHeightDifference: number;
    validationTime: number;
  };
  [EventType.PHYSICS_GROUND_CLAMP]: {
    entityId: string;
    position?: Position3D;
    options?: {
      raycastDistance?: number;
      verticalOffset?: number;
      layerMask?: number;
      allowUnderground?: boolean;
      snapToSurface?: boolean;
      smoothing?: boolean;
      smoothingFactor?: number;
    };
  };
  // Visual Test Framework
  [EventType.TEST_STATION_CREATED]: { station: Record<string, unknown> };
  [EventType.TEST_RESULT]: { stationId: string; result: { success: boolean; error?: string; duration: number; details?: Record<string, unknown> } };
}

/**
 * Type-safe event emitter interface
 */
export interface TypedEventEmitter {
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
  on<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void;
  off<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void;
  once<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void;
}

/**
 * Helper type to extract event payload type
 */
export type EventPayload<K extends keyof EventMap> = EventMap[K];

/**
 * Helper type to ensure event name is valid
 */
export type ValidEventName = keyof EventMap;

/**
 * Helper function to create a typed event payload
 */
export function createEventPayload<K extends keyof EventMap>(
  event: K,
  data: EventMap[K]
): { event: K; data: EventMap[K] } {
  return { event, data };
}