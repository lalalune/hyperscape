import * as Payloads from './event-payloads'

/**
 * Event Types
 * Defines all event types used in the system
 */

import type { Position3D } from './core';

// Banking Events
export interface BankDepositEvent {
  playerId: string;
  itemId: string;
  quantity: number;
}

export interface BankWithdrawEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  slotIndex: number;
}

export interface BankDepositSuccessEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  bankId: string;
}

// Store Events
export interface StoreTransactionEvent {
  playerId: string;
  storeId: string;
  itemId: string;
  quantity: number;
  totalCost: number;
  transactionType: 'buy' | 'sell';
}

export interface StoreOpenEvent {
  playerId: string;
  storeId: string;
  playerPosition: Position3D;
}

export interface StoreCloseEvent {
  playerId: string;
  storeId: string;
}

export interface StoreBuyEvent {
  playerId: string;
  storeId: string;
  itemId: string;
  quantity: number;
}

export interface StoreSellEvent {
  playerId: string;
  storeId: string;
  itemId: string;
  quantity: number;
}

// Inventory Events
export interface InventoryUpdateEvent {
  playerId: string;
  itemId: string;
  previousQuantity: number;
  newQuantity: number;
  action: 'add' | 'remove' | 'update';
}

export interface InventoryAddEvent {
  playerId: string;
  itemId: string;
  quantity: number;
}

export interface InventoryCanAddEvent {
  playerId: string;
  item: {
    id: string;
    name: string;
    quantity: number;
    stackable: boolean;
  };
  callback: (canAdd: boolean) => void;
}

export interface InventoryCheckEvent {
  playerId: string;
  itemId: string;
  quantity: number;
  callback: (hasItem: boolean, inventorySlot: InventoryItemInfo | null) => void;
}
export interface InventoryGetCoinsEvent {
  playerId: string;
  callback: (coins: number) => void;
}

export interface InventoryHasEquippedEvent {
  playerId: string;
  slot: string;
  itemType: string;
  callback: (hasEquipped: boolean) => void;
}

export interface InventoryRemoveCoinsEvent {
  playerId: string;
  amount: number;
}

export interface InventoryRemoveEvent {
  playerId: string;
  itemId: string;
  quantity: number;
}

export interface InventoryItemInfo {
  id: string;
  name: string;
  quantity: number;
  stackable: boolean;
  slot: string | null;
}

// Player Events
export interface PlayerInitEvent {
  playerId: string;
  position: Position3D;
  isNewPlayer: boolean;
}

export interface PlayerEnterEvent {
  playerId: string;
  userId?: string; // Database user ID for persistence
}

export interface PlayerLeaveEvent {
  playerId: string;
  userId?: string; // Database user ID for persistence
}

export interface PlayerLevelUpEvent {
  playerId: string;
  previousLevel: number;
  newLevel: number;
  skill: string;
}

export interface PlayerXPGainEvent {
  playerId: string;
  skill: string;
  xpGained: number;
  currentXP: number;
  currentLevel: number;
}

export interface HealthUpdateEvent {
  entityId: string;
  previousHealth: number;
  currentHealth: number;
  maxHealth: number;
}

export interface PlayerDeathEvent {
  playerId: string;
  deathLocation: Position3D;
  cause: string;
}

export interface PlayerRespawnRequestEvent {
  playerId: string;
  requestTime: number;
}

export interface PlayerRegisterEvent {
  id: string;
  playerId: string;
  entity: import('../entities/PlayerLocal').PlayerLocal;
}

// UI Events
export interface UIMessageEvent {
  playerId: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  duration: number; // 0 for permanent
}

// Player Events
export interface AvatarReadyEvent {
  playerId: string;
  avatar: unknown; // THREE.Object3D - avoiding direct three.js dependency
  camHeight: number;
}

export interface PlayerPositionUpdateEvent {
  playerId: string;
  position: { x: number; y: number; z: number };
}

// Combat Events  
export interface CombatSessionEvent {
  sessionId: string;
  attackerId: string;
  targetId: string;
}

export interface CombatHitEvent {
  sessionId: string;
  attackerId: string;
  targetId: string;
  damage: number;
  hitType: string;
}

// Item Events
export interface ItemSpawnedEvent {
  itemId: string;
  position: { x: number; y: number; z: number };
}

export interface EventData<T = Record<string, unknown>> {
  type: EventType;
  data: T;
  timestamp: number;
  source: string | null;
}

export enum EventType {
  // General System
  READY = 'ready',
  ERROR = 'error',
  TICK = 'tick',

  // Player Core
  PLAYER_JOINED = 'player:joined',
  PLAYER_LEFT = 'player:left',
  PLAYER_LOGOUT = 'player:logout',
  PLAYER_RECONNECTED = 'player:reconnected',
  PLAYER_AVATAR_READY = 'player:avatar_ready',
  PLAYER_INIT = 'player:init',
  PLAYER_READY = 'player:ready',
  PLAYER_REGISTERED = 'player:registered',
  PLAYER_UNREGISTERED = 'player:unregistered',
  PLAYER_CLEANUP = 'player:cleanup',
  PLAYER_AUTHENTICATED = 'player:authenticated',
  PLAYER_UPDATED = 'player:updated',
  PLAYER_SPAWNED = 'player:spawned',
  PLAYER_SPAWN_REQUEST = 'player:spawn_request',
  PLAYER_DATA_LOADED = 'player:data_loaded',
  PLAYER_DATA_SAVED = 'player:data_saved',
  PLAYER_SESSION_STARTED = 'player:session_started',
  PLAYER_SESSION_ENDED = 'player:session_ended',
  PLAYER_CREATE = 'player:create',
  PLAYER_SPAWN_COMPLETE = 'player:spawn_complete',
  PLAYER_ANIMATION = 'player:animation',
  
  // Entity Management
  ENTITY_CREATED = 'entity:created',
  ENTITY_UPDATED = 'entity:updated',
  ENTITY_INTERACT = 'entity:interact',
  ENTITY_MOVE_REQUEST = 'entity:move_request',
  ENTITY_PROPERTY_REQUEST = 'entity:property_request',
  ENTITY_SPAWNED = 'entity:spawned',
  ENTITY_DEATH = 'entity:death',
  ENTITY_POSITION_CHANGED = 'entity:position_changed',
  ENTITY_UNDERGROUND_DETECTED = 'entity:underground_detected',
  ENTITY_POSITION_CORRECTED = 'entity:position_corrected',
  ENTITY_COMPONENT_ADDED = 'entity:component:added',
  ENTITY_COMPONENT_REMOVED = 'entity:component:removed',

  // Asset Management
  ASSET_LOADED = 'asset:loaded',
  ASSETS_LOADING_PROGRESS = 'assets:loading:progress',

  // UI System
  UI_TOGGLE = 'ui:toggle',
  UI_OPEN_PANE = 'ui:open_pane',
  UI_CLOSE_PANE = 'ui:close_pane',
  UI_MENU = 'ui:menu',
  UI_AVATAR = 'ui:avatar',
  UI_KICK = 'ui:kick',
  UI_TOAST = 'ui:toast',
  UI_SIDEBAR_CHAT_TOGGLE = 'ui:sidebar:chat:toggle',
  UI_ACTIONS_UPDATE = 'ui:actions:update',
  UI_UPDATE = 'ui',

  // Network Communication
  NETWORK_CONNECTED = 'network:connected',
  NETWORK_DISCONNECTED = 'network:disconnected',
  NETWORK_MESSAGE_RECEIVED = 'network:message:received',
  NETWORK_ENTITY_UPDATES = 'network:entity_updates',

  // Client Communication
  CLIENT_CONNECT = 'client:connect',
  CLIENT_DISCONNECT = 'client:disconnect',
  CLIENT_ENTITY_SYNC = 'client:entity_sync',

  // Input System
  INPUT_KEY_DOWN = 'input:key:down',
  INPUT_KEY_UP = 'input:key:up',
  INPUT_POINTER_DOWN = 'input:pointer:down',
  INPUT_POINTER_UP = 'input:pointer:up',
  INPUT_POINTER_MOVE = 'input:pointer:move',

  // System Settings
  SETTINGS_CHANGED = 'settings:changed',

  // Graphics System
  GRAPHICS_RESIZE = 'graphics:resize',

  // XR System
  XR_SESSION = 'xr:session',

  // Terrain System
  TERRAIN_TILE_GENERATED = 'terrain:tile:generated',
  TERRAIN_VALIDATION_COMPLETE = 'terrain:validation:complete',
  TERRAIN_PHYSICS_READY = 'terrain:physics:ready',

  // Camera System
  CAMERA_SET_TARGET = 'camera:set_target',
  CAMERA_CLICK_WORLD = 'camera:click:world',
  CAMERA_SET_MODE = 'camera:set:mode',
  CAMERA_RESET = 'camera:reset',
  CAMERA_TAP = 'camera:tap',
  CAMERA_TARGET_CHANGED = 'camera:target:changed',

  // Movement System
  MOVEMENT_STOP = 'movement:stop',
  MOVEMENT_TOGGLE_RUN = 'movement:toggle:run',
  MOVEMENT_STARTED = 'movement:started',
  MOVEMENT_STOPPED = 'movement:stopped',
  MOVEMENT_SPEED_CHANGED = 'movement:speed:changed',
  MOVEMENT_STAMINA_DEPLETED = 'movement:stamina:depleted',
  PLAYER_STAMINA_UPDATE = 'player:stamina:update',

  // AI Navigation System
  AI_NAVIGATION_REQUEST = 'ai:navigation:request',
  AI_AGENT_REGISTER = 'ai:agent:register',
  AI_AGENT_UNREGISTER = 'ai:agent:unregister',
  AI_NAVIGATION_GRID_READY = 'ai:navigation:grid:ready',
  AI_AGENT_UNSTUCK = 'ai:agent:unstuck',

  // Test Framework Events
  TEST_STATION_CREATED = 'test:station:created',
  TEST_RESULT = 'test:result',


  // Test Visual Events
  TEST_UI_CREATE = 'test:ui:create',
  TEST_ZONE_CREATE = 'test:zone:create',
  TEST_UI_UPDATE = 'test:ui:update',
  TEST_ZONE_UPDATE = 'test:zone:update',
  TEST_PLAYER_CREATE = 'test:player:create',
  TEST_PLAYER_MOVE = 'test:player:move',
  TEST_CLEAR_UI = 'test:clear_ui',

  // Player Stats & Progression
  PLAYER_LEVEL_UP = 'player:level_up',
  PLAYER_LEVEL_CHANGED = 'player:level_changed',
  PLAYER_XP_GAINED = 'player:xp_gained',
  PLAYER_SKILLS_UPDATED = 'player:skills_updated',

  // Player Health & Status
  PLAYER_HEALTH_UPDATED = 'player:health_updated',
  PLAYER_DAMAGE = 'player:damage',
  PLAYER_DIED = 'player:died',
  PLAYER_RESPAWNED = 'player:respawned',
  PLAYER_RESPAWN_REQUEST = 'player:respawn_request',
  PLAYER_DESTROY = 'player:destroy',

  // Player Equipment & Stats
  PLAYER_EQUIPMENT_CHANGED = 'player:equipment_changed',
  PLAYER_EQUIPMENT_UPDATED = 'player:equipment_updated',
  PLAYER_STATS_EQUIPMENT_UPDATED = 'player:stats:equipment_updated',

  // Player Movement & Position
  PLAYER_POSITION_UPDATED = 'player:position:updated',
  PLAYER_TELEPORT_REQUEST = 'player:teleport_request',
  PLAYER_TELEPORTED = 'player:teleported',
  MOVEMENT_COMPLETED = 'movement:completed',
  MOVEMENT_CLICK_TO_MOVE = 'movement:click_to_move',

  // Player Combat Style
  ATTACK_STYLE_CHANGED = 'attack_style:changed',

  // Combat System
  COMBAT_STARTED = 'combat:started',
  COMBAT_ENDED = 'combat:ended',
  COMBAT_ATTACK = 'combat:attack',
  COMBAT_ATTACK_REQUEST = 'combat:attack_request',
  COMBAT_START_ATTACK = 'combat:start_attack',
  COMBAT_STOP_ATTACK = 'combat:stop_attack',
  COMBAT_ATTACK_STYLE_CHANGE = 'combat:attack_style:change',
  COMBAT_ATTACK_FAILED = 'combat:attack_failed',

  // Combat Types
  COMBAT_MELEE_ATTACK = 'combat:melee_attack',
  COMBAT_RANGED_ATTACK = 'combat:ranged_attack',
  COMBAT_MOB_ATTACK = 'combat:mob_attack',

  // Combat Calculations
  COMBAT_DAMAGE_DEALT = 'combat:damage_dealt',
  COMBAT_DAMAGE_CALCULATE = 'combat:damage_calculate',
  COMBAT_ACCURACY_CALCULATE = 'combat:accuracy_calculate',
  COMBAT_XP_CALCULATE = 'combat:xp_calculate',
  COMBAT_HEAL = 'combat:heal',
  COMBAT_MISS = 'combat:miss',
  COMBAT_ACTION = 'combat:action',
  COMBAT_KILL = 'combat:kill',

  // Aggro System
  AGGRO_PLAYER_LEFT = 'aggro:player_left',
  AGGRO_PLAYER_ENTERED = 'aggro:player_entered',
  AGGRO_MOB_AGGROED = 'aggro:mob_aggroed',

  // Inventory Management
  INVENTORY_INITIALIZED = 'inventory:initialized',
  INVENTORY_UPDATED = 'inventory:updated',
  INVENTORY_REQUEST = 'inventory:request',
  INVENTORY_FULL = 'inventory:full',

  // Inventory Items
  INVENTORY_ITEM_ADDED = 'inventory:item_added',
  INVENTORY_ITEM_REMOVED = 'inventory:item_removed',
  INVENTORY_MOVE = 'inventory:move',
  INVENTORY_USE = 'inventory:use',
  INVENTORY_EXAMINE_ITEM = 'inventory:examine_item',
  INVENTORY_CONSUME_ITEM = 'inventory:consume_item',

  // Inventory Queries
  INVENTORY_CHECK = 'inventory:check',
  INVENTORY_CAN_ADD = 'inventory:can_add',
  INVENTORY_HAS_ITEM = 'inventory:has_item',
  INVENTORY_HAS_EQUIPPED = 'inventory:has_equipped',

  // Inventory Interactions
  INVENTORY_ITEM_RIGHT_CLICK = 'inventory:item_right_click',

  // Inventory Currency
  INVENTORY_UPDATE_COINS = 'inventory:update_coins',
  INVENTORY_REMOVE_COINS = 'inventory:remove_coins',
  INVENTORY_COINS_UPDATED = 'inventory:coins_updated',

  // Item Lifecycle
  ITEM_SPAWNED = 'item:spawned',
  ITEM_SPAWN = 'item:spawn',
  ITEM_SPAWN_REQUEST = 'item:spawn_request',
  ITEM_SPAWN_LOOT = 'item:spawn_loot',
  ITEM_DESPAWN = 'item:despawn',
  ITEM_DESPAWNED = 'item:despawned',
  ITEM_RESPAWN_SHOPS = 'item:respawn_shops',

  // Item Actions
  ITEM_DROPPED = 'item:dropped',
  ITEM_DROP = 'item:drop',
  LOOT_DROPPED = 'loot:dropped',
  ITEM_PICKUP = 'item:picked_up',
  ITEM_PICKUP_REQUEST = 'item:pickup_request',
  ITEM_USED = 'item:used',
  ITEM_ACTION_SELECTED = 'item:action_selected',
  ITEMS_RETRIEVED = 'items:retrieved',

  // Equipment System
  EQUIPMENT_EQUIP = 'equipment:equip',
  EQUIPMENT_UNEQUIP = 'equipment:unequip',
  EQUIPMENT_TRY_EQUIP = 'equipment:try_equip',
  EQUIPMENT_FORCE_EQUIP = 'equipment:force_equip',
  EQUIPMENT_CONSUME_ARROW = 'equipment:consume_arrow',
  EQUIPMENT_EQUIPPED = 'equipment:equipped',
  EQUIPMENT_UNEQUIPPED = 'equipment:unequipped',
  EQUIPMENT_CAN_EQUIP = 'equipment:can_equip',

  // Interaction System
  INTERACTION_REGISTER = 'interaction:register',
  INTERACTION_UNREGISTER = 'interaction:unregister',

  // NPC System
  NPC_SPAWNED = 'npc:spawned',
  NPC_SPAWN_REQUEST = 'npc:spawn_request',
  NPC_INTERACTION = 'npc:interaction',
  NPC_DIALOGUE = 'npc:dialogue',

  // Quest System
  QUEST_STARTED = 'quest:started',
  QUEST_PROGRESSED = 'quest:progressed',
  QUEST_COMPLETED = 'quest:completed',

  // Mobs
  MOB_SPAWNED = 'mob:spawned',
  MOB_SPAWN_REQUEST = 'mob:spawn_request',
  MOB_SPAWN_POINTS_REGISTERED = 'mob:spawn_points:registered',
  MOB_DESPAWN = 'mob:despawn',
  MOB_DESPAWNED = 'mob:despawned',
  MOB_RESPAWN_ALL = 'mob:respawn_all',
  MOB_DAMAGED = 'mob:damaged',
  MOB_POSITION_UPDATED = 'mob:position_updated',
  MOB_ATTACKED = 'mob:attacked',
  MOB_DIED = 'mob:died',
  MOB_CHASE_STARTED = 'mob:chase:started',
  MOB_CHASE_ENDED = 'mob:chase:ended',
  MOB_MOVE_REQUEST = 'mob:move:request',
  MOB_DESTROY = 'mob:destroy',

  // Banking System
  BANK_OPEN = 'bank:open',
  BANK_CLOSE = 'bank:close',
  BANK_DEPOSIT = 'bank:deposit',
  BANK_DEPOSIT_SUCCESS = 'bank:deposit_success',
  BANK_DEPOSIT_FAIL = 'bank:deposit_fail',
  BANK_DEPOSIT_ALL = 'bank:deposit_all',
  BANK_WITHDRAW = 'bank:withdraw',
  BANK_WITHDRAW_SUCCESS = 'bank:withdraw_success',
  BANK_WITHDRAW_FAIL = 'bank:withdraw_fail',
  BANK_REMOVE = 'bank:remove',
  BANK_CREATE = 'bank:create',

  // Store System
  STORE_OPEN = 'store:open',
  STORE_CLOSE = 'store:close',
  STORE_BUY = 'store:buy',
  STORE_SELL = 'store:sell',
  STORE_REGISTER_NPC = 'store:register_npc',
  STORE_TRANSACTION = 'store:transaction',
  STORE_PLAYER_COINS = 'store:player_coins',

  // UI System
  UI_ATTACK_STYLE_GET = 'ui:attack_style:get',
  UI_ATTACK_STYLE_UPDATE = 'ui:attack_style:update',
  UI_ATTACK_STYLE_CHANGED = 'ui:attack_style:changed',
  UI_MESSAGE = 'ui:message',
  UI_REQUEST = 'ui:request',
  UI_CONTEXT_ACTION = 'ui:context_action',

  // Camera & Avatar
  CAMERA_FOLLOW_PLAYER = 'camera:follow_player',

  // Resource System
  RESOURCE_SPAWNED = 'resource:spawned',
  RESOURCE_GATHER = 'resource:gather',
  RESOURCE_GATHERED = 'resource:gathered',
  RESOURCE_HARVEST = 'resource:harvest',
  RESOURCE_DEPLETED = 'resource:depleted',
  RESOURCE_RESPAWNED = 'resource:respawned',
  RESOURCE_GATHERING_STARTED = 'resource:gathering:started',
  RESOURCE_GATHERING_PROGRESS = 'resource:gathering:progress',
  RESOURCE_GATHERING_STOPPED = 'resource:gathering:stopped',

  // Resource Validation Events
  RESOURCE_VALIDATION_REQUEST = 'resource:validation:request',
  RESOURCE_VALIDATION_COMPLETE = 'resource:validation:complete',
  RESOURCE_PLACEMENT_VALIDATE = 'resource:placement:validate',
  RESOURCE_RESPAWN_READY = 'resource:respawn:ready',
  RESOURCE_GATHERING_COMPLETED = 'resource:gathering:completed',
  RESOURCE_SPAWN_POINTS_REGISTERED = 'resource:spawn_points:registered',
  RESOURCE_ACTION = 'resource:action',

  // Skills & XP System
  SKILLS_XP_GAINED = 'skills:xp_gained',
  SKILLS_LEVEL_UP = 'skills:level_up',
  SKILLS_UPDATED = 'skills:updated',

  // Chat System
  CHAT_SEND = 'chat:send',
  CHAT_MESSAGE = 'chat:message',

  // Item Actions
  ITEM_USE_ON_FIRE = 'item:use_on_fire',
  ITEM_USE_ON_ITEM = 'item:use_on_item',
  ITEM_ON_ITEM = 'item:on:item',
  ITEM_RIGHT_CLICK = 'item:right_click',
  ITEM_ACTION_EXECUTE = 'item:action:execute',
  ITEM_EXAMINE = 'item:examine',
  ITEM_CONSUME = 'item:consume',

  // Additional Inventory Events
  INVENTORY_REMOVE_ITEM = 'inventory:remove_item',
  INVENTORY_ADD_COINS = 'inventory:add_coins',

  // Corpse System
  CORPSE_SPAWNED = 'corpse:spawned',
  CORPSE_CLICK = 'corpse:click',
  CORPSE_LOOT_REQUEST = 'corpse:loot_request',
  CORPSE_CLEANUP = 'corpse:cleanup',

  // Fire System
  FIRE_EXTINGUISHED = 'fire:extinguished',
  FIRE_CREATED = 'fire:created',

  // Cooking System
  COOKING_COMPLETED = 'cooking:completed',

  // Processing System
  PROCESSING_FIREMAKING_REQUEST = 'processing:firemaking:request',
  PROCESSING_COOKING_REQUEST = 'processing:cooking:request',

  // Additional UI Events
  UI_CREATE = 'ui:create',
  UI_OPEN_MENU = 'ui:open_menu',
  UI_CLOSE_MENU = 'ui:close_menu',
  UI_CONTEXT_MENU = 'ui:context_menu',
  UI_CLOSE_ALL = 'ui:close_all',
  UI_SET_VIEWPORT = 'ui:set_viewport',
  UI_DRAG_DROP = 'ui:drag_drop',
  UI_BANK_DEPOSIT = 'ui:bank_deposit',
  UI_BANK_WITHDRAW = 'ui:bank_withdraw',
  UI_HEALTH_UPDATE = 'ui:update_health',
  UI_PLAYER_UPDATE = 'ui:player_update',
  UI_EQUIPMENT_UPDATE = 'ui:equipment_update',
  UI_KEYBOARD_TEST = 'ui:keyboard_test',
  UI_SCREEN_READER_TEST = 'ui:screen_reader_test',
  UI_CONTRAST_TEST = 'ui:contrast_test',
  UI_COMPLEX_INTERACTION = 'ui:complex_interaction',
  UI_INTERACTION_VALIDATION = 'ui:interaction_validation',
  UI_TRIGGER_ERROR = 'ui:trigger_error',
  UI_TEST_RECOVERY = 'ui:test_recovery',
  UI_RESILIENCE_TEST = 'ui:resilience_test',

  // Stats System
  STATS_UPDATE = 'stats:update',

  // Persistence System
  PERSISTENCE_SAVE = 'persistence:save',
  PERSISTENCE_LOAD = 'persistence:load',

  // Chunk System
  CHUNK_LOADED = 'chunk:loaded',
  CHUNK_UNLOADED = 'chunk:unloaded',

  // Pathfinding System
  PATHFINDING_REQUEST = 'pathfinding:request',

  // Physics Test Events
  PHYSICS_TEST_RUN_ALL = 'physics:test:run_all',
  PHYSICS_TEST_BALL_RAMP = 'physics:test:ball_ramp',
  PHYSICS_TEST_CUBE_DROP = 'physics:test:cube_drop',
  PHYSICS_TEST_CHARACTER_COLLISION = 'physics:test:character_collision',
  PHYSICS_PRECISION_RUN_ALL = 'physics:precision:run_all',
  PHYSICS_PRECISION_PROJECTILE = 'physics:precision:projectile',
  PHYSICS_PRECISION_COMPLETED = 'physics:precision:completed',

  // Physics Validation Events
  PHYSICS_VALIDATION_REQUEST = 'physics:validation:request',
  PHYSICS_VALIDATION_COMPLETE = 'physics:validation:complete',
  PHYSICS_GROUND_CLAMP = 'physics:ground_clamp',

  // General Test Events
  TEST_RUN_ALL = 'test:run_all',
  TEST_PLAYER_REMOVE = 'test:player:remove',
  TEST_BANK_CREATE = 'test:bank:create',
  TEST_BANK_REMOVE = 'test:bank:remove',
  TEST_STORE_CREATE = 'test:store:create',
  TEST_STORE_REMOVE = 'test:store:remove',
  TEST_NPC_CREATE = 'test:npc:create',
  TEST_NPC_REMOVE = 'test:npc:remove',
  TEST_ITEM_CREATE = 'test:item:create',
  TEST_ITEM_REMOVE = 'test:item:remove',
  TEST_TREE_CREATE = 'test:tree:create',
  TEST_TREE_REMOVE = 'test:tree:remove',
  TEST_FISHING_SPOT_CREATE = 'test:fishing_spot:create',
  TEST_FISHING_SPOT_REMOVE = 'test:fishing_spot:remove',
  TEST_FIRE_EXTINGUISH = 'test:fire:extinguish',
  TEST_TEXT_CREATE = 'test:text:create',
  TEST_WAYPOINT_CREATE = 'test:waypoint:create',
  TEST_WAYPOINT_UPDATE = 'test:waypoint:update',
  TEST_WAYPOINT_REMOVE = 'test:waypoint:remove',
  TEST_OBSTACLE_CREATE = 'test:obstacle:create',
  TEST_OBSTACLE_REMOVE = 'test:obstacle:remove',
  TEST_BARRIER_CREATE = 'test:barrier:create',
  TEST_BARRIER_REMOVE = 'test:barrier:remove',
  TEST_TELEPORT_TARGET_CREATE = 'test:teleport_target:create',
  TEST_TELEPORT_TARGET_UPDATE = 'test:teleport_target:update',
  TEST_TELEPORT_TARGET_REMOVE = 'test:teleport_target:remove',
  TEST_EQUIPMENT_RACK_CREATE = 'test:equipment_rack:create',
  TEST_EQUIPMENT_RACK_REMOVE = 'test:equipment_rack:remove',
  TEST_EQUIPMENT_SLOT_CREATE = 'test:equipment_slot:create',
  TEST_EQUIPMENT_SLOT_REMOVE = 'test:equipment_slot:remove',
  TEST_EQUIPMENT_SLOT_UPDATE = 'test:equipment_slot:update',
  TEST_RUN_FIREMAKING_TESTS = 'test:run_firemaking_tests',
  TEST_RUN_COOKING_TESTS = 'test:run_cooking_tests',

  // Death System Events
  DEATH_LOOT_COLLECT = 'death:loot:collect',
  DEATH_HEADSTONE_EXPIRED = 'death:headstone:expired',
  INVENTORY_DROP_ALL = 'inventory:drop_all',
  PLAYER_SET_DEAD = 'player:set_dead',
  UI_DEATH_SCREEN = 'ui:death_screen',
  UI_DEATH_SCREEN_CLOSE = 'ui:death_screen:close',
  DEATH_LOOT_HEADSTONE = 'death:loot_headstone',
  ENTITY_CREATE_HEADSTONE = 'entity:create_headstone',
  ENTITY_REMOVE = 'entity:remove',
  WORLD_CREATE_GROUND_ITEM = 'world:create_ground_item',

  // Biome Visualization Events
  BIOME_TOGGLE_VISUALIZATION = 'biome:toggle_visualization',
  BIOME_SHOW_AREA = 'biome:show_area',
  BIOME_HIDE_AREA = 'biome:hide_area',

  // Test Runner Events
  TEST_ALL_COMPLETED = 'test:all_completed',
  TEST_REPORT = 'test:report',
  TEST_SPAWN_CUBE = 'test:spawn_cube',
  TEST_CLEAR_CUBES = 'test:clear_cubes',

  // Physics Events
  PHYSICS_REGISTER = 'physics:register',
  PHYSICS_UNREGISTER = 'physics:unregister',

  // Animation Events
  ANIMATION_COMPLETE = 'animation:complete',
  ANIMATION_PLAY = 'animation:play',

  // Terrain Events
  TERRAIN_CONFIGURE = 'terrain:configure',
  TERRAIN_SPAWN_RESOURCE = 'terrain:spawn_resource',

  // Skills System Events
  SKILLS_ACTION = 'skills:action',
  SKILLS_RESET = 'skills:reset',
  SKILLS_MILESTONE = 'skills:milestone',
  COMBAT_LEVEL_CHANGED = 'combat:level:changed',
  TOTAL_LEVEL_CHANGED = 'total:level:changed',

  // Damage & Healing Events
  PLAYER_DAMAGE_TAKEN = 'player:damage:taken',
  PLAYER_HEALING_RECEIVED = 'player:healing:received',
  ENTITY_DAMAGE_TAKEN = 'entity:damage:taken',
  ENTITY_HEALING_RECEIVED = 'entity:healing:received',
  ENTITY_HEALTH_CHANGED = 'entity:health:changed',
  ENTITY_REVIVED = 'entity:revived',

  // World Events
  WORLD_LOAD_AREA = 'world:load_area',
  WORLD_UNLOAD_AREA = 'world:unload_area',

  // Test framework events
  TEST_RUN_SUITE = 'test:run_suite',

  // World generation events
  WORLD_GENERATE = 'world:generate',
  WORLD_SPAWN_STRUCTURE = 'world:spawn_structure',
  ANIMATION_CANCEL = 'animation:cancel',
  AVATAR_LOAD_COMPLETE = 'avatar_load_complete',
}

export type EventPayloads = {
  // Core Events
  [EventType.PLAYER_JOINED]: Payloads.PlayerJoinedPayload
  [EventType.ENTITY_CREATED]: Payloads.EntityCreatedPayload

  // Events
  [EventType.PLAYER_LEVEL_UP]: Payloads.PlayerLevelUpPayload
  [EventType.PLAYER_XP_GAINED]: Payloads.PlayerXPGainedPayload
  [EventType.COMBAT_STARTED]: Payloads.CombatStartedPayload
  [EventType.INVENTORY_ITEM_ADDED]: Payloads.InventoryItemAddedPayload
  [EventType.MOB_DIED]: Payloads.MobDiedPayload
}

// Generic event base type for event payloads
// Use a more flexible type that can handle complex nested objects
export type AnyEvent = Record<string, unknown>
